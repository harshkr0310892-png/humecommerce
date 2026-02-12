import { useEffect, useState } from 'react';

export function useTheme() {
  const [theme] = useState<'light'>('light');

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark');
    root.classList.add('light');
  }, []);

  const toggleTheme = () => {
    // No-op since we're only using light theme
  };

  return { theme, setTheme: () => {}, toggleTheme };
}
