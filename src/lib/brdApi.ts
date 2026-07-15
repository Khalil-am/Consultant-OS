import { supabase } from './supabase';

const N8N_BASE_URL = import.meta.env.VITE_N8N_WEBHOOK_URL as string | undefined;
const N8N_CALLBACK_SECRET = import.meta.env.VITE_N8N_CALLBACK_SECRET as string | undefined;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BrdRunRecord {
  id: string;
  workspace_id: string | null;
  user_id: string;
  automation_type: string;
  prompt_template_id: string | null;
  status: string;
  options_json: string;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RunSection {
  id: string;
  run_id: string;
  section_name: string;
  section_index: number;
  status: string;
  content: string;
  confidence: number;
}

export interface RunFile {
  id: string;
  run_id: string;
  file_role: string;
  file_name: string;
  mime_type: string;
  storage_url: string;
  size_bytes: number | null;
}

// ─── Storage ──────────────────────────────────────────────────────────────────

/**
 * Uploads a File to the `workspace-docs` Supabase Storage bucket and returns
 * a 2-hour signed URL suitable for passing to n8n.
 */
export async function uploadFileToStorage(
  file: File,
  runId: string,
  role: 'input' | 'sample',
): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'bin';
  const path = `runs/${runId}/${role}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('workspace-docs')
    .upload(path, file, { contentType: file.type || 'application/octet-stream' });

  if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

  const { data: urlData } = await supabase.storage
    .from('workspace-docs')
    .createSignedUrl(path, 7200);

  if (!urlData?.signedUrl) throw new Error('Failed to generate signed URL for uploaded file');
  return urlData.signedUrl;
}

// ─── Run Records ──────────────────────────────────────────────────────────────

export async function createRunRecord(params: {
  runId: string;
  workspaceId: string | null;
  userId: string;
  promptTemplateId: string;
  options: object;
}): Promise<void> {
  const { error } = await supabase.from('automation_runs').insert({
    id: params.runId,
    workspace_id: params.workspaceId,
    user_id: params.userId,
    automation_type: 'brd_generator',
    prompt_template_id: params.promptTemplateId,
    status: 'queued',
    options_json: JSON.stringify(params.options),
    started_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Failed to create run record: ${error.message}`);
}

export async function saveRunFile(params: {
  runId: string;
  role: 'input' | 'sample';
  fileName: string;
  mimeType: string;
  storageUrl: string;
  sizeBytes: number;
}): Promise<void> {
  const { error } = await supabase.from('automation_run_files').insert({
    run_id: params.runId,
    file_role: params.role,
    file_name: params.fileName,
    mime_type: params.mimeType,
    storage_url: params.storageUrl,
    size_bytes: params.sizeBytes,
  });
  if (error) throw new Error(`Failed to save file record: ${error.message}`);
}

// ─── Webhook ──────────────────────────────────────────────────────────────────

export async function triggerBrdWebhook(payload: {
  runId: string;
  workspaceId: string | null;
  userId: string;
  automationType: string;
  promptTemplateId: string;
  inputFile: { fileId: string; name: string; mimeType: string; url: string };
  sampleFiles: { fileId: string; name: string; mimeType: string; url: string }[];
  options: object;
}): Promise<void> {
  if (!N8N_BASE_URL) {
    throw new Error(
      'n8n is not configured. Add VITE_N8N_WEBHOOK_URL to .env.local and restart the dev server.',
    );
  }

  const res = await fetch(`${N8N_BASE_URL}/webhook/automation/brd/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(N8N_CALLBACK_SECRET ? { 'X-N8N-Secret': N8N_CALLBACK_SECRET } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`n8n webhook returned ${res.status}: ${text}`);
  }
}

// ─── Polling / Status ─────────────────────────────────────────────────────────

export async function fetchRunStatus(runId: string): Promise<BrdRunRecord | null> {
  const { data, error } = await supabase
    .from('automation_runs')
    .select('*')
    .eq('id', runId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data as BrdRunRecord | null;
}

export async function fetchRunSections(runId: string): Promise<RunSection[]> {
  const { data, error } = await supabase
    .from('automation_run_sections')
    .select('*')
    .eq('run_id', runId)
    .order('section_index');
  if (error) throw error;
  return (data ?? []) as RunSection[];
}

export async function fetchRunFiles(runId: string): Promise<RunFile[]> {
  const { data, error } = await supabase
    .from('automation_run_files')
    .select('*')
    .eq('run_id', runId);
  if (error) throw error;
  return (data ?? []) as RunFile[];
}

export async function fetchRunEventPayload(
  runId: string,
  eventType: string,
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase
    .from('automation_run_events')
    .select('payload_json')
    .eq('run_id', runId)
    .eq('event_type', eventType)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  if (!data) return {};
  try {
    return JSON.parse(data.payload_json as string) as Record<string, unknown>;
  } catch {
    return {};
  }
}

// ─── Identity ─────────────────────────────────────────────────────────────────

/** Returns a stable anonymous user ID persisted in localStorage. */
export function getAnonUserId(): string {
  const key = 'consultant_os_user_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = `anon-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem(key, id);
  }
  return id;
}
