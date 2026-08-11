import { useState, useEffect } from 'react';
import { Shield, Search, Plus, Pencil, Trash2, AlertCircle, Lock } from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';
import { useAuth } from '../../context/AuthContext';
import { listarBombeiros, buscarBombeiro, criarBombeiro, atualizarBombeiro, excluirBombeiro } from '../../services/bombeiroService';
import type { Bombeiro } from '../../types/bombeiro';
import { CARGO_OPTIONS, EQUIPE_OPTIONS, ABBR_CARGO, getHorarioTrabalho } from '../../types/bombeiro';
import { BombeiroForm } from './BombeiroForm';
import { useDebounce } from '../../hooks/useDebounce';
import { AlertModal } from '../../components/ui/AlertModal';
import { capitalizarNome } from '../../utils/capitalize';
import { podeVerCadastroCompletoBase, resolverContextoOperacional } from '../../utils/permissoes';

export function Bombeiros() {
  const { user } = useAuth();

  const [bombeiros, setBombeiros] = useState<Bombeiro[]>([]);
  const [canManageCadastro, setCanManageCadastro] = useState(() => podeVerCadastroCompletoBase(user));
  const [termo, setTermo] = useState('');
  const [filterEquipe, setFilterEquipe] = useState('');
  const [filterCargo, setFilterCargo] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<Bombeiro | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const debouncedTermo = useDebounce(termo, 400);

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
      return;
    }
    carregar();
  }, [canManageCadastro, debouncedTermo, filterEquipe, filterCargo]);

  if (!canManageCadastro) {
    return (
      <PageContainer>
        <PageTitle icon={Shield} title="Bombeiros" />
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300/60 bg-white/50 p-12 text-center backdrop-blur-sm dark:border-border-dark dark:bg-surface-card">
          <Lock className="mb-4 h-12 w-12 text-graphite-300 dark:text-graphite-600" />
          <h3 className="mb-2 text-lg font-semibold text-graphite-700 dark:text-graphite-300">
            Acesso Restrito
          </h3>
          <p className="text-sm text-graphite-400">
            Apenas Administradores e GS podem acessar o cadastro de bombeiros.
          </p>
        </div>
      </PageContainer>
    );
  }

  async function carregar() {
    let lista = debouncedTermo ? await buscarBombeiro(debouncedTermo) : await listarBombeiros();
    if (filterEquipe) lista = lista.filter(b => b.equipe === filterEquipe);
    if (filterCargo) lista = lista.filter(b => b.cargo === filterCargo);
    setBombeiros(lista);
  }

  async function handleSave(data: Omit<Bombeiro, 'id' | 'createdAt' | 'updatedAt'>) {
    if (!canManageCadastro) return;
    try {
      setSaveError('');
      if (editando) {
        await atualizarBombeiro(editando.id, data);
      } else {
        await criarBombeiro(data);
      }
      setFormOpen(false);
      setEditando(null);
      carregar();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar');
    }
  }

  function handleEdit(b: Bombeiro) {
    if (!canManageCadastro) return;
    setEditando(b);
    setFormOpen(true);
  }

  function capitalize(str: string) {
    return capitalizarNome(str);
  }

  function labelCargo(valor: string) {
    const found = CARGO_OPTIONS.find(o => o.value === valor);
    return found ? found.label : valor;
  }

  async function handleDelete(id: string) {
    if (!canManageCadastro) return;
    if (deleting) return;
    setDeleting(true);
    try {
      await excluirBombeiro(id);
      setConfirmDelete(null);
      setDeleteError('');
      carregar();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Erro ao excluir');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <PageContainer>
      <div className="mb-6 flex items-center justify-between">
        <PageTitle icon={Shield} title="Bombeiros" />
      </div>

      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite-400" />
            <input
              type="text"
              value={termo}
              onChange={e => setTermo(e.target.value)}
              placeholder="Pesquisar por matrícula, nome, CPF..."
              className="w-full rounded-xl border border-graphite-300/60 bg-white/70 py-2.5 pl-10 pr-4 text-sm text-graphite-900 placeholder-graphite-400 outline-none transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-graphite-600 dark:bg-graphite-800 dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-graphite-700"
            />
          </div>
          <select
            value={filterEquipe}
            onChange={e => setFilterEquipe(e.target.value)}
            className="rounded-xl border border-graphite-300/60 bg-white/70 px-3 py-2.5 text-sm text-graphite-700 outline-none transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-graphite-600 dark:bg-graphite-800 dark:text-graphite-200 dark:focus:border-aviation-400/50 dark:focus:bg-graphite-700 dark:focus:text-graphite-100"
          >
            <option value="">Todas as Equipes</option>
            {EQUIPE_OPTIONS.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          <select
            value={filterCargo}
            onChange={e => setFilterCargo(e.target.value)}
            className="rounded-xl border border-graphite-300/60 bg-white/70 px-3 py-2.5 text-sm text-graphite-700 outline-none transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-graphite-600 dark:bg-graphite-800 dark:text-graphite-200 dark:focus:border-aviation-400/50 dark:focus:bg-graphite-700 dark:focus:text-graphite-100"
          >
            <option value="">Todos os Cargos</option>
            {CARGO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <button
          onClick={() => { setEditando(null); setFormOpen(true); }}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all duration-200 hover:shadow-xl hover:shadow-aviation-500/30 hover:from-aviation-500 hover:to-aviation-600 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          Novo Cadastro
        </button>
      </div>

      {bombeiros.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300/60 bg-white/50 p-12 text-center backdrop-blur-sm dark:border-border-dark dark:bg-surface-card">
          <Shield className="mb-4 h-12 w-12 text-graphite-300 dark:text-graphite-600" />
          <h3 className="mb-2 text-lg font-semibold text-graphite-700 dark:text-graphite-300">
            Nenhum bombeiro cadastrado
          </h3>
          <p className="text-sm text-graphite-400">
            Clique em "Novo Cadastro" para adicionar o primeiro bombeiro.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-graphite-200/60 bg-white/80 backdrop-blur-sm dark:border-border-dark dark:bg-surface-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-graphite-200 bg-graphite-50 text-left dark:border-border-dark dark:bg-surface-card">
                <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Matrícula</th>
                <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Nome</th>
                <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Nome de Guerra</th>
                <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Cargo</th>
                <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Função Abrev.</th>
                <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Equipe</th>
                <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Horário</th>
                <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Turno</th>
                <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Situação</th>
                <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Ações</th>
              </tr>
            </thead>
            <tbody>
              {bombeiros.map(b => (
                <tr key={b.id} className="border-b border-graphite-100 transition-colors hover:bg-graphite-50 dark:border-border-dark dark:hover:bg-surface-hover/50">
                  <td className="px-4 py-3 font-medium text-graphite-900 dark:text-graphite-100">{b.matricula}</td>
                  <td className="px-4 py-3 text-graphite-700 dark:text-graphite-300">{capitalize(b.nomeCompleto)}</td>
                  <td className="px-4 py-3 text-graphite-700 dark:text-graphite-300">{capitalize(b.nomeGuerra)}</td>
                  <td className="px-4 py-3 text-graphite-700 dark:text-graphite-300">{labelCargo(b.cargo)}</td>
                  <td className="px-4 py-3 text-graphite-700 dark:text-graphite-300">{ABBR_CARGO[b.cargo] || b.cargo}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-aviation-50 px-2.5 py-0.5 text-xs font-medium text-aviation-700 dark:bg-aviation-900/30 dark:text-aviation-300">
                      {b.equipe}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-graphite-700 dark:text-graphite-300">{getHorarioTrabalho(b.equipe, b.cargo)}</td>
                  <td className="px-4 py-3 text-graphite-700 dark:text-graphite-300">{b.turno}</td>
                  <td className="px-4 py-3">
                    {b.dataDesligamento ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-alert-red dark:bg-red-900/20">
                        <AlertCircle className="h-3 w-3" />
                        Inativo
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-status-green/10 px-2.5 py-0.5 text-xs font-medium text-status-green">
                        Ativo
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEdit(b)}
                        className="rounded-xl p-1.5 text-graphite-400 transition-all duration-200 hover:bg-graphite-100 hover:text-graphite-600 dark:hover:bg-surface-hover dark:hover:text-graphite-300"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {canManageCadastro && (
                        <button
                          onClick={() => setConfirmDelete(b.id)}
                          className="rounded-xl p-1.5 text-alert-red transition-all duration-200 hover:bg-red-50 dark:hover:bg-red-900/20"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formOpen && (
        <BombeiroForm
          bombeiro={editando}
          onSave={handleSave}
          onClose={() => { setFormOpen(false); setEditando(null); }}
          serverError={saveError}
        />
      )}

      <AlertModal
        open={!!confirmDelete}
        title="Confirmar exclusão"
        message="Tem certeza que deseja excluir este bombeiro? Esta ação não pode ser desfeita."
        variant="danger"
        confirmLabel="Excluir"
        loadingLabel="Excluindo..."
        loading={deleting}
        error={deleteError}
        onClose={() => { if (!deleting) { setConfirmDelete(null); setDeleteError(''); } }}
        onConfirm={() => confirmDelete ? handleDelete(confirmDelete) : undefined}
      />

    </PageContainer>
  );
}

export default Bombeiros;
