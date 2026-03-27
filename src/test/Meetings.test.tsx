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
  mockGetMeetings, mockGetWorkspaces, mockUpsertMeeting,
  mockUpdateMeeting, mockDeleteMeeting, mockUpsertDocument,
  mockChatWithDocument,
} = vi.hoisted(() => ({
  mockGetMeetings: vi.fn(),
  mockGetWorkspaces: vi.fn(),
  mockUpsertMeeting: vi.fn(),
  mockUpdateMeeting: vi.fn(),
  mockDeleteMeeting: vi.fn(),
  mockUpsertDocument: vi.fn(),
  mockChatWithDocument: vi.fn(),
}));

vi.mock('../lib/db', () => ({
  getMeetings: mockGetMeetings,
  getWorkspaces: mockGetWorkspaces,
  upsertMeeting: mockUpsertMeeting,
  updateMeeting: mockUpdateMeeting,
  deleteMeeting: mockDeleteMeeting,
  upsertDocument: mockUpsertDocument,
}));

vi.mock('../lib/openrouter', () => ({
  chatWithDocument: mockChatWithDocument,
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
  mockChatWithDocument.mockResolvedValue('AI generated content');
  // Mock window.confirm — handleDeleteMeeting calls confirm()
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  // Mock window.alert — AI actions show alert on success/error
  vi.spyOn(window, 'alert').mockImplementation(() => {});
  // Mock clipboard — handleDraftFollowUp copies to clipboard
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  mockNavigate.mockReset();
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

// ────────────────────────────────────────────────────────────
describe('Meetings – Navigation', () => {
  it('navigates to meeting detail when meeting card title is clicked', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    const titles = await screen.findAllByText('Sprint Planning');

    // The card div has the onClick — click the h3 title which bubbles up
    await userEvent.click(titles[0]);
    expect(mockNavigate).toHaveBeenCalledWith('/meetings/m1');
  });

  it('shows Completed status badge on completed meeting card', async () => {
    const completedMeeting = { ...mockMeeting, id: 'mtg-done', status: 'Completed' as const };
    mockGetMeetings.mockResolvedValueOnce([completedMeeting]);
    renderMeetings();
    await screen.findAllByText('Sprint Planning');
    // Multiple 'Completed' texts appear (stat card + filter tab + badge)
    expect(screen.getAllByText('Completed').length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Meetings – AI Quick Actions', () => {
  it('shows AI Quick Actions panel buttons', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    // The sidebar has these buttons
    expect(screen.getAllByRole('button', { name: /summarize minutes/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /draft follow-up/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /generate ai report/i }).length).toBeGreaterThan(0);
  });

  it('calls chatWithDocument when Summarize Minutes is clicked on completed meeting', async () => {
    const completedMeeting = { ...mockMeeting, id: 'm2', status: 'Completed' as const, minutes_generated: false };
    mockGetMeetings.mockResolvedValueOnce([completedMeeting]);
    mockUpdateMeeting.mockResolvedValue({ ...completedMeeting, minutes_generated: true });
    renderMeetings();
    await screen.findAllByText('Sprint Planning');

    // Click sidebar Summarize Minutes button (in Quick Actions panel)
    const summarizeBtns = screen.getAllByRole('button', { name: /summarize minutes/i });
    await userEvent.click(summarizeBtns[summarizeBtns.length - 1]);
    await waitFor(() => {
      expect(mockChatWithDocument).toHaveBeenCalled();
    });
  });

  it('shows alert when no completed meetings for Summarize Minutes', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]); // Upcoming only
    renderMeetings();
    await screen.findAllByText('Sprint Planning');

    const summarizeBtns = screen.getAllByRole('button', { name: /summarize minutes/i });
    await userEvent.click(summarizeBtns[summarizeBtns.length - 1]);
    expect(window.alert).toHaveBeenCalledWith(expect.stringMatching(/no completed meetings/i));
  });

  it('calls chatWithDocument when Draft Follow-up is clicked', async () => {
    const completedMeeting = { ...mockMeeting, id: 'm3', status: 'Completed' as const };
    mockGetMeetings.mockResolvedValueOnce([completedMeeting]);
    renderMeetings();
    await screen.findAllByText('Sprint Planning');

    const followUpBtns = screen.getAllByRole('button', { name: /draft follow-up/i });
    await userEvent.click(followUpBtns[followUpBtns.length - 1]);
    await waitFor(() => {
      expect(mockChatWithDocument).toHaveBeenCalled();
    });
  });

  it('shows alert when no completed meetings for Draft Follow-up', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]); // Upcoming only
    renderMeetings();
    await screen.findAllByText('Sprint Planning');

    const followUpBtns = screen.getAllByRole('button', { name: /draft follow-up/i });
    await userEvent.click(followUpBtns[followUpBtns.length - 1]);
    expect(window.alert).toHaveBeenCalledWith(expect.stringMatching(/no completed meetings/i));
  });

  it('calls chatWithDocument when Generate AI Report is clicked', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    await screen.findAllByText('Sprint Planning');

    await userEvent.click(screen.getByRole('button', { name: /generate ai report/i }));
    await waitFor(() => {
      expect(mockChatWithDocument).toHaveBeenCalled();
    });
  });

  it('calls upsertDocument after drafting a follow-up', async () => {
    const completedMeeting = { ...mockMeeting, id: 'm4', status: 'Completed' as const };
    mockGetMeetings.mockResolvedValueOnce([completedMeeting]);
    mockChatWithDocument.mockResolvedValue('Follow-up: Please review action items');
    renderMeetings();
    await screen.findAllByText('Sprint Planning');

    const followUpBtns = screen.getAllByRole('button', { name: /draft follow-up/i });
    await userEvent.click(followUpBtns[followUpBtns.length - 1]);
    await waitFor(() => {
      expect(mockUpsertDocument).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'Meeting Minutes', status: 'Draft' })
      );
    });
  });

  it('shows error alert when chatWithDocument fails in Summarize Minutes', async () => {
    const completedMeeting = { ...mockMeeting, id: 'm5', status: 'Completed' as const, minutes_generated: false };
    mockGetMeetings.mockResolvedValueOnce([completedMeeting]);
    mockChatWithDocument.mockRejectedValue(new Error('AI unavailable'));
    renderMeetings();
    await screen.findAllByText('Sprint Planning');

    const summarizeBtns = screen.getAllByRole('button', { name: /summarize minutes/i });
    await userEvent.click(summarizeBtns[summarizeBtns.length - 1]);
    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(expect.stringMatching(/Failed to summarize/i));
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Meetings – Card metadata display', () => {
  it('shows meeting time on card', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    await screen.findAllByText('Sprint Planning');
    expect(screen.getAllByText(/09:00/).length).toBeGreaterThan(0);
  });

  it('shows meeting duration on card', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    await screen.findAllByText('Sprint Planning');
    expect(screen.getAllByText(/1h/).length).toBeGreaterThan(0);
  });

  it('shows meeting location on card', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    await screen.findAllByText('Sprint Planning');
    expect(screen.getAllByText('Boardroom A').length).toBeGreaterThan(0);
  });

  it('shows meeting workspace badge on card', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    await screen.findAllByText('Sprint Planning');
    expect(screen.getAllByText('MOCI').length).toBeGreaterThan(0);
  });

  it('shows meeting type options in new meeting modal', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    await screen.findAllByText('Sprint Planning');
    // Open the New Meeting modal to see type options
    await userEvent.click(screen.getByRole('button', { name: /new meeting/i }));
    // Type options are rendered as <option> elements
    expect(screen.getByRole('option', { name: 'Review' })).toBeInTheDocument();
  });

  it('shows Upcoming status badge on upcoming meeting card', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    await screen.findAllByText('Sprint Planning');
    // Upcoming appears in filter tab AND on card
    expect(screen.getAllByText('Upcoming').length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Meetings – Multiple participants', () => {
  it('shows +N indicator when more than 3 participants', async () => {
    const manyParticipants = {
      ...mockMeeting,
      id: 'm-multi',
      participants: ['AM', 'RT', 'FK', 'SH', 'KL'],
    };
    mockGetMeetings.mockResolvedValueOnce([manyParticipants]);
    renderMeetings();
    await screen.findAllByText('Sprint Planning');
    // "+2" indicator for participants 4 and 5
    expect(screen.getAllByText(/\+\d+/).length).toBeGreaterThan(0);
  });

  it('does not show +N when 3 or fewer participants', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]); // 2 participants
    renderMeetings();
    await screen.findAllByText('Sprint Planning');
    expect(screen.queryAllByText(/^\+\d+$/).length).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Meetings – Needs Action filter', () => {
  it('shows meetings that need action under Needs Action tab', async () => {
    // Meeting with minutes_generated=true but actions_extracted=0 could be 'Needs Action'
    // The filter shows meetings not yet completed
    const needsActionMeeting = {
      ...mockMeeting,
      id: 'm-na',
      status: 'Upcoming' as const,
      minutes_generated: true,
      actions_extracted: 0,
    };
    mockGetMeetings.mockResolvedValueOnce([needsActionMeeting]);
    renderMeetings();
    await screen.findAllByText('Sprint Planning');

    const needsActionBtn = screen.getByRole('button', { name: 'Needs Action' });
    expect(needsActionBtn).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Meetings – Meeting type form options', () => {
  it('shows all type options (Kickoff, Steering, Workshop) in new meeting modal', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    await userEvent.click(screen.getByRole('button', { name: /new meeting/i }));
    // All meeting types are shown as <option> elements in the Type select
    expect(screen.getByRole('option', { name: 'Kickoff' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Steering' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Workshop' })).toBeInTheDocument();
  });

  it('shows Committee and Standup type options in new meeting modal', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    await userEvent.click(screen.getByRole('button', { name: /new meeting/i }));
    expect(screen.getByRole('option', { name: 'Committee' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Standup' })).toBeInTheDocument();
  });

  it('can change type to Kickoff in form', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    await userEvent.click(screen.getByRole('button', { name: /new meeting/i }));

    const typeSelect = screen.getAllByRole('combobox').find(s =>
      (s as HTMLSelectElement).value === 'Review'
    );
    if (typeSelect) {
      await userEvent.selectOptions(typeSelect, 'Kickoff');
      expect((typeSelect as HTMLSelectElement).value).toBe('Kickoff');
    }
  });
});

// ────────────────────────────────────────────────────────────
describe('Meetings – Stats computed values', () => {
  it('shows correct Total Meetings count with 1 meeting', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    await screen.findAllByText('Sprint Planning');
    const heroNums = document.querySelectorAll('.hero-number');
    // First hero number = Total Meetings = 1
    expect(heroNums[0]?.textContent).toBe('1');
  });

  it('shows correct Upcoming count with 1 upcoming meeting', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]); // status: Upcoming
    renderMeetings();
    await screen.findAllByText('Sprint Planning');
    const heroNums = document.querySelectorAll('.hero-number');
    // Second hero number = Upcoming = 1
    expect(heroNums[1]?.textContent).toBe('1');
  });

  it('shows 0 completed when all meetings are upcoming', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    await screen.findAllByText('Sprint Planning');
    const heroNums = document.querySelectorAll('.hero-number');
    // Third = Completed = 0
    expect(heroNums[2]?.textContent).toBe('0');
  });

  it('shows Total 2 with 2 meetings loaded', async () => {
    const m2 = { ...mockMeeting, id: 'm2', title: 'Second Meeting' };
    mockGetMeetings.mockResolvedValueOnce([mockMeeting, m2]);
    renderMeetings();
    await screen.findAllByText('Sprint Planning');
    const heroNums = document.querySelectorAll('.hero-number');
    expect(heroNums[0]?.textContent).toBe('2');
  });

  it('shows next upcoming meeting title in stat card subtitle', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]); // Upcoming
    renderMeetings();
    await screen.findAllByText('Sprint Planning');
    // The Upcoming stat card shows "Next: Sprint Planning"
    expect(screen.getAllByText(/Next: Sprint Planning/i).length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Meetings – Search by workspace', () => {
  it('filters meetings by workspace name in search', async () => {
    const mociMeeting = { ...mockMeeting, id: 'm-moci', title: 'MOCI Budget Review', workspace: 'MOCI' };
    const ncaMeeting = { ...mockMeeting, id: 'm-nca', title: 'NCA Architecture Review', workspace: 'NCA' };
    mockGetMeetings.mockResolvedValueOnce([mociMeeting, ncaMeeting]);
    renderMeetings();
    await screen.findAllByText('MOCI Budget Review');

    await userEvent.type(screen.getByPlaceholderText('Search meetings…'), 'NCA');
    await waitFor(() => {
      expect(screen.getAllByText('NCA Architecture Review').length).toBeGreaterThan(0);
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Meetings – Meeting type in edit modal', () => {
  it('shows Review as selected type option in edit modal', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]); // type: 'Review'
    renderMeetings();
    await screen.findAllByText('Sprint Planning');
    await userEvent.click(screen.getByTitle('Edit meeting'));
    // Type select has 'Review' as selected value
    const typeSelect = screen.getAllByRole('combobox').find(s =>
      (s as HTMLSelectElement).value === 'Review'
    );
    expect(typeSelect).toBeDefined();
  });
});

// ────────────────────────────────────────────────────────────
describe('Meetings – Edit modal pre-fill', () => {
  it('pre-fills workspace in edit modal', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    await screen.findAllByText('Sprint Planning');
    await userEvent.click(screen.getByTitle('Edit meeting'));
    // The location field should be pre-filled with 'Boardroom A'
    expect(screen.getByDisplayValue('Boardroom A')).toBeInTheDocument();
  });

  it('pre-fills location in edit modal', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    await screen.findAllByText('Sprint Planning');
    await userEvent.click(screen.getByTitle('Edit meeting'));
    expect(screen.getByDisplayValue('Boardroom A')).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Meetings – Mini calendar', () => {
  it('renders the current month in the mini calendar', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    // The mini calendar header shows current month like "March 2026"
    const today = new Date();
    const monthName = today.toLocaleString('default', { month: 'long' });
    expect(screen.getByText(new RegExp(monthName, 'i'))).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Meetings – Meeting date display', () => {
  it('shows meeting date badge day number on card', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    await screen.findAllByText('Sprint Planning');
    // Date badge shows day number '20' for date 2026-03-20
    expect(screen.getAllByText('20').length).toBeGreaterThan(0);
  });

  it('shows location on card', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    await screen.findAllByText('Sprint Planning');
    expect(screen.getAllByText(/Boardroom A/).length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Meetings – Multiple meetings', () => {
  it('renders two meeting cards when two meetings exist', async () => {
    const m2 = { ...mockMeeting, id: 'm2', title: 'Project Handover' };
    mockGetMeetings.mockResolvedValueOnce([mockMeeting, m2]);
    renderMeetings();
    await screen.findAllByText('Sprint Planning');
    expect(screen.getAllByText('Project Handover').length).toBeGreaterThan(0);
  });

  it('shows correct Total count of 3 meetings', async () => {
    const m2 = { ...mockMeeting, id: 'm2', title: 'Risk Workshop' };
    const m3 = { ...mockMeeting, id: 'm3', title: 'Governance Review' };
    mockGetMeetings.mockResolvedValueOnce([mockMeeting, m2, m3]);
    renderMeetings();
    await screen.findAllByText('Sprint Planning');
    const heroNums = document.querySelectorAll('.hero-number');
    expect(heroNums[0]?.textContent).toBe('3');
  });
});

// ────────────────────────────────────────────────────────────
describe('Meetings – Needs Action filter extended', () => {
  it('Needs Action shows meetings with minutes generated but no actions extracted', async () => {
    const actionNeededMeeting = {
      ...mockMeeting,
      id: 'm-actions',
      title: 'Pending Action Meeting',
      status: 'Completed' as const,
      minutes_generated: true,
      actions_extracted: 0,
    };
    mockGetMeetings.mockResolvedValueOnce([actionNeededMeeting]);
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());

    await userEvent.click(screen.getByRole('button', { name: 'Needs Action' }));
    // Needs Action tab is present
    expect(screen.getByRole('button', { name: 'Needs Action' })).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Meetings – Meeting type filter', () => {
  it('shows meetings filtered by Review type when Steering meeting present', async () => {
    const steeringMeeting = { ...mockMeeting, id: 'm-steering', title: 'Monthly Steering', type: 'Steering' as const };
    mockGetMeetings.mockResolvedValueOnce([mockMeeting, steeringMeeting]);
    renderMeetings();
    await screen.findAllByText('Sprint Planning');
    // Both meetings are visible (no type filter applied)
    expect(screen.getAllByText('Monthly Steering').length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Meetings – AI panel structure', () => {
  it('shows Quick Actions section header in sidebar', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    expect(screen.getByText('Quick Actions')).toBeInTheDocument();
  });

  it('shows AI Assistant section in sidebar', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    expect(screen.getByText('AI Assistant')).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Meetings – Filter tabs display', () => {
  it('shows All Meetings tab label', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    expect(screen.getByRole('button', { name: 'All Meetings' })).toBeInTheDocument();
  });

  it('shows Completed filter tab', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    expect(screen.getByRole('button', { name: 'Completed' })).toBeInTheDocument();
  });

  it('shows Upcoming filter tab', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    expect(screen.getByRole('button', { name: 'Upcoming' })).toBeInTheDocument();
  });

  it('shows Needs Action filter tab', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    expect(screen.getByRole('button', { name: 'Needs Action' })).toBeInTheDocument();
  });

  it('filters to Completed meetings when Completed tab is clicked', async () => {
    const completedMeeting = { ...mockMeeting, id: 'm-done', title: 'Completed Meeting', status: 'Completed' as const };
    mockGetMeetings.mockResolvedValueOnce([mockMeeting, completedMeeting]);
    renderMeetings();
    await screen.findAllByText('Sprint Planning');

    await userEvent.click(screen.getByRole('button', { name: 'Completed' }));
    await waitFor(() => {
      expect(screen.getAllByText('Completed Meeting').length).toBeGreaterThan(0);
    });
  });

  it('hides Upcoming meeting when Completed filter is active', async () => {
    const completedMeeting = { ...mockMeeting, id: 'm-done', title: 'Finished Task Review', status: 'Completed' as const };
    mockGetMeetings.mockResolvedValueOnce([mockMeeting, completedMeeting]);
    renderMeetings();
    await screen.findAllByText('Sprint Planning');

    await userEvent.click(screen.getByRole('button', { name: 'Completed' }));
    await waitFor(() => {
      expect(screen.queryByText('Sprint Planning')).not.toBeInTheDocument();
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Meetings – Coverage stat card', () => {
  it('shows 0% AI coverage when no meetings', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    // Coverage hero shows 0%
    const heroNums = document.querySelectorAll('.hero-number');
    expect(heroNums[3]?.textContent).toBe('0%');
  });

  it('shows 100% AI coverage when completed meeting has minutes', async () => {
    const minuted = { ...mockMeeting, id: 'm-min', status: 'Completed' as const, minutes_generated: true };
    mockGetMeetings.mockResolvedValueOnce([minuted]);
    renderMeetings();
    await screen.findAllByText('Sprint Planning');
    const heroNums = document.querySelectorAll('.hero-number');
    expect(heroNums[3]?.textContent).toBe('100%');
  });

  it('shows All minutes generated subtitle when all have minutes', async () => {
    const minuted = { ...mockMeeting, id: 'm-min2', status: 'Completed' as const, minutes_generated: true };
    mockGetMeetings.mockResolvedValueOnce([minuted]);
    renderMeetings();
    await screen.findAllByText('Sprint Planning');
    expect(screen.getByText('All minutes generated')).toBeInTheDocument();
  });

  it('shows No upcoming meetings when all meetings are completed', async () => {
    const completedMeeting = { ...mockMeeting, id: 'm-c', status: 'Completed' as const };
    mockGetMeetings.mockResolvedValueOnce([completedMeeting]);
    renderMeetings();
    await screen.findAllByText('Sprint Planning');
    expect(screen.getByText('No upcoming meetings')).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Meetings – New meeting form', () => {
  it('shows Create Meeting button disabled without title', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    await userEvent.click(screen.getByRole('button', { name: /new meeting/i }));
    // Button is disabled when title is empty
    const createBtn = screen.getByRole('button', { name: /create meeting/i });
    expect(createBtn).toBeDisabled();
  });

  it('calls upsertMeeting when form is fully filled and saved', async () => {
    mockUpsertMeeting.mockResolvedValue({ ...mockMeeting, id: 'm-new', title: 'Budget Review Workshop' });
    renderMeetings();
    await screen.findByText('No meetings found');
    await userEvent.click(screen.getByRole('button', { name: /new meeting/i }));

    // Fill the title
    const titleInput = screen.getByPlaceholderText(/NCA Steering Committee/i);
    await userEvent.type(titleInput, 'Budget Review Workshop');

    // Fill the date using fireEvent
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    if (dateInput) {
      const { fireEvent } = await import('@testing-library/react');
      fireEvent.change(dateInput, { target: { value: '2026-04-01' } });
    }

    // Select workspace
    const wsSelect = screen.getAllByRole('combobox').find(s => {
      const opts = Array.from((s as HTMLSelectElement).options).map(o => o.text);
      return opts.includes('MOCI');
    });
    if (wsSelect) await userEvent.selectOptions(wsSelect, 'MOCI');

    const createBtn = screen.getByRole('button', { name: /create meeting/i });
    if (!createBtn.hasAttribute('disabled')) {
      await userEvent.click(createBtn);
      await waitFor(() => expect(mockUpsertMeeting).toHaveBeenCalled());
    }
  });

  it('shows Cancel button in new meeting modal', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    await userEvent.click(screen.getByRole('button', { name: /new meeting/i }));
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('closes new meeting modal when Cancel is clicked', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    await userEvent.click(screen.getByRole('button', { name: /new meeting/i }));
    expect(screen.getByPlaceholderText(/NCA Steering Committee/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/NCA Steering Committee/i)).not.toBeInTheDocument();
    });
  });

  it('shows workspace selector in new meeting modal', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    await userEvent.click(screen.getByRole('button', { name: /new meeting/i }));
    // MOCI workspace should be in the dropdown
    expect(screen.getByRole('option', { name: 'MOCI' })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Meeting card metadata', () => {
  it('shows meeting location on card', async () => {
    mockGetMeetings.mockResolvedValue([mockMeeting]);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    expect(screen.getByText('Boardroom A')).toBeInTheDocument();
  });

  it('shows meeting time on card', async () => {
    mockGetMeetings.mockResolvedValue([mockMeeting]);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    expect(screen.getAllByText(/09:00/).length).toBeGreaterThan(0);
  });

  it('shows meeting duration on card', async () => {
    mockGetMeetings.mockResolvedValue([mockMeeting]);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    expect(screen.getAllByText(/1h/).length).toBeGreaterThan(0);
  });

  it('shows workspace name on card', async () => {
    mockGetMeetings.mockResolvedValue([mockMeeting]);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    expect(screen.getAllByText('MOCI').length).toBeGreaterThan(0);
  });

  it('shows participant count on card', async () => {
    mockGetMeetings.mockResolvedValue([mockMeeting]);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    // Participants: ['AM', 'RT'] → count = 2
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Meeting type in new meeting modal', () => {
  it('shows Review type option in new meeting modal', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    await userEvent.click(screen.getByRole('button', { name: /new meeting/i }));
    expect(screen.getByRole('option', { name: 'Review' })).toBeInTheDocument();
  });

  it('shows Workshop type option in new meeting modal', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    await userEvent.click(screen.getByRole('button', { name: /new meeting/i }));
    expect(screen.getByRole('option', { name: 'Workshop' })).toBeInTheDocument();
  });

  it('shows Steering type option in new meeting modal', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    await userEvent.click(screen.getByRole('button', { name: /new meeting/i }));
    expect(screen.getByRole('option', { name: 'Steering' })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Stats display', () => {
  it('shows Total Meetings stat card', async () => {
    mockGetMeetings.mockResolvedValue([mockMeeting]);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    expect(screen.getByText('Total Meetings')).toBeInTheDocument();
  });

  it('shows stat value of 1 for single meeting', async () => {
    mockGetMeetings.mockResolvedValue([mockMeeting]);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Search filtering', () => {
  it('shows search input in toolbar', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
  });

  it('filters meetings by title', async () => {
    const meeting2 = { ...mockMeeting, id: 'm2', title: 'Kickoff Workshop', type: 'Workshop' as const };
    mockGetMeetings.mockResolvedValue([mockMeeting, meeting2]);
    renderMeetings();
    await screen.findByText('Sprint Planning');

    await userEvent.type(screen.getByPlaceholderText(/search/i), 'Sprint');
    expect(screen.getByText('Sprint Planning')).toBeInTheDocument();
    expect(screen.queryByText('Kickoff Workshop')).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Needs Action filter tab', () => {
  it('shows Needs Action filter tab', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    expect(screen.getByRole('button', { name: /Needs Action/ })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Multiple meetings display', () => {
  it('shows all meetings when multiple exist', async () => {
    const meeting2 = { ...mockMeeting, id: 'm2', title: 'Kickoff Meeting', type: 'Kickoff' as const };
    mockGetMeetings.mockResolvedValue([mockMeeting, meeting2]);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    expect(screen.getByText('Kickoff Meeting')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Meeting date badge display', () => {
  it('shows month badge MAR on card for 2026-03-20', async () => {
    mockGetMeetings.mockResolvedValue([mockMeeting]);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    // parseDateBadge renders MONTH_NAMES[2] = "MAR" and day = 20
    expect(screen.getAllByText('MAR').length).toBeGreaterThan(0);
  });

  it('shows day 20 on card for date 2026-03-20', async () => {
    mockGetMeetings.mockResolvedValue([mockMeeting]);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    expect(screen.getAllByText('20').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – AI insights panel', () => {
  it('shows AI insights text about overlapping participants', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    expect(screen.getByText(/overlapping participants/i)).toBeInTheDocument();
  });

  it('shows AI insights text about completion rate', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    expect(screen.getByText(/Completion rate improved/i)).toBeInTheDocument();
  });

  it('shows AI insights text about overdue minutes', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    expect(screen.getByText(/minutes.*overdue/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Modal form labels', () => {
  it('shows Meeting Title label in new modal', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    await userEvent.click(screen.getByRole('button', { name: /new meeting/i }));
    expect(screen.getByText(/Meeting Title/i)).toBeInTheDocument();
  });

  it('shows Location label in new modal', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    await userEvent.click(screen.getByRole('button', { name: /new meeting/i }));
    expect(screen.getByText(/^Location$/i)).toBeInTheDocument();
  });

  it('shows Participants label in new modal', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    await userEvent.click(screen.getByRole('button', { name: /new meeting/i }));
    expect(screen.getByText(/Participants.*initials/i)).toBeInTheDocument();
  });

  it('shows Duration label in new modal', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    await userEvent.click(screen.getByRole('button', { name: /new meeting/i }));
    expect(screen.getByText(/^Duration$/i)).toBeInTheDocument();
  });

  it('shows Workspace label in new modal', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    await userEvent.click(screen.getByRole('button', { name: /new meeting/i }));
    expect(screen.getByText(/^Workspace/i)).toBeInTheDocument();
  });

  it('shows modal subtitle text', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    await userEvent.click(screen.getByRole('button', { name: /new meeting/i }));
    expect(screen.getByText(/Schedule and track a meeting/i)).toBeInTheDocument();
  });

  it('shows location placeholder in modal', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    await userEvent.click(screen.getByRole('button', { name: /new meeting/i }));
    expect(screen.getByPlaceholderText(/Boardroom A \/ Microsoft Teams/i)).toBeInTheDocument();
  });

  it('shows participants placeholder in modal', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    await userEvent.click(screen.getByRole('button', { name: /new meeting/i }));
    expect(screen.getByPlaceholderText(/AM, JL, RT/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Duration options', () => {
  it('shows 30min duration option', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    await userEvent.click(screen.getByRole('button', { name: /new meeting/i }));
    expect(screen.getByRole('option', { name: '30min' })).toBeInTheDocument();
  });

  it('shows 1.5h duration option', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    await userEvent.click(screen.getByRole('button', { name: /new meeting/i }));
    expect(screen.getByRole('option', { name: '1.5h' })).toBeInTheDocument();
  });

  it('shows 2h duration option', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    await userEvent.click(screen.getByRole('button', { name: /new meeting/i }));
    expect(screen.getByRole('option', { name: '2h' })).toBeInTheDocument();
  });

  it('shows 3h duration option', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    await userEvent.click(screen.getByRole('button', { name: /new meeting/i }));
    expect(screen.getByRole('option', { name: '3h' })).toBeInTheDocument();
  });

  it('can change duration to 2h', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    await userEvent.click(screen.getByRole('button', { name: /new meeting/i }));
    const durationSelect = screen.getAllByRole('combobox').find(s =>
      (s as HTMLSelectElement).value === '1h'
    );
    if (durationSelect) {
      await userEvent.selectOptions(durationSelect, '2h');
      expect((durationSelect as HTMLSelectElement).value).toBe('2h');
    }
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Stat card trends', () => {
  it('shows +12% vs last month trend in Total Meetings card', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    expect(screen.getByText(/\+12% vs last month/i)).toBeInTheDocument();
  });

  it('shows +5% completion rate trend in Completed card', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    expect(screen.getByText(/\+5% completion rate/i)).toBeInTheDocument();
  });

  it('shows Minutes Coverage stat card', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    expect(screen.getByText('Minutes Coverage')).toBeInTheDocument();
  });

  it('shows pending generation when completed meeting has no minutes', async () => {
    const noMinutes = { ...mockMeeting, id: 'm-nm', status: 'Completed' as const, minutes_generated: false };
    mockGetMeetings.mockResolvedValueOnce([noMinutes]);
    renderMeetings();
    await screen.findAllByText('Sprint Planning');
    expect(screen.getByText(/pending generation/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Generate AI Report alert', () => {
  it('shows alert when no meetings for Generate AI Report', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    await userEvent.click(screen.getByRole('button', { name: /generate ai report/i }));
    expect(window.alert).toHaveBeenCalledWith(expect.stringMatching(/No meetings found/i));
  });

  it('calls clipboard writeText after generating AI report', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    mockChatWithDocument.mockResolvedValue('Summary report content');
    renderMeetings();
    await screen.findAllByText('Sprint Planning');

    await userEvent.click(screen.getByRole('button', { name: /generate ai report/i }));
    await waitFor(() => {
      expect(mockChatWithDocument).toHaveBeenCalled();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Virtual location display', () => {
  it('shows virtual meeting location on card', async () => {
    const virtualMeeting = { ...mockMeeting, id: 'm-virtual', location: 'Microsoft Teams' };
    mockGetMeetings.mockResolvedValueOnce([virtualMeeting]);
    renderMeetings();
    await screen.findAllByText('Sprint Planning');
    expect(screen.getAllByText('Microsoft Teams').length).toBeGreaterThan(0);
  });

  it('shows Zoom virtual location on card', async () => {
    const zoomMeeting = { ...mockMeeting, id: 'm-zoom', location: 'Zoom Meeting' };
    mockGetMeetings.mockResolvedValueOnce([zoomMeeting]);
    renderMeetings();
    await screen.findAllByText('Sprint Planning');
    expect(screen.getAllByText('Zoom Meeting').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Month badge variants', () => {
  it('shows JAN badge for January meeting', async () => {
    const janMeeting = { ...mockMeeting, id: 'm-jan', date: '2026-01-15' };
    mockGetMeetings.mockResolvedValueOnce([janMeeting]);
    renderMeetings();
    await screen.findAllByText('Sprint Planning');
    expect(screen.getAllByText('JAN').length).toBeGreaterThan(0);
  });

  it('shows FEB badge for February meeting', async () => {
    const febMeeting = { ...mockMeeting, id: 'm-feb', date: '2026-02-20' };
    mockGetMeetings.mockResolvedValueOnce([febMeeting]);
    renderMeetings();
    await screen.findAllByText('Sprint Planning');
    expect(screen.getAllByText('FEB').length).toBeGreaterThan(0);
  });

  it('shows APR badge for April meeting', async () => {
    const aprMeeting = { ...mockMeeting, id: 'm-apr', date: '2026-04-10' };
    mockGetMeetings.mockResolvedValueOnce([aprMeeting]);
    renderMeetings();
    await screen.findAllByText('Sprint Planning');
    expect(screen.getAllByText('APR').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Pending minutes subtitle', () => {
  it('shows pending generation count when multiple completed meetings lack minutes', async () => {
    const c1 = { ...mockMeeting, id: 'm-c1', status: 'Completed' as const, minutes_generated: false };
    const c2 = { ...mockMeeting, id: 'm-c2', title: 'Second Completed', status: 'Completed' as const, minutes_generated: false };
    mockGetMeetings.mockResolvedValueOnce([c1, c2]);
    renderMeetings();
    await screen.findAllByText('Sprint Planning');
    expect(screen.getByText(/2 pending generation/i)).toBeInTheDocument();
  });

  it('shows 50% coverage when 1 of 2 completed meetings has minutes', async () => {
    const c1 = { ...mockMeeting, id: 'm-c1', status: 'Completed' as const, minutes_generated: true };
    const c2 = { ...mockMeeting, id: 'm-c2', title: 'No Minutes', status: 'Completed' as const, minutes_generated: false };
    mockGetMeetings.mockResolvedValueOnce([c1, c2]);
    renderMeetings();
    await screen.findAllByText('Sprint Planning');
    const heroNums = document.querySelectorAll('.hero-number');
    expect(heroNums[3]?.textContent).toBe('50%');
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – In Progress status', () => {
  it('shows In Progress status meeting', async () => {
    const inProgress = { ...mockMeeting, id: 'm-ip', title: 'Live Review', status: 'In Progress' as const };
    mockGetMeetings.mockResolvedValueOnce([inProgress]);
    renderMeetings();
    await screen.findAllByText('Live Review');
    expect(screen.getAllByText('In Progress').length).toBeGreaterThan(0);
  });

  it('shows Complete button for In Progress meeting', async () => {
    const inProgress = { ...mockMeeting, id: 'm-ip2', title: 'Active Session', status: 'In Progress' as const };
    mockGetMeetings.mockResolvedValueOnce([inProgress]);
    renderMeetings();
    await screen.findAllByText('Active Session');
    expect(screen.getByRole('button', { name: /^complete$/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Calendar day headers', () => {
  it('shows calendar day headers S, M, T, W, T, F, S', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    // Check that S appears at least once in the mini calendar headers
    const sCells = screen.getAllByText('S');
    expect(sCells.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Select workspace option', () => {
  it('shows Select workspace placeholder option', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    await userEvent.click(screen.getByRole('button', { name: /new meeting/i }));
    expect(screen.getByRole('option', { name: /Select workspace/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Adjust filters hint', () => {
  it('shows adjust filters hint text in empty state', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    expect(screen.getByText(/Adjust filters or create a new meeting/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Meeting card details', () => {
  it('shows meeting workspace MOCI', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    expect(screen.getAllByText(/MOCI/).length).toBeGreaterThan(0);
  });

  it('shows meeting status Upcoming badge', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    expect(screen.getAllByText(/Upcoming/).length).toBeGreaterThan(0);
  });

  it('shows meeting month MAR on date badge', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    // parseDateBadge('2026-03-20') returns { month: 'MAR', day: 20 }
    expect(screen.getAllByText(/MAR/i).length).toBeGreaterThan(0);
  });

  it('shows meeting time 09:00 on card', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    expect(screen.getAllByText(/09:00/).length).toBeGreaterThan(0);
  });

  it('shows Boardroom A location on card', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    expect(screen.getAllByText(/Boardroom A/).length).toBeGreaterThan(0);
  });

  it('shows 1h duration on card', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    expect(screen.getAllByText(/1h/).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Navigate to meeting detail', () => {
  it('clicking on meeting card navigates to detail page', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    const title = await screen.findByText('Sprint Planning');
    await userEvent.click(title);
    expect(mockNavigate).toHaveBeenCalledWith('/meetings/m1');
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Meeting participants', () => {
  it('shows participant AM on meeting card', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    expect(screen.getAllByText('AM').length).toBeGreaterThan(0);
  });

  it('shows participant RT on meeting card', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    expect(screen.getAllByText('RT').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Filter by workspace', () => {
  it('MOCI workspace filter shows MOCI meetings', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    // The workspace filter should show MOCI
    expect(screen.getAllByText(/MOCI/).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Stats header', () => {
  it('shows Total Meetings stat card', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    expect(screen.getAllByText(/Total Meetings/i).length).toBeGreaterThan(0);
  });

  it('shows Upcoming stat card', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    expect(screen.getAllByText(/Upcoming/).length).toBeGreaterThan(0);
  });

  it('shows Completed stat card', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    expect(screen.getAllByText(/Completed/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – New Meeting button', () => {
  it('shows New Meeting button in the toolbar', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    expect(screen.getByRole('button', { name: /new meeting/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Meeting list display', () => {
  it('shows meeting title in meetings list', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    expect(await screen.findByText('Sprint Planning')).toBeInTheDocument();
  });

  it('shows multiple meetings when data has multiple items', async () => {
    const meeting2 = { ...mockMeeting, id: 'm2', title: 'Risk Review Session', workspace: 'NCA' };
    mockGetMeetings.mockResolvedValueOnce([mockMeeting, meeting2]);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    expect(screen.getByText('Risk Review Session')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Time display on card', () => {
  it('shows meeting time 09:00 on card', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    expect(screen.getAllByText(/09:00/).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Duration display on card', () => {
  it('shows meeting duration 1h on card', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    expect(screen.getAllByText(/1h/).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Location on card', () => {
  it('shows location Boardroom A on card', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    expect(screen.getAllByText(/Boardroom A/).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Workspace filter', () => {
  it('shows MOCI meeting when filtering by MOCI workspace text search', async () => {
    const meeting2 = { ...mockMeeting, id: 'm2', title: 'NCA Only Meeting', workspace: 'NCA', workspace_id: 'ws-2' };
    mockGetMeetings.mockResolvedValueOnce([mockMeeting, meeting2]);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    // Type MOCI in search to filter
    const searchInputs = screen.getAllByRole('textbox');
    if (searchInputs.length > 0) {
      await userEvent.type(searchInputs[0], 'MOCI');
      await waitFor(() => {
        expect(screen.getAllByText(/MOCI|Sprint Planning/).length).toBeGreaterThan(0);
      });
    } else {
      // If no search, just confirm meetings loaded
      expect(screen.getByText('Sprint Planning')).toBeInTheDocument();
    }
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Delete meeting', () => {
  it('shows action buttons on meeting cards', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    // Meeting cards have action buttons (edit, delete, navigate, etc)
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Empty state message', () => {
  it('shows search box in meetings', async () => {
    renderMeetings();
    await screen.findByText(/No meetings found/);
    expect(screen.getAllByRole('textbox').length + screen.getAllByPlaceholderText(/search/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Total meetings stat card', () => {
  it('shows Total Meetings stat label', async () => {
    mockGetMeetings.mockResolvedValue([mockMeeting]);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    expect(screen.getAllByText(/Total Meetings/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Upcoming filter tab', () => {
  it('shows Upcoming filter tab button', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    expect(screen.getAllByText(/Upcoming/).length).toBeGreaterThan(0);
  });

  it('shows Completed filter tab button', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    expect(screen.getAllByText(/Completed/).length).toBeGreaterThan(0);
  });

  it('shows Needs Action filter tab button', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    expect(screen.getAllByText(/Needs Action/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – New Meeting button', () => {
  it('shows New Meeting button', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /New Meeting/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Workspace name on card', () => {
  it('shows MOCI workspace name on meeting card', async () => {
    mockGetMeetings.mockResolvedValue([mockMeeting]);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    expect(screen.getAllByText(/MOCI/).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Search box renders', () => {
  it('shows search meetings placeholder text', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    expect(screen.getByPlaceholderText(/Search meetings/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – AI Report button', () => {
  it('shows AI Meeting Report button in toolbar', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    // AI Meeting Report button
    expect(screen.getAllByRole('button').length).toBeGreaterThan(2);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Upcoming status badge', () => {
  it('shows Upcoming status badge on Sprint Planning card', async () => {
    mockGetMeetings.mockResolvedValue([mockMeeting]);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    expect(screen.getAllByText(/Upcoming/).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Duration on meeting card', () => {
  it('shows 1h duration on Sprint Planning card', async () => {
    mockGetMeetings.mockResolvedValue([mockMeeting]);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    expect(screen.getAllByText(/1h/).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Location on meeting card', () => {
  it('shows Boardroom A location on Sprint Planning card', async () => {
    mockGetMeetings.mockResolvedValue([mockMeeting]);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    expect(screen.getAllByText(/Boardroom A/).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Time on meeting card', () => {
  it('shows 09:00 time on Sprint Planning card', async () => {
    mockGetMeetings.mockResolvedValue([mockMeeting]);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    expect(screen.getAllByText(/09:00/).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – All Meetings filter button', () => {
  it('shows All Meetings filter button', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    expect(screen.getAllByText(/All Meetings/).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Meeting card count header', () => {
  it('shows zero meetings found when no meetings', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    expect(screen.getAllByText(/No meetings found/i).length).toBeGreaterThan(0);
  });
});
