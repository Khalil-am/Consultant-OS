import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface LayoutContextType {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  isMobile: boolean;
  isTablet: boolean;
  width: number;
}

const LayoutContext = createContext<LayoutContextType>({
  sidebarOpen: false,
  setSidebarOpen: () => {},
  isMobile: false,
  isTablet: false,
  width: 1200,
});

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [width, setWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // Close sidebar on resize to desktop
  useEffect(() => {
    if (width >= 1024) setSidebarOpen(false);
  }, [width]);

  return (
    <LayoutContext.Provider value={{
      sidebarOpen,
      setSidebarOpen,
      isMobile: width < 640,
      isTablet: width < 1024,
      width,
    }}>
      {children}
    </LayoutContext.Provider>
  );
}

export const useLayout = () => useContext(LayoutContext);
