import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiService, ScanResult } from '../services/apiService';
import { RenameModal } from '../components/RenameModal';
import { AppModal, ModalType } from '../components/AppModal';
import { fileStore } from '../services/fileStore';
import { useProfile } from '../context/ProfileContext';
import { getProfessionById } from '../services/professionRegistry';
import type { HomeAction } from '../types/professionTypes';
import {
  Pencil, Camera, Upload, Pi, Trash2, Search, X, Plus, ArrowRight,
  Image as ImageIcon, GraduationCap, Scale, Stethoscope, Ruler, Briefcase,
  BookOpen, School, Building2, MapPin, Building, Calculator, Car,
  FileCheck, ClipboardList, PenTool, Layers, FileText, FileSearch,
  FileLock, FileLock2, Mail, ClipboardCheck, Sparkles, ChevronRight,
  ScanLine, Wand2,
} from 'lucide-react';

// Map d'icônes Lucide par nom
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ICON_MAP: Record<string, any> = {
  Camera, Upload, GraduationCap, Scale, Stethoscope, Ruler, Briefcase,
  BookOpen, School, Building2, MapPin, Building, Calculator, Car,
  FileCheck, ClipboardList, PenTool, Layers, FileText, FileSearch,
  FileLock, FileLock2, Mail, ClipboardCheck, Sparkles,
  FileCheck2: FileCheck,
};

const getIcon = (name: string, size = 20, className = '') => {
  const Icon = ICON_MAP[name];
  return Icon ? <Icon size={size} className={className} /> : <Briefcase size={size} className={className} />;
};

const MAX_PAGES = 15;

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const [recents, setRecents] = useState<ScanResult[]>([]);

  // Multi-Upload
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  // Rename
  const [editingScan, setEditingScan] = useState<ScanResult | null>(null);

  // UI
  const [hasMath, setHasMath] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchActive, setIsSearchActive] = useState(false);

  // Modales
  const [modalConfig, setModalConfig] = useState<{isOpen: boolean, type: ModalType, title: string, message: string, onConfirm?: () => void}>({
    isOpen: false, type: 'info', title: '', message: ''
  });

  // Profession
  const profConfig = useMemo(() => {
    return profile?.profession ? getProfessionById(profile.profession) : null;
  }, [profile?.profession]);

  const loadHistory = async () => {
    try {
      const history = await ApiService.getHistory();
      setRecents(history);
    } catch(e) { console.error(e); }
  };

  useEffect(() => { loadHistory(); }, []);

  // Preview URLs
  useEffect(() => {
    previewUrls.forEach(url => URL.revokeObjectURL(url));
    const newUrls = selectedFiles.map(f => URL.createObjectURL(f));
    setPreviewUrls(newUrls);
    return () => { newUrls.forEach(url => URL.revokeObjectURL(url)); };
  }, [selectedFiles]); // eslint-disable-line react-hooks/exhaustive-deps

  // Helpers modales
  const openModal = (type: ModalType, title: string, message: string, onConfirm?: () => void) => {
    setModalConfig({ isOpen: true, type, title, message, onConfirm });
  };
  const closeModal = () => setModalConfig({ ...modalConfig, isOpen: false });

  // Filtrage
  const filteredRecents = recents
    .filter(scan => scan.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .slice(0, 3);

  // Multi-upload
  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const newFiles = Array.from(e.target.files);
    const combined = [...selectedFiles, ...newFiles];
    if (combined.length > MAX_PAGES) {
      openModal('info', 'Limite atteinte', `Vous pouvez sélectionner ${MAX_PAGES} pages maximum.`);
      setSelectedFiles(combined.slice(0, MAX_PAGES));
    } else {
      setSelectedFiles(combined);
    }
    e.target.value = '';
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleClearFiles = () => setSelectedFiles([]);

  const handleContinue = () => {
    if (selectedFiles.length === 0) return;
    fileStore.set(selectedFiles, hasMath);
    navigate('/customize');
  };

  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    openModal('delete', 'Supprimer ce document ?', 'Cette action est irréversible.', async () => {
      await ApiService.deleteScan(id);
      await loadHistory();
      closeModal();
    });
  };

  const handleRecentRename = async (newName: string) => {
    if (editingScan) {
      await ApiService.updateScanTitle(editingScan.id, newName);
      await loadHistory();
      setEditingScan(null);
    }
  };

  // Handler pour les actions métier
  const handleAction = (action: HomeAction) => {
    if (action.comingSoon) return;
    
    if (action.route) {
      navigate(action.route, { state: { actionId: action.id, scanType: action.scanType } });
    } else if (action.flowType === 'scan' && action.id === 'scan_photo') {
      // Déclencher l'input caméra
      const input = document.getElementById('home-camera-input') as HTMLInputElement;
      if (input) input.click();
    } else if (action.flowType === 'scan' && action.id === 'scan_import') {
      const input = document.getElementById('home-import-input') as HTMLInputElement;
      if (input) input.click();
    } else if (action.flowType === 'scan' && action.scanType) {
      // Scan typé (Examen, Cours, etc.) — ouvre l'import avec le type pré-marqué
      fileStore.set([], hasMath);
      // On navigue vers customize avec le type pré-sélectionné
      // Pour l'instant on ouvre l'import, le type sera géré dans Customize
      const input = document.getElementById('home-import-input') as HTMLInputElement;
      if (input) input.click();
    } else if (action.flowType === 'creation') {
      // TODO Phase 2/3 : navigate vers /create-flow avec le type
      openModal('info', 'Bientôt disponible', `La création de "${action.label}" arrive très bientôt !`);
    }
  };

  // Salutation
  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Bonjour';
    if (h < 18) return 'Bon après-midi';
    return 'Bonsoir';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-300">

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
        isOpen={!!editingScan}
        initialValue={editingScan?.title || ""}
        onClose={() => setEditingScan(null)}
        onSave={handleRecentRename}
        title="Renommer"
      />

      {/* Inputs cachés pour caméra/import */}
      <input id="home-camera-input" type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFilesSelected} />
      <input id="home-import-input" type="file" accept="image/*" multiple className="hidden" onChange={handleFilesSelected} />

      {/* HEADER */}
      <header className="bg-white dark:bg-slate-800 px-4 py-4 shadow-sm sticky top-0 z-10 transition-colors border-b border-gray-100 dark:border-slate-700">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{greeting()},</p>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {profile?.displayName || 'Utilisateur'}
            </h1>
            {profConfig && (
              <p className="text-xs font-medium mt-0.5" style={{ color: profConfig.color }}>
                {profConfig.labelShort}
              </p>
            )}
          </div>
          <button onClick={() => navigate('/profile')} className="w-10 h-10 bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-200 transition-colors hover:bg-gray-200 dark:hover:bg-slate-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
          </button>
        </div>
      </header>

      <main className="p-4 space-y-6 pb-24">

        {/* ═══ SECTION SCAN ═══ */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <ScanLine size={18} className="text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-bold text-gray-800 dark:text-white">Scan</h2>
          </div>

          {/* Boutons primaires : Photo + Import (toujours visibles) */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <label className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-2xl flex flex-col items-center justify-center cursor-pointer border-2 border-transparent hover:border-blue-200 dark:hover:border-blue-700 transition-all active:scale-95 group">
              <div className="w-11 h-11 bg-blue-600 rounded-full flex items-center justify-center text-white mb-2 shadow-lg shadow-blue-200 dark:shadow-none group-hover:scale-110 transition-transform">
                <Camera size={22} />
              </div>
              <span className="font-semibold text-sm text-blue-900 dark:text-blue-100">Photo</span>
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFilesSelected} />
            </label>

            <label className="bg-white dark:bg-slate-800 p-5 rounded-2xl flex flex-col items-center justify-center cursor-pointer border border-gray-100 dark:border-slate-700 shadow-sm hover:border-blue-200 dark:hover:border-slate-600 transition-all active:scale-95 group">
              <div className="w-11 h-11 bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 mb-2 group-hover:scale-110 transition-transform">
                <Upload size={22} />
              </div>
              <span className="font-semibold text-sm text-gray-700 dark:text-gray-200">Importer</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleFilesSelected} />
            </label>
          </div>

          {/* Actions scan spécifiques au métier */}
          {profConfig && profConfig.scanActions.filter(a => !['scan_photo', 'scan_import'].includes(a.id)).length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none">
              {profConfig.scanActions
                .filter(a => !['scan_photo', 'scan_import'].includes(a.id))
                .map(action => (
                  <button
                    key={action.id}
                    onClick={() => handleAction(action)}
                    className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl hover:border-blue-300 dark:hover:border-blue-600 transition-all active:scale-95 shadow-sm"
                  >
                    <span style={{ color: profConfig.color }}>
                      {getIcon(action.icon, 16)}
                    </span>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      {action.label}
                    </span>
                  </button>
                ))
              }
            </div>
          )}

          {/* Toggle Maths */}
          <div
            onClick={() => setHasMath(!hasMath)}
            className={`mt-3 p-3 rounded-xl border-2 cursor-pointer transition-all duration-300 flex items-center justify-between active:scale-[0.97] ${
              hasMath ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg transition-colors ${hasMath ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-400'}`}>
                <Pi size={20} strokeWidth={3} />
              </div>
              <div>
                <p className={`font-bold text-sm transition-colors ${hasMath ? 'text-purple-700 dark:text-purple-300' : 'text-gray-600 dark:text-gray-400'}`}>
                  Maths Expert
                </p>
                <p className="text-xs text-gray-500">Équations complexes</p>
              </div>
            </div>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${hasMath ? 'border-purple-500 bg-purple-500' : 'border-gray-300'}`}>
              {hasMath && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
            </div>
          </div>

          {/* Grille d'aperçu */}
          {selectedFiles.length > 0 && (
            <div className="mt-4 animate-slide-up">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ImageIcon size={16} className="text-gray-500 dark:text-gray-400" />
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {selectedFiles.length}/{MAX_PAGES} page{selectedFiles.length > 1 ? 's' : ''}
                  </span>
                </div>
                <button onClick={handleClearFiles} className="text-xs text-red-500 hover:text-red-600 font-medium flex items-center gap-1">
                  <Trash2 size={12} /> Tout supprimer
                </button>
              </div>

              <div className="grid grid-cols-5 gap-2 mb-4">
                {previewUrls.map((url, i) => (
                  <div key={i} className="relative aspect-[3/4] rounded-lg overflow-hidden bg-gray-200 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 group">
                    <img src={url} alt={`Page ${i + 1}`} className="w-full h-full object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1">
                      <span className="text-[10px] text-white font-bold">{i + 1}</span>
                    </div>
                    <button onClick={() => handleRemoveFile(i)} className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                      <X size={12} className="text-white" />
                    </button>
                  </div>
                ))}
                {selectedFiles.length < MAX_PAGES && (
                  <label className="aspect-[3/4] rounded-lg border-2 border-dashed border-gray-300 dark:border-slate-600 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 transition-colors">
                    <Plus size={20} className="text-gray-400" />
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleFilesSelected} />
                  </label>
                )}
              </div>

              <div className="w-full h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden mb-4">
                <div className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500" style={{ width: `${(selectedFiles.length / MAX_PAGES) * 100}%` }} />
              </div>

              <button onClick={handleContinue} className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-500/25 transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                Continuer <ArrowRight size={18} />
              </button>
            </div>
          )}
        </section>

        {/* ═══ SECTION CRÉATION ═══ */}
        {profConfig && profConfig.creationActions.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Wand2 size={18} className="text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-lg font-bold text-gray-800 dark:text-white">Création</h2>
            </div>

            <div className="space-y-2">
              {profConfig.creationActions.map(action => (
                <button
                  key={action.id}
                  onClick={() => handleAction(action)}
                  className="w-full bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm flex items-center gap-3 hover:shadow-md hover:border-gray-200 dark:hover:border-slate-600 transition-all active:scale-[0.98] group text-left"
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110"
                    style={{ backgroundColor: `${profConfig.color}15`, color: profConfig.color }}
                  >
                    {getIcon(action.icon, 20)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 dark:text-white text-sm">{action.label}</p>
                    {action.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{action.description}</p>
                    )}
                  </div>
                  <ChevronRight size={16} className="text-gray-300 dark:text-gray-600 group-hover:text-gray-400 transition-colors flex-shrink-0" />
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ═══ RÉCENTS ═══ */}
        <section>
          <div className="flex justify-between items-center mb-3 h-10">
            {isSearchActive ? (
               <div className="flex-1 flex items-center bg-gray-100 dark:bg-slate-700 rounded-lg px-3 py-1 mr-2">
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
                 <h2 className="text-lg font-bold text-gray-800 dark:text-white">Récents</h2>
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
                    <div className="flex-1 min-w-0 flex items-center gap-3 cursor-pointer overflow-hidden" onClick={() => navigate(`/result/${scan.id}`)}>
                      <div className="w-12 h-12 bg-gray-800 dark:bg-slate-900 rounded-lg flex-shrink-0 flex items-center justify-center text-gray-400 text-xs font-bold">
                        {scan.pageCount && scan.pageCount > 1 ? `${scan.pageCount}p` : 'DOC'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-gray-900 dark:text-white truncate">{scan.title}</h3>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-gray-400">{new Date(scan.date).toLocaleDateString()}</p>
                          {scan.docxReady && <span className="w-2 h-2 bg-green-500 rounded-full" title="DOCX prêt" />}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <button onClick={(e) => { e.stopPropagation(); setEditingScan(scan); }} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors flex-shrink-0">
                          <Pencil size={18} />
                        </button>
                        <button onClick={(e) => handleDeleteClick(scan.id, e)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex-shrink-0">
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