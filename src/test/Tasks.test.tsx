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
