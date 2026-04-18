import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import { ThemeProvider } from './components/theme-provider';
import { Toaster } from './components/ui/sonner';
import Home from './pages/Home';
import SignIn from './pages/SignIn';
import Callback from './pages/Callback';
import Dashboard from './pages/Dashboard';
import Workflows from './pages/Workflows';
import Cases from './pages/Cases';
import Credits from './pages/Credits';
import CreditsSuccess from './pages/CreditsSuccess';
import RunWorkflow from './pages/RunWorkflow';
import Settings from './pages/Settings';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/callback" element={<Callback />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/workflows" element={<Workflows />} />
        <Route path="/workflows/:id" element={<Workflows />} />
        <Route path="/workflows/:id/run" element={<RunWorkflow />} />
        <Route path="/cases" element={<Cases />} />
        <Route path="/cases/:id" element={<Cases />} />
        <Route path="/credits" element={<Credits />} />
        <Route path="/credits/success" element={<CreditsSuccess />} />
        <Route path="/settings" element={<Settings />} />
        </Routes>
      <Toaster richColors closeButton position="top-right" />
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
