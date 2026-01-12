import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, History, User } from 'lucide-react';

export const BottomNav: React.FC = () => {
  const navItems = [
    { path: '/', icon: Home, label: 'Accueil' },
    { path: '/history', icon: History, label: 'Historique' },
    { path: '/profile', icon: User, label: 'Profil' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-2 flex justify-between items-center z-50 md:hidden h-16 safe-area-bottom">
      {navItems.map(({ path, icon: Icon, label }) => (
        <NavLink
          key={path}
          to={path}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center w-full h-full space-y-1 ${
              isActive ? 'text-primary-600' : 'text-gray-400 hover:text-gray-600'
            }`
          }
        >
          <Icon size={24} />
          <span className="text-[10px] font-medium">{label}</span>
        </NavLink>
      ))}
    </div>
  );
};
