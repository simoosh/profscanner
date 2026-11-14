import React from 'react';
import { Server, AlertTriangle, AlertCircle } from 'lucide-react';

export type ModalType = 'delete' | 'error' | 'server-sleep' | 'info';

interface AppModalProps {
  isOpen: boolean;
  type: ModalType;
  title?: string;
  message: string;
  onConfirm?: () => void;
  onClose: () => void;
  isLoading?: boolean;
}

export const AppModal: React.FC<AppModalProps> = ({ 
  isOpen, type, title, message, onConfirm, onClose, isLoading 
}) => {

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
        onClick={onClose}
        style={{ animation: 'fadeIn 0.2s ease-out' }}
      />

      {/* Contenu */}
      <div 
        className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-2xl p-6 shadow-2xl relative border border-gray-100 dark:border-slate-700"
        style={{ animation: 'modalSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        
        {/* ZONE D'ILLUSTRATION */}
        <div className="flex justify-center mb-5 h-28 items-center overflow-hidden bg-gray-50 dark:bg-slate-900/50 rounded-xl">
            
            {/* 1. SUPPRESSION — CSS only animation */}
            {type === 'delete' && (
                <div className="flex flex-col items-center" style={{ gap: '2px' }}>
                    {/* Document qui tombe */}
                    <div className="delete-doc-anim">
                      <svg width="28" height="34" viewBox="0 0 28 34" fill="none">
                        <rect x="1" y="1" width="26" height="32" rx="3" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1.5" />
                        <line x1="7" y1="9" x2="21" y2="9" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
                        <line x1="7" y1="14" x2="21" y2="14" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
                        <line x1="7" y1="19" x2="15" y2="19" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </div>
                    {/* Couvercle animé (séparé du corps) */}
                    <div className="delete-lid-anim" style={{ marginBottom: '-4px', zIndex: 2 }}>
                      <svg width="32" height="10" viewBox="0 0 32 10" fill="none">
                        <path d="M5 9 H27" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
                        <path d="M12 9 V4 H20 V9" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    {/* Corps de la poubelle (fixe) */}
                    <svg width="32" height="24" viewBox="0 0 32 24" fill="none">
                      <path d="M7 2 L9 22 H23 L25 2" fill="#fee2e2" stroke="#ef4444" strokeWidth="1.5" strokeLinejoin="round" />
                      <line x1="13" y1="6" x2="13" y2="18" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
                      <line x1="19" y1="6" x2="19" y2="18" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                </div>
            )}

            {/* 2. ERREUR — Icône pulse */}
            {type === 'error' && (
                <div className="flex items-center justify-center">
                    <div className="relative">
                        <div className="absolute inset-0 bg-red-500/20 rounded-full" style={{ animation: 'errorPulse 2s ease-in-out infinite' }} />
                        <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-full relative">
                            <AlertCircle size={40} className="text-red-500 dark:text-red-400" />
                        </div>
                    </div>
                </div>
            )}

            {/* 3. SERVEUR ENDORMI */}
            {type === 'server-sleep' && (
                <div className="relative flex items-center justify-center">
                    <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-full">
                        <Server size={40} className="text-blue-500 dark:text-blue-400" />
                    </div>
                    <div className="absolute -top-1 -right-2 flex flex-col items-end gap-0.5">
                       <span className="text-blue-400 font-bold text-lg animate-bounce" style={{animationDuration: '2s'}}>Z</span>
                       <span className="text-blue-300 font-bold text-sm animate-bounce" style={{animationDuration: '2.2s', animationDelay: '0.3s'}}>z</span>
                    </div>
                </div>
            )}

             {/* 4. INFO STANDARD */}
             {type === 'info' && (
                <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-full">
                    <AlertTriangle size={40} className="text-blue-600 dark:text-blue-400" />
                </div>
            )}
        </div>

        {/* --- TEXTE --- */}
        <div className="text-center mb-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                {title || (type === 'delete' ? 'Supprimer ?' : type === 'error' ? 'Erreur' : 'Information')}
            </h3>
            <p className="text-gray-500 dark:text-gray-300 text-sm leading-relaxed px-2">
                {message}
            </p>
        </div>

        {/* --- BOUTONS --- */}
        <div className="flex gap-3">
            <button 
                onClick={onClose}
                className={`flex-1 py-3 font-semibold rounded-xl transition-colors ${
                  onConfirm 
                    ? 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600' 
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
            >
                {onConfirm ? 'Annuler' : 'Compris'}
            </button>

            {onConfirm && (
                <button 
                    onClick={onConfirm}
                    disabled={isLoading}
                    className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-500/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                    {isLoading ? '...' : 'Confirmer'}
                </button>
            )}
        </div>

      </div>
    </div>
  );
};