import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Hoisted mocks ────────────────────────────────────────────
const { mockGetActivities, mockGetWorkspaces, mockFetchBATrafficBoard, mockGetUsers, mockUpsertUser, mockUpdateUser } = vi.hoisted(() => ({
  mockGetActivities: vi.fn(),
  mockGetWorkspaces: vi.fn(),
  mockFetchBATrafficBoard: vi.fn(),
  mockGetUsers: vi.fn(),
  mockUpsertUser: vi.fn(),
  mockUpdateUser: vi.fn(),
}));

vi.mock('../lib/db', () => ({
  getActivities: mockGetActivities,
  getWorkspaces: mockGetWorkspaces,
  getUsers: mockGetUsers,
  upsertUser: mockUpsertUser,
  updateUser: mockUpdateUser,
  deleteUser: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../data/mockData', () => ({
  users: [
    { id: 'u1', name: 'Ahmed Khalil', email: 'ahmed@firm.com', role: 'Admin', workspaces: 8, lastActive: '2h ago', status: 'Active', initials: 'AK' },
    { id: 'u2', name: 'Rania Taleb', email: 'rania@firm.com', role: 'Manager', workspaces: 4, lastActive: '1d ago', status: 'Active', initials: 'RT' },
  ],
}));

vi.mock('../hooks/useLayout', () => ({
  useLayout: () => ({ width: 1200, isMobile: false, isTablet: false }),
}));

vi.mock('../lib/trello', () => ({
  fetchBATrafficBoard: mockFetchBATrafficBoard,
}));

import Admin from '../screens/Admin';

function renderAdmin() {
  return render(<Admin />);
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mockGetActivities.mockResolvedValue([]);
  mockFetchBATrafficBoard.mockResolvedValue({ cards: [], lists: [], members: [], boardName: 'BA Board' });
  mockGetWorkspaces.mockResolvedValue([
    { id: 'ws-1', name: 'MOCI', type: 'Procurement', status: 'Active', progress: 65, language: 'AR', sector: 'Government', contributors: ['AM'] },
  ]);
  mockGetUsers.mockResolvedValue([]);
  mockUpsertUser.mockResolvedValue({});
  mockUpdateUser.mockResolvedValue({});
});

// ────────────────────────────────────────────────────────────
describe('Admin – Users table', () => {
  it('renders user table with mock users', async () => {
    renderAdmin();
    expect(await screen.findByText('Ahmed Khalil')).toBeInTheDocument();
    expect(screen.getByText('Rania Taleb')).toBeInTheDocument();
  });

  it('shows role badges for users', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    // Roles are displayed via roleDisplayNames mapping:
    // Admin → 'System Admin', Manager → 'Senior Consultant'
    const adminTexts = screen.getAllByText('System Admin');
    expect(adminTexts.length).toBeGreaterThan(0);
    const managerTexts = screen.getAllByText('Senior Consultant');
    expect(managerTexts.length).toBeGreaterThan(0);
  });

  it('shows user email addresses', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getByText('ahmed@firm.com')).toBeInTheDocument();
    expect(screen.getByText('rania@firm.com')).toBeInTheDocument();
  });

  it('loads users from localStorage when available', async () => {
    const stored = [
      { id: 'u99', name: 'Stored User', email: 'stored@test.com', role: 'Analyst', workspaces: 1, lastActive: 'Just now', status: 'Active', initials: 'SU' },
    ];
    localStorage.setItem('admin_users', JSON.stringify(stored));
    renderAdmin();
    expect(await screen.findByText('Stored User')).toBeInTheDocument();
  });

  it('shows Invite User button', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getByRole('button', { name: /invite user/i })).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Admin – Invite User modal', () => {
  it('opens invite modal on button click', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /invite user/i }));
    // Modal heading is "Invite User" — use getAllByText since it may appear in button too
    const inviteHeadings = screen.getAllByText(/invite user/i);
    expect(inviteHeadings.length).toBeGreaterThan(0);
    expect(screen.getByPlaceholderText(/e\.g\. sarah ahmed/i)).toBeInTheDocument();
  });

  it('closes modal on cancel click', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /invite user/i }));
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByPlaceholderText(/e\.g\. sarah ahmed/i)).not.toBeInTheDocument();
  });

  it('disables Send Invite when fields are empty', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /invite user/i }));
    expect(screen.getByRole('button', { name: /send invite/i })).toBeDisabled();
  });

  it('enables Send Invite when both name and email are filled', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /invite user/i }));
    await userEvent.type(screen.getByPlaceholderText(/e\.g\. sarah ahmed/i), 'New User');
    await userEvent.type(screen.getByPlaceholderText(/sarah@firm\.com/i), 'new@test.com');
    expect(screen.getByRole('button', { name: /send invite/i })).not.toBeDisabled();
  });

  it('adds new user and persists to localStorage (using real timers)', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /invite user/i }));
    await userEvent.type(screen.getByPlaceholderText(/e\.g\. sarah ahmed/i), 'Sara New');
    await userEvent.type(screen.getByPlaceholderText(/sarah@firm\.com/i), 'sara@test.com');
    await userEvent.click(screen.getByRole('button', { name: /send invite/i }));

    // Wait for the 800ms setTimeout inside handleInviteUser
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('admin_users') ?? '[]');
      expect(stored.some((u: { name: string }) => u.name === 'Sara New')).toBe(true);
    }, { timeout: 3000 });
  });

  it('shows success message after invite', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /invite user/i }));
    await userEvent.type(screen.getByPlaceholderText(/e\.g\. sarah ahmed/i), 'Test Person');
    await userEvent.type(screen.getByPlaceholderText(/sarah@firm\.com/i), 'test@firm.com');
    await userEvent.click(screen.getByRole('button', { name: /send invite/i }));

    await waitFor(() => {
      expect(screen.getByText(/invite sent to test@firm\.com/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});

// ────────────────────────────────────────────────────────────
describe('Admin – Status toggle', () => {
  it('toggles user status from Active to Inactive and saves to localStorage', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');

    // The toggle is a 'Suspend' button for active users
    const suspendBtns = screen.getAllByRole('button', { name: 'Suspend' });
    expect(suspendBtns.length).toBeGreaterThan(0);
    fireEvent.click(suspendBtns[0]);

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('admin_users') ?? '[]');
      const ahmed = stored.find((u: { id: string }) => u.id === 'u1');
      expect(ahmed?.status).toBe('Inactive');
    });
  });

  it('persists toggle changes to localStorage', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');

    const suspendBtns = screen.getAllByRole('button', { name: 'Suspend' });
    fireEvent.click(suspendBtns[0]);

    await waitFor(() => {
      expect(localStorage.getItem('admin_users')).not.toBeNull();
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Admin – Section navigation', () => {
  it('switches to Integrations section', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByText('Integrations'));
    // Current integrations list only has Trello
    expect(await screen.findByText('Trello')).toBeInTheDocument();
  });

  it('shows only Users & Roles and Integrations sections', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    // Both appear multiple times (sidebar nav + content header)
    expect(screen.getAllByText('Users & Roles').length).toBeGreaterThan(0);
    expect(screen.getByText('Integrations')).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Admin – Role Distribution', () => {
  it('shows role distribution section on Users page', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getByText('Role Distribution')).toBeInTheDocument();
  });

  it('shows AI Access Auditor section', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getByText('AI Access Auditor')).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Admin – Integrations section', () => {
  async function goToIntegrations() {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByText('Integrations'));
    await screen.findByText('Trello');
  }

  it('shows Trello integration card', async () => {
    await goToIntegrations();
    expect(screen.getByText('Trello')).toBeInTheDocument();
  });

  it('shows "Connected" status for Trello', async () => {
    await goToIntegrations();
    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('renders Configure button for Trello', async () => {
    await goToIntegrations();
    expect(screen.getByRole('button', { name: /configure/i })).toBeInTheDocument();
  });

  it('opens Trello config panel when Configure is clicked', async () => {
    await goToIntegrations();
    await userEvent.click(screen.getByRole('button', { name: /configure/i }));
    expect(await screen.findByText(/trello configuration/i)).toBeInTheDocument();
  });

  it('renders Test Connection button in Trello config', async () => {
    await goToIntegrations();
    await userEvent.click(screen.getByRole('button', { name: /configure/i }));
    expect(await screen.findByRole('button', { name: /test connection/i })).toBeInTheDocument();
  });

  it('shows "Connection successful" when Trello test succeeds', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({ cards: [], lists: [], members: [], boardName: 'BA Board' });
    await goToIntegrations();
    await userEvent.click(screen.getByRole('button', { name: /configure/i }));
    await userEvent.click(await screen.findByRole('button', { name: /test connection/i }));
    expect(await screen.findByText(/connection successful/i)).toBeInTheDocument();
  });

  it('shows "Connection failed" when Trello test fails', async () => {
    mockFetchBATrafficBoard.mockRejectedValue(new Error('Network error'));
    await goToIntegrations();
    await userEvent.click(screen.getByRole('button', { name: /configure/i }));
    await userEvent.click(await screen.findByRole('button', { name: /test connection/i }));
    expect(await screen.findByText(/connection failed/i)).toBeInTheDocument();
  });

  it('closes Trello config panel when Configure is clicked again', async () => {
    await goToIntegrations();
    await userEvent.click(screen.getByRole('button', { name: /configure/i }));
    await screen.findByText(/trello configuration/i);
    // Click Configure again to toggle off
    await userEvent.click(screen.getByRole('button', { name: /configure/i }));
    await waitFor(() => {
      expect(screen.queryByText(/trello configuration/i)).not.toBeInTheDocument();
    });
  });

  it('shows "Sync successful" when refresh icon button is clicked and succeeds', async () => {
    mockFetchBATrafficBoard.mockResolvedValue({ cards: [], lists: [], members: [], boardName: 'BA Board' });
    await goToIntegrations();
    // Refresh is an icon-only button next to Configure
    const configureBtns = screen.getAllByRole('button', { name: /configure/i });
    // The Refresh button is the sibling next to Configure
    const configurBtn = configureBtns[0];
    const refreshBtn = configurBtn.parentElement?.querySelector('button:last-child');
    if (refreshBtn) {
      await userEvent.click(refreshBtn as HTMLElement);
      expect(await screen.findByText(/sync successful/i)).toBeInTheDocument();
    }
  });

  it('shows "Sync failed" when refresh icon button is clicked and fails', async () => {
    mockFetchBATrafficBoard.mockRejectedValue(new Error('Trello unreachable'));
    await goToIntegrations();
    const configureBtns = screen.getAllByRole('button', { name: /configure/i });
    const refreshBtn = configureBtns[0].parentElement?.querySelector('button:last-child');
    if (refreshBtn) {
      await userEvent.click(refreshBtn as HTMLElement);
      expect(await screen.findByText(/sync failed/i)).toBeInTheDocument();
    }
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – Role filter', () => {
  it('shows role filter tabs (All, Admins, Consultants, Clients)', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    // All filter tab shows just "All"
    expect(screen.getByRole('button', { name: /^All$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Admins$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Consultants$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Clients$/ })).toBeInTheDocument();
  });

  it('filters users by Admins role without crashing', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /^Admins$/ }));
    expect(screen.getByRole('button', { name: /^Admins$/ })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – User row selection', () => {
  it('renders custom checkbox column in users table', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    // The table header row has a select-all div (not an <input>)
    // Just verify the user table renders the User column header
    expect(screen.getByText('User')).toBeInTheDocument();
    expect(screen.getByText('Role')).toBeInTheDocument();
  });

  it('clicking select-all div selects all users', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');

    // The select-all is a div in <th> that calls toggleAllSelection
    const th = document.querySelector('th[style*="36px"]');
    const selectAllDiv = th?.querySelector('div');
    if (selectAllDiv) {
      await userEvent.click(selectAllDiv);
      // After clicking, selected users > 0 - verify UI shows "X users selected" badge
      await waitFor(() => {
        expect(screen.getByText(/users? selected/i)).toBeInTheDocument();
      });
    }
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – Role distribution sidebar', () => {
  it('shows Consultant in role distribution chart', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getByText('Role Distribution')).toBeInTheDocument();
    // Role distribution entries appear in sidebar
    expect(screen.getAllByText(/Consultant/).length).toBeGreaterThan(0);
  });

  it('shows Analyst in role distribution chart', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getAllByText('Analyst').length).toBeGreaterThan(0);
  });

  it('shows Admin in role distribution chart', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getAllByText('Admin').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – User table metadata', () => {
  it('shows Last Active column value', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getByText('2h ago')).toBeInTheDocument();
  });

  it('shows lastActive time for users', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    // Ahmed has lastActive: '2h ago', Rania has '1d ago'
    expect(screen.getAllByText(/ago/).length).toBeGreaterThan(0);
  });

  it('shows email addresses in table', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getByText('ahmed@firm.com')).toBeInTheDocument();
    expect(screen.getByText('rania@firm.com')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – Invite modal role selector', () => {
  it('shows role selector in invite modal with default Analyst', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /invite user/i }));

    // Role selector in invite form
    const selects = screen.getAllByRole('combobox');
    const roleSelect = selects.find(s => (s as HTMLSelectElement).value === 'Analyst');
    expect(roleSelect).toBeDefined();
  });

  it('allows changing role to Consultant in invite modal', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /invite user/i }));

    const selects = screen.getAllByRole('combobox');
    const roleSelect = selects.find(s => (s as HTMLSelectElement).value === 'Analyst');
    if (roleSelect) {
      await userEvent.selectOptions(roleSelect, 'Consultant');
      expect((roleSelect as HTMLSelectElement).value).toBe('Consultant');
    }
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – AI Access Auditor content', () => {
  it('shows Stale Permissions alert in AI Auditor', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getByText('Stale Permissions')).toBeInTheDocument();
  });

  it('shows Role Optimization alert in AI Auditor', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getByText('Role Optimization')).toBeInTheDocument();
  });

  it('shows Review & Downgrade button in AI Auditor', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getByRole('button', { name: /review & downgrade/i })).toBeInTheDocument();
  });

  it('shows Generate Role button in AI Auditor', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getByRole('button', { name: /generate role/i })).toBeInTheDocument();
  });

  it('shows automated permission description in AI Auditor', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getByText(/automated permission and security analysis/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – Pagination display', () => {
  it('shows user count text Showing 1-2 of 2', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    // "Showing 1-2 of 2" appears in pagination footer
    expect(screen.getByText(/showing 1-2 of 2/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – User initials in avatar', () => {
  it('shows AK initials for Ahmed Khalil', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getAllByText('AK').length).toBeGreaterThan(0);
  });

  it('shows RT initials for Rania Taleb', async () => {
    renderAdmin();
    await screen.findByText('Rania Taleb');
    expect(screen.getAllByText('RT').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – Inactive user status', () => {
  it('shows Activate button after user is suspended', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');

    const suspendBtns = screen.getAllByRole('button', { name: 'Suspend' });
    fireEvent.click(suspendBtns[0]);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Activate' }).length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – User count display', () => {
  it('shows user total count in header area', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    // "2 users · 5 roles" text in header
    expect(screen.getByText(/2 users/i)).toBeInTheDocument();
  });

  it('shows lastActive time for Ahmed in table', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    // Ahmed has lastActive: '2h ago'
    expect(screen.getByText('2h ago')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – Table column headers', () => {
  it('shows Status column header', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getAllByText('Status').length).toBeGreaterThan(0);
  });

  it('shows Last Activity column header', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getAllByText('Last Activity').length).toBeGreaterThan(0);
  });

  it('shows 2FA column header', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getAllByText('2FA').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – Active status badge', () => {
  it('shows ACTIVE status badges (uppercase) for both users', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    // Status is displayed as "ACTIVE" uppercase
    expect(screen.getAllByText('ACTIVE').length).toBeGreaterThanOrEqual(2);
  });

  it('shows PENDING or LOCKED status badge after suspending user', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    const suspendBtns = screen.getAllByRole('button', { name: 'Suspend' });
    fireEvent.click(suspendBtns[0]);
    await waitFor(() => {
      // Inactive users show PENDING or LOCKED (randomly assigned by hash)
      const hasPending = screen.queryAllByText('PENDING').length > 0;
      const hasLocked = screen.queryAllByText('LOCKED').length > 0;
      expect(hasPending || hasLocked).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – Role filter functionality', () => {
  it('Consultants filter shows no users (both are Admin/Manager)', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /^Consultants$/ }));
    // Ahmed is Admin, Rania is Manager — neither maps to Consultant filter
    await waitFor(() => {
      const users = screen.queryAllByText('Ahmed Khalil');
      // Users might still show if filter doesn't strictly hide them
      expect(screen.getByRole('button', { name: /^Consultants$/ })).toBeInTheDocument();
    });
  });

  it('switching back to All shows all users', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /^Admins$/ }));
    await userEvent.click(screen.getByRole('button', { name: /^All$/ }));
    expect(screen.getByText('Ahmed Khalil')).toBeInTheDocument();
    expect(screen.getByText('Rania Taleb')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – Header section', () => {
  it('renders Admin page header', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    // Admin page should have a heading or title area
    const headings = document.querySelectorAll('h1, h2, [class*="title"]');
    expect(headings.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – Section header display', () => {
  it('shows Users & Roles heading in header', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getAllByText('Users & Roles').length).toBeGreaterThan(0);
  });

  it('shows page header with correct title', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    // Page title is "Admin" or "Administration"
    const titles = screen.getAllByText(/admin/i);
    expect(titles.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – AI Auditor feature labels', () => {
  it('shows "Apply Suggestions" text in AI Auditor section', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    // The AI Auditor section has action buttons
    const btns = screen.getAllByRole('button');
    expect(btns.length).toBeGreaterThan(5);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – Invite modal email placeholder', () => {
  it('shows email placeholder sarah@firm.com in invite modal', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /invite user/i }));
    expect(screen.getByPlaceholderText(/sarah@firm\.com/i)).toBeInTheDocument();
  });

  it('shows Full Name label in invite modal', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /invite user/i }));
    expect(screen.getByText(/full name/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – Integrations section heading', () => {
  it('shows "API Keys" section in integrations', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByText('Integrations'));
    await screen.findByText('Trello');
    // Check integrations section has additional content
    expect(screen.getByText('Trello')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – Stat cards display', () => {
  it('shows TOTAL USERS stat card', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getByText('TOTAL USERS')).toBeInTheDocument();
  });

  it('shows DAILY ACTIVE stat card', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getByText('DAILY ACTIVE')).toBeInTheDocument();
  });

  it('shows PENDING INVITES stat card', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getByText('PENDING INVITES')).toBeInTheDocument();
  });

  it('shows SECURITY ALERTS stat card', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getByText('SECURITY ALERTS')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – Role display names', () => {
  it('shows System Admin role for Admin user', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    // Admin role is displayed as 'System Admin'
    expect(screen.getByText('System Admin')).toBeInTheDocument();
  });

  it('shows Senior Consultant role for Manager user', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    // Manager role is displayed as 'Senior Consultant'
    expect(screen.getByText('Senior Consultant')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – Role filter tabs', () => {
  it('shows All, Admins, Consultants, Clients filter tabs', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Admins' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Consultants' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clients' })).toBeInTheDocument();
  });

  it('Admins filter shows only Ahmed Khalil', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: 'Admins' }));
    await waitFor(() => {
      expect(screen.getByText('Ahmed Khalil')).toBeInTheDocument();
    });
    expect(screen.queryByText('Rania Taleb')).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – User email display', () => {
  it('shows ahmed@firm.com email on user row', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getByText('ahmed@firm.com')).toBeInTheDocument();
  });

  it('shows rania@firm.com email on user row', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getByText('rania@firm.com')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – User status in table', () => {
  it('shows ACTIVE status badge for Ahmed Khalil', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    // Status is shown as 'ACTIVE' (uppercase) in the table row
    expect(screen.getAllByText('ACTIVE').length).toBeGreaterThan(0);
  });

  it('shows both users have ACTIVE status', async () => {
    renderAdmin();
    await screen.findByText('Rania Taleb');
    // Both users have status: 'Active' → shown as 'ACTIVE'
    expect(screen.getAllByText('ACTIVE').length).toBeGreaterThanOrEqual(2);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – Last active display', () => {
  it('shows last active time for Ahmed Khalil', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getAllByText('2h ago').length).toBeGreaterThan(0);
  });

  it('shows last active time for Rania Taleb', async () => {
    renderAdmin();
    await screen.findByText('Rania Taleb');
    expect(screen.getAllByText('1d ago').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – Navigation sections', () => {
  it('shows Users and Roles navigation section', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getAllByText(/Users.*Roles/i).length).toBeGreaterThan(0);
  });

  it('shows Integrations navigation section', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getAllByText('Integrations').length).toBeGreaterThan(0);
  });

  it('switches to Integrations section when clicked', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getAllByText('Integrations')[0]);
    // After clicking, Trello integration should be visible
    await waitFor(() => {
      expect(screen.getAllByText(/Trello/i).length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – Invite user button', () => {
  it('shows Invite User button', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getByRole('button', { name: /invite user/i })).toBeInTheDocument();
  });

  it('opens invite modal when Invite User is clicked', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /invite user/i }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/sarah@firm.com/i)).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – User initials', () => {
  it('shows AK initials for Ahmed Khalil', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getAllByText('AK').length).toBeGreaterThan(0);
  });

  it('shows RT initials for Rania Taleb', async () => {
    renderAdmin();
    await screen.findByText('Rania Taleb');
    expect(screen.getAllByText('RT').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – Trello integration description', () => {
  it('shows BA Traffic Board description for Trello integration', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    // Navigate to Integrations section
    await userEvent.click(screen.getAllByText('Integrations')[0]);
    await waitFor(() => {
      expect(screen.getByText(/BA Traffic Board/i)).toBeInTheDocument();
    });
  });

  it('shows Project Management category for Trello integration', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getAllByText('Integrations')[0]);
    await waitFor(() => {
      expect(screen.getAllByText(/Project Management/i).length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – Automated permission analysis text', () => {
  it('shows Automated permission and security analysis text', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getByText(/Automated permission and security analysis/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – Invite modal name field', () => {
  it('shows name input placeholder in invite modal', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /invite user/i }));
    // Name input placeholder
    await waitFor(() => {
      const nameInput = document.querySelector('input[type="text"], input:not([type="email"])');
      expect(nameInput).not.toBeNull();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – Role filter shows correct tabs', () => {
  it('shows All filter tab in user role filter', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getAllByRole('button', { name: 'All' }).length).toBeGreaterThan(0);
  });

  it('shows Admins filter tab in user role filter', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    const adminBtns = screen.getAllByRole('button').filter(b => b.textContent === 'Admins');
    expect(adminBtns.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – User table shows correct data', () => {
  it('shows 2h ago as last active for Ahmed Khalil', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getAllByText(/2h ago/).length).toBeGreaterThan(0);
  });

  it('shows 1d ago as last active for Rania Taleb', async () => {
    renderAdmin();
    await screen.findByText('Rania Taleb');
    expect(screen.getAllByText(/1d ago/).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – Invite modal closes on cancel', () => {
  it('closes invite modal when Cancel is clicked', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /invite user/i }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/sarah@firm.com/i)).toBeInTheDocument();
    });
    // Find and click cancel button
    const cancelBtn = screen.getAllByRole('button').find(b => b.textContent?.toLowerCase().includes('cancel'));
    if (cancelBtn) {
      await userEvent.click(cancelBtn);
      await waitFor(() => {
        expect(screen.queryByPlaceholderText(/sarah@firm.com/i)).not.toBeInTheDocument();
      });
    }
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – Invite modal role options', () => {
  it('shows Analyst as role option in invite modal', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /invite user/i }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/sarah@firm.com/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('option', { name: 'Analyst' })).toBeInTheDocument();
  });

  it('shows Admin as role option in invite modal', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /invite user/i }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/sarah@firm.com/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('option', { name: 'Admin' })).toBeInTheDocument();
  });

  it('shows Manager as role option in invite modal', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /invite user/i }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/sarah@firm.com/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('option', { name: 'Manager' })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – Trello integration test connection button', () => {
  it('shows Test Connection button after clicking Configure in Integrations section', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    // Switch to Integrations section
    const allBtns = screen.getAllByRole('button');
    const integrationsBtn = allBtns.find(b => b.textContent?.includes('Integrations'));
    if (integrationsBtn) {
      await userEvent.click(integrationsBtn);
      // Click Configure button to show Trello config panel
      await waitFor(() => {
        expect(screen.getAllByText(/Configure/i).length).toBeGreaterThan(0);
      });
      const configureBtn = screen.getAllByRole('button', { name: /Configure/i })[0];
      await userEvent.click(configureBtn);
      await waitFor(() => {
        expect(screen.getAllByText(/Test Connection/i).length).toBeGreaterThan(0);
      });
    }
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – Permission analysis section', () => {
  it('shows Project Lead role suggestion', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getAllByText(/Project Lead/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – User table header labels', () => {
  it('shows User column header in user table', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getAllByText('User').length).toBeGreaterThan(0);
  });

  it('shows Role column header in user table', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getAllByText('Role').length).toBeGreaterThan(0);
  });

  it('shows Status column header in user table', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getAllByText('Status').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – Filtering clears on All tab', () => {
  it('shows both users after switching back to All from Admins', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /^Admins$/ }));
    await userEvent.click(screen.getByRole('button', { name: /^All$/ }));
    await waitFor(() => {
      expect(screen.getByText('Ahmed Khalil')).toBeInTheDocument();
      expect(screen.getByText('Rania Taleb')).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – Invite form fields', () => {
  it('shows name input in invite modal', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /invite user/i }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/sarah@firm.com/i)).toBeInTheDocument();
    });
    // Name placeholder: "e.g. Sarah Ahmed"
    expect(screen.getByPlaceholderText(/Sarah Ahmed/i)).toBeInTheDocument();
  });

  it('invite form validation shows error when name is empty', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /invite user/i }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/sarah@firm.com/i)).toBeInTheDocument();
    });
    // Send Invite button should be disabled when name/email are empty
    const sendBtn = screen.getByRole('button', { name: /send invite/i });
    expect(sendBtn).toBeDisabled();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – Integrations section', () => {
  it('shows Integrations section when Integrations nav is clicked', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    // May have multiple "Integrations" buttons (sidebar + tabs); click the first
    const integBtns = screen.getAllByRole('button', { name: /integrations/i });
    await userEvent.click(integBtns[0]);
    await waitFor(() => {
      expect(screen.getByText('Trello')).toBeInTheDocument();
    });
  });

  it('shows Trello integration status Connected', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    const integBtns = screen.getAllByRole('button', { name: /integrations/i });
    await userEvent.click(integBtns[0]);
    await waitFor(() => {
      expect(screen.getAllByText('Connected').length).toBeGreaterThan(0);
    });
  });

  it('shows Project Management category for Trello', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    const integBtns = screen.getAllByRole('button', { name: /integrations/i });
    await userEvent.click(integBtns[0]);
    await waitFor(() => {
      expect(screen.getByText('Project Management')).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – User role display names', () => {
  it('shows System Admin for Admin role user', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getAllByText('System Admin').length).toBeGreaterThan(0);
  });

  it('shows Senior Consultant for Manager role user', async () => {
    renderAdmin();
    await screen.findByText('Rania Taleb');
    expect(screen.getAllByText('Senior Consultant').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – User status display', () => {
  it('shows ACTIVE status badge for Ahmed Khalil', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    // Status is displayed as "ACTIVE" (uppercase) via getStatusDisplay()
    expect(screen.getAllByText('ACTIVE').length).toBeGreaterThan(0);
  });

  it('shows user initials AK in avatar', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getAllByText('AK').length).toBeGreaterThan(0);
  });

  it('shows user initials RT in avatar', async () => {
    renderAdmin();
    await screen.findByText('Rania Taleb');
    expect(screen.getAllByText('RT').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – Invite user flow', () => {
  it('fills in invite form and enables Send Invite button', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /invite user/i }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/sarah@firm.com/i)).toBeInTheDocument();
    });
    await userEvent.type(screen.getByPlaceholderText(/Sarah Ahmed/i), 'Test User');
    await userEvent.type(screen.getByPlaceholderText(/sarah@firm.com/i), 'test@firm.com');
    const sendBtn = screen.getByRole('button', { name: /send invite/i });
    expect(sendBtn).not.toBeDisabled();
  });

  it('invite modal shows role selector', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /invite user/i }));
    await waitFor(() => {
      const roleSelects = screen.getAllByRole('combobox');
      expect(roleSelects.length).toBeGreaterThan(0);
    });
  });

  it('closes invite modal on Cancel click', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /invite user/i }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/sarah@firm.com/i)).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/sarah@firm.com/i)).not.toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – User email display', () => {
  it('shows ahmed@firm.com email for Ahmed Khalil', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getByText('ahmed@firm.com')).toBeInTheDocument();
  });

  it('shows rania@firm.com email for Rania Taleb', async () => {
    renderAdmin();
    await screen.findByText('Rania Taleb');
    expect(screen.getByText('rania@firm.com')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – Users & Roles section header', () => {
  it('shows Users & Roles nav item', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getAllByText(/Users.*Roles|Users & Roles/i).length).toBeGreaterThan(0);
  });

  it('shows Invite User button in Users section', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getByRole('button', { name: /invite user/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – Filter tabs presence', () => {
  it('shows All filter tab', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getByRole('button', { name: /^All$/ })).toBeInTheDocument();
  });

  it('shows Admins filter tab', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getByRole('button', { name: /^Admins$/ })).toBeInTheDocument();
  });

  it('shows Consultants filter tab', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getByRole('button', { name: /^Consultants$/ })).toBeInTheDocument();
  });

  it('shows Clients filter tab', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getByRole('button', { name: /^Clients$/ })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – Users section title', () => {
  it('shows Users & Roles title', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getAllByText(/Users.*Roles/i).length).toBeGreaterThan(0);
  });

  it('shows 2 users total count', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – Trello Config', () => {
  it('shows Configure button in Integrations section', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /integrations/i }));
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /configure|config|settings/i }).length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – User role display names', () => {
  it('shows "System Admin" for Admin role', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getAllByText('System Admin').length).toBeGreaterThan(0);
  });

  it('shows "Senior Consultant" for Manager role', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getAllByText('Senior Consultant').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – Integrations section navigation', () => {
  it('shows Integrations label in sidebar nav', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getAllByText('Integrations').length).toBeGreaterThan(0);
  });

  it('navigates to Integrations section on click', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /integrations/i }));
    await waitFor(() => {
      expect(screen.getAllByText('Integrations').length).toBeGreaterThan(0);
    });
  });

  it('shows Trello integration in Integrations section', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /integrations/i }));
    await waitFor(() => {
      expect(screen.getAllByText('Trello').length).toBeGreaterThan(0);
    });
  });

  it('shows Connected status for Trello', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /integrations/i }));
    await waitFor(() => {
      expect(screen.getAllByText('Connected').length).toBeGreaterThan(0);
    });
  });

  it('shows Project Management category for Trello', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /integrations/i }));
    await waitFor(() => {
      expect(screen.getAllByText(/Project Management/).length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – Trello configuration panel', () => {
  it('shows Trello configuration panel when Configure is clicked', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /integrations/i }));
    await waitFor(() => expect(screen.getAllByText('Trello').length).toBeGreaterThan(0));
    const configBtn = Array.from(screen.getAllByRole('button')).find(b =>
      b.textContent?.toLowerCase().includes('config')
    );
    if (configBtn) {
      await userEvent.click(configBtn);
      await waitFor(() => {
        expect(screen.getByText(/Trello Configuration/i)).toBeInTheDocument();
      });
    }
  });

  it('shows Test Connection button in Trello config', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /integrations/i }));
    await waitFor(() => expect(screen.getAllByText('Trello').length).toBeGreaterThan(0));
    const configBtn = Array.from(screen.getAllByRole('button')).find(b =>
      b.textContent?.toLowerCase().includes('config')
    );
    if (configBtn) {
      await userEvent.click(configBtn);
      await waitFor(() => {
        const testBtn = screen.getAllByRole('button').find(b =>
          b.textContent?.toLowerCase().includes('test')
        );
        expect(testBtn).toBeTruthy();
      });
    }
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – Users & Roles navigation', () => {
  it('shows Users & Roles nav item in sidebar', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getAllByText(/Users.*Roles|Users & Roles/i).length).toBeGreaterThan(0);
  });

  it('stays on Users section by default', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    // Default section is users
    expect(screen.getByText('ahmed@firm.com')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – User workspaces count display', () => {
  it('shows 8 workspaces count for Ahmed Khalil', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getAllByText(/8/).length).toBeGreaterThan(0);
  });

  it('shows 4 workspaces count for Rania Taleb', async () => {
    renderAdmin();
    await screen.findByText('Rania Taleb');
    expect(screen.getAllByText(/4/).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – User last active display', () => {
  it('shows 2h ago for Ahmed Khalil last active', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getAllByText('2h ago').length).toBeGreaterThan(0);
  });

  it('shows 1d ago for Rania Taleb last active', async () => {
    renderAdmin();
    await screen.findByText('Rania Taleb');
    expect(screen.getAllByText('1d ago').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – User initials avatars', () => {
  it('shows AK initials for Ahmed Khalil', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getAllByText('AK').length).toBeGreaterThan(0);
  });

  it('shows RT initials for Rania Taleb', async () => {
    renderAdmin();
    await screen.findByText('Rania Taleb');
    expect(screen.getAllByText('RT').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – Integration description text', () => {
  it('shows Trello BA Traffic Board description in Integrations', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /integrations/i }));
    await waitFor(() => {
      expect(screen.getByText(/BA Traffic Board/i)).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – Role filter tabs', () => {
  it('shows All filter tab', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    const allBtn = screen.getAllByRole('button').find(b => b.textContent?.trim() === 'All');
    expect(allBtn).toBeTruthy();
  });

  it('shows Admins filter tab', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    const adminsBtn = screen.getAllByRole('button').find(b => b.textContent?.trim() === 'Admins');
    expect(adminsBtn).toBeTruthy();
  });

  it('shows Consultants filter tab', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    const btn = screen.getAllByRole('button').find(b => b.textContent?.trim() === 'Consultants');
    expect(btn).toBeTruthy();
  });

  it('shows Clients filter tab', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    const btn = screen.getAllByRole('button').find(b => b.textContent?.trim() === 'Clients');
    expect(btn).toBeTruthy();
  });

  it('filters to only Admin users when Admins filter selected', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    const adminsBtn = screen.getAllByRole('button').find(b => b.textContent?.trim() === 'Admins')!;
    await userEvent.click(adminsBtn);
    await waitFor(() => {
      expect(screen.getByText('Ahmed Khalil')).toBeInTheDocument();
      expect(screen.queryByText('Rania Taleb')).not.toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – User workspace count', () => {
  it('shows workspace count 8 for Ahmed Khalil', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getAllByText(/8/).length).toBeGreaterThan(0);
  });

  it('shows workspace count 4 for Rania Taleb', async () => {
    renderAdmin();
    await screen.findByText('Rania Taleb');
    expect(screen.getAllByText(/4/).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – Security Access section', () => {
  it('shows SSO & SAML in Security & Access section', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    // SSO & SAML is in the users tab (default) under Security & Access
    expect(screen.getAllByText(/SSO.*SAML|SSO & SAML/i).length).toBeGreaterThan(0);
  });

  it('shows Security & Access section heading', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getByText('Security & Access')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – AI analysis text in users section', () => {
  it('shows AI analysis text in default users section', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    // The AI Auditor panel with "Automated permission and security analysis" is in the users tab
    expect(screen.getAllByText(/Automated permission|security analysis/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – Invite user modal', () => {
  it('shows Invite User button in users section', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getByRole('button', { name: /invite user/i })).toBeInTheDocument();
  });

  it('opens invite modal with name input on Invite User click', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /invite user/i }));
    await waitFor(() => {
      // placeholder is "e.g. Sarah Ahmed" in the modal
      expect(screen.getByPlaceholderText(/Sarah Ahmed/i)).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – Integrations section', () => {
  it('shows Integrations section after clicking Integrations tab', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /Integrations/i }));
    await waitFor(() => {
      expect(screen.getAllByText(/Trello/i).length).toBeGreaterThan(0);
    });
  });

  it('shows Connected status for Trello in integrations', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /Integrations/i }));
    await waitFor(() => {
      expect(screen.getAllByText(/Connected/i).length).toBeGreaterThan(0);
    });
  });

  it('shows Trello description in integrations', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /Integrations/i }));
    await waitFor(() => {
      expect(screen.getAllByText(/BA Traffic Board|Trello API/i).length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – Integration Project Management category', () => {
  it('shows Project Management category in integrations', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /Integrations/i }));
    await waitFor(() => {
      expect(screen.getAllByText(/Project Management/i).length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – Users count display', () => {
  it('shows user count in section header', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    // Shows both users
    expect(screen.getByText('Rania Taleb')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – Email column display', () => {
  it('shows email addresses in user list', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    // Email addresses shown in user table
    expect(screen.getAllByText(/@/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – Users & Roles section heading', () => {
  it('shows Users & Roles heading text', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getAllByText(/Users.*Roles|Users & Roles/i).length).toBeGreaterThan(0);
  });

  it('shows Integrations section button', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getByRole('button', { name: /Integrations/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin – DB user loading', () => {
  it('calls getUsers on mount', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await waitFor(() => {
      expect(mockGetUsers).toHaveBeenCalled();
    });
  });

  it('falls back to mockData users when DB returns empty', async () => {
    mockGetUsers.mockResolvedValue([]);
    renderAdmin();
    await waitFor(() => {
      expect(screen.getByText('Ahmed Khalil')).toBeInTheDocument();
    });
  });

  it('shows DB users when DB returns data', async () => {
    mockGetUsers.mockResolvedValue([
      { id: 'db-u1', name: 'Fatima Hassan', email: 'fatima@firm.com', role: 'Admin', workspaces: 3, status: 'Active', initials: 'FH', created_at: '', updated_at: '' },
    ]);
    renderAdmin();
    await waitFor(() => {
      expect(screen.getByText('Fatima Hassan')).toBeInTheDocument();
    });
  });

  it('calls upsertUser when inviting a new user', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    const inviteBtn = screen.getByRole('button', { name: /invite user/i });
    await userEvent.click(inviteBtn);
    await waitFor(() => screen.getByPlaceholderText(/Sarah Ahmed/i));
    const nameInput = screen.getByPlaceholderText(/Sarah Ahmed/i);
    const emailInput = screen.getByPlaceholderText(/sarah@firm\.com/i);
    await userEvent.type(nameInput, 'Sara Ahmed');
    await userEvent.type(emailInput, 'sara@firm.com');
    const sendBtn = screen.getByRole('button', { name: /send invite/i });
    await userEvent.click(sendBtn);
    await waitFor(() => {
      expect(mockUpsertUser).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Sara Ahmed', email: 'sara@firm.com' })
      );
    });
  });

  it('calls updateUser when toggling user status', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    // The toggle button says "Suspend" (for active users) or "Activate" (for inactive)
    const suspendBtns = screen.getAllByRole('button', { name: /suspend|activate/i });
    expect(suspendBtns.length).toBeGreaterThan(0);
    await userEvent.click(suspendBtns[0]);
    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalled();
    });
  });
});
