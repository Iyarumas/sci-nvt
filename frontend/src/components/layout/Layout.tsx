import { Outlet } from 'react-router-dom';
import { useSidebar } from '../../hooks/useSidebar';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function Layout() {
  const { effectiveCollapsed } = useSidebar();

  return (
    <div className="min-h-screen bg-white dark:bg-graphite-950">
      <Sidebar />
      <div
        className={`will-change-[margin] transition-all duration-300 ease-out-expo ${
          effectiveCollapsed ? 'md:ml-[70px]' : 'md:ml-[260px]'
        }`}
      >
        <Header />
        <main className="min-h-[calc(100vh-4rem)]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
