import { HashRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Dashboard from './screens/Dashboard';
import Workspaces from './screens/Workspaces';
import WorkspaceDetail from './screens/WorkspaceDetail';
import Automations from './screens/Automations';
import AutomationBuilder from './screens/AutomationBuilder';
import Documents from './screens/Documents';
import DocumentDetail from './screens/DocumentDetail';
import Meetings from './screens/Meetings';
import MeetingDetail from './screens/MeetingDetail';
import Tasks from './screens/Tasks';
import Reports from './screens/Reports';
import Knowledge from './screens/Knowledge';
import Templates from './screens/Templates';
import Admin from './screens/Admin';

function AppShell() {
  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        overflow: 'hidden',
        background: '#0A0F1E',
      }}
    >
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TopBar />
        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            background: '#0A0F1E',
          }}
        >
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
            <Route path="/knowledge" element={<Knowledge />} />
            <Route path="/templates" element={<Templates />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AppShell />
    </HashRouter>
  );
}
