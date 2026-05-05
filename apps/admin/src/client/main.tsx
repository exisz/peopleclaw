import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';
import './i18n';
import { ThemeProvider } from './components/theme-provider';
import { Toaster } from './components/ui/sonner';
import Home from './pages/Home';
import SignIn from './pages/SignIn';
import Callback from './pages/Callback';
import { ErrorBoundary } from './components/ErrorBoundary';
import AppPlaceholder from './pages/AppPlaceholder';
import AppsList from './pages/AppsList';
import PlaceholderPage from './pages/PlaceholderPage';
import Settings from './pages/Settings';
import AppShell from './components/layout/AppShell';
import AppInnerShell from './components/layout/AppInnerShell';
import AppDashboardPage from './pages/app/AppDashboardPage';
import AppCanvasPage from './pages/app/AppCanvasPage';
import AppChatPage from './pages/app/AppChatPage';
import AppModuleFlowPage from './pages/app/AppModuleFlowPage';
import AppCronPage from './pages/app/AppCronPage';
import AppSecretsPage from './pages/app/AppSecretsPage';
import AppRunnersPage from './pages/app/AppRunnersPage';
import AppLogsPage from './pages/app/AppLogsPage';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/callback" element={<Callback />} />
          {/* All internal pages use AppShell */}
          <Route path="/apps" element={<ErrorBoundary><AppShell title="Apps"><AppsList /></AppShell></ErrorBoundary>} />
          <Route path="/published" element={<ErrorBoundary><AppShell title="Published"><PlaceholderPage title="Published Apps" /></AppShell></ErrorBoundary>} />
          <Route path="/security" element={<ErrorBoundary><AppShell title="Security"><PlaceholderPage title="Security" /></AppShell></ErrorBoundary>} />
          <Route path="/app" element={<ErrorBoundary><AppShell><AppPlaceholder /></AppShell></ErrorBoundary>} />
          <Route path="/app/:id" element={<ErrorBoundary><AppShell><AppPlaceholder /></AppShell></ErrorBoundary>} />
          {/* PLANET-1407: Living SaaS shell — opt-in routes inside an app */}
          <Route path="/app/:id/dashboard" element={<ErrorBoundary><AppInnerShell title="Dashboard"><AppDashboardPage /></AppInnerShell></ErrorBoundary>} />
          <Route path="/app/:id/canvas" element={<ErrorBoundary><AppInnerShell title="Canvas"><AppCanvasPage /></AppInnerShell></ErrorBoundary>} />
          <Route path="/app/:id/chat" element={<ErrorBoundary><AppInnerShell title="Chat"><AppChatPage /></AppInnerShell></ErrorBoundary>} />
          <Route path="/app/:id/system/flow" element={<ErrorBoundary><AppInnerShell title="Module Flow"><AppModuleFlowPage /></AppInnerShell></ErrorBoundary>} />
          <Route path="/app/:id/system/cron" element={<ErrorBoundary><AppInnerShell title="Cron"><AppCronPage /></AppInnerShell></ErrorBoundary>} />
          <Route path="/app/:id/system/secrets" element={<ErrorBoundary><AppInnerShell title="Secrets"><AppSecretsPage /></AppInnerShell></ErrorBoundary>} />
          <Route path="/app/:id/system/runners" element={<ErrorBoundary><AppInnerShell title="Runners"><AppRunnersPage /></AppInnerShell></ErrorBoundary>} />
          <Route path="/app/:id/system/logs" element={<ErrorBoundary><AppInnerShell title="Logs"><AppLogsPage /></AppInnerShell></ErrorBoundary>} />
          <Route path="/settings" element={<ErrorBoundary><AppShell title="Settings"><Settings /></AppShell></ErrorBoundary>} />
          <Route path="/settings/:tab" element={<ErrorBoundary><AppShell title="Settings"><Settings /></AppShell></ErrorBoundary>} />
          {/* All old workflow/case/step URLs redirect to /app */}
          <Route path="/app/workflow/*" element={<Navigate to="/app" replace />} />
          <Route path="/app/task/*" element={<Navigate to="/app" replace />} />
          <Route path="/dashboard" element={<Navigate to="/app" replace />} />
          <Route path="/workflows/*" element={<Navigate to="/app" replace />} />
          <Route path="/credits/*" element={<Navigate to="/app" replace />} />
          <Route path="/roadmap" element={<Navigate to="/app" replace />} />
          <Route path="*" element={<Navigate to="/apps" replace />} />
        </Routes>
        <Toaster richColors closeButton position="top-right" />
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
