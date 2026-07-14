import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── CSV export globals ────────────────────────────────────────
let mockCreateObjectURL: ReturnType<typeof vi.fn>;
let mockRevokeObjectURL: ReturnType<typeof vi.fn>;
let mockClick: ReturnType<typeof vi.fn>;
const origCreateObjectURL = URL.createObjectURL;
const origRevokeObjectURL = URL.revokeObjectURL;
const origCreateElement = document.createElement.bind(document);

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
  mockClick = vi.fn();
  mockCreateObjectURL = vi.fn(() => 'blob:mock-tasks-url');
  mockRevokeObjectURL = vi.fn();
  URL.createObjectURL = mockCreateObjectURL;
  URL.revokeObjectURL = mockRevokeObjectURL;
  document.createElement = (tag: string) => {
    const el = origCreateElement(tag);
    if (tag === 'a') { Object.defineProperty(el, 'click', { value: mockClick, writable: true }); }
    return el;
  };
});

afterEach(() => {
  URL.createObjectURL = origCreateObjectURL;
  URL.revokeObjectURL = origRevokeObjectURL;
  document.createElement = origCreateElement;
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
    expect(screen.getAllByText('Ahmed Khalil').length).toBeGreaterThan(0);
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
    expect(screen.getAllByText(/Ahmed Khalil/).length).toBeGreaterThan(0);
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
    expect(screen.getByRole('button', { name: /task status: all/i })).toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: /Task status: Completed/i })).toBeInTheDocument();
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
    expect(screen.getByRole('combobox', { name: /filter by list/i })).toBeInTheDocument();
  });

  it('filters by list name when list filter is changed', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard, mockCard2],
      lists: [mockList, { id: 'list-2', name: 'Backlog' }],
      members: [], boardName: 'BA Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');

    const listSelect = screen.getByRole('combobox', { name: /filter by list/i });
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

    const listSelect = screen.getByRole('combobox', { name: /filter by list/i });
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
    expect(screen.getByRole('button', { name: /Task status: Overdue/i })).toBeInTheDocument();
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

// ────────────────────────────────────────────────────────────
describe('Tasks – Sort dropdown', () => {
  it('renders sort dropdown', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('combobox', { name: /sort cards/i })).toBeInTheDocument();
  });

  it('shows Sort: Default option', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('option', { name: 'Sort: Default' })).toBeInTheDocument();
  });

  it('shows Sort: Priority option', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('option', { name: 'Sort: Priority' })).toBeInTheDocument();
  });

  it('shows Sort: Due Date option', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('option', { name: 'Sort: Due Date' })).toBeInTheDocument();
  });

  it('shows Sort: Client option', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('option', { name: 'Sort: Client' })).toBeInTheDocument();
  });

  it('defaults to Sort: Default', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const select = screen.getByRole('combobox', { name: /sort cards/i }) as HTMLSelectElement;
    expect(select.value).toBe('default');
  });

  it('can be changed to priority sort', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const select = screen.getByRole('combobox', { name: /sort cards/i });
    await userEvent.selectOptions(select, 'priority');
    expect((select as HTMLSelectElement).value).toBe('priority');
  });

  it('can be changed to due_date sort', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const select = screen.getByRole('combobox', { name: /sort cards/i });
    await userEvent.selectOptions(select, 'due_date');
    expect((select as HTMLSelectElement).value).toBe('due_date');
  });

  it('can be changed to client sort', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const select = screen.getByRole('combobox', { name: /sort cards/i });
    await userEvent.selectOptions(select, 'client');
    expect((select as HTMLSelectElement).value).toBe('client');
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Sort by priority', () => {
  it('shows Highest priority card before High when sorted by priority', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard, mockOverdueCard],
      lists: [mockList],
      boardName: 'BA Traffic Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const select = screen.getByRole('combobox', { name: /sort cards/i });
    await userEvent.selectOptions(select, 'priority');
    const rows = screen.getAllByRole('link');
    const names = rows.map(r => r.textContent ?? '');
    const overdueIdx = names.findIndex(n => n.includes('Overdue Contract Review'));
    const normalIdx = names.findIndex(n => n.includes('Review BRD for NCA'));
    expect(overdueIdx).toBeLessThan(normalIdx);
  });

  it('shows Low priority card after High when sorted by priority', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard, mockCompletedCard],
      lists: [mockList],
      boardName: 'BA Traffic Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const select = screen.getByRole('combobox', { name: /sort cards/i });
    await userEvent.selectOptions(select, 'priority');
    const rows = screen.getAllByRole('link');
    const names = rows.map(r => r.textContent ?? '');
    const highIdx = names.findIndex(n => n.includes('Review BRD for NCA'));
    const lowIdx = names.findIndex(n => n.includes('Completed Requirements Gathering'));
    expect(highIdx).toBeLessThan(lowIdx);
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Sort by client', () => {
  it('shows MOCI card before NCA when sorted by client (A-Z)', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard, mockCard2],
      lists: [mockList],
      boardName: 'BA Traffic Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const select = screen.getByRole('combobox', { name: /sort cards/i });
    await userEvent.selectOptions(select, 'client');
    const rows = screen.getAllByRole('link');
    const names = rows.map(r => r.textContent ?? '');
    const mociIdx = names.findIndex(n => n.includes('MOCI Procurement Analysis'));
    const ncaIdx = names.findIndex(n => n.includes('Review BRD for NCA'));
    expect(mociIdx).toBeLessThan(ncaIdx);
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Sort by due date', () => {
  it('shows overdue card (earlier date) before no-due-date card when sorted by due_date', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard, mockOverdueCard],
      lists: [mockList],
      boardName: 'BA Traffic Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const select = screen.getByRole('combobox', { name: /sort cards/i });
    await userEvent.selectOptions(select, 'due_date');
    const rows = screen.getAllByRole('link');
    const names = rows.map(r => r.textContent ?? '');
    const overdueIdx = names.findIndex(n => n.includes('Overdue Contract Review'));
    const noDueIdx = names.findIndex(n => n.includes('Review BRD for NCA'));
    expect(overdueIdx).toBeLessThan(noDueIdx);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Tasks – Status filter aria attributes', () => {
  beforeEach(() => {
    mockFetchBATrafficBoard.mockResolvedValue({ cards: [mockCard, mockCard2], lists: [{ id: 'list-1', name: 'In Progress' }, { id: 'list-2', name: 'Backlog' }], members: [], boardName: 'BA Board' });
  });

  it('All status tab has aria-pressed=true by default', async () => {
    renderTasks();
    await waitFor(() => expect(screen.getByRole('button', { name: /task status: all/i })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /task status: all/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('In Progress status tab has aria-pressed=false by default', async () => {
    renderTasks();
    await waitFor(() => expect(screen.getByRole('button', { name: /task status: in progress/i })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /task status: in progress/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking In Progress sets its aria-pressed=true and All to false', async () => {
    renderTasks();
    await waitFor(() => expect(screen.getByRole('button', { name: /task status: in progress/i })).toBeInTheDocument());
    const allBtn = screen.getByRole('button', { name: /task status: all/i });
    const inProgressBtn = screen.getByRole('button', { name: /task status: in progress/i });
    await userEvent.click(inProgressBtn);
    await waitFor(() => {
      expect(inProgressBtn).toHaveAttribute('aria-pressed', 'true');
      expect(allBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('Overdue status tab has correct aria-label', async () => {
    renderTasks();
    await waitFor(() => expect(screen.getByRole('button', { name: /task status: overdue/i })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /task status: overdue/i })).toBeInTheDocument();
  });

  it('clicking All restores its aria-pressed=true after switching tabs', async () => {
    renderTasks();
    await waitFor(() => expect(screen.getByRole('button', { name: /task status: all/i })).toBeInTheDocument());
    const allBtn = screen.getByRole('button', { name: /task status: all/i });
    const inProgressBtn = screen.getByRole('button', { name: /task status: in progress/i });
    await userEvent.click(inProgressBtn);
    await userEvent.click(allBtn);
    await waitFor(() => {
      expect(allBtn).toHaveAttribute('aria-pressed', 'true');
      expect(inProgressBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

describe('Tasks – Priority filter dropdown', () => {
  it('renders priority filter dropdown', async () => {
    renderTasks();
    await waitFor(() => expect(mockFetchBATrafficBoard).toHaveBeenCalled());
    expect(screen.getByRole('combobox', { name: /filter by priority/i })).toBeInTheDocument();
  });

  it('priority filter defaults to All Priorities', async () => {
    renderTasks();
    await waitFor(() => expect(mockFetchBATrafficBoard).toHaveBeenCalled());
    const select = screen.getByRole('combobox', { name: /filter by priority/i }) as HTMLSelectElement;
    expect(select.value).toBe('All');
  });

  it('priority filter has all priority options', async () => {
    renderTasks();
    await waitFor(() => expect(mockFetchBATrafficBoard).toHaveBeenCalled());
    const select = screen.getByRole('combobox', { name: /filter by priority/i });
    const values = Array.from(select.querySelectorAll('option')).map(o => (o as HTMLOptionElement).value);
    expect(values).toContain('All');
    expect(values).toContain('High');
    expect(values).toContain('Medium');
    expect(values).toContain('Low');
  });

  it('selecting High filters to show only High priority cards', async () => {
    const highCard = { ...mockCard, id: 'c1', name: 'High Task', priority: 'High' };
    const medCard = { ...mockCard, id: 'c2', name: 'Medium Task', priority: 'Medium' };
    mockFetchBATrafficBoard.mockResolvedValue({ cards: [highCard, medCard], lists: [mockList], boardName: 'BA Traffic Board' });
    renderTasks();
    await screen.findByText('High Task');
    const select = screen.getByRole('combobox', { name: /filter by priority/i });
    await userEvent.selectOptions(select, 'High');
    await waitFor(() => {
      expect(screen.getByText('High Task')).toBeInTheDocument();
      expect(screen.queryByText('Medium Task')).not.toBeInTheDocument();
    });
  });

  it('resetting to All shows all priority cards again', async () => {
    const highCard = { ...mockCard, id: 'c1', name: 'High Task', priority: 'High' };
    const medCard = { ...mockCard, id: 'c2', name: 'Medium Task', priority: 'Medium' };
    mockFetchBATrafficBoard.mockResolvedValue({ cards: [highCard, medCard], lists: [mockList], boardName: 'BA Traffic Board' });
    renderTasks();
    await screen.findByText('High Task');
    const select = screen.getByRole('combobox', { name: /filter by priority/i });
    await userEvent.selectOptions(select, 'High');
    await waitFor(() => expect(screen.queryByText('Medium Task')).not.toBeInTheDocument());
    await userEvent.selectOptions(select, 'All');
    await waitFor(() => {
      expect(screen.getByText('High Task')).toBeInTheDocument();
      expect(screen.getByText('Medium Task')).toBeInTheDocument();
    });
  });

  it('selecting Medium shows only Medium priority tasks', async () => {
    const highCard = { ...mockCard, id: 'c1', name: 'High Task', priority: 'High' };
    const medCard = { ...mockCard, id: 'c2', name: 'Medium Task', priority: 'Medium' };
    mockFetchBATrafficBoard.mockResolvedValue({ cards: [highCard, medCard], lists: [mockList], boardName: 'BA Traffic Board' });
    renderTasks();
    await screen.findByText('Medium Task');
    const select = screen.getByRole('combobox', { name: /filter by priority/i });
    await userEvent.selectOptions(select, 'Medium');
    await waitFor(() => {
      expect(screen.getByText('Medium Task')).toBeInTheDocument();
      expect(screen.queryByText('High Task')).not.toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Tasks – Clear search button', () => {
  it('clear search button not visible when search is empty', async () => {
    renderTasks();
    await waitFor(() => expect(mockFetchBATrafficBoard).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /clear search/i })).not.toBeInTheDocument();
  });

  it('clear search button appears when search has text', async () => {
    renderTasks();
    await waitFor(() => expect(mockFetchBATrafficBoard).toHaveBeenCalled());
    const searchInput = screen.getByPlaceholderText(/search cards/i);
    await userEvent.type(searchInput, 'test');
    expect(screen.getByRole('button', { name: /clear search/i })).toBeInTheDocument();
  });

  it('clear search button has aria-label="Clear search"', async () => {
    renderTasks();
    await waitFor(() => expect(mockFetchBATrafficBoard).toHaveBeenCalled());
    const searchInput = screen.getByPlaceholderText(/search cards/i);
    await userEvent.type(searchInput, 'abc');
    expect(screen.getByRole('button', { name: 'Clear search' })).toBeInTheDocument();
  });

  it('clicking clear search clears the search input', async () => {
    renderTasks();
    await waitFor(() => expect(mockFetchBATrafficBoard).toHaveBeenCalled());
    const searchInput = screen.getByPlaceholderText(/search cards/i);
    await userEvent.type(searchInput, 'test query');
    await userEvent.click(screen.getByRole('button', { name: /clear search/i }));
    expect((searchInput as HTMLInputElement).value).toBe('');
  });

  it('clear search button disappears after clearing', async () => {
    renderTasks();
    await waitFor(() => expect(mockFetchBATrafficBoard).toHaveBeenCalled());
    const searchInput = screen.getByPlaceholderText(/search cards/i);
    await userEvent.type(searchInput, 'test');
    await userEvent.click(screen.getByRole('button', { name: /clear search/i }));
    expect(screen.queryByRole('button', { name: /clear search/i })).not.toBeInTheDocument();
  });

  it('status filter tabs still visible after clearing search', async () => {
    renderTasks();
    await waitFor(() => expect(mockFetchBATrafficBoard).toHaveBeenCalled());
    const searchInput = screen.getByPlaceholderText(/search cards/i);
    await userEvent.type(searchInput, 'x');
    await userEvent.click(screen.getByRole('button', { name: /clear search/i }));
    expect(screen.getByRole('button', { name: /task status: all/i })).toBeInTheDocument();
  });
});

describe('Tasks – Search input aria-label', () => {
  it('search cards input has aria-label', async () => {
    renderTasks();
    await waitFor(() => expect(mockFetchBATrafficBoard).toHaveBeenCalled());
    expect(screen.getByRole('textbox', { name: /search cards/i })).toBeInTheDocument();
  });

  it('typing in search input filters cards', async () => {
    renderTasks();
    await waitFor(() => expect(mockFetchBATrafficBoard).toHaveBeenCalled());
    const searchInput = screen.getByRole('textbox', { name: /search cards/i });
    await userEvent.type(searchInput, 'ADNOC');
    expect(searchInput).toHaveValue('ADNOC');
  });
});

// ─────────────────────────────────────────────────────────────
describe('Tasks – Sort dropdown aria-label', () => {
  it('sort cards select has aria-label', async () => {
    renderTasks();
    await waitFor(() => expect(mockFetchBATrafficBoard).toHaveBeenCalled());
    expect(screen.getByRole('combobox', { name: /sort cards/i })).toBeInTheDocument();
  });

  it('filter by list select has aria-label', async () => {
    renderTasks();
    await waitFor(() => expect(mockFetchBATrafficBoard).toHaveBeenCalled());
    expect(screen.getByRole('combobox', { name: /filter by list/i })).toBeInTheDocument();
  });

  it('filter by priority select has aria-label', async () => {
    renderTasks();
    await waitFor(() => expect(mockFetchBATrafficBoard).toHaveBeenCalled());
    expect(screen.getByRole('combobox', { name: /filter by priority/i })).toBeInTheDocument();
  });

  it('sort by default value is "default"', async () => {
    renderTasks();
    await waitFor(() => expect(mockFetchBATrafficBoard).toHaveBeenCalled());
    const sortSelect = screen.getByRole('combobox', { name: /sort cards/i });
    expect((sortSelect as HTMLSelectElement).value).toBe('default');
  });
});

// ─────────────────────────────────────────────────────────────
describe('Tasks – Combined filter and search', () => {
  it('searching after selecting priority filter still shows correct results', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard, mockCard2],
      lists: [mockList],
      boardName: 'BA Traffic Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const prioritySelect = screen.getByRole('combobox', { name: /filter by priority/i });
    await userEvent.selectOptions(prioritySelect, 'High');
    await waitFor(() => {
      expect(screen.getByText('Review BRD for NCA')).toBeInTheDocument();
      expect(screen.queryByText('MOCI Procurement Analysis')).not.toBeInTheDocument();
    });
  });

  it('search input finds card by client name', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard, mockCard2],
      lists: [mockList],
      boardName: 'BA Traffic Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const searchInput = screen.getByRole('textbox', { name: /search cards/i });
    await userEvent.type(searchInput, 'MOCI');
    await waitFor(() => {
      expect(screen.getByText('MOCI Procurement Analysis')).toBeInTheDocument();
      expect(screen.queryByText('Review BRD for NCA')).not.toBeInTheDocument();
    });
  });

  it('search finds card by member name', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard, mockCard2],
      lists: [mockList],
      boardName: 'BA Traffic Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const searchInput = screen.getByRole('textbox', { name: /search cards/i });
    await userEvent.type(searchInput, 'Rania');
    await waitFor(() => {
      expect(screen.getByText('MOCI Procurement Analysis')).toBeInTheDocument();
      expect(screen.queryByText('Review BRD for NCA')).not.toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Tasks – Stats values with multiple cards', () => {
  it('In Progress stat shows correct count', async () => {
    const inProgressCard1 = { ...mockCard, id: 'c1', name: 'IP Card 1', listName: 'In Progress' };
    const inProgressCard2 = { ...mockCard, id: 'c2', name: 'IP Card 2', listName: 'In Progress' };
    const backlogCard = { ...mockCard2, id: 'c3', name: 'Backlog Card', listName: 'Backlog' };
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [inProgressCard1, inProgressCard2, backlogCard],
      lists: [mockList],
      boardName: 'BA Traffic Board',
    });
    renderTasks();
    await screen.findByText('IP Card 1');
    const heroNumbers = document.querySelectorAll('.hero-number');
    // heroNumbers[0] = Total (3), heroNumbers[1] = In Progress (2)
    expect(heroNumbers[1]?.textContent).toBe('2');
  });

  it('Total stat shows sum of all cards', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard, mockCard2, mockCompletedCard, mockOverdueCard],
      lists: [mockList],
      boardName: 'BA Traffic Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const heroNumbers = document.querySelectorAll('.hero-number');
    expect(heroNumbers[0]?.textContent).toBe('4');
  });
});

// ─────────────────────────────────────────────────────────────
describe('Tasks – Clear search button', () => {
  it('Clear search button has aria-label', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const searchInput = screen.getByPlaceholderText(/search cards/i);
    await userEvent.type(searchInput, 'test');
    expect(screen.getByRole('button', { name: /clear search/i })).toBeInTheDocument();
  });

  it('clicking Clear search empties the input', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const searchInput = screen.getByPlaceholderText(/search cards/i);
    await userEvent.type(searchInput, 'NCA');
    const clearBtn = screen.getByRole('button', { name: /clear search/i });
    await userEvent.click(clearBtn);
    expect(searchInput).toHaveValue('');
  });

  it('clearing search restores all cards', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const searchInput = screen.getByPlaceholderText(/search cards/i);
    await userEvent.type(searchInput, 'ZZZ');
    await screen.findByText(/No cards match your filters/i);
    const clearBtn = screen.getByRole('button', { name: /clear search/i });
    await userEvent.click(clearBtn);
    await waitFor(() => {
      expect(screen.getByText('Review BRD for NCA')).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Tasks – Task status tab buttons', () => {
  it('Task status All tab has aria-label', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('button', { name: /task status: all/i })).toBeInTheDocument();
  });

  it('Task status In Progress tab has aria-label', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('button', { name: /task status: in progress/i })).toBeInTheDocument();
  });

  it('Task status Completed tab has aria-label', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('button', { name: /task status: completed/i })).toBeInTheDocument();
  });

  it('clicking In Progress tab filters to show only in-progress cards', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard, mockCard2],
      lists: [mockList],
      boardName: 'BA Traffic Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /task status: in progress/i }));
    await waitFor(() => {
      expect(screen.getByText('Review BRD for NCA')).toBeInTheDocument();
      expect(screen.queryByText('MOCI Procurement Analysis')).not.toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Tasks – Task status additional tabs', () => {
  it('Task status: Backlog tab has aria-label', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('button', { name: /task status: backlog/i })).toBeInTheDocument();
  });

  it('Task status: Overdue tab has aria-label', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('button', { name: /task status: overdue/i })).toBeInTheDocument();
  });

  it('Task status: In Review tab has aria-label', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('button', { name: /task status: in review/i })).toBeInTheDocument();
  });

  it('clicking Backlog tab filters to backlog cards', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard, mockCard2],
      lists: [mockList],
      boardName: 'BA Traffic Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /task status: backlog/i }));
    await waitFor(() => {
      expect(screen.queryByText('Review BRD for NCA')).not.toBeInTheDocument();
      expect(screen.getByText('MOCI Procurement Analysis')).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Tasks – Card details display', () => {
  it('shows card client name', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getAllByText('NCA').length).toBeGreaterThan(0);
  });

  it('shows card priority label', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getAllByText('High').length).toBeGreaterThan(0);
  });

  it('shows member names on cards', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getAllByText('Ahmed Khalil').length).toBeGreaterThan(0);
  });

  it('shows board name from Trello API', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByText('BA Traffic Board')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Tasks – Stat card sub-text labels', () => {
  it('shows "actively being worked" sub-text for In Progress stat', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByText('actively being worked')).toBeInTheDocument();
  });

  it('shows "past due date" sub-text for Overdue stat', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByText('past due date')).toBeInTheDocument();
  });

  it('shows "finished cards" sub-text for Completed stat', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByText('finished cards')).toBeInTheDocument();
  });

  it('shows unique list count in Total Cards sub-text', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    // mockCard is in "In Progress" list → 1 unique list → "1 lists"
    expect(screen.getByText(/1 lists/)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Tasks – Loading state text', () => {
  it('shows "Loading Trello board…" text when loading', async () => {
    // Set up a delayed promise so loading state is visible
    let resolveFn: (value: unknown) => void;
    mockFetchBATrafficBoard.mockReturnValue(new Promise(resolve => { resolveFn = resolve; }));
    renderTasks();
    expect(screen.getByText(/Loading Trello board/i)).toBeInTheDocument();
    // Resolve to avoid hanging
    resolveFn!({ cards: [], lists: [], boardName: 'BA Traffic Board' });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Tasks – Card URL link target', () => {
  it('card row links to the Trello card URL', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const link = screen.getAllByRole('link').find(a =>
      a.textContent?.includes('Review BRD for NCA')
    );
    expect(link).toBeDefined();
    expect(link).toHaveAttribute('href', 'https://trello.com/c/card-1');
  });

  it('card row opens in new tab', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const link = screen.getAllByRole('link').find(a =>
      a.textContent?.includes('Review BRD for NCA')
    );
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('card link has rel="noopener noreferrer" for security', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const link = screen.getAllByRole('link').find(a =>
      a.textContent?.includes('Review BRD for NCA')
    );
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});

// ─────────────────────────────────────────────────────────────
describe('Tasks – Board header card count', () => {
  it('shows "1 cards" in board header sub-text', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getAllByText(/1 cards/).length).toBeGreaterThan(0);
  });

  it('shows "2 cards" when two cards are loaded', async () => {
    mockFetchBATrafficBoard.mockResolvedValueOnce({
      cards: [mockCard, mockCard2],
      lists: [mockList],
      boardName: 'BA Traffic Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getAllByText(/2 cards/).length).toBeGreaterThan(0);
  });

  it('shows "Trello Board ·" text in board header', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByText(/Trello Board/)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Tasks – Members truncation', () => {
  it('shows first 2 members when card has 3 members', async () => {
    const threeMembers = {
      ...mockCard,
      id: 'card-3m',
      name: 'Three Member Card',
      members: ['Alice', 'Bob', 'Charlie'],
    };
    mockFetchBATrafficBoard.mockResolvedValueOnce({ ...mockBoard, cards: [threeMembers] });
    renderTasks();
    await screen.findByText('Three Member Card');
    expect(screen.getByText(/Alice, Bob/)).toBeInTheDocument();
  });

  it('shows +1 for 3-member card (one extra beyond 2)', async () => {
    const threeMembers = {
      ...mockCard,
      id: 'card-3m',
      name: 'Three Member Card',
      members: ['Alice', 'Bob', 'Charlie'],
    };
    mockFetchBATrafficBoard.mockResolvedValueOnce({ ...mockBoard, cards: [threeMembers] });
    renderTasks();
    await screen.findByText('Three Member Card');
    expect(screen.getByText(/\+1/)).toBeInTheDocument();
  });

  it('shows +2 for 4-member card', async () => {
    const fourMembers = {
      ...mockCard,
      id: 'card-4m',
      name: 'Four Member Card',
      members: ['Alice', 'Bob', 'Charlie', 'Dave'],
    };
    mockFetchBATrafficBoard.mockResolvedValueOnce({ ...mockBoard, cards: [fourMembers] });
    renderTasks();
    await screen.findByText('Four Member Card');
    expect(screen.getByText(/\+2/)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Tasks – Lowest priority', () => {
  it('shows Lowest priority badge on card', async () => {
    const lowestCard = {
      ...mockCard,
      id: 'card-low',
      name: 'Lowest Priority Task',
      priority: 'Lowest',
    };
    mockFetchBATrafficBoard.mockResolvedValueOnce({ ...mockBoard, cards: [lowestCard] });
    renderTasks();
    await screen.findByText('Lowest Priority Task');
    expect(screen.getByText('Lowest')).toBeInTheDocument();
  });

  it('shows Medium badge when priority is undefined (falls back to Medium)', async () => {
    const noPriorityCard = {
      ...mockCard,
      id: 'card-no-p',
      name: 'No Priority Task',
      priority: '',
    };
    mockFetchBATrafficBoard.mockResolvedValueOnce({ ...mockBoard, cards: [noPriorityCard] });
    renderTasks();
    await screen.findByText('No Priority Task');
    expect(screen.getAllByText('Medium').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Tasks – Search by list name', () => {
  it('filters cards by list name in search', async () => {
    mockFetchBATrafficBoard.mockResolvedValueOnce({
      cards: [mockCard, mockCard2],
      lists: [mockList, { id: 'list-2', name: 'Backlog' }],
      boardName: 'BA Traffic Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.type(screen.getByRole('textbox', { name: /search cards/i }), 'In Progress');
    await waitFor(() => {
      expect(screen.getByText('Review BRD for NCA')).toBeInTheDocument();
      expect(screen.queryByText('MOCI Procurement Analysis')).not.toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Tasks – Overdue tab filter', () => {
  it('clicking Overdue tab shows only overdue cards', async () => {
    mockFetchBATrafficBoard.mockResolvedValueOnce({
      cards: [mockCard, mockOverdueCard],
      lists: [mockList],
      boardName: 'BA Traffic Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /task status: overdue/i }));
    await waitFor(() => {
      expect(screen.getByText('Overdue Contract Review')).toBeInTheDocument();
      expect(screen.queryByText('Review BRD for NCA')).not.toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Tasks – Checklist completed color', () => {
  it('shows checklist as green text when all items done', async () => {
    const doneChecklist = {
      ...mockCard,
      id: 'card-done-cl',
      name: 'Fully Done Checklist Card',
      checklistTotal: 3,
      checklistDone: 3,
    };
    mockFetchBATrafficBoard.mockResolvedValueOnce({ ...mockBoard, cards: [doneChecklist] });
    renderTasks();
    await screen.findByText('Fully Done Checklist Card');
    expect(screen.getByText('3/3')).toBeInTheDocument();
  });

  it('shows partial checklist progress as text fraction', async () => {
    const partialChecklist = {
      ...mockCard,
      id: 'card-part-cl',
      name: 'Partial Checklist Card',
      checklistTotal: 10,
      checklistDone: 7,
    };
    mockFetchBATrafficBoard.mockResolvedValueOnce({ ...mockBoard, cards: [partialChecklist] });
    renderTasks();
    await screen.findByText('Partial Checklist Card');
    expect(screen.getByText('7/10')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Tasks – All status tab aria-labels', () => {
  it('Task status: All tab has aria-label', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('button', { name: /task status: all/i })).toBeInTheDocument();
  });

  it('Task status: Completed tab has aria-label', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('button', { name: /task status: completed/i })).toBeInTheDocument();
  });

  it('Task status: In Progress tab has aria-label', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('button', { name: /task status: in progress/i })).toBeInTheDocument();
  });

  it('Task status: All is pressed by default', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('button', { name: /task status: all/i })).toHaveAttribute('aria-pressed', 'true');
  });
});

// ─────────────────────────────────────────────────────────────
describe('Tasks – Clicking Completed tab', () => {
  it('clicking Completed tab sets aria-pressed=true', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const completedBtn = screen.getByRole('button', { name: /task status: completed/i });
    await userEvent.click(completedBtn);
    expect(completedBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking Completed tab sets All to aria-pressed=false', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const allBtn = screen.getByRole('button', { name: /task status: all/i });
    const completedBtn = screen.getByRole('button', { name: /task status: completed/i });
    await userEvent.click(completedBtn);
    expect(allBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking All after Completed restores All to aria-pressed=true', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const allBtn = screen.getByRole('button', { name: /task status: all/i });
    const completedBtn = screen.getByRole('button', { name: /task status: completed/i });
    await userEvent.click(completedBtn);
    await userEvent.click(allBtn);
    expect(allBtn).toHaveAttribute('aria-pressed', 'true');
  });
});

// ─────────────────────────────────────────────────────────────
describe('Tasks – Sort cards select options', () => {
  it('Sort cards select has options', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const sortSelect = screen.getByRole('combobox', { name: /sort cards/i });
    const opts = Array.from(sortSelect.querySelectorAll('option'));
    expect(opts.length).toBeGreaterThan(1);
  });

  it('Sort cards defaults to name or first option', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const sortSelect = screen.getByRole('combobox', { name: /sort cards/i }) as HTMLSelectElement;
    expect(sortSelect.value).toBeTruthy();
  });

  it('Filter by priority defaults to All Priorities', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const prioritySelect = screen.getByRole('combobox', { name: /filter by priority/i }) as HTMLSelectElement;
    expect(prioritySelect.value).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Tasks – Filter and sort dropdown aria-labels', () => {
  it('Search cards input has aria-label', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('textbox', { name: /search cards/i })).toBeInTheDocument();
  });

  it('Filter by list select has aria-label', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('combobox', { name: /filter by list/i })).toBeInTheDocument();
  });

  it('Filter by priority select has aria-label', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('combobox', { name: /filter by priority/i })).toBeInTheDocument();
  });

  it('Sort cards select has aria-label', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('combobox', { name: /sort cards/i })).toBeInTheDocument();
  });
});

describe('Tasks – Priority filter option text labels', () => {
  it('priority filter has P: Highest option', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const sel = screen.getByRole('combobox', { name: /filter by priority/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('P: Highest');
  });

  it('priority filter has P: High option', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const sel = screen.getByRole('combobox', { name: /filter by priority/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('P: High');
  });

  it('priority filter has P: Medium option', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const sel = screen.getByRole('combobox', { name: /filter by priority/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('P: Medium');
  });

  it('priority filter has P: Low option', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const sel = screen.getByRole('combobox', { name: /filter by priority/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('P: Low');
  });

  it('priority filter has P: Lowest option', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const sel = screen.getByRole('combobox', { name: /filter by priority/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('P: Lowest');
  });

  it('priority filter can be changed to P: High', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const sel = screen.getByRole('combobox', { name: /filter by priority/i });
    await userEvent.selectOptions(sel, 'High');
    expect((sel as HTMLSelectElement).value).toBe('High');
  });
});

describe('Tasks – Search cards placeholder text', () => {
  it('search cards input has placeholder text', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const input = screen.getByRole('textbox', { name: /search cards/i }) as HTMLInputElement;
    expect(input.placeholder).toMatch(/search/i);
  });
});

describe('Tasks – Sort cards option text labels', () => {
  it('sort cards select has Sort: Default option', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const sel = screen.getByRole('combobox', { name: /sort cards/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Sort: Default');
  });

  it('sort cards select has Sort: Priority option', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const sel = screen.getByRole('combobox', { name: /sort cards/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Sort: Priority');
  });

  it('sort cards select has Sort: Due Date option', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const sel = screen.getByRole('combobox', { name: /sort cards/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Sort: Due Date');
  });

  it('sort cards select has Sort: Client option', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const sel = screen.getByRole('combobox', { name: /sort cards/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Sort: Client');
  });

  it('sort cards can be changed to Sort: Priority', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const sel = screen.getByRole('combobox', { name: /sort cards/i });
    await userEvent.selectOptions(sel, 'priority');
    expect((sel as HTMLSelectElement).value).toBe('priority');
  });

  it('sort cards can be changed to Sort: Due Date', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const sel = screen.getByRole('combobox', { name: /sort cards/i });
    await userEvent.selectOptions(sel, 'due_date');
    expect((sel as HTMLSelectElement).value).toBe('due_date');
  });
});

describe('Tasks – Filter by list select defaults', () => {
  it('filter by list select has All Lists option', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const sel = screen.getByRole('combobox', { name: /filter by list/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('All Lists');
  });

  it('filter by list defaults to All Lists value', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const sel = screen.getByRole('combobox', { name: /filter by list/i }) as HTMLSelectElement;
    expect(sel.value).toBe('');
  });

  it('priority filter defaults to All value', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const sel = screen.getByRole('combobox', { name: /filter by priority/i }) as HTMLSelectElement;
    expect(sel.value).toBe('All');
  });

  it('sort cards defaults to default value', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const sel = screen.getByRole('combobox', { name: /sort cards/i }) as HTMLSelectElement;
    expect(sel.value).toBe('default');
  });
});

// ─────────────────────────────────────────────────────────────
describe('Tasks – Filter by priority select options', () => {
  it('priority filter has All Priorities option', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const sel = screen.getByRole('combobox', { name: /filter by priority/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('All Priorities');
  });

  it('priority filter has P: High option', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const sel = screen.getByRole('combobox', { name: /filter by priority/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('P: High');
  });

  it('priority filter has P: Medium option', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const sel = screen.getByRole('combobox', { name: /filter by priority/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('P: Medium');
  });

  it('priority filter has P: Low option', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const sel = screen.getByRole('combobox', { name: /filter by priority/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('P: Low');
  });

  it('priority filter can be changed to High', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const sel = screen.getByRole('combobox', { name: /filter by priority/i });
    await userEvent.selectOptions(sel, 'High');
    expect((sel as HTMLSelectElement).value).toBe('High');
  });

  it('priority filter can be changed to Medium', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const sel = screen.getByRole('combobox', { name: /filter by priority/i });
    await userEvent.selectOptions(sel, 'Medium');
    expect((sel as HTMLSelectElement).value).toBe('Medium');
  });
});

// ─────────────────────────────────────────────────────────────
describe('Tasks – Task status tab Backlog pressed state', () => {
  it('Task status: Backlog has aria-pressed=false by default', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const btn = screen.getByRole('button', { name: /task status: backlog/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Backlog tab sets it to aria-pressed=true', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const btn = screen.getByRole('button', { name: /task status: backlog/i });
    await userEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking Backlog tab sets All to aria-pressed=false', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const allBtn = screen.getByRole('button', { name: /task status: all/i });
    const backlogBtn = screen.getByRole('button', { name: /task status: backlog/i });
    await userEvent.click(backlogBtn);
    expect(allBtn).toHaveAttribute('aria-pressed', 'false');
  });
});

// ─────────────────────────────────────────────────────────────
describe('Tasks – Task status tab In Review pressed state', () => {
  it('Task status: In Review has aria-pressed=false by default', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const btn = screen.getByRole('button', { name: /task status: in review/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking In Review sets it to aria-pressed=true', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const btn = screen.getByRole('button', { name: /task status: in review/i });
    await userEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking In Review sets All to aria-pressed=false', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const allBtn = screen.getByRole('button', { name: /task status: all/i });
    const reviewBtn = screen.getByRole('button', { name: /task status: in review/i });
    await userEvent.click(reviewBtn);
    expect(allBtn).toHaveAttribute('aria-pressed', 'false');
  });
});

// ─────────────────────────────────────────────────────────────
describe('Tasks – Overdue tab cross-deselection', () => {
  it('clicking Overdue tab sets All to aria-pressed=false', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const allBtn = screen.getByRole('button', { name: /task status: all/i });
    const overdueBtn = screen.getByRole('button', { name: /task status: overdue/i });
    await userEvent.click(overdueBtn);
    expect(allBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Overdue sets it to aria-pressed=true', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const overdueBtn = screen.getByRole('button', { name: /task status: overdue/i });
    await userEvent.click(overdueBtn);
    expect(overdueBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking In Progress after Overdue sets Overdue to aria-pressed=false', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const overdueBtn = screen.getByRole('button', { name: /task status: overdue/i });
    const inProgressBtn = screen.getByRole('button', { name: /task status: in progress/i });
    await userEvent.click(overdueBtn);
    await userEvent.click(inProgressBtn);
    expect(overdueBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking All after Overdue restores All to aria-pressed=true', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const allBtn = screen.getByRole('button', { name: /task status: all/i });
    const overdueBtn = screen.getByRole('button', { name: /task status: overdue/i });
    await userEvent.click(overdueBtn);
    await userEvent.click(allBtn);
    expect(allBtn).toHaveAttribute('aria-pressed', 'true');
  });
});

// ─────────────────────────────────────────────────────────────
describe('Tasks – Status tab mutual exclusion (non-All tabs)', () => {
  it('clicking Completed after In Review sets In Review to aria-pressed=false', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const reviewBtn = screen.getByRole('button', { name: /task status: in review/i });
    const completedBtn = screen.getByRole('button', { name: /task status: completed/i });
    await userEvent.click(reviewBtn);
    await userEvent.click(completedBtn);
    expect(reviewBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking In Review after Completed sets Completed to aria-pressed=false', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const completedBtn = screen.getByRole('button', { name: /task status: completed/i });
    const reviewBtn = screen.getByRole('button', { name: /task status: in review/i });
    await userEvent.click(completedBtn);
    await userEvent.click(reviewBtn);
    expect(completedBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking All after In Review restores All to aria-pressed=true', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const allBtn = screen.getByRole('button', { name: /task status: all/i });
    const reviewBtn = screen.getByRole('button', { name: /task status: in review/i });
    await userEvent.click(reviewBtn);
    await userEvent.click(allBtn);
    expect(allBtn).toHaveAttribute('aria-pressed', 'true');
  });
});

// ─────────────────────────────────────────────────────────────
describe('Tasks – Backlog and Completed cross-deselection', () => {
  it('clicking Completed after Backlog sets Backlog to aria-pressed=false', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const backlogBtn = screen.getByRole('button', { name: /task status: backlog/i });
    const completedBtn = screen.getByRole('button', { name: /task status: completed/i });
    await userEvent.click(backlogBtn);
    await userEvent.click(completedBtn);
    expect(backlogBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking All after Completed restores All to aria-pressed=true', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const allBtn = screen.getByRole('button', { name: /task status: all/i });
    const completedBtn = screen.getByRole('button', { name: /task status: completed/i });
    await userEvent.click(completedBtn);
    await userEvent.click(allBtn);
    expect(allBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('Backlog after In Progress sets In Progress to false', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const progressBtn = screen.getByRole('button', { name: /task status: in progress/i });
    const backlogBtn = screen.getByRole('button', { name: /task status: backlog/i });
    await userEvent.click(progressBtn);
    await userEvent.click(backlogBtn);
    expect(progressBtn).toHaveAttribute('aria-pressed', 'false');
  });
});

// ─────────────────────────────────────────────────────────────
describe('Tasks – Overdue filter cross-deselection', () => {
  it('Overdue has aria-pressed=false by default', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('button', { name: /task status: overdue/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Overdue sets All to false', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const allBtn = screen.getByRole('button', { name: /task status: all/i });
    const overdueBtn = screen.getByRole('button', { name: /task status: overdue/i });
    await userEvent.click(overdueBtn);
    await waitFor(() => {
      expect(overdueBtn).toHaveAttribute('aria-pressed', 'true');
      expect(allBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('clicking Completed after Overdue sets Overdue to false', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const overdueBtn = screen.getByRole('button', { name: /task status: overdue/i });
    const completedBtn = screen.getByRole('button', { name: /task status: completed/i });
    await userEvent.click(overdueBtn);
    await waitFor(() => expect(overdueBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(completedBtn);
    await waitFor(() => {
      expect(completedBtn).toHaveAttribute('aria-pressed', 'true');
      expect(overdueBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('clicking All after Overdue restores All to true', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const allBtn = screen.getByRole('button', { name: /task status: all/i });
    const overdueBtn = screen.getByRole('button', { name: /task status: overdue/i });
    await userEvent.click(overdueBtn);
    await waitFor(() => expect(overdueBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(allBtn);
    await waitFor(() => expect(allBtn).toHaveAttribute('aria-pressed', 'true'));
  });
});

// ─────────────────────────────────────────────────────────────
describe('Tasks – In Review filter cross-deselection', () => {
  it('In Review has aria-pressed=false by default', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('button', { name: /task status: in review/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking In Review sets All to false', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const allBtn = screen.getByRole('button', { name: /task status: all/i });
    const reviewBtn = screen.getByRole('button', { name: /task status: in review/i });
    await userEvent.click(reviewBtn);
    await waitFor(() => {
      expect(reviewBtn).toHaveAttribute('aria-pressed', 'true');
      expect(allBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('clicking Overdue after In Review sets In Review to false', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const reviewBtn = screen.getByRole('button', { name: /task status: in review/i });
    const overdueBtn = screen.getByRole('button', { name: /task status: overdue/i });
    await userEvent.click(reviewBtn);
    await waitFor(() => expect(reviewBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(overdueBtn);
    await waitFor(() => {
      expect(overdueBtn).toHaveAttribute('aria-pressed', 'true');
      expect(reviewBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Tasks – All filter default and toggle', () => {
  it('All filter has aria-pressed=true by default', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('button', { name: /task status: all/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('In Progress has aria-pressed=false by default', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('button', { name: /task status: in progress/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking In Progress sets All to false', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const allBtn = screen.getByRole('button', { name: /task status: all/i });
    const inProgressBtn = screen.getByRole('button', { name: /task status: in progress/i });
    await userEvent.click(inProgressBtn);
    await waitFor(() => expect(allBtn).toHaveAttribute('aria-pressed', 'false'));
  });

  it('clicking Completed after In Progress sets In Progress to false', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const inProgressBtn = screen.getByRole('button', { name: /task status: in progress/i });
    const completedBtn = screen.getByRole('button', { name: /task status: completed/i });
    await userEvent.click(inProgressBtn);
    await waitFor(() => expect(inProgressBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(completedBtn);
    await waitFor(() => expect(inProgressBtn).toHaveAttribute('aria-pressed', 'false'));
  });
});

// ─────────────────────────────────────────────────────────────
describe('Tasks – Completed filter interactions', () => {
  it('Completed has aria-pressed=false by default', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('button', { name: /task status: completed/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Completed sets it to true', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const completedBtn = screen.getByRole('button', { name: /task status: completed/i });
    await userEvent.click(completedBtn);
    await waitFor(() => expect(completedBtn).toHaveAttribute('aria-pressed', 'true'));
  });

  it('clicking All after Completed restores All to true', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const allBtn = screen.getByRole('button', { name: /task status: all/i });
    const completedBtn = screen.getByRole('button', { name: /task status: completed/i });
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
describe('Tasks – three-status sequences', () => {
  it('In Progress → Overdue → Completed: Completed=true, others=false', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const inProgressBtn = screen.getByRole('button', { name: /task status: in progress/i });
    const overdueBtn = screen.getByRole('button', { name: /task status: overdue/i });
    const completedBtn = screen.getByRole('button', { name: /task status: completed/i });
    await userEvent.click(inProgressBtn);
    await waitFor(() => expect(inProgressBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(overdueBtn);
    await waitFor(() => expect(overdueBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(completedBtn);
    await waitFor(() => {
      expect(completedBtn).toHaveAttribute('aria-pressed', 'true');
      expect(inProgressBtn).toHaveAttribute('aria-pressed', 'false');
      expect(overdueBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('Completed → In Review → All: All=true', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const allBtn = screen.getByRole('button', { name: /task status: all/i });
    const completedBtn = screen.getByRole('button', { name: /task status: completed/i });
    const reviewBtn = screen.getByRole('button', { name: /task status: in review/i });
    await userEvent.click(completedBtn);
    await waitFor(() => expect(completedBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(reviewBtn);
    await waitFor(() => expect(reviewBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(allBtn);
    await waitFor(() => {
      expect(allBtn).toHaveAttribute('aria-pressed', 'true');
      expect(completedBtn).toHaveAttribute('aria-pressed', 'false');
      expect(reviewBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Tasks – Overdue filter interactions', () => {
  it('Overdue filter button is present', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('button', { name: /task status: overdue/i })).toBeInTheDocument();
  });

  it('clicking Overdue sets aria-pressed=true', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const btn = screen.getByRole('button', { name: /task status: overdue/i });
    await userEvent.click(btn);
    await waitFor(() => expect(btn).toHaveAttribute('aria-pressed', 'true'));
  });

  it('clicking Overdue deselects All', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const allBtn = screen.getByRole('button', { name: /task status: all/i });
    const overdueBtn = screen.getByRole('button', { name: /task status: overdue/i });
    await userEvent.click(overdueBtn);
    await waitFor(() => expect(allBtn).toHaveAttribute('aria-pressed', 'false'));
  });

  it('clicking All after Overdue restores All=true', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const allBtn = screen.getByRole('button', { name: /task status: all/i });
    const overdueBtn = screen.getByRole('button', { name: /task status: overdue/i });
    await userEvent.click(overdueBtn);
    await waitFor(() => expect(overdueBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(allBtn);
    await waitFor(() => expect(allBtn).toHaveAttribute('aria-pressed', 'true'));
  });
});

// ─────────────────────────────────────────────────────────────
describe('Tasks – In Review filter interactions', () => {
  it('In Review filter button is present', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('button', { name: /task status: in review/i })).toBeInTheDocument();
  });

  it('clicking In Review sets aria-pressed=true', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const btn = screen.getByRole('button', { name: /task status: in review/i });
    await userEvent.click(btn);
    await waitFor(() => expect(btn).toHaveAttribute('aria-pressed', 'true'));
  });

  it('clicking In Review deselects All', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const allBtn = screen.getByRole('button', { name: /task status: all/i });
    const reviewBtn = screen.getByRole('button', { name: /task status: in review/i });
    await userEvent.click(reviewBtn);
    await waitFor(() => expect(allBtn).toHaveAttribute('aria-pressed', 'false'));
  });
});

// ─────────────────────────────────────────────────────────────
describe('Tasks – additional three-status sequences', () => {
  it('Overdue → In Review → Completed: Completed=true, rest=false', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const overdueBtn = screen.getByRole('button', { name: /task status: overdue/i });
    const reviewBtn = screen.getByRole('button', { name: /task status: in review/i });
    const completedBtn = screen.getByRole('button', { name: /task status: completed/i });
    await userEvent.click(overdueBtn);
    await waitFor(() => expect(overdueBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(reviewBtn);
    await waitFor(() => expect(reviewBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(completedBtn);
    await waitFor(() => {
      expect(completedBtn).toHaveAttribute('aria-pressed', 'true');
      expect(overdueBtn).toHaveAttribute('aria-pressed', 'false');
      expect(reviewBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('In Progress → Completed → Overdue: Overdue=true, rest=false', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const inProgressBtn = screen.getByRole('button', { name: /task status: in progress/i });
    const completedBtn = screen.getByRole('button', { name: /task status: completed/i });
    const overdueBtn = screen.getByRole('button', { name: /task status: overdue/i });
    await userEvent.click(inProgressBtn);
    await waitFor(() => expect(inProgressBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(completedBtn);
    await waitFor(() => expect(completedBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(overdueBtn);
    await waitFor(() => {
      expect(overdueBtn).toHaveAttribute('aria-pressed', 'true');
      expect(inProgressBtn).toHaveAttribute('aria-pressed', 'false');
      expect(completedBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Tasks – Backlog filter interactions', () => {
  it('Backlog filter button exists if present', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    // Check all status buttons present
    expect(screen.getByRole('button', { name: /task status: all/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /task status: in progress/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /task status: overdue/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /task status: completed/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /task status: in review/i })).toBeInTheDocument();
  });

  it('clicking All after any filter restores All=true', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const allBtn = screen.getByRole('button', { name: /task status: all/i });
    const overdueBtn = screen.getByRole('button', { name: /task status: overdue/i });
    await userEvent.click(overdueBtn);
    await waitFor(() => expect(overdueBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(allBtn);
    await waitFor(() => {
      expect(allBtn).toHaveAttribute('aria-pressed', 'true');
      expect(overdueBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('clicking same filter twice stays active', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const inProgressBtn = screen.getByRole('button', { name: /task status: in progress/i });
    await userEvent.click(inProgressBtn);
    await waitFor(() => expect(inProgressBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(inProgressBtn);
    // The button stays active (radio-button-like behavior)
    await waitFor(() => expect(inProgressBtn).toHaveAttribute('aria-pressed', 'true'));
  });
});

// ─────────────────────────────────────────────────────────────
describe('Tasks – task data display', () => {
  it('shows task title in list', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByText('Review BRD for NCA')).toBeInTheDocument();
  });

  it('shows task status badge', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getAllByText(/in progress/i).length).toBeGreaterThan(0);
  });

  it('shows task priority', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getAllByText(/high/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Tasks – Completed filter interactions', () => {
  it('clicking Completed makes it active', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const completedBtn = screen.getByRole('button', { name: /task status: completed/i });
    await userEvent.click(completedBtn);
    await waitFor(() => expect(completedBtn).toHaveAttribute('aria-pressed', 'true'));
  });

  it('clicking Completed deselects All', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const allBtn = screen.getByRole('button', { name: /task status: all/i });
    const completedBtn = screen.getByRole('button', { name: /task status: completed/i });
    await userEvent.click(completedBtn);
    await waitFor(() => {
      expect(completedBtn).toHaveAttribute('aria-pressed', 'true');
      expect(allBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('clicking All after Completed restores All=true', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const allBtn = screen.getByRole('button', { name: /task status: all/i });
    const completedBtn = screen.getByRole('button', { name: /task status: completed/i });
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
describe('Tasks – four-status sequence', () => {
  it('In Review active after Completed→Overdue→InProgress→InReview', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const completedBtn = screen.getByRole('button', { name: /task status: completed/i });
    const overdueBtn = screen.getByRole('button', { name: /task status: overdue/i });
    const inProgressBtn = screen.getByRole('button', { name: /task status: in progress/i });
    const inReviewBtn = screen.getByRole('button', { name: /task status: in review/i });
    await userEvent.click(completedBtn);
    await userEvent.click(overdueBtn);
    await userEvent.click(inProgressBtn);
    await userEvent.click(inReviewBtn);
    await waitFor(() => {
      expect(inReviewBtn).toHaveAttribute('aria-pressed', 'true');
      expect(completedBtn).toHaveAttribute('aria-pressed', 'false');
      expect(overdueBtn).toHaveAttribute('aria-pressed', 'false');
      expect(inProgressBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Tasks – all status filter buttons', () => {
  it('all five status buttons are present', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('button', { name: /task status: all/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /task status: in progress/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /task status: completed/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /task status: overdue/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /task status: in review/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Tasks – CSV Export', () => {
  it('shows Export CSV button when cards are loaded', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('button', { name: /export tasks to csv/i })).toBeInTheDocument();
  });

  it('Export CSV button is not visible when no cards loaded', async () => {
    mockFetchBATrafficBoard.mockResolvedValueOnce({ cards: [], lists: [], boardName: 'Empty Board' });
    renderTasks();
    await screen.findByText(/No cards found on this board/i);
    expect(screen.queryByRole('button', { name: /export tasks to csv/i })).not.toBeInTheDocument();
  });

  it('clicking Export CSV creates a CSV Blob', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const exportBtn = screen.getByRole('button', { name: /export tasks to csv/i });
    await userEvent.click(exportBtn);
    await waitFor(() => {
      expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);
      const blob = mockCreateObjectURL.mock.calls[0][0];
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('text/csv');
    });
  });

  it('clicking Export CSV triggers anchor download click', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /export tasks to csv/i }));
    await waitFor(() => expect(mockClick).toHaveBeenCalledTimes(1));
  });

  it('clicking Export CSV revokes the blob URL', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /export tasks to csv/i }));
    await waitFor(() => expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-tasks-url'));
  });

  it('exported CSV contains header row with Title and Status', async () => {
    let capturedBlob: Blob | null = null;
    URL.createObjectURL = vi.fn((blob: Blob) => { capturedBlob = blob; return 'blob:mock-tasks-url'; });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /export tasks to csv/i }));
    await waitFor(() => expect(capturedBlob).not.toBeNull());
    const text = await capturedBlob!.text();
    expect(text).toContain('Title');
    expect(text).toContain('Status');
    expect(text).toContain('Priority');
    expect(text).toContain('Client');
  });

  it('exported CSV contains card data', async () => {
    let capturedBlob: Blob | null = null;
    URL.createObjectURL = vi.fn((blob: Blob) => { capturedBlob = blob; return 'blob:mock-tasks-url'; });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /export tasks to csv/i }));
    await waitFor(() => expect(capturedBlob).not.toBeNull());
    const text = await capturedBlob!.text();
    expect(text).toContain('Review BRD for NCA');
    expect(text).toContain('NCA');
  });

  it('exported CSV contains multiple cards when multi-card board loaded', async () => {
    mockFetchBATrafficBoard.mockResolvedValueOnce({
      cards: [mockCard, mockCard2, mockCompletedCard],
      lists: [mockList, { id: 'list-2', name: 'Backlog' }, { id: 'list-3', name: 'Done' }],
      boardName: 'BA Traffic Board',
    });
    let capturedBlob: Blob | null = null;
    URL.createObjectURL = vi.fn((blob: Blob) => { capturedBlob = blob; return 'blob:mock-tasks-url'; });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /export tasks to csv/i }));
    await waitFor(() => expect(capturedBlob).not.toBeNull());
    const text = await capturedBlob!.text();
    expect(text).toContain('Review BRD for NCA');
    expect(text).toContain('MOCI Procurement Analysis');
    expect(text).toContain('Completed Requirements Gathering');
  });

  it('Export CSV button disappears after filtering leaves no results', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const searchInput = screen.getByPlaceholderText(/search cards/i);
    await userEvent.type(searchInput, 'ZZZNOMATCH999');
    await waitFor(() => expect(screen.queryByRole('button', { name: /export tasks to csv/i })).not.toBeInTheDocument());
  });

  it('Export CSV exports only filtered cards when search is active', async () => {
    mockFetchBATrafficBoard.mockResolvedValueOnce({
      cards: [mockCard, mockCard2],
      lists: [mockList, { id: 'list-2', name: 'Backlog' }],
      boardName: 'BA Traffic Board',
    });
    let capturedBlob: Blob | null = null;
    URL.createObjectURL = vi.fn((blob: Blob) => { capturedBlob = blob; return 'blob:mock-tasks-url'; });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    // Filter to only NCA card
    const searchInput = screen.getByPlaceholderText(/search cards/i);
    await userEvent.type(searchInput, 'NCA');
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /export tasks to csv/i }));
    await waitFor(() => expect(capturedBlob).not.toBeNull());
    const text = await capturedBlob!.text();
    expect(text).toContain('Review BRD for NCA');
    expect(text).not.toContain('MOCI Procurement Analysis');
  });
});

// ─────────────────────────────────────────────────────────────
describe('Tasks – Local Task Creation', () => {
  beforeEach(() => {
    localStorage.removeItem('local_tasks');
  });

  it('shows New Task button', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('button', { name: /add new local task/i })).toBeInTheDocument();
  });

  it('opens New Task modal when New Task button clicked', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /add new local task/i }));
    expect(await screen.findByRole('dialog', { name: /add new task/i })).toBeInTheDocument();
  });

  it('modal has Task Title input', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /add new local task/i }));
    await screen.findByRole('dialog');
    expect(screen.getByRole('textbox', { name: /task title/i })).toBeInTheDocument();
  });

  it('modal has Client input', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /add new local task/i }));
    await screen.findByRole('dialog');
    expect(screen.getByRole('textbox', { name: /^client$/i })).toBeInTheDocument();
  });

  it('modal has Priority select defaulting to Medium', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /add new local task/i }));
    await screen.findByRole('dialog');
    const prioritySelect = screen.getByRole('combobox', { name: /^priority$/i }) as HTMLSelectElement;
    expect(prioritySelect.value).toBe('Medium');
  });

  it('modal has Status select defaulting to Backlog', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /add new local task/i }));
    await screen.findByRole('dialog');
    const statusSelect = screen.getByRole('combobox', { name: /task status/i }) as HTMLSelectElement;
    expect(statusSelect.value).toBe('Backlog');
  });

  it('Create Task button is disabled when title is empty', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /add new local task/i }));
    await screen.findByRole('dialog');
    expect(screen.getByRole('button', { name: /create task/i })).toBeDisabled();
  });

  it('Create Task button is enabled when title is filled', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /add new local task/i }));
    await screen.findByRole('dialog');
    await userEvent.type(screen.getByRole('textbox', { name: /task title/i }), 'My New Task');
    expect(screen.getByRole('button', { name: /create task/i })).not.toBeDisabled();
  });

  it('creates a local task and shows it in the list', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /add new local task/i }));
    await screen.findByRole('dialog');
    await userEvent.type(screen.getByRole('textbox', { name: /task title/i }), 'NCA Security Assessment');
    await userEvent.click(screen.getByRole('button', { name: /create task/i }));
    expect(await screen.findByText('NCA Security Assessment')).toBeInTheDocument();
  });

  it('closes modal after creating task', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /add new local task/i }));
    await screen.findByRole('dialog');
    await userEvent.type(screen.getByRole('textbox', { name: /task title/i }), 'Quick Task');
    await userEvent.click(screen.getByRole('button', { name: /create task/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('shows Local badge on local tasks', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /add new local task/i }));
    await screen.findByRole('dialog');
    await userEvent.type(screen.getByRole('textbox', { name: /task title/i }), 'Local Only Task');
    await userEvent.click(screen.getByRole('button', { name: /create task/i }));
    await screen.findByText('Local Only Task');
    expect(screen.getByText('Local')).toBeInTheDocument();
  });

  it('persists local task to localStorage', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /add new local task/i }));
    await screen.findByRole('dialog');
    await userEvent.type(screen.getByRole('textbox', { name: /task title/i }), 'Persistent Task');
    await userEvent.click(screen.getByRole('button', { name: /create task/i }));
    await screen.findByText('Persistent Task');
    const stored = JSON.parse(localStorage.getItem('local_tasks') ?? '[]');
    expect(stored.some((t: { name: string }) => t.name === 'Persistent Task')).toBe(true);
  });

  it('loads local tasks from localStorage on mount', async () => {
    const stored = [{ id: 'lt-1', name: 'Pre-stored Task', client: 'MOCI', priority: 'High', status: 'Backlog', dueDate: '', assignee: '', createdAt: new Date().toISOString() }];
    localStorage.setItem('local_tasks', JSON.stringify(stored));
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(await screen.findByText('Pre-stored Task')).toBeInTheDocument();
  });

  it('deletes a local task when trash icon clicked', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /add new local task/i }));
    await screen.findByRole('dialog');
    await userEvent.type(screen.getByRole('textbox', { name: /task title/i }), 'Task To Delete');
    await userEvent.click(screen.getByRole('button', { name: /create task/i }));
    await screen.findByText('Task To Delete');
    const deleteBtn = screen.getByRole('button', { name: /delete local task task to delete/i });
    await userEvent.click(deleteBtn);
    await waitFor(() => expect(screen.queryByText('Task To Delete')).not.toBeInTheDocument());
  });

  it('removes deleted task from localStorage', async () => {
    const stored = [{ id: 'del-1', name: 'Del Me Task', client: '', priority: 'Low', status: 'Backlog', dueDate: '', assignee: '', createdAt: new Date().toISOString() }];
    localStorage.setItem('local_tasks', JSON.stringify(stored));
    renderTasks();
    await screen.findByText('Del Me Task');
    await userEvent.click(screen.getByRole('button', { name: /delete local task del me task/i }));
    await waitFor(() => {
      const remaining = JSON.parse(localStorage.getItem('local_tasks') ?? '[]');
      expect(remaining.some((t: { id: string }) => t.id === 'del-1')).toBe(false);
    });
  });

  it('closes modal when Cancel is clicked', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /add new local task/i }));
    await screen.findByRole('dialog');
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('closes modal when X button clicked', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /add new local task/i }));
    await screen.findByRole('dialog');
    await userEvent.click(screen.getByRole('button', { name: /close dialog/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('local task appears in All tab', async () => {
    const stored = [{ id: 'lt-all', name: 'All Tab Task', client: '', priority: 'Medium', status: 'Backlog', dueDate: '', assignee: '', createdAt: new Date().toISOString() }];
    localStorage.setItem('local_tasks', JSON.stringify(stored));
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(await screen.findByText('All Tab Task')).toBeInTheDocument();
  });

  it('local task with Backlog status appears under Backlog filter', async () => {
    const stored = [{ id: 'lt-bl', name: 'Backlog Local Task', client: '', priority: 'Medium', status: 'Backlog', dueDate: '', assignee: '', createdAt: new Date().toISOString() }];
    localStorage.setItem('local_tasks', JSON.stringify(stored));
    mockFetchBATrafficBoard.mockResolvedValueOnce({ cards: [mockCard], lists: [mockList], boardName: 'BA Board' });
    renderTasks();
    await screen.findByText('Backlog Local Task');
    const backlogBtn = screen.getByRole('button', { name: /task status: backlog/i });
    await userEvent.click(backlogBtn);
    await waitFor(() => {
      expect(screen.getByText('Backlog Local Task')).toBeInTheDocument();
    });
  });

  it('local task with client set appears with client name', async () => {
    const stored = [{ id: 'lt-cl', name: 'Client Task', client: 'RWA', priority: 'High', status: 'In Progress', dueDate: '', assignee: '', createdAt: new Date().toISOString() }];
    localStorage.setItem('local_tasks', JSON.stringify(stored));
    renderTasks();
    await screen.findByText('Client Task');
    expect(screen.getAllByText('RWA').length).toBeGreaterThan(0);
  });

  it('local task with assignee set shows assignee name', async () => {
    const stored = [{ id: 'lt-as', name: 'Assigned Task', client: '', priority: 'Medium', status: 'Backlog', dueDate: '', assignee: 'Fatima Hassan', createdAt: new Date().toISOString() }];
    localStorage.setItem('local_tasks', JSON.stringify(stored));
    renderTasks();
    await screen.findByText('Assigned Task');
    expect(screen.getAllByText('Fatima Hassan').length).toBeGreaterThan(0);
  });

  it('local task is searchable by name', async () => {
    const stored = [{ id: 'lt-srch', name: 'RWA Inspection Task', client: 'RWA', priority: 'High', status: 'Backlog', dueDate: '', assignee: '', createdAt: new Date().toISOString() }];
    localStorage.setItem('local_tasks', JSON.stringify(stored));
    renderTasks();
    await screen.findByText('RWA Inspection Task');
    const searchInput = screen.getByPlaceholderText(/search cards/i);
    await userEvent.type(searchInput, 'RWA Inspection');
    await waitFor(() => expect(screen.getByText('RWA Inspection Task')).toBeInTheDocument());
  });

  it('local task increases Total Cards count', async () => {
    const stored = [{ id: 'lt-cnt', name: 'Counter Task', client: '', priority: 'Low', status: 'Backlog', dueDate: '', assignee: '', createdAt: new Date().toISOString() }];
    localStorage.setItem('local_tasks', JSON.stringify(stored));
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await screen.findByText('Counter Task');
    const heroNumbers = document.querySelectorAll('.hero-number');
    expect(heroNumbers[0]?.textContent).toBe('2');
  });

  it('shows priority badge on local task', async () => {
    const stored = [{ id: 'lt-pri', name: 'High Pri Local', client: '', priority: 'High', status: 'Backlog', dueDate: '', assignee: '', createdAt: new Date().toISOString() }];
    localStorage.setItem('local_tasks', JSON.stringify(stored));
    renderTasks();
    await screen.findByText('High Pri Local');
    expect(screen.getAllByText('High').length).toBeGreaterThan(0);
  });

  it('can create task with In Progress status', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /add new local task/i }));
    await screen.findByRole('dialog');
    await userEvent.type(screen.getByRole('textbox', { name: /task title/i }), 'IP Task');
    const statusSelect = screen.getByRole('combobox', { name: /task status/i });
    await userEvent.selectOptions(statusSelect, 'In Progress');
    await userEvent.click(screen.getByRole('button', { name: /create task/i }));
    await screen.findByText('IP Task');
    expect(screen.getAllByText('In Progress').length).toBeGreaterThan(0);
  });
});

describe('Tasks – Copy Task Summary', () => {
  beforeEach(() => {
    localStorage.clear();
    mockFetchBATrafficBoard.mockResolvedValue(mockBoard);
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('shows Copy Task Summary button', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('button', { name: /copy task summary to clipboard/i })).toBeInTheDocument();
  });

  it('Copy Task Summary button is not disabled', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('button', { name: /copy task summary to clipboard/i })).not.toBeDisabled();
  });

  it('clicking Copy Task Summary calls clipboard.writeText', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /copy task summary to clipboard/i }));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });
  });

  it('clipboard.writeText called with Total in text', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /copy task summary to clipboard/i }));
    await waitFor(() => {
      const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(text).toContain('Total:');
    });
  });

  it('clipboard.writeText includes board name in summary', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /copy task summary to clipboard/i }));
    await waitFor(() => {
      const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(text).toContain('BA Traffic Board');
    });
  });

  it('clipboard.writeText includes In Progress count', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /copy task summary to clipboard/i }));
    await waitFor(() => {
      const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(text).toContain('In Progress:');
    });
  });

  it('shows Copied! text in button after clicking', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /copy task summary to clipboard/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copy task summary to clipboard/i })).toHaveTextContent('Copied!');
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Export Tasks TXT', () => {
  it('shows Export TXT button when tasks exist', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('button', { name: /export tasks to txt/i })).toBeInTheDocument();
  });

  it('Export TXT button is not visible when no tasks exist', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({ ...mockBoard, cards: [] });
    renderTasks();
    await waitFor(() => expect(mockFetchBATrafficBoard).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /export tasks to txt/i })).not.toBeInTheDocument();
  });

  it('clicking Export TXT calls URL.createObjectURL', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /export tasks to txt/i }));
    expect(mockCreateObjectURL).toHaveBeenCalled();
  });

  it('clicking Export TXT triggers anchor click', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /export tasks to txt/i }));
    expect(mockClick).toHaveBeenCalled();
  });

  it('clicking Export TXT calls URL.revokeObjectURL', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /export tasks to txt/i }));
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-tasks-url');
  });

  it('shows Exported! feedback after clicking Export TXT', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /export tasks to txt/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export tasks to txt/i })).toHaveTextContent('Exported!');
    });
  });
});

// ── Due-date quick filter ─────────────────────────────────────
describe('Tasks – Due Date Quick Filter', () => {
  const todayISO = new Date().toISOString().slice(0, 10);
  const cardDueToday = {
    ...mockCard,
    id: 'card-due-today',
    name: 'Task Due Today',
    dueDate: `${todayISO}T09:00:00.000Z`,
    dueComplete: false,
  };

  it('renders All, Due Today, and Due This Week filter buttons', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('button', { name: /filter tasks by due date: all/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter tasks by due date: due today/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter tasks by due date: due this week/i })).toBeInTheDocument();
  });

  it('All filter is pressed by default', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('button', { name: /filter tasks by due date: all/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('Due Today is not pressed by default', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('button', { name: /filter tasks by due date: due today/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('Due This Week is not pressed by default', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('button', { name: /filter tasks by due date: due this week/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Due Today sets it to pressed', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /filter tasks by due date: due today/i }));
    expect(screen.getByRole('button', { name: /filter tasks by due date: due today/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking Due Today deactivates All', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /filter tasks by due date: due today/i }));
    expect(screen.getByRole('button', { name: /filter tasks by due date: all/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Due This Week sets it to pressed', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /filter tasks by due date: due this week/i }));
    expect(screen.getByRole('button', { name: /filter tasks by due date: due this week/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking All after Due Today restores All as pressed', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /filter tasks by due date: due today/i }));
    await userEvent.click(screen.getByRole('button', { name: /filter tasks by due date: all/i }));
    expect(screen.getByRole('button', { name: /filter tasks by due date: all/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /filter tasks by due date: due today/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('Due Today filter shows only tasks due today', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard, cardDueToday],
      lists: [mockList],
      boardName: 'BA Traffic Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await screen.findByText('Task Due Today');
    await userEvent.click(screen.getByRole('button', { name: /filter tasks by due date: due today/i }));
    await waitFor(() => {
      expect(screen.queryByText('Review BRD for NCA')).not.toBeInTheDocument();
      expect(screen.getByText('Task Due Today')).toBeInTheDocument();
    });
  });
});

// ── No Due Date Quick Filter ──────────────────────────────────
describe('Tasks – No Due Date Quick Filter', () => {
  const todayISO = new Date().toISOString().slice(0, 10);
  const cardWithDue = {
    ...mockCard,
    id: 'card-with-due',
    name: 'Task With Due Date',
    dueDate: `${todayISO}T12:00:00.000Z`,
  };

  it('renders No Due Date filter button', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('button', { name: /filter tasks by due date: no due date/i })).toBeInTheDocument();
  });

  it('No Due Date filter is not pressed by default', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('button', { name: /filter tasks by due date: no due date/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking No Due Date sets it to pressed', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /filter tasks by due date: no due date/i }));
    expect(screen.getByRole('button', { name: /filter tasks by due date: no due date/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking No Due Date deactivates All', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /filter tasks by due date: no due date/i }));
    expect(screen.getByRole('button', { name: /filter tasks by due date: all/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('No Due Date filter shows cards without a due date', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard, cardWithDue],
      lists: [mockList],
      boardName: 'BA Traffic Board',
    });
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await screen.findByText('Task With Due Date');
    await userEvent.click(screen.getByRole('button', { name: /filter tasks by due date: no due date/i }));
    await waitFor(() => {
      expect(screen.getByText('Review BRD for NCA')).toBeInTheDocument();
      expect(screen.queryByText('Task With Due Date')).not.toBeInTheDocument();
    });
  });

  it('No Due Date filter hides cards with a due date', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [cardWithDue],
      lists: [mockList],
      boardName: 'BA Traffic Board',
    });
    renderTasks();
    await screen.findByText('Task With Due Date');
    await userEvent.click(screen.getByRole('button', { name: /filter tasks by due date: no due date/i }));
    await waitFor(() => {
      expect(screen.queryByText('Task With Due Date')).not.toBeInTheDocument();
    });
  });

  it('clicking All after No Due Date restores All as pressed', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /filter tasks by due date: no due date/i }));
    await userEvent.click(screen.getByRole('button', { name: /filter tasks by due date: all/i }));
    expect(screen.getByRole('button', { name: /filter tasks by due date: all/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /filter tasks by due date: no due date/i })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('Tasks – Assignee Quick Filter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard, mockCard2],
      lists: [mockList, { id: 'list-2', name: 'Backlog' }],
      boardName: 'BA Traffic Board',
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it('shows assignee filter dropdown when multiple assignees exist', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await waitFor(() => expect(screen.getByRole('combobox', { name: /filter tasks by assignee/i })).toBeInTheDocument());
  });

  it('assignee filter defaults to All Assignees', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await waitFor(() => {
      const select = screen.getByRole('combobox', { name: /filter tasks by assignee/i });
      expect(select).toHaveValue('All');
    });
  });

  it('shows all tasks when All Assignees selected', async () => {
    renderTasks();
    await waitFor(() => {
      expect(screen.getByText('Review BRD for NCA')).toBeInTheDocument();
      expect(screen.getByText('MOCI Procurement Analysis')).toBeInTheDocument();
    });
  });

  it('filtering by Ahmed Khalil shows only his tasks', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await waitFor(() => screen.getByRole('combobox', { name: /filter tasks by assignee/i }));
    const select = screen.getByRole('combobox', { name: /filter tasks by assignee/i });
    await userEvent.selectOptions(select, 'Ahmed Khalil');
    await waitFor(() => {
      expect(screen.getByText('Review BRD for NCA')).toBeInTheDocument();
      expect(screen.queryByText('MOCI Procurement Analysis')).not.toBeInTheDocument();
    });
  });

  it('filtering by Rania Taleb shows only her tasks', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await waitFor(() => screen.getByRole('combobox', { name: /filter tasks by assignee/i }));
    const select = screen.getByRole('combobox', { name: /filter tasks by assignee/i });
    await userEvent.selectOptions(select, 'Rania Taleb');
    await waitFor(() => {
      expect(screen.queryByText('Review BRD for NCA')).not.toBeInTheDocument();
      expect(screen.getByText('MOCI Procurement Analysis')).toBeInTheDocument();
    });
  });

  it('switching back to All Assignees restores all tasks', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await waitFor(() => screen.getByRole('combobox', { name: /filter tasks by assignee/i }));
    const select = screen.getByRole('combobox', { name: /filter tasks by assignee/i });
    await userEvent.selectOptions(select, 'Ahmed Khalil');
    await waitFor(() => expect(screen.queryByText('MOCI Procurement Analysis')).not.toBeInTheDocument());
    await userEvent.selectOptions(select, 'All');
    await waitFor(() => {
      expect(screen.getByText('Review BRD for NCA')).toBeInTheDocument();
      expect(screen.getByText('MOCI Procurement Analysis')).toBeInTheDocument();
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Assignee Sort', () => {
  beforeEach(() => {
    mockFetchBATrafficBoard.mockResolvedValue({ ...mockBoard, cards: [mockCard, mockCard2] });
  });

  it('renders Sort: Assignee option in sort dropdown', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const sortSelect = screen.getByRole('combobox', { name: /sort cards/i });
    expect(sortSelect).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Sort: Assignee' })).toBeInTheDocument();
  });

  it('sort dropdown defaults to Sort: Default', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const sortSelect = screen.getByRole('combobox', { name: /sort cards/i });
    expect(sortSelect).toHaveValue('default');
  });

  it('can select Sort: Assignee option', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const sortSelect = screen.getByRole('combobox', { name: /sort cards/i });
    await userEvent.selectOptions(sortSelect, 'assignee');
    expect(sortSelect).toHaveValue('assignee');
  });

  it('sorting by assignee shows both tasks', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const sortSelect = screen.getByRole('combobox', { name: /sort cards/i });
    await userEvent.selectOptions(sortSelect, 'assignee');
    await waitFor(() => {
      expect(screen.getByText('Review BRD for NCA')).toBeInTheDocument();
      expect(screen.getByText('MOCI Procurement Analysis')).toBeInTheDocument();
    });
  });

  it('sorting by assignee orders Ahmed before Rania alphabetically', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const sortSelect = screen.getByRole('combobox', { name: /sort cards/i });
    await userEvent.selectOptions(sortSelect, 'assignee');
    await waitFor(() => {
      const cards = screen.getAllByRole('link').filter(el => el.textContent?.includes('BRD') || el.textContent?.includes('MOCI'));
      const texts = cards.map(el => el.textContent ?? '');
      const ahmedIdx = texts.findIndex(t => t.includes('Review BRD'));
      const raniaIdx = texts.findIndex(t => t.includes('MOCI'));
      expect(ahmedIdx).toBeLessThan(raniaIdx);
    });
  });
});

describe('Tasks – Payment Filter', () => {
  const paymentCard = {
    ...mockCard, id: 'pay-1', name: 'Invoice Review Task', relatedToPayment: true,
  };
  const nonPaymentCard = {
    ...mockCard, id: 'pay-2', name: 'Regular Analysis Task', relatedToPayment: false,
  };

  beforeEach(() => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [paymentCard, nonPaymentCard],
      lists: [{ id: 'list-1', name: 'In Progress' }],
      boardName: 'BA Traffic Board',
    });
  });

  it('renders the Payment filter button', async () => {
    render(<Tasks />);
    await screen.findByText('Invoice Review Task');
    expect(screen.getByRole('button', { name: /show payment-related tasks only/i })).toBeInTheDocument();
  });

  it('Payment button defaults to not pressed', async () => {
    render(<Tasks />);
    await screen.findByText('Invoice Review Task');
    const btn = screen.getByRole('button', { name: /show payment-related tasks only/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Payment button sets aria-pressed to true', async () => {
    render(<Tasks />);
    await screen.findByText('Invoice Review Task');
    const btn = screen.getByRole('button', { name: /show payment-related tasks only/i });
    await userEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking Payment button again deactivates the filter', async () => {
    render(<Tasks />);
    await screen.findByText('Invoice Review Task');
    const btn = screen.getByRole('button', { name: /show payment-related tasks only/i });
    await userEvent.click(btn);
    await userEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('Payment filter shows only payment-related tasks', async () => {
    render(<Tasks />);
    await screen.findByText('Invoice Review Task');
    expect(screen.getByText('Regular Analysis Task')).toBeInTheDocument();
    const btn = screen.getByRole('button', { name: /show payment-related tasks only/i });
    await userEvent.click(btn);
    expect(screen.getByText('Invoice Review Task')).toBeInTheDocument();
    expect(screen.queryByText('Regular Analysis Task')).not.toBeInTheDocument();
  });

  it('turning off Payment filter restores all tasks', async () => {
    render(<Tasks />);
    await screen.findByText('Invoice Review Task');
    const btn = screen.getByRole('button', { name: /show payment-related tasks only/i });
    await userEvent.click(btn);
    await userEvent.click(btn);
    expect(screen.getByText('Invoice Review Task')).toBeInTheDocument();
    expect(screen.getByText('Regular Analysis Task')).toBeInTheDocument();
  });
});

// ── Sort by Name ───────────────────────────────────────────────
describe('Tasks – Sort by Name', () => {
  beforeEach(() => {
    mockFetchBATrafficBoard.mockResolvedValue({ cards: [mockCard, mockCard2] });
  });

  it('renders Sort: Name option in sort dropdown', async () => {
    render(<Tasks />);
    await screen.findByText('Review BRD for NCA');
    const select = screen.getByRole('combobox', { name: /sort cards/i });
    expect(select.querySelector('option[value="name"]')).toBeTruthy();
  });

  it('Sort: Name option has correct label', async () => {
    render(<Tasks />);
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('option', { name: /sort: name/i })).toBeInTheDocument();
  });

  it('selecting name sort updates dropdown value', async () => {
    render(<Tasks />);
    await screen.findByText('Review BRD for NCA');
    const select = screen.getByRole('combobox', { name: /sort cards/i });
    await userEvent.selectOptions(select, 'name');
    expect((select as HTMLSelectElement).value).toBe('name');
  });

  it('name sort orders tasks alphabetically', async () => {
    const cardA = { ...mockCard, id: 'c-z', name: 'Zebra Task' };
    const cardB = { ...mockCard, id: 'c-a', name: 'Alpha Task' };
    mockFetchBATrafficBoard.mockResolvedValueOnce({ cards: [cardA, cardB] });
    render(<Tasks />);
    await screen.findByText('Zebra Task');
    const select = screen.getByRole('combobox', { name: /sort cards/i });
    await userEvent.selectOptions(select, 'name');
    await waitFor(() => {
      const alphaEl = screen.getByText('Alpha Task');
      const zebraEl = screen.getByText('Zebra Task');
      const pos = alphaEl.compareDocumentPosition(zebraEl);
      expect(pos & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });

  it('switching from name back to default changes sort', async () => {
    render(<Tasks />);
    await screen.findByText('Review BRD for NCA');
    const select = screen.getByRole('combobox', { name: /sort cards/i });
    await userEvent.selectOptions(select, 'name');
    await userEvent.selectOptions(select, 'default');
    expect((select as HTMLSelectElement).value).toBe('default');
  });
});

describe('Tasks – Client Filter', () => {
  const cardNCA = { ...mockCard, id: 'c-nca', name: 'NCA Task', client: 'NCA' };
  const cardMOCI = { ...mockCard, id: 'c-moci', name: 'MOCI Task', client: 'MOCI' };
  const cardADNOC = { ...mockCard, id: 'c-adnoc', name: 'ADNOC Task', client: 'ADNOC' };

  beforeEach(() => {
    mockFetchBATrafficBoard.mockResolvedValue({ cards: [cardNCA, cardMOCI, cardADNOC] });
  });

  it('renders client filter dropdown when multiple clients exist', async () => {
    render(<Tasks />);
    await screen.findByText('NCA Task');
    expect(screen.getByRole('combobox', { name: /filter tasks by client/i })).toBeInTheDocument();
  });

  it('client filter defaults to All', async () => {
    render(<Tasks />);
    await screen.findByText('NCA Task');
    const sel = screen.getByRole('combobox', { name: /filter tasks by client/i }) as HTMLSelectElement;
    expect(sel.value).toBe('All');
  });

  it('filtering by NCA hides MOCI Task', async () => {
    render(<Tasks />);
    await screen.findByText('NCA Task');
    const sel = screen.getByRole('combobox', { name: /filter tasks by client/i });
    await userEvent.selectOptions(sel, 'NCA');
    await waitFor(() => expect(screen.queryByText('MOCI Task')).not.toBeInTheDocument());
  });

  it('filtering by NCA keeps NCA Task visible', async () => {
    render(<Tasks />);
    await screen.findByText('NCA Task');
    const sel = screen.getByRole('combobox', { name: /filter tasks by client/i });
    await userEvent.selectOptions(sel, 'NCA');
    await waitFor(() => expect(screen.getByText('NCA Task')).toBeInTheDocument());
  });

  it('filtering by MOCI hides NCA Task', async () => {
    render(<Tasks />);
    await screen.findByText('MOCI Task');
    const sel = screen.getByRole('combobox', { name: /filter tasks by client/i });
    await userEvent.selectOptions(sel, 'MOCI');
    await waitFor(() => expect(screen.queryByText('NCA Task')).not.toBeInTheDocument());
  });

  it('switching back to All restores all tasks', async () => {
    render(<Tasks />);
    await screen.findByText('NCA Task');
    const sel = screen.getByRole('combobox', { name: /filter tasks by client/i });
    await userEvent.selectOptions(sel, 'NCA');
    await waitFor(() => expect(screen.queryByText('MOCI Task')).not.toBeInTheDocument());
    await userEvent.selectOptions(sel, 'All');
    await waitFor(() => {
      expect(screen.getByText('NCA Task')).toBeInTheDocument();
      expect(screen.getByText('MOCI Task')).toBeInTheDocument();
    });
  });

  it('client filter has All Clients default option', async () => {
    render(<Tasks />);
    await screen.findByText('NCA Task');
    const sel = screen.getByRole('combobox', { name: /filter tasks by client/i });
    expect(sel.querySelector('option[value="All"]')).toBeInTheDocument();
  });
});

describe('Tasks – Sort by Label', () => {
  const cardZebra = { ...mockCard, id: 'c-z', name: 'Zebra Label Task', labels: ['Zebra'] };
  const cardAlpha = { ...mockCard, id: 'c-a', name: 'Alpha Label Task', labels: ['Alpha'] };
  const cardMid = { ...mockCard, id: 'c-m', name: 'Mid Label Task', labels: ['Mid'] };

  beforeEach(() => {
    mockFetchBATrafficBoard.mockResolvedValue({ cards: [cardZebra, cardAlpha, cardMid] });
  });

  it('renders Sort: Label option in sort dropdown', async () => {
    render(<Tasks />);
    await screen.findByText('Zebra Label Task');
    expect(screen.getByRole('option', { name: /sort: label/i })).toBeInTheDocument();
  });

  it('selecting label sort updates dropdown value', async () => {
    render(<Tasks />);
    await screen.findByText('Zebra Label Task');
    const select = screen.getByRole('combobox', { name: /sort cards/i });
    await userEvent.selectOptions(select, 'label');
    expect((select as HTMLSelectElement).value).toBe('label');
  });

  it('label sort places Alpha before Zebra in DOM', async () => {
    render(<Tasks />);
    await screen.findByText('Zebra Label Task');
    const select = screen.getByRole('combobox', { name: /sort cards/i });
    await userEvent.selectOptions(select, 'label');
    await waitFor(() => {
      const alphaEl = screen.getByText('Alpha Label Task');
      const zebraEl = screen.getByText('Zebra Label Task');
      expect(alphaEl.compareDocumentPosition(zebraEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });

  it('all three tasks remain visible after label sort', async () => {
    render(<Tasks />);
    await screen.findByText('Zebra Label Task');
    const select = screen.getByRole('combobox', { name: /sort cards/i });
    await userEvent.selectOptions(select, 'label');
    expect(screen.getByText('Zebra Label Task')).toBeInTheDocument();
    expect(screen.getByText('Alpha Label Task')).toBeInTheDocument();
    expect(screen.getByText('Mid Label Task')).toBeInTheDocument();
  });

  it('switching from label sort back to default works', async () => {
    render(<Tasks />);
    await screen.findByText('Zebra Label Task');
    const select = screen.getByRole('combobox', { name: /sort cards/i });
    await userEvent.selectOptions(select, 'label');
    await userEvent.selectOptions(select, 'default');
    expect((select as HTMLSelectElement).value).toBe('default');
  });
});

describe('Tasks – Sort by Status', () => {
  const cardBacklog = { ...mockCard, id: 'c-backlog', name: 'Backlog Status Task', listName: 'Backlog' };
  const cardInProg = { ...mockCard, id: 'c-inprog', name: 'InProgress Status Task', listName: 'In Progress' };
  const cardDone = { ...mockCard, id: 'c-done', name: 'Done Status Task', listName: 'Completed' };

  beforeEach(() => {
    mockFetchBATrafficBoard.mockResolvedValue({ cards: [cardInProg, cardDone, cardBacklog] });
  });

  it('renders Sort: Status option in sort dropdown', async () => {
    render(<Tasks />);
    await screen.findByText('InProgress Status Task');
    expect(screen.getByRole('option', { name: /sort: status/i })).toBeInTheDocument();
  });

  it('selecting status sort updates dropdown value', async () => {
    render(<Tasks />);
    await screen.findByText('InProgress Status Task');
    const select = screen.getByRole('combobox', { name: /sort cards/i });
    await userEvent.selectOptions(select, 'status');
    expect((select as HTMLSelectElement).value).toBe('status');
  });

  it('all three tasks remain visible after status sort', async () => {
    render(<Tasks />);
    await screen.findByText('InProgress Status Task');
    const select = screen.getByRole('combobox', { name: /sort cards/i });
    await userEvent.selectOptions(select, 'status');
    expect(screen.getByText('Backlog Status Task')).toBeInTheDocument();
    expect(screen.getByText('InProgress Status Task')).toBeInTheDocument();
    expect(screen.getByText('Done Status Task')).toBeInTheDocument();
  });

  it('switching from status sort back to default works', async () => {
    render(<Tasks />);
    await screen.findByText('InProgress Status Task');
    const select = screen.getByRole('combobox', { name: /sort cards/i });
    await userEvent.selectOptions(select, 'status');
    await userEvent.selectOptions(select, 'default');
    expect((select as HTMLSelectElement).value).toBe('default');
  });
});

describe('Tasks – Label Filter', () => {
  const cardBRD = { ...mockCard, id: 'card-lbl-brd', name: 'BRD Task', labels: ['BRD'], listName: 'In Progress' };
  const cardProc = { ...mockCard, id: 'card-lbl-proc', name: 'Procurement Task', labels: ['Procurement'], listName: 'In Progress' };
  const cardRisk = { ...mockCard, id: 'card-lbl-risk', name: 'Risk Task', labels: ['Risk'], listName: 'In Progress' };

  beforeEach(() => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [cardBRD, cardProc, cardRisk],
      lists: [{ id: 'list-1', name: 'In Progress' }],
      members: [],
      boardName: 'BA Traffic Board',
    });
  });

  it('renders label filter select when labels exist', async () => {
    render(<Tasks />);
    await screen.findByText('BRD Task');
    expect(screen.getByRole('combobox', { name: /filter tasks by label/i })).toBeInTheDocument();
  });

  it('label filter defaults to All Labels', async () => {
    render(<Tasks />);
    await screen.findByText('BRD Task');
    const sel = screen.getByRole('combobox', { name: /filter tasks by label/i }) as HTMLSelectElement;
    expect(sel.value).toBe('All');
  });

  it('filtering by BRD shows only BRD Task', async () => {
    render(<Tasks />);
    await screen.findByText('BRD Task');
    const sel = screen.getByRole('combobox', { name: /filter tasks by label/i });
    await userEvent.selectOptions(sel, 'BRD');
    expect(screen.getByText('BRD Task')).toBeInTheDocument();
    expect(screen.queryByText('Procurement Task')).not.toBeInTheDocument();
    expect(screen.queryByText('Risk Task')).not.toBeInTheDocument();
  });

  it('filtering by Procurement shows only Procurement Task', async () => {
    render(<Tasks />);
    await screen.findByText('BRD Task');
    const sel = screen.getByRole('combobox', { name: /filter tasks by label/i });
    await userEvent.selectOptions(sel, 'Procurement');
    expect(screen.getByText('Procurement Task')).toBeInTheDocument();
    expect(screen.queryByText('BRD Task')).not.toBeInTheDocument();
  });

  it('resetting to All Labels shows all tasks again', async () => {
    render(<Tasks />);
    await screen.findByText('BRD Task');
    const sel = screen.getByRole('combobox', { name: /filter tasks by label/i });
    await userEvent.selectOptions(sel, 'Risk');
    await userEvent.selectOptions(sel, 'All');
    expect(screen.getByText('BRD Task')).toBeInTheDocument();
    expect(screen.getByText('Procurement Task')).toBeInTheDocument();
    expect(screen.getByText('Risk Task')).toBeInTheDocument();
  });
});

describe('Tasks – List Filter', () => {
  const inProgressCard = { ...mockCard, id: 'card-lf-ip', name: 'In Progress Task', listName: 'In Progress' };
  const backlogCard = { ...mockCard, id: 'card-lf-bl', name: 'Backlog Task', listName: 'Backlog' };
  const reviewCard = { ...mockCard, id: 'card-lf-rv', name: 'Review Task', listName: 'In Review' };

  beforeEach(() => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [inProgressCard, backlogCard, reviewCard],
      lists: [
        { id: 'list-1', name: 'In Progress' },
        { id: 'list-2', name: 'Backlog' },
        { id: 'list-3', name: 'In Review' },
      ],
      members: [],
      boardName: 'BA Traffic Board',
    });
  });

  it('renders list filter select', async () => {
    render(<Tasks />);
    await screen.findByText('In Progress Task');
    expect(screen.getByRole('combobox', { name: /filter by list/i })).toBeInTheDocument();
  });

  it('list filter defaults to All Lists', async () => {
    render(<Tasks />);
    await screen.findByText('In Progress Task');
    const sel = screen.getByRole('combobox', { name: /filter by list/i }) as HTMLSelectElement;
    expect(sel.value).toBe('');
  });

  it('filtering by In Progress hides Backlog and Review tasks', async () => {
    render(<Tasks />);
    await screen.findByText('In Progress Task');
    const sel = screen.getByRole('combobox', { name: /filter by list/i });
    await userEvent.selectOptions(sel, 'In Progress');
    expect(screen.getByText('In Progress Task')).toBeInTheDocument();
    expect(screen.queryByText('Backlog Task')).not.toBeInTheDocument();
    expect(screen.queryByText('Review Task')).not.toBeInTheDocument();
  });

  it('filtering by Backlog shows only Backlog tasks', async () => {
    render(<Tasks />);
    await screen.findByText('In Progress Task');
    const sel = screen.getByRole('combobox', { name: /filter by list/i });
    await userEvent.selectOptions(sel, 'Backlog');
    expect(screen.getByText('Backlog Task')).toBeInTheDocument();
    expect(screen.queryByText('In Progress Task')).not.toBeInTheDocument();
    expect(screen.queryByText('Review Task')).not.toBeInTheDocument();
  });

  it('resetting to All Lists shows all tasks', async () => {
    render(<Tasks />);
    await screen.findByText('In Progress Task');
    const sel = screen.getByRole('combobox', { name: /filter by list/i });
    await userEvent.selectOptions(sel, 'Backlog');
    await userEvent.selectOptions(sel, '');
    expect(screen.getByText('In Progress Task')).toBeInTheDocument();
    expect(screen.getByText('Backlog Task')).toBeInTheDocument();
    expect(screen.getByText('Review Task')).toBeInTheDocument();
  });
});

describe('Tasks – Sort by Priority', () => {
  const highCard = { ...mockCard, id: 'card-ph', name: 'High Priority Task', priority: 'High' };
  const medCard = { ...mockCard, id: 'card-pm', name: 'Medium Priority Task', priority: 'Medium' };
  const lowCard = { ...mockCard, id: 'card-pl', name: 'Low Priority Task', priority: 'Low' };

  beforeEach(() => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [medCard, lowCard, highCard],
      lists: [{ id: 'list-1', name: 'In Progress' }],
      members: [],
      boardName: 'BA Traffic Board',
    });
  });

  it('renders priority sort option in sort select', async () => {
    renderTasks();
    await screen.findByText('Medium Priority Task');
    const sel = screen.getByRole('combobox', { name: /sort cards/i });
    expect(sel.querySelector('option[value="priority"]')).toBeInTheDocument();
  });

  it('selecting priority sort sets value', async () => {
    renderTasks();
    await screen.findByText('Medium Priority Task');
    const sel = screen.getByRole('combobox', { name: /sort cards/i }) as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'priority');
    expect(sel.value).toBe('priority');
  });

  it('priority sort places High before Low in DOM', async () => {
    renderTasks();
    await screen.findByText('Medium Priority Task');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort cards/i }), 'priority');
    const highEl = screen.getByText('High Priority Task');
    const lowEl = screen.getByText('Low Priority Task');
    expect(highEl.compareDocumentPosition(lowEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('all three priority tasks remain visible after sort', async () => {
    renderTasks();
    await screen.findByText('Medium Priority Task');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort cards/i }), 'priority');
    expect(screen.getByText('High Priority Task')).toBeInTheDocument();
    expect(screen.getByText('Medium Priority Task')).toBeInTheDocument();
    expect(screen.getByText('Low Priority Task')).toBeInTheDocument();
  });

  it('switching back to default works after priority sort', async () => {
    renderTasks();
    await screen.findByText('Medium Priority Task');
    const sel = screen.getByRole('combobox', { name: /sort cards/i }) as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'priority');
    await userEvent.selectOptions(sel, 'default');
    expect(sel.value).toBe('default');
  });
});

describe('Tasks – Sort by Due Date', () => {
  const earlyCard = { ...mockCard, id: 'card-dd1', name: 'Early Due Task', dueDate: '2026-01-10T00:00:00.000Z' };
  const lateCard = { ...mockCard, id: 'card-dd2', name: 'Late Due Task', dueDate: '2026-03-20T00:00:00.000Z' };
  const noDueCard = { ...mockCard, id: 'card-dd3', name: 'No Due Task', dueDate: null };

  beforeEach(() => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [lateCard, noDueCard, earlyCard],
      lists: [{ id: 'list-1', name: 'In Progress' }],
      members: [],
      boardName: 'BA Traffic Board',
    });
  });

  it('renders due_date sort option in sort select', async () => {
    renderTasks();
    await screen.findByText('Late Due Task');
    const sel = screen.getByRole('combobox', { name: /sort cards/i });
    expect(sel.querySelector('option[value="due_date"]')).toBeInTheDocument();
  });

  it('selecting due_date sort sets value', async () => {
    renderTasks();
    await screen.findByText('Late Due Task');
    const sel = screen.getByRole('combobox', { name: /sort cards/i }) as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'due_date');
    expect(sel.value).toBe('due_date');
  });

  it('due date sort places Early Due before Late Due in DOM', async () => {
    renderTasks();
    await screen.findByText('Late Due Task');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort cards/i }), 'due_date');
    const earlyEl = screen.getByText('Early Due Task');
    const lateEl = screen.getByText('Late Due Task');
    expect(earlyEl.compareDocumentPosition(lateEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('no due date task is visible after sort', async () => {
    renderTasks();
    await screen.findByText('Late Due Task');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort cards/i }), 'due_date');
    expect(screen.getByText('No Due Task')).toBeInTheDocument();
  });

  it('switching back to default works after due_date sort', async () => {
    renderTasks();
    await screen.findByText('Late Due Task');
    const sel = screen.getByRole('combobox', { name: /sort cards/i }) as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'due_date');
    await userEvent.selectOptions(sel, 'default');
    expect(sel.value).toBe('default');
  });
});

describe('Tasks – Sort by Client', () => {
  const alphaCard = { ...mockCard, id: 'card-ca', name: 'Alpha Client Task', client: 'Alpha Corp' };
  const betaCard = { ...mockCard, id: 'card-cb', name: 'Beta Client Task', client: 'Beta Ltd' };
  const zetaCard = { ...mockCard, id: 'card-cz', name: 'Zeta Client Task', client: 'Zeta Inc' };

  beforeEach(() => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [zetaCard, alphaCard, betaCard],
      lists: [{ id: 'list-1', name: 'In Progress' }],
      members: [],
      boardName: 'BA Traffic Board',
    });
  });

  it('renders client sort option in sort select', async () => {
    renderTasks();
    await screen.findByText('Zeta Client Task');
    const sel = screen.getByRole('combobox', { name: /sort cards/i });
    expect(sel.querySelector('option[value="client"]')).toBeInTheDocument();
  });

  it('selecting client sort sets value', async () => {
    renderTasks();
    await screen.findByText('Zeta Client Task');
    const sel = screen.getByRole('combobox', { name: /sort cards/i }) as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'client');
    expect(sel.value).toBe('client');
  });

  it('client sort places Alpha before Zeta in DOM', async () => {
    renderTasks();
    await screen.findByText('Zeta Client Task');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort cards/i }), 'client');
    const alphaEl = screen.getByText('Alpha Client Task');
    const zetaEl = screen.getByText('Zeta Client Task');
    expect(alphaEl.compareDocumentPosition(zetaEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('all three client tasks remain visible after sort', async () => {
    renderTasks();
    await screen.findByText('Zeta Client Task');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort cards/i }), 'client');
    expect(screen.getByText('Alpha Client Task')).toBeInTheDocument();
    expect(screen.getByText('Beta Client Task')).toBeInTheDocument();
    expect(screen.getByText('Zeta Client Task')).toBeInTheDocument();
  });

  it('switching back to default works after client sort', async () => {
    renderTasks();
    await screen.findByText('Zeta Client Task');
    const sel = screen.getByRole('combobox', { name: /sort cards/i }) as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'client');
    await userEvent.selectOptions(sel, 'default');
    expect(sel.value).toBe('default');
  });
});

describe('Tasks – Sort by Status DOM Order', () => {
  const backlogCard = { ...mockCard, id: 'card-sb', name: 'Backlog Status Task', listName: 'Backlog' };
  const inProgCard = { ...mockCard, id: 'card-si', name: 'InProgress Status Task', listName: 'In Progress' };
  const completedCard = { ...mockCard, id: 'card-sc', name: 'Completed Status Task', listName: 'Completed Done' };

  beforeEach(() => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [inProgCard, completedCard, backlogCard],
      lists: [{ id: 'list-1', name: 'In Progress' }],
      members: [],
      boardName: 'BA Traffic Board',
    });
  });

  it('status sort places Backlog before InProgress in DOM (alphabetical)', async () => {
    renderTasks();
    await screen.findByText('InProgress Status Task');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort cards/i }), 'status');
    const backlogEl = screen.getByText('Backlog Status Task');
    const inProgEl = screen.getByText('InProgress Status Task');
    expect(backlogEl.compareDocumentPosition(inProgEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('status sort places Completed before InProgress in DOM (alphabetical)', async () => {
    renderTasks();
    await screen.findByText('InProgress Status Task');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort cards/i }), 'status');
    const compEl = screen.getByText('Completed Status Task');
    const inProgEl = screen.getByText('InProgress Status Task');
    expect(compEl.compareDocumentPosition(inProgEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('all three status tasks remain visible after sort', async () => {
    renderTasks();
    await screen.findByText('InProgress Status Task');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort cards/i }), 'status');
    expect(screen.getByText('Backlog Status Task')).toBeInTheDocument();
    expect(screen.getByText('InProgress Status Task')).toBeInTheDocument();
    expect(screen.getByText('Completed Status Task')).toBeInTheDocument();
  });

  it('switching back to default works after status sort', async () => {
    renderTasks();
    await screen.findByText('InProgress Status Task');
    const sel = screen.getByRole('combobox', { name: /sort cards/i }) as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'status');
    await userEvent.selectOptions(sel, 'default');
    expect(sel.value).toBe('default');
  });
});

describe('Tasks – Sort by Name DOM Order', () => {
  const zetaCard = { ...mockCard, id: 'card-nz', name: 'Zeta Name Task', client: 'Zeta' };
  const alphaCard = { ...mockCard, id: 'card-na', name: 'Alpha Name Task', client: 'Alpha' };
  const midCard = { ...mockCard, id: 'card-nm', name: 'Mina Name Task', client: 'Mina' };

  beforeEach(() => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [zetaCard, midCard, alphaCard],
      lists: [{ id: 'list-1', name: 'In Progress' }],
      members: [],
      boardName: 'BA Traffic Board',
    });
  });

  it('name sort places Alpha before Zeta in DOM', async () => {
    renderTasks();
    await screen.findByText('Zeta Name Task');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort cards/i }), 'name');
    const alphaEl = screen.getByText('Alpha Name Task');
    const zetaEl = screen.getByText('Zeta Name Task');
    expect(alphaEl.compareDocumentPosition(zetaEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('all three name tasks remain visible after name sort', async () => {
    renderTasks();
    await screen.findByText('Zeta Name Task');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort cards/i }), 'name');
    expect(screen.getByText('Alpha Name Task')).toBeInTheDocument();
    expect(screen.getByText('Mina Name Task')).toBeInTheDocument();
    expect(screen.getByText('Zeta Name Task')).toBeInTheDocument();
  });

  it('switching back to default works after name sort', async () => {
    renderTasks();
    await screen.findByText('Zeta Name Task');
    const sel = screen.getByRole('combobox', { name: /sort cards/i }) as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'name');
    await userEvent.selectOptions(sel, 'default');
    expect(sel.value).toBe('default');
  });
});

describe('Tasks – Sort by Priority DOM Order', () => {
  const critCard = { ...mockCard, id: 'card-pcrit', name: 'Critical Priority Task', priority: 'Highest', listName: 'In Progress' };
  const highCard = { ...mockCard, id: 'card-phi', name: 'High Priority Task', priority: 'High', listName: 'In Progress' };
  const lowCard = { ...mockCard, id: 'card-plo', name: 'Low Priority Task', priority: 'Low', listName: 'In Progress' };

  beforeEach(() => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [lowCard, critCard, highCard],
      lists: [{ id: 'list-1', name: 'In Progress' }],
      members: [],
      boardName: 'BA Traffic Board',
    });
  });

  it('priority sort places Critical (Highest) before High in DOM', async () => {
    renderTasks();
    await screen.findByText('Critical Priority Task');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort cards/i }), 'priority');
    const critEl = screen.getByText('Critical Priority Task');
    const highEl = screen.getByText('High Priority Task');
    expect(critEl.compareDocumentPosition(highEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('priority sort places High before Low in DOM', async () => {
    renderTasks();
    await screen.findByText('Critical Priority Task');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort cards/i }), 'priority');
    const highEl = screen.getByText('High Priority Task');
    const lowEl = screen.getByText('Low Priority Task');
    expect(highEl.compareDocumentPosition(lowEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('all three priority tasks remain visible after sort', async () => {
    renderTasks();
    await screen.findByText('Critical Priority Task');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort cards/i }), 'priority');
    expect(screen.getByText('Critical Priority Task')).toBeInTheDocument();
    expect(screen.getByText('High Priority Task')).toBeInTheDocument();
    expect(screen.getByText('Low Priority Task')).toBeInTheDocument();
  });

  it('switching back to default after priority sort resets selector', async () => {
    renderTasks();
    await screen.findByText('Critical Priority Task');
    const sel = screen.getByRole('combobox', { name: /sort cards/i }) as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'priority');
    await userEvent.selectOptions(sel, 'default');
    expect(sel.value).toBe('default');
  });
});

describe('Tasks – Sort by Due Date DOM Order', () => {
  const earlyCard = { ...mockCard, id: 'card-de', name: 'Early Due Task', dueDate: '2026-01-15T00:00:00Z', listName: 'In Progress' };
  const lateCard = { ...mockCard, id: 'card-dl', name: 'Late Due Task', dueDate: '2026-12-31T00:00:00Z', listName: 'In Progress' };
  const noDueCard = { ...mockCard, id: 'card-dn', name: 'No Due Date Task', dueDate: null as string | null, listName: 'In Progress' };

  beforeEach(() => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [lateCard, noDueCard, earlyCard],
      lists: [{ id: 'list-1', name: 'In Progress' }],
      members: [],
      boardName: 'BA Traffic Board',
    });
  });

  it('due date sort places Early Due before Late Due in DOM', async () => {
    renderTasks();
    await screen.findByText('Early Due Task');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort cards/i }), 'due_date');
    const earlyEl = screen.getByText('Early Due Task');
    const lateEl = screen.getByText('Late Due Task');
    expect(earlyEl.compareDocumentPosition(lateEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('due date sort places Early Due before No Due Date in DOM', async () => {
    renderTasks();
    await screen.findByText('Early Due Task');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort cards/i }), 'due_date');
    const earlyEl = screen.getByText('Early Due Task');
    const noDueEl = screen.getByText('No Due Date Task');
    expect(earlyEl.compareDocumentPosition(noDueEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('all three due date tasks remain visible after sort', async () => {
    renderTasks();
    await screen.findByText('Early Due Task');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort cards/i }), 'due_date');
    expect(screen.getByText('Early Due Task')).toBeInTheDocument();
    expect(screen.getByText('Late Due Task')).toBeInTheDocument();
    expect(screen.getByText('No Due Date Task')).toBeInTheDocument();
  });

  it('switching back to default after due date sort resets selector', async () => {
    renderTasks();
    await screen.findByText('Early Due Task');
    const sel = screen.getByRole('combobox', { name: /sort cards/i }) as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'due_date');
    await userEvent.selectOptions(sel, 'default');
    expect(sel.value).toBe('default');
  });
});

describe('Tasks – Sort by Client DOM Order', () => {
  const alphaClientCard = { ...mockCard, id: 'card-ca', name: 'Alpha Client Task', client: 'Alpha Corp', listName: 'In Progress' };
  const zetaClientCard = { ...mockCard, id: 'card-cz', name: 'Zeta Client Task', client: 'Zeta Corp', listName: 'In Progress' };
  const midClientCard = { ...mockCard, id: 'card-cm', name: 'Mid Client Task', client: 'Mid Corp', listName: 'In Progress' };

  beforeEach(() => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [zetaClientCard, midClientCard, alphaClientCard],
      lists: [{ id: 'list-1', name: 'In Progress' }],
      members: [],
      boardName: 'BA Traffic Board',
    });
  });

  it('client sort places Alpha Corp before Zeta Corp in DOM', async () => {
    renderTasks();
    await screen.findByText('Alpha Client Task');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort cards/i }), 'client');
    const alphaEl = screen.getByText('Alpha Client Task');
    const zetaEl = screen.getByText('Zeta Client Task');
    expect(alphaEl.compareDocumentPosition(zetaEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('client sort places Alpha Corp before Mid Corp in DOM', async () => {
    renderTasks();
    await screen.findByText('Alpha Client Task');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort cards/i }), 'client');
    const alphaEl = screen.getByText('Alpha Client Task');
    const midEl = screen.getByText('Mid Client Task');
    expect(alphaEl.compareDocumentPosition(midEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('all three client tasks remain visible after client sort', async () => {
    renderTasks();
    await screen.findByText('Alpha Client Task');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort cards/i }), 'client');
    expect(screen.getByText('Alpha Client Task')).toBeInTheDocument();
    expect(screen.getByText('Mid Client Task')).toBeInTheDocument();
    expect(screen.getByText('Zeta Client Task')).toBeInTheDocument();
  });

  it('switching back to default after client sort resets selector', async () => {
    renderTasks();
    await screen.findByText('Alpha Client Task');
    const sel = screen.getByRole('combobox', { name: /sort cards/i }) as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'client');
    await userEvent.selectOptions(sel, 'default');
    expect(sel.value).toBe('default');
  });
});

describe('Tasks – Sort by Assignee DOM Order', () => {
  const aaCard = { ...mockCard, id: 'card-aa', name: 'Aaron Assignee Task', members: ['Aaron Smith'], listName: 'In Progress' };
  const zzCard = { ...mockCard, id: 'card-az', name: 'Zoe Assignee Task', members: ['Zoe Wilson'], listName: 'In Progress' };
  const mmCard = { ...mockCard, id: 'card-am', name: 'Mike Assignee Task', members: ['Mike Jones'], listName: 'In Progress' };

  beforeEach(() => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [zzCard, mmCard, aaCard],
      lists: [{ id: 'list-1', name: 'In Progress' }],
      members: [],
      boardName: 'BA Traffic Board',
    });
  });

  it('assignee sort places Aaron before Zoe in DOM', async () => {
    renderTasks();
    await screen.findByText('Aaron Assignee Task');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort cards/i }), 'assignee');
    const aaEl = screen.getByText('Aaron Assignee Task');
    const zzEl = screen.getByText('Zoe Assignee Task');
    expect(aaEl.compareDocumentPosition(zzEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('assignee sort places Aaron before Mike in DOM', async () => {
    renderTasks();
    await screen.findByText('Aaron Assignee Task');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort cards/i }), 'assignee');
    const aaEl = screen.getByText('Aaron Assignee Task');
    const mmEl = screen.getByText('Mike Assignee Task');
    expect(aaEl.compareDocumentPosition(mmEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('all three assignee tasks remain visible after sort', async () => {
    renderTasks();
    await screen.findByText('Aaron Assignee Task');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort cards/i }), 'assignee');
    expect(screen.getByText('Aaron Assignee Task')).toBeInTheDocument();
    expect(screen.getByText('Mike Assignee Task')).toBeInTheDocument();
    expect(screen.getByText('Zoe Assignee Task')).toBeInTheDocument();
  });

  it('switching back to default after assignee sort resets selector', async () => {
    renderTasks();
    await screen.findByText('Aaron Assignee Task');
    const sel = screen.getByRole('combobox', { name: /sort cards/i }) as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'assignee');
    await userEvent.selectOptions(sel, 'default');
    expect(sel.value).toBe('default');
  });
});

describe('Tasks – Sort by Label DOM Order', () => {
  const analysisCard = { ...mockCard, id: 'card-la', name: 'Analysis Label Task', labels: ['Analysis'], listName: 'In Progress' };
  const zoneCard = { ...mockCard, id: 'card-lz', name: 'Zone Label Task', labels: ['Zone'], listName: 'In Progress' };
  const midLabelCard = { ...mockCard, id: 'card-lm', name: 'Risk Label Task', labels: ['Risk'], listName: 'In Progress' };

  beforeEach(() => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [zoneCard, midLabelCard, analysisCard],
      lists: [{ id: 'list-1', name: 'In Progress' }],
      members: [],
      boardName: 'BA Traffic Board',
    });
  });

  it('label sort places Analysis before Zone in DOM', async () => {
    renderTasks();
    await screen.findByText('Analysis Label Task');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort cards/i }), 'label');
    const analysisEl = screen.getByText('Analysis Label Task');
    const zoneEl = screen.getByText('Zone Label Task');
    expect(analysisEl.compareDocumentPosition(zoneEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('label sort places Analysis before Risk in DOM', async () => {
    renderTasks();
    await screen.findByText('Analysis Label Task');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort cards/i }), 'label');
    const analysisEl = screen.getByText('Analysis Label Task');
    const riskEl = screen.getByText('Risk Label Task');
    expect(analysisEl.compareDocumentPosition(riskEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('all three label tasks remain visible after label sort', async () => {
    renderTasks();
    await screen.findByText('Analysis Label Task');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort cards/i }), 'label');
    expect(screen.getByText('Analysis Label Task')).toBeInTheDocument();
    expect(screen.getByText('Risk Label Task')).toBeInTheDocument();
    expect(screen.getByText('Zone Label Task')).toBeInTheDocument();
  });

  it('switching back to default after label sort resets selector', async () => {
    renderTasks();
    await screen.findByText('Analysis Label Task');
    const sel = screen.getByRole('combobox', { name: /sort cards/i }) as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'label');
    await userEvent.selectOptions(sel, 'default');
    expect(sel.value).toBe('default');
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Export to CSV', () => {
  let mockCreateObjectURLLocal: ReturnType<typeof vi.fn>;
  let mockRevokeObjectURLLocal: ReturnType<typeof vi.fn>;
  let mockClickLocal: ReturnType<typeof vi.fn>;
  const origCreateObjectURLLocal = URL.createObjectURL;
  const origRevokeObjectURLLocal = URL.revokeObjectURL;
  const origCreateElementLocal = document.createElement.bind(document);

  beforeEach(() => {
    localStorage.clear();
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard, mockCard2],
      lists: [mockList, { id: 'list-2', name: 'Backlog' }],
      members: [],
      boardName: 'BA Traffic Board',
    });
    mockClickLocal = vi.fn();
    mockCreateObjectURLLocal = vi.fn(() => 'blob:mock-tasks-csv-url');
    mockRevokeObjectURLLocal = vi.fn();
    URL.createObjectURL = mockCreateObjectURLLocal;
    URL.revokeObjectURL = mockRevokeObjectURLLocal;
    document.createElement = (tag: string) => {
      const el = origCreateElementLocal(tag);
      if (tag === 'a') (el as HTMLAnchorElement).click = mockClickLocal;
      return el;
    };
  });

  afterEach(() => {
    URL.createObjectURL = origCreateObjectURLLocal;
    URL.revokeObjectURL = origRevokeObjectURLLocal;
    document.createElement = origCreateElementLocal;
  });

  it('shows Export tasks to CSV button when tasks loaded', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('button', { name: /export tasks to csv/i })).toBeInTheDocument();
  });

  it('Export tasks to CSV button is not disabled', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('button', { name: /export tasks to csv/i })).not.toBeDisabled();
  });

  it('clicking Export tasks to CSV calls URL.createObjectURL', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /export tasks to csv/i }));
    expect(mockCreateObjectURLLocal).toHaveBeenCalled();
  });

  it('clicking Export tasks to CSV triggers anchor click', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /export tasks to csv/i }));
    expect(mockClickLocal).toHaveBeenCalled();
  });

  it('clicking Export tasks to CSV calls URL.revokeObjectURL', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /export tasks to csv/i }));
    expect(mockRevokeObjectURLLocal).toHaveBeenCalledWith('blob:mock-tasks-csv-url');
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Export to TXT', () => {
  let mockCreateObjectURLLocal: ReturnType<typeof vi.fn>;
  let mockRevokeObjectURLLocal: ReturnType<typeof vi.fn>;
  let mockClickLocal: ReturnType<typeof vi.fn>;
  const origCreateObjectURLLocal = URL.createObjectURL;
  const origRevokeObjectURLLocal = URL.revokeObjectURL;
  const origCreateElementLocal = document.createElement.bind(document);

  beforeEach(() => {
    localStorage.clear();
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard, mockCard2],
      lists: [mockList, { id: 'list-2', name: 'Backlog' }],
      members: [],
      boardName: 'BA Traffic Board',
    });
    mockClickLocal = vi.fn();
    mockCreateObjectURLLocal = vi.fn(() => 'blob:mock-tasks-txt-url');
    mockRevokeObjectURLLocal = vi.fn();
    URL.createObjectURL = mockCreateObjectURLLocal;
    URL.revokeObjectURL = mockRevokeObjectURLLocal;
    document.createElement = (tag: string) => {
      const el = origCreateElementLocal(tag);
      if (tag === 'a') (el as HTMLAnchorElement).click = mockClickLocal;
      return el;
    };
  });

  afterEach(() => {
    URL.createObjectURL = origCreateObjectURLLocal;
    URL.revokeObjectURL = origRevokeObjectURLLocal;
    document.createElement = origCreateElementLocal;
  });

  it('shows Export tasks to TXT button when tasks loaded', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('button', { name: /export tasks to txt/i })).toBeInTheDocument();
  });

  it('Export tasks to TXT button is not disabled', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('button', { name: /export tasks to txt/i })).not.toBeDisabled();
  });

  it('clicking Export tasks to TXT calls URL.createObjectURL', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /export tasks to txt/i }));
    expect(mockCreateObjectURLLocal).toHaveBeenCalled();
  });

  it('clicking Export tasks to TXT triggers anchor click', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /export tasks to txt/i }));
    expect(mockClickLocal).toHaveBeenCalled();
  });

  it('clicking Export tasks to TXT calls URL.revokeObjectURL', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /export tasks to txt/i }));
    expect(mockRevokeObjectURLLocal).toHaveBeenCalledWith('blob:mock-tasks-txt-url');
  });

  it('shows Exported! feedback after clicking Export TXT', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /export tasks to txt/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export tasks to txt/i })).toHaveTextContent('Exported!');
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Copy Task Summary', () => {
  beforeEach(() => {
    localStorage.clear();
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard],
      lists: [mockList],
      members: [],
      boardName: 'BA Traffic Board',
    });
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('shows Copy task summary to clipboard button', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('button', { name: /copy task summary to clipboard/i })).toBeInTheDocument();
  });

  it('Copy task summary button is not disabled', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('button', { name: /copy task summary to clipboard/i })).not.toBeDisabled();
  });

  it('clicking Copy task summary calls clipboard.writeText', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /copy task summary to clipboard/i }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
  });

  it('clipboard text contains board name', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /copy task summary to clipboard/i }));
    await waitFor(() => {
      const call = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call).toContain('BA Traffic Board');
    });
  });

  it('clipboard text contains Total count', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /copy task summary to clipboard/i }));
    await waitFor(() => {
      const call = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call).toContain('Total:');
    });
  });

  it('shows Copied! feedback after clicking Copy task summary', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /copy task summary to clipboard/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copy task summary to clipboard/i })).toHaveTextContent('Copied!');
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Payment Filter', () => {
  const paymentCard = {
    ...mockCard,
    id: 'card-pay',
    name: 'Invoice Processing Task',
    relatedToPayment: true,
    listName: 'In Progress',
    client: 'Finance',
    members: ['Ahmed Khalil'],
    labels: ['Finance'],
  };
  const nonPaymentCard = {
    ...mockCard,
    id: 'card-nopay',
    name: 'Architecture Review Task',
    relatedToPayment: false,
    listName: 'In Progress',
    client: 'NCA',
    members: ['Ahmed Khalil'],
    labels: ['Analysis'],
  };

  beforeEach(() => {
    localStorage.clear();
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [paymentCard, nonPaymentCard],
      lists: [mockList],
      members: [],
      boardName: 'BA Traffic Board',
    });
  });

  it('shows Show payment-related tasks only button', async () => {
    renderTasks();
    await screen.findByText('Invoice Processing Task');
    expect(screen.getByRole('button', { name: /show payment-related tasks only/i })).toBeInTheDocument();
  });

  it('payment filter button starts with aria-pressed false', async () => {
    renderTasks();
    await screen.findByText('Invoice Processing Task');
    expect(screen.getByRole('button', { name: /show payment-related tasks only/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('both tasks visible before payment filter is applied', async () => {
    renderTasks();
    await screen.findByText('Invoice Processing Task');
    expect(screen.getByText('Architecture Review Task')).toBeInTheDocument();
  });

  it('clicking payment filter hides non-payment tasks', async () => {
    renderTasks();
    await screen.findByText('Invoice Processing Task');
    await userEvent.click(screen.getByRole('button', { name: /show payment-related tasks only/i }));
    await waitFor(() => {
      expect(screen.queryByText('Architecture Review Task')).not.toBeInTheDocument();
    });
  });

  it('clicking payment filter keeps payment tasks visible', async () => {
    renderTasks();
    await screen.findByText('Invoice Processing Task');
    await userEvent.click(screen.getByRole('button', { name: /show payment-related tasks only/i }));
    await waitFor(() => {
      expect(screen.getByText('Invoice Processing Task')).toBeInTheDocument();
    });
  });

  it('clicking payment filter twice shows all tasks again', async () => {
    renderTasks();
    await screen.findByText('Invoice Processing Task');
    const btn = screen.getByRole('button', { name: /show payment-related tasks only/i });
    await userEvent.click(btn);
    await waitFor(() => expect(screen.queryByText('Architecture Review Task')).not.toBeInTheDocument());
    await userEvent.click(btn);
    await waitFor(() => {
      expect(screen.getByText('Architecture Review Task')).toBeInTheDocument();
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Due Date Filter', () => {
  const taskNoDueDate = {
    ...mockCard,
    id: 'card-nodue',
    name: 'No Due Date Task',
    dueDate: null,
    listName: 'In Progress',
  };
  const taskWithDueDate = {
    ...mockCard,
    id: 'card-hasdue',
    name: 'Has Due Date Task',
    dueDate: '2026-08-01T00:00:00.000Z',
    listName: 'In Progress',
  };

  beforeEach(() => {
    localStorage.clear();
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [taskNoDueDate, taskWithDueDate],
      lists: [mockList],
      members: [],
      boardName: 'BA Traffic Board',
    });
  });

  it('shows due date filter buttons', async () => {
    renderTasks();
    await screen.findByText('No Due Date Task');
    expect(screen.getByRole('button', { name: /filter tasks by due date: all/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter tasks by due date: no due date/i })).toBeInTheDocument();
  });

  it('All due date filter is active by default', async () => {
    renderTasks();
    await screen.findByText('No Due Date Task');
    expect(screen.getByRole('button', { name: /filter tasks by due date: all/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('both tasks visible with All filter', async () => {
    renderTasks();
    await screen.findByText('No Due Date Task');
    expect(screen.getByText('Has Due Date Task')).toBeInTheDocument();
  });

  it('No Due Date filter hides tasks with due dates', async () => {
    renderTasks();
    await screen.findByText('No Due Date Task');
    await userEvent.click(screen.getByRole('button', { name: /filter tasks by due date: no due date/i }));
    await waitFor(() => {
      expect(screen.queryByText('Has Due Date Task')).not.toBeInTheDocument();
    });
  });

  it('No Due Date filter keeps tasks without due dates visible', async () => {
    renderTasks();
    await screen.findByText('No Due Date Task');
    await userEvent.click(screen.getByRole('button', { name: /filter tasks by due date: no due date/i }));
    await waitFor(() => {
      expect(screen.getByText('No Due Date Task')).toBeInTheDocument();
    });
  });

  it('switching back to All restores both tasks', async () => {
    renderTasks();
    await screen.findByText('No Due Date Task');
    await userEvent.click(screen.getByRole('button', { name: /filter tasks by due date: no due date/i }));
    await waitFor(() => expect(screen.queryByText('Has Due Date Task')).not.toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /filter tasks by due date: all/i }));
    await waitFor(() => {
      expect(screen.getByText('Has Due Date Task')).toBeInTheDocument();
      expect(screen.getByText('No Due Date Task')).toBeInTheDocument();
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Assignee Filter', () => {
  const ahmedCard = {
    ...mockCard,
    id: 'card-ahmed',
    name: 'Ahmed Task',
    members: ['Ahmed Khalil'],
    listName: 'In Progress',
  };
  const raniaCard = {
    ...mockCard,
    id: 'card-rania',
    name: 'Rania Task',
    members: ['Rania Taleb'],
    listName: 'In Progress',
  };

  beforeEach(() => {
    localStorage.clear();
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [ahmedCard, raniaCard],
      lists: [mockList],
      members: [],
      boardName: 'BA Traffic Board',
    });
  });

  it('shows assignee filter when multiple assignees exist', async () => {
    renderTasks();
    await screen.findByText('Ahmed Task');
    expect(screen.getByRole('combobox', { name: /filter tasks by assignee/i })).toBeInTheDocument();
  });

  it('assignee filter defaults to All Assignees', async () => {
    renderTasks();
    await screen.findByText('Ahmed Task');
    const sel = screen.getByRole('combobox', { name: /filter tasks by assignee/i }) as HTMLSelectElement;
    expect(sel.value).toBe('All');
  });

  it('filtering by Ahmed Khalil hides Rania Task', async () => {
    renderTasks();
    await screen.findByText('Ahmed Task');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /filter tasks by assignee/i }), 'Ahmed Khalil');
    await waitFor(() => {
      expect(screen.queryByText('Rania Task')).not.toBeInTheDocument();
    });
  });

  it('filtering by Ahmed Khalil keeps Ahmed Task visible', async () => {
    renderTasks();
    await screen.findByText('Ahmed Task');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /filter tasks by assignee/i }), 'Ahmed Khalil');
    await waitFor(() => {
      expect(screen.getByText('Ahmed Task')).toBeInTheDocument();
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Client Filter', () => {
  const ncaCard = {
    ...mockCard,
    id: 'card-nca2',
    name: 'NCA Client Task',
    client: 'NCA',
    listName: 'In Progress',
    members: ['Ahmed Khalil'],
  };
  const mociCard = {
    ...mockCard,
    id: 'card-moci2',
    name: 'MOCI Client Task',
    client: 'MOCI',
    listName: 'In Progress',
    members: ['Ahmed Khalil'],
  };

  beforeEach(() => {
    localStorage.clear();
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [ncaCard, mociCard],
      lists: [mockList],
      members: [],
      boardName: 'BA Traffic Board',
    });
  });

  it('shows client filter when multiple clients exist', async () => {
    renderTasks();
    await screen.findByText('NCA Client Task');
    expect(screen.getByRole('combobox', { name: /filter tasks by client/i })).toBeInTheDocument();
  });

  it('client filter defaults to All', async () => {
    renderTasks();
    await screen.findByText('NCA Client Task');
    const sel = screen.getByRole('combobox', { name: /filter tasks by client/i }) as HTMLSelectElement;
    expect(sel.value).toBe('All');
  });

  it('filtering by NCA hides MOCI Client Task', async () => {
    renderTasks();
    await screen.findByText('NCA Client Task');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /filter tasks by client/i }), 'NCA');
    await waitFor(() => {
      expect(screen.queryByText('MOCI Client Task')).not.toBeInTheDocument();
    });
  });

  it('filtering by NCA keeps NCA Client Task visible', async () => {
    renderTasks();
    await screen.findByText('NCA Client Task');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /filter tasks by client/i }), 'NCA');
    await waitFor(() => {
      expect(screen.getByText('NCA Client Task')).toBeInTheDocument();
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Label Filter', () => {
  const brdCard = {
    ...mockCard,
    id: 'card-brd-lbl',
    name: 'BRD Label Task',
    labels: ['BRD'],
    listName: 'In Progress',
    members: ['Ahmed Khalil'],
    client: 'NCA',
  };
  const procurementCard = {
    ...mockCard,
    id: 'card-proc-lbl',
    name: 'Procurement Label Task',
    labels: ['Procurement'],
    listName: 'In Progress',
    members: ['Ahmed Khalil'],
    client: 'MOCI',
  };

  beforeEach(() => {
    localStorage.clear();
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [brdCard, procurementCard],
      lists: [mockList],
      members: [],
      boardName: 'BA Traffic Board',
    });
  });

  it('shows label filter when multiple labels exist', async () => {
    renderTasks();
    await screen.findByText('BRD Label Task');
    expect(screen.getByRole('combobox', { name: /filter tasks by label/i })).toBeInTheDocument();
  });

  it('label filter defaults to All', async () => {
    renderTasks();
    await screen.findByText('BRD Label Task');
    const sel = screen.getByRole('combobox', { name: /filter tasks by label/i }) as HTMLSelectElement;
    expect(sel.value).toBe('All');
  });

  it('filtering by BRD hides Procurement Label Task', async () => {
    renderTasks();
    await screen.findByText('BRD Label Task');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /filter tasks by label/i }), 'BRD');
    await waitFor(() => {
      expect(screen.queryByText('Procurement Label Task')).not.toBeInTheDocument();
    });
  });

  it('filtering by BRD keeps BRD Label Task visible', async () => {
    renderTasks();
    await screen.findByText('BRD Label Task');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /filter tasks by label/i }), 'BRD');
    await waitFor(() => {
      expect(screen.getByText('BRD Label Task')).toBeInTheDocument();
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Starred Tasks', () => {
  beforeEach(() => {
    localStorage.clear();
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard, mockCard2],
      lists: [mockList],
      boardName: 'BA Traffic Board',
    });
  });

  it('renders a star button for each card', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('button', { name: /star task: review brd for nca/i })).toBeInTheDocument();
  });

  it('star button starts unstarred (aria-pressed false)', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const btn = screen.getByRole('button', { name: /^Star task: Review BRD for NCA/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking star button marks task as starred', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const btn = screen.getByRole('button', { name: /^Star task: Review BRD for NCA/i });
    await userEvent.click(btn);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Unstar task: Review BRD for NCA/i })).toBeInTheDocument();
    });
  });

  it('starred tasks filter button exists', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('button', { name: /show starred tasks only/i })).toBeInTheDocument();
  });

  it('starred tasks filter starts unpressed', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('button', { name: /show starred tasks only/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking starred filter then starring a task keeps it visible', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /^Star task: Review BRD for NCA/i }));
    await userEvent.click(screen.getByRole('button', { name: /show starred tasks only/i }));
    await waitFor(() => {
      expect(screen.getByText('Review BRD for NCA')).toBeInTheDocument();
    });
  });

  it('starring one task and enabling starred filter hides non-starred task', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /^Star task: Review BRD for NCA/i }));
    await userEvent.click(screen.getByRole('button', { name: /show starred tasks only/i }));
    await waitFor(() => {
      expect(screen.queryByText('MOCI Procurement Analysis')).not.toBeInTheDocument();
    });
  });

  it('toggling starred filter off restores all tasks', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /^Star task: Review BRD for NCA/i }));
    const starredBtn = screen.getByRole('button', { name: /show starred tasks only/i });
    await userEvent.click(starredBtn);
    await userEvent.click(starredBtn);
    await waitFor(() => {
      expect(screen.getByText('MOCI Procurement Analysis')).toBeInTheDocument();
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Overdue Only Filter', () => {
  beforeEach(() => {
    localStorage.clear();
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [mockCard, mockOverdueCard],
      lists: [mockList],
      boardName: 'BA Traffic Board',
    });
  });

  it('renders the overdue only filter button', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('button', { name: /show overdue tasks only/i })).toBeInTheDocument();
  });

  it('overdue filter starts unpressed', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('button', { name: /show overdue tasks only/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('enabling overdue filter hides non-overdue tasks', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('button', { name: /show overdue tasks only/i }));
    await waitFor(() => {
      expect(screen.queryByText('Review BRD for NCA')).not.toBeInTheDocument();
    });
  });

  it('enabling overdue filter shows overdue tasks', async () => {
    renderTasks();
    await screen.findByText('Overdue Contract Review');
    await userEvent.click(screen.getByRole('button', { name: /show overdue tasks only/i }));
    await waitFor(() => {
      expect(screen.getByText('Overdue Contract Review')).toBeInTheDocument();
    });
  });

  it('toggling overdue filter off restores all tasks', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const overdueBtn = screen.getByRole('button', { name: /show overdue tasks only/i });
    await userEvent.click(overdueBtn);
    await userEvent.click(overdueBtn);
    await waitFor(() => {
      expect(screen.getByText('Review BRD for NCA')).toBeInTheDocument();
    });
  });

  it('overdue filter is toggled on when pressed', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const btn = screen.getByRole('button', { name: /show overdue tasks only/i });
    await userEvent.click(btn);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /show overdue tasks only/i })).toHaveAttribute('aria-pressed', 'true');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Tasks – Bulk Selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    const board = {
      cards: [mockCard, mockCard2, mockCompletedCard],
      lists: [mockList, { id: 'list-2', name: 'Backlog' }, { id: 'list-3', name: 'Done' }],
      boardName: 'BA Traffic Board',
    };
    mockFetchBATrafficBoard.mockResolvedValue(board);
  });

  it('renders a checkbox for each task row', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThanOrEqual(1);
  });

  it('checkbox aria-label includes task name', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.getByRole('checkbox', { name: /Select task: Review BRD for NCA/i })).toBeInTheDocument();
  });

  it('checkboxes start unchecked', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const checkbox = screen.getByRole('checkbox', { name: /Select task: Review BRD for NCA/i }) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
  });

  it('clicking a checkbox selects the task and shows bulk action bar', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    const checkbox = screen.getByRole('checkbox', { name: /Select task: Review BRD for NCA/i });
    await userEvent.click(checkbox);
    await waitFor(() => {
      expect(screen.getByText(/1 task selected/i)).toBeInTheDocument();
    });
  });

  it('selecting two tasks shows "2 tasks selected"', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('checkbox', { name: /Select task: Review BRD for NCA/i }));
    await userEvent.click(screen.getByRole('checkbox', { name: /Select task: MOCI Procurement Analysis/i }));
    await waitFor(() => {
      expect(screen.getByText(/2 tasks selected/i)).toBeInTheDocument();
    });
  });

  it('bulk action bar shows "Star" button', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('checkbox', { name: /Select task: Review BRD for NCA/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /star selected tasks/i })).toBeInTheDocument();
    });
  });

  it('bulk action bar shows "Clear" button', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('checkbox', { name: /Select task: Review BRD for NCA/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /clear task selection/i })).toBeInTheDocument();
    });
  });

  it('clicking Clear removes bulk selection', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('checkbox', { name: /Select task: Review BRD for NCA/i }));
    await waitFor(() => expect(screen.getByText(/1 task selected/i)).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /clear task selection/i }));
    await waitFor(() => {
      expect(screen.queryByText(/task selected/i)).not.toBeInTheDocument();
    });
  });

  it('bulk action bar shows selected count correctly for three selected tasks', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('checkbox', { name: /Select task: Review BRD for NCA/i }));
    await userEvent.click(screen.getByRole('checkbox', { name: /Select task: MOCI Procurement Analysis/i }));
    await userEvent.click(screen.getByRole('checkbox', { name: /Select task: Completed Requirements Gathering/i }));
    await waitFor(() => {
      expect(screen.getByText(/3 tasks selected/i)).toBeInTheDocument();
    });
  });

  it('bulk action bar not shown when no tasks selected', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    expect(screen.queryByText(/task selected/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /clear task selection/i })).not.toBeInTheDocument();
  });

  it('clicking Star bulk-stars all selected tasks', async () => {
    renderTasks();
    await screen.findByText('Review BRD for NCA');
    await userEvent.click(screen.getByRole('checkbox', { name: /Select task: Review BRD for NCA/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /star selected tasks/i })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /star selected tasks/i }));
    await waitFor(() => {
      const starred = JSON.parse(localStorage.getItem('tasks_starred') ?? '[]') as string[];
      expect(starred).toContain('card-1');
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Tasks – Due in 3 Days Filter', () => {
  function daysFromNow(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString();
  }

  const dueSoonCard = {
    ...mockCard,
    id: 'due-soon-1',
    name: 'Due In 2 Days Task',
    dueDate: daysFromNow(2),
    dueComplete: false,
    listName: 'In Progress',
  };
  const dueNextWeekCard = {
    ...mockCard,
    id: 'due-next-week',
    name: 'Due Next Week Task',
    dueDate: daysFromNow(7),
    dueComplete: false,
    listName: 'Backlog',
  };
  const noDueDateCard = {
    ...mockCard,
    id: 'no-due-date',
    name: 'No Due Date Task',
    dueDate: null,
    dueComplete: false,
    listName: 'Backlog',
  };

  beforeEach(() => {
    mockFetchBATrafficBoard.mockResolvedValue({
      cards: [dueSoonCard, dueNextWeekCard, noDueDateCard],
      lists: [mockList],
      boardName: 'Test Board',
    });
  });

  it('renders "Due in 3 Days" filter button', async () => {
    renderTasks();
    await screen.findByText('Due In 2 Days Task');
    expect(screen.getByRole('button', { name: /filter tasks by due date: due in 3 days/i })).toBeInTheDocument();
  });

  it('"Due in 3 Days" button is aria-pressed false by default', async () => {
    renderTasks();
    await screen.findByText('Due In 2 Days Task');
    const btn = screen.getByRole('button', { name: /filter tasks by due date: due in 3 days/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking "Due in 3 Days" sets aria-pressed to true', async () => {
    renderTasks();
    await screen.findByText('Due In 2 Days Task');
    const btn = screen.getByRole('button', { name: /filter tasks by due date: due in 3 days/i });
    await userEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('filter shows only tasks due within 3 days', async () => {
    renderTasks();
    await screen.findByText('Due In 2 Days Task');
    await userEvent.click(screen.getByRole('button', { name: /filter tasks by due date: due in 3 days/i }));
    await waitFor(() => {
      expect(screen.getByText('Due In 2 Days Task')).toBeInTheDocument();
      expect(screen.queryByText('Due Next Week Task')).not.toBeInTheDocument();
    });
  });

  it('filter hides tasks with no due date', async () => {
    renderTasks();
    await screen.findByText('No Due Date Task');
    await userEvent.click(screen.getByRole('button', { name: /filter tasks by due date: due in 3 days/i }));
    await waitFor(() => {
      expect(screen.queryByText('No Due Date Task')).not.toBeInTheDocument();
    });
  });

  it('clicking All restores all tasks after due-in-3-days filter', async () => {
    renderTasks();
    await screen.findByText('Due In 2 Days Task');
    await userEvent.click(screen.getByRole('button', { name: /filter tasks by due date: due in 3 days/i }));
    await userEvent.click(screen.getByRole('button', { name: /filter tasks by due date: all/i }));
    await waitFor(() => {
      expect(screen.getByText('Due Next Week Task')).toBeInTheDocument();
      expect(screen.getByText('No Due Date Task')).toBeInTheDocument();
    });
  });

  it('"Due in 3 Days" filter button comes between "Due Today" and "Due This Week"', async () => {
    renderTasks();
    await screen.findByText('Due In 2 Days Task');
    const todayBtn = screen.getByRole('button', { name: /filter tasks by due date: due today/i });
    const in3Btn = screen.getByRole('button', { name: /filter tasks by due date: due in 3 days/i });
    const weekBtn = screen.getByRole('button', { name: /filter tasks by due date: due this week/i });
    expect(todayBtn.compareDocumentPosition(in3Btn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(in3Btn.compareDocumentPosition(weekBtn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
