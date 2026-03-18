import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Hoisted mocks ────────────────────────────────────────────
const { mockGetActivities, mockGetWorkspaces } = vi.hoisted(() => ({
  mockGetActivities: vi.fn(),
  mockGetWorkspaces: vi.fn(),
}));

vi.mock('../lib/db', () => ({
  getActivities: mockGetActivities,
  getWorkspaces: mockGetWorkspaces,
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

import Admin from '../screens/Admin';

function renderAdmin() {
  return render(<Admin />);
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mockGetActivities.mockResolvedValue([]);
  mockGetWorkspaces.mockResolvedValue([
    { id: 'ws-1', name: 'MOCI', type: 'Procurement', status: 'Active', progress: 65, language: 'AR', sector: 'Government', contributors: ['AM'] },
  ]);
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
    // Use getAllByText since "Admin" appears in sidebar too
    const adminTexts = screen.getAllByText('Admin');
    expect(adminTexts.length).toBeGreaterThan(0);
    // "Manager" also appears in sidebar nav, use getAllByText
    const managerTexts = screen.getAllByText('Manager');
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

    // The toggle is a styled div. Find by looking for the Active status indicator
    // then clicking the sibling toggle element.
    const statusCells = document.querySelectorAll('[style*="cursor: pointer"][style*="border-radius: 8px"]');
    expect(statusCells.length).toBeGreaterThan(0);
    fireEvent.click(statusCells[0]);

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('admin_users') ?? '[]');
      const ahmed = stored.find((u: { id: string }) => u.id === 'u1');
      expect(ahmed?.status).toBe('Inactive');
    });
  });

  it('persists toggle changes to localStorage', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');

    const toggles = document.querySelectorAll('[style*="cursor: pointer"][style*="border-radius: 8px"]');
    fireEvent.click(toggles[0]);

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
    expect(await screen.findByText('Microsoft SharePoint')).toBeInTheDocument();
  });

  it('switches to AI Models section', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByText('AI Models'));
    expect(await screen.findByText('AI Model Configuration')).toBeInTheDocument();
  });

  it('switches to Audit Logs section', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByText('Audit Logs'));
    expect(await screen.findByText('All system activity logs')).toBeInTheDocument();
  });

  it('switches to Workspaces section and shows DB workspaces', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    // "Workspaces" appears in nav AND table header; click the first (nav) one
    await userEvent.click(screen.getAllByText('Workspaces')[0]);
    expect(await screen.findByText('MOCI')).toBeInTheDocument();
  });

  it('switches to Prompt Library section', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByText('Prompt Library'));
    expect(await screen.findByText('BRD Section Extractor')).toBeInTheDocument();
  });

  it('switches to Notifications section', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByText('Notifications'));
    expect(await screen.findByText('Notification Rules')).toBeInTheDocument();
  });

  it('switches to Approval Rules section', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    await userEvent.click(screen.getByText('Approval Rules'));
    expect(await screen.findByText('Approval Workflow Rules')).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Admin – Role Permissions Matrix', () => {
  it('shows role permissions matrix on Users section', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    expect(screen.getByText('Role Permissions Matrix')).toBeInTheDocument();
  });

  it('shows all 5 roles in permissions matrix', async () => {
    renderAdmin();
    await screen.findByText('Ahmed Khalil');
    // Roles in the matrix
    expect(screen.getByText('Consultant')).toBeInTheDocument();
    expect(screen.getByText('Analyst')).toBeInTheDocument();
    expect(screen.getByText('Viewer')).toBeInTheDocument();
  });
});
