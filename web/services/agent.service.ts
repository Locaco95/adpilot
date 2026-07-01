/* ── AdPilot — Assistant chat service (web equivalent of the Telegram agent) ── */
import { apiPost } from "./api-client";

export interface PendingAction {
  id: string;
  summary: string;
}

export interface ChatReply {
  reply: string;
  pending: PendingAction | null;
}

/* LLM tool-loop can be slow (reads several endpoints) — give it room. */
export function sendChat(message: string): Promise<ChatReply> {
  return apiPost<ChatReply>("/agent/chat", { message }, 60_000);
}

export function decideAction(
  id: string,
  decision: "approve" | "reject"
): Promise<ChatReply> {
  return apiPost<ChatReply>(`/agent/action/${id}`, { decision }, 60_000);
}
