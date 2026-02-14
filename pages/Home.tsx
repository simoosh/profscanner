import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiService, ScanResult } from '../services/apiService';
import { RenameModal } from '../components/RenameModal';
import { AppModal, ModalType } from '../components/AppModal'; // <--- NOUVEAU
import { Pencil, Camera, Upload, Pi, Trash2, Search, X } from 'lucide-react';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [recents, setRecents] = useState<ScanResult[]>([]);
  
  // États Scan & Rename
  const [tempScan, setTempScan] = useState<ScanResult | null>(null);
  const [showPostScanModal, setShowPostScanModal] = useState(false);
  const [editingScan, setEditingScan] = useState<ScanResult | null>(null);
  
  // États UI
  const [hasMath, setHasMath] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchActive, setIsSearchActive] = useState(false);

  // États Modales Custom
  const [modalConfig, setModalConfig] = useState<{isOpen: boolean, type: ModalType, title: string, message: string, onConfirm?: () => void}>({
    isOpen: false, type: 'info', title: '', message: ''
  });

  const loadHistory = async () => {
    try {
      const history = await ApiService.getHistory();
      setRecents(history);
    } catch(e) { console.error(e); }
  };

  useEffect(() => { loadHistory(); }, []);

  // Fonction Helper pour ouvrir les modales
  const openModal = (type: ModalType, title: string, message: string, onConfirm?: () => void) => {
    setModalConfig({ isOpen: true, type, title, message, onConfirm });
  };
  const closeModal = () => setModalConfig({ ...modalConfig, isOpen: false });

  // FILTRAGE
  const filteredRecents = recents
    .filter(scan => scan.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .slice(0, 3);

  // ACTIONS
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLoading(true);
      try {
        const result = await ApiService.uploadDocument(file, hasMath);
        setTempScan(result);
        setShowPostScanModal(true);
      } catch (err: any) {
        // --- REMPLACEMENT DE L'ALERT PAR MODALE ---
        setLoading(false);
        openModal('error', 'Oups...', err.message || "Une erreur est survenue lors de l'analyse.");
      } finally {
        if (showPostScanModal) setLoading(false);
      }
    }
  };

  const handlePostScanSave = async (newName: string) => {
    if (tempScan) {
      try {
        if (!tempScan.id.startsWith('temp-')) {
           await ApiService.updateScanTitle(tempScan.id, newName);
        }
        const finalScan = { ...tempScan, title: newName };
        setShowPostScanModal(false);
        setLoading(false);
        navigate('/result', { state: { scanResult: finalScan }, replace: true });
      } catch (error) {
        navigate('/result', { state: { scanResult: tempScan } });
      }
    }
  };

  const handleClosePostScan = () => {
    setShowPostScanModal(false);
    setLoading(false);
    if (tempScan) navigate('/result', { state: { scanResult: tempScan } });
  };

  const handleRecentRename = async (newName: string) => {
    if (editingScan) {
      await ApiService.updateScanTitle(editingScan.id, newName);
      await loadHistory();
      setEditingScan(null);
    }
  };

  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // --- REMPLACEMENT DU CONFIRM NATIF PAR MODALE ---
    openModal(
        'delete', 
        'Supprimer ce document ?', 
        'Cette action est irréversible. Le document sera effacé de votre historique.',
        async () => {
            await ApiService.deleteScan(id);
            await loadHistory();
            closeModal();
        }
    );
  };

  if (loading && !showPostScanModal) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col justify-center items-center p-6 transition-colors">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <h2 className="text-xl font-bold text-gray-800 dark:text-white animate-pulse">
          {hasMath ? "Mode Math Expert..." : "Analyse en cours..."}
        </h2>
        <p className="text-gray-500 dark:text-gray-400">L'IA déchiffre votre document.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-300 pb-20">
      
      {/* MODALES SYSTÈME (Delete, Error...) */}
      <AppModal 
        isOpen={modalConfig.isOpen}
        type={modalConfig.type}
        title={modalConfig.title}
        message={modalConfig.message}
        onConfirm={modalConfig.onConfirm}
        onClose={closeModal}
      />

      <RenameModal 
        isOpen={showPostScanModal}
        title="Nommer le document"
        initialValue={tempScan?.title || "Nouveau Scan"}
        onClose={handleClosePostScan} 
        onSave={handlePostScanSave}
      />

      <RenameModal 
        isOpen={!!editingScan}
        initialValue={editingScan?.title || ""}
        onClose={() => setEditingScan(null)}
        onSave={handleRecentRename}
        title="Renommer"
      />

      {/* HEADER */}
      <header className="bg-white dark:bg-slate-800 p-4 flex justify-between items-center shadow-sm sticky top-0 z-10 transition-colors">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">ProfScanner</h1>
          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Plan Gratuit</p>
        </div>
        <button onClick={() => navigate('/profile')} className="w-10 h-10 bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-200 transition-colors hover:bg-gray-200 dark:hover:bg-slate-600">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
        </button>
      </header>

      <main className="p-4 space-y-6">
        
        {/* NOUVEAU SCAN */}
        <section>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Nouveau Scan</h2>
          </div>

          <div 
            onClick={() => setHasMath(!hasMath)}
            className={`
              p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 flex items-center justify-between mb-4 active:scale-95
              ${hasMath ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 shadow-md' : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800'}
            `}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg transition-colors ${hasMath ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-400'}`}>
                <Pi size={24} strokeWidth={3} />
              </div>
              <div>
                <p className={`font-bold transition-colors ${hasMath ? 'text-purple-700 dark:text-purple-300' : 'text-gray-600 dark:text-gray-400'}`}>
                  Maths Expert
                </p>
                <p className="text-xs text-gray-500">Pour équations complexes</p>
              </div>
            </div>
            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${hasMath ? 'border-purple-500 bg-purple-500 scale-110' : 'border-gray-300'}`}>
              {hasMath && <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-2xl flex flex-col items-center justify-center cursor-pointer border-2 border-transparent hover:border-blue-200 dark:hover:border-blue-700 transition-all active:scale-95 group">
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white mb-2 shadow-lg shadow-blue-200 dark:shadow-none group-hover:scale-110 transition-transform">
                <Camera size={24} />
              </div>
              <span className="font-semibold text-blue-900 dark:text-blue-100">Photo</span>
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
            </label>

            <label className="bg-white dark:bg-slate-800 p-6 rounded-2xl flex flex-col items-center justify-center cursor-pointer border border-gray-100 dark:border-slate-700 shadow-sm hover:border-blue-200 dark:hover:border-slate-600 transition-all active:scale-95 group">
              <div className="w-12 h-12 bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 mb-2 group-hover:scale-110 transition-transform">
                <Upload size={24} />
              </div>
              <span className="font-semibold text-gray-700 dark:text-gray-200">Importer</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </label>
          </div>
        </section>

        {/* RÉCENTS */}
        <section>
          <div className="flex justify-between items-center mb-3 h-10">
            {isSearchActive ? (
               <div className="flex-1 flex items-center bg-gray-100 dark:bg-slate-700 rounded-lg px-3 py-1 mr-2 animate-in fade-in slide-in-from-left-4 duration-200">
                 <Search size={16} className="text-gray-400 mr-2" />
                 <input 
                   autoFocus
                   type="text"
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                   className="bg-transparent border-none outline-none text-sm w-full text-gray-800 dark:text-white placeholder-gray-400"
                   placeholder="Chercher..."
                 />
                 <button onClick={() => { setIsSearchActive(false); setSearchQuery(""); }} className="text-gray-500">
                   <X size={16} />
                 </button>
               </div>
            ) : (
               <div className="flex items-center gap-2">
                 <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Récents</h2>
                 <button onClick={() => setIsSearchActive(true)} className="p-1.5 bg-gray-100 dark:bg-slate-800 rounded-full text-gray-500 hover:bg-blue-100 hover:text-blue-600 transition-colors">
                    <Search size={16} />
                 </button>
               </div>
            )}
            
            {!isSearchActive && (
               <button onClick={() => navigate('/history')} className="text-sm text-blue-600 dark:text-blue-400 font-medium hover:underline">Voir tout</button>
            )}
          </div>
          
          <div className="space-y-3">
            {filteredRecents.length === 0 ? (
                <div className="text-center py-4 text-gray-400 text-sm">Aucun résultat</div>
            ) : (
                filteredRecents.map((scan) => (
                  <div key={scan.id} className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 flex items-center gap-3 transition-colors group">
                    
                    {/* --- CORRECTION CSS BUG D'AFFICHAGE --- */}
                    {/* J'ai remplacé flex-1 par w-full et ajouté min-w-0 pour éviter l'étirement bizarre sur mobile */}
                    <div className="flex-1 min-w-0 flex items-center gap-3 cursor-pointer overflow-hidden" onClick={() => navigate(`/result/${scan.id}`)}>
                      <div className="w-12 h-12 bg-gray-800 dark:bg-slate-900 rounded-lg flex-shrink-0 flex items-center justify-center text-gray-400 text-xs font-bold">DOC</div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-gray-900 dark:text-white truncate">{scan.title}</h3>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{new Date(scan.date).toLocaleDateString()}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setEditingScan(scan); }}
                          className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors flex-shrink-0"
                        >
                          <Pencil size={18} />
                        </button>
                        <button 
                          onClick={(e) => handleDeleteClick(scan.id, e)} // <-- Appel nouvelle fonction
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex-shrink-0"
                        >
                          <Trash2 size={18} />
                        </button>
                    </div>
                  </div>
                ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default Home;