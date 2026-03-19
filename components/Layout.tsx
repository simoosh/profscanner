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
    <div className="flex-1 flex flex-col w-full relative transition-colors duration-300">
      
      <main className={`
        flex-1 flex flex-col w-full overflow-x-hidden
        ${showBottomNav ? 'pb-20' : ''}
      `}>
        {children}
      </main>

      {showBottomNav && <BottomNav />}
    </div>
  );
};
