import { useState, useRef, useEffect, useCallback } from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { useSidebar } from '../../hooks/useSidebar';
import { useAuth } from '../../context/AuthContext';
import { Tooltip } from '../ui/Tooltip';
import { menuItems } from '../../services/menuData';
import type { MenuItem as MenuItemType } from '../../types/navigation';
import {
  canVisualizarArquivo,
  canVisualizarCertificacoes,
  canVisualizarRelatoriosPtrBa,
  canVisualizarRelatorios,
  isAdministradorSistema,
  podeVerCadastroCompletoBase,
  podeVerArquivoBase,
  podeVerCertificacoesBase,
  podeVerRelatoriosPtrBaBase,
  podeVerRelatoriosBase,
  resolverContextoOperacional,
} from '../../utils/permissoes';

function isVisible(
  item: MenuItemType,
  isAdmin: boolean,
  canViewCadastroCompleto: boolean,
  canViewArquivo: boolean,
  canViewCertificacoes: boolean,
  canViewRelatorios: boolean,
  canViewRelatoriosPtrBa: boolean,
): boolean {
  if (item.adminOnly && !isAdmin) return false;
  if (item.adminOrGsOnly && !canViewCadastroCompleto) return false;
  if (item.arquivoOnly && !canViewArquivo) return false;
  if (item.certificacoesOnly && !canViewCertificacoes) return false;
  if (item.ptrBaRelatoriosOnly && !canViewRelatoriosPtrBa) return false;
  if (item.relatoriosOnly && !canViewRelatorios) {
    if (!item.children) return false;
    const visibleChildren = item.children.filter(c => isVisible(c, isAdmin, canViewCadastroCompleto, canViewArquivo, canViewCertificacoes, canViewRelatorios, canViewRelatoriosPtrBa));
    return visibleChildren.length > 0;
  }
  if (item.children) {
    const visibleChildren = item.children.filter(c => isVisible(c, isAdmin, canViewCadastroCompleto, canViewArquivo, canViewCertificacoes, canViewRelatorios, canViewRelatoriosPtrBa));
    if (visibleChildren.length === 0) return false;
  }
  return true;
}

function filterMenu(
  items: MenuItemType[],
  isAdmin: boolean,
  canViewCadastroCompleto: boolean,
  canViewArquivo: boolean,
  canViewCertificacoes: boolean,
  canViewRelatorios: boolean,
  canViewRelatoriosPtrBa: boolean,
): MenuItemType[] {
  return items.filter(item => isVisible(item, isAdmin, canViewCadastroCompleto, canViewArquivo, canViewCertificacoes, canViewRelatorios, canViewRelatoriosPtrBa)).map(item => {
    if (item.children) {
      return { ...item, children: filterMenu(item.children, isAdmin, canViewCadastroCompleto, canViewArquivo, canViewCertificacoes, canViewRelatorios, canViewRelatoriosPtrBa) };
    }
    return item;
  });
}

function SidebarItem({ item, collapsed, onPin, depth = 0 }: { item: MenuItemType; collapsed: boolean; onPin: () => void; depth?: number }) {
  const Icon = item.icon;

  if (item.children) {
    return (
      <SidebarGroup item={item} collapsed={collapsed} onPin={onPin} depth={depth} />
    );
  }

  const link = (
    <NavLink
      to={item.path || '#'}
      end
      onClick={onPin}
      className={({ isActive }) =>
        `relative flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-200 ${
          isActive
            ? 'bg-white/15 text-white shadow-sm'
            : 'text-aviation-200 hover:bg-white/10 hover:text-white'
        } ${depth === 0 ? 'px-3 py-2.5' : 'px-3 py-2 ml-3'}`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-white" />
          )}
          <Icon className={`shrink-0 transition-transform duration-200 group-hover:scale-110 ${depth === 0 ? 'h-5 w-5' : 'h-4 w-4'}`} />
          <span
            className={`whitespace-nowrap transition-all duration-300 ${
              collapsed ? 'w-0 opacity-0 overflow-hidden' : 'opacity-100'
            }`}
          >
            {item.label}
          </span>
        </>
      )}
    </NavLink>
  );

  return (
    <li className="group">
      {collapsed ? (
        <Tooltip text={item.label} position="right">
          {link}
        </Tooltip>
      ) : link}
    </li>
  );
}

function SidebarGroup({ item, collapsed, onPin, depth = 0 }: { item: MenuItemType; collapsed: boolean; onPin: () => void; depth?: number }) {
  const [open, setOpen] = useState(false);
  const Icon = item.icon;

  const button = (
    <button
      onClick={() => { if (collapsed) { onPin(); setOpen(true); } else { setOpen(!open); } }}
      className={`flex w-full items-center gap-3 rounded-xl text-sm font-medium transition-all duration-200 text-aviation-200 hover:bg-white/10 hover:text-white ${open ? 'mb-1' : ''} ${depth === 0 ? 'px-3 py-2.5' : 'px-3 py-2'}`}
    >
      <Icon className={`shrink-0 transition-transform duration-200 ${open ? 'scale-105' : ''} ${depth === 0 ? 'h-5 w-5' : 'h-4 w-4'}`} />
      <span
        className={`flex-1 text-left whitespace-nowrap transition-all duration-300 ${
          collapsed ? 'w-0 opacity-0 overflow-hidden' : 'opacity-100'
        }`}
      >
        {item.label}
      </span>
      {!collapsed && (
        <ChevronDown
          className={`h-4 w-4 transition-all duration-300 ${
            open ? 'rotate-0 text-white' : '-rotate-90'
          }`}
        />
      )}
    </button>
  );

  if (collapsed) {
    return (
      <li className="group">
        <Tooltip text={item.label} position="right">
          {button}
        </Tooltip>
      </li>
    );
  }

  return (
    <li>
      {button}
      <div
        className={`overflow-hidden transition-all duration-300 ease-out-expo ${
          open ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <ul className="ml-3 space-y-0.5 border-l-2 border-white/15 pl-3">
          {item.children?.map((child) => (
            <SidebarItem key={child.label} item={child} collapsed={collapsed} onPin={onPin} depth={depth + 1} />
          ))}
        </ul>
      </div>
    </li>
  );
}

export function Sidebar() {
  const { collapsed, effectiveCollapsed, toggleSidebar, setPeeking, setPinned } = useSidebar();
  const { user } = useAuth();
  const isAdmin = isAdministradorSistema(user);
  const [canViewCadastroCompleto, setCanViewCadastroCompleto] = useState(() => podeVerCadastroCompletoBase(user));
  const [canViewArquivo, setCanViewArquivo] = useState(() => podeVerArquivoBase(user));
  const [canViewCertificacoes, setCanViewCertificacoes] = useState(() => podeVerCertificacoesBase(user));
  const [canViewRelatorios, setCanViewRelatorios] = useState(() => podeVerRelatoriosBase(user));
  const [canViewRelatoriosPtrBa, setCanViewRelatoriosPtrBa] = useState(() => podeVerRelatoriosPtrBaBase(user));
  const visibleMenu = filterMenu(menuItems, isAdmin, canViewCadastroCompleto, canViewArquivo, canViewCertificacoes, canViewRelatorios, canViewRelatoriosPtrBa);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const asideRef = useRef<HTMLElement>(null);

  const handlePin = useCallback(() => {
    setPinned(true);
    setPeeking(false);
  }, [setPinned, setPeeking]);

  useEffect(() => {
    let cancelled = false;
    setCanViewCadastroCompleto(podeVerCadastroCompletoBase(user));
    setCanViewArquivo(podeVerArquivoBase(user));
    setCanViewCertificacoes(podeVerCertificacoesBase(user));
    setCanViewRelatorios(podeVerRelatoriosBase(user));
    setCanViewRelatoriosPtrBa(podeVerRelatoriosPtrBaBase(user));

    resolverContextoOperacional(user)
      .then(contexto => {
        if (!cancelled) {
          setCanViewCadastroCompleto(contexto.isAdministradorSistema || contexto.canManageGlobal);
          setCanViewArquivo(canVisualizarArquivo(contexto));
          setCanViewCertificacoes(canVisualizarCertificacoes(contexto));
          setCanViewRelatorios(canVisualizarRelatorios(contexto));
          setCanViewRelatoriosPtrBa(canVisualizarRelatoriosPtrBa(contexto));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCanViewCadastroCompleto(podeVerCadastroCompletoBase(user));
          setCanViewArquivo(podeVerArquivoBase(user));
          setCanViewCertificacoes(podeVerCertificacoesBase(user));
          setCanViewRelatorios(podeVerRelatoriosBase(user));
          setCanViewRelatoriosPtrBa(podeVerRelatoriosPtrBaBase(user));
        }
      });

    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (effectiveCollapsed) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (asideRef.current && !asideRef.current.contains(e.target as Node)) {
        setPeeking(false);
        setPinned(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [effectiveCollapsed, setPeeking, setPinned]);

  const handleMouseEnter = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (collapsed) setPeeking(true);
  };

  const handleMouseLeave = () => {
    timerRef.current = setTimeout(() => setPeeking(false), 200);
  };

  const handleToggle = () => {
    toggleSidebar();
  };

  return (
    <aside
      ref={asideRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`fixed left-0 top-0 z-50 hidden h-screen flex-col bg-graphite-950 border-r border-white/5 transition-all duration-300 ease-out-expo md:flex ${
        effectiveCollapsed ? 'md:w-[70px]' : 'md:w-[260px]'
      }`}
    >
      <div className="flex h-16 items-center border-b border-white/10 px-4">
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-sm">
            <img src="/logobombeiro.jpeg" alt="SCI NVT" className="h-full w-full object-cover" />
          </div>
          <span
            className={`whitespace-nowrap text-lg font-bold text-white transition-all duration-300 ${
              effectiveCollapsed ? 'w-0 opacity-0 overflow-hidden pointer-events-none' : 'opacity-100'
            }`}
          >
            SCI NVT
          </span>
        </div>
        <button
          onClick={handleToggle}
          className="ml-auto rounded-xl p-1.5 text-aviation-300 transition-all duration-200 hover:bg-white/10 hover:text-white"
        >
          {effectiveCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-4">
        <ul className="space-y-0.5">
          {visibleMenu.map((item) => (
            <SidebarItem key={item.label} item={item} collapsed={effectiveCollapsed} onPin={handlePin} />
          ))}
        </ul>
      </nav>

      <div className="mx-3 mb-3 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="px-3 pb-3 text-center text-[10px] font-medium uppercase tracking-widest text-aviation-400">
        {effectiveCollapsed ? '' : 'SCI NVT v1.0'}
      </div>
    </aside>
  );
}
