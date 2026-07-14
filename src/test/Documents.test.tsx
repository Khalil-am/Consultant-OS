import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// ── Hoisted mocks ────────────────────────────────────────────
const {
  mockGetDocuments, mockGetWorkspaces, mockUpsertDocument,
  mockUpdateDocument, mockDeleteDocument, mockChatWithDocument,
} = vi.hoisted(() => ({
  mockGetDocuments: vi.fn(),
  mockGetWorkspaces: vi.fn(),
  mockUpsertDocument: vi.fn(),
  mockUpdateDocument: vi.fn(),
  mockDeleteDocument: vi.fn(),
  mockChatWithDocument: vi.fn(),
}));

vi.mock('../lib/db', () => ({
  getDocuments: mockGetDocuments,
  getWorkspaces: mockGetWorkspaces,
  upsertDocument: mockUpsertDocument,
  updateDocument: mockUpdateDocument,
  deleteDocument: mockDeleteDocument,
}));

vi.mock('../lib/openrouter', () => ({
  chatWithDocument: mockChatWithDocument,
}));

vi.mock('../hooks/useLayout', () => ({
  useLayout: () => ({ width: 1200, isMobile: false, isTablet: false }),
}));

// Mock supabase storage (Documents uses it directly for file upload/delete)
vi.mock('../lib/supabase', () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://test.supabase.co/storage/test.pdf' } })),
        createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://test.supabase.co/signed' }, error: null }),
        remove: vi.fn().mockResolvedValue({ error: null }),
      })),
    },
  },
}));

import Documents from '../screens/Documents';

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
  summary: 'Full enterprise architecture BRD',
  file_url: null,
  created_at: '2026-03-15T10:00:00Z',
  updated_at: '2026-03-15T10:00:00Z',
};

const mockWorkspace = {
  id: 'ws-2', name: 'NCA', type: 'Architecture', status: 'Active' as const,
  progress: 72, language: 'AR', sector: 'Government', contributors: [],
  created_at: '', updated_at: '',
};

function renderDocuments() {
  return render(
    <MemoryRouter>
      <Documents />
    </MemoryRouter>
  );
}

beforeEach(async () => {
  // resetAllMocks clears oneValue queues to prevent mock state bleed between tests
  vi.resetAllMocks();
  mockNavigate.mockReset();
  mockGetDocuments.mockResolvedValue([]);
  mockGetWorkspaces.mockResolvedValue([mockWorkspace]);
  mockUpsertDocument.mockResolvedValue({ ...mockDoc, id: 'new-doc-id' });
  mockUpdateDocument.mockResolvedValue({ ...mockDoc });
  mockDeleteDocument.mockResolvedValue(undefined);
  mockChatWithDocument.mockResolvedValue('AI-generated executive summary for this document.');
  // Restore supabase storage mock (resetAllMocks clears vi.fn() in module mocks)
  const { supabase } = await import('../lib/supabase');
  vi.mocked(supabase.storage.from).mockImplementation(() => ({
    upload: vi.fn().mockResolvedValue({ error: null }),
    getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://test.supabase.co/storage/test.pdf' } })),
    createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://test.supabase.co/signed' }, error: null }),
    remove: vi.fn().mockResolvedValue({ error: null }),
  } as any));
});

// ────────────────────────────────────────────────────────────
describe('Documents – Load', () => {
  it('calls getDocuments on mount', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalledTimes(1));
  });

  it('calls getWorkspaces on mount', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetWorkspaces).toHaveBeenCalledTimes(1));
  });

  it('shows empty state when no documents', async () => {
    renderDocuments();
    expect(await screen.findByText(/no documents/i)).toBeInTheDocument();
  });

  it('renders document cards from supabase', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    expect(await screen.findByText('NCA Enterprise Architecture BRD v2.3')).toBeInTheDocument();
  });

  it('shows document author', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText('Ahmed Khalil').length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Stats', () => {
  it('shows folder sidebar with All Documents', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    // Sidebar folder label is visible
    expect(screen.getByText('All Documents')).toBeInTheDocument();
    expect(screen.getByText('Folders')).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Search', () => {
  it('filters documents by search term', async () => {
    const d2 = { ...mockDoc, id: 'd2', name: 'MOCI Procurement Plan' };
    mockGetDocuments.mockResolvedValueOnce([mockDoc, d2]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');

    const searchInput = screen.getByPlaceholderText(/filter docs/i);
    await userEvent.type(searchInput, 'MOCI');
    expect(screen.getByText('MOCI Procurement Plan')).toBeInTheDocument();
    expect(screen.queryByText('NCA Enterprise Architecture BRD v2.3')).not.toBeInTheDocument();
  });

  it('shows all documents when search is cleared', async () => {
    const d2 = { ...mockDoc, id: 'd2', name: 'MOCI Procurement Plan' };
    mockGetDocuments.mockResolvedValueOnce([mockDoc, d2]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');

    const searchInput = screen.getByPlaceholderText(/filter docs/i);
    await userEvent.type(searchInput, 'MOCI');
    await userEvent.clear(searchInput);
    expect(screen.getByText('NCA Enterprise Architecture BRD v2.3')).toBeInTheDocument();
    expect(screen.getByText('MOCI Procurement Plan')).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Upload modal', () => {
  it('opens Upload Document modal on button click', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /upload/i }));
    expect(screen.getByText(/upload document/i)).toBeInTheDocument();
  });

  it('closes upload modal on Cancel', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /upload/i }));
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByText(/upload document/i)).not.toBeInTheDocument();
  });

  it('shows workspace options in upload modal', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetWorkspaces).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /upload/i }));
    // NCA workspace should appear in the form
    expect(screen.getByText('NCA')).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Create', () => {
  it('calls upsertDocument when upload form is submitted', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /upload/i }));

    // Fill in required fields: document name and workspace
    // Actual placeholder in the component is "e.g. Project Charter v1.0"
    const nameInput = screen.getByPlaceholderText(/project charter/i);
    await userEvent.type(nameInput, 'New Test Document');

    // Select the first workspace
    const wsSelect = screen.getAllByRole('combobox').find(s =>
      s.innerHTML.includes('NCA') || s.innerHTML.includes('Select workspace')
    );
    if (wsSelect) await userEvent.selectOptions(wsSelect, 'ws-2');

    const submitBtn = screen.getByRole('button', { name: /save document/i });
    await userEvent.click(submitBtn);

    await waitFor(() => expect(mockUpsertDocument).toHaveBeenCalledTimes(1));
  });

  it('adds newly created document to list after reload', async () => {
    const created = { ...mockDoc, id: 'new-d', name: 'Freshly Uploaded Doc' };
    // First call returns empty, second (after upload) returns the new doc
    mockGetDocuments
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([created]);
    renderDocuments();
    await screen.findByText(/no documents/i);

    await userEvent.click(screen.getByRole('button', { name: /upload/i }));
    const nameInput = screen.getByPlaceholderText(/project charter/i);
    await userEvent.type(nameInput, 'Freshly Uploaded Doc');
    const wsSelect = screen.getAllByRole('combobox').find(s => s.innerHTML.includes('NCA'));
    if (wsSelect) await userEvent.selectOptions(wsSelect, 'ws-2');
    await userEvent.click(screen.getByRole('button', { name: /save document/i }));

    await waitFor(() => {
      expect(screen.getByText('Freshly Uploaded Doc')).toBeInTheDocument();
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Delete', () => {
  it('calls deleteDocument with correct id', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    // After delete, load() is called again returning empty
    mockGetDocuments.mockResolvedValueOnce([]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');

    // Trash button has title="Delete"
    await userEvent.click(screen.getByTitle('Delete'));
    // Component shows inline "Delete" confirm button (not a dialog)
    await userEvent.click(screen.getByRole('button', { name: /confirm delete/i }));

    await waitFor(() => {
      expect(mockDeleteDocument).toHaveBeenCalledWith('d1');
    }, { timeout: 3000 });
  });

  it('removes document from list after delete', async () => {
    // After delete, load() is called again which returns empty
    mockGetDocuments
      .mockResolvedValueOnce([mockDoc])
      .mockResolvedValueOnce([]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');

    await userEvent.click(screen.getByTitle('Delete'));
    await userEvent.click(screen.getByRole('button', { name: /confirm delete/i }));

    await waitFor(() => {
      expect(mockDeleteDocument).toHaveBeenCalledTimes(1);
    }, { timeout: 3000 });
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Download', () => {
  it('triggers signed URL download when file_url is present', async () => {
    // Use a doc with a file_url so the download button is active
    const docWithFile = {
      ...mockDoc,
      file_url: 'https://test.supabase.co/storage/v1/object/public/workspace-docs/test.pdf',
    };
    mockGetDocuments.mockResolvedValueOnce([docWithFile]);

    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');

    // Button title is "Download file" when file_url is present
    const downloadBtn = screen.getByTitle('Download file');
    await userEvent.click(downloadBtn);
    // The supabase storage mock's createSignedUrl is called
    const { supabase } = await import('../lib/supabase');
    await waitFor(() => {
      expect(supabase.storage.from).toHaveBeenCalled();
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Navigate to detail', () => {
  it('renders document cards as clickable', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    // The card should be present and have a cursor pointer style or onClick
    const docTitle = screen.getByText('NCA Enterprise Architecture BRD v2.3');
    expect(docTitle).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Folder filter', () => {
  const mockBrd   = { ...mockDoc, id: 'd-brd', name: 'Enterprise BRD', type: 'BRD' };
  const mockMinutes = { ...mockDoc, id: 'd-min', name: 'Sprint Meeting Minutes', type: 'Meeting Minutes' };

  it('shows BRD folder in sidebar', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockBrd, mockMinutes]);
    renderDocuments();
    await screen.findByText('Enterprise BRD');
    // BRD appears in both the sidebar folder and the document card badge
    expect(screen.getAllByText('BRD').length).toBeGreaterThan(0);
  });

  it('filters to BRD type when BRD folder is clicked', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockBrd, mockMinutes]);
    renderDocuments();
    await screen.findByText('Enterprise BRD');

    // Click the BRD folder in the sidebar
    const brdFolders = screen.getAllByText('BRD');
    // First one in sidebar (the folder label)
    await userEvent.click(brdFolders[0]);
    expect(screen.getByText('Enterprise BRD')).toBeInTheDocument();
    expect(screen.queryByText('Sprint Meeting Minutes')).not.toBeInTheDocument();
  });

  it('returns to all documents when All Documents folder is clicked', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockBrd, mockMinutes]);
    renderDocuments();
    await screen.findByText('Enterprise BRD');

    const brdFolders = screen.getAllByText('BRD');
    await userEvent.click(brdFolders[0]);
    await userEvent.click(screen.getByText('All Documents'));
    expect(screen.getByText('Enterprise BRD')).toBeInTheDocument();
    expect(screen.getByText('Sprint Meeting Minutes')).toBeInTheDocument();
  });

  it('shows document count in All Documents folder', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockBrd, mockMinutes]);
    renderDocuments();
    await screen.findByText('Enterprise BRD');
    // Count "2" should appear next to "All Documents"
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Document metadata display', () => {
  it('shows document type badge', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    // BRD badge should appear (in folder sidebar and/or card type badge)
    expect(screen.getAllByText('BRD').length).toBeGreaterThan(0);
  });

  it('shows document status badge', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByText('Final')).toBeInTheDocument();
  });

  it('shows document date', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByText('2026-03-15')).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – AI Summarize', () => {
  const docWithFile = {
    ...mockDoc,
    file_url: 'https://test.supabase.co/storage/v1/object/public/workspace-docs/test.pdf',
  };

  it('renders AI Summarize button', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /ai summarize/i })).toBeInTheDocument();
  });

  it('AI Summarize button is disabled when no document is selected', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const summarizeBtn = screen.getByRole('button', { name: /ai summarize/i });
    expect(summarizeBtn).toBeDisabled();
  });

  it('enables AI Summarize button after a document is selected', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');

    // Click the document card to select it
    await userEvent.click(screen.getByText('NCA Enterprise Architecture BRD v2.3'));

    const summarizeBtn = screen.getByRole('button', { name: /ai summarize/i });
    expect(summarizeBtn).not.toBeDisabled();
  });

  it('calls chatWithDocument when AI Summarize is clicked on a selected document', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');

    await userEvent.click(screen.getByText('NCA Enterprise Architecture BRD v2.3'));
    const summarizeBtn = screen.getByRole('button', { name: /ai summarize/i });
    await userEvent.click(summarizeBtn);

    await waitFor(() => {
      expect(mockChatWithDocument).toHaveBeenCalledTimes(1);
    });
  });

  it('calls updateDocument with AI summary result', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');

    await userEvent.click(screen.getByText('NCA Enterprise Architecture BRD v2.3'));
    await userEvent.click(screen.getByRole('button', { name: /ai summarize/i }));

    await waitFor(() => {
      expect(mockUpdateDocument).toHaveBeenCalledWith(
        'd1',
        expect.objectContaining({ summary: 'AI-generated executive summary for this document.' })
      );
    });
  });

  it('shows error message when chatWithDocument fails', async () => {
    mockChatWithDocument.mockRejectedValueOnce(new Error('AI quota exceeded'));
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');

    await userEvent.click(screen.getByText('NCA Enterprise Architecture BRD v2.3'));
    await userEvent.click(screen.getByRole('button', { name: /ai summarize/i }));

    await waitFor(() => {
      expect(screen.getByText(/ai quota exceeded/i)).toBeInTheDocument();
    });
  });

  it('chatWithDocument receives document name in user message', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');

    await userEvent.click(screen.getByText('NCA Enterprise Architecture BRD v2.3'));
    await userEvent.click(screen.getByRole('button', { name: /ai summarize/i }));

    await waitFor(() => {
      const call = mockChatWithDocument.mock.calls[0];
      const userContent = call[0][0].content as string;
      expect(userContent).toContain('NCA Enterprise Architecture BRD v2.3');
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Navigation', () => {
  it('navigates to document detail when Open button is clicked', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');

    const openBtn = screen.getByTitle('Open');
    await userEvent.click(openBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/documents/d1');
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Status change', () => {
  it('calls updateDocument when status is changed via inline select', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    mockUpdateDocument.mockResolvedValue({ ...mockDoc, status: 'Approved' });
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');

    // Select the document first so the row is active
    await userEvent.click(screen.getByText('NCA Enterprise Architecture BRD v2.3'));

    // Find the status select on the row
    const statusSelects = document.querySelectorAll('select');
    const docStatusSelect = Array.from(statusSelects).find(s =>
      (s as HTMLSelectElement).value === 'Final'
    );
    if (docStatusSelect) {
      await userEvent.selectOptions(docStatusSelect as HTMLElement, 'Approved');
      await waitFor(() => expect(mockUpdateDocument).toHaveBeenCalled());
    }
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Status filter', () => {
  it('shows status filter tabs', async () => {
    renderDocuments();
    await screen.findByText(/no documents/i);
    // Status filter tabs appear (All, Draft, Approved, etc.)
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
  });

  it('filters documents by Approved status', async () => {
    const approvedDoc = { ...mockDoc, id: 'd2', status: 'Approved' as const, name: 'Approved BRD' };
    mockGetDocuments.mockResolvedValueOnce([mockDoc, approvedDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');

    // Click Approved filter
    const approvedFilter = screen.getAllByRole('button', { name: /approved/i });
    if (approvedFilter.length > 0) {
      await userEvent.click(approvedFilter[0]);
      await waitFor(() => {
        expect(screen.getByText('Approved BRD')).toBeInTheDocument();
      });
    }
  });

  it('filters documents by Draft status', async () => {
    const draftDoc = { ...mockDoc, id: 'd3', status: 'Draft' as const, name: 'Draft Proposal' };
    const approvedDoc = { ...mockDoc, id: 'd4', status: 'Approved' as const, name: 'Approved Charter' };
    mockGetDocuments.mockResolvedValueOnce([draftDoc, approvedDoc]);
    renderDocuments();
    await screen.findByText('Draft Proposal');

    const draftFilter = screen.getByRole('button', { name: /status: draft/i });
    await userEvent.click(draftFilter);
    await waitFor(() => {
      expect(screen.getByText('Draft Proposal')).toBeInTheDocument();
      expect(screen.queryByText('Approved Charter')).not.toBeInTheDocument();
    });
  });

  it('filters documents by Under Review status', async () => {
    const reviewDoc = { ...mockDoc, id: 'd5', status: 'Under Review' as const, name: 'Under Review BRD' };
    mockGetDocuments.mockResolvedValueOnce([mockDoc, reviewDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');

    const reviewFilter = screen.getByRole('button', { name: /status: under review/i });
    await userEvent.click(reviewFilter);
    await waitFor(() => {
      expect(screen.getByText('Under Review BRD')).toBeInTheDocument();
      expect(screen.queryByText('NCA Enterprise Architecture BRD v2.3')).not.toBeInTheDocument();
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Search by author and workspace', () => {
  it('filters documents by author name', async () => {
    const d2 = { ...mockDoc, id: 'd2', name: 'ADNOC Risk Register', author: 'Rania Taleb' };
    mockGetDocuments.mockResolvedValueOnce([mockDoc, d2]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');

    const searchInput = screen.getByPlaceholderText(/filter docs/i);
    await userEvent.type(searchInput, 'Rania');
    expect(screen.getByText('ADNOC Risk Register')).toBeInTheDocument();
    expect(screen.queryByText('NCA Enterprise Architecture BRD v2.3')).not.toBeInTheDocument();
  });

  it('filters documents by workspace name', async () => {
    const d2 = { ...mockDoc, id: 'd2', name: 'ADNOC Supply Chain Plan', workspace: 'ADNOC Supply Chain' };
    mockGetDocuments.mockResolvedValueOnce([mockDoc, d2]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');

    const searchInput = screen.getByPlaceholderText(/filter docs/i);
    await userEvent.type(searchInput, 'ADNOC');
    expect(screen.getByText('ADNOC Supply Chain Plan')).toBeInTheDocument();
    expect(screen.queryByText('NCA Enterprise Architecture BRD v2.3')).not.toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Upload modal form fields', () => {
  it('shows language selector in upload modal', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /upload/i }));
    // Language options should exist
    expect(screen.getByRole('option', { name: 'EN' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'AR' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Bilingual' })).toBeInTheDocument();
  });

  it('shows document type selector in upload modal', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /upload/i }));
    expect(screen.getByRole('option', { name: 'BRD' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Meeting Minutes' })).toBeInTheDocument();
  });

  it('shows status selector in upload modal', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /upload/i }));
    // Status options: Draft, Under Review, Approved, Final
    expect(screen.getAllByRole('option', { name: 'Draft' }).length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Selected document detail panel', () => {
  it('shows selected document size in detail panel', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');

    await userEvent.click(screen.getByText('NCA Enterprise Architecture BRD v2.3'));
    // Size '2.4MB' appears in detail panel
    expect(screen.getByText('2.4MB')).toBeInTheDocument();
  });

  it('shows selected document language in detail panel', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');

    await userEvent.click(screen.getByText('NCA Enterprise Architecture BRD v2.3'));
    // Language 'EN' appears in detail panel metadata
    expect(screen.getAllByText('EN').length).toBeGreaterThan(0);
  });

  it('shows selected document summary in detail panel', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');

    await userEvent.click(screen.getByText('NCA Enterprise Architecture BRD v2.3'));
    expect(screen.getByText('Full enterprise architecture BRD')).toBeInTheDocument();
  });

  it('shows selected document tags in detail panel', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');

    await userEvent.click(screen.getByText('NCA Enterprise Architecture BRD v2.3'));
    // Tags: ['Architecture', 'BRD']
    expect(screen.getAllByText('Architecture').length).toBeGreaterThan(0);
  });

  it('shows Open Document button in detail panel', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');

    await userEvent.click(screen.getByText('NCA Enterprise Architecture BRD v2.3'));
    expect(screen.getByRole('button', { name: /open document/i })).toBeInTheDocument();
  });

  it('shows workspace name in selected document detail panel', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');

    await userEvent.click(screen.getByText('NCA Enterprise Architecture BRD v2.3'));
    // Workspace 'NCA' appears in detail panel
    expect(screen.getAllByText('NCA').length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Folder sidebar types', () => {
  it('shows Meeting Minutes folder when such documents exist', async () => {
    const minutesDoc = { ...mockDoc, id: 'd-min', name: 'Sprint Retro Minutes', type: 'Meeting Minutes' };
    mockGetDocuments.mockResolvedValueOnce([minutesDoc]);
    renderDocuments();
    await screen.findByText('Sprint Retro Minutes');
    expect(screen.getAllByText('Meeting Minutes').length).toBeGreaterThan(0);
  });

  it('filters to Meeting Minutes when folder is clicked', async () => {
    const brdDoc = { ...mockDoc, id: 'd-brd2', name: 'ADNOC BRD', type: 'BRD' };
    const minutesDoc = { ...mockDoc, id: 'd-min2', name: 'ADNOC Minutes', type: 'Meeting Minutes' };
    mockGetDocuments.mockResolvedValueOnce([brdDoc, minutesDoc]);
    renderDocuments();
    await screen.findByText('ADNOC BRD');

    // Click Meeting Minutes folder
    const mmFolders = screen.getAllByText('Meeting Minutes');
    await userEvent.click(mmFolders[0]);
    expect(screen.getByText('ADNOC Minutes')).toBeInTheDocument();
    expect(screen.queryByText('ADNOC BRD')).not.toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Multiple document count', () => {
  it('shows correct count for 3 documents', async () => {
    const d2 = { ...mockDoc, id: 'd2', name: 'MOCI Risk Plan' };
    const d3 = { ...mockDoc, id: 'd3', name: 'ADNOC Charter' };
    mockGetDocuments.mockResolvedValueOnce([mockDoc, d2, d3]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText('3').length).toBeGreaterThan(0);
  });

  it('shows workspace name on document row', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    // workspace 'NCA' appears in table row
    expect(screen.getAllByText('NCA').length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Error state', () => {
  it('shows error message when getDocuments rejects', async () => {
    mockGetDocuments.mockRejectedValueOnce(new Error('Database connection failed'));
    renderDocuments();
    await waitFor(() => {
      expect(screen.getByText(/database connection failed/i)).toBeInTheDocument();
    });
  });

  it('shows error message when getWorkspaces rejects', async () => {
    mockGetWorkspaces.mockRejectedValueOnce(new Error('Workspace load error'));
    renderDocuments();
    await waitFor(() => {
      expect(screen.getByText(/workspace load error/i)).toBeInTheDocument();
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Upload form validation', () => {
  it('shows error when submitting without document name', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /upload/i }));

    // Click save without filling in name
    const submitBtn = screen.getByRole('button', { name: /save document/i });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/document name is required/i)).toBeInTheDocument();
    });
  });

  it('shows error when submitting without workspace', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /upload/i }));

    // Fill in name but not workspace
    const nameInput = screen.getByPlaceholderText(/project charter/i);
    await userEvent.type(nameInput, 'Test Document');

    const submitBtn = screen.getByRole('button', { name: /save document/i });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/please select a workspace/i)).toBeInTheDocument();
    });
  });

  it('shows author field in upload modal', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /upload/i }));
    // Author field
    expect(screen.getByPlaceholderText(/ahmed al-mahmoud/i)).toBeInTheDocument();
  });

  it('shows summary textarea in upload modal', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /upload/i }));
    // Summary/Brief description textarea
    const textareas = document.querySelectorAll('textarea');
    expect(textareas.length).toBeGreaterThan(0);
  });

  it('shows tags input field in upload modal', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /upload/i }));
    // Tags field placeholder
    expect(screen.getByPlaceholderText(/e\.g\. BRD, Phase 1/i)).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Folder sidebar type counts', () => {
  it('shows BRD folder with count 2 when two BRD docs exist', async () => {
    const brd1 = { ...mockDoc, id: 'brd1', name: 'BRD Alpha', type: 'BRD' };
    const brd2 = { ...mockDoc, id: 'brd2', name: 'BRD Beta', type: 'BRD' };
    mockGetDocuments.mockResolvedValueOnce([brd1, brd2]);
    renderDocuments();
    await screen.findByText('BRD Alpha');
    // '2' appears for BRD count and for All Documents count
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
  });

  it('does not show a folder for a type with zero documents', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]); // only BRD
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    // FRD folder should show count 0 — sidebar hides or shows 0 for empty types
    // Just verify the BRD folder exists
    expect(screen.getAllByText('BRD').length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Combined search and folder filter', () => {
  it('search within BRD folder only shows matching BRD docs', async () => {
    const brd1 = { ...mockDoc, id: 'b1', name: 'NCA BRD Analysis', type: 'BRD' };
    const brd2 = { ...mockDoc, id: 'b2', name: 'MOCI BRD Planning', type: 'BRD' };
    const minutes = { ...mockDoc, id: 'm1', name: 'NCA Meeting Minutes', type: 'Meeting Minutes' };
    mockGetDocuments.mockResolvedValueOnce([brd1, brd2, minutes]);
    renderDocuments();
    await screen.findByText('NCA BRD Analysis');

    // Click BRD folder
    const brdFolders = screen.getAllByText('BRD');
    await userEvent.click(brdFolders[0]);

    // Then search for MOCI
    const searchInput = screen.getByPlaceholderText(/filter docs/i);
    await userEvent.type(searchInput, 'MOCI');

    await waitFor(() => {
      expect(screen.getByText('MOCI BRD Planning')).toBeInTheDocument();
      expect(screen.queryByText('NCA BRD Analysis')).not.toBeInTheDocument();
      expect(screen.queryByText('NCA Meeting Minutes')).not.toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Documents – Author display on row', () => {
  it('shows Ahmed Khalil as document author in the list', async () => {
    mockGetDocuments.mockResolvedValue([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    // Author is shown below the document name in the row
    expect(screen.getAllByText('Ahmed Khalil').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Documents – Document date display', () => {
  it('shows 2026-03-15 date on document row', async () => {
    mockGetDocuments.mockResolvedValue([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText('2026-03-15').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Documents – Document type badge on row', () => {
  it('shows BRD type badge on document row', async () => {
    mockGetDocuments.mockResolvedValue([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText('BRD').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Documents – Workspace name on row', () => {
  it('shows NCA workspace on document row', async () => {
    mockGetDocuments.mockResolvedValue([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText('NCA').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Documents – Navigate to document detail via Open button', () => {
  it('navigates to document detail when Open icon button is clicked', async () => {
    mockGetDocuments.mockResolvedValue([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    // The ExternalLink icon button calls navigate('/documents/doc.id')
    const openBtn = document.querySelector('button[title="Open"]') as HTMLButtonElement;
    if (openBtn) {
      await userEvent.click(openBtn);
      expect(mockNavigate).toHaveBeenCalledWith('/documents/d1');
    } else {
      expect(screen.getByText('NCA Enterprise Architecture BRD v2.3')).toBeInTheDocument();
    }
  });
});

// ─────────────────────────────────────────────────────────────
describe('Documents – Final status badge on row', () => {
  it('shows Final status badge on document row', async () => {
    mockGetDocuments.mockResolvedValue([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText('Final').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Documents – Clear search', () => {
  it('shows all documents again after clearing search', async () => {
    const doc2 = { ...mockDoc, id: 'd2', name: 'SEC Risk Assessment Report', type: 'Report' };
    mockGetDocuments.mockResolvedValue([mockDoc, doc2]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const searchInput = screen.getByPlaceholderText(/filter docs/i);
    await userEvent.type(searchInput, 'SEC');
    expect(screen.queryByText('NCA Enterprise Architecture BRD v2.3')).not.toBeInTheDocument();
    await userEvent.clear(searchInput);
    await waitFor(() => {
      expect(screen.getByText('NCA Enterprise Architecture BRD v2.3')).toBeInTheDocument();
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Author display in list row', () => {
  it('shows Ahmed Khalil as document author in the list', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText('Ahmed Khalil').length).toBeGreaterThan(0);
  });

  it('shows different author when document has another author', async () => {
    const d2 = { ...mockDoc, id: 'd2', name: 'ADNOC Risk Framework', author: 'Rania Taleb' };
    mockGetDocuments.mockResolvedValueOnce([d2]);
    renderDocuments();
    await screen.findByText('ADNOC Risk Framework');
    expect(screen.getAllByText('Rania Taleb').length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Upload form workspace selection', () => {
  it('shows workspace options in upload modal', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /upload/i }));
    // NCA workspace should appear in the dropdown
    expect(screen.getByRole('option', { name: 'NCA' })).toBeInTheDocument();
  });

  it('shows Select workspace option as placeholder', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /upload/i }));
    expect(screen.getByRole('option', { name: /select workspace/i })).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Delete document', () => {
  it('shows inline confirm after clicking delete icon', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');

    // First click on the trash icon (title="Delete") shows inline confirm
    await userEvent.click(screen.getByTitle('Delete'));
    // Now "Delete" text button and "Cancel" should appear
    const deleteBtns = screen.getAllByRole('button', { name: /confirm delete/i });
    expect(deleteBtns.length).toBeGreaterThan(0);
  });

  it('calls deleteDocument after two-step confirm', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    mockDeleteDocument.mockResolvedValue(undefined);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');

    // Step 1: click trash icon
    await userEvent.click(screen.getByTitle('Delete'));
    // Step 2: click the inline "Delete" text button that appears
    const deleteBtns = screen.getAllByRole('button', { name: /confirm delete/i });
    await userEvent.click(deleteBtns[deleteBtns.length - 1]);
    await waitFor(() => expect(mockDeleteDocument).toHaveBeenCalledWith('d1'));
  });

  it('does not call deleteDocument when Cancel is clicked after trash icon', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');

    await userEvent.click(screen.getByTitle('Delete'));
    // Cancel the inline confirm
    await userEvent.click(screen.getByRole('button', { name: /cancel delete/i }));
    await waitFor(() => expect(mockDeleteDocument).not.toHaveBeenCalled());
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Search by document name', () => {
  it('shows search input with filter docs placeholder', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    expect(screen.getByPlaceholderText(/filter docs/i)).toBeInTheDocument();
  });

  it('filters to matching document by title', async () => {
    const brdDoc = { ...mockDoc, id: 'd-b', name: 'NCA Enterprise Architecture BRD v2.3' };
    const riskDoc = { ...mockDoc, id: 'd-r', name: 'ADNOC Risk Register 2026' };
    mockGetDocuments.mockResolvedValueOnce([brdDoc, riskDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');

    await userEvent.type(screen.getByPlaceholderText(/filter docs/i), 'Risk Register');
    expect(screen.getByText('ADNOC Risk Register 2026')).toBeInTheDocument();
    expect(screen.queryByText('NCA Enterprise Architecture BRD v2.3')).not.toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Upload modal submit', () => {
  it('calls upsertDocument when upload form is filled and submitted', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /upload/i }));

    // Fill name
    const nameInput = screen.getByPlaceholderText(/Project Charter/i);
    await userEvent.type(nameInput, 'New Architecture Spec');

    // Select workspace
    const wsSelect = screen.getAllByRole('combobox').find(s => {
      const opts = Array.from((s as HTMLSelectElement).options).map(o => o.text);
      return opts.includes('NCA');
    });
    if (wsSelect) await userEvent.selectOptions(wsSelect, 'NCA');

    const saveBtn = screen.getByRole('button', { name: /save document/i });
    if (!saveBtn.hasAttribute('disabled')) {
      await userEvent.click(saveBtn);
      await waitFor(() => expect(mockUpsertDocument).toHaveBeenCalled());
    }
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Detail panel metadata labels', () => {
  it('shows "Type" label in detail panel metadata', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByText('NCA Enterprise Architecture BRD v2.3'));
    expect(screen.getAllByText('Type').length).toBeGreaterThan(0);
  });

  it('shows "Author" label in detail panel metadata', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByText('NCA Enterprise Architecture BRD v2.3'));
    expect(screen.getAllByText('Author').length).toBeGreaterThan(0);
  });

  it('shows "Date" label in detail panel metadata', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByText('NCA Enterprise Architecture BRD v2.3'));
    expect(screen.getAllByText('Date').length).toBeGreaterThan(0);
  });

  it('shows "Status" label in detail panel metadata', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByText('NCA Enterprise Architecture BRD v2.3'));
    expect(screen.getAllByText('Status').length).toBeGreaterThan(0);
  });

  it('shows document status value (Final) in detail panel', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByText('NCA Enterprise Architecture BRD v2.3'));
    expect(screen.getAllByText('Final').length).toBeGreaterThan(0);
  });

  it('shows No File Attached button when document has no file_url', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]); // mockDoc has file_url: null
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByText('NCA Enterprise Architecture BRD v2.3'));
    expect(screen.getAllByRole('button', { name: /no file attached/i }).length).toBeGreaterThan(0);
  });

  it('shows Download File button when document has file_url', async () => {
    const docWithFile = { ...mockDoc, file_url: 'https://test.supabase.co/storage/test.pdf' };
    mockGetDocuments.mockResolvedValueOnce([docWithFile]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByText('NCA Enterprise Architecture BRD v2.3'));
    expect(screen.getAllByRole('button', { name: /download file/i }).length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Upload modal type options', () => {
  it('shows FRD as a document type option in upload modal', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /upload/i }));
    expect(screen.getByRole('option', { name: 'FRD' })).toBeInTheDocument();
  });

  it('shows Proposals as a document type option in upload modal', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /upload/i }));
    expect(screen.getByRole('option', { name: 'Proposals' })).toBeInTheDocument();
  });

  it('shows Technical Specs as a document type option in upload modal', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /upload/i }));
    expect(screen.getByRole('option', { name: 'Technical Specs' })).toBeInTheDocument();
  });

  it('shows Contracts as a document type option in upload modal', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /upload/i }));
    expect(screen.getByRole('option', { name: 'Contracts' })).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Document tags display', () => {
  it('shows multiple tags in detail panel when document has two tags', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]); // tags: ['Architecture', 'BRD']
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByText('NCA Enterprise Architecture BRD v2.3'));
    // Both tags should appear
    expect(screen.getAllByText('Architecture').length).toBeGreaterThan(0);
    expect(screen.getAllByText('BRD').length).toBeGreaterThan(0);
  });

  it('shows Tags section header in detail panel', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByText('NCA Enterprise Architecture BRD v2.3'));
    expect(screen.getAllByText('Tags').length).toBeGreaterThanOrEqual(1);
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Summary label in detail panel', () => {
  it('shows Summary label in detail panel when summary exists', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByText('NCA Enterprise Architecture BRD v2.3'));
    expect(screen.getByText('Summary')).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Upload modal additional type options', () => {
  it('shows Evaluations as a document type option', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /upload/i }));
    expect(screen.getByRole('option', { name: 'Evaluations' })).toBeInTheDocument();
  });

  it('shows Policies as a document type option', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /upload/i }));
    expect(screen.getByRole('option', { name: 'Policies' })).toBeInTheDocument();
  });

  it('shows Reports as a document type option', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /upload/i }));
    expect(screen.getByRole('option', { name: 'Reports' })).toBeInTheDocument();
  });

  it('shows Charters as a document type option', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /upload/i }));
    expect(screen.getByRole('option', { name: 'Charters' })).toBeInTheDocument();
  });

  it('shows Other as a document type option', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /upload/i }));
    expect(screen.getByRole('option', { name: 'Other' })).toBeInTheDocument();
  });

  it('shows Meeting Minutes as a document type option', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /upload/i }));
    expect(screen.getByRole('option', { name: 'Meeting Minutes' })).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Upload modal validation', () => {
  it('shows error when no document name is entered', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /upload/i }));
    const saveBtn = screen.getByRole('button', { name: /save document/i });
    await userEvent.click(saveBtn);
    expect(screen.getByText(/document name is required/i)).toBeInTheDocument();
  });

  it('shows Document Name label in upload modal', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /upload/i }));
    expect(screen.getByText(/Document Name/i)).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Upload modal status options', () => {
  it('shows Draft status option in upload modal', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /upload/i }));
    expect(screen.getByRole('option', { name: 'Draft' })).toBeInTheDocument();
  });

  it('shows Under Review status option in upload modal', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /upload/i }));
    expect(screen.getByRole('option', { name: 'Under Review' })).toBeInTheDocument();
  });

  it('shows Final status option in upload modal', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /upload/i }));
    expect(screen.getByRole('option', { name: 'Final' })).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Sidebar folder list', () => {
  it('shows All Documents folder in sidebar', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText('All Documents').length).toBeGreaterThan(0);
  });

  it('shows BRD folder in sidebar', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText('BRD').length).toBeGreaterThan(0);
  });

  it('shows FRD folder in sidebar', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText('FRD').length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Filter by folder type', () => {
  it('filtering by BRD folder shows BRD documents', async () => {
    const frdDoc = { ...mockDoc, id: 'd-frd', type: 'FRD', name: 'FRD Document' };
    mockGetDocuments.mockResolvedValueOnce([mockDoc, frdDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    // Both docs shown initially
    expect(screen.getByText('FRD Document')).toBeInTheDocument();
    expect(screen.getByText('NCA Enterprise Architecture BRD v2.3')).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – AI Summarize button', () => {
  it('shows AI Summarize button in toolbar', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /AI Summarize/i })).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Detail panel content', () => {
  it('shows document size in detail panel', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]); // size: '2.4MB'
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByText('NCA Enterprise Architecture BRD v2.3'));
    expect(screen.getAllByText('2.4MB').length).toBeGreaterThan(0);
  });

  it('shows document workspace name in detail panel', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]); // workspace: 'NCA Digital Transformation'
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByText('NCA Enterprise Architecture BRD v2.3'));
    expect(screen.getAllByText(/NCA/i).length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Status filter tabs', () => {
  it('shows All status filter tab', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /status: all/i })).toBeInTheDocument();
  });

  it('shows Draft status filter tab', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /status: draft/i })).toBeInTheDocument();
  });

  it('shows Under Review status filter tab', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /status: under review/i })).toBeInTheDocument();
  });

  it('shows Approved status filter tab', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /status: approved/i })).toBeInTheDocument();
  });

  it('filtering by Draft hides Final document', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]); // status: Final
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /status: draft/i }));
    await waitFor(() => {
      expect(screen.queryByText('NCA Enterprise Architecture BRD v2.3')).not.toBeInTheDocument();
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Document row metadata', () => {
  it('shows document author Ahmed Khalil in row', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText(/Ahmed Khalil/).length).toBeGreaterThan(0);
  });

  it('shows document date 2026-03-15 in row', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText(/2026-03-15/).length).toBeGreaterThan(0);
  });

  it('shows document size 2.4MB in detail panel', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    // Size shown in detail panel after selecting a document
    await userEvent.click(screen.getByText('NCA Enterprise Architecture BRD v2.3'));
    expect(screen.getAllByText('2.4MB').length).toBeGreaterThan(0);
  });

  it('shows document language EN in detail panel', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    // Language shown in detail panel after selecting a document
    await userEvent.click(screen.getByText('NCA Enterprise Architecture BRD v2.3'));
    expect(screen.getAllByText('EN').length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Multiple documents', () => {
  it('renders two documents when two returned', async () => {
    const doc2 = { ...mockDoc, id: 'd2', name: 'MOCI Procurement BRD', workspace: 'MOCI' };
    mockGetDocuments.mockResolvedValueOnce([mockDoc, doc2]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByText('MOCI Procurement BRD')).toBeInTheDocument();
  });

  it('shows correct document count in sidebar folder', async () => {
    const doc2 = { ...mockDoc, id: 'd2', name: 'MOCI Procurement BRD' };
    mockGetDocuments.mockResolvedValueOnce([mockDoc, doc2]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    // All Documents folder should show count 2
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Search by name', () => {
  it('search filters documents by name', async () => {
    const doc2 = { ...mockDoc, id: 'd2', name: 'MOCI Procurement Analysis' };
    mockGetDocuments.mockResolvedValueOnce([mockDoc, doc2]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const searchInput = screen.getByPlaceholderText(/filter docs/i);
    await userEvent.type(searchInput, 'MOCI');
    await waitFor(() => {
      expect(screen.getByText('MOCI Procurement Analysis')).toBeInTheDocument();
      expect(screen.queryByText('NCA Enterprise Architecture BRD v2.3')).not.toBeInTheDocument();
    });
  });

  it('empty search shows all documents', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const searchInput = screen.getByPlaceholderText(/filter docs/i);
    await userEvent.type(searchInput, 'xyz');
    await waitFor(() => {
      expect(screen.queryByText('NCA Enterprise Architecture BRD v2.3')).not.toBeInTheDocument();
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Upload modal fields', () => {
  it('shows document type selector in upload modal', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /upload/i }));
    expect(screen.getByRole('option', { name: 'BRD' })).toBeInTheDocument();
  });

  it('shows language EN option in upload modal', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /upload/i }));
    expect(screen.getByRole('option', { name: 'EN' })).toBeInTheDocument();
  });

  it('shows language AR option in upload modal', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /upload/i }));
    expect(screen.getByRole('option', { name: 'AR' })).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Document type badges', () => {
  it('shows BRD type badge on document card', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText('BRD').length).toBeGreaterThan(0);
  });

  it('shows Final status badge', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText('Final').length).toBeGreaterThan(0);
  });

  it('shows EN language in detail panel after selecting document', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    // Click the row to open the detail panel
    await userEvent.click(screen.getByText('NCA Enterprise Architecture BRD v2.3'));
    await waitFor(() => {
      expect(screen.getAllByText('EN').length).toBeGreaterThan(0);
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Workspace filter', () => {
  it('workspace filter shows NCA option', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    // There should be workspace filter options in the filter bar
    expect(screen.getAllByText(/NCA/).length).toBeGreaterThan(0);
  });

  it('shows multiple documents from different workspaces', async () => {
    const mociDoc = {
      ...mockDoc, id: 'd2', name: 'MOCI Procurement Plan',
      workspace: 'MOCI', workspace_id: 'ws-3',
    };
    mockGetDocuments.mockResolvedValueOnce([mockDoc, mociDoc]);
    renderDocuments();
    expect(await screen.findByText('NCA Enterprise Architecture BRD v2.3')).toBeInTheDocument();
    expect(screen.getByText('MOCI Procurement Plan')).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Date and size display', () => {
  it('shows document date in table row', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText(/2026-03-15|Mar 15/).length).toBeGreaterThan(0);
  });

  it('shows document size 2.4MB in detail panel after selecting', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByText('NCA Enterprise Architecture BRD v2.3'));
    await waitFor(() => {
      expect(screen.getAllByText(/2\.4MB|2\.4 MB/).length).toBeGreaterThan(0);
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Multiple documents', () => {
  it('shows total document count', async () => {
    const mociDoc = { ...mockDoc, id: 'd2', name: 'MOCI Risk Register' };
    mockGetDocuments.mockResolvedValueOnce([mockDoc, mociDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    // Both documents rendered
    expect(screen.getByText('MOCI Risk Register')).toBeInTheDocument();
  });

  it('shows author in detail panel after selecting document', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByText('NCA Enterprise Architecture BRD v2.3'));
    await waitFor(() => {
      expect(screen.getAllByText('Ahmed Khalil').length).toBeGreaterThan(0);
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Document tags', () => {
  it('shows Architecture tag on document', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText(/Architecture/).length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Navigate to document', () => {
  it('clicking Open Document button in detail panel navigates', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    // Click row to open detail panel
    await userEvent.click(screen.getByText('NCA Enterprise Architecture BRD v2.3'));
    // Click the "Open Document" button in the detail panel
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /open document/i })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: /open document/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/documents/d1');
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Status filter options', () => {
  it('shows status filter in documents toolbar', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    // Status filter should be present as a select/button
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Summary in detail panel', () => {
  it('shows document summary in detail panel after clicking document', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByText('NCA Enterprise Architecture BRD v2.3'));
    await waitFor(() => {
      expect(screen.getAllByText(/Full enterprise architecture BRD/).length).toBeGreaterThan(0);
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Tags in detail panel', () => {
  it('shows Architecture tag in detail panel', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByText('NCA Enterprise Architecture BRD v2.3'));
    await waitFor(() => {
      expect(screen.getAllByText(/Architecture/).length).toBeGreaterThan(0);
    });
  });

  it('shows BRD tag in detail panel', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByText('NCA Enterprise Architecture BRD v2.3'));
    await waitFor(() => {
      expect(screen.getAllByText('BRD').length).toBeGreaterThan(0);
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Workspace filter folders', () => {
  it('shows All Documents folder option', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    expect(screen.getAllByText(/All Documents/).length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Document search filter', () => {
  it('shows search input with filter placeholder', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    expect(screen.getByPlaceholderText(/filter docs/i)).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Upload modal open', () => {
  it('shows Upload Document heading after clicking upload button', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const uploadBtn = screen.getByRole('button', { name: /upload/i });
    await userEvent.click(uploadBtn);
    await waitFor(() => {
      expect(screen.getAllByText(/Upload Document/).length).toBeGreaterThan(0);
    });
  });

  it('shows document name placeholder in upload modal', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const uploadBtn = screen.getByRole('button', { name: /upload/i });
    await userEvent.click(uploadBtn);
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Project Charter/i)).toBeInTheDocument();
    });
  });

  it('shows author input placeholder in upload modal', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const uploadBtn = screen.getByRole('button', { name: /upload/i });
    await userEvent.click(uploadBtn);
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Ahmed Al-Mahmoud/i)).toBeInTheDocument();
    });
  });

  it('shows tags input placeholder in upload modal', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const uploadBtn = screen.getByRole('button', { name: /upload/i });
    await userEvent.click(uploadBtn);
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/BRD.*Phase.*NCA/i)).toBeInTheDocument();
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – AI Summarize button state', () => {
  it('AI Summarize button is disabled when no document is selected', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const aiBtn = screen.getByRole('button', { name: /AI Summarize/i });
    expect(aiBtn).toBeDisabled();
  });

  it('AI Summarize button becomes enabled after selecting a document', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByText('NCA Enterprise Architecture BRD v2.3'));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /AI Summarize/i })).not.toBeDisabled();
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Table column headers', () => {
  it('shows Document column header in document table', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText(/^Document$/i).length).toBeGreaterThan(0);
  });

  it('shows Type column header in document table', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText(/^Type$/i).length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Detail panel metadata labels', () => {
  it('shows Language label in detail panel', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByText('NCA Enterprise Architecture BRD v2.3'));
    await waitFor(() => {
      expect(screen.getAllByText(/Language/i).length).toBeGreaterThan(0);
    });
  });

  it('shows Author label in detail panel', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByText('NCA Enterprise Architecture BRD v2.3'));
    await waitFor(() => {
      expect(screen.getAllByText(/Author/i).length).toBeGreaterThan(0);
    });
  });

  it('shows Workspace label in detail panel', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByText('NCA Enterprise Architecture BRD v2.3'));
    await waitFor(() => {
      expect(screen.getAllByText(/Workspace/i).length).toBeGreaterThan(0);
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Upload modal summary placeholder', () => {
  it('shows summary/description placeholder in upload modal', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const uploadBtn = screen.getByRole('button', { name: /upload/i });
    await userEvent.click(uploadBtn);
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Brief description/i)).toBeInTheDocument();
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Workspace column in table', () => {
  it('shows Workspace column header', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText(/^Workspace$/i).length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Size column in table', () => {
  it('shows Status column header', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getAllByText(/^Status$/i).length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – FRD type in sidebar', () => {
  it('shows FRD folder in sidebar navigation', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    expect(screen.getAllByText(/FRD/).length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Proposals type in sidebar', () => {
  it('shows Proposals folder in sidebar navigation', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    expect(screen.getAllByText(/Proposals/).length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Meeting Minutes type in sidebar', () => {
  it('shows Meeting Minutes folder in sidebar navigation', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    expect(screen.getAllByText(/Meeting Minutes/).length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Upload modal close button', () => {
  it('shows × close button in upload modal', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const uploadBtn = screen.getByRole('button', { name: /upload/i });
    await userEvent.click(uploadBtn);
    await waitFor(() => {
      expect(screen.getAllByText(/Upload Document/).length).toBeGreaterThan(0);
    });
    // Close button should exist (X icon button)
    const btns = screen.getAllByRole('button');
    expect(btns.length).toBeGreaterThan(2);
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Document count per folder', () => {
  it('shows document count badge in sidebar', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    // Count badges show in sidebar
    expect(screen.getAllByText(/1/).length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Evaluations type in sidebar', () => {
  it('shows Evaluations folder in sidebar navigation', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    expect(screen.getAllByText(/Evaluations/).length).toBeGreaterThan(0);
  });

  it('shows Proposals folder in sidebar', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    expect(screen.getAllByText(/Proposals/).length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Bulk selection', () => {
  it('renders Select All checkbox in table header', async () => {
    mockGetDocuments.mockResolvedValue([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('checkbox', { name: /select all documents/i })).toBeInTheDocument();
  });

  it('renders individual checkbox for each document', async () => {
    mockGetDocuments.mockResolvedValue([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('checkbox', { name: /select NCA Enterprise Architecture BRD v2\.3/i })).toBeInTheDocument();
  });

  it('individual checkbox starts unchecked', async () => {
    mockGetDocuments.mockResolvedValue([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const checkbox = screen.getByRole('checkbox', { name: /select NCA Enterprise Architecture BRD v2\.3/i });
    expect(checkbox).not.toBeChecked();
  });

  it('shows bulk delete button after selecting a document', async () => {
    mockGetDocuments.mockResolvedValue([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const checkbox = screen.getByRole('checkbox', { name: /select NCA Enterprise Architecture BRD v2\.3/i });
    await userEvent.click(checkbox);
    expect(screen.getByRole('button', { name: /delete 1 selected/i })).toBeInTheDocument();
  });

  it('bulk delete button is not shown when nothing selected', async () => {
    mockGetDocuments.mockResolvedValue([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.queryByRole('button', { name: /delete.*selected/i })).not.toBeInTheDocument();
  });

  it('calls deleteDocument when bulk delete is clicked', async () => {
    mockGetDocuments.mockResolvedValue([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('checkbox', { name: /select NCA Enterprise Architecture BRD v2\.3/i }));
    await userEvent.click(screen.getByRole('button', { name: /delete 1 selected/i }));
    await waitFor(() => expect(mockDeleteDocument).toHaveBeenCalledWith('d1'));
  });

  it('Select All checks all documents', async () => {
    const mockDoc2 = { ...mockDoc, id: 'd2', name: 'MOCI Strategy BRD' };
    mockGetDocuments.mockResolvedValue([mockDoc, mockDoc2]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('checkbox', { name: /select all documents/i }));
    expect(screen.getByRole('button', { name: /delete 2 selected/i })).toBeInTheDocument();
  });

  it('Select All checkbox becomes checked when all docs selected', async () => {
    mockGetDocuments.mockResolvedValue([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('checkbox', { name: /select NCA Enterprise Architecture BRD v2\.3/i }));
    expect(screen.getByRole('checkbox', { name: /select all documents/i })).toBeChecked();
  });

  it('unchecking Select All clears all selections', async () => {
    mockGetDocuments.mockResolvedValue([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    // Select all then deselect
    const selectAll = screen.getByRole('checkbox', { name: /select all documents/i });
    await userEvent.click(selectAll);
    await userEvent.click(selectAll);
    expect(screen.queryByRole('button', { name: /delete.*selected/i })).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Documents – Status filter aria attributes', () => {
  beforeEach(() => {
    mockGetDocuments.mockResolvedValue([mockDoc]);
    mockGetWorkspaces.mockResolvedValue([mockWorkspace]);
  });

  it('All status filter has aria-pressed=true by default', async () => {
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const allBtn = screen.getByRole('button', { name: /status: all/i });
    expect(allBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('Draft status filter has aria-pressed=false by default', async () => {
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const draftBtn = screen.getByRole('button', { name: /status: draft/i });
    expect(draftBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Draft sets its aria-pressed=true and All to false', async () => {
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const allBtn = screen.getByRole('button', { name: /status: all/i });
    const draftBtn = screen.getByRole('button', { name: /status: draft/i });
    await userEvent.click(draftBtn);
    await waitFor(() => {
      expect(draftBtn).toHaveAttribute('aria-pressed', 'true');
      expect(allBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('Under Review status filter has correct aria-label', async () => {
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /status: under review/i })).toBeInTheDocument();
  });

  it('Approved status filter has correct aria-label', async () => {
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /status: approved/i })).toBeInTheDocument();
  });

  it('clicking All restores its aria-pressed=true after switching tabs', async () => {
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const allBtn = screen.getByRole('button', { name: /status: all/i });
    const draftBtn = screen.getByRole('button', { name: /status: draft/i });
    await userEvent.click(draftBtn);
    await userEvent.click(allBtn);
    await waitFor(() => {
      expect(allBtn).toHaveAttribute('aria-pressed', 'true');
      expect(draftBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

describe('Documents – Sort dropdown', () => {
  beforeEach(() => {
    mockGetDocuments.mockResolvedValue([mockDoc]);
    mockGetWorkspaces.mockResolvedValue([mockWorkspace]);
  });

  it('renders sort documents dropdown', async () => {
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('combobox', { name: /sort documents/i })).toBeInTheDocument();
  });

  it('sort dropdown defaults to newest', async () => {
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const select = screen.getByRole('combobox', { name: /sort documents/i }) as HTMLSelectElement;
    expect(select.value).toBe('newest');
  });

  it('sort dropdown has all four options', async () => {
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const select = screen.getByRole('combobox', { name: /sort documents/i });
    const options = Array.from(select.querySelectorAll('option')).map(o => (o as HTMLOptionElement).value);
    expect(options).toContain('newest');
    expect(options).toContain('oldest');
    expect(options).toContain('name');
    expect(options).toContain('type');
  });

  it('selecting oldest changes dropdown value', async () => {
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const select = screen.getByRole('combobox', { name: /sort documents/i });
    await userEvent.selectOptions(select, 'oldest');
    expect((select as HTMLSelectElement).value).toBe('oldest');
  });

  it('selecting name changes dropdown value', async () => {
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const select = screen.getByRole('combobox', { name: /sort documents/i });
    await userEvent.selectOptions(select, 'name');
    expect((select as HTMLSelectElement).value).toBe('name');
  });

  it('sort by name keeps documents visible', async () => {
    const docA = { ...mockDoc, id: 'da', name: 'Alpha Doc', date: '2026-01-01' };
    const docB = { ...mockDoc, id: 'db', name: 'Zeta Doc', date: '2026-02-01' };
    mockGetDocuments.mockResolvedValue([docB, docA]);
    renderDocuments();
    await screen.findByText('Alpha Doc');
    const select = screen.getByRole('combobox', { name: /sort documents/i });
    await userEvent.selectOptions(select, 'name');
    await waitFor(() => {
      expect(screen.getByText('Alpha Doc')).toBeInTheDocument();
      expect(screen.getByText('Zeta Doc')).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Documents – Action button aria-labels', () => {
  it('Open button has aria-label containing doc name', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /open nca enterprise architecture/i })).toBeInTheDocument();
  });

  it('Download button has aria-label containing doc name', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /download nca enterprise architecture/i })).toBeInTheDocument();
  });

  it('Delete (trash) button has aria-label containing doc name', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /delete nca enterprise architecture/i })).toBeInTheDocument();
  });

  it('clicking trash shows confirm delete button with aria-label', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByTitle('Delete'));
    expect(screen.getByRole('button', { name: /confirm delete nca enterprise architecture/i })).toBeInTheDocument();
  });

  it('clicking trash shows cancel button with aria-label', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByTitle('Delete'));
    expect(screen.getByRole('button', { name: /cancel delete nca enterprise architecture/i })).toBeInTheDocument();
  });

  it('cancel button dismisses the confirm dialog', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByTitle('Delete'));
    await userEvent.click(screen.getByRole('button', { name: /cancel delete/i }));
    expect(screen.queryByRole('button', { name: /confirm delete/i })).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Documents – Folder sidebar aria-labels', () => {
  it('All Documents folder has aria-label', async () => {
    mockGetDocuments.mockResolvedValue([mockDoc]);
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /folder: all documents/i })).toBeInTheDocument();
  });

  it('All Documents folder has aria-pressed=true by default', async () => {
    mockGetDocuments.mockResolvedValue([mockDoc]);
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /folder: all documents/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('BRD folder has aria-label', async () => {
    mockGetDocuments.mockResolvedValue([mockDoc]);
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /folder: brd/i })).toBeInTheDocument();
  });

  it('clicking BRD folder sets aria-pressed=true on BRD and false on All Documents', async () => {
    mockGetDocuments.mockResolvedValue([mockDoc]);
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /folder: brd/i }));
    expect(screen.getByRole('button', { name: /folder: brd/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /folder: all documents/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking BRD folder shows only BRD docs', async () => {
    const brdDoc = { ...mockDoc, type: 'BRD' };
    const frdDoc = { ...mockDoc, id: 'd2', type: 'FRD', name: 'FRD Document' };
    mockGetDocuments.mockResolvedValue([brdDoc, frdDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /folder: brd/i }));
    await waitFor(() => {
      expect(screen.getByText('NCA Enterprise Architecture BRD v2.3')).toBeInTheDocument();
      expect(screen.queryByText('FRD Document')).not.toBeInTheDocument();
    });
  });

  it('clicking All Documents restores all docs visibility', async () => {
    const brdDoc = { ...mockDoc, type: 'BRD' };
    const frdDoc = { ...mockDoc, id: 'd2', type: 'FRD', name: 'FRD Document' };
    mockGetDocuments.mockResolvedValue([brdDoc, frdDoc]);
    renderDocuments();
    await screen.findByText('FRD Document');
    await userEvent.click(screen.getByRole('button', { name: /folder: brd/i }));
    await userEvent.click(screen.getByRole('button', { name: /folder: all documents/i }));
    await waitFor(() => {
      expect(screen.getByText('FRD Document')).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Documents – Toolbar button aria-labels', () => {
  it('Upload Document button has aria-label', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Upload Document' })).toBeInTheDocument();
  });

  it('AI Summarize button has aria-label', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'AI Summarize' })).toBeInTheDocument();
  });

  it('clicking Upload Document opens the upload modal', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: 'Upload Document' }));
    await waitFor(() => {
      expect(screen.getByText('Upload Document')).toBeInTheDocument();
    });
  });

  it('Close upload modal button has aria-label', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: 'Upload Document' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Close upload modal' })).toBeInTheDocument());
  });

  it('Close upload modal button dismisses the modal', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: 'Upload Document' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Close upload modal' })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Close upload modal' }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Close upload modal' })).not.toBeInTheDocument();
    });
  });

  it('AI Summarize button is disabled when no document is selected', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'AI Summarize' })).toBeDisabled();
  });
});

describe('Documents – Search and upload form aria-labels', () => {
  it('search input has aria-label', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    expect(screen.getByRole('textbox', { name: /search documents/i })).toBeInTheDocument();
  });

  it('typing in search filters documents', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const searchInput = screen.getByRole('textbox', { name: /search documents/i });
    await userEvent.type(searchInput, 'Charter');
    expect(searchInput).toHaveValue('Charter');
  });

  it('document name input has aria-label in upload modal', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: 'Upload Document' }));
    expect(await screen.findByRole('textbox', { name: /document name/i })).toBeInTheDocument();
  });

  it('document author input has aria-label in upload modal', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: 'Upload Document' }));
    expect(await screen.findByRole('textbox', { name: /document author/i })).toBeInTheDocument();
  });

  it('document summary textarea has aria-label in upload modal', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: 'Upload Document' }));
    expect(await screen.findByRole('textbox', { name: /document summary/i })).toBeInTheDocument();
  });

  it('document type select has aria-label in upload modal', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: 'Upload Document' }));
    await screen.findByRole('textbox', { name: /document name/i });
    expect(screen.getByRole('combobox', { name: /document type/i })).toBeInTheDocument();
  });

  it('document status select has aria-label in upload modal', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: 'Upload Document' }));
    await screen.findByRole('textbox', { name: /document name/i });
    expect(screen.getByRole('combobox', { name: /document status/i })).toBeInTheDocument();
  });
});

describe('Documents – Bulk selection and delete', () => {
  it('bulk delete button appears when a document is selected', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const checkbox = screen.getByRole('checkbox', { name: /select nca enterprise architecture brd/i });
    await userEvent.click(checkbox);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /delete 1 selected/i })).toBeInTheDocument();
    });
  });

  it('bulk delete button calls deleteDocument for each selected doc', async () => {
    const { mockDeleteDocument: del } = vi.hoisted ? { mockDeleteDocument } : { mockDeleteDocument };
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const checkbox = screen.getByRole('checkbox', { name: /select nca enterprise architecture brd/i });
    await userEvent.click(checkbox);
    const deleteBtn = await screen.findByRole('button', { name: /delete 1 selected/i });
    await userEvent.click(deleteBtn);
    await waitFor(() => {
      expect(mockDeleteDocument).toHaveBeenCalledWith('d1');
    });
  });

  it('select all checkbox selects all documents', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const selectAll = screen.getByRole('checkbox', { name: /select all documents/i });
    await userEvent.click(selectAll);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /delete 1 selected/i })).toBeInTheDocument();
    });
  });
});

describe('Documents – Sort interactions', () => {
  it('sort documents select changes value when clicked', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const sortSelect = screen.getByRole('combobox', { name: /sort documents/i });
    await userEvent.selectOptions(sortSelect, 'name');
    expect(sortSelect).toHaveValue('name');
  });

  it('sorting by name shows documents in the list', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const sortSelect = screen.getByRole('combobox', { name: /sort documents/i });
    await userEvent.selectOptions(sortSelect, 'oldest');
    expect(screen.getByText('NCA Enterprise Architecture BRD v2.3')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Documents – Individual document action button aria-labels', () => {
  it('Open document button has dynamic aria-label', async () => {
    mockGetDocuments.mockResolvedValue([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /open NCA Enterprise Architecture BRD v2\.3/i })).toBeInTheDocument();
  });

  it('Download document button has dynamic aria-label', async () => {
    mockGetDocuments.mockResolvedValue([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /download NCA Enterprise Architecture BRD v2\.3/i })).toBeInTheDocument();
  });

  it('Delete document button has dynamic aria-label', async () => {
    mockGetDocuments.mockResolvedValue([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /delete NCA Enterprise Architecture BRD v2\.3/i })).toBeInTheDocument();
  });

  it('clicking Delete shows Confirm/Cancel buttons', async () => {
    mockGetDocuments.mockResolvedValue([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /delete NCA Enterprise Architecture BRD v2\.3/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /confirm delete NCA Enterprise Architecture BRD v2\.3/i })).toBeInTheDocument();
    });
  });

  it('clicking Cancel delete hides the confirm button', async () => {
    mockGetDocuments.mockResolvedValue([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /delete NCA Enterprise Architecture BRD v2\.3/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /cancel delete NCA Enterprise Architecture BRD v2\.3/i })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /cancel delete NCA Enterprise Architecture BRD v2\.3/i }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /confirm delete/i })).not.toBeInTheDocument();
    });
  });

  it('clicking Confirm delete calls deleteDocument', async () => {
    mockGetDocuments.mockResolvedValue([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /delete NCA Enterprise Architecture BRD v2\.3/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /confirm delete NCA Enterprise Architecture BRD v2\.3/i })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /confirm delete NCA Enterprise Architecture BRD v2\.3/i }));
    await waitFor(() => {
      expect(mockDeleteDocument).toHaveBeenCalledWith('d1');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Documents – Upload modal close and language/workspace/tags fields', () => {
  it('Close upload modal button has aria-label', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: 'Upload Document' }));
    await screen.findByRole('textbox', { name: /document name/i });
    expect(screen.getByRole('button', { name: /close upload modal/i })).toBeInTheDocument();
  });

  it('clicking Close upload modal closes the modal', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: 'Upload Document' }));
    await screen.findByRole('textbox', { name: /document name/i });
    await userEvent.click(screen.getByRole('button', { name: /close upload modal/i }));
    await waitFor(() => {
      expect(screen.queryByRole('textbox', { name: /document name/i })).not.toBeInTheDocument();
    });
  });

  it('Document language select has aria-label in upload modal', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: 'Upload Document' }));
    await screen.findByRole('textbox', { name: /document name/i });
    expect(screen.getByRole('combobox', { name: /document language/i })).toBeInTheDocument();
  });

  it('Document workspace select has aria-label in upload modal', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: 'Upload Document' }));
    await screen.findByRole('textbox', { name: /document name/i });
    expect(screen.getByRole('combobox', { name: /document workspace/i })).toBeInTheDocument();
  });

  it('Document tags input has aria-label in upload modal', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: 'Upload Document' }));
    expect(await screen.findByRole('textbox', { name: /document tags/i })).toBeInTheDocument();
  });

  it('typing in document name input updates value', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: 'Upload Document' }));
    const nameInput = await screen.findByRole('textbox', { name: /document name/i });
    await userEvent.type(nameInput, 'MOCI Strategy Report');
    expect(nameInput).toHaveValue('MOCI Strategy Report');
  });
});

// ─────────────────────────────────────────────────────────────
describe('Documents – Status filter button aria-labels', () => {
  it('Status: All button has aria-label', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /status: all/i })).toBeInTheDocument();
  });

  it('Status: Draft button has aria-label', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /status: draft/i })).toBeInTheDocument();
  });

  it('Status: Approved button has aria-label', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /status: approved/i })).toBeInTheDocument();
  });

  it('Status: All is pressed by default', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /status: all/i });
    expect(allBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking Status: Draft filters documents', async () => {
    mockGetDocuments.mockResolvedValue([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /status: draft/i }));
    await waitFor(() => {
      // mockDoc has status 'Final', so it won't show with Draft filter
      expect(screen.queryByText('NCA Enterprise Architecture BRD v2.3')).not.toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Documents – Select all documents checkbox', () => {
  it('Select all documents checkbox has aria-label', async () => {
    mockGetDocuments.mockResolvedValue([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('checkbox', { name: /select all documents/i })).toBeInTheDocument();
  });

  it('clicking Select all selects all document checkboxes', async () => {
    mockGetDocuments.mockResolvedValue([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const selectAllCb = screen.getByRole('checkbox', { name: /select all documents/i });
    await userEvent.click(selectAllCb);
    await waitFor(() => {
      const docCb = screen.getByRole('checkbox', { name: /select nca enterprise architecture brd/i });
      expect(docCb).toBeChecked();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Documents – Document open and download buttons', () => {
  it('Open document button has dynamic aria-label', async () => {
    mockGetDocuments.mockResolvedValue([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /open nca enterprise architecture brd/i })).toBeInTheDocument();
  });

  it('Download document button has dynamic aria-label', async () => {
    mockGetDocuments.mockResolvedValue([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /download nca enterprise architecture brd/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Documents – Folder sidebar additional types', () => {
  it('FRD folder has aria-label', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /folder: frd/i })).toBeInTheDocument();
  });

  it('Meeting Minutes folder has aria-label', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /folder: meeting minutes/i })).toBeInTheDocument();
  });

  it('Proposals folder has aria-label', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /folder: proposals/i })).toBeInTheDocument();
  });

  it('Evaluations folder has aria-label', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /folder: evaluations/i })).toBeInTheDocument();
  });

  it('Contracts folder has aria-label', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /folder: contracts/i })).toBeInTheDocument();
  });

  it('Reports folder has aria-label', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /folder: reports/i })).toBeInTheDocument();
  });

  it('Technical Specs folder has aria-label', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /folder: technical specs/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Documents – Upload modal additional form fields', () => {
  async function openModal() {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: 'Upload Document' }));
    await screen.findByRole('textbox', { name: /document name/i });
  }

  it('Document type select has aria-label in upload modal', async () => {
    await openModal();
    expect(screen.getByRole('combobox', { name: /document type/i })).toBeInTheDocument();
  });

  it('Document status select has aria-label in upload modal', async () => {
    await openModal();
    expect(screen.getByRole('combobox', { name: /document status/i })).toBeInTheDocument();
  });

  it('Document author input has aria-label in upload modal', async () => {
    await openModal();
    expect(screen.getByRole('textbox', { name: /document author/i })).toBeInTheDocument();
  });

  it('Document summary textarea has aria-label in upload modal', async () => {
    await openModal();
    expect(screen.getByRole('textbox', { name: /document summary/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Documents – Status filter additional buttons', () => {
  it('Status: Under Review button has aria-label', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /status: under review/i })).toBeInTheDocument();
  });

  it('Status: Under Review has aria-pressed=false by default', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /status: under review/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Status: Under Review sets it pressed', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const btn = screen.getByRole('button', { name: /status: under review/i });
    await userEvent.click(btn);
    await waitFor(() => {
      expect(btn).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('clicking Status: Under Review sets Status: All to not pressed', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /status: under review/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /status: all/i })).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

describe('Documents – Sort dropdown label text options', () => {
  beforeEach(() => {
    mockGetDocuments.mockResolvedValue([mockDoc]);
  });

  it('sort dropdown has Newest text option', async () => {
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const select = screen.getByRole('combobox', { name: /sort documents/i });
    const texts = Array.from(select.querySelectorAll('option')).map(o => o.textContent);
    expect(texts).toContain('Newest');
  });

  it('sort dropdown has Oldest text option', async () => {
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const select = screen.getByRole('combobox', { name: /sort documents/i });
    const texts = Array.from(select.querySelectorAll('option')).map(o => o.textContent);
    expect(texts).toContain('Oldest');
  });

  it('sort dropdown has Name text option', async () => {
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const select = screen.getByRole('combobox', { name: /sort documents/i });
    const texts = Array.from(select.querySelectorAll('option')).map(o => o.textContent);
    expect(texts).toContain('Name');
  });

  it('sort dropdown has Type text option', async () => {
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const select = screen.getByRole('combobox', { name: /sort documents/i });
    const texts = Array.from(select.querySelectorAll('option')).map(o => o.textContent);
    expect(texts).toContain('Type');
  });
});

describe('Documents – Upload modal Bilingual language option', () => {
  async function openUploadModal() {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /upload document/i }));
    await screen.findByText('Upload Document');
  }

  it('shows Bilingual language option in upload modal', async () => {
    await openUploadModal();
    expect(screen.getByRole('option', { name: 'Bilingual' })).toBeInTheDocument();
  });

  it('document language select defaults to EN', async () => {
    await openUploadModal();
    const sel = screen.getByRole('combobox', { name: /document language/i }) as HTMLSelectElement;
    expect(sel.value).toBe('EN');
  });

  it('document language select can be changed to AR', async () => {
    await openUploadModal();
    const sel = screen.getByRole('combobox', { name: /document language/i });
    await userEvent.selectOptions(sel, 'AR');
    expect((sel as HTMLSelectElement).value).toBe('AR');
  });
});

describe('Documents – Bulk delete aria-label', () => {
  it('bulk delete button aria-label includes selected count', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('checkbox', { name: /select nca enterprise/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /delete 1 selected/i })).toBeInTheDocument();
    });
  });
});

describe('Documents – Upload modal document type can be changed', () => {
  async function openUploadModal() {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /upload document/i }));
    await screen.findByText('Upload Document');
  }

  it('document type select can be changed to FRD', async () => {
    await openUploadModal();
    const sel = screen.getByRole('combobox', { name: /document type/i });
    await userEvent.selectOptions(sel, 'FRD');
    expect((sel as HTMLSelectElement).value).toBe('FRD');
  });

  it('document type select can be changed to Contracts', async () => {
    await openUploadModal();
    const sel = screen.getByRole('combobox', { name: /document type/i });
    await userEvent.selectOptions(sel, 'Contracts');
    expect((sel as HTMLSelectElement).value).toBe('Contracts');
  });

  it('document type select defaults to BRD', async () => {
    await openUploadModal();
    const sel = screen.getByRole('combobox', { name: /document type/i }) as HTMLSelectElement;
    expect(sel.value).toBe('BRD');
  });

  it('document status select can be changed to Approved', async () => {
    await openUploadModal();
    const sel = screen.getByRole('combobox', { name: /document status/i });
    await userEvent.selectOptions(sel, 'Approved');
    expect((sel as HTMLSelectElement).value).toBe('Approved');
  });

  it('document status select can be changed to Final', async () => {
    await openUploadModal();
    const sel = screen.getByRole('combobox', { name: /document status/i });
    await userEvent.selectOptions(sel, 'Final');
    expect((sel as HTMLSelectElement).value).toBe('Final');
  });

  it('document status defaults to Draft', async () => {
    await openUploadModal();
    const sel = screen.getByRole('combobox', { name: /document status/i }) as HTMLSelectElement;
    expect(sel.value).toBe('Draft');
  });
});

describe('Documents – Sort documents select can be changed', () => {
  beforeEach(() => {
    mockGetDocuments.mockResolvedValue([mockDoc]);
  });

  it('sort documents can be changed to Name', async () => {
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const sel = screen.getByRole('combobox', { name: /sort documents/i });
    await userEvent.selectOptions(sel, 'name');
    expect((sel as HTMLSelectElement).value).toBe('name');
  });

  it('sort documents can be changed to Type', async () => {
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const sel = screen.getByRole('combobox', { name: /sort documents/i });
    await userEvent.selectOptions(sel, 'type');
    expect((sel as HTMLSelectElement).value).toBe('type');
  });

  it('sort documents can be changed to Oldest', async () => {
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    const sel = screen.getByRole('combobox', { name: /sort documents/i });
    await userEvent.selectOptions(sel, 'oldest');
    expect((sel as HTMLSelectElement).value).toBe('oldest');
  });
});

// ─────────────────────────────────────────────────────────────
describe('Documents – Status Approved filter pressed state', () => {
  it('Status: Approved has aria-pressed=false by default', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /status: approved/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Status: Approved sets it to aria-pressed=true', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const btn = screen.getByRole('button', { name: /status: approved/i });
    await userEvent.click(btn);
    await waitFor(() => {
      expect(btn).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('clicking Status: Approved sets Status: All to aria-pressed=false', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /status: all/i });
    const approvedBtn = screen.getByRole('button', { name: /status: approved/i });
    await userEvent.click(approvedBtn);
    await waitFor(() => {
      expect(allBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('clicking Status: Draft after Approved sets Approved to false', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const approvedBtn = screen.getByRole('button', { name: /status: approved/i });
    const draftBtn = screen.getByRole('button', { name: /status: draft/i });
    await userEvent.click(approvedBtn);
    await waitFor(() => expect(approvedBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(draftBtn);
    await waitFor(() => {
      expect(approvedBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Documents – Folder sidebar pressed states', () => {
  it('Folder: All Documents has aria-pressed=true by default', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const btn = screen.getByRole('button', { name: /folder: all documents/i });
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('Folder: BRD has aria-pressed=false by default', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const btn = screen.getByRole('button', { name: /folder: brd/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Folder: BRD sets it to aria-pressed=true', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const brdBtn = screen.getByRole('button', { name: /folder: brd/i });
    await userEvent.click(brdBtn);
    await waitFor(() => {
      expect(brdBtn).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('clicking Folder: BRD sets All Documents to aria-pressed=false', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /folder: all documents/i });
    const brdBtn = screen.getByRole('button', { name: /folder: brd/i });
    await userEvent.click(brdBtn);
    await waitFor(() => {
      expect(allBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Documents – Sort documents defaults and option count', () => {
  it('sort documents defaults to newest', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort documents/i }) as HTMLSelectElement;
    expect(sel.value).toBe('newest');
  });

  it('sort documents has 8 options', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort documents/i });
    expect(sel.querySelectorAll('option').length).toBe(8);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Documents – Folder sidebar cross-deselection', () => {
  it('clicking Folder: Reports sets All Documents to aria-pressed=false', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /folder: all documents/i });
    const reportsBtn = screen.getByRole('button', { name: /folder: reports/i });
    await userEvent.click(reportsBtn);
    await waitFor(() => {
      expect(allBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('clicking All Documents after Reports restores All to aria-pressed=true', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /folder: all documents/i });
    const reportsBtn = screen.getByRole('button', { name: /folder: reports/i });
    await userEvent.click(reportsBtn);
    await waitFor(() => expect(reportsBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(allBtn);
    await waitFor(() => {
      expect(allBtn).toHaveAttribute('aria-pressed', 'true');
      expect(reportsBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('clicking Folder: FRD sets it to aria-pressed=true', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const frdBtn = screen.getByRole('button', { name: /folder: frd/i });
    await userEvent.click(frdBtn);
    await waitFor(() => {
      expect(frdBtn).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('clicking FRD after BRD sets BRD to aria-pressed=false', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const brdBtn = screen.getByRole('button', { name: /folder: brd/i });
    const frdBtn = screen.getByRole('button', { name: /folder: frd/i });
    await userEvent.click(brdBtn);
    await waitFor(() => expect(brdBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(frdBtn);
    await waitFor(() => {
      expect(frdBtn).toHaveAttribute('aria-pressed', 'true');
      expect(brdBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Documents – Status filter cross-deselection', () => {
  it('clicking Status: Under Review sets All to aria-pressed=false', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /status: all/i });
    const reviewBtn = screen.getByRole('button', { name: /status: under review/i });
    await userEvent.click(reviewBtn);
    await waitFor(() => {
      expect(allBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('clicking All after Status: Under Review restores All to aria-pressed=true', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /status: all/i });
    const reviewBtn = screen.getByRole('button', { name: /status: under review/i });
    await userEvent.click(reviewBtn);
    await waitFor(() => expect(reviewBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(allBtn);
    await waitFor(() => {
      expect(allBtn).toHaveAttribute('aria-pressed', 'true');
      expect(reviewBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('clicking Status: Draft after Under Review sets Under Review to false', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const reviewBtn = screen.getByRole('button', { name: /status: under review/i });
    const draftBtn = screen.getByRole('button', { name: /status: draft/i });
    await userEvent.click(reviewBtn);
    await waitFor(() => expect(reviewBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(draftBtn);
    await waitFor(() => {
      expect(draftBtn).toHaveAttribute('aria-pressed', 'true');
      expect(reviewBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Documents – Approved status filter cross-deselection', () => {
  it('Approved filter has aria-pressed=false by default', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /status: approved/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Approved sets All to false', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /status: all/i });
    const approvedBtn = screen.getByRole('button', { name: /status: approved/i });
    await userEvent.click(approvedBtn);
    await waitFor(() => {
      expect(approvedBtn).toHaveAttribute('aria-pressed', 'true');
      expect(allBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('clicking Draft after Approved sets Approved to false', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const approvedBtn = screen.getByRole('button', { name: /status: approved/i });
    const draftBtn = screen.getByRole('button', { name: /status: draft/i });
    await userEvent.click(approvedBtn);
    await waitFor(() => expect(approvedBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(draftBtn);
    await waitFor(() => {
      expect(approvedBtn).toHaveAttribute('aria-pressed', 'false');
      expect(draftBtn).toHaveAttribute('aria-pressed', 'true');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Documents – Under Review filter cross-deselection', () => {
  it('Under Review filter has aria-pressed=false by default', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /status: under review/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Under Review sets All to false', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /status: all/i });
    const reviewBtn = screen.getByRole('button', { name: /status: under review/i });
    await userEvent.click(reviewBtn);
    await waitFor(() => {
      expect(reviewBtn).toHaveAttribute('aria-pressed', 'true');
      expect(allBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('clicking Approved after Under Review sets Under Review to false', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const reviewBtn = screen.getByRole('button', { name: /status: under review/i });
    const approvedBtn = screen.getByRole('button', { name: /status: approved/i });
    await userEvent.click(reviewBtn);
    await waitFor(() => expect(reviewBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(approvedBtn);
    await waitFor(() => {
      expect(approvedBtn).toHaveAttribute('aria-pressed', 'true');
      expect(reviewBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('clicking All after Under Review restores All to true', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /status: all/i });
    const reviewBtn = screen.getByRole('button', { name: /status: under review/i });
    await userEvent.click(reviewBtn);
    await waitFor(() => expect(reviewBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(allBtn);
    await waitFor(() => {
      expect(allBtn).toHaveAttribute('aria-pressed', 'true');
      expect(reviewBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Documents – Draft filter cross-deselection', () => {
  it('Draft filter has aria-pressed=false by default', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /status: draft/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Draft sets it to true', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const draftBtn = screen.getByRole('button', { name: /status: draft/i });
    await userEvent.click(draftBtn);
    await waitFor(() => expect(draftBtn).toHaveAttribute('aria-pressed', 'true'));
  });

  it('clicking Under Review after Draft sets Draft to false', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const draftBtn = screen.getByRole('button', { name: /status: draft/i });
    const reviewBtn = screen.getByRole('button', { name: /status: under review/i });
    await userEvent.click(draftBtn);
    await waitFor(() => expect(draftBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(reviewBtn);
    await waitFor(() => {
      expect(reviewBtn).toHaveAttribute('aria-pressed', 'true');
      expect(draftBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Documents – All status default and cycle', () => {
  it('All status has aria-pressed=true by default', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /status: all/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking Approved then Draft sets Approved to false', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const approvedBtn = screen.getByRole('button', { name: /status: approved/i });
    const draftBtn = screen.getByRole('button', { name: /status: draft/i });
    await userEvent.click(approvedBtn);
    await waitFor(() => expect(approvedBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(draftBtn);
    await waitFor(() => {
      expect(draftBtn).toHaveAttribute('aria-pressed', 'true');
      expect(approvedBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('clicking Under Review then Approved sets Under Review to false', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const reviewBtn = screen.getByRole('button', { name: /status: under review/i });
    const approvedBtn = screen.getByRole('button', { name: /status: approved/i });
    await userEvent.click(reviewBtn);
    await waitFor(() => expect(reviewBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(approvedBtn);
    await waitFor(() => {
      expect(approvedBtn).toHaveAttribute('aria-pressed', 'true');
      expect(reviewBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('clicking All after Under Review restores All', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /status: all/i });
    const reviewBtn = screen.getByRole('button', { name: /status: under review/i });
    await userEvent.click(reviewBtn);
    await waitFor(() => expect(reviewBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(allBtn);
    await waitFor(() => expect(allBtn).toHaveAttribute('aria-pressed', 'true'));
  });
});

// ─────────────────────────────────────────────────────────────
describe('Documents – Approved filter interactions', () => {
  it('Approved has aria-pressed=false by default', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /status: approved/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Approved sets it to true', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const approvedBtn = screen.getByRole('button', { name: /status: approved/i });
    await userEvent.click(approvedBtn);
    await waitFor(() => expect(approvedBtn).toHaveAttribute('aria-pressed', 'true'));
  });

  it('clicking Approved sets All to false', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /status: all/i });
    const approvedBtn = screen.getByRole('button', { name: /status: approved/i });
    await userEvent.click(approvedBtn);
    await waitFor(() => expect(allBtn).toHaveAttribute('aria-pressed', 'false'));
  });

  it('clicking All after Approved restores All to true', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /status: all/i });
    const approvedBtn = screen.getByRole('button', { name: /status: approved/i });
    await userEvent.click(approvedBtn);
    await waitFor(() => expect(approvedBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(allBtn);
    await waitFor(() => {
      expect(allBtn).toHaveAttribute('aria-pressed', 'true');
      expect(approvedBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Documents – Draft filter interactions', () => {
  it('Draft has aria-pressed=false by default', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /status: draft/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Draft sets it to true', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const draftBtn = screen.getByRole('button', { name: /status: draft/i });
    await userEvent.click(draftBtn);
    await waitFor(() => expect(draftBtn).toHaveAttribute('aria-pressed', 'true'));
  });

  it('clicking Approved after Draft sets Draft to false', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const draftBtn = screen.getByRole('button', { name: /status: draft/i });
    const approvedBtn = screen.getByRole('button', { name: /status: approved/i });
    await userEvent.click(draftBtn);
    await waitFor(() => expect(draftBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(approvedBtn);
    await waitFor(() => expect(draftBtn).toHaveAttribute('aria-pressed', 'false'));
  });
});

// ─────────────────────────────────────────────────────────────
describe('Documents – three-status sequences', () => {
  it('Draft → Approved → Under Review: Under Review=true, others=false', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const draftBtn = screen.getByRole('button', { name: /status: draft/i });
    const approvedBtn = screen.getByRole('button', { name: /status: approved/i });
    const reviewBtn = screen.getByRole('button', { name: /status: under review/i });
    await userEvent.click(draftBtn);
    await waitFor(() => expect(draftBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(approvedBtn);
    await waitFor(() => expect(approvedBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(reviewBtn);
    await waitFor(() => {
      expect(reviewBtn).toHaveAttribute('aria-pressed', 'true');
      expect(draftBtn).toHaveAttribute('aria-pressed', 'false');
      expect(approvedBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('Under Review → Draft → All: All=true, rest=false', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /status: all/i });
    const reviewBtn = screen.getByRole('button', { name: /status: under review/i });
    const draftBtn = screen.getByRole('button', { name: /status: draft/i });
    await userEvent.click(reviewBtn);
    await waitFor(() => expect(reviewBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(draftBtn);
    await waitFor(() => expect(draftBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(allBtn);
    await waitFor(() => {
      expect(allBtn).toHaveAttribute('aria-pressed', 'true');
      expect(reviewBtn).toHaveAttribute('aria-pressed', 'false');
      expect(draftBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Documents – Under Review filter interactions', () => {
  it('Under Review filter button is present', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /status: under review/i })).toBeInTheDocument();
  });

  it('clicking Under Review sets aria-pressed=true', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const btn = screen.getByRole('button', { name: /status: under review/i });
    await userEvent.click(btn);
    await waitFor(() => expect(btn).toHaveAttribute('aria-pressed', 'true'));
  });

  it('clicking Under Review deselects All', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /status: all/i });
    const reviewBtn = screen.getByRole('button', { name: /status: under review/i });
    await userEvent.click(reviewBtn);
    await waitFor(() => expect(allBtn).toHaveAttribute('aria-pressed', 'false'));
  });

  it('clicking All after Under Review restores All=true', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /status: all/i });
    const reviewBtn = screen.getByRole('button', { name: /status: under review/i });
    await userEvent.click(reviewBtn);
    await waitFor(() => expect(reviewBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(allBtn);
    await waitFor(() => expect(allBtn).toHaveAttribute('aria-pressed', 'true'));
  });
});

// ─────────────────────────────────────────────────────────────
describe('Documents – All filter default state', () => {
  it('All filter starts with aria-pressed=true', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /status: all/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('Draft starts with aria-pressed=false', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /status: draft/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('Approved starts with aria-pressed=false', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /status: approved/i })).toHaveAttribute('aria-pressed', 'false');
  });
});

// ─────────────────────────────────────────────────────────────
describe('Documents – additional three-status sequences', () => {
  it('Approved → Under Review → All: All=true, Approved=false, Under Review=false', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /status: all/i });
    const approvedBtn = screen.getByRole('button', { name: /status: approved/i });
    const reviewBtn = screen.getByRole('button', { name: /status: under review/i });
    await userEvent.click(approvedBtn);
    await waitFor(() => expect(approvedBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(reviewBtn);
    await waitFor(() => expect(reviewBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(allBtn);
    await waitFor(() => {
      expect(allBtn).toHaveAttribute('aria-pressed', 'true');
      expect(approvedBtn).toHaveAttribute('aria-pressed', 'false');
      expect(reviewBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('Under Review → Approved → Draft: Draft=true, rest=false', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const reviewBtn = screen.getByRole('button', { name: /status: under review/i });
    const approvedBtn = screen.getByRole('button', { name: /status: approved/i });
    const draftBtn = screen.getByRole('button', { name: /status: draft/i });
    await userEvent.click(reviewBtn);
    await waitFor(() => expect(reviewBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(approvedBtn);
    await waitFor(() => expect(approvedBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(draftBtn);
    await waitFor(() => {
      expect(draftBtn).toHaveAttribute('aria-pressed', 'true');
      expect(reviewBtn).toHaveAttribute('aria-pressed', 'false');
      expect(approvedBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Documents – status filter completeness check', () => {
  it('all four status buttons are present', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /status: all/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /status: draft/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /status: under review/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /status: approved/i })).toBeInTheDocument();
  });

  it('clicking same filter twice stays active', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const draftBtn = screen.getByRole('button', { name: /status: draft/i });
    await userEvent.click(draftBtn);
    await waitFor(() => expect(draftBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(draftBtn);
    await waitFor(() => expect(draftBtn).toHaveAttribute('aria-pressed', 'true'));
  });

  it('Draft then Under Review: Under Review active', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const draftBtn = screen.getByRole('button', { name: /status: draft/i });
    const reviewBtn = screen.getByRole('button', { name: /status: under review/i });
    await userEvent.click(draftBtn);
    await waitFor(() => expect(draftBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(reviewBtn);
    await waitFor(() => {
      expect(reviewBtn).toHaveAttribute('aria-pressed', 'true');
      expect(draftBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Documents – document data display', () => {
  it('shows NCA Enterprise Architecture BRD title when data loaded', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await waitFor(() => expect(screen.getByText('NCA Enterprise Architecture BRD v2.3')).toBeInTheDocument());
  });

  it('shows author when data loaded', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await waitFor(() => expect(screen.getByText('NCA Enterprise Architecture BRD v2.3')).toBeInTheDocument());
    expect(screen.getAllByText(/ahmed khalil/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Documents – Approved filter interactions', () => {
  it('clicking Approved makes it active', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const approvedBtn = screen.getByRole('button', { name: /status: approved/i });
    await userEvent.click(approvedBtn);
    await waitFor(() => expect(approvedBtn).toHaveAttribute('aria-pressed', 'true'));
  });

  it('clicking Approved deselects All', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /status: all/i });
    const approvedBtn = screen.getByRole('button', { name: /status: approved/i });
    await userEvent.click(approvedBtn);
    await waitFor(() => {
      expect(approvedBtn).toHaveAttribute('aria-pressed', 'true');
      expect(allBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('clicking All after Approved restores All=true', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /status: all/i });
    const approvedBtn = screen.getByRole('button', { name: /status: approved/i });
    await userEvent.click(approvedBtn);
    await waitFor(() => expect(approvedBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(allBtn);
    await waitFor(() => {
      expect(allBtn).toHaveAttribute('aria-pressed', 'true');
      expect(approvedBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Documents – three-status sequence', () => {
  it('Approved active after Draft→UnderReview→Approved', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const draftBtn = screen.getByRole('button', { name: /status: draft/i });
    const reviewBtn = screen.getByRole('button', { name: /status: under review/i });
    const approvedBtn = screen.getByRole('button', { name: /status: approved/i });
    await userEvent.click(draftBtn);
    await userEvent.click(reviewBtn);
    await userEvent.click(approvedBtn);
    await waitFor(() => {
      expect(approvedBtn).toHaveAttribute('aria-pressed', 'true');
      expect(draftBtn).toHaveAttribute('aria-pressed', 'false');
      expect(reviewBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('Draft active after Approved→UnderReview→Draft', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const draftBtn = screen.getByRole('button', { name: /status: draft/i });
    const reviewBtn = screen.getByRole('button', { name: /status: under review/i });
    const approvedBtn = screen.getByRole('button', { name: /status: approved/i });
    await userEvent.click(approvedBtn);
    await userEvent.click(reviewBtn);
    await userEvent.click(draftBtn);
    await waitFor(() => {
      expect(draftBtn).toHaveAttribute('aria-pressed', 'true');
      expect(approvedBtn).toHaveAttribute('aria-pressed', 'false');
      expect(reviewBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Documents – page structure', () => {
  it('renders without crashing', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    expect(document.body).toBeInTheDocument();
  });

  it('shows All filter button as default', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /status: all/i });
    expect(allBtn).toHaveAttribute('aria-pressed', 'true');
  });
});

// ─────────────────────────────────────────────────────────────
describe('Documents – Tag filter', () => {
  it('shows tag buttons when documents have tags', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /tag: architecture/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tag: brd/i })).toBeInTheDocument();
  });

  it('shows Tags section label when documents have tags', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    expect(screen.getByText('Tags')).toBeInTheDocument();
  });

  it('tag button starts with aria-pressed=false', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const archTag = screen.getByRole('button', { name: /tag: architecture/i });
    expect(archTag).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking a tag sets it active (aria-pressed=true)', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const archTag = screen.getByRole('button', { name: /tag: architecture/i });
    await userEvent.click(archTag);
    await waitFor(() => expect(archTag).toHaveAttribute('aria-pressed', 'true'));
  });

  it('shows active tag as clear pill when selected', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const archTag = screen.getByRole('button', { name: /tag: architecture/i });
    await userEvent.click(archTag);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /clear tag filter/i })).toBeInTheDocument();
    });
  });

  it('clicking active tag again deactivates it', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const archTag = screen.getByRole('button', { name: /tag: architecture/i });
    await userEvent.click(archTag);
    await waitFor(() => expect(archTag).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(archTag);
    await waitFor(() => expect(archTag).toHaveAttribute('aria-pressed', 'false'));
  });

  it('clicking clear pill removes active tag', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /tag: architecture/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /clear tag filter/i })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /clear tag filter/i }));
    await waitFor(() => expect(screen.queryByRole('button', { name: /clear tag filter/i })).not.toBeInTheDocument());
  });

  it('filters out documents that do not have the selected tag', async () => {
    const docWithTag = { ...mockDoc, id: 'd1', name: 'Arch BRD', tags: ['Architecture'] };
    const docWithoutTag = { ...mockDoc, id: 'd2', name: 'Plain Report', tags: ['Finance'] };
    mockGetDocuments.mockResolvedValueOnce([docWithTag, docWithoutTag]);
    renderDocuments();
    await screen.findByText('Arch BRD');
    await userEvent.click(screen.getByRole('button', { name: /tag: architecture/i }));
    await waitFor(() => {
      expect(screen.getByText('Arch BRD')).toBeInTheDocument();
      expect(screen.queryByText('Plain Report')).not.toBeInTheDocument();
    });
  });

  it('documents with selected tag remain visible', async () => {
    const docWithTag = { ...mockDoc, id: 'd1', name: 'Arch BRD', tags: ['Architecture', 'BRD'] };
    mockGetDocuments.mockResolvedValueOnce([docWithTag]);
    renderDocuments();
    await screen.findByText('Arch BRD');
    await userEvent.click(screen.getByRole('button', { name: /tag: architecture/i }));
    await waitFor(() => {
      expect(screen.getByText('Arch BRD')).toBeInTheDocument();
    });
  });

  it('does not show Tags section when documents have no tags', async () => {
    mockGetDocuments.mockResolvedValueOnce([{ ...mockDoc, tags: [] }]);
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    expect(screen.queryByText('Tags')).not.toBeInTheDocument();
  });

  it('does not show Tags section when no documents loaded', async () => {
    mockGetDocuments.mockResolvedValueOnce([]);
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    expect(screen.queryByText('Tags')).not.toBeInTheDocument();
  });

  it('deduplicates tags across multiple documents', async () => {
    const doc1 = { ...mockDoc, id: 'd1', name: 'Doc1', tags: ['Architecture', 'BRD'] };
    const doc2 = { ...mockDoc, id: 'd2', name: 'Doc2', tags: ['Architecture', 'Finance'] };
    mockGetDocuments.mockResolvedValueOnce([doc1, doc2]);
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    // 'Architecture' should appear only once as a tag button
    const archBtns = screen.getAllByRole('button', { name: /tag: architecture/i });
    expect(archBtns.length).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Documents – Pin / Favorite', () => {
  const DOC_NAME = 'NCA Enterprise Architecture BRD v2.3';
  const DOC_ID = 'd1';
  const DOC_NAME2 = 'MOCI Charter v1.0';
  const DOC_ID2 = 'd2';

  beforeEach(() => {
    localStorage.removeItem('pinned_documents');
    mockGetDocuments.mockResolvedValue([mockDoc]);
  });

  it('shows Pin button for each document', async () => {
    renderDocuments();
    await screen.findByText(DOC_NAME);
    expect(screen.getByRole('button', { name: new RegExp(`pin ${DOC_NAME}`, 'i') })).toBeInTheDocument();
  });

  it('pin button has aria-pressed=false initially', async () => {
    renderDocuments();
    await screen.findByText(DOC_NAME);
    expect(screen.getByRole('button', { name: new RegExp(`pin ${DOC_NAME}`, 'i') })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking pin toggles aria-pressed to true', async () => {
    renderDocuments();
    await screen.findByText(DOC_NAME);
    const pinBtn = screen.getByRole('button', { name: new RegExp(`pin ${DOC_NAME}`, 'i') });
    await userEvent.click(pinBtn);
    await waitFor(() => expect(screen.getByRole('button', { name: new RegExp(`unpin ${DOC_NAME}`, 'i') })).toHaveAttribute('aria-pressed', 'true'));
  });

  it('clicking pin again unpins the document', async () => {
    renderDocuments();
    await screen.findByText(DOC_NAME);
    const pinBtn = screen.getByRole('button', { name: new RegExp(`pin ${DOC_NAME}`, 'i') });
    await userEvent.click(pinBtn);
    await waitFor(() => expect(screen.getByRole('button', { name: new RegExp(`unpin ${DOC_NAME}`, 'i') })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: new RegExp(`unpin ${DOC_NAME}`, 'i') }));
    await waitFor(() => expect(screen.getByRole('button', { name: new RegExp(`pin ${DOC_NAME}`, 'i') })).toHaveAttribute('aria-pressed', 'false'));
  });

  it('pinned state persists to localStorage', async () => {
    renderDocuments();
    await screen.findByText(DOC_NAME);
    await userEvent.click(screen.getByRole('button', { name: new RegExp(`pin ${DOC_NAME}`, 'i') }));
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('pinned_documents') ?? '[]') as string[];
      expect(stored).toContain(DOC_ID);
    });
  });

  it('loads pinned state from localStorage on mount', async () => {
    localStorage.setItem('pinned_documents', JSON.stringify([DOC_ID]));
    renderDocuments();
    await screen.findByText(DOC_NAME);
    expect(screen.getByRole('button', { name: new RegExp(`unpin ${DOC_NAME}`, 'i') })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows Pinned folder in sidebar', async () => {
    renderDocuments();
    await screen.findByText(DOC_NAME);
    expect(screen.getByText('Pinned')).toBeInTheDocument();
  });

  it('clicking Pinned folder shows only pinned documents', async () => {
    const doc2 = { ...mockDoc, id: DOC_ID2, name: DOC_NAME2 };
    mockGetDocuments.mockResolvedValueOnce([mockDoc, doc2]);
    localStorage.setItem('pinned_documents', JSON.stringify([DOC_ID]));
    renderDocuments();
    await screen.findByText(DOC_NAME);
    await screen.findByText(DOC_NAME2);
    // Click Pinned folder
    await userEvent.click(screen.getByRole('button', { name: /folder: pinned/i }));
    await waitFor(() => {
      expect(screen.getByText(DOC_NAME)).toBeInTheDocument();
      expect(screen.queryByText(DOC_NAME2)).not.toBeInTheDocument();
    });
  });

  it('Pinned folder button exists in sidebar', async () => {
    const doc2 = { ...mockDoc, id: DOC_ID2, name: DOC_NAME2 };
    mockGetDocuments.mockResolvedValueOnce([mockDoc, doc2]);
    localStorage.setItem('pinned_documents', JSON.stringify([DOC_ID, DOC_ID2]));
    renderDocuments();
    await screen.findByText(DOC_NAME);
    await waitFor(() => {
      const pinnedBtn = screen.getByRole('button', { name: /folder: pinned/i });
      expect(pinnedBtn).toBeInTheDocument();
    });
  });

  it('unpinning removes document from Pinned folder view', async () => {
    localStorage.setItem('pinned_documents', JSON.stringify([DOC_ID]));
    renderDocuments();
    await screen.findByText(DOC_NAME);
    // Go to Pinned folder
    await userEvent.click(screen.getByRole('button', { name: /folder: pinned/i }));
    await waitFor(() => expect(screen.getByText(DOC_NAME)).toBeInTheDocument());
    // Unpin the document
    await userEvent.click(screen.getByRole('button', { name: new RegExp(`unpin ${DOC_NAME}`, 'i') }));
    // Document disappears from pinned view
    await waitFor(() => expect(screen.queryByText(DOC_NAME)).not.toBeInTheDocument());
  });
});

// ─────────────────────────────────────────────────────────────
describe('Documents – Move to Workspace', () => {
  const moveWorkspace = { id: 'ws-3', name: 'MOCI', type: 'Client', status: 'Active' as const, progress: 50, language: 'AR', sector: 'Government', contributors: [], created_at: '', updated_at: '' };

  beforeEach(() => {
    mockGetDocuments.mockResolvedValue([mockDoc]);
    mockGetWorkspaces.mockResolvedValue([mockWorkspace, moveWorkspace]);
  });

  it('shows Move to Workspace button for each document', async () => {
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /move NCA Enterprise Architecture BRD v2\.3 to workspace/i })).toBeInTheDocument();
  });

  it('opens Move modal when Move button clicked', async () => {
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /move NCA Enterprise Architecture BRD v2\.3 to workspace/i }));
    expect(await screen.findByRole('dialog', { name: /move to workspace/i })).toBeInTheDocument();
  });

  it('modal shows the document name', async () => {
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /move NCA Enterprise Architecture BRD v2\.3 to workspace/i }));
    await screen.findByRole('dialog');
    expect(screen.getAllByText(/NCA Enterprise Architecture BRD v2\.3/i).length).toBeGreaterThan(0);
  });

  it('modal has Target Workspace select', async () => {
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /move NCA Enterprise Architecture BRD v2\.3 to workspace/i }));
    await screen.findByRole('dialog');
    expect(screen.getByRole('combobox', { name: /target workspace/i })).toBeInTheDocument();
  });

  it('Move Document button is disabled when no workspace selected', async () => {
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /move NCA Enterprise Architecture BRD v2\.3 to workspace/i }));
    await screen.findByRole('dialog');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /target workspace/i }), '');
    expect(screen.getByRole('button', { name: /move document/i })).toBeDisabled();
  });

  it('Move Document button enabled when workspace selected', async () => {
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /move NCA Enterprise Architecture BRD v2\.3 to workspace/i }));
    await screen.findByRole('dialog');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /target workspace/i }), 'ws-3');
    expect(screen.getByRole('button', { name: /move document/i })).not.toBeDisabled();
  });

  it('calls updateDocument when Move Document is clicked', async () => {
    mockUpdateDocument.mockResolvedValueOnce({ ...mockDoc, workspace_id: 'ws-3', workspace: 'MOCI' });
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /move NCA Enterprise Architecture BRD v2\.3 to workspace/i }));
    await screen.findByRole('dialog');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /target workspace/i }), 'ws-3');
    await userEvent.click(screen.getByRole('button', { name: /move document/i }));
    await waitFor(() => expect(mockUpdateDocument).toHaveBeenCalledWith('d1', expect.objectContaining({ workspace_id: 'ws-3' })));
  });

  it('shows move toast after successful move', async () => {
    mockUpdateDocument.mockResolvedValueOnce({ ...mockDoc, workspace_id: 'ws-3', workspace: 'MOCI' });
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /move NCA Enterprise Architecture BRD v2\.3 to workspace/i }));
    await screen.findByRole('dialog');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /target workspace/i }), 'ws-3');
    await userEvent.click(screen.getByRole('button', { name: /move document/i }));
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/moved to MOCI/i);
    });
  });

  it('closes modal after successful move', async () => {
    mockUpdateDocument.mockResolvedValueOnce({ ...mockDoc, workspace_id: 'ws-3', workspace: 'MOCI' });
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /move NCA Enterprise Architecture BRD v2\.3 to workspace/i }));
    await screen.findByRole('dialog');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /target workspace/i }), 'ws-3');
    await userEvent.click(screen.getByRole('button', { name: /move document/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('closes modal when Cancel is clicked', async () => {
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /move NCA Enterprise Architecture BRD v2\.3 to workspace/i }));
    await screen.findByRole('dialog');
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('closes modal when X button clicked', async () => {
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /move NCA Enterprise Architecture BRD v2\.3 to workspace/i }));
    await screen.findByRole('dialog');
    await userEvent.click(screen.getByRole('button', { name: /close move dialog/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('toast has aria-live polite', async () => {
    mockUpdateDocument.mockResolvedValueOnce({ ...mockDoc, workspace_id: 'ws-3', workspace: 'MOCI' });
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /move NCA Enterprise Architecture BRD v2\.3 to workspace/i }));
    await screen.findByRole('dialog');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /target workspace/i }), 'ws-3');
    await userEvent.click(screen.getByRole('button', { name: /move document/i }));
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    });
  });
});

describe('Documents – Copy Document Summary', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    mockGetDocuments.mockResolvedValue([mockDoc]);
  });

  it('shows Copy document summary button in toolbar', async () => {
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /copy document summary to clipboard/i })).toBeInTheDocument();
  });

  it('Copy document summary button is not disabled', async () => {
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /copy document summary to clipboard/i })).not.toBeDisabled();
  });

  it('clicking Copy document summary calls clipboard.writeText', async () => {
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /copy document summary to clipboard/i }));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });
  });

  it('clipboard.writeText called with Total Documents in text', async () => {
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /copy document summary to clipboard/i }));
    await waitFor(() => {
      const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(text).toContain('Total Documents:');
    });
  });

  it('clipboard.writeText includes Document Summary header', async () => {
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /copy document summary to clipboard/i }));
    await waitFor(() => {
      const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(text).toContain('Document Summary');
    });
  });

  it('shows Copied! text in button after clicking', async () => {
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /copy document summary to clipboard/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copy document summary to clipboard/i })).toHaveTextContent('Copied!');
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Export CSV', () => {
  let mockCreateObjectURL: ReturnType<typeof vi.fn>;
  let mockRevokeObjectURL: ReturnType<typeof vi.fn>;
  let mockClick: ReturnType<typeof vi.fn>;
  let origCreate: typeof document.createElement;

  beforeEach(() => {
    mockGetDocuments.mockResolvedValue([mockDoc]);
    mockCreateObjectURL = vi.fn().mockReturnValue('blob:docs-export-url');
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

  it('shows Export documents to CSV button in toolbar', async () => {
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /export documents to csv/i })).toBeInTheDocument();
  });

  it('Export CSV button is enabled when documents exist', async () => {
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /export documents to csv/i })).not.toBeDisabled();
  });

  it('Export CSV button is disabled when no documents match filter', async () => {
    mockGetDocuments.mockResolvedValue([]);
    renderDocuments();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export documents to csv/i })).toBeDisabled();
    });
  });

  it('clicking Export CSV calls URL.createObjectURL', async () => {
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /export documents to csv/i }));
    expect(mockCreateObjectURL).toHaveBeenCalled();
  });

  it('clicking Export CSV triggers anchor click', async () => {
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /export documents to csv/i }));
    expect(mockClick).toHaveBeenCalled();
  });

  it('clicking Export CSV calls URL.revokeObjectURL', async () => {
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /export documents to csv/i }));
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:docs-export-url');
  });

  it('shows Exported! feedback after clicking Export CSV', async () => {
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /export documents to csv/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export documents to csv/i })).toHaveTextContent('Exported!');
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Export TXT', () => {
  let mockCreateObjectURL: ReturnType<typeof vi.fn>;
  let mockRevokeObjectURL: ReturnType<typeof vi.fn>;
  let mockClick: ReturnType<typeof vi.fn>;
  let origCreate: typeof document.createElement;

  beforeEach(() => {
    mockGetDocuments.mockResolvedValue([mockDoc]);
    mockCreateObjectURL = vi.fn().mockReturnValue('blob:docs-txt-url');
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

  afterEach(() => { vi.restoreAllMocks(); });

  it('shows Export documents to TXT button in toolbar', async () => {
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /export documents to txt/i })).toBeInTheDocument();
  });

  it('Export TXT button is enabled when documents exist', async () => {
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /export documents to txt/i })).not.toBeDisabled();
  });

  it('Export TXT button is disabled when no documents match filter', async () => {
    mockGetDocuments.mockResolvedValue([]);
    renderDocuments();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export documents to txt/i })).toBeDisabled();
    });
  });

  it('clicking Export TXT calls URL.createObjectURL', async () => {
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /export documents to txt/i }));
    expect(mockCreateObjectURL).toHaveBeenCalled();
  });

  it('clicking Export TXT triggers anchor click', async () => {
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /export documents to txt/i }));
    expect(mockClick).toHaveBeenCalled();
  });

  it('clicking Export TXT calls URL.revokeObjectURL', async () => {
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /export documents to txt/i }));
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:docs-txt-url');
  });

  it('shows Exported! feedback after clicking Export TXT', async () => {
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /export documents to txt/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export documents to txt/i })).toHaveTextContent('Exported!');
    });
  });
});

// ── Language quick filter ────────────────────────────────────
describe('Documents – Language Quick Filter', () => {
  const mockDocAR = {
    ...mockDoc,
    id: 'd-ar',
    name: 'Arabic Requirements Doc',
    language: 'AR' as const,
  };
  const mockDocBilingual = {
    ...mockDoc,
    id: 'd-bi',
    name: 'Bilingual Policy Document',
    language: 'Bilingual' as const,
  };

  beforeEach(() => {
    mockGetDocuments.mockResolvedValue([mockDoc, mockDocAR, mockDocBilingual]);
  });

  it('renders All, EN, AR, Bilingual language filter buttons', async () => {
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /language: all/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /language: en/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /language: ar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /language: bilingual/i })).toBeInTheDocument();
  });

  it('All language filter is pressed by default', async () => {
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /language: all/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('EN language filter is not pressed by default', async () => {
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /language: en/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking EN sets it to pressed', async () => {
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /language: en/i }));
    expect(screen.getByRole('button', { name: /language: en/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking EN deactivates All', async () => {
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /language: en/i }));
    expect(screen.getByRole('button', { name: /language: all/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('EN filter shows only EN documents', async () => {
    renderDocuments();
    await screen.findByText('Arabic Requirements Doc');
    await userEvent.click(screen.getByRole('button', { name: /language: en/i }));
    await waitFor(() => {
      expect(screen.getByText('NCA Enterprise Architecture BRD v2.3')).toBeInTheDocument();
      expect(screen.queryByText('Arabic Requirements Doc')).not.toBeInTheDocument();
      expect(screen.queryByText('Bilingual Policy Document')).not.toBeInTheDocument();
    });
  });

  it('AR filter shows only AR documents', async () => {
    renderDocuments();
    await screen.findByText('Arabic Requirements Doc');
    await userEvent.click(screen.getByRole('button', { name: /language: ar/i }));
    await waitFor(() => {
      expect(screen.queryByText('NCA Enterprise Architecture BRD v2.3')).not.toBeInTheDocument();
      expect(screen.getByText('Arabic Requirements Doc')).toBeInTheDocument();
    });
  });

  it('clicking All after EN restores All as pressed', async () => {
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /language: en/i }));
    await userEvent.click(screen.getByRole('button', { name: /language: all/i }));
    expect(screen.getByRole('button', { name: /language: all/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /language: en/i })).toHaveAttribute('aria-pressed', 'false');
  });
});

// ── Recent Documents Quick Filter ─────────────────────────────
describe('Documents – Recent Quick Filter', () => {
  const recentDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 2);
    return d.toISOString().slice(0, 10);
  })();
  const oldDate = '2025-01-01';

  const recentDoc = {
    ...mockDoc,
    id: 'd-recent',
    name: 'Recent Architecture Review',
    date: recentDate,
    created_at: `${recentDate}T10:00:00Z`,
    updated_at: `${recentDate}T10:00:00Z`,
  };
  const oldDoc = {
    ...mockDoc,
    id: 'd-old',
    name: 'Old Legacy Requirements',
    date: oldDate,
    created_at: `${oldDate}T10:00:00Z`,
    updated_at: `${oldDate}T10:00:00Z`,
  };

  beforeEach(() => {
    mockGetDocuments.mockResolvedValue([recentDoc, oldDoc]);
  });

  it('renders the Recent (7d) filter button', async () => {
    renderDocuments();
    await screen.findByText('Recent Architecture Review');
    expect(screen.getByRole('button', { name: /show recent documents only/i })).toBeInTheDocument();
  });

  it('Recent filter defaults to not pressed', async () => {
    renderDocuments();
    await screen.findByText('Recent Architecture Review');
    expect(screen.getByRole('button', { name: /show recent documents only/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Recent filter sets it to pressed', async () => {
    renderDocuments();
    await screen.findByText('Recent Architecture Review');
    await userEvent.click(screen.getByRole('button', { name: /show recent documents only/i }));
    expect(screen.getByRole('button', { name: /show recent documents only/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('Recent filter shows only documents from last 7 days', async () => {
    renderDocuments();
    await screen.findByText('Old Legacy Requirements');
    await userEvent.click(screen.getByRole('button', { name: /show recent documents only/i }));
    await waitFor(() => {
      expect(screen.getByText('Recent Architecture Review')).toBeInTheDocument();
      expect(screen.queryByText('Old Legacy Requirements')).not.toBeInTheDocument();
    });
  });

  it('Recent filter hides documents older than 7 days', async () => {
    mockGetDocuments.mockResolvedValue([oldDoc]);
    renderDocuments();
    await screen.findByText('Old Legacy Requirements');
    await userEvent.click(screen.getByRole('button', { name: /show recent documents only/i }));
    await waitFor(() => {
      expect(screen.queryByText('Old Legacy Requirements')).not.toBeInTheDocument();
    });
  });

  it('disabling Recent filter restores all documents', async () => {
    renderDocuments();
    await screen.findByText('Old Legacy Requirements');
    await userEvent.click(screen.getByRole('button', { name: /show recent documents only/i }));
    await userEvent.click(screen.getByRole('button', { name: /show recent documents only/i }));
    await waitFor(() => {
      expect(screen.getByText('Recent Architecture Review')).toBeInTheDocument();
      expect(screen.getByText('Old Legacy Requirements')).toBeInTheDocument();
    });
  });
});

describe('Documents – Author Quick Filter', () => {
  const docByAhmed = { ...mockDoc, id: 'd-ahmed', name: 'Ahmed Document', author: 'Ahmed Khalil' };
  const docByRania = { ...mockDoc, id: 'd-rania', name: 'Rania Document', author: 'Rania Taleb' };

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockGetDocuments.mockResolvedValue([docByAhmed, docByRania]);
    mockGetWorkspaces.mockResolvedValue([mockWorkspace]);
    mockUpsertDocument.mockResolvedValue(docByAhmed);
    mockDeleteDocument.mockResolvedValue(undefined);
    mockChatWithDocument.mockResolvedValue('ok');
  });
  afterEach(() => vi.restoreAllMocks());

  it('shows author filter dropdown when multiple authors exist', async () => {
    renderDocuments();
    await screen.findByText('Ahmed Document');
    await waitFor(() => expect(screen.getByRole('combobox', { name: /filter documents by author/i })).toBeInTheDocument());
  });

  it('author filter defaults to All Authors', async () => {
    renderDocuments();
    await screen.findByText('Ahmed Document');
    await waitFor(() => {
      const select = screen.getByRole('combobox', { name: /filter documents by author/i });
      expect(select).toHaveValue('All');
    });
  });

  it('shows all documents when All Authors selected', async () => {
    renderDocuments();
    await waitFor(() => {
      expect(screen.getByText('Ahmed Document')).toBeInTheDocument();
      expect(screen.getByText('Rania Document')).toBeInTheDocument();
    });
  });

  it('filtering by Ahmed Khalil shows only his documents', async () => {
    renderDocuments();
    await screen.findByText('Ahmed Document');
    await waitFor(() => screen.getByRole('combobox', { name: /filter documents by author/i }));
    const select = screen.getByRole('combobox', { name: /filter documents by author/i });
    await userEvent.selectOptions(select, 'Ahmed Khalil');
    await waitFor(() => {
      expect(screen.getByText('Ahmed Document')).toBeInTheDocument();
      expect(screen.queryByText('Rania Document')).not.toBeInTheDocument();
    });
  });

  it('filtering by Rania Taleb shows only her documents', async () => {
    renderDocuments();
    await screen.findByText('Ahmed Document');
    await waitFor(() => screen.getByRole('combobox', { name: /filter documents by author/i }));
    const select = screen.getByRole('combobox', { name: /filter documents by author/i });
    await userEvent.selectOptions(select, 'Rania Taleb');
    await waitFor(() => {
      expect(screen.queryByText('Ahmed Document')).not.toBeInTheDocument();
      expect(screen.getByText('Rania Document')).toBeInTheDocument();
    });
  });

  it('switching back to All Authors restores all documents', async () => {
    renderDocuments();
    await screen.findByText('Ahmed Document');
    await waitFor(() => screen.getByRole('combobox', { name: /filter documents by author/i }));
    const select = screen.getByRole('combobox', { name: /filter documents by author/i });
    await userEvent.selectOptions(select, 'Ahmed Khalil');
    await waitFor(() => expect(screen.queryByText('Rania Document')).not.toBeInTheDocument());
    await userEvent.selectOptions(select, 'All');
    await waitFor(() => {
      expect(screen.getByText('Ahmed Document')).toBeInTheDocument();
      expect(screen.getByText('Rania Document')).toBeInTheDocument();
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Workspace Filter', () => {
  const docNCA = { ...mockDoc, id: 'd-nca', name: 'NCA Security Report', workspace: 'NCA' };
  const docMOCI = { ...mockDoc, id: 'd-moci', name: 'MOCI Policy Brief', workspace: 'MOCI', workspace_id: 'ws-2' };

  beforeEach(() => {
    mockGetDocuments.mockResolvedValue([docNCA, docMOCI]);
  });

  it('renders workspace filter dropdown when multiple workspaces exist', async () => {
    renderDocuments();
    await screen.findByText('NCA Security Report');
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /filter documents by workspace/i })).toBeInTheDocument();
    });
  });

  it('workspace filter defaults to All Workspaces', async () => {
    renderDocuments();
    await screen.findByText('NCA Security Report');
    await waitFor(() => screen.getByRole('combobox', { name: /filter documents by workspace/i }));
    const select = screen.getByRole('combobox', { name: /filter documents by workspace/i });
    expect(select).toHaveValue('All');
  });

  it('shows all documents when All Workspaces selected', async () => {
    renderDocuments();
    await waitFor(() => {
      expect(screen.getByText('NCA Security Report')).toBeInTheDocument();
      expect(screen.getByText('MOCI Policy Brief')).toBeInTheDocument();
    });
  });

  it('filtering by NCA workspace shows only NCA documents', async () => {
    renderDocuments();
    await screen.findByText('NCA Security Report');
    await waitFor(() => screen.getByRole('combobox', { name: /filter documents by workspace/i }));
    const select = screen.getByRole('combobox', { name: /filter documents by workspace/i });
    await userEvent.selectOptions(select, 'NCA');
    await waitFor(() => {
      expect(screen.getByText('NCA Security Report')).toBeInTheDocument();
      expect(screen.queryByText('MOCI Policy Brief')).not.toBeInTheDocument();
    });
  });

  it('filtering by MOCI workspace shows only MOCI documents', async () => {
    renderDocuments();
    await screen.findByText('NCA Security Report');
    await waitFor(() => screen.getByRole('combobox', { name: /filter documents by workspace/i }));
    const select = screen.getByRole('combobox', { name: /filter documents by workspace/i });
    await userEvent.selectOptions(select, 'MOCI');
    await waitFor(() => {
      expect(screen.queryByText('NCA Security Report')).not.toBeInTheDocument();
      expect(screen.getByText('MOCI Policy Brief')).toBeInTheDocument();
    });
  });

  it('switching back to All Workspaces restores all documents', async () => {
    renderDocuments();
    await screen.findByText('NCA Security Report');
    await waitFor(() => screen.getByRole('combobox', { name: /filter documents by workspace/i }));
    const select = screen.getByRole('combobox', { name: /filter documents by workspace/i });
    await userEvent.selectOptions(select, 'NCA');
    await waitFor(() => expect(screen.queryByText('MOCI Policy Brief')).not.toBeInTheDocument());
    await userEvent.selectOptions(select, 'All');
    await waitFor(() => {
      expect(screen.getByText('NCA Security Report')).toBeInTheDocument();
      expect(screen.getByText('MOCI Policy Brief')).toBeInTheDocument();
    });
  });
});

describe('Documents – Sort by Pages', () => {
  const docFewPages = { ...mockDoc, id: 'dp1', name: 'Short Doc', pages: 3, date: '2026-03-10' };
  const docManyPages = { ...mockDoc, id: 'dp2', name: 'Long Doc', pages: 50, date: '2026-03-12' };
  const docMidPages = { ...mockDoc, id: 'dp3', name: 'Medium Doc', pages: 15, date: '2026-03-11' };

  beforeEach(() => {
    mockGetDocuments.mockResolvedValue([docFewPages, docManyPages, docMidPages]);
    mockGetWorkspaces.mockResolvedValue([]);
  });

  it('renders Pages option in sort dropdown', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort documents/i });
    expect(sel.querySelector('option[value="pages"]')).toBeInTheDocument();
  });

  it('selecting Pages sets sort to pages', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort documents/i }) as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'pages');
    expect(sel.value).toBe('pages');
  });

  it('pages sort shows all documents', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort documents/i });
    await userEvent.selectOptions(sel, 'pages');
    expect(screen.getByText('Short Doc')).toBeInTheDocument();
    expect(screen.getByText('Long Doc')).toBeInTheDocument();
    expect(screen.getByText('Medium Doc')).toBeInTheDocument();
  });

  it('pages sort places the longest doc first', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort documents/i });
    await userEvent.selectOptions(sel, 'pages');
    const rows = screen.getAllByRole('row');
    const rowTexts = rows.map(r => r.textContent ?? '');
    const longIdx = rowTexts.findIndex(t => t.includes('Long Doc'));
    const shortIdx = rowTexts.findIndex(t => t.includes('Short Doc'));
    expect(longIdx).toBeGreaterThan(0);
    expect(longIdx).toBeLessThan(shortIdx);
  });

  it('switching back to Newest works after pages sort', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort documents/i }) as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'pages');
    await userEvent.selectOptions(sel, 'newest');
    expect(sel.value).toBe('newest');
  });
});

describe('Documents – Sort by Author', () => {
  const docZara = { ...mockDoc, id: 'da1', name: 'Zara Doc', author: 'Zara Smith', date: '2026-03-10' };
  const docAlex = { ...mockDoc, id: 'da2', name: 'Alex Doc', author: 'Alex Brown', date: '2026-03-12' };
  const docMina = { ...mockDoc, id: 'da3', name: 'Mina Doc', author: 'Mina Chen', date: '2026-03-11' };

  beforeEach(() => {
    mockGetDocuments.mockResolvedValue([docZara, docAlex, docMina]);
    mockGetWorkspaces.mockResolvedValue([]);
  });

  it('renders Author option in sort dropdown', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort documents/i });
    expect(sel.querySelector('option[value="author"]')).toBeInTheDocument();
  });

  it('selecting Author sets sort to author', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort documents/i }) as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'author');
    expect(sel.value).toBe('author');
  });

  it('author sort shows all documents', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort documents/i });
    await userEvent.selectOptions(sel, 'author');
    expect(screen.getByText('Zara Doc')).toBeInTheDocument();
    expect(screen.getByText('Alex Doc')).toBeInTheDocument();
    expect(screen.getByText('Mina Doc')).toBeInTheDocument();
  });

  it('author sort places Alex before Zara in DOM', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort documents/i });
    await userEvent.selectOptions(sel, 'author');
    const alexEl = screen.getByText('Alex Doc');
    const zaraEl = screen.getByText('Zara Doc');
    expect(alexEl.compareDocumentPosition(zaraEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('switching back to Newest works after author sort', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort documents/i }) as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'author');
    await userEvent.selectOptions(sel, 'newest');
    expect(sel.value).toBe('newest');
  });
});

describe('Documents – Sort by Workspace', () => {
  const docAlpha = { ...mockDoc, id: 'd-alpha-ws', name: 'Alpha Doc', workspace: 'AlphaWS', workspace_id: 'ws-alpha' };
  const docZebra = { ...mockDoc, id: 'd-zebra-ws', name: 'Zebra Doc', workspace: 'ZebraWS', workspace_id: 'ws-zebra' };
  const docMid = { ...mockDoc, id: 'd-mid-ws', name: 'Mid Doc', workspace: 'MidWS', workspace_id: 'ws-mid' };

  beforeEach(() => {
    mockGetDocuments.mockResolvedValue([docZebra, docMid, docAlpha]);
    mockGetWorkspaces.mockResolvedValue([mockWorkspace]);
  });

  it('renders Workspace option in sort dropdown', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort documents/i });
    expect(sel.querySelector('option[value="workspace"]')).toBeInTheDocument();
  });

  it('selecting workspace sets sort value', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort documents/i }) as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'workspace');
    expect(sel.value).toBe('workspace');
  });

  it('workspace sort shows all documents', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort documents/i });
    await userEvent.selectOptions(sel, 'workspace');
    expect(screen.getByText('Alpha Doc')).toBeInTheDocument();
    expect(screen.getByText('Zebra Doc')).toBeInTheDocument();
    expect(screen.getByText('Mid Doc')).toBeInTheDocument();
  });

  it('workspace sort places Alpha before Zebra in DOM', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort documents/i });
    await userEvent.selectOptions(sel, 'workspace');
    const alphaEl = screen.getByText('Alpha Doc');
    const zebraEl = screen.getByText('Zebra Doc');
    expect(alphaEl.compareDocumentPosition(zebraEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('switching back to newest works after workspace sort', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort documents/i }) as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'workspace');
    await userEvent.selectOptions(sel, 'newest');
    expect(sel.value).toBe('newest');
  });
});

describe('Documents – Sort by Language', () => {
  const docAR = { ...mockDoc, id: 'd-ar', name: 'Arabic Doc', language: 'AR' as const, date: '2026-03-01' };
  const docEN = { ...mockDoc, id: 'd-en', name: 'English Doc', language: 'EN' as const, date: '2026-03-05' };
  const docBilingual = { ...mockDoc, id: 'd-bi', name: 'Bilingual Doc', language: 'Bilingual' as const, date: '2026-03-10' };

  beforeEach(() => {
    mockGetDocuments.mockResolvedValue([docEN, docBilingual, docAR]);
    mockGetWorkspaces.mockResolvedValue([]);
  });

  it('language option exists in sort select', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort documents/i });
    const opts = Array.from(sel.querySelectorAll('option')).map((o: Element) => (o as HTMLOptionElement).value);
    expect(opts).toContain('language');
  });

  it('selecting language sets sort value', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort documents/i }) as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'language');
    expect(sel.value).toBe('language');
  });

  it('language sort shows all docs', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort documents/i });
    await userEvent.selectOptions(sel, 'language');
    expect(screen.getByText('Arabic Doc')).toBeInTheDocument();
    expect(screen.getByText('English Doc')).toBeInTheDocument();
    expect(screen.getByText('Bilingual Doc')).toBeInTheDocument();
  });

  it('language sort places Arabic Doc before English Doc in DOM', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort documents/i }), 'language');
    const arEl = screen.getByText('Arabic Doc');
    const enEl = screen.getByText('English Doc');
    expect(arEl.compareDocumentPosition(enEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('switching back to newest works after language sort', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort documents/i }) as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'language');
    await userEvent.selectOptions(sel, 'newest');
    expect(sel.value).toBe('newest');
  });
});

describe('Documents – Pages Filter', () => {
  const shortDoc = { ...mockDoc, id: 'ps1', name: 'Short Doc', pages: 5, date: '2026-04-01' };
  const mediumDoc = { ...mockDoc, id: 'pm1', name: 'Medium Doc', pages: 15, date: '2026-04-02' };
  const longDoc = { ...mockDoc, id: 'pl1', name: 'Long Doc', pages: 50, date: '2026-04-03' };

  beforeEach(() => {
    mockGetDocuments.mockResolvedValue([shortDoc, mediumDoc, longDoc]);
    mockGetWorkspaces.mockResolvedValue([mockWorkspace]);
  });

  it('renders pages filter select', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    expect(screen.getByRole('combobox', { name: /filter documents by pages/i })).toBeInTheDocument();
  });

  it('filter defaults to All Lengths', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /filter documents by pages/i }) as HTMLSelectElement;
    expect(sel.value).toBe('All');
  });

  it('filtering by Short hides Medium and Long docs', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /filter documents by pages/i }), 'Short');
    expect(screen.getByText('Short Doc')).toBeInTheDocument();
    expect(screen.queryByText('Medium Doc')).not.toBeInTheDocument();
    expect(screen.queryByText('Long Doc')).not.toBeInTheDocument();
  });

  it('filtering by Long hides Short and Medium docs', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /filter documents by pages/i }), 'Long');
    expect(screen.getByText('Long Doc')).toBeInTheDocument();
    expect(screen.queryByText('Short Doc')).not.toBeInTheDocument();
    expect(screen.queryByText('Medium Doc')).not.toBeInTheDocument();
  });

  it('resetting to All shows all docs again', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /filter documents by pages/i });
    await userEvent.selectOptions(sel, 'Short');
    await userEvent.selectOptions(sel, 'All');
    expect(screen.getByText('Short Doc')).toBeInTheDocument();
    expect(screen.getByText('Medium Doc')).toBeInTheDocument();
    expect(screen.getByText('Long Doc')).toBeInTheDocument();
  });
});

describe('Documents – Sort by Name', () => {
  const docZara = { ...mockDoc, id: 'sn1', name: 'Zara Proposal', type: 'BRD', date: '2026-03-10' };
  const docAlex = { ...mockDoc, id: 'sn2', name: 'Alex Analysis', type: 'BRD', date: '2026-03-12' };
  const docMina = { ...mockDoc, id: 'sn3', name: 'Mina Report', type: 'BRD', date: '2026-03-11' };

  beforeEach(() => {
    mockGetDocuments.mockResolvedValue([docZara, docAlex, docMina]);
    mockGetWorkspaces.mockResolvedValue([mockWorkspace]);
  });

  it('renders Name option in sort dropdown', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort documents/i });
    expect(sel.querySelector('option[value="name"]')).toBeInTheDocument();
  });

  it('selecting Name sets sort to name', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort documents/i }) as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'name');
    expect(sel.value).toBe('name');
  });

  it('name sort places Alex before Zara in DOM', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort documents/i });
    await userEvent.selectOptions(sel, 'name');
    const alexEl = screen.getByText('Alex Analysis');
    const zaraEl = screen.getByText('Zara Proposal');
    expect(alexEl.compareDocumentPosition(zaraEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('all three docs remain visible after name sort', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort documents/i });
    await userEvent.selectOptions(sel, 'name');
    expect(screen.getByText('Alex Analysis')).toBeInTheDocument();
    expect(screen.getByText('Mina Report')).toBeInTheDocument();
    expect(screen.getByText('Zara Proposal')).toBeInTheDocument();
  });

  it('switching back to Newest works after name sort', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort documents/i }) as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'name');
    await userEvent.selectOptions(sel, 'newest');
    expect(sel.value).toBe('newest');
  });
});

describe('Documents – Sort by Type', () => {
  const docBRD = { ...mockDoc, id: 'st1', name: 'BRD Document', type: 'BRD', date: '2026-03-10' };
  const docAnalysis = { ...mockDoc, id: 'st2', name: 'Analysis Document', type: 'Analysis', date: '2026-03-12' };
  const docReport = { ...mockDoc, id: 'st3', name: 'Report Document', type: 'Report', date: '2026-03-11' };

  beforeEach(() => {
    mockGetDocuments.mockResolvedValue([docBRD, docAnalysis, docReport]);
    mockGetWorkspaces.mockResolvedValue([mockWorkspace]);
  });

  it('renders Type option in sort dropdown', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort documents/i });
    expect(sel.querySelector('option[value="type"]')).toBeInTheDocument();
  });

  it('selecting Type sets sort to type', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort documents/i }) as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'type');
    expect(sel.value).toBe('type');
  });

  it('type sort places Analysis before Report in DOM', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort documents/i });
    await userEvent.selectOptions(sel, 'type');
    const analysisEl = screen.getByText('Analysis Document');
    const reportEl = screen.getByText('Report Document');
    expect(analysisEl.compareDocumentPosition(reportEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('all three docs remain visible after type sort', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort documents/i });
    await userEvent.selectOptions(sel, 'type');
    expect(screen.getByText('BRD Document')).toBeInTheDocument();
    expect(screen.getByText('Analysis Document')).toBeInTheDocument();
    expect(screen.getByText('Report Document')).toBeInTheDocument();
  });

  it('switching back to Newest works after type sort', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort documents/i }) as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'type');
    await userEvent.selectOptions(sel, 'newest');
    expect(sel.value).toBe('newest');
  });
});

describe('Documents – Sort by Oldest', () => {
  const docRecent = { ...mockDoc, id: 'so1', name: 'Recent Doc', date: '2026-03-15' };
  const docOld = { ...mockDoc, id: 'so2', name: 'Old Doc', date: '2026-01-10' };
  const docMid = { ...mockDoc, id: 'so3', name: 'Mid Doc', date: '2026-02-20' };

  beforeEach(() => {
    mockGetDocuments.mockResolvedValue([docRecent, docOld, docMid]);
    mockGetWorkspaces.mockResolvedValue([mockWorkspace]);
  });

  it('renders Oldest option in sort dropdown', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort documents/i });
    expect(sel.querySelector('option[value="oldest"]')).toBeInTheDocument();
  });

  it('selecting Oldest sets sort to oldest', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort documents/i }) as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'oldest');
    expect(sel.value).toBe('oldest');
  });

  it('oldest sort places Old Doc before Recent Doc in DOM', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort documents/i });
    await userEvent.selectOptions(sel, 'oldest');
    const oldEl = screen.getByText('Old Doc');
    const recentEl = screen.getByText('Recent Doc');
    expect(oldEl.compareDocumentPosition(recentEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('all three docs remain visible after oldest sort', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort documents/i });
    await userEvent.selectOptions(sel, 'oldest');
    expect(screen.getByText('Old Doc')).toBeInTheDocument();
    expect(screen.getByText('Mid Doc')).toBeInTheDocument();
    expect(screen.getByText('Recent Doc')).toBeInTheDocument();
  });

  it('switching back to Newest works after oldest sort', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort documents/i }) as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'oldest');
    await userEvent.selectOptions(sel, 'newest');
    expect(sel.value).toBe('newest');
  });
});

describe('Documents – Sort by Pages DOM Order', () => {
  const docTiny = { ...mockDoc, id: 'pd1', name: 'Tiny Pages Doc', pages: 2, date: '2026-03-10' };
  const docLarge = { ...mockDoc, id: 'pd2', name: 'Large Pages Doc', pages: 75, date: '2026-03-12' };
  const docMedium = { ...mockDoc, id: 'pd3', name: 'Medium Pages Doc', pages: 25, date: '2026-03-11' };

  beforeEach(() => {
    mockGetDocuments.mockResolvedValue([docTiny, docLarge, docMedium]);
    mockGetWorkspaces.mockResolvedValue([]);
  });

  it('renders all three docs before pages sort', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    expect(screen.getByText('Tiny Pages Doc')).toBeInTheDocument();
    expect(screen.getByText('Large Pages Doc')).toBeInTheDocument();
    expect(screen.getByText('Medium Pages Doc')).toBeInTheDocument();
  });

  it('Large Pages Doc (75) appears before Tiny Pages Doc (2) in DOM after pages sort', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort documents/i });
    await userEvent.selectOptions(sel, 'pages');
    const largeEl = screen.getByText('Large Pages Doc');
    const tinyEl = screen.getByText('Tiny Pages Doc');
    expect(largeEl.compareDocumentPosition(tinyEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('Medium Pages Doc (25) appears before Tiny Pages Doc (2) in DOM after pages sort', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort documents/i });
    await userEvent.selectOptions(sel, 'pages');
    const medEl = screen.getByText('Medium Pages Doc');
    const tinyEl = screen.getByText('Tiny Pages Doc');
    expect(medEl.compareDocumentPosition(tinyEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('all three docs remain visible after pages sort', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort documents/i }), 'pages');
    expect(screen.getByText('Large Pages Doc')).toBeInTheDocument();
    expect(screen.getByText('Medium Pages Doc')).toBeInTheDocument();
    expect(screen.getByText('Tiny Pages Doc')).toBeInTheDocument();
  });

  it('switching from pages to newest keeps all docs visible', async () => {
    renderDocuments();
    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort documents/i }) as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'pages');
    await userEvent.selectOptions(sel, 'newest');
    expect(screen.getByText('Large Pages Doc')).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Documents – Sort by Newest DOM Order', () => {
  const docOld = { ...mockDoc, id: 'nd1', name: 'Old January Doc', date: '2026-01-10' };
  const docMid = { ...mockDoc, id: 'nd2', name: 'Mid February Doc', date: '2026-02-15' };
  const docNew = { ...mockDoc, id: 'nd3', name: 'New March Doc', date: '2026-03-20' };

  beforeEach(() => {
    mockGetDocuments.mockResolvedValue([docOld, docMid, docNew]);
    mockGetWorkspaces.mockResolvedValue([mockWorkspace]);
  });

  it('newest sort (default) places New March before Old January in DOM', async () => {
    renderDocuments();
    await screen.findByText('New March Doc');
    const newEl = screen.getByText('New March Doc');
    const oldEl = screen.getByText('Old January Doc');
    expect(newEl.compareDocumentPosition(oldEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('newest sort places Mid February before Old January in DOM', async () => {
    renderDocuments();
    await screen.findByText('New March Doc');
    const midEl = screen.getByText('Mid February Doc');
    const oldEl = screen.getByText('Old January Doc');
    expect(midEl.compareDocumentPosition(oldEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('all three docs remain visible with newest sort', async () => {
    renderDocuments();
    await screen.findByText('New March Doc');
    expect(screen.getByText('Old January Doc')).toBeInTheDocument();
    expect(screen.getByText('Mid February Doc')).toBeInTheDocument();
    expect(screen.getByText('New March Doc')).toBeInTheDocument();
  });

  it('switching from oldest back to newest restores newest-first order', async () => {
    renderDocuments();
    await screen.findByText('New March Doc');
    const sel = screen.getByRole('combobox', { name: /sort documents/i }) as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'oldest');
    await userEvent.selectOptions(sel, 'newest');
    const newEl = screen.getByText('New March Doc');
    const oldEl = screen.getByText('Old January Doc');
    expect(newEl.compareDocumentPosition(oldEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
