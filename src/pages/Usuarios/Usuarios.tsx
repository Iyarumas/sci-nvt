import { useState, useEffect } from 'react';
import { UserCog, Search, Plus, Pencil, Trash2, Lock, ShieldCheck, ShieldOff, Link2, Copy, CheckCheck, Sparkles, AlertTriangle, LinkIcon, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { criarConvite, listarConvites, type Convite } from '../../services/conviteService';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';
import { useAuth } from '../../context/AuthContext';
import { ROLE_LABELS, cargoParaUserRole, apocParaUserRole, type UserRole } from '../../context/AuthContext';
import type { StoredUser } from '../../context/AuthContext';
import { UsuarioForm } from './UsuarioForm';
import { listarAtivos } from '../../services/bombeiroService';
import { listarAPOCs } from '../../services/apocService';
import {
  listarUsuarios as listarUsuariosDb,
  criarUsuarioComHash,
  atualizarUsuario,
  excluirUsuario,
  atualizarSenha,
} from '../../services/usuarioService';
import type { Bombeiro } from '../../types/bombeiro';
import type { APOC } from '../../types/apoc';
import { CARGO_OPTIONS } from '../../types/bombeiro';
import { FUNCAO_APOC_OPTIONS } from '../../types/apoc';
import { podeVerCadastroCompletoBase, resolverContextoOperacional } from '../../utils/permissoes';

const ROLE_BADGE: Record<string, string> = {
  desenvolvedor: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
  admin: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
  gerente: 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400',
  chefe: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
  lider: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
  bombeiro: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
};

function CountdownTimer({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, new Date(expiresAt).getTime() - Date.now()));

  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => {
      const diff = Math.max(0, new Date(expiresAt).getTime() - Date.now());
      setRemaining(diff);
      if (diff <= 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt, remaining]);

  if (remaining <= 0) return <span className="text-[11px] font-bold text-red-500">Expirado</span>;

  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  const totalMin = h * 60 + m;
  const urgent = totalMin < 30;

  return (
    <span className={`font-mono text-xs font-bold tabular-nums ${urgent ? 'text-red-500 animate-pulse' : totalMin < 60 ? 'text-amber-500' : 'text-graphite-500 dark:text-graphite-400'}`}>
      {h > 0 ? `${h}h ` : ''}{String(m).padStart(2, '0')}m {String(s).padStart(2, '0')}s
    </span>
  );
}

export function Usuarios() {
  const { user } = useAuth();

  const [usuarios, setUsuarios] = useState<[string, StoredUser][]>([]);
  const [canManageCadastro, setCanManageCadastro] = useState(() => podeVerCadastroCompletoBase(user));
  const [termo, setTermo] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<{ username: string; name: string; role?: UserRole; previousRole?: UserRole; personId?: string; personType?: 'bombeiro' | 'apoc' } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [convites, setConvites] = useState<Convite[]>([]);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  const [bombeiros, setBombeiros] = useState<Bombeiro[]>([]);
  const [apocs, setApocs] = useState<APOC[]>([]);

  useEffect(() => {
    let cancelled = false;
    setCanManageCadastro(podeVerCadastroCompletoBase(user));

    resolverContextoOperacional(user)
      .then(contexto => {
        if (!cancelled) setCanManageCadastro(contexto.isAdministradorSistema || contexto.canManageGlobal);
      })
      .catch(() => {
        if (!cancelled) setCanManageCadastro(podeVerCadastroCompletoBase(user));
      });

    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!canManageCadastro) {
      setBombeiros([]);
      setApocs([]);
      return;
    }

    Promise.all([listarAtivos(), listarAPOCs()]).then(([b, a]) => {
      setBombeiros(b);
      setApocs(a);
    }).catch(() => {});
  }, [canManageCadastro]);

  function resolvePerson(data: StoredUser) {
    if (!data.personId || !data.personType) return null;
    if (data.personType === 'bombeiro') {
      return bombeiros.find(b => b.id === data.personId) || null;
    }
    return apocs.find(a => a.id === data.personId) || null;
  }

  function migrarRole(d: StoredUser): StoredUser {
    if (d.role === 'admin_master' as string) d.role = 'desenvolvedor' as UserRole;
    if (d.previousRole === 'admin_master' as string) d.previousRole = 'desenvolvedor' as UserRole;
    return d;
  }

  async function carregar() {
    try {
      const remote = await listarUsuariosDb();
      const entries: [string, StoredUser][] = remote.map(u => [
        u.username,
        migrarRole({ name: u.name, role: u.role as UserRole, previousRole: u.previousRole as UserRole | undefined, personId: u.personId, personType: u.personType }),
      ]);
      if (termo) {
        const t = termo.toLowerCase();
        setUsuarios(entries.filter(([u, d]) =>
          u.includes(t) || d.name.toLowerCase().includes(t) || (ROLE_LABELS[d.role] || '').toLowerCase().includes(t) || (d.previousRole ? (ROLE_LABELS[d.previousRole] || '').toLowerCase().includes(t) : false)
        ));
      } else {
        setUsuarios(entries);
      }
    } catch (err) {
      console.error('Erro ao carregar usuarios:', err);
      setUsuarios([]);
      setMensagem({ tipo: 'erro', texto: 'Erro ao conectar com o servidor. Verifique sua conexao.' });
      setTimeout(() => setMensagem(null), 5000);
    }
  }

  useEffect(() => {
    if (!canManageCadastro) {
      setUsuarios([]);
      return;
    }
    carregar();
  }, [canManageCadastro, termo]);

  useEffect(() => {
    if (!canManageCadastro) {
      setConvites([]);
      return;
    }
    listarConvites().then(setConvites);
  }, [canManageCadastro]);

  async function copiarUrl(codigo: string) {
    const url = `${window.location.origin}/cadastro/convite/${codigo}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(codigo);
      setTimeout(() => setCopiado(null), 3000);
    } catch {
      const el = document.createElement('textarea');
      el.value = url;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopiado(codigo);
      setTimeout(() => setCopiado(null), 3000);
    }
  }

  async function handleGerarConvite() {
    if (!canManageCadastro) return;
    const convite = await criarConvite();
    const lista = await listarConvites();
    setConvites(lista);
    await copiarUrl(convite.codigo);
  }

  function handleCopiarLink(codigo: string) {
    copiarUrl(codigo);
  }

  async function handleSave(data: { username: string; name: string; password: string; role: UserRole; personId?: string; personType?: 'bombeiro' | 'apoc' }) {
    if (!canManageCadastro) return;
    try {
      if (editando) {
        if (data.role === 'desenvolvedor' && user?.role !== 'desenvolvedor') {
          setMensagem({ tipo: 'erro', texto: 'Apenas desenvolvedores podem atribuir o papel de desenvolvedor.' });
          return;
        }
        if (editando.role === 'desenvolvedor' && user?.role !== 'desenvolvedor') {
          setMensagem({ tipo: 'erro', texto: 'Apenas desenvolvedores podem editar desenvolvedores.' });
          return;
        }
        if (data.role === 'admin' && user?.role !== 'desenvolvedor') {
          setMensagem({ tipo: 'erro', texto: 'Apenas desenvolvedores podem editar administradores.' });
          return;
        }

        const previousRole = (data.role === 'admin' && editando.role !== 'admin')
          ? editando.role
          : (data.role !== 'admin' ? undefined : editando.previousRole);

        if (data.username !== editando.username) {
          await excluirUsuario(editando.username);
        }
        await atualizarUsuario(data.username, {
          name: data.name,
          role: data.role,
          previousRole,
          personId: data.personId,
          personType: data.personType,
        });
        if (data.password) {
          await atualizarSenha(data.username, data.password);
        }
      } else {
        if (data.role === 'desenvolvedor' && user?.role !== 'desenvolvedor') {
          setMensagem({ tipo: 'erro', texto: 'Apenas desenvolvedores podem atribuir o papel de desenvolvedor.' });
          return;
        }
        if (data.role === 'admin' && user?.role !== 'desenvolvedor') {
          setMensagem({ tipo: 'erro', texto: 'Apenas desenvolvedores podem criar administradores.' });
          return;
        }
        await criarUsuarioComHash({
          username: data.username,
          name: data.name,
          password: data.password,
          role: data.role,
          personId: data.personId,
          personType: data.personType,
        });
      }
      setFormOpen(false);
      setEditando(null);
      setMensagem({ tipo: 'sucesso', texto: editando ? 'Usuario atualizado com sucesso!' : 'Usuario criado com sucesso!' });
      setTimeout(() => setMensagem(null), 4000);
      carregar();
    } catch (err) {
      console.error('Erro ao salvar usuario:', err);
      setMensagem({ tipo: 'erro', texto: 'Erro ao salvar. Verifique sua conexao.' });
      setTimeout(() => setMensagem(null), 4000);
    }
  }

  async function handleDelete(username: string) {
    if (!canManageCadastro) return;
    if (username === 'serra') return;
    try {
      await excluirUsuario(username);
      setConfirmDelete(null);
      carregar();
    } catch (err) {
      console.error('Erro ao excluir usuario:', err);
      setMensagem({ tipo: 'erro', texto: 'Erro ao excluir. Verifique sua conexao.' });
      setTimeout(() => setMensagem(null), 4000);
    }
  }

  async function handleToggleAdmin(username: string) {
    if (!canManageCadastro) return;
    if (username === 'serra') return;
    try {
      const remote = await listarUsuariosDb();
      const target = remote.find(u => u.username === username);
      if (!target) return;

      if (target.role === 'desenvolvedor') return;

      let newRole: UserRole;
      let newPreviousRole: UserRole | undefined;

      if (target.role === 'admin') {
        newRole = (target.previousRole as UserRole) || 'sem_funcao';
        newPreviousRole = undefined;
      } else {
        newRole = 'admin';
        newPreviousRole = target.role as UserRole;
      }

      await atualizarUsuario(username, {
        name: target.name,
        role: newRole,
        previousRole: newPreviousRole,
      });

      carregar();
    } catch (err) {
      console.error('Erro ao alterar role:', err);
      setMensagem({ tipo: 'erro', texto: 'Erro ao alterar permissao. Verifique sua conexao.' });
      setTimeout(() => setMensagem(null), 4000);
    }
  }

  if (!canManageCadastro) {
    return (
      <PageContainer>
        <PageTitle icon={UserCog} title="Usuários" />
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300 bg-white p-12 text-center dark:border-border-dark dark:bg-surface-card">
          <Lock className="mb-4 h-12 w-12 text-graphite-300 dark:text-graphite-600" />
          <h3 className="mb-2 text-lg font-semibold text-graphite-700 dark:text-graphite-300">Acesso Restrito</h3>
          <p className="text-sm text-graphite-400 dark:text-graphite-500">Apenas administradores podem gerenciar usuários.</p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mb-6 flex items-center justify-between">
        <PageTitle icon={UserCog} title="Usuários" />
      </div>

      {mensagem && (
        <div className={`mb-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
          mensagem.tipo === 'sucesso'
            ? 'border border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400'
            : 'border border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400'
        }`}>
          {mensagem.tipo === 'sucesso' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          {mensagem.texto}
        </div>
      )}

      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite-400" />
          <input
            type="text"
            value={termo}
            onChange={e => setTermo(e.target.value)}
            placeholder="Pesquisar por usuário, nome ou função..."
            className="w-full rounded-xl border border-graphite-300 bg-white py-2.5 pl-10 pr-4 text-sm text-graphite-900 placeholder-graphite-400 outline-none transition-all hover:border-graphite-400 focus:border-aviation-500 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:hover:border-graphite-500 dark:focus:border-aviation-400 dark:focus:bg-surface-elevated dark:focus:ring-aviation-400/10 dark:placeholder:text-graphite-500"
          />
        </div>
        <button
          onClick={() => { setEditando(null); setFormOpen(true); }}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all hover:shadow-xl hover:from-aviation-500 hover:to-aviation-600 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" /> Novo Usuário
        </button>
      </div>

      {usuarios.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300 bg-white p-12 text-center dark:border-border-dark dark:bg-surface-card">
          <UserCog className="mb-4 h-12 w-12 text-graphite-300 dark:text-graphite-600" />
          <h3 className="mb-2 text-lg font-semibold text-graphite-700 dark:text-graphite-300">Nenhum usuário cadastrado</h3>
          <p className="text-sm text-graphite-400 dark:text-graphite-500">Clique em "Novo Usuário" para criar o primeiro acesso.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-graphite-200 bg-white dark:border-border-dark dark:bg-surface-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-graphite-200 bg-graphite-50 text-left dark:border-border-dark dark:bg-graphite-900">
                <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Nome Completo</th>
                <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Usuário</th>
                <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Função</th>
                <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Ações</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map(([username, data]) => {
                const person = resolvePerson(data);
                const personFoto = person && 'foto' in person ? (person as Bombeiro).foto : undefined;
                const personGuerra = person && 'nomeGuerra' in person ? (person as Bombeiro | APOC).nomeGuerra : undefined;
                const personCargo = person && 'cargo' in person
                  ? CARGO_OPTIONS.find(c => c.value === (person as Bombeiro).cargo)?.label
                  : person && 'funcao' in person
                    ? FUNCAO_APOC_OPTIONS.find(f => f.value === (person as APOC).funcao)?.label
                    : undefined;

                const personRole = person && 'cargo' in person && person.cargo
                  ? cargoParaUserRole(person.cargo)
                  : person && 'funcao' in person && person.funcao
                    ? apocParaUserRole(person.funcao)
                    : undefined;

                const isViewerDevOrAdmin = user?.role === 'desenvolvedor' || user?.role === 'admin';
                const isTargetAdmin = data.role === 'admin';
                const isTargetDev = data.role === 'desenvolvedor';
                const isSelf = username === user?.username;
                const isProtegido = username === 'serra';

                const displayRole: UserRole = isTargetAdmin && !isViewerDevOrAdmin && !isSelf
                  ? (data.previousRole as UserRole) || 'sem_funcao'
                  : data.role;

                const canEditThis = isProtegido ? isSelf : (isTargetDev ? isViewerDevOrAdmin : (isViewerDevOrAdmin || (!isSelf && data.role !== 'admin')));
                const canDeleteThis = !isProtegido && (isTargetDev ? isViewerDevOrAdmin : (isViewerDevOrAdmin || (!isSelf && data.role !== 'admin')));
                const canToggleAdminThis = isViewerDevOrAdmin && !isTargetDev && !isSelf;

                return (
                <tr key={username} className="border-b border-graphite-100 transition-colors hover:bg-graphite-50 dark:border-border-dark dark:hover:bg-surface-hover/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-aviation-500 to-aviation-700 text-xs font-bold text-white">
                        {personFoto ? (
                          <img src={personFoto} className="h-full w-full object-cover" alt="" />
                        ) : (
                          username.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-graphite-900 dark:text-graphite-100 truncate">
                          {data.name && data.name !== username ? data.name : username}
                        </p>
                        {personGuerra ? (
                          <p className="text-[11px] text-graphite-500 dark:text-graphite-400 truncate">{personGuerra}</p>
                        ) : (
                          <p className="flex items-center gap-1 text-[11px] text-amber-500 dark:text-amber-400">
                            <AlertTriangle className="h-3 w-3" />
                            Sem vínculo — aguardando admin
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-graphite-600 dark:text-graphite-400">{username}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${ROLE_BADGE[displayRole] || ROLE_BADGE.chefe}`}>
                        {ROLE_LABELS[displayRole] || displayRole}
                      </span>
                      {data.role === 'admin' && data.previousRole && (isViewerDevOrAdmin || isSelf) && (
                        <span className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${ROLE_BADGE[data.previousRole] || ROLE_BADGE.chefe}`}>
                          {ROLE_LABELS[data.previousRole] || data.previousRole}
                        </span>
                      )}
                      {data.role === 'desenvolvedor' && personRole && (
                        <span className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${ROLE_BADGE[personRole] || ROLE_BADGE.chefe}`}>
                          {ROLE_LABELS[personRole] || personRole}
                        </span>
                      )}
                      {!data.personId && (
                        <span className="flex items-center gap-1 text-[11px] text-amber-500 dark:text-amber-400">
                          <LinkIcon className="h-3 w-3" />
                          Não vinculado
                        </span>
                      )}
                    </div>
                  </td>
                   <td className="px-4 py-3">
                     <div className="flex items-center gap-1">
                       {canEditThis && (
                         <button
                           onClick={() => { setEditando({ username, name: data.name, role: data.role, previousRole: data.previousRole, personId: data.personId, personType: data.personType }); setFormOpen(true); }}
                           className="rounded-xl p-1.5 text-graphite-400 transition-all hover:bg-graphite-100 hover:text-graphite-600 dark:hover:bg-surface-hover dark:hover:text-graphite-300"
                           title="Editar"
                         >
                           <Pencil className="h-4 w-4" />
                         </button>
                       )}
                       {canToggleAdminThis && data.role !== 'admin' && (
                         <button
                           onClick={() => handleToggleAdmin(username)}
                           className="rounded-xl p-1.5 text-amber-500 transition-all hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-900/20 dark:hover:text-amber-400"
                           title="Tornar Administrador"
                         >
                           <ShieldCheck className="h-4 w-4" />
                         </button>
                       )}
                       {canToggleAdminThis && data.role === 'admin' && (
                         <button
                           onClick={() => handleToggleAdmin(username)}
                           className="rounded-xl p-1.5 text-graphite-400 transition-all hover:bg-graphite-100 hover:text-graphite-600 dark:hover:bg-surface-hover dark:hover:text-graphite-300"
                           title="Remover Admin"
                         >
                           <ShieldOff className="h-4 w-4" />
                         </button>
                       )}
                       {canDeleteThis && (
                         <button
                           onClick={() => setConfirmDelete(username)}
                           className="rounded-xl p-1.5 text-alert-red transition-all hover:bg-red-50 dark:hover:bg-red-900/20"
                           title="Excluir"
                         >
                           <Trash2 className="h-4 w-4" />
                         </button>
                       )}
                     </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8 rounded-2xl border border-graphite-200 bg-white p-5 dark:border-border-dark dark:bg-surface-card">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30">
              <Link2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-graphite-900 dark:text-graphite-100">Convites</h3>
              <p className="text-xs text-graphite-500">Links de acesso para novos usuários</p>
            </div>
          </div>
          <button
            onClick={handleGerarConvite}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-purple-700 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-purple-500/20 transition-all hover:shadow-xl hover:from-purple-500 hover:to-purple-600 active:scale-[0.98]"
          >
            <Sparkles className="h-4 w-4" /> Gerar Convite
          </button>
        </div>

        {convites.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-graphite-300 bg-graphite-50/50 py-8 text-center dark:border-border-dark dark:bg-surface-hover/30">
            <Link2 className="mb-3 h-8 w-8 text-graphite-300 dark:text-graphite-600" />
            <p className="text-sm text-graphite-500 dark:text-graphite-400">Nenhum convite gerado ainda.</p>
            <p className="text-xs text-graphite-400 dark:text-graphite-500">Clique em "Gerar Convite" para criar um link de acesso.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {convites.map(c => {
              const expirado = !c.usado && new Date(c.expiresAt).getTime() < Date.now();
              return (
              <div
                key={c.codigo}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-all ${
                  c.usado
                    ? 'border-green-200 bg-green-50/50 dark:border-green-800/30 dark:bg-green-900/10'
                    : expirado
                      ? 'border-red-200 bg-red-50/50 dark:border-red-800/30 dark:bg-red-900/10'
                      : 'border-graphite-200 bg-white dark:border-border-dark dark:bg-surface-card'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    c.usado ? 'bg-green-100 dark:bg-green-900/30' : expirado ? 'bg-red-100 dark:bg-red-900/30' : 'bg-purple-100 dark:bg-purple-900/30'
                  }`}>
                    {c.usado
                      ? <CheckCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
                      : expirado
                        ? <Clock className="h-4 w-4 text-red-500 dark:text-red-400" />
                        : <Link2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    }
                  </div>
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-bold tracking-wider text-graphite-900 dark:text-graphite-100">
                      {c.codigo}
                    </p>
                    <p className="text-xs text-graphite-500">
                      {c.usado
                        ? `Usado em ${new Date(c.usadoEm!).toLocaleDateString('pt-BR')} por ${c.registradoPor}`
                        : expirado
                          ? `Expirou`
                          : `Criado em ${new Date(c.createdAt).toLocaleDateString('pt-BR')}`
                      }
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {c.usado ? (
                    <span className="rounded-full bg-green-100 px-3 py-1 text-[11px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      Utilizado
                    </span>
                  ) : expirado ? (
                    <span className="rounded-full bg-red-100 px-3 py-1 text-[11px] font-medium text-red-600 dark:bg-red-900/30 dark:text-red-400">
                      Expirado
                    </span>
                  ) : (
                    <>
                      <CountdownTimer expiresAt={c.expiresAt} />
                      <span className="rounded-full bg-purple-100 px-3 py-1 text-[11px] font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                        Ativo
                      </span>
                      <button
                        onClick={() => handleCopiarLink(c.codigo)}
                        className="flex items-center gap-1.5 rounded-lg border border-graphite-200 bg-white px-3 py-1.5 text-xs font-medium text-graphite-600 transition-all hover:bg-graphite-50 dark:border-border-dark dark:bg-surface-card dark:hover:bg-surface-hover"
                      >
                        {copiado === c.codigo ? (
                          <><CheckCheck className="h-3.5 w-3.5 text-green-500" /> Copiado</>
                        ) : (
                          <><Copy className="h-3.5 w-3.5" /> Copiar Link</>
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      {formOpen && (
        <UsuarioForm
          user={editando}
          onSave={handleSave}
          onClose={() => { setFormOpen(false); setEditando(null); }}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-surface-card">
            <h3 className="mb-2 text-lg font-bold text-graphite-900 dark:text-graphite-100">Confirmar exclusão</h3>
            <p className="mb-6 text-sm text-graphite-500 dark:text-graphite-400">Tem certeza que deseja excluir este usuário? Ele não poderá mais acessar o sistema.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(null)}
                className="rounded-xl border border-graphite-300 bg-white px-4 py-2.5 text-sm font-medium text-graphite-700 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200">Cancelar</button>
              <button onClick={() => handleDelete(confirmDelete)}
                className="rounded-xl bg-gradient-to-r from-alert-red to-red-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-red-500/20 transition-all hover:shadow-xl hover:shadow-red-500/30 active:scale-[0.98]">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

export default Usuarios;
