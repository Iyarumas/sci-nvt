import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  Search,
  Bell,
  MessageSquare,
  Sun,
  Moon,
  ChevronDown,
  Settings,
  UserCircle,
  LogOut,
} from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { cargoParaUserRole, useAuth, ROLE_LABELS } from '../../context/AuthContext';
import { useContextoOperacional } from '../../hooks/useContextoOperacional';
import { Breadcrumb } from './Breadcrumb';
import { RightPanel } from './RightPanel';
import { CARGO_OPTIONS } from '../../types/bombeiro';
import { FUNCAO_APOC_OPTIONS } from '../../types/apoc';
import { contarNaoLidas as contarNotifNaoLidas } from '../../services/notificacaoService';
import { contarNaoLidas as contarChatNaoLidas } from '../../services/chatService';

export function Header() {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const { contexto } = useContextoOperacional();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<'notificacoes' | 'chat' | 'contatos'>('notificacoes');
  const [notifCount, setNotifCount] = useState(0);
  const [chatCount, setChatCount] = useState(0);

  useEffect(() => {
    let active = true;

    async function updateCounts() {
      const [notif, chat] = await Promise.all([
        Promise.resolve(contarNotifNaoLidas()),
        user?.username ? contarChatNaoLidas(user.username) : Promise.resolve(0),
      ]);
      if (!active) return;
      setNotifCount(notif);
      setChatCount(chat);
    }

    updateCounts().catch(() => {
      setNotifCount(contarNotifNaoLidas());
      setChatCount(0);
    });
    const iv = setInterval(() => { updateCounts().catch(() => undefined); }, 15000);
    return () => {
      active = false;
      clearInterval(iv);
    };
  }, [user?.username]);

  const pessoa = user?.pessoa;
  const displayName = pessoa?.nomeGuerra || user?.name || 'Usuário';
  const cargoEfetivo = pessoa?.personType === 'bombeiro'
    ? contexto.cargo || pessoa.funcao
    : pessoa?.funcao || '';
  const roleEfetiva = pessoa?.personType === 'bombeiro' && cargoEfetivo
    ? cargoParaUserRole(cargoEfetivo)
    : user?.role || 'chefe';
  const roleParaExibir = user?.role === 'desenvolvedor' || user?.role === 'admin'
    ? user.role
    : roleEfetiva;
  const displayRole = ROLE_LABELS[roleParaExibir];
  const cargoLabel = pessoa
    ? (pessoa.personType === 'bombeiro'
        ? CARGO_OPTIONS.find(c => c.value === cargoEfetivo)?.label || cargoEfetivo
        : FUNCAO_APOC_OPTIONS.find(f => f.value === cargoEfetivo)?.label || cargoEfetivo) || undefined
    : undefined;
  const displayPhoto = pessoa?.foto || null;
  const fullName = pessoa?.nomeGuerra ? (user?.name || '') : '';

  const pageTitle = getPageTitle(pathname);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-graphite-200/60 bg-white/80 px-3 backdrop-blur-xl dark:border-border-dark dark:bg-surface-dark/80 sm:px-6">
      <div className="min-w-0 flex flex-col">
        <h2 className="max-w-[9rem] truncate text-base font-bold text-graphite-900 dark:text-graphite-100 sm:max-w-none sm:text-lg">
          {pageTitle}
        </h2>
        <div className="hidden sm:block">
          <Breadcrumb />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite-400" />
          <input
            type="text"
            placeholder="Pesquisar..."
            className="w-64 rounded-xl border border-graphite-200/60 bg-graphite-100/50 py-2 pl-10 pr-4 text-sm text-graphite-900 placeholder-graphite-400 outline-none transition-all duration-200 focus:w-72 focus:border-aviation-400/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:placeholder-graphite-500 dark:focus:border-aviation-400/30 dark:focus:bg-surface-elevated"
          />
        </div>

        <button onClick={() => { setRightPanelTab('notificacoes'); setRightPanelOpen(true); }}
          className="relative rounded-xl p-2 text-graphite-400 transition-all duration-200 hover:bg-graphite-100 hover:text-graphite-600 dark:text-graphite-500 dark:hover:bg-surface-card dark:hover:text-graphite-300">
          <Bell className="h-5 w-5" />
          {notifCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-alert-red px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-surface-dark">
              {notifCount}
            </span>
          )}
        </button>

        <button onClick={() => { setRightPanelTab('chat'); setRightPanelOpen(true); }}
          className="relative rounded-xl p-2 text-graphite-400 transition-all duration-200 hover:bg-graphite-100 hover:text-graphite-600 dark:text-graphite-500 dark:hover:bg-surface-card dark:hover:text-graphite-300">
          <MessageSquare className="h-5 w-5" />
          {chatCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-alert-red px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-surface-dark">
              {chatCount}
            </span>
          )}
        </button>

        <div className="mx-1 hidden h-6 w-px bg-graphite-200/60 dark:bg-border-dark sm:block" />

        <button
          onClick={toggleTheme}
          className="rounded-xl p-2 text-graphite-400 transition-all duration-200 hover:bg-graphite-100 hover:text-graphite-600 dark:text-graphite-500 dark:hover:bg-surface-card dark:hover:text-graphite-300"
        >
          {theme === 'light' ? (
            <Moon className="h-5 w-5" />
          ) : (
            <Sun className="h-5 w-5" />
          )}
        </button>

        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-1 rounded-xl p-1.5 transition-all duration-200 hover:bg-graphite-100 dark:hover:bg-surface-card sm:gap-3"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-aviation-500 to-aviation-700 text-sm font-bold text-white shadow-md shadow-aviation-500/20">
              {displayPhoto ? (
                <img src={displayPhoto} className="h-full w-full object-cover" alt={displayName} />
              ) : (
                displayName.charAt(0).toUpperCase()
              )}
            </div>
            <div className="hidden text-left lg:block">
              <p className="text-sm font-bold leading-tight text-graphite-900 dark:text-graphite-100">
                {displayName}
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-aviation-600 dark:text-aviation-400">
                {displayRole}
              </p>
              {cargoLabel && (
                <p className="text-[10px] uppercase text-graphite-500 dark:text-graphite-400">
                  {cargoLabel}
                </p>
              )}
              {fullName && fullName !== displayName && (
                <p className="text-[10px] text-graphite-400 dark:text-graphite-500 truncate max-w-[120px]">
                  {fullName}
                </p>
              )}
            </div>
            <ChevronDown className={`hidden h-4 w-4 text-graphite-400 transition-transform duration-200 sm:block ${userMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {userMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setUserMenuOpen(false)}
              />
              <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-graphite-200 bg-white shadow-xl shadow-black/5 animate-scaleIn dark:border-border-dark dark:bg-surface-card dark:shadow-black/30">
                <div className="px-4 py-3 border-b border-graphite-100 dark:border-border-dark">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-aviation-500 to-aviation-700 text-sm font-bold text-white">
                      {displayPhoto ? (
                        <img src={displayPhoto} className="h-full w-full object-cover" />
                      ) : (
                        displayName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-graphite-900 dark:text-graphite-100 truncate">{displayName}</p>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-aviation-600 dark:text-aviation-400">{displayRole}</p>
                      {cargoLabel && (
                        <p className="text-[10px] uppercase text-graphite-500 dark:text-graphite-400">{cargoLabel}</p>
                      )}
                      {fullName && fullName !== displayName && (
                        <p className="text-[10px] text-graphite-400 truncate">{fullName}</p>
                      )}
                      <p className="text-[10px] text-graphite-400">@{user?.username}</p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => { setUserMenuOpen(false); navigate('/perfil'); }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm text-graphite-600 transition-colors hover:bg-aviation-50 hover:text-aviation-700 dark:text-graphite-300 dark:hover:bg-aviation-900/20 dark:hover:text-aviation-300"
                >
                  <UserCircle className="h-4 w-4" />
                  Meu Perfil
                </button>
                <button
                  onClick={() => { setUserMenuOpen(false); navigate('/configuracoes'); }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm text-graphite-600 transition-colors hover:bg-aviation-50 hover:text-aviation-700 dark:text-graphite-300 dark:hover:bg-aviation-900/20 dark:hover:text-aviation-300"
                >
                  <Settings className="h-4 w-4" />
                  Configurações
                </button>
                <div className="border-t border-graphite-100 dark:border-border-dark" />
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm text-alert-red transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <LogOut className="h-4 w-4" />
                  Sair
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {rightPanelOpen && createPortal(
        <RightPanel
          onClose={() => setRightPanelOpen(false)}
          openTab={rightPanelTab}
        />,
        document.body,
      )}
    </header>
  );
}

function getPageTitle(pathname: string): string {
  const labels: Record<string, string> = {
    'cadastro/bombeiros': 'Bombeiros',
    'cadastro/apoc': 'APOC',
    'cadastro/equipamentos': 'Equipamentos',
    'cadastro/extintores': 'Extintores',
    'cadastro/agentes-extintores': 'Agentes Extintores',
    'cadastro/hidrantes': 'Hidrantes',
    'cadastro/viaturas': 'Viaturas',
    'cadastro/ferias': 'Férias',
    'cadastro/documentos': 'Gerenciar Documentos',
    'relatorios/lro': 'LRO',
    'relatorios/bona': 'BONA/REA',
    'relatorios/ptr-ba': 'PTR-BA',
    'relatorios/ptr-ba-registros': 'PTR-BA Registros',
    'relatorios/exercicios': 'Exercícios',
    'relatorios/exercicios/taf': 'TAF',
    'relatorios/exercicios/tp-epr': 'TP/EPR',
    'relatorios/exercicios/posicionamento': 'Posicionamento',
    'relatorios/exercicios/tempo-resposta': 'Tempo Resposta',
    'relatorios/ordem-servico': 'Ordem de Serviço',
    'relatorios/substituicoes': 'Substituições',
    'relatorios/trocas': 'Trocas',
    'registros-diarios/ptr-ba': 'PTR-BA por Instrução',
    'registros-diarios/ptr-ba-completo': 'PTR-BA',
    'registros-diarios/lro-ocorrencias': 'LRO/Ocorrências',
    'registros-diarios/bona-rea': 'BONA/REA',
    'registros-diarios/inspecoes': 'Inspeções',
    'registros-diarios/solicitacoes': 'Solicitações',
    'registros-diarios/inspecoes/check': 'Check de Inspeção',
    'treinamentos/tp-epr': 'TP/EPR',
    'treinamentos/taf': 'TAF',
    'documentos/trocas': 'Trocas',
    'registros-diarios/gerar-lro': 'Gerar LRO',
    'registros-diarios/preview-lro': 'Preview LRO',
    'inspecoes/solicitacoes': 'Solicitações',
    'inspecoes/check': 'Check de Inspeção',
    'treinamentos/posicionamento': 'Posicionamento',
    'treinamentos/tempo-resposta': 'Tempo Resposta',
    'funcionarios/substituicoes': 'Substituições',
    arquivo: 'Arquivo',
    ocorrencias: 'BONA/REA',
    inspecoes: 'Inspeções',
    viaturas: 'Viaturas CCI',
    epis: 'EPIs',
    checklists: 'Checklists',
    documentos: 'Documentos',
    escalas: 'Escalas',
    treinamentos: 'Treinamentos',
    certificacoes: 'Certificações',
    funcionarios: 'Funcionários',
    substituicoes: 'Substituições',
    conferencia: 'Conferência',
    estatisticas: 'Estatísticas',
    configuracoes: 'Configurações',
    usuarios: 'Usuários',
    perfil: 'Meu Perfil',
  };
  const key = pathname.replace(/^\//, '');
  return labels[key] || 'Dashboard';
}
