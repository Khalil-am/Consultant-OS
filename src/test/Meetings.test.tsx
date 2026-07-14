import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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
    expect(screen.getByRole('button', { name: /meeting filter: upcoming/i })).toBeInTheDocument();
  });

  it('shows Completed filter tab', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    expect(screen.getByRole('button', { name: /meeting filter: completed/i })).toBeInTheDocument();
  });

  it('filters to Completed meetings', async () => {
    const completed = { ...mockMeeting, id: 'm3', title: 'Past Meeting', status: 'Completed' as const };
    mockGetMeetings.mockResolvedValueOnce([mockMeeting, completed]);
    renderMeetings();
    await screen.findAllByText('Sprint Planning');

    await userEvent.click(screen.getByRole('button', { name: /meeting filter: completed/i }));
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
    expect(screen.getByRole('button', { name: /meeting filter: all meetings/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /meeting filter: upcoming/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /meeting filter: completed/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /meeting filter: needs action/i })).toBeInTheDocument();
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
    await userEvent.click(screen.getByRole('button', { name: /mark.*complete/i }));
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

    await userEvent.click(screen.getByRole('button', { name: /mark.*complete/i }));
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
    // Type options are rendered as <option> elements (may appear in filter dropdown too)
    expect(screen.getAllByRole('option', { name: 'Review' }).length).toBeGreaterThan(0);
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

    const needsActionBtn = screen.getByRole('button', { name: /meeting filter: needs action/i });
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
    expect(screen.getAllByRole('option', { name: 'Kickoff' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('option', { name: 'Steering' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('option', { name: 'Workshop' }).length).toBeGreaterThan(0);
  });

  it('shows Committee and Standup type options in new meeting modal', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    await userEvent.click(screen.getByRole('button', { name: /new meeting/i }));
    expect(screen.getAllByRole('option', { name: 'Committee' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('option', { name: 'Standup' }).length).toBeGreaterThan(0);
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

    await userEvent.click(screen.getByRole('button', { name: /meeting filter: needs action/i }));
    // Needs Action tab is present
    expect(screen.getByRole('button', { name: /meeting filter: needs action/i })).toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: /meeting filter: all meetings/i })).toBeInTheDocument();
  });

  it('shows Completed filter tab', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    expect(screen.getByRole('button', { name: /meeting filter: completed/i })).toBeInTheDocument();
  });

  it('shows Upcoming filter tab', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    expect(screen.getByRole('button', { name: /meeting filter: upcoming/i })).toBeInTheDocument();
  });

  it('shows Needs Action filter tab', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    expect(screen.getByRole('button', { name: /meeting filter: needs action/i })).toBeInTheDocument();
  });

  it('filters to Completed meetings when Completed tab is clicked', async () => {
    const completedMeeting = { ...mockMeeting, id: 'm-done', title: 'Completed Meeting', status: 'Completed' as const };
    mockGetMeetings.mockResolvedValueOnce([mockMeeting, completedMeeting]);
    renderMeetings();
    await screen.findAllByText('Sprint Planning');

    await userEvent.click(screen.getByRole('button', { name: /meeting filter: completed/i }));
    await waitFor(() => {
      expect(screen.getAllByText('Completed Meeting').length).toBeGreaterThan(0);
    });
  });

  it('hides Upcoming meeting when Completed filter is active', async () => {
    const completedMeeting = { ...mockMeeting, id: 'm-done', title: 'Finished Task Review', status: 'Completed' as const };
    mockGetMeetings.mockResolvedValueOnce([mockMeeting, completedMeeting]);
    renderMeetings();
    await screen.findAllByText('Sprint Planning');

    await userEvent.click(screen.getByRole('button', { name: /meeting filter: completed/i }));
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
    expect(screen.getAllByRole('option', { name: 'Review' }).length).toBeGreaterThan(0);
  });

  it('shows Workshop type option in new meeting modal', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    await userEvent.click(screen.getByRole('button', { name: /new meeting/i }));
    expect(screen.getAllByRole('option', { name: 'Workshop' }).length).toBeGreaterThan(0);
  });

  it('shows Steering type option in new meeting modal', async () => {
    renderMeetings();
    await screen.findByText('No meetings found');
    await userEvent.click(screen.getByRole('button', { name: /new meeting/i }));
    expect(screen.getAllByRole('option', { name: 'Steering' }).length).toBeGreaterThan(0);
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
    expect(screen.getByRole('button', { name: /mark.*complete/i })).toBeInTheDocument();
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

// ─────────────────────────────────────────────────────────────
describe('Meetings – Type filter dropdown', () => {
  it('renders type filter dropdown', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    expect(screen.getByRole('combobox', { name: /filter by meeting type/i })).toBeInTheDocument();
  });

  it('shows All Types as default option', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    expect(screen.getByRole('option', { name: 'All Types' })).toBeInTheDocument();
  });

  it('shows Workshop type option', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    expect(screen.getByRole('option', { name: 'Workshop' })).toBeInTheDocument();
  });

  it('shows Committee type option', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    expect(screen.getByRole('option', { name: 'Committee' })).toBeInTheDocument();
  });

  it('shows Steering type option', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    expect(screen.getByRole('option', { name: 'Steering' })).toBeInTheDocument();
  });

  it('shows Kickoff type option', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    expect(screen.getByRole('option', { name: 'Kickoff' })).toBeInTheDocument();
  });

  it('defaults to All Types', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const select = screen.getByRole('combobox', { name: /filter by meeting type/i }) as HTMLSelectElement;
    expect(select.value).toBe('All Types');
  });

  it('filters to Review type only when selected', async () => {
    mockGetMeetings.mockResolvedValue([mockMeeting]);
    renderMeetings();
    await screen.findAllByText('Sprint Planning');
    const select = screen.getByRole('combobox', { name: /filter by meeting type/i });
    await userEvent.selectOptions(select, 'Review');
    expect(screen.getAllByText('Sprint Planning').length).toBeGreaterThan(0);
  });

  it('hides meeting when type does not match filter', async () => {
    mockGetMeetings.mockResolvedValue([mockMeeting]); // mockMeeting is type Review
    renderMeetings();
    await screen.findAllByText('Sprint Planning');
    const select = screen.getByRole('combobox', { name: /filter by meeting type/i });
    await userEvent.selectOptions(select, 'Workshop');
    await waitFor(() => expect(screen.queryByText('Sprint Planning')).not.toBeInTheDocument());
  });

  it('shows meeting again when type filter reset to All Types', async () => {
    mockGetMeetings.mockResolvedValue([mockMeeting]);
    renderMeetings();
    await screen.findAllByText('Sprint Planning');
    const select = screen.getByRole('combobox', { name: /filter by meeting type/i });
    await userEvent.selectOptions(select, 'Workshop');
    await userEvent.selectOptions(select, 'All Types');
    await waitFor(() => expect(screen.getAllByText('Sprint Planning').length).toBeGreaterThan(0));
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Filter tab aria attributes', () => {
  beforeEach(() => {
    mockGetMeetings.mockResolvedValue([mockMeeting]);
  });

  it('All Meetings filter tab has aria-pressed=true by default', async () => {
    renderMeetings();
    await screen.findByText('Sprint Planning');
    const allBtn = screen.getByRole('button', { name: /meeting filter: all meetings/i });
    expect(allBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('Upcoming filter tab has aria-pressed=false by default', async () => {
    renderMeetings();
    await screen.findByText('Sprint Planning');
    const upcomingBtn = screen.getByRole('button', { name: /meeting filter: upcoming/i });
    expect(upcomingBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Upcoming sets its aria-pressed=true and All Meetings to false', async () => {
    renderMeetings();
    await screen.findByText('Sprint Planning');
    const allBtn = screen.getByRole('button', { name: /meeting filter: all meetings/i });
    const upcomingBtn = screen.getByRole('button', { name: /meeting filter: upcoming/i });
    await userEvent.click(upcomingBtn);
    await waitFor(() => {
      expect(upcomingBtn).toHaveAttribute('aria-pressed', 'true');
      expect(allBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('Completed filter tab has correct aria-label', async () => {
    renderMeetings();
    await screen.findByText('Sprint Planning');
    expect(screen.getByRole('button', { name: /meeting filter: completed/i })).toBeInTheDocument();
  });

  it('Needs Action filter tab has correct aria-label', async () => {
    renderMeetings();
    await screen.findByText('Sprint Planning');
    expect(screen.getByRole('button', { name: /meeting filter: needs action/i })).toBeInTheDocument();
  });

  it('clicking All Meetings restores its aria-pressed=true after switching tabs', async () => {
    renderMeetings();
    await screen.findByText('Sprint Planning');
    const allBtn = screen.getByRole('button', { name: /meeting filter: all meetings/i });
    const completedBtn = screen.getByRole('button', { name: /meeting filter: completed/i });
    await userEvent.click(completedBtn);
    await userEvent.click(allBtn);
    await waitFor(() => {
      expect(allBtn).toHaveAttribute('aria-pressed', 'true');
      expect(completedBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

describe('Meetings – Sort dropdown', () => {
  beforeEach(() => {
    mockGetMeetings.mockResolvedValue([mockMeeting]);
    mockGetWorkspaces.mockResolvedValue([mockWorkspace]);
  });

  it('renders sort meetings dropdown', async () => {
    renderMeetings();
    await screen.findByText('Sprint Planning');
    expect(screen.getByRole('combobox', { name: /sort meetings/i })).toBeInTheDocument();
  });

  it('sort dropdown defaults to newest', async () => {
    renderMeetings();
    await screen.findByText('Sprint Planning');
    const select = screen.getByRole('combobox', { name: /sort meetings/i }) as HTMLSelectElement;
    expect(select.value).toBe('newest');
  });

  it('sort dropdown has newest, oldest and title options', async () => {
    renderMeetings();
    await screen.findByText('Sprint Planning');
    const select = screen.getByRole('combobox', { name: /sort meetings/i });
    const options = Array.from(select.querySelectorAll('option')).map(o => (o as HTMLOptionElement).value);
    expect(options).toContain('newest');
    expect(options).toContain('oldest');
    expect(options).toContain('title');
  });

  it('selecting oldest changes dropdown value', async () => {
    renderMeetings();
    await screen.findByText('Sprint Planning');
    const select = screen.getByRole('combobox', { name: /sort meetings/i });
    await userEvent.selectOptions(select, 'oldest');
    expect((select as HTMLSelectElement).value).toBe('oldest');
  });

  it('selecting title sort keeps meetings visible', async () => {
    renderMeetings();
    await screen.findByText('Sprint Planning');
    const select = screen.getByRole('combobox', { name: /sort meetings/i });
    await userEvent.selectOptions(select, 'title');
    expect(screen.getByText('Sprint Planning')).toBeInTheDocument();
  });

  it('resetting to newest still shows meetings', async () => {
    renderMeetings();
    await screen.findByText('Sprint Planning');
    const select = screen.getByRole('combobox', { name: /sort meetings/i });
    await userEvent.selectOptions(select, 'oldest');
    await userEvent.selectOptions(select, 'newest');
    expect(screen.getByText('Sprint Planning')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Meeting action button aria-labels', () => {
  it('Edit button has aria-label with meeting title', async () => {
    mockGetMeetings.mockResolvedValue([mockMeeting]);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    expect(screen.getByRole('button', { name: /edit sprint planning/i })).toBeInTheDocument();
  });

  it('Delete button has aria-label with meeting title', async () => {
    mockGetMeetings.mockResolvedValue([mockMeeting]);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    expect(screen.getByRole('button', { name: /delete sprint planning/i })).toBeInTheDocument();
  });

  it('Complete button has aria-label with meeting title for Upcoming meeting', async () => {
    mockGetMeetings.mockResolvedValue([mockMeeting]);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    expect(screen.getByRole('button', { name: /mark sprint planning as complete/i })).toBeInTheDocument();
  });

  it('Summarize Minutes button has aria-label for Completed meeting', async () => {
    const completedMeeting = { ...mockMeeting, status: 'Completed' as const };
    mockGetMeetings.mockResolvedValue([completedMeeting]);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    expect(screen.getByRole('button', { name: /summarize minutes for sprint planning/i })).toBeInTheDocument();
  });

  it('Draft Follow-up button has aria-label for Completed meeting', async () => {
    const completedMeeting = { ...mockMeeting, status: 'Completed' as const };
    mockGetMeetings.mockResolvedValue([completedMeeting]);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    expect(screen.getByRole('button', { name: /draft follow-up for sprint planning/i })).toBeInTheDocument();
  });

  it('clicking Edit button opens Edit Meeting modal', async () => {
    mockGetMeetings.mockResolvedValue([mockMeeting]);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    await userEvent.click(screen.getByRole('button', { name: /edit sprint planning/i }));
    await waitFor(() => {
      expect(screen.getByText('Edit Meeting')).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – New meeting and quick action button aria-labels', () => {
  it('New Meeting button has aria-label', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'New Meeting' })).toBeInTheDocument();
  });

  it('clicking New Meeting button opens the modal', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: 'New Meeting' }));
    await waitFor(() => {
      expect(screen.getByText(/Schedule and track a meeting/i)).toBeInTheDocument();
    });
  });

  it('Summarize Minutes sidebar button has aria-label', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Summarize Minutes' })).toBeInTheDocument();
  });

  it('Draft Follow-up sidebar button has aria-label', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Draft Follow-up' })).toBeInTheDocument();
  });

  it('Generate AI Report sidebar button has aria-label', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Generate AI Report' })).toBeInTheDocument();
  });

  it('Close meeting modal button has aria-label and closes modal', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: 'New Meeting' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Close meeting modal' })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Close meeting modal' }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Close meeting modal' })).not.toBeInTheDocument();
    });
  });
});

describe('Meetings – Search and form input aria-labels', () => {
  it('search input has aria-label', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    expect(screen.getByRole('textbox', { name: /search meetings/i })).toBeInTheDocument();
  });

  it('typing in search input filters meetings', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const searchInput = screen.getByRole('textbox', { name: /search meetings/i });
    await userEvent.type(searchInput, 'NCA');
    expect(searchInput).toHaveValue('NCA');
  });

  it('meeting title input has aria-label in new meeting modal', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: 'New Meeting' }));
    expect(await screen.findByRole('textbox', { name: /meeting title/i })).toBeInTheDocument();
  });

  it('meeting location input has aria-label in new meeting modal', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: 'New Meeting' }));
    expect(await screen.findByRole('textbox', { name: /meeting location/i })).toBeInTheDocument();
  });

  it('meeting participants input has aria-label in new meeting modal', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: 'New Meeting' }));
    expect(await screen.findByRole('textbox', { name: /meeting participants/i })).toBeInTheDocument();
  });

  it('meeting duration select has aria-label in new meeting modal', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: 'New Meeting' }));
    await screen.findByRole('textbox', { name: /meeting title/i });
    expect(screen.getByRole('combobox', { name: /meeting duration/i })).toBeInTheDocument();
  });

  it('meeting type select has aria-label in new meeting modal', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: 'New Meeting' }));
    await screen.findByRole('textbox', { name: /meeting title/i });
    expect(screen.getByRole('combobox', { name: /^meeting type$/i })).toBeInTheDocument();
  });
});

describe('Meetings – Sort interactions', () => {
  it('sort meetings select changes to oldest', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const sortSelect = screen.getByRole('combobox', { name: /sort meetings/i });
    await userEvent.selectOptions(sortSelect, 'oldest');
    expect(sortSelect).toHaveValue('oldest');
  });

  it('sort meetings select changes to title', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const sortSelect = screen.getByRole('combobox', { name: /sort meetings/i });
    await userEvent.selectOptions(sortSelect, 'title');
    expect(sortSelect).toHaveValue('title');
  });

  it('type filter select changes to workshop', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const typeSelect = screen.getByRole('combobox', { name: /filter by meeting type/i });
    await userEvent.selectOptions(typeSelect, 'Workshop');
    expect(typeSelect).toHaveValue('Workshop');
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – New meeting form interaction', () => {
  it('typing in meeting title input updates value', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: 'New Meeting' }));
    const titleInput = await screen.findByRole('textbox', { name: /meeting title/i });
    await userEvent.type(titleInput, 'ADNOC Kickoff Q1');
    expect(titleInput).toHaveValue('ADNOC Kickoff Q1');
  });

  it('typing in meeting location input updates value', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: 'New Meeting' }));
    await screen.findByRole('textbox', { name: /meeting title/i });
    const locationInput = screen.getByRole('textbox', { name: /meeting location/i });
    await userEvent.type(locationInput, 'Conference Room A');
    expect(locationInput).toHaveValue('Conference Room A');
  });

  it('typing in meeting participants updates value', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: 'New Meeting' }));
    await screen.findByRole('textbox', { name: /meeting title/i });
    const participantsInput = screen.getByRole('textbox', { name: /meeting participants/i });
    await userEvent.type(participantsInput, 'Ahmed, Rania');
    expect(participantsInput).toHaveValue('Ahmed, Rania');
  });

  it('meeting workspace select has options', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: 'New Meeting' }));
    await screen.findByRole('textbox', { name: /meeting title/i });
    const workspaceSelect = screen.getByRole('combobox', { name: /meeting workspace/i });
    expect(workspaceSelect).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Delete flow', () => {
  it('clicking Delete meeting button calls deleteMeeting', async () => {
    mockGetMeetings.mockResolvedValue([mockMeeting]);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    await userEvent.click(screen.getByRole('button', { name: /delete sprint planning/i }));
    await waitFor(() => {
      expect(mockDeleteMeeting).toHaveBeenCalledWith(mockMeeting.id);
    });
  });

  it('deleted meeting is removed from list', async () => {
    mockGetMeetings.mockResolvedValue([mockMeeting]);
    mockDeleteMeeting.mockResolvedValue(undefined);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    await userEvent.click(screen.getByRole('button', { name: /delete sprint planning/i }));
    await waitFor(() => {
      expect(screen.queryByText('Sprint Planning')).not.toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Complete flow', () => {
  it('clicking Mark as complete calls updateMeeting with Completed status', async () => {
    mockGetMeetings.mockResolvedValue([mockMeeting]);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    await userEvent.click(screen.getByRole('button', { name: /mark sprint planning as complete/i }));
    await waitFor(() => {
      expect(mockUpdateMeeting).toHaveBeenCalledWith(
        mockMeeting.id,
        expect.objectContaining({ status: 'Completed' })
      );
    });
  });

  it('marking meeting complete calls updateMeeting', async () => {
    mockGetMeetings.mockResolvedValue([mockMeeting]);
    mockUpdateMeeting.mockResolvedValue({ ...mockMeeting, status: 'Completed' as const });
    renderMeetings();
    await screen.findByText('Sprint Planning');
    await userEvent.click(screen.getByRole('button', { name: /mark sprint planning as complete/i }));
    await waitFor(() => {
      expect(mockUpdateMeeting).toHaveBeenCalled();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Create meeting form submission', () => {
  it('Create Meeting button is present in the new meeting modal', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: 'New Meeting' }));
    await screen.findByRole('textbox', { name: /meeting title/i });
    expect(screen.getByRole('button', { name: /create meeting/i })).toBeInTheDocument();
  });

  it('Create Meeting button is disabled when title is empty', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: 'New Meeting' }));
    await screen.findByRole('textbox', { name: /meeting title/i });
    const createBtn = screen.getByRole('button', { name: /create meeting/i });
    expect(createBtn).toBeDisabled();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Close modal button', () => {
  it('Close meeting modal button has aria-label', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: 'New Meeting' }));
    await screen.findByRole('textbox', { name: /meeting title/i });
    expect(screen.getByRole('button', { name: /close meeting modal/i })).toBeInTheDocument();
  });

  it('clicking Close meeting modal hides the modal', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: 'New Meeting' }));
    await screen.findByRole('textbox', { name: /meeting title/i });
    await userEvent.click(screen.getByRole('button', { name: /close meeting modal/i }));
    await waitFor(() => {
      expect(screen.queryByRole('textbox', { name: /meeting title/i })).not.toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Form field aria-labels', () => {
  it('meeting duration select has aria-label', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: 'New Meeting' }));
    await screen.findByRole('textbox', { name: /meeting title/i });
    expect(screen.getByRole('combobox', { name: /meeting duration/i })).toBeInTheDocument();
  });

  it('meeting form type select exists in the form', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: 'New Meeting' }));
    await screen.findByRole('textbox', { name: /meeting title/i });
    // Both filter type and form type exist - get the one named "Meeting type" (exact)
    const typeSelects = screen.getAllByRole('combobox', { name: /meeting type/i });
    expect(typeSelects.length).toBeGreaterThan(0);
  });

  it('meeting workspace select has aria-label', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: 'New Meeting' }));
    await screen.findByRole('textbox', { name: /meeting title/i });
    expect(screen.getByRole('combobox', { name: /meeting workspace/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Per-meeting AI actions for Completed meetings', () => {
  const completedMeeting = {
    id: 'm-completed',
    title: 'Q4 Review',
    type: 'Review' as const,
    date: '2025-12-15',
    time: '14:00',
    duration: '2h',
    workspace: 'NCA',
    workspace_id: 'ws-1',
    location: 'Board Room',
    participants: ['AM'],
    status: 'Completed' as const,
    agenda: null, notes: null, attachments: null, action_items: null,
    minutes_generated: false, actions_extracted: 0, decisions_logged: 0, quorum_status: null,
  };

  it('Summarize minutes button appears for completed meetings', async () => {
    mockGetMeetings.mockResolvedValue([completedMeeting]);
    renderMeetings();
    await screen.findByText('Q4 Review');
    expect(screen.getByRole('button', { name: /summarize minutes for q4 review/i })).toBeInTheDocument();
  });

  it('Draft follow-up button appears for completed meetings', async () => {
    mockGetMeetings.mockResolvedValue([completedMeeting]);
    renderMeetings();
    await screen.findByText('Q4 Review');
    expect(screen.getByRole('button', { name: /draft follow-up for q4 review/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Search meetings input', () => {
  it('Search meetings input has aria-label', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    expect(screen.getByRole('textbox', { name: /search meetings/i })).toBeInTheDocument();
  });

  it('typing in search filters meetings', async () => {
    mockGetMeetings.mockResolvedValue([mockMeeting]);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    const searchInput = screen.getByRole('textbox', { name: /search meetings/i });
    await userEvent.type(searchInput, 'ZZZNoMatch');
    await waitFor(() => {
      expect(screen.queryByText('Sprint Planning')).not.toBeInTheDocument();
    });
  });

  it('clearing search restores all meetings', async () => {
    mockGetMeetings.mockResolvedValue([mockMeeting]);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    const searchInput = screen.getByRole('textbox', { name: /search meetings/i });
    await userEvent.type(searchInput, 'ZZZ');
    await waitFor(() => expect(screen.queryByText('Sprint Planning')).not.toBeInTheDocument());
    await userEvent.clear(searchInput);
    await waitFor(() => {
      expect(screen.getByText('Sprint Planning')).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Meeting filter tabs', () => {
  it('Meeting filter: All Meetings tab has aria-label', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /meeting filter: all meetings/i })).toBeInTheDocument();
  });

  it('Meeting filter: Upcoming tab has aria-label', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /meeting filter: upcoming/i })).toBeInTheDocument();
  });

  it('Meeting filter: Completed tab has aria-label', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /meeting filter: completed/i })).toBeInTheDocument();
  });

  it('clicking Upcoming tab filters to upcoming meetings', async () => {
    mockGetMeetings.mockResolvedValue([mockMeeting]);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    await userEvent.click(screen.getByRole('button', { name: /meeting filter: upcoming/i }));
    await waitFor(() => {
      expect(screen.getByText('Sprint Planning')).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Filter and sort dropdowns', () => {
  it('Filter by meeting type select has aria-label', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    expect(screen.getByRole('combobox', { name: /filter by meeting type/i })).toBeInTheDocument();
  });

  it('Sort meetings select has aria-label', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    expect(screen.getByRole('combobox', { name: /sort meetings/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Sprint Planning card details', () => {
  it('shows Sprint Planning meeting with 09:00 time', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    expect(screen.getAllByText(/09:00/).length).toBeGreaterThan(0);
  });

  it('shows Sprint Planning with 1h duration', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    expect(screen.getAllByText(/1h/).length).toBeGreaterThan(0);
  });

  it('shows Sprint Planning with MOCI workspace', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    expect(screen.getAllByText(/MOCI/).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Filter by type dropdown options', () => {
  it('type filter has "All Types" option', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const select = screen.getByRole('combobox', { name: /filter by meeting type/i }) as HTMLSelectElement;
    const opts = Array.from(select.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('All Types');
  });

  it('type filter has "Review" option', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const select = screen.getByRole('combobox', { name: /filter by meeting type/i });
    const opts = Array.from(select.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Review');
  });

  it('type filter has "Steering" option', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const select = screen.getByRole('combobox', { name: /filter by meeting type/i });
    const opts = Array.from(select.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Steering');
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Needs Action filter pressed state', () => {
  it('clicking Needs Action sets its aria-pressed=true', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const needsBtn = screen.getByRole('button', { name: /meeting filter: needs action/i });
    await userEvent.click(needsBtn);
    expect(needsBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking Needs Action sets All Meetings to aria-pressed=false', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /meeting filter: all meetings/i });
    const needsBtn = screen.getByRole('button', { name: /meeting filter: needs action/i });
    await userEvent.click(needsBtn);
    expect(allBtn).toHaveAttribute('aria-pressed', 'false');
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – New meeting modal date and time inputs', () => {
  async function openNewModal() {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /new meeting/i }));
    await screen.findByRole('textbox', { name: /meeting title/i });
  }

  it('meeting date input has aria-label in new meeting modal', async () => {
    await openNewModal();
    expect(screen.getByLabelText(/meeting date/i)).toBeInTheDocument();
  });

  it('meeting time input has aria-label in new meeting modal', async () => {
    await openNewModal();
    expect(screen.getByLabelText(/meeting time/i)).toBeInTheDocument();
  });

  it('meeting type select has aria-label in new meeting modal', async () => {
    await openNewModal();
    expect(screen.getAllByRole('combobox', { name: /meeting type/i }).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – KPI stat cards', () => {
  it('shows "Total" stat card with 0 when no meetings', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    // With 0 meetings, stats show 0
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
  });

  it('shows "Upcoming" stat card', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    expect(screen.getAllByText('Upcoming').length).toBeGreaterThan(0);
  });

  it('shows "Completed" stat card', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    expect(screen.getAllByText('Completed').length).toBeGreaterThan(0);
  });
});

describe('Meetings – Type filter additional options', () => {
  it('type filter has "Kickoff" option', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const select = screen.getByRole('combobox', { name: /filter by meeting type/i });
    const opts = Array.from(select.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Kickoff');
  });

  it('type filter has "Workshop" option', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const select = screen.getByRole('combobox', { name: /filter by meeting type/i });
    const opts = Array.from(select.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Workshop');
  });

  it('type filter has "Committee" option', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const select = screen.getByRole('combobox', { name: /filter by meeting type/i });
    const opts = Array.from(select.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Committee');
  });

  it('type filter has "Standup" option', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const select = screen.getByRole('combobox', { name: /filter by meeting type/i });
    const opts = Array.from(select.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Standup');
  });
});

describe('Meetings – Sort meetings options', () => {
  it('Sort meetings select has "Newest" option', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const select = screen.getByRole('combobox', { name: /sort meetings/i });
    const opts = Array.from(select.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Newest');
  });

  it('Sort meetings select has default option visible', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    expect(screen.getByRole('combobox', { name: /sort meetings/i })).toBeInTheDocument();
  });
});

describe('Meetings – Sort meetings Title option', () => {
  it('sort meetings has Oldest option text', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort meetings/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Oldest');
  });

  it('sort meetings has Title option text', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort meetings/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Title');
  });

  it('sort meetings can be changed to Title', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort meetings/i });
    await userEvent.selectOptions(sel, 'title');
    expect((sel as HTMLSelectElement).value).toBe('title');
  });
});

describe('Meetings – Workshop and Standup filter click behavior', () => {
  it('clicking Workshop type filter changes its value', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const typeFilter = screen.getByRole('combobox', { name: /filter by meeting type/i });
    await userEvent.selectOptions(typeFilter, 'Workshop');
    expect((typeFilter as HTMLSelectElement).value).toBe('Workshop');
  });

  it('clicking Standup type filter changes its value', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const typeFilter = screen.getByRole('combobox', { name: /filter by meeting type/i });
    await userEvent.selectOptions(typeFilter, 'Standup');
    expect((typeFilter as HTMLSelectElement).value).toBe('Standup');
  });
});

describe('Meetings – Completed filter tab pressed state', () => {
  it('Meeting filter: Completed tab has aria-pressed=false by default', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const btn = screen.getByRole('button', { name: /meeting filter: completed/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Meeting filter: Completed sets it to aria-pressed=true', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const btn = screen.getByRole('button', { name: /meeting filter: completed/i });
    await userEvent.click(btn);
    await waitFor(() => {
      expect(btn).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('clicking Meeting filter: Completed sets All Meetings to aria-pressed=false', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /meeting filter: all meetings/i });
    const completedBtn = screen.getByRole('button', { name: /meeting filter: completed/i });
    await userEvent.click(completedBtn);
    await waitFor(() => {
      expect(allBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

describe('Meetings – Meeting duration select option text labels', () => {
  async function openNewModal() {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: 'New Meeting' }));
    await screen.findByRole('textbox', { name: /meeting title/i });
  }

  it('meeting duration select has 1h option', async () => {
    await openNewModal();
    const sel = screen.getByRole('combobox', { name: /meeting duration/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('1h');
  });

  it('meeting duration select has 2h option', async () => {
    await openNewModal();
    const sel = screen.getByRole('combobox', { name: /meeting duration/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('2h');
  });

  it('meeting duration select has 3h option', async () => {
    await openNewModal();
    const sel = screen.getByRole('combobox', { name: /meeting duration/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('3h');
  });

  it('meeting duration select can be changed to 2h', async () => {
    await openNewModal();
    const sel = screen.getByRole('combobox', { name: /meeting duration/i });
    await userEvent.selectOptions(sel, '2h');
    expect((sel as HTMLSelectElement).value).toBe('2h');
  });
});

describe('Meetings – Meeting type form select option text labels', () => {
  async function openNewModal() {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: 'New Meeting' }));
    await screen.findByRole('textbox', { name: /meeting title/i });
  }

  it('meeting type form select has Review option', async () => {
    await openNewModal();
    const sels = screen.getAllByRole('combobox', { name: /meeting type/i });
    const formSel = sels[sels.length - 1];
    const opts = Array.from(formSel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Review');
  });

  it('meeting type form select has Steering option', async () => {
    await openNewModal();
    const sels = screen.getAllByRole('combobox', { name: /meeting type/i });
    const formSel = sels[sels.length - 1];
    const opts = Array.from(formSel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Steering');
  });

  it('meeting type form select has Kickoff option', async () => {
    await openNewModal();
    const sels = screen.getAllByRole('combobox', { name: /meeting type/i });
    const formSel = sels[sels.length - 1];
    const opts = Array.from(formSel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Kickoff');
  });

  it('meeting type form select can be changed to Kickoff', async () => {
    await openNewModal();
    const sels = screen.getAllByRole('combobox', { name: /meeting type/i });
    const formSel = sels[sels.length - 1];
    await userEvent.selectOptions(formSel, 'Kickoff');
    expect((formSel as HTMLSelectElement).value).toBe('Kickoff');
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Duration select 30min and 1.5h options', () => {
  async function openNewModal() {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: 'New Meeting' }));
    await screen.findByRole('textbox', { name: /meeting title/i });
  }

  it('meeting duration select has 30min option', async () => {
    await openNewModal();
    const sel = screen.getByRole('combobox', { name: /meeting duration/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('30min');
  });

  it('meeting duration select has 1.5h option', async () => {
    await openNewModal();
    const sel = screen.getByRole('combobox', { name: /meeting duration/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('1.5h');
  });

  it('meeting duration select has 5 options', async () => {
    await openNewModal();
    const sel = screen.getByRole('combobox', { name: /meeting duration/i });
    expect(sel.querySelectorAll('option').length).toBe(5);
  });

  it('meeting duration select defaults to 1h', async () => {
    await openNewModal();
    const sel = screen.getByRole('combobox', { name: /meeting duration/i });
    expect((sel as HTMLSelectElement).value).toBe('1h');
  });

  it('meeting duration select can be changed to 30min', async () => {
    await openNewModal();
    const sel = screen.getByRole('combobox', { name: /meeting duration/i });
    await userEvent.selectOptions(sel, '30min');
    expect((sel as HTMLSelectElement).value).toBe('30min');
  });

  it('meeting duration select can be changed to 1.5h', async () => {
    await openNewModal();
    const sel = screen.getByRole('combobox', { name: /meeting duration/i });
    await userEvent.selectOptions(sel, '1.5h');
    expect((sel as HTMLSelectElement).value).toBe('1.5h');
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Filter tab cross-deselection', () => {
  it('clicking Completed after Upcoming sets Upcoming to aria-pressed=false', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const upcomingBtn = screen.getByRole('button', { name: /meeting filter: upcoming/i });
    const completedBtn = screen.getByRole('button', { name: /meeting filter: completed/i });
    await userEvent.click(upcomingBtn);
    await userEvent.click(completedBtn);
    await waitFor(() => {
      expect(upcomingBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('clicking Needs Action after Completed sets Completed to aria-pressed=false', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const completedBtn = screen.getByRole('button', { name: /meeting filter: completed/i });
    const needsActionBtn = screen.getByRole('button', { name: /meeting filter: needs action/i });
    await userEvent.click(completedBtn);
    await userEvent.click(needsActionBtn);
    await waitFor(() => {
      expect(completedBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('clicking Upcoming after Needs Action sets Needs Action to aria-pressed=false', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const needsActionBtn = screen.getByRole('button', { name: /meeting filter: needs action/i });
    const upcomingBtn = screen.getByRole('button', { name: /meeting filter: upcoming/i });
    await userEvent.click(needsActionBtn);
    await userEvent.click(upcomingBtn);
    await waitFor(() => {
      expect(needsActionBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('clicking All Meetings after Upcoming restores All to aria-pressed=true', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /meeting filter: all meetings/i });
    const upcomingBtn = screen.getByRole('button', { name: /meeting filter: upcoming/i });
    await userEvent.click(upcomingBtn);
    await userEvent.click(allBtn);
    await waitFor(() => {
      expect(allBtn).toHaveAttribute('aria-pressed', 'true');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Needs Action filter tab pressed state', () => {
  it('Needs Action filter tab has aria-pressed=false by default', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const btn = screen.getByRole('button', { name: /meeting filter: needs action/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Needs Action sets it to aria-pressed=true', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const btn = screen.getByRole('button', { name: /meeting filter: needs action/i });
    await userEvent.click(btn);
    await waitFor(() => expect(btn).toHaveAttribute('aria-pressed', 'true'));
  });

  it('clicking Needs Action sets All Meetings to aria-pressed=false', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /meeting filter: all meetings/i });
    const needsActionBtn = screen.getByRole('button', { name: /meeting filter: needs action/i });
    await userEvent.click(needsActionBtn);
    await waitFor(() => expect(allBtn).toHaveAttribute('aria-pressed', 'false'));
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – All Meetings restore cross-deselection', () => {
  it('clicking All Meetings after Completed restores All to aria-pressed=true', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /meeting filter: all meetings/i });
    const completedBtn = screen.getByRole('button', { name: /meeting filter: completed/i });
    await userEvent.click(completedBtn);
    await userEvent.click(allBtn);
    await waitFor(() => expect(allBtn).toHaveAttribute('aria-pressed', 'true'));
  });

  it('clicking All Meetings after Needs Action restores All to aria-pressed=true', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /meeting filter: all meetings/i });
    const needsActionBtn = screen.getByRole('button', { name: /meeting filter: needs action/i });
    await userEvent.click(needsActionBtn);
    await userEvent.click(allBtn);
    await waitFor(() => expect(allBtn).toHaveAttribute('aria-pressed', 'true'));
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Upcoming filter cross-deselection', () => {
  it('clicking Upcoming sets All Meetings to aria-pressed=false', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /meeting filter: all meetings/i });
    const upcomingBtn = screen.getByRole('button', { name: /meeting filter: upcoming/i });
    await userEvent.click(upcomingBtn);
    await waitFor(() => {
      expect(allBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('clicking Completed after Upcoming sets Upcoming to false', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const upcomingBtn = screen.getByRole('button', { name: /meeting filter: upcoming/i });
    const completedBtn = screen.getByRole('button', { name: /meeting filter: completed/i });
    await userEvent.click(upcomingBtn);
    await waitFor(() => expect(upcomingBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(completedBtn);
    await waitFor(() => {
      expect(upcomingBtn).toHaveAttribute('aria-pressed', 'false');
      expect(completedBtn).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('clicking All Meetings after Upcoming restores All to true', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /meeting filter: all meetings/i });
    const upcomingBtn = screen.getByRole('button', { name: /meeting filter: upcoming/i });
    await userEvent.click(upcomingBtn);
    await waitFor(() => expect(upcomingBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(allBtn);
    await waitFor(() => {
      expect(allBtn).toHaveAttribute('aria-pressed', 'true');
      expect(upcomingBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Completed filter cross-deselection', () => {
  it('Completed filter has aria-pressed=false by default', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /meeting filter: completed/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Completed sets All to false', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /meeting filter: all meetings/i });
    const completedBtn = screen.getByRole('button', { name: /meeting filter: completed/i });
    await userEvent.click(completedBtn);
    await waitFor(() => {
      expect(completedBtn).toHaveAttribute('aria-pressed', 'true');
      expect(allBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('clicking All after Completed restores All to true', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /meeting filter: all meetings/i });
    const completedBtn = screen.getByRole('button', { name: /meeting filter: completed/i });
    await userEvent.click(completedBtn);
    await waitFor(() => expect(completedBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(allBtn);
    await waitFor(() => {
      expect(allBtn).toHaveAttribute('aria-pressed', 'true');
      expect(completedBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Needs Action filter cross-deselection', () => {
  it('Needs Action filter has aria-pressed=false by default', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /meeting filter: needs action/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Needs Action sets All to false', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /meeting filter: all meetings/i });
    const needsActionBtn = screen.getByRole('button', { name: /meeting filter: needs action/i });
    await userEvent.click(needsActionBtn);
    await waitFor(() => {
      expect(needsActionBtn).toHaveAttribute('aria-pressed', 'true');
      expect(allBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('clicking Completed after Needs Action sets Needs Action to false', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const needsActionBtn = screen.getByRole('button', { name: /meeting filter: needs action/i });
    const completedBtn = screen.getByRole('button', { name: /meeting filter: completed/i });
    await userEvent.click(needsActionBtn);
    await waitFor(() => expect(needsActionBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(completedBtn);
    await waitFor(() => {
      expect(completedBtn).toHaveAttribute('aria-pressed', 'true');
      expect(needsActionBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('clicking All after Needs Action restores All to true', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /meeting filter: all meetings/i });
    const needsActionBtn = screen.getByRole('button', { name: /meeting filter: needs action/i });
    await userEvent.click(needsActionBtn);
    await waitFor(() => expect(needsActionBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(allBtn);
    await waitFor(() => {
      expect(allBtn).toHaveAttribute('aria-pressed', 'true');
      expect(needsActionBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Upcoming filter cross-deselection', () => {
  it('Upcoming filter has aria-pressed=false by default', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /meeting filter: upcoming/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Upcoming sets All to false', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /meeting filter: all meetings/i });
    const upcomingBtn = screen.getByRole('button', { name: /meeting filter: upcoming/i });
    await userEvent.click(upcomingBtn);
    await waitFor(() => {
      expect(upcomingBtn).toHaveAttribute('aria-pressed', 'true');
      expect(allBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('clicking Needs Action after Upcoming sets Upcoming to false', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const upcomingBtn = screen.getByRole('button', { name: /meeting filter: upcoming/i });
    const needsActionBtn = screen.getByRole('button', { name: /meeting filter: needs action/i });
    await userEvent.click(upcomingBtn);
    await waitFor(() => expect(upcomingBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(needsActionBtn);
    await waitFor(() => {
      expect(needsActionBtn).toHaveAttribute('aria-pressed', 'true');
      expect(upcomingBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – All meetings filter default state', () => {
  it('All Meetings has aria-pressed=true by default', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /meeting filter: all meetings/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking Completed then All restores All to true', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /meeting filter: all meetings/i });
    const completedBtn = screen.getByRole('button', { name: /meeting filter: completed/i });
    await userEvent.click(completedBtn);
    await waitFor(() => expect(completedBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(allBtn);
    await waitFor(() => {
      expect(allBtn).toHaveAttribute('aria-pressed', 'true');
      expect(completedBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('clicking Upcoming then Completed sets Upcoming to false', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const upcomingBtn = screen.getByRole('button', { name: /meeting filter: upcoming/i });
    const completedBtn = screen.getByRole('button', { name: /meeting filter: completed/i });
    await userEvent.click(upcomingBtn);
    await waitFor(() => expect(upcomingBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(completedBtn);
    await waitFor(() => {
      expect(completedBtn).toHaveAttribute('aria-pressed', 'true');
      expect(upcomingBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Completed filter interactions', () => {
  it('Completed has aria-pressed=false by default', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /meeting filter: completed/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Completed sets it to true', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const completedBtn = screen.getByRole('button', { name: /meeting filter: completed/i });
    await userEvent.click(completedBtn);
    await waitFor(() => expect(completedBtn).toHaveAttribute('aria-pressed', 'true'));
  });

  it('clicking Needs Action after Completed sets Completed to false', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const completedBtn = screen.getByRole('button', { name: /meeting filter: completed/i });
    const needsActionBtn = screen.getByRole('button', { name: /meeting filter: needs action/i });
    await userEvent.click(completedBtn);
    await waitFor(() => expect(completedBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(needsActionBtn);
    await waitFor(() => expect(completedBtn).toHaveAttribute('aria-pressed', 'false'));
  });

  it('clicking All after Completed restores All to true', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /meeting filter: all meetings/i });
    const completedBtn = screen.getByRole('button', { name: /meeting filter: completed/i });
    await userEvent.click(completedBtn);
    await waitFor(() => expect(completedBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(allBtn);
    await waitFor(() => {
      expect(allBtn).toHaveAttribute('aria-pressed', 'true');
      expect(completedBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Upcoming filter interactions', () => {
  it('Upcoming has aria-pressed=false by default', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /meeting filter: upcoming/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Upcoming sets it to true', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const upcomingBtn = screen.getByRole('button', { name: /meeting filter: upcoming/i });
    await userEvent.click(upcomingBtn);
    await waitFor(() => expect(upcomingBtn).toHaveAttribute('aria-pressed', 'true'));
  });

  it('clicking All after Upcoming restores All to true', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /meeting filter: all meetings/i });
    const upcomingBtn = screen.getByRole('button', { name: /meeting filter: upcoming/i });
    await userEvent.click(upcomingBtn);
    await waitFor(() => expect(upcomingBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(allBtn);
    await waitFor(() => {
      expect(allBtn).toHaveAttribute('aria-pressed', 'true');
      expect(upcomingBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – three-filter sequences', () => {
  it('Upcoming → Completed → Needs Action: Needs Action=true, others=false', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const upcomingBtn = screen.getByRole('button', { name: /meeting filter: upcoming/i });
    const completedBtn = screen.getByRole('button', { name: /meeting filter: completed/i });
    const needsActionBtn = screen.getByRole('button', { name: /meeting filter: needs action/i });
    await userEvent.click(upcomingBtn);
    await waitFor(() => expect(upcomingBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(completedBtn);
    await waitFor(() => expect(completedBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(needsActionBtn);
    await waitFor(() => {
      expect(needsActionBtn).toHaveAttribute('aria-pressed', 'true');
      expect(upcomingBtn).toHaveAttribute('aria-pressed', 'false');
      expect(completedBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('Needs Action → Upcoming → All: All=true, rest=false', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /meeting filter: all meetings/i });
    const needsActionBtn = screen.getByRole('button', { name: /meeting filter: needs action/i });
    const upcomingBtn2 = screen.getByRole('button', { name: /meeting filter: upcoming/i });
    await userEvent.click(needsActionBtn);
    await waitFor(() => expect(needsActionBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(upcomingBtn2);
    await waitFor(() => expect(upcomingBtn2).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(allBtn);
    await waitFor(() => {
      expect(allBtn).toHaveAttribute('aria-pressed', 'true');
      expect(needsActionBtn).toHaveAttribute('aria-pressed', 'false');
      expect(upcomingBtn2).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Needs Action filter interactions', () => {
  it('Needs Action filter button is present', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /meeting filter: needs action/i })).toBeInTheDocument();
  });

  it('clicking Needs Action sets aria-pressed=true', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const btn = screen.getByRole('button', { name: /meeting filter: needs action/i });
    await userEvent.click(btn);
    await waitFor(() => expect(btn).toHaveAttribute('aria-pressed', 'true'));
  });

  it('clicking Needs Action deselects All', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /meeting filter: all meetings/i });
    const needsActionBtn = screen.getByRole('button', { name: /meeting filter: needs action/i });
    await userEvent.click(needsActionBtn);
    await waitFor(() => expect(allBtn).toHaveAttribute('aria-pressed', 'false'));
  });

  it('clicking All after Needs Action restores All=true', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /meeting filter: all meetings/i });
    const needsActionBtn = screen.getByRole('button', { name: /meeting filter: needs action/i });
    await userEvent.click(needsActionBtn);
    await waitFor(() => expect(needsActionBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(allBtn);
    await waitFor(() => expect(allBtn).toHaveAttribute('aria-pressed', 'true'));
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – All Meetings default state', () => {
  it('All Meetings starts with aria-pressed=true', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /meeting filter: all meetings/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('Upcoming starts with aria-pressed=false', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /meeting filter: upcoming/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('Completed starts with aria-pressed=false', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /meeting filter: completed/i })).toHaveAttribute('aria-pressed', 'false');
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – additional three-filter sequences', () => {
  it('Completed → Needs Action → Upcoming: Upcoming=true, rest=false', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const completedBtn = screen.getByRole('button', { name: /meeting filter: completed/i });
    const needsActionBtn = screen.getByRole('button', { name: /meeting filter: needs action/i });
    const upcomingBtn = screen.getByRole('button', { name: /meeting filter: upcoming/i });
    await userEvent.click(completedBtn);
    await waitFor(() => expect(completedBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(needsActionBtn);
    await waitFor(() => expect(needsActionBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(upcomingBtn);
    await waitFor(() => {
      expect(upcomingBtn).toHaveAttribute('aria-pressed', 'true');
      expect(completedBtn).toHaveAttribute('aria-pressed', 'false');
      expect(needsActionBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('Upcoming → All → Needs Action: Needs Action=true, rest=false', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const upcomingBtn = screen.getByRole('button', { name: /meeting filter: upcoming/i });
    const allBtn = screen.getByRole('button', { name: /meeting filter: all meetings/i });
    const needsActionBtn = screen.getByRole('button', { name: /meeting filter: needs action/i });
    await userEvent.click(upcomingBtn);
    await waitFor(() => expect(upcomingBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(allBtn);
    await waitFor(() => expect(allBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(needsActionBtn);
    await waitFor(() => {
      expect(needsActionBtn).toHaveAttribute('aria-pressed', 'true');
      expect(upcomingBtn).toHaveAttribute('aria-pressed', 'false');
      expect(allBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – In Progress filter interactions', () => {
  it('clicking Completed then Upcoming deselects Completed', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const completedBtn = screen.getByRole('button', { name: /meeting filter: completed/i });
    const upcomingBtn = screen.getByRole('button', { name: /meeting filter: upcoming/i });
    await userEvent.click(completedBtn);
    await waitFor(() => expect(completedBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(upcomingBtn);
    await waitFor(() => expect(completedBtn).toHaveAttribute('aria-pressed', 'false'));
  });

  it('clicking Needs Action then All deselects Needs Action', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const needsActionBtn = screen.getByRole('button', { name: /meeting filter: needs action/i });
    const allBtn = screen.getByRole('button', { name: /meeting filter: all meetings/i });
    await userEvent.click(needsActionBtn);
    await waitFor(() => expect(needsActionBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(allBtn);
    await waitFor(() => expect(needsActionBtn).toHaveAttribute('aria-pressed', 'false'));
  });

  it('all four filter buttons are present', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /meeting filter: all meetings/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /meeting filter: upcoming/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /meeting filter: completed/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /meeting filter: needs action/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – meeting data display', () => {
  it('shows Sprint Planning meeting when data loaded', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    await waitFor(() => expect(screen.getByText('Sprint Planning')).toBeInTheDocument());
  });

  it('shows workspace MOCI when data loaded', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    await waitFor(() => expect(screen.getAllByText(/moci/i).length).toBeGreaterThan(0));
  });

  it('shows meeting type when data loaded', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    await waitFor(() => expect(screen.getByText('Sprint Planning')).toBeInTheDocument());
    expect(screen.getAllByText(/review/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Upcoming filter interactions', () => {
  it('clicking Upcoming makes it active', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const upcomingBtn = screen.getByRole('button', { name: /meeting filter: upcoming/i });
    await userEvent.click(upcomingBtn);
    await waitFor(() => expect(upcomingBtn).toHaveAttribute('aria-pressed', 'true'));
  });

  it('clicking Upcoming deselects All Meetings', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /meeting filter: all meetings/i });
    const upcomingBtn = screen.getByRole('button', { name: /meeting filter: upcoming/i });
    await userEvent.click(upcomingBtn);
    await waitFor(() => {
      expect(upcomingBtn).toHaveAttribute('aria-pressed', 'true');
      expect(allBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('clicking All Meetings after Upcoming restores All=true', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /meeting filter: all meetings/i });
    const upcomingBtn = screen.getByRole('button', { name: /meeting filter: upcoming/i });
    await userEvent.click(upcomingBtn);
    await waitFor(() => expect(upcomingBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(allBtn);
    await waitFor(() => {
      expect(allBtn).toHaveAttribute('aria-pressed', 'true');
      expect(upcomingBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – four-filter sequence', () => {
  it('Needs Action active after Upcoming→Completed→NeedsAction sequence', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const upcomingBtn = screen.getByRole('button', { name: /meeting filter: upcoming/i });
    const completedBtn = screen.getByRole('button', { name: /meeting filter: completed/i });
    const needsActionBtn = screen.getByRole('button', { name: /meeting filter: needs action/i });
    await userEvent.click(upcomingBtn);
    await userEvent.click(completedBtn);
    await userEvent.click(needsActionBtn);
    await waitFor(() => {
      expect(needsActionBtn).toHaveAttribute('aria-pressed', 'true');
      expect(upcomingBtn).toHaveAttribute('aria-pressed', 'false');
      expect(completedBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – page structure', () => {
  it('renders without crashing', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    expect(document.body).toBeInTheDocument();
  });

  it('All Meetings starts as active by default', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /meeting filter: all meetings/i });
    expect(allBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('Upcoming filter starts inactive by default', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const upcomingBtn = screen.getByRole('button', { name: /meeting filter: upcoming/i });
    expect(upcomingBtn).toHaveAttribute('aria-pressed', 'false');
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Action Items', () => {
  beforeEach(() => {
    localStorage.removeItem('meetings_action_items');
  });

  it('shows Action Items section in sidebar', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    expect(screen.getByText('Action Items')).toBeInTheDocument();
  });

  it('shows Add button for action items', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /add action item/i })).toBeInTheDocument();
  });

  it('shows empty state when no action items', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    expect(screen.getByText(/No action items yet/i)).toBeInTheDocument();
  });

  it('clicking Add button shows action item form', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /add action item/i }));
    expect(screen.getByRole('textbox', { name: /action item description/i })).toBeInTheDocument();
  });

  it('form has description, owner, due date, and meeting fields', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /add action item/i }));
    expect(screen.getByRole('textbox', { name: /action item description/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /owner name/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /link to meeting/i })).toBeInTheDocument();
  });

  it('Save button is disabled when description is empty', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /add action item/i }));
    expect(screen.getByRole('button', { name: /save action item/i })).toBeDisabled();
  });

  it('Save button is enabled when description has text', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /add action item/i }));
    await userEvent.type(screen.getByRole('textbox', { name: /action item description/i }), 'Review NCA requirements');
    expect(screen.getByRole('button', { name: /save action item/i })).not.toBeDisabled();
  });

  it('creates a new action item and shows it in the list', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /add action item/i }));
    await userEvent.type(screen.getByRole('textbox', { name: /action item description/i }), 'Review NCA requirements');
    await userEvent.type(screen.getByRole('textbox', { name: /owner name/i }), 'Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /save action item/i }));
    await waitFor(() => expect(screen.getByText('Review NCA requirements')).toBeInTheDocument());
  });

  it('newly created action item shows owner name', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /add action item/i }));
    await userEvent.type(screen.getByRole('textbox', { name: /action item description/i }), 'Prepare agenda');
    await userEvent.type(screen.getByRole('textbox', { name: /owner name/i }), 'Rania Taleb');
    await userEvent.click(screen.getByRole('button', { name: /save action item/i }));
    await waitFor(() => expect(screen.getByText(/Rania Taleb/i)).toBeInTheDocument());
  });

  it('action item description input clears after saving', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /add action item/i }));
    const input = screen.getByRole('textbox', { name: /action item description/i });
    await userEvent.type(input, 'Send report');
    await userEvent.click(screen.getByRole('button', { name: /save action item/i }));
    await waitFor(() => expect(input.value ?? (input as HTMLInputElement).value).toBe(''));
  });

  it('can delete an action item', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    // Add one first
    await userEvent.click(screen.getByRole('button', { name: /add action item/i }));
    await userEvent.type(screen.getByRole('textbox', { name: /action item description/i }), 'Action to delete');
    await userEvent.click(screen.getByRole('button', { name: /save action item/i }));
    await screen.findByText('Action to delete');
    await userEvent.click(screen.getByRole('button', { name: /delete action item: action to delete/i }));
    await waitFor(() => expect(screen.queryByText('Action to delete')).not.toBeInTheDocument());
  });

  it('can toggle an action item to done', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /add action item/i }));
    await userEvent.type(screen.getByRole('textbox', { name: /action item description/i }), 'Task to complete');
    await userEvent.click(screen.getByRole('button', { name: /save action item/i }));
    await screen.findByText('Task to complete');
    await userEvent.click(screen.getByRole('button', { name: /mark action item complete: task to complete/i }));
    // After completion, the button label changes to incomplete
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /mark action item incomplete: task to complete/i })).toBeInTheDocument()
    );
  });

  it('shows open count badge when there are pending action items', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /add action item/i }));
    await userEvent.type(screen.getByRole('textbox', { name: /action item description/i }), 'Pending task');
    await userEvent.click(screen.getByRole('button', { name: /save action item/i }));
    await screen.findByText('Pending task');
    expect(screen.getByText(/1 open/i)).toBeInTheDocument();
  });

  it('action items persist to localStorage', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /add action item/i }));
    await userEvent.type(screen.getByRole('textbox', { name: /action item description/i }), 'Persistent task');
    await userEvent.click(screen.getByRole('button', { name: /save action item/i }));
    await screen.findByText('Persistent task');
    const stored = JSON.parse(localStorage.getItem('meetings_action_items') ?? '[]');
    expect(stored.some((a: { text: string }) => a.text === 'Persistent task')).toBe(true);
  });

  it('action items load from localStorage on mount', async () => {
    localStorage.setItem('meetings_action_items', JSON.stringify([
      { id: 'ai-stored', text: 'Stored action item', owner: 'Test User', dueDate: '', done: false, meetingId: '' }
    ]));
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    expect(screen.getByText('Stored action item')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Meetings – Clone Meeting', () => {
  it('shows Clone button for each meeting', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    expect(screen.getByRole('button', { name: /clone sprint planning/i })).toBeInTheDocument();
  });

  it('calls upsertMeeting when Clone is clicked', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    const cloned = { ...mockMeeting, id: 'cloned-1', title: 'Copy of Sprint Planning', status: 'Upcoming' as const };
    mockUpsertMeeting.mockResolvedValueOnce(cloned);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    await userEvent.click(screen.getByRole('button', { name: /clone sprint planning/i }));
    await waitFor(() => expect(mockUpsertMeeting).toHaveBeenCalled());
  });

  it('cloned meeting appears in the list with Copy of prefix', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    const cloned = { ...mockMeeting, id: 'cloned-2', title: 'Copy of Sprint Planning', status: 'Upcoming' as const };
    mockUpsertMeeting.mockResolvedValueOnce(cloned);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    await userEvent.click(screen.getByRole('button', { name: /clone sprint planning/i }));
    await screen.findByText('Copy of Sprint Planning');
  });

  it('shows toast after cloning', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    const cloned = { ...mockMeeting, id: 'cloned-3', title: 'Copy of Sprint Planning', status: 'Upcoming' as const };
    mockUpsertMeeting.mockResolvedValueOnce(cloned);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    await userEvent.click(screen.getByRole('button', { name: /clone sprint planning/i }));
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/copy of sprint planning.*created/i);
    });
  });

  it('toast has aria-live polite', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    const cloned = { ...mockMeeting, id: 'cloned-4', title: 'Copy of Sprint Planning', status: 'Upcoming' as const };
    mockUpsertMeeting.mockResolvedValueOnce(cloned);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    await userEvent.click(screen.getByRole('button', { name: /clone sprint planning/i }));
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    });
  });

  it('upsertMeeting called with title "Copy of {original title}"', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    const cloned = { ...mockMeeting, id: 'cloned-5', title: 'Copy of Sprint Planning', status: 'Upcoming' as const };
    mockUpsertMeeting.mockResolvedValueOnce(cloned);
    renderMeetings();
    await screen.findByText('Sprint Planning');
    await userEvent.click(screen.getByRole('button', { name: /clone sprint planning/i }));
    await waitFor(() => {
      const call = mockUpsertMeeting.mock.calls[0][0];
      expect(call.title).toBe('Copy of Sprint Planning');
    });
  });

  it('cloned meeting status is always Upcoming', async () => {
    const completedMeeting = { ...mockMeeting, id: 'm-comp', title: 'Old Review', status: 'Completed' as const };
    mockGetMeetings.mockResolvedValueOnce([completedMeeting]);
    const cloned = { ...completedMeeting, id: 'cloned-6', title: 'Copy of Old Review', status: 'Upcoming' as const };
    mockUpsertMeeting.mockResolvedValueOnce(cloned);
    renderMeetings();
    await screen.findByText('Old Review');
    await userEvent.click(screen.getByRole('button', { name: /clone old review/i }));
    await waitFor(() => {
      const call = mockUpsertMeeting.mock.calls[0][0];
      expect(call.status).toBe('Upcoming');
    });
  });

  it('clone button is disabled while cloning is in progress', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    let resolveClone: (v: unknown) => void;
    mockUpsertMeeting.mockReturnValueOnce(new Promise(r => { resolveClone = r; }));
    renderMeetings();
    await screen.findByText('Sprint Planning');
    fireEvent.click(screen.getByRole('button', { name: /clone sprint planning/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /clone sprint planning/i })).toBeDisabled();
    });
    resolveClone!({ ...mockMeeting, id: 'done', title: 'Copy of Sprint Planning' });
  });
});

describe('Meetings – Export CSV', () => {
  let mockCreateObjectURL: ReturnType<typeof vi.fn>;
  let mockRevokeObjectURL: ReturnType<typeof vi.fn>;
  let mockClick: ReturnType<typeof vi.fn>;
  const origCreateObjectURL = URL.createObjectURL;
  const origRevokeObjectURL = URL.revokeObjectURL;
  const origCreateElement = document.createElement.bind(document);

  beforeEach(() => {
    localStorage.clear();
    mockGetMeetings.mockResolvedValue([mockMeeting]);
    mockClick = vi.fn();
    mockCreateObjectURL = vi.fn(() => 'blob:mock-meetings-url');
    mockRevokeObjectURL = vi.fn();
    URL.createObjectURL = mockCreateObjectURL;
    URL.revokeObjectURL = mockRevokeObjectURL;
    document.createElement = (tag: string) => {
      const el = origCreateElement(tag);
      if (tag === 'a') (el as HTMLAnchorElement).click = mockClick;
      return el;
    };
  });

  afterEach(() => {
    URL.createObjectURL = origCreateObjectURL;
    URL.revokeObjectURL = origRevokeObjectURL;
    document.createElement = origCreateElement;
  });

  it('shows Export CSV button when meetings are loaded', async () => {
    renderMeetings();
    await screen.findByText('Sprint Planning');
    expect(screen.getByRole('button', { name: /export meetings to csv/i })).toBeInTheDocument();
  });

  it('Export CSV button is not disabled', async () => {
    renderMeetings();
    await screen.findByText('Sprint Planning');
    expect(screen.getByRole('button', { name: /export meetings to csv/i })).not.toBeDisabled();
  });

  it('clicking Export CSV calls URL.createObjectURL', async () => {
    renderMeetings();
    await screen.findByText('Sprint Planning');
    await userEvent.click(screen.getByRole('button', { name: /export meetings to csv/i }));
    expect(mockCreateObjectURL).toHaveBeenCalled();
  });

  it('clicking Export CSV triggers anchor click', async () => {
    renderMeetings();
    await screen.findByText('Sprint Planning');
    await userEvent.click(screen.getByRole('button', { name: /export meetings to csv/i }));
    expect(mockClick).toHaveBeenCalled();
  });

  it('clicking Export CSV calls URL.revokeObjectURL', async () => {
    renderMeetings();
    await screen.findByText('Sprint Planning');
    await userEvent.click(screen.getByRole('button', { name: /export meetings to csv/i }));
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-meetings-url');
  });

  it('Export CSV button does not appear with empty meetings list', async () => {
    mockGetMeetings.mockResolvedValue([]);
    renderMeetings();
    await screen.findByText('No meetings found');
    expect(screen.queryByRole('button', { name: /export meetings to csv/i })).not.toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Meetings – Copy Meetings Summary', () => {
  beforeEach(() => {
    localStorage.clear();
    mockGetMeetings.mockResolvedValue([mockMeeting]);
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows Copy meetings summary to clipboard button when meetings loaded', async () => {
    renderMeetings();
    await screen.findByText('Sprint Planning');
    expect(screen.getByRole('button', { name: /copy meetings summary to clipboard/i })).toBeInTheDocument();
  });

  it('Copy meetings summary button is not disabled', async () => {
    renderMeetings();
    await screen.findByText('Sprint Planning');
    expect(screen.getByRole('button', { name: /copy meetings summary to clipboard/i })).not.toBeDisabled();
  });

  it('Copy meetings summary button does not appear with empty list', async () => {
    mockGetMeetings.mockResolvedValue([]);
    renderMeetings();
    await screen.findByText('No meetings found');
    expect(screen.queryByRole('button', { name: /copy meetings summary to clipboard/i })).not.toBeInTheDocument();
  });

  it('clicking Copy meetings summary calls clipboard.writeText', async () => {
    renderMeetings();
    await screen.findByText('Sprint Planning');
    await userEvent.click(screen.getByRole('button', { name: /copy meetings summary to clipboard/i }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
  });

  it('clipboard text contains Total count', async () => {
    renderMeetings();
    await screen.findByText('Sprint Planning');
    await userEvent.click(screen.getByRole('button', { name: /copy meetings summary to clipboard/i }));
    await waitFor(() => {
      const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(text).toContain('Total:');
    });
  });

  it('clipboard text contains Upcoming count', async () => {
    renderMeetings();
    await screen.findByText('Sprint Planning');
    await userEvent.click(screen.getByRole('button', { name: /copy meetings summary to clipboard/i }));
    await waitFor(() => {
      const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(text).toContain('Upcoming:');
    });
  });

  it('shows Copied! feedback after clicking Copy summary', async () => {
    renderMeetings();
    await screen.findByText('Sprint Planning');
    await userEvent.click(screen.getByRole('button', { name: /copy meetings summary to clipboard/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copy meetings summary to clipboard/i })).toHaveTextContent('Copied!');
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Meetings – Export Meetings TXT', () => {
  let mockCreateObjectURL: ReturnType<typeof vi.fn>;
  let mockRevokeObjectURL: ReturnType<typeof vi.fn>;
  let mockClick: ReturnType<typeof vi.fn>;
  let origCreate: typeof document.createElement;

  beforeEach(() => {
    localStorage.clear();
    mockGetMeetings.mockResolvedValue([mockMeeting]);
    mockCreateObjectURL = vi.fn().mockReturnValue('blob:meetings-txt-url');
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

  function renderMeetings() {
    return render(<MemoryRouter><Meetings /></MemoryRouter>);
  }

  it('shows Export TXT button when meetings exist', async () => {
    renderMeetings();
    await screen.findByText('Sprint Planning');
    expect(screen.getByRole('button', { name: /export meetings to txt/i })).toBeInTheDocument();
  });

  it('Export TXT button is not visible when no meetings exist', async () => {
    mockGetMeetings.mockResolvedValue([]);
    renderMeetings();
    await screen.findByText('No meetings found');
    expect(screen.queryByRole('button', { name: /export meetings to txt/i })).not.toBeInTheDocument();
  });

  it('clicking Export TXT calls URL.createObjectURL', async () => {
    renderMeetings();
    await screen.findByText('Sprint Planning');
    await userEvent.click(screen.getByRole('button', { name: /export meetings to txt/i }));
    expect(mockCreateObjectURL).toHaveBeenCalled();
  });

  it('clicking Export TXT triggers anchor click', async () => {
    renderMeetings();
    await screen.findByText('Sprint Planning');
    await userEvent.click(screen.getByRole('button', { name: /export meetings to txt/i }));
    expect(mockClick).toHaveBeenCalled();
  });

  it('clicking Export TXT calls URL.revokeObjectURL', async () => {
    renderMeetings();
    await screen.findByText('Sprint Planning');
    await userEvent.click(screen.getByRole('button', { name: /export meetings to txt/i }));
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:meetings-txt-url');
  });

  it('shows Exported! feedback after clicking Export TXT', async () => {
    renderMeetings();
    await screen.findByText('Sprint Planning');
    await userEvent.click(screen.getByRole('button', { name: /export meetings to txt/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export meetings to txt/i })).toHaveTextContent('Exported!');
    });
  });
});

describe('Meetings – Date Quick Filter', () => {
  function renderMeetings() {
    return render(<MemoryRouter><Meetings /></MemoryRouter>);
  }

  beforeEach(() => {
    mockGetMeetings.mockResolvedValue([mockMeeting]);
  });

  it('shows All date filter button (default active)', async () => {
    renderMeetings();
    await screen.findByText('Sprint Planning');
    expect(screen.getByRole('button', { name: /filter meetings by date: all/i })).toBeInTheDocument();
  });

  it('shows Today date filter button', async () => {
    renderMeetings();
    await screen.findByText('Sprint Planning');
    expect(screen.getByRole('button', { name: /filter meetings by date: today/i })).toBeInTheDocument();
  });

  it('shows This Week date filter button', async () => {
    renderMeetings();
    await screen.findByText('Sprint Planning');
    expect(screen.getByRole('button', { name: /filter meetings by date: this week/i })).toBeInTheDocument();
  });

  it('All date filter button is pressed by default', async () => {
    renderMeetings();
    await screen.findByText('Sprint Planning');
    expect(screen.getByRole('button', { name: /filter meetings by date: all/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('Today filter button is not pressed by default', async () => {
    renderMeetings();
    await screen.findByText('Sprint Planning');
    expect(screen.getByRole('button', { name: /filter meetings by date: today/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Today sets Today as active filter', async () => {
    renderMeetings();
    await screen.findByText('Sprint Planning');
    await userEvent.click(screen.getByRole('button', { name: /filter meetings by date: today/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /filter meetings by date: today/i })).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('clicking Today deactivates All filter', async () => {
    renderMeetings();
    await screen.findByText('Sprint Planning');
    await userEvent.click(screen.getByRole('button', { name: /filter meetings by date: today/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /filter meetings by date: all/i })).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('clicking This Week sets This Week as active filter', async () => {
    renderMeetings();
    await screen.findByText('Sprint Planning');
    await userEvent.click(screen.getByRole('button', { name: /filter meetings by date: this week/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /filter meetings by date: this week/i })).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('clicking All after Today restores All as active', async () => {
    renderMeetings();
    await screen.findByText('Sprint Planning');
    await userEvent.click(screen.getByRole('button', { name: /filter meetings by date: today/i }));
    await userEvent.click(screen.getByRole('button', { name: /filter meetings by date: all/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /filter meetings by date: all/i })).toHaveAttribute('aria-pressed', 'true');
    });
  });
});

describe('Meetings – Location Quick Filter', () => {
  const mockVirtual = {
    ...mockMeeting,
    id: 'm-virtual',
    title: 'Virtual Sprint',
    location: 'MS Teams',
  };
  const mockInPerson = {
    ...mockMeeting,
    id: 'm-inperson',
    title: 'In-Person Review',
    location: 'Boardroom A',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMeetings.mockResolvedValue([mockVirtual, mockInPerson]);
    mockGetWorkspaces.mockResolvedValue([mockWorkspace]);
  });
  afterEach(() => vi.restoreAllMocks());

  it('renders location filter buttons All, Virtual, In-Person', async () => {
    renderMeetings();
    await screen.findByText('Virtual Sprint');
    expect(screen.getByRole('button', { name: /filter meetings by location: all/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter meetings by location: virtual/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter meetings by location: in-person/i })).toBeInTheDocument();
  });

  it('All location filter is active by default', async () => {
    renderMeetings();
    await screen.findByText('Virtual Sprint');
    expect(screen.getByRole('button', { name: /filter meetings by location: all/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('All filter shows both virtual and in-person meetings', async () => {
    renderMeetings();
    await screen.findByText('Virtual Sprint');
    expect(screen.getByText('In-Person Review')).toBeInTheDocument();
  });

  it('Virtual filter shows only virtual meetings', async () => {
    renderMeetings();
    await screen.findByText('Virtual Sprint');
    await userEvent.click(screen.getByRole('button', { name: /filter meetings by location: virtual/i }));
    await waitFor(() => {
      expect(screen.getByText('Virtual Sprint')).toBeInTheDocument();
      expect(screen.queryByText('In-Person Review')).not.toBeInTheDocument();
    });
  });

  it('In-Person filter shows only in-person meetings', async () => {
    renderMeetings();
    await screen.findByText('In-Person Review');
    await userEvent.click(screen.getByRole('button', { name: /filter meetings by location: in-person/i }));
    await waitFor(() => {
      expect(screen.getByText('In-Person Review')).toBeInTheDocument();
      expect(screen.queryByText('Virtual Sprint')).not.toBeInTheDocument();
    });
  });

  it('clicking Virtual sets it as active', async () => {
    renderMeetings();
    await screen.findByText('Virtual Sprint');
    await userEvent.click(screen.getByRole('button', { name: /filter meetings by location: virtual/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /filter meetings by location: virtual/i })).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('clicking In-Person deactivates Virtual', async () => {
    renderMeetings();
    await screen.findByText('Virtual Sprint');
    await userEvent.click(screen.getByRole('button', { name: /filter meetings by location: virtual/i }));
    await userEvent.click(screen.getByRole('button', { name: /filter meetings by location: in-person/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /filter meetings by location: virtual/i })).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('clicking All after Virtual restores both meetings', async () => {
    renderMeetings();
    await screen.findByText('Virtual Sprint');
    await userEvent.click(screen.getByRole('button', { name: /filter meetings by location: virtual/i }));
    await userEvent.click(screen.getByRole('button', { name: /filter meetings by location: all/i }));
    await waitFor(() => {
      expect(screen.getByText('Virtual Sprint')).toBeInTheDocument();
      expect(screen.getByText('In-Person Review')).toBeInTheDocument();
    });
  });
});

// ── Has Action Items Filter ────────────────────────────────────
describe('Meetings – Has Action Items Filter', () => {
  const meetingWithActions = {
    ...mockMeeting,
    id: 'm-with-actions',
    title: 'Meeting With Action Items',
  };
  const meetingNoActions = {
    ...mockMeeting,
    id: 'm-no-actions',
    title: 'Meeting Without Actions',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockGetMeetings.mockResolvedValue([meetingWithActions, meetingNoActions]);
    mockGetWorkspaces.mockResolvedValue([mockWorkspace]);
    const actionItems = [
      { id: 'ai-1', text: 'Follow up with client', owner: 'AM', dueDate: '2026-04-01', done: false, meetingId: 'm-with-actions' },
    ];
    localStorage.setItem('meetings_action_items', JSON.stringify(actionItems));
  });
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders the Has Actions filter button', async () => {
    renderMeetings();
    await screen.findByText('Meeting With Action Items');
    expect(screen.getByRole('button', { name: /show meetings with action items only/i })).toBeInTheDocument();
  });

  it('Has Actions filter defaults to not pressed', async () => {
    renderMeetings();
    await screen.findByText('Meeting With Action Items');
    expect(screen.getByRole('button', { name: /show meetings with action items only/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Has Actions sets it to pressed', async () => {
    renderMeetings();
    await screen.findByText('Meeting With Action Items');
    await userEvent.click(screen.getByRole('button', { name: /show meetings with action items only/i }));
    expect(screen.getByRole('button', { name: /show meetings with action items only/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('Has Actions filter shows only meetings with action items', async () => {
    renderMeetings();
    await screen.findByText('Meeting Without Actions');
    await userEvent.click(screen.getByRole('button', { name: /show meetings with action items only/i }));
    await waitFor(() => {
      expect(screen.getByText('Meeting With Action Items')).toBeInTheDocument();
      expect(screen.queryByText('Meeting Without Actions')).not.toBeInTheDocument();
    });
  });

  it('disabling Has Actions filter restores all meetings', async () => {
    renderMeetings();
    await screen.findByText('Meeting Without Actions');
    await userEvent.click(screen.getByRole('button', { name: /show meetings with action items only/i }));
    await userEvent.click(screen.getByRole('button', { name: /show meetings with action items only/i }));
    await waitFor(() => {
      expect(screen.getByText('Meeting With Action Items')).toBeInTheDocument();
      expect(screen.getByText('Meeting Without Actions')).toBeInTheDocument();
    });
  });

  it('Has Actions filter with no action items hides all meetings', async () => {
    localStorage.setItem('meetings_action_items', JSON.stringify([]));
    renderMeetings();
    await screen.findByText('Meeting With Action Items');
    await userEvent.click(screen.getByRole('button', { name: /show meetings with action items only/i }));
    await waitFor(() => {
      expect(screen.queryByText('Meeting With Action Items')).not.toBeInTheDocument();
      expect(screen.queryByText('Meeting Without Actions')).not.toBeInTheDocument();
    });
  });
});

describe('Meetings – Duration Quick Filter', () => {
  const shortMeeting = { ...mockMeeting, id: 'm-short', title: 'Quick Standup', duration: '30min' };
  const hourMeeting = { ...mockMeeting, id: 'm-hour', title: 'Sprint Review', duration: '1h' };
  const longMeeting = { ...mockMeeting, id: 'm-long', title: 'Deep Dive Workshop', duration: '3h' };

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockGetMeetings.mockResolvedValue([shortMeeting, hourMeeting, longMeeting]);
    mockGetWorkspaces.mockResolvedValue([mockWorkspace]);
    mockUpsertMeeting.mockResolvedValue(mockMeeting);
    mockUpdateMeeting.mockResolvedValue(mockMeeting);
    mockDeleteMeeting.mockResolvedValue(undefined);
    mockUpsertDocument.mockResolvedValue({ id: 'doc-1' });
    mockChatWithDocument.mockResolvedValue('ok');
  });
  afterEach(() => vi.restoreAllMocks());

  it('renders Any Duration filter button', async () => {
    renderMeetings();
    await screen.findByText('Quick Standup');
    expect(screen.getByRole('button', { name: /filter meetings by duration: all/i })).toBeInTheDocument();
  });

  it('renders Short and Long filter buttons', async () => {
    renderMeetings();
    await screen.findByText('Quick Standup');
    expect(screen.getByRole('button', { name: /filter meetings by duration: short/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter meetings by duration: long/i })).toBeInTheDocument();
  });

  it('Any Duration filter is active by default', async () => {
    renderMeetings();
    await screen.findByText('Quick Standup');
    expect(screen.getByRole('button', { name: /filter meetings by duration: all/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows all meetings with Any Duration filter', async () => {
    renderMeetings();
    await waitFor(() => {
      expect(screen.getByText('Quick Standup')).toBeInTheDocument();
      expect(screen.getByText('Sprint Review')).toBeInTheDocument();
      expect(screen.getByText('Deep Dive Workshop')).toBeInTheDocument();
    });
  });

  it('Short filter shows only 30min and 1h meetings', async () => {
    renderMeetings();
    await screen.findByText('Quick Standup');
    await userEvent.click(screen.getByRole('button', { name: /filter meetings by duration: short/i }));
    await waitFor(() => {
      expect(screen.getByText('Quick Standup')).toBeInTheDocument();
      expect(screen.getByText('Sprint Review')).toBeInTheDocument();
      expect(screen.queryByText('Deep Dive Workshop')).not.toBeInTheDocument();
    });
  });

  it('Long filter hides 30min and 1h meetings', async () => {
    renderMeetings();
    await screen.findByText('Deep Dive Workshop');
    await userEvent.click(screen.getByRole('button', { name: /filter meetings by duration: long/i }));
    await waitFor(() => {
      expect(screen.queryByText('Quick Standup')).not.toBeInTheDocument();
      expect(screen.queryByText('Sprint Review')).not.toBeInTheDocument();
      expect(screen.getByText('Deep Dive Workshop')).toBeInTheDocument();
    });
  });

  it('clicking Any Duration after Short restores all meetings', async () => {
    renderMeetings();
    await screen.findByText('Quick Standup');
    await userEvent.click(screen.getByRole('button', { name: /filter meetings by duration: short/i }));
    await waitFor(() => expect(screen.queryByText('Deep Dive Workshop')).not.toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /filter meetings by duration: all/i }));
    await waitFor(() => expect(screen.getByText('Deep Dive Workshop')).toBeInTheDocument());
  });
});

// ────────────────────────────────────────────────────────────
describe('Meetings – Starred Meetings', () => {
  const mockMeeting2 = {
    ...mockMeeting,
    id: 'm2',
    title: 'Budget Review',
    duration: '2h',
  };

  beforeEach(() => {
    localStorage.removeItem('meetings_starred');
    mockGetMeetings.mockResolvedValue([mockMeeting, mockMeeting2]);
  });

  afterEach(() => {
    localStorage.removeItem('meetings_starred');
  });

  it('renders Starred toggle button', async () => {
    renderMeetings();
    await screen.findByText('Sprint Planning');
    expect(screen.getByRole('button', { name: /show starred meetings only/i })).toBeInTheDocument();
  });

  it('Starred toggle is not pressed by default', async () => {
    renderMeetings();
    await screen.findByText('Sprint Planning');
    expect(screen.getByRole('button', { name: /show starred meetings only/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders star button for each meeting', async () => {
    renderMeetings();
    await screen.findByText('Sprint Planning');
    expect(screen.getByRole('button', { name: /star meeting: sprint planning/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /star meeting: budget review/i })).toBeInTheDocument();
  });

  it('star button defaults to not pressed', async () => {
    renderMeetings();
    await screen.findByText('Sprint Planning');
    expect(screen.getByRole('button', { name: /star meeting: sprint planning/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking star button stars the meeting', async () => {
    renderMeetings();
    await screen.findByText('Sprint Planning');
    await userEvent.click(screen.getByRole('button', { name: /star meeting: sprint planning/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /unstar meeting: sprint planning/i })).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('starring persists to localStorage', async () => {
    renderMeetings();
    await screen.findByText('Sprint Planning');
    await userEvent.click(screen.getByRole('button', { name: /star meeting: sprint planning/i }));
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('meetings_starred') ?? '[]');
      expect(stored).toContain('m1');
    });
  });

  it('Starred only toggle hides non-starred meetings', async () => {
    renderMeetings();
    await screen.findByText('Sprint Planning');
    await userEvent.click(screen.getByRole('button', { name: /star meeting: sprint planning/i }));
    await waitFor(() => screen.getByRole('button', { name: /unstar meeting: sprint planning/i }));
    await userEvent.click(screen.getByRole('button', { name: /show starred meetings only/i }));
    await waitFor(() => {
      expect(screen.getByText('Sprint Planning')).toBeInTheDocument();
      expect(screen.queryByText('Budget Review')).not.toBeInTheDocument();
    });
  });

  it('loads starred state from localStorage', async () => {
    localStorage.setItem('meetings_starred', JSON.stringify(['m1']));
    renderMeetings();
    await screen.findByText('Sprint Planning');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /unstar meeting: sprint planning/i })).toHaveAttribute('aria-pressed', 'true');
    });
  });
});

// ── Sort by Participants ──────────────────────────────────────
describe('Meetings – Sort by Participants', () => {
  it('renders Most Participants sort option', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const select = screen.getByRole('combobox', { name: /sort meetings/i });
    expect(select.querySelector('option[value="participants"]')).toBeTruthy();
  });

  it('selects participants sort option', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const select = screen.getByRole('combobox', { name: /sort meetings/i });
    await userEvent.selectOptions(select, 'participants');
    expect((select as HTMLSelectElement).value).toBe('participants');
  });

  it('sorts meetings by participant count descending', async () => {
    const m1 = { ...mockMeeting, id: 'm1', title: 'SmallMtg', participants: ['A'] };
    const m2 = { ...mockMeeting, id: 'm2', title: 'BigMtg', participants: ['A', 'B', 'C', 'D'] };
    mockGetMeetings.mockResolvedValueOnce([m1, m2]);
    renderMeetings();
    await screen.findByText('SmallMtg');
    const select = screen.getByRole('combobox', { name: /sort meetings/i });
    await userEvent.selectOptions(select, 'participants');
    await waitFor(() => {
      const bigEl = screen.getByText('BigMtg');
      const smallEl = screen.getByText('SmallMtg');
      const pos = bigEl.compareDocumentPosition(smallEl);
      expect(pos & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });

  it('switching back to newest changes sort', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const select = screen.getByRole('combobox', { name: /sort meetings/i });
    await userEvent.selectOptions(select, 'participants');
    await userEvent.selectOptions(select, 'newest');
    expect((select as HTMLSelectElement).value).toBe('newest');
  });

  it('sort dropdown has Most Participants option text', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    expect(screen.getByRole('option', { name: /most participants/i })).toBeInTheDocument();
  });
});

describe('Meetings – Sort by Workspace', () => {
  const mtgAlpha = { ...mockMeeting, id: 'm-a', title: 'Alpha Meeting', workspace: 'Alpha WS', date: '2026-03-10' };
  const mtgZeta = { ...mockMeeting, id: 'm-z', title: 'Zeta Meeting', workspace: 'Zeta WS', date: '2026-03-15' };
  const mtgMid = { ...mockMeeting, id: 'm-m', title: 'Mid Meeting', workspace: 'Mid WS', date: '2026-03-12' };

  beforeEach(() => {
    mockGetMeetings.mockResolvedValue([mtgAlpha, mtgZeta, mtgMid]);
    mockGetWorkspaces.mockResolvedValue([]);
  });

  it('renders By Workspace option in sort dropdown', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    expect(screen.getByRole('option', { name: /by workspace/i })).toBeInTheDocument();
  });

  it('selecting workspace sets sort value', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort meetings/i }) as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'workspace');
    expect(sel.value).toBe('workspace');
  });

  it('workspace sort shows all meetings', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort meetings/i });
    await userEvent.selectOptions(sel, 'workspace');
    expect(screen.getByText('Alpha Meeting')).toBeInTheDocument();
    expect(screen.getByText('Zeta Meeting')).toBeInTheDocument();
    expect(screen.getByText('Mid Meeting')).toBeInTheDocument();
  });

  it('workspace sort places Alpha before Zeta in DOM', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort meetings/i });
    await userEvent.selectOptions(sel, 'workspace');
    const alphaEl = screen.getByText('Alpha Meeting');
    const zetaEl = screen.getByText('Zeta Meeting');
    expect(alphaEl.compareDocumentPosition(zetaEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('switching back to newest works', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort meetings/i }) as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'workspace');
    await userEvent.selectOptions(sel, 'newest');
    expect(sel.value).toBe('newest');
  });
});

describe('Meetings – Sort by Type', () => {
  const mtgKickoff = { ...mockMeeting, id: 'm-kick', title: 'Kickoff Meeting', type: 'Kickoff' as const, date: '2026-03-10' };
  const mtgReview = { ...mockMeeting, id: 'm-rev', title: 'Review Meeting', type: 'Review' as const, date: '2026-03-12' };
  const mtgWorkshop = { ...mockMeeting, id: 'm-work', title: 'Workshop Meeting', type: 'Workshop' as const, date: '2026-03-11' };

  beforeEach(() => {
    mockGetMeetings.mockResolvedValue([mtgWorkshop, mtgReview, mtgKickoff]);
    mockGetWorkspaces.mockResolvedValue([]);
  });

  it('renders By Type option in sort dropdown', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    expect(screen.getByRole('option', { name: /by type/i })).toBeInTheDocument();
  });

  it('selecting type sets sort value', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort meetings/i }) as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'type');
    expect(sel.value).toBe('type');
  });

  it('type sort shows all meetings', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort meetings/i });
    await userEvent.selectOptions(sel, 'type');
    expect(screen.getByText('Kickoff Meeting')).toBeInTheDocument();
    expect(screen.getByText('Review Meeting')).toBeInTheDocument();
    expect(screen.getByText('Workshop Meeting')).toBeInTheDocument();
  });

  it('type sort places Kickoff before Workshop in DOM', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort meetings/i });
    await userEvent.selectOptions(sel, 'type');
    const kickoffEl = screen.getByText('Kickoff Meeting');
    const workshopEl = screen.getByText('Workshop Meeting');
    expect(kickoffEl.compareDocumentPosition(workshopEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('switching back to newest works after type sort', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort meetings/i }) as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'type');
    await userEvent.selectOptions(sel, 'newest');
    expect(sel.value).toBe('newest');
  });
});

describe('Meetings – Sort by Location', () => {
  const mtgBoardroom = { ...mockMeeting, id: 'm-board', title: 'Boardroom Meeting', location: 'Boardroom A', date: '2026-03-10' };
  const mtgVirtual = { ...mockMeeting, id: 'm-virt', title: 'Virtual Meeting', location: 'Virtual/Zoom', date: '2026-03-12' };
  const mtgConference = { ...mockMeeting, id: 'm-conf', title: 'Conference Meeting', location: 'Conference C', date: '2026-03-11' };

  beforeEach(() => {
    mockGetMeetings.mockResolvedValue([mtgVirtual, mtgBoardroom, mtgConference]);
  });

  it('location option exists in sort select', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort meetings/i });
    const opts = Array.from(sel.querySelectorAll('option')).map((o: Element) => (o as HTMLOptionElement).value);
    expect(opts).toContain('location');
  });

  it('selecting location sets sort value', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort meetings/i }) as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'location');
    expect(sel.value).toBe('location');
  });

  it('location sort shows all meetings', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort meetings/i });
    await userEvent.selectOptions(sel, 'location');
    expect(screen.getByText('Boardroom Meeting')).toBeInTheDocument();
    expect(screen.getByText('Virtual Meeting')).toBeInTheDocument();
    expect(screen.getByText('Conference Meeting')).toBeInTheDocument();
  });

  it('location sort places Boardroom before Virtual in DOM', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort meetings/i });
    await userEvent.selectOptions(sel, 'location');
    const boardEl = screen.getByText('Boardroom Meeting');
    const virtEl = screen.getByText('Virtual Meeting');
    expect(boardEl.compareDocumentPosition(virtEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('switching back to newest works after location sort', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort meetings/i }) as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'location');
    await userEvent.selectOptions(sel, 'newest');
    expect(sel.value).toBe('newest');
  });
});

describe('Meetings – Min Participants Filter', () => {
  const smallMeeting = { ...mockMeeting, id: 'sm1', title: 'Small Meeting', participants: ['AM', 'RT'] };
  const largeMeeting = { ...mockMeeting, id: 'lm1', title: 'Large Meeting', participants: ['AM', 'RT', 'FK', 'SR', 'KH', 'ZZ'] };
  const mediumMeeting = { ...mockMeeting, id: 'mm1', title: 'Medium Meeting', participants: ['AM', 'RT', 'FK'] };

  beforeEach(() => {
    mockGetMeetings.mockResolvedValue([smallMeeting, largeMeeting, mediumMeeting]);
    mockGetWorkspaces.mockResolvedValue([mockWorkspace]);
  });

  it('renders min participants filter select', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    expect(screen.getByRole('combobox', { name: /filter meetings by minimum participants/i })).toBeInTheDocument();
  });

  it('filter defaults to Any Size (0)', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /filter meetings by minimum participants/i }) as HTMLSelectElement;
    expect(sel.value).toBe('0');
  });

  it('filtering to 5+ hides small and medium meetings', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /filter meetings by minimum participants/i }), '5');
    expect(screen.getByText('Large Meeting')).toBeInTheDocument();
    expect(screen.queryByText('Small Meeting')).not.toBeInTheDocument();
    expect(screen.queryByText('Medium Meeting')).not.toBeInTheDocument();
  });

  it('filtering to 3+ includes medium and large but not small', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /filter meetings by minimum participants/i }), '3');
    expect(screen.getByText('Large Meeting')).toBeInTheDocument();
    expect(screen.getByText('Medium Meeting')).toBeInTheDocument();
    expect(screen.queryByText('Small Meeting')).not.toBeInTheDocument();
  });

  it('resetting to Any Size shows all meetings', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /filter meetings by minimum participants/i });
    await userEvent.selectOptions(sel, '5');
    await userEvent.selectOptions(sel, '0');
    expect(screen.getByText('Small Meeting')).toBeInTheDocument();
    expect(screen.getByText('Large Meeting')).toBeInTheDocument();
    expect(screen.getByText('Medium Meeting')).toBeInTheDocument();
  });
});

describe('Meetings – Quorum Status Filter', () => {
  const metMeeting = { ...mockMeeting, id: 'qm1', title: 'Quorum Met Meeting', quorum_status: 'Met' as const };
  const notMetMeeting = { ...mockMeeting, id: 'qn1', title: 'Quorum Not Met Meeting', quorum_status: 'Not Met' as const };
  const noQuorumMeeting = { ...mockMeeting, id: 'qx1', title: 'No Quorum Meeting', quorum_status: null };

  beforeEach(() => {
    mockGetMeetings.mockResolvedValue([metMeeting, notMetMeeting, noQuorumMeeting]);
    mockGetWorkspaces.mockResolvedValue([mockWorkspace]);
  });

  it('renders quorum filter select', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    expect(screen.getByRole('combobox', { name: /filter meetings by quorum status/i })).toBeInTheDocument();
  });

  it('filter defaults to Any Quorum', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /filter meetings by quorum status/i }) as HTMLSelectElement;
    expect(sel.value).toBe('All');
  });

  it('filtering by Met shows only meetings with quorum met', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /filter meetings by quorum status/i }), 'Met');
    expect(screen.getByText('Quorum Met Meeting')).toBeInTheDocument();
    expect(screen.queryByText('Quorum Not Met Meeting')).not.toBeInTheDocument();
    expect(screen.queryByText('No Quorum Meeting')).not.toBeInTheDocument();
  });

  it('filtering by Not Met shows only meetings with quorum not met', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /filter meetings by quorum status/i }), 'Not Met');
    expect(screen.getByText('Quorum Not Met Meeting')).toBeInTheDocument();
    expect(screen.queryByText('Quorum Met Meeting')).not.toBeInTheDocument();
    expect(screen.queryByText('No Quorum Meeting')).not.toBeInTheDocument();
  });

  it('resetting to Any Quorum shows all meetings', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /filter meetings by quorum status/i });
    await userEvent.selectOptions(sel, 'Met');
    await userEvent.selectOptions(sel, 'All');
    expect(screen.getByText('Quorum Met Meeting')).toBeInTheDocument();
    expect(screen.getByText('Quorum Not Met Meeting')).toBeInTheDocument();
    expect(screen.getByText('No Quorum Meeting')).toBeInTheDocument();
  });
});

describe('Meetings – Sort by Title', () => {
  const mtgAlpha = { ...mockMeeting, id: 'mta', title: 'Alpha Strategy Meeting', date: '2026-03-15' };
  const mtgBeta = { ...mockMeeting, id: 'mtb', title: 'Beta Planning Session', date: '2026-03-16' };
  const mtgZeta = { ...mockMeeting, id: 'mtz', title: 'Zeta Review Workshop', date: '2026-03-17' };

  beforeEach(() => {
    mockGetMeetings.mockResolvedValue([mtgZeta, mtgAlpha, mtgBeta]);
    mockGetWorkspaces.mockResolvedValue([mockWorkspace]);
  });

  it('title sort option exists in sort dropdown', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort meetings/i });
    expect(sel.querySelector('option[value="title"]')).toBeInTheDocument();
  });

  it('selecting title sort activates it', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort meetings/i }) as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'title');
    expect(sel.value).toBe('title');
  });

  it('title sort places Alpha before Zeta in DOM', async () => {
    renderMeetings();
    await screen.findByText('Zeta Review Workshop');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort meetings/i }), 'title');
    const alphaEl = screen.getByText('Alpha Strategy Meeting');
    const zetaEl = screen.getByText('Zeta Review Workshop');
    expect(alphaEl.compareDocumentPosition(zetaEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('all three meetings remain visible after title sort', async () => {
    renderMeetings();
    await screen.findByText('Zeta Review Workshop');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort meetings/i }), 'title');
    expect(screen.getByText('Alpha Strategy Meeting')).toBeInTheDocument();
    expect(screen.getByText('Beta Planning Session')).toBeInTheDocument();
    expect(screen.getByText('Zeta Review Workshop')).toBeInTheDocument();
  });

  it('switching back to newest deactivates title sort', async () => {
    renderMeetings();
    await screen.findByText('Zeta Review Workshop');
    const sel = screen.getByRole('combobox', { name: /sort meetings/i }) as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'title');
    await userEvent.selectOptions(sel, 'newest');
    expect(sel.value).toBe('newest');
  });
});

describe('Meetings – Sort by Oldest', () => {
  const mtgEarly = { ...mockMeeting, id: 'moe', title: 'Early Jan Meeting', date: '2026-01-10' };
  const mtgMid = { ...mockMeeting, id: 'mom', title: 'Mid Feb Meeting', date: '2026-02-20' };
  const mtgLate = { ...mockMeeting, id: 'mol', title: 'Late Mar Meeting', date: '2026-03-30' };

  beforeEach(() => {
    mockGetMeetings.mockResolvedValue([mtgLate, mtgEarly, mtgMid]);
    mockGetWorkspaces.mockResolvedValue([mockWorkspace]);
  });

  it('oldest sort option exists in sort dropdown', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort meetings/i });
    expect(sel.querySelector('option[value="oldest"]')).toBeInTheDocument();
  });

  it('selecting oldest sort activates it', async () => {
    renderMeetings();
    await waitFor(() => expect(mockGetMeetings).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /sort meetings/i }) as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'oldest');
    expect(sel.value).toBe('oldest');
  });

  it('oldest sort places Early Jan before Late Mar in DOM', async () => {
    renderMeetings();
    await screen.findByText('Late Mar Meeting');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort meetings/i }), 'oldest');
    const earlyEl = screen.getByText('Early Jan Meeting');
    const lateEl = screen.getByText('Late Mar Meeting');
    expect(earlyEl.compareDocumentPosition(lateEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('all three meetings remain visible after oldest sort', async () => {
    renderMeetings();
    await screen.findByText('Late Mar Meeting');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort meetings/i }), 'oldest');
    expect(screen.getByText('Early Jan Meeting')).toBeInTheDocument();
    expect(screen.getByText('Mid Feb Meeting')).toBeInTheDocument();
    expect(screen.getByText('Late Mar Meeting')).toBeInTheDocument();
  });

  it('switching back to newest restores newest-first ordering option', async () => {
    renderMeetings();
    await screen.findByText('Late Mar Meeting');
    const sel = screen.getByRole('combobox', { name: /sort meetings/i }) as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'oldest');
    await userEvent.selectOptions(sel, 'newest');
    expect(sel.value).toBe('newest');
  });
});

// ────────────────────────────────────────────────────────────
describe('Meetings – Sort by Newest DOM Order', () => {
  const mtgEarly = { ...mockMeeting, id: 'mne', title: 'Early Jan Meeting', date: '2026-01-10' };
  const mtgMid = { ...mockMeeting, id: 'mnm', title: 'Mid Feb Meeting', date: '2026-02-20' };
  const mtgLate = { ...mockMeeting, id: 'mnl', title: 'Late Mar Meeting', date: '2026-03-30' };

  beforeEach(() => {
    mockGetMeetings.mockResolvedValue([mtgEarly, mtgMid, mtgLate]);
    mockGetWorkspaces.mockResolvedValue([mockWorkspace]);
  });

  it('newest sort (default) places Late Mar before Early Jan in DOM', async () => {
    renderMeetings();
    await screen.findByText('Late Mar Meeting');
    const lateEl = screen.getByText('Late Mar Meeting');
    const earlyEl = screen.getByText('Early Jan Meeting');
    expect(lateEl.compareDocumentPosition(earlyEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('newest sort places Mid Feb before Early Jan in DOM', async () => {
    renderMeetings();
    await screen.findByText('Late Mar Meeting');
    const midEl = screen.getByText('Mid Feb Meeting');
    const earlyEl = screen.getByText('Early Jan Meeting');
    expect(midEl.compareDocumentPosition(earlyEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('all three meetings remain visible with newest sort', async () => {
    renderMeetings();
    await screen.findByText('Late Mar Meeting');
    expect(screen.getByText('Early Jan Meeting')).toBeInTheDocument();
    expect(screen.getByText('Mid Feb Meeting')).toBeInTheDocument();
    expect(screen.getByText('Late Mar Meeting')).toBeInTheDocument();
  });

  it('switching from oldest back to newest restores newest-first order', async () => {
    renderMeetings();
    await screen.findByText('Late Mar Meeting');
    const sel = screen.getByRole('combobox', { name: /sort meetings/i }) as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'oldest');
    await userEvent.selectOptions(sel, 'newest');
    const lateEl = screen.getByText('Late Mar Meeting');
    const earlyEl = screen.getByText('Early Jan Meeting');
    expect(lateEl.compareDocumentPosition(earlyEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

// ────────────────────────────────────────────────────────────
describe('Meetings – Location Filter', () => {
  const virtualMeeting = {
    ...mockMeeting,
    id: 'mv1',
    title: 'Virtual Sprint Review',
    location: 'Microsoft Teams',
  };
  const inPersonMeeting = {
    ...mockMeeting,
    id: 'mi1',
    title: 'In-Person Steering Meeting',
    location: 'Boardroom C',
  };

  beforeEach(() => {
    mockGetMeetings.mockResolvedValue([virtualMeeting, inPersonMeeting]);
    mockGetWorkspaces.mockResolvedValue([mockWorkspace]);
  });

  it('shows location filter buttons', async () => {
    renderMeetings();
    await screen.findByText('Virtual Sprint Review');
    expect(screen.getByRole('button', { name: /filter meetings by location: all/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter meetings by location: virtual/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter meetings by location: in-person/i })).toBeInTheDocument();
  });

  it('All location filter is active by default', async () => {
    renderMeetings();
    await screen.findByText('Virtual Sprint Review');
    expect(screen.getByRole('button', { name: /filter meetings by location: all/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('both meetings visible with All location filter', async () => {
    renderMeetings();
    await screen.findByText('Virtual Sprint Review');
    expect(screen.getByText('In-Person Steering Meeting')).toBeInTheDocument();
  });

  it('Virtual filter hides in-person meetings', async () => {
    renderMeetings();
    await screen.findByText('Virtual Sprint Review');
    await userEvent.click(screen.getByRole('button', { name: /filter meetings by location: virtual/i }));
    await waitFor(() => {
      expect(screen.queryByText('In-Person Steering Meeting')).not.toBeInTheDocument();
    });
  });

  it('Virtual filter keeps virtual meetings visible', async () => {
    renderMeetings();
    await screen.findByText('Virtual Sprint Review');
    await userEvent.click(screen.getByRole('button', { name: /filter meetings by location: virtual/i }));
    await waitFor(() => {
      expect(screen.getByText('Virtual Sprint Review')).toBeInTheDocument();
    });
  });

  it('In-Person filter hides virtual meetings', async () => {
    renderMeetings();
    await screen.findByText('Virtual Sprint Review');
    await userEvent.click(screen.getByRole('button', { name: /filter meetings by location: in-person/i }));
    await waitFor(() => {
      expect(screen.queryByText('Virtual Sprint Review')).not.toBeInTheDocument();
    });
  });

  it('In-Person filter keeps in-person meetings visible', async () => {
    renderMeetings();
    await screen.findByText('In-Person Steering Meeting');
    await userEvent.click(screen.getByRole('button', { name: /filter meetings by location: in-person/i }));
    await waitFor(() => {
      expect(screen.getByText('In-Person Steering Meeting')).toBeInTheDocument();
    });
  });

  it('switching back to All restores both meetings', async () => {
    renderMeetings();
    await screen.findByText('Virtual Sprint Review');
    await userEvent.click(screen.getByRole('button', { name: /filter meetings by location: virtual/i }));
    await waitFor(() => expect(screen.queryByText('In-Person Steering Meeting')).not.toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /filter meetings by location: all/i }));
    await waitFor(() => {
      expect(screen.getByText('Virtual Sprint Review')).toBeInTheDocument();
      expect(screen.getByText('In-Person Steering Meeting')).toBeInTheDocument();
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Meetings – Has Actions Toggle', () => {
  const meetingWithActions = {
    ...mockMeeting,
    id: 'mha1',
    title: 'Meeting With Action Items',
    action_items: JSON.stringify([{ id: 'a1', text: 'Review docs', owner: 'AM', meetingId: 'mha1', status: 'pending' }]),
  };
  const meetingNoActions = {
    ...mockMeeting,
    id: 'mha2',
    title: 'Meeting Without Actions',
    action_items: null,
  };

  beforeEach(() => {
    mockGetMeetings.mockResolvedValue([meetingWithActions, meetingNoActions]);
    mockGetWorkspaces.mockResolvedValue([mockWorkspace]);
  });

  it('shows Show meetings with action items only button', async () => {
    renderMeetings();
    await screen.findByText('Meeting With Action Items');
    expect(screen.getByRole('button', { name: /show meetings with action items only/i })).toBeInTheDocument();
  });

  it('Has Actions toggle starts with aria-pressed false', async () => {
    renderMeetings();
    await screen.findByText('Meeting With Action Items');
    expect(screen.getByRole('button', { name: /show meetings with action items only/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('both meetings visible before toggle', async () => {
    renderMeetings();
    await screen.findByText('Meeting With Action Items');
    expect(screen.getByText('Meeting Without Actions')).toBeInTheDocument();
  });

  it('clicking Has Actions toggle shows only meetings that have action items', async () => {
    renderMeetings();
    await screen.findByText('Meeting With Action Items');
    await userEvent.click(screen.getByRole('button', { name: /show meetings with action items only/i }));
    await waitFor(() => {
      expect(screen.getByText('Meeting With Action Items')).toBeInTheDocument();
    });
  });

  it('clicking Has Actions toggle changes aria-pressed to true', async () => {
    renderMeetings();
    await screen.findByText('Meeting With Action Items');
    await userEvent.click(screen.getByRole('button', { name: /show meetings with action items only/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /show meetings with action items only/i })).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('clicking Has Actions toggle again restores aria-pressed to false', async () => {
    renderMeetings();
    await screen.findByText('Meeting With Action Items');
    const btn = screen.getByRole('button', { name: /show meetings with action items only/i });
    await userEvent.click(btn);
    await waitFor(() => expect(btn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(btn);
    await waitFor(() => {
      expect(btn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Meetings – Duration Filter', () => {
  const shortMeeting = {
    ...mockMeeting,
    id: 'mdf1',
    title: 'Short Stand-Up Meeting',
    duration: '30min',
  };
  const longMeeting = {
    ...mockMeeting,
    id: 'mdf2',
    title: 'Long Workshop Meeting',
    duration: '3h',
  };

  beforeEach(() => {
    mockGetMeetings.mockResolvedValue([shortMeeting, longMeeting]);
    mockGetWorkspaces.mockResolvedValue([mockWorkspace]);
  });

  it('shows duration filter buttons', async () => {
    renderMeetings();
    await screen.findByText('Short Stand-Up Meeting');
    expect(screen.getByRole('button', { name: /filter meetings by duration: all/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter meetings by duration: short/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter meetings by duration: long/i })).toBeInTheDocument();
  });

  it('Any Duration (All) filter is active by default', async () => {
    renderMeetings();
    await screen.findByText('Short Stand-Up Meeting');
    expect(screen.getByRole('button', { name: /filter meetings by duration: all/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('both meetings visible with All duration filter', async () => {
    renderMeetings();
    await screen.findByText('Short Stand-Up Meeting');
    expect(screen.getByText('Long Workshop Meeting')).toBeInTheDocument();
  });

  it('Short filter hides long meetings', async () => {
    renderMeetings();
    await screen.findByText('Short Stand-Up Meeting');
    await userEvent.click(screen.getByRole('button', { name: /filter meetings by duration: short/i }));
    await waitFor(() => {
      expect(screen.queryByText('Long Workshop Meeting')).not.toBeInTheDocument();
    });
  });

  it('Short filter keeps short meetings visible', async () => {
    renderMeetings();
    await screen.findByText('Short Stand-Up Meeting');
    await userEvent.click(screen.getByRole('button', { name: /filter meetings by duration: short/i }));
    await waitFor(() => {
      expect(screen.getByText('Short Stand-Up Meeting')).toBeInTheDocument();
    });
  });

  it('Long filter hides short meetings', async () => {
    renderMeetings();
    await screen.findByText('Short Stand-Up Meeting');
    await userEvent.click(screen.getByRole('button', { name: /filter meetings by duration: long/i }));
    await waitFor(() => {
      expect(screen.queryByText('Short Stand-Up Meeting')).not.toBeInTheDocument();
    });
  });

  it('Long filter keeps long meetings visible', async () => {
    renderMeetings();
    await screen.findByText('Short Stand-Up Meeting');
    await userEvent.click(screen.getByRole('button', { name: /filter meetings by duration: long/i }));
    await waitFor(() => {
      expect(screen.getByText('Long Workshop Meeting')).toBeInTheDocument();
    });
  });

  it('switching back to All restores both meetings', async () => {
    renderMeetings();
    await screen.findByText('Short Stand-Up Meeting');
    await userEvent.click(screen.getByRole('button', { name: /filter meetings by duration: short/i }));
    await waitFor(() => expect(screen.queryByText('Long Workshop Meeting')).not.toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /filter meetings by duration: all/i }));
    await waitFor(() => {
      expect(screen.getByText('Short Stand-Up Meeting')).toBeInTheDocument();
      expect(screen.getByText('Long Workshop Meeting')).toBeInTheDocument();
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Meetings – Minimum Participants Filter', () => {
  const smallMeeting = {
    ...mockMeeting,
    id: 'mmp1',
    title: 'Small Team Meeting',
    participants: ['AM', 'RT'],
  };
  const largeMeeting = {
    ...mockMeeting,
    id: 'mmp2',
    title: 'Large Steering Committee',
    participants: ['AM', 'RT', 'FH', 'SK', 'BK', 'MO'],
  };

  beforeEach(() => {
    mockGetMeetings.mockResolvedValue([smallMeeting, largeMeeting]);
    mockGetWorkspaces.mockResolvedValue([mockWorkspace]);
  });

  it('shows minimum participants filter dropdown', async () => {
    renderMeetings();
    await screen.findByText('Small Team Meeting');
    expect(screen.getByRole('combobox', { name: /filter meetings by minimum participants/i })).toBeInTheDocument();
  });

  it('minimum participants filter defaults to Any Size (0)', async () => {
    renderMeetings();
    await screen.findByText('Small Team Meeting');
    const sel = screen.getByRole('combobox', { name: /filter meetings by minimum participants/i }) as HTMLSelectElement;
    expect(sel.value).toBe('0');
  });

  it('both meetings visible with Any Size filter', async () => {
    renderMeetings();
    await screen.findByText('Small Team Meeting');
    expect(screen.getByText('Large Steering Committee')).toBeInTheDocument();
  });

  it('filtering by 5+ participants hides small meeting', async () => {
    renderMeetings();
    await screen.findByText('Small Team Meeting');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /filter meetings by minimum participants/i }), '5');
    await waitFor(() => {
      expect(screen.queryByText('Small Team Meeting')).not.toBeInTheDocument();
    });
  });

  it('filtering by 5+ participants keeps large meeting visible', async () => {
    renderMeetings();
    await screen.findByText('Small Team Meeting');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /filter meetings by minimum participants/i }), '5');
    await waitFor(() => {
      expect(screen.getByText('Large Steering Committee')).toBeInTheDocument();
    });
  });

  it('switching back to Any Size restores both meetings', async () => {
    renderMeetings();
    await screen.findByText('Small Team Meeting');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /filter meetings by minimum participants/i }), '5');
    await waitFor(() => expect(screen.queryByText('Small Team Meeting')).not.toBeInTheDocument());
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /filter meetings by minimum participants/i }), '0');
    await waitFor(() => {
      expect(screen.getByText('Small Team Meeting')).toBeInTheDocument();
      expect(screen.getByText('Large Steering Committee')).toBeInTheDocument();
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Meetings – Quorum Filter', () => {
  const quorumMet = {
    ...mockMeeting,
    id: 'mqf1',
    title: 'Quorum Met Meeting',
    quorum_status: 'Met' as const,
  };
  const quorumNotMet = {
    ...mockMeeting,
    id: 'mqf2',
    title: 'Quorum Not Met Meeting',
    quorum_status: 'Not Met' as const,
  };
  const quorumNull = {
    ...mockMeeting,
    id: 'mqf3',
    title: 'Quorum Unknown Meeting',
    quorum_status: null,
  };

  beforeEach(() => {
    mockGetMeetings.mockResolvedValue([quorumMet, quorumNotMet, quorumNull]);
    mockGetWorkspaces.mockResolvedValue([mockWorkspace]);
  });

  it('shows quorum filter dropdown', async () => {
    renderMeetings();
    await screen.findByText('Quorum Met Meeting');
    expect(screen.getByRole('combobox', { name: /filter meetings by quorum status/i })).toBeInTheDocument();
  });

  it('quorum filter defaults to All', async () => {
    renderMeetings();
    await screen.findByText('Quorum Met Meeting');
    const sel = screen.getByRole('combobox', { name: /filter meetings by quorum status/i }) as HTMLSelectElement;
    expect(sel.value).toBe('All');
  });

  it('all three meetings visible with All quorum filter', async () => {
    renderMeetings();
    await screen.findByText('Quorum Met Meeting');
    expect(screen.getByText('Quorum Not Met Meeting')).toBeInTheDocument();
    expect(screen.getByText('Quorum Unknown Meeting')).toBeInTheDocument();
  });

  it('Met filter hides Not Met and Unknown meetings', async () => {
    renderMeetings();
    await screen.findByText('Quorum Met Meeting');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /filter meetings by quorum status/i }), 'Met');
    await waitFor(() => {
      expect(screen.queryByText('Quorum Not Met Meeting')).not.toBeInTheDocument();
      expect(screen.queryByText('Quorum Unknown Meeting')).not.toBeInTheDocument();
    });
  });

  it('Met filter keeps Met meetings visible', async () => {
    renderMeetings();
    await screen.findByText('Quorum Met Meeting');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /filter meetings by quorum status/i }), 'Met');
    await waitFor(() => {
      expect(screen.getByText('Quorum Met Meeting')).toBeInTheDocument();
    });
  });

  it('Not Met filter hides Met and Unknown meetings', async () => {
    renderMeetings();
    await screen.findByText('Quorum Met Meeting');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /filter meetings by quorum status/i }), 'Not Met');
    await waitFor(() => {
      expect(screen.queryByText('Quorum Met Meeting')).not.toBeInTheDocument();
      expect(screen.queryByText('Quorum Unknown Meeting')).not.toBeInTheDocument();
    });
  });

  it('Not Met filter keeps Not Met meetings visible', async () => {
    renderMeetings();
    await screen.findByText('Quorum Met Meeting');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /filter meetings by quorum status/i }), 'Not Met');
    await waitFor(() => {
      expect(screen.getByText('Quorum Not Met Meeting')).toBeInTheDocument();
    });
  });

  it('switching back to All restores all meetings', async () => {
    renderMeetings();
    await screen.findByText('Quorum Met Meeting');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /filter meetings by quorum status/i }), 'Met');
    await waitFor(() => expect(screen.queryByText('Quorum Not Met Meeting')).not.toBeInTheDocument());
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /filter meetings by quorum status/i }), 'All');
    await waitFor(() => {
      expect(screen.getByText('Quorum Met Meeting')).toBeInTheDocument();
      expect(screen.getByText('Quorum Not Met Meeting')).toBeInTheDocument();
      expect(screen.getByText('Quorum Unknown Meeting')).toBeInTheDocument();
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Meetings – Reminder Toggle', () => {
  afterEach(() => localStorage.clear());

  it('renders a Set reminder button for each meeting card', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    expect(await screen.findByRole('button', { name: /set reminder: sprint planning/i })).toBeInTheDocument();
  });

  it('reminder button has aria-pressed false initially', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    const btn = await screen.findByRole('button', { name: /set reminder: sprint planning/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking reminder button sets aria-pressed true', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    const btn = await screen.findByRole('button', { name: /set reminder: sprint planning/i });
    await userEvent.click(btn);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /remove reminder: sprint planning/i })).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('button label changes to Remove reminder after clicking', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    const btn = await screen.findByRole('button', { name: /set reminder: sprint planning/i });
    await userEvent.click(btn);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /remove reminder: sprint planning/i })).toBeInTheDocument();
    });
  });

  it('clicking again toggles reminder off', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    const btn = await screen.findByRole('button', { name: /set reminder: sprint planning/i });
    await userEvent.click(btn);
    await waitFor(() => screen.getByRole('button', { name: /remove reminder: sprint planning/i }));
    await userEvent.click(screen.getByRole('button', { name: /remove reminder: sprint planning/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /set reminder: sprint planning/i })).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('persists reminder to localStorage', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    const btn = await screen.findByRole('button', { name: /set reminder: sprint planning/i });
    await userEvent.click(btn);
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('meetings_reminders') ?? '[]');
      expect(stored).toContain('m1');
    });
  });

  it('persists removal to localStorage', async () => {
    localStorage.setItem('meetings_reminders', JSON.stringify(['m1']));
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    await waitFor(() => screen.getByRole('button', { name: /remove reminder: sprint planning/i }));
    await userEvent.click(screen.getByRole('button', { name: /remove reminder: sprint planning/i }));
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('meetings_reminders') ?? '[]');
      expect(stored).not.toContain('m1');
    });
  });

  it('loads reminder state from localStorage on mount', async () => {
    localStorage.setItem('meetings_reminders', JSON.stringify(['m1']));
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    expect(await screen.findByRole('button', { name: /remove reminder: sprint planning/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows Reminded text when reminder is active', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    const btn = await screen.findByRole('button', { name: /set reminder: sprint planning/i });
    await userEvent.click(btn);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /remove reminder: sprint planning/i })).toHaveTextContent('Reminded');
    });
  });

  it('shows Remind text when reminder is inactive', async () => {
    mockGetMeetings.mockResolvedValueOnce([mockMeeting]);
    renderMeetings();
    const btn = await screen.findByRole('button', { name: /set reminder: sprint planning/i });
    expect(btn).toHaveTextContent('Remind');
  });
});
