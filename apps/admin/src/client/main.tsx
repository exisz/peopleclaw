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
import { AppHome } from './components/replit/AppHome';
import { AgentWorkspace } from './components/replit/AgentWorkspace';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/callback" element={<Callback />} />
          <Route path="/app" element={<ErrorBoundary><AppHome /></ErrorBoundary>} />
          <Route path="/app/task/:taskId" element={<ErrorBoundary><AgentWorkspace /></ErrorBoundary>} />
          <Route path="/dashboard" element={<Navigate to="/app" replace />} />
          <Route path="/workflows/*" element={<Navigate to="/app" replace />} />
          <Route path="/settings/*" element={<Navigate to="/app" replace />} />
          <Route path="/credits/*" element={<Navigate to="/app" replace />} />
          <Route path="/roadmap" element={<Navigate to="/app" replace />} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
        <Toaster richColors closeButton position="top-right" />
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
