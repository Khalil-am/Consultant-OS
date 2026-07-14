import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LayoutProvider, useLayout } from '../hooks/useLayout';

// ── Test component that exposes hook values ───────────────────
function LayoutConsumer() {
  const { sidebarOpen, setSidebarOpen, isMobile, isTablet, width } = useLayout();
  return (
    <div>
      <span data-testid="sidebar">{sidebarOpen ? 'open' : 'closed'}</span>
      <span data-testid="isMobile">{String(isMobile)}</span>
      <span data-testid="isTablet">{String(isTablet)}</span>
      <span data-testid="width">{width}</span>
      <button onClick={() => setSidebarOpen(true)}>Open</button>
      <button onClick={() => setSidebarOpen(false)}>Close</button>
    </div>
  );
}

function renderWithProvider(windowWidth = 1200) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: windowWidth });
  return render(
    <LayoutProvider>
      <LayoutConsumer />
    </LayoutProvider>
  );
}

// ─────────────────────────────────────────────────────────────
describe('useLayout – default values', () => {
  it('sidebar is closed by default', () => {
    renderWithProvider(1200);
    expect(screen.getByTestId('sidebar').textContent).toBe('closed');
  });

  it('isMobile is false at desktop width', () => {
    renderWithProvider(1200);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
  });

  it('isTablet is false at desktop width', () => {
    renderWithProvider(1200);
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
  });

  it('width reflects initial window.innerWidth', () => {
    renderWithProvider(1440);
    expect(screen.getByTestId('width').textContent).toBe('1440');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – responsive flags', () => {
  it('isMobile is true when width < 640', () => {
    renderWithProvider(375);
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
  });

  it('isTablet is true when width < 1024', () => {
    renderWithProvider(768);
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });

  it('isMobile is false at exactly 640', () => {
    renderWithProvider(640);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
  });

  it('isTablet is false at exactly 1024', () => {
    renderWithProvider(1024);
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
  });

  it('both isMobile and isTablet true at mobile width', () => {
    renderWithProvider(375);
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – sidebar state', () => {
  it('opens sidebar when setSidebarOpen(true) called', async () => {
    renderWithProvider(1200);
    await userEvent.click(screen.getByText('Open'));
    expect(screen.getByTestId('sidebar').textContent).toBe('open');
  });

  it('closes sidebar when setSidebarOpen(false) called', async () => {
    renderWithProvider(1200);
    await userEvent.click(screen.getByText('Open'));
    await userEvent.click(screen.getByText('Close'));
    expect(screen.getByTestId('sidebar').textContent).toBe('closed');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – resize event', () => {
  it('updates width when window resize event fires', () => {
    renderWithProvider(1200);
    expect(screen.getByTestId('width').textContent).toBe('1200');

    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 768 });
      window.dispatchEvent(new Event('resize'));
    });

    expect(screen.getByTestId('width').textContent).toBe('768');
  });

  it('closes sidebar automatically when resized to desktop width', async () => {
    renderWithProvider(375); // start at mobile
    await userEvent.click(screen.getByText('Open')); // open sidebar
    expect(screen.getByTestId('sidebar').textContent).toBe('open');

    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
      window.dispatchEvent(new Event('resize'));
    });

    // After resize to desktop, sidebar should close
    expect(screen.getByTestId('sidebar').textContent).toBe('closed');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – context default (outside provider)', () => {
  it('returns default values when used outside LayoutProvider', () => {
    // Render consumer directly without LayoutProvider
    render(<LayoutConsumer />);
    expect(screen.getByTestId('sidebar').textContent).toBe('closed');
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
    expect(screen.getByTestId('width').textContent).toBe('1200');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – boundary widths', () => {
  it('isMobile is true at width 639', () => {
    renderWithProvider(639);
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
  });

  it('isMobile is false at width 640', () => {
    renderWithProvider(640);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
  });

  it('isTablet is true at width 1023', () => {
    renderWithProvider(1023);
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });

  it('isTablet is false at width 1024', () => {
    renderWithProvider(1024);
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
  });

  it('sidebar does NOT auto-close when resized to tablet width (768)', async () => {
    renderWithProvider(375); // start at mobile
    await userEvent.click(screen.getByText('Open'));
    expect(screen.getByTestId('sidebar').textContent).toBe('open');

    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 768 });
      window.dispatchEvent(new Event('resize'));
    });

    // 768 < 1024, so sidebar should stay open
    expect(screen.getByTestId('sidebar').textContent).toBe('open');
  });

  it('sidebar auto-closes at exactly 1024', async () => {
    renderWithProvider(375);
    await userEvent.click(screen.getByText('Open'));

    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
      window.dispatchEvent(new Event('resize'));
    });

    expect(screen.getByTestId('sidebar').textContent).toBe('closed');
  });

  it('multiple resize events correctly update width', () => {
    renderWithProvider(1200);

    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 800 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('width').textContent).toBe('800');

    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1400 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('width').textContent).toBe('1400');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – very small widths', () => {
  it('isMobile is true at width 320', () => {
    renderWithProvider(320);
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
  });

  it('isMobile is true at width 480', () => {
    renderWithProvider(480);
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
  });

  it('isTablet is true at width 320', () => {
    renderWithProvider(320);
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });

  it('width is correctly reported at 320', () => {
    renderWithProvider(320);
    expect(screen.getByTestId('width').textContent).toBe('320');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – large display widths', () => {
  it('isMobile is false at 1440', () => {
    renderWithProvider(1440);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
  });

  it('isTablet is false at 1440', () => {
    renderWithProvider(1440);
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
  });

  it('width is correctly reported at 1920', () => {
    renderWithProvider(1920);
    expect(screen.getByTestId('width').textContent).toBe('1920');
  });

  it('width is correctly reported at 2560', () => {
    renderWithProvider(2560);
    expect(screen.getByTestId('width').textContent).toBe('2560');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – sidebar toggle sequence', () => {
  it('toggling open then closed gives closed state', async () => {
    renderWithProvider(1200);
    await userEvent.click(screen.getByText('Open'));
    await userEvent.click(screen.getByText('Close'));
    expect(screen.getByTestId('sidebar').textContent).toBe('closed');
  });

  it('toggling closed then open gives open state', async () => {
    renderWithProvider(1200);
    await userEvent.click(screen.getByText('Close'));
    await userEvent.click(screen.getByText('Open'));
    expect(screen.getByTestId('sidebar').textContent).toBe('open');
  });

  it('width does not change when sidebar is toggled', async () => {
    renderWithProvider(1200);
    await userEvent.click(screen.getByText('Open'));
    expect(screen.getByTestId('width').textContent).toBe('1200');
    await userEvent.click(screen.getByText('Close'));
    expect(screen.getByTestId('width').textContent).toBe('1200');
  });

  it('isMobile does not change when sidebar is toggled', async () => {
    renderWithProvider(1200);
    await userEvent.click(screen.getByText('Open'));
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – resize from mobile to tablet', () => {
  it('transitions from mobile to tablet on resize to 768', () => {
    renderWithProvider(375);
    expect(screen.getByTestId('isMobile').textContent).toBe('true');

    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 768 });
      window.dispatchEvent(new Event('resize'));
    });

    expect(screen.getByTestId('isMobile').textContent).toBe('false');
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });

  it('transitions from tablet to desktop on resize to 1200', () => {
    renderWithProvider(768);
    expect(screen.getByTestId('isTablet').textContent).toBe('true');

    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1200 });
      window.dispatchEvent(new Event('resize'));
    });

    expect(screen.getByTestId('isMobile').textContent).toBe('false');
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – resize from desktop to mobile', () => {
  it('transitions from desktop to mobile on resize to 375', () => {
    renderWithProvider(1200);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');

    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
      window.dispatchEvent(new Event('resize'));
    });

    expect(screen.getByTestId('isMobile').textContent).toBe('true');
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });

  it('transitions from desktop to tablet on resize to 900', () => {
    renderWithProvider(1200);

    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 900 });
      window.dispatchEvent(new Event('resize'));
    });

    expect(screen.getByTestId('isMobile').textContent).toBe('false');
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – width at exact breakpoints', () => {
  it('reports width as 1 for minimum viable width', () => {
    renderWithProvider(1);
    expect(screen.getByTestId('width').textContent).toBe('1');
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
  });

  it('reports correct width at 1366 (common laptop width)', () => {
    renderWithProvider(1366);
    expect(screen.getByTestId('width').textContent).toBe('1366');
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
  });

  it('isMobile false and isTablet true at 800', () => {
    renderWithProvider(800);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – sidebar state preserved through width updates', () => {
  it('sidebar stays open when width stays below 1024', async () => {
    renderWithProvider(768);
    await userEvent.click(screen.getByText('Open'));
    expect(screen.getByTestId('sidebar').textContent).toBe('open');

    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 900 });
      window.dispatchEvent(new Event('resize'));
    });

    // Still below 1024, sidebar should remain open
    expect(screen.getByTestId('sidebar').textContent).toBe('open');
  });

  it('sidebar stays closed when opened then closed before resize', async () => {
    renderWithProvider(1200);
    await userEvent.click(screen.getByText('Open'));
    await userEvent.click(screen.getByText('Close'));

    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1400 });
      window.dispatchEvent(new Event('resize'));
    });

    expect(screen.getByTestId('sidebar').textContent).toBe('closed');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – extreme widths', () => {
  it('handles very small mobile width 320', () => {
    renderWithProvider(320);
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
    expect(screen.getByTestId('width').textContent).toBe('320');
  });

  it('handles large desktop width 2560', () => {
    renderWithProvider(2560);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
    expect(screen.getByTestId('width').textContent).toBe('2560');
  });

  it('handles 1px width as mobile', () => {
    renderWithProvider(1);
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
  });

  it('handles tablet boundary 769', () => {
    renderWithProvider(769);
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – resize to mobile transitions', () => {
  it('isTablet becomes true after resize from desktop to tablet', () => {
    renderWithProvider(1200);
    expect(screen.getByTestId('isTablet').textContent).toBe('false');

    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 768 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });

  it('isMobile becomes true after resize from desktop to mobile', () => {
    renderWithProvider(1200);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');

    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
  });

  it('isMobile becomes false after resize from mobile to desktop', () => {
    renderWithProvider(375);
    expect(screen.getByTestId('isMobile').textContent).toBe('true');

    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1440 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
  });

  it('isTablet becomes false after resize from tablet to desktop', () => {
    renderWithProvider(768);
    expect(screen.getByTestId('isTablet').textContent).toBe('true');

    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1440 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – multiple resizes', () => {
  it('correctly updates width through multiple resize events', () => {
    renderWithProvider(1200);

    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 768 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('width').textContent).toBe('768');

    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1440 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('width').textContent).toBe('1440');

    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('width').textContent).toBe('375');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – sidebar toggle multiple times', () => {
  it('can open and close sidebar multiple times', async () => {
    renderWithProvider(1200);
    await userEvent.click(screen.getByText('Open'));
    expect(screen.getByTestId('sidebar').textContent).toBe('open');
    await userEvent.click(screen.getByText('Close'));
    expect(screen.getByTestId('sidebar').textContent).toBe('closed');
    await userEvent.click(screen.getByText('Open'));
    expect(screen.getByTestId('sidebar').textContent).toBe('open');
  });

  it('calling setSidebarOpen(true) twice keeps sidebar open', async () => {
    renderWithProvider(1200);
    await userEvent.click(screen.getByText('Open'));
    await userEvent.click(screen.getByText('Open'));
    expect(screen.getByTestId('sidebar').textContent).toBe('open');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – common device widths', () => {
  it('iPhone SE (375) reports isMobile true', () => {
    renderWithProvider(375);
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
    expect(screen.getByTestId('width').textContent).toBe('375');
  });

  it('iPhone 14 (390) reports isMobile true', () => {
    renderWithProvider(390);
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
    expect(screen.getByTestId('width').textContent).toBe('390');
  });

  it('iPad Mini (768) is tablet not mobile', () => {
    renderWithProvider(768);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
    expect(screen.getByTestId('width').textContent).toBe('768');
  });

  it('iPad Pro (1024) is neither mobile nor tablet', () => {
    renderWithProvider(1024);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
    expect(screen.getByTestId('width').textContent).toBe('1024');
  });

  it('MacBook Air (1280) is desktop', () => {
    renderWithProvider(1280);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
    expect(screen.getByTestId('width').textContent).toBe('1280');
  });

  it('Full HD (1920) is desktop', () => {
    renderWithProvider(1920);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
    expect(screen.getByTestId('width').textContent).toBe('1920');
  });

  it('4K display (3840) is desktop', () => {
    renderWithProvider(3840);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
    expect(screen.getByTestId('width').textContent).toBe('3840');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – width at 641 (just above mobile threshold)', () => {
  it('isMobile is false at 641', () => {
    renderWithProvider(641);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
  });

  it('isTablet is true at 641', () => {
    renderWithProvider(641);
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });

  it('width is 641', () => {
    renderWithProvider(641);
    expect(screen.getByTestId('width').textContent).toBe('641');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – width at 1025 (just above tablet threshold)', () => {
  it('isMobile is false at 1025', () => {
    renderWithProvider(1025);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
  });

  it('isTablet is false at 1025', () => {
    renderWithProvider(1025);
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
  });

  it('width is 1025', () => {
    renderWithProvider(1025);
    expect(screen.getByTestId('width').textContent).toBe('1025');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – sidebar with resize sequences', () => {
  it('sidebar closes after opening and resizing to 1200', async () => {
    renderWithProvider(500);
    await userEvent.click(screen.getByText('Open'));
    expect(screen.getByTestId('sidebar').textContent).toBe('open');

    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1200 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('sidebar').textContent).toBe('closed');
  });

  it('sidebar stays open when resizing from 500 to 900 (both below 1024)', async () => {
    renderWithProvider(500);
    await userEvent.click(screen.getByText('Open'));

    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 900 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('sidebar').textContent).toBe('open');
  });

  it('isTablet changes from true to false when resizing from 900 to 1200', () => {
    renderWithProvider(900);
    expect(screen.getByTestId('isTablet').textContent).toBe('true');

    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1200 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
  });

  it('width 480 reports isMobile=true', () => {
    renderWithProvider(480);
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
    expect(screen.getByTestId('width').textContent).toBe('480');
  });

  it('width 1440 reports both false', () => {
    renderWithProvider(1440);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
    expect(screen.getByTestId('width').textContent).toBe('1440');
  });

  it('three consecutive resizes update width correctly', () => {
    renderWithProvider(1200);

    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('width').textContent).toBe('375');

    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 768 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('width').textContent).toBe('768');

    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1440 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('width').textContent).toBe('1440');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – isMobile and isTablet independence', () => {
  it('isMobile false and isTablet true are independent states at 700', () => {
    renderWithProvider(700);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });

  it('both false at 1100', () => {
    renderWithProvider(1100);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
  });

  it('both true at 400', () => {
    renderWithProvider(400);
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – sidebar interactions at boundary', () => {
  it('sidebar closes when resized from below 1024 to exactly 1024', async () => {
    renderWithProvider(500);
    await userEvent.click(screen.getByText('Open'));
    expect(screen.getByTestId('sidebar').textContent).toBe('open');

    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('sidebar').textContent).toBe('closed');
  });

  it('sidebar stays open at 1023 even when opened from mobile', async () => {
    renderWithProvider(500);
    await userEvent.click(screen.getByText('Open'));

    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1023 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('sidebar').textContent).toBe('open');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – exactly-below boundary widths', () => {
  it('isMobile is true at 639 (one below mobile threshold)', () => {
    renderWithProvider(639);
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
    expect(screen.getByTestId('width').textContent).toBe('639');
  });

  it('isTablet is true at 1023 (one below tablet threshold)', () => {
    renderWithProvider(1023);
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – sidebar independence from responsive flags', () => {
  it('sidebar can be open while isMobile is true', async () => {
    renderWithProvider(375);
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
    await userEvent.click(screen.getByText('Open'));
    expect(screen.getByTestId('sidebar').textContent).toBe('open');
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
  });

  it('sidebar can be open while isTablet is true', async () => {
    renderWithProvider(768);
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
    await userEvent.click(screen.getByText('Open'));
    expect(screen.getByTestId('sidebar').textContent).toBe('open');
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });

  it('sidebar is closed while isMobile is false', () => {
    renderWithProvider(1200);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
    expect(screen.getByTestId('sidebar').textContent).toBe('closed');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – resize does not affect sidebar when below 1024', () => {
  it('resize from 500 to 600 keeps sidebar open', async () => {
    renderWithProvider(500);
    await userEvent.click(screen.getByText('Open'));
    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 600 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('sidebar').textContent).toBe('open');
  });

  it('resize from 600 to 400 keeps sidebar open', async () => {
    renderWithProvider(600);
    await userEvent.click(screen.getByText('Open'));
    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 400 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('sidebar').textContent).toBe('open');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – resize to exactly 1024 and 1025', () => {
  it('resizing to 1024 triggers sidebar close', async () => {
    renderWithProvider(500);
    await userEvent.click(screen.getByText('Open'));
    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
    expect(screen.getByTestId('sidebar').textContent).toBe('closed');
  });

  it('resizing to 1025 triggers sidebar close', async () => {
    renderWithProvider(500);
    await userEvent.click(screen.getByText('Open'));
    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1025 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
    expect(screen.getByTestId('sidebar').textContent).toBe('closed');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – width reflects current window at render time', () => {
  it('captures width 500 at render time', () => {
    renderWithProvider(500);
    expect(screen.getByTestId('width').textContent).toBe('500');
  });

  it('captures width 1366 at render time', () => {
    renderWithProvider(1366);
    expect(screen.getByTestId('width').textContent).toBe('1366');
  });

  it('captures width 412 (Android common) at render time', () => {
    renderWithProvider(412);
    expect(screen.getByTestId('width').textContent).toBe('412');
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – specific widths', () => {
  it('isMobile true at iPhone SE width 375', () => {
    renderWithProvider(375);
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });

  it('isMobile false at standard desktop 1920', () => {
    renderWithProvider(1920);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
  });

  it('isTablet true at iPad portrait 768', () => {
    renderWithProvider(768);
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
  });

  it('width 768 is correctly reported', () => {
    renderWithProvider(768);
    expect(screen.getByTestId('width').textContent).toBe('768');
  });

  it('isMobile false at 641', () => {
    renderWithProvider(641);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
  });

  it('isTablet true at 800 (tablet width)', () => {
    renderWithProvider(800);
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });

  it('isTablet false at 1280', () => {
    renderWithProvider(1280);
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
  });

  it('isMobile and isTablet both false at 1440', () => {
    renderWithProvider(1440);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – sidebar toggle sequence', () => {
  it('can open then close sidebar', async () => {
    renderWithProvider(1200);
    expect(screen.getByTestId('sidebar').textContent).toBe('closed');
    await userEvent.click(screen.getByText('Open'));
    expect(screen.getByTestId('sidebar').textContent).toBe('open');
    await userEvent.click(screen.getByText('Close'));
    expect(screen.getByTestId('sidebar').textContent).toBe('closed');
  });

  it('calling open twice keeps sidebar open', async () => {
    renderWithProvider(1200);
    await userEvent.click(screen.getByText('Open'));
    await userEvent.click(screen.getByText('Open'));
    expect(screen.getByTestId('sidebar').textContent).toBe('open');
  });

  it('calling close when already closed keeps it closed', async () => {
    renderWithProvider(1200);
    await userEvent.click(screen.getByText('Close'));
    expect(screen.getByTestId('sidebar').textContent).toBe('closed');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – resize updates both width and flags', () => {
  it('updates isMobile to true on resize to mobile', () => {
    renderWithProvider(1200);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 400 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
  });

  it('updates isTablet to true on resize to tablet', () => {
    renderWithProvider(1200);
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 900 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });

  it('updates width on resize', () => {
    renderWithProvider(1200);
    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 600 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('width').textContent).toBe('600');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – sidebar auto-closes at various widths', () => {
  it('auto-closes sidebar when resizing from 400 to 1280', async () => {
    renderWithProvider(400);
    await userEvent.click(screen.getByText('Open'));
    expect(screen.getByTestId('sidebar').textContent).toBe('open');
    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('sidebar').textContent).toBe('closed');
  });

  it('does not auto-close sidebar at tablet width 900', async () => {
    renderWithProvider(400);
    await userEvent.click(screen.getByText('Open'));
    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 900 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('sidebar').textContent).toBe('open');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – multiple resize events', () => {
  it('handles multiple rapid resize events correctly', () => {
    renderWithProvider(1200);
    act(() => {
      [800, 600, 400, 1200].forEach(w => {
        Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: w });
        window.dispatchEvent(new Event('resize'));
      });
    });
    expect(screen.getByTestId('width').textContent).toBe('1200');
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – boundary widths', () => {
  it('isMobile is false at exactly 640', () => {
    renderWithProvider(640);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
  });

  it('isMobile is true at exactly 639', () => {
    renderWithProvider(639);
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
  });

  it('isTablet is false at exactly 1024', () => {
    renderWithProvider(1024);
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
  });

  it('isTablet is true at exactly 1023', () => {
    renderWithProvider(1023);
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });

  it('width is 320 for very small screen', () => {
    renderWithProvider(320);
    expect(screen.getByTestId('width').textContent).toBe('320');
  });

  it('width is 2560 for 4K screen', () => {
    renderWithProvider(2560);
    expect(screen.getByTestId('width').textContent).toBe('2560');
  });

  it('isMobile is true at 480 (small phone)', () => {
    renderWithProvider(480);
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
  });

  it('isTablet is true at 768 (iPad)', () => {
    renderWithProvider(768);
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });

  it('isMobile is false and isTablet is false at 1200', () => {
    renderWithProvider(1200);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – sidebar state persistence across renders', () => {
  it('sidebar remains open after re-render at same width', async () => {
    const { rerender } = renderWithProvider(1200);
    await userEvent.click(screen.getByText('Open'));
    expect(screen.getByTestId('sidebar').textContent).toBe('open');
    rerender(
      <LayoutProvider>
        <LayoutConsumer />
      </LayoutProvider>
    );
    expect(screen.getByTestId('sidebar').textContent).toBe('open');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – resize from tablet to mobile', () => {
  it('transitions isMobile from false to true at resize', () => {
    renderWithProvider(768);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 400 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
  });

  it('transitions isTablet from true to false at resize to desktop', () => {
    renderWithProvider(768);
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – sidebar with multiple open/close calls', () => {
  it('stays open after multiple open calls', async () => {
    renderWithProvider(1200);
    await userEvent.click(screen.getByText('Open'));
    await userEvent.click(screen.getByText('Open'));
    await userEvent.click(screen.getByText('Open'));
    expect(screen.getByTestId('sidebar').textContent).toBe('open');
  });

  it('stays closed after multiple close calls', async () => {
    renderWithProvider(1200);
    await userEvent.click(screen.getByText('Close'));
    await userEvent.click(screen.getByText('Close'));
    expect(screen.getByTestId('sidebar').textContent).toBe('closed');
  });

  it('alternates open/close correctly', async () => {
    renderWithProvider(1200);
    await userEvent.click(screen.getByText('Open'));
    expect(screen.getByTestId('sidebar').textContent).toBe('open');
    await userEvent.click(screen.getByText('Close'));
    expect(screen.getByTestId('sidebar').textContent).toBe('closed');
    await userEvent.click(screen.getByText('Open'));
    expect(screen.getByTestId('sidebar').textContent).toBe('open');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – width tracking across resize sequence', () => {
  it('tracks correct width after resize down to 600', () => {
    renderWithProvider(1200);
    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 600 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('width').textContent).toBe('600');
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
  });

  it('tracks correct width after resize up from mobile to tablet', () => {
    renderWithProvider(320);
    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 768 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('width').textContent).toBe('768');
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – exact breakpoint transitions isMobile', () => {
  it('isMobile is true at 599', () => {
    renderWithProvider(599);
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
  });

  it('isMobile is false at 641', () => {
    renderWithProvider(641);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
  });

  it('isTablet is true at 900', () => {
    renderWithProvider(900);
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });

  it('isTablet is false at 1025', () => {
    renderWithProvider(1025);
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – width values at specific breakpoints', () => {
  it('width is correctly reported at 375 (iPhone)', () => {
    renderWithProvider(375);
    expect(screen.getByTestId('width').textContent).toBe('375');
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
  });

  it('width is correctly reported at 414 (iPhone Plus)', () => {
    renderWithProvider(414);
    expect(screen.getByTestId('width').textContent).toBe('414');
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
  });

  it('width is correctly reported at 768 (iPad portrait)', () => {
    renderWithProvider(768);
    expect(screen.getByTestId('width').textContent).toBe('768');
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });

  it('width is correctly reported at 1024 (iPad landscape)', () => {
    renderWithProvider(1024);
    expect(screen.getByTestId('width').textContent).toBe('1024');
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
  });

  it('width is correctly reported at 1280 (desktop)', () => {
    renderWithProvider(1280);
    expect(screen.getByTestId('width').textContent).toBe('1280');
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
  });

  it('width is correctly reported at 1920 (full HD)', () => {
    renderWithProvider(1920);
    expect(screen.getByTestId('width').textContent).toBe('1920');
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
  });

  it('isMobile is true at 360 (Android small)', () => {
    renderWithProvider(360);
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – sidebar toggle multiple times', () => {
  it('sidebar can be opened and closed twice in succession', async () => {
    renderWithProvider(1280);
    await userEvent.click(screen.getByText('Open'));
    expect(screen.getByTestId('sidebar').textContent).toBe('open');
    await userEvent.click(screen.getByText('Close'));
    expect(screen.getByTestId('sidebar').textContent).toBe('closed');
    await userEvent.click(screen.getByText('Open'));
    expect(screen.getByTestId('sidebar').textContent).toBe('open');
  });

  it('closing an already closed sidebar keeps it closed', async () => {
    renderWithProvider(1280);
    expect(screen.getByTestId('sidebar').textContent).toBe('closed');
    await userEvent.click(screen.getByText('Close'));
    expect(screen.getByTestId('sidebar').textContent).toBe('closed');
  });

  it('opening an already open sidebar keeps it open', async () => {
    renderWithProvider(1280);
    await userEvent.click(screen.getByText('Open'));
    expect(screen.getByTestId('sidebar').textContent).toBe('open');
    await userEvent.click(screen.getByText('Open'));
    expect(screen.getByTestId('sidebar').textContent).toBe('open');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – isTablet and isMobile co-occurrence', () => {
  it('at 320 both isMobile and isTablet are true', () => {
    renderWithProvider(320);
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });

  it('at 480 both isMobile and isTablet are true', () => {
    renderWithProvider(480);
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });

  it('at 640 isMobile is false and isTablet is true', () => {
    renderWithProvider(640);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });

  it('at 1024 both isMobile and isTablet are false', () => {
    renderWithProvider(1024);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
  });

  it('at 1440 both isMobile and isTablet are false', () => {
    renderWithProvider(1440);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – resize from mobile to desktop', () => {
  it('isMobile transitions from true to false when resized to 1200', () => {
    renderWithProvider(375);
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1200 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
  });

  it('isTablet transitions from true to false when resized to 1200', () => {
    renderWithProvider(768);
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1200 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
  });

  it('width reflects new value after resize to 1500', () => {
    renderWithProvider(375);
    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1500 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('width').textContent).toBe('1500');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – boundary width values', () => {
  it('isMobile is true at width 639', () => {
    renderWithProvider(639);
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
  });

  it('isTablet is true at width 1023', () => {
    renderWithProvider(1023);
    // 1023 < 1024, so isTablet should be true
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });

  it('width is exact value 800 when rendered at 800', () => {
    renderWithProvider(800);
    expect(screen.getByTestId('width').textContent).toBe('800');
  });

  it('width is exact value 1024 when rendered at 1024', () => {
    renderWithProvider(1024);
    expect(screen.getByTestId('width').textContent).toBe('1024');
  });

  it('isMobile is false at width 641', () => {
    renderWithProvider(641);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – sidebar state persistence within session', () => {
  it('sidebar remains open after multiple re-renders at same width', () => {
    const { rerender } = renderWithProvider(1200);
    act(() => {
      screen.getByRole('button', { name: 'Open' }).click();
    });
    expect(screen.getByTestId('sidebar').textContent).toBe('open');
    rerender(
      <LayoutProvider>
        <LayoutConsumer />
      </LayoutProvider>
    );
    expect(screen.getByTestId('sidebar').textContent).toBe('open');
  });

  it('closing sidebar after opening leaves it closed', async () => {
    renderWithProvider(1200);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByTestId('sidebar').textContent).toBe('closed');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – various desktop widths', () => {
  it('isTablet is false at 1280', () => {
    renderWithProvider(1280);
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
  });

  it('isTablet is false at 1920', () => {
    renderWithProvider(1920);
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
  });

  it('isMobile is false at 1920', () => {
    renderWithProvider(1920);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
  });

  it('width reflects 320 at mobile width', () => {
    renderWithProvider(320);
    expect(screen.getByTestId('width').textContent).toBe('320');
  });
});

// ────────────────────────────────────────────────────────────
describe('useLayout – exact boundary values', () => {
  it('isMobile is true at width 400', () => {
    renderWithProvider(400);
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
  });

  it('isMobile is false at width 700', () => {
    renderWithProvider(700);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
  });

  it('isTablet is true at width 900', () => {
    renderWithProvider(900);
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });

  it('isTablet is false at width 1100', () => {
    renderWithProvider(1100);
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
  });

  it('width reflects 500 at given width', () => {
    renderWithProvider(500);
    expect(screen.getByTestId('width').textContent).toBe('500');
  });
});

// ────────────────────────────────────────────────────────────
describe('useLayout – sidebar initial state', () => {
  it('sidebar starts closed by default (not auto-opened)', () => {
    renderWithProvider(1200);
    // Default sidebarOpen is false — sidebar must be opened explicitly
    expect(screen.getByTestId('sidebar').textContent).toBe('closed');
  });

  it('sidebar can be opened via setSidebarOpen', async () => {
    renderWithProvider(1200);
    await userEvent.click(screen.getByText('Open'));
    expect(screen.getByTestId('sidebar').textContent).toBe('open');
  });
});

// ────────────────────────────────────────────────────────────
describe('useLayout – isMobile at exact thresholds', () => {
  it('isMobile is false at exactly 640', () => {
    renderWithProvider(640);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
  });
});

// ────────────────────────────────────────────────────────────
describe('useLayout – close sidebar', () => {
  it('sidebar is closed after Open then Close', async () => {
    renderWithProvider(1200);
    await userEvent.click(screen.getByText('Open'));
    await userEvent.click(screen.getByText('Close'));
    expect(screen.getByTestId('sidebar').textContent).toBe('closed');
  });
});

// ────────────────────────────────────────────────────────────
describe('useLayout – width 768 thresholds', () => {
  it('width reflects 768', () => {
    renderWithProvider(768);
    expect(screen.getByTestId('width').textContent).toBe('768');
  });

  it('isMobile is false at 768', () => {
    renderWithProvider(768);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
  });
});

// ────────────────────────────────────────────────────────────
describe('useLayout – width 320 (very narrow)', () => {
  it('width reflects 320', () => {
    renderWithProvider(320);
    expect(screen.getByTestId('width').textContent).toBe('320');
  });

  it('isMobile is true at width 320', () => {
    renderWithProvider(320);
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
  });

  it('isTablet is true at width 320', () => {
    renderWithProvider(320);
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });
});

// ────────────────────────────────────────────────────────────
describe('useLayout – width 1440 (large desktop)', () => {
  it('width reflects 1440', () => {
    renderWithProvider(1440);
    expect(screen.getByTestId('width').textContent).toBe('1440');
  });

  it('isMobile is false at 1440', () => {
    renderWithProvider(1440);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
  });

  it('isTablet is false at 1440', () => {
    renderWithProvider(1440);
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
  });

  it('sidebar defaults to closed at 1440', () => {
    renderWithProvider(1440);
    expect(screen.getByTestId('sidebar').textContent).toBe('closed');
  });
});

// ────────────────────────────────────────────────────────────
describe('useLayout – width 600 (mobile boundary)', () => {
  it('isMobile is true at 600', () => {
    renderWithProvider(600);
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
  });

  it('width reflects 600', () => {
    renderWithProvider(600);
    expect(screen.getByTestId('width').textContent).toBe('600');
  });
});

// ────────────────────────────────────────────────────────────
describe('useLayout – width 900 (tablet boundary)', () => {
  it('isTablet is true at 900', () => {
    renderWithProvider(900);
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });

  it('isMobile is false at 900', () => {
    renderWithProvider(900);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
  });

  it('width reflects 900', () => {
    renderWithProvider(900);
    expect(screen.getByTestId('width').textContent).toBe('900');
  });
});

// ────────────────────────────────────────────────────────────
describe('useLayout – sidebar toggle multiple times', () => {
  it('sidebar can be opened multiple times', async () => {
    renderWithProvider(1200);
    await userEvent.click(screen.getByText('Open'));
    expect(screen.getByTestId('sidebar').textContent).toBe('open');
    await userEvent.click(screen.getByText('Close'));
    expect(screen.getByTestId('sidebar').textContent).toBe('closed');
    await userEvent.click(screen.getByText('Open'));
    expect(screen.getByTestId('sidebar').textContent).toBe('open');
  });

  it('sidebar remains closed after double close', async () => {
    renderWithProvider(1200);
    await userEvent.click(screen.getByText('Close'));
    await userEvent.click(screen.getByText('Close'));
    expect(screen.getByTestId('sidebar').textContent).toBe('closed');
  });
});

// ────────────────────────────────────────────────────────────
describe('useLayout – width 639 (just below mobile threshold)', () => {
  it('isMobile is true at 639', () => {
    renderWithProvider(639);
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
  });

  it('isTablet is true at 639', () => {
    renderWithProvider(639);
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });

  it('width reflects 639', () => {
    renderWithProvider(639);
    expect(screen.getByTestId('width').textContent).toBe('639');
  });
});

// ────────────────────────────────────────────────────────────
describe('useLayout – width 640 (mobile/tablet boundary)', () => {
  it('isMobile is false at 640 (threshold is <640)', () => {
    renderWithProvider(640);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
  });

  it('isTablet is true at 640 (640 < 1024)', () => {
    renderWithProvider(640);
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });

  it('width reflects 640', () => {
    renderWithProvider(640);
    expect(screen.getByTestId('width').textContent).toBe('640');
  });
});

// ────────────────────────────────────────────────────────────
describe('useLayout – width 1023 (just below desktop threshold)', () => {
  it('isTablet is true at 1023', () => {
    renderWithProvider(1023);
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });

  it('isMobile is false at 1023', () => {
    renderWithProvider(1023);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
  });

  it('width reflects 1023', () => {
    renderWithProvider(1023);
    expect(screen.getByTestId('width').textContent).toBe('1023');
  });
});

// ────────────────────────────────────────────────────────────
describe('useLayout – width 1024 (desktop threshold)', () => {
  it('isTablet is false at 1024 (threshold is <1024)', () => {
    renderWithProvider(1024);
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
  });

  it('isMobile is false at 1024', () => {
    renderWithProvider(1024);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
  });

  it('sidebar defaults to closed at 1024', () => {
    renderWithProvider(1024);
    expect(screen.getByTestId('sidebar').textContent).toBe('closed');
  });
});

// ────────────────────────────────────────────────────────────
describe('useLayout – width 480 (small mobile)', () => {
  it('isMobile is true at 480', () => {
    renderWithProvider(480);
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
  });

  it('isTablet is true at 480', () => {
    renderWithProvider(480);
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });

  it('width reflects 480', () => {
    renderWithProvider(480);
    expect(screen.getByTestId('width').textContent).toBe('480');
  });
});

// ────────────────────────────────────────────────────────────
describe('useLayout – width 767 (below tablet, above mobile)', () => {
  it('isMobile is false at 767 (>= 640)', () => {
    renderWithProvider(767);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
  });

  it('isTablet is true at 767 (< 1024)', () => {
    renderWithProvider(767);
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });

  it('width reflects 767', () => {
    renderWithProvider(767);
    expect(screen.getByTestId('width').textContent).toBe('767');
  });
});

// ────────────────────────────────────────────────────────────
describe('useLayout – width 428 (iPhone 14 Plus)', () => {
  it('isMobile is true at 428 (< 640)', () => {
    renderWithProvider(428);
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
  });

  it('isTablet is true at 428 (< 1024)', () => {
    renderWithProvider(428);
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });

  it('width reflects 428', () => {
    renderWithProvider(428);
    expect(screen.getByTestId('width').textContent).toBe('428');
  });

  it('sidebar defaults to closed at 428', () => {
    renderWithProvider(428);
    expect(screen.getByTestId('sidebar').textContent).toBe('closed');
  });
});

// ────────────────────────────────────────────────────────────
describe('useLayout – width 1536 (large HiDPI laptop)', () => {
  it('isMobile is false at 1536', () => {
    renderWithProvider(1536);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
  });

  it('isTablet is false at 1536', () => {
    renderWithProvider(1536);
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
  });

  it('width reflects 1536', () => {
    renderWithProvider(1536);
    expect(screen.getByTestId('width').textContent).toBe('1536');
  });
});

// ────────────────────────────────────────────────────────────
describe('useLayout – width 1600', () => {
  it('isMobile is false at 1600', () => {
    renderWithProvider(1600);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
  });

  it('isTablet is false at 1600', () => {
    renderWithProvider(1600);
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
  });

  it('width reflects 1600', () => {
    renderWithProvider(1600);
    expect(screen.getByTestId('width').textContent).toBe('1600');
  });
});

describe('useLayout – width 2048 (iMac 21.5")', () => {
  it('isMobile is false at 2048', () => {
    renderWithProvider(2048);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
  });

  it('isTablet is false at 2048', () => {
    renderWithProvider(2048);
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
  });

  it('width reflects 2048', () => {
    renderWithProvider(2048);
    expect(screen.getByTestId('width').textContent).toBe('2048');
  });

  it('sidebar defaults to closed at 2048', () => {
    renderWithProvider(2048);
    expect(screen.getByTestId('sidebar').textContent).toBe('closed');
  });
});

describe('useLayout – width 4096 (DCI 4K)', () => {
  it('isMobile is false at 4096', () => {
    renderWithProvider(4096);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
  });

  it('isTablet is false at 4096', () => {
    renderWithProvider(4096);
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
  });

  it('width reflects 4096', () => {
    renderWithProvider(4096);
    expect(screen.getByTestId('width').textContent).toBe('4096');
  });
});

describe('useLayout – sidebar behavior at mobile width', () => {
  it('sidebar can be opened at mobile width', async () => {
    renderWithProvider(375);
    expect(screen.getByTestId('sidebar').textContent).toBe('closed');
    await userEvent.click(screen.getByText('Open'));
    expect(screen.getByTestId('sidebar').textContent).toBe('open');
  });

  it('sidebar can be closed at mobile width', async () => {
    renderWithProvider(375);
    await userEvent.click(screen.getByText('Open'));
    await userEvent.click(screen.getByText('Close'));
    expect(screen.getByTestId('sidebar').textContent).toBe('closed');
  });

  it('calling setSidebarOpen(false) when already closed keeps closed', async () => {
    renderWithProvider(1200);
    expect(screen.getByTestId('sidebar').textContent).toBe('closed');
    await userEvent.click(screen.getByText('Close'));
    expect(screen.getByTestId('sidebar').textContent).toBe('closed');
  });
});

describe('useLayout – width 320 (iPhone SE 1st gen)', () => {
  it('isMobile is true at 320', () => {
    renderWithProvider(320);
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
  });

  it('isTablet is true at 320', () => {
    renderWithProvider(320);
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });

  it('width reflects 320', () => {
    renderWithProvider(320);
    expect(screen.getByTestId('width').textContent).toBe('320');
  });

  it('sidebar defaults to closed at 320', () => {
    renderWithProvider(320);
    expect(screen.getByTestId('sidebar').textContent).toBe('closed');
  });
});

describe('useLayout – width 1024 (tablet landscape)', () => {
  it('isMobile is false at 1024 (>= 640)', () => {
    renderWithProvider(1024);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
  });

  it('isTablet is false at 1024 (not < 1024)', () => {
    renderWithProvider(1024);
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
  });

  it('width reflects 1024', () => {
    renderWithProvider(1024);
    expect(screen.getByTestId('width').textContent).toBe('1024');
  });
});

describe('useLayout – width 639 (just below mobile threshold)', () => {
  it('isMobile is true at 639 (< 640)', () => {
    renderWithProvider(639);
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
  });

  it('isTablet is true at 639', () => {
    renderWithProvider(639);
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });
});

describe('useLayout – width 640 (exactly mobile threshold)', () => {
  it('isMobile is false at exactly 640', () => {
    renderWithProvider(640);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
  });

  it('isTablet is true at 640 (< 1024)', () => {
    renderWithProvider(640);
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });

  it('width reflects 640', () => {
    renderWithProvider(640);
    expect(screen.getByTestId('width').textContent).toBe('640');
  });
});

describe('useLayout – sidebar toggle at medium width', () => {
  it('sidebar can be toggled open at 1024', async () => {
    renderWithProvider(1024);
    await userEvent.click(screen.getByText('Open'));
    expect(screen.getByTestId('sidebar').textContent).toBe('open');
  });

  it('sidebar can be toggled closed after open at 1024', async () => {
    renderWithProvider(1024);
    await userEvent.click(screen.getByText('Open'));
    await userEvent.click(screen.getByText('Close'));
    expect(screen.getByTestId('sidebar').textContent).toBe('closed');
  });
});

describe('useLayout – width 1920 (FHD monitor)', () => {
  it('isMobile is false at 1920', () => {
    renderWithProvider(1920);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
  });

  it('isTablet is false at 1920', () => {
    renderWithProvider(1920);
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
  });

  it('width reflects 1920', () => {
    renderWithProvider(1920);
    expect(screen.getByTestId('width').textContent).toBe('1920');
  });

  it('sidebar defaults to closed at 1920', () => {
    renderWithProvider(1920);
    expect(screen.getByTestId('sidebar').textContent).toBe('closed');
  });
});

// ────────────────────────────────────────────────────────────
describe('useLayout – width 350 (small Android phone)', () => {
  it('isMobile is true at 350', () => {
    renderWithProvider(350);
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
  });

  it('isTablet is true at 350', () => {
    renderWithProvider(350);
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });

  it('width reflects 350', () => {
    renderWithProvider(350);
    expect(screen.getByTestId('width').textContent).toBe('350');
  });

  it('sidebar defaults to closed at 350', () => {
    renderWithProvider(350);
    expect(screen.getByTestId('sidebar').textContent).toBe('closed');
  });
});

// ────────────────────────────────────────────────────────────
describe('useLayout – width 720 (common tablet portrait)', () => {
  it('isMobile is false at 720 (>= 640)', () => {
    renderWithProvider(720);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
  });

  it('isTablet is true at 720 (< 1024)', () => {
    renderWithProvider(720);
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });

  it('width reflects 720', () => {
    renderWithProvider(720);
    expect(screen.getByTestId('width').textContent).toBe('720');
  });
});

// ────────────────────────────────────────────────────────────
describe('useLayout – width 834 (iPad Air portrait)', () => {
  it('isMobile is false at 834', () => {
    renderWithProvider(834);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
  });

  it('isTablet is true at 834', () => {
    renderWithProvider(834);
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });

  it('width reflects 834', () => {
    renderWithProvider(834);
    expect(screen.getByTestId('width').textContent).toBe('834');
  });

  it('sidebar defaults to closed at 834', () => {
    renderWithProvider(834);
    expect(screen.getByTestId('sidebar').textContent).toBe('closed');
  });
});

// ────────────────────────────────────────────────────────────
describe('useLayout – width 1080 (small laptop or tablet landscape)', () => {
  it('isMobile is false at 1080', () => {
    renderWithProvider(1080);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
  });

  it('isTablet is false at 1080 (>= 1024)', () => {
    renderWithProvider(1080);
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
  });

  it('width reflects 1080', () => {
    renderWithProvider(1080);
    expect(screen.getByTestId('width').textContent).toBe('1080');
  });
});

// ────────────────────────────────────────────────────────────
describe('useLayout – width 1360 (Chromebook / HD laptop)', () => {
  it('isMobile is false at 1360', () => {
    renderWithProvider(1360);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
  });

  it('isTablet is false at 1360', () => {
    renderWithProvider(1360);
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
  });

  it('width reflects 1360', () => {
    renderWithProvider(1360);
    expect(screen.getByTestId('width').textContent).toBe('1360');
  });

  it('sidebar defaults to closed at 1360', () => {
    renderWithProvider(1360);
    expect(screen.getByTestId('sidebar').textContent).toBe('closed');
  });
});

// ────────────────────────────────────────────────────────────
describe('useLayout – width 5120 (5K iMac display)', () => {
  it('isMobile is false at 5120', () => {
    renderWithProvider(5120);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
  });

  it('isTablet is false at 5120', () => {
    renderWithProvider(5120);
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
  });

  it('width reflects 5120', () => {
    renderWithProvider(5120);
    expect(screen.getByTestId('width').textContent).toBe('5120');
  });
});

// ────────────────────────────────────────────────────────────
describe('useLayout – width 393 (Galaxy S23 Ultra)', () => {
  it('isMobile is true at 393', () => {
    renderWithProvider(393);
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
  });

  it('isTablet is true at 393', () => {
    renderWithProvider(393);
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });

  it('width reflects 393', () => {
    renderWithProvider(393);
    expect(screen.getByTestId('width').textContent).toBe('393');
  });
});

// ────────────────────────────────────────────────────────────
describe('useLayout – width 828 (iPhone landscape)', () => {
  it('isMobile is false at 828 (>= 640)', () => {
    renderWithProvider(828);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
  });

  it('isTablet is true at 828 (< 1024)', () => {
    renderWithProvider(828);
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });

  it('width reflects 828', () => {
    renderWithProvider(828);
    expect(screen.getByTestId('width').textContent).toBe('828');
  });
});

// ────────────────────────────────────────────────────────────
describe('useLayout – width 1728 (MacBook Pro 13")', () => {
  it('isMobile is false at 1728', () => {
    renderWithProvider(1728);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
  });

  it('isTablet is false at 1728', () => {
    renderWithProvider(1728);
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
  });

  it('width reflects 1728', () => {
    renderWithProvider(1728);
    expect(screen.getByTestId('width').textContent).toBe('1728');
  });
});

// ────────────────────────────────────────────────────────────
describe('useLayout – width 414 (iPhone XR)', () => {
  it('isMobile is true at width 414', () => {
    renderWithProvider(414);
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
  });

  it('isTablet is true at width 414', () => {
    renderWithProvider(414);
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });

  it('width is 414', () => {
    renderWithProvider(414);
    expect(screen.getByTestId('width').textContent).toBe('414');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – width 768 (iPad portrait)', () => {
  it('isMobile is false at width 768', () => {
    renderWithProvider(768);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
  });

  it('isTablet is true at width 768', () => {
    renderWithProvider(768);
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });

  it('width is 768', () => {
    renderWithProvider(768);
    expect(screen.getByTestId('width').textContent).toBe('768');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – width 1280 (HD laptop)', () => {
  it('isMobile is false at width 1280', () => {
    renderWithProvider(1280);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
  });

  it('isTablet is false at width 1280', () => {
    renderWithProvider(1280);
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
  });

  it('width is 1280', () => {
    renderWithProvider(1280);
    expect(screen.getByTestId('width').textContent).toBe('1280');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – width 2560 (2K QHD monitor)', () => {
  it('isMobile is false at width 2560', () => {
    renderWithProvider(2560);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
  });

  it('isTablet is false at width 2560', () => {
    renderWithProvider(2560);
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
  });

  it('width is 2560', () => {
    renderWithProvider(2560);
    expect(screen.getByTestId('width').textContent).toBe('2560');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – sidebar auto-close on resize through threshold', () => {
  it('sidebar opened at 600 auto-closes after resize to 1100', async () => {
    renderWithProvider(600);
    await userEvent.click(screen.getByText('Open'));
    expect(screen.getByTestId('sidebar').textContent).toBe('open');
    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1100 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('sidebar').textContent).toBe('closed');
  });

  it('sidebar stays open when resizing from 600 to 720 (both below 1024)', async () => {
    renderWithProvider(600);
    await userEvent.click(screen.getByText('Open'));
    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 720 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('sidebar').textContent).toBe('open');
  });

  it('width updates correctly after resize to 720', () => {
    renderWithProvider(600);
    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 720 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('width').textContent).toBe('720');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – boundary widths', () => {
  it('width 639 reports isMobile=true', () => {
    renderWithProvider(639);
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
  });

  it('width 640 reports isMobile=false', () => {
    renderWithProvider(640);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
  });

  it('width 1023 reports isTablet=true', () => {
    renderWithProvider(1023);
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });

  it('width 1024 reports isTablet=false', () => {
    renderWithProvider(1024);
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
  });

  it('width 1024 reports isMobile=false', () => {
    renderWithProvider(1024);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
  });

  it('width 639 also reports isTablet=true', () => {
    renderWithProvider(639);
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });

  it('width 800 reports isMobile=false and isTablet=true', () => {
    renderWithProvider(800);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });

  it('width 1280 reports both flags false', () => {
    renderWithProvider(1280);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – resize transitions', () => {
  it('resize from 1200 to 500 sets isMobile=true', () => {
    renderWithProvider(1200);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 500 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
  });

  it('resize from 500 to 1200 sets isMobile=false', () => {
    renderWithProvider(500);
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1200 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
  });

  it('resize from 1200 to 900 sets isTablet=true', () => {
    renderWithProvider(1200);
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 900 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });

  it('sidebar auto-closes when resizing from 900 to 1024', async () => {
    renderWithProvider(900);
    await userEvent.click(screen.getByText('Open'));
    expect(screen.getByTestId('sidebar').textContent).toBe('open');
    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('sidebar').textContent).toBe('closed');
  });

  it('sidebar stays open when resizing from 800 to 900 (both tablet)', async () => {
    renderWithProvider(800);
    await userEvent.click(screen.getByText('Open'));
    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 900 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('sidebar').textContent).toBe('open');
  });

  it('width value updates to 1024 after resize', () => {
    renderWithProvider(800);
    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('width').textContent).toBe('1024');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – multiple resize events', () => {
  it('handles two consecutive resize events correctly', () => {
    renderWithProvider(1200);
    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 800 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
  });

  it('width 768 is tablet but not mobile', () => {
    renderWithProvider(768);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });

  it('width 400 is both mobile and tablet', () => {
    renderWithProvider(400);
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });

  it('width 320 is mobile', () => {
    renderWithProvider(320);
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
  });

  it('width 2560 is not mobile or tablet', () => {
    renderWithProvider(2560);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
  });

  it('width reflects the value after multiple resizes', () => {
    renderWithProvider(1200);
    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 600 });
      window.dispatchEvent(new Event('resize'));
    });
    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1440 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('width').textContent).toBe('1440');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – sidebar control', () => {
  it('sidebar starts closed at any width', () => {
    renderWithProvider(375);
    expect(screen.getByTestId('sidebar').textContent).toBe('closed');
  });

  it('Close button keeps sidebar closed when already closed', async () => {
    renderWithProvider(800);
    await userEvent.click(screen.getByText('Close'));
    expect(screen.getByTestId('sidebar').textContent).toBe('closed');
  });

  it('Open then Close sets sidebar back to closed', async () => {
    renderWithProvider(800);
    await userEvent.click(screen.getByText('Open'));
    expect(screen.getByTestId('sidebar').textContent).toBe('open');
    await userEvent.click(screen.getByText('Close'));
    expect(screen.getByTestId('sidebar').textContent).toBe('closed');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – width boundary exactness', () => {
  it('width 639 is mobile (< 640)', () => {
    renderWithProvider(639);
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
  });

  it('width 640 is not mobile (>= 640)', () => {
    renderWithProvider(640);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
  });

  it('width 1023 is tablet (< 1024)', () => {
    renderWithProvider(1023);
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });

  it('width 1024 is not tablet (>= 1024)', () => {
    renderWithProvider(1024);
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
  });

  it('width 1 is mobile and tablet', () => {
    renderWithProvider(1);
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – large screen widths', () => {
  it('width 1280 is not mobile or tablet', () => {
    renderWithProvider(1280);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
  });

  it('width 1920 is not mobile or tablet', () => {
    renderWithProvider(1920);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
  });

  it('width 3840 reports correct width', () => {
    renderWithProvider(3840);
    expect(screen.getByTestId('width').textContent).toBe('3840');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – open sidebar state', () => {
  it('sidebar is open after clicking Open', async () => {
    renderWithProvider(1200);
    await userEvent.click(screen.getByText('Open'));
    expect(screen.getByTestId('sidebar').textContent).toBe('open');
  });

  it('sidebar can be opened multiple times without effect', async () => {
    renderWithProvider(800);
    await userEvent.click(screen.getByText('Open'));
    await userEvent.click(screen.getByText('Open'));
    expect(screen.getByTestId('sidebar').textContent).toBe('open');
  });

  it('sidebar width reflects provided value when open', async () => {
    renderWithProvider(768);
    await userEvent.click(screen.getByText('Open'));
    expect(screen.getByTestId('sidebar').textContent).toBe('open');
    expect(screen.getByTestId('width').textContent).toBe('768');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – responsive flag combinations at specific widths', () => {
  it('width 480 is mobile and tablet', () => {
    renderWithProvider(480);
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });

  it('width 800 is tablet only (not mobile)', () => {
    renderWithProvider(800);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });

  it('width 1100 is neither mobile nor tablet', () => {
    renderWithProvider(1100);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
  });

  it('width 500 is mobile', () => {
    renderWithProvider(500);
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – resize events update flags', () => {
  it('resizing to mobile width sets isMobile=true', () => {
    renderWithProvider(1200);
    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
  });

  it('resizing from mobile to desktop sets isMobile=false', () => {
    renderWithProvider(375);
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
  });

  it('resizing to tablet width sets isTablet=true', () => {
    renderWithProvider(1200);
    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 768 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – exact boundary widths (additional)', () => {
  it('width 320 (small mobile) isMobile=true', () => {
    renderWithProvider(320);
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
  });

  it('width 375 (iPhone-size) isMobile=true', () => {
    renderWithProvider(375);
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
  });

  it('width 414 (large mobile) isMobile=true', () => {
    renderWithProvider(414);
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
  });

  it('width 768 (tablet) isTablet=true', () => {
    renderWithProvider(768);
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });

  it('width 900 (large tablet) isTablet=true, isMobile=false', () => {
    renderWithProvider(900);
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
  });

  it('width 1200 desktop: isMobile=false, isTablet=false', () => {
    renderWithProvider(1200);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – sidebar toggle sequences', () => {
  it('close then open sidebar', async () => {
    renderWithProvider(1200);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByTestId('sidebar').textContent).toBe('open');
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByTestId('sidebar').textContent).toBe('closed');
  });

  it('open then close then open sidebar', async () => {
    renderWithProvider(1200);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByTestId('sidebar').textContent).toBe('open');
  });

  it('multiple close calls stay closed', async () => {
    renderWithProvider(1200);
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByTestId('sidebar').textContent).toBe('closed');
  });

  it('multiple open calls stay open', async () => {
    renderWithProvider(1200);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByTestId('sidebar').textContent).toBe('open');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – width property reflects innerWidth', () => {
  it('reflects width 480', () => {
    renderWithProvider(480);
    expect(screen.getByTestId('width').textContent).toBe('480');
  });

  it('reflects width 600', () => {
    renderWithProvider(600);
    expect(screen.getByTestId('width').textContent).toBe('600');
  });

  it('reflects width 1440', () => {
    renderWithProvider(1440);
    expect(screen.getByTestId('width').textContent).toBe('1440');
  });

  it('reflects width 2560', () => {
    renderWithProvider(2560);
    expect(screen.getByTestId('width').textContent).toBe('2560');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – sidebar state default behavior', () => {
  it('sidebar starts closed on wide screen (1280)', () => {
    renderWithProvider(1280);
    expect(screen.getByTestId('sidebar').textContent).toBe('closed');
  });

  it('sidebar starts closed on small screen (375)', () => {
    renderWithProvider(375);
    expect(screen.getByTestId('sidebar').textContent).toBe('closed');
  });

  it('sidebar starts closed on medium-small screen (640)', () => {
    renderWithProvider(640);
    expect(screen.getByTestId('sidebar').textContent).toBe('closed');
  });

  it('sidebar starts closed on large screen (1920)', () => {
    renderWithProvider(1920);
    expect(screen.getByTestId('sidebar').textContent).toBe('closed');
  });
});

// ─────────────────────────────────────────────────────────────
describe('useLayout – isMobile flag for various widths', () => {
  it('isMobile is true at 320px', () => {
    renderWithProvider(320);
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
  });

  it('isMobile is true at 480px', () => {
    renderWithProvider(480);
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
  });

  it('isMobile is false at 1200px', () => {
    renderWithProvider(1200);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
  });

  it('isMobile is false at 1920px', () => {
    renderWithProvider(1920);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
  });
});
