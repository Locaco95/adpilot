/* ── AdPilot — Settings service (LLM model for the Telegram agent) ── */
import { apiGet, apiPost } from "./api-client";

export interface LLMModelOption {
  provider: string;
  id: string;
  label: string;
}

export interface LLMModelState {
  current: string;
  options: LLMModelOption[];
}

export function getLLMModel(): Promise<LLMModelState> {
  return apiGet<LLMModelState>("/settings/llm");
}

export function setLLMModel(model: string): Promise<LLMModelState> {
  return apiPost<LLMModelState>("/settings/llm", { model });
}

/* ── Google Drive connection ── */
export interface DriveStatus {
  connected: boolean;
}

export function getDriveStatus(): Promise<DriveStatus> {
  return apiGet<DriveStatus>("/drive/status");
}

export function getDriveAuthUrl(): Promise<{ url: string }> {
  return apiGet<{ url: string }>("/drive/auth/url");
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
}

export interface DriveFolderResponse {
  files: DriveFile[];
  count: number;
}

/* List image/video files in a Drive folder (link or id) via the OAuth connection. */
export function getDriveFolder(url: string): Promise<DriveFolderResponse> {
  return apiGet<DriveFolderResponse>(`/drive/folder?url=${encodeURIComponent(url)}`);
}
