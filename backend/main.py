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
from models import (
    ChatMessage,
    ChatRequest,
    ChatResponse,
    GroundingChunk,
    GroundingMetadata,
    GroundingSupport,
    StreamEvent,
)
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
        
        # Build parts list with text and optional images
        parts = []
        
        # Add text content
        if m.content:
            parts.append({"text": m.content})
        
        # Add inline images if present
        if m.images:
            for img in m.images:
                parts.append({
                    "inline_data": {
                        "mime_type": img.mime_type,
                        "data": img.data
                    }
                })
        
        contents.append({
            "role": role,
            "parts": parts,
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


async def _route_tool_usage(client, model_name: str, user_query: str, use_search: bool, use_tools: bool) -> str:
    """
    Auto-router that determines which tools to use based on the query.
    Returns: 'search', 'tools', 'both', or 'none'
    """
    print(f"[ROUTER] Input: use_search={use_search}, use_tools={use_tools}, query='{user_query[:50]}'")
    
    if not use_search and not use_tools:
        print(f"[ROUTER] Both disabled, returning 'none'")
        return 'none'
    if not use_search:
        print(f"[ROUTER] Only tools enabled, returning 'tools'")
        return 'tools'
    if not use_tools:
        print(f"[ROUTER] Only search enabled, returning 'search'")
        return 'search'
    
    # Both are enabled - use router LLM to decide
    print(f"[ROUTER] Both enabled, calling router LLM...")
    router_prompt = f"""Classify this query with ONE word only.

Query: "{user_query}"

Respond with:
- "none" if greeting/chitchat
- "search" if needs news/current events/web
- "tools" if needs Quran/Hadith
- "both" if needs web AND Islamic texts

Answer:"""
    
    try:
        # Add safety settings to prevent blocking
        router_safety_settings = [
            genai_types.SafetySetting(
                category=genai_types.HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold=genai_types.HarmBlockThreshold.BLOCK_NONE
            ),
            genai_types.SafetySetting(
                category=genai_types.HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                threshold=genai_types.HarmBlockThreshold.BLOCK_NONE
            ),
            genai_types.SafetySetting(
                category=genai_types.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                threshold=genai_types.HarmBlockThreshold.BLOCK_NONE
            ),
            genai_types.SafetySetting(
                category=genai_types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold=genai_types.HarmBlockThreshold.BLOCK_NONE
            ),
        ]
        
        try:
            # Disable thinking mode for router to ensure we get direct output
            thinking_config = genai_types.ThinkingConfig(thinking_budget=0)
            
            response = await asyncio.to_thread(
                client.models.generate_content,
                model="gemini-flash-lite-latest",  # Use lightweight model for fast routing
                contents=[{"role": "user", "parts": [{"text": router_prompt}]}],
                config=genai_types.GenerateContentConfig(
                    temperature=0.0,
                    max_output_tokens=10,  # Back to 10 since we disabled thinking
                    safety_settings=router_safety_settings,
                    thinking_config=thinking_config,
                )
            )
            print(f"[ROUTER] Got response successfully")
        except Exception as gen_error:
            print(f"[ROUTER] Generation error: {gen_error}")
            raise
        
        # Debug the response
        print(f"[ROUTER] Response type: {type(response)}")
        if hasattr(response, 'candidates') and response.candidates:
            first_candidate = response.candidates[0]
            print(f"[ROUTER] Finish reason: {getattr(first_candidate, 'finish_reason', 'UNKNOWN')}")
            print(f"[ROUTER] Has content: {hasattr(first_candidate, 'content')}")
            if hasattr(first_candidate, 'content'):
                content = first_candidate.content
                print(f"[ROUTER] Content: {content}")
                print(f"[ROUTER] Has parts: {hasattr(content, 'parts')}")
                if hasattr(content, 'parts'):
                    print(f"[ROUTER] Parts: {content.parts}")
                    if content.parts:
                        print(f"[ROUTER] Parts count: {len(content.parts)}")
                        for idx, part in enumerate(content.parts):
                            print(f"[ROUTER] Part {idx} type: {type(part)}")
                            print(f"[ROUTER] Part {idx} dir: {dir(part)}")
                            part_text = getattr(part, 'text', None)
                            print(f"[ROUTER] Part {idx} text: '{part_text}'")
        
        decision = _extract_text_from_genai2_response(response)
        print(f"[ROUTER] Extracted text: '{decision}' (type: {type(decision)})")
        
        if decision:
            decision = decision.strip().lower()
            print(f"[ROUTER] Cleaned decision: '{decision}'")
            
            if decision in ['search', 'tools', 'both', 'none']:
                print(f"[ROUTER] Valid decision: {decision}")
                return decision
            else:
                print(f"[ROUTER] Invalid decision '{decision}', not in ['search', 'tools', 'both', 'none']")
        else:
            print(f"[ROUTER] No decision extracted from response")
    except Exception as e:
        print(f"[ROUTER] Error: {e}, defaulting to 'tools'")
    
    # Default to tools if router fails
    print(f"[ROUTER] Falling back to default: 'tools'")
    return 'tools'


def _add_inline_citations(text: str, grounding_metadata: Optional[GroundingMetadata]) -> str:
    """Add inline clickable citations to text based on grounding metadata.
    
    Follows Google's recommended pattern from:
    https://ai.google.dev/gemini-api/docs/grounding
    """
    if not grounding_metadata:
        print("[CITATIONS] No grounding metadata")
        return text
    
    if not grounding_metadata.grounding_supports:
        print("[CITATIONS] No grounding supports")
        return text
        
    if not grounding_metadata.grounding_chunks:
        print("[CITATIONS] No grounding chunks")
        return text
    
    print(f"[CITATIONS] Processing {len(grounding_metadata.grounding_supports)} supports, {len(grounding_metadata.grounding_chunks)} chunks")
    
    # Sort supports by end_index in DESCENDING order to avoid shifting issues when inserting
    # This is the key - we work backwards through the text
    sorted_supports = sorted(
        grounding_metadata.grounding_supports,
        key=lambda s: s.end_index,
        reverse=True
    )
    
    # Build a list of (position, citation_string) tuples first, then insert all at once
    insertions = []
    
    for support in sorted_supports:
        end_index = support.end_index
        
        if not support.grounding_chunk_indices:
            continue
        
        # Find where this segment actually appears in our text
        gemini_segment = support.text
        
        # Try to find the segment in our text
        try:
            actual_start = text.find(gemini_segment)
            if actual_start != -1:
                actual_end = actual_start + len(gemini_segment)
                insertion_point = actual_end
                print(f"[CITATIONS] Found segment at [{actual_start}:{actual_end}] (Gemini said [{support.start_index}:{support.end_index}])")
            else:
                # Fallback: use Gemini's index
                insertion_point = end_index
                print(f"[CITATIONS] Segment not found, using Gemini's index {insertion_point}")
        except Exception as e:
            insertion_point = end_index
            print(f"[CITATIONS] Error finding segment: {e}, using Gemini's index {insertion_point}")
        
        # Create citation links like [[1]](url)[[2]](url)
        citation_links = []
        for i in support.grounding_chunk_indices:
            if i < len(grounding_metadata.grounding_chunks):
                chunk = grounding_metadata.grounding_chunks[i]
                title = chunk.title or "Source"
                # Create markdown link with tooltip
                citation_links.append(f'[[{i + 1}]]({chunk.uri} "{title}")')
        
        if citation_links:
            # Add space before citations for readability
            citation_string = " " + "".join(citation_links)
            insertions.append((insertion_point, citation_string))
            print(f"[CITATIONS] Will insert at position {insertion_point}: {citation_string}")
    
    # Now insert all citations at once, working backwards
    modified_text = text
    for insertion_point, citation_string in insertions:
        modified_text = modified_text[:insertion_point] + citation_string + modified_text[insertion_point:]
    
    print(f"[CITATIONS] Done. Original length: {len(text)}, Final length: {len(modified_text)}")
    return modified_text


def _extract_grounding_metadata(resp) -> tuple[Optional[GroundingMetadata], Optional[str]]:
    """Extract grounding metadata and canonical text from Gemini response.
    
    Returns:
        tuple: (grounding_metadata, canonical_text) where canonical_text is the text
               that the grounding indices refer to.
    """
    try:
        candidates = getattr(resp, "candidates", None)
        if not candidates:
            return None, None
        first = candidates[0]
        
        # Extract canonical text that grounding indices refer to
        canonical_text = _extract_text_from_genai2_response(resp)
        
        grounding_metadata = getattr(first, "grounding_metadata", None)
        if not grounding_metadata:
            return None, canonical_text

        # Extract web search queries
        web_search_queries = getattr(grounding_metadata, "web_search_queries", None)
        if web_search_queries and hasattr(web_search_queries, "__iter__"):
            web_search_queries = list(web_search_queries)
        else:
            web_search_queries = None

        # Extract grounding chunks
        grounding_chunks_raw = getattr(grounding_metadata, "grounding_chunks", None)
        grounding_chunks = []
        if grounding_chunks_raw:
            for chunk in grounding_chunks_raw:
                web = getattr(chunk, "web", None)
                if web:
                    uri = getattr(web, "uri", None)
                    title = getattr(web, "title", None)
                    if uri:
                        grounding_chunks.append(GroundingChunk(uri=uri, title=title))

        # Extract grounding supports
        grounding_supports_raw = getattr(grounding_metadata, "grounding_supports", None)
        grounding_supports = []
        if grounding_supports_raw:
            for support in grounding_supports_raw:
                segment = getattr(support, "segment", None)
                if segment:
                    start_index = getattr(segment, "start_index", None)
                    end_index = getattr(segment, "end_index", None)
                    text = getattr(segment, "text", None)
                    chunk_indices = getattr(support, "grounding_chunk_indices", None)
                    if start_index is not None and end_index is not None and text and chunk_indices:
                        grounding_supports.append(
                            GroundingSupport(
                                start_index=start_index,
                                end_index=end_index,
                                text=text,
                                grounding_chunk_indices=list(chunk_indices),
                            )
                        )

        if web_search_queries or grounding_chunks or grounding_supports:
            metadata = GroundingMetadata(
                web_search_queries=web_search_queries,
                grounding_chunks=grounding_chunks if grounding_chunks else None,
                grounding_supports=grounding_supports if grounding_supports else None,
            )
            return metadata, canonical_text
    except Exception as e:
        print(f"[GROUNDING] Error extracting metadata: {e}")
    return None, None


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
        use_tools = body.use_tools if body.use_tools is not None else True

        # Extract the last user message for routing
        last_user_message = ""
        for msg in reversed(body.messages):
            if msg.role == "user":
                last_user_message = msg.content
                break
        
        # Use auto-router to determine which tools to use
        routing_decision = await _route_tool_usage(client, model_name, last_user_message, use_search, use_tools)
        print(f"[ROUTER] Final decision: {routing_decision}")
        
        # Determine actual tool usage based on routing decision
        use_search_now = routing_decision in ['search', 'both']
        use_tools_now = routing_decision in ['tools', 'both']
        execute_sequentially = routing_decision == 'both'

        # Build tool-aware system instruction if tools are enabled
        tool_names = get_tool_names() if use_tools_now else []
        announced_tool_names = list(tool_names)
        if use_search_now:
            announced_tool_names.append("google_search")
        
        if use_tools_now or use_search_now:
            tool_si = build_tools_instruction(announced_tool_names)
            si_for_tools = (
                f"{system_instruction}\n\n{tool_si}" if system_instruction else tool_si
            )
        else:
            si_for_tools = system_instruction

        # Assemble tool entries (function declarations + optional Google Search)
        # NOTE: Gemini API limitation - cannot use both function calling and Google Search together
        # When both are needed, we'll execute them sequentially
        
        tool_entries: List[genai_types.Tool] = []
        
        if execute_sequentially:
            # Start with Google Search first for 'both' scenario
            print(f"[ROUTER] Sequential execution: Starting with Google Search")
            tool_entries.append(genai_types.Tool(google_search=genai_types.GoogleSearch()))
        elif use_search_now:
            # Google Search only
            print(f"[ROUTER] Using Google Search only")
            tool_entries.append(genai_types.Tool(google_search=genai_types.GoogleSearch()))
        elif use_tools_now:
            # Custom function declarations only
            print(f"[ROUTER] Using custom tools only")
            function_declarations = get_function_declaration_models()
            if function_declarations:
                tool_entries.append(genai_types.Tool(function_declarations=function_declarations))
        
        print(f"[DEBUG] tool_entries count={len(tool_entries)}")

        # Safety settings to turn off all filters
        safety_settings = [
            genai_types.SafetySetting(
                category=genai_types.HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold=genai_types.HarmBlockThreshold.BLOCK_NONE
            ),
            genai_types.SafetySetting(
                category=genai_types.HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                threshold=genai_types.HarmBlockThreshold.BLOCK_NONE
            ),
            genai_types.SafetySetting(
                category=genai_types.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                threshold=genai_types.HarmBlockThreshold.BLOCK_NONE
            ),
            genai_types.SafetySetting(
                category=genai_types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold=genai_types.HarmBlockThreshold.BLOCK_NONE
            ),
        ]
        
        cfg_kwargs = {
            "temperature": body.temperature,
            "max_output_tokens": effective_max_output_tokens,
            "system_instruction": si_for_tools,
            "tools": tool_entries or None,
            "safety_settings": safety_settings,
        }
        
        # Note: tool_config is not needed and causes conflicts when mixing function declarations with Google Search
        # The model will automatically use available tools when appropriate
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
            Optional[GroundingMetadata],
        ]:
            thought_parts: List[str] = []
            answer_parts: List[str] = []
            events: List[StreamEvent] = []
            finish_reason_local: Optional[str] = None
            function_call_local: Optional[Tuple[str, Dict[str, Any], Optional[Dict[str, Any]]]] = None
            last_chunk = None

            stream = client.models.generate_content_stream(
                model=model_name,
                contents=contents_input,
                config=config_input,
            )

            thoughts_printed = False
            answer_printed = False

            for chunk in stream:
                last_chunk = chunk
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
                        # Don't trim individual chunks - only trim the final joined text
                        ev = StreamEvent(kind="answer", text=part_text)
                        answer_parts.append(part_text)
                        events.append(ev)
                        if event_sink:
                            event_sink(ev)

            if answer_printed:
                print()

            answer_text = "".join(answer_parts).rstrip() if answer_parts else None
            thoughts_text = "".join(thought_parts).rstrip() if thought_parts else None
            grounding_metadata, _ = _extract_grounding_metadata(last_chunk) if last_chunk else (None, None)
            
            # Always use streamed text - it's the most reliable for citation placement
            
            if grounding_metadata:
                print(f"[GROUNDING] Queries: {grounding_metadata.web_search_queries}")
                if grounding_metadata.grounding_chunks:
                    print(f"[GROUNDING] Sources: {len(grounding_metadata.grounding_chunks)} chunks")
            
            return answer_text, thoughts_text, events, function_call_local, finish_reason_local, grounding_metadata

        async def run_conversation(
            event_sink: Optional[Callable[[StreamEvent], None]] = None,
        ) -> ChatResponse:
            local_tools_used: List[str] = []
            grounding_metadata: Optional[GroundingMetadata] = None

            text, thoughts, stream_events, function_call, finish_reason, grounding_metadata = await asyncio.to_thread(
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
                    # Send tool activity to frontend
                    if event_sink:
                        event_sink(StreamEvent(kind="thought", text=f"[tools] calling {name}"))
                    
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
                            # Send result to frontend
                            if event_sink:
                                event_sink(StreamEvent(kind="thought", text=f"[tools] result {name} ok={ok}"))
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
                    text2, thoughts2, stream_events2, _, finish_reason2, grounding_metadata2 = await asyncio.to_thread(
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
                    if grounding_metadata2:
                        grounding_metadata = grounding_metadata2

            if not text:
                fr_str = str(finish_reason) if finish_reason is not None else None
                if fr_str is not None:
                    # Handle MAX_TOKENS by increasing token limit
                    is_max_tokens = fr_str in ("2", "MAX_TOKENS", "FinishReason.MAX_TOKENS")
                    # Handle STOP with no text (random API glitch) by simple retry
                    is_stop_no_text = fr_str in ("1", "STOP", "FinishReason.STOP")
                    
                    if is_max_tokens or is_stop_no_text:
                        # For MAX_TOKENS, increase the limit; for STOP, keep same limit
                        if is_max_tokens:
                            new_tokens = min(
                                max(effective_max_output_tokens * 2, effective_max_output_tokens + 512),
                                MAX_OUTPUT_TOKENS_CAP,
                            )
                        else:
                            new_tokens = effective_max_output_tokens
                            
                        if is_stop_no_text or new_tokens > effective_max_output_tokens:
                            if is_stop_no_text:
                                print(f"[retry] Model returned STOP with no text. Retrying with same config...")
                            else:
                                print(f"[retry] MAX_TOKENS reached. Retrying with increased tokens: {new_tokens}")
                            try:
                                retry_kwargs = {
                                    "temperature": body.temperature,
                                    "max_output_tokens": new_tokens,
                                    "system_instruction": si_for_tools,
                                    "tools": tool_entries or None,
                                    "safety_settings": safety_settings,
                                }
                                generation_config_retry = genai_types.GenerateContentConfig(
                                    **{k: v for k, v in retry_kwargs.items() if v is not None}
                                )
                            except Exception:
                                fallback_retry_kwargs = {
                                    "system_instruction": si_for_tools,
                                    "safety_settings": safety_settings,
                                }
                                if tool_entries:
                                    fallback_retry_kwargs["tools"] = tool_entries
                                generation_config_retry = genai_types.GenerateContentConfig(
                                    **fallback_retry_kwargs
                                )
                            try:
                                text_retry, thoughts_retry, stream_events_retry, function_call_retry, finish_reason_retry, grounding_metadata_retry = await asyncio.to_thread(
                                    _stream_generate_content,
                                    contents,
                                    generation_config_retry,
                                    event_sink,
                                )
                                stream_events_retry = stream_events_retry or []
                                if function_call_retry:
                                    retry_name, retry_arguments, _ = function_call_retry
                                    if isinstance(retry_name, str) and (not tool_names or retry_name in tool_names):
                                        # Send tool activity to frontend
                                        if event_sink:
                                            event_sink(StreamEvent(kind="thought", text=f"[tools] calling {retry_name}"))
                                        
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
                                                # Send result to frontend
                                                if event_sink:
                                                    event_sink(StreamEvent(kind="thought", text=f"[tools] result {retry_name} ok={ok_retry}"))
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
                                        text_retry2, thoughts_retry2, stream_events_retry2, _, finish_reason_retry2, grounding_metadata_retry2 = await asyncio.to_thread(
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
                                        if grounding_metadata_retry2:
                                            grounding_metadata_retry = grounding_metadata_retry2

                                if text_retry:
                                    text = text_retry
                                if thoughts_retry:
                                    thoughts = thoughts_retry
                                if stream_events_retry:
                                    stream_events.extend(stream_events_retry)
                                finish_reason = finish_reason_retry or finish_reason
                                if grounding_metadata_retry:
                                    grounding_metadata = grounding_metadata_retry
                            except Exception:
                                text = None
                if not text:
                    raise HTTPException(
                        status_code=502,
                        detail=f"Model returned no text. finish_reason={fr_str}. Try increasing max_output_tokens or adjusting prompt.",
                    )

            if not text:
                raise HTTPException(status_code=502, detail="Model returned no text response.")

            # Sequential execution: If routing decision was 'both', now execute custom tools
            if execute_sequentially and text and use_tools:
                print(f"[ROUTER] Sequential execution: Phase 2 - Running custom tools with search context")
                
                # Create a new prompt that includes the search results as context
                search_context_prompt = f"""Based on the following web search results:

{text}

Now use the available Islamic canonical tools (Quran, Hadith, Tafsir) to provide a comprehensive answer that combines this information with Islamic sources.

Original query: {last_user_message}"""
                
                # Rebuild tool entries with custom tools only
                function_declarations = get_function_declaration_models()
                tool_entries_phase2: List[genai_types.Tool] = []
                if function_declarations:
                    tool_entries_phase2.append(genai_types.Tool(function_declarations=function_declarations))
                
                # Create new config with custom tools
                cfg_kwargs_phase2 = {
                    "temperature": body.temperature,
                    "max_output_tokens": effective_max_output_tokens,
                    "system_instruction": si_for_tools,
                    "tools": tool_entries_phase2 or None,
                    "safety_settings": safety_settings,
                }
                
                try:
                    generation_config_phase2 = genai_types.GenerateContentConfig(
                        **{k: v for k, v in cfg_kwargs_phase2.items() if v is not None}
                    )
                except Exception:
                    fallback_kwargs_phase2 = {"system_instruction": si_for_tools}
                    if tool_entries_phase2:
                        fallback_kwargs_phase2["tools"] = tool_entries_phase2
                    generation_config_phase2 = genai_types.GenerateContentConfig(**fallback_kwargs_phase2)
                
                # Add search results as context
                contents_phase2 = contents + [
                    {"role": "model", "parts": [{"text": text}]},
                    {"role": "user", "parts": [{"text": search_context_prompt}]}
                ]
                
                # Execute phase 2 with custom tools
                text2, thoughts2, stream_events2, function_call2, finish_reason2, grounding_metadata2 = await asyncio.to_thread(
                    _stream_generate_content,
                    contents_phase2,
                    generation_config_phase2,
                    event_sink,
                )
                
                # Handle function calls in phase 2 (similar to existing logic)
                if function_call2:
                    name2, arguments2, _ = function_call2
                    if isinstance(name2, str) and name2 in tool_names:
                        try:
                            print(f"[tools] Phase 2 calling name={name2} args={arguments2}")
                            tool_result2 = await execute_tool(name2, arguments2 or {})
                            local_tools_used.append(name2)
                            
                            # Provide tool response back
                            contents_phase2_with_tool = contents_phase2 + [
                                {
                                    "role": "user",
                                    "parts": [
                                        {
                                            "function_response": {
                                                "name": name2,
                                                "response": tool_result2,
                                            }
                                        }
                                    ],
                                }
                            ]
                            
                            text3, thoughts3, stream_events3, _, finish_reason3, _ = await asyncio.to_thread(
                                _stream_generate_content,
                                contents_phase2_with_tool,
                                generation_config_phase2,
                                event_sink,
                            )
                            
                            if text3:
                                text = text3
                            if thoughts3:
                                thoughts = thoughts3
                            if stream_events3:
                                stream_events.extend(stream_events3)
                        except Exception as e:
                            print(f"[tools] Phase 2 error: {e}")
                elif text2:
                    # Use phase 2 response if no function call
                    text = text2
                    if thoughts2:
                        thoughts = thoughts2
                    if stream_events2:
                        stream_events.extend(stream_events2)

            # Add inline citations if grounding metadata is available
            final_text = _add_inline_citations(text, grounding_metadata) if grounding_metadata else text
            
            return ChatResponse(
                model=model_name,
                text=final_text,
                tools_used=local_tools_used or None,
                thoughts=thoughts or None,
                stream_events=stream_events or None,
                grounding_metadata=grounding_metadata,
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


@app.post("/translate")
async def translate(
    arabic_word: str,
    lemma: Optional[str] = None,
    root: Optional[str] = None,
    pos: Optional[str] = None,
    morphology: Optional[str] = None,
):
    """
    Lightweight endpoint for translating Arabic words to English.
    Uses gemini-flash-lite-latest with thinking disabled for fast responses.
    """
    if not GOOGLE_API_KEY:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY is not set.")
    
    try:
        client = genai.Client(api_key=GOOGLE_API_KEY)
        
        # Build context
        context = f"Arabic word: {arabic_word}"
        if lemma and lemma != arabic_word:
            context += f"\nLemma (base form): {lemma}"
        if root:
            context += f"\nRoot: {root}"
        if pos:
            context += f"\nPart of speech: {pos}"
        if morphology:
            context += f"\nMorphology: {morphology}"
        
        system_instruction = (
            "You are an expert in Quranic Arabic. Provide a concise English translation"
            "(1-2 sentences, <60 words). Focus on the Quranic context. "
            "Be direct and clear. No markdown."
        )
        
        # Use lightweight model with thinking disabled
        response = await asyncio.to_thread(
            client.models.generate_content,
            model="gemini-flash-lite-latest",
            contents=[{"role": "user", "parts": [{"text": context}]}],
            config=genai_types.GenerateContentConfig(
                temperature=0.2,
                max_output_tokens=150,
                system_instruction=system_instruction,
                thinking_config=genai_types.ThinkingConfig(thinking_budget=0),
            )
        )
        
        # Extract text
        text = ""
        if hasattr(response, "text"):
            text = response.text
        elif hasattr(response, "candidates") and response.candidates:
            first = response.candidates[0]
            if hasattr(first, "content") and hasattr(first.content, "parts"):
                text = "".join(p.text for p in first.content.parts if hasattr(p, "text"))
        
        return {
            "translation": text.strip(),
            "model": "gemini-flash-lite-latest"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Translation error: {e}")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=True)
