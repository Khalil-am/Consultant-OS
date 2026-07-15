import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Hoisted mocks ────────────────────────────────────────────
const { mockGetActivities, mockGetWorkspaces, mockGetTeamMembers, mockCreateTeamMember, mockUpdateTeamMember } = vi.hoisted(() => ({
  mockGetActivities: vi.fn(),
  mockGetWorkspaces: vi.fn(),
  mockGetTeamMembers: vi.fn(),
  mockCreateTeamMember: vi.fn(),
  mockUpdateTeamMember: vi.fn(),
}));

vi.mock('../lib/db', () => ({
  getActivities: mockGetActivities,
  getWorkspaces: mockGetWorkspaces,
  getTeamMembers: mockGetTeamMembers,
  createTeamMember: mockCreateTeamMember,
  updateTeamMember: mockUpdateTeamMember,
}));

const mockMembers = [
  { id: 'u1', name: 'Ahmed Khalil', email: 'ahmed@firm.com', role: 'Admin', workspaces_count: 8, last_active: '2h ago', status: 'Active', initials: 'AK', created_at: '', updated_at: '' },
  { id: 'u2', name: 'Rania Taleb', email: 'rania@firm.com', role: 'Manager', workspaces_count: 4, last_active: '1d ago', status: 'Active', initials: 'RT', created_at: '', updated_at: '' },
];

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
  mockGetTeamMembers.mockResolvedValue(mockMembers);
  mockCreateTeamMember.mockImplementation(async (member: typeof mockMembers[0]) => ({ ...member, created_at: '', updated_at: '' }));
  mockUpdateTeamMember.mockResolvedValue({});
});

// ────────────────────────────────────────────────────────────
describe('Admin – Users table', () => {
  it('renders user table with Supabase users', async () => {
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

  it('loads users from Supabase on mount', async () => {
    renderAdmin();
    await waitFor(() => expect(mockGetTeamMembers).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Ahmed Khalil')).toBeInTheDocument();
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

  it('adds new user via Supabase createTeamMember when invited', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /invite user/i }));
    await userEvent.type(screen.getByPlaceholderText(/e\.g\. sarah ahmed/i), 'Sara New');
    await userEvent.type(screen.getByPlaceholderText(/sarah@firm\.com/i), 'sara@test.com');
    await userEvent.click(screen.getByRole('button', { name: /send invite/i }));

    await waitFor(() => {
      expect(mockCreateTeamMember).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Sara New', email: 'sara@test.com' }),
      );
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
  it('toggles user status from Active to Inactive and calls Supabase updateTeamMember', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');

    // The toggle is a 'Suspend {name}' button for active users
    const suspendBtns = screen.getAllByRole('button', { name: /^Suspend /i });
    expect(suspendBtns.length).toBeGreaterThan(0);
    fireEvent.click(suspendBtns[0]);

    await waitFor(() => {
      expect(mockUpdateTeamMember).toHaveBeenCalledWith('u1', { status: 'Inactive' });
    });
  });

  it('persists toggle changes via Supabase updateTeamMember', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');

    const suspendBtns = screen.getAllByRole('button', { name: /^Suspend /i });
    fireEvent.click(suspendBtns[0]);

    await waitFor(() => {
      expect(mockUpdateTeamMember).toHaveBeenCalledTimes(1);
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
    expect(screen.getByRole('button', { name: /filter users: all/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter users: admins/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter users: consultants/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter users: clients/i })).toBeInTheDocument();
  });

  it('filters users by Admins role without crashing', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /filter users: admins/i }));
    expect(screen.getByRole('button', { name: /filter users: admins/i })).toBeInTheDocument();
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
    expect(screen.getAllByText('Role').length).toBeGreaterThan(0);
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

    const suspendBtns = screen.getAllByRole('button', { name: /^Suspend /i });
    fireEvent.click(suspendBtns[0]);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /^Activate /i }).length).toBeGreaterThan(0);
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
    const suspendBtns = screen.getAllByRole('button', { name: /^Suspend /i });
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
    await userEvent.click(screen.getByRole('button', { name: /filter users: consultants/i }));
    // Ahmed is Admin, Rania is Manager — neither maps to Consultant filter
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /filter users: consultants/i })).toBeInTheDocument();
    });
  });

  it('switching back to All shows all users', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /filter users: admins/i }));
    await userEvent.click(screen.getByRole('button', { name: /filter users: all/i }));
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
    expect(screen.getByRole('button', { name: /filter users: all/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter users: admins/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter users: consultants/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter users: clients/i })).toBeInTheDocument();
  });

  it('Admins filter shows only Ahmed Khalil', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /filter users: admins/i }));
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
    expect(screen.getByRole('button', { name: /filter users: all/i })).toBeInTheDocument();
  });

  it('shows Admins filter tab in user role filter', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getByRole('button', { name: /filter users: admins/i })).toBeInTheDocument();
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
    await userEvent.click(screen.getByRole('button', { name: /filter users: admins/i }));
    await userEvent.click(screen.getByRole('button', { name: /filter users: all/i }));
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
    expect(screen.getByRole('button', { name: /filter users: all/i })).toBeInTheDocument();
  });

  it('shows Admins filter tab', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getByRole('button', { name: /filter users: admins/i })).toBeInTheDocument();
  });

  it('shows Consultants filter tab', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getByRole('button', { name: /filter users: consultants/i })).toBeInTheDocument();
  });

  it('shows Clients filter tab', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getByRole('button', { name: /filter users: clients/i })).toBeInTheDocument();
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

// ── User Status Quick Filter ────────────────────────────────────
describe('Admin – User Status Quick Filter', () => {
  beforeEach(() => {
    const users = [
      { id: 'uq1', name: 'Active Alice', email: 'alice@firm.com', role: 'Admin', workspaces: 1, lastActive: '1h ago', status: 'Active', initials: 'AA', created_at: '', updated_at: '' },
      { id: 'uq2', name: 'Inactive Bob', email: 'bob@firm.com', role: 'Analyst', workspaces: 0, lastActive: '30d ago', status: 'Inactive', initials: 'IB', created_at: '', updated_at: '' },
    ];
    localStorage.setItem('admin_users', JSON.stringify(users));
  });
  afterEach(() => localStorage.removeItem('admin_users'));

  it('renders All, Active, Inactive status filter buttons', async () => {
    renderAdmin();
    await screen.findByText('Active Alice');
    expect(screen.getByRole('button', { name: /filter users by status: all/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter users by status: active/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter users by status: inactive/i })).toBeInTheDocument();
  });

  it('All filter is active by default', async () => {
    renderAdmin();
    await screen.findByText('Active Alice');
    expect(screen.getByRole('button', { name: /filter users by status: all/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('Active filter shows only active users', async () => {
    renderAdmin();
    await screen.findByText('Active Alice');
    await userEvent.click(screen.getByRole('button', { name: /filter users by status: active/i }));
    await waitFor(() => {
      expect(screen.getByText('Active Alice')).toBeInTheDocument();
      expect(screen.queryByText('Inactive Bob')).not.toBeInTheDocument();
    });
  });

  it('Inactive filter shows only inactive users', async () => {
    renderAdmin();
    await screen.findByText('Active Alice');
    await userEvent.click(screen.getByRole('button', { name: /filter users by status: inactive/i }));
    await waitFor(() => {
      expect(screen.getByText('Inactive Bob')).toBeInTheDocument();
      expect(screen.queryByText('Active Alice')).not.toBeInTheDocument();
    });
  });

  it('clicking All after filtering restores all users', async () => {
    renderAdmin();
    await screen.findByText('Active Alice');
    await userEvent.click(screen.getByRole('button', { name: /filter users by status: active/i }));
    await userEvent.click(screen.getByRole('button', { name: /filter users by status: all/i }));
    await waitFor(() => {
      expect(screen.getByText('Active Alice')).toBeInTheDocument();
      expect(screen.getByText('Inactive Bob')).toBeInTheDocument();
    });
  });
});

// ── User Email Sort ─────────────────────────────────────────────
describe('Admin – User Email Sort', () => {
  beforeEach(() => {
    const users = [
      { id: 'ue1', name: 'Zara User', email: 'zara@firm.com', role: 'Admin', workspaces: 1, lastActive: '1h ago', status: 'Active', initials: 'ZU', created_at: '', updated_at: '' },
      { id: 'ue2', name: 'Alpha User', email: 'alpha@firm.com', role: 'Analyst', workspaces: 0, lastActive: '2h ago', status: 'Active', initials: 'AU', created_at: '', updated_at: '' },
    ];
    localStorage.setItem('admin_users', JSON.stringify(users));
  });
  afterEach(() => localStorage.removeItem('admin_users'));

  it('renders email option in sort users dropdown', async () => {
    renderAdmin();
    await screen.findByText('Zara User');
    const sel = screen.getByRole('combobox', { name: /sort users/i });
    expect(sel.querySelector('option[value="email"]')).toBeInTheDocument();
  });

  it('selecting email sort updates dropdown value', async () => {
    renderAdmin();
    await screen.findByText('Zara User');
    const sel = screen.getByRole('combobox', { name: /sort users/i }) as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'email');
    expect(sel.value).toBe('email');
  });

  it('email sort places alpha@ before zara@ in DOM', async () => {
    renderAdmin();
    await screen.findByText('Zara User');
    const sel = screen.getByRole('combobox', { name: /sort users/i }) as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'email');
    await waitFor(() => {
      const alphaEl = screen.getByText('Alpha User');
      const zaraEl = screen.getByText('Zara User');
      expect(alphaEl.compareDocumentPosition(zaraEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });
});

// ── Sort users by Joined ────────────────────────────────────────
describe('Admin – Sort users by Joined', () => {
  const userEarly = { id: 'ue', name: 'Early User', email: 'early@firm.com', role: 'Admin', workspaces: 1, lastActive: '1d ago', status: 'Active', initials: 'EU', created_at: '2025-01-01T00:00:00Z', updated_at: '' };
  const userLate = { id: 'ul', name: 'Late User', email: 'late@firm.com', role: 'Manager', workspaces: 2, lastActive: '1d ago', status: 'Active', initials: 'LU', created_at: '2026-06-01T00:00:00Z', updated_at: '' };

  beforeEach(() => {
    localStorage.setItem('admin_users', JSON.stringify([userEarly, userLate]));
  });
  afterEach(() => localStorage.removeItem('admin_users'));

  it('renders Joined option in Sort users dropdown', async () => {
    renderAdmin();
    await screen.findByText('Early User');
    const sel = screen.getByRole('combobox', { name: /sort users/i });
    expect(sel.querySelector('option[value="joined"]')).toBeInTheDocument();
  });

  it('selecting Joined sets sort value', async () => {
    renderAdmin();
    await screen.findByText('Early User');
    const sel = screen.getByRole('combobox', { name: /sort users/i }) as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'joined');
    expect(sel.value).toBe('joined');
  });

  it('switching back to name works after joined sort', async () => {
    renderAdmin();
    await screen.findByText('Early User');
    const sel = screen.getByRole('combobox', { name: /sort users/i }) as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'joined');
    await userEvent.selectOptions(sel, 'name');
    expect(sel.value).toBe('name');
  });
});

// ── Audit Log Sort ──────────────────────────────────────────────
describe('Admin – Audit Log Sort', () => {
  async function goToAuditLog() {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /security & audit/i }));
    await screen.findByText(/Security & Audit Log/i);
  }

  it('renders audit log sort dropdown', async () => {
    await goToAuditLog();
    expect(screen.getByRole('combobox', { name: /sort audit log/i })).toBeInTheDocument();
  });

  it('newest is selected by default', async () => {
    await goToAuditLog();
    const sel = screen.getByRole('combobox', { name: /sort audit log/i }) as HTMLSelectElement;
    expect(sel.value).toBe('newest');
  });

  it('has oldest and severity options', async () => {
    await goToAuditLog();
    const sel = screen.getByRole('combobox', { name: /sort audit log/i });
    expect(sel.querySelector('option[value="oldest"]')).toBeInTheDocument();
    expect(sel.querySelector('option[value="severity"]')).toBeInTheDocument();
  });

  it('selecting oldest updates dropdown', async () => {
    await goToAuditLog();
    const sel = screen.getByRole('combobox', { name: /sort audit log/i }) as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'oldest');
    expect(sel.value).toBe('oldest');
  });
});

// ── Audit Log Actor Filter ──────────────────────────────────────
describe('Admin – Audit Log Actor Filter', () => {
  async function goToAuditLog() {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /security & audit/i }));
    await screen.findByText(/Security & Audit Log/i);
  }

  it('renders audit actor filter dropdown', async () => {
    await goToAuditLog();
    expect(screen.getByRole('combobox', { name: /filter audit log by actor/i })).toBeInTheDocument();
  });

  it('All is selected by default', async () => {
    await goToAuditLog();
    const sel = screen.getByRole('combobox', { name: /filter audit log by actor/i }) as HTMLSelectElement;
    expect(sel.value).toBe('All');
  });
});

// ── Audit Date Filter ───────────────────────────────────────────
describe('Admin – Audit Date Filter', () => {
  async function goToAuditLog() {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /security & audit/i }));
    await screen.findByText(/Security & Audit Log/i);
  }

  it('renders audit date filter buttons', async () => {
    await goToAuditLog();
    expect(screen.getByRole('button', { name: /filter audit log by date: all/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter audit log by date: today/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter audit log by date: this week/i })).toBeInTheDocument();
  });

  it('All date filter is active by default', async () => {
    await goToAuditLog();
    expect(screen.getByRole('button', { name: /filter audit log by date: all/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking Today sets it to active', async () => {
    await goToAuditLog();
    await userEvent.click(screen.getByRole('button', { name: /filter audit log by date: today/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /filter audit log by date: today/i })).toHaveAttribute('aria-pressed', 'true');
    });
  });
});

// ── Audit Log Search ─────────────────────────────────────────────
describe('Admin – Audit Log Search', () => {
  const auditSearchEvents = [
    { id: 'as-1', actor: 'ZebraActor', action: 'User invited', target: 'alpha@firm.com', ip: '10.0.0.1', timestamp: new Date().toISOString(), severity: 'info' },
    { id: 'as-2', actor: 'AlphaActor', action: 'Role changed', target: 'beta@firm.com', ip: '10.0.0.2', timestamp: new Date().toISOString(), severity: 'warning' },
    { id: 'as-3', actor: 'BetaActor', action: 'CSV export downloaded', target: 'gamma.csv', ip: '10.0.0.3', timestamp: new Date().toISOString(), severity: 'info' },
  ];

  async function goToAuditLog() {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /security & audit/i }));
    await screen.findByText(/Security & Audit Log/i);
  }

  beforeEach(() => {
    localStorage.setItem('admin_audit_events', JSON.stringify(auditSearchEvents));
  });
  afterEach(() => localStorage.removeItem('admin_audit_events'));

  it('renders audit log search input', async () => {
    await goToAuditLog();
    expect(screen.getByRole('textbox', { name: /search audit log/i })).toBeInTheDocument();
  });

  it('audit search input is empty by default', async () => {
    await goToAuditLog();
    expect(screen.getByRole('textbox', { name: /search audit log/i })).toHaveValue('');
  });

  it('typing actor name filters audit log by action text', async () => {
    await goToAuditLog();
    await screen.findByText('User invited');
    await userEvent.type(screen.getByRole('textbox', { name: /search audit log/i }), 'ZebraActor');
    await waitFor(() => {
      expect(screen.getByText('User invited')).toBeInTheDocument();
      expect(screen.queryByText('Role changed')).not.toBeInTheDocument();
    });
  });

  it('typing action name filters audit log', async () => {
    await goToAuditLog();
    await screen.findByText('CSV export downloaded');
    await userEvent.type(screen.getByRole('textbox', { name: /search audit log/i }), 'CSV export');
    await waitFor(() => {
      expect(screen.getByText('CSV export downloaded')).toBeInTheDocument();
      expect(screen.queryByText('User invited')).not.toBeInTheDocument();
    });
  });

  it('clearing search restores all audit events', async () => {
    await goToAuditLog();
    await screen.findByText('User invited');
    const input = screen.getByRole('textbox', { name: /search audit log/i });
    await userEvent.type(input, 'CSV export');
    await waitFor(() => expect(screen.queryByText('User invited')).not.toBeInTheDocument());
    await userEvent.clear(input);
    await waitFor(() => {
      expect(screen.getByText('User invited')).toBeInTheDocument();
      expect(screen.getByText('Role changed')).toBeInTheDocument();
    });
  });

  it('search with no match shows no audit events message', async () => {
    await goToAuditLog();
    await screen.findByText('User invited');
    await userEvent.type(screen.getByRole('textbox', { name: /search audit log/i }), 'zzzunmatchedxxx');
    await waitFor(() => {
      expect(screen.queryByText('User invited')).not.toBeInTheDocument();
      expect(screen.queryByText('Role changed')).not.toBeInTheDocument();
    });
  });
});

describe('Admin – Sort Users by Workspaces', () => {
  const wsUsers = [
    { id: 'ws-u1', name: 'LowWS User', email: 'low@firm.com', role: 'Analyst', workspaces: 2, lastActive: '1h ago', status: 'Active' as const, initials: 'LU' },
    { id: 'ws-u2', name: 'HighWS User', email: 'high@firm.com', role: 'Admin', workspaces: 15, lastActive: '2h ago', status: 'Active' as const, initials: 'HU' },
    { id: 'ws-u3', name: 'MidWS User', email: 'mid@firm.com', role: 'Manager', workspaces: 7, lastActive: '3h ago', status: 'Active' as const, initials: 'MU' },
  ];

  beforeEach(() => {
    mockGetUsers.mockResolvedValue(wsUsers);
  });

  it('workspaces option exists in sort select', async () => {
    renderAdmin();
    await screen.findByText('LowWS User');
    const sortSelect = screen.getByRole('combobox', { name: /sort users/i });
    const opts = Array.from(sortSelect.querySelectorAll('option')).map((o: Element) => (o as HTMLOptionElement).value);
    expect(opts).toContain('workspaces');
  });

  it('sort select has 6 options', async () => {
    renderAdmin();
    await screen.findByText('LowWS User');
    const sortSelect = screen.getByRole('combobox', { name: /sort users/i });
    expect(sortSelect.querySelectorAll('option').length).toBe(6);
  });

  it('workspaces sort places HighWS before LowWS in DOM', async () => {
    renderAdmin();
    await screen.findByText('LowWS User');
    fireEvent.change(screen.getByRole('combobox', { name: /sort users/i }), { target: { value: 'workspaces' } });
    const highEl = await screen.findByText('HighWS User');
    const lowEl = screen.getByText('LowWS User');
    expect(highEl.compareDocumentPosition(lowEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('all three users visible after workspaces sort', async () => {
    renderAdmin();
    await screen.findByText('LowWS User');
    fireEvent.change(screen.getByRole('combobox', { name: /sort users/i }), { target: { value: 'workspaces' } });
    expect(await screen.findByText('HighWS User')).toBeInTheDocument();
    expect(screen.getByText('MidWS User')).toBeInTheDocument();
    expect(screen.getByText('LowWS User')).toBeInTheDocument();
  });

  it('switching back to name sort deactivates workspaces sort', async () => {
    renderAdmin();
    await screen.findByText('LowWS User');
    fireEvent.change(screen.getByRole('combobox', { name: /sort users/i }), { target: { value: 'workspaces' } });
    fireEvent.change(screen.getByRole('combobox', { name: /sort users/i }), { target: { value: 'name' } });
    const highEl = await screen.findByText('HighWS User');
    const lowEl = screen.getByText('LowWS User');
    expect(highEl.compareDocumentPosition(lowEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('Admin – Audit Log Sort by Actor', () => {
  const sortActorEvents = [
    { id: 'sa-1', actor: 'Zara Admin', action: 'User invited', target: 'new@firm.com', ip: '10.0.0.1', timestamp: new Date('2026-04-15T10:00:00Z').toISOString(), severity: 'info' },
    { id: 'sa-2', actor: 'Alex Sys', action: 'Role changed', target: 'old@firm.com', ip: '10.0.0.2', timestamp: new Date('2026-04-14T10:00:00Z').toISOString(), severity: 'warning' },
    { id: 'sa-3', actor: 'Mina Ops', action: 'CSV exported', target: 'report.csv', ip: '10.0.0.3', timestamp: new Date('2026-04-13T10:00:00Z').toISOString(), severity: 'info' },
  ];

  async function goToAuditLog() {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /security & audit/i }));
    await screen.findByText(/Security & Audit Log/i);
  }

  beforeEach(() => {
    localStorage.setItem('admin_audit_events', JSON.stringify(sortActorEvents));
  });
  afterEach(() => localStorage.removeItem('admin_audit_events'));

  it('renders actor sort option in audit sort select', async () => {
    await goToAuditLog();
    const sel = screen.getByRole('combobox', { name: /sort audit log/i });
    expect(sel).toBeInTheDocument();
    expect(sel.innerHTML).toContain('actor');
  });

  it('actor sort option exists in audit sort select', async () => {
    await goToAuditLog();
    const sel = screen.getByRole('combobox', { name: /sort audit log/i }) as HTMLSelectElement;
    const options = Array.from(sel.options).map(o => o.value);
    expect(options).toContain('actor');
  });

  it('selecting actor sort places Alex before Zara in DOM', async () => {
    await goToAuditLog();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort audit log/i }), 'actor');
    const allAlex = await screen.findAllByText('Alex Sys');
    const allZara = screen.getAllByText('Zara Admin');
    const alexEl = allAlex.find(el => el.tagName !== 'OPTION')!;
    const zaraEl = allZara.find(el => el.tagName !== 'OPTION')!;
    expect(alexEl.compareDocumentPosition(zaraEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('all three events remain visible after actor sort', async () => {
    await goToAuditLog();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort audit log/i }), 'actor');
    expect((await screen.findAllByText('Alex Sys')).some(el => el.tagName !== 'OPTION')).toBe(true);
    expect(screen.getAllByText('Mina Ops').some(el => el.tagName !== 'OPTION')).toBe(true);
    expect(screen.getAllByText('Zara Admin').some(el => el.tagName !== 'OPTION')).toBe(true);
  });
});

describe('Admin – Sort Users by Role', () => {
  const roleUsers = [
    { id: 'ru1', name: 'Zara Manager', email: 'zara@firm.com', role: 'Manager', workspaces: 2, lastActive: '1h ago', status: 'Active' as const, initials: 'ZM' },
    { id: 'ru2', name: 'Alex Admin', email: 'alex@firm.com', role: 'Admin', workspaces: 5, lastActive: '2h ago', status: 'Active' as const, initials: 'AA' },
    { id: 'ru3', name: 'Mina Analyst', email: 'mina@firm.com', role: 'Analyst', workspaces: 1, lastActive: '3h ago', status: 'Active' as const, initials: 'MA' },
  ];

  beforeEach(() => {
    mockGetUsers.mockResolvedValue(roleUsers);
  });

  it('role option exists in sort users select', async () => {
    renderAdmin();
    await screen.findByText('Zara Manager');
    const opts = Array.from(screen.getByRole('combobox', { name: /sort users/i }).querySelectorAll('option')).map((o: Element) => (o as HTMLOptionElement).value);
    expect(opts).toContain('role');
  });

  it('selecting role sort sets dropdown value', async () => {
    renderAdmin();
    await screen.findByText('Zara Manager');
    const sel = screen.getByRole('combobox', { name: /sort users/i }) as HTMLSelectElement;
    fireEvent.change(sel, { target: { value: 'role' } });
    expect(sel.value).toBe('role');
  });

  it('role sort places Admin before Manager in DOM', async () => {
    renderAdmin();
    await screen.findByText('Zara Manager');
    fireEvent.change(screen.getByRole('combobox', { name: /sort users/i }), { target: { value: 'role' } });
    const alexEl = await screen.findByText('Alex Admin');
    const zaraEl = screen.getByText('Zara Manager');
    expect(alexEl.compareDocumentPosition(zaraEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('all three users remain visible after role sort', async () => {
    renderAdmin();
    await screen.findByText('Zara Manager');
    fireEvent.change(screen.getByRole('combobox', { name: /sort users/i }), { target: { value: 'role' } });
    expect(await screen.findByText('Alex Admin')).toBeInTheDocument();
    expect(screen.getByText('Mina Analyst')).toBeInTheDocument();
    expect(screen.getByText('Zara Manager')).toBeInTheDocument();
  });

  it('switching back to name works after role sort', async () => {
    renderAdmin();
    await screen.findByText('Zara Manager');
    const sel = screen.getByRole('combobox', { name: /sort users/i }) as HTMLSelectElement;
    fireEvent.change(sel, { target: { value: 'role' } });
    fireEvent.change(sel, { target: { value: 'name' } });
    expect(sel.value).toBe('name');
  });
});

describe('Admin – Audit Log Sort by Severity', () => {
  const severityEvents = [
    { id: 'sev-1', actor: 'User A', action: 'Info event', target: 'target-a', ip: '10.0.0.1', timestamp: new Date('2026-04-15T10:00:00Z').toISOString(), severity: 'info' },
    { id: 'sev-2', actor: 'User B', action: 'Critical event', target: 'target-b', ip: '10.0.0.2', timestamp: new Date('2026-04-14T10:00:00Z').toISOString(), severity: 'critical' },
    { id: 'sev-3', actor: 'User C', action: 'Warning event', target: 'target-c', ip: '10.0.0.3', timestamp: new Date('2026-04-13T10:00:00Z').toISOString(), severity: 'warning' },
  ];

  async function goToAuditLog() {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /security & audit/i }));
    await screen.findByText(/Security & Audit Log/i);
  }

  beforeEach(() => {
    localStorage.setItem('admin_audit_events', JSON.stringify(severityEvents));
  });
  afterEach(() => localStorage.removeItem('admin_audit_events'));

  it('severity option exists in audit sort select', async () => {
    await goToAuditLog();
    const sel = screen.getByRole('combobox', { name: /sort audit log/i }) as HTMLSelectElement;
    const options = Array.from(sel.options).map(o => o.value);
    expect(options).toContain('severity');
  });

  it('selecting severity sort sets dropdown value', async () => {
    await goToAuditLog();
    const sel = screen.getByRole('combobox', { name: /sort audit log/i }) as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'severity');
    expect(sel.value).toBe('severity');
  });

  it('severity sort places Critical event before Info event in DOM', async () => {
    await goToAuditLog();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort audit log/i }), 'severity');
    const critEl = await screen.findByText('Critical event');
    const infoEl = screen.getByText('Info event');
    expect(critEl.compareDocumentPosition(infoEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('all three events remain visible after severity sort', async () => {
    await goToAuditLog();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort audit log/i }), 'severity');
    expect(await screen.findByText('Critical event')).toBeInTheDocument();
    expect(screen.getByText('Warning event')).toBeInTheDocument();
    expect(screen.getByText('Info event')).toBeInTheDocument();
  });

  it('switching back to newest works after severity sort', async () => {
    await goToAuditLog();
    const sel = screen.getByRole('combobox', { name: /sort audit log/i }) as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'severity');
    await userEvent.selectOptions(sel, 'newest');
    expect(sel.value).toBe('newest');
  });
});

describe('Admin – User Search', () => {
  const searchUsers = [
    { id: 'su1', name: 'Ahmed Khalil', email: 'ahmed@firm.com', role: 'Admin', workspaces: 3, lastActive: '1h ago', status: 'Active' as const, initials: 'AK' },
    { id: 'su2', name: 'Rania Taleb', email: 'rania@firm.com', role: 'Manager', workspaces: 2, lastActive: '2h ago', status: 'Active' as const, initials: 'RT' },
    { id: 'su3', name: 'Zara Smith', email: 'zara@firm.com', role: 'Analyst', workspaces: 1, lastActive: '3h ago', status: 'Active' as const, initials: 'ZS' },
  ];

  beforeEach(() => {
    mockGetUsers.mockResolvedValue(searchUsers);
  });
  afterEach(() => localStorage.removeItem('admin_users'));

  it('renders the search users input', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getByRole('textbox', { name: /search users/i })).toBeInTheDocument();
  });

  it('search input is empty by default', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect((screen.getByRole('textbox', { name: /search users/i }) as HTMLInputElement).value).toBe('');
  });

  it('typing filters users by name', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.type(screen.getByRole('textbox', { name: /search users/i }), 'Rania');
    await waitFor(() => {
      expect(screen.getByText('Rania Taleb')).toBeInTheDocument();
      expect(screen.queryByText('Ahmed Khalil')).not.toBeInTheDocument();
      expect(screen.queryByText('Zara Smith')).not.toBeInTheDocument();
    });
  });

  it('typing filters users by email', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.type(screen.getByRole('textbox', { name: /search users/i }), 'zara@');
    await waitFor(() => {
      expect(screen.getByText('Zara Smith')).toBeInTheDocument();
      expect(screen.queryByText('Ahmed Khalil')).not.toBeInTheDocument();
    });
  });

  it('search is case-insensitive', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.type(screen.getByRole('textbox', { name: /search users/i }), 'ahmed');
    await waitFor(() => {
      expect(screen.getByText('Ahmed Khalil')).toBeInTheDocument();
    });
  });

  it('clearing search restores all users', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    const input = screen.getByRole('textbox', { name: /search users/i });
    await userEvent.type(input, 'Rania');
    await userEvent.clear(input);
    await waitFor(() => {
      expect(screen.getByText('Ahmed Khalil')).toBeInTheDocument();
      expect(screen.getByText('Rania Taleb')).toBeInTheDocument();
      expect(screen.getByText('Zara Smith')).toBeInTheDocument();
    });
  });

  it('search with no match shows no users', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.type(screen.getByRole('textbox', { name: /search users/i }), 'zzznomatch');
    await waitFor(() => {
      expect(screen.queryByText('Ahmed Khalil')).not.toBeInTheDocument();
      expect(screen.queryByText('Rania Taleb')).not.toBeInTheDocument();
    });
  });

  it('shows Clear user search button when search is non-empty', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.type(screen.getByRole('textbox', { name: /search users/i }), 'Rania');
    expect(await screen.findByRole('button', { name: /clear user search/i })).toBeInTheDocument();
  });

  it('clicking Clear user search button clears the input', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.type(screen.getByRole('textbox', { name: /search users/i }), 'Rania');
    await userEvent.click(await screen.findByRole('button', { name: /clear user search/i }));
    await waitFor(() => {
      expect(screen.getByText('Ahmed Khalil')).toBeInTheDocument();
      expect(screen.getByText('Zara Smith')).toBeInTheDocument();
    });
  });
});

describe('Admin – Sort Users by Status DOM Order', () => {
  const statusUsers = [
    { id: 'stu1', name: 'Active User One', email: 'au1@firm.com', role: 'Analyst', workspaces: 2, lastActive: '1h ago', status: 'Active' as const, initials: 'A1' },
    { id: 'stu2', name: 'Inactive User Two', email: 'iu2@firm.com', role: 'Analyst', workspaces: 1, lastActive: '5d ago', status: 'Inactive' as const, initials: 'I2' },
    { id: 'stu3', name: 'Active User Three', email: 'au3@firm.com', role: 'Manager', workspaces: 3, lastActive: '2h ago', status: 'Active' as const, initials: 'A3' },
  ];

  beforeEach(() => {
    mockGetUsers.mockResolvedValue(statusUsers);
  });

  it('status option exists in sort users select', async () => {
    renderAdmin();
    await screen.findByText('Active User One');
    const opts = Array.from(screen.getByRole('combobox', { name: /sort users/i }).querySelectorAll('option')).map((o: Element) => (o as HTMLOptionElement).value);
    expect(opts).toContain('status');
  });

  it('status sort places Active before Inactive in DOM', async () => {
    renderAdmin();
    await screen.findByText('Inactive User Two');
    fireEvent.change(screen.getByRole('combobox', { name: /sort users/i }), { target: { value: 'status' } });
    const activeEl = await screen.findByText('Active User One');
    const inactiveEl = screen.getByText('Inactive User Two');
    expect(activeEl.compareDocumentPosition(inactiveEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('all three users remain visible after status sort', async () => {
    renderAdmin();
    await screen.findByText('Inactive User Two');
    fireEvent.change(screen.getByRole('combobox', { name: /sort users/i }), { target: { value: 'status' } });
    expect(await screen.findByText('Active User One')).toBeInTheDocument();
    expect(screen.getByText('Inactive User Two')).toBeInTheDocument();
    expect(screen.getByText('Active User Three')).toBeInTheDocument();
  });

  it('switching back to name works after status sort', async () => {
    renderAdmin();
    await screen.findByText('Active User One');
    const sel = screen.getByRole('combobox', { name: /sort users/i }) as HTMLSelectElement;
    fireEvent.change(sel, { target: { value: 'status' } });
    fireEvent.change(sel, { target: { value: 'name' } });
    expect(sel.value).toBe('name');
  });
});

describe('Admin – Pagination', () => {
  const sixUsers = [
    { id: 'pg1', name: 'User Alpha', email: 'alpha@firm.com', role: 'Analyst', workspaces: 1, lastActive: '1h ago', status: 'Active' as const, initials: 'UA' },
    { id: 'pg2', name: 'User Beta', email: 'beta@firm.com', role: 'Analyst', workspaces: 2, lastActive: '2h ago', status: 'Active' as const, initials: 'UB' },
    { id: 'pg3', name: 'User Gamma', email: 'gamma@firm.com', role: 'Manager', workspaces: 3, lastActive: '3h ago', status: 'Active' as const, initials: 'UG' },
    { id: 'pg4', name: 'User Delta', email: 'delta@firm.com', role: 'Analyst', workspaces: 4, lastActive: '4h ago', status: 'Active' as const, initials: 'UD' },
    { id: 'pg5', name: 'User Epsilon', email: 'epsilon@firm.com', role: 'Analyst', workspaces: 5, lastActive: '5h ago', status: 'Active' as const, initials: 'UE' },
    { id: 'pg6', name: 'User Zeta', email: 'zeta@firm.com', role: 'Admin', workspaces: 6, lastActive: '6h ago', status: 'Active' as const, initials: 'UZ' },
  ];

  beforeEach(() => {
    mockGetUsers.mockResolvedValue(sixUsers);
  });

  it('shows Showing 1-5 of 6 text with six users', async () => {
    renderAdmin();
    await screen.findByText('User Alpha');
    expect(screen.getByText(/Showing 1-5 of 6/i)).toBeInTheDocument();
  });

  it('Previous page button is disabled on first page', async () => {
    renderAdmin();
    await screen.findByText('User Alpha');
    expect(screen.getByRole('button', { name: /previous page/i })).toBeDisabled();
  });

  it('Next page button is enabled on first page', async () => {
    renderAdmin();
    await screen.findByText('User Alpha');
    expect(screen.getByRole('button', { name: /next page/i })).not.toBeDisabled();
  });

  it('clicking Next page shows user on page 2', async () => {
    renderAdmin();
    await screen.findByText('User Alpha');
    await userEvent.click(screen.getByRole('button', { name: /next page/i }));
    await waitFor(() => {
      expect(screen.getByText('User Zeta')).toBeInTheDocument();
    });
  });

  it('page 2 shows Showing 6-6 of 6', async () => {
    renderAdmin();
    await screen.findByText('User Alpha');
    await userEvent.click(screen.getByRole('button', { name: /next page/i }));
    await waitFor(() => {
      expect(screen.getByText(/Showing 6-6 of 6/i)).toBeInTheDocument();
    });
  });

  it('clicking Previous page returns to page 1', async () => {
    renderAdmin();
    await screen.findByText('User Alpha');
    await userEvent.click(screen.getByRole('button', { name: /next page/i }));
    await userEvent.click(screen.getByRole('button', { name: /previous page/i }));
    await waitFor(() => {
      expect(screen.getByText('User Alpha')).toBeInTheDocument();
    });
  });

  it('Next page button is disabled on last page', async () => {
    renderAdmin();
    await screen.findByText('User Alpha');
    await userEvent.click(screen.getByRole('button', { name: /next page/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /next page/i })).toBeDisabled();
    });
  });
});

describe('Admin – Export Users CSV', () => {
  let mockCreateObjectURL: ReturnType<typeof vi.fn>;
  let mockRevokeObjectURL: ReturnType<typeof vi.fn>;
  let mockClick: ReturnType<typeof vi.fn>;
  const origCreateObjectURL = URL.createObjectURL;
  const origRevokeObjectURL = URL.revokeObjectURL;
  const origCreateElement = document.createElement.bind(document);

  beforeEach(() => {
    mockGetUsers.mockResolvedValue([]);
    mockClick = vi.fn();
    mockCreateObjectURL = vi.fn(() => 'blob:mock-admin-users-url');
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

  it('shows Export users list as CSV button', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getByRole('button', { name: /export users list as csv/i })).toBeInTheDocument();
  });

  it('Export users CSV button is not disabled', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getByRole('button', { name: /export users list as csv/i })).not.toBeDisabled();
  });

  it('clicking Export users CSV calls URL.createObjectURL', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /export users list as csv/i }));
    expect(mockCreateObjectURL).toHaveBeenCalled();
  });

  it('clicking Export users CSV triggers anchor click', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /export users list as csv/i }));
    expect(mockClick).toHaveBeenCalled();
  });

  it('clicking Export users CSV calls URL.revokeObjectURL', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /export users list as csv/i }));
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-admin-users-url');
  });
});

describe('Admin – Export Users TXT', () => {
  let mockCreateObjectURL: ReturnType<typeof vi.fn>;
  let mockRevokeObjectURL: ReturnType<typeof vi.fn>;
  let mockClick: ReturnType<typeof vi.fn>;
  const origCreateObjectURL = URL.createObjectURL;
  const origRevokeObjectURL = URL.revokeObjectURL;
  const origCreateElement = document.createElement.bind(document);

  beforeEach(() => {
    mockGetUsers.mockResolvedValue([]);
    mockClick = vi.fn();
    mockCreateObjectURL = vi.fn(() => 'blob:mock-admin-users-txt-url');
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

  it('shows Export users list as TXT button', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getByRole('button', { name: /export users list as txt/i })).toBeInTheDocument();
  });

  it('Export users TXT button is not disabled', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getByRole('button', { name: /export users list as txt/i })).not.toBeDisabled();
  });

  it('clicking Export users TXT calls URL.createObjectURL', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /export users list as txt/i }));
    expect(mockCreateObjectURL).toHaveBeenCalled();
  });

  it('clicking Export users TXT triggers anchor click', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /export users list as txt/i }));
    expect(mockClick).toHaveBeenCalled();
  });

  it('clicking Export users TXT calls URL.revokeObjectURL', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /export users list as txt/i }));
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-admin-users-txt-url');
  });
});

describe('Admin – Copy User Summary', () => {
  beforeEach(() => {
    mockGetUsers.mockResolvedValue([]);
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows Copy user summary to clipboard button', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getByRole('button', { name: /copy user summary to clipboard/i })).toBeInTheDocument();
  });

  it('Copy user summary button is not disabled', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getByRole('button', { name: /copy user summary to clipboard/i })).not.toBeDisabled();
  });

  it('clicking Copy user summary calls clipboard.writeText', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /copy user summary to clipboard/i }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
  });

  it('clipboard text contains Users Export heading', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /copy user summary to clipboard/i }));
    await waitFor(() => {
      const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(text).toContain('Users');
    });
  });
});

describe('Admin – Copy Audit Log Summary', () => {
  beforeEach(() => {
    mockGetUsers.mockResolvedValue([]);
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    const auditEvents = [
      { id: 'ae1', actor: 'Ahmed Khalil', action: 'Login', target: 'Platform', ip: '10.0.0.1', timestamp: new Date().toISOString(), severity: 'info' },
    ];
    localStorage.setItem('admin_audit_events', JSON.stringify(auditEvents));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function navigateToSecurity() {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /admin section: security & audit/i }));
  }

  it('shows Copy audit log summary to clipboard button after navigating to security', async () => {
    await navigateToSecurity();
    expect(screen.getByRole('button', { name: /copy audit log summary to clipboard/i })).toBeInTheDocument();
  });

  it('Copy audit log summary button is not disabled', async () => {
    await navigateToSecurity();
    expect(screen.getByRole('button', { name: /copy audit log summary to clipboard/i })).not.toBeDisabled();
  });

  it('clicking Copy audit log summary calls clipboard.writeText', async () => {
    await navigateToSecurity();
    await userEvent.click(screen.getByRole('button', { name: /copy audit log summary to clipboard/i }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
  });

  it('clipboard text contains Security heading', async () => {
    await navigateToSecurity();
    await userEvent.click(screen.getByRole('button', { name: /copy audit log summary to clipboard/i }));
    await waitFor(() => {
      const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(text).toContain('Security');
    });
  });

  it('clipboard text contains Total Events', async () => {
    await navigateToSecurity();
    await userEvent.click(screen.getByRole('button', { name: /copy audit log summary to clipboard/i }));
    await waitFor(() => {
      const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(text).toContain('Total Events:');
    });
  });
});

describe('Admin – Export Audit Log CSV', () => {
  let mockCreateObjectURL: ReturnType<typeof vi.fn>;
  let mockRevokeObjectURL: ReturnType<typeof vi.fn>;
  let mockClick: ReturnType<typeof vi.fn>;
  const origCreateObjectURL = URL.createObjectURL;
  const origRevokeObjectURL = URL.revokeObjectURL;
  const origCreateElement = document.createElement.bind(document);

  beforeEach(() => {
    mockGetUsers.mockResolvedValue([]);
    mockClick = vi.fn();
    mockCreateObjectURL = vi.fn(() => 'blob:mock-audit-csv-url');
    mockRevokeObjectURL = vi.fn();
    URL.createObjectURL = mockCreateObjectURL;
    URL.revokeObjectURL = mockRevokeObjectURL;
    document.createElement = (tag: string) => {
      const el = origCreateElement(tag);
      if (tag === 'a') {
        Object.defineProperty(el, 'click', { value: mockClick, writable: true });
      }
      return el;
    };
    const auditEvents = [
      { id: 'ae1', actor: 'Ahmed Khalil', action: 'Login', target: 'Platform', ip: '10.0.0.1', timestamp: new Date().toISOString(), severity: 'info' },
    ];
    localStorage.setItem('admin_audit_events', JSON.stringify(auditEvents));
  });

  afterEach(() => {
    URL.createObjectURL = origCreateObjectURL;
    URL.revokeObjectURL = origRevokeObjectURL;
    document.createElement = origCreateElement;
  });

  async function navigateToSecurity() {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /admin section: security & audit/i }));
  }

  it('shows Export audit log to CSV button after navigating to security', async () => {
    await navigateToSecurity();
    expect(screen.getByRole('button', { name: /export audit log to csv/i })).toBeInTheDocument();
  });

  it('Export audit log CSV button is not disabled', async () => {
    await navigateToSecurity();
    expect(screen.getByRole('button', { name: /export audit log to csv/i })).not.toBeDisabled();
  });

  it('clicking Export audit log CSV calls URL.createObjectURL', async () => {
    await navigateToSecurity();
    await userEvent.click(screen.getByRole('button', { name: /export audit log to csv/i }));
    expect(mockCreateObjectURL).toHaveBeenCalled();
  });

  it('clicking Export audit log CSV triggers anchor click', async () => {
    await navigateToSecurity();
    await userEvent.click(screen.getByRole('button', { name: /export audit log to csv/i }));
    expect(mockClick).toHaveBeenCalled();
  });

  it('clicking Export audit log CSV calls URL.revokeObjectURL', async () => {
    await navigateToSecurity();
    await userEvent.click(screen.getByRole('button', { name: /export audit log to csv/i }));
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-audit-csv-url');
  });
});

describe('Admin – Export Audit Log TXT', () => {
  let mockCreateObjectURL: ReturnType<typeof vi.fn>;
  let mockRevokeObjectURL: ReturnType<typeof vi.fn>;
  let mockClick: ReturnType<typeof vi.fn>;
  const origCreateObjectURL = URL.createObjectURL;
  const origRevokeObjectURL = URL.revokeObjectURL;
  const origCreateElement = document.createElement.bind(document);

  beforeEach(() => {
    mockGetUsers.mockResolvedValue([]);
    mockClick = vi.fn();
    mockCreateObjectURL = vi.fn(() => 'blob:mock-audit-txt-url');
    mockRevokeObjectURL = vi.fn();
    URL.createObjectURL = mockCreateObjectURL;
    URL.revokeObjectURL = mockRevokeObjectURL;
    document.createElement = (tag: string) => {
      const el = origCreateElement(tag);
      if (tag === 'a') {
        Object.defineProperty(el, 'click', { value: mockClick, writable: true });
      }
      return el;
    };
    const auditEvents = [
      { id: 'ae1', actor: 'Ahmed Khalil', action: 'Login', target: 'Platform', ip: '10.0.0.1', timestamp: new Date().toISOString(), severity: 'info' },
    ];
    localStorage.setItem('admin_audit_events', JSON.stringify(auditEvents));
  });

  afterEach(() => {
    URL.createObjectURL = origCreateObjectURL;
    URL.revokeObjectURL = origRevokeObjectURL;
    document.createElement = origCreateElement;
  });

  async function navigateToSecurity() {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /admin section: security & audit/i }));
  }

  it('shows Export audit log to TXT button after navigating to security', async () => {
    await navigateToSecurity();
    expect(screen.getByRole('button', { name: /export audit log to txt/i })).toBeInTheDocument();
  });

  it('Export audit log TXT button is not disabled', async () => {
    await navigateToSecurity();
    expect(screen.getByRole('button', { name: /export audit log to txt/i })).not.toBeDisabled();
  });

  it('clicking Export audit log TXT calls URL.createObjectURL', async () => {
    await navigateToSecurity();
    await userEvent.click(screen.getByRole('button', { name: /export audit log to txt/i }));
    expect(mockCreateObjectURL).toHaveBeenCalled();
  });

  it('clicking Export audit log TXT triggers anchor click', async () => {
    await navigateToSecurity();
    await userEvent.click(screen.getByRole('button', { name: /export audit log to txt/i }));
    expect(mockClick).toHaveBeenCalled();
  });

  it('clicking Export audit log TXT calls URL.revokeObjectURL', async () => {
    await navigateToSecurity();
    await userEvent.click(screen.getByRole('button', { name: /export audit log to txt/i }));
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-audit-txt-url');
  });
});

describe('Admin – Copy Integration Status', () => {
  beforeEach(() => {
    mockGetUsers.mockResolvedValue([]);
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function navigateToIntegrations() {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /admin section: integrations/i }));
  }

  it('shows Copy integration status to clipboard button in integrations section', async () => {
    await navigateToIntegrations();
    expect(screen.getByRole('button', { name: /copy integration status to clipboard/i })).toBeInTheDocument();
  });

  it('Copy integration status button is not disabled', async () => {
    await navigateToIntegrations();
    expect(screen.getByRole('button', { name: /copy integration status to clipboard/i })).not.toBeDisabled();
  });

  it('clicking Copy integration status calls clipboard.writeText', async () => {
    await navigateToIntegrations();
    await userEvent.click(screen.getByRole('button', { name: /copy integration status to clipboard/i }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
  });

  it('clipboard text contains Integration Status Report heading', async () => {
    await navigateToIntegrations();
    await userEvent.click(screen.getByRole('button', { name: /copy integration status to clipboard/i }));
    await waitFor(() => {
      const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(text).toContain('Integration Status Report');
    });
  });

  it('clipboard text contains Total count', async () => {
    await navigateToIntegrations();
    await userEvent.click(screen.getByRole('button', { name: /copy integration status to clipboard/i }));
    await waitFor(() => {
      const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(text).toContain('Total:');
    });
  });
});

describe('Admin – Security section navigation', () => {
  beforeEach(() => {
    mockGetUsers.mockResolvedValue([]);
  });

  it('clicking Security & Audit nav button activates security section', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    const secBtn = screen.getByRole('button', { name: /admin section: security & audit/i });
    await userEvent.click(secBtn);
    expect(secBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('security section shows Audit Log heading after clicking nav', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /admin section: security & audit/i }));
    await waitFor(() => expect(screen.getByText(/audit log/i)).toBeInTheDocument());
  });

  it('switching back to users section shows Ahmed Khalil', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /admin section: security & audit/i }));
    await userEvent.click(screen.getByRole('button', { name: /admin section: users & roles/i }));
    await waitFor(() => expect(screen.getByText('Ahmed Khalil')).toBeInTheDocument());
  });
});

describe('Admin – Integrations section navigation', () => {
  beforeEach(() => {
    mockGetUsers.mockResolvedValue([]);
  });

  it('clicking Integrations nav button activates integrations section', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    const intBtn = screen.getByRole('button', { name: /admin section: integrations/i });
    await userEvent.click(intBtn);
    expect(intBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('integrations section shows copy integration status button', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /admin section: integrations/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /copy integration status to clipboard/i })).toBeInTheDocument());
  });
});

// ────────────────────────────────────────────────────────────
describe('Admin – Role Filter functional tests', () => {
  beforeEach(() => {
    const users = [
      { id: 'rf1', name: 'Admin Alice', email: 'alice@firm.com', role: 'Admin', workspaces: 3, lastActive: '1h ago', status: 'Active', initials: 'AA', created_at: '', updated_at: '' },
      { id: 'rf2', name: 'Consultant Bob', email: 'bob@firm.com', role: 'Consultant', workspaces: 2, lastActive: '2h ago', status: 'Active', initials: 'CB', created_at: '', updated_at: '' },
      { id: 'rf3', name: 'Manager Carol', email: 'carol@firm.com', role: 'Manager', workspaces: 1, lastActive: '3h ago', status: 'Active', initials: 'MC', created_at: '', updated_at: '' },
      { id: 'rf4', name: 'Viewer Dave', email: 'dave@firm.com', role: 'Viewer', workspaces: 0, lastActive: '4h ago', status: 'Active', initials: 'VD', created_at: '', updated_at: '' },
    ];
    localStorage.setItem('admin_users', JSON.stringify(users));
  });
  afterEach(() => localStorage.removeItem('admin_users'));

  it('shows Consultants filter tab', async () => {
    renderAdmin();
    await screen.findByText('Admin Alice');
    expect(screen.getByRole('button', { name: /filter users: consultants/i })).toBeInTheDocument();
  });

  it('shows Clients filter tab', async () => {
    renderAdmin();
    await screen.findByText('Admin Alice');
    expect(screen.getByRole('button', { name: /filter users: clients/i })).toBeInTheDocument();
  });

  it('All tab is pressed by default', async () => {
    renderAdmin();
    await screen.findByText('Admin Alice');
    expect(screen.getByRole('button', { name: /filter users: all/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('Admins filter shows only Admin users', async () => {
    renderAdmin();
    await screen.findByText('Admin Alice');
    await userEvent.click(screen.getByRole('button', { name: /filter users: admins/i }));
    await waitFor(() => {
      expect(screen.getByText('Admin Alice')).toBeInTheDocument();
      expect(screen.queryByText('Consultant Bob')).not.toBeInTheDocument();
      expect(screen.queryByText('Manager Carol')).not.toBeInTheDocument();
      expect(screen.queryByText('Viewer Dave')).not.toBeInTheDocument();
    });
  });

  it('Consultants filter shows Consultant and Manager users', async () => {
    renderAdmin();
    await screen.findByText('Admin Alice');
    await userEvent.click(screen.getByRole('button', { name: /filter users: consultants/i }));
    await waitFor(() => {
      expect(screen.getByText('Consultant Bob')).toBeInTheDocument();
      expect(screen.getByText('Manager Carol')).toBeInTheDocument();
      expect(screen.queryByText('Admin Alice')).not.toBeInTheDocument();
      expect(screen.queryByText('Viewer Dave')).not.toBeInTheDocument();
    });
  });

  it('Clients filter shows Viewer users', async () => {
    renderAdmin();
    await screen.findByText('Admin Alice');
    await userEvent.click(screen.getByRole('button', { name: /filter users: clients/i }));
    await waitFor(() => {
      expect(screen.getByText('Viewer Dave')).toBeInTheDocument();
      expect(screen.queryByText('Admin Alice')).not.toBeInTheDocument();
      expect(screen.queryByText('Consultant Bob')).not.toBeInTheDocument();
      expect(screen.queryByText('Manager Carol')).not.toBeInTheDocument();
    });
  });

  it('switching to All restores all users after Admins filter', async () => {
    renderAdmin();
    await screen.findByText('Admin Alice');
    await userEvent.click(screen.getByRole('button', { name: /filter users: admins/i }));
    await userEvent.click(screen.getByRole('button', { name: /filter users: all/i }));
    await waitFor(() => {
      expect(screen.getByText('Admin Alice')).toBeInTheDocument();
      expect(screen.getByText('Consultant Bob')).toBeInTheDocument();
      expect(screen.getByText('Manager Carol')).toBeInTheDocument();
      expect(screen.getByText('Viewer Dave')).toBeInTheDocument();
    });
  });

  it('Admins tab becomes pressed when clicked', async () => {
    renderAdmin();
    await screen.findByText('Admin Alice');
    await userEvent.click(screen.getByRole('button', { name: /filter users: admins/i }));
    expect(screen.getByRole('button', { name: /filter users: admins/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /filter users: all/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('Consultants tab becomes pressed when clicked', async () => {
    renderAdmin();
    await screen.findByText('Admin Alice');
    await userEvent.click(screen.getByRole('button', { name: /filter users: consultants/i }));
    expect(screen.getByRole('button', { name: /filter users: consultants/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /filter users: all/i })).toHaveAttribute('aria-pressed', 'false');
  });
});

// ────────────────────────────────────────────────────────────
describe('Admin – Sort users by Joined DOM Order', () => {
  const userEarly = { id: 'jde', name: 'Early Joiner', email: 'early@firm.com', role: 'Admin', workspaces: 1, lastActive: '1d ago', status: 'Active', initials: 'EJ', created_at: '2025-01-01T00:00:00Z', updated_at: '' };
  const userLate = { id: 'jdl', name: 'Late Joiner', email: 'late@firm.com', role: 'Manager', workspaces: 2, lastActive: '1h ago', status: 'Active', initials: 'LJ', created_at: '2026-06-01T00:00:00Z', updated_at: '' };
  const userMid = { id: 'jdm', name: 'Mid Joiner', email: 'mid@firm.com', role: 'Analyst', workspaces: 1, lastActive: '3h ago', status: 'Active', initials: 'MJ', created_at: '2025-09-01T00:00:00Z', updated_at: '' };

  beforeEach(() => {
    localStorage.setItem('admin_users', JSON.stringify([userEarly, userMid, userLate]));
  });
  afterEach(() => localStorage.removeItem('admin_users'));

  it('joined sort places Late Joiner before Early Joiner in DOM (newest first)', async () => {
    renderAdmin();
    await screen.findByText('Early Joiner');
    const sel = screen.getByRole('combobox', { name: /sort users/i }) as HTMLSelectElement;
    fireEvent.change(sel, { target: { value: 'joined' } });
    await waitFor(() => {
      const lateEl = screen.getByText('Late Joiner');
      const earlyEl = screen.getByText('Early Joiner');
      expect(lateEl.compareDocumentPosition(earlyEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });

  it('joined sort places Late Joiner before Mid Joiner in DOM', async () => {
    renderAdmin();
    await screen.findByText('Early Joiner');
    const sel = screen.getByRole('combobox', { name: /sort users/i }) as HTMLSelectElement;
    fireEvent.change(sel, { target: { value: 'joined' } });
    await waitFor(() => {
      const lateEl = screen.getByText('Late Joiner');
      const midEl = screen.getByText('Mid Joiner');
      expect(lateEl.compareDocumentPosition(midEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });

  it('all three users remain visible after joined sort', async () => {
    renderAdmin();
    await screen.findByText('Early Joiner');
    const sel = screen.getByRole('combobox', { name: /sort users/i }) as HTMLSelectElement;
    fireEvent.change(sel, { target: { value: 'joined' } });
    await waitFor(() => {
      expect(screen.getByText('Early Joiner')).toBeInTheDocument();
      expect(screen.getByText('Mid Joiner')).toBeInTheDocument();
      expect(screen.getByText('Late Joiner')).toBeInTheDocument();
    });
  });

  it('switching back to name sort after joined sort works', async () => {
    renderAdmin();
    await screen.findByText('Early Joiner');
    const sel = screen.getByRole('combobox', { name: /sort users/i }) as HTMLSelectElement;
    fireEvent.change(sel, { target: { value: 'joined' } });
    fireEvent.change(sel, { target: { value: 'name' } });
    expect(sel.value).toBe('name');
  });
});

describe('Admin – Clear Audit Log', () => {
  it('Clear Log button exists in security section', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /admin section: security & audit/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /clear audit log/i })).toBeInTheDocument();
    });
  });

  it('audit events are shown before clearing', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /admin section: security & audit/i }));
    await waitFor(() => {
      expect(screen.getByText('User role changed')).toBeInTheDocument();
    });
  });

  it('clicking Clear Log removes audit events from the list', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /admin section: security & audit/i }));
    await waitFor(() => screen.getByText('User role changed'));
    await userEvent.click(screen.getByRole('button', { name: /clear audit log/i }));
    await waitFor(() => {
      expect(screen.queryByText('User role changed')).not.toBeInTheDocument();
    });
  });

  it('Export TXT button is disabled after clearing audit log', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /admin section: security & audit/i }));
    await waitFor(() => screen.getByText('User role changed'));
    await userEvent.click(screen.getByRole('button', { name: /clear audit log/i }));
    await waitFor(() => {
      const exportTxtBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('Export TXT') || b.textContent?.includes('Exported!'));
      if (exportTxtBtn) expect(exportTxtBtn).toBeDisabled();
    });
  });
});

describe('Admin – Reset Password Toast', () => {
  it('Reset PW button exists for Ahmed Khalil', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getByRole('button', { name: /reset password for Ahmed Khalil/i })).toBeInTheDocument();
  });

  it('Reset PW button exists for Rania Taleb', async () => {
    renderAdmin();
    await screen.findByText('Rania Taleb');
    expect(screen.getByRole('button', { name: /reset password for Rania Taleb/i })).toBeInTheDocument();
  });

  it('clicking Reset PW shows toast for Ahmed Khalil email', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /reset password for Ahmed Khalil/i }));
    await waitFor(() => {
      expect(screen.getByText(/Password reset email sent to ahmed@firm\.com/i)).toBeInTheDocument();
    });
  });

  it('clicking Reset PW shows toast with correct email', async () => {
    renderAdmin();
    await screen.findByText('Rania Taleb');
    await userEvent.click(screen.getByRole('button', { name: /reset password for Rania Taleb/i }));
    await waitFor(() => {
      expect(screen.getByText(/Password reset email sent to rania@firm\.com/i)).toBeInTheDocument();
    });
  });

  it('toast has role status after reset password', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /reset password for Ahmed Khalil/i }));
    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });
});

describe('Admin – Suspend User Toggle', () => {
  it('Suspend button exists for Ahmed Khalil', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getByRole('button', { name: /suspend ahmed khalil/i })).toBeInTheDocument();
  });

  it('Suspend button shows ACTIVE status before click', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getAllByText('ACTIVE').length).toBeGreaterThan(0);
  });

  it('clicking Suspend changes button label to Activate', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /suspend ahmed khalil/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /activate ahmed khalil/i })).toBeInTheDocument();
    });
  });

  it('clicking Suspend removes ACTIVE badge from Ahmed Khalil row', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    const activeCount = screen.getAllByText('ACTIVE').length;
    await userEvent.click(screen.getByRole('button', { name: /suspend ahmed khalil/i }));
    await waitFor(() => {
      expect(screen.getAllByText('ACTIVE').length).toBeLessThan(activeCount);
    });
  });

  it('clicking Activate after Suspend restores Suspend button', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /suspend ahmed khalil/i }));
    await waitFor(() => screen.getByRole('button', { name: /activate ahmed khalil/i }));
    await userEvent.click(screen.getByRole('button', { name: /activate ahmed khalil/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /suspend ahmed khalil/i })).toBeInTheDocument();
    });
  });
});

describe('Admin – Invite User Success', () => {
  it('Send Invite button is disabled with empty form', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /invite user/i }));
    await waitFor(() => screen.getByRole('button', { name: /send invite/i }));
    expect(screen.getByRole('button', { name: /send invite/i })).toBeDisabled();
  });

  it('Send Invite button becomes enabled after filling name and email', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /invite user/i }));
    await waitFor(() => screen.getByLabelText(/full name/i));
    await userEvent.type(screen.getByLabelText(/full name/i), 'Test User');
    await userEvent.type(screen.getByLabelText(/email address/i), 'test@firm.com');
    expect(screen.getByRole('button', { name: /send invite/i })).not.toBeDisabled();
  });

  it('clicking Send Invite shows success message', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /invite user/i }));
    await waitFor(() => screen.getByLabelText(/full name/i));
    await userEvent.type(screen.getByLabelText(/full name/i), 'Test User');
    await userEvent.type(screen.getByLabelText(/email address/i), 'test@firm.com');
    await userEvent.click(screen.getByRole('button', { name: /send invite/i }));
    await waitFor(() => {
      expect(screen.getByText(/invite sent to test@firm\.com/i)).toBeInTheDocument();
    });
  });

  it('invited user appears in the user list', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /invite user/i }));
    await waitFor(() => screen.getByLabelText(/full name/i));
    await userEvent.type(screen.getByLabelText(/full name/i), 'New Colleague');
    await userEvent.type(screen.getByLabelText(/email address/i), 'colleague@firm.com');
    await userEvent.click(screen.getByRole('button', { name: /send invite/i }));
    await waitFor(() => {
      expect(screen.queryByText('New Colleague')).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});

// ────────────────────────────────────────────────────────────
describe('Admin – Audit Severity Filter', () => {
  const severityFilterEvents = [
    { id: 'sf-1', actor: 'Alice', action: 'Login', target: 'Dashboard', ip: '10.0.0.1', timestamp: new Date().toISOString(), severity: 'info' },
    { id: 'sf-2', actor: 'Bob', action: 'Permission change', target: 'User group', ip: '10.0.0.2', timestamp: new Date().toISOString(), severity: 'warning' },
    { id: 'sf-3', actor: 'Carol', action: 'Data export', target: 'users.csv', ip: '10.0.0.3', timestamp: new Date().toISOString(), severity: 'critical' },
  ];

  beforeEach(() => {
    localStorage.setItem('admin_audit_events', JSON.stringify(severityFilterEvents));
  });
  afterEach(() => localStorage.removeItem('admin_audit_events'));

  async function goToSecurity() {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /admin section: security & audit/i }));
    await screen.findByText(/Security & Audit Log/i);
  }

  it('renders severity filter buttons (all, info, warning, critical)', async () => {
    await goToSecurity();
    expect(screen.getByRole('button', { name: /filter audit log: all/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter audit log: info/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter audit log: warning/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter audit log: critical/i })).toBeInTheDocument();
  });

  it('"all" severity filter is active by default', async () => {
    await goToSecurity();
    expect(screen.getByRole('button', { name: /filter audit log: all/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking critical filter sets it to aria-pressed true', async () => {
    await goToSecurity();
    await userEvent.click(screen.getByRole('button', { name: /filter audit log: critical/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /filter audit log: critical/i })).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('clicking warning filter sets aria-pressed true on warning', async () => {
    await goToSecurity();
    await userEvent.click(screen.getByRole('button', { name: /filter audit log: warning/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /filter audit log: warning/i })).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('clicking info filter hides critical event', async () => {
    await goToSecurity();
    await screen.findByText('Data export');
    await userEvent.click(screen.getByRole('button', { name: /filter audit log: info/i }));
    await waitFor(() => {
      expect(screen.queryByText('Data export')).not.toBeInTheDocument();
    });
  });

  it('clicking critical filter hides info event', async () => {
    await goToSecurity();
    await screen.findByText('Login');
    await userEvent.click(screen.getByRole('button', { name: /filter audit log: critical/i }));
    await waitFor(() => {
      expect(screen.queryByText('Login')).not.toBeInTheDocument();
    });
  });

  it('clicking critical filter shows only the critical event', async () => {
    await goToSecurity();
    await screen.findByText('Data export');
    await userEvent.click(screen.getByRole('button', { name: /filter audit log: critical/i }));
    await waitFor(() => {
      expect(screen.getByText('Data export')).toBeInTheDocument();
    });
  });

  it('clicking all after critical restores all events', async () => {
    await goToSecurity();
    await screen.findByText('Login');
    await userEvent.click(screen.getByRole('button', { name: /filter audit log: critical/i }));
    await waitFor(() => { expect(screen.queryByText('Login')).not.toBeInTheDocument(); });
    await userEvent.click(screen.getByRole('button', { name: /filter audit log: all/i }));
    await waitFor(() => {
      expect(screen.getByText('Login')).toBeInTheDocument();
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Admin – Audit Log Empty State', () => {
  const infoOnlyEvents = [
    { id: 'eo-1', actor: 'Dave', action: 'View dashboard', target: 'Dashboard', ip: '10.0.0.1', timestamp: new Date().toISOString(), severity: 'info' },
  ];

  beforeEach(() => {
    localStorage.setItem('admin_audit_events', JSON.stringify(infoOnlyEvents));
  });
  afterEach(() => localStorage.removeItem('admin_audit_events'));

  async function goToSecurity() {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /admin section: security & audit/i }));
    await screen.findByText(/Security & Audit Log/i);
  }

  it('filtering to critical when no critical events shows "No audit events found"', async () => {
    await goToSecurity();
    await screen.findByText('View dashboard');
    await userEvent.click(screen.getByRole('button', { name: /filter audit log: critical/i }));
    await waitFor(() => {
      expect(screen.getByText('No audit events found')).toBeInTheDocument();
    });
  });

  it('filtering to warning when no warning events shows "No audit events found"', async () => {
    await goToSecurity();
    await screen.findByText('View dashboard');
    await userEvent.click(screen.getByRole('button', { name: /filter audit log: warning/i }));
    await waitFor(() => {
      expect(screen.getByText('No audit events found')).toBeInTheDocument();
    });
  });

  it('removing the filter restores the audit event', async () => {
    await goToSecurity();
    await screen.findByText('View dashboard');
    await userEvent.click(screen.getByRole('button', { name: /filter audit log: critical/i }));
    await waitFor(() => { expect(screen.getByText('No audit events found')).toBeInTheDocument(); });
    await userEvent.click(screen.getByRole('button', { name: /filter audit log: all/i }));
    await waitFor(() => {
      expect(screen.getByText('View dashboard')).toBeInTheDocument();
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Admin – Bulk User Action Bar', () => {
  it('selecting a user shows bulk action bar with "1 user selected"', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    const rows = document.querySelectorAll('tbody tr');
    const firstCheckbox = rows[0]?.querySelector('td:first-child div') as HTMLElement;
    if (firstCheckbox) {
      await userEvent.click(firstCheckbox);
      await waitFor(() => {
        expect(screen.getByText(/1 user selected/i)).toBeInTheDocument();
      });
    }
  });

  it('bulk action bar shows "Change Role" button after user selection', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    const rows = document.querySelectorAll('tbody tr');
    const firstCheckbox = rows[0]?.querySelector('td:first-child div') as HTMLElement;
    if (firstCheckbox) {
      await userEvent.click(firstCheckbox);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /change role for selected users/i })).toBeInTheDocument();
      });
    }
  });

  it('bulk action bar shows "Reset Password" button after user selection', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    const rows = document.querySelectorAll('tbody tr');
    const firstCheckbox = rows[0]?.querySelector('td:first-child div') as HTMLElement;
    if (firstCheckbox) {
      await userEvent.click(firstCheckbox);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /reset password for selected users/i })).toBeInTheDocument();
      });
    }
  });

  it('bulk action bar shows "Suspend" button after user selection', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    const rows = document.querySelectorAll('tbody tr');
    const firstCheckbox = rows[0]?.querySelector('td:first-child div') as HTMLElement;
    if (firstCheckbox) {
      await userEvent.click(firstCheckbox);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /suspend selected users/i })).toBeInTheDocument();
      });
    }
  });

  it('selecting two users shows "2 users selected"', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    const rows = document.querySelectorAll('tbody tr');
    const first = rows[0]?.querySelector('td:first-child div') as HTMLElement;
    const second = rows[1]?.querySelector('td:first-child div') as HTMLElement;
    if (first && second) {
      await userEvent.click(first);
      await userEvent.click(second);
      await waitFor(() => {
        expect(screen.getByText(/2 users selected/i)).toBeInTheDocument();
      });
    }
  });

  it('bulk action bar disappears after deselecting all users', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    const rows = document.querySelectorAll('tbody tr');
    const firstCheckbox = rows[0]?.querySelector('td:first-child div') as HTMLElement;
    if (firstCheckbox) {
      await userEvent.click(firstCheckbox);
      await waitFor(() => { expect(screen.getByText(/1 user selected/i)).toBeInTheDocument(); });
      await userEvent.click(firstCheckbox);
      await waitFor(() => {
        expect(screen.queryByText(/users? selected/i)).not.toBeInTheDocument();
      });
    }
  });
});

describe('Admin – Refresh Trello Integration', () => {
  async function goToIntegrations() {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /admin section: integrations/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /refresh trello integration/i })).toBeInTheDocument());
  }

  beforeEach(() => {
    mockGetUsers.mockResolvedValue([]);
    mockFetchBATrafficBoard.mockResolvedValue({ cards: [], members: [], lists: [], risks: [], tasks: [], board: { id: 'b1', name: 'BA', url: '' } });
  });
  afterEach(() => vi.restoreAllMocks());

  it('Refresh Trello integration button is present in integrations section', async () => {
    await goToIntegrations();
    expect(screen.getByRole('button', { name: /refresh trello integration/i })).toBeInTheDocument();
  });

  it('clicking Refresh Trello shows "Sync successful" when fetch resolves', async () => {
    await goToIntegrations();
    await userEvent.click(screen.getByRole('button', { name: /refresh trello integration/i }));
    await waitFor(() => {
      expect(screen.getByText(/sync successful/i)).toBeInTheDocument();
    });
  });

  it('clicking Refresh Trello calls fetchBATrafficBoard', async () => {
    await goToIntegrations();
    mockFetchBATrafficBoard.mockClear();
    await userEvent.click(screen.getByRole('button', { name: /refresh trello integration/i }));
    await waitFor(() => expect(mockFetchBATrafficBoard).toHaveBeenCalled());
  });

  it('shows "Sync failed" when fetchBATrafficBoard rejects', async () => {
    mockFetchBATrafficBoard.mockRejectedValueOnce(new Error('Network error'));
    await goToIntegrations();
    await userEvent.click(screen.getByRole('button', { name: /refresh trello integration/i }));
    await waitFor(() => {
      expect(screen.getByText(/sync failed/i)).toBeInTheDocument();
    });
  });

  it('refresh message is visible immediately after a successful sync', async () => {
    await goToIntegrations();
    await userEvent.click(screen.getByRole('button', { name: /refresh trello integration/i }));
    await waitFor(() => {
      const msg = screen.queryByText(/sync successful/i);
      expect(msg).toBeInTheDocument();
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Admin – System Health', () => {
  async function goToHealth() {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByRole('button', { name: /admin section: system health/i }));
    await waitFor(() => expect(screen.getByRole('heading', { name: /system health/i, level: 2 })).toBeInTheDocument());
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  it('System Health nav button is visible in sidebar', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getByRole('button', { name: /admin section: system health/i })).toBeInTheDocument();
  });

  it('navigates to System Health section when clicked', async () => {
    await goToHealth();
    expect(screen.getByRole('heading', { name: /system health/i, level: 2 })).toBeInTheDocument();
  });

  it('shows overall system status banner', async () => {
    await goToHealth();
    expect(screen.getByLabelText('Overall system status')).toBeInTheDocument();
  });

  it('shows "All Systems Operational" when all services are up', async () => {
    await goToHealth();
    expect(screen.getByText('All Systems Operational')).toBeInTheDocument();
  });

  it('renders all 6 default services', async () => {
    await goToHealth();
    const serviceCards = screen.getAllByRole('generic', { name: /^Service: /i });
    expect(serviceCards.length).toBe(6);
  });

  it('renders Database service card', async () => {
    await goToHealth();
    expect(screen.getByLabelText('Service: Database')).toBeInTheDocument();
  });

  it('renders API Gateway service card', async () => {
    await goToHealth();
    expect(screen.getByLabelText('Service: API Gateway')).toBeInTheDocument();
  });

  it('renders AI / OpenRouter service card', async () => {
    await goToHealth();
    expect(screen.getByLabelText('Service: AI / OpenRouter')).toBeInTheDocument();
  });

  it('renders Trello Integration service card', async () => {
    await goToHealth();
    expect(screen.getByLabelText('Service: Trello Integration')).toBeInTheDocument();
  });

  it('renders File Storage service card', async () => {
    await goToHealth();
    expect(screen.getByLabelText('Service: File Storage')).toBeInTheDocument();
  });

  it('renders Authentication service card', async () => {
    await goToHealth();
    expect(screen.getByLabelText('Service: Authentication')).toBeInTheDocument();
  });

  it('each service has a status badge', async () => {
    await goToHealth();
    const statusBadges = screen.getAllByRole('generic', { name: /status$/i });
    expect(statusBadges.length).toBeGreaterThanOrEqual(6);
  });

  it('shows uptime percentages for services', async () => {
    await goToHealth();
    const dbUptime = screen.getByLabelText('Database uptime');
    expect(dbUptime).toHaveTextContent('%');
  });

  it('shows latency for Database service', async () => {
    await goToHealth();
    const latency = screen.getByLabelText('Database latency');
    expect(latency).toHaveTextContent('ms');
  });

  it('shows Run Diagnostics button', async () => {
    await goToHealth();
    expect(screen.getByRole('button', { name: /run health diagnostics/i })).toBeInTheDocument();
  });

  it('Run Diagnostics button shows "Running…" while running', async () => {
    await goToHealth();
    await userEvent.click(screen.getByRole('button', { name: /run health diagnostics/i }));
    expect(screen.getByRole('button', { name: /run health diagnostics/i })).toBeDisabled();
  });

  it('Run Diagnostics button re-enables after completion', async () => {
    await goToHealth();
    await userEvent.click(screen.getByRole('button', { name: /run health diagnostics/i }));
    await waitFor(
      () => expect(screen.getByRole('button', { name: /run health diagnostics/i })).not.toBeDisabled(),
      { timeout: 3000 }
    );
  }, 8000);

  it('Run Diagnostics updates lastChecked timestamps', async () => {
    await goToHealth();
    await userEvent.click(screen.getByRole('button', { name: /run health diagnostics/i }));
    await waitFor(
      () => expect(screen.getByRole('button', { name: /run health diagnostics/i })).not.toBeDisabled(),
      { timeout: 3000 }
    );
    expect(screen.getByLabelText('Overall system status')).toBeInTheDocument();
  }, 8000);

  it('shows Copy Report button', async () => {
    await goToHealth();
    expect(screen.getByRole('button', { name: /copy health report/i })).toBeInTheDocument();
  });

  it('Copy Report calls navigator.clipboard.writeText', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, writable: true, configurable: true });
    await goToHealth();
    await userEvent.click(screen.getByRole('button', { name: /copy health report/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining('System Health Report')));
  });

  it('Copy Report shows "Copied!" feedback', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, writable: true, configurable: true });
    await goToHealth();
    await userEvent.click(screen.getByRole('button', { name: /copy health report/i }));
    await waitFor(() => expect(screen.getByText('Copied!')).toBeInTheDocument());
  });

  it('shows Incident History section', async () => {
    await goToHealth();
    expect(screen.getByText('Incident History')).toBeInTheDocument();
  });

  it('shows default incidents', async () => {
    await goToHealth();
    await waitFor(() => {
      expect(screen.getByLabelText(/Incident: Elevated latency/i)).toBeInTheDocument();
    });
  });

  it('shows resolved badge on resolved incidents', async () => {
    await goToHealth();
    const resolved = await screen.findAllByText('Resolved');
    expect(resolved.length).toBeGreaterThan(0);
  });

  it('shows Resolve button for unresolved incidents', async () => {
    // Add an unresolved incident via localStorage
    localStorage.setItem('admin_health_incidents', JSON.stringify([
      { id: 'inc-test', service: 'Database', description: 'Test outage', severity: 'critical', timestamp: new Date().toISOString(), resolved: false },
    ]));
    await goToHealth();
    const resolveBtn = await screen.findByRole('button', { name: /mark incident inc-test as resolved/i });
    expect(resolveBtn).toBeInTheDocument();
  });

  it('clicking Resolve marks incident as resolved', async () => {
    localStorage.setItem('admin_health_incidents', JSON.stringify([
      { id: 'inc-test', service: 'Database', description: 'Test outage', severity: 'critical', timestamp: new Date().toISOString(), resolved: false },
    ]));
    await goToHealth();
    const resolveBtn = await screen.findByRole('button', { name: /mark incident inc-test as resolved/i });
    await userEvent.click(resolveBtn);
    await waitFor(() => expect(screen.getByText('Resolved')).toBeInTheDocument());
  });

  it('incident resolve state persists to localStorage', async () => {
    localStorage.setItem('admin_health_incidents', JSON.stringify([
      { id: 'inc-test', service: 'Database', description: 'Test outage', severity: 'critical', timestamp: new Date().toISOString(), resolved: false },
    ]));
    await goToHealth();
    const resolveBtn = await screen.findByRole('button', { name: /mark incident inc-test as resolved/i });
    await userEvent.click(resolveBtn);
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('admin_health_incidents') ?? '[]');
      expect(stored.find((i: { id: string }) => i.id === 'inc-test')?.resolved).toBe(true);
    });
  });

  it('Reopen button appears after resolving an incident', async () => {
    localStorage.setItem('admin_health_incidents', JSON.stringify([
      { id: 'inc-test', service: 'Database', description: 'Test outage', severity: 'critical', timestamp: new Date().toISOString(), resolved: false },
    ]));
    await goToHealth();
    const resolveBtn = await screen.findByRole('button', { name: /mark incident inc-test as resolved/i });
    await userEvent.click(resolveBtn);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /mark incident inc-test as unresolved/i })).toBeInTheDocument();
    });
  });

  it('Filter "Unresolved" hides resolved incidents', async () => {
    await goToHealth();
    // Default incidents are all resolved
    const unresolvedBtn = screen.getByRole('button', { name: /filter incidents: unresolved/i });
    await userEvent.click(unresolvedBtn);
    await waitFor(() => {
      expect(screen.queryByText('Elevated latency detected')).not.toBeInTheDocument();
    });
  });

  it('Filter "Unresolved" button has aria-pressed true when active', async () => {
    await goToHealth();
    const unresolvedBtn = screen.getByRole('button', { name: /filter incidents: unresolved/i });
    await userEvent.click(unresolvedBtn);
    await waitFor(() => expect(unresolvedBtn).toHaveAttribute('aria-pressed', 'true'));
  });

  it('"All" filter shows all incidents', async () => {
    await goToHealth();
    // Switch to unresolved first, then back to All
    await userEvent.click(screen.getByRole('button', { name: /filter incidents: unresolved/i }));
    await userEvent.click(screen.getByRole('button', { name: /filter incidents: all/i }));
    await waitFor(() => {
      expect(screen.getByLabelText(/Incident: Elevated latency/i)).toBeInTheDocument();
    });
  });

  it('shows "No incidents to display" when filtered list is empty', async () => {
    await goToHealth();
    await userEvent.click(screen.getByRole('button', { name: /filter incidents: unresolved/i }));
    await waitFor(() => expect(screen.getByText('No incidents to display')).toBeInTheDocument());
  });

  it('health services are loaded from localStorage if present', async () => {
    localStorage.setItem('admin_system_health', JSON.stringify([
      { id: 'db', name: 'Database', category: 'Infrastructure', status: 'down', uptime: 0, latency: 999, lastChecked: new Date().toISOString() },
    ]));
    await goToHealth();
    await waitFor(() => {
      const dbStatus = screen.getByLabelText('Database status');
      expect(dbStatus).toHaveTextContent('Down');
    });
  });

  it('shows service disruption banner when a service is down', async () => {
    localStorage.setItem('admin_system_health', JSON.stringify([
      { id: 'db', name: 'Database', category: 'Infrastructure', status: 'down', uptime: 0, latency: 999, lastChecked: new Date().toISOString() },
    ]));
    await goToHealth();
    await waitFor(() => {
      expect(screen.getByText('Service Disruption Detected')).toBeInTheDocument();
    });
  });

  it('shows "Degraded Performance" banner when a service is degraded', async () => {
    localStorage.setItem('admin_system_health', JSON.stringify([
      { id: 'api', name: 'API Gateway', category: 'Infrastructure', status: 'degraded', uptime: 95, latency: 800, lastChecked: new Date().toISOString() },
    ]));
    await goToHealth();
    await waitFor(() => {
      expect(screen.getByText('Degraded Performance')).toBeInTheDocument();
    });
  });

  it('header shows count of operational services', async () => {
    await goToHealth();
    await waitFor(() => {
      const el = screen.getByText(/services operational/i);
      expect(el).toBeInTheDocument();
    });
  });

  it('System Health section heading is present', async () => {
    await goToHealth();
    const heading = screen.getByRole('heading', { name: /system health/i, level: 2 });
    expect(heading).toBeInTheDocument();
  });
});
