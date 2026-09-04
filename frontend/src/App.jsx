import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import ReconciliationPage from './pages/ReconciliationPage';
import ExceptionsPage from './pages/ExceptionsPage';
import ExceptionDetail from './pages/ExceptionDetail';
import AIInsightsPage from './pages/AIInsightsPage';
import AuditLogPage from './pages/AuditLogPage';
import DataPage from './pages/DataPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing page — no nav */}
        <Route path="/" element={<LandingPage />} />

        {/* App pages — with nav */}
        <Route path="/*" element={<AppLayout />} />
      </Routes>
    </BrowserRouter>
  );
}

function AppLayout() {
  return (
    <div className="min-h-screen bg-[#0f1117]">
      <Navbar />
      <main className="pt-16 px-4 sm:px-6 py-6 max-w-7xl mx-auto">
        <Routes>
          <Route path="/dashboard"      element={<Dashboard />} />
          <Route path="/reconciliation" element={<ReconciliationPage />} />
          <Route path="/exceptions"     element={<ExceptionsPage />} />
          <Route path="/exceptions/:id" element={<ExceptionDetail />} />
          <Route path="/ai-insights"    element={<AIInsightsPage />} />
          <Route path="/audit"          element={<AuditLogPage />} />
          <Route path="/data"           element={<DataPage />} />
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}
