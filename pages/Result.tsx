import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ApiService, ScanResult, formatDuration } from '../services/apiService';
import { RenameModal } from '../components/RenameModal';
import { AppModal, ModalType } from '../components/AppModal';
import { Pencil, ArrowLeft, Trash2, Loader2, FileText, ChevronDown, ChevronUp, Download } from 'lucide-react';

/** Wraps AI-generated HTML for a sandboxed iframe (no scripts, isolated styles). */
const sandboxDocument = (html: string, extraCss = '') =>
  `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:16px;font-family:Calibri,Arial,sans-serif;}${extraCss}</style></head><body>${html}</body></html>`;

const Result: React.FC = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [scanData, setScanData] = useState<ScanResult | null>(() => location.state?.scanResult ?? null);
  const [loading, setLoading] = useState(!location.state?.scanResult);
  const [isRenaming, setIsRenaming] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [reportExpanded, setReportExpanded] = useState(false);

  const [modalConfig, setModalConfig] = useState<{ isOpen: boolean; type: ModalType; title: string; message: string; onConfirm?: () => void }>({
    isOpen: false, type: 'info', title: '', message: '',
  });

  const openModal = (type: ModalType, title: string, message: string, onConfirm?: () => void) => {
    setModalConfig({ isOpen: true, type, title, message, onConfirm });
  };
  const closeModal = () => setModalConfig({ ...modalConfig, isOpen: false });

  useEffect(() => {
    if (location.state?.scanResult || !id) return;
    ApiService.getScanById(id).then((found) => {
      if (found) {
        setScanData(found);
      } else {
        openModal('error', 'Introuvable', "Ce document n'a pas été trouvé.");
        navigate('/');
      }
      setLoading(false);
    });
  }, [id, location.state, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRename = async (newName: string) => {
    if (!scanData) return;
    await ApiService.updateScanTitle(scanData.id, newName);
    setScanData({ ...scanData, title: newName });
  };

  const handleDelete = () => {
    if (!scanData) return;
    openModal('delete', 'Supprimer le scan ?', 'Ce document sera définitivement effacé de cet appareil.', async () => {
      await ApiService.deleteScan(scanData.id);
      navigate(-1);
    });
  };

  const handleDownload = async () => {
    if (!scanData?.content) return;
    setDownloading(true);
    try {
      await ApiService.downloadWordDoc(scanData.id, scanData.content, scanData.title);
    } catch (e: any) {
      console.error('Erreur génération DOCX:', e);
      openModal('error', 'Export impossible', `Le fichier Word n'a pas pu être généré. ${e?.message || ''}`.trim());
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <div className="flex-1 flex flex-col items-center justify-center w-full">Chargement...</div>;
  if (!scanData) return <div className="flex-1 flex flex-col items-center justify-center text-gray-500 w-full">Erreur.</div>;

  return (
    <div className="flex-1 flex flex-col w-full relative overflow-hidden">
      <AppModal
        isOpen={modalConfig.isOpen} type={modalConfig.type} title={modalConfig.title} message={modalConfig.message} onConfirm={modalConfig.onConfirm} onClose={closeModal}
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

      {/* CONTENU */}
      <div className="flex-1 flex flex-col relative p-4 w-full overflow-y-auto">
        {/* Infos document */}
        <div className="flex items-center justify-center gap-2 mb-4 flex-shrink-0">
          <p className="text-sm text-gray-500">
            Aperçu de la transcription
            {scanData.model ? ` · ${scanData.model}` : ''}
            {scanData.durationMs ? ` · ${formatDuration(scanData.durationMs)}` : ''}
          </p>
          {scanData.pageCount && scanData.pageCount > 1 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 text-xs rounded-full">
              <FileText size={12} />
              {scanData.pageCount} pages
            </span>
          )}
        </div>

        {/* RAPPORT DE MODIFICATIONS (HTML généré par l'IA → iframe sandboxée) */}
        {scanData.modificationReport && (
          <div className="mb-4 flex-shrink-0 w-full">
            <button
              onClick={() => setReportExpanded(!reportExpanded)}
              className="w-full flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 px-4 py-3 rounded-xl border border-blue-100 dark:border-blue-800/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-semibold text-blue-800 dark:text-blue-300">Rapport des modifications</span>
              </div>
              {reportExpanded ? <ChevronUp size={16} className="text-blue-500" /> : <ChevronDown size={16} className="text-blue-500" />}
            </button>

            {reportExpanded && (
              <iframe
                srcDoc={sandboxDocument(scanData.modificationReport, 'body{font-size:14px;}')}
                sandbox=""
                title="Rapport des modifications"
                className="mt-2 w-full h-60 bg-white rounded-xl border border-gray-200 dark:border-slate-700"
              />
            )}
          </div>
        )}

        {/* APERÇU DU DOCUMENT */}
        <div className="relative w-full h-[400px] sm:h-[60vh] bg-white rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden flex-shrink-0">
          <iframe
            srcDoc={sandboxDocument(scanData.content)}
            className="absolute inset-0 w-full h-full border-none"
            sandbox=""
            title="Aperçu du document"
          />
        </div>

        {/* TÉLÉCHARGEMENT */}
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="mt-4 w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 disabled:opacity-70 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 flex-shrink-0"
        >
          {downloading ? (
            <><Loader2 size={20} className="animate-spin" /> Génération du fichier Word…</>
          ) : (
            <><Download size={20} /> Télécharger le fichier Word</>
          )}
        </button>
        <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-2 flex-shrink-0">
          Généré sur votre appareil · équations éditables dans Word
        </p>
      </div>
    </div>
  );
};

export default Result;
