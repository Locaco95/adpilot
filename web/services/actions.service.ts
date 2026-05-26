import { apiGet, apiPost } from "./api-client";
import type { Action, DecideActionPayload } from "@/types";

export async function getActions(
  filter: string = "all"
): Promise<Action[]> {
  return apiGet<Action[]>(`/actions?filter=${filter}`);
}

export async function decideAction(
  id: string,
  payload: DecideActionPayload
): Promise<Action> {
  return apiPost<Action>(`/actions/${id}/decide`, payload);
}

export async function revokeAction(id: string): Promise<Action> {
  return apiPost<Action>(`/actions/${id}/revoke`);
}
