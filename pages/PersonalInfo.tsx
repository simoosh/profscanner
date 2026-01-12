import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiService } from '../services/apiService';
import { Eye, EyeOff, Copy, Check, ShieldCheck, Mail, FileText, Star } from 'lucide-react';

const PersonalInfo: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // États
  const [scanCount, setScanCount] = useState<number | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Simulation du mot de passe (Firebase ne le renvoie jamais pour sécurité)
  const hiddenPassword = "••••••••••••";
  
  // Chargement des stats réelles
  useEffect(() => {
    const loadStats = async () => {
      try {
        const history = await ApiService.getHistory();
        setScanCount(history.length);
      } catch (e) {
        console.error("Erreur chargement stats", e);
        setScanCount(0);
      }
    };
    loadStats();
  }, []);

  // Fonction Copier
  const handleCopyPassword = () => {
    // Ici on ne peut copier que le placeholder car le vrai mdp est crypté chez Google
    navigator.clipboard.writeText("Mot de passe masqué"); 
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-300 pb-20">
      
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 p-4 shadow-sm flex items-center gap-3 sticky top-0 z-10 transition-colors border-b dark:border-slate-700">
        <button 
          onClick={() => navigate(-1)} 
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-200 transition-colors"
        >
           <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white transition-colors">Infos Personnelles</h1>
      </div>

      <div className="p-4 space-y-6 max-w-2xl mx-auto">

        {/* Section Identité */}
        <section>
          <h2 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 ml-1">Identité</h2>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden transition-colors">
            
            {/* Email */}
            <div className="p-5 border-b border-gray-50 dark:border-slate-700">
              <div className="flex items-center gap-3 mb-2">
                <Mail className="w-5 h-5 text-blue-500" />
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Adresse Email</span>
              </div>
              <p className="text-lg font-semibold text-gray-900 dark:text-white pl-8 break-all">
                {user?.email}
              </p>
            </div>

            {/* Mot de passe */}
            <div className="p-5">
              <div className="flex items-center gap-3 mb-2">
                <ShieldCheck className="w-5 h-5 text-green-500" />
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Mot de passe</span>
              </div>
              
              <div className="pl-8 flex items-center justify-between gap-2">
                <div className="text-lg font-semibold text-gray-900 dark:text-white tracking-widest">
                  {showPassword ? "Crypté par Google" : hiddenPassword}
                </div>
                
                <div className="flex gap-2">
                  <button 
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                  
                  <button 
                    onClick={handleCopyPassword}
                    className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-lg transition-colors relative"
                  >
                    {copied ? <Check size={20} className="text-green-500" /> : <Copy size={20} />}
                  </button>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* Section Statistiques */}
        <section>
          <h2 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 ml-1">Statistiques du compte</h2>
          <div className="grid grid-cols-2 gap-4">
            
            {/* Carte Scans */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 transition-colors">
              <div className="flex items-center gap-2 mb-3 text-purple-600 dark:text-purple-400">
                <FileText size={20} />
                <span className="font-semibold text-sm">Scans effectués</span>
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {scanCount === null ? "..." : scanCount}
              </p>
            </div>

            {/* Carte Plan */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 transition-colors relative overflow-hidden">
              <div className="flex items-center gap-2 mb-3 text-yellow-600 dark:text-yellow-400 relative z-10">
                <Star size={20} className="fill-yellow-500 text-yellow-500" />
                <span className="font-semibold text-sm">Plan Actuel</span>
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-white relative z-10">
                Gratuit
              </p>
              {/* Petit effet déco */}
              <div className="absolute -right-2 -bottom-2 w-16 h-16 bg-yellow-50 dark:bg-yellow-900/20 rounded-full z-0"></div>
            </div>

          </div>
        </section>

      </div>
    </div>
  );
};

export default PersonalInfo;