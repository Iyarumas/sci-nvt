import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { substituicaoPorSubstituto } from '../services/substituicaoService';
import { listarBombeiros, obterBombeiro } from '../services/bombeiroService';
import { listarAPOCs } from '../services/apocService';
import { apiFetch, getAuthToken, setAuthToken, UNAUTHORIZED_EVENT } from '../lib/apiClient';
import type { Usuario } from '../services/usuarioService';

export type UserRole = 'desenvolvedor' | 'admin' | 'gerente' | 'chefe' | 'lider' | 'bombeiro' | 'sem_funcao';

export const ROLE_LABELS: Record<UserRole, string> = {
  desenvolvedor: 'Desenvolvedor',
  admin: 'Administrador',
  gerente: 'Gerente da Seção de Combate a Incêndio',
  chefe: 'Chefe de Equipe',
  lider: 'Líder de Resgate',
  bombeiro: 'Bombeiro de Aeródromo',
  sem_funcao: 'Sem Função Atribuída',
};

export interface PessoaVinculada {
  id?: string;
  nomeGuerra: string;
  foto?: string;
  funcao: string;
  equipe?: string;
  personType: 'bombeiro' | 'apoc';
}

interface User {
  name: string;
  username: string;
  avatar: string;
  role: UserRole;
  substituindoDe?: string;
  substituindoFuncao?: UserRole;
  pessoa?: PessoaVinculada;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  effectiveRole: UserRole;
  login: (username: string, password: string) => Promise<void>;
  registerConvite: (codigo: string, username: string, password: string) => Promise<void>;
  logout: () => void;
}

export interface StoredUser {
  name: string;
  role: UserRole;
  previousRole?: UserRole;
  personId?: string;
  personType?: 'bombeiro' | 'apoc';
}

const USERS_KEY = 'sescinc-users';
const SESSION_KEY = 'sescinc-session';
const IDLE_TIMEOUT = 20 * 60 * 1000;

function getStoredUsers(): Record<string, StoredUser> {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveSession(user: User) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

function loadSession(): User | null {
  try {
    // Sem token valido nao existe sessao: a funcao do usuario vem sempre do servidor.
    if (!getAuthToken()) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  setAuthToken(null);
}

/** Mantem o cache local usado por telas antigas (Perfil, LRO) com os dados vindos do servidor. */
function cacheStoredUser(remote: Usuario) {
  try {
    const users = getStoredUsers();
    users[remote.username] = {
      name: remote.name,
      role: remote.role,
      previousRole: remote.previousRole,
      personId: remote.personId,
      personType: remote.personType,
    };
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch { /* ignore */ }
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  effectiveRole: 'sem_funcao',
  login: async () => {},
  registerConvite: async () => {},
  logout: () => {},
});

const ROLE_HIERARQUIA: UserRole[] = ['desenvolvedor', 'admin', 'gerente', 'chefe', 'lider', 'bombeiro', 'sem_funcao'];

function apocParaUserRole(funcao: string): UserRole {
  if (['SUPERVISOR', 'COORDENADOR'].includes(funcao.toUpperCase())) return 'gerente';
  return 'chefe';
}

export function cargoParaUserRole(cargo: string): UserRole {
  if (cargo === 'GS') return 'gerente';
  if (cargo === 'BA-CE') return 'chefe';
  if (cargo === 'BA-LR') return 'lider';
  if (cargo === 'BA-MC') return 'bombeiro';
  if (cargo === 'BA-2') return 'bombeiro';
  if (cargo === 'BA-RE') return 'bombeiro';
  if (cargo === 'OC') return 'bombeiro';
  return 'bombeiro';
}

export { apocParaUserRole };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => loadSession());

  // Token expirado/invalido em qualquer chamada da API: volta para a tela de login.
  useEffect(() => {
    const onUnauthorized = () => {
      localStorage.removeItem(SESSION_KEY);
      setUser(null);
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  // Ao abrir o sistema com sessao salva, confirma no servidor e atualiza a funcao atual.
  useEffect(() => {
    if (!getAuthToken()) return;
    let cancelled = false;
    apiFetch<{ user: Usuario }>('/auth/me', { cache: 'no-store' })
      .then(({ user: remote }) => {
        if (cancelled || !remote) return;
        cacheStoredUser(remote);
        setUser(prev => {
          if (!prev || (prev.role === remote.role && prev.username === remote.username)) return prev;
          const next = { ...prev, username: remote.username, role: remote.role || 'sem_funcao' };
          saveSession(next);
          return next;
        });
      })
      .catch(() => { /* 401 ja tratado pelo evento; offline mantem a sessao */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!user) return;
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (user?.username) {
          try {
            const raw = localStorage.getItem('sescinc-presence');
            if (raw) {
              const data: Record<string, number> = JSON.parse(raw);
              delete data[user.username];
              localStorage.setItem('sescinc-presence', JSON.stringify(data));
            }
          } catch { /* ignore */ }
        }
        clearSession();
        setUser(null);
      }, IDLE_TIMEOUT);
    };
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, reset));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach(e => window.removeEventListener(e, reset));
    };
  }, [user]);

  const login = useCallback(async (username: string, password: string) => {
    // Senha conferida no servidor, que tambem limita tentativas e devolve o token da sessao.
    const session = await apiFetch<{ token: string; user: Usuario }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
      cache: 'no-store',
    });
    setAuthToken(session.token);
    const remote = session.user;
    cacheStoredUser(remote);

    const roleGarantida: UserRole = remote.role || 'sem_funcao';

    const userData: User = {
      name: remote.name,
      username: remote.username,
      avatar: remote.name.charAt(0).toUpperCase(),
      role: roleGarantida,
    };

    if (remote.personId && remote.personType) {
      try {
        if (remote.personType === 'bombeiro') {
          const b = await obterBombeiro(remote.personId);
          if (b) {
            userData.name = b.nomeCompleto;
            userData.pessoa = {
              id: b.id,
              nomeGuerra: b.nomeGuerra,
              foto: b.foto || undefined,
              funcao: b.cargo,
              equipe: b.equipe,
              personType: 'bombeiro',
            };
            const substituicao = await substituicaoPorSubstituto(b.id);
            if (substituicao) {
              const subRole = cargoParaUserRole(substituicao.funcaoSubstituicao);
              if (subRole) {
                userData.substituindoDe = substituicao.funcionarioNome;
                userData.substituindoFuncao = subRole;
              }
            }
          }
        } else if (remote.personType === 'apoc') {
          const apocs = await listarAPOCs();
          const a = apocs.find(p => p.id === remote.personId);
          if (a) {
            userData.name = a.nomeCompleto;
            userData.pessoa = {
              id: a.id,
              nomeGuerra: a.nomeGuerra,
              foto: undefined,
              funcao: a.funcao,
              equipe: a.equipe,
              personType: 'apoc',
            };
          }
        }
      } catch { /* ignore - fallback to basic user data */ }
    } else {
      try {
        const ids = remote.personId ? [remote.personId] : [];
        const bombeiros = await listarBombeiros({ ids });
        const bombeiro = bombeiros.find(b => b.nomeCompleto === remote.name || b.email === username);
        if (bombeiro) {
          userData.name = bombeiro.nomeCompleto;
          userData.pessoa = {
            id: bombeiro.id,
            nomeGuerra: bombeiro.nomeGuerra,
            foto: bombeiro.foto || undefined,
            funcao: bombeiro.cargo,
            equipe: bombeiro.equipe,
            personType: 'bombeiro',
          };
          const substituicao = await substituicaoPorSubstituto(bombeiro.id);
          if (substituicao) {
            const subRole = cargoParaUserRole(substituicao.funcaoSubstituicao);
            if (subRole) {
              userData.substituindoDe = substituicao.funcionarioNome;
              userData.substituindoFuncao = subRole;
            }
          }
        }
      } catch { /* ignore - Supabase offline or table missing */ }
    }

    setUser(userData);
    saveSession(userData);
  }, []);

  const registerConvite = useCallback(async (codigo: string, username: string, password: string) => {
    // O servidor valida o convite, cria o usuario como "sem funcao" e marca o convite como usado.
    await apiFetch('/auth/register-convite', {
      method: 'POST',
      body: JSON.stringify({ codigo, username, name: username, password }),
      cache: 'no-store',
    });
  }, []);

  const logout = useCallback(() => {
    if (user?.username) {
      try {
        const raw = localStorage.getItem('sescinc-presence');
        if (raw) {
          const data: Record<string, number> = JSON.parse(raw);
          delete data[user.username];
          localStorage.setItem('sescinc-presence', JSON.stringify(data));
        }
      } catch { /* ignore */ }
    }
    clearSession();
    setUser(null);
  }, [user]);

  const effectiveRole = useMemo(() => {
    if (!user) return 'sem_funcao';
    if (user.substituindoFuncao) {
      const userIdx = ROLE_HIERARQUIA.indexOf(user.role);
      const subIdx = ROLE_HIERARQUIA.indexOf(user.substituindoFuncao);
      return subIdx < userIdx ? user.substituindoFuncao : user.role;
    }
    return user.role;
  }, [user]);

  const contextValue = useMemo(() => ({
    user,
    isAuthenticated: !!user,
    effectiveRole,
    login,
    registerConvite,
    logout,
  }), [user, effectiveRole, login, registerConvite, logout]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
