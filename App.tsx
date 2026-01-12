import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext'; // Ajout du contexte Thème
import { Layout } from './components/Layout';


// --- IMPORTS PAR DÉFAUT (export default) ---
// Basé sur le code que tu m'as fourni pour ces fichiers
import Home from './pages/Home';
import Result from './pages/Result';
import Preferences from './pages/Preferences';
import PersonalInfo from './pages/PersonalInfo';

// --- IMPORTS NOMMÉS (export const) ---
// Basé sur la structure standard de tes autres fichiers
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { History } from './pages/History';
import { Profile } from './pages/Profile'; 

// Composant de protection (Si pas connecté -> Login)
const ProtectedRoute = ({ children }: React.PropsWithChildren) => {
  const { user, loading } = useAuth();
  
  // J'ai ajouté dark:bg-slate-900 ici pour que l'écran de chargement ne flash pas en blanc
  if (loading) return <div className="h-screen flex items-center justify-center text-blue-600 bg-gray-50 dark:bg-slate-900 transition-colors">Chargement...</div>;
  
  if (!user) return <Navigate to="/login" replace />;

  return <Layout>{children}</Layout>;
};

// Composant Public (Si connecté -> Home)
const PublicRoute = ({ children }: React.PropsWithChildren) => {
  const { user, loading } = useAuth();
  
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  // J'utilise Layout ici aussi pour que le fond sombre s'applique même sur Login/Signup
  return <Layout>{children}</Layout>;
};

function App() {
  return (
    <AuthProvider>
      {/* On englobe toute l'app avec le ThemeProvider pour que le mode sombre fonctionne partout */}
      <ThemeProvider>
        <HashRouter>
          <Routes>
            {/* Routes Publiques */}
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
            
            {/* Routes Privées (Protégées) */}
            <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/personal-info" element={<ProtectedRoute><PersonalInfo /></ProtectedRoute>} />
            <Route path="/preferences" element={<ProtectedRoute><Preferences /></ProtectedRoute>} />
            
            {/* Routes Résultat (Gestion directe ou via historique) */}
            <Route path="/result" element={<ProtectedRoute><Result /></ProtectedRoute>} />
            <Route path="/result/:id" element={<ProtectedRoute><Result /></ProtectedRoute>} />
            
            {/* Redirection par défaut (404 -> Home) */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;