import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
// On importe le hook du contexte qu'on vient de créer pour gérer le thème global
import { useTheme } from '../context/ThemeContext';

const Preferences: React.FC = () => {
  const navigate = useNavigate();
  
  // On récupère l'état global (darkMode) et la fonction pour le changer (toggleTheme)
  const { darkMode, toggleTheme } = useTheme();

  // États locaux pour les options simulées (Notifications, Historique)
  // Elles fonctionnent visuellement mais ne sont pas encore liées au backend
  const [notifications, setNotifications] = useState(true);
  // On charge la valeur réelle (par défaut true si pas définie)
  const [saveHistory, setSaveHistory] = useState(() => {
    return localStorage.getItem('saveHistory') !== 'false';
  });

  // Quand on change l'option, on sauvegarde dans la mémoire du téléphone
  const toggleSaveHistory = () => {
    const newValue = !saveHistory;
    setSaveHistory(newValue);
    localStorage.setItem('saveHistory', String(newValue));
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-300 pb-20">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 p-4 shadow-sm flex items-center gap-3 sticky top-0 z-10 transition-colors border-b dark:border-slate-700">
        <button 
          onClick={() => navigate(-1)} // Retourne à la page précédente (Profil)
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-200 transition-colors"
        >
           <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Préférences</h1>
      </div>

      <div className="p-4 space-y-6">

        {/* Section Apparence */}
        <section>
          <h2 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 ml-1">Apparence</h2>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden transition-colors">
            
            {/* Toggle Mode Sombre (Connecté au ThemeContext) */}
            <div className="p-4 flex items-center justify-between border-b border-gray-50 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg transition-colors ${darkMode ? 'bg-purple-900/30 text-purple-400' : 'bg-gray-100 text-gray-600'}`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                </div>
                <span className="font-medium text-gray-700 dark:text-gray-200">Mode Sombre</span>
              </div>
              
              <button 
                onClick={toggleTheme} // Appelle la fonction globale
                className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ease-in-out ${darkMode ? 'bg-blue-600' : 'bg-gray-300 dark:bg-slate-600'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ease-in-out ${darkMode ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>

            {/* Langue (Statique pour l'instant) */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg>
                </div>
                <span className="font-medium text-gray-700 dark:text-gray-200">Langue</span>
              </div>
              <span className="text-sm text-gray-400 dark:text-gray-500 font-medium">Français (FR)</span>
            </div>

          </div>
        </section>

        {/* Section Système */}
        <section>
          <h2 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 ml-1">Système</h2>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden transition-colors">
            
            {/* Toggle Notifications */}
            <div className="p-4 flex items-center justify-between border-b border-gray-50 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                </div>
                <span className="font-medium text-gray-700 dark:text-gray-200">Notifications</span>
              </div>
              <button 
                onClick={() => setNotifications(!notifications)}
                className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${notifications ? 'bg-blue-600' : 'bg-gray-300 dark:bg-slate-600'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${notifications ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>

             {/* Toggle Historique */}
             <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div className="flex flex-col">
                    <span className="font-medium text-gray-700 dark:text-gray-200">Sauvegarder l'historique</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">Conserver les scans localement</span>
                </div>
              </div>
              <button 
                onClick={toggleSaveHistory} // <--- Utilise la nouvelle fonction
                className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${saveHistory ? 'bg-blue-600' : 'bg-gray-300 dark:bg-slate-600'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${saveHistory ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>

          </div>
        </section>

        {/* Footer Info */}
        <div className="text-center pt-8">
            <p className="text-xs text-gray-400 dark:text-gray-600">ProfScanner v1.0.2 (Beta)</p>
            <p className="text-xs text-gray-300 dark:text-gray-700 mt-1">© 2026 . Slimane Sahnoune, all rights reserved®.</p>
        </div>

      </div>
    </div>
  );
};

export default Preferences;