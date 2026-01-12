import React, { createContext, useContext, useEffect, useState } from 'react';

interface ThemeContextType {
  darkMode: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({} as ThemeContextType);

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  // On initialise l'état
  const [darkMode, setDarkMode] = useState(() => {
    // Par défaut, on regarde le localStorage, sinon on met false (Light mode)
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark';
    }
    return false;
  });

  // C'est ici que la magie opère
  useEffect(() => {
    const root = window.document.documentElement;
    
    // On enlève TOUT d'abord pour être sûr
    root.classList.remove('light', 'dark');

    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      console.log("Mode Sombre ACTIVÉ"); // Pour débugger (F12)
    } else {
      root.classList.add('light'); // Optionnel mais aide certains navigateurs
      localStorage.setItem('theme', 'light');
      console.log("Mode Sombre DÉSACTIVÉ"); // Pour débugger (F12)
    }
  }, [darkMode]);

  const toggleTheme = () => {
    setDarkMode((prev) => !prev);
  };

  return (
    <ThemeContext.Provider value={{ darkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};