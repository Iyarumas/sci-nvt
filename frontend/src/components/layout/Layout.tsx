import { Outlet } from 'react-router-dom';
import { useSidebar } from '../../hooks/useSidebar';
import { ChefeRegistrosDiariosAuthAlert } from '../ui/ChefeRegistrosDiariosAuthAlert';
import { ChefeVencimentosAlert } from '../ui/ChefeVencimentosAlert';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function Layout() {
  const { effectiveCollapsed } = useSidebar();

  return (
    <div className="min-h-screen bg-white dark:bg-graphite-950">
      <Sidebar />
      <div
        className={`flex min-h-screen flex-col will-change-[margin] transition-all duration-300 ease-out-expo ${
          effectiveCollapsed ? 'md:ml-[70px]' : 'md:ml-[260px]'
        }`}
      >
        <Header />
        <main className="flex-1">
          <Outlet />
        </main>
        <footer className="px-6 py-4 text-center text-xs font-medium text-graphite-400 dark:text-graphite-500">
          Desenvolvido por Guilherme Serra Cardias, Vitor Serra Cardias e Michael Alexandre de Azevedo.
        </footer>
      </div>
      <ChefeRegistrosDiariosAuthAlert />
      <ChefeVencimentosAlert />
    </div>
  );
}
