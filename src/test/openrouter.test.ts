import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildDocumentSystemPrompt, chatWithDocument } from '../lib/openrouter';
import type { ChatMsg } from '../lib/openrouter';

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt', () => {
  const baseDoc = {
    name: 'NCA Enterprise Architecture BRD v2.3',
    type: 'BRD',
    author: 'Ahmed Khalil',
    date: '2026-03-15',
    workspace: 'NCA',
    status: 'Final',
    language: 'EN',
    summary: 'Full enterprise architecture design for NCA.',
    tags: ['Architecture', 'BRD', 'Final'],
  };

  it('includes document name in prompt', () => {
    const prompt = buildDocumentSystemPrompt(baseDoc);
    expect(prompt).toContain('NCA Enterprise Architecture BRD v2.3');
  });

  it('includes document type', () => {
    const prompt = buildDocumentSystemPrompt(baseDoc);
    expect(prompt).toContain('BRD');
  });

  it('includes author', () => {
    const prompt = buildDocumentSystemPrompt(baseDoc);
    expect(prompt).toContain('Ahmed Khalil');
  });

  it('includes date', () => {
    const prompt = buildDocumentSystemPrompt(baseDoc);
    expect(prompt).toContain('2026-03-15');
  });

  it('includes workspace', () => {
    const prompt = buildDocumentSystemPrompt(baseDoc);
    expect(prompt).toContain('NCA');
  });

  it('includes status', () => {
    const prompt = buildDocumentSystemPrompt(baseDoc);
    expect(prompt).toContain('Final');
  });

  it('includes language', () => {
    const prompt = buildDocumentSystemPrompt(baseDoc);
    expect(prompt).toContain('EN');
  });

  it('includes summary when provided', () => {
    const prompt = buildDocumentSystemPrompt(baseDoc);
    expect(prompt).toContain('Full enterprise architecture design for NCA.');
  });

  it('shows fallback message when summary is absent', () => {
    const doc = { ...baseDoc, summary: undefined };
    const prompt = buildDocumentSystemPrompt(doc);
    expect(prompt).toContain('No summary provided');
  });

  it('shows fallback message when summary is empty string', () => {
    const doc = { ...baseDoc, summary: '' };
    const prompt = buildDocumentSystemPrompt(doc);
    expect(prompt).toContain('No summary provided');
  });

  it('joins tags with comma when tags are provided', () => {
    const prompt = buildDocumentSystemPrompt(baseDoc);
    expect(prompt).toContain('Architecture, BRD, Final');
  });

  it('shows None when tags are empty', () => {
    const doc = { ...baseDoc, tags: [] };
    const prompt = buildDocumentSystemPrompt(doc);
    expect(prompt).toContain('None');
  });

  it('shows None when tags are absent', () => {
    const doc = { ...baseDoc, tags: undefined };
    const prompt = buildDocumentSystemPrompt(doc);
    expect(prompt).toContain('None');
  });

  it('returns a string of substantial length', () => {
    const prompt = buildDocumentSystemPrompt(baseDoc);
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(200);
  });

  it('includes consulting tone instruction', () => {
    const prompt = buildDocumentSystemPrompt(baseDoc);
    expect(prompt.toLowerCase()).toContain('consulting');
  });

  it('handles single tag correctly', () => {
    const doc = { ...baseDoc, tags: ['Governance'] };
    const prompt = buildDocumentSystemPrompt(doc);
    expect(prompt).toContain('Governance');
    expect(prompt).not.toContain('None');
  });
});

// ─────────────────────────────────────────────────────────────
describe('chatWithDocument', () => {
  const messages: ChatMsg[] = [{ role: 'user', content: 'What is this document about?' }];
  const systemPrompt = 'You are an expert consultant.';

  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    vi.stubEnv('VITE_OPENROUTER_API_KEY', 'test-api-key');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('throws when VITE_OPENROUTER_API_KEY is not set', async () => {
    vi.stubEnv('VITE_OPENROUTER_API_KEY', '');
    await expect(chatWithDocument(messages, systemPrompt)).rejects.toThrow(
      'OpenRouter API key not set'
    );
  });

  it('calls fetch with correct URL', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'AI response' } }] }),
    });
    await chatWithDocument(messages, systemPrompt);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.any(Object)
    );
  });

  it('sends POST request', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'AI response' } }] }),
    });
    await chatWithDocument(messages, systemPrompt);
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.method).toBe('POST');
  });

  it('sends Authorization header with Bearer token', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'AI response' } }] }),
    });
    await chatWithDocument(messages, systemPrompt);
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers['Authorization']).toBe('Bearer test-api-key');
  });

  it('includes system prompt as first message in body', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'AI response' } }] }),
    });
    await chatWithDocument(messages, systemPrompt);
    const [, opts] = mockFetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.messages[0]).toEqual({ role: 'system', content: systemPrompt });
  });

  it('appends user messages after system prompt', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'AI response' } }] }),
    });
    await chatWithDocument(messages, systemPrompt);
    const [, opts] = mockFetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.messages[1]).toEqual({ role: 'user', content: 'What is this document about?' });
  });

  it('returns trimmed content from choices[0]', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '  AI analysis result  ' } }] }),
    });
    const result = await chatWithDocument(messages, systemPrompt);
    expect(result).toBe('AI analysis result');
  });

  it('returns "No response received." when choices are empty', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [] }),
    });
    const result = await chatWithDocument(messages, systemPrompt);
    expect(result).toBe('No response received.');
  });

  it('returns "No response received." when response has no choices', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    const result = await chatWithDocument(messages, systemPrompt);
    expect(result).toBe('No response received.');
  });

  it('throws with error message from API on non-ok response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: 'Rate limit exceeded' } }),
    });
    await expect(chatWithDocument(messages, systemPrompt)).rejects.toThrow('Rate limit exceeded');
  });

  it('throws fallback error when API error response has no message', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });
    await expect(chatWithDocument(messages, systemPrompt)).rejects.toThrow('OpenRouter error 500');
  });

  it('sets Content-Type to application/json', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'response' } }] }),
    });
    await chatWithDocument(messages, systemPrompt);
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers['Content-Type']).toBe('application/json');
  });

  it('sends multiple user messages in order', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'response' } }] }),
    });
    const multiMessages: ChatMsg[] = [
      { role: 'user', content: 'First question' },
      { role: 'assistant', content: 'First answer' },
      { role: 'user', content: 'Follow-up question' },
    ];
    await chatWithDocument(multiMessages, systemPrompt);
    const [, opts] = mockFetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    // system + 3 messages = 4 total
    expect(body.messages).toHaveLength(4);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[1].content).toBe('First question');
    expect(body.messages[3].content).toBe('Follow-up question');
  });

  it('throws network error when fetch rejects', async () => {
    mockFetch.mockRejectedValue(new Error('Network connection refused'));
    await expect(chatWithDocument(messages, systemPrompt)).rejects.toThrow('Network connection refused');
  });

  it('includes model in request body', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    await chatWithDocument(messages, systemPrompt);
    const [, opts] = mockFetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.model).toBeDefined();
    expect(typeof body.model).toBe('string');
  });

  it('sends HTTP-Referer header', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    await chatWithDocument(messages, systemPrompt);
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers['HTTP-Referer']).toBeDefined();
  });

  it('sends X-Title header with Consultant OS', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    await chatWithDocument(messages, systemPrompt);
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers['X-Title']).toBe('Consultant OS');
  });

  it('includes max_tokens: 2048 in request body', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    await chatWithDocument(messages, systemPrompt);
    const [, opts] = mockFetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.max_tokens).toBe(2048);
  });

  it('includes temperature: 0.7 in request body', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    await chatWithDocument(messages, systemPrompt);
    const [, opts] = mockFetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.temperature).toBe(0.7);
  });

  it('returns "No response received." when choices[0].message.content is undefined', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: {} }] }),
    });
    const result = await chatWithDocument(messages, systemPrompt);
    expect(result).toBe('No response received.');
  });

  it('returns "No response received." when choices[0].message is null', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: null }] }),
    });
    const result = await chatWithDocument(messages, systemPrompt);
    expect(result).toBe('No response received.');
  });

  it('sends conversation with assistant role message', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'follow-up response' } }] }),
    });
    const convo = [
      { role: 'user' as const, content: 'Hello' },
      { role: 'assistant' as const, content: 'Hi there' },
      { role: 'user' as const, content: 'Follow up?' },
    ];
    const result = await chatWithDocument(convo, systemPrompt);
    expect(result).toBe('follow-up response');
    const [, opts] = mockFetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.messages[2].role).toBe('assistant');
  });

  it('stringifies body as JSON', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    await chatWithDocument(messages, systemPrompt);
    const [, opts] = mockFetch.mock.calls[0];
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it('returns content with internal whitespace untrimmed', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'hello world' } }] }),
    });
    const result = await chatWithDocument(messages, systemPrompt);
    expect(result).toBe('hello world');
  });

  it('passes empty messages array with just system prompt', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'response' } }] }),
    });
    await chatWithDocument([], systemPrompt);
    const [, opts] = mockFetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    // Only the system prompt message
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].role).toBe('system');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt (additional cases)', () => {
  const baseDoc = {
    name: 'MOCI Procurement Plan',
    type: 'Procurement Summary',
    author: 'Rania Taleb',
    date: '2026-04-01',
    workspace: 'MOCI',
    status: 'Draft',
    language: 'AR',
    summary: 'Procurement reform strategy for 2026.',
    tags: ['Procurement', 'MOCI', 'Government'],
  };

  it('works with Arabic language', () => {
    const prompt = buildDocumentSystemPrompt(baseDoc);
    expect(prompt).toContain('AR');
    expect(prompt).toContain('MOCI');
  });

  it('handles documents with many tags', () => {
    const doc = { ...baseDoc, tags: ['T1', 'T2', 'T3', 'T4', 'T5'] };
    const prompt = buildDocumentSystemPrompt(doc);
    expect(prompt).toContain('T1, T2, T3, T4, T5');
  });

  it('includes workspace in prompt', () => {
    const prompt = buildDocumentSystemPrompt(baseDoc);
    expect(prompt).toContain('MOCI');
  });

  it('includes document type in prompt', () => {
    const prompt = buildDocumentSystemPrompt(baseDoc);
    expect(prompt).toContain('Procurement Summary');
  });

  it('includes actionable insights instruction', () => {
    const prompt = buildDocumentSystemPrompt(baseDoc);
    expect(prompt.toLowerCase()).toContain('actionable');
  });

  it('includes metadata instruction', () => {
    const prompt = buildDocumentSystemPrompt(baseDoc);
    expect(prompt.toLowerCase()).toContain('metadata');
  });

  it('includes professional instruction', () => {
    const prompt = buildDocumentSystemPrompt(baseDoc);
    expect(prompt.toLowerCase()).toContain('professional');
  });

  it('includes the answer/respond instruction text', () => {
    const prompt = buildDocumentSystemPrompt(baseDoc);
    expect(prompt.toLowerCase()).toContain('answer');
  });

  it('separates tags with comma and space', () => {
    const doc = { ...baseDoc, tags: ['A', 'B', 'C'] };
    const prompt = buildDocumentSystemPrompt(doc);
    expect(prompt).toContain('A, B, C');
  });

  it('works with draft status document', () => {
    const prompt = buildDocumentSystemPrompt(baseDoc);
    expect(prompt).toContain('Draft');
  });

  it('produces different prompts for different documents', () => {
    const doc2 = { ...baseDoc, name: 'Different Document Name', type: 'Risk Register' };
    const prompt1 = buildDocumentSystemPrompt(baseDoc);
    const prompt2 = buildDocumentSystemPrompt(doc2);
    expect(prompt1).not.toBe(prompt2);
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt (edge cases)', () => {
  const minimalDoc = {
    name: 'Minimal Doc',
    type: 'Report',
    author: 'Test Author',
    date: '2026-01-01',
    workspace: 'Test WS',
    status: 'Active',
    language: 'EN',
  };

  it('handles missing summary gracefully', () => {
    const prompt = buildDocumentSystemPrompt(minimalDoc);
    expect(prompt).toContain('No summary provided');
  });

  it('handles missing tags gracefully', () => {
    const prompt = buildDocumentSystemPrompt(minimalDoc);
    expect(prompt).toContain('None');
  });

  it('returns a non-empty string for minimal doc', () => {
    const prompt = buildDocumentSystemPrompt(minimalDoc);
    expect(prompt.length).toBeGreaterThan(50);
  });

  it('includes document name for minimal doc', () => {
    const prompt = buildDocumentSystemPrompt(minimalDoc);
    expect(prompt).toContain('Minimal Doc');
  });

  it('includes document type for minimal doc', () => {
    const prompt = buildDocumentSystemPrompt(minimalDoc);
    expect(prompt).toContain('Report');
  });

  it('handles very long document names', () => {
    const doc = { ...minimalDoc, name: 'A'.repeat(200) };
    const prompt = buildDocumentSystemPrompt(doc);
    expect(prompt).toContain('A'.repeat(200));
  });

  it('handles special characters in author name', () => {
    const doc = { ...minimalDoc, author: 'Ahmed Al-Khalil (PhD)' };
    const prompt = buildDocumentSystemPrompt(doc);
    expect(prompt).toContain('Ahmed Al-Khalil (PhD)');
  });

  it('handles Arabic workspace name', () => {
    const doc = { ...minimalDoc, workspace: 'وزارة الاتصالات' };
    const prompt = buildDocumentSystemPrompt(doc);
    expect(prompt).toContain('وزارة الاتصالات');
  });
});

// ─────────────────────────────────────────────────────────────
describe('chatWithDocument – additional edge cases', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    vi.stubEnv('VITE_OPENROUTER_API_KEY', 'test-api-key');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('trims leading and trailing whitespace from response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '\n\n  Analysis result  \n\n' } }] }),
    });
    const result = await chatWithDocument([{ role: 'user', content: 'test' }], 'system');
    expect(result).toBe('Analysis result');
  });

  it('handles API returning 401 unauthorized', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Unauthorized: invalid API key' } }),
    });
    await expect(
      chatWithDocument([{ role: 'user', content: 'test' }], 'system')
    ).rejects.toThrow('Unauthorized: invalid API key');
  });

  it('handles API returning 503 service unavailable', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    });
    await expect(
      chatWithDocument([{ role: 'user', content: 'test' }], 'system')
    ).rejects.toThrow('OpenRouter error 503');
  });

  it('includes the API key value in Authorization header', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    await chatWithDocument([{ role: 'user', content: 'q' }], 'sys');
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers['Authorization']).toContain('test-api-key');
  });

  it('sends body as a string (not object)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    await chatWithDocument([{ role: 'user', content: 'q' }], 'sys');
    const [, opts] = mockFetch.mock.calls[0];
    expect(typeof opts.body).toBe('string');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt (additional cases)', () => {
  const baseDoc = {
    name: 'ADNOC Risk Framework',
    type: 'Report',
    author: 'Rania Taleb',
    date: '2026-02-01',
    workspace: 'ADNOC',
    status: 'Draft',
    language: 'AR',
    summary: 'Comprehensive risk framework for ADNOC portfolio.',
    tags: ['Risk', 'Framework', 'ADNOC'],
  };

  it('includes tags in prompt', () => {
    const prompt = buildDocumentSystemPrompt(baseDoc);
    expect(prompt).toContain('Risk');
    expect(prompt).toContain('Framework');
    expect(prompt).toContain('ADNOC');
  });

  it('includes None when no tags provided', () => {
    const prompt = buildDocumentSystemPrompt({ ...baseDoc, tags: [] });
    expect(prompt).toContain('None');
  });

  it('includes None when tags is undefined', () => {
    const prompt = buildDocumentSystemPrompt({ ...baseDoc, tags: undefined });
    expect(prompt).toContain('None');
  });

  it('shows no summary fallback message when summary is empty string', () => {
    const prompt = buildDocumentSystemPrompt({ ...baseDoc, summary: '' });
    expect(prompt).toContain('No summary provided');
  });

  it('shows no summary fallback message when summary is undefined', () => {
    const prompt = buildDocumentSystemPrompt({ ...baseDoc, summary: undefined });
    expect(prompt).toContain('No summary provided');
  });

  it('includes AR language in prompt', () => {
    const prompt = buildDocumentSystemPrompt(baseDoc);
    expect(prompt).toContain('AR');
  });

  it('includes Draft status in prompt', () => {
    const prompt = buildDocumentSystemPrompt(baseDoc);
    expect(prompt).toContain('Draft');
  });

  it('includes 2026-02-01 date in prompt', () => {
    const prompt = buildDocumentSystemPrompt(baseDoc);
    expect(prompt).toContain('2026-02-01');
  });

  it('returns a string', () => {
    const prompt = buildDocumentSystemPrompt(baseDoc);
    expect(typeof prompt).toBe('string');
  });

  it('prompt starts with expected consulting tone prefix', () => {
    const prompt = buildDocumentSystemPrompt(baseDoc);
    expect(prompt).toContain('expert AI consultant assistant');
  });
});

// ─────────────────────────────────────────────────────────────
describe('chatWithDocument (request structure)', () => {
  let localMockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localMockFetch = vi.fn();
    vi.stubGlobal('fetch', localMockFetch);
    vi.stubEnv('VITE_OPENROUTER_API_KEY', 'test-api-key');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('sends max_tokens 2048 in request body', async () => {
    localMockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'done' } }] }),
    });
    await chatWithDocument([{ role: 'user', content: 'hello' }], 'sys');
    const [, opts] = localMockFetch.mock.calls[0];
    const parsed = JSON.parse(opts.body);
    expect(parsed.max_tokens).toBe(2048);
  });

  it('sends temperature 0.7 in request body', async () => {
    localMockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'done' } }] }),
    });
    await chatWithDocument([{ role: 'user', content: 'hello' }], 'sys');
    const [, opts] = localMockFetch.mock.calls[0];
    const parsed = JSON.parse(opts.body);
    expect(parsed.temperature).toBe(0.7);
  });

  it('includes system prompt as first message', async () => {
    localMockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'done' } }] }),
    });
    await chatWithDocument([{ role: 'user', content: 'hello' }], 'my-system-prompt');
    const [, opts] = localMockFetch.mock.calls[0];
    const parsed = JSON.parse(opts.body);
    expect(parsed.messages[0]).toMatchObject({ role: 'system', content: 'my-system-prompt' });
  });

  it('uses POST method', async () => {
    localMockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'done' } }] }),
    });
    await chatWithDocument([{ role: 'user', content: 'hello' }], 'sys');
    const [, opts] = localMockFetch.mock.calls[0];
    expect(opts.method).toBe('POST');
  });

  it('returns No response received when choices is empty', async () => {
    localMockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [] }),
    });
    const result = await chatWithDocument([{ role: 'user', content: 'hello' }], 'sys');
    expect(result).toBe('No response received.');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – prompt structure', () => {
  const doc = {
    name: 'SEC Fintech Strategy',
    type: 'Strategy Report',
    author: 'Khalid Al-Rashid',
    date: '2026-05-01',
    workspace: 'SEC',
    status: 'Under Review',
    language: 'Bilingual',
    summary: 'Capital markets digital transformation roadmap.',
    tags: ['Fintech', 'Capital Markets', 'Strategy'],
  };

  it('includes Bilingual language in prompt', () => {
    const prompt = buildDocumentSystemPrompt(doc);
    expect(prompt).toContain('Bilingual');
  });

  it('includes Under Review status in prompt', () => {
    const prompt = buildDocumentSystemPrompt(doc);
    expect(prompt).toContain('Under Review');
  });

  it('includes all three tags joined with commas', () => {
    const prompt = buildDocumentSystemPrompt(doc);
    expect(prompt).toContain('Fintech, Capital Markets, Strategy');
  });

  it('includes Strategy Report type in prompt', () => {
    const prompt = buildDocumentSystemPrompt(doc);
    expect(prompt).toContain('Strategy Report');
  });

  it('includes Capital markets digital transformation roadmap in summary', () => {
    const prompt = buildDocumentSystemPrompt(doc);
    expect(prompt).toContain('Capital markets digital transformation roadmap.');
  });

  it('includes 2026-05-01 date in prompt', () => {
    const prompt = buildDocumentSystemPrompt(doc);
    expect(prompt).toContain('2026-05-01');
  });

  it('includes Khalid Al-Rashid author in prompt', () => {
    const prompt = buildDocumentSystemPrompt(doc);
    expect(prompt).toContain('Khalid Al-Rashid');
  });

  it('includes "Keep responses focused" instruction', () => {
    const prompt = buildDocumentSystemPrompt(doc);
    expect(prompt.toLowerCase()).toContain('keep responses focused');
  });

  it('includes "Base answers" instruction', () => {
    const prompt = buildDocumentSystemPrompt(doc);
    expect(prompt.toLowerCase()).toContain('base answers');
  });

  it('produces a prompt that is a string starting with "You are"', () => {
    const prompt = buildDocumentSystemPrompt(doc);
    expect(prompt.startsWith('You are')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
describe('chatWithDocument – model field', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    vi.stubEnv('VITE_OPENROUTER_API_KEY', 'test-key-xyz');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('uses google/gemini-2.0-flash-exp:free as model', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    await chatWithDocument([{ role: 'user', content: 'hi' }], 'sys');
    const [, opts] = mockFetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.model).toBe('google/gemini-2.0-flash-exp:free');
  });

  it('sends exactly 2 messages when 1 user message provided', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    await chatWithDocument([{ role: 'user', content: 'question' }], 'system-prompt');
    const [, opts] = mockFetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.messages).toHaveLength(2);
  });

  it('throws with full error message text from API', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: 'Bad request: invalid model' } }),
    });
    await expect(
      chatWithDocument([{ role: 'user', content: 'q' }], 'sys')
    ).rejects.toThrow('Bad request: invalid model');
  });

  it('fetch called exactly once per chatWithDocument call', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    await chatWithDocument([{ role: 'user', content: 'test' }], 'sys');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('returns the content trimmed when whitespace-only response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '   ' } }] }),
    });
    const result = await chatWithDocument([{ role: 'user', content: 'test' }], 'sys');
    expect(result).toBe('');
  });

  it('sends max_tokens of 2048 in the request body', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    await chatWithDocument([{ role: 'user', content: 'test' }], 'sys');
    const [, opts] = mockFetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.max_tokens).toBe(2048);
  });

  it('sends temperature of 0.7 in the request body', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    await chatWithDocument([{ role: 'user', content: 'test' }], 'sys');
    const [, opts] = mockFetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.temperature).toBe(0.7);
  });

  it('uses POST method in fetch call', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    await chatWithDocument([{ role: 'user', content: 'test' }], 'sys');
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.method).toBe('POST');
  });

  it('includes Authorization header with Bearer prefix', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    await chatWithDocument([{ role: 'user', content: 'test' }], 'sys');
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers['Authorization']).toMatch(/^Bearer /);
  });

  it('includes Content-Type application/json header', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    await chatWithDocument([{ role: 'user', content: 'test' }], 'sys');
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers['Content-Type']).toBe('application/json');
  });

  it('includes X-Title: Consultant OS header', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    await chatWithDocument([{ role: 'user', content: 'test' }], 'sys');
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers['X-Title']).toBe('Consultant OS');
  });

  it('returns No response received when choices array is empty', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [] }),
    });
    const result = await chatWithDocument([{ role: 'user', content: 'test' }], 'sys');
    expect(result).toBe('No response received.');
  });

  it('throws OpenRouter error with status code when no error message', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    });
    await expect(
      chatWithDocument([{ role: 'user', content: 'q' }], 'sys')
    ).rejects.toThrow('OpenRouter error 503');
  });

  it('places system message first in messages array', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    await chatWithDocument([{ role: 'user', content: 'hello' }], 'my-system-prompt');
    const [, opts] = mockFetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[0].content).toBe('my-system-prompt');
  });

  it('places user message after system message', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    await chatWithDocument([{ role: 'user', content: 'user-msg' }], 'sys');
    const [, opts] = mockFetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.messages[1].content).toBe('user-msg');
  });

  it('handles multiple messages in conversation', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'multi ok' } }] }),
    });
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'reply' },
      { role: 'user', content: 'follow up' },
    ];
    const result = await chatWithDocument(messages, 'sys');
    expect(result).toBe('multi ok');
    const [, opts] = mockFetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    // 1 system + 3 user/assistant = 4 total
    expect(body.messages).toHaveLength(4);
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – tags content', () => {
  const baseDoc = {
    name: 'Test Document',
    type: 'Report',
    author: 'Rania Taleb',
    date: '2026-01-15',
    workspace: 'MOCI',
    status: 'Draft',
    language: 'AR',
    summary: 'Summary for MOCI procurement analysis',
    tags: ['Procurement', 'MOCI', 'Phase 2'],
  };

  it('includes all tags in prompt', () => {
    const prompt = buildDocumentSystemPrompt(baseDoc);
    expect(prompt).toContain('Procurement');
  });

  it('includes MOCI tag in prompt', () => {
    const prompt = buildDocumentSystemPrompt(baseDoc);
    expect(prompt).toContain('MOCI');
  });

  it('includes Phase 2 tag in prompt', () => {
    const prompt = buildDocumentSystemPrompt(baseDoc);
    expect(prompt).toContain('Phase 2');
  });

  it('includes summary text in prompt', () => {
    const prompt = buildDocumentSystemPrompt(baseDoc);
    expect(prompt).toContain('Summary for MOCI procurement analysis');
  });

  it('includes Draft status in prompt', () => {
    const prompt = buildDocumentSystemPrompt(baseDoc);
    expect(prompt).toContain('Draft');
  });

  it('includes AR language in prompt', () => {
    const prompt = buildDocumentSystemPrompt(baseDoc);
    expect(prompt).toContain('AR');
  });

  it('includes Rania Taleb author in prompt', () => {
    const prompt = buildDocumentSystemPrompt(baseDoc);
    expect(prompt).toContain('Rania Taleb');
  });

  it('returns a string', () => {
    const prompt = buildDocumentSystemPrompt(baseDoc);
    expect(typeof prompt).toBe('string');
  });
});

// ─────────────────────────────────────────────────────────────
describe('chatWithDocument – response parsing', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    vi.stubEnv('VITE_OPENROUTER_API_KEY', 'test-api-key');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('returns the content string from API response', async () => {
    const expectedContent = 'Portfolio has 8 active engagements.';
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: expectedContent } }] }),
    });
    const result = await chatWithDocument([{ role: 'user', content: 'q' }], 'sys');
    expect(result).toBe(expectedContent);
  });

  it('handles empty response content', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '' } }] }),
    });
    const result = await chatWithDocument([{ role: 'user', content: 'q' }], 'sys');
    expect(result).toBe('');
  });

  it('sends Content-Type application/json header', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    await chatWithDocument([{ role: 'user', content: 'q' }], 'sys');
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers['Content-Type']).toBe('application/json');
  });

  it('throws on non-ok response with error message', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: 'Model not available' } }),
    });
    await expect(chatWithDocument([{ role: 'user', content: 'q' }], 'sys'))
      .rejects.toThrow('Model not available');
  });

  it('throws on network error', async () => {
    mockFetch.mockRejectedValue(new Error('Network failure'));
    await expect(chatWithDocument([{ role: 'user', content: 'q' }], 'sys'))
      .rejects.toThrow('Network failure');
  });

  it('sends body as JSON string', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    await chatWithDocument([{ role: 'user', content: 'q' }], 'sys');
    const [, opts] = mockFetch.mock.calls[0];
    expect(typeof opts.body).toBe('string');
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – prompt is non-empty', () => {
  it('returns non-empty string for minimal document', () => {
    const prompt = buildDocumentSystemPrompt({
      name: 'Minimal Doc',
      type: 'Report',
      author: 'Author',
      date: '2026-01-01',
      workspace: 'WS',
      status: 'Draft',
      language: 'EN',
      summary: '',
      tags: [],
    });
    expect(prompt.length).toBeGreaterThan(10);
  });

  it('prompt includes summary text when summary is very long', () => {
    const longSummary = 'This is a very detailed summary with unique content: UniqueToken12345 that must appear in the prompt verbatim.';
    const withLongSummary = buildDocumentSystemPrompt({
      name: 'Doc',
      type: 'BRD',
      author: 'A',
      date: '2026-01-01',
      workspace: 'W',
      status: 'Draft',
      language: 'EN',
      summary: longSummary,
      tags: [],
    });
    // The unique token from summary should appear in the prompt
    expect(withLongSummary).toContain('UniqueToken12345');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – separator and structure', () => {
  const doc = {
    name: 'Test BRD',
    type: 'BRD',
    author: 'Test Author',
    date: '2026-01-01',
    workspace: 'TestWS',
    status: 'Active',
    language: 'EN',
    summary: 'A test summary.',
    tags: ['Test'],
  };

  it('contains separator line ━━━', () => {
    const prompt = buildDocumentSystemPrompt(doc);
    expect(prompt).toContain('━━━');
  });

  it('contains "Document Name:" label', () => {
    const prompt = buildDocumentSystemPrompt(doc);
    expect(prompt).toContain('Document Name:');
  });

  it('contains "Type:" label', () => {
    const prompt = buildDocumentSystemPrompt(doc);
    expect(prompt).toContain('Type:');
  });

  it('contains "Author:" label', () => {
    const prompt = buildDocumentSystemPrompt(doc);
    expect(prompt).toContain('Author:');
  });

  it('contains "Date:" label', () => {
    const prompt = buildDocumentSystemPrompt(doc);
    expect(prompt).toContain('Date:');
  });

  it('contains "Workspace:" label', () => {
    const prompt = buildDocumentSystemPrompt(doc);
    expect(prompt).toContain('Workspace:');
  });

  it('contains "Status:" label', () => {
    const prompt = buildDocumentSystemPrompt(doc);
    expect(prompt).toContain('Status:');
  });

  it('contains "Language:" label', () => {
    const prompt = buildDocumentSystemPrompt(doc);
    expect(prompt).toContain('Language:');
  });

  it('contains "Tags:" label', () => {
    const prompt = buildDocumentSystemPrompt(doc);
    expect(prompt).toContain('Tags:');
  });

  it('contains "Summary:" label', () => {
    const prompt = buildDocumentSystemPrompt(doc);
    expect(prompt).toContain('Summary:');
  });

  it('contains "Consultant OS" product name', () => {
    const prompt = buildDocumentSystemPrompt(doc);
    expect(prompt).toContain('Consultant OS');
  });

  it('starts with "You are an expert AI consultant"', () => {
    const prompt = buildDocumentSystemPrompt(doc);
    expect(prompt).toContain('You are an expert AI consultant');
  });

  it('includes "focused" instruction at the end', () => {
    const prompt = buildDocumentSystemPrompt(doc);
    expect(prompt).toContain('focused');
  });
});

// ─────────────────────────────────────────────────────────────
describe('chatWithDocument – key error message content', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    vi.stubEnv('VITE_OPENROUTER_API_KEY', 'test-key-abc');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('error message contains "VITE_OPENROUTER_API_KEY" when key is missing', async () => {
    vi.stubEnv('VITE_OPENROUTER_API_KEY', '');
    await expect(chatWithDocument([{ role: 'user', content: 'test' }], 'sys'))
      .rejects.toThrow('VITE_OPENROUTER_API_KEY');
  });

  it('appends correct user message at index 1 after system', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    await chatWithDocument([{ role: 'user', content: 'specific user content' }], 'sys-prompt');
    const [, opts] = mockFetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.messages[1].content).toBe('specific user content');
    expect(body.messages[1].role).toBe('user');
  });

  it('passes system prompt at index 0 in messages array', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    await chatWithDocument([], 'special-system-prompt');
    const [, opts] = mockFetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.messages[0].content).toBe('special-system-prompt');
  });

  it('model field is a non-empty string', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    await chatWithDocument([{ role: 'user', content: 'hi' }], 'sys');
    const [, opts] = mockFetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.model.length).toBeGreaterThan(0);
  });

  it('throws error with status code 404 when API not found', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({}),
    });
    await expect(chatWithDocument([{ role: 'user', content: 'q' }], 'sys'))
      .rejects.toThrow('OpenRouter error 404');
  });

  it('handles multiple assistant messages in history', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'final response' } }] }),
    });
    const history = [
      { role: 'user' as const, content: 'q1' },
      { role: 'assistant' as const, content: 'a1' },
      { role: 'user' as const, content: 'q2' },
      { role: 'assistant' as const, content: 'a2' },
      { role: 'user' as const, content: 'q3' },
    ];
    const result = await chatWithDocument(history, 'sys');
    expect(result).toBe('final response');
    const [, opts] = mockFetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    // 1 system + 5 history = 6 total
    expect(body.messages).toHaveLength(6);
  });
});

// ─────────────────────────────────────────────────────────────
describe('chatWithDocument – fetch request details', () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    vi.stubEnv('VITE_OPENROUTER_API_KEY', 'test-api-key');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('calls fetch with chat/completions endpoint', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    await chatWithDocument([{ role: 'user', content: 'hi' }], 'sys');
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('chat/completions');
  });

  it('sets Authorization header starting with Bearer', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    await chatWithDocument([{ role: 'user', content: 'hi' }], 'sys');
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers['Authorization']).toMatch(/^Bearer /);
  });

  it('sets Content-Type header to application/json', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    await chatWithDocument([{ role: 'user', content: 'hi' }], 'sys');
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers['Content-Type']).toBe('application/json');
  });

  it('sets max_tokens to 2048 in request body', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    await chatWithDocument([{ role: 'user', content: 'hi' }], 'sys');
    const [, opts] = mockFetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.max_tokens).toBe(2048);
  });

  it('sets temperature to 0.7 in request body', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    await chatWithDocument([{ role: 'user', content: 'hi' }], 'sys');
    const [, opts] = mockFetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.temperature).toBe(0.7);
  });

  it('uses POST method', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    await chatWithDocument([{ role: 'user', content: 'hi' }], 'sys');
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.method).toBe('POST');
  });
});

// ─────────────────────────────────────────────────────────────
describe('chatWithDocument – response edge cases', () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    vi.stubEnv('VITE_OPENROUTER_API_KEY', 'test-api-key');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('returns "No response received." when choices array is empty', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [] }),
    });
    const result = await chatWithDocument([{ role: 'user', content: 'q' }], 'sys');
    expect(result).toBe('No response received.');
  });

  it('returns "No response received." when choices is missing', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    const result = await chatWithDocument([{ role: 'user', content: 'q' }], 'sys');
    expect(result).toBe('No response received.');
  });

  it('throws error on status 500', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });
    await expect(chatWithDocument([{ role: 'user', content: 'q' }], 'sys'))
      .rejects.toThrow('OpenRouter error 500');
  });

  it('throws error with custom message from API error response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Invalid API key' } }),
    });
    await expect(chatWithDocument([{ role: 'user', content: 'q' }], 'sys'))
      .rejects.toThrow('Invalid API key');
  });

  it('trims whitespace from response content', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '  hello world  ' } }] }),
    });
    const result = await chatWithDocument([{ role: 'user', content: 'q' }], 'sys');
    expect(result).toBe('hello world');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – with tags array', () => {
  it('joins multiple tags with comma separator', () => {
    const prompt = buildDocumentSystemPrompt({
      name: 'Test Doc', type: 'BRD', author: 'AM',
      date: '2026-01-01', workspace: 'NCA', status: 'Draft',
      language: 'EN', tags: ['Architecture', 'Security', 'Cloud'],
    });
    expect(prompt).toContain('Architecture, Security, Cloud');
  });

  it('shows "None" when tags array is empty', () => {
    const prompt = buildDocumentSystemPrompt({
      name: 'Test Doc', type: 'BRD', author: 'AM',
      date: '2026-01-01', workspace: 'NCA', status: 'Draft',
      language: 'EN', tags: [],
    });
    expect(prompt).toContain('None');
  });

  it('shows "None" when tags is undefined', () => {
    const prompt = buildDocumentSystemPrompt({
      name: 'Test Doc', type: 'BRD', author: 'AM',
      date: '2026-01-01', workspace: 'NCA', status: 'Draft',
      language: 'EN',
    });
    expect(prompt).toContain('None');
  });

  it('includes consulting tone instruction', () => {
    const prompt = buildDocumentSystemPrompt({
      name: 'Doc', type: 'Report', author: 'AM',
      date: '2026-01-01', workspace: 'WS', status: 'Draft', language: 'EN',
    });
    expect(prompt).toContain('professional, concise consulting tone');
  });

  it('shows fallback text when summary is undefined', () => {
    const prompt = buildDocumentSystemPrompt({
      name: 'Doc', type: 'Report', author: 'AM',
      date: '2026-01-01', workspace: 'WS', status: 'Draft', language: 'EN',
    });
    expect(prompt).toContain('No summary provided');
  });

  it('shows actual summary when provided', () => {
    const prompt = buildDocumentSystemPrompt({
      name: 'Doc', type: 'Report', author: 'AM',
      date: '2026-01-01', workspace: 'WS', status: 'Draft', language: 'EN',
      summary: 'This is a detailed BRD for the NCA platform.',
    });
    expect(prompt).toContain('This is a detailed BRD for the NCA platform.');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – content structure', () => {
  it('includes document name in prompt', () => {
    const prompt = buildDocumentSystemPrompt({
      name: 'NCA BRD v2', type: 'BRD', author: 'AM',
      date: '2026-03-15', workspace: 'NCA', status: 'Final', language: 'EN',
    });
    expect(prompt).toContain('NCA BRD v2');
  });

  it('includes type in prompt', () => {
    const prompt = buildDocumentSystemPrompt({
      name: 'Doc', type: 'FRD', author: 'AM',
      date: '2026-03-15', workspace: 'NCA', status: 'Draft', language: 'EN',
    });
    expect(prompt).toContain('FRD');
  });

  it('includes workspace in prompt', () => {
    const prompt = buildDocumentSystemPrompt({
      name: 'Doc', type: 'BRD', author: 'AM',
      date: '2026-03-15', workspace: 'MOCI', status: 'Draft', language: 'EN',
    });
    expect(prompt).toContain('MOCI');
  });

  it('includes author in prompt', () => {
    const prompt = buildDocumentSystemPrompt({
      name: 'Doc', type: 'BRD', author: 'Rania Taleb',
      date: '2026-03-15', workspace: 'NCA', status: 'Draft', language: 'EN',
    });
    expect(prompt).toContain('Rania Taleb');
  });

  it('includes status in prompt', () => {
    const prompt = buildDocumentSystemPrompt({
      name: 'Doc', type: 'BRD', author: 'AM',
      date: '2026-03-15', workspace: 'NCA', status: 'Under Review', language: 'EN',
    });
    expect(prompt).toContain('Under Review');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – language in prompt', () => {
  it('includes language in prompt', () => {
    const prompt = buildDocumentSystemPrompt({
      name: 'Doc', type: 'BRD', author: 'AM',
      date: '2026-03-15', workspace: 'NCA', status: 'Draft', language: 'AR',
    });
    expect(prompt).toContain('AR');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – date in prompt', () => {
  it('includes date in prompt', () => {
    const prompt = buildDocumentSystemPrompt({
      name: 'Doc', type: 'BRD', author: 'AM',
      date: '2026-06-01', workspace: 'NCA', status: 'Final', language: 'EN',
    });
    expect(prompt).toContain('2026-06-01');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – metadata-only notice', () => {
  it('instructs about metadata-only responses when content not in summary', () => {
    const prompt = buildDocumentSystemPrompt({
      name: 'Doc', type: 'BRD', author: 'AM',
      date: '2026-01-01', workspace: 'WS', status: 'Draft', language: 'EN',
      summary: 'A summary.',
    });
    expect(prompt).toContain('metadata');
  });

  it('contains instruction about working from metadata only when no summary', () => {
    const prompt = buildDocumentSystemPrompt({
      name: 'Doc', type: 'BRD', author: 'AM',
      date: '2026-01-01', workspace: 'WS', status: 'Draft', language: 'EN',
      summary: undefined,
    });
    expect(prompt).toContain('metadata only');
  });

  it('contains actionable insights instruction', () => {
    const prompt = buildDocumentSystemPrompt({
      name: 'Doc', type: 'BRD', author: 'AM',
      date: '2026-01-01', workspace: 'WS', status: 'Draft', language: 'EN',
    });
    expect(prompt).toContain('actionable insights');
  });

  it('instructs about professional and concise consulting tone', () => {
    const prompt = buildDocumentSystemPrompt({
      name: 'Doc', type: 'BRD', author: 'AM',
      date: '2026-01-01', workspace: 'WS', status: 'Draft', language: 'EN',
    });
    expect(prompt).toContain('concise consulting tone');
  });

  it('contains "Base answers" instruction in prompt', () => {
    const prompt = buildDocumentSystemPrompt({
      name: 'Doc', type: 'Report', author: 'AM',
      date: '2026-01-01', workspace: 'WS', status: 'Active', language: 'EN',
    });
    expect(prompt).toContain('Base answers');
  });

  it('contains "Keep responses" instruction in prompt', () => {
    const prompt = buildDocumentSystemPrompt({
      name: 'Doc', type: 'Report', author: 'AM',
      date: '2026-01-01', workspace: 'WS', status: 'Active', language: 'EN',
    });
    expect(prompt).toContain('Keep responses');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – one tag', () => {
  it('includes single tag without trailing comma', () => {
    const prompt = buildDocumentSystemPrompt({
      name: 'Doc', type: 'BRD', author: 'AM',
      date: '2026-01-01', workspace: 'WS', status: 'Draft', language: 'EN',
      tags: ['Governance'],
    });
    expect(prompt).toContain('Governance');
    expect(prompt).not.toContain('Governance,');
  });

  it('joins two tags with ", " separator', () => {
    const prompt = buildDocumentSystemPrompt({
      name: 'Doc', type: 'BRD', author: 'AM',
      date: '2026-01-01', workspace: 'WS', status: 'Draft', language: 'EN',
      tags: ['Risk', 'Security'],
    });
    expect(prompt).toContain('Risk, Security');
  });
});

// ─────────────────────────────────────────────────────────────
describe('chatWithDocument – URL verification', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    vi.stubEnv('VITE_OPENROUTER_API_KEY', 'test-key');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('calls fetch with URL containing openrouter.ai', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    await chatWithDocument([{ role: 'user', content: 'hi' }], 'sys');
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('openrouter.ai');
  });

  it('calls fetch with URL containing /v1/', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    await chatWithDocument([{ role: 'user', content: 'hi' }], 'sys');
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/v1/');
  });

  it('sends message count equal to system + user messages', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    const userMessages = [
      { role: 'user' as const, content: 'msg1' },
      { role: 'user' as const, content: 'msg2' },
    ];
    await chatWithDocument(userMessages, 'sys');
    const [, opts] = mockFetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    // 1 system + 2 user = 3
    expect(body.messages).toHaveLength(3);
  });

  it('model string contains "gemini"', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    await chatWithDocument([{ role: 'user', content: 'q' }], 'sys');
    const [, opts] = mockFetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.model).toContain('gemini');
  });

  it('error message from missing key contains ".env.local"', async () => {
    vi.stubEnv('VITE_OPENROUTER_API_KEY', '');
    await expect(chatWithDocument([], 'sys')).rejects.toThrow('.env.local');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – document types (new)', () => {
  const base = {
    name: 'Doc', author: 'AM', date: '2026-01-01',
    workspace: 'WS', status: 'Draft', language: 'EN',
  };

  it('includes type "PRD" in prompt', () => {
    expect(buildDocumentSystemPrompt({ ...base, type: 'PRD' })).toContain('PRD');
  });

  it('includes type "MOM" in prompt', () => {
    expect(buildDocumentSystemPrompt({ ...base, type: 'MOM' })).toContain('MOM');
  });

  it('includes type "RFC" in prompt', () => {
    expect(buildDocumentSystemPrompt({ ...base, type: 'RFC' })).toContain('RFC');
  });

  it('includes type "Meeting Notes" in prompt', () => {
    expect(buildDocumentSystemPrompt({ ...base, type: 'Meeting Notes' })).toContain('Meeting Notes');
  });

  it('includes type "Change Request" in prompt', () => {
    expect(buildDocumentSystemPrompt({ ...base, type: 'Change Request' })).toContain('Change Request');
  });

  it('includes type "GAP Analysis" in prompt', () => {
    expect(buildDocumentSystemPrompt({ ...base, type: 'GAP Analysis' })).toContain('GAP Analysis');
  });

  it('includes type "Technical Spec" in prompt', () => {
    expect(buildDocumentSystemPrompt({ ...base, type: 'Technical Spec' })).toContain('Technical Spec');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – status values (new)', () => {
  const base = {
    name: 'Doc', type: 'BRD', author: 'AM',
    date: '2026-01-01', workspace: 'WS', language: 'EN',
  };

  it('includes status "Approved" in prompt', () => {
    expect(buildDocumentSystemPrompt({ ...base, status: 'Approved' })).toContain('Approved');
  });

  it('includes status "Archived" in prompt', () => {
    expect(buildDocumentSystemPrompt({ ...base, status: 'Archived' })).toContain('Archived');
  });

  it('includes status "Deprecated" in prompt', () => {
    expect(buildDocumentSystemPrompt({ ...base, status: 'Deprecated' })).toContain('Deprecated');
  });

  it('includes status "Published" in prompt', () => {
    expect(buildDocumentSystemPrompt({ ...base, status: 'Published' })).toContain('Published');
  });

  it('includes status "In Progress" in prompt', () => {
    expect(buildDocumentSystemPrompt({ ...base, status: 'In Progress' })).toContain('In Progress');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – language codes (new)', () => {
  const base = {
    name: 'Doc', type: 'BRD', author: 'AM',
    date: '2026-01-01', workspace: 'WS', status: 'Draft',
  };

  it('includes language "FR" in prompt', () => {
    expect(buildDocumentSystemPrompt({ ...base, language: 'FR' })).toContain('FR');
  });

  it('includes language "DE" in prompt', () => {
    expect(buildDocumentSystemPrompt({ ...base, language: 'DE' })).toContain('DE');
  });

  it('includes language "ZH" in prompt', () => {
    expect(buildDocumentSystemPrompt({ ...base, language: 'ZH' })).toContain('ZH');
  });
});

// ─────────────────────────────────────────────────────────────
describe('chatWithDocument – multiple choices behavior', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    vi.stubEnv('VITE_OPENROUTER_API_KEY', 'test-key');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('returns first choice content when three choices provided', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          { message: { content: 'first answer' } },
          { message: { content: 'second answer' } },
          { message: { content: 'third answer' } },
        ],
      }),
    });
    const result = await chatWithDocument([{ role: 'user', content: 'q' }], 'sys');
    expect(result).toBe('first answer');
  });

  it('returns first choice content when two choices provided', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          { message: { content: 'choice A' } },
          { message: { content: 'choice B' } },
        ],
      }),
    });
    const result = await chatWithDocument([{ role: 'user', content: 'q' }], 'sys');
    expect(result).toBe('choice A');
  });
});

// ─────────────────────────────────────────────────────────────
describe('chatWithDocument – system prompt content in request body', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    vi.stubEnv('VITE_OPENROUTER_API_KEY', 'test-key');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('sends the exact system prompt string in first message', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    const systemPrompt = 'Custom system prompt for testing purposes';
    await chatWithDocument([{ role: 'user', content: 'q' }], systemPrompt);
    const [, opts] = mockFetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.messages[0].content).toBe(systemPrompt);
  });

  it('first message in request body has role "system"', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    await chatWithDocument([{ role: 'user', content: 'q' }], 'my-system-prompt');
    const [, opts] = mockFetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.messages[0].role).toBe('system');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – language codes extended', () => {
  const base = {
    name: 'Doc', type: 'BRD', author: 'AM',
    date: '2026-01-01', workspace: 'WS', status: 'Draft',
  };

  it('includes language "ES" in prompt', () => {
    const prompt = buildDocumentSystemPrompt({ ...base, language: 'ES' });
    expect(prompt).toContain('ES');
  });

  it('includes language "PT" in prompt', () => {
    const prompt = buildDocumentSystemPrompt({ ...base, language: 'PT' });
    expect(prompt).toContain('PT');
  });

  it('includes language "JA" in prompt', () => {
    const prompt = buildDocumentSystemPrompt({ ...base, language: 'JA' });
    expect(prompt).toContain('JA');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – document types extended', () => {
  const base = {
    author: 'AM', date: '2026-01-01', workspace: 'WS',
    status: 'Draft', language: 'EN',
  };

  it('includes type "Feasibility Study" in prompt', () => {
    const prompt = buildDocumentSystemPrompt({ ...base, name: 'FS Doc', type: 'Feasibility Study' });
    expect(prompt).toContain('Feasibility Study');
  });

  it('includes type "Project Charter" in prompt', () => {
    const prompt = buildDocumentSystemPrompt({ ...base, name: 'PC Doc', type: 'Project Charter' });
    expect(prompt).toContain('Project Charter');
  });

  it('includes type "Audit Report" in prompt', () => {
    const prompt = buildDocumentSystemPrompt({ ...base, name: 'AR Doc', type: 'Audit Report' });
    expect(prompt).toContain('Audit Report');
  });

  it('includes type "Presentation" in prompt', () => {
    const prompt = buildDocumentSystemPrompt({ ...base, name: 'Pres Doc', type: 'Presentation' });
    expect(prompt).toContain('Presentation');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – platform and product mentions', () => {
  const doc = {
    name: 'Test Doc', type: 'BRD', author: 'AM',
    date: '2026-01-01', workspace: 'WS', status: 'Draft', language: 'EN',
  };

  it('includes "consulting management platform" in prompt', () => {
    const prompt = buildDocumentSystemPrompt(doc);
    expect(prompt).toContain('consulting management platform');
  });

  it('includes "Consultant OS" in prompt', () => {
    const prompt = buildDocumentSystemPrompt(doc);
    expect(prompt).toContain('Consultant OS');
  });
});

// ─────────────────────────────────────────────────────────────
describe('chatWithDocument – API key error message content', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('error message contains "restart the dev server" when key is missing', async () => {
    vi.stubEnv('VITE_OPENROUTER_API_KEY', '');
    await expect(chatWithDocument([], 'sys')).rejects.toThrow('restart the dev server');
  });

  it('error message contains "OpenRouter API key not set" phrase', async () => {
    vi.stubEnv('VITE_OPENROUTER_API_KEY', '');
    await expect(chatWithDocument([], 'sys')).rejects.toThrow('OpenRouter API key not set');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – workspace names', () => {
  const base = {
    name: 'Doc', type: 'BRD', author: 'AM',
    date: '2026-01-01', status: 'Draft', language: 'EN',
  };

  it('includes workspace "ADNOC" in prompt', () => {
    expect(buildDocumentSystemPrompt({ ...base, workspace: 'ADNOC' })).toContain('ADNOC');
  });

  it('includes workspace "SEC" in prompt', () => {
    expect(buildDocumentSystemPrompt({ ...base, workspace: 'SEC' })).toContain('SEC');
  });

  it('includes workspace "NCA" in prompt', () => {
    expect(buildDocumentSystemPrompt({ ...base, workspace: 'NCA' })).toContain('NCA');
  });

  it('includes workspace "MOCI" in prompt', () => {
    expect(buildDocumentSystemPrompt({ ...base, workspace: 'MOCI' })).toContain('MOCI');
  });
});

// ─────────────────────────────────────────────────────────────
describe('chatWithDocument – three message conversation', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    vi.stubEnv('VITE_OPENROUTER_API_KEY', 'test-key');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('sends 4 messages total for 3-message conversation', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    const history = [
      { role: 'user' as const, content: 'q1' },
      { role: 'assistant' as const, content: 'a1' },
      { role: 'user' as const, content: 'q2' },
    ];
    await chatWithDocument(history, 'sys');
    const [, opts] = mockFetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.messages).toHaveLength(4);
  });

  it('preserves order of messages in conversation', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    const history = [
      { role: 'user' as const, content: 'first-msg' },
      { role: 'assistant' as const, content: 'second-msg' },
    ];
    await chatWithDocument(history, 'sys');
    const [, opts] = mockFetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.messages[1].content).toBe('first-msg');
    expect(body.messages[2].content).toBe('second-msg');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – author name variations', () => {
  const base = {
    name: 'Doc', type: 'BRD', date: '2026-01-01',
    workspace: 'NCA', status: 'Draft', language: 'EN',
  };

  it('includes "Khalid Al-Rashid" author in prompt', () => {
    expect(buildDocumentSystemPrompt({ ...base, author: 'Khalid Al-Rashid' })).toContain('Khalid Al-Rashid');
  });

  it('includes "Rania Taleb" author in prompt', () => {
    expect(buildDocumentSystemPrompt({ ...base, author: 'Rania Taleb' })).toContain('Rania Taleb');
  });

  it('includes "Ahmed Khalil" author in prompt', () => {
    expect(buildDocumentSystemPrompt({ ...base, author: 'Ahmed Khalil' })).toContain('Ahmed Khalil');
  });

  it('includes "Faisal Hassan" author in prompt', () => {
    expect(buildDocumentSystemPrompt({ ...base, author: 'Faisal Hassan' })).toContain('Faisal Hassan');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – date formats', () => {
  const base = {
    name: 'Doc', type: 'BRD', author: 'AM',
    workspace: 'NCA', status: 'Draft', language: 'EN',
  };

  it('includes date "2025-12-31" in prompt', () => {
    expect(buildDocumentSystemPrompt({ ...base, date: '2025-12-31' })).toContain('2025-12-31');
  });

  it('includes date "2026-07-04" in prompt', () => {
    expect(buildDocumentSystemPrompt({ ...base, date: '2026-07-04' })).toContain('2026-07-04');
  });

  it('includes date "2026-09-15" in prompt', () => {
    expect(buildDocumentSystemPrompt({ ...base, date: '2026-09-15' })).toContain('2026-09-15');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – Final and Approved statuses', () => {
  const base = {
    name: 'Doc', type: 'BRD', author: 'AM',
    date: '2026-01-01', workspace: 'NCA', language: 'EN',
  };

  it('includes status "Final" in prompt', () => {
    expect(buildDocumentSystemPrompt({ ...base, status: 'Final' })).toContain('Final');
  });

  it('includes status "Approved" in prompt', () => {
    expect(buildDocumentSystemPrompt({ ...base, status: 'Approved' })).toContain('Approved');
  });

  it('includes status "Rejected" in prompt', () => {
    expect(buildDocumentSystemPrompt({ ...base, status: 'Rejected' })).toContain('Rejected');
  });

  it('includes status "On Hold" in prompt', () => {
    expect(buildDocumentSystemPrompt({ ...base, status: 'On Hold' })).toContain('On Hold');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – multi-word document names', () => {
  const base = {
    type: 'BRD', author: 'AM', date: '2026-01-01',
    workspace: 'NCA', status: 'Draft', language: 'EN',
  };

  it('includes multi-word name in prompt', () => {
    const name = 'ADNOC Digital Transformation Business Requirements';
    expect(buildDocumentSystemPrompt({ ...base, name })).toContain(name);
  });

  it('includes Arabic title with brackets in prompt', () => {
    const name = 'MOCI Procurement Reform [Phase 2]';
    expect(buildDocumentSystemPrompt({ ...base, name })).toContain(name);
  });

  it('includes document with version number in name', () => {
    const name = 'NCA Security Framework v3.2';
    expect(buildDocumentSystemPrompt({ ...base, name })).toContain(name);
  });
});

// ─────────────────────────────────────────────────────────────
describe('chatWithDocument – Authorization header key', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('uses the exact API key in Authorization header', async () => {
    vi.stubEnv('VITE_OPENROUTER_API_KEY', 'my-secret-key-123');
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    await chatWithDocument([{ role: 'user', content: 'test' }], 'sys');
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers['Authorization']).toContain('my-secret-key-123');
  });

  it('Authorization header starts with "Bearer " followed by key', async () => {
    vi.stubEnv('VITE_OPENROUTER_API_KEY', 'test-api-key-xyz');
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    await chatWithDocument([{ role: 'user', content: 'test' }], 'sys');
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers['Authorization']).toBe('Bearer test-api-key-xyz');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – workspace variations', () => {
  const base = {
    type: 'Report', author: 'AM', date: '2026-01-01',
    status: 'Draft', language: 'EN',
  };

  it('includes ZATCA workspace in prompt', () => {
    const prompt = buildDocumentSystemPrompt({ ...base, name: 'ZATCA VAT Report', workspace: 'ZATCA' });
    expect(prompt).toContain('ZATCA');
  });

  it('includes SAMA workspace in prompt', () => {
    const prompt = buildDocumentSystemPrompt({ ...base, name: 'SAMA Compliance', workspace: 'SAMA' });
    expect(prompt).toContain('SAMA');
  });

  it('includes CMA workspace in prompt', () => {
    const prompt = buildDocumentSystemPrompt({ ...base, name: 'CMA Regulations', workspace: 'CMA' });
    expect(prompt).toContain('CMA');
  });

  it('includes GAZT workspace in prompt', () => {
    const prompt = buildDocumentSystemPrompt({ ...base, name: 'GAZT Tax Strategy', workspace: 'GAZT' });
    expect(prompt).toContain('GAZT');
  });

  it('includes MOH workspace in prompt', () => {
    const prompt = buildDocumentSystemPrompt({ ...base, name: 'MOH Digital Health', workspace: 'MOH' });
    expect(prompt).toContain('MOH');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – language variations', () => {
  const base = {
    name: 'Doc', type: 'BRD', author: 'AM', date: '2026-01-01',
    workspace: 'NCA', status: 'Draft',
  };

  it('includes EN language in prompt', () => {
    const prompt = buildDocumentSystemPrompt({ ...base, language: 'EN' });
    expect(prompt).toContain('EN');
  });

  it('includes AR language in prompt', () => {
    const prompt = buildDocumentSystemPrompt({ ...base, language: 'AR' });
    expect(prompt).toContain('AR');
  });

  it('includes Bilingual language in prompt', () => {
    const prompt = buildDocumentSystemPrompt({ ...base, language: 'Bilingual' });
    expect(prompt).toContain('Bilingual');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – document type variations', () => {
  const base = {
    name: 'Test Doc', author: 'AM', date: '2026-01-01',
    workspace: 'NCA', status: 'Draft', language: 'EN',
  };

  it('includes Feasibility Study type in prompt', () => {
    const prompt = buildDocumentSystemPrompt({ ...base, type: 'Feasibility Study' });
    expect(prompt).toContain('Feasibility Study');
  });

  it('includes Risk Register type in prompt', () => {
    const prompt = buildDocumentSystemPrompt({ ...base, type: 'Risk Register' });
    expect(prompt).toContain('Risk Register');
  });

  it('includes Meeting Minutes type in prompt', () => {
    const prompt = buildDocumentSystemPrompt({ ...base, type: 'Meeting Minutes' });
    expect(prompt).toContain('Meeting Minutes');
  });

  it('includes Technical Specification type in prompt', () => {
    const prompt = buildDocumentSystemPrompt({ ...base, type: 'Technical Specification' });
    expect(prompt).toContain('Technical Specification');
  });
});

// ─────────────────────────────────────────────────────────────
describe('chatWithDocument – HTTP method and URL', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    vi.stubEnv('VITE_OPENROUTER_API_KEY', 'test-key');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('calls fetch with openrouter.ai URL', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    await chatWithDocument([{ role: 'user', content: 'test' }], 'sys');
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('openrouter.ai');
  });

  it('calls fetch with /chat/completions path', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    await chatWithDocument([{ role: 'user', content: 'test' }], 'sys');
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('chat/completions');
  });

  it('sends 3 messages when conversation has 2 exchanges', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    const messages = [
      { role: 'user' as const, content: 'First' },
      { role: 'assistant' as const, content: 'Response to first' },
    ];
    await chatWithDocument(messages, 'sys');
    const [, opts] = mockFetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    // 1 system + 2 conversation = 3
    expect(body.messages).toHaveLength(3);
  });

  it('returns trimmed string without leading newline', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '\nclean response\n' } }] }),
    });
    const result = await chatWithDocument([{ role: 'user', content: 'q' }], 'sys');
    expect(result).toBe('clean response');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – single tag', () => {
  const base = {
    name: 'Single Tag Doc', type: 'Report', author: 'AM',
    date: '2026-01-01', workspace: 'NCA', status: 'Draft', language: 'EN',
  };

  it('handles single tag without comma', () => {
    const prompt = buildDocumentSystemPrompt({ ...base, tags: ['BRD'] });
    expect(prompt).toContain('BRD');
  });

  it('handles exactly two tags joined with comma', () => {
    const prompt = buildDocumentSystemPrompt({ ...base, tags: ['Alpha', 'Beta'] });
    expect(prompt).toContain('Alpha, Beta');
  });

  it('handles empty string tag gracefully', () => {
    const prompt = buildDocumentSystemPrompt({ ...base, tags: ['ValidTag', ''] });
    expect(prompt).toContain('ValidTag');
  });
});

// ─────────────────────────────────────────────────────────────
describe('chatWithDocument – response completeness', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    vi.stubEnv('VITE_OPENROUTER_API_KEY', 'test-key');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('returns full multi-line content', async () => {
    const content = 'Line 1\nLine 2\nLine 3';
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content } }] }),
    });
    const result = await chatWithDocument([{ role: 'user', content: 'list items' }], 'sys');
    expect(result).toContain('Line 1');
    expect(result).toContain('Line 3');
  });

  it('returns content with numbers', async () => {
    const content = 'Total budget: 5,000,000 SAR';
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content } }] }),
    });
    const result = await chatWithDocument([{ role: 'user', content: 'budget?' }], 'sys');
    expect(result).toBe(content);
  });

  it('returns empty string for whitespace-only content', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '\t\t\t' } }] }),
    });
    const result = await chatWithDocument([{ role: 'user', content: 'q' }], 'sys');
    expect(result).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – author variations', () => {
  const base = {
    name: 'Test Doc', type: 'Report', date: '2026-01-01',
    workspace: 'NCA', status: 'Draft', language: 'EN',
  };

  it('includes Khalid Al-Rashid in prompt', () => {
    const prompt = buildDocumentSystemPrompt({ ...base, author: 'Khalid Al-Rashid' });
    expect(prompt).toContain('Khalid Al-Rashid');
  });

  it('includes Rania Taleb in prompt', () => {
    const prompt = buildDocumentSystemPrompt({ ...base, author: 'Rania Taleb' });
    expect(prompt).toContain('Rania Taleb');
  });

  it('includes Ahmed Al-Khatib in prompt', () => {
    const prompt = buildDocumentSystemPrompt({ ...base, author: 'Ahmed Al-Khatib' });
    expect(prompt).toContain('Ahmed Al-Khatib');
  });

  it('includes Faisal bin Sultan in prompt', () => {
    const prompt = buildDocumentSystemPrompt({ ...base, author: 'Faisal bin Sultan' });
    expect(prompt).toContain('Faisal bin Sultan');
  });

  it('includes Consultant OS AI as author', () => {
    const prompt = buildDocumentSystemPrompt({ ...base, author: 'Consultant OS AI' });
    expect(prompt).toContain('Consultant OS AI');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – date variations', () => {
  const base = {
    name: 'Doc', type: 'BRD', author: 'AM',
    workspace: 'NCA', status: 'Draft', language: 'EN',
  };

  it('includes 2026-01-15 date in prompt', () => {
    const prompt = buildDocumentSystemPrompt({ ...base, date: '2026-01-15' });
    expect(prompt).toContain('2026-01-15');
  });

  it('includes 2026-06-30 date in prompt', () => {
    const prompt = buildDocumentSystemPrompt({ ...base, date: '2026-06-30' });
    expect(prompt).toContain('2026-06-30');
  });

  it('includes 2025-11-01 date in prompt', () => {
    const prompt = buildDocumentSystemPrompt({ ...base, date: '2025-11-01' });
    expect(prompt).toContain('2025-11-01');
  });
});

// ─────────────────────────────────────────────────────────────
describe('chatWithDocument – five message history', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    vi.stubEnv('VITE_OPENROUTER_API_KEY', 'test-key');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('sends 6 messages with 5-message history', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'final' } }] }),
    });
    const history = [
      { role: 'user' as const, content: 'q1' },
      { role: 'assistant' as const, content: 'a1' },
      { role: 'user' as const, content: 'q2' },
      { role: 'assistant' as const, content: 'a2' },
      { role: 'user' as const, content: 'q3' },
    ];
    await chatWithDocument(history, 'sys');
    const [, opts] = mockFetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.messages).toHaveLength(6); // system + 5
  });

  it('preserves assistant role in history', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    const history = [
      { role: 'user' as const, content: 'hello' },
      { role: 'assistant' as const, content: 'hi' },
      { role: 'user' as const, content: 'follow up' },
    ];
    await chatWithDocument(history, 'sys');
    const [, opts] = mockFetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.messages[2].role).toBe('assistant');
    expect(body.messages[2].content).toBe('hi');
  });

  it('always starts with system message regardless of history', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    const history = Array.from({ length: 4 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `msg ${i}`,
    }));
    await chatWithDocument(history, 'always-first-system');
    const [, opts] = mockFetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[0].content).toBe('always-first-system');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – summary variations', () => {
  const base = {
    name: 'Doc', type: 'BRD', author: 'AM', date: '2026-01-01',
    workspace: 'NCA', status: 'Draft', language: 'EN',
  };

  it('includes short summary verbatim', () => {
    const prompt = buildDocumentSystemPrompt({ ...base, summary: 'Short summary.' });
    expect(prompt).toContain('Short summary.');
  });

  it('includes summary with Arabic text', () => {
    const prompt = buildDocumentSystemPrompt({ ...base, summary: 'ملخص الوثيقة' });
    expect(prompt).toContain('ملخص الوثيقة');
  });

  it('shows No summary provided for null summary', () => {
    const prompt = buildDocumentSystemPrompt({ ...base, summary: null });
    expect(prompt).toContain('No summary provided');
  });

  it('shows No summary provided for undefined summary', () => {
    const prompt = buildDocumentSystemPrompt({ ...base });
    expect(prompt).toContain('No summary provided');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – document completeness checks', () => {
  const doc = {
    name: 'ADNOC Upstream BRD v2',
    type: 'BRD',
    author: 'Khalid Al-Rashid',
    date: '2026-03-15',
    workspace: 'ADNOC',
    status: 'Final',
    language: 'EN',
    summary: 'Upstream operations digital transformation.',
    tags: ['BRD', 'ADNOC', 'Upstream', 'Digital'],
  };

  it('includes document name in prompt', () => {
    const prompt = buildDocumentSystemPrompt(doc);
    expect(prompt).toContain('ADNOC Upstream BRD v2');
  });

  it('includes Final status in prompt', () => {
    const prompt = buildDocumentSystemPrompt(doc);
    expect(prompt).toContain('Final');
  });

  it('includes four tags separated by commas', () => {
    const prompt = buildDocumentSystemPrompt(doc);
    expect(prompt).toContain('BRD, ADNOC, Upstream, Digital');
  });

  it('includes summary text', () => {
    const prompt = buildDocumentSystemPrompt(doc);
    expect(prompt).toContain('Upstream operations digital transformation.');
  });

  it('includes author name', () => {
    const prompt = buildDocumentSystemPrompt(doc);
    expect(prompt).toContain('Khalid Al-Rashid');
  });

  it('includes date', () => {
    const prompt = buildDocumentSystemPrompt(doc);
    expect(prompt).toContain('2026-03-15');
  });
});

// ─────────────────────────────────────────────────────────────
describe('chatWithDocument – error handling edge cases', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    vi.stubEnv('VITE_OPENROUTER_API_KEY', 'test-key');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('throws with message from error.error.message', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ error: { message: 'Unprocessable entity' } }),
    });
    await expect(
      chatWithDocument([{ role: 'user', content: 'q' }], 'sys')
    ).rejects.toThrow('Unprocessable entity');
  });

  it('fallback error contains status 422', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({}),
    });
    await expect(
      chatWithDocument([{ role: 'user', content: 'q' }], 'sys')
    ).rejects.toThrow('OpenRouter error 422');
  });

  it('returns No response received for null choices', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: null }),
    });
    const result = await chatWithDocument([{ role: 'user', content: 'q' }], 'sys');
    expect(result).toBe('No response received.');
  });

  it('model string contains slashes (vendor/model format)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    await chatWithDocument([{ role: 'user', content: 'q' }], 'sys');
    const [, opts] = mockFetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.model).toContain('/');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – NCA workspace specific', () => {
  const base = {
    name: 'NCA Cybersecurity Framework v3',
    type: 'Technical Specification',
    author: 'Ahmed Al-Khatib',
    date: '2026-02-10',
    workspace: 'NCA',
    status: 'Under Review',
    language: 'AR',
    summary: 'National cybersecurity framework for critical infrastructure.',
    tags: ['Cybersecurity', 'NCA', 'Critical Infrastructure'],
  };

  it('includes NCA workspace', () => {
    expect(buildDocumentSystemPrompt(base)).toContain('NCA');
  });

  it('includes Technical Specification type', () => {
    expect(buildDocumentSystemPrompt(base)).toContain('Technical Specification');
  });

  it('includes Under Review status', () => {
    expect(buildDocumentSystemPrompt(base)).toContain('Under Review');
  });

  it('includes Cybersecurity tag', () => {
    expect(buildDocumentSystemPrompt(base)).toContain('Cybersecurity');
  });

  it('includes Critical Infrastructure tag', () => {
    expect(buildDocumentSystemPrompt(base)).toContain('Critical Infrastructure');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – MOCI workspace specific', () => {
  const base = {
    name: 'MOCI Digital Transformation Roadmap',
    type: 'Strategy Report',
    author: 'Faisal bin Sultan',
    date: '2026-04-01',
    workspace: 'MOCI',
    status: 'Draft',
    language: 'Bilingual',
    summary: 'Three-year digital transformation plan.',
    tags: ['Strategy', 'Digital', 'MOCI', '2026'],
  };

  it('includes MOCI workspace in prompt', () => {
    expect(buildDocumentSystemPrompt(base)).toContain('MOCI');
  });

  it('includes Strategy Report type', () => {
    expect(buildDocumentSystemPrompt(base)).toContain('Strategy Report');
  });

  it('includes Bilingual language', () => {
    expect(buildDocumentSystemPrompt(base)).toContain('Bilingual');
  });

  it('includes author Faisal bin Sultan', () => {
    expect(buildDocumentSystemPrompt(base)).toContain('Faisal bin Sultan');
  });

  it('includes 2026 tag', () => {
    expect(buildDocumentSystemPrompt(base)).toContain('2026');
  });
});

// ─────────────────────────────────────────────────────────────
describe('chatWithDocument – single assistant message exchange', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    vi.stubEnv('VITE_OPENROUTER_API_KEY', 'test-key');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('sends 3 messages total for 1 user + 1 assistant + 1 user', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    const messages = [
      { role: 'user' as const, content: 'q1' },
      { role: 'assistant' as const, content: 'a1' },
      { role: 'user' as const, content: 'q2' },
    ];
    await chatWithDocument(messages, 'sys');
    const [, opts] = mockFetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.messages).toHaveLength(4); // sys + 3
    expect(body.messages[2].role).toBe('assistant');
  });

  it('first message is always system role', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    await chatWithDocument([{ role: 'user', content: 'hi' }], 'my-system');
    const [, opts] = mockFetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.messages[0]).toMatchObject({ role: 'system', content: 'my-system' });
  });

  it('second message is user when single message provided', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    await chatWithDocument([{ role: 'user', content: 'my-question' }], 'sys');
    const [, opts] = mockFetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.messages[1]).toMatchObject({ role: 'user', content: 'my-question' });
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – SEC workspace', () => {
  const base = {
    name: 'SEC Capital Markets Circular',
    type: 'Regulatory Circular',
    author: 'Capital Markets Division',
    date: '2026-03-20',
    workspace: 'SEC',
    status: 'Approved',
    language: 'AR',
    summary: 'New circular on capital adequacy ratios.',
    tags: ['Regulation', 'SEC', 'Capital Markets'],
  };

  it('includes SEC workspace in prompt', () => {
    expect(buildDocumentSystemPrompt(base)).toContain('SEC');
  });

  it('includes Approved status in prompt', () => {
    expect(buildDocumentSystemPrompt(base)).toContain('Approved');
  });

  it('includes Regulatory Circular type', () => {
    expect(buildDocumentSystemPrompt(base)).toContain('Regulatory Circular');
  });

  it('includes Capital Markets Division author', () => {
    expect(buildDocumentSystemPrompt(base)).toContain('Capital Markets Division');
  });

  it('includes Regulation tag', () => {
    expect(buildDocumentSystemPrompt(base)).toContain('Regulation');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – NEOM workspace', () => {
  const base = {
    name: 'NEOM Smart City Blueprint',
    type: 'Strategy Document',
    author: 'NEOM Planning Division',
    date: '2026-02-14',
    workspace: 'NEOM',
    status: 'Draft',
    language: 'EN',
    summary: 'Smart city infrastructure planning for NEOM.',
    tags: ['NEOM', 'Smart City', 'Infrastructure'],
  };

  it('includes NEOM workspace in prompt', () => {
    expect(buildDocumentSystemPrompt(base)).toContain('NEOM');
  });

  it('includes Strategy Document type', () => {
    expect(buildDocumentSystemPrompt(base)).toContain('Strategy Document');
  });

  it('includes Smart City tag', () => {
    expect(buildDocumentSystemPrompt(base)).toContain('Smart City');
  });

  it('includes Draft status', () => {
    expect(buildDocumentSystemPrompt(base)).toContain('Draft');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – VISION2030 workspace', () => {
  const base = {
    name: 'Vision 2030 Initiative Plan',
    type: 'Policy Document',
    author: 'Strategy Office',
    date: '2026-01-10',
    workspace: 'VISION2030',
    status: 'Approved',
    language: 'Bilingual',
    summary: 'National transformation initiative document.',
    tags: ['Vision2030', 'Policy', 'National'],
  };

  it('includes VISION2030 workspace in prompt', () => {
    expect(buildDocumentSystemPrompt(base)).toContain('VISION2030');
  });

  it('includes Policy Document type', () => {
    expect(buildDocumentSystemPrompt(base)).toContain('Policy Document');
  });

  it('includes Strategy Office author', () => {
    expect(buildDocumentSystemPrompt(base)).toContain('Strategy Office');
  });

  it('includes Vision2030 tag', () => {
    expect(buildDocumentSystemPrompt(base)).toContain('Vision2030');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – status Under Review', () => {
  const base = {
    name: 'Q1 Risk Register',
    type: 'Risk Register',
    author: 'Risk Team',
    date: '2026-03-01',
    workspace: 'NCA',
    status: 'Under Review',
    language: 'EN',
    summary: 'Quarterly risk register under legal review.',
    tags: ['Risk', 'Q1'],
  };

  it('includes Under Review status', () => {
    expect(buildDocumentSystemPrompt(base)).toContain('Under Review');
  });

  it('includes Q1 tag', () => {
    expect(buildDocumentSystemPrompt(base)).toContain('Q1');
  });

  it('includes NCA workspace', () => {
    expect(buildDocumentSystemPrompt(base)).toContain('NCA');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – Final status', () => {
  const base = {
    name: 'IT Architecture Final',
    type: 'Technical Specification',
    author: 'Architecture Board',
    date: '2026-01-30',
    workspace: 'MOCI',
    status: 'Final',
    language: 'EN',
    summary: 'Final approved IT architecture document.',
    tags: ['Architecture', 'Final', 'IT'],
  };

  it('includes Final status in prompt', () => {
    expect(buildDocumentSystemPrompt(base)).toContain('Final');
  });

  it('includes Architecture Board author', () => {
    expect(buildDocumentSystemPrompt(base)).toContain('Architecture Board');
  });

  it('includes three tags', () => {
    const prompt = buildDocumentSystemPrompt(base);
    expect(prompt).toContain('Architecture');
    expect(prompt).toContain('IT');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – Archived status', () => {
  const base = {
    name: 'Legacy System Spec',
    type: 'Technical Specification',
    author: 'IT Department',
    date: '2024-06-01',
    workspace: 'SAMA',
    status: 'Archived',
    language: 'EN',
    summary: 'Archived specification for legacy system.',
    tags: ['Legacy', 'Archived'],
  };

  it('includes Archived status', () => {
    expect(buildDocumentSystemPrompt(base)).toContain('Archived');
  });

  it('includes SAMA workspace', () => {
    expect(buildDocumentSystemPrompt(base)).toContain('SAMA');
  });

  it('includes Legacy tag', () => {
    expect(buildDocumentSystemPrompt(base)).toContain('Legacy');
  });

  it('includes 2024 date year', () => {
    expect(buildDocumentSystemPrompt(base)).toContain('2024');
  });
});

// ─────────────────────────────────────────────────────────────
describe('chatWithDocument – four message conversation', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    vi.stubEnv('VITE_OPENROUTER_API_KEY', 'test-api-key-4msg');
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Four message response' } }],
      }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('sends all 4 messages including system', async () => {
    const history = [
      { role: 'user' as const, content: 'First question' },
      { role: 'assistant' as const, content: 'First answer' },
      { role: 'user' as const, content: 'Second question' },
    ];
    await chatWithDocument(history, 'System prompt for 4 msgs');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.messages).toHaveLength(4);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[1].role).toBe('user');
    expect(body.messages[2].role).toBe('assistant');
    expect(body.messages[3].role).toBe('user');
  });

  it('returns correct content from response', async () => {
    const result = await chatWithDocument([{ role: 'user', content: 'test' }], 'sys');
    expect(result).toBe('Four message response');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – document name in prompt', () => {
  it('includes document name verbatim', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'UNIQUE-DOC-XYZ', type: 'BRD', author: 'A', date: '2026-01-01', workspace: 'NCA', status: 'Draft', language: 'EN', summary: 'Test' });
    expect(prompt).toContain('UNIQUE-DOC-XYZ');
  });

  it('includes document name with Arabic characters', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'وثيقة المشروع', type: 'Charter', author: 'AM', date: '2026-01-01', workspace: 'MOCI', status: 'Draft', language: 'AR', summary: 'عربي' });
    expect(prompt).toContain('وثيقة المشروع');
  });

  it('includes long document name', () => {
    const longName = 'National Cybersecurity Authority Information Security Policy Framework Version 3.2';
    const prompt = buildDocumentSystemPrompt({ name: longName, type: 'Policy', author: 'NCA Team', date: '2026-02-01', workspace: 'NCA', status: 'Approved', language: 'EN', summary: 'Security framework' });
    expect(prompt).toContain('National Cybersecurity Authority');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – GAZT workspace extended', () => {
  const base = {
    name: 'VAT Implementation Guide',
    type: 'Regulatory Document',
    author: 'Tax Advisory Team',
    date: '2026-03-01',
    workspace: 'GAZT',
    status: 'Final',
    language: 'AR',
    summary: 'Guide for VAT implementation for corporates.',
    tags: ['VAT', 'Tax', 'GAZT'],
  };

  it('includes VAT in tags', () => {
    const prompt = buildDocumentSystemPrompt(base);
    expect(prompt).toContain('VAT');
  });

  it('includes Tax Advisory Team author', () => {
    expect(buildDocumentSystemPrompt(base)).toContain('Tax Advisory Team');
  });

  it('includes AR language', () => {
    expect(buildDocumentSystemPrompt(base)).toContain('AR');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – ADNOC workspace', () => {
  const doc = {
    name: 'ADNOC Digital Strategy 2026',
    type: 'Strategy Document',
    author: 'Digital Team',
    date: '2026-01-15',
    workspace: 'ADNOC',
    status: 'Approved',
    language: 'EN',
    summary: 'Digital transformation strategy for ADNOC.',
    tags: ['Strategy', 'Digital', 'ADNOC'],
  };

  it('includes ADNOC workspace', () => {
    expect(buildDocumentSystemPrompt(doc)).toContain('ADNOC');
  });

  it('includes Strategy Document type', () => {
    expect(buildDocumentSystemPrompt(doc)).toContain('Strategy Document');
  });

  it('includes Digital Team author', () => {
    expect(buildDocumentSystemPrompt(doc)).toContain('Digital Team');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – ZATCA workspace', () => {
  const doc = {
    name: 'ZATCA E-Invoicing Compliance Guide',
    type: 'Regulatory Document',
    author: 'Compliance Team',
    date: '2026-02-01',
    workspace: 'ZATCA',
    status: 'Final',
    language: 'AR',
    summary: 'E-Invoicing compliance requirements.',
    tags: ['Compliance', 'E-Invoice', 'VAT'],
  };

  it('includes ZATCA in prompt', () => {
    expect(buildDocumentSystemPrompt(doc)).toContain('ZATCA');
  });

  it('includes E-Invoicing in document name', () => {
    expect(buildDocumentSystemPrompt(doc)).toContain('E-Invoicing');
  });

  it('includes Compliance Team author', () => {
    expect(buildDocumentSystemPrompt(doc)).toContain('Compliance Team');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – SAMA workspace', () => {
  const doc = {
    name: 'SAMA Financial Reporting Framework',
    type: 'Policy Document',
    author: 'Risk & Compliance',
    date: '2025-11-01',
    workspace: 'SAMA',
    status: 'Draft',
    language: 'EN',
    summary: 'Framework for financial reporting standards.',
    tags: ['Finance', 'Reporting', 'Policy'],
  };

  it('includes SAMA in prompt', () => {
    expect(buildDocumentSystemPrompt(doc)).toContain('SAMA');
  });

  it('includes Policy Document type', () => {
    expect(buildDocumentSystemPrompt(doc)).toContain('Policy Document');
  });

  it('includes Draft status', () => {
    expect(buildDocumentSystemPrompt(doc)).toContain('Draft');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – summary field variants', () => {
  it('includes long summary text', () => {
    const longSummary = 'This document covers the comprehensive technical architecture, integration patterns, security protocols, and governance frameworks required for the national digital identity platform.';
    const prompt = buildDocumentSystemPrompt({ name: 'DI Platform', type: 'Architecture', author: 'Team', date: '2026-01-01', workspace: 'NCA', status: 'Draft', language: 'EN', summary: longSummary });
    expect(prompt).toContain('national digital identity platform');
  });

  it('handles empty summary gracefully', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Quick Note', type: 'Note', author: 'AM', date: '2026-03-01', workspace: 'MOCI', status: 'Draft', language: 'EN', summary: '' });
    expect(prompt).toContain('Quick Note');
  });

  it('includes summary with special characters', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Report v1.0', type: 'Report', author: 'RT', date: '2026-03-01', workspace: 'NCA', status: 'Final', language: 'EN', summary: 'Budget: SAR 5,000,000 — Phase 1 & 2' });
    expect(prompt).toContain('SAR 5,000,000');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – type variations', () => {
  it('includes Charter type in prompt', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Project Charter', type: 'Charter', author: 'AM', date: '2026-01-01', workspace: 'NCA', status: 'Draft', language: 'EN', summary: 'Charter doc' });
    expect(prompt).toContain('Charter');
  });

  it('includes Architecture type in prompt', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Arch Doc', type: 'Architecture Document', author: 'AM', date: '2026-01-01', workspace: 'NCA', status: 'Final', language: 'EN', summary: 'Architecture' });
    expect(prompt).toContain('Architecture Document');
  });

  it('includes Meeting Minutes type in prompt', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Q1 Minutes', type: 'Meeting Minutes', author: 'RT', date: '2026-04-15', workspace: 'NCA', status: 'Draft', language: 'EN', summary: 'Minutes' });
    expect(prompt).toContain('Meeting Minutes');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – author variations', () => {
  it('includes Arabic author name', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Doc 1', type: 'BRD', author: 'أحمد خليل', date: '2026-01-01', workspace: 'NCA', status: 'Draft', language: 'AR', summary: '' });
    expect(prompt).toContain('أحمد خليل');
  });

  it('includes team name as author', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Strategy Doc', type: 'Strategy', author: 'Strategy & Planning Team', date: '2026-02-01', workspace: 'NEOM', status: 'Draft', language: 'EN', summary: 'Strategy' });
    expect(prompt).toContain('Strategy & Planning Team');
  });

  it('includes single letter abbreviation author', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Quick Doc', type: 'Note', author: 'AM', date: '2026-03-01', workspace: 'NCA', status: 'Draft', language: 'EN', summary: '' });
    expect(prompt).toContain('AM');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – date variations', () => {
  it('includes 2025 date', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Old Doc', type: 'Report', author: 'AM', date: '2025-06-15', workspace: 'NCA', status: 'Archived', language: 'EN', summary: '' });
    expect(prompt).toContain('2025-06-15');
  });

  it('includes 2026 date', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'New Doc', type: 'BRD', author: 'AM', date: '2026-12-31', workspace: 'MOCI', status: 'Draft', language: 'EN', summary: '' });
    expect(prompt).toContain('2026-12-31');
  });

  it('includes date with January month', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Jan Doc', type: 'Charter', author: 'RT', date: '2026-01-01', workspace: 'NCA', status: 'Final', language: 'EN', summary: '' });
    expect(prompt).toContain('2026-01-01');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – status variations', () => {
  it('includes Final status in prompt', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Final Doc', type: 'BRD', author: 'AM', date: '2026-01-01', workspace: 'NCA', status: 'Final', language: 'EN', summary: '' });
    expect(prompt).toContain('Final');
  });

  it('includes Draft status in prompt', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Draft Doc', type: 'BRD', author: 'AM', date: '2026-01-01', workspace: 'NCA', status: 'Draft', language: 'EN', summary: '' });
    expect(prompt).toContain('Draft');
  });

  it('includes Approved status in prompt', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Approved Doc', type: 'BRD', author: 'AM', date: '2026-01-01', workspace: 'NCA', status: 'Approved', language: 'EN', summary: '' });
    expect(prompt).toContain('Approved');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – language variations', () => {
  it('includes EN language in prompt', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'English Doc', type: 'Report', author: 'AM', date: '2026-01-01', workspace: 'NCA', status: 'Final', language: 'EN', summary: '' });
    expect(prompt).toContain('EN');
  });

  it('includes AR language in prompt', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Arabic Doc', type: 'Report', author: 'AM', date: '2026-01-01', workspace: 'NCA', status: 'Final', language: 'AR', summary: '' });
    expect(prompt).toContain('AR');
  });

  it('prompt is non-empty string', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Any Doc', type: 'BRD', author: 'AM', date: '2026-01-01', workspace: 'MOCI', status: 'Draft', language: 'EN', summary: '' });
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – workspace NCA variants', () => {
  it('mentions NCA workspace context for BRD', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'NCA BRD', type: 'BRD', author: 'AM', date: '2026-02-01', workspace: 'NCA', status: 'Draft', language: 'EN', summary: 'NCA business requirements' });
    expect(prompt).toContain('NCA');
  });

  it('mentions NCA workspace context for Architecture Document', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'NCA Arch Doc', type: 'Architecture Document', author: 'AM', date: '2026-02-01', workspace: 'NCA', status: 'Final', language: 'EN', summary: '' });
    expect(prompt).toContain('NCA');
  });

  it('includes document name for NCA report', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'NCA Q1 Report', type: 'Report', author: 'AM', date: '2026-03-15', workspace: 'NCA', status: 'Final', language: 'EN', summary: '' });
    expect(prompt).toContain('NCA Q1 Report');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – summary content variations', () => {
  it('includes short summary text', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Summary Doc', type: 'BRD', author: 'AM', date: '2026-01-01', workspace: 'NCA', status: 'Final', language: 'EN', summary: 'Brief summary' });
    expect(prompt).toContain('Brief summary');
  });

  it('includes technical summary text', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Tech Doc', type: 'Architecture Document', author: 'AM', date: '2026-01-01', workspace: 'MOCI', status: 'Draft', language: 'EN', summary: 'Technical architecture overview' });
    expect(prompt).toContain('Technical architecture overview');
  });

  it('handles no summary gracefully', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'No Summary Doc', type: 'Report', author: 'AM', date: '2026-01-01', workspace: 'NCA', status: 'Draft', language: 'EN', summary: '' });
    expect(prompt).toContain('No Summary Doc');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – MOCI workspace variants', () => {
  it('mentions MOCI workspace for BRD', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'MOCI Digital BRD', type: 'BRD', author: 'AM', date: '2026-01-15', workspace: 'MOCI', status: 'Draft', language: 'EN', summary: '' });
    expect(prompt).toContain('MOCI');
  });

  it('mentions MOCI workspace for Report', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'MOCI Q1 Report', type: 'Report', author: 'RT', date: '2026-01-15', workspace: 'MOCI', status: 'Final', language: 'EN', summary: '' });
    expect(prompt).toContain('MOCI');
  });

  it('includes document name for MOCI workspace', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Ministry Digital Transformation Plan', type: 'Charter', author: 'AM', date: '2026-03-01', workspace: 'MOCI', status: 'Draft', language: 'EN', summary: '' });
    expect(prompt).toContain('Ministry Digital Transformation Plan');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – author role context', () => {
  it('includes author in prompt for team lead author', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Strategy Doc', type: 'Charter', author: 'Project Manager', date: '2026-03-01', workspace: 'NCA', status: 'Draft', language: 'EN', summary: '' });
    expect(prompt).toContain('Project Manager');
  });

  it('includes author for senior consultant', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Risk Assessment', type: 'Report', author: 'Senior Consultant', date: '2026-03-01', workspace: 'NCA', status: 'Final', language: 'EN', summary: '' });
    expect(prompt).toContain('Senior Consultant');
  });

  it('includes author for Arabic name', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Phase 2 Plan', type: 'BRD', author: 'Khalid Al-Rashid', date: '2026-02-01', workspace: 'NCA', status: 'Draft', language: 'AR', summary: '' });
    expect(prompt).toContain('Khalid Al-Rashid');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – type Report variants', () => {
  it('includes Report type for monthly report', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Monthly Report Jan 2026', type: 'Report', author: 'AM', date: '2026-01-31', workspace: 'NCA', status: 'Final', language: 'EN', summary: '' });
    expect(prompt).toContain('Report');
  });

  it('includes Report type for quarterly report', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Q1 2026 Summary', type: 'Report', author: 'RT', date: '2026-03-31', workspace: 'MOCI', status: 'Draft', language: 'EN', summary: 'Q1 summary' });
    expect(prompt).toContain('Report');
  });

  it('includes report document name', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'NCA Annual Report 2025', type: 'Report', author: 'AM', date: '2025-12-31', workspace: 'NCA', status: 'Approved', language: 'EN', summary: '' });
    expect(prompt).toContain('NCA Annual Report 2025');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – type Charter variants', () => {
  it('includes Charter type for project charter', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Phase 2 Project Charter', type: 'Charter', author: 'PM', date: '2026-01-01', workspace: 'NCA', status: 'Draft', language: 'EN', summary: '' });
    expect(prompt).toContain('Charter');
  });

  it('includes Charter type for program charter', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Digital Program Charter', type: 'Charter', author: 'DM', date: '2026-02-01', workspace: 'MOCI', status: 'Final', language: 'EN', summary: '' });
    expect(prompt).toContain('Charter');
  });

  it('includes charter document name', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'NCA Security Charter 2026', type: 'Charter', author: 'CISO', date: '2026-01-01', workspace: 'NCA', status: 'Approved', language: 'EN', summary: '' });
    expect(prompt).toContain('NCA Security Charter 2026');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – STC workspace', () => {
  it('includes STC workspace name', () => {
    const prompt = buildDocumentSystemPrompt({ name: '5G Roadmap BRD', type: 'BRD', author: 'TM', date: '2026-01-01', workspace: 'STC', status: 'Draft', language: 'EN', summary: '' });
    expect(prompt).toContain('STC');
  });

  it('includes document name for STC workspace', () => {
    const prompt = buildDocumentSystemPrompt({ name: '5G Rollout Strategy', type: 'Report', author: 'AM', date: '2026-02-01', workspace: 'STC', status: 'Final', language: 'EN', summary: '' });
    expect(prompt).toContain('5G Rollout Strategy');
  });

  it('includes BRD type for STC document', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Billing System BRD', type: 'BRD', author: 'FK', date: '2026-03-01', workspace: 'STC', status: 'Draft', language: 'EN', summary: '' });
    expect(prompt).toContain('BRD');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – SEC workspace', () => {
  it('includes SEC workspace name', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Market Data Analysis', type: 'Report', author: 'RT', date: '2026-01-01', workspace: 'SEC', status: 'Final', language: 'EN', summary: '' });
    expect(prompt).toContain('SEC');
  });

  it('includes document author for SEC workspace', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Compliance Framework BRD', type: 'BRD', author: 'Sara Mansour', date: '2026-02-01', workspace: 'SEC', status: 'Draft', language: 'EN', summary: '' });
    expect(prompt).toContain('Sara Mansour');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – returns string type', () => {
  it('returns a string for minimal inputs', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Doc', type: 'BRD', author: 'A', date: '2026-01-01', workspace: 'W', status: 'Draft', language: 'EN', summary: '' });
    expect(typeof prompt).toBe('string');
  });

  it('returns non-empty string', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Doc', type: 'BRD', author: 'A', date: '2026-01-01', workspace: 'W', status: 'Draft', language: 'EN', summary: '' });
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('contains document metadata for any type', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Policy V1', type: 'Policy', author: 'PO', date: '2026-01-01', workspace: 'NEOM', status: 'Draft', language: 'EN', summary: '' });
    expect(prompt).toContain('Policy V1');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – summary field content', () => {
  it('includes non-empty summary text in prompt', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Strategy Doc', type: 'Report', author: 'AM', date: '2026-01-01', workspace: 'NCA', status: 'Draft', language: 'EN', summary: 'Detailed strategic overview' });
    expect(prompt).toContain('Detailed strategic overview');
  });

  it('works fine with empty summary', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Blank Report', type: 'Report', author: 'AM', date: '2026-01-01', workspace: 'NCA', status: 'Draft', language: 'EN', summary: '' });
    expect(typeof prompt).toBe('string');
  });

  it('includes long summary in prompt', () => {
    const longSummary = 'This is a comprehensive strategy document covering phase one through phase five of the national digital transformation program.';
    const prompt = buildDocumentSystemPrompt({ name: 'Transformation Plan', type: 'BRD', author: 'DM', date: '2026-01-01', workspace: 'MOCI', status: 'Draft', language: 'EN', summary: longSummary });
    expect(prompt).toContain('comprehensive strategy');
  });
});

// ─────────────────────────────────────────────────────────────
describe('chatWithDocument – response text extraction', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    vi.stubEnv('VITE_OPENROUTER_API_KEY', 'test-api-key');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('returns content from first choice', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'Hello from AI' } }] }),
    });
    const result = await chatWithDocument([{ role: 'user', content: 'test' }], 'system');
    expect(result).toBe('Hello from AI');
  });

  it('returns different content correctly', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'Risk analysis complete' } }] }),
    });
    const result = await chatWithDocument([{ role: 'user', content: 'analyze risks' }], 'system');
    expect(result).toBe('Risk analysis complete');
  });

  it('sends Content-Type application/json header', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    await chatWithDocument([{ role: 'user', content: 'hi' }], 'system');
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers['Content-Type']).toBe('application/json');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – type Roadmap variants', () => {
  it('includes Roadmap type in prompt', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Digital Transformation Roadmap', type: 'Roadmap', author: 'CTO', date: '2026-01-01', workspace: 'NCA', status: 'Draft', language: 'EN', summary: '' });
    expect(prompt).toContain('Roadmap');
  });

  it('includes document name for Roadmap type', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Q2 2026 Technology Roadmap', type: 'Roadmap', author: 'AM', date: '2026-04-01', workspace: 'MOCI', status: 'Draft', language: 'EN', summary: '' });
    expect(prompt).toContain('Q2 2026 Technology Roadmap');
  });

  it('includes workspace for Roadmap type', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Platform Roadmap', type: 'Roadmap', author: 'RT', date: '2026-01-01', workspace: 'NEOM', status: 'Final', language: 'EN', summary: '' });
    expect(prompt).toContain('NEOM');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – author with title variations', () => {
  it('includes Dr. prefix in author name', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Research Report', type: 'Report', author: 'Dr. Ahmed Al-Rashid', date: '2026-01-01', workspace: 'NCA', status: 'Final', language: 'EN', summary: '' });
    expect(prompt).toContain('Dr. Ahmed Al-Rashid');
  });

  it('includes Eng. prefix in author name', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Tech Architecture', type: 'BRD', author: 'Eng. Khalid Mansour', date: '2026-01-01', workspace: 'STC', status: 'Draft', language: 'EN', summary: '' });
    expect(prompt).toContain('Eng. Khalid Mansour');
  });

  it('includes two-word author name correctly', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Compliance BRD', type: 'BRD', author: 'Reem Talal', date: '2026-02-01', workspace: 'NCA', status: 'Draft', language: 'EN', summary: '' });
    expect(prompt).toContain('Reem Talal');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – type Policy variants', () => {
  it('includes Policy type in prompt', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Data Privacy Policy', type: 'Policy', author: 'AM', date: '2026-01-01', workspace: 'NCA', status: 'Draft', language: 'EN', summary: '' });
    expect(prompt).toContain('Policy');
  });

  it('includes policy document name', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Information Security Policy', type: 'Policy', author: 'RT', date: '2026-02-01', workspace: 'SAMA', status: 'Approved', language: 'EN', summary: '' });
    expect(prompt).toContain('Information Security Policy');
  });

  it('includes workspace for Policy type', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'AI Usage Policy', type: 'Policy', author: 'FK', date: '2026-01-01', workspace: 'GAZT', status: 'Final', language: 'EN', summary: '' });
    expect(prompt).toContain('GAZT');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – SAMA workspace variants', () => {
  it('includes SAMA workspace name', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Banking Regulation Report', type: 'Report', author: 'AM', date: '2026-01-01', workspace: 'SAMA', status: 'Final', language: 'EN', summary: '' });
    expect(prompt).toContain('SAMA');
  });

  it('includes document name for SAMA workspace', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Fintech Framework Analysis', type: 'BRD', author: 'RT', date: '2026-03-01', workspace: 'SAMA', status: 'Draft', language: 'EN', summary: '' });
    expect(prompt).toContain('Fintech Framework Analysis');
  });

  it('includes author for SAMA workspace document', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Open Banking BRD', type: 'BRD', author: 'Noura Hamad', date: '2026-02-01', workspace: 'SAMA', status: 'Approved', language: 'EN', summary: '' });
    expect(prompt).toContain('Noura Hamad');
  });
});

// ─────────────────────────────────────────────────────────────
describe('chatWithDocument – empty choices array', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    vi.stubEnv('VITE_OPENROUTER_API_KEY', 'test-api-key');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('returns "No response received." when choices array is empty', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [] }),
    });
    const result = await chatWithDocument([{ role: 'user', content: 'test' }], 'system');
    expect(result).toBe('No response received.');
  });

  it('throws when response ok is false', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: 'Rate limit exceeded' } }),
    });
    await expect(chatWithDocument([{ role: 'user', content: 'test' }], 'system')).rejects.toThrow();
  });

  it('returns correct content from API with two choices', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'First choice response' } }, { message: { content: 'Second choice' } }] }),
    });
    const result = await chatWithDocument([{ role: 'user', content: 'test' }], 'system');
    expect(result).toBe('First choice response');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – GAZT workspace variants', () => {
  it('includes GAZT workspace name', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Tax Reform BRD', type: 'BRD', author: 'AM', date: '2026-01-01', workspace: 'GAZT', status: 'Draft', language: 'EN', summary: '' });
    expect(prompt).toContain('GAZT');
  });

  it('includes VAT analysis document name', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'VAT Compliance Analysis', type: 'Report', author: 'FK', date: '2026-02-01', workspace: 'GAZT', status: 'Final', language: 'EN', summary: '' });
    expect(prompt).toContain('VAT Compliance Analysis');
  });

  it('includes Arabic language code AR for GAZT doc', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Arabic Report', type: 'Report', author: 'AM', date: '2026-01-01', workspace: 'GAZT', status: 'Draft', language: 'AR', summary: '' });
    expect(prompt).toContain('AR');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – Under Review status', () => {
  it('includes Under Review status in prompt', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Draft BRD v1', type: 'BRD', author: 'AM', date: '2026-01-01', workspace: 'NCA', status: 'Under Review', language: 'EN', summary: '' });
    expect(prompt).toContain('Under Review');
  });

  it('includes document name for Under Review docs', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Q1 Report Under Review', type: 'Report', author: 'RT', date: '2026-03-15', workspace: 'MOCI', status: 'Under Review', language: 'EN', summary: '' });
    expect(prompt).toContain('Q1 Report Under Review');
  });

  it('includes workspace for Under Review status', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Security Policy', type: 'Policy', author: 'FK', date: '2026-02-01', workspace: 'NEOM', status: 'Under Review', language: 'EN', summary: '' });
    expect(prompt).toContain('NEOM');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – multiple tags', () => {
  it('includes all tags in a comma-separated list', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Tagged Doc', type: 'BRD', author: 'AM', date: '2026-01-01', workspace: 'NCA', status: 'Draft', language: 'EN', summary: '', tags: ['Alpha', 'Beta', 'Gamma'] });
    expect(prompt).toContain('Alpha');
    expect(prompt).toContain('Beta');
    expect(prompt).toContain('Gamma');
  });

  it('shows None when tags is an empty array', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'No Tags Doc', type: 'Report', author: 'RT', date: '2026-02-01', workspace: 'MOCI', status: 'Final', language: 'EN', summary: '', tags: [] });
    expect(prompt).toContain('None');
  });

  it('shows None when tags is undefined', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Undefined Tags', type: 'BRD', author: 'FK', date: '2026-03-01', workspace: 'NCA', status: 'Draft', language: 'EN', summary: '' });
    expect(prompt).toContain('None');
  });

  it('single tag appears in tags field', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Single Tag Doc', type: 'BRD', author: 'AM', date: '2026-04-01', workspace: 'NCA', status: 'Draft', language: 'EN', summary: '', tags: ['Security'] });
    expect(prompt).toContain('Security');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – summary vs no summary', () => {
  it('includes provided summary in prompt', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Summary Doc', type: 'BRD', author: 'AM', date: '2026-01-01', workspace: 'NCA', status: 'Final', language: 'EN', summary: 'Covers enterprise security architecture.' });
    expect(prompt).toContain('Covers enterprise security architecture.');
  });

  it('shows metadata-only notice when summary is empty string', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'No Summary Doc', type: 'Report', author: 'RT', date: '2026-02-01', workspace: 'MOCI', status: 'Draft', language: 'EN', summary: '' });
    expect(prompt).toContain('metadata only');
  });

  it('shows metadata-only notice when summary is undefined', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Undef Summary', type: 'BRD', author: 'FK', date: '2026-03-01', workspace: 'NCA', status: 'Draft', language: 'EN', summary: undefined as unknown as string });
    expect(prompt).toContain('metadata only');
  });
});

// ─────────────────────────────────────────────────────────────
describe('chatWithDocument – choices fallback paths', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_OPENROUTER_API_KEY', 'test-key-fallback');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('returns No response received when choices array is empty', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ choices: [] }) }));
    const result = await chatWithDocument([{ role: 'user', content: 'Hello' }], 'System prompt');
    expect(result).toBe('No response received.');
  });

  it('returns No response received when choices is undefined', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }));
    const result = await chatWithDocument([{ role: 'user', content: 'Test' }], 'System');
    expect(result).toBe('No response received.');
  });

  it('returns No response received when message.content is undefined', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ choices: [{ message: {} }] }) }));
    const result = await chatWithDocument([{ role: 'user', content: 'Test' }], 'System');
    expect(result).toBe('No response received.');
  });

  it('returns No response received when message is undefined', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ choices: [{}] }) }));
    const result = await chatWithDocument([{ role: 'user', content: 'Test' }], 'System');
    expect(result).toBe('No response received.');
  });

  it('trims leading and trailing whitespace from response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ choices: [{ message: { content: '  Great answer.  ' } }] }) }));
    const result = await chatWithDocument([{ role: 'user', content: 'Q' }], 'Sys');
    expect(result).toBe('Great answer.');
  });
});

// ─────────────────────────────────────────────────────────────
describe('buildDocumentSystemPrompt – Policy type', () => {
  it('includes Policy type in the prompt', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'IT Security Policy', type: 'Policy', author: 'AM', date: '2026-01-01', workspace: 'NCA', status: 'Approved', language: 'EN', summary: '' });
    expect(prompt).toContain('Policy');
  });

  it('includes Approved status for Policy document', () => {
    const prompt = buildDocumentSystemPrompt({ name: 'Data Governance Policy', type: 'Policy', author: 'RT', date: '2026-02-01', workspace: 'MOCI', status: 'Approved', language: 'EN', summary: '' });
    expect(prompt).toContain('Approved');
  });
});

// ─────────────────────────────────────────────────────────────
describe('chatWithDocument – HTTP error handling', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_OPENROUTER_API_KEY', 'err-test-key');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('throws when response status is 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: () => Promise.resolve({ error: { message: 'Unauthorized' } }) }));
    await expect(chatWithDocument([{ role: 'user', content: 'Hi' }], 'Sys')).rejects.toThrow('Unauthorized');
  });

  it('throws with generic message when JSON parse fails on error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503, json: () => Promise.reject(new Error('parse fail')) }));
    await expect(chatWithDocument([{ role: 'user', content: 'Hi' }], 'Sys')).rejects.toThrow('OpenRouter error 503');
  });

  it('includes status code in generic error message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429, json: () => Promise.resolve({}) }));
    await expect(chatWithDocument([{ role: 'user', content: 'Hi' }], 'Sys')).rejects.toThrow('429');
  });
});
