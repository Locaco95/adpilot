import { apiPost } from "./api-client";
import type { TokenResponse } from "@/types";

export async function loginApi(
  email: string,
  password: string
): Promise<TokenResponse> {
  return apiPost<TokenResponse>("/auth/login", { email, password });
}
