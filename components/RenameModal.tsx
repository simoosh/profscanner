import React, { useState, useEffect } from 'react';
import { X, Check, Edit3 } from 'lucide-react';

interface RenameModalProps {
  isOpen: boolean;
  initialValue: string;
  onClose: () => void;
  onSave: (newName: string) => Promise<void>;
  title?: string;
}

export const RenameModal: React.FC<RenameModalProps> = ({ isOpen, initialValue, onClose, onSave, title = "Renommer le document" }) => {
  const [value, setValue] = useState(initialValue);
  const [loading, setLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Animation d'entrée/sortie
  useEffect(() => {
    if (isOpen) {
      setValue(initialValue);
      setIsVisible(true);
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300); // Attendre la fin de l'anim
      return () => clearTimeout(timer);
    }
  }, [isOpen, initialValue]);

  if (!isOpen && !isVisible) return null;

  const handleSave = async () => {
    if (!value.trim()) return;
    setLoading(true);
    try {
      await onSave(value);
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
    >
      {/* Backdrop flou */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className={`
        bg-white dark:bg-slate-800 w-full max-w-sm rounded-2xl p-6 shadow-2xl relative transform transition-all duration-300
        ${isOpen ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}
      `}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
              <Edit3 size={20} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X size={20} />
          </button>
        </div>

        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full p-3 mb-6 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
          placeholder="Nom du document"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        />

        <div className="flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-3 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 font-semibold rounded-xl hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
          >
            Annuler
          </button>
          <button 
            onClick={handleSave}
            disabled={loading}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            {loading ? '...' : <>Enregistrer <Check size={18} /></>}
          </button>
        </div>
      </div>
    </div>
  );
};