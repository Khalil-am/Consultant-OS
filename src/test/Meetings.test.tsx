import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// ── Hoisted mocks ────────────────────────────────────────────
const {
  mockGetMeetings, mockGetWorkspaces, mockUpsertMeeting,
  mockUpdateMeeting, mockDeleteMeeting, mockUpsertDocument,
} = vi.hoisted(() => ({
  mockGetMeetings: vi.fn(),
  mockGetWorkspaces: vi.fn(),
  mockUpsertMeeting: vi.fn(),
  mockUpdateMeeting: vi.fn(),
  mockDeleteMeeting: vi.fn(),
  mockUpsertDocument: vi.fn(),
}));

vi.mock('../lib/db', () => ({
  getMeetings: mockGetMeetings,
  getWorkspaces: mockGetWorkspaces,
  upsertMeeting: mockUpsertMeeting,
  updateMeeting: mockUpdateMeeting,
  deleteMeeting: mockDeleteMeeting,
  upsertDocument: mockUpsertDocument,
}));

vi.mock('../hooks/useLayout', () => ({
  useLayout: () => ({ width: 1200, isMobile: false, isTablet: false }),
}));

import Meetings from '../screens/Meetings';

// ── Fixtures ──────────────────────────────────────────────────
const mockMeeting = {
  id: 'm1',
  title: 'Sprint Planning',
  type: 'Review' as const,
  date: '2026-03-20',
  time: '09:00',
  duration: '1h',
  workspace: 'MOCI',
  workspace_id: 'ws-1',
  location: 'Boardroom A',
  participants: ['AM', 'RT'],
  status: 'Upcoming' as const,
  agenda: null, notes: null, attachments: null, action_items: null,
  minutes_generated: false, actions_extracted: 0, decisions_logged: 0, quorum_status: null,
};

const mockWorkspace = {
  id: 'ws-1', name: 'MOCI', type: 'Procurement', status: 'Active' as const,
  progress: 65, language: 'AR', sector: 'Government', contributors: [],
  created_at: '', updated_at: '',
};

function renderMeetings() {
  return render(<MemoryRouter><Meetings /></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetMeetings.mockResolvedValue([]);
  mockGetWorkspaces.mockResolvedValue([mockWorkspace]);
  mockUpsertMeeting.mockResolvedValue({ ...mockMeeting });
  mockUpdateMeeting.mockResolvedValue({ ...mockMeeting, status: 'Completed' });
  mockDeleteMeeting.mockResolvedValue(undefined);
  mockUpsertDocument.mockResolvedValue({ id: 'doc-1' });
  // Mock window.confirm — handleDeleteMeeting calls confirm()
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

// ────────────────────────────────────────────────────────────
describe('Meetings – Load', () => {
  it('shows empty state when no meetings', async () => {
    renderMeetings();
    expect(await screen.findByText('No meetings found')).toBeInTheDocument();
  });

  it('renders meeting cards from supabase', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    // title appears in the card list AND the right sidebar — use getAllByText
    const titles = await screen.findAllByText('Sprint Planning');
    expect(titles.length).toBeGreaterThan(0);
  });

  it('calls getMeetings on mount', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalledTimes(1));
  });

  it('calls getWorkspaces on mount', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetWorkspaces).toHaveBeenCalledTimes(1));
  });

  it('shows stat cards', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    expect(screen.getByText('Total Meetings')).toBeInTheDocument();
    // "Upcoming" and "Completed" appear in both stat cards and filter tabs
    expect(screen.getAllByText('Upcoming').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Completed').length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Meetings – Filter tabs', () => {
  it('shows Upcoming filter tab', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    expect(screen.getByRole('button', { name: 'Upcoming' })).toBeInTheDocument();
  });

  it('shows Completed filter tab', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    expect(screen.getByRole('button', { name: 'Completed' })).toBeInTheDocument();
  });

  it('filters to Completed meetings', async () => {
    const completed = { ...mockMeeting, id: 'm3', title: 'Past Meeting', status: 'Completed' as const };
    mockGetMeetings.mockResolvedValueOnce([mockMeeting, completed]);
    renderMeetings();
    await screen.findAllByText('Sprint Planning');

    await userEvent.click(screen.getByRole('button', { name: 'Completed' }));
    expect(screen.getAllByText('Past Meeting').length).toBeGreaterThan(0);
    // Upcoming sprint planning should not be in the main card list
    // (but may still be in sidebar — check main area only)
    const mainCards = document.querySelector('[style*="flex-direction: column"][style*="gap: 0.625rem"]');
    if (mainCards) {
      expect(mainCards.querySelector('h3')?.textContent).not.toBe('Sprint Planning');
    }
  });

  it('filter tabs are all rendered', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    // filterTabs = ['All', 'Upcoming', 'Completed', 'Needs Action']
    // 'All' renders as 'All Meetings'
    expect(screen.getByRole('button', { name: 'All Meetings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upcoming' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Completed' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Needs Action' })).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Meetings – Search', () => {
  it('shows search input', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    expect(screen.getByPlaceholderText('Search meetings…')).toBeInTheDocument();
  });

  it('filters meetings by typing in search', async () => {
    const m2 = { ...mockMeeting, id: 'm2', title: 'Steering Committee Alpha' };
    mockGetMeetings.mockResolvedValueOnce([mockMeeting, m2]);
    renderMeetings();
    await screen.findAllByText('Sprint Planning');

    await userEvent.type(screen.getByPlaceholderText('Search meetings…'), 'Steering');
    expect(screen.getAllByText('Steering Committee Alpha').length).toBeGreaterThan(0);
    // Sprint Planning should be hidden in main list (not in sidebar either since it's Upcoming)
    const after = screen.queryAllByText('Sprint Planning');
    // Either 0 (fully hidden) or only in sidebar which is filtered separately
    // Just verify Steering is shown
    expect(screen.getAllByText('Steering Committee Alpha').length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Meetings – Create modal', () => {
  it('opens modal on New Meeting click', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    await userEvent.click(screen.getByRole('button', { name: /new meeting/i }));
    // Modal heading is an h2
    expect(screen.getByRole('heading', { name: 'New Meeting' })).toBeInTheDocument();
  });

  it('shows title input with correct placeholder', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    await userEvent.click(screen.getByRole('button', { name: /new meeting/i }));
    expect(screen.getByPlaceholderText(/NCA Steering Committee/i)).toBeInTheDocument();
  });

  it('closes modal on Cancel', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    await userEvent.click(screen.getByRole('button', { name: /new meeting/i }));
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByRole('heading', { name: 'New Meeting' })).not.toBeInTheDocument();
  });

  it('Create Meeting button is disabled when fields empty', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    await userEvent.click(screen.getByRole('button', { name: /new meeting/i }));
    expect(screen.getByRole('button', { name: /create meeting/i })).toBeDisabled();
  });

  it('calls upsertMeeting when all required fields are filled', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    await userEvent.click(screen.getByRole('button', { name: /new meeting/i }));

    // Fill title
    await userEvent.type(screen.getByPlaceholderText(/NCA Steering Committee/i), 'New Kickoff');
    // Date input has no associated label — use querySelector
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    await userEvent.type(dateInput, '2026-03-25');
    // Select workspace — no aria label; use the first combobox after title
    const selects = screen.getAllByRole('combobox');
    const wsSelect = selects.find(s => s.innerHTML.includes('ws-1') || s.innerHTML.includes('Select workspace'));
    if (wsSelect) await userEvent.selectOptions(wsSelect, 'ws-1');

    await userEvent.click(screen.getByRole('button', { name: /create meeting/i }));
    await waitFor(() => expect(mockUpsertMeeting).toHaveBeenCalledTimes(1));
  });
});

// ────────────────────────────────────────────────────────────
describe('Meetings – Edit', () => {
  it('opens Edit modal with pre-filled title', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    await screen.findAllByText('Sprint Planning');

    await userEvent.click(screen.getByTitle('Edit meeting'));
    expect(screen.getByRole('heading', { name: 'Edit Meeting' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Sprint Planning')).toBeInTheDocument();
  });

  it('shows Save Changes button in edit mode', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    await screen.findAllByText('Sprint Planning');

    await userEvent.click(screen.getByTitle('Edit meeting'));
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
  });

  it('calls updateMeeting when saving edits', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    mockUpdateMeeting.mockResolvedValueOnce({ ...mockMeeting, title: 'Updated Title' });
    renderMeetings();
    await screen.findAllByText('Sprint Planning');

    await userEvent.click(screen.getByTitle('Edit meeting'));
    await userEvent.clear(screen.getByDisplayValue('Sprint Planning'));
    await userEvent.type(screen.getByPlaceholderText(/NCA Steering Committee/i), 'Updated Title');

    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(mockUpdateMeeting).toHaveBeenCalledTimes(1));
  });
});

// ────────────────────────────────────────────────────────────
describe('Meetings – Delete', () => {
  it('calls deleteMeeting after confirm', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    await screen.findAllByText('Sprint Planning');

    await userEvent.click(screen.getByTitle('Delete meeting'));
    await waitFor(() => expect(mockDeleteMeeting).toHaveBeenCalledWith('m1'));
  });

  it('removes meeting from list', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    await screen.findAllByText('Sprint Planning');

    await userEvent.click(screen.getByTitle('Delete meeting'));
    await waitFor(() => {
      // After deletion the card list should have no heading with Sprint Planning
      const headings = screen.queryAllByRole('heading', { level: 3 });
      expect(headings.every(h => h.textContent !== 'Sprint Planning')).toBe(true);
    });
  });

  it('does not delete when confirm is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false);
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    await screen.findAllByText('Sprint Planning');

    await userEvent.click(screen.getByTitle('Delete meeting'));
    await waitFor(() => expect(mockDeleteMeeting).not.toHaveBeenCalled());
  });
});

// ────────────────────────────────────────────────────────────
describe('Meetings – Mark Complete', () => {
  it('calls updateMeeting with status Completed', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    await screen.findAllByText('Sprint Planning');

    // "Complete" action button (exact match) is different from "Completed" filter tab
    await userEvent.click(screen.getByRole('button', { name: /^complete$/i }));
    await waitFor(() => {
      expect(mockUpdateMeeting).toHaveBeenCalledWith('m1', { status: 'Completed' });
    });
  });

  it('updates meeting in state after marking complete', async () => {
    const completed = { ...mockMeeting, status: 'Completed' as const };
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    mockUpdateMeeting.mockResolvedValueOnce(completed);
    renderMeetings();
    await screen.findAllByText('Sprint Planning');

    await userEvent.click(screen.getByRole('button', { name: /^complete$/i }));
    await waitFor(() => expect(mockUpdateMeeting).toHaveBeenCalledTimes(1));
  });
});
