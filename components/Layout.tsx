import React, { ReactNode } from 'react';
import { BottomNav } from './BottomNav';
import { useLocation } from 'react-router-dom';

interface LayoutProps {
  children: ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  
  // On cache la barre de navigation sur ces pages spécifiques
  const isAuthPage = ['/login', '/signup'].includes(location.pathname);
  const isResultPage = location.pathname.startsWith('/result');

  const showBottomNav = !isAuthPage && !isResultPage;

  return (
    // CONTENEUR GLOBAL (FOND D'ÉCRAN)
    // Gère le fond gris clair (Light) ou bleu nuit très sombre (Dark)
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-gray-100 flex flex-col font-sans transition-colors duration-300">
      
      {/* 
          CONTENEUR PRINCIPAL (CARTE CENTRALE)
          - Mobile : Prend tout l'écran, fond identique au body (slate-900)
          - Desktop (md) : Devient une carte centrée avec un fond légèrement plus clair (slate-800) pour le contraste
      */}
      <main className={`
        flex-1 flex flex-col w-full max-w-2xl mx-auto
        bg-white dark:bg-slate-900 md:dark:bg-slate-800
        md:shadow-xl md:my-8 md:rounded-2xl
        min-h-screen md:min-h-[800px]
        relative overflow-hidden
        transition-colors duration-300
        ${showBottomNav ? 'pb-20' : ''}
      `}>
        {children}
      </main>

      {/* Barre de navigation en bas (si autorisée) */}
      {showBottomNav && <BottomNav />}
    </div>
  );
};