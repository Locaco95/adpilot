from typing import Literal

from pydantic import BaseModel


class ChatRequest(BaseModel):
    message: str


class PendingActionOut(BaseModel):
    id: str
    summary: str


class ChatReply(BaseModel):
    reply: str
    pending: PendingActionOut | None = None


class ActionRequest(BaseModel):
    decision: Literal["approve", "reject"]
