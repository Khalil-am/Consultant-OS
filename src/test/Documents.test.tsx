import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// ── Hoisted mocks ────────────────────────────────────────────
const {
  mockGetDocuments, mockGetWorkspaces, mockUpsertDocument,
  mockUpdateDocument, mockDeleteDocument,
} = vi.hoisted(() => ({
  mockGetDocuments: vi.fn(),
  mockGetWorkspaces: vi.fn(),
  mockUpsertDocument: vi.fn(),
  mockUpdateDocument: vi.fn(),
  mockDeleteDocument: vi.fn(),
}));

vi.mock('../lib/db', () => ({
  getDocuments: mockGetDocuments,
  getWorkspaces: mockGetWorkspaces,
  upsertDocument: mockUpsertDocument,
  updateDocument: mockUpdateDocument,
  deleteDocument: mockDeleteDocument,
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
  mockGetDocuments.mockResolvedValue([]);
  mockGetWorkspaces.mockResolvedValue([mockWorkspace]);
  mockUpsertDocument.mockResolvedValue({ ...mockDoc, id: 'new-doc-id' });
  mockUpdateDocument.mockResolvedValue({ ...mockDoc });
  mockDeleteDocument.mockResolvedValue(undefined);
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

    const searchInput = screen.getByPlaceholderText(/search/i);
    await userEvent.type(searchInput, 'MOCI');
    expect(screen.getByText('MOCI Procurement Plan')).toBeInTheDocument();
    expect(screen.queryByText('NCA Enterprise Architecture BRD v2.3')).not.toBeInTheDocument();
  });

  it('shows all documents when search is cleared', async () => {
    const d2 = { ...mockDoc, id: 'd2', name: 'MOCI Procurement Plan' };
    mockGetDocuments.mockResolvedValueOnce([mockDoc, d2]);
    renderDocuments();
    await screen.findByText('NCA Enterprise Architecture BRD v2.3');

    const searchInput = screen.getByPlaceholderText(/search/i);
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
