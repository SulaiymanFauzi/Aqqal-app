import asyncio
import json
from contextlib import suppress
from typing import Any, Callable, Dict, List, Optional, Tuple

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from google import genai
from google.genai import types as genai_types

from api_tools import execute_tool
from models import ChatMessage, ChatRequest, ChatResponse, StreamEvent
from settings import (
    ALLOW_ALL_ORIGINS,
    ALLOWED_ORIGINS,
    DEFAULT_MAX_OUTPUT_TOKENS,
    DEFAULT_MODEL,
    DEFAULT_SYSTEM_PROMPT,
    GOOGLE_API_KEY,
    MAX_OUTPUT_TOKENS_CAP,
    PORT,
    TOOL_USAGE_DIRECTIVE,
)
from utils import (
    build_tools_instruction,
    extract_function_call_from_response,
    get_function_declaration_models,
    get_tool_names,
)

app = FastAPI(title="Aqqal FastAPI Backend", version="0.1.0")

# CORS setup
if ALLOW_ALL_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
# ----- Utilities -----

def _split_system_and_convert_contents(messages: List[ChatMessage]):
    system_parts: List[str] = []
    contents = []

    for m in messages:
        if m.role == "system":
            if m.content and m.content.strip():
                system_parts.append(m.content.strip())
            continue

        role = "user" if m.role == "user" else "model"  # assistant -> model
        contents.append({
            "role": role,
            "parts": [
                {"text": m.content}
            ],
        })

    system_instruction = "\n\n".join(system_parts) if system_parts else None
    return system_instruction, contents


def _extract_text_from_genai2_response(resp) -> Optional[str]:
    """Safely extract text from google-genai response without triggering quick accessor errors."""
    # Try quick accessor but guard exceptions
    try:
        t = getattr(resp, "text", None)
        if t:
            return t
    except Exception:
        pass

    # Fallback to candidates -> content -> parts
    try:
        candidates = getattr(resp, "candidates", None)
        if not candidates:
            return None
        first = candidates[0]
        content = getattr(first, "content", None)
        parts = getattr(content, "parts", None) if content is not None else None
        if not parts:
            return None
        buf: List[str] = []
        for p in parts:
            try:
                pt = getattr(p, "text", None)
            except Exception:
                pt = None
            if pt:
                buf.append(pt)
            elif isinstance(p, dict):
                pt = p.get("text")
                if pt:
                    buf.append(pt)
        return "".join(buf) if buf else None
    except Exception:
        return None


# ----- Routes -----

@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/")
async def root():
    return {
        "name": "Aqqal FastAPI Backend",
        "version": "0.1.0",
        "endpoints": ["GET /health", "POST /chat"],
        "default_model": DEFAULT_MODEL,
    }


@app.post("/chat", response_model=ChatResponse)
async def chat(body: ChatRequest):
    if not GOOGLE_API_KEY:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY is not set. Provide it in backend/.env.")

    client = genai.Client(api_key=GOOGLE_API_KEY)
    model_name = body.model or DEFAULT_MODEL

    # Extract system instruction from messages unless explicitly provided
    extracted_system_instruction, contents = _split_system_and_convert_contents(body.messages)
    effective_base_system_instruction = (
        body.system_instruction or extracted_system_instruction or DEFAULT_SYSTEM_PROMPT
    )
    if effective_base_system_instruction:
        system_instruction = f"{effective_base_system_instruction}\n\n{TOOL_USAGE_DIRECTIVE}"
    else:
        system_instruction = TOOL_USAGE_DIRECTIVE
    # Effective output token budget (request overrides env default)
    effective_max_output_tokens = body.max_output_tokens or DEFAULT_MAX_OUTPUT_TOKENS

    if not contents:
        raise HTTPException(status_code=400, detail="No user/assistant messages provided.")

    try:
        tools_used: List[str] = []
        use_search = body.use_search if body.use_search is not None else False

        # Always build tool-aware system instruction
        tool_names = get_tool_names()
        announced_tool_names = list(tool_names)
        if use_search:
            announced_tool_names.append("google_search")
        tool_si = build_tools_instruction(announced_tool_names)
        si_for_tools = (
            f"{system_instruction}\n\n{tool_si}" if system_instruction else tool_si
        )

        # Assemble tool entries (function declarations + optional Google Search)
        function_declarations = get_function_declaration_models()
        tool_entries: List[genai_types.Tool] = []
        if function_declarations:
            tool_entries.append(genai_types.Tool(function_declarations=function_declarations))
        if use_search:
            tool_entries.append(genai_types.Tool(google_search=genai_types.GoogleSearch()))

        cfg_kwargs = {
            "temperature": body.temperature,
            "max_output_tokens": effective_max_output_tokens,
            "system_instruction": si_for_tools,
            "tools": tool_entries or None,
        }
        thinking_cls = getattr(genai_types, "ThinkingConfig", None)
        if thinking_cls is not None:
            try:
                cfg_kwargs["thinking_config"] = thinking_cls(include_thoughts=True)
            except Exception:
                pass
        try:
            generation_config = genai_types.GenerateContentConfig(
                **{k: v for k, v in cfg_kwargs.items() if v is not None}
            )
        except Exception:
            fallback_kwargs = {"system_instruction": si_for_tools}
            if tool_entries:
                fallback_kwargs["tools"] = tool_entries
            generation_config = genai_types.GenerateContentConfig(**fallback_kwargs)

        def _get_genai1_finish_reason(resp) -> Optional[str]:
            try:
                candidates = getattr(resp, "candidates", None)
                if not candidates:
                    return None
                first = candidates[0]
                fr = getattr(first, "finish_reason", None)
                if fr is None and isinstance(first, dict):
                    fr = first.get("finish_reason") or first.get("finishReason")
                return str(fr) if fr is not None else None
            except Exception:
                return None

        def _stream_generate_content(
            contents_input,
            config_input,
            event_sink: Optional[Callable[[StreamEvent], None]] = None,
        ) -> Tuple[
            Optional[str],
            Optional[str],
            List[StreamEvent],
            Optional[Tuple[str, Dict[str, Any], Optional[Dict[str, Any]]]],
            Optional[str],
        ]:
            thought_parts: List[str] = []
            answer_parts: List[str] = []
            events: List[StreamEvent] = []
            finish_reason_local: Optional[str] = None
            function_call_local: Optional[Tuple[str, Dict[str, Any], Optional[Dict[str, Any]]]] = None

            stream = client.models.generate_content_stream(
                model=model_name,
                contents=contents_input,
                config=config_input,
            )

            thoughts_printed = False
            answer_printed = False

            for chunk in stream:
                candidate = getattr(chunk, "candidates", None)
                parts = None
                if candidate:
                    first_candidate = candidate[0]
                    content = getattr(first_candidate, "content", None)
                    parts = getattr(content, "parts", None) if content is not None else None

                extracted_fc = extract_function_call_from_response(chunk)
                if function_call_local is None and extracted_fc:
                    function_call_local = extracted_fc

                chunk_finish_reason = _get_genai1_finish_reason(chunk)
                if chunk_finish_reason:
                    finish_reason_local = chunk_finish_reason

                if not parts:
                    chunk_text = getattr(chunk, "text", None)
                    if chunk_text:
                        if not answer_printed:
                            print("Answer:")
                            answer_printed = True
                        print(chunk_text, end="", flush=True)
                        ev = StreamEvent(kind="answer", text=chunk_text)
                        answer_parts.append(chunk_text)
                        events.append(ev)
                        if event_sink:
                            event_sink(ev)
                    continue

                for part in parts:
                    part_text = getattr(part, "text", None) if not isinstance(part, dict) else part.get("text")
                    part_thought = getattr(part, "thought", None) if not isinstance(part, dict) else part.get("thought")

                    if part_thought and part_text:
                        if not thoughts_printed:
                            print("Thoughts summary:")
                            thoughts_printed = True
                        print(part_text, flush=True)
                        ev = StreamEvent(kind="thought", text=part_text)
                        thought_parts.append(part_text)
                        events.append(ev)
                        if event_sink:
                            event_sink(ev)
                    elif part_text:
                        if not answer_printed:
                            print("Answer:")
                            answer_printed = True
                        print(part_text, flush=True)
                        ev = StreamEvent(kind="answer", text=part_text)
                        answer_parts.append(part_text)
                        events.append(ev)
                        if event_sink:
                            event_sink(ev)

            if answer_printed:
                print()

            answer_text = "".join(answer_parts) if answer_parts else None
            thoughts_text = "".join(thought_parts) if thought_parts else None
            return answer_text, thoughts_text, events, function_call_local, finish_reason_local

        async def run_conversation(
            event_sink: Optional[Callable[[StreamEvent], None]] = None,
        ) -> ChatResponse:
            local_tools_used: List[str] = []

            text, thoughts, stream_events, function_call, finish_reason = await asyncio.to_thread(
                _stream_generate_content,
                contents,
                generation_config,
                event_sink,
            )
            stream_events = stream_events or []

            # Try function call if requested by the model
            if function_call:
                name, arguments, _ = function_call
                if isinstance(name, str) and (not tool_names or name in tool_names):
                    try:
                        print(f"[tools] calling name={name} args={arguments}")
                        tool_result = await execute_tool(name, arguments or {})
                    except Exception as _:
                        tool_result = {"ok": False, "error": "Tool execution failed"}
                    finally:
                        try:
                            ok = tool_result.get("ok") if isinstance(tool_result, dict) else None
                            status = tool_result.get("status") if isinstance(tool_result, dict) else None
                            print(f"[tools] result name={name} ok={ok} status={status}")
                        except Exception:
                            pass

                    local_tools_used.append(name)

                    if isinstance(tool_result, dict) and not tool_result.get("ok"):
                        status_code = tool_result.get("status")
                        failure_payload = tool_result.get("response_text") or tool_result.get("error")
                        print("[tools] failure payload:", failure_payload)

                        # Some Aqqal endpoints reject include_chains=False; retry without that key.
                        if status_code in {401, 403} and "include_chains" in (arguments or {}):
                            retry_args = dict(arguments)
                            retry_args.pop("include_chains", None)
                            try:
                                print("[tools] retrying without include_chains", retry_args)
                                tool_result_retry = await execute_tool(name, retry_args)
                                retry_ok = tool_result_retry.get("ok") if isinstance(tool_result_retry, dict) else None
                                retry_status = tool_result_retry.get("status") if isinstance(tool_result_retry, dict) else None
                                print(f"[tools] retry result ok={retry_ok} status={retry_status}")
                                if isinstance(tool_result_retry, dict) and tool_result_retry.get("ok"):
                                    tool_result = tool_result_retry
                                    arguments = retry_args
                                    status_code = None
                            except Exception as retry_exc:
                                print("[tools] retry error", retry_exc)

                    if isinstance(tool_result, dict) and tool_result.get("status") in {401, 403}:
                        auth_message = (
                            "⚠️ The configured Aqqal API key is not authorized to access this data. "
                            "Please supply a key with chained hadith and keyword search permissions."
                        )
                        return ChatResponse(model=model_name, text=auth_message, tools_used=local_tools_used or None)

                    # Provide tool response back to the model
                    contents_with_tool = contents + [
                        {
                            "role": "user",
                            "parts": [
                                {
                                    "function_response": {
                                        "name": name,
                                        "response": tool_result,
                                    }
                                }
                            ],
                        }
                    ]
                    text2, thoughts2, stream_events2, _, finish_reason2 = await asyncio.to_thread(
                        _stream_generate_content,
                        contents_with_tool,
                        generation_config,
                        event_sink,
                    )
                    if text2:
                        text = text2
                    if thoughts2:
                        thoughts = thoughts2
                    if stream_events2:
                        stream_events.extend(stream_events2)
                    finish_reason = finish_reason2 or finish_reason

            if not text:
                fr_str = str(finish_reason) if finish_reason is not None else None
                if fr_str is not None:
                    if fr_str in ("2", "MAX_TOKENS", "FinishReason.MAX_TOKENS"):
                        new_tokens = min(
                            max(effective_max_output_tokens * 2, effective_max_output_tokens + 512),
                            MAX_OUTPUT_TOKENS_CAP,
                        )
                        if new_tokens > effective_max_output_tokens:
                            try:
                                retry_kwargs = {
                                    "temperature": body.temperature,
                                    "max_output_tokens": new_tokens,
                                    "system_instruction": si_for_tools,
                                    "tools": tool_entries or None,
                                }
                                generation_config_retry = genai_types.GenerateContentConfig(
                                    **{k: v for k, v in retry_kwargs.items() if v is not None}
                                )
                            except Exception:
                                fallback_retry_kwargs = {"system_instruction": si_for_tools}
                                if tool_entries:
                                    fallback_retry_kwargs["tools"] = tool_entries
                                generation_config_retry = genai_types.GenerateContentConfig(
                                    **fallback_retry_kwargs
                                )
                            try:
                                text_retry, thoughts_retry, stream_events_retry, function_call_retry, finish_reason_retry = await asyncio.to_thread(
                                    _stream_generate_content,
                                    contents,
                                    generation_config_retry,
                                    event_sink,
                                )
                                stream_events_retry = stream_events_retry or []
                                if function_call_retry:
                                    retry_name, retry_arguments, _ = function_call_retry
                                    if isinstance(retry_name, str) and (not tool_names or retry_name in tool_names):
                                        try:
                                            print(f"[tools] calling name={retry_name} args={retry_arguments}")
                                            tool_result_retry_call = await execute_tool(retry_name, retry_arguments or {})
                                        except Exception as _:
                                            tool_result_retry_call = {"ok": False, "error": "Tool execution failed"}
                                        finally:
                                            try:
                                                ok_retry = tool_result_retry_call.get("ok") if isinstance(tool_result_retry_call, dict) else None
                                                status_retry = tool_result_retry_call.get("status") if isinstance(tool_result_retry_call, dict) else None
                                                print(f"[tools] result name={retry_name} ok={ok_retry} status={status_retry}")
                                            except Exception:
                                                pass

                                        local_tools_used.append(retry_name)

                                        if isinstance(tool_result_retry_call, dict) and not tool_result_retry_call.get("ok"):
                                            status_code_retry = tool_result_retry_call.get("status")
                                            failure_payload_retry = tool_result_retry_call.get("response_text") or tool_result_retry_call.get("error")
                                            print("[tools] failure payload:", failure_payload_retry)

                                            if status_code_retry in {401, 403} and "include_chains" in (retry_arguments or {}):
                                                retry_args_second = dict(retry_arguments)
                                                retry_args_second.pop("include_chains", None)
                                                try:
                                                    print("[tools] retrying without include_chains", retry_args_second)
                                                    tool_result_retry_second = await execute_tool(retry_name, retry_args_second)
                                                    retry_ok_second = tool_result_retry_second.get("ok") if isinstance(tool_result_retry_second, dict) else None
                                                    retry_status_second = tool_result_retry_second.get("status") if isinstance(tool_result_retry_second, dict) else None
                                                    print(f"[tools] retry result ok={retry_ok_second} status={retry_status_second}")
                                                    if isinstance(tool_result_retry_second, dict) and tool_result_retry_second.get("ok"):
                                                        tool_result_retry_call = tool_result_retry_second
                                                        retry_arguments = retry_args_second
                                                        status_code_retry = None
                                                except Exception as retry_exc_second:
                                                    print("[tools] retry error", retry_exc_second)

                                        if isinstance(tool_result_retry_call, dict) and tool_result_retry_call.get("status") in {401, 403}:
                                            auth_message = (
                                                "⚠️ The configured Aqqal API key is not authorized to access this data. "
                                                "Please supply a key with chained hadith and keyword search permissions."
                                            )
                                            return ChatResponse(model=model_name, text=auth_message, tools_used=local_tools_used or None)

                                        contents_with_tool_retry = contents + [
                                            {
                                                "role": "user",
                                                "parts": [
                                                    {
                                                        "function_response": {
                                                            "name": retry_name,
                                                            "response": tool_result_retry_call,
                                                        }
                                                    }
                                                ],
                                            }
                                        ]
                                        text_retry2, thoughts_retry2, stream_events_retry2, _, finish_reason_retry2 = await asyncio.to_thread(
                                            _stream_generate_content,
                                            contents_with_tool_retry,
                                            generation_config_retry,
                                            event_sink,
                                        )
                                        if text_retry2:
                                            text_retry = text_retry2
                                        if thoughts_retry2:
                                            thoughts_retry = thoughts_retry2
                                        if stream_events_retry2:
                                            stream_events_retry.extend(stream_events_retry2)
                                        finish_reason_retry = finish_reason_retry2 or finish_reason_retry

                                if text_retry:
                                    text = text_retry
                                if thoughts_retry:
                                    thoughts = thoughts_retry
                                if stream_events_retry:
                                    stream_events.extend(stream_events_retry)
                                finish_reason = finish_reason_retry or finish_reason
                            except Exception:
                                text = None
                if not text:
                    raise HTTPException(
                        status_code=502,
                        detail=f"Model returned no text. finish_reason={fr_str}. Try increasing max_output_tokens or adjusting prompt.",
                    )

            if not text:
                raise HTTPException(status_code=502, detail="Model returned no text response.")

            return ChatResponse(
                model=model_name,
                text=text,
                tools_used=local_tools_used or None,
                thoughts=thoughts or None,
                stream_events=stream_events or None,
            )

        if not body.stream:
            return await run_conversation()

        async def event_generator():
            loop = asyncio.get_running_loop()
            queue: asyncio.Queue[Optional[Tuple[str, Dict[str, Any]]]] = asyncio.Queue()

            def on_event(event: StreamEvent) -> None:
                loop.call_soon_threadsafe(
                    queue.put_nowait,
                    ("chunk", {"kind": event.kind, "text": event.text}),
                )

            async def producer():
                try:
                    response = await run_conversation(event_sink=on_event)
                    await queue.put(("final", response.dict()))
                except HTTPException as exc:
                    await queue.put(("error", {"status": exc.status_code, "detail": exc.detail}))
                except Exception as exc:
                    await queue.put(("error", {"status": 500, "detail": str(exc)}))
                finally:
                    await queue.put(None)

            producer_task = asyncio.create_task(producer())
            try:
                while True:
                    item = await queue.get()
                    if item is None:
                        break
                    event_name, payload = item
                    yield f"event: {event_name}\ndata: {json.dumps(payload)}\n\n"
            finally:
                producer_task.cancel()
                with suppress(asyncio.CancelledError):
                    await producer_task

        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini error: {e}")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=True)
