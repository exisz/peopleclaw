/**
 * PeopleClaw Living SaaS shell routing.
 *
 * Top-level shell: Apps + Settings.
 * Per-App shell: `/app/:id/{dashboard|build|chat}`.
 * Runtime soft route: `/apps/:appId/*` resolves App deployment artifacts.
 */
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
import AppsList from './pages/AppsList';
import Settings from './pages/Settings';
import AppShell from './components/layout/AppShell';
import AppInnerShell from './components/layout/AppInnerShell';
import AppDashboardPage from './pages/app/AppDashboardPage';
import AppBuildPage from './pages/app/AppBuildPage';
import AppChatPage from './pages/app/AppChatPage';
import UserAppRuntimePage from './pages/app/UserAppRuntimePage';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/callback" element={<Callback />} />

          <Route path="/apps" element={<ErrorBoundary><AppShell title="Apps"><AppsList /></AppShell></ErrorBoundary>} />
          <Route path="/apps/:appId/*" element={<ErrorBoundary><AppShell title="App Runtime"><UserAppRuntimePage /></AppShell></ErrorBoundary>} />
          <Route path="/settings" element={<ErrorBoundary><AppShell title="Settings"><Settings /></AppShell></ErrorBoundary>} />
          <Route path="/settings/:tab" element={<ErrorBoundary><AppShell title="Settings"><Settings /></AppShell></ErrorBoundary>} />

          <Route path="/app/:id" element={<Navigate to="dashboard" replace />} />
          <Route path="/app/:id/dashboard" element={<ErrorBoundary><AppInnerShell title="Overview"><AppDashboardPage /></AppInnerShell></ErrorBoundary>} />
          <Route path="/app/:id/build" element={<ErrorBoundary><AppInnerShell title="Build App"><AppBuildPage /></AppInnerShell></ErrorBoundary>} />
          <Route path="/app/:id/chat" element={<ErrorBoundary><AppInnerShell title="Chat"><AppChatPage /></AppInnerShell></ErrorBoundary>} />
          <Route path="/app/:id/modules" element={<Navigate to="../build" replace />} />
          <Route path="/app/:id/system/*" element={<Navigate to="../build" replace />} />

          <Route path="/app" element={<Navigate to="/apps" replace />} />
          <Route path="/dashboard" element={<Navigate to="/apps" replace />} />
          <Route path="/credits/*" element={<Navigate to="/apps" replace />} />
          <Route path="/roadmap" element={<Navigate to="/apps" replace />} />
          <Route path="*" element={<Navigate to="/apps" replace />} />
        </Routes>
        <Toaster richColors closeButton position="top-right" />
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
