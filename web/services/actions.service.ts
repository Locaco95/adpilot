import { apiGet, apiPost } from "./api-client";
import type { Action, DecideActionPayload } from "@/types";

type MaybeList<T> = T[] | { items: T[]; total?: number } | { data: T[] };

function toArray<T>(res: MaybeList<T>): T[] {
  if (Array.isArray(res)) return res;
  if ("items" in res && Array.isArray(res.items)) return res.items;
  if ("data" in res && Array.isArray(res.data)) return res.data;
  return [];
}

export async function getActions(
  filter: string = "all"
): Promise<Action[]> {
  const res = await apiGet<MaybeList<Action>>(`/actions?filter=${filter}`);
  return toArray(res);
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
