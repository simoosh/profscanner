import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ApiService, ScanResult } from '../services/apiService';
import { RenameModal } from '../components/RenameModal';
import { Pencil, Copy, Share2, FileDown, ArrowLeft } from 'lucide-react';

const Result: React.FC = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  // --- CORRECTION MAJEURE ICI ---
  // On initialise l'état DIRECTEMENT avec les données reçues de Home (si elles existent).
  // Cela garantit que le titre modifié s'affiche INSTANTANÉMENT sans attendre.
  const [scanData, setScanData] = useState<ScanResult | null>(() => {
    if (location.state?.scanResult) {
      return location.state.scanResult;
    }
    return null;
  });

  const [loading, setLoading] = useState(!location.state?.scanResult); // Si on a déjà les données, pas de chargement
  const [copyFeedback, setCopyFeedback] = useState("Copier");
  const [isRenaming, setIsRenaming] = useState(false);

  useEffect(() => {
    // Si on a déjà les données via la navigation (Cas du renommage récent), on ne fait rien de plus.
    if (location.state?.scanResult) return;

    // Sinon (Cas accès via Historique ou URL directe), on charge depuis l'API
    const loadData = async () => {
      if (id) {
        const found = await ApiService.getScanById(id);
        if (found) {
          setScanData(found);
        } else {
          alert("Document introuvable");
          navigate('/');
        }
        setLoading(false);
      }
    };
    loadData();
  }, [id, location.state, navigate]);

  const handleRename = async (newName: string) => {
    if (scanData) {
      // 1. Mise à jour Backend (si ce n'est pas un scan temporaire)
      if (!scanData.id.startsWith('temp-')) {
        await ApiService.updateScanTitle(scanData.id, newName);
      }
      // 2. Mise à jour Frontend immédiate
      setScanData({ ...scanData, title: newName });
    }
  };

  const handleCopy = () => {
    if (scanData?.content) {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = scanData.content;
      const text = tempDiv.textContent || tempDiv.innerText || "";
      
      navigator.clipboard.writeText(text).then(() => {
        setCopyFeedback("Copié !");
        setTimeout(() => setCopyFeedback("Copier"), 2000);
      });
    }
  };

  const handleDownload = () => {
    if (!scanData?.content) return;
    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export HTML To Doc</title></head><body>";
    const footer = "</body></html>";
    const sourceHTML = header + scanData.content + footer;
    const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
    const fileDownload = document.createElement("a");
    document.body.appendChild(fileDownload);
    fileDownload.href = source;
    fileDownload.download = `${scanData.title}.doc`;
    fileDownload.click();
    document.body.removeChild(fileDownload);
  };

  const handleShare = async () => {
    if (!scanData) return;
    if (navigator.share) {
      try {
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = scanData.content;
        const text = tempDiv.textContent || "";
        await navigator.share({
          title: scanData.title,
          text: text.substring(0, 2000),
        });
      } catch (err) { console.log("Partage annulé"); }
    } else {
      alert("Sur PC, utilisez le bouton 'Word' pour récupérer le fichier.");
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 text-gray-500 dark:text-gray-400">Chargement...</div>;
  if (!scanData) return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 text-gray-500 dark:text-gray-400">Erreur.</div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-32 transition-colors duration-300">
      
      <RenameModal 
        isOpen={isRenaming}
        initialValue={scanData.title}
        onClose={() => setIsRenaming(false)}
        onSave={handleRename}
      />

      {/* Header */}
      <div className="bg-white dark:bg-slate-800 shadow-sm p-4 flex items-center gap-3 sticky top-0 z-10 border-b border-gray-100 dark:border-slate-700 transition-colors">
        <button 
          onClick={() => navigate('/')} 
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-gray-600 dark:text-gray-200"
        >
          <ArrowLeft size={24} />
        </button>
        
        <div className="flex-1 flex items-center gap-2 overflow-hidden">
          <h1 className="font-bold text-lg truncate text-gray-900 dark:text-white transition-colors">{scanData.title}</h1>
          <button 
            onClick={() => setIsRenaming(true)}
            className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          >
            <Pencil size={16} />
          </button>
        </div>
      </div>

      {/* Contenu */}
      <div className="p-4 max-w-3xl mx-auto">
        <div 
          className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-sm min-h-[60vh] border border-gray-100 dark:border-slate-700 text-gray-800 dark:text-gray-200 break-words transition-colors [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-4 [&_h1]:text-gray-900 [&_h1]:dark:text-white"
          dangerouslySetInnerHTML={{ __html: scanData.content }} 
        />
      </div>

      {/* Barre d'actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 p-3 flex gap-2 shadow-lg z-20 transition-colors">
        <button onClick={handleCopy} className="flex-1 py-3 bg-gray-100 dark:bg-slate-700 active:bg-gray-200 dark:active:bg-slate-600 rounded-xl font-semibold text-gray-700 dark:text-gray-200 text-sm flex flex-col items-center justify-center gap-1 transition-colors">
          <Copy size={20} />
          {copyFeedback}
        </button>
        <button onClick={handleShare} className="flex-1 py-3 bg-gray-100 dark:bg-slate-700 active:bg-gray-200 dark:active:bg-slate-600 rounded-xl font-semibold text-gray-700 dark:text-gray-200 text-sm flex flex-col items-center justify-center gap-1 transition-colors">
          <Share2 size={20} />
          Partager
        </button>
        <button onClick={handleDownload} className="flex-[1.5] py-3 bg-blue-600 active:bg-blue-700 rounded-xl font-semibold text-white text-sm flex flex-col items-center justify-center gap-1 shadow-lg shadow-blue-600/20 transition-all">
          <FileDown size={20} />
          Word
        </button>
      </div>
    </div>
  );
};

export default Result;