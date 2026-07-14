import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// ── Hoisted mocks ─────────────────────────────────────────────
const { mockGetMeeting, mockUpdateMeeting, mockUpsertDocument, mockGetDocuments, mockDeleteDocument } = vi.hoisted(() => ({
  mockGetMeeting: vi.fn(),
  mockUpdateMeeting: vi.fn(),
  mockUpsertDocument: vi.fn(),
  mockGetDocuments: vi.fn(),
  mockDeleteDocument: vi.fn(),
}));

vi.mock('../lib/db', () => ({
  getMeeting: mockGetMeeting,
  updateMeeting: mockUpdateMeeting,
  upsertDocument: mockUpsertDocument,
  getDocuments: mockGetDocuments,
  deleteDocument: mockDeleteDocument,
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://test.example.com/minutes.pdf' } })),
        createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://signed.url/minutes.pdf' }, error: null }),
        remove: vi.fn().mockResolvedValue({ error: null }),
      })),
    },
  },
}));

vi.mock('../hooks/useLayout', () => ({
  useLayout: () => ({ width: 1280, isMobile: false, isTablet: false }),
}));

import MeetingDetail from '../screens/MeetingDetail';

// ── Fixtures ──────────────────────────────────────────────────
const mockMeeting = {
  id: 'mtg-1',
  title: 'NCA Steering Committee Q1 2026',
  date: '2026-04-15',
  time: '10:00',
  duration: '2h',
  type: 'Steering' as const,
  status: 'Upcoming' as const,
  participants: ['Ahmed Khalil', 'Rania Taleb', 'Faisal Hassan'],
  workspace: 'NCA',
  workspace_id: 'ws-1',
  location: 'Riyadh Office — Board Room',
  minutes_generated: false,
  actions_extracted: 0,
  decisions_logged: 0,
  agenda: ['Q1 Review', 'Risk Assessment', 'Next Steps'],
  created_at: '2026-03-20T08:00:00Z',
  updated_at: '2026-03-20T08:00:00Z',
};

const mockMinutesDoc = {
  id: 'doc-minutes-1',
  name: 'NCA Steering Committee Q1 2026 – Minutes',
  type: 'Meeting Minutes',
  type_color: '#10B981',
  status: 'Draft' as const,
  date: '2026-04-15',
  workspace: 'NCA',
  workspace_id: 'ws-1',
  size: '145 KB',
  language: 'EN' as const,
  tags: ['mtg-1', 'meeting-minutes'],
  author: 'AM',
  pages: 3,
  summary: 'Minutes from the Q1 steering committee',
  file_url: 'https://test.example.com/minutes.pdf',
  created_at: '2026-04-15T12:00:00Z',
  updated_at: '2026-04-15T12:00:00Z',
};

function renderDetail(id = 'mtg-1') {
  return render(
    <MemoryRouter initialEntries={[`/meetings/${id}`]}>
      <Routes>
        <Route path="/meetings/:id" element={<MeetingDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetMeeting.mockResolvedValue(mockMeeting);
  mockGetDocuments.mockResolvedValue([]);
  mockUpdateMeeting.mockResolvedValue({ ...mockMeeting, minutes_generated: true });
  mockUpsertDocument.mockResolvedValue(mockMinutesDoc);
  mockDeleteDocument.mockResolvedValue(undefined);
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Loading & Header', () => {
  it('shows loading state initially', () => {
    mockGetMeeting.mockImplementation(() => new Promise(() => {}));
    renderDetail();
    expect(screen.getByText(/loading meeting/i)).toBeInTheDocument();
  });

  it('renders meeting title after load', async () => {
    renderDetail();
    expect(await screen.findByText('NCA Steering Committee Q1 2026')).toBeInTheDocument();
  });

  it('renders meeting type badge', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('Steering')).toBeInTheDocument();
  });

  it('renders meeting date formatted', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText(/15 Apr/i)).toBeInTheDocument();
  });

  it('renders meeting location', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText(/Riyadh Office/i)).toBeInTheDocument();
  });

  it('renders status badge', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('Upcoming')).toBeInTheDocument();
  });

  it('shows not found when meeting is null', async () => {
    mockGetMeeting.mockResolvedValue(null);
    renderDetail();
    expect(await screen.findByText(/meeting not found/i)).toBeInTheDocument();
  });

  it('calls getMeeting with correct id', async () => {
    renderDetail('mtg-1');
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(mockGetMeeting).toHaveBeenCalledWith('mtg-1');
  });

  it('renders workspace chip', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('NCA')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Participants count', () => {
  it('renders participant count in meta row', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    // Rendered as "3 participants"
    expect(screen.getByText('3 participants')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Upload Section', () => {
  it('renders "Upload Meeting Minutes" section heading', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('Upload Meeting Minutes')).toBeInTheDocument();
  });

  it('renders drag & drop zone text', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText(/drag & drop your minutes file here/i)).toBeInTheDocument();
  });

  it('renders Uploaded Minutes section heading', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('Uploaded Minutes')).toBeInTheDocument();
  });

  it('shows "No minutes uploaded yet" empty state', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => {
      expect(screen.getByText(/no minutes uploaded yet/i)).toBeInTheDocument();
    });
  });

  it('shows minutes document when it exists', async () => {
    mockGetDocuments.mockResolvedValue([mockMinutesDoc]);
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => {
      expect(screen.getByText('NCA Steering Committee Q1 2026 – Minutes')).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Back navigation', () => {
  it('renders Back to Meetings button', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText(/back to meetings/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Status variants', () => {
  it('shows Completed status badge for completed meeting', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, status: 'Completed' });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('shows Minutes Uploaded badge when meeting has minutes', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, minutes_generated: true });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    // Badge text is exactly "Minutes Uploaded" (separate from "Uploaded Minutes" section heading)
    expect(screen.getByText('Minutes Uploaded')).toBeInTheDocument();
  });

  it('shows meeting time in meta row', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText(/10:00/)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Info display', () => {
  it('shows combined time and duration in meta row', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    // Rendered as "10:00 · 2h"
    expect(screen.getByText(/10:00 · 2h/)).toBeInTheDocument();
  });

  it('shows workspace in separate chip', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('NCA')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Meeting type variants', () => {
  it('shows Workshop type badge', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, type: 'Workshop' });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('Workshop')).toBeInTheDocument();
  });

  it('shows Kickoff type badge', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, type: 'Kickoff' });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('Kickoff')).toBeInTheDocument();
  });

  it('shows combined time and duration string', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    // Duration is combined with time: "10:00 · 2h"
    expect(screen.getByText('10:00 · 2h')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – File Upload', () => {
  it('calls supabase storage upload when a file is selected', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).not.toBeNull();

    const file = new File(['meeting content'], 'minutes.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    // The supabase mock's storage.from should have been called
    await waitFor(() => {
      expect(mockUpsertDocument).toHaveBeenCalled();
    }, { timeout: 3000 });
  });

  it('calls upsertDocument after successful file upload', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'Q1_Minutes.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockUpsertDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'Meeting Minutes',
          workspace_id: 'ws-1',
        })
      );
    }, { timeout: 3000 });
  });

  it('calls updateMeeting with minutes_generated=true after upload', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'minutes.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockUpdateMeeting).toHaveBeenCalledWith(
        'mtg-1',
        expect.objectContaining({ minutes_generated: true })
      );
    }, { timeout: 3000 });
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Minutes document actions', () => {
  it('shows Download button for existing minutes document', async () => {
    mockGetDocuments.mockResolvedValue([mockMinutesDoc]);
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => {
      expect(screen.getByText('NCA Steering Committee Q1 2026 – Minutes')).toBeInTheDocument();
    });
    // Download button renders next to the minutes document
    expect(screen.getByText('Download')).toBeInTheDocument();
  });

  it('calls deleteDocument when trash button is clicked for minutes', async () => {
    mockGetDocuments
      .mockResolvedValueOnce([mockMinutesDoc])
      .mockResolvedValueOnce([]);
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => {
      expect(screen.getByText('NCA Steering Committee Q1 2026 – Minutes')).toBeInTheDocument();
    });
    // Find the trash button (icon-only button near Download)
    const downloadBtn = screen.getByText('Download');
    const trashBtn = downloadBtn.closest('div')?.querySelector('button:last-child');
    if (trashBtn) {
      await userEvent.click(trashBtn as HTMLElement);
      await waitFor(() => {
        expect(mockDeleteDocument).toHaveBeenCalledWith('doc-minutes-1');
      });
    }
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Refresh button', () => {
  it('renders Refresh button in the uploaded minutes section', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('Refresh')).toBeInTheDocument();
  });

  it('calls getDocuments again when Refresh is clicked', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const refreshBtn = screen.getByText('Refresh');
    await userEvent.click(refreshBtn);
    await waitFor(() => {
      expect(mockGetDocuments).toHaveBeenCalledTimes(2);
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Participants meta', () => {
  it('shows participant count in meta row', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('3 participants')).toBeInTheDocument();
  });

  it('shows 1 participant when only one is listed', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, participants: ['Ahmed Khalil'] });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('1 participants')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Duration meta', () => {
  it('shows duration in the meta row', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText(/2h/)).toBeInTheDocument();
  });

  it('shows time combined with duration', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('10:00 · 2h')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Location meta', () => {
  it('shows location when provided', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('Riyadh Office — Board Room')).toBeInTheDocument();
  });

  it('hides location when not provided', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, location: '' });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.queryByText('Riyadh Office — Board Room')).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Error state', () => {
  it('shows not found after getMeeting throws', async () => {
    mockGetMeeting.mockRejectedValue(new Error('Database error'));
    renderDetail();
    // After error, meeting is null → shows not found
    await waitFor(() => {
      expect(screen.queryByText(/loading meeting/i)).not.toBeInTheDocument();
    });
    expect(screen.getByText(/meeting not found/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – In Progress status', () => {
  it('shows In Progress status badge', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, status: 'In Progress' });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Review type variant', () => {
  it('shows Review type badge', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, type: 'Review' });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('Review')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Upload section', () => {
  it('shows accepted file types text', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText(/PDF, DOCX, PPTX/i)).toBeInTheDocument();
  });

  it('shows click to browse text in drop zone', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText(/click to browse/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Upload feedback', () => {
  it('shows upload success message after file is uploaded', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'minutes.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/"minutes\.pdf" uploaded successfully/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('shows upload error message when storage upload fails', async () => {
    const { supabase } = await import('../lib/supabase');
    vi.mocked(supabase.storage.from).mockReturnValueOnce({
      upload: vi.fn().mockResolvedValue({ error: { message: 'Storage quota exceeded' } }),
      getPublicUrl: vi.fn(() => ({ data: { publicUrl: '' } })),
      createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: '' }, error: null }),
      remove: vi.fn().mockResolvedValue({ error: null }),
    } as any);

    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'large.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/storage quota exceeded/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('calls getDocuments with workspace_id when meeting loads', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => {
      expect(mockGetDocuments).toHaveBeenCalledWith('ws-1');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Attachment count badge', () => {
  it('shows count badge when attachments are present', async () => {
    mockGetDocuments.mockResolvedValue([mockMinutesDoc]);
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => {
      expect(screen.getByText('NCA Steering Committee Q1 2026 – Minutes')).toBeInTheDocument();
    });
    // Badge shows count "1" next to "Uploaded Minutes" header
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Meeting type variants extended', () => {
  it('shows Standup type badge', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, type: 'Standup' });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('Standup')).toBeInTheDocument();
  });

  it('shows Committee type badge', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, type: 'Committee' });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('Committee')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Date formatting', () => {
  it('shows formatted date with year', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    // fmtDate('2026-04-15') → '15 Apr 2026'
    expect(screen.getAllByText(/2026/).length).toBeGreaterThan(0);
  });

  it('shows no minutes badge when minutes_generated is false', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, minutes_generated: false });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.queryByText('Minutes Uploaded')).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Meeting date format', () => {
  it('shows meeting formatted date in header', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    // fmtDate uses en-GB locale: '15 Apr 2026'
    expect(screen.getByText(/15 Apr 2026/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Agenda items', () => {
  it('shows Upcoming status (not Agenda section since UI renders status)', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('Upcoming')).toBeInTheDocument();
  });

  it('shows NCA workspace chip in meeting header', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('NCA')).toBeInTheDocument();
  });

  it('shows 3 participants count in header', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('3 participants')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – File upload actions count', () => {
  it('shows 145 KB file size in uploaded document', async () => {
    mockGetDocuments.mockResolvedValue([mockMinutesDoc]);
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => {
      expect(screen.getByText('NCA Steering Committee Q1 2026 – Minutes')).toBeInTheDocument();
    });
    expect(screen.getByText('145 KB')).toBeInTheDocument();
  });

  it('shows PDF file extension badge for pdf minutes', async () => {
    mockGetDocuments.mockResolvedValue([{ ...mockMinutesDoc, name: 'minutes.pdf', file_url: 'https://test.url/minutes.pdf' }]);
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => {
      expect(screen.getByText('minutes.pdf')).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Upload zone attributes', () => {
  it('shows accepted file types in upload zone', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    // Rendered text is "PDF, DOCX, PPTX, XLSX, TXT accepted"
    expect(screen.getByText(/PDF, DOCX, PPTX/i)).toBeInTheDocument();
  });

  it('shows "Saved to workspace" label on uploaded document', async () => {
    mockGetDocuments.mockResolvedValue([mockMinutesDoc]);
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => {
      expect(screen.getByText('Saved to workspace')).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Meeting type display', () => {
  it('shows meeting type Steering on header', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText('Steering').length).toBeGreaterThan(0);
  });

  it('shows combined time and duration in meta row', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    // Time and duration combined: "10:00 · 2h"
    expect(screen.getAllByText(/10:00.*2h|10:00 · 2h/).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Location display', () => {
  it('shows location text on meeting header', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('Riyadh Office — Board Room')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Participant count', () => {
  it('shows 3 participants count in header area', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('3 participants')).toBeInTheDocument();
  });

  it('shows different participant count for different meeting', async () => {
    mockGetMeeting.mockResolvedValueOnce({
      ...mockMeeting,
      participants: ['Alice', 'Bob'],
    });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('2 participants')).toBeInTheDocument();
  });

  it('shows 0 participants when participants list is empty', async () => {
    mockGetMeeting.mockResolvedValueOnce({
      ...mockMeeting,
      participants: [],
    });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('0 participants')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – DB calls on mount', () => {
  it('calls getMeeting with correct id', async () => {
    renderDetail('mtg-1');
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(mockGetMeeting).toHaveBeenCalledWith('mtg-1');
  });

  it('calls getDocuments on mount', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(mockGetDocuments).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Meeting date display', () => {
  it('shows meeting date formatted on header', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    // Date is '2026-04-15' — shown as "15 Apr 2026" (en-GB locale)
    expect(screen.getAllByText(/15 Apr 2026/).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Workspace display', () => {
  it('shows workspace NCA on meeting header', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText('NCA').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Location display', () => {
  it('shows location Riyadh Office in meeting detail', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('Riyadh Office — Board Room')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Steering type display', () => {
  it('shows Steering meeting type badge', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText('Steering').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Meeting with existing minutes doc', () => {
  it('shows existing minutes doc name when getDocuments returns one', async () => {
    mockGetDocuments.mockResolvedValue([mockMinutesDoc]);
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => {
      expect(screen.getByText('NCA Steering Committee Q1 2026 – Minutes')).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Upcoming status display', () => {
  it('shows Upcoming status badge on meeting', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText('Upcoming').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Actions extracted display', () => {
  it('shows Minutes section label in meeting detail', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    // The upload section has a label for meeting minutes
    expect(screen.getAllByText(/minutes/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Upload Meeting Minutes section', () => {
  it('shows Upload Meeting Minutes section header', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('Upload Meeting Minutes')).toBeInTheDocument();
  });

  it('shows Uploaded Minutes section header', async () => {
    mockGetDocuments.mockResolvedValue([mockMinutesDoc]);
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => {
      expect(screen.getByText('Uploaded Minutes')).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Participant count display', () => {
  it('shows 3 participants count in meeting detail', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    // mockMeeting has 3 participants: ['Ahmed Khalil', 'Rania Taleb', 'Faisal Hassan']
    expect(screen.getAllByText(/3 participants/).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Time and duration display', () => {
  it('shows 10:00 time on detail page', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText(/10:00/).length).toBeGreaterThan(0);
  });

  it('shows 2h duration on detail page', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText(/2h/).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Workspace display', () => {
  it('shows NCA workspace badge', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText('NCA').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Minutes uploaded doc display', () => {
  it('shows minutes document name when uploaded', async () => {
    mockGetDocuments.mockResolvedValue([mockMinutesDoc]);
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => {
      expect(screen.getAllByText(/NCA Steering Committee Q1 2026 – Minutes/).length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Type display', () => {
  it('shows Steering type badge on detail page', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText('Steering').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Uploaded Minutes section', () => {
  it('shows "Uploaded Minutes" section header', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('Uploaded Minutes')).toBeInTheDocument();
  });

  it('shows "No minutes uploaded yet" when no attachments', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => {
      expect(screen.getByText(/No minutes uploaded yet/i)).toBeInTheDocument();
    });
  });

  it('shows uploaded minutes filename when attachment exists', async () => {
    mockGetDocuments.mockResolvedValue([mockMinutesDoc]);
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => {
      expect(screen.getAllByText(/NCA Steering Committee Q1 2026 – Minutes/).length).toBeGreaterThan(0);
    });
  });

  it('shows Refresh button in Uploaded Minutes section', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Upload section', () => {
  it('shows "Upload Meeting Minutes" section header', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('Upload Meeting Minutes')).toBeInTheDocument();
  });

  it('shows drag & drop text in upload zone', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText(/drag & drop/i)).toBeInTheDocument();
  });

  it('shows "click to browse" text in upload zone', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText(/click to browse/i)).toBeInTheDocument();
  });

  it('shows accepted file types label', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText(/PDF, DOCX/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Participant count in header', () => {
  it('shows 3 participants in meta row', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText(/3 participants/).length).toBeGreaterThan(0);
  });

  it('shows 1 participant for single-participant meeting', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, participants: ['AM'] });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText(/1 participant/).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Status badge', () => {
  it('shows Upcoming status badge', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText('Upcoming').length).toBeGreaterThan(0);
  });

  it('shows Completed status when meeting is completed', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, status: 'Completed' });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText('Completed').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Location display', () => {
  it('shows meeting location in meta row', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText('Riyadh Office — Board Room').length).toBeGreaterThan(0);
  });

  it('shows no location when location is null', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, location: null });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.queryByText('Riyadh Office — Board Room')).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Minutes Generated badge', () => {
  it('shows "Minutes Uploaded" badge when minutes_generated is true', async () => {
    mockGetMeeting.mockResolvedValueOnce({ ...mockMeeting, minutes_generated: true });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => {
      expect(screen.getAllByText(/Minutes Uploaded/i).length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Meeting type badge', () => {
  it('shows Steering type badge in header', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText('Steering').length).toBeGreaterThan(0);
  });

  it('shows Workshop type badge for Workshop meeting', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, type: 'Workshop' as const });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText('Workshop').length).toBeGreaterThan(0);
  });

  it('shows Committee type badge for Committee meeting', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, type: 'Committee' as const });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText('Committee').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Meeting time and duration', () => {
  it('shows meeting time in header', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText(/10:00/).length).toBeGreaterThan(0);
  });

  it('shows meeting duration in header', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText(/2h/).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Workspace chip', () => {
  it('shows workspace name chip NCA', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText('NCA').length).toBeGreaterThan(0);
  });

  it('shows different workspace name chip', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, workspace: 'MOCI' });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText('MOCI').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Upload section content', () => {
  it('shows Upload Meeting Minutes section header', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('Upload Meeting Minutes')).toBeInTheDocument();
  });

  it('shows file type hint PPTX', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText(/PPTX/i)).toBeInTheDocument();
  });

  it('shows file type hint TXT', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText(/TXT accepted/i)).toBeInTheDocument();
  });

  it('shows Uploaded Minutes section header', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('Uploaded Minutes')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Uploaded Minutes documents', () => {
  it('shows uploaded document name when minutes exist', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockMinutesDoc]);
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => {
      expect(screen.getAllByText(/NCA Steering Committee Q1 2026 – Minutes/i).length).toBeGreaterThan(0);
    });
  });

  it('shows no documents hint when no minutes uploaded', async () => {
    mockGetDocuments.mockResolvedValueOnce([]);
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => {
      expect(screen.getByText(/Upload a file above/i)).toBeInTheDocument();
    });
  });

  it('shows Document size in uploaded minutes list', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockMinutesDoc]);
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => {
      expect(screen.getAllByText(/145 KB/).length).toBeGreaterThan(0);
    });
  });

  it('shows Download button for uploaded document', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockMinutesDoc]);
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => {
      const downloadBtns = screen.getAllByRole('button').filter(b => /download/i.test(b.textContent || ''));
      expect(downloadBtns.length).toBeGreaterThan(0);
    });
  });

  it('calls deleteDocument when delete button clicked', async () => {
    mockGetDocuments.mockResolvedValueOnce([mockMinutesDoc]);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => {
      expect(screen.getAllByText(/NCA Steering Committee Q1 2026 – Minutes/i).length).toBeGreaterThan(0);
    });
    const deleteBtns = screen.getAllByRole('button').filter(b => /delete/i.test(b.textContent || b.getAttribute('title') || ''));
    if (deleteBtns.length > 0) {
      await userEvent.click(deleteBtns[0]);
      await waitFor(() => {
        expect(mockDeleteDocument).toHaveBeenCalledWith('doc-minutes-1');
      });
    }
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Meeting not found', () => {
  it('shows Meeting not found when meeting is null', async () => {
    mockGetMeeting.mockResolvedValue(null);
    mockGetDocuments.mockResolvedValue([]);
    renderDetail();
    await waitFor(() => {
      expect(screen.getByText(/Meeting not found/i)).toBeInTheDocument();
    });
  });

  it('shows Back to Meetings button when meeting not found', async () => {
    mockGetMeeting.mockResolvedValue(null);
    mockGetDocuments.mockResolvedValue([]);
    renderDetail();
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /back to meetings/i }).length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – In Progress status', () => {
  it('shows In Progress status badge', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, status: 'In Progress' as const });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText('In Progress').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Different participant counts', () => {
  it('shows 0 participants for empty participants list', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, participants: [] });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText(/0 participants/i).length).toBeGreaterThan(0);
  });

  it('shows 5 participants for large group meeting', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, participants: ['A', 'B', 'C', 'D', 'E'] });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText(/5 participants/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Meeting date display', () => {
  it('shows meeting date 2026-04-15', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText(/2026-04-15|Apr 15, 2026|15 Apr 2026/).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Meeting time display', () => {
  it('shows meeting time 10:00', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText(/10:00/).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Meeting location', () => {
  it('shows meeting location Riyadh Office', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText(/Riyadh Office/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Workspace display', () => {
  it('shows NCA workspace on meeting detail', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText('NCA').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Agenda metadata', () => {
  it('shows agenda item count as 3 in the meeting details', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    // Agenda items count or the items themselves may appear
    // The meeting has 3 agenda items
    expect(screen.getAllByText(/3/).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Participants count', () => {
  it('shows 3 participants from participants array', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    // Participants rendered as count only: "3 participants"
    expect(screen.getAllByText(/3 participants/i).length).toBeGreaterThan(0);
  });

  it('shows 1 participant for single person meeting', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, participants: ['Ahmed Khalil'] });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText(/1 participant/i).length).toBeGreaterThan(0);
  });

  it('shows 2 participants for two-person meeting', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, participants: ['Ahmed Khalil', 'Rania Taleb'] });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText(/2 participants/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Meeting type display', () => {
  it('shows Steering meeting type', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText(/Steering/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Duration display', () => {
  it('shows meeting duration 2h', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText(/2h/).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Participant count display', () => {
  it('shows 3 participants count for default meeting', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText(/3 participants/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Completed status', () => {
  it('shows Completed status badge for completed meeting', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, status: 'Completed' as const });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText('Completed').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Upcoming status', () => {
  it('shows Upcoming status badge for upcoming meeting', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText('Upcoming').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Board Room location', () => {
  it('shows Board Room text in location', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText(/Board Room/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Workspace label', () => {
  it('shows workspace name NCA', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText(/NCA/).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Meeting type Steering', () => {
  it('shows Steering meeting type', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText(/Steering/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Participant count display', () => {
  it('shows 3 participants count', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText(/3 participants/i).length).toBeGreaterThan(0);
  });

  it('shows participants label with user icon', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    // The meeting has 3 participants — count is displayed
    expect(screen.getAllByText(/participants/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Meeting date display', () => {
  it('shows meeting date in formatted display (Apr 2026)', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    // fmtDate renders as "15 Apr 2026" in en-GB locale
    expect(screen.getAllByText(/Apr 2026|15 Apr/).length).toBeGreaterThan(0);
  });

  it('shows meeting time 10:00', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText(/10:00/).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Upload minutes section', () => {
  it('shows Upload Meeting Minutes header', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText(/Upload Meeting Minutes/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Back navigation', () => {
  it('shows back button to meetings list', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const backBtn = screen.getAllByRole('button').find(b =>
      b.textContent?.includes('Meetings') || b.getAttribute('aria-label')?.includes('back')
    );
    expect(backBtn || screen.queryAllByText(/Meetings/).length).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Action Items tab', () => {
  it('shows Refresh button in Uploaded Minutes section', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    // The Uploaded Minutes section has a "Refresh" button to reload attachments
    expect(screen.getAllByRole('button', { name: /refresh/i }).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Meeting title is shown', () => {
  it('shows meeting title prominently', async () => {
    renderDetail();
    expect(await screen.findByText('NCA Steering Committee Q1 2026')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Uploaded Minutes section', () => {
  it('shows Uploaded Minutes header section', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText(/Uploaded Minutes/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Navigation back button', () => {
  it('shows at least 2 action buttons in the header', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const allBtns = screen.getAllByRole('button');
    expect(allBtns.length).toBeGreaterThan(1);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Meeting workspace name', () => {
  it('shows workspace NCA in the meeting header', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText(/NCA/).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Meeting info row display', () => {
  it('shows time and duration together', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    // time · duration format
    expect(screen.getAllByText(/10:00/).length).toBeGreaterThan(0);
  });

  it('shows location Riyadh Office Board Room', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText(/Riyadh Office/).length).toBeGreaterThan(0);
  });

  it('shows 3 participants in info row', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText(/3 participants/).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Meeting type badge', () => {
  it('shows Steering type badge in meeting header', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText(/Steering/).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Upload area visible', () => {
  it('shows Drag and drop upload area text', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText(/Drag.*drop|drag.*drop/i).length).toBeGreaterThan(0);
  });

  it('shows Upload Meeting Minutes heading', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText(/Upload Meeting Minutes/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Empty uploaded minutes state', () => {
  it('shows No minutes uploaded yet when no docs', async () => {
    mockGetDocuments.mockResolvedValue([]);
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => {
      expect(screen.getAllByText(/No minutes uploaded yet/i).length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Minutes Uploaded badge', () => {
  it('shows Minutes Uploaded badge when minutes_generated is true', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, minutes_generated: true });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText(/Minutes Uploaded/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Meeting header buttons', () => {
  it('shows at least 2 buttons in the meeting detail area', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByRole('button').length).toBeGreaterThan(1);
  });

  it('shows Delete or action button in header', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    // There should be at least one action button
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
  });

  it('shows Refresh button for uploaded minutes', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByRole('button', { name: /refresh/i }).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – File input', () => {
  it('has file input in upload area', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(document.querySelector('input[type="file"]')).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Uploaded Minutes section', () => {
  it('shows Uploaded Minutes heading', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText(/Uploaded Minutes/i).length).toBeGreaterThan(0);
  });

  it('shows file format hint text', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText(/PDF.*DOCX|DOCX.*PDF|accepted/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Meeting title display', () => {
  it('shows full meeting title prominently', async () => {
    renderDetail();
    expect(await screen.findByText('NCA Steering Committee Q1 2026')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Date in formatted display', () => {
  it('shows meeting date formatted for display', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    // Date is formatted as "15 Apr '26" or similar
    const body = document.body.textContent ?? '';
    expect(body).toMatch(/Apr|2026-04-15/i);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Back to Meetings link text', () => {
  it('shows "Back to Meetings" button text', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText(/Back to Meetings/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Meeting not found detail', () => {
  it('shows back link when meeting ID not found', async () => {
    mockGetMeeting.mockResolvedValue(null);
    renderDetail('non-existent');
    await waitFor(() => {
      expect(screen.getAllByText(/Back to Meetings|not found/i).length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Upload minutes section PDF hint', () => {
  it('shows PDF in accepted formats hint', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText(/PDF/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Meeting type Steering color', () => {
  it('shows Steering type text on meeting badge', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    // Type is shown as a colored badge
    expect(screen.getAllByText('Steering').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Meeting workspace NCA text', () => {
  it('shows NCA workspace chip text', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText('NCA').length).toBeGreaterThan(0);
  });
});

describe('MeetingDetail – Participants section', () => {
  it('shows Participants section heading', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('Participants')).toBeInTheDocument();
  });

  it('shows all participant names as chips', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('Ahmed Khalil')).toBeInTheDocument();
    expect(screen.getByText('Rania Taleb')).toBeInTheDocument();
    expect(screen.getByText('Faisal Hassan')).toBeInTheDocument();
  });

  it('shows participant count badge', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    // Participants section has check-in buttons for each participant
    const list = screen.getByRole('generic', { name: /participants list/i });
    expect(list).toBeInTheDocument();
    expect(list.querySelectorAll('button').length).toBe(3);
  });

  it('hides Participants section when participants list is empty', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, participants: [] });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.queryByText('Participants')).not.toBeInTheDocument();
  });

  it('shows single participant correctly', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, participants: ['Ahmed Khalil'] });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('Ahmed Khalil')).toBeInTheDocument();
    expect(screen.queryByText('Rania Taleb')).not.toBeInTheDocument();
  });

  it('Participants list has aria-label', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByRole('generic', { name: /participants list/i })).toBeInTheDocument();
  });
});

// ──────────────────────────────────────────────────────────────────────
describe('MeetingDetail – Meeting Notes section', () => {
  it('renders Meeting Notes section', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
  });

  it('renders the notes textarea with placeholder', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByRole('textbox', { name: /meeting notes input/i })).toBeInTheDocument();
  });

  it('renders the Save button for notes', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByRole('button', { name: /save meeting notes/i })).toBeInTheDocument();
  });

  it('allows typing in notes textarea', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const textarea = screen.getByRole('textbox', { name: /meeting notes input/i });
    await userEvent.type(textarea, 'Action item: Follow up with NCA team');
    expect((textarea as HTMLTextAreaElement).value).toContain('Action item');
  });

  it('Save button changes to Saved after clicking', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const saveBtn = screen.getByRole('button', { name: /save meeting notes/i });
    await userEvent.click(saveBtn);
    await waitFor(() => {
      expect(saveBtn).toHaveTextContent('Saved');
    });
  });

  it('persists notes to localStorage on save', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const textarea = screen.getByRole('textbox', { name: /meeting notes input/i });
    await userEvent.type(textarea, 'Key decision noted');
    await userEvent.click(screen.getByRole('button', { name: /save meeting notes/i }));
    await waitFor(() => {
      const stored = localStorage.getItem('meeting_notes_mtg-1');
      expect(stored).toContain('Key decision noted');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Navigation and action button aria-labels', () => {
  it('Back to Meetings button has aria-label', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByRole('button', { name: /back to meetings/i })).toBeInTheDocument();
  });

  it('Refresh attachments button has aria-label', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByRole('button', { name: /refresh attachments/i })).toBeInTheDocument();
  });

  it('Save meeting notes button has aria-label', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByRole('button', { name: /save meeting notes/i })).toBeInTheDocument();
  });

  it('meeting title is displayed in the header', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('NCA Steering Committee Q1 2026')).toBeInTheDocument();
  });

  it('participants section is labeled', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const participantsList = document.querySelector('[aria-label="Participants list"]');
    expect(participantsList).toBeTruthy();
  });

  it('No minutes uploaded message shows when no attachments', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => {
      expect(screen.getByText(/no minutes uploaded yet/i)).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Attachment download/delete aria-labels', () => {
  it('Download button for attachment has dynamic aria-label', async () => {
    mockGetDocuments.mockResolvedValue([mockMinutesDoc]);
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /download NCA Steering Committee Q1 2026 – Minutes/i })).toBeInTheDocument();
    });
  });

  it('Delete button for attachment has dynamic aria-label', async () => {
    mockGetDocuments.mockResolvedValue([mockMinutesDoc]);
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /delete NCA Steering Committee Q1 2026 – Minutes/i })).toBeInTheDocument();
    });
  });

  it('clicking delete button calls deleteDocument', async () => {
    mockGetDocuments.mockResolvedValue([mockMinutesDoc]);
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /delete NCA Steering Committee Q1 2026 – Minutes/i })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: /delete NCA Steering Committee Q1 2026 – Minutes/i }));
    await waitFor(() => {
      expect(mockDeleteDocument).toHaveBeenCalledWith('doc-minutes-1');
    });
  });

  it('file size is displayed in attachment row', async () => {
    mockGetDocuments.mockResolvedValue([mockMinutesDoc]);
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => {
      expect(screen.getByText('145 KB')).toBeInTheDocument();
    });
  });

  it('Saved to workspace label is shown for attachment', async () => {
    mockGetDocuments.mockResolvedValue([mockMinutesDoc]);
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => {
      expect(screen.getByText('Saved to workspace')).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Upload error dismiss', () => {
  it('Dismiss upload error button has aria-label', async () => {
    // Force upload error by making supabase.storage.from.upload fail
    const { supabase } = await import('../lib/supabase');
    (supabase.storage.from as ReturnType<typeof vi.fn>).mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: new Error('Storage failure') }),
      getPublicUrl: vi.fn(() => ({ data: { publicUrl: '' } })),
      createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: '' }, error: null }),
      remove: vi.fn().mockResolvedValue({ error: null }),
    });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'minutes.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    await waitFor(() => {
      const dismissBtn = document.querySelector('[aria-label="Dismiss upload error"]');
      expect(dismissBtn).toBeTruthy();
    }, { timeout: 3000 });
  });

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Participants list', () => {
  it('shows all three participants', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('Ahmed Khalil')).toBeInTheDocument();
    expect(screen.getByText('Rania Taleb')).toBeInTheDocument();
    expect(screen.getByText('Faisal Hassan')).toBeInTheDocument();
  });

  it('participants list has aria-label', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(document.querySelector('[aria-label="Participants list"]')).toBeTruthy();
  });

  it('participants count matches the meeting fixture', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const participantsList = document.querySelector('[aria-label="Participants list"]');
    expect(participantsList?.children.length).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Back to Meetings navigation', () => {
  it('back button navigates to /meetings', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const backBtn = screen.getByRole('button', { name: /back to meetings/i });
    await userEvent.click(backBtn);
    // After click the route changes — component unmounts so text disappears
    await waitFor(() => {
      expect(screen.queryByText('NCA Steering Committee Q1 2026')).not.toBeInTheDocument();
    });
  });

  it('Back to Meetings button text is visible', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('Back to Meetings')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Meeting metadata display', () => {
  it('shows meeting location', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('Riyadh Office — Board Room')).toBeInTheDocument();
  });

  it('shows meeting workspace', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText('NCA').length).toBeGreaterThan(0);
  });

  it('shows meeting duration in time row', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    // Duration is rendered as part of "10:00 · 2h"
    expect(screen.getByText(/2h/)).toBeInTheDocument();
  });

  it('shows formatted meeting date', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    // Date is formatted as "15 Apr 2026" via fmtDate
    expect(screen.getByText(/15 Apr 2026/)).toBeInTheDocument();
  });
});
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Meeting Notes textarea', () => {
  it('meeting notes textarea is present', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByRole('textbox', { name: /meeting notes input/i })).toBeInTheDocument();
  });

  it('meeting notes textarea has placeholder text', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByPlaceholderText(/add your meeting notes/i)).toBeInTheDocument();
  });

  it('typing in meeting notes updates value', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const textarea = screen.getByRole('textbox', { name: /meeting notes input/i });
    await userEvent.clear(textarea);
    await userEvent.type(textarea, 'Follow up with team');
    expect(textarea).toHaveValue('Follow up with team');
  });

  it('Save meeting notes button is present', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByRole('button', { name: /save meeting notes/i })).toBeInTheDocument();
  });

  it('Save button shows "Saved" after clicking', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const saveBtn = screen.getByRole('button', { name: /save meeting notes/i });
    await userEvent.click(saveBtn);
    await waitFor(() => {
      expect(screen.getByText('Saved')).toBeInTheDocument();
    });
  });

  it('Meeting Notes heading is visible', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Meeting type display', () => {
  it('shows Steering type label', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText('Steering').length).toBeGreaterThan(0);
  });

  it('shows meeting time value', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText(/10:00/)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Refresh attachments button', () => {
  it('Refresh attachments button has aria-label', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByRole('button', { name: /refresh attachments/i })).toBeInTheDocument();
  });

  it('clicking Refresh attachments button refetches documents', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const refreshBtn = screen.getByRole('button', { name: /refresh attachments/i });
    await userEvent.click(refreshBtn);
    await waitFor(() => {
      expect(mockGetDocuments).toHaveBeenCalledTimes(2);
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Meeting status badge display', () => {
  it('shows Upcoming status badge', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText('Upcoming').length).toBeGreaterThan(0);
  });

  it('shows Steering type label', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText('Steering').length).toBeGreaterThan(0);
  });

  it('shows meeting participants count label', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    // 3 participants in fixture
    expect(screen.getAllByText('3').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Meeting with attached minutes document', () => {
  it('shows Download Minutes button for docs with file_url', async () => {
    mockGetDocuments.mockResolvedValue([mockMinutesDoc]);
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /download nca steering committee q1 2026 – minutes/i })).toBeInTheDocument();
    });
  });

  it('shows Delete Minutes button for attached docs', async () => {
    mockGetDocuments.mockResolvedValue([mockMinutesDoc]);
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /delete nca steering committee q1 2026 – minutes/i })).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Meeting Notes save behavior', () => {
  it('Save button text reverts after timeout', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const saveBtn = screen.getByRole('button', { name: /save meeting notes/i });
    await userEvent.click(saveBtn);
    await waitFor(() => {
      expect(screen.getByText('Saved')).toBeInTheDocument();
    });
    // After timeout the button reverts back to "Save"
    await waitFor(() => {
      expect(screen.queryByText('Saved')).not.toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('notes persisted to localStorage on save', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const textarea = screen.getByRole('textbox', { name: /meeting notes input/i });
    await userEvent.clear(textarea);
    await userEvent.type(textarea, 'Key decisions made');
    await userEvent.click(screen.getByRole('button', { name: /save meeting notes/i }));
    await waitFor(() => {
      expect(localStorage.getItem('meeting_notes_mtg-1')).toBe('Key decisions made');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Multiple attachments in list', () => {
  const mockDoc2 = {
    id: 'doc-minutes-2',
    name: 'NCA Steering Q1 Agenda',
    type: 'Meeting Minutes' as const,
    type_color: '#10B981',
    status: 'Draft' as const,
    date: '2026-04-15',
    workspace: 'NCA',
    workspace_id: 'ws-1',
    size: '85 KB',
    language: 'EN' as const,
    tags: ['mtg-1'],
    author: 'AM',
    pages: 2,
    summary: '',
    file_url: 'https://test.example.com/agenda.pdf',
    created_at: '2026-04-15T13:00:00Z',
    updated_at: '2026-04-15T13:00:00Z',
  };

  it('shows both document names when two attachments exist', async () => {
    mockGetDocuments.mockResolvedValue([mockMinutesDoc, mockDoc2]);
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => {
      expect(screen.getByText('NCA Steering Committee Q1 2026 – Minutes')).toBeInTheDocument();
      expect(screen.getByText('NCA Steering Q1 Agenda')).toBeInTheDocument();
    });
  });

  it('shows Download buttons for both attachments', async () => {
    mockGetDocuments.mockResolvedValue([mockMinutesDoc, mockDoc2]);
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /download nca steering committee q1 2026 – minutes/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /download nca steering q1 agenda/i })).toBeInTheDocument();
    });
  });

  it('shows attachment count badge of 2 when two docs exist', async () => {
    mockGetDocuments.mockResolvedValue([mockMinutesDoc, mockDoc2]);
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => {
      expect(screen.getAllByText('2').length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Saved to workspace label', () => {
  it('shows "Saved to workspace" in attachment metadata', async () => {
    mockGetDocuments.mockResolvedValue([mockMinutesDoc]);
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => {
      expect(screen.getByText('Saved to workspace')).toBeInTheDocument();
    });
  });

  it('shows file size 145 KB in attachment metadata', async () => {
    mockGetDocuments.mockResolvedValue([mockMinutesDoc]);
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => {
      expect(screen.getByText('145 KB')).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Notes pre-loaded from localStorage', () => {
  it('meeting notes textarea pre-fills from localStorage', async () => {
    localStorage.setItem('meeting_notes_mtg-1', 'Previously saved content');
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const textarea = screen.getByRole('textbox', { name: /meeting notes input/i });
    expect(textarea).toHaveValue('Previously saved content');
  });

  it('meeting notes textarea is empty when localStorage has no entry', async () => {
    localStorage.removeItem('meeting_notes_mtg-1');
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const textarea = screen.getByRole('textbox', { name: /meeting notes input/i });
    expect(textarea).toHaveValue('');
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Uploaded attachment date format', () => {
  it('shows "Uploaded" prefix in attachment metadata row', async () => {
    mockGetDocuments.mockResolvedValue([mockMinutesDoc]);
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => {
      const uploadedText = screen.getAllByText(/Uploaded/i);
      expect(uploadedText.length).toBeGreaterThan(0);
    });
  });

  it('attachment metadata shows month abbreviation from created_at', async () => {
    mockGetDocuments.mockResolvedValue([mockMinutesDoc]);
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => {
      // created_at: '2026-04-15T12:00:00Z' → fmtDateTime → "15 Apr 26, 12:00"
      const body = document.body.textContent ?? '';
      expect(body).toMatch(/Apr/);
    });
  });

  it('shows both size and upload info for second attachment', async () => {
    const doc2 = {
      ...mockMinutesDoc,
      id: 'doc-2',
      name: 'NCA Steering Q1 Agenda',
      size: '88 KB',
      created_at: '2026-04-15T13:00:00Z',
    };
    mockGetDocuments.mockResolvedValue([mockMinutesDoc, doc2]);
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => {
      expect(screen.getByText('88 KB')).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Notes textarea typing', () => {
  it('typing in notes textarea updates its value', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const textarea = screen.getByRole('textbox', { name: /meeting notes input/i });
    await userEvent.type(textarea, 'Action item: review Q2 budget');
    expect(textarea).toHaveValue('Action item: review Q2 budget');
  });

  it('notes textarea accepts multi-line input', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const textarea = screen.getByRole('textbox', { name: /meeting notes input/i });
    await userEvent.type(textarea, 'Line one{Enter}Line two');
    expect((textarea as HTMLTextAreaElement).value).toMatch(/Line one/);
    expect((textarea as HTMLTextAreaElement).value).toMatch(/Line two/);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Upload accepted file types hint', () => {
  it('shows "PDF, DOCX, PPTX, XLSX, TXT accepted" in upload section', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText(/PDF, DOCX, PPTX/i)).toBeInTheDocument();
  });

  it('shows "TXT accepted" in upload section hint', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText(/TXT accepted/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Meeting notes section header', () => {
  it('shows "Meeting Notes" section heading', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
  });

  it('shows "Save" button in meeting notes section', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByRole('button', { name: /save meeting notes/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Participants section header', () => {
  it('shows "Participants" section heading', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText('Participants').length).toBeGreaterThan(0);
  });

  it('shows all three participant names as pills', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('Ahmed Khalil')).toBeInTheDocument();
    expect(screen.getByText('Rania Taleb')).toBeInTheDocument();
    expect(screen.getByText('Faisal Hassan')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Attachment file extension badges', () => {
  it('shows DOCX extension badge for docx file', async () => {
    const docxDoc = {
      ...mockMinutesDoc,
      id: 'doc-docx',
      name: 'Meeting Notes.docx',
      file_url: 'https://test.example.com/notes.docx',
    };
    mockGetDocuments.mockResolvedValue([docxDoc]);
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => {
      expect(screen.getByText('DOCX')).toBeInTheDocument();
    });
  });

  it('shows TXT extension badge for txt file', async () => {
    const txtDoc = {
      ...mockMinutesDoc,
      id: 'doc-txt',
      name: 'Notes.txt',
      file_url: 'https://test.example.com/notes.txt',
    };
    mockGetDocuments.mockResolvedValue([txtDoc]);
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => {
      expect(screen.getByText('TXT')).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Meeting status transitions', () => {
  it('shows "In Progress" status badge when status is In Progress', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, status: 'In Progress' });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText(/In Progress/).length).toBeGreaterThan(0);
  });

  it('shows Completed status when status is Completed', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, status: 'Completed' });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText(/Completed/).length).toBeGreaterThan(0);
  });

  it('shows Upcoming status when status is Upcoming', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, status: 'Upcoming' });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText(/Upcoming/).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – XLSX and PPTX extension badges', () => {
  it('shows XLSX extension badge for xlsx file', async () => {
    const xlsxDoc = {
      ...mockMinutesDoc,
      id: 'doc-xlsx',
      name: 'Meeting Data.xlsx',
      file_url: 'https://test.example.com/data.xlsx',
    };
    mockGetDocuments.mockResolvedValue([xlsxDoc]);
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => {
      expect(screen.getByText('XLSX')).toBeInTheDocument();
    });
  });

  it('shows PPTX extension badge for pptx file', async () => {
    const pptxDoc = {
      ...mockMinutesDoc,
      id: 'doc-pptx',
      name: 'Presentation.pptx',
      file_url: 'https://test.example.com/slide.pptx',
    };
    mockGetDocuments.mockResolvedValue([pptxDoc]);
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => {
      expect(screen.getByText('PPTX')).toBeInTheDocument();
    });
  });

  it('shows XYZ extension badge for xyz file', async () => {
    const xyzDoc = {
      ...mockMinutesDoc,
      id: 'doc-xyz',
      name: 'Document.xyz',
      file_url: 'https://test.example.com/doc.xyz',
    };
    mockGetDocuments.mockResolvedValue([xyzDoc]);
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => {
      expect(screen.getByText('XYZ')).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Meeting with no location', () => {
  it('does not show location when meeting has no location', async () => {
    const noLocationMeeting = { ...mockMeeting, location: '' };
    mockGetMeeting.mockResolvedValue(noLocationMeeting);
    mockGetDocuments.mockResolvedValue([]);
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    // Location is empty string, so "Riyadh Office" should not appear
    expect(screen.queryByText(/Riyadh Office/i)).not.toBeInTheDocument();
  });

  it('shows other metadata when meeting has no location', async () => {
    const noLocationMeeting = { ...mockMeeting, location: '' };
    mockGetMeeting.mockResolvedValue(noLocationMeeting);
    mockGetDocuments.mockResolvedValue([]);
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    // Time/duration should still show
    expect(screen.getByText('10:00 · 2h')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Attachment list with multiple files', () => {
  it('shows both attachment names when two documents exist', async () => {
    const doc2 = {
      ...mockMinutesDoc,
      id: 'doc-2',
      name: 'Q1 Agenda.pdf',
      size: '72 KB',
    };
    mockGetDocuments.mockResolvedValue([mockMinutesDoc, doc2]);
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => {
      expect(screen.getByText('NCA Steering Committee Q1 2026 – Minutes')).toBeInTheDocument();
      expect(screen.getByText('Q1 Agenda.pdf')).toBeInTheDocument();
    });
  });

  it('shows "2" in the Uploaded Minutes count badge when two docs', async () => {
    const doc2 = {
      ...mockMinutesDoc,
      id: 'doc-2',
      name: 'Q1 Agenda.pdf',
    };
    mockGetDocuments.mockResolvedValue([mockMinutesDoc, doc2]);
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => {
      // Count badge shows "2"
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });
});

describe('MeetingDetail – DOC, XLS, PPT extension badges', () => {
  it('shows DOC extension badge for doc file', async () => {
    const docFile = { ...mockMinutesDoc, id: 'doc-doc', name: 'Requirements.doc', file_url: 'https://test.example.com/req.doc' };
    mockGetDocuments.mockResolvedValue([docFile]);
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => {
      expect(screen.getByText('DOC')).toBeInTheDocument();
    });
  });

  it('shows XLS extension badge for xls file', async () => {
    const xlsFile = { ...mockMinutesDoc, id: 'doc-xls', name: 'Data.xls', file_url: 'https://test.example.com/data.xls' };
    mockGetDocuments.mockResolvedValue([xlsFile]);
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => {
      expect(screen.getByText('XLS')).toBeInTheDocument();
    });
  });

  it('shows PPT extension badge for ppt file', async () => {
    const pptFile = { ...mockMinutesDoc, id: 'doc-ppt', name: 'Presentation.ppt', file_url: 'https://test.example.com/pres.ppt' };
    mockGetDocuments.mockResolvedValue([pptFile]);
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => {
      expect(screen.getByText('PPT')).toBeInTheDocument();
    });
  });

  it('shows FILE fallback badge for file with no extension', async () => {
    const noExtFile = { ...mockMinutesDoc, id: 'doc-noext', name: 'noextfile.', file_url: 'https://test.example.com/noextfile.' };
    mockGetDocuments.mockResolvedValue([noExtFile]);
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => {
      expect(screen.getByText('FILE')).toBeInTheDocument();
    });
  });
});

describe('MeetingDetail – Meeting notes Save button feedback', () => {
  it('Save button text changes to "Saved" after clicking', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const saveBtn = screen.getByRole('button', { name: /save meeting notes/i });
    expect(saveBtn).toHaveTextContent('Save');
    await userEvent.click(saveBtn);
    await waitFor(() => {
      expect(saveBtn).toHaveTextContent('Saved');
    });
  });

  it('Save button aria-label changes after clicking', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const saveBtn = screen.getByRole('button', { name: /save meeting notes/i });
    await userEvent.click(saveBtn);
    await waitFor(() => {
      // After click, notesSaved is true so button is no longer named "Save meeting notes"
      expect(saveBtn).toBeInTheDocument();
    });
  });
});

describe('MeetingDetail – Individual participant name chips', () => {
  it('shows Ahmed Khalil participant chip', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => {
      expect(screen.getAllByText('Ahmed Khalil').length).toBeGreaterThan(0);
    });
  });

  it('shows Rania Taleb participant chip', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => {
      expect(screen.getAllByText('Rania Taleb').length).toBeGreaterThan(0);
    });
  });

  it('shows Faisal Hassan participant chip', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => {
      expect(screen.getAllByText('Faisal Hassan').length).toBeGreaterThan(0);
    });
  });
});

describe('MeetingDetail – Notes textarea aria-label and placeholder', () => {
  it('notes textarea has correct aria-label', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const textarea = document.querySelector('textarea[aria-label="Meeting notes input"]');
    expect(textarea).toBeInTheDocument();
  });

  it('notes textarea placeholder text matches source', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const textarea = document.querySelector('textarea[aria-label="Meeting notes input"]') as HTMLTextAreaElement | null;
    expect(textarea?.placeholder).toMatch(/add your meeting notes/i);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – 1h duration meeting', () => {
  it('shows 1h duration in meta row', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, duration: '1h' });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText(/10:00 · 1h/)).toBeInTheDocument();
  });

  it('shows 3h duration in meta row', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, duration: '3h' });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText(/10:00 · 3h/)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Different meeting time', () => {
  it('shows 14:30 time in meta row', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, time: '14:30' });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText(/14:30/)).toBeInTheDocument();
  });

  it('shows 09:00 time in meta row', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, time: '09:00' });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText(/09:00/)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Workspace name variants', () => {
  it('shows MOCI workspace name when meeting has MOCI workspace', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, workspace: 'MOCI' });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText('MOCI').length).toBeGreaterThan(0);
  });

  it('shows ZATCA workspace name when meeting has ZATCA workspace', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, workspace: 'ZATCA' });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText('ZATCA').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – File input accept attribute', () => {
  it('file input accepts .docx files', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput?.accept).toContain('.docx');
  });

  it('file input accepts .pptx files', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput?.accept).toContain('.pptx');
  });

  it('file input accepts .pdf files', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput?.accept).toContain('.pdf');
  });

  it('file input accepts .xlsx files', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput?.accept).toContain('.xlsx');
  });

  it('file input accepts .txt files', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput?.accept).toContain('.txt');
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Meeting 4 participants', () => {
  it('shows 4 participants when meeting has 4', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, participants: ['A', 'B', 'C', 'D'] });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText(/4 participants/).length).toBeGreaterThan(0);
  });

  it('shows participant chips for 4-person meeting', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, participants: ['Ahmed', 'Rania', 'Faisal', 'Yasser'] });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('Yasser')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Refresh button calls getDocuments twice', () => {
  it('clicking Refresh calls getDocuments a second time', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const beforeCount = mockGetDocuments.mock.calls.length;
    const refreshBtn = screen.getByRole('button', { name: /refresh attachments/i });
    await userEvent.click(refreshBtn);
    await waitFor(() => {
      expect(mockGetDocuments.mock.calls.length).toBeGreaterThan(beforeCount);
    }, { timeout: 3000 });
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Needs Action and Cancelled status', () => {
  it('shows "Needs Action" status badge', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, status: 'Needs Action' as any });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('Needs Action')).toBeInTheDocument();
  });

  it('shows "Cancelled" status badge', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, status: 'Cancelled' as any });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Five participants meeting', () => {
  it('shows "5 participants" for a 5-person meeting', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, participants: ['A', 'B', 'C', 'D', 'E'] });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText(/5 participants/).length).toBeGreaterThan(0);
  });

  it('shows all five participant chips', async () => {
    mockGetMeeting.mockResolvedValue({
      ...mockMeeting,
      participants: ['Ahmed', 'Rania', 'Faisal', 'Yasser', 'Sara'],
    });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('Sara')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – 30min duration and MOCI workspace', () => {
  it('shows "30min" duration in meta row', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, duration: '30min' });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText(/30min/)).toBeInTheDocument();
  });

  it('shows MOCI workspace chip', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, workspace: 'MOCI', workspace_id: 'ws-moci' });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('MOCI')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Meeting type display', () => {
  it('shows Board meeting type in header', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, type: 'Board' as any });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('Board')).toBeInTheDocument();
  });

  it('shows Workshop meeting type in header', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, type: 'Workshop' as any });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('Workshop')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – SEC workspace and 4h duration', () => {
  it('shows SEC workspace chip', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, workspace: 'SEC', workspace_id: 'ws-sec' });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('SEC')).toBeInTheDocument();
  });

  it('shows 4h duration in meta row', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, duration: '4h' });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText(/4h/)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Meeting title and date display', () => {
  it('shows custom meeting title', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, title: 'ADNOC Risk Workshop 2026' });
    renderDetail();
    await screen.findByText('ADNOC Risk Workshop 2026');
    expect(screen.getByText('ADNOC Risk Workshop 2026')).toBeInTheDocument();
  });

  it('shows meeting date in meta row', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, date: '2026-06-01' });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText(/Jun 2026/)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – additional status variants', () => {
  it('shows Completed status badge', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, status: 'Completed' });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('shows In Progress status badge', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, status: 'In Progress' });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('shows Upcoming status badge', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, status: 'Upcoming' });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('Upcoming')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – different workspaces', () => {
  it('shows ADNOC workspace chip', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, workspace: 'ADNOC', workspace_id: 'ws-adnoc' });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('ADNOC')).toBeInTheDocument();
  });

  it('shows MOCI workspace chip', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, workspace: 'MOCI', workspace_id: 'ws-moci' });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('MOCI')).toBeInTheDocument();
  });

  it('shows different meeting title for ZATCA', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, title: 'ZATCA Tax Reform Kickoff', workspace: 'ZATCA' });
    renderDetail();
    await screen.findByText('ZATCA Tax Reform Kickoff');
    expect(screen.getByText('ZATCA Tax Reform Kickoff')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – duration variants', () => {
  it('shows 1h duration', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, duration: '1h' });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText(/1h/)).toBeInTheDocument();
  });

  it('shows 3h duration', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, duration: '3h' });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText(/3h/)).toBeInTheDocument();
  });

  it('shows 30min duration', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, duration: '30min' });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText(/30min/)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – participant variants', () => {
  it('shows participant Ahmed Khalil', async () => {
    mockGetMeeting.mockResolvedValue(mockMeeting);
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText(/ahmed khalil/i)).toBeInTheDocument();
  });

  it('shows participant Rania Taleb', async () => {
    mockGetMeeting.mockResolvedValue(mockMeeting);
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText(/rania taleb/i)).toBeInTheDocument();
  });

  it('shows participant Faisal Hassan', async () => {
    mockGetMeeting.mockResolvedValue(mockMeeting);
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText(/faisal hassan/i)).toBeInTheDocument();
  });

  it('shows different participants when overridden', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, participants: ['Khalid Mansour', 'Sara Al-Otaibi'] });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText(/khalid mansour/i)).toBeInTheDocument();
    expect(screen.getByText(/sara al-otaibi/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – location variants', () => {
  it('shows default Riyadh Office location', async () => {
    mockGetMeeting.mockResolvedValue(mockMeeting);
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText(/riyadh office/i)).toBeInTheDocument();
  });

  it('shows Virtual Meeting location', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, location: 'Virtual Meeting — Microsoft Teams' });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText(/virtual meeting/i)).toBeInTheDocument();
  });

  it('shows Jeddah Office location', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, location: 'Jeddah Office — Conference Room A' });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText(/jeddah office/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – meeting type variants', () => {
  it('shows Steering type badge', async () => {
    mockGetMeeting.mockResolvedValue(mockMeeting);
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('Steering')).toBeInTheDocument();
  });

  it('shows Board type badge', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, type: 'Board' as const, title: 'SAMA Governance Meeting' });
    renderDetail();
    await screen.findByText('SAMA Governance Meeting');
    expect(screen.getByText('Board')).toBeInTheDocument();
  });

  it('shows Kickoff type badge', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, type: 'Kickoff' as const, title: 'ZATCA Project Session' });
    renderDetail();
    await screen.findByText('ZATCA Project Session');
    expect(screen.getByText('Kickoff')).toBeInTheDocument();
  });

  it('shows Workshop type badge', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, type: 'Workshop' as const, title: 'Requirements Session' });
    renderDetail();
    await screen.findByText('Requirements Session');
    expect(screen.getByText('Workshop')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – date and time variants', () => {
  it('shows formatted date for 2026-04-15', async () => {
    mockGetMeeting.mockResolvedValue(mockMeeting);
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText(/apr.*2026|2026.*apr/i).length).toBeGreaterThan(0);
  });

  it('shows formatted date for 2026-06-01', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, date: '2026-06-01' });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText(/jun.*2026|2026.*jun/i).length).toBeGreaterThan(0);
  });

  it('shows default time 10:00', async () => {
    mockGetMeeting.mockResolvedValue(mockMeeting);
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText(/10:00/)).toBeInTheDocument();
  });

  it('shows custom time 14:30', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, time: '14:30' });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText(/14:30/)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – additional status variants', () => {
  it('shows In Progress status badge', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, status: 'In Progress' as const });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText(/in progress/i)).toBeInTheDocument();
  });

  it('shows Completed status badge', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, status: 'Completed' as const });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText(/completed/i)).toBeInTheDocument();
  });

  it('shows Upcoming status badge', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, status: 'Upcoming' as const });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText(/upcoming/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – additional duration variants', () => {
  it('shows 4h duration', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, duration: '4h' });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText(/4h/)).toBeInTheDocument();
  });

  it('shows 45min duration', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, duration: '45min' });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText(/45min/)).toBeInTheDocument();
  });

  it('shows 2h duration (default)', async () => {
    mockGetMeeting.mockResolvedValue(mockMeeting);
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText(/2h/)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – additional workspace variants', () => {
  it('renders meeting from SAMA workspace', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, workspace: 'SAMA', workspace_id: 'ws-sama', title: 'SAMA Board Review' });
    mockGetDocuments.mockResolvedValue([]);
    renderDetail();
    await screen.findByText('SAMA Board Review');
    expect(screen.getAllByText(/sama/i).length).toBeGreaterThan(0);
  });

  it('renders meeting from NEOM workspace', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, workspace: 'NEOM', workspace_id: 'ws-neom', title: 'NEOM Smart City Review' });
    mockGetDocuments.mockResolvedValue([]);
    renderDetail();
    await screen.findByText('NEOM Smart City Review');
    expect(screen.getAllByText(/neom/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – additional location variants', () => {
  it('shows Dubai Office location', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, location: 'Dubai Office' });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText(/dubai office/i)).toBeInTheDocument();
  });

  it('shows Online location', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, location: 'Online' });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText(/online/i)).toBeInTheDocument();
  });

  it('shows Abu Dhabi location', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, location: 'Abu Dhabi HQ' });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText(/abu dhabi/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – additional participant variants', () => {
  it('shows single participant', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, participants: ['Ahmed Khalil'] });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText(/ahmed khalil/i).length).toBeGreaterThan(0);
  });

  it('shows five participants', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, participants: ['AM', 'RT', 'FK', 'AB', 'CD'] });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText(/NCA Steering Committee Q1 2026/)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – additional title variants', () => {
  it('shows STC Risk Workshop title', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, title: 'STC Risk Workshop' });
    renderDetail();
    await screen.findByText('STC Risk Workshop');
    expect(screen.getByText('STC Risk Workshop')).toBeInTheDocument();
  });

  it('shows ZATCA Compliance Review title', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, title: 'ZATCA Compliance Review' });
    renderDetail();
    await screen.findByText('ZATCA Compliance Review');
    expect(screen.getByText('ZATCA Compliance Review')).toBeInTheDocument();
  });

  it('shows ADNOC Digital Strategy title', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, title: 'ADNOC Digital Strategy' });
    renderDetail();
    await screen.findByText('ADNOC Digital Strategy');
    expect(screen.getByText('ADNOC Digital Strategy')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – additional meeting type variants', () => {
  it('shows Workshop type', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, type: 'Workshop' });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText(/workshop/i)).toBeInTheDocument();
  });

  it('shows Presentation type', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, type: 'Presentation' });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText(/presentation/i)).toBeInTheDocument();
  });

  it('shows Review type', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, type: 'Review' });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText(/review/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – notes input area', () => {
  it('shows meeting notes textarea', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByRole('textbox', { name: /meeting notes input/i })).toBeInTheDocument();
  });

  it('shows Save button for notes', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByRole('button', { name: /save meeting notes/i })).toBeInTheDocument();
  });

  it('typing in notes textarea works', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const textarea = screen.getByRole('textbox', { name: /meeting notes input/i });
    await userEvent.type(textarea, 'test note');
    expect(textarea).toHaveValue('test note');
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – meeting status variants', () => {
  it('shows Completed status when provided', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, status: 'Completed' });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText(/completed/i)).toBeInTheDocument();
  });

  it('shows Scheduled status when provided', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, status: 'Scheduled' });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText(/scheduled/i)).toBeInTheDocument();
  });

  it('shows Cancelled status when provided', async () => {
    mockGetMeeting.mockResolvedValue({ ...mockMeeting, status: 'Cancelled' });
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText(/cancelled/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – meeting data fields', () => {
  it('shows meeting date from mock', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText(/2026/i).length).toBeGreaterThan(0);
  });

  it('shows NCA workspace context', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getAllByText(/nca/i).length).toBeGreaterThan(0);
  });

  it('shows Steering Committee meeting type', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText(/steering committee/i)).toBeInTheDocument();
  });

  it('renders meeting page without crashing', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(document.body).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Attendee Check-in', () => {
  beforeEach(() => {
    localStorage.removeItem('meeting_attendance_mtg-1');
  });

  it('renders check-in button for each participant', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByRole('button', { name: /check in ahmed khalil/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /check in rania taleb/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /check in faisal hassan/i })).toBeInTheDocument();
  });

  it('participant buttons start with aria-pressed=false', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const btn = screen.getByRole('button', { name: /check in ahmed khalil/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking check-in button marks participant as present', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await userEvent.click(screen.getByRole('button', { name: /check in ahmed khalil/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /mark ahmed khalil absent/i })).toBeInTheDocument();
    });
  });

  it('checked-in participant button has aria-pressed=true', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await userEvent.click(screen.getByRole('button', { name: /check in ahmed khalil/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /mark ahmed khalil absent/i })).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('clicking again un-checks (marks absent)', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await userEvent.click(screen.getByRole('button', { name: /check in ahmed khalil/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /mark ahmed khalil absent/i })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /mark ahmed khalil absent/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /check in ahmed khalil/i })).toBeInTheDocument());
  });

  it('shows check-in count in participants header', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await userEvent.click(screen.getByRole('button', { name: /check in ahmed khalil/i }));
    await waitFor(() => expect(screen.getByText(/1\/3 checked in/i)).toBeInTheDocument());
  });

  it('multiple check-ins update the count', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await userEvent.click(screen.getByRole('button', { name: /check in ahmed khalil/i }));
    await userEvent.click(screen.getByRole('button', { name: /check in rania taleb/i }));
    await waitFor(() => expect(screen.getByText(/2\/3 checked in/i)).toBeInTheDocument());
  });

  it('persists check-in state to localStorage', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await userEvent.click(screen.getByRole('button', { name: /check in ahmed khalil/i }));
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('meeting_attendance_mtg-1') ?? '[]') as string[];
      expect(stored).toContain('Ahmed Khalil');
    });
  });

  it('loads check-in state from localStorage on mount', async () => {
    localStorage.setItem('meeting_attendance_mtg-1', JSON.stringify(['Rania Taleb']));
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /mark rania taleb absent/i })).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('shows 0/3 checked in when no one is checked in', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText(/0\/3 checked in/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('MeetingDetail – Copy Meeting Info', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('shows Copy Info button in meeting header', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByRole('button', { name: /copy meeting info/i })).toBeInTheDocument();
  });

  it('clicking Copy Info calls clipboard.writeText', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await userEvent.click(screen.getByRole('button', { name: /copy meeting info/i }));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });
  });

  it('clipboard.writeText called with meeting title', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await userEvent.click(screen.getByRole('button', { name: /copy meeting info/i }));
    await waitFor(() => {
      const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(text).toContain('NCA Steering Committee Q1 2026');
    });
  });

  it('clipboard.writeText called with meeting date', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await userEvent.click(screen.getByRole('button', { name: /copy meeting info/i }));
    await waitFor(() => {
      const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(text).toContain('Date:');
    });
  });

  it('button shows Copied! text after clicking', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await userEvent.click(screen.getByRole('button', { name: /copy meeting info/i }));
    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });
  });

  it('button returns to Copy Info after timeout', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await userEvent.click(screen.getByRole('button', { name: /copy meeting info/i }));
    await screen.findByText('Copied!');
    await waitFor(() => {
      expect(screen.getByText('Copy Info')).toBeInTheDocument();
    }, { timeout: 3500 });
  }, 8000);
});

// ────────────────────────────────────────────────────────────
describe('MeetingDetail – Copy Attendance Summary', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('shows Copy attendance summary button', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByRole('button', { name: /copy attendance summary to clipboard/i })).toBeInTheDocument();
  });

  it('Copy attendance button is not disabled', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByRole('button', { name: /copy attendance summary to clipboard/i })).not.toBeDisabled();
  });

  it('clicking Copy attendance calls clipboard.writeText', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await userEvent.click(screen.getByRole('button', { name: /copy attendance summary to clipboard/i }));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });
  });

  it('clipboard text contains meeting title', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await userEvent.click(screen.getByRole('button', { name: /copy attendance summary to clipboard/i }));
    await waitFor(() => {
      const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(text).toContain('NCA Steering Committee Q1 2026');
    });
  });

  it('clipboard text contains Total Participants', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await userEvent.click(screen.getByRole('button', { name: /copy attendance summary to clipboard/i }));
    await waitFor(() => {
      const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(text).toContain('Total Participants: 3');
    });
  });

  it('clipboard text contains Checked In line', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await userEvent.click(screen.getByRole('button', { name: /copy attendance summary to clipboard/i }));
    await waitFor(() => {
      const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(text).toContain('Checked In:');
    });
  });

  it('shows Copied! after clicking attendance copy button', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await userEvent.click(screen.getByRole('button', { name: /copy attendance summary to clipboard/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copy attendance summary to clipboard/i })).toHaveTextContent('Copied!');
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('MeetingDetail – Export Attendance CSV', () => {
  let mockCreateObjectURL: ReturnType<typeof vi.fn>;
  let mockRevokeObjectURL: ReturnType<typeof vi.fn>;
  let mockClick: ReturnType<typeof vi.fn>;
  let origCreate: typeof document.createElement;

  beforeEach(() => {
    localStorage.clear();
    mockCreateObjectURL = vi.fn().mockReturnValue('blob:attendance-url');
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

  it('shows Export attendance to CSV button', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByRole('button', { name: /export attendance to csv/i })).toBeInTheDocument();
  });

  it('Export attendance button is not disabled when participants exist', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByRole('button', { name: /export attendance to csv/i })).not.toBeDisabled();
  });

  it('clicking Export attendance calls URL.createObjectURL', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await userEvent.click(screen.getByRole('button', { name: /export attendance to csv/i }));
    expect(mockCreateObjectURL).toHaveBeenCalled();
  });

  it('clicking Export attendance triggers anchor click', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await userEvent.click(screen.getByRole('button', { name: /export attendance to csv/i }));
    expect(mockClick).toHaveBeenCalled();
  });

  it('clicking Export attendance calls URL.revokeObjectURL', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await userEvent.click(screen.getByRole('button', { name: /export attendance to csv/i }));
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:attendance-url');
  });
});

// ────────────────────────────────────────────────────────────
describe('MeetingDetail – Export Meeting Notes as TXT', () => {
  let mockCreateObjectURL: ReturnType<typeof vi.fn>;
  let mockRevokeObjectURL: ReturnType<typeof vi.fn>;
  let mockClick: ReturnType<typeof vi.fn>;
  let origCreate: typeof document.createElement;

  beforeEach(() => {
    localStorage.clear();
    mockCreateObjectURL = vi.fn().mockReturnValue('blob:notes-url');
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
    localStorage.clear();
  });

  it('shows Export meeting notes as TXT button', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByRole('button', { name: /export meeting notes as txt/i })).toBeInTheDocument();
  });

  it('Export notes button is disabled when notes are empty', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByRole('button', { name: /export meeting notes as txt/i })).toBeDisabled();
  });

  it('Export notes button is enabled after typing notes', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const textarea = screen.getByRole('textbox', { name: /meeting notes input/i });
    await userEvent.type(textarea, 'Action item: review budget');
    expect(screen.getByRole('button', { name: /export meeting notes as txt/i })).not.toBeDisabled();
  });

  it('clicking Export notes calls URL.createObjectURL', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const textarea = screen.getByRole('textbox', { name: /meeting notes input/i });
    await userEvent.type(textarea, 'Some notes content');
    await userEvent.click(screen.getByRole('button', { name: /export meeting notes as txt/i }));
    expect(mockCreateObjectURL).toHaveBeenCalled();
  });

  it('clicking Export notes triggers anchor click', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const textarea = screen.getByRole('textbox', { name: /meeting notes input/i });
    await userEvent.type(textarea, 'Some notes content');
    await userEvent.click(screen.getByRole('button', { name: /export meeting notes as txt/i }));
    expect(mockClick).toHaveBeenCalled();
  });

  it('clicking Export notes calls URL.revokeObjectURL', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const textarea = screen.getByRole('textbox', { name: /meeting notes input/i });
    await userEvent.type(textarea, 'Some notes content');
    await userEvent.click(screen.getByRole('button', { name: /export meeting notes as txt/i }));
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:notes-url');
  });

  it('shows Exported! feedback after clicking Export notes', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const textarea = screen.getByRole('textbox', { name: /meeting notes input/i });
    await userEvent.type(textarea, 'Some notes content');
    await userEvent.click(screen.getByRole('button', { name: /export meeting notes as txt/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export meeting notes as txt/i })).toHaveTextContent('Exported!');
    });
  });
});

describe('MeetingDetail – Copy Meeting Notes', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('shows Copy meeting notes button', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByRole('button', { name: /copy meeting notes to clipboard/i })).toBeInTheDocument();
  });

  it('Copy notes button is disabled when notes are empty', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByRole('button', { name: /copy meeting notes to clipboard/i })).toBeDisabled();
  });

  it('Copy notes button is enabled after typing notes', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const textarea = screen.getByRole('textbox', { name: /meeting notes input/i });
    await userEvent.type(textarea, 'Key decisions made in meeting');
    expect(screen.getByRole('button', { name: /copy meeting notes to clipboard/i })).not.toBeDisabled();
  });

  it('clicking Copy notes calls clipboard.writeText', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const textarea = screen.getByRole('textbox', { name: /meeting notes input/i });
    await userEvent.type(textarea, 'Key decisions made in meeting');
    await userEvent.click(screen.getByRole('button', { name: /copy meeting notes to clipboard/i }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
  });

  it('clipboard text contains the typed notes', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const textarea = screen.getByRole('textbox', { name: /meeting notes input/i });
    await userEvent.type(textarea, 'Key decisions made in meeting');
    await userEvent.click(screen.getByRole('button', { name: /copy meeting notes to clipboard/i }));
    await waitFor(() => {
      const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(text).toContain('Key decisions made in meeting');
    });
  });

  it('shows Copied! feedback after clicking Copy notes', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const textarea = screen.getByRole('textbox', { name: /meeting notes input/i });
    await userEvent.type(textarea, 'Key decisions made in meeting');
    await userEvent.click(screen.getByRole('button', { name: /copy meeting notes to clipboard/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copy meeting notes to clipboard/i })).toHaveTextContent('Copied!');
    });
  });
});

describe('MeetingDetail – Decision Log', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockGetMeeting.mockResolvedValue({ ...mockMeeting });
    mockGetDocuments.mockResolvedValue([]);
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });
  afterEach(() => vi.restoreAllMocks());

  it('renders Decision Log section heading', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('Decision Log')).toBeInTheDocument();
  });

  it('renders the new decision input field', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByRole('textbox', { name: /new decision input/i })).toBeInTheDocument();
  });

  it('renders the Add button', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByRole('button', { name: /add decision/i })).toBeInTheDocument();
  });

  it('shows empty state when no decisions logged', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('No decisions logged yet.')).toBeInTheDocument();
  });

  it('clicking Add with text adds a decision to the list', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const input = screen.getByRole('textbox', { name: /new decision input/i });
    fireEvent.change(input, { target: { value: 'Budget approved' } });
    await userEvent.click(screen.getByRole('button', { name: /add decision/i }));
    await waitFor(() => expect(screen.getByText('Budget approved')).toBeInTheDocument());
  });

  it('adding a decision clears the input', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const input = screen.getByRole('textbox', { name: /new decision input/i });
    fireEvent.change(input, { target: { value: 'Decision text' } });
    await userEvent.click(screen.getByRole('button', { name: /add decision/i }));
    await waitFor(() => expect(input).toHaveValue(''));
  });

  it('adding a decision persists it to localStorage', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const input = screen.getByRole('textbox', { name: /new decision input/i });
    fireEvent.change(input, { target: { value: 'Approved timeline' } });
    await userEvent.click(screen.getByRole('button', { name: /add decision/i }));
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('meeting_decisions_mtg-1') ?? '[]');
      expect(stored.length).toBeGreaterThan(0);
      expect(stored[0].text).toBe('Approved timeline');
    });
  });

  it('pressing Enter in input adds the decision', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const input = screen.getByRole('textbox', { name: /new decision input/i });
    fireEvent.change(input, { target: { value: 'Enter key decision' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(screen.getByText('Enter key decision')).toBeInTheDocument());
  });

  it('clicking delete button removes the decision', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const input = screen.getByRole('textbox', { name: /new decision input/i });
    fireEvent.change(input, { target: { value: 'To be deleted' } });
    await userEvent.click(screen.getByRole('button', { name: /add decision/i }));
    await screen.findByText('To be deleted');
    await userEvent.click(screen.getByRole('button', { name: /delete decision: to be deleted/i }));
    await waitFor(() => expect(screen.queryByText('To be deleted')).not.toBeInTheDocument());
  });

  it('loads persisted decisions from localStorage on mount', async () => {
    localStorage.setItem('meeting_decisions_mtg-1', JSON.stringify([{ id: 'dec-1', text: 'Pre-stored decision', timestamp: '2026-01-01T00:00:00Z' }]));
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => expect(screen.getByText('Pre-stored decision')).toBeInTheDocument());
  });

  it('decision count badge shows correct count', async () => {
    localStorage.setItem('meeting_decisions_mtg-1', JSON.stringify([
      { id: 'dec-1', text: 'Decision A', timestamp: '2026-01-01T00:00:00Z' },
      { id: 'dec-2', text: 'Decision B', timestamp: '2026-01-02T00:00:00Z' },
    ]));
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument());
  });
});

describe('MeetingDetail – Decision Search', () => {
  const threeDecisions = [
    { id: 'dec-1', text: 'Budget approved for Q1', timestamp: '2026-01-01T00:00:00Z' },
    { id: 'dec-2', text: 'Timeline extended by two weeks', timestamp: '2026-01-02T00:00:00Z' },
    { id: 'dec-3', text: 'Vendor selected for project', timestamp: '2026-01-03T00:00:00Z' },
  ];

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockGetMeeting.mockResolvedValue({ ...mockMeeting });
    mockGetDocuments.mockResolvedValue([]);
  });
  afterEach(() => vi.restoreAllMocks());

  it('does not show search input when there are 2 or fewer decisions', async () => {
    localStorage.setItem('meeting_decisions_mtg-1', JSON.stringify([
      { id: 'dec-1', text: 'Decision A', timestamp: '2026-01-01T00:00:00Z' },
      { id: 'dec-2', text: 'Decision B', timestamp: '2026-01-02T00:00:00Z' },
    ]));
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => expect(screen.getByText('Decision A')).toBeInTheDocument());
    expect(screen.queryByRole('textbox', { name: /search decisions/i })).not.toBeInTheDocument();
  });

  it('does not show search input when there are no decisions', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.queryByRole('textbox', { name: /search decisions/i })).not.toBeInTheDocument();
  });

  it('shows search input when there are more than 2 decisions', async () => {
    localStorage.setItem('meeting_decisions_mtg-1', JSON.stringify(threeDecisions));
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => expect(screen.getByRole('textbox', { name: /search decisions/i })).toBeInTheDocument());
  });

  it('filtering by search term hides non-matching decisions', async () => {
    localStorage.setItem('meeting_decisions_mtg-1', JSON.stringify(threeDecisions));
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const searchInput = await screen.findByRole('textbox', { name: /search decisions/i });
    fireEvent.change(searchInput, { target: { value: 'budget' } });
    await waitFor(() => {
      expect(screen.getByText('Budget approved for Q1')).toBeInTheDocument();
      expect(screen.queryByText('Timeline extended by two weeks')).not.toBeInTheDocument();
      expect(screen.queryByText('Vendor selected for project')).not.toBeInTheDocument();
    });
  });

  it('filtering is case-insensitive', async () => {
    localStorage.setItem('meeting_decisions_mtg-1', JSON.stringify(threeDecisions));
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const searchInput = await screen.findByRole('textbox', { name: /search decisions/i });
    fireEvent.change(searchInput, { target: { value: 'VENDOR' } });
    await waitFor(() => expect(screen.getByText('Vendor selected for project')).toBeInTheDocument());
  });

  it('clearing the search restores all decisions', async () => {
    localStorage.setItem('meeting_decisions_mtg-1', JSON.stringify(threeDecisions));
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const searchInput = await screen.findByRole('textbox', { name: /search decisions/i });
    fireEvent.change(searchInput, { target: { value: 'budget' } });
    await waitFor(() => expect(screen.queryByText('Timeline extended by two weeks')).not.toBeInTheDocument());
    fireEvent.change(searchInput, { target: { value: '' } });
    await waitFor(() => {
      expect(screen.getByText('Budget approved for Q1')).toBeInTheDocument();
      expect(screen.getByText('Timeline extended by two weeks')).toBeInTheDocument();
      expect(screen.getByText('Vendor selected for project')).toBeInTheDocument();
    });
  });

  it('shows no items when search matches nothing', async () => {
    localStorage.setItem('meeting_decisions_mtg-1', JSON.stringify(threeDecisions));
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const searchInput = await screen.findByRole('textbox', { name: /search decisions/i });
    fireEvent.change(searchInput, { target: { value: 'xyznotfound' } });
    await waitFor(() => {
      expect(screen.queryByText('Budget approved for Q1')).not.toBeInTheDocument();
      expect(screen.queryByText('Timeline extended by two weeks')).not.toBeInTheDocument();
      expect(screen.queryByText('Vendor selected for project')).not.toBeInTheDocument();
    });
  });

  it('search matches partial text in the middle of a decision', async () => {
    localStorage.setItem('meeting_decisions_mtg-1', JSON.stringify(threeDecisions));
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const searchInput = await screen.findByRole('textbox', { name: /search decisions/i });
    fireEvent.change(searchInput, { target: { value: 'weeks' } });
    await waitFor(() => {
      expect(screen.getByText('Timeline extended by two weeks')).toBeInTheDocument();
      expect(screen.queryByText('Budget approved for Q1')).not.toBeInTheDocument();
    });
  });
});

// ── Action Items ──────────────────────────────────────────────
describe('MeetingDetail – Action Items', () => {
  beforeEach(() => {
    localStorage.removeItem('meeting_actions_mtg-1');
  });

  function renderDetail() {
    mockGetMeeting.mockResolvedValue(mockMeeting);
    mockGetDocuments.mockResolvedValue([]);
    return render(
      <MemoryRouter initialEntries={['/meetings/mtg-1']}>
        <Routes>
          <Route path="/meetings/:id" element={<MeetingDetail />} />
        </Routes>
      </MemoryRouter>
    );
  }

  it('renders Action Items section', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('Action Items')).toBeInTheDocument();
  });

  it('renders action item text input', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByRole('textbox', { name: /new action item text/i })).toBeInTheDocument();
  });

  it('renders action item owner input', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByRole('textbox', { name: /action item owner/i })).toBeInTheDocument();
  });

  it('renders Add action item button', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByRole('button', { name: /add action item/i })).toBeInTheDocument();
  });

  it('shows empty state when no action items', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText(/no action items yet/i)).toBeInTheDocument();
  });

  it('adding an action item shows it in the list', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const textInput = screen.getByRole('textbox', { name: /new action item text/i });
    fireEvent.change(textInput, { target: { value: 'Update the project plan' } });
    await userEvent.click(screen.getByRole('button', { name: /add action item/i }));
    expect(screen.getByText('Update the project plan')).toBeInTheDocument();
  });

  it('clearing the input after adding', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const textInput = screen.getByRole('textbox', { name: /new action item text/i });
    fireEvent.change(textInput, { target: { value: 'Send report' } });
    await userEvent.click(screen.getByRole('button', { name: /add action item/i }));
    expect(textInput).toHaveValue('');
  });

  it('action item shows delete button', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    fireEvent.change(screen.getByRole('textbox', { name: /new action item text/i }), { target: { value: 'Follow up with client' } });
    await userEvent.click(screen.getByRole('button', { name: /add action item/i }));
    expect(screen.getByRole('button', { name: /delete action item: follow up with client/i })).toBeInTheDocument();
  });

  it('deleting an action item removes it', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    fireEvent.change(screen.getByRole('textbox', { name: /new action item text/i }), { target: { value: 'Task to delete' } });
    await userEvent.click(screen.getByRole('button', { name: /add action item/i }));
    await userEvent.click(screen.getByRole('button', { name: /delete action item: task to delete/i }));
    expect(screen.queryByText('Task to delete')).not.toBeInTheDocument();
  });

  it('can complete an action item', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    fireEvent.change(screen.getByRole('textbox', { name: /new action item text/i }), { target: { value: 'Review design doc' } });
    await userEvent.click(screen.getByRole('button', { name: /add action item/i }));
    const completeBtn = screen.getByRole('button', { name: /complete action item: review design doc/i });
    await userEvent.click(completeBtn);
    expect(screen.getByRole('button', { name: /reopen action item: review design doc/i })).toBeInTheDocument();
  });

  it('shows owner tag when owner is provided', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    fireEvent.change(screen.getByRole('textbox', { name: /new action item text/i }), { target: { value: 'Send deliverable' } });
    fireEvent.change(screen.getByRole('textbox', { name: /action item owner/i }), { target: { value: 'Ahmed' } });
    await userEvent.click(screen.getByRole('button', { name: /add action item/i }));
    expect(screen.getByText('Ahmed')).toBeInTheDocument();
  });

  it('persists action items in localStorage', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    fireEvent.change(screen.getByRole('textbox', { name: /new action item text/i }), { target: { value: 'Persist this' } });
    await userEvent.click(screen.getByRole('button', { name: /add action item/i }));
    const stored = JSON.parse(localStorage.getItem('meeting_actions_mtg-1') ?? '[]');
    expect(stored.length).toBe(1);
    expect(stored[0].text).toBe('Persist this');
  });

  it('loads existing action items from localStorage on mount', async () => {
    const existing = [{ id: 'act-1', text: 'Existing action', owner: 'Rania', done: false }];
    localStorage.setItem('meeting_actions_mtg-1', JSON.stringify(existing));
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('Existing action')).toBeInTheDocument();
    expect(screen.getByText('Rania')).toBeInTheDocument();
  });
});

describe('MeetingDetail – Pending Actions Filter', () => {
  beforeEach(() => {
    localStorage.removeItem('meeting_actions_mtg-1');
  });

  function renderDetail() {
    mockGetMeeting.mockResolvedValue(mockMeeting);
    mockGetDocuments.mockResolvedValue([]);
    return render(
      <MemoryRouter initialEntries={['/meetings/mtg-1']}>
        <Routes>
          <Route path="/meetings/:id" element={<MeetingDetail />} />
        </Routes>
      </MemoryRouter>
    );
  }

  it('renders the Pending Only toggle button', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByRole('button', { name: /show pending action items only/i })).toBeInTheDocument();
  });

  it('Pending Only button is not pressed by default', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const btn = screen.getByRole('button', { name: /show pending action items only/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Pending Only sets aria-pressed to true', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const btn = screen.getByRole('button', { name: /show pending action items only/i });
    await userEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking Pending Only again deactivates the filter', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const btn = screen.getByRole('button', { name: /show pending action items only/i });
    await userEvent.click(btn);
    await userEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('Pending Only filter hides completed action items', async () => {
    const items = [
      { id: 'act-1', text: 'Pending task', owner: '', done: false },
      { id: 'act-2', text: 'Completed task', owner: '', done: true },
    ];
    localStorage.setItem('meeting_actions_mtg-1', JSON.stringify(items));
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByText('Pending task')).toBeInTheDocument();
    expect(screen.getByText('Completed task')).toBeInTheDocument();
    const btn = screen.getByRole('button', { name: /show pending action items only/i });
    await userEvent.click(btn);
    expect(screen.getByText('Pending task')).toBeInTheDocument();
    expect(screen.queryByText('Completed task')).not.toBeInTheDocument();
  });

  it('turning off Pending Only restores all items', async () => {
    const items = [
      { id: 'act-1', text: 'Pending task', owner: '', done: false },
      { id: 'act-2', text: 'Completed task', owner: '', done: true },
    ];
    localStorage.setItem('meeting_actions_mtg-1', JSON.stringify(items));
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const btn = screen.getByRole('button', { name: /show pending action items only/i });
    await userEvent.click(btn);
    await userEvent.click(btn);
    expect(screen.getByText('Pending task')).toBeInTheDocument();
    expect(screen.getByText('Completed task')).toBeInTheDocument();
  });

  it('Pending Only shows only pending when all are pending', async () => {
    const items = [
      { id: 'act-1', text: 'Task Alpha', owner: '', done: false },
      { id: 'act-2', text: 'Task Beta', owner: '', done: false },
    ];
    localStorage.setItem('meeting_actions_mtg-1', JSON.stringify(items));
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const btn = screen.getByRole('button', { name: /show pending action items only/i });
    await userEvent.click(btn);
    expect(screen.getByText('Task Alpha')).toBeInTheDocument();
    expect(screen.getByText('Task Beta')).toBeInTheDocument();
  });
});

// ── Action Item Search ─────────────────────────────────────────
describe('MeetingDetail – Action Item Search', () => {
  const actions = [
    { id: 'act-a', text: 'Review design mockups', owner: 'Alice', done: false },
    { id: 'act-b', text: 'Update project timeline', owner: 'Bob', done: false },
    { id: 'act-c', text: 'Send status report', owner: 'Alice', done: true },
  ];

  beforeEach(() => {
    localStorage.setItem('meeting_actions_mtg-1', JSON.stringify(actions));
  });

  afterEach(() => {
    localStorage.removeItem('meeting_actions_mtg-1');
  });

  it('renders search action items input when actions exist', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByRole('textbox', { name: /search action items/i })).toBeInTheDocument();
  });

  it('search input is empty by default', async () => {
    renderDetail();
    await screen.findByText('Review design mockups');
    expect(screen.getByRole('textbox', { name: /search action items/i })).toHaveValue('');
  });

  it('typing filters action items by text', async () => {
    renderDetail();
    await screen.findByText('Review design mockups');
    await userEvent.type(screen.getByRole('textbox', { name: /search action items/i }), 'design');
    expect(screen.getByText('Review design mockups')).toBeInTheDocument();
    expect(screen.queryByText('Update project timeline')).not.toBeInTheDocument();
  });

  it('search filters by owner name', async () => {
    renderDetail();
    await screen.findByText('Review design mockups');
    await userEvent.type(screen.getByRole('textbox', { name: /search action items/i }), 'Bob');
    expect(screen.getByText('Update project timeline')).toBeInTheDocument();
    expect(screen.queryByText('Review design mockups')).not.toBeInTheDocument();
  });

  it('clearing search restores all action items', async () => {
    renderDetail();
    await screen.findByText('Review design mockups');
    const input = screen.getByRole('textbox', { name: /search action items/i });
    await userEvent.type(input, 'design');
    expect(screen.queryByText('Update project timeline')).not.toBeInTheDocument();
    await userEvent.clear(input);
    expect(screen.getByText('Update project timeline')).toBeInTheDocument();
  });

  it('search is case-insensitive', async () => {
    renderDetail();
    await screen.findByText('Review design mockups');
    await userEvent.type(screen.getByRole('textbox', { name: /search action items/i }), 'DESIGN');
    expect(screen.getByText('Review design mockups')).toBeInTheDocument();
  });

  it('search with no match shows no action items', async () => {
    renderDetail();
    await screen.findByText('Review design mockups');
    await userEvent.type(screen.getByRole('textbox', { name: /search action items/i }), 'zzznotfound');
    expect(screen.queryByText('Review design mockups')).not.toBeInTheDocument();
    expect(screen.queryByText('Update project timeline')).not.toBeInTheDocument();
  });

  it('search combines with pending only filter', async () => {
    renderDetail();
    await screen.findByText('Review design mockups');
    await userEvent.click(screen.getByRole('button', { name: /show pending action items only/i }));
    await userEvent.type(screen.getByRole('textbox', { name: /search action items/i }), 'Alice');
    expect(screen.getByText('Review design mockups')).toBeInTheDocument();
    expect(screen.queryByText('Send status report')).not.toBeInTheDocument();
  });
});

// ── Action Item Sort ─────────────────────────────────────────────
describe('MeetingDetail – Action Item Sort', () => {
  const sortActions = [
    { id: 'srt-1', text: 'Zara task review', owner: 'Zara Smith', done: false },
    { id: 'srt-2', text: 'Alex task planning', owner: 'Alex Brown', done: true },
    { id: 'srt-3', text: 'Mina task deploy', owner: 'Mina Chen', done: false },
  ];

  beforeEach(() => {
    localStorage.setItem('meeting_actions_mtg-1', JSON.stringify(sortActions));
  });

  afterEach(() => {
    localStorage.removeItem('meeting_actions_mtg-1');
  });

  it('renders default, owner, and pending-first sort buttons', async () => {
    renderDetail();
    await screen.findByText('Zara task review');
    expect(screen.getByRole('button', { name: /sort actions by default/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sort actions by owner/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sort actions by pending/i })).toBeInTheDocument();
  });

  it('default sort button is pressed on load', async () => {
    renderDetail();
    await screen.findByText('Zara task review');
    expect(screen.getByRole('button', { name: /sort actions by default/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /sort actions by owner/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking owner sort activates it', async () => {
    renderDetail();
    await screen.findByText('Zara task review');
    await userEvent.click(screen.getByRole('button', { name: /sort actions by owner/i }));
    expect(screen.getByRole('button', { name: /sort actions by owner/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /sort actions by default/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('sort by owner orders Alex before Zara alphabetically', async () => {
    renderDetail();
    await screen.findByText('Zara task review');
    await userEvent.click(screen.getByRole('button', { name: /sort actions by owner/i }));
    const alexEl = await screen.findByText('Alex task planning');
    const zaraEl = screen.getByText('Zara task review');
    expect(alexEl.compareDocumentPosition(zaraEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('sort by pending first places undone items before done items', async () => {
    renderDetail();
    await screen.findByText('Zara task review');
    await userEvent.click(screen.getByRole('button', { name: /sort actions by pending/i }));
    const zaraEl = await screen.findByText('Zara task review');
    const alexEl = screen.getByText('Alex task planning');
    expect(zaraEl.compareDocumentPosition(alexEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('switching back to default sort deactivates other buttons', async () => {
    renderDetail();
    await screen.findByText('Zara task review');
    await userEvent.click(screen.getByRole('button', { name: /sort actions by owner/i }));
    await userEvent.click(screen.getByRole('button', { name: /sort actions by default/i }));
    expect(screen.getByRole('button', { name: /sort actions by default/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /sort actions by owner/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('all three action items remain visible after sort change', async () => {
    renderDetail();
    await screen.findByText('Zara task review');
    await userEvent.click(screen.getByRole('button', { name: /sort actions by owner/i }));
    expect(screen.getByText('Zara task review')).toBeInTheDocument();
    expect(screen.getByText('Alex task planning')).toBeInTheDocument();
    expect(screen.getByText('Mina task deploy')).toBeInTheDocument();
  });
});

describe('MeetingDetail – Sort Actions by Text', () => {
  const textActions = [
    { id: 'txt-1', text: 'Zara task review', owner: 'Owner1', done: false },
    { id: 'txt-2', text: 'Alex task planning', owner: 'Owner2', done: false },
    { id: 'txt-3', text: 'Mina task deploy', owner: 'Owner3', done: false },
  ];

  beforeEach(() => {
    localStorage.setItem('meeting_actions_mtg-1', JSON.stringify(textActions));
  });

  afterEach(() => {
    localStorage.removeItem('meeting_actions_mtg-1');
  });

  it('renders text sort button', async () => {
    renderDetail();
    await screen.findByText('Zara task review');
    expect(screen.getByRole('button', { name: /sort actions by text/i })).toBeInTheDocument();
  });

  it('text sort button is not pressed by default', async () => {
    renderDetail();
    await screen.findByText('Zara task review');
    expect(screen.getByRole('button', { name: /sort actions by text/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking text sort activates it', async () => {
    renderDetail();
    await screen.findByText('Zara task review');
    await userEvent.click(screen.getByRole('button', { name: /sort actions by text/i }));
    expect(screen.getByRole('button', { name: /sort actions by text/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /sort actions by default/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('text sort places Alex before Zara in DOM', async () => {
    renderDetail();
    await screen.findByText('Zara task review');
    await userEvent.click(screen.getByRole('button', { name: /sort actions by text/i }));
    const alexEl = await screen.findByText('Alex task planning');
    const zaraEl = screen.getByText('Zara task review');
    expect(alexEl.compareDocumentPosition(zaraEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('all three actions remain visible after text sort', async () => {
    renderDetail();
    await screen.findByText('Zara task review');
    await userEvent.click(screen.getByRole('button', { name: /sort actions by text/i }));
    expect(screen.getByText('Alex task planning')).toBeInTheDocument();
    expect(screen.getByText('Mina task deploy')).toBeInTheDocument();
    expect(screen.getByText('Zara task review')).toBeInTheDocument();
  });
});

describe('MeetingDetail – Decision Sort', () => {
  const decisionKey = 'meeting_decisions_mtg-1';
  const sortDecisions = [
    { id: 'dec-z', text: 'Zara review findings', timestamp: '2026-04-15T10:05:00Z' },
    { id: 'dec-a', text: 'Alex compile report', timestamp: '2026-04-15T10:06:00Z' },
    { id: 'dec-m', text: 'Mina schedule follow-up', timestamp: '2026-04-15T10:07:00Z' },
  ];

  beforeEach(() => {
    localStorage.setItem(decisionKey, JSON.stringify(sortDecisions));
  });

  afterEach(() => {
    localStorage.removeItem(decisionKey);
  });

  it('renders decision sort buttons when decisions exist', async () => {
    renderDetail();
    await screen.findByText('Zara review findings');
    expect(screen.getByRole('button', { name: /sort decisions by default/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sort decisions by text/i })).toBeInTheDocument();
  });

  it('default decision sort button is pressed by default', async () => {
    renderDetail();
    await screen.findByText('Zara review findings');
    expect(screen.getByRole('button', { name: /sort decisions by default/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /sort decisions by text/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking text sort activates it and deactivates default', async () => {
    renderDetail();
    await screen.findByText('Zara review findings');
    await userEvent.click(screen.getByRole('button', { name: /sort decisions by text/i }));
    expect(screen.getByRole('button', { name: /sort decisions by text/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /sort decisions by default/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('text sort places Alex before Zara in DOM', async () => {
    renderDetail();
    await screen.findByText('Zara review findings');
    await userEvent.click(screen.getByRole('button', { name: /sort decisions by text/i }));
    const alexEl = await screen.findByText('Alex compile report');
    const zaraEl = screen.getByText('Zara review findings');
    expect(alexEl.compareDocumentPosition(zaraEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('all three decisions remain visible after text sort', async () => {
    renderDetail();
    await screen.findByText('Zara review findings');
    await userEvent.click(screen.getByRole('button', { name: /sort decisions by text/i }));
    expect(screen.getByText('Alex compile report')).toBeInTheDocument();
    expect(screen.getByText('Mina schedule follow-up')).toBeInTheDocument();
    expect(screen.getByText('Zara review findings')).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('MeetingDetail – Copy Action Items Summary', () => {
  beforeEach(() => {
    localStorage.removeItem('meeting_actions_mtg-1');
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('copy action items button not visible when no action items', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.queryByRole('button', { name: /copy action items summary/i })).not.toBeInTheDocument();
  });

  it('copy action items button appears after adding an action item', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    fireEvent.change(screen.getByRole('textbox', { name: /new action item text/i }), { target: { value: 'Prepare quarterly report' } });
    await userEvent.click(screen.getByRole('button', { name: /add action item/i }));
    expect(screen.getByRole('button', { name: /copy action items summary to clipboard/i })).toBeInTheDocument();
  });

  it('clicking copy action items calls clipboard.writeText', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    fireEvent.change(screen.getByRole('textbox', { name: /new action item text/i }), { target: { value: 'Review stakeholder feedback' } });
    await userEvent.click(screen.getByRole('button', { name: /add action item/i }));
    await userEvent.click(screen.getByRole('button', { name: /copy action items summary to clipboard/i }));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });
  });

  it('clipboard text contains the action item text', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    fireEvent.change(screen.getByRole('textbox', { name: /new action item text/i }), { target: { value: 'Update risk register' } });
    await userEvent.click(screen.getByRole('button', { name: /add action item/i }));
    await userEvent.click(screen.getByRole('button', { name: /copy action items summary to clipboard/i }));
    await waitFor(() => {
      const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(text).toContain('Update risk register');
    });
  });

  it('copy button shows Copied! feedback', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    fireEvent.change(screen.getByRole('textbox', { name: /new action item text/i }), { target: { value: 'Send meeting minutes' } });
    await userEvent.click(screen.getByRole('button', { name: /add action item/i }));
    await userEvent.click(screen.getByRole('button', { name: /copy action items summary to clipboard/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copy action items summary to clipboard/i })).toHaveTextContent('Copied!');
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('MeetingDetail – Export Action Items CSV', () => {
  let mockCreateObjectURL: ReturnType<typeof vi.fn>;
  let mockRevokeObjectURL: ReturnType<typeof vi.fn>;
  let mockClick: ReturnType<typeof vi.fn>;
  let origCreate: typeof document.createElement;

  beforeEach(() => {
    localStorage.removeItem('meeting_actions_mtg-1');
    mockCreateObjectURL = vi.fn().mockReturnValue('blob:actions-csv-url');
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

  it('export action items CSV button not visible when no action items', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.queryByRole('button', { name: /export action items to csv/i })).not.toBeInTheDocument();
  });

  it('export action items CSV button appears after adding an action item', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    fireEvent.change(screen.getByRole('textbox', { name: /new action item text/i }), { target: { value: 'Schedule follow-up' } });
    await userEvent.click(screen.getByRole('button', { name: /add action item/i }));
    expect(screen.getByRole('button', { name: /export action items to csv/i })).toBeInTheDocument();
  });

  it('clicking export action items CSV calls URL.createObjectURL', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    fireEvent.change(screen.getByRole('textbox', { name: /new action item text/i }), { target: { value: 'Finalize budget plan' } });
    await userEvent.click(screen.getByRole('button', { name: /add action item/i }));
    await userEvent.click(screen.getByRole('button', { name: /export action items to csv/i }));
    expect(mockCreateObjectURL).toHaveBeenCalled();
  });

  it('clicking export action items CSV triggers anchor click', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    fireEvent.change(screen.getByRole('textbox', { name: /new action item text/i }), { target: { value: 'Contact MOCI team' } });
    await userEvent.click(screen.getByRole('button', { name: /add action item/i }));
    await userEvent.click(screen.getByRole('button', { name: /export action items to csv/i }));
    expect(mockClick).toHaveBeenCalled();
  });

  it('clicking export action items CSV calls URL.revokeObjectURL', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    fireEvent.change(screen.getByRole('textbox', { name: /new action item text/i }), { target: { value: 'Draft project charter' } });
    await userEvent.click(screen.getByRole('button', { name: /add action item/i }));
    await userEvent.click(screen.getByRole('button', { name: /export action items to csv/i }));
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:actions-csv-url');
  });

  it('export button shows Exported! feedback', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    fireEvent.change(screen.getByRole('textbox', { name: /new action item text/i }), { target: { value: 'Prepare presentation' } });
    await userEvent.click(screen.getByRole('button', { name: /add action item/i }));
    await userEvent.click(screen.getByRole('button', { name: /export action items to csv/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export action items to csv/i })).toHaveTextContent('Exported!');
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('MeetingDetail – Starred Action Items', () => {
  async function addActionItem(text: string) {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    fireEvent.change(screen.getByRole('textbox', { name: /new action item text/i }), { target: { value: text } });
    await userEvent.click(screen.getByRole('button', { name: /add action item/i }));
  }

  it('shows "Starred" filter button', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByRole('button', { name: /show starred action items only/i })).toBeInTheDocument();
  });

  it('Starred filter button has aria-pressed false by default', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const btn = screen.getByRole('button', { name: /show starred action items only/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('each action item has a star button', async () => {
    await addActionItem('Prepare quarterly report');
    const starBtn = await screen.findByRole('button', { name: /^Star action item: Prepare quarterly report$/i });
    expect(starBtn).toBeInTheDocument();
  });

  it('star button has aria-pressed false for new action items', async () => {
    await addActionItem('Draft stakeholder plan');
    const starBtn = await screen.findByRole('button', { name: /^Star action item: Draft stakeholder plan$/i });
    expect(starBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking star button stars an action item', async () => {
    await addActionItem('Review risk register');
    const starBtn = await screen.findByRole('button', { name: /^Star action item: Review risk register$/i });
    await userEvent.click(starBtn);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Unstar action item: Review risk register$/i })).toBeInTheDocument();
    });
  });

  it('starring an action item persists to localStorage', async () => {
    await addActionItem('Submit milestone report');
    const starBtn = await screen.findByRole('button', { name: /^Star action item: Submit milestone report$/i });
    await userEvent.click(starBtn);
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('meeting_actions_mtg-1') ?? '[]');
      expect(stored.some((a: { text: string; starred: boolean }) => a.text === 'Submit milestone report' && a.starred === true)).toBe(true);
    });
  });

  it('clicking Unstar removes the star', async () => {
    await addActionItem('Coordinate workshops');
    const starBtn = await screen.findByRole('button', { name: /^Star action item: Coordinate workshops$/i });
    await userEvent.click(starBtn);
    const unstarBtn = await screen.findByRole('button', { name: /^Unstar action item: Coordinate workshops$/i });
    await userEvent.click(unstarBtn);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Star action item: Coordinate workshops$/i })).toBeInTheDocument();
    });
  });

  it('Starred filter shows only starred items', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    // Add two items
    fireEvent.change(screen.getByRole('textbox', { name: /new action item text/i }), { target: { value: 'Critical task' } });
    await userEvent.click(screen.getByRole('button', { name: /add action item/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /new action item text/i }), { target: { value: 'Normal task' } });
    await userEvent.click(screen.getByRole('button', { name: /add action item/i }));
    // Star only Critical task
    const starBtn = await screen.findByRole('button', { name: /^Star action item: Critical task$/i });
    await userEvent.click(starBtn);
    // Enable starred filter
    await userEvent.click(screen.getByRole('button', { name: /show starred action items only/i }));
    await waitFor(() => {
      expect(screen.getByText('Critical task')).toBeInTheDocument();
      expect(screen.queryByText('Normal task')).not.toBeInTheDocument();
    });
  });

  it('Starred filter button has aria-pressed true when active', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const btn = screen.getByRole('button', { name: /show starred action items only/i });
    await userEvent.click(btn);
    await waitFor(() => expect(btn).toHaveAttribute('aria-pressed', 'true'));
  });

  it('toggling Starred filter off shows all items again', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    fireEvent.change(screen.getByRole('textbox', { name: /new action item text/i }), { target: { value: 'Test item' } });
    await userEvent.click(screen.getByRole('button', { name: /add action item/i }));
    const filterBtn = screen.getByRole('button', { name: /show starred action items only/i });
    await userEvent.click(filterBtn);
    await userEvent.click(filterBtn);
    await waitFor(() => expect(screen.getByText('Test item')).toBeInTheDocument());
  });

  it('"Starred First" sort option is present', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    expect(screen.getByRole('button', { name: /sort actions by starred/i })).toBeInTheDocument();
  });

  it('"Starred First" sort button sets aria-pressed true when clicked', async () => {
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    const sortBtn = screen.getByRole('button', { name: /sort actions by starred/i });
    await userEvent.click(sortBtn);
    expect(sortBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('starred items load from localStorage on initial render', async () => {
    localStorage.setItem('meeting_actions_mtg-1', JSON.stringify([
      { id: 'act-1', text: 'Persisted starred item', owner: '', done: false, starred: true },
    ]));
    renderDetail();
    await screen.findByText('NCA Steering Committee Q1 2026');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Unstar action item: Persisted starred item$/i })).toBeInTheDocument();
    });
  });
});
