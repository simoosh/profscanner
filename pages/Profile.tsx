import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useProfile } from '../context/ProfileContext';
import { getProfessionById } from '../services/professionRegistry';
import { clearAllLocalData } from '../services/storage';
import { findProvider, getSelectedModel, unavailabilityReason } from '../services/ai/registry';
import { AppModal } from '../components/AppModal';
import { InstallCard } from '../components/InstallCard';

const Chevron = () => (
  <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

export const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useProfile();
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  const profession = useMemo(
    () => (profile?.profession ? getProfessionById(profile.profession) : undefined),
    [profile?.profession]
  );
  const model = getSelectedModel();
  const modelProblem = unavailabilityReason(model);
  const hasApiKey = !modelProblem;
  const displayName = profile?.displayName || 'Utilisateur';

  const handleReset = async () => {
    setResetting(true);
    await clearAllLocalData();
    await refreshProfile();
    setResetting(false);
    setConfirmReset(false);
    navigate('/onboarding', { replace: true });
  };

  return (
    <div className="min-h-dvh bg-gray-50 dark:bg-slate-900 transition-colors duration-300 pb-20 relative">
      <AppModal
        isOpen={confirmReset}
        type="delete"
        title="Effacer toutes les données ?"
        message="Votre profil, votre historique de scans et votre clé API seront supprimés de cet appareil. Cette action est irréversible."
        onConfirm={handleReset}
        onClose={() => setConfirmReset(false)}
        isLoading={resetting}
      />

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
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white flex-shrink-0"
            style={{ backgroundColor: profession?.color || '#3b82f6' }}
          >
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="overflow-hidden">
            <h2 dir="auto" className="font-bold text-gray-900 dark:text-white truncate">{displayName}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{profession?.label || 'Profil local'}</p>
            <span className="inline-block mt-2 px-2 py-1 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 text-xs font-bold rounded-md border border-gray-200 dark:border-slate-600">
              Données stockées sur cet appareil
            </span>
          </div>
        </div>

        {/* Clé API */}
        <button
          onClick={() => navigate('/models')}
          className={`w-full p-4 rounded-2xl border flex items-center gap-3 text-left transition-colors ${
            hasApiKey
              ? 'bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-700'
              : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/40'
          }`}
        >
          <div className={`p-2 rounded-lg ${hasApiKey ? 'bg-green-50 dark:bg-green-900/20 text-green-600' : 'bg-amber-100 dark:bg-amber-900/40 text-amber-600'}`}>
            <KeyRound size={20} />
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-800 dark:text-gray-100">Modèle IA</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
              {hasApiKey ? (
                <><CheckCircle2 size={12} className="text-green-500" /> {model.label} · {findProvider(model.providerId)?.name}</>
              ) : (
                <><AlertTriangle size={12} className="text-amber-500" /> {modelProblem}</>
              )}
            </p>
          </div>
          <Chevron />
        </button>

        {/* Installation / plein écran */}
        <InstallCard />

        {/* Menu Options */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden transition-colors">
          <button onClick={() => navigate('/personal-info')} className="w-full p-4 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-slate-700 border-b border-gray-50 dark:border-slate-700 text-left">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            <span className="flex-1 text-gray-700 dark:text-gray-200 font-medium">Informations personnelles</span>
            <Chevron />
          </button>

          <button onClick={() => navigate('/preferences')} className="w-full p-4 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-slate-700 text-left transition-colors">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <span className="flex-1 text-gray-700 dark:text-gray-200 font-medium">Préférences</span>
            <Chevron />
          </button>
        </div>

        {/* Effacer les données */}
        <button
          onClick={() => setConfirmReset(true)}
          className="w-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl font-semibold flex items-center justify-center gap-2 active:bg-red-100 dark:active:bg-red-900/40 transition-colors"
        >
          <Trash2 size={20} />
          Effacer toutes mes données
        </button>

        <p className="text-center text-xs text-gray-400 dark:text-gray-500 px-6">
          ProfScanner est open source et ne possède aucun serveur : vos documents ne quittent votre appareil que pour être envoyés au fournisseur d'IA que vous avez choisi, avec votre propre clé.
        </p>
      </div>
    </div>
  );
};
