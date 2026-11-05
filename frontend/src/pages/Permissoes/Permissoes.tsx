import { useEffect, useMemo, useState } from 'react';
import { Info, KeyRound, RotateCcw, Save, Search, UserCog, X } from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';
import {
  listarPermissoes,
  salvarPermissoes,
  type Alcance,
  type DadosPermissoes,
  type MudancaFuncao,
  type MudancaUsuario,
  type TelaCatalogo,
} from '../../services/permissoesService';
import { ComunicantesPermissao } from './ComunicantesPermissao';

const NOME_ALCANCE: Record<Alcance, string> = { nao: 'Não', equipe: 'Própria equipe', todas: 'Todas' };
const CURTO_ALCANCE: Record<Alcance, string> = { nao: 'Não', equipe: 'Equipe', todas: 'Todas' };
const COR_ALCANCE: Record<Alcance, string> = {
  nao: 'border-graphite-200 bg-graphite-50 text-graphite-500 dark:border-border-dark dark:bg-surface-hover dark:text-graphite-400',
  equipe: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
  todas: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
};
const PROXIMO: Record<Alcance, Alcance> = { nao: 'equipe', equipe: 'todas', todas: 'nao' };

type Aba = 'funcao' | 'usuario' | 'excecoes';

function Pilula({ alcance, onClick, destaque, titulo, compacto }: {
  alcance: Alcance; onClick?: () => void; destaque?: 'alterado' | 'excecao' | null; titulo?: string; compacto?: boolean;
}) {
  const anel = destaque === 'excecao' ? 'ring-2 ring-violet-400 ring-offset-1 dark:ring-offset-surface-card'
    : destaque === 'alterado' ? 'ring-2 ring-aviation-400 ring-offset-1 dark:ring-offset-surface-card' : '';
  return (
    <button type="button" onClick={onClick} title={titulo} disabled={!onClick}
      className={`inline-flex min-w-[4.5rem] items-center justify-center rounded-full border px-2 py-1 text-[11px] font-semibold transition-colors ${COR_ALCANCE[alcance]} ${anel} ${onClick ? 'hover:brightness-95 active:scale-[0.98]' : 'cursor-default'}`}>
      {compacto ? CURTO_ALCANCE[alcance] : NOME_ALCANCE[alcance]}
    </button>
  );
}

export default function Permissoes() {
  const [dados, setDados] = useState<DadosPermissoes | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [aba, setAba] = useState<Aba>('funcao');
  const [busca, setBusca] = useState('');
  const [usuarioId, setUsuarioId] = useState('');
  // Alterações ainda não salvas: "acao|funcao" → alcance; "usuarioId|acao" → alcance (null = tirar exceção).
  const [pendFuncao, setPendFuncao] = useState<Record<string, Alcance>>({});
  const [pendUsuario, setPendUsuario] = useState<Record<string, Alcance | null>>({});

  useEffect(() => {
    listarPermissoes()
      .then(d => { setDados(d); setUsuarioId(d.usuarios.find(u => !u.acessoTotal)?.id ?? ''); })
      .catch(err => setErro(err instanceof Error ? err.message : 'Não foi possível carregar as permissões.'))
      .finally(() => setCarregando(false));
  }, []);

  const telasFiltradas = useMemo(() => {
    if (!dados) return [] as TelaCatalogo[];
    const t = busca.trim().toLowerCase();
    if (!t) return dados.telas;
    return dados.telas.filter(tela => tela.nome.toLowerCase().includes(t) || tela.grupo.toLowerCase().includes(t)
      || tela.acoes.some(a => a.nome.toLowerCase().includes(t)));
  }, [dados, busca]);

  const grupos = useMemo(() => {
    const mapa = new Map<string, TelaCatalogo[]>();
    for (const tela of telasFiltradas) mapa.set(tela.grupo, [...(mapa.get(tela.grupo) ?? []), tela]);
    return [...mapa];
  }, [telasFiltradas]);

  if (carregando) {
    return <PageContainer><PageTitle icon={KeyRound} title="Permissões" /><p className="text-sm text-graphite-500">Carregando…</p></PageContainer>;
  }
  if (!dados) {
    return <PageContainer><PageTitle icon={KeyRound} title="Permissões" /><p className="text-sm text-red-600">{erro}</p></PageContainer>;
  }

  const nomeAcao = (acao: string) => {
    const [telaChave, acaoChave] = acao.split('.');
    const tela = dados.telas.find(t => t.chave === telaChave);
    return `${tela?.nome ?? telaChave} · ${tela?.acoes.find(a => a.chave === acaoChave)?.nome ?? acaoChave}`;
  };

  const alcanceFuncao = (acao: string, funcao: string): Alcance =>
    pendFuncao[`${acao}|${funcao}`] ?? dados.grade[acao][funcao].alcance;

  const excecaoSalva = (uid: string, acao: string) => dados.excecoes.find(e => e.usuarioId === uid && e.acao === acao) ?? null;
  const excecaoAtual = (uid: string, acao: string): Alcance | null => {
    const k = `${uid}|${acao}`;
    return k in pendUsuario ? pendUsuario[k] : excecaoSalva(uid, acao)?.alcance ?? null;
  };

  function mudarFuncao(acao: string, funcao: string) {
    const salvo = dados!.grade[acao][funcao].alcance;
    const novo = PROXIMO[alcanceFuncao(acao, funcao)];
    setPendFuncao(p => {
      const copia = { ...p };
      if (novo === salvo) delete copia[`${acao}|${funcao}`]; else copia[`${acao}|${funcao}`] = novo;
      return copia;
    });
    setAviso('');
  }

  function definirExcecao(uid: string, acao: string, alcance: Alcance | null) {
    const salvo = excecaoSalva(uid, acao)?.alcance ?? null;
    setPendUsuario(p => {
      const copia = { ...p };
      if (alcance === salvo) delete copia[`${uid}|${acao}`]; else copia[`${uid}|${acao}`] = alcance;
      return copia;
    });
    setAviso('');
  }

  /** Clique no usuário: Não → Equipe → Todas → volta para o que a função dá. */
  function mudarUsuario(uid: string, acao: string, daFuncao: Alcance) {
    const atual = excecaoAtual(uid, acao) ?? daFuncao;
    let novo: Alcance | null = PROXIMO[atual];
    if (excecaoAtual(uid, acao) !== null && novo === daFuncao) novo = null;
    if (excecaoAtual(uid, acao) === null && novo === daFuncao) novo = PROXIMO[novo];
    definirExcecao(uid, acao, novo === daFuncao ? null : novo);
  }

  const totalPendentes = Object.keys(pendFuncao).length + Object.keys(pendUsuario).length;

  async function salvar() {
    setSalvando(true);
    setErro('');
    try {
      const funcoes: MudancaFuncao[] = Object.entries(pendFuncao).map(([k, alcance]) => {
        const [acao, funcao] = k.split('|');
        return { acao, funcao, alcance };
      });
      const usuarios: MudancaUsuario[] = Object.entries(pendUsuario).map(([k, alcance]) => {
        const [uid, acao] = k.split('|');
        return { usuarioId: uid, acao, alcance };
      });
      setDados(await salvarPermissoes(funcoes, usuarios));
      setPendFuncao({});
      setPendUsuario({});
      setAviso('Permissões salvas.');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível salvar as permissões.');
    } finally {
      setSalvando(false);
    }
  }

  const usuariosGrade = dados.usuarios.filter(u => !u.acessoTotal);
  const usuario = usuariosGrade.find(u => u.id === usuarioId) ?? null;
  const excecoesLista = [
    ...dados.excecoes.filter(e => !(`${e.usuarioId}|${e.acao}` in pendUsuario)).map(e => ({ ...e, pendente: false })),
    ...Object.entries(pendUsuario).filter(([, a]) => a !== null).map(([k, alcance]) => {
      const [uid, acao] = k.split('|');
      return { usuarioId: uid, acao, alcance: alcance as Alcance, alteradoPor: '', alteradoEm: '', pendente: true };
    }),
  ];

  const abaBtn = (id: Aba, rotulo: string) => (
    <button key={id} type="button" role="tab" aria-selected={aba === id} onClick={() => setAba(id)}
      className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${aba === id
        ? 'bg-white text-graphite-900 shadow-sm dark:bg-surface-elevated dark:text-graphite-100'
        : 'text-graphite-500 hover:text-graphite-800 dark:text-graphite-400 dark:hover:text-graphite-200'}`}>
      {rotulo}
    </button>
  );

  return (
    <PageContainer>
      <PageTitle icon={KeyRound} title="Permissões" subtitle="O que cada função e cada usuário pode fazer em cada tela." />

      <div className="mb-4 flex gap-2 rounded-xl border border-aviation-200 bg-aviation-50/60 px-4 py-3 text-sm text-aviation-800 dark:border-aviation-800/50 dark:bg-aviation-900/15 dark:text-aviation-200">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          A grade começa com as regras que o sistema já usa hoje. Administrador e Desenvolvedor têm acesso total e não aparecem aqui.
          <strong> Nesta primeira etapa as alterações ficam registradas, mas ainda não mudam o que cada pessoa consegue fazer</strong>;
          nas próximas, as telas e o servidor passam a seguir esta grade.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div role="tablist" className="inline-flex rounded-xl border border-graphite-200 bg-graphite-50 p-1 dark:border-border-dark dark:bg-surface-card">
          {abaBtn('funcao', 'Por função')}
          {abaBtn('usuario', 'Por usuário')}
          {abaBtn('excecoes', `Exceções (${excecoesLista.length})`)}
        </div>
        {aba !== 'excecoes' && (
          <div className="relative min-w-[14rem] flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite-400" />
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Procurar tela ou ação"
              className="w-full rounded-xl border border-graphite-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-aviation-500 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100" />
          </div>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2 text-xs text-graphite-500 dark:text-graphite-400">
          {(['nao', 'equipe', 'todas'] as Alcance[]).map(a => <Pilula key={a} alcance={a} />)}
        </div>
      </div>

      {erro && <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300">{erro}</p>}
      {aviso && <p className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-300">{aviso}</p>}

      {/* ───── Por função ───── */}
      {aba === 'funcao' && (
        <div className="space-y-6">
          <p className="text-xs text-graphite-500 dark:text-graphite-400">Clique numa célula para trocar entre Não, Própria equipe e Todas. Contorno azul = diferente do padrão (regra de hoje).</p>
          {grupos.map(([grupo, telas]) => (
            <section key={grupo}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">{grupo}</h3>
              <div className="space-y-3">
                {telas.map(tela => (
                  <div key={tela.chave} className="overflow-x-auto rounded-2xl border border-graphite-200 bg-white dark:border-border-dark dark:bg-surface-card">
                    {/* Larguras fixas: a coluna de cada função fica no mesmo lugar em todas as telas. */}
                    <table className="w-full min-w-[720px] table-fixed text-sm">
                      <colgroup>
                        <col className="w-56" />
                        {dados.funcoes.map(f => <col key={f} />)}
                      </colgroup>
                      <thead>
                        <tr className="border-b border-graphite-200 bg-graphite-50 dark:border-border-dark dark:bg-surface-elevated">
                          <th className="px-4 py-2 text-left font-semibold text-graphite-900 dark:text-graphite-100">{tela.nome}</th>
                          {dados.funcoes.map(f => <th key={f} className="px-1 py-2 text-center text-xs font-semibold text-graphite-500 dark:text-graphite-400">{f}</th>)}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-graphite-100 dark:divide-border-dark">
                        {tela.acoes.map(a => {
                          const acao = `${tela.chave}.${a.chave}`;
                          return (
                            <tr key={acao}>
                              <td className="px-4 py-1.5 text-graphite-700 dark:text-graphite-200">{a.nome}</td>
                              {dados.funcoes.map(f => {
                                const celula = dados.grade[acao][f];
                                const atual = alcanceFuncao(acao, f);
                                const titulo = [
                                  celula.observacao,
                                  atual !== celula.padrao ? `Padrão: ${NOME_ALCANCE[celula.padrao]}` : null,
                                  celula.alteradoPor ? `Alterado por ${celula.alteradoPor}` : null,
                                ].filter(Boolean).join(' · ') || undefined;
                                return (
                                  <td key={f} className="px-1 py-1.5">
                                    {/* Espaço do ⓘ reservado em todas as células: as pílulas ficam alinhadas na coluna. */}
                                    <div className="flex items-center justify-center gap-0.5">
                                      <span className="w-2.5 shrink-0" aria-hidden />
                                      <Pilula compacto alcance={atual} onClick={() => mudarFuncao(acao, f)} titulo={titulo}
                                        destaque={atual !== celula.padrao ? 'alterado' : null} />
                                      <span className={`w-2.5 shrink-0 select-none self-start text-[10px] leading-none text-graphite-400 ${celula.observacao ? 'cursor-help' : ''}`}
                                        title={celula.observacao ?? undefined}>
                                        {celula.observacao ? 'ⓘ' : ''}
                                      </span>
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* ───── Por usuário ───── */}
      {aba === 'usuario' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-graphite-200 bg-white p-4 dark:border-border-dark dark:bg-surface-card">
            <UserCog className="h-5 w-5 text-aviation-600" />
            <select value={usuarioId} onChange={e => setUsuarioId(e.target.value)}
              className="min-w-[16rem] rounded-xl border border-graphite-300 bg-white px-3 py-2 text-sm dark:border-border-dark dark:bg-surface-card dark:text-graphite-100">
              {usuariosGrade.map(u => <option key={u.id} value={u.id}>{u.nome} ({u.username})</option>)}
            </select>
            {usuario && (
              <span className="text-sm text-graphite-500 dark:text-graphite-400">
                {usuario.funcao ? `${usuario.funcao}${usuario.equipe ? ` · Equipe ${usuario.equipe}` : ''}` : 'Sem função: só vale o que tiver exceção'}
              </span>
            )}
            <span className="ml-auto text-xs text-graphite-500 dark:text-graphite-400">Contorno roxo = exceção só para este usuário. Clique para mudar; voltando ao da função, a exceção sai.</span>
          </div>

          {usuario && grupos.map(([grupo, telas]) => (
            <section key={grupo}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">{grupo}</h3>
              <div className="overflow-x-auto rounded-2xl border border-graphite-200 bg-white dark:border-border-dark dark:bg-surface-card">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b border-graphite-200 bg-graphite-50 text-xs text-graphite-500 dark:border-border-dark dark:bg-surface-elevated dark:text-graphite-400">
                      <th className="px-4 py-2 text-left font-semibold">Tela · ação</th>
                      <th className="px-2 py-2 text-center font-semibold">Pela função{usuario.funcao ? ` (${usuario.funcao})` : ''}</th>
                      <th className="px-2 py-2 text-center font-semibold">Para este usuário</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-graphite-100 dark:divide-border-dark">
                    {telas.flatMap(tela => tela.acoes.map(a => {
                      const acao = `${tela.chave}.${a.chave}`;
                      const daFuncao: Alcance = usuario.funcao ? alcanceFuncao(acao, usuario.funcao) : 'nao';
                      const exc = excecaoAtual(usuario.id, acao);
                      const vale = exc ?? daFuncao;
                      return (
                        <tr key={acao}>
                          <td className="px-4 py-1.5 text-graphite-700 dark:text-graphite-200"><span className="font-medium">{tela.nome}</span> · {a.nome}</td>
                          <td className="px-2 py-1.5 text-center"><Pilula alcance={daFuncao} /></td>
                          <td className="px-2 py-1.5 text-center">
                            <Pilula alcance={vale} onClick={() => mudarUsuario(usuario.id, acao, daFuncao)} destaque={exc !== null ? 'excecao' : null} />
                            {exc !== null && (
                              <button type="button" onClick={() => definirExcecao(usuario.id, acao, null)} title="Voltar ao da função"
                                className="ml-1 rounded p-0.5 text-graphite-400 hover:text-graphite-700"><RotateCcw className="inline h-3.5 w-3.5" /></button>
                            )}
                          </td>
                        </tr>
                      );
                    }))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}

      {/* ───── Exceções ───── */}
      {aba === 'excecoes' && (
        <div className="overflow-x-auto rounded-2xl border border-graphite-200 bg-white dark:border-border-dark dark:bg-surface-card">
          {excecoesLista.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-graphite-500">Nenhuma exceção: todo mundo segue a própria função.</p>
          ) : (
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-graphite-200 bg-graphite-50 text-xs text-graphite-500 dark:border-border-dark dark:bg-surface-elevated dark:text-graphite-400">
                  <th className="px-4 py-2 text-left font-semibold">Usuário</th>
                  <th className="px-2 py-2 text-left font-semibold">Tela · ação</th>
                  <th className="px-2 py-2 text-center font-semibold">Pela função</th>
                  <th className="px-2 py-2 text-center font-semibold">Exceção</th>
                  <th className="px-2 py-2 text-left font-semibold">Quem / quando</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-100 dark:divide-border-dark">
                {excecoesLista.map(e => {
                  const u = dados.usuarios.find(x => x.id === e.usuarioId);
                  const daFuncao: Alcance = u?.funcao ? alcanceFuncao(e.acao, u.funcao) : 'nao';
                  return (
                    <tr key={`${e.usuarioId}|${e.acao}`}>
                      <td className="px-4 py-2 text-graphite-900 dark:text-graphite-100">{u?.nome ?? e.usuarioId}<span className="ml-1 text-xs text-graphite-400">{u?.funcao ?? 'sem função'}</span></td>
                      <td className="px-2 py-2 text-graphite-700 dark:text-graphite-200">{nomeAcao(e.acao)}</td>
                      <td className="px-2 py-2 text-center"><Pilula alcance={daFuncao} /></td>
                      <td className="px-2 py-2 text-center"><Pilula alcance={e.alcance} destaque="excecao" /></td>
                      <td className="px-2 py-2 text-xs text-graphite-500">
                        {e.pendente ? 'Ainda não salva' : `${e.alteradoPor} · ${new Date(e.alteradoEm).toLocaleDateString('pt-BR')}`}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <button type="button" onClick={() => definirExcecao(e.usuarioId, e.acao, null)} title="Tirar exceção"
                          className="rounded-lg p-1.5 text-graphite-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"><X className="h-4 w-4" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {totalPendentes > 0 && (
        <div className="sticky bottom-4 z-20 mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-aviation-200 bg-white px-4 py-3 shadow-lg dark:border-aviation-800/50 dark:bg-surface-elevated">
          <span className="text-sm font-medium text-graphite-800 dark:text-graphite-100">{totalPendentes} alteração(ões) não salva(s)</span>
          <button type="button" onClick={() => { setPendFuncao({}); setPendUsuario({}); }}
            className="ml-auto rounded-xl border border-graphite-300 px-3 py-2 text-sm font-medium text-graphite-700 hover:bg-graphite-50 dark:border-border-dark dark:text-graphite-200">
            Descartar
          </button>
          <button type="button" onClick={salvar} disabled={salvando}
            className="flex items-center gap-2 rounded-xl bg-aviation-600 px-4 py-2 text-sm font-medium text-white hover:bg-aviation-500 disabled:opacity-60">
            <Save className="h-4 w-4" /> {salvando ? 'Salvando…' : 'Salvar permissões'}
          </button>
        </div>
      )}

      <ComunicantesPermissao />
    </PageContainer>
  );
}
