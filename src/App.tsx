import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { LayoutProvider, useLayout } from './hooks/useLayout';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import { ErrorBoundary } from './components/ErrorBoundary';

import Dashboard from './screens/Dashboard';

const Workspaces          = lazy(() => import('./screens/Workspaces'));
const WorkspaceDetail     = lazy(() => import('./screens/WorkspaceDetail'));
const Automations         = lazy(() => import('./screens/Automations'));
const AutomationBuilder   = lazy(() => import('./screens/AutomationBuilder'));
const Documents           = lazy(() => import('./screens/Documents'));
const DocumentDetail      = lazy(() => import('./screens/DocumentDetail'));
const Meetings            = lazy(() => import('./screens/Meetings'));
const MeetingDetail       = lazy(() => import('./screens/MeetingDetail'));
const Tasks               = lazy(() => import('./screens/Tasks'));
const Reports             = lazy(() => import('./screens/Reports'));
const AskAI               = lazy(() => import('./screens/AskAI'));
const Admin               = lazy(() => import('./screens/Admin'));
const BrdRunPage          = lazy(() => import('./screens/BrdRunPage'));
const BrdToUserstoriesPage = lazy(() => import('./screens/BrdToUserstoriesPage'));
const TrelloCards         = lazy(() => import('./screens/TrelloCards'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
        className="w-10 h-10 rounded-full border-[3px] border-white/10 border-t-[#A78BFA]"
      />
    </div>
  );
}

function RouteTransitions() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        className="h-full"
      >
        <Routes location={location}>
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
          <Route path="/automations/diwan/run" element={<BrdToUserstoriesPage />} />
          <Route path="/trello-cards" element={<TrelloCards />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

function AppShell() {
  const { sidebarOpen, setSidebarOpen, isTablet } = useLayout();

  return (
    <div className="flex h-[100dvh] overflow-hidden relative bg-[color:var(--bg-base)]">
      <AnimatePresence>
        {isTablet && sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[49]"
          />
        )}
      </AnimatePresence>

      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          <Suspense fallback={<PageLoader />}>
            <ErrorBoundary section="Page">
              <RouteTransitions />
            </ErrorBoundary>
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
