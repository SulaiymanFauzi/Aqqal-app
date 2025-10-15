from typing import List, Literal, Optional

from pydantic import BaseModel, Field


Role = Literal["user", "assistant", "system"]


class ChatMessage(BaseModel):
    role: Role
    content: str = Field(..., description="Message content as plain text")


class ChatRequest(BaseModel):
    messages: List[ChatMessage] = Field(
        ..., description="Conversation messages in order. Include both user and assistant turns."
    )
    model: Optional[str] = Field(
        None,
        description="Optional Gemini model override (e.g., 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash').",
    )
    temperature: Optional[float] = Field(0.7, ge=0.0, le=2.0)
    max_output_tokens: Optional[int] = Field(None, ge=1)
    system_instruction: Optional[str] = Field(
        None, description="Optional system instruction to steer the assistant."
    )
    use_search: Optional[bool] = Field(
        False,
        description="If true, enable Google Search grounding via google-genai (tools).",
    )
    use_tools: Optional[bool] = Field(
        True,
        description="If true (default), enable minimal tool-calling via api_tools using a JSON schema in the model output.",
    )
    stream: Optional[bool] = Field(
        False,
        description="If true, return a server-sent events stream instead of a single JSON payload.",
    )


class StreamEvent(BaseModel):
    kind: Literal["thought", "answer"]
    text: str


class ChatResponse(BaseModel):
    model: str
    text: str
    tools_used: Optional[List[str]] = None
    thoughts: Optional[str] = None
    stream_events: Optional[List[StreamEvent]] = None
