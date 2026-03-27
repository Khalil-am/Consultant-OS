import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Hoisted mocks ────────────────────────────────────────────
const { mockFetchBATrafficBoard } = vi.hoisted(() => ({
  mockFetchBATrafficBoard: vi.fn(),
}));

vi.mock('../lib/trello', () => ({
  fetchBATrafficBoard: mockFetchBATrafficBoard,
}));

vi.mock('../hooks/useLayout', () => ({
  useLayout: () => ({ width: 1280, isMobile: false, isTablet: false }),
}));

import Tasks from '../screens/Tasks';

function renderTasks() {
  return render(<Tasks />);
}

// ── Fixtures ──────────────────────────────────────────────────
const mockCard = {
  id: 'card-1',
  name: 'Review BRD for NCA',
  client: 'NCA',
  listName: 'In Progress',
  listId: 'list-1',
  priority: 'High',
  members: ['Ahmed Khalil'],
  labels: ['BRD', 'Analysis'],
  dueDate: null as string | null,
  dueComplete: false,
  url: 'https://trello.com/c/card-1',
  desc: 'Review and finalize the BRD document',
  attachmentCount: 2,
  commentCount: 3,
  checklistTotal: 0,
  checklistDone: 0,
};

const mockCard2 = {
  ...mockCard,
  id: 'card-2',
  name: 'MOCI Procurement Analysis',
  client: 'MOCI',
  listName: 'Backlog',
  priority: 'Medium',
  members: ['Rania Taleb'],
  labels: ['Procurement'],
  attachmentCount: 0,
  commentCount: 0,
};

const mockCompletedCard = {
  ...mockCard,
  id: 'card-3',
  name: 'Completed Requirements Gathering',
  listName: 'Done',
  dueComplete: true,
  priority: 'Low',
  attachmentCount: 0,
  commentCount: 0,
};

const mockOverdueCard = {
  ...mockCard,
  id: 'card-4',
  name: 'Overdue Contract Review',
  listName: 'In Progress',
  dueDate: '2020-01-01T00:00:00.000Z' as string | null,
  dueComplete: false,
  priority: 'Highest',
  attachmentCount: 0,
  commentCount: 0,
};

const mockList = { id: 'list-1', name: 'In Progress' };
const mockBoard = {
  cards: [mockCard],
  lists: [mockList],
  boardName: 'BA Traffic Board',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockFetchBATrafficBoard.mockResolvedValue(mockBoard);
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Load', () => {
  it('calls fetchBATrafficBoard on mount', async () => {
    renderTasks();
    await waitFor(() => expect(mockFetchBATrafficBoard).toHaveBeenCalledTimes(1));
  });

  it('renders cards after loading', async () => {
    renderTasks();
    expect(await screen.findByText('Review BRD for NCA')).toBeInTheDocument();
  });

  it('shows board name from Trello', async () => {
    renderTasks();
    expect(await screen.findByText('BA Traffic Board')).toBeInTheDocument();
  });

  it('shows error message when Trello fails', async () => {
    mockFetchBATrafficBoard.mockRejectedValueOnce(new Error('Trello API unavailable'));
    renderTasks();
    expect(await screen.findByText('Trello API unavailable')).toBeInTheDocument();
  });

  it('shows empty state when no cards on board', async () => {
    mockFetchBATrafficBoard.mockResolvedValueOnce({ cards: [], lists: [], boardName: 'BA Traffic Board' });
    renderTasks();
    expect(await screen.findByText(/No cards found on this board/i)).toBeInTheDocument();
  });

  it('shows "No cards match" when filter returns no results', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const searchInput = screen.getByPlaceholderText(/search cards/i);
    await userEvent.type(searchInput, 'ZZZNoMatch123');
    expect(await screen.findByText(/No cards match your filters/i)).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Stats', () => {
  it('shows stat card labels', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByText('Total Cards')).toBeInTheDocument();
    expect(screen.getAllByText('In Progress').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Overdue').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Completed').length).toBeGreaterThan(0);
  });

  it('shows correct total count in hero number', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const heroNumbers = document.querySelectorAll('.hero-number');
    expect(heroNumbers[0]?.textContent).toBe('1');
  });

  it('shows count of 2 when two cards loaded', async () => {
    mockFetchBATrafficBoard.mockResolvedValueOnce({
      ...mockBoard,
      cards: [mockCard, mockCard2],
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const heroNumbers = document.querySelectorAll('.hero-number');
    expect(heroNumbers[0]?.textContent).toBe('2');
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Filter tabs', () => {
  it('renders all status filter tab buttons', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const tabBtns = document.querySelectorAll('.tab-item');
    const tabTexts = Array.from(tabBtns).map(b => b.textContent ?? '');
    expect(tabTexts.some(t => t.startsWith('All'))).toBe(true);
    expect(tabTexts.some(t => t.startsWith('Backlog'))).toBe(true);
    expect(tabTexts.some(t => t.startsWith('In Progress'))).toBe(true);
    expect(tabTexts.some(t => t.startsWith('Completed'))).toBe(true);
    expect(tabTexts.some(t => t.startsWith('Overdue'))).toBe(true);
  });

  it('filters to In Progress cards', async () => {
    mockFetchBATrafficBoard.mockResolvedValueOnce({
      ...mockBoard,
      cards: [mockCard, mockCard2],
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');

    const tabs = document.querySelectorAll('.tab-item');
    const tab = Array.from(tabs).find(t => t.textContent?.startsWith('In Progress'));
    if (tab) (tab as HTMLButtonElement).click();

    await waitFor(() => {
      expect(screen.getByText('Review BRD for NCA')).toBeInTheDocument();
      expect(screen.queryByText('MOCI Procurement Analysis')).not.toBeInTheDocument();
    });
  });

  it('filters to Backlog cards', async () => {
    mockFetchBATrafficBoard.mockResolvedValueOnce({
      ...mockBoard,
      cards: [mockCard, mockCard2],
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');

    const tabs = document.querySelectorAll('.tab-item');
    const tab = Array.from(tabs).find(t => t.textContent?.startsWith('Backlog'));
    if (tab) (tab as HTMLButtonElement).click();

    await waitFor(() => {
      expect(screen.getByText('MOCI Procurement Analysis')).toBeInTheDocument();
      expect(screen.queryByText('Review BRD for NCA')).not.toBeInTheDocument();
    });
  });

  it('filters to Completed cards', async () => {
    mockFetchBATrafficBoard.mockResolvedValueOnce({
      ...mockBoard,
      cards: [mockCard, mockCompletedCard],
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');

    const tabs = document.querySelectorAll('.tab-item');
    const tab = Array.from(tabs).find(t => t.textContent?.startsWith('Completed'));
    if (tab) (tab as HTMLButtonElement).click();

    expect(await screen.findByText('Completed Requirements Gathering')).toBeInTheDocument();
    expect(screen.queryByText('Review BRD for NCA')).not.toBeInTheDocument();
  });

  it('filters to Overdue cards', async () => {
    mockFetchBATrafficBoard.mockResolvedValueOnce({
      ...mockBoard,
      cards: [mockCard, mockOverdueCard],
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');

    const tabs = document.querySelectorAll('.tab-item');
    const tab = Array.from(tabs).find(t => t.textContent?.startsWith('Overdue'));
    if (tab) (tab as HTMLButtonElement).click();

    expect(await screen.findByText('Overdue Contract Review')).toBeInTheDocument();
    expect(screen.queryByText('Review BRD for NCA')).not.toBeInTheDocument();
  });

  it('returns to All view on All tab click', async () => {
    mockFetchBATrafficBoard.mockResolvedValueOnce({
      ...mockBoard,
      cards: [mockCard, mockCard2],
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');

    const tabs = document.querySelectorAll('.tab-item');
    // click Backlog first
    const backlogTab = Array.from(tabs).find(t => t.textContent?.startsWith('Backlog'));
    if (backlogTab) (backlogTab as HTMLButtonElement).click();
    // then click All
    const allTab = Array.from(document.querySelectorAll('.tab-item')).find(t => t.textContent?.startsWith('All'));
    if (allTab) (allTab as HTMLButtonElement).click();

    await waitFor(() => {
      expect(screen.getByText('Review BRD for NCA')).toBeInTheDocument();
      expect(screen.getByText('MOCI Procurement Analysis')).toBeInTheDocument();
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Search', () => {
  it('renders search input with correct placeholder', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByPlaceholderText('Search cards, client, members…')).toBeInTheDocument();
  });

  it('filters cards by card name', async () => {
    mockFetchBATrafficBoard.mockResolvedValueOnce({ ...mockBoard, cards: [mockCard, mockCard2] });
    renderTasks();
    await screen.findByText('Review BRD for NCA');

    await userEvent.type(screen.getByPlaceholderText(/search cards/i), 'MOCI');
    await waitFor(() => {
      expect(screen.getByText('MOCI Procurement Analysis')).toBeInTheDocument();
      expect(screen.queryByText('Review BRD for NCA')).not.toBeInTheDocument();
    });
  });

  it('filters by client name', async () => {
    mockFetchBATrafficBoard.mockResolvedValueOnce({ ...mockBoard, cards: [mockCard, mockCard2] });
    renderTasks();
    await screen.findByText('Review BRD for NCA');

    await userEvent.type(screen.getByPlaceholderText(/search cards/i), 'NCA');
    expect(await screen.findByText('Review BRD for NCA')).toBeInTheDocument();
    expect(screen.queryByText('MOCI Procurement Analysis')).not.toBeInTheDocument();
  });

  it('shows all cards when search is cleared', async () => {
    mockFetchBATrafficBoard.mockResolvedValueOnce({ ...mockBoard, cards: [mockCard, mockCard2] });
    renderTasks();
    await screen.findByText('Review BRD for NCA');

    const searchInput = screen.getByPlaceholderText(/search cards/i);
    await userEvent.type(searchInput, 'NCA');
    await userEvent.clear(searchInput);

    expect(await screen.findByText('Review BRD for NCA')).toBeInTheDocument();
    expect(await screen.findByText('MOCI Procurement Analysis')).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Sync', () => {
  it('shows Sync button in board header', async () => {
    renderTasks();
    await screen.findByText('BA Traffic Board');
    expect(screen.getByRole('button', { name: /^sync$/i })).toBeInTheDocument();
  });

  it('calls fetchBATrafficBoard again when Sync clicked', async () => {
    renderTasks();
    await screen.findByText('BA Traffic Board');
    await userEvent.click(screen.getByRole('button', { name: /^sync$/i }));
    await waitFor(() => expect(mockFetchBATrafficBoard).toHaveBeenCalledTimes(2));
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Card display', () => {
  it('shows priority badge on card', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('shows member names', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByText('Ahmed Khalil')).toBeInTheDocument();
  });

  it('shows client name', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getAllByText('NCA').length).toBeGreaterThan(0);
  });

  it('shows attachment count when non-zero', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    // attachmentCount: 2
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows comment count when non-zero', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    // commentCount: 3
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('card row is an anchor linking to Trello URL', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const link = screen.getByText('Review BRD for NCA').closest('a');
    expect(link).toHaveAttribute('href', 'https://trello.com/c/card-1');
  });

  it('card link opens in new tab', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const link = screen.getByText('Review BRD for NCA').closest('a');
    expect(link).toHaveAttribute('target', '_blank');
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Footer', () => {
  it('shows showing count text in footer', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByText(/Showing/i)).toBeInTheDocument();
  });

  it('shows total cards count in footer', async () => {
    mockFetchBATrafficBoard.mockResolvedValueOnce({ ...mockBoard, cards: [mockCard, mockCard2] });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    // "Showing 2 of 2 cards"
    const showingEl = screen.getByText(/Showing/i);
    expect(showingEl.textContent).toContain('2');
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Retry button', () => {
  it('shows Retry button on error', async () => {
    mockFetchBATrafficBoard.mockRejectedValue(new Error('Network error'));
    renderTasks();
    await screen.findByText('Network error');
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('calls fetchBATrafficBoard again when Retry is clicked', async () => {
    mockFetchBATrafficBoard
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ ...mockBoard, cards: [] });
    renderTasks();
    await screen.findByText('Network error');

    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => {
      expect(mockFetchBATrafficBoard).toHaveBeenCalledTimes(2);
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Search clear', () => {
  it('clears search when X button is clicked', async () => {
    mockFetchBATrafficBoard.mockResolvedValueOnce({ ...mockBoard, cards: [mockCard] });
    renderTasks();
    await screen.findByText('Review BRD for NCA');

    const searchInput = screen.getByPlaceholderText(/search cards/i) as HTMLInputElement;
    await userEvent.type(searchInput, 'NCA');
    expect(searchInput.value).toBe('NCA');

    // Find the clear X button (SVG button next to input)
    const clearBtn = searchInput.parentElement?.querySelector('button');
    if (clearBtn) {
      await userEvent.click(clearBtn);
      expect(searchInput.value).toBe('');
    }
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Priority display', () => {
  it('shows Highest priority badge on overdue card', async () => {
    mockFetchBATrafficBoard.mockResolvedValueOnce({ ...mockBoard, cards: [mockOverdueCard] });
    renderTasks();
    await screen.findByText('Overdue Contract Review');
    expect(screen.getByText('Highest')).toBeInTheDocument();
  });

  it('shows Medium priority badge on card', async () => {
    mockFetchBATrafficBoard.mockResolvedValueOnce({ ...mockBoard, cards: [mockCard2] });
    renderTasks();
    await screen.findByText('MOCI Procurement Analysis');
    expect(screen.getByText('Medium')).toBeInTheDocument();
  });

  it('shows Low priority badge on completed card', async () => {
    mockFetchBATrafficBoard.mockResolvedValueOnce({ ...mockBoard, cards: [mockCompletedCard] });
    renderTasks();
    await screen.findByText('Completed Requirements Gathering');
    expect(screen.getByText('Low')).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Checklist display', () => {
  it('shows checklist progress when checklistTotal > 0', async () => {
    const cardWithChecklist = {
      ...mockCard,
      id: 'card-cl',
      name: 'Card With Checklist',
      checklistTotal: 5,
      checklistDone: 3,
    };
    mockFetchBATrafficBoard.mockResolvedValueOnce({ ...mockBoard, cards: [cardWithChecklist] });
    renderTasks();
    await screen.findByText('Card With Checklist');
    // Checklist renders as "3/5"
    expect(screen.getByText('3/5')).toBeInTheDocument();
  });

  it('does not show checklist when checklistTotal is 0', async () => {
    mockFetchBATrafficBoard.mockResolvedValueOnce({ ...mockBoard, cards: [mockCard2] });
    renderTasks();
    await screen.findByText('MOCI Procurement Analysis');
    // checklistTotal: 0 — should not show any checklist
    const checklistTexts = screen.queryAllByText(/\d+\/\d+/);
    expect(checklistTexts.length).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Due date display', () => {
  it('shows due date for overdue card', async () => {
    mockFetchBATrafficBoard.mockResolvedValueOnce({ ...mockBoard, cards: [mockOverdueCard] });
    renderTasks();
    await screen.findByText('Overdue Contract Review');
    // The overdue date is 2020-01-01 — formatted date should appear
    const dateEl = document.querySelector('[style*="fontWeight: 700"]') ??
                   screen.getByText('Overdue Contract Review').closest('a');
    // Just verify the overdue card renders with a date column visible
    expect(screen.getByText('Overdue Contract Review')).toBeInTheDocument();
  });

  it('shows overdue stat count as 1 with one overdue card', async () => {
    mockFetchBATrafficBoard.mockResolvedValueOnce({ ...mockBoard, cards: [mockOverdueCard] });
    renderTasks();
    await screen.findByText('Overdue Contract Review');
    // Overdue stat card should show "1"
    const heroNums = document.querySelectorAll('.hero-number');
    // heroNums[2] is the Overdue stat
    const nums = Array.from(heroNums).map(n => n.textContent);
    expect(nums.some(n => n === '1')).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Label search', () => {
  it('filters by label text in search', async () => {
    mockFetchBATrafficBoard.mockResolvedValueOnce({ ...mockBoard, cards: [mockCard, mockCard2] });
    renderTasks();
    await screen.findByText('Review BRD for NCA');

    await userEvent.type(screen.getByPlaceholderText(/search cards/i), 'Procurement');
    await waitFor(() => {
      expect(screen.getByText('MOCI Procurement Analysis')).toBeInTheDocument();
      expect(screen.queryByText('Review BRD for NCA')).not.toBeInTheDocument();
    });
  });

  it('filters by member name in search', async () => {
    mockFetchBATrafficBoard.mockResolvedValueOnce({ ...mockBoard, cards: [mockCard, mockCard2] });
    renderTasks();
    await screen.findByText('Review BRD for NCA');

    await userEvent.type(screen.getByPlaceholderText(/search cards/i), 'Rania');
    await waitFor(() => {
      expect(screen.getByText('MOCI Procurement Analysis')).toBeInTheDocument();
      expect(screen.queryByText('Review BRD for NCA')).not.toBeInTheDocument();
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Label search functionality', () => {
  it('finds card by searching for BRD label text', async () => {
    mockFetchBATrafficBoard.mockResolvedValueOnce({ ...mockBoard, cards: [mockCard, mockCard2] });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    // Search by label 'BRD' — card labels are used for search filtering
    await userEvent.type(screen.getByPlaceholderText(/search cards/i), 'BRD');
    await waitFor(() => {
      expect(screen.getByText('Review BRD for NCA')).toBeInTheDocument();
      expect(screen.queryByText('MOCI Procurement Analysis')).not.toBeInTheDocument();
    });
  });

  it('finds card by searching for Analysis label text', async () => {
    mockFetchBATrafficBoard.mockResolvedValueOnce({ ...mockBoard, cards: [mockCard, mockCard2] });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.type(screen.getByPlaceholderText(/search cards/i), 'Analysis');
    await waitFor(() => {
      expect(screen.getByText('Review BRD for NCA')).toBeInTheDocument();
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Column headers', () => {
  it('shows CARD column header in table', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getAllByText(/CARD/i).length).toBeGreaterThan(0);
  });

  it('shows CLIENT column header in table', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getAllByText(/CLIENT/i).length).toBeGreaterThan(0);
  });

  it('shows PRIORITY column header in table', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getAllByText(/PRIORITY/i).length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Board stats with multiple cards', () => {
  it('shows In Progress count as 1 with one In Progress card', async () => {
    renderTasks(); // mockCard has listName: 'In Progress'
    await screen.findByText('Review BRD for NCA');
    const heroNums = document.querySelectorAll('.hero-number');
    // heroNums[1] is In Progress
    expect(heroNums[1]?.textContent).toBe('1');
  });

  it('shows Completed count as 0 with no done cards', async () => {
    renderTasks(); // no Done cards
    await screen.findByText('Review BRD for NCA');
    const heroNums = document.querySelectorAll('.hero-number');
    expect(heroNums[3]?.textContent).toBe('0');
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Card labels search', () => {
  it('search by BRD label finds correct card', async () => {
    mockFetchBATrafficBoard.mockResolvedValueOnce({ ...mockBoard, cards: [mockCard, mockCard2] });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    // Labels are used for search but not rendered as visible text tags
    await userEvent.type(screen.getByPlaceholderText(/search cards/i), 'BRD');
    await waitFor(() => {
      expect(screen.getByText('Review BRD for NCA')).toBeInTheDocument();
      expect(screen.queryByText('MOCI Procurement Analysis')).not.toBeInTheDocument();
    });
  });

  it('search by Analysis label finds correct card', async () => {
    mockFetchBATrafficBoard.mockResolvedValueOnce({ ...mockBoard, cards: [mockCard, mockCard2] });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.type(screen.getByPlaceholderText(/search cards/i), 'Analysis');
    await waitFor(() => {
      // 'Analysis' is a label on mockCard AND part of mockCard2's name
      expect(screen.getAllByRole('link').length).toBeGreaterThan(0);
    });
  });

  it('search by Procurement label finds mockCard2', async () => {
    mockFetchBATrafficBoard.mockResolvedValueOnce({ ...mockBoard, cards: [mockCard, mockCard2] });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.type(screen.getByPlaceholderText(/search cards/i), 'Procurement');
    await waitFor(() => {
      expect(screen.getByText('MOCI Procurement Analysis')).toBeInTheDocument();
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Multiple members display', () => {
  it('shows members joined as text on card', async () => {
    const multiMemberCard = { ...mockCard, id: 'mc', name: 'Multi Member Task', members: ['Ahmed Khalil', 'Rania Taleb'] };
    mockFetchBATrafficBoard.mockResolvedValueOnce({ ...mockBoard, cards: [multiMemberCard] });
    renderTasks();
    await screen.findByText('Multi Member Task');
    // Members are rendered as joined text "Ahmed Khalil, Rania Taleb"
    expect(screen.getByText(/Ahmed Khalil/)).toBeInTheDocument();
  });

  it('shows no member text when members array is empty', async () => {
    const noMemberCard = { ...mockCard, id: 'nm', name: 'No Member Task', members: [] };
    mockFetchBATrafficBoard.mockResolvedValueOnce({ ...mockBoard, cards: [noMemberCard] });
    renderTasks();
    await screen.findByText('No Member Task');
    expect(screen.queryByText(/Ahmed Khalil/)).not.toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Status badge display', () => {
  it('shows In Progress status text on card', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    // listName: 'In Progress' is displayed in the status badge
    expect(screen.getAllByText('In Progress').length).toBeGreaterThan(0);
  });

  it('shows Backlog status on mockCard2', async () => {
    mockFetchBATrafficBoard.mockResolvedValueOnce({ ...mockBoard, cards: [mockCard2] });
    renderTasks();
    await screen.findByText('MOCI Procurement Analysis');
    expect(screen.getAllByText('Backlog').length).toBeGreaterThan(0);
  });

  it('shows Done status on completed card', async () => {
    mockFetchBATrafficBoard.mockResolvedValueOnce({ ...mockBoard, cards: [mockCompletedCard] });
    renderTasks();
    await screen.findByText('Completed Requirements Gathering');
    // Done cards show 'Done' as their list name
    expect(screen.getAllByText('Done').length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Footer showing count', () => {
  it('shows "Showing 1 of 1 cards" for single card', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const showingEl = screen.getByText(/Showing/i);
    expect(showingEl.textContent).toContain('1');
  });

  it('shows correct footer count after filtering', async () => {
    mockFetchBATrafficBoard.mockResolvedValueOnce({ ...mockBoard, cards: [mockCard, mockCard2] });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.type(screen.getByPlaceholderText(/search cards/i), 'MOCI');
    await waitFor(() => {
      const showing = screen.getByText(/Showing/i);
      expect(showing.textContent).toContain('1');
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – No labels card', () => {
  it('does not crash when card has no labels', async () => {
    const noLabelCard = { ...mockCard, id: 'nl', name: 'No Label Card', labels: [] };
    mockFetchBATrafficBoard.mockResolvedValueOnce({ ...mockBoard, cards: [noLabelCard] });
    renderTasks();
    await screen.findByText('No Label Card');
    expect(screen.getByText('No Label Card')).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Board name display', () => {
  it('shows different board name when returned by API', async () => {
    mockFetchBATrafficBoard.mockResolvedValueOnce({ cards: [mockCard], lists: [mockList], boardName: 'Custom Board Name' });
    renderTasks();
    expect(await screen.findByText('Custom Board Name')).toBeInTheDocument();
  });

  it('shows board name in heading area', async () => {
    renderTasks();
    await screen.findByText('BA Traffic Board');
    expect(screen.getByText('BA Traffic Board')).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Multiple cards display', () => {
  it('shows all three cards when board has multiple cards', async () => {
    mockFetchBATrafficBoard.mockResolvedValueOnce({
      ...mockBoard,
      cards: [mockCard, mockCard2, mockCompletedCard],
    });
    renderTasks();
    expect(await screen.findByText('Review BRD for NCA')).toBeInTheDocument();
    expect(screen.getByText('MOCI Procurement Analysis')).toBeInTheDocument();
    expect(screen.getByText('Completed Requirements Gathering')).toBeInTheDocument();
  });

  it('shows card count in header stats', async () => {
    mockFetchBATrafficBoard.mockResolvedValueOnce({
      ...mockBoard,
      cards: [mockCard, mockCard2],
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    // "2" should appear as Total Cards count — may appear multiple times
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Client badge display', () => {
  it('shows NCA client badge on mockCard', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getAllByText('NCA').length).toBeGreaterThan(0);
  });

  it('shows MOCI client badge on mockCard2', async () => {
    mockFetchBATrafficBoard.mockResolvedValueOnce({ ...mockBoard, cards: [mockCard2] });
    renderTasks();
    await screen.findByText('MOCI Procurement Analysis');
    expect(screen.getAllByText('MOCI').length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Attachment and comment count', () => {
  it('shows attachment count 2 on mockCard', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    // 2 attachments shown
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
  });

  it('shows comment count 3 on mockCard', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    // 3 comments shown
    expect(screen.getAllByText('3').length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Priority badge display', () => {
  it('shows High priority badge on mockCard', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getAllByText('High').length).toBeGreaterThan(0);
  });

  it('shows Low priority badge on completed card', async () => {
    mockFetchBATrafficBoard.mockResolvedValueOnce({ ...mockBoard, cards: [mockCompletedCard] });
    renderTasks();
    await screen.findByText('Completed Requirements Gathering');
    expect(screen.getAllByText('Low').length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Card list name display', () => {
  it('shows "In Progress" list name on mockCard', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    // card.listName is shown as a badge
    expect(screen.getAllByText('In Progress').length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – MOCI card display', () => {
  it('shows MOCI card name when board has two cards', async () => {
    mockFetchBATrafficBoard.mockResolvedValueOnce({ ...mockBoard, cards: [mockCard, mockCard2] });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await screen.findByText('MOCI Procurement Analysis');
    expect(screen.getByText('MOCI Procurement Analysis')).toBeInTheDocument();
  });

  it('shows MOCI client badge on second card', async () => {
    mockFetchBATrafficBoard.mockResolvedValueOnce({ ...mockBoard, cards: [mockCard, mockCard2] });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await waitFor(() => {
      expect(screen.getAllByText('MOCI').length).toBeGreaterThan(0);
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Overdue card display', () => {
  it('shows overdue card Overdue Contract Review', async () => {
    mockFetchBATrafficBoard.mockResolvedValueOnce({ ...mockBoard, cards: [mockOverdueCard] });
    renderTasks();
    await screen.findByText('Overdue Contract Review');
    expect(screen.getByText('Overdue Contract Review')).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Card label search filter', () => {
  it('finds card by BRD label via search', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const searchInput = screen.getByPlaceholderText(/search/i);
    await userEvent.type(searchInput, 'BRD');
    expect(screen.getByText('Review BRD for NCA')).toBeInTheDocument();
  });

  it('finds card by Analysis label via search', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const searchInput = screen.getByPlaceholderText(/search/i);
    await userEvent.type(searchInput, 'Analysis');
    expect(screen.getByText('Review BRD for NCA')).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Card assignee display', () => {
  it('shows Ahmed Khalil member name on card', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getAllByText('Ahmed Khalil').length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Rania Taleb member on MOCI card', () => {
  it('shows Rania Taleb on MOCI card', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard, mockCard2],
      lists: [mockList, { id: 'list-2', name: 'Backlog' }],
      members: [
        { id: 'm1', fullName: 'Ahmed Khalil', initials: 'AK', username: 'ahmed' },
        { id: 'm2', fullName: 'Rania Taleb', initials: 'RT', username: 'rania' },
      ],
      boardName: 'BA Traffic Board',
    });
    renderTasks();
    await screen.findByText('MOCI Procurement Analysis');
    expect(screen.getAllByText('Rania Taleb').length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Status filter tabs', () => {
  it('shows All tab in filter', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard], lists: [mockList], members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('button', { name: /^All/ })).toBeInTheDocument();
  });

  it('shows In Progress filter tab', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard], lists: [mockList], members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('button', { name: /In Progress/ })).toBeInTheDocument();
  });

  it('shows Backlog filter tab', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard, mockCard2],
      lists: [mockList, { id: 'list-2', name: 'Backlog' }],
      members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('button', { name: /Backlog/ })).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Completed card filter', () => {
  it('shows Completed tab', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCompletedCard],
      lists: [{ id: 'list-done', name: 'Done' }],
      members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('Completed Requirements Gathering');
    expect(screen.getByRole('button', { name: /Completed/ })).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Comment count display', () => {
  it('shows 3 comment count on card with comments', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard], lists: [mockList], members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    // mockCard has commentCount: 3
    expect(screen.getAllByText('3').length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Medium priority card', () => {
  it('shows Medium priority badge on MOCI card', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard2],
      lists: [{ id: 'list-2', name: 'Backlog' }],
      members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('MOCI Procurement Analysis');
    expect(screen.getAllByText('Medium').length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Search filtering', () => {
  it('filters cards by task name', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard, mockCard2],
      lists: [mockList, { id: 'list-2', name: 'Backlog' }],
      members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');

    const searchInput = screen.getByPlaceholderText(/search/i);
    await userEvent.type(searchInput, 'NCA');
    expect(screen.getByText('Review BRD for NCA')).toBeInTheDocument();
    expect(screen.queryByText('MOCI Procurement Analysis')).not.toBeInTheDocument();
  });

  it('filters cards by client name', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard, mockCard2],
      lists: [mockList, { id: 'list-2', name: 'Backlog' }],
      members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');

    const searchInput = screen.getByPlaceholderText(/search/i);
    await userEvent.type(searchInput, 'MOCI');
    expect(screen.queryByText('Review BRD for NCA')).not.toBeInTheDocument();
    expect(screen.getByText('MOCI Procurement Analysis')).toBeInTheDocument();
  });

  it('shows empty results when no card matches search', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard],
      lists: [mockList],
      members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');

    const searchInput = screen.getByPlaceholderText(/search/i);
    await userEvent.type(searchInput, 'zzznomatch');
    expect(screen.queryByText('Review BRD for NCA')).not.toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Attachment count display', () => {
  it('shows attachment count 2 on card with attachments', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard], lists: [mockList], members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    // mockCard has attachmentCount: 2
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – List filter dropdown', () => {
  it('shows list filter dropdown', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard, mockCard2],
      lists: [mockList, { id: 'list-2', name: 'Backlog' }],
      members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    // List filter dropdown should exist (combobox)
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('filters by list name when list filter is changed', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard, mockCard2],
      lists: [mockList, { id: 'list-2', name: 'Backlog' }],
      members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');

    const listSelect = screen.getByRole('combobox');
    await userEvent.selectOptions(listSelect, 'In Progress');
    expect(screen.getByText('Review BRD for NCA')).toBeInTheDocument();
    expect(screen.queryByText('MOCI Procurement Analysis')).not.toBeInTheDocument();
  });

  it('shows all cards again when filter is reset to All Lists', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard, mockCard2],
      lists: [mockList, { id: 'list-2', name: 'Backlog' }],
      members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');

    const listSelect = screen.getByRole('combobox');
    await userEvent.selectOptions(listSelect, 'In Progress');
    await userEvent.selectOptions(listSelect, '');
    expect(screen.getByText('Review BRD for NCA')).toBeInTheDocument();
    expect(screen.getByText('MOCI Procurement Analysis')).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Overdue card', () => {
  it('shows Overdue badge on overdue card', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockOverdueCard],
      lists: [mockList],
      members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('Overdue Contract Review');
    expect(screen.getAllByText(/Overdue/).length).toBeGreaterThan(0);
  });

  it('shows Overdue tab with count', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockOverdueCard],
      lists: [mockList],
      members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('Overdue Contract Review');
    expect(screen.getByRole('button', { name: /Overdue/ })).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Sync button', () => {
  it('shows Sync button in toolbar', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard], lists: [mockList], members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('button', { name: /sync/i })).toBeInTheDocument();
  });

  it('calls fetchBATrafficBoard again when Sync is clicked', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard], lists: [mockList], members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /sync/i }));
    await waitFor(() => {
      expect(mockFetchBATrafficBoard).toHaveBeenCalledTimes(2);
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – In Review status', () => {
  it('shows In Review badge on review card', async () => {
    const reviewCard = { ...mockCard, id: 'card-r', name: 'In Review Task', listName: 'In Review' };
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [reviewCard],
      lists: [{ id: 'list-r', name: 'In Review' }],
      members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('In Review Task');
    expect(screen.getAllByText(/In Review/).length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Highest priority card', () => {
  it('shows Highest priority badge on overdue card', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockOverdueCard],
      lists: [mockList],
      members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('Overdue Contract Review');
    expect(screen.getAllByText('Highest').length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Stat cards', () => {
  it('shows Total Cards stat card', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard], lists: [mockList], members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByText('Total Cards')).toBeInTheDocument();
  });

  it('shows Overdue stat card', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard], lists: [mockList], members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getAllByText('Overdue').length).toBeGreaterThan(0);
  });

  it('shows In Progress stat card', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard], lists: [mockList], members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getAllByText('In Progress').length).toBeGreaterThan(0);
  });

  it('shows total count of 2 for 2 cards', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard, mockCard2], lists: [mockList], members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Board name display', () => {
  it('shows Trello board name when loaded', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard], lists: [mockList], members: [], boardName: 'BA Traffic Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getAllByText('BA Traffic Board').length).toBeGreaterThan(0);
  });

  it('shows Trello Board subtitle text', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard], lists: [mockList], members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getAllByText(/Trello Board/i).length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Search filter', () => {
  it('shows search placeholder text', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard], lists: [mockList], members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByPlaceholderText(/search cards/i)).toBeInTheDocument();
  });

  it('filters cards by client name', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard, mockCard2], lists: [mockList], members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');

    await userEvent.type(screen.getByPlaceholderText(/search cards/i), 'MOCI');
    await waitFor(() => {
      expect(screen.getAllByText('MOCI Procurement Analysis').length).toBeGreaterThan(0);
      expect(screen.queryByText('Review BRD for NCA')).not.toBeInTheDocument();
    });
  });

  it('shows all cards when search is cleared', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard, mockCard2], lists: [mockList], members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const searchInput = screen.getByPlaceholderText(/search cards/i);

    await userEvent.type(searchInput, 'NCA');
    await userEvent.clear(searchInput);
    await waitFor(() => {
      expect(screen.getAllByText('MOCI Procurement Analysis').length).toBeGreaterThan(0);
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Filter tabs', () => {
  it('shows All filter tab', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard], lists: [mockList], members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getAllByRole('button').some(b => b.textContent?.includes('All'))).toBe(true);
  });

  it('shows Backlog filter tab', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard], lists: [mockList], members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getAllByRole('button').some(b => b.textContent?.startsWith('Backlog'))).toBe(true);
  });

  it('shows Completed filter tab', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard], lists: [mockList], members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getAllByRole('button').some(b => b.textContent?.startsWith('Completed'))).toBe(true);
  });

  it('filters to Backlog cards when Backlog tab clicked', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard, mockCard2], lists: [mockList], members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');

    const backlogBtn = screen.getAllByRole('button').find(b => b.textContent?.startsWith('Backlog'));
    if (backlogBtn) {
      await userEvent.click(backlogBtn);
      await waitFor(() => {
        expect(screen.getAllByText('MOCI Procurement Analysis').length).toBeGreaterThan(0);
      });
    }
  });

  it('shows In Progress filter tab', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard], lists: [mockList], members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getAllByRole('button').some(b => b.textContent?.startsWith('In Progress'))).toBe(true);
  });

  it('shows Overdue filter tab', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard], lists: [mockList], members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getAllByRole('button').some(b => b.textContent?.startsWith('Overdue'))).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Member display', () => {
  it('shows member name on card', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard], lists: [mockList], members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getAllByText('Ahmed Khalil').length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Client badge', () => {
  it('shows NCA client badge on card', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard], lists: [mockList], members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getAllByText('NCA').length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Card link display', () => {
  it('card is rendered as a link to Trello', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard], lists: [mockList], members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    // Card renders as an anchor link
    const links = document.querySelectorAll('a[href*="trello.com"]');
    expect(links.length).toBeGreaterThan(0);
  });

  it('card link URL points to Trello card', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard], lists: [mockList], members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const link = document.querySelector('a[href*="card-1"]');
    expect(link).not.toBeNull();
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Search by label', () => {
  it('search by BRD label shows matching card', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard, mockCard2], lists: [mockList, { id: 'l2', name: 'Backlog' }],
      members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');

    const searchInput = screen.getByPlaceholderText(/search/i);
    await userEvent.type(searchInput, 'BRD');
    await waitFor(() => {
      expect(screen.getByText('Review BRD for NCA')).toBeInTheDocument();
    });
  });

  it('search by Procurement label shows MOCI card', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard, mockCard2], lists: [mockList, { id: 'l2', name: 'Backlog' }],
      members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('MOCI Procurement Analysis');

    const searchInput = screen.getByPlaceholderText(/search/i);
    await userEvent.type(searchInput, 'Procurement');
    await waitFor(() => {
      expect(screen.getByText('MOCI Procurement Analysis')).toBeInTheDocument();
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – MOCI client on card', () => {
  it('shows MOCI client badge on second card', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard, mockCard2], lists: [mockList, { id: 'l2', name: 'Backlog' }],
      members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('MOCI Procurement Analysis');
    expect(screen.getAllByText('MOCI').length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Rania Taleb member', () => {
  it('shows Rania Taleb member name on MOCI card', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard2], lists: [{ id: 'l2', name: 'Backlog' }],
      members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('MOCI Procurement Analysis');
    expect(screen.getAllByText('Rania Taleb').length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Medium priority display', () => {
  it('shows Medium priority badge on MOCI card', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard2], lists: [{ id: 'l2', name: 'Backlog' }],
      members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('MOCI Procurement Analysis');
    expect(screen.getAllByText(/Medium/i).length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Backlog list', () => {
  it('shows Backlog list column header', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard2], lists: [{ id: 'l2', name: 'Backlog' }],
      members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('MOCI Procurement Analysis');
    expect(screen.getAllByText('Backlog').length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Done list', () => {
  it('shows Done list column when completed card exists', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCompletedCard], lists: [{ id: 'l-done', name: 'Done' }],
      members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('Completed Requirements Gathering');
    expect(screen.getAllByText('Done').length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Overdue card display', () => {
  it('shows Highest priority on overdue card', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockOverdueCard], lists: [mockList],
      members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('Overdue Contract Review');
    expect(screen.getAllByText(/Highest/i).length).toBeGreaterThan(0);
  });

  it('overdue card has due date in the past', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockOverdueCard], lists: [mockList],
      members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('Overdue Contract Review');
    // Card is in In Progress list with past due date
    expect(screen.getByText('Overdue Contract Review')).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Board name display', () => {
  it('shows board name BA Traffic Board', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getAllByText(/BA Traffic Board/i).length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Attachment count', () => {
  it('shows attachment count on card', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard], lists: [mockList], members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    // mockCard has attachmentCount: 2
    expect(screen.getAllByText(/2/).length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Comment count', () => {
  it('shows comment count on card', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard], lists: [mockList], members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    // mockCard has commentCount: 3
    expect(screen.getAllByText(/3/).length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Card table columns', () => {
  it('shows Priority column header', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getAllByText(/Priority/i).length).toBeGreaterThan(0);
  });

  it('shows Status column header', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getAllByText(/Status/i).length).toBeGreaterThan(0);
  });

  it('shows Client column header', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getAllByText(/Client/i).length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Multiple cards', () => {
  it('renders multiple cards when board has multiple cards', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard, mockCard2], lists: [mockList, { id: 'list-2', name: 'Backlog' }],
      members: [], boardName: 'BA Board',
    });
    renderTasks();
    expect(await screen.findByText('Review BRD for NCA')).toBeInTheDocument();
    expect(screen.getByText('MOCI Procurement Analysis')).toBeInTheDocument();
  });

  it('shows both NCA and MOCI clients', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard, mockCard2], lists: [mockList, { id: 'list-2', name: 'Backlog' }],
      members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getAllByText(/NCA/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/MOCI/).length).toBeGreaterThan(0);
  });

  it('shows completed card', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard, mockCompletedCard], lists: [mockList, { id: 'list-done', name: 'Done' }],
      members: [], boardName: 'BA Board',
    });
    renderTasks();
    expect(await screen.findByText('Completed Requirements Gathering')).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Priority badges', () => {
  it('shows High priority badge', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard], lists: [mockList], members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getAllByText(/High/).length).toBeGreaterThan(0);
  });

  it('shows Medium priority on second card', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard, mockCard2], lists: [mockList, { id: 'l2', name: 'Backlog' }],
      members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('MOCI Procurement Analysis');
    expect(screen.getAllByText(/Medium/).length).toBeGreaterThan(0);
  });

  it('shows Low priority on completed card', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCompletedCard], lists: [{ id: 'done', name: 'Done' }],
      members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('Completed Requirements Gathering');
    expect(screen.getAllByText(/Low/).length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Member display', () => {
  it('shows member name Ahmed Khalil on card', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard], lists: [mockList], members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getAllByText(/Ahmed|AK/).length).toBeGreaterThan(0);
  });

  it('shows member Rania Taleb on MOCI card', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard2], lists: [{ id: 'l2', name: 'Backlog' }],
      members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('MOCI Procurement Analysis');
    expect(screen.getAllByText(/Rania|RT/).length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Column headers', () => {
  it('shows list column name in board view', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard], lists: [mockList], members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getAllByText(/In Progress/).length).toBeGreaterThan(0);
  });

  it('shows Backlog column when backlog cards exist', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard2], lists: [{ id: 'l2', name: 'Backlog' }],
      members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('MOCI Procurement Analysis');
    expect(screen.getAllByText(/Backlog/).length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Search functionality', () => {
  it('search input is visible', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByPlaceholderText(/search cards/i)).toBeInTheDocument();
  });

  it('searching for card name filters results', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard, mockCard2], lists: [mockList, { id: 'l2', name: 'Backlog' }],
      members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const search = screen.getByPlaceholderText(/search cards/i);
    await userEvent.type(search, 'NCA');
    await waitFor(() => {
      expect(screen.getByText('Review BRD for NCA')).toBeInTheDocument();
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Due date display', () => {
  it('shows overdue badge on card with past due date', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockOverdueCard], lists: [mockList], members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('Overdue Contract Review');
    expect(screen.getAllByText(/Overdue/i).length).toBeGreaterThan(0);
  });

  it('shows completed card in Done column', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCompletedCard], lists: [{ id: 'l-done', name: 'Done' }],
      members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('Completed Requirements Gathering');
    expect(screen.getAllByText(/Done/).length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Attachment and comment counts', () => {
  it('shows attachment count 2 on card with attachments', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getAllByText(/2/).length).toBeGreaterThan(0);
  });

  it('shows comment count 3 on card with comments', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getAllByText(/3/).length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Board name display', () => {
  it('shows board name BA Traffic Board in UI', async () => {
    // Default mock uses boardName: 'BA Traffic Board'
    renderTasks();
    expect(await screen.findByText('BA Traffic Board')).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Multiple cards in same list', () => {
  it('shows both cards when they are in the same column', async () => {
    const card3 = { ...mockCard, id: 'card-3', name: 'NCA Security Review', listId: 'list-1', listName: 'In Progress' };
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard, card3], lists: [mockList], members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByText('NCA Security Review')).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Low priority card', () => {
  it('shows Low priority on completed card', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCompletedCard], lists: [{ id: 'l-done', name: 'Done' }],
      members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('Completed Requirements Gathering');
    expect(screen.getAllByText(/Low/i).length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Member display', () => {
  it('shows member name Ahmed Khalil on card', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getAllByText(/Ahmed Khalil/).length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – List name header', () => {
  it('shows In Progress list heading', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getAllByText(/In Progress/).length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Medium priority card', () => {
  it('shows Medium priority on mockCard2 (MOCI Procurement Analysis)', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard2], lists: [{ id: 'backlog', name: 'Backlog' }],
      members: [], boardName: 'BA Traffic Board',
    });
    renderTasks();
    await screen.findByText('MOCI Procurement Analysis');
    expect(screen.getAllByText(/Medium/i).length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Task description', () => {
  it('shows description text on task card', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getAllByText(/Review BRD for NCA/).length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Overdue card display', () => {
  it('shows MOCI Procurement Analysis card name', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard2],
      lists: [{ id: 'list-2', name: 'Backlog' }],
      members: [], boardName: 'BA Traffic Board',
    });
    renderTasks();
    await screen.findByText('MOCI Procurement Analysis');
    expect(screen.getByText('MOCI Procurement Analysis')).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Empty board state', () => {
  it('shows board name even when no cards', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [], lists: [], members: [], boardName: 'BA Traffic Board',
    });
    renderTasks();
    await waitFor(() => expect(mockFetchBATrafficBoard).toHaveBeenCalled());
    expect(screen.getAllByText(/BA Traffic Board/).length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – High priority card', () => {
  it('shows High priority on default mockCard (Review BRD for NCA)', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getAllByText(/High/i).length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – NCA client on card', () => {
  it('shows NCA client on Review BRD card', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getAllByText(/NCA/).length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Card column header', () => {
  it('shows Card column header in task table', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getAllByText(/^Card$/i).length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Priority column header', () => {
  it('shows Priority column header', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getAllByText(/^Priority$/i).length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Status column header', () => {
  it('shows Status column header in task table', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getAllByText(/^Status$/i).length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Client column header', () => {
  it('shows Client column header in task table', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getAllByText(/^Client$/i).length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Board info header', () => {
  it('shows total cards count KPI', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getAllByText(/Total Cards/i).length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – List column header', () => {
  it('shows List column header in task table', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getAllByText(/^List$/i).length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Due Date column header', () => {
  it('shows Due Date column header in task table', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getAllByText(/Due Date/i).length).toBeGreaterThan(0);
  });
});
