import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import Home from './pages/Home';
import SignIn from './pages/SignIn';
import Callback from './pages/Callback';
import Dashboard from './pages/Dashboard';
import Workflows from './pages/Workflows';
import Cases from './pages/Cases';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/callback" element={<Callback />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/workflows" element={<Workflows />} />
        <Route path="/workflows/:id" element={<Workflows />} />
        <Route path="/cases" element={<Cases />} />
        <Route path="/cases/:id" element={<Cases />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
