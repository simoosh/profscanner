import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiService, ScanResult } from '../services/apiService';
import { RenameModal } from '../components/RenameModal';
import { AppModal, ModalType } from '../components/AppModal';
import { fileStore } from '../services/fileStore';
import { 
  ArrowLeft, 
  Sparkles, 
  SpellCheck, 
  PenLine, 
  Calculator, 
  ListChecks,
  Languages, 
  FileText, 
  Send, 
  X, 
  Image as ImageIcon,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface ChipOption {
  id: string;
  label: string;
  icon: React.ReactNode;
  prompt: string;
}

const CHIP_OPTIONS: ChipOption[] = [
  {
    id: 'spelling',
    label: 'Corriger l\'orthographe',
    icon: <SpellCheck size={16} />,
    prompt: 'Corrige toutes les fautes d\'orthographe et de grammaire s\'il y en a.',
  },
  {
    id: 'professional',
    label: 'Reformuler pro',
    icon: <PenLine size={16} />,
    prompt: 'Reformule le texte de manière professionnelle et académique tout en gardant le même sens.',
  },
  {
    id: 'solve',
    label: 'Vérifier les calculs',
    icon: <Calculator size={16} />,
    prompt: 'Résous l\'exercice étape par étape pour vérifier qu\'il n\'y a pas d\'erreur dans les données ou les calculs.',
  },
  {
    id: 'steps',
    label: 'Ajouter les étapes',
    icon: <ListChecks size={16} />,
    prompt: 'Ajoute les étapes de résolution manquantes pour que le raisonnement soit complet.',
  },
  {
    id: 'translate',
    label: 'Traduire en français',
    icon: <Languages size={16} />,
    prompt: 'Traduis le contenu en français si ce n\'est pas déjà le cas.',
  },
  {
    id: 'summarize',
    label: 'Résumer le contenu',
    icon: <FileText size={16} />,
    prompt: 'Ajoute un résumé concis du contenu à la fin du document.',
  },
];

const Customize: React.FC = () => {
  const navigate = useNavigate();

  // Récupérer les données depuis le fileStore (pas de navigate state)
  const storeData = useRef(fileStore.get());
  const files: File[] = storeData.current.files;
  const hasMath: boolean = storeData.current.hasMath;

  const [selectedChips, setSelectedChips] = useState<Set<string>>(new Set());
  const [customText, setCustomText] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  // Modales
  const [tempScan, setTempScan] = useState<ScanResult | null>(null);
  const [showPostScanModal, setShowPostScanModal] = useState(false);
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    type: ModalType;
    title: string;
    message: string;
    onConfirm?: () => void;
  }>({
    isOpen: false,
    type: 'info',
    title: '',
    message: '',
  });

  const openModal = (type: ModalType, title: string, message: string, onConfirm?: () => void) => {
    setModalConfig({ isOpen: true, type, title, message, onConfirm });
  };
  const closeModal = () => setModalConfig({ ...modalConfig, isOpen: false });

  // Rediriger si pas de fichiers
  useEffect(() => {
    if (files.length === 0) {
      navigate('/', { replace: true });
      return;
    }

    // Générer les aperçus
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviewUrls(urls);

    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Construire le prompt personnalisé
  const customPrompt = useMemo(() => {
    const parts: string[] = [];
    selectedChips.forEach((chipId) => {
      const chip = CHIP_OPTIONS.find((c) => c.id === chipId);
      if (chip) parts.push(chip.prompt);
    });
    if (customText.trim()) parts.push(customText.trim());
    return parts.join('\n');
  }, [selectedChips, customText]);

  const hasCustomizations = selectedChips.size > 0 || customText.trim().length > 0;

  const toggleChip = (chipId: string) => {
    setSelectedChips((prev) => {
      const next = new Set(prev);
      if (next.has(chipId)) {
        next.delete(chipId);
      } else {
        next.add(chipId);
      }
      return next;
    });
  };

  // Messages de chargement progressifs (ne bouclent PAS)
  const loadingMessages = [
    'Analyse des pages en cours...',
    'L\'IA déchiffre votre écriture...',
    'Transcription du contenu...',
    'Mise en forme du document...',
    'Cela peut prendre quelques minutes...',
    'Patientez encore un peu...',
    'Vous y êtes presque...',
    'L\'IA peaufine les détails...',
    'Encore un instant...',
  ];

  const handleLaunchScan = async () => {
    setLoading(true);
    setLoadingMessage(loadingMessages[0]);

    // Messages progressifs (pas de boucle, on avance seulement)
    let msgIndex = 0;
    const msgInterval = setInterval(() => {
      msgIndex++;
      if (msgIndex < loadingMessages.length) {
        setLoadingMessage(loadingMessages[msgIndex]);
      }
      // Reste sur le dernier message au lieu de boucler
    }, 5000);

    try {
      const result = await ApiService.uploadMultipleDocuments(files, hasMath, customPrompt);
      clearInterval(msgInterval);
      setTempScan(result);
      setShowPostScanModal(true);
    } catch (err: any) {
      clearInterval(msgInterval);
      setLoading(false);
      // Message d'erreur court et clair
      const rawMsg = err.message || "";
      let friendlyMsg = "Une erreur est survenue lors de l'analyse.";
      if (rawMsg.includes('blocked') || rawMsg.includes('403')) {
        friendlyMsg = "L'accès à l'IA est temporairement bloqué. Réessayez dans quelques instants.";
      } else if (rawMsg.includes('illisible')) {
        friendlyMsg = "L'image est illisible. Essayez avec une photo plus nette.";
      } else if (rawMsg.includes('timeout') || rawMsg.includes('timed out')) {
        friendlyMsg = "Le document est trop complexe. Essayez avec moins de pages.";
      }
      openModal('error', 'Oups...', friendlyMsg);
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
      } catch {
        navigate('/result', { state: { scanResult: tempScan } });
      }
    }
  };

  const handleClosePostScan = () => {
    setShowPostScanModal(false);
    setLoading(false);
    if (tempScan) navigate('/result', { state: { scanResult: tempScan } });
  };

  // Écran de chargement
  if (loading && !showPostScanModal) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col justify-center items-center p-6 transition-colors">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-6"></div>
        <h2 key={loadingMessage} className="text-xl font-bold text-gray-800 dark:text-white text-center mb-2 animate-text-fade">
          {loadingMessage}
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-center text-sm">
          {files.length} page{files.length > 1 ? 's' : ''} en cours de traitement
          {hasCustomizations && '\navec personnalisations'}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-300 flex flex-col">
      
      {/* MODALES */}
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
        initialValue={tempScan?.title || 'Nouveau Scan'}
        onClose={handleClosePostScan}
        onSave={handlePostScanSave}
      />

      {/* HEADER */}
      <header className="bg-white dark:bg-slate-800 p-4 flex items-center gap-3 shadow-sm sticky top-0 z-10 transition-colors border-b border-gray-100 dark:border-slate-700">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-200 flex-shrink-0"
        >
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Personnalisation</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {files.length} page{files.length > 1 ? 's' : ''} sélectionnée{files.length > 1 ? 's' : ''}
          </p>
        </div>
      </header>

      <main className="flex-1 p-4 space-y-5 pb-32">
        
        {/* APERÇU DES PAGES */}
        <section>
          <button 
            onClick={() => setPreviewExpanded(!previewExpanded)}
            className="w-full flex items-center justify-between mb-3"
          >
            <div className="flex items-center gap-2">
              <ImageIcon size={18} className="text-gray-500 dark:text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Aperçu des pages
              </h2>
            </div>
            {previewExpanded ? (
              <ChevronUp size={18} className="text-gray-400" />
            ) : (
              <ChevronDown size={18} className="text-gray-400" />
            )}
          </button>
          
          {previewExpanded && (
            <div className="grid grid-cols-4 gap-2 animate-slide-up">
              {previewUrls.map((url, i) => (
                <div
                  key={i}
                  className="aspect-[3/4] rounded-lg overflow-hidden bg-gray-200 dark:bg-slate-700 border border-gray-200 dark:border-slate-600"
                >
                  <img
                    src={url}
                    alt={`Page ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* SUGGESTIONS RAPIDES */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={18} className="text-blue-500" />
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Modifications suggérées
            </h2>
          </div>

          <div className="flex flex-wrap gap-2">
            {CHIP_OPTIONS.map((chip) => {
              const isSelected = selectedChips.has(chip.id);
              return (
                <button
                  key={chip.id}
                  onClick={() => toggleChip(chip.id)}
                  className={`
                    inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium
                    transition-all duration-200 active:scale-95 border
                    ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-600 shadow-sm'
                        : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500'
                    }
                  `}
                >
                  {chip.icon}
                  <span>{chip.label}</span>
                  {isSelected && (
                    <X size={14} className="ml-0.5 text-blue-400" />
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* CHAMP TEXTE LIBRE */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <PenLine size={18} className="text-purple-500" />
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Instructions supplémentaires
            </h2>
          </div>

          <textarea
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="Décrivez les modifications que vous souhaitez apporter au document..."
            rows={4}
            className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl p-4 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />

          {customText.length > 0 && (
            <p className="text-xs text-gray-400 mt-1 text-right">
              {customText.length} caractère{customText.length > 1 ? 's' : ''}
            </p>
          )}
        </section>

        {/* RÉSUMÉ DES PERSONNALISATIONS */}
        {hasCustomizations && (
          <section className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-800/30">
            <div className="flex items-center gap-2 mb-2">
              <ListChecks size={16} className="text-blue-600 dark:text-blue-400" />
              <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                Personnalisations actives
              </h3>
            </div>
            <ul className="space-y-1">
              {Array.from(selectedChips).map((chipId) => {
                const chip = CHIP_OPTIONS.find((c) => c.id === chipId);
                return chip ? (
                  <li key={chipId} className="text-xs text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-blue-500 flex-shrink-0" />
                    {chip.label}
                  </li>
                ) : null;
              })}
              {customText.trim() && (
                <li className="text-xs text-blue-700 dark:text-blue-400 flex items-start gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
                  <span className="line-clamp-2">{customText.trim()}</span>
                </li>
              )}
            </ul>
            <p className="text-xs text-blue-500 dark:text-blue-400/60 mt-2">
              Un rapport détaillé des modifications sera généré avec votre document.
            </p>
          </section>
        )}
      </main>

      {/* BOUTON FIXE EN BAS */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg border-t border-gray-100 dark:border-slate-700 z-20">
        <button
          onClick={handleLaunchScan}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-500/25 transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-base"
        >
          <Send size={20} />
          Lancer l'analyse
          {hasCustomizations && (
            <span className="bg-white/20 text-white text-xs font-semibold px-2 py-0.5 rounded-full ml-1">
              + personnalisations
            </span>
          )}
        </button>
      </div>
    </div>
  );
};

export default Customize;
