import React, { useEffect, useState } from 'react';
import { Download, Maximize, Minimize, Share, SquarePlus, X } from 'lucide-react';
import {
  canFullscreen,
  canPromptInstall,
  isFullscreen,
  isIOS,
  isMobileDevice,
  isStandalone,
  onInstallStateChange,
  promptInstall,
  toggleFullscreen,
} from '../services/install';

const DISMISS_KEY = 'profscanner.installBannerDismissed';

/**
 * Invites the user to install ProfScanner so it opens full screen, without the browser bars.
 * - `compact`: dismissible banner for the home screen, mobile only;
 * - default: permanent card (profile page), also offers full screen on demand.
 */
export const InstallCard: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const [, refresh] = useState(0);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => onInstallStateChange(() => refresh((n) => n + 1)), []);

  const standalone = isStandalone();
  const ios = isIOS();
  const installable = canPromptInstall();
  const fullscreenSupported = canFullscreen();

  if (standalone) return null; // already installed: nothing to offer
  if (compact && (dismissed || !isMobileDevice())) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore
    }
  };

  const install = async () => {
    if (installable) await promptInstall();
    else setShowIosHelp(true); // iOS (or a browser without install prompt): explain the manual way
  };

  const canInstallSomehow = installable || ios;

  return (
    <div className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-2xl p-4 shadow-lg shadow-blue-500/20 relative">
      {compact && (
        <button onClick={dismiss} aria-label="Masquer" className="absolute top-2 right-2 p-1.5 rounded-full hover:bg-white/15">
          <X size={16} />
        </button>
      )}
      <div className="flex items-start gap-3">
        <div className="p-2 bg-white/15 rounded-xl flex-shrink-0">
          <Download size={22} />
        </div>
        <div className="min-w-0 flex-1 pr-5">
          <p className="font-bold leading-tight">Utilisez ProfScanner en plein écran</p>
          <p className="text-sm text-blue-100 mt-1 leading-snug">
            Installez l'app : elle s'ouvre comme une vraie application, sans barre d'adresse, et reste utilisable hors ligne.
          </p>

          <div className="flex flex-wrap gap-2 mt-3">
            {canInstallSomehow && (
              <button onClick={install} className="px-4 py-2 rounded-xl bg-white text-blue-700 font-semibold text-sm active:scale-95 transition-transform">
                Installer
              </button>
            )}
            {!compact && fullscreenSupported && (
              <button
                onClick={() => toggleFullscreen().catch(() => {})}
                className="px-4 py-2 rounded-xl bg-white/15 font-semibold text-sm flex items-center gap-1.5 active:scale-95 transition-transform"
              >
                {isFullscreen() ? <Minimize size={16} /> : <Maximize size={16} />}
                {isFullscreen() ? 'Quitter le plein écran' : 'Plein écran maintenant'}
              </button>
            )}
          </div>

          {!canInstallSomehow && (
            <p className="text-xs text-blue-100 mt-3 leading-snug">
              Votre navigateur ne propose pas l'installation depuis ce bouton : ouvrez son menu (⋮) et choisissez « Installer l'application » ou « Ajouter à l'écran d'accueil ».
            </p>
          )}

          {showIosHelp && (
            <ol className="text-sm text-blue-50 mt-3 space-y-2 bg-black/15 rounded-xl p-3">
              <li className="flex items-center gap-2">
                <Share size={16} className="flex-shrink-0" /> Touchez le bouton <strong>Partager</strong> de Safari
              </li>
              <li className="flex items-center gap-2">
                <SquarePlus size={16} className="flex-shrink-0" /> Choisissez <strong>Sur l'écran d'accueil</strong>
              </li>
              <li>Ouvrez ProfScanner depuis l'icône ajoutée.</li>
            </ol>
          )}
        </div>
      </div>
    </div>
  );
};
