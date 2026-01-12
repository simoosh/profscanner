import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Sparkles, User as UserIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Header: React.FC = () => {
  const { user } = useAuth();

  return (
    <header className="px-6 py-5 bg-white border-b border-gray-100 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-2">
        <div className="bg-primary-600 p-2 rounded-lg text-white">
          <Sparkles size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 leading-tight">ProfScanner</h1>
          <p className="text-xs text-primary-600 font-medium">
            {user?.plan === 'free' ? 'Plan Gratuit' : 'Plan Pro'} • {user?.credits || 0} crédits
          </p>
        </div>
      </div>
      
      <Link to="/profile" className="p-2 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200 transition-colors">
        <UserIcon size={24} />
      </Link>
    </header>
  );
};
