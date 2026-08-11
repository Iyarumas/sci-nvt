import { createContext, useCallback, useEffect, useState, type ReactNode } from 'react';

interface SidebarContextType {
  collapsed: boolean;
  effectiveCollapsed: boolean;
  toggleSidebar: () => void;
  setPinned: (v: boolean) => void;
  setPeeking: (v: boolean) => void;
}

export const SidebarContext = createContext<SidebarContextType>({
  collapsed: false,
  effectiveCollapsed: false,
  toggleSidebar: () => {},
  setPinned: () => {},
  setPeeking: () => {},
});

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => {
    const stored = localStorage.getItem('sescinc-sidebar');
    return stored === 'true';
  });

  const [peeking, setPeeking] = useState(false);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    localStorage.setItem('sescinc-sidebar', String(collapsed));
  }, [collapsed]);

  const effectiveCollapsed = collapsed && !peeking && !pinned;

  const toggleSidebar = useCallback(() => {
    setCollapsed(prev => !prev);
    setPinned(false);
    setPeeking(false);
  }, []);

  return (
    <SidebarContext.Provider value={{ collapsed, effectiveCollapsed, toggleSidebar, setPinned, setPeeking }}>
      {children}
    </SidebarContext.Provider>
  );
}
