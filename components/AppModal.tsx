import React, { useEffect, useRef } from 'react';
import anime from 'animejs';
import { Server, AlertTriangle } from 'lucide-react';

export type ModalType = 'delete' | 'error' | 'server-sleep' | 'info';

interface AppModalProps {
  isOpen: boolean;
  type: ModalType;
  title?: string;
  message: string;
  onConfirm?: () => void;
  onClose: () => void;
  isLoading?: boolean;
}

export const AppModal: React.FC<AppModalProps> = ({ 
  isOpen, type, title, message, onConfirm, onClose, isLoading 
}) => {
  
  // Références pour les éléments à animer
  const trashLidRef = useRef<SVGPathElement>(null);
  const paperBallRef = useRef<SVGGElement>(null);
  const tumbleweedRef = useRef<SVGGElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // --- ANIMATION 1 : SUPPRESSION (Timeline complexe) ---
    if (type === 'delete' && trashLidRef.current && paperBallRef.current) {
      const tl = anime.timeline({
        loop: true,
        easing: 'easeInOutQuad'
      });

      // 1. État initial (Reset)
      anime.set(paperBallRef.current, { translateY: -60, opacity: 0, scale: 1 });
      anime.set(trashLidRef.current, { rotate: 0 });

      tl
      // 2. Le couvercle s'ouvre (pivot à droite)
      .add({
        targets: trashLidRef.current,
        rotate: -35, // S'ouvre vers la gauche
        duration: 400,
      })
      // 3. Le papier apparaît et tombe
      .add({
        targets: paperBallRef.current,
        opacity: [0, 1],
        translateY: [-60, 10], // Tombe dans la boîte
        translateX: [0, 5], // Légère courbe
        rotate: 180,
        scale: 0.5, // Rétrécit en entrant
        duration: 600,
        easing: 'easeInQuad'
      }, '-=200') // Commence un peu avant la fin de l'ouverture
      // 4. Le papier disparaît (caché par la boîte)
      .add({
        targets: paperBallRef.current,
        opacity: 0,
        duration: 100
      })
      // 5. Le couvercle se referme (claquement)
      .add({
        targets: trashLidRef.current,
        rotate: 0,
        duration: 300,
        easing: 'easeOutBounce' // Petit rebond à la fermeture
      })
      // 6. Pause avant de recommencer
      .add({
        duration: 1000
      });
    }

    // --- ANIMATION 2 : ERREUR (Tumbleweed qui roule) ---
    if (type === 'error' && tumbleweedRef.current) {
      anime.set(tumbleweedRef.current, { translateX: -50, opacity: 0, rotate: 0 });

      anime({
        targets: tumbleweedRef.current,
        translateX: [-50, 100], // Traverse la zone
        rotate: 720, // 2 tours complets
        opacity: [
           { value: 1, duration: 500 }, // Fade In
           { value: 1, duration: 1500 }, // Reste visible
           { value: 0, duration: 500 }   // Fade Out
        ],
        duration: 2500,
        easing: 'linear',
        loop: true,
        delay: 200
      });
    }

  }, [isOpen, type]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />

      {/* Contenu */}
      <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-2xl p-6 shadow-2xl relative border border-gray-100 dark:border-slate-700 animate-in fade-in zoom-in duration-300">
        
        {/* ZONE D'ILLUSTRATION */}
        <div className="flex justify-center mb-6 h-32 items-center relative overflow-hidden bg-gray-50 dark:bg-slate-900/50 rounded-xl">
            
            {/* 1. SUPPRESSION (Vectorielle avec Anime.js) */}
            {type === 'delete' && (
                <div className="relative w-full h-full flex items-center justify-center">
                    <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
                        {/* Papier (Boule froissée vectorielle) */}
                        <g ref={paperBallRef}>
                             <path d="M45 45 C42 42, 58 42, 55 45 S 48 55, 45 55 S 42 48, 45 45" fill="#cbd5e1" stroke="#64748b" strokeWidth="1.5"/>
                             <path d="M45 45 L55 55 M55 45 L45 55" stroke="#64748b" strokeWidth="1"/>
                        </g>

                        {/* Corps Poubelle (Devant le papier) */}
                        <path d="M35 50 L38 85 H62 L65 50 H35 Z" fill="#fee2e2" stroke="#ef4444" strokeWidth="2.5" strokeLinejoin="round" />
                        {/* Lignes détails */}
                        <path d="M44 58 V78 M56 58 V78" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />

                        {/* Couvercle (Pivot à droite grâce à transform-origin CSS ou g) */}
                        {/* On utilise un groupe <g> pour faciliter la rotation */}
                        <g style={{ transformOrigin: '65px 48px' }}>
                           <path ref={trashLidRef} d="M32 48 H68 L65 42 H35 L32 48 Z M45 42 V38 H55 V42" fill="#ef4444" stroke="#b91c1c" strokeWidth="1.5" />
                        </g>
                    </svg>
                </div>
            )}

            {/* 2. ERREUR (Virevoltant) */}
            {type === 'error' && (
                <div className="relative w-full h-full overflow-hidden flex items-end justify-center pb-4">
                    {/* Le Tumbleweed */}
                    <g ref={tumbleweedRef} className="text-amber-600 dark:text-amber-500">
                        <svg width="50" height="50" viewBox="0 0 50 50" fill="none" stroke="currentColor" strokeWidth="1.5">
                            {/* Un dessin "brouillon" pour faire le virevoltant */}
                            <path d="M25 5 C10 5, 5 15, 10 30 C 5 40, 20 45, 25 45 C 40 45, 45 35, 40 20 C 45 5, 30 5, 25 5 Z" strokeDasharray="3 2" />
                            <path d="M15 15 L35 35 M35 15 L15 35 M25 5 V45 M5 25 H45" strokeOpacity="0.6" />
                            <circle cx="25" cy="25" r="12" strokeOpacity="0.4" />
                        </svg>
                    </g>
                    {/* Le sol */}
                    <div className="absolute bottom-4 w-full h-0.5 bg-gray-300 dark:bg-slate-600"></div>
                </div>
            )}

            {/* 3. SERVEUR ENDORMI (CSS Pure est suffisant ici mais on garde la structure) */}
            {type === 'server-sleep' && (
                <div className="relative">
                    <Server size={48} className="text-blue-500 dark:text-blue-400" />
                    {/* Bulles Zzz en CSS (plus simple pour les particules) */}
                    <div className="absolute -top-4 -right-4 flex flex-col items-end">
                       <span className="text-blue-400 font-bold text-xl animate-bounce" style={{animationDuration: '2s'}}>Z</span>
                       <span className="text-blue-300 font-bold text-lg animate-bounce" style={{animationDuration: '2.2s', animationDelay: '0.2s'}}>z</span>
                    </div>
                </div>
            )}

             {/* 4. INFO STANDARD */}
             {type === 'info' && (
                <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-full">
                    <AlertTriangle size={40} className="text-blue-600 dark:text-blue-400" />
                </div>
            )}
        </div>

        {/* --- TEXTE --- */}
        <div className="text-center mb-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                {title || (type === 'delete' ? 'Supprimer ?' : 'Information')}
            </h3>
            <p className="text-gray-500 dark:text-gray-300 text-sm leading-relaxed">
                {message}
            </p>
        </div>

        {/* --- BOUTONS --- */}
        <div className="flex gap-3">
            <button 
                onClick={onClose}
                className={`flex-1 py-3 font-semibold rounded-xl transition-colors ${type === 'delete' ? 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
            >
                {type === 'delete' ? 'Annuler' : 'Compris'}
            </button>

            {onConfirm && (
                <button 
                    onClick={onConfirm}
                    disabled={isLoading}
                    className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-500/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                    {isLoading ? '...' : 'Confirmer'}
                </button>
            )}
        </div>

      </div>
    </div>
  );
};