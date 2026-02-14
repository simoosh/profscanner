import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ApiService, ScanResult } from '../services/apiService';
import { RenameModal } from '../components/RenameModal';
import { AppModal, ModalType } from '../components/AppModal'; // <--- NOUVEAU
import { Pencil, ArrowLeft, Lock, PlayCircle, Trash2 } from 'lucide-react';

const Result: React.FC = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [scanData, setScanData] = useState<ScanResult | null>(() => {
    if (location.state?.scanResult) return location.state.scanResult;
    return null;
  });

  const [loading, setLoading] = useState(!location.state?.scanResult);
  const [isRenaming, setIsRenaming] = useState(false);
  
  const [_isUnlocked, setIsUnlocked] = useState(false);
  const [adLoading, setAdLoading] = useState(false);

  // État Modale
  const [modalConfig, setModalConfig] = useState<{isOpen: boolean, type: ModalType, title: string, message: string, onConfirm?: () => void}>({
    isOpen: false, type: 'info', title: '', message: ''
  });

  const openModal = (type: ModalType, title: string, message: string, onConfirm?: () => void) => {
    setModalConfig({ isOpen: true, type, title, message, onConfirm });
  };
  const closeModal = () => setModalConfig({ ...modalConfig, isOpen: false });


  useEffect(() => {
    if (location.state?.scanResult) return;
    const loadData = async () => {
      if (id) {
        const found = await ApiService.getScanById(id);
        if (found) { setScanData(found); } 
        else { alert("Document introuvable"); navigate('/'); }
        setLoading(false);
      }
    };
    loadData();
  }, [id, location.state, navigate]);

  const handleRename = async (newName: string) => {
    if (scanData && !scanData.id.startsWith('temp-')) {
      await ApiService.updateScanTitle(scanData.id, newName);
    }
    if (scanData) setScanData({ ...scanData, title: newName });
  };

  const handleDelete = () => {
    if(!scanData) return;
    openModal('delete', 'Supprimer le scan ?', 'Ce document sera définitivement effacé.', async () => {
        if (!scanData.id.startsWith('temp-')) {
            await ApiService.deleteScan(scanData.id);
        }
        navigate('/');
    });
  };

  const handleDownload = async () => {
    if (!scanData?.content) return;
    
    // Mode Maths Expert (Backend Render)
    if (scanData.hasMath === true) {
        setAdLoading(true); 
        try {
            await ApiService.downloadWordDoc(scanData.content, scanData.title);
        } catch (e) {
            // --- POPUP SERVEUR SLEEP ---
            setAdLoading(false);
            openModal(
                'server-sleep', 
                'Serveur en réveil...', 
                "Le serveur de conversion démarre (Free Tier). Veuillez patienter 30 secondes et réessayer."
            );
        } finally {
            setAdLoading(false);
        }
    } else {
        // Mode Standard
        const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export</title></head><body>";
        const footer = "</body></html>";
        const sourceHTML = header + scanData.content + footer;
        const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
        const fileDownload = document.createElement("a");
        document.body.appendChild(fileDownload);
        fileDownload.href = source;
        fileDownload.download = `${scanData.title}.doc`;
        fileDownload.click();
        document.body.removeChild(fileDownload);
    }
  };

  const handleWatchAd = () => {
    setAdLoading(true);
    setTimeout(() => {
      setAdLoading(false);
      setIsUnlocked(true);
      handleDownload();
    }, 2000);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 text-blue-600">Chargement...</div>;
  if (!scanData) return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 text-gray-500">Erreur.</div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-32 transition-colors duration-300">
      
      <AppModal 
        isOpen={modalConfig.isOpen}
        type={modalConfig.type}
        title={modalConfig.title}
        message={modalConfig.message}
        onConfirm={modalConfig.onConfirm}
        onClose={closeModal}
        isLoading={adLoading} // Juste pour réutiliser le style
      />

      <RenameModal 
        isOpen={isRenaming}
        initialValue={scanData.title}
        onClose={() => setIsRenaming(false)}
        onSave={handleRename}
      />

      {/* Header */}
      <div className="bg-white dark:bg-slate-800 shadow-sm p-4 flex items-center gap-3 sticky top-0 z-10 border-b border-gray-100 dark:border-slate-700 transition-colors">
        <button onClick={() => navigate('/')} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-gray-600 dark:text-gray-200">
          <ArrowLeft size={24} />
        </button>
        <div className="flex-1 flex items-center gap-2 overflow-hidden">
          <h1 className="font-bold text-lg truncate text-gray-900 dark:text-white transition-colors">{scanData.title}</h1>
          <button onClick={() => setIsRenaming(true)} className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
            <Pencil size={16} />
          </button>
        </div>
        
        {/* BOUTON SUPPRIMER HEADER */}
        <button 
            onClick={handleDelete}
            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
        >
            <Trash2 size={20} />
        </button>
      </div>

      {/* Contenu */}
      <div className="relative p-4 max-w-3xl mx-auto min-h-[60vh] flex flex-col">
        <div className="text-center mb-6 opacity-50">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{scanData.title}</h2>
          <p className="text-sm text-gray-500">Aperçu du document généré</p>
        </div>

        <div className="relative flex-1 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
            <div 
                className="p-8 prose lg:prose-xl dark:prose-invert max-w-none filter blur-md select-none opacity-50"
                dangerouslySetInnerHTML={{ __html: scanData.content }}
            />
            
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/30 dark:bg-slate-900/40 backdrop-blur-sm z-10">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-2xl text-center max-w-xs mx-4 border border-gray-100 dark:border-slate-600">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Lock size={32} className="text-gray-400 dark:text-gray-300" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Fichier Word Prêt</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                        Regardez une courte vidéo pour débloquer et télécharger.
                    </p>
                    <button 
                        onClick={handleWatchAd}
                        disabled={adLoading}
                        className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-bold py-3 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                        {adLoading ? "Chargement..." : <><PlayCircle size={20} /> Débloquer (Gratuit)</>}
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Result;