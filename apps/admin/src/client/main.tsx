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
import Settings from './pages/Settings';
import SettingsBilling from './pages/SettingsBilling';
import SettingsConnections from './pages/SettingsConnections';
import SettingsTeam from './pages/SettingsTeam';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/callback" element={<Callback />} />
          <Route path="/app" element={<ErrorBoundary><AppPlaceholder /></ErrorBoundary>} />
          <Route path="/settings" element={<ErrorBoundary><Settings /></ErrorBoundary>} />
          <Route path="/settings/billing" element={<ErrorBoundary><SettingsBilling /></ErrorBoundary>} />
          <Route path="/settings/connections" element={<ErrorBoundary><SettingsConnections /></ErrorBoundary>} />
          <Route path="/settings/team" element={<ErrorBoundary><SettingsTeam /></ErrorBoundary>} />
          {/* All old workflow/case/step URLs redirect to /app */}
          <Route path="/app/workflow/*" element={<Navigate to="/app" replace />} />
          <Route path="/app/task/*" element={<Navigate to="/app" replace />} />
          <Route path="/dashboard" element={<Navigate to="/app" replace />} />
          <Route path="/workflows/*" element={<Navigate to="/app" replace />} />
          <Route path="/credits/*" element={<Navigate to="/app" replace />} />
          <Route path="/roadmap" element={<Navigate to="/app" replace />} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
        <Toaster richColors closeButton position="top-right" />
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
