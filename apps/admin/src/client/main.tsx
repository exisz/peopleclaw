import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import './i18n';
import { ThemeProvider } from './components/theme-provider';
import { Toaster } from './components/ui/sonner';
import Home from './pages/Home';
import SignIn from './pages/SignIn';
import Callback from './pages/Callback';
import Dashboard from './pages/Dashboard';
import Workflows from './pages/Workflows';
import Credits from './pages/Credits';
import CreditsSuccess from './pages/CreditsSuccess';
import RunWorkflow from './pages/RunWorkflow';
import Settings from './pages/Settings';
import SettingsBackground from './pages/SettingsBackground';
import { ErrorBoundary } from './components/ErrorBoundary';
import Roadmap from './pages/Roadmap';
import AppLayout from './components/AppLayout';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/callback" element={<Callback />} />
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
          <Route path="/workflows" element={<ErrorBoundary><Workflows /></ErrorBoundary>} />
          <Route path="/workflows/:id" element={<ErrorBoundary><Workflows /></ErrorBoundary>} />
          <Route path="/workflows/:id/cases/:caseId" element={<ErrorBoundary><Workflows /></ErrorBoundary>} />
          <Route path="/workflows/:id/run" element={<ErrorBoundary><RunWorkflow /></ErrorBoundary>} />
          <Route path="/credits" element={<ErrorBoundary><Credits /></ErrorBoundary>} />
          <Route path="/credits/success" element={<ErrorBoundary><CreditsSuccess /></ErrorBoundary>} />
          <Route path="/roadmap" element={<ErrorBoundary><Roadmap /></ErrorBoundary>} />
          <Route path="/settings" element={<ErrorBoundary><Settings /></ErrorBoundary>} />
          <Route path="/settings/:tab" element={<ErrorBoundary><Settings /></ErrorBoundary>} />
          <Route path="/settings/background" element={<ErrorBoundary><SettingsBackground /></ErrorBoundary>} />
        </Route>
        </Routes>
      <Toaster richColors closeButton position="top-right" />
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
