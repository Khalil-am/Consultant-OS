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
