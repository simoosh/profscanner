import React, { ReactNode } from 'react';
import { BottomNav } from './BottomNav';
import { useLocation } from 'react-router-dom';

interface LayoutProps {
  children: ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const isAuthPage = ['/login', '/signup'].includes(location.pathname);
  const isResultPage = location.pathname.startsWith('/result');

  const showBottomNav = !isAuthPage && !isResultPage;

  return (
    // flex-1 garantit que le layout remplit l'écran
    <div className="flex-1 flex flex-col w-full relative transition-colors duration-300">
      
      <main className={`
        flex-1 flex flex-col w-full mx-auto
        /* MOBILE : Transparent pour hériter du body, 100% de large */
        bg-transparent
        /* PC : Effet carte centré */
        md:max-w-2xl md:bg-white md:dark:bg-slate-800 md:shadow-2xl md:my-8 md:rounded-2xl md:overflow-hidden
        relative
        ${showBottomNav ? 'pb-20' : 'pb-0'}
      `}>
        {children}
      </main>

      {showBottomNav && <BottomNav />}
    </div>
  );
};