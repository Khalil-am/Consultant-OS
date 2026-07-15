export interface EnvStatus {
  ok: boolean;
  missing: string[];
  warnings: string[];
}

const REQUIRED: Array<{ key: string; name: string }> = [
  { key: 'VITE_SUPABASE_URL',      name: 'Supabase URL'      },
  { key: 'VITE_SUPABASE_ANON_KEY', name: 'Supabase Anon Key' },
];

const OPTIONAL: Array<{ key: string; name: string; placeholder?: string }> = [
  { key: 'VITE_OPENROUTER_API_KEY', name: 'OpenRouter API Key' },
  { key: 'VITE_TRELLO_API_KEY',     name: 'Trello API Key'     },
  { key: 'VITE_N8N_WEBHOOK_URL',    name: 'n8n Webhook URL'    },
];

const KNOWN_PLACEHOLDERS = [
  'PASTE_FULL_ANON_KEY_HERE',
  'YOUR_KEY_HERE',
  'REPLACE_ME',
  '',
];

function isPlaceholder(val: string | undefined): boolean {
  if (!val) return true;
  return KNOWN_PLACEHOLDERS.some(p => val.trim() === p || val.trim().toUpperCase() === p.toUpperCase());
}

export function checkEnv(): EnvStatus {
  const missing: string[] = [];
  const warnings: string[] = [];

  const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env;

  for (const { key, name } of REQUIRED) {
    if (isPlaceholder(env[key])) {
      missing.push(name);
    }
  }

  for (const { key, name } of OPTIONAL) {
    if (isPlaceholder(env[key])) {
      warnings.push(name);
    }
  }

  return { ok: missing.length === 0, missing, warnings };
}
