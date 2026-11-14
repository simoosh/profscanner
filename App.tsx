import React from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ProfileProvider, useProfile } from './context/ProfileContext';
import { Layout } from './components/Layout';

// --- IMPORTS ---
import Home from './pages/Home';
import Result from './pages/Result';
import Preferences from './pages/Preferences';
import PersonalInfo from './pages/PersonalInfo';
import Customize from './pages/Customize';
import Onboarding from './pages/Onboarding';

import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { History } from './pages/History';
import { Profile } from './pages/Profile';

// Route protégée : vérifie auth + onboarding
const ProtectedRoute = ({ children }: React.PropsWithChildren) => {
  const { user, loading } = useAuth();
  const { isOnboarded, loading: profileLoading } = useProfile();
  const location = useLocation();

  if (loading || profileLoading) {
    return (
      <div className="h-screen flex items-center justify-center text-blue-600 bg-gray-50 dark:bg-slate-900 transition-colors">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Si pas onboardé et pas déjà sur /onboarding → rediriger
  if (!isOnboarded && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  // Si onboardé et sur /onboarding → rediriger vers home
  if (isOnboarded && location.pathname === '/onboarding') {
    return <Navigate to="/" replace />;
  }

  return <Layout>{children}</Layout>;
};

// Route publique : si connecté → Home
const PublicRoute = ({ children }: React.PropsWithChildren) => {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  return <Layout>{children}</Layout>;
};

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <ProfileProvider>
          <HashRouter>
            <Routes>
              {/* Routes Publiques */}
              <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
              <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />

              {/* Onboarding (protégé mais avant Home) */}
              <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />

              {/* Routes Privées */}
              <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
              <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/personal-info" element={<ProtectedRoute><PersonalInfo /></ProtectedRoute>} />
              <Route path="/preferences" element={<ProtectedRoute><Preferences /></ProtectedRoute>} />
              <Route path="/customize" element={<ProtectedRoute><Customize /></ProtectedRoute>} />

              {/* Routes Résultat */}
              <Route path="/result" element={<ProtectedRoute><Result /></ProtectedRoute>} />
              <Route path="/result/:id" element={<ProtectedRoute><Result /></ProtectedRoute>} />

              {/* 404 → Home */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </HashRouter>
        </ProfileProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;