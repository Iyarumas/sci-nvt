import { useState, useEffect, useMemo } from 'react';
import { UserCircle, Save, Link, Unlink, Eye, EyeOff, Loader2, CheckCircle } from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';
import { useAuth, ROLE_LABELS, type UserRole } from '../../context/AuthContext';
import { Autocomplete } from '../../components/documentos/Autocomplete';
import { listarAtivos } from '../../services/bombeiroService';
import { listarAPOCs } from '../../services/apocService';
import { atualizarUsuario, atualizarSenha, verificarSenha } from '../../services/usuarioService';
import type { Bombeiro } from '../../types/bombeiro';
import type { APOC } from '../../types/apoc';
import { CARGO_OPTIONS } from '../../types/bombeiro';
import { FUNCAO_APOC_OPTIONS } from '../../types/apoc';

const USERS_KEY = 'sescinc-users';

function getStoredUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || '{}'); } catch { return {}; }
}

interface PersonOption {
  id: string;
  type: 'bombeiro' | 'apoc';
  nomeCompleto: string;
  nomeGuerra: string;
  cargo?: string;
  funcao?: string;
}

export function Perfil() {
  const { user } = useAuth();

  const [bombeiros, setBombeiros] = useState<Bombeiro[]>([]);
  const [apocs, setApocs] = useState<APOC[]>([]);
  const [loadingPessoas, setLoadingPessoas] = useState(true);

  const [personId, setPersonId] = useState<string | undefined>(user?.pessoa ? undefined : undefined);
  const [personType, setPersonType] = useState<'bombeiro' | 'apoc' | undefined>(undefined);
  const [personName, setPersonName] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  const [saving, setSaving] = useState(false);
  const [notif, setNotif] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

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
    if (!user) return;
    const users = getStoredUsers();
    const stored = users[user.username];
    if (stored?.personId && stored?.personType) {
      setPersonId(stored.personId);
      setPersonType(stored.personType);
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
    setPersonId(person.id);
    setPersonType(person.type);
    setPersonName(person.nomeCompleto);
  }

  function handleUnlink() {
    setPersonId(undefined);
    setPersonType(undefined);
    setPersonName('');
  }

  async function handleSavePerson() {
    if (!user) return;
    setSaving(true);
    try {
      const users = getStoredUsers();
      const stored = users[user.username];
      if (!stored) return;
      stored.personId = personId;
      stored.personType = personType;
      if (personId && personType && linkedPerson) {
        stored.name = linkedPerson.nomeCompleto;
      }
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
      try {
        await atualizarUsuario(user.username, { name: stored.name, role: stored.role, personId: stored.personId, personType: stored.personType });
      } catch { /* ignore */ }
      const sessionKey = 'sescinc-session';
      const session = JSON.parse(localStorage.getItem(sessionKey) || '{}');
      if (session.username === user.username) {
        session.name = stored.name;
        if (personId && personType && linkedPerson) {
          session.pessoa = {
            nomeGuerra: linkedPerson.nomeGuerra,
            funcao: linkedPerson.cargo || linkedPerson.funcao || '',
            foto: '',
            personType: linkedPerson.type,
          };
        } else {
          session.pessoa = undefined;
        }
        localStorage.setItem(sessionKey, JSON.stringify(session));
      }
      setNotif({ msg: 'Vinculo atualizado com sucesso!', type: 'success' });
      setTimeout(() => setNotif(null), 3000);
    } catch {
      setNotif({ msg: 'Erro ao salvar vínculo.', type: 'error' });
      setTimeout(() => setNotif(null), 3000);
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    if (!currentPassword || !newPassword || !confirmPassword) {
      setNotif({ msg: 'Preencha todos os campos de senha.', type: 'error' });
      setTimeout(() => setNotif(null), 3000);
      return;
    }
    if (newPassword.length < 6) {
      setNotif({ msg: 'A nova senha deve ter pelo menos 6 caracteres.', type: 'error' });
      setTimeout(() => setNotif(null), 3000);
      return;
    }
    if (newPassword !== confirmPassword) {
      setNotif({ msg: 'As senhas não coincidem.', type: 'error' });
      setTimeout(() => setNotif(null), 3000);
      return;
    }

    const senhaValida = await verificarSenha(user.username, currentPassword);
    if (!senhaValida) {
      setNotif({ msg: 'Senha atual incorreta.', type: 'error' });
      setTimeout(() => setNotif(null), 3000);
      return;
    }

    setSaving(true);
    try {
      await atualizarSenha(user.username, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setNotif({ msg: 'Senha alterada com sucesso!', type: 'success' });
      setTimeout(() => setNotif(null), 3000);
    } catch (err) {
      console.error('Erro ao alterar senha:', err);
      setNotif({ msg: 'Erro ao alterar senha. Verifique sua conexao.', type: 'error' });
      setTimeout(() => setNotif(null), 3000);
    } finally {
      setSaving(false);
    }
  }

  if (!user) return null;

  const pessoa = user.pessoa;
  const displayPhoto = pessoa?.foto || null;
  const displayName = pessoa?.nomeGuerra || user.name;
  const displayCargo = pessoa
    ? (pessoa.personType === 'bombeiro'
        ? CARGO_OPTIONS.find(c => c.value === pessoa.funcao)?.label || pessoa.funcao
        : FUNCAO_APOC_OPTIONS.find(f => f.value === pessoa.funcao)?.label || pessoa.funcao)
    : null;

  const input = 'w-full rounded-xl border border-graphite-300 bg-white px-3 py-2.5 text-sm text-graphite-900 transition-all duration-200 hover:border-graphite-400 focus:border-aviation-500 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:hover:border-graphite-500 dark:focus:border-aviation-400 dark:focus:bg-surface-elevated dark:focus:ring-aviation-400/10 dark:placeholder:text-graphite-500';

  return (
    <PageContainer>
      <PageTitle icon={UserCircle} title="Meu Perfil" />

      {notif && (
        <div className={`mb-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium ${
          notif.type === 'success'
            ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
            : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
        }`}>
          {notif.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <span className="h-4 w-4 flex items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">!</span>}
          {notif.msg}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Card perfil */}
        <div className="rounded-2xl border border-graphite-200 bg-white p-6 dark:border-border-dark dark:bg-surface-card">
          <h3 className="mb-4 text-lg font-bold text-graphite-900 dark:text-graphite-100">Informações do Perfil</h3>

          <div className="flex items-center gap-4 mb-6">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-aviation-500 to-aviation-700 text-xl font-bold text-white shadow-lg shadow-aviation-500/20">
              {displayPhoto ? (
                <img src={displayPhoto} className="h-full w-full object-cover" alt="" />
              ) : (
                displayName.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <p className="text-lg font-bold text-graphite-900 dark:text-graphite-100">{displayName}</p>
              {pessoa && pessoa.nomeGuerra !== user.name && (
                <p className="text-sm text-graphite-500 dark:text-graphite-400">{user.name}</p>
              )}
              <p className="text-xs text-graphite-400 dark:text-graphite-500">@{user.username}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-graphite-50 px-4 py-3 dark:bg-graphite-800/50">
              <span className="text-sm text-graphite-500 dark:text-graphite-400">Funcao do Sistema</span>
              <span className="text-sm font-semibold text-graphite-900 dark:text-graphite-100">{ROLE_LABELS[user.role as UserRole] || user.role}</span>
            </div>

            {displayCargo && (user.role === 'desenvolvedor' || user.role === 'admin') && (
              <div className="flex items-center justify-between rounded-xl bg-graphite-50 px-4 py-3 dark:bg-graphite-800/50">
                <span className="text-sm text-graphite-500 dark:text-graphite-400">Cargo/Funcao</span>
                <span className="text-sm font-semibold text-graphite-900 dark:text-graphite-100">{displayCargo}</span>
              </div>
            )}

            {pessoa && (
              <div className="flex items-center justify-between rounded-xl bg-graphite-50 px-4 py-3 dark:bg-graphite-800/50">
                <span className="text-sm text-graphite-500 dark:text-graphite-400">Tipo</span>
                <span className="text-sm font-semibold text-graphite-900 dark:text-graphite-100 uppercase">{pessoa.personType === 'bombeiro' ? 'Bombeiro' : 'APOC'}</span>
              </div>
            )}
          </div>
        </div>

        {/* Vincular pessoa */}
        <div className="rounded-2xl border border-graphite-200 bg-white p-6 dark:border-border-dark dark:bg-surface-card">
          <h3 className="mb-4 text-lg font-bold text-graphite-900 dark:text-graphite-100">
            <Link className="mr-2 inline h-5 w-5 text-aviation-600" />
            Vincular Pessoa
          </h3>
          <p className="mb-4 text-sm text-graphite-500 dark:text-graphite-400">
            {linkedPerson
              ? 'Sua conta está vinculada a uma pessoa. Você pode alterar o vínculo abaixo.'
              : 'Sua conta não está vinculada a nenhuma pessoa. Selecione um bombeiro ou APOC para vincular.'}
          </p>

          {loadingPessoas ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-aviation-500" />
              <span className="ml-2 text-sm text-graphite-500">Carregando pessoas...</span>
            </div>
          ) : (
            <>
              <div className="mb-3">
                <label className="mb-1 block text-sm font-medium text-graphite-700 dark:text-graphite-300">Buscar pessoa</label>
                <Autocomplete
                  value={personName}
                  onChange={handleSelectPerson}
                  options={autocompleteOptions}
                  placeholder="Buscar por nome completo..."
                  className={input}
                />
              </div>

              {linkedPerson && (
                <div className="mb-4 flex items-center gap-3 rounded-xl border border-aviation-200 bg-aviation-50/50 px-3 py-2.5 dark:border-aviation-700 dark:bg-aviation-900/20">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-aviation-100 dark:bg-aviation-800">
                    <UserCircle className="h-4 w-4 text-aviation-600 dark:text-aviation-400" />
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

              <button onClick={handleSavePerson} disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all hover:shadow-xl hover:from-aviation-500 hover:to-aviation-600 active:scale-[0.98] disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar Vinculo
              </button>
            </>
          )}
        </div>

        {/* Alterar senha */}
        <div className="rounded-2xl border border-graphite-200 bg-white p-6 dark:border-border-dark dark:bg-surface-card lg:col-span-2">
          <h3 className="mb-4 text-lg font-bold text-graphite-900 dark:text-graphite-100">Alterar Senha</h3>

          <form onSubmit={handleChangePassword} className="max-w-md space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-graphite-700 dark:text-graphite-300">Senha Atual *</label>
              <div className="relative">
                <input type={showCurrentPw ? 'text' : 'password'} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="Digite sua senha atual" className={input} />
                <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-graphite-400 hover:text-graphite-600 dark:hover:text-graphite-300">
                  {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-graphite-700 dark:text-graphite-300">Nova Senha *</label>
              <div className="relative">
                <input type={showNewPw ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  placeholder="Minimo 6 caracteres" className={input} />
                <button type="button" onClick={() => setShowNewPw(!showNewPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-graphite-400 hover:text-graphite-600 dark:hover:text-graphite-300">
                  {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-graphite-700 dark:text-graphite-300">Confirmar Nova Senha *</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha" className={input} />
            </div>

            <button type="submit" disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all hover:shadow-xl hover:from-aviation-500 hover:to-aviation-600 active:scale-[0.98] disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Alterar Senha
            </button>
          </form>
        </div>
      </div>
    </PageContainer>
  );
}

export default Perfil;
