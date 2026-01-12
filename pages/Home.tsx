import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiService, ScanResult } from '../services/apiService';
import { RenameModal } from '../components/RenameModal';
import { Pencil, Camera, Upload } from 'lucide-react';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [recents, setRecents] = useState<ScanResult[]>([]);
  
  // États pour le renommage
  const [tempScan, setTempScan] = useState<ScanResult | null>(null);
  const [showPostScanModal, setShowPostScanModal] = useState(false);
  
  // État pour renommer un élément de la liste récente
  const [editingScan, setEditingScan] = useState<ScanResult | null>(null);

  const loadHistory = async () => {
    try {
      const history = await ApiService.getHistory();
      setRecents(history.slice(0, 3));
    } catch(e) { console.error(e); }
  };

  useEffect(() => { loadHistory(); }, []);

  // 1. GESTION DU SCAN
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLoading(true);
      try {
        const result = await ApiService.uploadDocument(file);
        
        // On stocke le résultat temporaire et on ouvre la modale
        setTempScan(result);
        setShowPostScanModal(true);
        
      } catch (err: any) {
        alert("Erreur : " + err.message);
        setLoading(false); // Important de reset le loading en cas d'erreur ici
      } finally {
        // Note: On laisse loading à true si ça marche, car la modale s'ouvre par dessus
        if (showPostScanModal) setLoading(false); 
      }
    }
  };

  // 2. SAUVEGARDE APRÈS SCAN (FIX CORRIGÉ : MISE À JOUR IMMÉDIATE)
  const handlePostScanSave = async (newName: string) => {
    if (tempScan) {
      try {
        // A. Mise à jour en Base de Données (si l'ID est valide / pas temp)
        if (!tempScan.id.startsWith('temp-')) {
           await ApiService.updateScanTitle(tempScan.id, newName);
        }
        
        // B. Création de l'objet FINAL avec le NOUVEAU NOM
        // C'est cet objet précis qu'on envoie à la page de résultat
        const finalScan = {
          ...tempScan,
          title: newName // On écrase l'ancien titre
        };
        
        // C. On ferme la modale
        setShowPostScanModal(false);
        setLoading(false); // On s'assure que le chargement est fini

        // D. Navigation avec le scan mis à jour
        // L'astuce "replace: true" évite de garder l'ancien état dans l'historique du navigateur
        navigate('/result', { 
          state: { scanResult: finalScan },
          replace: true 
        });
        
      } catch (error) {
        console.error("Erreur renommage:", error);
        setLoading(false);
        // Fallback
        navigate('/result', { state: { scanResult: tempScan } });
      }
    }
  };

  // Fonction pour fermer la modale sans renommer (garde le nom par défaut)
  const handleClosePostScan = () => {
    setShowPostScanModal(false);
    setLoading(false);
    if (tempScan) {
      navigate('/result', { state: { scanResult: tempScan } });
    }
  };

  // 3. RENOMMAGE LISTE RÉCENTS
  const handleRecentRename = async (newName: string) => {
    if (editingScan) {
      await ApiService.updateScanTitle(editingScan.id, newName);
      await loadHistory();
      setEditingScan(null);
    }
  };

  if (loading && !showPostScanModal) { // On cache le loading si la modale est ouverte
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col justify-center items-center p-6 transition-colors">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <h2 className="text-xl font-bold text-gray-800 dark:text-white animate-pulse">Analyse en cours...</h2>
        <p className="text-gray-500 dark:text-gray-400">L'IA déchiffre votre écriture.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-300 pb-20">
      
      {/* MODALE POST-SCAN */}
      <RenameModal 
        isOpen={showPostScanModal}
        title="Nommer votre scan"
        initialValue={tempScan?.title || "Nouveau Scan"}
        onClose={handleClosePostScan} 
        onSave={handlePostScanSave}
      />

      {/* MODALE LISTE RÉCENTS */}
      <RenameModal 
        isOpen={!!editingScan}
        initialValue={editingScan?.title || ""}
        onClose={() => setEditingScan(null)}
        onSave={handleRecentRename}
        title="Renommer le document"
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
        {/* SECTION NOUVEAU SCAN */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">Nouveau Scan</h2>
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

        {/* SECTION RÉCENTS */}
        <section>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Récents</h2>
            <button onClick={() => navigate('/history')} className="text-sm text-blue-600 dark:text-blue-400 font-medium hover:underline">Voir tout</button>
          </div>
          
          <div className="space-y-3">
            {recents.map((scan) => (
              <div 
                key={scan.id} 
                className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 flex items-center gap-3 transition-colors group"
              >
                {/* Click Zone */}
                <div 
                  className="flex-1 flex items-center gap-3 cursor-pointer overflow-hidden"
                  onClick={() => navigate(`/result/${scan.id}`)}
                >
                  <div className="w-12 h-12 bg-gray-800 dark:bg-slate-900 rounded-lg flex-shrink-0 flex items-center justify-center text-gray-400 text-xs font-bold">
                     DOC
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 dark:text-white truncate">{scan.title}</h3>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{new Date(scan.date).toLocaleDateString()}</p>
                  </div>
                </div>

                {/* Bouton Renommer */}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingScan(scan);
                  }}
                  className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors flex-shrink-0"
                >
                  <Pencil size={18} />
                </button>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

export default Home;