"""Web chat route: same agent brain as Telegram, over JWT-authed HTTP.

Reuses telegram_agent (the LLM tool-loop) and the shared execute_action.
History/pending live in the agent's in-memory store keyed by a chat id; here
we derive a stable id from the operator's JWT subject so the web conversation
is isolated from any Telegram chat.
"""
from __future__ import annotations

import logging
import zlib

from fastapi import APIRouter, Depends, HTTPException

from app.agents import telegram_agent
from app.database import AsyncSessionLocal
from app.deps import get_current_user
from app.schemas.agent import ChatRequest, ChatReply, ActionRequest, PendingActionOut
from app.services import llm_models
from app.services.agent_actions import execute_action

logger = logging.getLogger("adpilot.agent")

router = APIRouter(prefix="/agent", tags=["agent"])


def _chat_id(user: dict) -> int:
    """Stable, web-namespaced chat id from the JWT subject (negative so it can
    never collide with a real positive Telegram chat id)."""
    sub = str(user.get("sub", "operator"))
    return -(zlib.crc32(sub.encode()) & 0x7FFFFFFF)


def _pending_out(p: telegram_agent.PendingAction | None) -> PendingActionOut | None:
    if not p:
        return None
    return PendingActionOut(id=p.id, summary=p.summary)


@router.post("/chat", response_model=ChatReply)
async def chat(body: ChatRequest, user=Depends(get_current_user)):
    text = body.message.strip()
    if not text:
        raise HTTPException(400, "Empty message")
    chat_id = _chat_id(user)
    async with AsyncSessionLocal() as db:
        model = await llm_models.get_current_model(db)
    try:
        reply = await telegram_agent.handle_message(chat_id, text, model=model)
    except Exception as e:
        logger.exception("agent error")
        raise HTTPException(502, f"Agent error: {str(e)[:300]}")
    return ChatReply(reply=reply.text, pending=_pending_out(reply.pending))


@router.post("/action/{action_id}", response_model=ChatReply)
async def decide(action_id: str, body: ActionRequest, user=Depends(get_current_user)):
    chat_id = _chat_id(user)
    action = telegram_agent.pop_pending(action_id)
    if not action:
        raise HTTPException(404, "This request expired — ask again.")

    if body.decision == "reject":
        telegram_agent.record_decision(chat_id, f"Operator REJECTED: {action.summary}")
        return ChatReply(reply=f"❌ Rejected\n\n{action.summary}")

    try:
        result_text = await execute_action(action)
    except Exception as e:
        logger.exception("action execution failed")
        result_text = f"❌ Execution failed:\n{str(e)[:500]}"
    telegram_agent.record_decision(
        chat_id, f"Operator APPROVED: {action.summary} → {result_text}"
    )
    return ChatReply(reply=result_text)
