import { Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NavBar from './components/NavBar';
import HomePage from './pages/HomePage';
import AnalyticsPage from './pages/AnalyticsPage';
import AboutPage from './pages/AboutPage';
import UserGuidePage from './pages/UserGuidePage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 min
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-[var(--paper)] text-[var(--text)]">
        {/* Floating Top Semi-Transparent Navigation Bar */}
        <NavBar />

        {/* Multi-Page Routes */}
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/guide" element={<UserGuidePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </QueryClientProvider>
  );
}
