import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { substituicaoPorSubstituto } from '../services/substituicaoService';
import { listarBombeiros, obterBombeiro } from '../services/bombeiroService';
import { listarAPOCs } from '../services/apocService';
import {
  buscarUsuarioPorUsername,
  verificarSenha,
  criarUsuarioComHash,
} from '../services/usuarioService';

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
  register: (name: string, username: string, password: string, role: UserRole, personId?: string, personType?: 'bombeiro' | 'apoc') => Promise<void>;
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
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as User;
    if (session.username === 'serra' && session.role !== 'desenvolvedor') {
      session.role = 'desenvolvedor';
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
    if (session.username === 'admin' && session.role !== 'admin') {
      session.role = 'admin';
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
    return session;
  } catch {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  effectiveRole: 'sem_funcao',
  login: async () => {},
  register: async () => {},
  logout: () => {},
});

function seedAdmin() {
  const users = getStoredUsers();
  let changed = false;

  if (!users['serra']) {
    users['serra'] = { name: 'Serra', role: 'desenvolvedor' };
    changed = true;
  }

  if (users['admin']) {
    delete users['admin'];
    changed = true;
  }

  if (changed) localStorage.setItem(USERS_KEY, JSON.stringify(users));

  syncSeedsToSupabase(users).catch(() => {});
}

async function syncSeedsToSupabase(users: Record<string, StoredUser>) {
  const seeds = ['serra'];
  for (const uname of seeds) {
    const local = users[uname];
    if (!local) continue;
    try {
      const existing = await buscarUsuarioPorUsername(uname);
      if (!existing) {
        await criarUsuarioComHash({
          username: uname,
          name: local.name,
          password: 'serra',
          role: 'desenvolvedor',
        });
      }
    } catch { /* ignore - Supabase offline */ }
  }
}

const ROLE_HIERARQUIA: UserRole[] = ['desenvolvedor', 'admin', 'gerente', 'chefe', 'lider', 'bombeiro', 'sem_funcao'];

function apocParaUserRole(funcao: string): UserRole {
  if (funcao.toUpperCase() === 'SUPERVISOR') return 'gerente';
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

  useEffect(() => { seedAdmin(); }, []);

  useEffect(() => {
    if (user?.username === 'serra' && user.role !== 'desenvolvedor') {
      setUser(prev => prev ? { ...prev, role: 'desenvolvedor' } : prev);
    }
  }, [user]);

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
    const ATTEMPTS_KEY = 'sescinc-login-attempts';
    const MAX_ATTEMPTS = 5;
    const BLOCK_MINUTES = 15;

    let attempts: Record<string, { count: number; firstAttempt: string }> = {};
    try { attempts = JSON.parse(localStorage.getItem(ATTEMPTS_KEY) || '{}'); } catch { /* ignore */ }

    const userAttempts = attempts[username];
    if (userAttempts && userAttempts.count >= MAX_ATTEMPTS) {
      const elapsed = Date.now() - new Date(userAttempts.firstAttempt).getTime();
      const remaining = BLOCK_MINUTES * 60 * 1000 - elapsed;
      if (remaining > 0) {
        const mins = Math.ceil(remaining / 60000);
        throw new Error(`Conta bloqueada por ${mins} minuto(s) devido a múltiplas tentativas inválidas.`);
      }
      delete attempts[username];
    }

    await new Promise(r => setTimeout(r, 600));

    let remote = await verificarSenha(username, password);

    if (!remote) {
      try {
        const users = getStoredUsers();
        const stored = users[username];
        if (!stored) {
          const fetched = await buscarUsuarioPorUsername(username);
          if (fetched) {
            const usersUpdated = getStoredUsers();
            usersUpdated[username] = { name: fetched.name, role: fetched.role };
            localStorage.setItem(USERS_KEY, JSON.stringify(usersUpdated));
          }
        }
      } catch { /* ignore */ }
    }

    if (!remote) {
      const now = new Date().toISOString();
      if (!attempts[username]) attempts[username] = { count: 0, firstAttempt: now };
      attempts[username].count++;
      if (attempts[username].count === 1) attempts[username].firstAttempt = now;
      localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(attempts));
      const tentativasRestantes = MAX_ATTEMPTS - attempts[username].count;
      throw new Error(`Usuário ou senha inválidos. ${tentativasRestantes > 0 ? `${tentativasRestantes} tentativa(s) restante(s).` : 'Conta bloqueada por 15 minutos.'}`);
    }

    delete attempts[username];
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(attempts));

    const roleGarantida: UserRole = username === 'serra'
      ? 'desenvolvedor'
      : username === 'admin'
        ? 'admin'
        : remote.role || 'sem_funcao';

    const userData: User = {
      name: remote.name,
      username,
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

  const register = useCallback(async (name: string, username: string, password: string, role: UserRole, personId?: string, personType?: 'bombeiro' | 'apoc') => {
    await new Promise(r => setTimeout(r, 600));

    const existing = await buscarUsuarioPorUsername(username);
    if (existing) {
      throw new Error('Nome de usuário já existe.');
    }

    const users = getStoredUsers();
    users[username] = { name, role, personId, personType };
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    try {
      await criarUsuarioComHash({ username, name, password, role, personId, personType });
    } catch { /* ignore - Supabase offline */ }
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
    register,
    logout,
  }), [user, effectiveRole, login, register, logout]);

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
