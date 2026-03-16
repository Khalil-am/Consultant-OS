const BASE = 'https://openrouter.ai/api/v1';
// Free model — excellent quality, no cost
const MODEL = 'google/gemini-2.0-flash-exp:free';

export interface ChatMsg {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function chatWithDocument(
  messages: ChatMsg[],
  systemPrompt: string
): Promise<string> {
  const key = import.meta.env.VITE_OPENROUTER_API_KEY as string | undefined;
  if (!key) {
    throw new Error(
      'OpenRouter API key not set. Add VITE_OPENROUTER_API_KEY=<your-key> to your .env.local file, then restart the dev server.'
    );
  }

  const body = {
    model: MODEL,
    messages: [{ role: 'system', content: systemPrompt }, ...messages],
    max_tokens: 2048,
    temperature: 0.7,
  };

  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Consultant OS',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `OpenRouter error ${res.status}`);
  }

  const data = await res.json() as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content?.trim() ?? 'No response received.';
}

export function buildDocumentSystemPrompt(doc: {
  name: string;
  type: string;
  author: string;
  date: string;
  workspace: string;
  status: string;
  language: string;
  summary?: string;
  tags?: string[];
}): string {
  return `You are an expert AI consultant assistant embedded in Consultant OS, a professional consulting management platform.

You are analyzing the following document:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Document Name:  ${doc.name}
Type:           ${doc.type}
Author:         ${doc.author}
Date:           ${doc.date}
Workspace:      ${doc.workspace}
Status:         ${doc.status}
Language:       ${doc.language}
Tags:           ${doc.tags?.length ? doc.tags.join(', ') : 'None'}
Summary:
${doc.summary || 'No summary provided — answer based on document metadata only.'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Answer user questions about this document with a professional, concise consulting tone.
- Base answers on the provided metadata and summary
- If the user asks about specific file content not in the summary, note that you're working from metadata only
- Offer actionable insights where relevant
- Keep responses focused and professional`;
}
