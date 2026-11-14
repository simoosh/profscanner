import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiService, ScanResult } from '../services/apiService';
import { RenameModal } from '../components/RenameModal';
import { AppModal, ModalType } from '../components/AppModal';
import { Pencil, FileText, Trash2, Search, X } from 'lucide-react';

export const History: React.FC = () => {
  const navigate = useNavigate();
  const [history, setHistory] = useState<ScanResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingScan, setEditingScan] = useState<ScanResult | null>(null);
  
  // Recherche
  const [searchQuery, setSearchQuery] = useState("");

  // Modale custom (au lieu du confirm natif)
  const [modalConfig, setModalConfig] = useState<{isOpen: boolean, type: ModalType, title: string, message: string, onConfirm?: () => void}>({
    isOpen: false, type: 'info', title: '', message: ''
  });

  const openModal = (type: ModalType, title: string, message: string, onConfirm?: () => void) => {
    setModalConfig({ isOpen: true, type, title, message, onConfirm });
  };
  const closeModal = () => setModalConfig({ ...modalConfig, isOpen: false });

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
      await load();
      setEditingScan(null);
    }
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    openModal(
      'delete',
      'Supprimer ce document ?',
      'Cette action est irréversible. Le document sera effacé de votre historique.',
      async () => {
        await ApiService.deleteScan(id);
        await load();
        closeModal();
      }
    );
  };

  // Filtrage
  const filteredHistory = history.filter(scan => 
    scan.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-20 transition-colors duration-300">
      
      {/* MODALE CUSTOM SUPPRESSION */}
      <AppModal 
        isOpen={modalConfig.isOpen}
        type={modalConfig.type}
        title={modalConfig.title}
        message={modalConfig.message}
        onConfirm={modalConfig.onConfirm}
        onClose={closeModal}
      />

      <RenameModal 
        isOpen={!!editingScan}
        initialValue={editingScan?.title || ""}
        onClose={() => setEditingScan(null)}
        onSave={handleRename}
        title="Renommer le document"
      />

      {/* Header avec Barre de Recherche intégrée */}
      <div className="bg-white dark:bg-slate-800 p-4 shadow-sm sticky top-0 z-10 flex flex-col gap-3 transition-colors border-b dark:border-slate-700">
        <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/')} 
              className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-200 transition-colors"
            >
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white transition-colors">Historique</h1>
        </div>

        {/* Barre de recherche */}
        <div className="relative group">
            <Search className="absolute left-3 top-3 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={20} />
            <input 
                type="text" 
                placeholder="Rechercher un document..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-white rounded-xl py-2.5 pl-10 pr-10 outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder-gray-500"
            />
            {searchQuery && (
                <button 
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                >
                    <X size={18} />
                </button>
            )}
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="text-center text-gray-500 dark:text-gray-400 mt-10 animate-pulse">Chargement...</div>
        ) : filteredHistory.length === 0 ? (
          <div className="text-center text-gray-400 dark:text-gray-500 mt-20 flex flex-col items-center">
            <FileText size={48} className="mb-4 opacity-20" />
            <p>{searchQuery ? "Aucun résultat trouvé" : "Aucun scan pour le moment"}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredHistory.map((scan) => (
              <div 
                key={scan.id} 
                className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 flex items-center gap-3 transition-colors group"
              >
                <div 
                  className="flex-1 flex items-center gap-3 cursor-pointer overflow-hidden"
                  onClick={() => navigate(`/result/${scan.id}`)}
                >
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 transition-colors">
                    {scan.pageCount && scan.pageCount > 1 ? `${scan.pageCount}p` : 'DOC'}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 dark:text-white truncate transition-colors pr-2">
                      {scan.title}
                    </h3>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-gray-400 dark:text-gray-500 transition-colors">
                        {new Date(scan.date).toLocaleDateString()}
                      </p>
                      {scan.docxReady && (
                        <span className="w-2 h-2 bg-green-500 rounded-full" title="DOCX prêt" />
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-1 ml-auto">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setEditingScan(scan); }}
                      className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors flex-shrink-0"
                    >
                      <Pencil size={18} />
                    </button>
                    <button 
                      onClick={(e) => handleDelete(scan.id, e)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex-shrink-0"
                    >
                      <Trash2 size={18} />
                    </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};