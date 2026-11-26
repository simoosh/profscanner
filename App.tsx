import React from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { ProfileProvider, useProfile } from './context/ProfileContext';
import { Layout } from './components/Layout';
import { fetchDemoStatus } from './services/ai/demo';

import Home from './pages/Home';
import Result from './pages/Result';
import Preferences from './pages/Preferences';
import PersonalInfo from './pages/PersonalInfo';
import Customize from './pages/Customize';
import Onboarding from './pages/Onboarding';
import Models from './pages/Models';
import { History } from './pages/History';
import { Profile } from './pages/Profile';

// Pas de compte : l'app est utilisable dès que le profil local est créé.
const AppRoute = ({ children }: React.PropsWithChildren) => {
  const { isOnboarded, loading } = useProfile();
  const location = useLocation();

  if (loading) {
    return (
      <div className="h-dvh flex items-center justify-center text-blue-600 bg-gray-50 dark:bg-slate-900 transition-colors">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isOnboarded && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  if (isOnboarded && location.pathname === '/onboarding') {
    return <Navigate to="/" replace />;
  }

  return <Layout>{children}</Layout>;
};

function App() {
  // Ask the relay once at start whether the free demo is enabled, so the default model is a usable one.
  React.useEffect(() => {
    fetchDemoStatus().catch(() => {});
  }, []);

  return (
    <ThemeProvider>
      <ProfileProvider>
        <HashRouter>
          <Routes>
            <Route path="/onboarding" element={<AppRoute><Onboarding /></AppRoute>} />

            <Route path="/" element={<AppRoute><Home /></AppRoute>} />
            <Route path="/history" element={<AppRoute><History /></AppRoute>} />
            <Route path="/profile" element={<AppRoute><Profile /></AppRoute>} />
            <Route path="/personal-info" element={<AppRoute><PersonalInfo /></AppRoute>} />
            <Route path="/preferences" element={<AppRoute><Preferences /></AppRoute>} />
            <Route path="/models" element={<AppRoute><Models /></AppRoute>} />
            <Route path="/api-key" element={<Navigate to="/models" replace />} />
            <Route path="/customize" element={<AppRoute><Customize /></AppRoute>} />

            <Route path="/result" element={<AppRoute><Result /></AppRoute>} />
            <Route path="/result/:id" element={<AppRoute><Result /></AppRoute>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
      </ProfileProvider>
    </ThemeProvider>
  );
}

export default App;
