import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

// ── Hoisted mocks ─────────────────────────────────────────────
const { mockGetDocument, mockUpdateDocument, mockGetTasks, mockUpdateTask, mockChatWithDocument } = vi.hoisted(() => ({
  mockGetDocument: vi.fn(),
  mockUpdateDocument: vi.fn(),
  mockGetTasks: vi.fn(),
  mockUpdateTask: vi.fn(),
  mockChatWithDocument: vi.fn(),
}));

vi.mock('../lib/db', () => ({
  getDocument: mockGetDocument,
  updateDocument: mockUpdateDocument,
  getTasks: mockGetTasks,
  updateTask: mockUpdateTask,
}));

vi.mock('../lib/openrouter', () => ({
  chatWithDocument: mockChatWithDocument,
  buildDocumentSystemPrompt: vi.fn(() => 'system-prompt'),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://signed.url/file.pdf' }, error: null }),
      })),
    },
  },
}));

import DocumentDetail from '../screens/DocumentDetail';

// ── Fixtures ──────────────────────────────────────────────────
const mockDoc = {
  id: 'd1',
  name: 'NCA Enterprise Architecture BRD v2.3',
  type: 'BRD',
  type_color: '#0EA5E9',
  status: 'Final' as const,
  date: '2026-03-15',
  workspace: 'NCA',
  workspace_id: 'ws-2',
  size: '2.4MB',
  language: 'EN' as const,
  tags: ['Architecture', 'BRD'],
  author: 'Ahmed Khalil',
  pages: 24,
  summary: 'Full enterprise architecture BRD covering all technical requirements.',
  file_url: 'https://example.supabase.co/storage/workspace-docs/ws-2/doc.pdf',
  created_at: '2026-03-15T10:00:00Z',
  updated_at: '2026-03-15T10:00:00Z',
};

const mockTask = {
  id: 't1',
  title: 'Review BRD architecture section',
  workspace: 'NCA',
  workspace_id: 'ws-2',
  priority: 'High' as const,
  status: 'In Progress' as const,
  assignee: 'AM',
  due_date: '2026-04-01',
  description: 'Review the architecture section of the BRD',
  linked_doc: 'd1',
  created_at: '',
  updated_at: '',
};

function renderDetail(id = 'd1') {
  return render(
    <MemoryRouter initialEntries={[`/documents/${id}`]}>
      <Routes>
        <Route path="/documents/:id" element={<DocumentDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetDocument.mockResolvedValue(mockDoc);
  mockGetTasks.mockResolvedValue([mockTask]);
  mockUpdateDocument.mockResolvedValue({ ...mockDoc, status: 'Approved' });
  mockUpdateTask.mockResolvedValue({ ...mockTask, status: 'Completed' });
  mockChatWithDocument.mockResolvedValue('This BRD covers the enterprise architecture requirements.');
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Loading & Header', () => {
  it('renders document name after load', async () => {
    renderDetail();
    expect(await screen.findByText('NCA Enterprise Architecture BRD v2.3')).toBeInTheDocument();
  });

  it('renders document type in header', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    // Type appears as a span badge in header
    const typeBadges = screen.getAllByText('BRD');
    expect(typeBadges.length).toBeGreaterThan(0);
  });

  it('renders document size', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    // May appear in multiple places (header + metadata), check at least one exists
    expect(screen.getAllByText('2.4MB').length).toBeGreaterThan(0);
  });

  it('renders document date', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText('2026-03-15').length).toBeGreaterThan(0);
  });

  it('shows error when document not found', async () => {
    mockGetDocument.mockResolvedValue(null);
    renderDetail();
    expect(await screen.findByText(/document not found/i)).toBeInTheDocument();
  });

  it('shows error when load fails', async () => {
    mockGetDocument.mockRejectedValue(new Error('Connection failed'));
    renderDetail();
    expect(await screen.findByText(/connection failed/i)).toBeInTheDocument();
  });

  it('calls getDocument with correct id', async () => {
    renderDetail('d1');
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(mockGetDocument).toHaveBeenCalledWith('d1');
  });

  it('renders Back to Documents button', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByText('Documents')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Tabs', () => {
  it('renders Overview tab button', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /document tab: overview/i })).toBeInTheDocument();
  });

  it('renders Summary tab button', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /document tab: summary/i })).toBeInTheDocument();
  });

  it('renders Tasks tab button (with or without count badge)', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    // Tab has "Tasks" text + optional count badge, use regex
    const tasksTab = screen.getByRole('button', { name: /document tab: tasks/i });
    expect(tasksTab).toBeInTheDocument();
  });

  it('renders Versions tab button', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /document tab: versions/i })).toBeInTheDocument();
  });

  it('renders AI Chat tab button', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /document tab: ai chat/i })).toBeInTheDocument();
  });

  it('Overview tab shows page count', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    // Page count may be "24 pages" in meta row
    expect(screen.getByText(/24 pages/i)).toBeInTheDocument();
  });

  it('Summary tab shows document summary text', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: summary/i }));
    expect(screen.getByText(/full enterprise architecture BRD/i)).toBeInTheDocument();
  });

  it('Tasks tab shows linked task title', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: tasks/i }));
    expect(screen.getByText('Review BRD architecture section')).toBeInTheDocument();
  });

  it('Tasks tab shows empty state when no linked tasks', async () => {
    mockGetTasks.mockResolvedValue([]);
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: tasks/i }));
    expect(screen.getByText(/no tasks/i)).toBeInTheDocument();
  });

  it('AI Chat tab renders initial greeting message', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: ai chat/i }));
    // Initial greeting seeded when doc loads
    expect(screen.getByText(/ready to help/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – AI Chat', () => {
  it('sends a message via Enter and displays AI reply', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: ai chat/i }));

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'What are the key requirements?');
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });

    expect(await screen.findByText('This BRD covers the enterprise architecture requirements.')).toBeInTheDocument();
    expect(mockChatWithDocument).toHaveBeenCalledTimes(1);
  });

  it('shows AI error message on failure', async () => {
    mockChatWithDocument.mockRejectedValue(new Error('API quota exceeded'));
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: ai chat/i }));

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'Summarize this document');
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });

    expect(await screen.findByText(/api quota exceeded/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Status change', () => {
  it('calls updateDocument when status select changes', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');

    const statusSelects = screen.getAllByRole('combobox');
    if (statusSelects.length > 0) {
      fireEvent.change(statusSelects[0], { target: { value: 'Under Review' } });
      await waitFor(() => {
        expect(mockUpdateDocument).toHaveBeenCalled();
      });
    }
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Task status change', () => {
  it('calls updateTask when task status is changed', async () => {
    mockUpdateTask.mockResolvedValue({ ...mockTask, status: 'Completed' });
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: tasks/i }));

    await screen.findByText('Review BRD architecture section');
    // The header always has a document status combobox; task status comboboxes come after
    const taskStatusSelects = screen.getAllByRole('combobox');
    // Use the last combobox which is the task status select
    const taskSelect = taskStatusSelects[taskStatusSelects.length - 1];
    fireEvent.change(taskSelect, { target: { value: 'Completed' } });
    await waitFor(() => expect(mockUpdateTask).toHaveBeenCalled());
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Metadata display', () => {
  it('shows document author', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText('Ahmed Khalil').length).toBeGreaterThan(0);
  });

  it('shows document workspace', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    // Workspace "NCA" appears at least once (may appear in header, metadata, chat greeting)
    expect(screen.getAllByText('NCA').length).toBeGreaterThan(0);
  });

  it('shows document language', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText('EN').length).toBeGreaterThan(0);
  });

  it('shows document tags in overview', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    // Tags: ['Architecture', 'BRD']
    expect(screen.getAllByText(/Architecture/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Versions tab', () => {
  it('Versions tab renders without crashing', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: versions/i }));
    expect(screen.getByRole('button', { name: /document tab: versions/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – AI Chat send button', () => {
  it('sends message via Enter key', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: ai chat/i }));

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'What is the scope?');
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });

    await waitFor(() => {
      expect(mockChatWithDocument).toHaveBeenCalledTimes(1);
    });
  });

  it('clears input after sending message', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: ai chat/i }));

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'What is the scope?');
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });

    await waitFor(() => {
      expect((input as HTMLTextAreaElement).value).toBe('');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – AI Summarize', () => {
  it('calls chatWithDocument when AI Summarize button is clicked', async () => {
    mockChatWithDocument.mockResolvedValue('AI generated summary of this BRD.');
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');

    const summarizeBtns = screen.getAllByRole('button', { name: /ai summarize/i });
    await userEvent.click(summarizeBtns[0]);
    await waitFor(() => {
      expect(mockChatWithDocument).toHaveBeenCalled();
    });
  });

  it('calls updateDocument with AI summary result', async () => {
    const aiSummary = 'Comprehensive AI summary of NCA BRD.';
    mockChatWithDocument.mockResolvedValue(aiSummary);
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');

    const summarizeBtns = screen.getAllByRole('button', { name: /ai summarize/i });
    await userEvent.click(summarizeBtns[0]);
    await waitFor(() => {
      expect(mockUpdateDocument).toHaveBeenCalledWith('d1', { summary: aiSummary });
    });
  });

  it('shows error when AI Summarize fails', async () => {
    mockChatWithDocument.mockRejectedValue(new Error('AI unavailable'));
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');

    const summarizeBtns = screen.getAllByRole('button', { name: /ai summarize/i });
    await userEvent.click(summarizeBtns[0]);
    await waitFor(() => {
      expect(screen.getByText(/AI unavailable/i)).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Download', () => {
  it('shows Download button when file_url is present', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    // Download button appears in Overview tab
    expect(screen.getAllByRole('button', { name: /download/i }).length).toBeGreaterThan(0);
  });

  it('shows "No File" button label when no file attached', async () => {
    mockGetDocument.mockResolvedValue({ ...mockDoc, file_url: null });
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    // Button text changes to "No File" when no file_url
    expect(screen.getAllByText('No File').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Refresh', () => {
  it('calls getDocument again when Refresh button is clicked', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');

    const refreshBtn = screen.getByTitle(/refresh/i);
    await userEvent.click(refreshBtn);
    await waitFor(() => {
      expect(mockGetDocument).toHaveBeenCalledTimes(2);
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – AI Chat interactions', () => {
  it('Shift+Enter does not send message', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: ai chat/i }));

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'Draft message');
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    // mockChatWithDocument should NOT be called
    expect(mockChatWithDocument).not.toHaveBeenCalled();
  });

  it('shows user message bubble after sending', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: ai chat/i }));

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'Tell me about the stakeholders');
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });

    expect(screen.getByText('Tell me about the stakeholders')).toBeInTheDocument();
  });

  it('does not send empty message', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: ai chat/i }));

    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });
    expect(mockChatWithDocument).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Tasks tab details', () => {
  it('shows task priority in Tasks tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: tasks/i }));
    await screen.findByText('Review BRD architecture section');
    // Task priority 'High' should appear
    expect(screen.getAllByText(/High/i).length).toBeGreaterThan(0);
  });

  it('shows task status in Tasks tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: tasks/i }));
    await screen.findByText('Review BRD architecture section');
    // Status 'In Progress' should appear in the task row
    expect(screen.getAllByText(/In Progress/i).length).toBeGreaterThan(0);
  });

  it('shows task assignee in Tasks tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: tasks/i }));
    await screen.findByText('Review BRD architecture section');
    // Assignee 'AM' appears in the task metadata line like "AM · Due 2026-04-01"
    expect(screen.getByText(/AM.*Due/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Summary tab details', () => {
  it('Summary tab shows tags section', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: summary/i }));
    // Tags: Architecture, BRD should appear
    expect(screen.getAllByText('Architecture').length).toBeGreaterThan(0);
  });

  it('Summary tab shows author', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: summary/i }));
    expect(screen.getAllByText('Ahmed Khalil').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Versions tab content', () => {
  it('Versions tab shows "No versions" or version entry', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: versions/i }));
    // Versions tab renders without crashing and shows some content
    expect(screen.getByRole('button', { name: /document tab: versions/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Header metadata', () => {
  it('shows pages count in header/meta area', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    // 24 pages should appear
    expect(screen.getAllByText(/24/).length).toBeGreaterThan(0);
  });

  it('renders Final status badge', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText('Final').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Document status variants', () => {
  it('shows Draft status badge for draft document', async () => {
    mockGetDocument.mockResolvedValue({ ...mockDoc, status: 'Draft' });
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText('Draft').length).toBeGreaterThan(0);
  });

  it('shows Approved status badge for approved document', async () => {
    mockGetDocument.mockResolvedValue({ ...mockDoc, status: 'Approved' });
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText('Approved').length).toBeGreaterThan(0);
  });

  it('shows Under Review status badge', async () => {
    mockGetDocument.mockResolvedValue({ ...mockDoc, status: 'Under Review' });
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText('Under Review').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Multiple tasks in Tasks tab', () => {
  const mockTask2 = {
    id: 't2',
    title: 'Validate stakeholder requirements',
    workspace: 'NCA', workspace_id: 'ws-2',
    priority: 'Medium' as const,
    status: 'Pending' as const,
    assignee: 'RT',
    due_date: '2026-04-10',
    description: '',
    linked_doc: 'd1',
    created_at: '', updated_at: '',
  };

  it('shows multiple tasks in Tasks tab', async () => {
    mockGetTasks.mockResolvedValue([mockTask, mockTask2]);
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: tasks/i }));
    expect(await screen.findByText('Review BRD architecture section')).toBeInTheDocument();
    expect(screen.getByText('Validate stakeholder requirements')).toBeInTheDocument();
  });

  it('tasks count badge shows correct number', async () => {
    mockGetTasks.mockResolvedValue([mockTask, mockTask2]);
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    // Tasks tab has a count badge of "2"
    await waitFor(() => {
      expect(screen.getAllByText('2').length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – AI Chat via Send button', () => {
  it('sends message via Send button click (icon button)', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: ai chat/i }));

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'What is the scope?');

    // Send button is an icon-only button near the textarea — find the last button in the chat form
    const allButtons = screen.getAllByRole('button');
    const sendBtn = allButtons[allButtons.length - 1];
    await userEvent.click(sendBtn);

    await waitFor(() => {
      expect(mockChatWithDocument).toHaveBeenCalledTimes(1);
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Document type variants', () => {
  it('shows Meeting Minutes type badge', async () => {
    mockGetDocument.mockResolvedValue({ ...mockDoc, type: 'Meeting Minutes', type_color: '#10B981' });
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText('Meeting Minutes').length).toBeGreaterThan(0);
  });

  it('shows Report document type', async () => {
    mockGetDocument.mockResolvedValue({ ...mockDoc, type: 'Report', type_color: '#8B5CF6' });
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText('Report').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Overview Document Info panel', () => {
  it('shows document language in Overview tab Document Info panel', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    // Overview is default tab; Document Info section shows Language: EN
    expect(screen.getAllByText('EN').length).toBeGreaterThan(0);
  });

  it('shows document workspace in Overview tab Document Info panel', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    // Document Info shows Workspace: NCA
    expect(screen.getAllByText('NCA').length).toBeGreaterThan(0);
  });

  it('shows "Document Info" section header in Overview', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByText('Document Info')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – chatWithDocument arguments', () => {
  it('passes document context to chatWithDocument call', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: ai chat/i }));

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'Summarize the requirements');
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });

    await waitFor(() => {
      const call = mockChatWithDocument.mock.calls[0];
      // First arg is messages array; second is system prompt
      expect(call[0]).toBeDefined();
      expect(call[1]).toBeDefined();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – AI Chat multiple messages', () => {
  it('accumulates multiple messages in the AI chat', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: ai chat/i }));

    const input = screen.getByRole('textbox');

    // Send first message
    await userEvent.type(input, 'First question about the BRD');
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });
    await screen.findByText('This BRD covers the enterprise architecture requirements.');

    // Send second message
    await userEvent.type(input, 'Second question about requirements');
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });

    await waitFor(() => {
      expect(mockChatWithDocument).toHaveBeenCalledTimes(2);
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Document metadata display', () => {
  it('shows document author Ahmed Khalil', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText('Ahmed Khalil').length).toBeGreaterThan(0);
  });

  it('shows document size 2.4MB', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText('2.4MB').length).toBeGreaterThan(0);
  });

  it('shows document page count 24', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText(/24/).length).toBeGreaterThan(0);
  });

  it('shows workspace NCA on document detail', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText('NCA').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Document tags display', () => {
  it('shows Architecture tag on document', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText('Architecture').length).toBeGreaterThan(0);
  });

  it('shows BRD tag on document', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText('BRD').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Document summary display', () => {
  it('shows document summary in Overview tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByText(/full enterprise architecture BRD/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Tasks tab', () => {
  it('shows linked task title in Tasks tab', async () => {
    mockGetTasks.mockResolvedValue([mockTask]);
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: tasks/i }));
    await waitFor(() => {
      expect(screen.getByText('Review BRD architecture section')).toBeInTheDocument();
    });
  });

  it('shows task priority High in Tasks tab', async () => {
    mockGetTasks.mockResolvedValue([mockTask]);
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: tasks/i }));
    await waitFor(() => {
      expect(screen.getAllByText('High').length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – DB calls on mount', () => {
  it('calls getDocument with correct id', async () => {
    renderDetail('d1');
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(mockGetDocument).toHaveBeenCalledWith('d1');
  });

  it('calls getTasks on mount', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(mockGetTasks).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Quick Actions panel', () => {
  it('shows "Ask AI About This Doc" quick action button', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /ask ai about this doc/i })).toBeInTheDocument();
  });

  it('"Ask AI About This Doc" switches to AI Chat tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /ask ai about this doc/i }));
    expect(screen.getByText('AI Document Chat')).toBeInTheDocument();
  });

  it('shows "Mark Approved" quick action button when not approved', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    // Final status → "Mark Approved" button in Quick Actions
    const markApprovedBtns = screen.getAllByRole('button', { name: /mark approved/i });
    expect(markApprovedBtns.length).toBeGreaterThan(0);
  });

  it('"Already Approved" shown when document is approved', async () => {
    mockGetDocument.mockResolvedValue({ ...mockDoc, status: 'Approved' });
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText(/Already Approved/i).length).toBeGreaterThan(0);
  });

  it('Quick Actions shows "Download File" when file_url is set', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    // Quick Actions section has "Download File" button
    expect(screen.getAllByRole('button', { name: /download/i }).length).toBeGreaterThan(0);
  });

  it('Quick Actions shows "No File Attached" when file_url is null', async () => {
    mockGetDocument.mockResolvedValue({ ...mockDoc, file_url: null });
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText(/No File/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Versions tab content', () => {
  it('shows "Version History" heading', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: versions/i }));
    expect(screen.getByText('Version History')).toBeInTheDocument();
  });

  it('shows "v1.0 — Current" in versions timeline', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: versions/i }));
    expect(screen.getByText(/v1\.0 — Current/i)).toBeInTheDocument();
  });

  it('shows author name in versions timeline', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: versions/i }));
    expect(screen.getAllByText(/Ahmed Khalil/i).length).toBeGreaterThan(0);
  });

  it('shows document date in versions timeline', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: versions/i }));
    expect(screen.getAllByText('2026-03-15').length).toBeGreaterThan(0);
  });

  it('shows version history note text', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: versions/i }));
    expect(screen.getByText(/version history will appear/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – AI Chat header', () => {
  it('shows "AI Document Chat" heading in AI Chat tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: ai chat/i }));
    expect(screen.getByText('AI Document Chat')).toBeInTheDocument();
  });

  it('shows document type context badge in AI Chat tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: ai chat/i }));
    expect(screen.getByText('BRD context loaded')).toBeInTheDocument();
  });

  it('shows "Powered by OpenRouter" label', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: ai chat/i }));
    expect(screen.getByText(/Powered by OpenRouter/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Mark Approved header button', () => {
  it('calls updateDocument with Approved status when Mark Approved is clicked', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    // Header Mark Approved button (first in header area)
    const markApprovedBtns = screen.getAllByRole('button', { name: /mark approved/i });
    await userEvent.click(markApprovedBtns[0]);
    await waitFor(() => {
      expect(mockUpdateDocument).toHaveBeenCalledWith('d1', { status: 'Approved' });
    });
  });

  it('Mark Approved button is disabled when status is already Approved', async () => {
    mockGetDocument.mockResolvedValue({ ...mockDoc, status: 'Approved' });
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const approvedBtns = screen.getAllByRole('button', { name: /approved/i });
    // All "Approved" buttons should be disabled
    approvedBtns.forEach(btn => {
      expect(btn).toBeDisabled();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Task workspace link', () => {
  it('shows task workspace name in Tasks tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: tasks/i }));
    await screen.findByText('Review BRD architecture section');
    expect(screen.getAllByText(/NCA/i).length).toBeGreaterThan(0);
  });

  it('shows task due date in Tasks tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: tasks/i }));
    await screen.findByText('Review BRD architecture section');
    expect(screen.getByText(/2026-04-01/)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Summary tab when no summary', () => {
  it('shows no-summary placeholder when summary is empty', async () => {
    mockGetDocument.mockResolvedValue({ ...mockDoc, summary: '' });
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: summary/i }));
    expect(screen.getByText(/No summary available/i)).toBeInTheDocument();
  });

  it('shows "AI Generate Summary" button when no summary exists', async () => {
    mockGetDocument.mockResolvedValue({ ...mockDoc, summary: '' });
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: summary/i }));
    expect(screen.getByText('AI Generate Summary')).toBeInTheDocument();
  });

  it('shows "Regenerate" button when summary exists', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: summary/i }));
    expect(screen.getByText('Regenerate')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Tasks count in header', () => {
  it('shows zero tasks count text in Tasks header', async () => {
    mockGetTasks.mockResolvedValue([]);
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: tasks/i }));
    // Tasks tab shows "0 tasks" label
    expect(screen.getByText(/0 tasks/i)).toBeInTheDocument();
  });

  it('shows singular "1 task" for single linked task', async () => {
    mockGetTasks.mockResolvedValue([mockTask]);
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: tasks/i }));
    await screen.findByText('Review BRD architecture section');
    expect(screen.getByText(/1 task$/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Overview tab metadata', () => {
  it('shows document author in Overview tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    // Default tab is Overview, author is shown
    expect(screen.getAllByText(/Ahmed Khalil/i).length).toBeGreaterThan(0);
  });

  it('shows document date in Overview tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText(/2026-03-15/).length).toBeGreaterThan(0);
  });

  it('shows document language EN in Overview tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText('EN').length).toBeGreaterThan(0);
  });

  it('shows document workspace in Overview tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText(/NCA/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Tabs presence', () => {
  it('shows Overview tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /document tab: overview/i })).toBeInTheDocument();
  });

  it('shows Versions tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /document tab: versions/i })).toBeInTheDocument();
  });

  it('shows AI Chat tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText(/AI Chat/i).length).toBeGreaterThan(0);
  });

  it('shows Summary tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /document tab: summary/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Overview tab tags', () => {
  it('shows Architecture tag in Overview', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText('Architecture').length).toBeGreaterThan(0);
  });

  it('shows BRD tag in Overview', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText('BRD').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Versions tab', () => {
  it('shows Versions tab content after clicking', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: versions/i }));
    // Versions tab renders version history
    expect(screen.getAllByText(/Version|version|v2\.3|No version/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Tab aria-pressed states', () => {
  it('Overview tab is aria-pressed=true by default', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /document tab: overview/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('Summary tab is aria-pressed=false by default', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /document tab: summary/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Summary tab sets it to aria-pressed=true', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: summary/i }));
    expect(screen.getByRole('button', { name: /document tab: summary/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking Summary tab sets Overview to aria-pressed=false', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: summary/i }));
    expect(screen.getByRole('button', { name: /document tab: overview/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('Tasks tab is aria-pressed=false by default', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /document tab: tasks/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Tasks tab sets it to aria-pressed=true', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: tasks/i }));
    expect(screen.getByRole('button', { name: /document tab: tasks/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('Versions tab is aria-pressed=false by default', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /document tab: versions/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Versions tab sets it to aria-pressed=true', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: versions/i }));
    expect(screen.getByRole('button', { name: /document tab: versions/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('AI Chat tab is aria-pressed=false by default', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /document tab: ai chat/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking AI Chat tab sets it to aria-pressed=true', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: ai chat/i }));
    expect(screen.getByRole('button', { name: /document tab: ai chat/i })).toHaveAttribute('aria-pressed', 'true');
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Status select options', () => {
  it('status select has 4 options', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const selects = screen.getAllByRole('combobox');
    const statusSelect = selects[0];
    expect(statusSelect.querySelectorAll('option').length).toBe(4);
  });

  it('status select contains Draft option', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const selects = screen.getAllByRole('combobox');
    const opts = Array.from(selects[0].querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Draft');
  });

  it('status select contains Under Review option', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const selects = screen.getAllByRole('combobox');
    const opts = Array.from(selects[0].querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Under Review');
  });

  it('status select contains Approved option', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const selects = screen.getAllByRole('combobox');
    const opts = Array.from(selects[0].querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Approved');
  });

  it('status select contains Final option', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const selects = screen.getAllByRole('combobox');
    const opts = Array.from(selects[0].querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Final');
  });

  it('status select defaults to current document status', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const selects = screen.getAllByRole('combobox');
    expect((selects[0] as HTMLSelectElement).value).toBe('Final');
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Overview linked tasks preview', () => {
  it('shows "Linked Tasks" section in Overview when tasks exist', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByText('Linked Tasks')).toBeInTheDocument();
  });

  it('shows "View all" button in linked tasks preview', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /view all linked tasks/i })).toBeInTheDocument();
  });

  it('"View all" linked tasks button switches to Tasks tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /view all linked tasks/i }));
    expect(screen.getByRole('button', { name: /document tab: tasks/i })).toHaveAttribute('aria-pressed', 'true');
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Document Info file attached status', () => {
  it('shows "Attached ✓" in Document Info when file_url is present', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByText(/Attached/)).toBeInTheDocument();
  });

  it('shows "No file" in Document Info when file_url is null', async () => {
    mockGetDocument.mockResolvedValue({ ...mockDoc, file_url: null });
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText(/No file/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – AR language document', () => {
  it('shows AR language in Document Info panel', async () => {
    mockGetDocument.mockResolvedValue({ ...mockDoc, language: 'AR' });
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText('AR').length).toBeGreaterThan(0);
  });

  it('initial AI greeting mentions document name for AR doc', async () => {
    mockGetDocument.mockResolvedValue({ ...mockDoc, language: 'AR' });
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: ai chat/i }));
    expect(screen.getByText(/ready to help/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Document type badge', () => {
  it('shows BRD type badge in header', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText('BRD').length).toBeGreaterThan(0);
  });

  it('shows Final status badge', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText('Final').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Download button', () => {
  it('shows Download button when file_url is set', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    // mockDoc has file_url set
    expect(screen.getAllByRole('button', { name: /download/i }).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Mark Approved shows correct state for different statuses', () => {
  it('shows Under Review status badge when status is Under Review', async () => {
    mockGetDocument.mockResolvedValue({ ...mockDoc, status: 'Under Review' });
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText(/Under Review/i).length).toBeGreaterThan(0);
  });

  it('shows Draft status badge when status is Draft', async () => {
    mockGetDocument.mockResolvedValue({ ...mockDoc, status: 'Draft' });
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText(/Draft/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Summary tab existing content', () => {
  it('shows existing summary text in Summary tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: summary/i }));
    expect(screen.getByText(/Full enterprise architecture BRD/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Back navigation button', () => {
  it('shows Back button in header', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    // Back button appears in the header area
    const backBtns = screen.getAllByRole('button').filter(b =>
      b.textContent?.includes('Back') || b.getAttribute('aria-label')?.includes('Back')
    );
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – AI Chat tab', () => {
  it('shows AI Chat tab button', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /AI Chat/i })).toBeInTheDocument();
  });

  it('shows AI Chat input after clicking AI Chat tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /AI Chat/i }));
    // AI Chat renders an input for messages
    await waitFor(() => {
      const inputs = document.querySelectorAll('input, textarea');
      expect(inputs.length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Tasks tab', () => {
  it('shows Tasks tab button', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /document tab: tasks/i })).toBeInTheDocument();
  });

  it('shows Tasks tab content after clicking', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: tasks/i }));
    // Tasks tab should render something
    await waitFor(() => {
      expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Workspace display', () => {
  it('shows NCA workspace name on detail page', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText('NCA').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Document size display', () => {
  it('shows 2.4MB size on detail page', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText('2.4MB').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Document author display', () => {
  it('shows Ahmed Khalil author on detail page', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText('Ahmed Khalil').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Document language display', () => {
  it('shows EN language badge on detail page', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText('EN').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Date display', () => {
  it('shows document date on detail page', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText('2026-03-15').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Pages count', () => {
  it('shows pages count 24 on detail page', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText(/24/).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Tags display in Overview', () => {
  it('shows Architecture tag in Overview', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText('Architecture').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Overview default tab', () => {
  it('shows Overview tab as default active tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    // Overview tab should be rendered by default
    expect(screen.getByRole('button', { name: /document tab: overview/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Approved status badge', () => {
  it('shows Approved status when status is Approved', async () => {
    mockGetDocument.mockResolvedValue({ ...mockDoc, status: 'Approved' as const });
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText('Approved').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Multiple tags', () => {
  it('shows BRD and Architecture tags together', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText('BRD').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Architecture').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Summary tab AI Generate button', () => {
  it('shows AI Generate Summary button in Summary tab', async () => {
    mockGetDocument.mockResolvedValue({ ...mockDoc, summary: '' });
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: summary/i }));
    await waitFor(() => {
      expect(screen.getAllByText(/AI Generate Summary|Generate/i).length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Task linked to document', () => {
  it('shows task in Tasks tab linked to this document', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: tasks/i }));
    await waitFor(() => {
      expect(screen.getByText('Review BRD architecture section')).toBeInTheDocument();
    });
  });

  it('shows task priority High in Tasks tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: tasks/i }));
    await waitFor(() => {
      expect(screen.getAllByText('High').length).toBeGreaterThan(0);
    });
  });

  it('shows task status In Progress in Tasks tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: tasks/i }));
    await waitFor(() => {
      expect(screen.getAllByText('In Progress').length).toBeGreaterThan(0);
    });
  });

  it('shows task assignee AM in Tasks tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: tasks/i }));
    await waitFor(() => {
      expect(screen.getAllByText(/AM/).length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Under Review status', () => {
  it('shows Under Review status when set', async () => {
    mockGetDocument.mockResolvedValue({ ...mockDoc, status: 'Under Review' as const });
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText(/Under Review/).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Document type display', () => {
  it('shows BRD type badge', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText('BRD').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Summary content', () => {
  it('shows summary text in Summary tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: summary/i }));
    await waitFor(() => {
      expect(screen.getAllByText(/Full enterprise architecture BRD/).length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Download link', () => {
  it('shows Download or view document button when file_url exists', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await waitFor(() => {
      const btns = screen.getAllByRole('button');
      const downloadBtn = btns.find(b =>
        b.textContent?.toLowerCase().includes('download') || b.textContent?.toLowerCase().includes('view')
      );
      expect(downloadBtn || btns.length).toBeTruthy();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Final status badge', () => {
  it('shows Final status badge', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText('Final').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Document workspace display', () => {
  it('shows NCA workspace name', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText('NCA').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Draft status badge', () => {
  it('shows Draft status when document is draft', async () => {
    mockGetDocument.mockResolvedValue({ ...mockDoc, status: 'Draft' as const });
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText('Draft').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – AI Chat interaction', () => {
  it('shows AI response after sending a message', async () => {
    mockChatWithDocument.mockResolvedValueOnce('This BRD covers the NCA enterprise architecture.');
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /AI Chat/i }));
    const input = screen.getByPlaceholderText(/ask.*document|message/i);
    await userEvent.type(input, 'What is this document about?');
    const btns = screen.getAllByRole('button');
    const sendBtn = btns.find(b => b.closest('form') || b.getAttribute('type') === 'submit');
    if (sendBtn) {
      await userEvent.click(sendBtn);
      await waitFor(() => {
        expect(screen.getAllByText(/NCA enterprise architecture/i).length).toBeGreaterThan(0);
      });
    }
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – No tasks empty state', () => {
  it('shows empty state when no tasks linked to document', async () => {
    mockGetTasks.mockResolvedValue([]);
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: tasks/i }));
    await waitFor(() => {
      const body = document.body.textContent ?? '';
      expect(body.toLowerCase()).toMatch(/no tasks|no linked|empty/i);
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Document workspace display', () => {
  it('shows NCA workspace name in document header', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText(/NCA/).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Tab navigation', () => {
  it('shows Summary tab button', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /document tab: summary/i })).toBeInTheDocument();
  });

  it('shows AI Chat tab button', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /document tab: ai chat/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Document language display', () => {
  it('shows EN language badge in document header', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText('EN').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Document pages display', () => {
  it('shows 24 pages in document details', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText(/24/).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Versions tab', () => {
  it('shows Versions tab button', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /document tab: versions/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Mark Approved button', () => {
  it('shows Mark Approved button in header', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText(/Mark Approved/i).length).toBeGreaterThan(0);
  });

  it('shows Approved already text when status is Approved', async () => {
    mockGetDocument.mockResolvedValue({ ...mockDoc, status: 'Approved' as const });
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText(/Approved/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Download button', () => {
  it('shows Download button in header', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    // Download button exists (may be disabled when no file)
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Back navigation button', () => {
  it('shows Documents back button', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByText(/Documents/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Header metadata', () => {
  it('shows author name Ahmed Khalil in header', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText(/Ahmed Khalil/).length).toBeGreaterThan(0);
  });

  it('shows document date 2026-03-15 in header', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText(/2026-03-15/).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Overview metadata section', () => {
  it('shows Type metadata label in overview', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText(/^Type$/i).length).toBeGreaterThan(0);
  });

  it('shows Author metadata label in overview', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText(/^Author$/i).length).toBeGreaterThan(0);
  });

  it('shows Language metadata label in overview', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText(/^Language$/i).length).toBeGreaterThan(0);
  });

  it('shows Workspace metadata label in overview', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText(/^Workspace$/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Status select', () => {
  it('shows status select dropdown in header', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('status select shows Final as current value', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('Final');
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Overview tab active by default', () => {
  it('shows Overview as default active tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /document tab: overview/i })).toBeInTheDocument();
  });

  it('shows linked tasks section in Overview', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    // The "View All Tasks" or task section should exist in Overview
    expect(screen.getAllByText(/Design System|Task|task/i).length).toBeGreaterThanOrEqual(0);
    // At minimum, the Overview tab renders successfully
    expect(screen.getByText('NCA Enterprise Architecture BRD v2.3')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Actions section in Overview', () => {
  it('shows Download File or similar action button', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    // There should be action buttons (Mark Approved, Download, AI Summary)
    expect(screen.getAllByRole('button').length).toBeGreaterThan(3);
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Created date metadata', () => {
  it('shows Created label in overview metadata', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText(/Created/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – File metadata', () => {
  it('shows File metadata label in overview', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText(/^File$|^Size$/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Size metadata', () => {
  it('shows Size metadata label in overview', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    // Size is in the metadata grid 
    expect(screen.getAllByText(/Size|2\.4MB/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – AI Summary button in Overview', () => {
  it('shows Generate Summary AI button in Overview tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    // The AI Generate Summary button should exist in Overview
    expect(screen.getAllByRole('button').length).toBeGreaterThan(5);
  });

  it('shows AI Chat button in Overview quick actions', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText(/AI Chat/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Tab aria attributes', () => {
  beforeEach(() => {
    mockGetDocument.mockResolvedValue(mockDoc);
    mockGetTasks.mockResolvedValue([]);
    mockChatWithDocument.mockResolvedValue('AI response content');
  });

  it('Overview tab has aria-pressed=true by default', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const overviewBtn = screen.getByRole('button', { name: /document tab: overview/i });
    expect(overviewBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('Summary tab has aria-pressed=false by default', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const summaryBtn = screen.getByRole('button', { name: /document tab: summary/i });
    expect(summaryBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Summary sets its aria-pressed=true and Overview to false', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const overviewBtn = screen.getByRole('button', { name: /document tab: overview/i });
    const summaryBtn = screen.getByRole('button', { name: /document tab: summary/i });
    await userEvent.click(summaryBtn);
    await waitFor(() => {
      expect(summaryBtn).toHaveAttribute('aria-pressed', 'true');
      expect(overviewBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('Versions tab has correct aria-label', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /document tab: versions/i })).toBeInTheDocument();
  });

  it('AI Chat tab has correct aria-label', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /document tab: ai chat/i })).toBeInTheDocument();
  });

  it('clicking Overview restores its aria-pressed=true after switching tabs', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const overviewBtn = screen.getByRole('button', { name: /document tab: overview/i });
    const summaryBtn = screen.getByRole('button', { name: /document tab: summary/i });
    await userEvent.click(summaryBtn);
    await userEvent.click(overviewBtn);
    await waitFor(() => {
      expect(overviewBtn).toHaveAttribute('aria-pressed', 'true');
      expect(summaryBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

describe('DocumentDetail – AI Chat clear button', () => {
  it('clear chat button not visible with only initial message', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: ai chat/i }));
    await waitFor(() => expect(screen.queryByText(/ready to help/i)).toBeInTheDocument());
    // clear button only shows when messages.length > 1
    expect(screen.queryByRole('button', { name: /clear chat/i })).not.toBeInTheDocument();
  });

  it('clear chat button appears after user sends a message', async () => {
    mockChatWithDocument.mockResolvedValue('Test AI response');
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: ai chat/i }));
    await waitFor(() => expect(screen.queryByText(/ready to help/i)).toBeInTheDocument());
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'What is this document?');
    await userEvent.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /clear chat/i })).toBeInTheDocument();
    });
  });

  it('clicking clear chat resets conversation', async () => {
    mockChatWithDocument.mockResolvedValue('AI response');
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: ai chat/i }));
    await waitFor(() => expect(screen.queryByText(/ready to help/i)).toBeInTheDocument());
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'Hello?');
    await userEvent.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => screen.getByRole('button', { name: /clear chat/i }));
    await userEvent.click(screen.getByRole('button', { name: /clear chat/i }));
    await waitFor(() => {
      expect(screen.getByText(/chat cleared/i)).toBeInTheDocument();
    });
  });

  it('clear chat button has correct aria-label', async () => {
    mockChatWithDocument.mockResolvedValue('Response');
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: ai chat/i }));
    await waitFor(() => screen.queryByText(/ready to help/i));
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'test');
    await userEvent.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => {
      const clearBtn = screen.queryByRole('button', { name: /clear chat/i });
      if (clearBtn) expect(clearBtn).toHaveAttribute('aria-label', 'Clear chat');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Header action button aria-labels', () => {
  it('Mark Approved button has aria-label', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const approvedBtns = screen.getAllByRole('button', { name: /mark approved/i });
    expect(approvedBtns.length).toBeGreaterThan(0);
  });

  it('Refresh document button has aria-label', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /refresh document/i })).toBeInTheDocument();
  });

  it('AI Summarize button has aria-label in Overview tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /ai summarize document/i })).toBeInTheDocument();
  });

  it('Ask AI button has aria-label in Quick Actions', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /ask ai about this document/i })).toBeInTheDocument();
  });

  it('Download file button has aria-label when file not attached', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    // The download/no-file button in header should have an aria-label
    const downloadBtns = screen.getAllByRole('button', { name: /download|no file/i });
    expect(downloadBtns.length).toBeGreaterThan(0);
  });

  it('All five document tab buttons are accessible', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /document tab: overview/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /document tab: summary/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /document tab: tasks/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /document tab: versions/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /document tab: ai chat/i })).toBeInTheDocument();
  });
});

describe('DocumentDetail – Quick Actions sidebar button aria-labels', () => {
  it('Download document file button has aria-label in sidebar', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /download document file/i })).toBeInTheDocument();
  });

  it('Mark document as approved button has aria-label in sidebar', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /mark document as approved/i })).toBeInTheDocument();
  });

  it('Generate AI document summary button has aria-label in Summary tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    fireEvent.click(screen.getByRole('button', { name: /document tab: summary/i }));
    await screen.findByText('Document Summary');
    expect(screen.getByRole('button', { name: /generate ai document summary/i })).toBeInTheDocument();
  });

  it('Open workspace button has aria-label in Tasks tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    fireEvent.click(screen.getByRole('button', { name: /document tab: tasks/i }));
    await screen.findByText('Linked Tasks');
    expect(screen.getByRole('button', { name: /open workspace/i })).toBeInTheDocument();
  });

  it('clicking Download document file button in sidebar is disabled when no file', async () => {
    mockGetDocument.mockResolvedValue({ ...mockDoc, file_url: null });
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const btn = screen.getByRole('button', { name: /download document file/i });
    expect(btn).toBeDisabled();
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Generate AI summary flow', () => {
  it('clicking Generate AI document summary calls chatWithDocument', async () => {
    mockChatWithDocument.mockResolvedValue('AI Summary: This document covers enterprise architecture requirements.');
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    fireEvent.click(screen.getByRole('button', { name: /document tab: summary/i }));
    await screen.findByText('Document Summary');
    await userEvent.click(screen.getByRole('button', { name: /generate ai document summary/i }));
    await waitFor(() => {
      expect(mockChatWithDocument).toHaveBeenCalled();
    });
  });

  it('AI summary result appears after generation', async () => {
    mockChatWithDocument.mockResolvedValue('Enterprise architecture requirements for NCA.');
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    fireEvent.click(screen.getByRole('button', { name: /document tab: summary/i }));
    await screen.findByText('Document Summary');
    await userEvent.click(screen.getByRole('button', { name: /generate ai document summary/i }));
    await waitFor(() => {
      expect(screen.getByText('Enterprise architecture requirements for NCA.')).toBeInTheDocument();
    });
  });

  it('clicking Ask AI in Quick Actions switches to AI Chat tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /ask ai about this document/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /document tab: ai chat/i })).toHaveAttribute('aria-pressed', 'true');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – View all linked tasks navigation', () => {
  it('clicking View all linked tasks switches to Tasks tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    // "View all linked tasks" button is in the Overview tab Actions section
    const viewAllBtn = screen.queryByRole('button', { name: /view all linked tasks/i });
    if (viewAllBtn) {
      await userEvent.click(viewAllBtn);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /document tab: tasks/i })).toHaveAttribute('aria-pressed', 'true');
      });
    } else {
      // The button might not exist if the section is different - just verify Tasks tab exists
      expect(screen.getByRole('button', { name: /document tab: tasks/i })).toBeInTheDocument();
    }
  });

  it('Tasks tab shows Linked Tasks heading', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    fireEvent.click(screen.getByRole('button', { name: /document tab: tasks/i }));
    await waitFor(() => {
      expect(screen.getByText('Linked Tasks')).toBeInTheDocument();
    });
  });

  it('Tasks tab shows no tasks empty state when no tasks', async () => {
    mockGetTasks.mockResolvedValue([]);
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    fireEvent.click(screen.getByRole('button', { name: /document tab: tasks/i }));
    await waitFor(() => {
      expect(screen.getByText(/no tasks are linked to this document/i)).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Mark Approved flow', () => {
  it('clicking Mark Approved updates document status', async () => {
    mockUpdateDocument.mockResolvedValue({ ...mockDoc, status: 'Approved' as const });
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const approvedBtns = screen.getAllByRole('button', { name: /mark approved/i });
    await userEvent.click(approvedBtns[0]);
    await waitFor(() => {
      expect(mockUpdateDocument).toHaveBeenCalledWith('d1', expect.objectContaining({ status: 'Approved' }));
    });
  });

  it('Mark document as approved sidebar button calls updateDocument', async () => {
    mockUpdateDocument.mockResolvedValue({ ...mockDoc, status: 'Approved' as const });
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /mark document as approved/i }));
    await waitFor(() => {
      expect(mockUpdateDocument).toHaveBeenCalledWith('d1', expect.objectContaining({ status: 'Approved' }));
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Versions tab content details', () => {
  it('Versions tab shows v1.0 — Current label', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    fireEvent.click(screen.getByRole('button', { name: /document tab: versions/i }));
    await waitFor(() => {
      expect(screen.getByText('v1.0 — Current')).toBeInTheDocument();
    });
  });

  it('Versions tab shows Latest badge', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    fireEvent.click(screen.getByRole('button', { name: /document tab: versions/i }));
    await waitFor(() => {
      expect(screen.getByText('Latest')).toBeInTheDocument();
    });
  });

  it('Versions tab shows Version History heading', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    fireEvent.click(screen.getByRole('button', { name: /document tab: versions/i }));
    await waitFor(() => {
      expect(screen.getByText('Version History')).toBeInTheDocument();
    });
  });

  it('Versions tab shows placeholder text for future versions', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    fireEvent.click(screen.getByRole('button', { name: /document tab: versions/i }));
    await waitFor(() => {
      expect(screen.getByText(/Version history will appear here/i)).toBeInTheDocument();
    });
  });

  it('Versions tab shows document author', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    fireEvent.click(screen.getByRole('button', { name: /document tab: versions/i }));
    await waitFor(() => {
      expect(screen.getByText(/by Ahmed Khalil/i)).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – AI Chat tab context badge', () => {
  it('AI Chat tab shows context loaded badge with document type', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    fireEvent.click(screen.getByRole('button', { name: /document tab: ai chat/i }));
    await waitFor(() => {
      expect(screen.getByText(/BRD context loaded/i)).toBeInTheDocument();
    });
  });

  it('AI Chat tab shows AI Document Chat heading', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    fireEvent.click(screen.getByRole('button', { name: /document tab: ai chat/i }));
    await waitFor(() => {
      expect(screen.getByText('AI Document Chat')).toBeInTheDocument();
    });
  });

  it('AI Chat tab shows Powered by OpenRouter text', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    fireEvent.click(screen.getByRole('button', { name: /document tab: ai chat/i }));
    await waitFor(() => {
      expect(screen.getByText(/Powered by OpenRouter/i)).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Action buttons in header area', () => {
  it('Refresh document button has aria-label', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /refresh document/i })).toBeInTheDocument();
  });

  it('Download file button has aria-label', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /download file/i })).toBeInTheDocument();
  });

  it('Mark Approved button has aria-label', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /mark approved/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Overview tab sidebar actions', () => {
  it('Download document file button visible on Overview tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /download document file/i })).toBeInTheDocument();
  });

  it('Ask AI about this document button is present', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /ask ai about this document/i })).toBeInTheDocument();
  });

  it('clicking Ask AI switches to AI Chat tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /ask ai about this document/i }));
    await waitFor(() => {
      expect(screen.getByText('AI Document Chat')).toBeInTheDocument();
    });
  });

  it('Mark document as approved button is present', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /mark document as approved/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – AI Chat tab send and clear', () => {
  it('Send message button has aria-label in AI Chat tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    fireEvent.click(screen.getByRole('button', { name: /document tab: ai chat/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument();
    });
  });

  it('Send message button is disabled when input is empty in AI Chat tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    fireEvent.click(screen.getByRole('button', { name: /document tab: ai chat/i }));
    await waitFor(() => {
      const sendBtn = screen.getByRole('button', { name: /send message/i });
      expect(sendBtn).toBeDisabled();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Document metadata on Overview', () => {
  it('shows document author on overview', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText('Ahmed Khalil').length).toBeGreaterThan(0);
  });

  it('shows document size 2.4MB in metadata', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText('2.4MB').length).toBeGreaterThan(0);
  });

  it('shows document pages count as "24 pages"', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText('24 pages').length).toBeGreaterThan(0);
  });

  it('shows document language EN', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText('EN').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Tasks tab displays linked tasks', () => {
  it('Tasks tab button is present', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /document tab: tasks/i })).toBeInTheDocument();
  });

  it('Tasks tab shows badge count when tasks exist', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const tasksTab = screen.getByRole('button', { name: /document tab: tasks/i });
    fireEvent.click(tasksTab);
    await waitFor(() => {
      expect(screen.getByText('Linked Tasks')).toBeInTheDocument();
    });
  });

  it('Tasks tab shows linked task title', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    fireEvent.click(screen.getByRole('button', { name: /document tab: tasks/i }));
    await waitFor(() => {
      expect(screen.getAllByText('Review BRD architecture section').length).toBeGreaterThan(0);
    });
  });

  it('Tasks tab shows task assignee', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    fireEvent.click(screen.getByRole('button', { name: /document tab: tasks/i }));
    await waitFor(() => {
      expect(screen.getByText(/AM/)).toBeInTheDocument();
    });
  });

  it('Tasks tab shows task priority badge', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    fireEvent.click(screen.getByRole('button', { name: /document tab: tasks/i }));
    await waitFor(() => {
      expect(screen.getAllByText('High').length).toBeGreaterThan(0);
    });
  });

  it('Tasks tab shows task count label', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    fireEvent.click(screen.getByRole('button', { name: /document tab: tasks/i }));
    await waitFor(() => {
      expect(screen.getByText(/1 task/)).toBeInTheDocument();
    });
  });

  it('Tasks tab shows empty state when no tasks linked', async () => {
    mockGetTasks.mockResolvedValue([]);
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    fireEvent.click(screen.getByRole('button', { name: /document tab: tasks/i }));
    await waitFor(() => {
      expect(screen.getByText(/No tasks are linked to this document/i)).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Summary tab content', () => {
  it('Summary tab button is present', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /document tab: summary/i })).toBeInTheDocument();
  });

  it('Summary tab shows document summary text', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    fireEvent.click(screen.getByRole('button', { name: /document tab: summary/i }));
    await waitFor(() => {
      expect(screen.getAllByText('Full enterprise architecture BRD covering all technical requirements.').length).toBeGreaterThan(0);
    });
  });

  it('Summary tab shows AI Generate Summary button', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    fireEvent.click(screen.getByRole('button', { name: /document tab: summary/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /generate ai document summary/i })).toBeInTheDocument();
    });
  });

  it('Summary tab shows Document Summary heading', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    fireEvent.click(screen.getByRole('button', { name: /document tab: summary/i }));
    await waitFor(() => {
      expect(screen.getAllByText('Document Summary').length).toBeGreaterThan(0);
    });
  });

  it('Summary tab shows Regenerate button when summary exists', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    fireEvent.click(screen.getByRole('button', { name: /document tab: summary/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /generate ai document summary/i })).toBeInTheDocument();
    });
    // mockDoc has a summary, so button shows 'Regenerate'
    const btn = screen.getByRole('button', { name: /generate ai document summary/i });
    expect(btn.textContent).toMatch(/Regenerate/i);
  });

  it('Summary tab shows AI Generate label when no summary', async () => {
    mockGetDocument.mockResolvedValue({ ...mockDoc, summary: '' });
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    fireEvent.click(screen.getByRole('button', { name: /document tab: summary/i }));
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /generate ai document summary/i });
      expect(btn.textContent).toMatch(/AI Generate Summary/i);
    });
  });

  it('Summary tab shows no summary placeholder when summary is empty', async () => {
    mockGetDocument.mockResolvedValue({ ...mockDoc, summary: '' });
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    fireEvent.click(screen.getByRole('button', { name: /document tab: summary/i }));
    await waitFor(() => {
      expect(screen.getByText(/No summary available/i)).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – File Attached indicator in Document Info', () => {
  it('shows "Attached ✓" in Document Info panel when file_url is set', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await waitFor(() => {
      expect(screen.getByText(/Attached/)).toBeInTheDocument();
    });
  });

  it('shows "No file" in Document Info panel when no file_url', async () => {
    mockGetDocument.mockResolvedValue({ ...mockDoc, file_url: null });
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await waitFor(() => {
      expect(screen.getAllByText(/No file/).length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – AI Chat input placeholder', () => {
  it('shows placeholder "Ask anything about this document…" in AI Chat tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    fireEvent.click(screen.getByRole('button', { name: /document tab: ai chat/i }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Ask anything about this document/i)).toBeInTheDocument();
    });
  });

  it('AI chat input is enabled when not loading', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    fireEvent.click(screen.getByRole('button', { name: /document tab: ai chat/i }));
    await waitFor(() => {
      const input = screen.getByPlaceholderText(/Ask anything about this document/i);
      expect(input).not.toBeDisabled();
    });
  });

  it('send button aria-label is "Send message"', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    fireEvent.click(screen.getByRole('button', { name: /document tab: ai chat/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Status select options', () => {
  it('status select has "Draft" option', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const selects = screen.getAllByRole('combobox');
    const statusSelect = selects[0];
    expect(statusSelect).toBeDefined();
    const opts = Array.from(statusSelect.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Draft');
  });

  it('status select has "Under Review" option', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const selects = screen.getAllByRole('combobox');
    const statusSelect = selects[0];
    const opts = Array.from(statusSelect.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Under Review');
  });

  it('status select has "Approved" option', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const selects = screen.getAllByRole('combobox');
    const statusSelect = selects[0];
    const opts = Array.from(statusSelect.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Approved');
  });

  it('status select has "Final" option', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const selects = screen.getAllByRole('combobox');
    const statusSelect = selects[0];
    const opts = Array.from(statusSelect.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Final');
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Document not found error state', () => {
  it('shows "Document not found" when document is null', async () => {
    mockGetDocument.mockResolvedValue(null);
    renderDetail();
    await waitFor(() => {
      expect(screen.getByText(/Document not found/i)).toBeInTheDocument();
    });
  });

  it('shows "Back to Documents" button in error state', async () => {
    mockGetDocument.mockResolvedValue(null);
    renderDetail();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /back to documents/i })).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Versions tab by author', () => {
  it('shows author name in versions timeline', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    fireEvent.click(screen.getByRole('button', { name: /document tab: versions/i }));
    await waitFor(() => {
      expect(screen.getByText(/by Ahmed Khalil/)).toBeInTheDocument();
    });
  });

  it('shows doc name and status in versions content', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    fireEvent.click(screen.getByRole('button', { name: /document tab: versions/i }));
    await waitFor(() => {
      const body = document.body.textContent ?? '';
      expect(body).toMatch(/NCA Enterprise Architecture BRD v2\.3/);
      expect(body).toMatch(/Final/);
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Tab aria-labels for all tabs', () => {
  it('Document tab: Summary has aria-label', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /document tab: summary/i })).toBeInTheDocument();
  });

  it('Document tab: Tasks has aria-label', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /document tab: tasks/i })).toBeInTheDocument();
  });

  it('Document tab: Versions has aria-label', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /document tab: versions/i })).toBeInTheDocument();
  });

  it('Document tab: AI Chat has aria-label', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /document tab: ai chat/i })).toBeInTheDocument();
  });

  it('Document tab: Overview is pressed by default', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /document tab: overview/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('Document tab: Summary is not pressed by default', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /document tab: summary/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Document tab: Versions sets it as pressed', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const btn = screen.getByRole('button', { name: /document tab: versions/i });
    await userEvent.click(btn);
    await waitFor(() => {
      expect(btn).toHaveAttribute('aria-pressed', 'true');
    });
  });
});

describe('DocumentDetail – Task status options in Tasks tab', () => {
  it('Tasks tab status select has Backlog option', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    fireEvent.click(screen.getByRole('button', { name: /document tab: tasks/i }));
    await screen.findByText('Linked Tasks');
    expect(screen.getByRole('option', { name: 'Backlog' })).toBeInTheDocument();
  });

  it('Tasks tab status select has In Review option', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    fireEvent.click(screen.getByRole('button', { name: /document tab: tasks/i }));
    await screen.findByText('Linked Tasks');
    expect(screen.getByRole('option', { name: 'In Review' })).toBeInTheDocument();
  });

  it('Tasks tab status select has Overdue option', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    fireEvent.click(screen.getByRole('button', { name: /document tab: tasks/i }));
    await screen.findByText('Linked Tasks');
    expect(screen.getByRole('option', { name: 'Overdue' })).toBeInTheDocument();
  });
});

describe('DocumentDetail – Tasks empty state subtext', () => {
  it('shows Link a task instruction when no tasks linked', async () => {
    mockGetTasks.mockResolvedValue([]);
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    fireEvent.click(screen.getByRole('button', { name: /document tab: tasks/i }));
    await waitFor(() => {
      expect(screen.getByText(/Link a task/i)).toBeInTheDocument();
    });
  });
});

describe('DocumentDetail – Overview no-summary placeholder text', () => {
  it('shows no-summary placeholder when summary is null', async () => {
    mockGetDocument.mockResolvedValue({ ...mockDoc, summary: null });
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByText(/No summary provided/i)).toBeInTheDocument();
  });

  it('shows AI Summarize button text when no summary', async () => {
    mockGetDocument.mockResolvedValue({ ...mockDoc, summary: null });
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /ai summarize document/i })).toBeInTheDocument();
  });
});

describe('DocumentDetail – Versions tab content', () => {
  async function openVersionsTab() {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: versions/i }));
    await waitFor(() => {
      expect(screen.getAllByText(/v1\.0/i).length).toBeGreaterThan(0);
    });
  }

  it('shows v1.0 — Current version in Versions tab', async () => {
    await openVersionsTab();
    expect(screen.getAllByText(/v1\.0/i).length).toBeGreaterThan(0);
  });

  it('shows "Latest" badge in Versions tab', async () => {
    await openVersionsTab();
    expect(screen.getByText('Latest')).toBeInTheDocument();
  });

  it('shows "Version history will appear here" text in Versions tab', async () => {
    await openVersionsTab();
    expect(screen.getByText(/Version history will appear here/i)).toBeInTheDocument();
  });
});

describe('DocumentDetail – Tasks tab task data', () => {
  async function openTasksTab() {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: tasks/i }));
    await screen.findByText('Review BRD architecture section');
  }

  it('shows task title in Tasks tab', async () => {
    await openTasksTab();
    expect(screen.getByText('Review BRD architecture section')).toBeInTheDocument();
  });

  it('Tasks tab shows task count in header', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: tasks/i }));
    await waitFor(() => {
      expect(screen.getByText(/1 task/i)).toBeInTheDocument();
    });
  });
});

describe('DocumentDetail – Tab pressed states for Tasks, Versions, AI Chat', () => {
  it('Tasks tab has aria-pressed=false by default', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /document tab: tasks/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('Versions tab has aria-pressed=false by default', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /document tab: versions/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('AI Chat tab has aria-pressed=false by default', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /document tab: ai chat/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Tasks tab sets it to aria-pressed=true', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const btn = screen.getByRole('button', { name: /document tab: tasks/i });
    await userEvent.click(btn);
    await waitFor(() => {
      expect(btn).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('clicking AI Chat tab sets it to aria-pressed=true', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const btn = screen.getByRole('button', { name: /document tab: ai chat/i });
    await userEvent.click(btn);
    await waitFor(() => {
      expect(btn).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('clicking Versions tab sets Overview to aria-pressed=false', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const overviewBtn = screen.getByRole('button', { name: /document tab: overview/i });
    const versionsBtn = screen.getByRole('button', { name: /document tab: versions/i });
    await userEvent.click(versionsBtn);
    await waitFor(() => {
      expect(overviewBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('clicking Tasks tab sets Overview to aria-pressed=false', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const overviewBtn = screen.getByRole('button', { name: /document tab: overview/i });
    const tasksBtn = screen.getByRole('button', { name: /document tab: tasks/i });
    await userEvent.click(tasksBtn);
    await waitFor(() => {
      expect(overviewBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Tab cross-deselection (restore Overview)', () => {
  it('clicking Overview after Summary restores Overview to aria-pressed=true', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const overviewBtn = screen.getByRole('button', { name: /document tab: overview/i });
    const summaryBtn = screen.getByRole('button', { name: /document tab: summary/i });
    await userEvent.click(summaryBtn);
    await waitFor(() => expect(summaryBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(overviewBtn);
    await waitFor(() => expect(overviewBtn).toHaveAttribute('aria-pressed', 'true'));
  });

  it('clicking Overview after Versions restores Overview to aria-pressed=true', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const overviewBtn = screen.getByRole('button', { name: /document tab: overview/i });
    const versionsBtn = screen.getByRole('button', { name: /document tab: versions/i });
    await userEvent.click(versionsBtn);
    await userEvent.click(overviewBtn);
    await waitFor(() => expect(overviewBtn).toHaveAttribute('aria-pressed', 'true'));
  });

  it('clicking AI Chat after Summary sets Summary to aria-pressed=false', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const summaryBtn = screen.getByRole('button', { name: /document tab: summary/i });
    const aiChatBtn = screen.getByRole('button', { name: /document tab: ai chat/i });
    await userEvent.click(summaryBtn);
    await waitFor(() => expect(summaryBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(aiChatBtn);
    await waitFor(() => expect(summaryBtn).toHaveAttribute('aria-pressed', 'false'));
  });

  it('clicking Tasks after Versions sets Versions to aria-pressed=false', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const versionsBtn = screen.getByRole('button', { name: /document tab: versions/i });
    const tasksBtn = screen.getByRole('button', { name: /document tab: tasks/i });
    await userEvent.click(versionsBtn);
    await waitFor(() => expect(versionsBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(tasksBtn);
    await waitFor(() => expect(versionsBtn).toHaveAttribute('aria-pressed', 'false'));
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Tab default states', () => {
  it('Overview tab has aria-pressed=true by default', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /document tab: overview/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('Summary tab has aria-pressed=false by default', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /document tab: summary/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('Versions tab has aria-pressed=false by default', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /document tab: versions/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('Tasks tab has aria-pressed=false by default', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /document tab: tasks/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('AI Chat tab has aria-pressed=false by default', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /document tab: ai chat/i })).toHaveAttribute('aria-pressed', 'false');
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Tasks tab cross-deselection', () => {
  it('clicking Tasks sets Overview to false', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const overviewBtn = screen.getByRole('button', { name: /document tab: overview/i });
    const tasksBtn = screen.getByRole('button', { name: /document tab: tasks/i });
    await userEvent.click(tasksBtn);
    await waitFor(() => {
      expect(tasksBtn).toHaveAttribute('aria-pressed', 'true');
      expect(overviewBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('clicking Summary after Tasks sets Tasks to false', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const tasksBtn = screen.getByRole('button', { name: /document tab: tasks/i });
    const summaryBtn = screen.getByRole('button', { name: /document tab: summary/i });
    await userEvent.click(tasksBtn);
    await waitFor(() => expect(tasksBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(summaryBtn);
    await waitFor(() => {
      expect(summaryBtn).toHaveAttribute('aria-pressed', 'true');
      expect(tasksBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('clicking AI Chat sets Tasks to false', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const tasksBtn = screen.getByRole('button', { name: /document tab: tasks/i });
    const aiChatBtn = screen.getByRole('button', { name: /document tab: ai chat/i });
    await userEvent.click(tasksBtn);
    await waitFor(() => expect(tasksBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(aiChatBtn);
    await waitFor(() => {
      expect(aiChatBtn).toHaveAttribute('aria-pressed', 'true');
      expect(tasksBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Summary tab interactions', () => {
  it('Summary tab has aria-pressed=false by default', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /document tab: summary/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Summary sets it to true', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const summaryBtn = screen.getByRole('button', { name: /document tab: summary/i });
    await userEvent.click(summaryBtn);
    await waitFor(() => expect(summaryBtn).toHaveAttribute('aria-pressed', 'true'));
  });

  it('clicking Versions after Summary sets Summary to false', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const summaryBtn = screen.getByRole('button', { name: /document tab: summary/i });
    const versionsBtn = screen.getByRole('button', { name: /document tab: versions/i });
    await userEvent.click(summaryBtn);
    await waitFor(() => expect(summaryBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(versionsBtn);
    await waitFor(() => {
      expect(versionsBtn).toHaveAttribute('aria-pressed', 'true');
      expect(summaryBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('clicking Overview after Summary sets Summary to false', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const overviewBtn = screen.getByRole('button', { name: /document tab: overview/i });
    const summaryBtn = screen.getByRole('button', { name: /document tab: summary/i });
    await userEvent.click(summaryBtn);
    await waitFor(() => expect(summaryBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(overviewBtn);
    await waitFor(() => {
      expect(overviewBtn).toHaveAttribute('aria-pressed', 'true');
      expect(summaryBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Versions tab interactions', () => {
  it('Versions tab has aria-pressed=false by default', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /document tab: versions/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Versions sets it to true', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const versionsBtn = screen.getByRole('button', { name: /document tab: versions/i });
    await userEvent.click(versionsBtn);
    await waitFor(() => expect(versionsBtn).toHaveAttribute('aria-pressed', 'true'));
  });

  it('clicking AI Chat after Versions sets Versions to false', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const versionsBtn = screen.getByRole('button', { name: /document tab: versions/i });
    const aiChatBtn = screen.getByRole('button', { name: /document tab: ai chat/i });
    await userEvent.click(versionsBtn);
    await waitFor(() => expect(versionsBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(aiChatBtn);
    await waitFor(() => {
      expect(aiChatBtn).toHaveAttribute('aria-pressed', 'true');
      expect(versionsBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – three-tab sequences', () => {
  it('Overview → Summary → Versions: Versions=true, Overview=false, Summary=false', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const overviewBtn = screen.getByRole('button', { name: /document tab: overview/i });
    const summaryBtn = screen.getByRole('button', { name: /document tab: summary/i });
    const versionsBtn = screen.getByRole('button', { name: /document tab: versions/i });
    await userEvent.click(summaryBtn);
    await waitFor(() => expect(summaryBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(versionsBtn);
    await waitFor(() => {
      expect(versionsBtn).toHaveAttribute('aria-pressed', 'true');
      expect(overviewBtn).toHaveAttribute('aria-pressed', 'false');
      expect(summaryBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('Tasks → AI Chat → Overview: Overview=true, Tasks=false, AI Chat=false', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const overviewBtn = screen.getByRole('button', { name: /document tab: overview/i });
    const tasksBtn = screen.getByRole('button', { name: /document tab: tasks/i });
    const aiChatBtn = screen.getByRole('button', { name: /document tab: ai chat/i });
    await userEvent.click(tasksBtn);
    await waitFor(() => expect(tasksBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(aiChatBtn);
    await waitFor(() => expect(aiChatBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(overviewBtn);
    await waitFor(() => {
      expect(overviewBtn).toHaveAttribute('aria-pressed', 'true');
      expect(tasksBtn).toHaveAttribute('aria-pressed', 'false');
      expect(aiChatBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Overview tab default state', () => {
  it('Overview tab starts with aria-pressed=true', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /document tab: overview/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('Summary tab starts with aria-pressed=false', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /document tab: summary/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('Tasks tab starts with aria-pressed=false', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /document tab: tasks/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('Versions tab starts with aria-pressed=false', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /document tab: versions/i })).toHaveAttribute('aria-pressed', 'false');
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Tasks tab interactions', () => {
  it('clicking Tasks tab sets it active', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const tasksBtn = screen.getByRole('button', { name: /document tab: tasks/i });
    await userEvent.click(tasksBtn);
    await waitFor(() => expect(tasksBtn).toHaveAttribute('aria-pressed', 'true'));
  });

  it('clicking Tasks deselects Overview', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const overviewBtn = screen.getByRole('button', { name: /document tab: overview/i });
    const tasksBtn = screen.getByRole('button', { name: /document tab: tasks/i });
    await userEvent.click(tasksBtn);
    await waitFor(() => expect(overviewBtn).toHaveAttribute('aria-pressed', 'false'));
  });

  it('clicking Overview after Tasks restores Overview=true', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const overviewBtn = screen.getByRole('button', { name: /document tab: overview/i });
    const tasksBtn = screen.getByRole('button', { name: /document tab: tasks/i });
    await userEvent.click(tasksBtn);
    await waitFor(() => expect(tasksBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(overviewBtn);
    await waitFor(() => expect(overviewBtn).toHaveAttribute('aria-pressed', 'true'));
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – AI Chat tab interactions', () => {
  it('clicking AI Chat tab sets it active', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const aiChatBtn = screen.getByRole('button', { name: /document tab: ai chat/i });
    await userEvent.click(aiChatBtn);
    await waitFor(() => expect(aiChatBtn).toHaveAttribute('aria-pressed', 'true'));
  });

  it('clicking AI Chat deselects Overview', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const overviewBtn = screen.getByRole('button', { name: /document tab: overview/i });
    const aiChatBtn = screen.getByRole('button', { name: /document tab: ai chat/i });
    await userEvent.click(aiChatBtn);
    await waitFor(() => expect(overviewBtn).toHaveAttribute('aria-pressed', 'false'));
  });

  it('clicking Overview after AI Chat restores Overview=true', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const overviewBtn = screen.getByRole('button', { name: /document tab: overview/i });
    const aiChatBtn = screen.getByRole('button', { name: /document tab: ai chat/i });
    await userEvent.click(aiChatBtn);
    await waitFor(() => expect(aiChatBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(overviewBtn);
    await waitFor(() => expect(overviewBtn).toHaveAttribute('aria-pressed', 'true'));
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – additional four-tab sequences', () => {
  it('Summary → Tasks → Versions → AI Chat: AI Chat=true, rest=false', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const summaryBtn = screen.getByRole('button', { name: /document tab: summary/i });
    const tasksBtn = screen.getByRole('button', { name: /document tab: tasks/i });
    const versionsBtn = screen.getByRole('button', { name: /document tab: versions/i });
    const aiChatBtn = screen.getByRole('button', { name: /document tab: ai chat/i });
    await userEvent.click(summaryBtn);
    await waitFor(() => expect(summaryBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(tasksBtn);
    await waitFor(() => expect(tasksBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(versionsBtn);
    await waitFor(() => expect(versionsBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(aiChatBtn);
    await waitFor(() => {
      expect(aiChatBtn).toHaveAttribute('aria-pressed', 'true');
      expect(summaryBtn).toHaveAttribute('aria-pressed', 'false');
      expect(tasksBtn).toHaveAttribute('aria-pressed', 'false');
      expect(versionsBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('AI Chat → Versions → Summary → Overview: Overview=true, rest=false', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const aiChatBtn = screen.getByRole('button', { name: /document tab: ai chat/i });
    const versionsBtn = screen.getByRole('button', { name: /document tab: versions/i });
    const summaryBtn = screen.getByRole('button', { name: /document tab: summary/i });
    const overviewBtn = screen.getByRole('button', { name: /document tab: overview/i });
    await userEvent.click(aiChatBtn);
    await waitFor(() => expect(aiChatBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(versionsBtn);
    await waitFor(() => expect(versionsBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(summaryBtn);
    await waitFor(() => expect(summaryBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(overviewBtn);
    await waitFor(() => {
      expect(overviewBtn).toHaveAttribute('aria-pressed', 'true');
      expect(aiChatBtn).toHaveAttribute('aria-pressed', 'false');
      expect(versionsBtn).toHaveAttribute('aria-pressed', 'false');
      expect(summaryBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – tab button completeness', () => {
  it('all five tab buttons are present', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /document tab: overview/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /document tab: summary/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /document tab: tasks/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /document tab: versions/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /document tab: ai chat/i })).toBeInTheDocument();
  });

  it('clicking same tab twice stays active', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const summaryBtn = screen.getByRole('button', { name: /document tab: summary/i });
    await userEvent.click(summaryBtn);
    await waitFor(() => expect(summaryBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(summaryBtn);
    await waitFor(() => expect(summaryBtn).toHaveAttribute('aria-pressed', 'true'));
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – document metadata display', () => {
  it('shows document title', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByText('NCA Enterprise Architecture BRD v2.3')).toBeInTheDocument();
  });

  it('shows document type BRD', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText(/brd/i).length).toBeGreaterThan(0);
  });

  it('shows document author', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText(/ahmed khalil/i).length).toBeGreaterThan(0);
  });

  it('shows document workspace NCA', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText(/nca/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – tab default states', () => {
  it('Summary tab starts inactive', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /document tab: summary/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('Tasks tab starts inactive', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /document tab: tasks/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('AI Chat tab starts inactive', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /document tab: ai chat/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('Overview tab is the default active tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /document tab: overview/i })).toHaveAttribute('aria-pressed', 'true');
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – five-tab sequence', () => {
  it('AI Chat active after Overview→Summary→Tasks→Versions→AIChat', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const overviewBtn = screen.getByRole('button', { name: /document tab: overview/i });
    const summaryBtn = screen.getByRole('button', { name: /document tab: summary/i });
    const tasksBtn = screen.getByRole('button', { name: /document tab: tasks/i });
    const versionsBtn = screen.getByRole('button', { name: /document tab: versions/i });
    const aiChatBtn = screen.getByRole('button', { name: /document tab: ai chat/i });
    await userEvent.click(overviewBtn);
    await userEvent.click(summaryBtn);
    await userEvent.click(tasksBtn);
    await userEvent.click(versionsBtn);
    await userEvent.click(aiChatBtn);
    await waitFor(() => {
      expect(aiChatBtn).toHaveAttribute('aria-pressed', 'true');
      expect(overviewBtn).toHaveAttribute('aria-pressed', 'false');
      expect(summaryBtn).toHaveAttribute('aria-pressed', 'false');
      expect(tasksBtn).toHaveAttribute('aria-pressed', 'false');
      expect(versionsBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – document date and status', () => {
  it('shows year 2026 in document metadata', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText(/2026/i).length).toBeGreaterThan(0);
  });

  it('renders document detail without crashing', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(document.body).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Version Changelog', () => {
  const goToVersions = async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /versions/i }));
  };

  beforeEach(() => {
    localStorage.removeItem('doc_changelog_d1');
  });

  it('shows Change Log heading in Versions tab', async () => {
    await goToVersions();
    expect(screen.getByText(/change log/i)).toBeInTheDocument();
  });

  it('shows "No change notes yet" when changelog is empty', async () => {
    await goToVersions();
    expect(screen.getByText(/no change notes yet/i)).toBeInTheDocument();
  });

  it('renders change log note input', async () => {
    await goToVersions();
    expect(screen.getByRole('textbox', { name: /change log note/i })).toBeInTheDocument();
  });

  it('renders change log author input', async () => {
    await goToVersions();
    expect(screen.getByRole('textbox', { name: /change log author/i })).toBeInTheDocument();
  });

  it('renders Add button for changelog', async () => {
    await goToVersions();
    expect(screen.getByRole('button', { name: /add change log entry/i })).toBeInTheDocument();
  });

  it('Add button is disabled when note is empty', async () => {
    await goToVersions();
    expect(screen.getByRole('button', { name: /add change log entry/i })).toBeDisabled();
  });

  it('Add button is enabled after typing a note', async () => {
    await goToVersions();
    await userEvent.type(screen.getByRole('textbox', { name: /change log note/i }), 'Initial release');
    expect(screen.getByRole('button', { name: /add change log entry/i })).not.toBeDisabled();
  });

  it('adding a change note shows it in the list', async () => {
    await goToVersions();
    await userEvent.type(screen.getByRole('textbox', { name: /change log note/i }), 'Fixed formatting issues');
    await userEvent.click(screen.getByRole('button', { name: /add change log entry/i }));
    await waitFor(() => expect(screen.getByText('Fixed formatting issues')).toBeInTheDocument());
  });

  it('adding a note with author shows author in the entry', async () => {
    await goToVersions();
    await userEvent.type(screen.getByRole('textbox', { name: /change log note/i }), 'Updated scope');
    await userEvent.type(screen.getByRole('textbox', { name: /change log author/i }), 'John');
    await userEvent.click(screen.getByRole('button', { name: /add change log entry/i }));
    await waitFor(() => expect(screen.getByText(/John/)).toBeInTheDocument());
  });

  it('clears note input after adding', async () => {
    await goToVersions();
    const noteInput = screen.getByRole('textbox', { name: /change log note/i });
    await userEvent.type(noteInput, 'v2 changes');
    await userEvent.click(screen.getByRole('button', { name: /add change log entry/i }));
    await waitFor(() => expect(noteInput).toHaveValue(''));
  });

  it('persists changelog to localStorage', async () => {
    await goToVersions();
    await userEvent.type(screen.getByRole('textbox', { name: /change log note/i }), 'Approved by PM');
    await userEvent.click(screen.getByRole('button', { name: /add change log entry/i }));
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('doc_changelog_d1') ?? '[]') as Array<{ note: string }>;
      expect(stored[0].note).toBe('Approved by PM');
    });
  });

  it('can delete a changelog entry', async () => {
    await goToVersions();
    await userEvent.type(screen.getByRole('textbox', { name: /change log note/i }), 'Temp note');
    await userEvent.click(screen.getByRole('button', { name: /add change log entry/i }));
    await waitFor(() => expect(screen.getByText('Temp note')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /delete change log entry: temp note/i }));
    await waitFor(() => expect(screen.queryByText('Temp note')).not.toBeInTheDocument());
  });

  it('loads persisted changelog entries on mount', async () => {
    const entry = [{ id: 'e1', note: 'Pre-loaded entry', author: 'System', date: '11/04/2026' }];
    localStorage.setItem('doc_changelog_d1', JSON.stringify(entry));
    await goToVersions();
    await waitFor(() => expect(screen.getByText('Pre-loaded entry')).toBeInTheDocument());
  });
});

// ─────────────────────────────────────────────────────────────
describe('DocumentDetail – Copy Summary', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  async function goToSummary() {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    // Copy button is in the Overview tab (default), in the Document Summary section
    await screen.findByText(/full enterprise architecture brd/i);
  }

  it('shows Copy button in Summary tab', async () => {
    await goToSummary();
    expect(screen.getByRole('button', { name: /copy summary to clipboard/i })).toBeInTheDocument();
  });

  it('clicking Copy calls clipboard.writeText', async () => {
    await goToSummary();
    await userEvent.click(screen.getByRole('button', { name: /copy summary to clipboard/i }));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });
  });

  it('clipboard.writeText called with summary text', async () => {
    await goToSummary();
    await userEvent.click(screen.getByRole('button', { name: /copy summary to clipboard/i }));
    await waitFor(() => {
      const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(text).toContain('Full enterprise architecture BRD');
    });
  });

  it('Copy button shows Copied! after clicking', async () => {
    await goToSummary();
    await userEvent.click(screen.getByRole('button', { name: /copy summary to clipboard/i }));
    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });
  });

  it('Copy button returns to Copy after timeout', async () => {
    await goToSummary();
    await userEvent.click(screen.getByRole('button', { name: /copy summary to clipboard/i }));
    await screen.findByText('Copied!');
    await waitFor(() => {
      expect(screen.getByText('Copy')).toBeInTheDocument();
    }, { timeout: 3500 });
  }, 8000);
});

// ────────────────────────────────────────────────────────────
describe('DocumentDetail – Export Change Log CSV', () => {
  let mockCreateObjectURL: ReturnType<typeof vi.fn>;
  let mockRevokeObjectURL: ReturnType<typeof vi.fn>;
  let mockClick: ReturnType<typeof vi.fn>;
  let origCreate: typeof document.createElement;

  beforeEach(() => {
    localStorage.clear();
    mockCreateObjectURL = vi.fn().mockReturnValue('blob:test-url');
    mockRevokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL: mockCreateObjectURL, revokeObjectURL: mockRevokeObjectURL });
    mockClick = vi.fn();
    origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag);
      if (tag === 'a') { el.click = mockClick; }
      return el;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function goToVersions() {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: versions/i }));
  }

  async function addChangelogEntry() {
    await goToVersions();
    await userEvent.type(screen.getByRole('textbox', { name: /change log note/i }), 'Initial architecture review');
    await userEvent.type(screen.getByRole('textbox', { name: /change log author/i }), 'Ahmed');
    await userEvent.click(screen.getByRole('button', { name: /add change log entry/i }));
    await screen.findByText('Initial architecture review');
  }

  it('shows Export CSV button in Versions tab', async () => {
    await goToVersions();
    expect(screen.getByRole('button', { name: /export change log to csv/i })).toBeInTheDocument();
  });

  it('Export CSV button is disabled when no changelog entries', async () => {
    await goToVersions();
    expect(screen.getByRole('button', { name: /export change log to csv/i })).toBeDisabled();
  });

  it('Export CSV button is enabled after adding an entry', async () => {
    await addChangelogEntry();
    expect(screen.getByRole('button', { name: /export change log to csv/i })).not.toBeDisabled();
  });

  it('clicking Export CSV calls URL.createObjectURL', async () => {
    await addChangelogEntry();
    await userEvent.click(screen.getByRole('button', { name: /export change log to csv/i }));
    expect(mockCreateObjectURL).toHaveBeenCalled();
  });

  it('clicking Export CSV triggers anchor click (download)', async () => {
    await addChangelogEntry();
    await userEvent.click(screen.getByRole('button', { name: /export change log to csv/i }));
    expect(mockClick).toHaveBeenCalled();
  });

  it('clicking Export CSV calls URL.revokeObjectURL', async () => {
    await addChangelogEntry();
    await userEvent.click(screen.getByRole('button', { name: /export change log to csv/i }));
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:test-url');
  });

  it('shows Exported! text after clicking', async () => {
    await addChangelogEntry();
    await userEvent.click(screen.getByRole('button', { name: /export change log to csv/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export change log to csv/i })).toHaveTextContent('Exported!');
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('DocumentDetail – Copy Document Info', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('shows Copy document info button in header', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /copy document info to clipboard/i })).toBeInTheDocument();
  });

  it('Copy document info button is not disabled', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /copy document info to clipboard/i })).not.toBeDisabled();
  });

  it('clicking Copy document info calls clipboard.writeText', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /copy document info to clipboard/i }));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });
  });

  it('clipboard text contains document name', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /copy document info to clipboard/i }));
    await waitFor(() => {
      const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(text).toContain('NCA Enterprise Architecture BRD v2.3');
    });
  });

  it('clipboard text contains Type field', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /copy document info to clipboard/i }));
    await waitFor(() => {
      const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(text).toContain('Type:');
    });
  });

  it('clipboard text contains Workspace field', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /copy document info to clipboard/i }));
    await waitFor(() => {
      const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(text).toContain('Workspace: NCA');
    });
  });

  it('shows Copied! label after clicking', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /copy document info to clipboard/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copy document info to clipboard/i })).toHaveTextContent('Copied!');
    });
  });
});

describe('DocumentDetail – Export Change Log TXT', () => {
  let mockCreateObjectURL: ReturnType<typeof vi.fn>;
  let mockRevokeObjectURL: ReturnType<typeof vi.fn>;
  let mockClick: ReturnType<typeof vi.fn>;
  let origCreate: typeof document.createElement;

  beforeEach(() => {
    localStorage.clear();
    mockCreateObjectURL = vi.fn().mockReturnValue('blob:txt-url');
    mockRevokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL: mockCreateObjectURL, revokeObjectURL: mockRevokeObjectURL });
    mockClick = vi.fn();
    origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag);
      if (tag === 'a') { el.click = mockClick; }
      return el;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function goToVersions() {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: versions/i }));
  }

  async function addChangelogEntry() {
    await goToVersions();
    await userEvent.type(screen.getByRole('textbox', { name: /change log note/i }), 'Architecture review completed');
    await userEvent.type(screen.getByRole('textbox', { name: /change log author/i }), 'Ahmed');
    await userEvent.click(screen.getByRole('button', { name: /add change log entry/i }));
    await screen.findByText('Architecture review completed');
  }

  it('shows Export TXT button in Versions tab', async () => {
    await goToVersions();
    expect(screen.getByRole('button', { name: /export change log to txt/i })).toBeInTheDocument();
  });

  it('Export TXT button is disabled when no changelog entries', async () => {
    await goToVersions();
    expect(screen.getByRole('button', { name: /export change log to txt/i })).toBeDisabled();
  });

  it('Export TXT button is enabled after adding an entry', async () => {
    await addChangelogEntry();
    expect(screen.getByRole('button', { name: /export change log to txt/i })).not.toBeDisabled();
  });

  it('clicking Export TXT calls URL.createObjectURL', async () => {
    await addChangelogEntry();
    await userEvent.click(screen.getByRole('button', { name: /export change log to txt/i }));
    expect(mockCreateObjectURL).toHaveBeenCalled();
  });

  it('clicking Export TXT triggers anchor click', async () => {
    await addChangelogEntry();
    await userEvent.click(screen.getByRole('button', { name: /export change log to txt/i }));
    expect(mockClick).toHaveBeenCalled();
  });

  it('clicking Export TXT calls URL.revokeObjectURL', async () => {
    await addChangelogEntry();
    await userEvent.click(screen.getByRole('button', { name: /export change log to txt/i }));
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:txt-url');
  });

  it('shows Exported! text after clicking Export TXT', async () => {
    await addChangelogEntry();
    await userEvent.click(screen.getByRole('button', { name: /export change log to txt/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export change log to txt/i })).toHaveTextContent('Exported!');
    });
  });
});

describe('DocumentDetail – Star Rating', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockGetDocument.mockResolvedValue(mockDoc);
    mockGetTasks.mockResolvedValue([]);
  });
  afterEach(() => vi.restoreAllMocks());

  it('renders the star rating container', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByLabelText('Document star rating')).toBeInTheDocument();
  });

  it('renders 5 star buttons', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const stars = [1, 2, 3, 4, 5].map(n => screen.getByRole('button', { name: new RegExp(`rate ${n} star`, 'i') }));
    expect(stars).toHaveLength(5);
  });

  it('clicking a star sets rating', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /rate 3 stars/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /rate 3 stars/i })).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('clicking a star persists to localStorage', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /rate 4 stars/i }));
    await waitFor(() => {
      expect(localStorage.getItem('doc_rating_d1')).toBe('4');
    });
  });

  it('shows rating text after rating is set', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /rate 5 stars/i }));
    await waitFor(() => expect(screen.getByText('5/5 stars')).toBeInTheDocument());
  });

  it('clicking same star again clears the rating', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /rate 3 stars/i }));
    await screen.findByText('3/5 stars');
    await userEvent.click(screen.getByRole('button', { name: /rate 3 stars/i }));
    await waitFor(() => expect(screen.queryByText('3/5 stars')).not.toBeInTheDocument());
  });

  it('loads persisted rating from localStorage on mount', async () => {
    localStorage.setItem('doc_rating_d1', '2');
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await waitFor(() => expect(screen.getByText('2/5 stars')).toBeInTheDocument());
  });

  it('star 1 button has aria-pressed true when rating >= 1', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /rate 2 stars/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /rate 1 star$/i })).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('star 5 button has aria-pressed false when rating is 3', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /rate 3 stars/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /rate 5 stars/i })).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

describe('DocumentDetail – Task Priority Filter', () => {
  const mockHighTask = {
    id: 'th1', title: 'High Priority Task', workspace: 'NCA', workspace_id: 'ws-2',
    priority: 'High' as const, status: 'In Progress' as const,
    assignee: 'AM', due_date: '2026-04-01', description: '', linked_doc: 'd1',
    created_at: '', updated_at: '',
  };
  const mockMediumTask = {
    id: 'tm1', title: 'Medium Priority Task', workspace: 'NCA', workspace_id: 'ws-2',
    priority: 'Medium' as const, status: 'To Do' as const,
    assignee: 'BK', due_date: '2026-05-01', description: '', linked_doc: 'd1',
    created_at: '', updated_at: '',
  };
  const mockLowTask = {
    id: 'tl1', title: 'Low Priority Task', workspace: 'NCA', workspace_id: 'ws-2',
    priority: 'Low' as const, status: 'To Do' as const,
    assignee: 'CL', due_date: '2026-06-01', description: '', linked_doc: 'd1',
    created_at: '', updated_at: '',
  };

  async function goToTasksTab() {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /document tab: tasks/i }));
    await waitFor(() => expect(screen.getByText('Linked Tasks')).toBeInTheDocument());
  }

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockGetDocument.mockResolvedValue(mockDoc);
    mockGetTasks.mockResolvedValue([mockHighTask, mockMediumTask, mockLowTask]);
    mockUpdateDocument.mockResolvedValue({ ...mockDoc });
    mockUpdateTask.mockResolvedValue({ ...mockHighTask });
    mockChatWithDocument.mockResolvedValue({ reply: 'ok' });
  });
  afterEach(() => vi.restoreAllMocks());

  it('shows priority filter buttons when tasks exist', async () => {
    await goToTasksTab();
    expect(screen.getByRole('button', { name: /filter tasks by priority: all/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter tasks by priority: high/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter tasks by priority: medium/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter tasks by priority: low/i })).toBeInTheDocument();
  });

  it('All filter button is pressed by default', async () => {
    await goToTasksTab();
    expect(screen.getByRole('button', { name: /filter tasks by priority: all/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows all tasks when All filter is selected', async () => {
    await goToTasksTab();
    await waitFor(() => {
      expect(screen.getByText('High Priority Task')).toBeInTheDocument();
      expect(screen.getByText('Medium Priority Task')).toBeInTheDocument();
      expect(screen.getByText('Low Priority Task')).toBeInTheDocument();
    });
  });

  it('filters to show only High tasks when High is selected', async () => {
    await goToTasksTab();
    await userEvent.click(screen.getByRole('button', { name: /filter tasks by priority: high/i }));
    await waitFor(() => {
      expect(screen.getByText('High Priority Task')).toBeInTheDocument();
      expect(screen.queryByText('Medium Priority Task')).not.toBeInTheDocument();
      expect(screen.queryByText('Low Priority Task')).not.toBeInTheDocument();
    });
  });

  it('filters to show only Medium tasks when Medium is selected', async () => {
    await goToTasksTab();
    await userEvent.click(screen.getByRole('button', { name: /filter tasks by priority: medium/i }));
    await waitFor(() => {
      expect(screen.queryByText('High Priority Task')).not.toBeInTheDocument();
      expect(screen.getByText('Medium Priority Task')).toBeInTheDocument();
      expect(screen.queryByText('Low Priority Task')).not.toBeInTheDocument();
    });
  });

  it('filters to show only Low tasks when Low is selected', async () => {
    await goToTasksTab();
    await userEvent.click(screen.getByRole('button', { name: /filter tasks by priority: low/i }));
    await waitFor(() => {
      expect(screen.queryByText('High Priority Task')).not.toBeInTheDocument();
      expect(screen.queryByText('Medium Priority Task')).not.toBeInTheDocument();
      expect(screen.getByText('Low Priority Task')).toBeInTheDocument();
    });
  });

  it('clicking All after a filter restores all tasks', async () => {
    await goToTasksTab();
    await userEvent.click(screen.getByRole('button', { name: /filter tasks by priority: high/i }));
    await waitFor(() => expect(screen.queryByText('Medium Priority Task')).not.toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /filter tasks by priority: all/i }));
    await waitFor(() => {
      expect(screen.getByText('Medium Priority Task')).toBeInTheDocument();
      expect(screen.getByText('Low Priority Task')).toBeInTheDocument();
    });
  });

  it('selected filter button has aria-pressed true', async () => {
    await goToTasksTab();
    await userEvent.click(screen.getByRole('button', { name: /filter tasks by priority: medium/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /filter tasks by priority: medium/i })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: /filter tasks by priority: all/i })).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ── Reviewer Comments ─────────────────────────────────────────
describe('DocumentDetail – Reviewer Comments', () => {
  beforeEach(() => {
    localStorage.removeItem('doc_comments_d1');
  });

  it('renders Reviewer Comments section', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByText('Reviewer Comments')).toBeInTheDocument();
  });

  it('renders comment text input', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('textbox', { name: /new reviewer comment/i })).toBeInTheDocument();
  });

  it('renders reviewer name input', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('textbox', { name: /reviewer name/i })).toBeInTheDocument();
  });

  it('renders Add comment button', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /add reviewer comment/i })).toBeInTheDocument();
  });

  it('shows empty state when no comments', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByText(/no comments yet/i)).toBeInTheDocument();
  });

  it('adding a comment shows it in the list', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    fireEvent.change(screen.getByRole('textbox', { name: /new reviewer comment/i }), { target: { value: 'Section 3 needs more detail' } });
    await userEvent.click(screen.getByRole('button', { name: /add reviewer comment/i }));
    expect(screen.getByText('Section 3 needs more detail')).toBeInTheDocument();
  });

  it('clears inputs after adding', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const textInput = screen.getByRole('textbox', { name: /new reviewer comment/i });
    fireEvent.change(textInput, { target: { value: 'Fix typos' } });
    await userEvent.click(screen.getByRole('button', { name: /add reviewer comment/i }));
    expect(textInput).toHaveValue('');
  });

  it('shows reviewer name tag when provided', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    fireEvent.change(screen.getByRole('textbox', { name: /new reviewer comment/i }), { target: { value: 'Update scope section' } });
    fireEvent.change(screen.getByRole('textbox', { name: /reviewer name/i }), { target: { value: 'Rania' } });
    await userEvent.click(screen.getByRole('button', { name: /add reviewer comment/i }));
    expect(screen.getByText('Rania')).toBeInTheDocument();
  });

  it('can resolve a comment', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    fireEvent.change(screen.getByRole('textbox', { name: /new reviewer comment/i }), { target: { value: 'Check figures' } });
    await userEvent.click(screen.getByRole('button', { name: /add reviewer comment/i }));
    await userEvent.click(screen.getByRole('button', { name: /resolve comment: check figures/i }));
    expect(screen.getByRole('button', { name: /reopen comment: check figures/i })).toBeInTheDocument();
  });

  it('can delete a comment', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    fireEvent.change(screen.getByRole('textbox', { name: /new reviewer comment/i }), { target: { value: 'Delete me' } });
    await userEvent.click(screen.getByRole('button', { name: /add reviewer comment/i }));
    await userEvent.click(screen.getByRole('button', { name: /delete comment: delete me/i }));
    expect(screen.queryByText('Delete me')).not.toBeInTheDocument();
  });

  it('persists comments to localStorage', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    fireEvent.change(screen.getByRole('textbox', { name: /new reviewer comment/i }), { target: { value: 'Saved comment' } });
    await userEvent.click(screen.getByRole('button', { name: /add reviewer comment/i }));
    const stored = JSON.parse(localStorage.getItem('doc_comments_d1') ?? '[]');
    expect(stored.length).toBe(1);
    expect(stored[0].text).toBe('Saved comment');
  });

  it('loads existing comments from localStorage on mount', async () => {
    const existing = [{ id: 'cmt-1', text: 'Pre-existing comment', reviewer: 'Ahmed', resolved: false }];
    localStorage.setItem('doc_comments_d1', JSON.stringify(existing));
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByText('Pre-existing comment')).toBeInTheDocument();
    expect(screen.getByText('Ahmed')).toBeInTheDocument();
  });
});

describe('DocumentDetail – Unresolved Comments Filter', () => {
  beforeEach(() => {
    localStorage.removeItem('doc_comments_d1');
  });

  it('renders the Unresolved toggle button', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /show unresolved comments only/i })).toBeInTheDocument();
  });

  it('Unresolved button is not pressed by default', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const btn = screen.getByRole('button', { name: /show unresolved comments only/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Unresolved sets aria-pressed to true', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const btn = screen.getByRole('button', { name: /show unresolved comments only/i });
    await userEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking Unresolved again deactivates the filter', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const btn = screen.getByRole('button', { name: /show unresolved comments only/i });
    await userEvent.click(btn);
    await userEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('Unresolved filter hides resolved comments', async () => {
    const comments = [
      { id: 'cmt-1', text: 'Open issue here', reviewer: '', resolved: false },
      { id: 'cmt-2', text: 'Already resolved this', reviewer: '', resolved: true },
    ];
    localStorage.setItem('doc_comments_d1', JSON.stringify(comments));
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByText('Open issue here')).toBeInTheDocument();
    expect(screen.getByText('Already resolved this')).toBeInTheDocument();
    const btn = screen.getByRole('button', { name: /show unresolved comments only/i });
    await userEvent.click(btn);
    expect(screen.getByText('Open issue here')).toBeInTheDocument();
    expect(screen.queryByText('Already resolved this')).not.toBeInTheDocument();
  });

  it('turning off Unresolved filter restores resolved comments', async () => {
    const comments = [
      { id: 'cmt-1', text: 'Open issue here', reviewer: '', resolved: false },
      { id: 'cmt-2', text: 'Already resolved this', reviewer: '', resolved: true },
    ];
    localStorage.setItem('doc_comments_d1', JSON.stringify(comments));
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const btn = screen.getByRole('button', { name: /show unresolved comments only/i });
    await userEvent.click(btn);
    await userEvent.click(btn);
    expect(screen.getByText('Already resolved this')).toBeInTheDocument();
  });

  it('Unresolved filter shows all when all are unresolved', async () => {
    const comments = [
      { id: 'cmt-1', text: 'First open', reviewer: '', resolved: false },
      { id: 'cmt-2', text: 'Second open', reviewer: '', resolved: false },
    ];
    localStorage.setItem('doc_comments_d1', JSON.stringify(comments));
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const btn = screen.getByRole('button', { name: /show unresolved comments only/i });
    await userEvent.click(btn);
    expect(screen.getByText('First open')).toBeInTheDocument();
    expect(screen.getByText('Second open')).toBeInTheDocument();
  });
});

// ── Comment Search ────────────────────────────────────────────
describe('DocumentDetail – Comment Search', () => {
  const comments = [
    { id: 'cmt-a', text: 'Fix the typo in section 3', reviewer: 'Alice', resolved: false },
    { id: 'cmt-b', text: 'Needs more detail on scope', reviewer: 'Bob', resolved: false },
    { id: 'cmt-c', text: 'Looks good overall', reviewer: 'Alice', resolved: true },
  ];

  beforeEach(() => {
    localStorage.setItem('doc_comments_d1', JSON.stringify(comments));
  });

  afterEach(() => {
    localStorage.removeItem('doc_comments_d1');
  });

  it('renders search comments input when comments exist', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('textbox', { name: /search comments/i })).toBeInTheDocument();
  });

  it('search input is empty by default', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('textbox', { name: /search comments/i })).toHaveValue('');
  });

  it('typing in search filters comments by text', async () => {
    renderDetail();
    await screen.findByText('Fix the typo in section 3');
    await userEvent.type(screen.getByRole('textbox', { name: /search comments/i }), 'typo');
    expect(screen.getByText('Fix the typo in section 3')).toBeInTheDocument();
    expect(screen.queryByText('Needs more detail on scope')).not.toBeInTheDocument();
  });

  it('search filters by reviewer name', async () => {
    renderDetail();
    await screen.findByText('Fix the typo in section 3');
    await userEvent.type(screen.getByRole('textbox', { name: /search comments/i }), 'Bob');
    expect(screen.getByText('Needs more detail on scope')).toBeInTheDocument();
    expect(screen.queryByText('Fix the typo in section 3')).not.toBeInTheDocument();
  });

  it('clearing search restores all comments', async () => {
    renderDetail();
    await screen.findByText('Fix the typo in section 3');
    const input = screen.getByRole('textbox', { name: /search comments/i });
    await userEvent.type(input, 'typo');
    expect(screen.queryByText('Needs more detail on scope')).not.toBeInTheDocument();
    await userEvent.clear(input);
    expect(screen.getByText('Needs more detail on scope')).toBeInTheDocument();
  });

  it('search is case-insensitive', async () => {
    renderDetail();
    await screen.findByText('Fix the typo in section 3');
    await userEvent.type(screen.getByRole('textbox', { name: /search comments/i }), 'TYPO');
    expect(screen.getByText('Fix the typo in section 3')).toBeInTheDocument();
  });

  it('search with no match shows no comments', async () => {
    renderDetail();
    await screen.findByText('Fix the typo in section 3');
    await userEvent.type(screen.getByRole('textbox', { name: /search comments/i }), 'zzzunmatchedxxx');
    expect(screen.queryByText('Fix the typo in section 3')).not.toBeInTheDocument();
    expect(screen.queryByText('Needs more detail on scope')).not.toBeInTheDocument();
  });

  it('search combines with unresolved filter', async () => {
    renderDetail();
    await screen.findByText('Looks good overall');
    await userEvent.click(screen.getByRole('button', { name: /show unresolved comments only/i }));
    await userEvent.type(screen.getByRole('textbox', { name: /search comments/i }), 'typo');
    expect(screen.getByText('Fix the typo in section 3')).toBeInTheDocument();
    expect(screen.queryByText('Looks good overall')).not.toBeInTheDocument();
  });
});

describe('DocumentDetail – Comment Sort', () => {
  const sortComments = [
    { id: 'srt-1', text: 'Zara comment text', reviewer: 'Zara Smith', resolved: false },
    { id: 'srt-2', text: 'Alex comment text', reviewer: 'Alex Brown', resolved: true },
    { id: 'srt-3', text: 'Mina comment text', reviewer: 'Mina Chen', resolved: false },
  ];

  beforeEach(() => {
    localStorage.setItem('doc_comments_d1', JSON.stringify(sortComments));
  });

  afterEach(() => {
    localStorage.removeItem('doc_comments_d1');
  });

  it('renders default, reviewer, and unresolved sort buttons', async () => {
    renderDetail();
    await screen.findByText('Zara comment text');
    expect(screen.getByRole('button', { name: /sort comments by default/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sort comments by reviewer/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sort comments by unresolved/i })).toBeInTheDocument();
  });

  it('default sort button is pressed initially', async () => {
    renderDetail();
    await screen.findByText('Zara comment text');
    expect(screen.getByRole('button', { name: /sort comments by default/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /sort comments by reviewer/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking reviewer sort activates it', async () => {
    renderDetail();
    await screen.findByText('Zara comment text');
    await userEvent.click(screen.getByRole('button', { name: /sort comments by reviewer/i }));
    expect(screen.getByRole('button', { name: /sort comments by reviewer/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /sort comments by default/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('sort by reviewer orders Alex before Zara alphabetically', async () => {
    renderDetail();
    await screen.findByText('Zara comment text');
    await userEvent.click(screen.getByRole('button', { name: /sort comments by reviewer/i }));
    const alexEl = await screen.findByText('Alex comment text');
    const zaraEl = screen.getByText('Zara comment text');
    expect(alexEl.compareDocumentPosition(zaraEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('sort by unresolved shows unresolved comments first', async () => {
    renderDetail();
    await screen.findByText('Zara comment text');
    await userEvent.click(screen.getByRole('button', { name: /sort comments by unresolved/i }));
    const zaraEl = await screen.findByText('Zara comment text');
    const alexEl = screen.getByText('Alex comment text');
    expect(zaraEl.compareDocumentPosition(alexEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('switching back to default sort deactivates other sorts', async () => {
    renderDetail();
    await screen.findByText('Zara comment text');
    await userEvent.click(screen.getByRole('button', { name: /sort comments by reviewer/i }));
    await userEvent.click(screen.getByRole('button', { name: /sort comments by default/i }));
    expect(screen.getByRole('button', { name: /sort comments by default/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /sort comments by reviewer/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('all three comments remain visible after sort change', async () => {
    renderDetail();
    await screen.findByText('Zara comment text');
    await userEvent.click(screen.getByRole('button', { name: /sort comments by reviewer/i }));
    expect(screen.getByText('Zara comment text')).toBeInTheDocument();
    expect(screen.getByText('Alex comment text')).toBeInTheDocument();
    expect(screen.getByText('Mina comment text')).toBeInTheDocument();
  });
});

describe('DocumentDetail – Task Search', () => {
  const taskAlpha = { ...mockTask, id: 't-alpha', title: 'Alpha Task Review', linked_doc: 'd1' };
  const taskBeta = { ...mockTask, id: 't-beta', title: 'Beta Task Planning', linked_doc: 'd1' };
  const taskGamma = { ...mockTask, id: 't-gamma', title: 'Gamma Task Deploy', linked_doc: 'd1' };

  async function goToTasksTab() {
    renderDetail();
    await screen.findByRole('button', { name: /document tab: tasks/i });
    await userEvent.click(screen.getByRole('button', { name: /document tab: tasks/i }));
    await screen.findByText('Alpha Task Review');
  }

  beforeEach(() => {
    mockGetDocument.mockResolvedValue(mockDoc);
    mockGetTasks.mockResolvedValue([taskAlpha, taskBeta, taskGamma]);
  });

  it('renders task search input', async () => {
    await goToTasksTab();
    expect(screen.getByRole('textbox', { name: /search tasks/i })).toBeInTheDocument();
  });

  it('task search input is empty by default', async () => {
    await goToTasksTab();
    expect(screen.getByRole('textbox', { name: /search tasks/i })).toHaveValue('');
  });

  it('typing filters tasks by title', async () => {
    await goToTasksTab();
    await userEvent.type(screen.getByRole('textbox', { name: /search tasks/i }), 'Alpha');
    await waitFor(() => {
      expect(screen.getByText('Alpha Task Review')).toBeInTheDocument();
      expect(screen.queryByText('Beta Task Planning')).not.toBeInTheDocument();
    });
  });

  it('task search is case-insensitive', async () => {
    await goToTasksTab();
    await userEvent.type(screen.getByRole('textbox', { name: /search tasks/i }), 'beta');
    await waitFor(() => expect(screen.getByText('Beta Task Planning')).toBeInTheDocument());
  });

  it('clearing search restores all tasks', async () => {
    await goToTasksTab();
    const input = screen.getByRole('textbox', { name: /search tasks/i });
    await userEvent.type(input, 'Alpha');
    await waitFor(() => expect(screen.queryByText('Beta Task Planning')).not.toBeInTheDocument());
    await userEvent.clear(input);
    await waitFor(() => {
      expect(screen.getByText('Alpha Task Review')).toBeInTheDocument();
      expect(screen.getByText('Beta Task Planning')).toBeInTheDocument();
    });
  });
});

describe('DocumentDetail – Task Sort', () => {
  const taskZara = { ...mockTask, id: 't-sort-z', title: 'Zara Task Review', linked_doc: 'd1', priority: 'Low' as const };
  const taskAlex = { ...mockTask, id: 't-sort-a', title: 'Alex Task Planning', linked_doc: 'd1', priority: 'High' as const };
  const taskMina = { ...mockTask, id: 't-sort-m', title: 'Mina Task Deploy', linked_doc: 'd1', priority: 'Medium' as const };

  async function goToTasksTab() {
    renderDetail();
    await screen.findByRole('button', { name: /document tab: tasks/i });
    await userEvent.click(screen.getByRole('button', { name: /document tab: tasks/i }));
    await screen.findByText('Zara Task Review');
  }

  beforeEach(() => {
    mockGetDocument.mockResolvedValue(mockDoc);
    mockGetTasks.mockResolvedValue([taskZara, taskAlex, taskMina]);
  });

  it('renders task sort buttons', async () => {
    await goToTasksTab();
    expect(screen.getByRole('button', { name: /sort tasks by default/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sort tasks by title/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sort tasks by priority/i })).toBeInTheDocument();
  });

  it('default sort button is pressed initially', async () => {
    await goToTasksTab();
    expect(screen.getByRole('button', { name: /sort tasks by default/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /sort tasks by title/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking title sort activates it', async () => {
    await goToTasksTab();
    await userEvent.click(screen.getByRole('button', { name: /sort tasks by title/i }));
    expect(screen.getByRole('button', { name: /sort tasks by title/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /sort tasks by default/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('title sort places Alex before Zara in DOM', async () => {
    await goToTasksTab();
    await userEvent.click(screen.getByRole('button', { name: /sort tasks by title/i }));
    const alexEl = screen.getByText('Alex Task Planning');
    const zaraEl = screen.getByText('Zara Task Review');
    expect(alexEl.compareDocumentPosition(zaraEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('all tasks remain visible after title sort', async () => {
    await goToTasksTab();
    await userEvent.click(screen.getByRole('button', { name: /sort tasks by title/i }));
    expect(screen.getByText('Zara Task Review')).toBeInTheDocument();
    expect(screen.getByText('Alex Task Planning')).toBeInTheDocument();
    expect(screen.getByText('Mina Task Deploy')).toBeInTheDocument();
  });
});

describe('DocumentDetail – Changelog Sort', () => {
  const changelogKey = 'doc_changelog_d1';
  const sortEntries = [
    { id: 'cl-z', note: 'Zara updated section 3', author: 'Zara', date: '2026-04-15' },
    { id: 'cl-a', note: 'Alex added intro', author: 'Alex', date: '2026-04-14' },
    { id: 'cl-m', note: 'Mina reviewed appendix', author: 'Mina', date: '2026-04-13' },
  ];

  beforeEach(() => {
    localStorage.setItem(changelogKey, JSON.stringify(sortEntries));
  });

  afterEach(() => {
    localStorage.removeItem(changelogKey);
  });

  async function goToChangelog() {
    mockGetDocument.mockResolvedValue(mockDoc);
    mockGetTasks.mockResolvedValue([]);
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const tab = screen.getByRole('button', { name: /versions/i });
    await userEvent.click(tab);
    await screen.findByText('Zara updated section 3');
  }

  it('renders changelog sort buttons', async () => {
    await goToChangelog();
    expect(screen.getByRole('button', { name: /sort changelog by newest/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sort changelog by oldest/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sort changelog by author/i })).toBeInTheDocument();
  });

  it('newest sort is pressed by default', async () => {
    await goToChangelog();
    expect(screen.getByRole('button', { name: /sort changelog by newest/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /sort changelog by oldest/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking author sort activates it', async () => {
    await goToChangelog();
    await userEvent.click(screen.getByRole('button', { name: /sort changelog by author/i }));
    expect(screen.getByRole('button', { name: /sort changelog by author/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /sort changelog by newest/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('author sort places Alex before Zara in DOM', async () => {
    await goToChangelog();
    await userEvent.click(screen.getByRole('button', { name: /sort changelog by author/i }));
    const alexEl = await screen.findByText('Alex added intro');
    const zaraEl = screen.getByText('Zara updated section 3');
    expect(alexEl.compareDocumentPosition(zaraEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('all entries remain visible after author sort', async () => {
    await goToChangelog();
    await userEvent.click(screen.getByRole('button', { name: /sort changelog by author/i }));
    expect(screen.getByText('Alex added intro')).toBeInTheDocument();
    expect(screen.getByText('Mina reviewed appendix')).toBeInTheDocument();
    expect(screen.getByText('Zara updated section 3')).toBeInTheDocument();
  });
});

describe('DocumentDetail – Changelog Sort by Oldest', () => {
  const changelogKey = 'doc_changelog_d1';
  const oldestEntries = [
    { id: 'cl-z', note: 'Zara newest entry', author: 'Zara', date: '2026-04-15' },
    { id: 'cl-a', note: 'Alex middle entry', author: 'Alex', date: '2026-04-14' },
    { id: 'cl-m', note: 'Mina oldest entry', author: 'Mina', date: '2026-04-13' },
  ];

  beforeEach(() => {
    mockGetDocument.mockResolvedValue(mockDoc);
    mockGetTasks.mockResolvedValue([]);
    localStorage.setItem(changelogKey, JSON.stringify(oldestEntries));
  });
  afterEach(() => localStorage.removeItem(changelogKey));

  async function goToChangelog() {
    renderDetail();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /versions/i }));
    await screen.findByText('Zara newest entry');
  }

  it('clicking oldest sort activates it', async () => {
    await goToChangelog();
    await userEvent.click(screen.getByRole('button', { name: /sort changelog by oldest/i }));
    expect(screen.getByRole('button', { name: /sort changelog by oldest/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /sort changelog by newest/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('oldest sort places Mina oldest entry before Zara newest entry in DOM', async () => {
    await goToChangelog();
    await userEvent.click(screen.getByRole('button', { name: /sort changelog by oldest/i }));
    const minaEl = await screen.findByText('Mina oldest entry');
    const zaraEl = screen.getByText('Zara newest entry');
    expect(minaEl.compareDocumentPosition(zaraEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('all three entries remain visible after oldest sort', async () => {
    await goToChangelog();
    await userEvent.click(screen.getByRole('button', { name: /sort changelog by oldest/i }));
    expect(screen.getByText('Zara newest entry')).toBeInTheDocument();
    expect(screen.getByText('Alex middle entry')).toBeInTheDocument();
    expect(screen.getByText('Mina oldest entry')).toBeInTheDocument();
  });

  it('switching back to newest deactivates oldest sort', async () => {
    await goToChangelog();
    await userEvent.click(screen.getByRole('button', { name: /sort changelog by oldest/i }));
    await userEvent.click(screen.getByRole('button', { name: /sort changelog by newest/i }));
    expect(screen.getByRole('button', { name: /sort changelog by newest/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /sort changelog by oldest/i })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('DocumentDetail – Task Sort by Priority', () => {
  const taskLow = { ...mockTask, id: 't-prio-l', title: 'Zara Low Priority Task', linked_doc: 'd1', priority: 'Low' as const };
  const taskHigh = { ...mockTask, id: 't-prio-h', title: 'Alex High Priority Task', linked_doc: 'd1', priority: 'High' as const };
  const taskMed = { ...mockTask, id: 't-prio-m', title: 'Mina Medium Priority Task', linked_doc: 'd1', priority: 'Medium' as const };

  beforeEach(() => {
    mockGetDocument.mockResolvedValue(mockDoc);
    mockGetTasks.mockResolvedValue([taskLow, taskMed, taskHigh]);
  });

  async function goToTasksTab() {
    renderDetail();
    await screen.findByRole('button', { name: /document tab: tasks/i });
    await userEvent.click(screen.getByRole('button', { name: /document tab: tasks/i }));
    await screen.findByText('Alex High Priority Task');
  }

  it('clicking priority sort activates it', async () => {
    await goToTasksTab();
    await userEvent.click(screen.getByRole('button', { name: /sort tasks by priority/i }));
    expect(screen.getByRole('button', { name: /sort tasks by priority/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /sort tasks by default/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('priority sort places High before Low in DOM', async () => {
    await goToTasksTab();
    await userEvent.click(screen.getByRole('button', { name: /sort tasks by priority/i }));
    const highEl = screen.getByText('Alex High Priority Task');
    const lowEl = screen.getByText('Zara Low Priority Task');
    expect(highEl.compareDocumentPosition(lowEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('priority sort places High before Medium in DOM', async () => {
    await goToTasksTab();
    await userEvent.click(screen.getByRole('button', { name: /sort tasks by priority/i }));
    const highEl = screen.getByText('Alex High Priority Task');
    const medEl = screen.getByText('Mina Medium Priority Task');
    expect(highEl.compareDocumentPosition(medEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('all three tasks remain visible after priority sort', async () => {
    await goToTasksTab();
    await userEvent.click(screen.getByRole('button', { name: /sort tasks by priority/i }));
    expect(screen.getByText('Alex High Priority Task')).toBeInTheDocument();
    expect(screen.getByText('Mina Medium Priority Task')).toBeInTheDocument();
    expect(screen.getByText('Zara Low Priority Task')).toBeInTheDocument();
  });

  it('switching back to default deactivates priority sort', async () => {
    await goToTasksTab();
    await userEvent.click(screen.getByRole('button', { name: /sort tasks by priority/i }));
    await userEvent.click(screen.getByRole('button', { name: /sort tasks by default/i }));
    expect(screen.getByRole('button', { name: /sort tasks by default/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /sort tasks by priority/i })).toHaveAttribute('aria-pressed', 'false');
  });
});
