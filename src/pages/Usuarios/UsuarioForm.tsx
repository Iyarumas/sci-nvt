import { useState, useEffect, useMemo } from 'react';
import { X, User, Unlink } from 'lucide-react';
import type { UserRole } from '../../context/AuthContext';
import { cargoParaUserRole, apocParaUserRole } from '../../context/AuthContext';
import { Autocomplete } from '../../components/documentos/Autocomplete';
import { listarAtivos } from '../../services/bombeiroService';
import { listarAPOCs } from '../../services/apocService';
import type { Bombeiro } from '../../types/bombeiro';
import type { APOC } from '../../types/apoc';
import { CARGO_OPTIONS } from '../../types/bombeiro';
import { FUNCAO_APOC_OPTIONS } from '../../types/apoc';

interface UserData {
  username: string;
  name: string;
  password: string;
  role: UserRole;
  previousRole?: UserRole;
  personId?: string;
  personType?: 'bombeiro' | 'apoc';
}

interface Props {
  user?: { username: string; name: string; role?: UserRole; previousRole?: UserRole; personId?: string; personType?: 'bombeiro' | 'apoc' } | null;
  onSave: (data: UserData) => void | Promise<void>;
  onClose: () => void;
}

interface PersonOption {
  id: string;
  type: 'bombeiro' | 'apoc';
  nomeCompleto: string;
  nomeGuerra: string;
  cargo?: string;
  funcao?: string;
}

export function UsuarioForm({ user, onSave, onClose }: Props) {
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('sem_funcao');
  const [erro, setErro] = useState('');

  const [personId, setPersonId] = useState<string | undefined>(user?.personId);
  const [personType, setPersonType] = useState<'bombeiro' | 'apoc' | undefined>(user?.personType);

  const [bombeiros, setBombeiros] = useState<Bombeiro[]>([]);
  const [apocs, setApocs] = useState<APOC[]>([]);
  const [loadingPessoas, setLoadingPessoas] = useState(true);

  useEffect(() => {
    async function load() {
      setLoadingPessoas(true);
      try {
        const [b, a] = await Promise.all([listarAtivos(), listarAPOCs()]);
        setBombeiros(b);
        setApocs(a);
      } catch { /* ignore */ }
      setLoadingPessoas(false);
    }
    load();
  }, []);

  useEffect(() => {
    if (user) {
      setUsername(user.username);
      setName(user.name);
      setRole((user.role as UserRole) || 'sem_funcao');
      setPassword('');
      setPersonId(user.personId);
      setPersonType(user.personType);
    }
  }, [user]);

  const allPersons: PersonOption[] = useMemo(() => {
    const bOpts: PersonOption[] = bombeiros.map(b => ({
      id: b.id, type: 'bombeiro', nomeCompleto: b.nomeCompleto, nomeGuerra: b.nomeGuerra, cargo: b.cargo,
    }));
    const aOpts: PersonOption[] = apocs.map(a => ({
      id: a.id, type: 'apoc', nomeCompleto: a.nomeCompleto, nomeGuerra: a.nomeGuerra, funcao: a.funcao,
    }));
    return [...bOpts, ...aOpts];
  }, [bombeiros, apocs]);

  const autocompleteOptions = useMemo(() =>
    allPersons.map(p => ({
      label: p.nomeCompleto,
      sublabel: `${p.nomeGuerra} — ${p.type === 'bombeiro'
        ? CARGO_OPTIONS.find(c => c.value === p.cargo)?.label || p.cargo
        : FUNCAO_APOC_OPTIONS.find(f => f.value === p.funcao)?.label || p.funcao}`,
    })),
    [allPersons]
  );

  const linkedPerson = useMemo(() => {
    if (!personId || !personType) return null;
    return allPersons.find(p => p.id === personId && p.type === personType) || null;
  }, [personId, personType, allPersons]);

  function handleSelectPerson(label: string) {
    const person = allPersons.find(p => p.nomeCompleto === label);
    if (!person) return;

    setName(person.nomeCompleto);
    setPersonId(person.id);
    setPersonType(person.type);

    if (person.type === 'bombeiro' && person.cargo) {
      const mapped = cargoParaUserRole(person.cargo);
      if (mapped) setRole(mapped);
    } else if (person.type === 'apoc' && person.funcao) {
      setRole(apocParaUserRole(person.funcao));
    }
  }

  function handleUnlink() {
    setPersonId(undefined);
    setPersonType(undefined);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username || (!user && !password)) {
      setErro('Preencha todos os campos obrigatórios.');
      return;
    }
    if (!user && password.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    setErro('');
    const finalName = name || username;
    try {
      await onSave({ username, name: finalName, password, role, personId, personType });
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar usuário.');
    }
  }

  const input = 'w-full rounded-xl border border-graphite-300 bg-white px-3 py-2.5 text-sm text-graphite-900 transition-all duration-200 hover:border-graphite-400 focus:border-aviation-500 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:hover:border-graphite-500 dark:focus:border-aviation-400 dark:focus:bg-surface-elevated dark:focus:ring-aviation-400/10 dark:placeholder:text-graphite-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-surface-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-graphite-900 dark:text-graphite-100">
            {user ? 'Editar Usuário' : 'Novo Usuário'}
          </h2>
          <button onClick={onClose} className="rounded-xl p-1 text-graphite-400 transition-all hover:bg-graphite-100 hover:text-graphite-600 dark:hover:bg-surface-hover">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-graphite-700 dark:text-graphite-300">Nome Completo</label>
            {loadingPessoas ? (
              <input disabled value="Carregando pessoas..." className={input + ' cursor-not-allowed opacity-60'} />
            ) : (
              <Autocomplete
                value={name}
                onChange={handleSelectPerson}
                options={autocompleteOptions}
                placeholder="Buscar por nome de bombeiro ou APOC..."
                className={input}
              />
            )}
          </div>

          {linkedPerson && (
            <div className="flex items-center gap-3 rounded-xl border border-aviation-200 bg-aviation-50/50 px-3 py-2.5 dark:border-aviation-700 dark:bg-aviation-900/20">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-aviation-100 dark:bg-aviation-800">
                <User className="h-4 w-4 text-aviation-600 dark:text-aviation-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-graphite-900 dark:text-graphite-100 truncate">
                  {linkedPerson.nomeGuerra}
                </p>
                <p className="text-[11px] text-graphite-500 dark:text-graphite-400">
                  {linkedPerson.type === 'bombeiro'
                    ? CARGO_OPTIONS.find(c => c.value === linkedPerson.cargo)?.label || linkedPerson.cargo
                    : FUNCAO_APOC_OPTIONS.find(f => f.value === linkedPerson.funcao)?.label || linkedPerson.funcao}
                  {' · '}
                  <span className="uppercase">{linkedPerson.type === 'bombeiro' ? 'Bombeiro' : 'APOC'}</span>
                </p>
              </div>
              <button type="button" onClick={handleUnlink}
                className="rounded-lg p-1.5 text-graphite-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                title="Desvincular pessoa">
                <Unlink className="h-4 w-4" />
              </button>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-graphite-700 dark:text-graphite-300">Usuário (Login) *</label>
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder="nome.usuario"
              className={input} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-graphite-700 dark:text-graphite-300">
              Senha {user ? '(deixe em branco para manter)' : '*'}
            </label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres"
              className={input} />
          </div>

          {erro && <p className="text-sm text-alert-red dark:text-red-400">{erro}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="rounded-xl border border-graphite-300 bg-white px-4 py-2.5 text-sm font-medium text-graphite-700 transition-all hover:bg-graphite-50 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200 dark:hover:bg-surface-hover">
              Cancelar
            </button>
            <button type="submit"
              className="rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all hover:shadow-xl hover:from-aviation-500 hover:to-aviation-600 active:scale-[0.98]">
              {user ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
