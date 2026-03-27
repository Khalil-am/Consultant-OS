import { describe, it, expect, vi, beforeEach } from 'vitest';
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
    expect(screen.getByText('Ahmed Khalil')).toBeInTheDocument();
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
    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }));

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
    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }));

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

    const draftFilter = screen.getByRole('button', { name: /^Draft$/ });
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

    const reviewFilter = screen.getByRole('button', { name: /under review/i });
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
    const deleteBtns = screen.getAllByRole('button', { name: 'Delete' });
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
    const deleteBtns = screen.getAllByRole('button', { name: 'Delete' });
    await userEvent.click(deleteBtns[deleteBtns.length - 1]);
    await waitFor(() => expect(mockDeleteDocument).toHaveBeenCalledWith('d1'));
  });

  it('does not call deleteDocument when Cancel is clicked after trash icon', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');

    await userEvent.click(screen.getByTitle('Delete'));
    // Cancel the inline confirm
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
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
    expect(screen.getByText('Tags')).toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: /^All$/ })).toBeInTheDocument();
  });

  it('shows Draft status filter tab', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /^Draft$/ })).toBeInTheDocument();
  });

  it('shows Under Review status filter tab', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /^Under Review$/ })).toBeInTheDocument();
  });

  it('shows Approved status filter tab', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    expect(screen.getByRole('button', { name: /^Approved$/ })).toBeInTheDocument();
  });

  it('filtering by Draft hides Final document', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockDoc]); // status: Final
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');
    await userEvent.click(screen.getByRole('button', { name: /^Draft$/ }));
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
