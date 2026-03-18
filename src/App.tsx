import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { LayoutProvider, useLayout } from './hooks/useLayout';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';

// Eagerly loaded — always needed
import Dashboard from './screens/Dashboard';

// Lazily loaded — code-split per route
const Workspaces      = lazy(() => import('./screens/Workspaces'));
const WorkspaceDetail = lazy(() => import('./screens/WorkspaceDetail'));
const Automations     = lazy(() => import('./screens/Automations'));
const AutomationBuilder = lazy(() => import('./screens/AutomationBuilder'));
const Documents       = lazy(() => import('./screens/Documents'));
const DocumentDetail  = lazy(() => import('./screens/DocumentDetail'));
const Meetings        = lazy(() => import('./screens/Meetings'));
const MeetingDetail   = lazy(() => import('./screens/MeetingDetail'));
const Tasks           = lazy(() => import('./screens/Tasks'));
const Reports         = lazy(() => import('./screens/Reports'));
const AskAI           = lazy(() => import('./screens/AskAI'));
const Admin           = lazy(() => import('./screens/Admin'));
const BrdRunPage      = lazy(() => import('./screens/BrdRunPage'));

// Minimal fallback shown during lazy load
function PageLoader() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100%', background: '#080C18',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        border: '3px solid rgba(0,212,255,0.15)',
        borderTop: '3px solid #00D4FF',
        animation: 'spin 0.7s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function AppShell() {
  const { sidebarOpen, setSidebarOpen, isTablet } = useLayout();

  return (
    <div style={{ display: 'flex', height: '100dvh', overflow: 'hidden', background: '#080C18', position: 'relative' }}>
      {/* Mobile overlay */}
      {isTablet && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            zIndex: 49, backdropFilter: 'blur(2px)',
          }}
        />
      )}

      <Sidebar />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <TopBar />
        <main style={{ flex: 1, overflowY: 'auto', background: '#080C18' }}>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/workspaces" element={<Workspaces />} />
              <Route path="/workspaces/:id" element={<WorkspaceDetail />} />
              <Route path="/automations" element={<Automations />} />
              <Route path="/automations/:id" element={<AutomationBuilder />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/documents/:id" element={<DocumentDetail />} />
              <Route path="/meetings" element={<Meetings />} />
              <Route path="/meetings/:id" element={<MeetingDetail />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/ask-ai" element={<AskAI />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/automations/brd/run" element={<BrdRunPage />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <LayoutProvider>
        <AppShell />
      </LayoutProvider>
    </HashRouter>
  );
}
