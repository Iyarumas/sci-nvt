import { useState, useEffect } from 'react';
import { Radio, Search, Plus, Pencil, Trash2, Lock } from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';
import { useAuth } from '../../context/AuthContext';
import { APOCForm } from './APOCForm';
import { listarAPOCs, buscarAPOC, criarAPOC, atualizarAPOC, excluirAPOC } from '../../services/apocService';
import type { APOC } from '../../types/apoc';
import { useDebounce } from '../../hooks/useDebounce';
import { AlertModal } from '../../components/ui/AlertModal';
import { PageTour } from '../../components/ui/PageTour';
import { capitalizarNome } from '../../utils/capitalize';
import { podeVerCadastroCompletoBase, resolverContextoOperacional } from '../../utils/permissoes';

const APOCS_TOUR_STEPS = [
  {
    selector: 'main h1',
    title: 'Cadastro de APOC',
    body: 'Esta página reúne o pessoal do Centro de Operações Aeroportuárias. No sistema, esses usuários aparecem como equipe MOTIVA e função APOC/MOTIVA.',
    detail: 'Manter nome, e-mail, equipe e função corretos ajuda na identificação de responsáveis, documentos e vínculos com equipamentos quando o cadastro for usado em outras telas.',
  },
  {
    selector: 'main p',
    title: 'Aviso da função MOTIVA',
    body: 'Este aviso lembra que os registros desta tela representam o pessoal do Centro de Operações Aeroportuárias.',
    detail: 'Diferente dos bombeiros das equipes Alfa, Bravo, Charlie e Delta, o APOC não entra na escala operacional diária como BA, mas pode aparecer como pessoa vinculada ou referência administrativa.',
  },
  {
    selector: 'main input',
    title: 'Busca de APOC',
    body: 'A busca filtra por nome ou e-mail para localizar rapidamente um membro do APOC.',
    detail: 'Use quando precisar conferir se a pessoa já existe antes de criar um novo cadastro, evitando duplicidade de nomes ou e-mails.',
  },
  {
    selector: 'main button',
    title: 'Novo APOC',
    body: 'O botão Novo APOC abre o formulário para cadastrar um membro do Centro de Operações Aeroportuárias.',
    detail: 'O cadastro deve conter principalmente nome de guerra, nome completo, e-mail e função. Esses dados aparecem na tabela e podem ser usados em vínculos internos.',
  },
  {
    selector: 'main table',
    title: 'Tabela de APOCs',
    body: 'A tabela mostra nome de guerra, nome completo, e-mail, equipe e função de cada APOC cadastrado.',
    detail: 'Na coluna Ações, o lápis edita o registro e a lixeira exclui, quando o usuário atual tem permissão administrativa.',
  },
];

export function APOCs() {
  const { user } = useAuth();

  const [apocs, setApocs] = useState<APOC[]>([]);
  const [canManageCadastro, setCanManageCadastro] = useState(() => podeVerCadastroCompletoBase(user));
  const [termo, setTermo] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<APOC | null>(null);
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
      setApocs([]);
      return;
    }
    carregar();
  }, [canManageCadastro, debouncedTermo]);

  async function carregar() {
    setApocs(debouncedTermo ? await buscarAPOC(debouncedTermo) : await listarAPOCs());
  }

  async function handleSave(data: Omit<APOC, 'id' | 'createdAt' | 'updatedAt'>) {
    if (!canManageCadastro) return;
    try {
      if (editando) {
        await atualizarAPOC(editando.id, data);
      } else {
        await criarAPOC(data);
      }
      setFormOpen(false);
      setEditando(null);
      carregar();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar');
    }
  }

  async function handleDelete(id: string) {
    if (!canManageCadastro) return;
    if (deleting) return;
    setDeleting(true);
    try {
      await excluirAPOC(id);
      setConfirmDelete(null);
      setDeleteError('');
      carregar();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Erro ao excluir');
    } finally {
      setDeleting(false);
    }
  }

  function capitalize(str: string) {
    return capitalizarNome(str);
  }

  if (!canManageCadastro) {
    return (
      <PageContainer>
        <PageTitle icon={Radio} title="APOC - Centro de Operacoes Aeroportuarias" />
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300/60 bg-white/50 p-12 text-center backdrop-blur-sm dark:border-border-dark dark:bg-surface-card">
          <Lock className="mb-4 h-12 w-12 text-graphite-300 dark:text-graphite-600" />
          <h3 className="mb-2 text-lg font-semibold text-graphite-700 dark:text-graphite-300">Acesso Restrito</h3>
          <p className="text-sm text-graphite-400">Apenas Administradores e GS podem acessar o cadastro de APOC.</p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mb-6 flex items-center justify-between">
        <PageTitle icon={Radio} title="APOC - Centro de Operações Aeroportuárias" />
      </div>

      <div className="mb-4 rounded-xl border border-aviation-200/50 bg-aviation-50/50 px-4 py-3 dark:border-aviation-700/30 dark:bg-aviation-900/20">
        <p className="text-sm text-aviation-700 dark:text-aviation-300">
          Pessoal do <strong>Centro de Operações Aeroportuárias</strong> — todos possuem a função <strong>MOTIVA</strong>.
        </p>
      </div>

      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite-400" />
          <input
            type="text"
            value={termo}
            onChange={e => setTermo(e.target.value)}
            placeholder="Pesquisar por nome ou e-mail..."
            className="w-full rounded-xl border border-graphite-300/60 bg-white/70 py-2.5 pl-10 pr-4 text-sm text-graphite-900 placeholder-graphite-400 outline-none transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated"
          />
        </div>
        {canManageCadastro && (
          <button
            onClick={() => { setEditando(null); setFormOpen(true); }}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all duration-200 hover:shadow-xl hover:shadow-aviation-500/30 hover:from-aviation-500 hover:to-aviation-600 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            Novo APOC
          </button>
        )}
      </div>

      {apocs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300/60 bg-white/50 p-12 text-center backdrop-blur-sm dark:border-border-dark dark:bg-surface-card">
          <Radio className="mb-4 h-12 w-12 text-graphite-300 dark:text-graphite-600" />
          <h3 className="mb-2 text-lg font-semibold text-graphite-700 dark:text-graphite-300">
            Nenhum APOC cadastrado
          </h3>
          <p className="text-sm text-graphite-400">
            Clique em "Novo APOC" para adicionar o primeiro membro do APOC.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-graphite-200/60 bg-white/80 backdrop-blur-sm dark:border-border-dark dark:bg-surface-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-graphite-200 bg-graphite-50 text-left dark:border-graphite-700 dark:bg-graphite-800">
                <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Nome de Guerra</th>
                <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Nome Completo</th>
                <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">E-mail</th>
                <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Equipe</th>
                <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Função</th>
                {canManageCadastro && <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {apocs.map(a => (
                <tr key={a.id} className="border-b border-graphite-100 transition-colors hover:bg-graphite-50 dark:border-graphite-700 dark:hover:bg-graphite-700/50">
                  <td className="px-4 py-3 font-medium text-graphite-900 dark:text-graphite-100">{capitalize(a.nomeGuerra)}</td>
                  <td className="px-4 py-3 text-graphite-700 dark:text-graphite-300">{capitalize(a.nomeCompleto)}</td>
                  <td className="px-4 py-3 text-graphite-700 dark:text-graphite-300">{a.email}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-aviation-50 px-2.5 py-0.5 text-xs font-medium text-aviation-700 dark:bg-aviation-900/30 dark:text-aviation-300">
                      {a.equipe || 'MOTIVA'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                      {a.funcao}
                    </span>
                  </td>
                  {canManageCadastro && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setEditando(a); setFormOpen(true); }}
                          className="rounded-xl p-1.5 text-graphite-400 transition-all duration-200 hover:bg-graphite-100 hover:text-graphite-600 dark:hover:bg-surface-hover dark:hover:text-graphite-300"
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(a.id)}
                          className="rounded-xl p-1.5 text-alert-red transition-all duration-200 hover:bg-red-50 dark:hover:bg-red-900/20"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formOpen && (
        <APOCForm
          apoc={editando}
          onSave={handleSave}
          onClose={() => { setFormOpen(false); setEditando(null); }}
          serverError={saveError}
        />
      )}

      <AlertModal
        open={!!confirmDelete}
        title="Confirmar exclusão"
        message="Tem certeza que deseja excluir este membro do APOC?"
        variant="danger"
        confirmLabel="Excluir"
        loadingLabel="Excluindo..."
        loading={deleting}
        error={deleteError}
        onClose={() => { if (!deleting) { setConfirmDelete(null); setDeleteError(''); } }}
        onConfirm={() => confirmDelete ? handleDelete(confirmDelete) : undefined}
      />

      <PageTour
        steps={APOCS_TOUR_STEPS}
        targetAttribute="data-apocs-tour"
        title="Abrir tutorial de APOC"
        detailLabel="Uso no sistema"
      />
    </PageContainer>
  );
}

export default APOCs;
