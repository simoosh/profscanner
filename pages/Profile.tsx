import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
// On importe l'icône Diamant et X (Fermer)
import { Gem } from 'lucide-react';

export const Profile: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  // État pour gérer l'affichage de la popup "Bientôt disponible"
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error("Erreur déconnexion", error);
    }
  };

  const showFeatureAlert = (feature: string) => {
    // On garde l'alerte simple pour les autres boutons
    alert(`La fonctionnalité "${feature}" sera disponible prochainement.`);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-300 pb-20 relative">
      
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 p-4 shadow-sm flex items-center gap-3 sticky top-0 z-10 transition-colors">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-200">
           <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Mon Profil</h1>
      </div>

      <div className="p-4 space-y-6">
        
        {/* Carte Utilisateur */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 flex items-center gap-4 transition-colors">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-full flex items-center justify-center text-2xl font-bold">
            {user?.email?.charAt(0).toUpperCase() || "U"}
          </div>
          <div className="overflow-hidden">
            <h2 className="font-bold text-gray-900 dark:text-white truncate">Utilisateur</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
            <span className="inline-block mt-2 px-2 py-1 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 text-xs font-bold rounded-md border border-gray-200 dark:border-slate-600">
              Membre Gratuit
            </span>
          </div>
        </div>

        {/* --- NOUVEAU BOUTON PREMIUM --- */}
        <button 
          onClick={() => setShowPremiumModal(true)}
          className="w-full relative overflow-hidden group bg-gradient-to-r from-blue-700 to-blue-600 p-6 rounded-2xl shadow-lg shadow-blue-500/30 text-left border border-blue-500/30 transition-transform active:scale-[0.98]"
        >
          {/* Effet Brillant (Shine) qui passe en boucle */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent w-1/2 h-full skew-x-[-15deg] animate-shine" />
          
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {/* Icône Diamant Dorée */}
                <Gem className="w-6 h-6 text-yellow-300 fill-yellow-400" />
                <h3 className="text-xl font-bold text-white tracking-wide">
                  PREMIUM
                </h3>
              </div>
              <p className="text-blue-100 text-sm font-medium">Débloquez l'illimité & sans pubs</p>
            </div>
            
            <div className="bg-white/20 p-2 rounded-full backdrop-blur-sm group-hover:bg-white/30 transition-colors">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </div>
          </div>
        </button>

        {/* Menu Options (Reste inchangé) */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden transition-colors">
        <button onClick={() => navigate('/personal-info')} className="w-full p-4 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-slate-700 border-b border-gray-50 dark:border-slate-700 text-left">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            <span className="flex-1 text-gray-700 dark:text-gray-200 font-medium">Informations personnelles</span>
            <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>

          <button onClick={() => navigate('/preferences')} className="w-full p-4 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-slate-700 text-left transition-colors">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <span className="flex-1 text-gray-700 dark:text-gray-200 font-medium">Préférences</span>
            <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>

        {/* Bouton Déconnexion */}
        <button 
          onClick={handleLogout}
          className="w-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl font-semibold flex items-center justify-center gap-2 active:bg-red-100 dark:active:bg-red-900/40 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          Se déconnecter
        </button>

      </div>

      {/* --- POPUP (MODAL) PREMIUM --- */}
      {showPremiumModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity">
          <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-2xl p-6 shadow-2xl transform transition-all scale-100">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-tr from-yellow-200 to-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-yellow-500/30">
                <Gem className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Bientôt Disponible !
              </h3>
              <p className="text-gray-500 dark:text-gray-300 mb-6">
                Le mode Premium arrive très bientôt. <br/>
                Vous profiterez de scans illimités, sans aucune publicité et d'un support prioritaire.
              </p>
              
              <button 
                onClick={() => setShowPremiumModal(false)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors"
              >
                Compris, j'ai hâte !
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};