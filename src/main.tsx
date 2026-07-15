import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import EnvErrorPage from './components/EnvErrorPage.tsx'
import { checkEnv } from './lib/envCheck.ts'

const envStatus = checkEnv();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {envStatus.ok ? (
      <ErrorBoundary section="Application">
        <App />
      </ErrorBoundary>
    ) : (
      <EnvErrorPage status={envStatus} />
    )}
  </StrictMode>,
)
