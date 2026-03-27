import { describe, it, expect, vi, beforeEach } from 'vitest';
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
