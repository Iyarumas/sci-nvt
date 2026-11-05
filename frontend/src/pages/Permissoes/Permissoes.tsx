import { useEffect, useMemo, useState } from 'react';
import { Info, KeyRound, RotateCcw, Save } from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';
import {
  listarPermissoes,
  salvarPermissoes,
  type AlteracaoPermissao,
  type GradePermissoes,
  type NivelPermissao,
} from '../../services/permissoesService';

const NOME_NIVEL: Record<NivelPermissao, string> = {
  nenhum: 'Sem acesso',
  ver: 'Ver',
  equipe: 'Própria equipe',
  tudo: 'Editar tudo',
};

const DESCRICAO_NIVEL: Record<NivelPermissao, string> = {
  nenhum: 'Não vê a tela.',
  ver: 'Vê, mas não cria, edita nem exclui.',
  equipe: 'Cria e edita só o que é da própria equipe.',
  tudo: 'Cria, edita e exclui de todas as equipes.',
};

const COR_NIVEL: Record<NivelPermissao, string> = {
  nenhum: 'border-graphite-200 bg-graphite-50 text-graphite-500 dark:border-border-dark dark:bg-surface-hover dark:text-graphite-400',
  ver: 'border-aviation-200 bg-aviation-50 text-aviation-700 dark:border-aviation-800 dark:bg-aviation-900/20 dark:text-aviation-300',
  equipe: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
  tudo: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
};

const chave = (modulo: string, funcao: string) => `${modulo}|${funcao}`;

export default function Permissoes() {
  const [dados, setDados] = useState<GradePermissoes | null>(null);
  const [rascunho, setRascunho] = useState<Record<string, NivelPermissao>>({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    listarPermissoes()
      .then(setDados)
      .catch(err => setErro(err instanceof Error ? err.message : 'Não foi possível carregar as permissões.'))
      .finally(() => setCarregando(false));
  }, []);

  const alteracoes = useMemo<AlteracaoPermissao[]>(() => {
    if (!dados) return [];
    return Object.entries(rascunho)
      .filter(([k, nivel]) => {
        const [modulo, funcao] = k.split('|');
        return dados.grade[modulo]?.[funcao]?.nivel !== nivel;
      })
      .map(([k, nivel]) => {
        const [modulo, funcao] = k.split('|');
        return { modulo, funcao, nivel };
      });
  }, [rascunho, dados]);

  async function salvar() {
    if (!alteracoes.length) return;
    setSalvando(true);
    setErro('');
    try {
      setDados(await salvarPermissoes(alteracoes));
      setRascunho({});
      setAviso(`${alteracoes.length} permissão(ões) salva(s).`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível salvar as permissões.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <PageContainer>
      <PageTitle icon={KeyRound} title="Permissões" subtitle="O que cada função pode fazer em cada tela do sistema." />

      <div className="mb-4 flex gap-3 rounded-xl border border-aviation-200 bg-aviation-50 p-4 text-sm text-aviation-900 dark:border-aviation-800 dark:bg-aviation-900/20 dark:text-aviation-200">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          A grade começa com as regras que o sistema já usa hoje. Administrador e Desenvolvedor têm acesso total e não aparecem aqui.
          Nesta primeira etapa as alterações ficam registradas; na próxima, o servidor passa a cobrar o que estiver nesta grade.
        </p>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {(['nenhum', 'ver', 'equipe', 'tudo'] as NivelPermissao[]).map(nivel => (
          <div key={nivel} className={`rounded-xl border px-3 py-2 text-xs ${COR_NIVEL[nivel]}`}>
            <span className="block font-bold">{NOME_NIVEL[nivel]}</span>
            <span className="opacity-80">{DESCRICAO_NIVEL[nivel]}</span>
          </div>
        ))}
      </div>

      {erro && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">{erro}</div>}
      {aviso && !alteracoes.length && <div role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">{aviso}</div>}

      {carregando ? (
        <div role="status" className="flex items-center justify-center gap-3 py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-aviation-500 border-t-transparent" />
          <span>Carregando permissões...</span>
        </div>
      ) : dados && (
        <div className="overflow-x-auto rounded-2xl border border-graphite-200 bg-white dark:border-border-dark dark:bg-surface-card">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="bg-graphite-50 text-xs uppercase tracking-wider text-graphite-500 dark:bg-surface-hover dark:text-graphite-400">
              <tr>
                <th className="sticky left-0 z-10 bg-graphite-50 p-3 font-semibold dark:bg-surface-hover">Tela</th>
                {dados.funcoes.map(funcao => <th key={funcao} className="p-3 text-center font-semibold">{funcao}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-graphite-200 dark:divide-border-dark">
              {dados.modulos.map(modulo => (
                <tr key={modulo.chave}>
                  <th scope="row" className="sticky left-0 z-10 bg-white p-3 align-top font-normal dark:bg-surface-card">
                    <span className="block font-semibold text-graphite-900 dark:text-graphite-100">{modulo.nome}</span>
                    <span className="text-xs text-graphite-500 dark:text-graphite-400">{modulo.descricao}</span>
                  </th>
                  {dados.funcoes.map(funcao => {
                    const celula = dados.grade[modulo.chave][funcao];
                    const nivel = rascunho[chave(modulo.chave, funcao)] ?? celula.nivel;
                    const mudou = nivel !== celula.nivel;
                    const niveis = dados.niveis.filter(n => n !== 'equipe' || modulo.porEquipe);
                    const dica = [
                      celula.observacao,
                      celula.alteradoPor ? `Alterado por ${celula.alteradoPor} em ${new Date(celula.alteradoEm!).toLocaleString('pt-BR')}. Padrão: ${NOME_NIVEL[celula.padrao]}.` : null,
                    ].filter(Boolean).join(' ');
                    return (
                      <td key={funcao} className="p-2 text-center align-top">
                        <select
                          aria-label={`${modulo.nome} para ${funcao}`}
                          value={nivel}
                          onChange={e => {
                            setAviso('');
                            setRascunho(atual => ({ ...atual, [chave(modulo.chave, funcao)]: e.target.value as NivelPermissao }));
                          }}
                          className={`w-full min-w-[7.5rem] cursor-pointer rounded-lg border px-2 py-1.5 text-xs font-semibold dark:scheme-dark ${COR_NIVEL[nivel]} ${mudou ? 'ring-2 ring-aviation-500 ring-offset-1 dark:ring-offset-surface-card' : ''}`}
                        >
                          {/* A lista aberta não herda a cor do nível: texto neutro para ficar legível. */}
                          {niveis.map(n => (
                            <option key={n} value={n} className="bg-white font-medium text-graphite-900 dark:bg-surface-card dark:text-graphite-100">
                              {NOME_NIVEL[n]}
                            </option>
                          ))}
                        </select>
                        {(dica || celula.alteradoPor) && (
                          <span title={dica} className="mt-1 inline-flex cursor-help items-center gap-1 text-[11px] text-graphite-500 dark:text-graphite-400">
                            <Info className="h-3 w-3" /> {celula.alteradoPor ? 'Alterado' : 'Regra atual'}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {alteracoes.length > 0 && (
        <div className="sticky bottom-4 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-aviation-300 bg-white/95 p-4 shadow-lg backdrop-blur-sm dark:border-aviation-700 dark:bg-surface-elevated/95">
          <span className="text-sm font-medium text-graphite-700 dark:text-graphite-200">{alteracoes.length} alteração(ões) não salva(s)</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => setRascunho({})} disabled={salvando} className="flex items-center gap-2 rounded-xl border border-graphite-300/60 bg-white/80 px-4 py-2 text-sm font-medium text-graphite-700 hover:bg-graphite-50 disabled:opacity-60 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200">
              <RotateCcw className="h-4 w-4" /> Desfazer
            </button>
            <button type="button" onClick={salvar} disabled={salvando} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 hover:from-aviation-500 hover:to-aviation-600 disabled:opacity-60">
              <Save className="h-4 w-4" /> {salvando ? 'Salvando...' : 'Salvar permissões'}
            </button>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
