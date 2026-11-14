import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ApiService, ScanResult } from '../services/apiService';
import { RenameModal } from '../components/RenameModal';
import { AppModal, ModalType } from '../components/AppModal';
import { Pencil, ArrowLeft, Lock, PlayCircle, Trash2, CheckCircle, Loader2, FileText, ChevronDown, ChevronUp } from 'lucide-react';

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
  const [adLoading, setAdLoading] = useState(false);
  const [reportExpanded, setReportExpanded] = useState(false);

  // Polling pour vérifier si le DOCX est prêt
  const [docxReady, setDocxReady] = useState(false);

  const [modalConfig, setModalConfig] = useState<{isOpen: boolean, type: ModalType, title: string, message: string, onConfirm?: () => void}>({
    isOpen: false, type: 'info', title: '', message: ''
  });

  const openModal = (type: ModalType, title: string, message: string, onConfirm?: () => void) => {
    setModalConfig({ isOpen: true, type, title, message, onConfirm });
  };
  const closeModal = () => setModalConfig({ ...modalConfig, isOpen: false });

  // Chargement initial
  useEffect(() => {
    if (location.state?.scanResult) {
      setDocxReady(location.state.scanResult.docxReady || false);
      return;
    }
    const loadData = async () => {
      if (id) {
        const found = await ApiService.getScanById(id);
        if (found) {
          setScanData(found);
          setDocxReady(found.docxReady || false);
        } else {
          openModal('error', 'Introuvable', 'Ce document n\'a pas été trouvé.');
          navigate('/');
        }
        setLoading(false);
      }
    };
    loadData();
  }, [id, location.state, navigate]);

  // Polling pour le statut DOCX (toutes les 5s si pas encore prêt)
  useEffect(() => {
    if (docxReady || !scanData || scanData.id.startsWith('temp-')) return;

    const interval = setInterval(async () => {
      try {
        const updated = await ApiService.getScanById(scanData.id);
        if (updated?.docxReady) {
          setDocxReady(true);
          clearInterval(interval);
        }
      } catch {
        // Silently ignore polling errors
      }
    }, 5000);

    // Stop polling after 2 minutes
    const timeout = setTimeout(() => clearInterval(interval), 120000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [scanData, docxReady]);

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
        navigate(-1);
    });
  };

  const handleDownload = async () => {
    if (!scanData?.content) return;
    
    setAdLoading(true); 
    try {
        await ApiService.downloadWordDoc(scanData.id, scanData.content, scanData.title);
    } catch (e) {
        setAdLoading(false);
        openModal(
            'server-sleep', 
            'Serveur en réveil...', 
            "Le serveur de conversion démarre (Free Tier). Veuillez patienter quelques secondes et réessayer."
        );
    } finally {
        setAdLoading(false);
    }
  };

  const handleWatchAd = () => {
    setAdLoading(true);
    setTimeout(() => {
      setAdLoading(false);
      handleDownload();
    }, 2000); 
  };

  if (loading) return <div className="flex-1 flex flex-col items-center justify-center w-full">Chargement...</div>;
  if (!scanData) return <div className="flex-1 flex flex-col items-center justify-center text-gray-500 w-full">Erreur.</div>;

  // Préparer le contenu pour l'iframe sandboxée
  const iframeContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:16px;font-family:Inter,sans-serif;overflow:hidden;}</style></head><body>${scanData.content}</body></html>`;

  return (
    <div className="flex-1 flex flex-col w-full relative overflow-hidden">
      
      <AppModal 
        isOpen={modalConfig.isOpen} type={modalConfig.type} title={modalConfig.title} message={modalConfig.message} onConfirm={modalConfig.onConfirm} onClose={closeModal} isLoading={adLoading}
      />

      <RenameModal 
        isOpen={isRenaming} initialValue={scanData.title} onClose={() => setIsRenaming(false)} onSave={handleRename}
      />

      {/* HEADER */}
      <div className="bg-white dark:bg-slate-800 shadow-sm p-4 flex items-center justify-between sticky top-0 z-20 border-b border-gray-100 dark:border-slate-700 w-full">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-200 flex-shrink-0">
          <ArrowLeft size={24} />
        </button>
        
        <div className="flex-1 flex justify-center items-center px-2 overflow-hidden">
          <span dir="auto" className="font-bold text-lg truncate text-center text-gray-900 dark:text-white">
            {scanData.title}
          </span>
          <button onClick={() => setIsRenaming(true)} className="ml-2 p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 flex-shrink-0">
            <Pencil size={16} />
          </button>
        </div>
        
        <button onClick={handleDelete} className="p-2 -mr-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg flex-shrink-0">
            <Trash2 size={20} />
        </button>
      </div>

      {/* ZONE DE CONTENU PRINCIPALE */}
      <div className="flex-1 flex flex-col relative p-4 w-full overflow-y-auto">
        
        {/* Infos document */}
        <div className="flex flex-col items-center justify-center text-center mb-4 flex-shrink-0 w-full px-4">
          <h2 dir="auto" className="text-xl font-bold text-gray-800 dark:text-white line-clamp-2 text-center w-full break-words opacity-50">
            {scanData.title}
          </h2>
          <p className="text-sm text-gray-500 mt-1 text-center opacity-50">Aperçu du document généré</p>
          
          {/* Badges d'info */}
          <div className="flex items-center gap-2 mt-2">
            {scanData.pageCount && scanData.pageCount > 1 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 text-xs rounded-full">
                <FileText size={12} />
                {scanData.pageCount} pages
              </span>
            )}
            {docxReady ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs rounded-full">
                <CheckCircle size={12} />
                DOCX prêt
              </span>
            ) : (
              !scanData.id.startsWith('temp-') && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs rounded-full">
                  <Loader2 size={12} className="animate-spin" />
                  Conversion...
                </span>
              )
            )}
          </div>
        </div>

        {/* RAPPORT DE MODIFICATIONS */}
        {scanData.modificationReport && (
          <div className="mb-4 flex-shrink-0 w-full">
            <button 
              onClick={() => setReportExpanded(!reportExpanded)}
              className="w-full flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 px-4 py-3 rounded-xl border border-blue-100 dark:border-blue-800/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                  Rapport des modifications
                </span>
              </div>
              {reportExpanded ? (
                <ChevronUp size={16} className="text-blue-500" />
              ) : (
                <ChevronDown size={16} className="text-blue-500" />
              )}
            </button>

            {reportExpanded && (
              <div className="mt-2 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 animate-slide-up">
                <div 
                  className="text-sm text-gray-700 dark:text-gray-300 prose dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: scanData.modificationReport }}
                />
              </div>
            )}
          </div>
        )}

        {/* CONTENEUR DU DOCUMENT */}
        <div className="relative w-full h-[400px] sm:h-[60vh] bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden flex-shrink-0">
            
            {/* IFRAME SANDBOXÉE */}
            <iframe
                srcDoc={iframeContent}
                className="absolute inset-0 w-full h-full border-none filter blur-md select-none opacity-40 pointer-events-none"
                sandbox=""
                tabIndex={-1}
                title="Aperçu du document"
            />
            
            {/* OVERLAY DE VERROUILLAGE */}
            <div dir="ltr" className="absolute inset-0 flex flex-col items-center justify-center bg-white/40 dark:bg-slate-900/50 backdrop-blur-md z-10 p-4">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-2xl text-center w-full max-w-xs border border-gray-100 dark:border-slate-600 animate-slide-up">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                        {docxReady ? (
                          <CheckCircle size={32} className="text-green-500" />
                        ) : (
                          <Lock size={32} className="text-gray-400 dark:text-gray-300" />
                        )}
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 text-center">
                      {docxReady ? 'Fichier Word Prêt' : 'Conversion en cours...'}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 text-center">
                        {docxReady 
                          ? 'Regardez une courte vidéo pour débloquer et télécharger votre document éditable.'
                          : 'Le fichier Word est en cours de génération. Vous pouvez déjà débloquer le téléchargement.'
                        }
                    </p>
                    
                    <button 
                        onClick={handleWatchAd}
                        disabled={adLoading}
                        className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center"
                    >
                        {adLoading ? (
                            <span className="flex items-center gap-2">
                              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                              Chargement pub...
                            </span>
                        ) : (
                            <span className="flex items-center gap-2">
                                <PlayCircle size={20} fill="currentColor" className="text-blue-100" />
                                Débloquer (Gratuit)
                            </span>
                        )}
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Result;