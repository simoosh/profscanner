import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiService, ScanResult } from '../services/apiService';
import { RenameModal } from '../components/RenameModal';
import { Pencil, FileText } from 'lucide-react'; // J'utilise FileText comme icône DOC

export const History: React.FC = () => {
  const navigate = useNavigate();
  const [history, setHistory] = useState<ScanResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingScan, setEditingScan] = useState<ScanResult | null>(null);

  const load = async () => {
    try {
      const data = await ApiService.getHistory();
      setHistory(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleRename = async (newName: string) => {
    if (editingScan) {
      await ApiService.updateScanTitle(editingScan.id, newName);
      await load(); // On recharge la liste pour voir le nouveau nom
      setEditingScan(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-20 transition-colors duration-300">
      
      {/* Modale de renommage */}
      <RenameModal 
        isOpen={!!editingScan}
        initialValue={editingScan?.title || ""}
        onClose={() => setEditingScan(null)}
        onSave={handleRename}
        title="Renommer le document"
      />

      {/* Header */}
      <div className="bg-white dark:bg-slate-800 p-4 shadow-sm sticky top-0 z-10 flex items-center gap-3 transition-colors border-b dark:border-slate-700">
        <button 
          onClick={() => navigate('/')} 
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-200 transition-colors"
        >
           <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white transition-colors">Historique</h1>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="text-center text-gray-500 dark:text-gray-400 mt-10 animate-pulse">Chargement...</div>
        ) : history.length === 0 ? (
          <div className="text-center text-gray-400 dark:text-gray-500 mt-20 flex flex-col items-center">
            <FileText size={48} className="mb-4 opacity-20" />
            <p>Aucun scan pour le moment</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((scan) => (
              <div 
                key={scan.id} 
                className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 flex items-center gap-3 transition-colors group"
              >
                {/* Zone cliquable (Scan) */}
                <div 
                  className="flex-1 flex items-center gap-3 cursor-pointer overflow-hidden"
                  onClick={() => navigate(`/result/${scan.id}`)}
                >
                  {/* Icône DOC */}
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 transition-colors">
                    DOC
                  </div>
                  
                  {/* Textes */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 dark:text-white truncate transition-colors pr-2">
                      {scan.title}
                    </h3>
                    <p className="text-xs text-gray-400 dark:text-gray-500 transition-colors">
                      {new Date(scan.date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                
                {/* Bouton Crayon (Aligné à droite et fixe) */}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingScan(scan);
                  }}
                  className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors flex-shrink-0 ml-auto"
                >
                  <Pencil size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};