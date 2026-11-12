import { useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { listarBombeiros } from '../../services/bombeiroService';
import { listarFeriasGozo } from '../../services/feriasService';
import { listarSubstituicoesTemporarias } from '../../services/substituicaoTemporariaService';
import { listarTrocasServicoAssinadas } from '../../services/efetivoOperacionalService';
import { listarVigencias } from '../../services/vigenciaSubstituicaoService';
import type { Bombeiro } from '../../types/bombeiro';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';
import { useContextoOperacional } from '../../hooks/useContextoOperacional';
import { listarCompletas } from '../../services/escalaMensalService';
import { obterFimPlantao, obterFimPlantaoAnterior, salvarFimPlantao } from '../../services/fimPlantaoService';
import { obterInicioPlantao } from '../../services/inicioPlantaoService';
import {
  CHECKLIST_PADRAO,
  DESPEDIDA_PADRAO,
  HIDROMETRO,
  type DadosFimPlantao,
  type FimPlantaoSalvo,
  type HorarioRadio,
  type ItemChecklistPlantao,
  type MovimentacaoPlantao,
  type TesteSirene,
} from '../../types/fimPlantao';
import type { EscalaMensalCompleta } from '../../types/escalaMensal';
import { hojeLocalISO, mesmoDiaISO } from '../../utils/datas';
import {
  escalaMensalDoPlantao,
  montarEfetivoOperacional,
  montarExtrasAfastamentoDoDia,
  montarTrocasServicoDoDia,
} from '../../utils/efetivoOperacional';
import { montarMensagemFimPlantao } from '../../utils/mensagemFimPlantao';
import { isComunicante } from '../../utils/permissoes';
import { listarOcorrencias } from '../../services/ocorrenciaService';
import { listarConferencias } from '../../services/conferenciaService';
import type { Ocorrencia } from '../../types/ocorrencia';
import type { Conferencia } from '../../types/conferencia';
import {
  escalaRadioDasOcorrencias,
  movimentacoesDoPlantao,
  dataDoPlantaoAtual,
  ordemNoPlantao,
  type MovimentacaoAutomatica,
} from '../../utils/plantaoRegistros';
import { cardPlantao as card, PainelMensagemPlantao, tituloCardPlantao as tituloCard } from './PainelMensagemPlantao';

const EQUIPES = ['Alfa', 'Bravo', 'Charlie', 'Delta'] as const;
const input = 'w-full rounded-xl border border-graphite-300/60 bg-white/70 px-3 py-2.5 text-base sm:py-2 sm:text-sm transition-all focus:border-aviation-500/50 focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:scheme-dark';
const label = 'mb-1 block text-xs font-semibold text-graphite-600 dark:text-graphite-300';
const botaoAdicionar = 'mt-3 flex min-h-11 items-center gap-2 rounded-xl border border-dashed border-aviation-400/60 px-4 py-2.5 sm:min-h-0 sm:py-2 text-sm font-semibold text-aviation-700 transition-colors hover:bg-aviation-50 dark:text-aviation-300 dark:hover:bg-aviation-900/20';
const botaoRemover = 'shrink-0 rounded-lg p-3 sm:p-2 text-graphite-400 transition-colors hover:bg-red-500/10 hover:text-alert-red';

const SIRENE_VAZIA: TesteSirene = { hora: '', naoHouve: false };

/** Pessoas do plantão para a escala de rádio: efetivo do dia (com férias, extras e trocas) e os demais. */
interface PessoasDoDia {
  efetivo: string[];
  outros: string[];
  /** Nome de guerra de quem saiu → de quem entrou no lugar (troca ou extra). */
  troca: Map<string, string>;
  trocasTexto: string[];
}

async function carregarPessoasDoDia(equipe: string, data: string): Promise<PessoasDoDia> {
  const [bombeiros, gozos, substituicoes, completas, vigencias, trocaFills] = await Promise.all([
    listarBombeiros().catch(() => [] as Bombeiro[]),
    listarFeriasGozo({ equipe }).catch(() => []),
    listarSubstituicoesTemporarias().catch(() => []),
    listarCompletas().catch(() => [] as EscalaMensalCompleta[]),
    listarVigencias({ ativa: true }).catch(() => []),
    listarTrocasServicoAssinadas().catch(() => []),
  ]);
  const ativos = bombeiros.filter(b => !b.dataDesligamento);
  const efetivo = montarEfetivoOperacional({
    bombeiros, feriasGozo: gozos, vigencias, trocaFills, escalasCompletas: completas,
    substituicoesTemporarias: substituicoes, equipe, dataPlantao: data,
  }).map(e => e.bombeiro.nomeGuerra).filter(Boolean);
  const guerraPorNome = new Map(ativos.map(b => [b.nomeCompleto.trim().toLowerCase(), b.nomeGuerra]));
  const guerra = (nome: string) => guerraPorNome.get(nome.trim().toLowerCase()) || nome;
  const troca = new Map<string, string>();
  const trocasTexto: string[] = [];
  for (const t of montarTrocasServicoDoDia({ bombeiros, trocaFills, vigencias, feriasGozo: gozos, escalasCompletas: completas, equipe, dataPlantao: data })) {
    troca.set(guerra(t.nomeSaindo), guerra(t.nomeEntrando));
    trocasTexto.push(`${guerra(t.nomeSaindo)} → ${guerra(t.nomeEntrando)}`);
  }
  for (const x of montarExtrasAfastamentoDoDia({ bombeiros, substituicoes, vigencias, equipe, dataPlantao: data })) {
    troca.set(x.ausente.nomeGuerra, x.substituto.nomeGuerra);
    trocasTexto.push(`${x.ausente.nomeGuerra} → ${x.substituto.nomeGuerra}`);
  }
  const doDia = [...new Set(efetivo)].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const outros = [...new Set(ativos.map(b => b.nomeGuerra).filter(n => n && !doDia.includes(n)))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  return { efetivo: doDia, outros, troca, trocasTexto };
}

const DIGITAR = '__digitar__';

/** Quem fica no rádio: escolhe do efetivo do dia, dos outros bombeiros, ou digita. */
function SeletorRadio({ rotulo, valor, pessoas, onChange }: {
  rotulo: string; valor: string; pessoas: PessoasDoDia | null; onChange: (v: string) => void;
}) {
  const todos = [...(pessoas?.efetivo ?? []), ...(pessoas?.outros ?? [])];
  const [digitando, setDigitando] = useState(!!valor && !!pessoas && !todos.includes(valor));
  useEffect(() => {
    if (pessoas && valor && !todos.includes(valor)) setDigitando(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pessoas]);
  if (digitando || !pessoas) {
    return (
      <div className="flex min-w-0 items-center gap-1.5">
        <input aria-label={rotulo} value={valor} onChange={e => onChange(e.target.value)} placeholder="Nome de guerra" className={input} />
        {pessoas && (
          <button type="button" onClick={() => { setDigitando(false); if (!todos.includes(valor)) onChange(''); }}
            className="min-h-11 shrink-0 rounded-lg px-3 py-2 text-xs font-semibold text-aviation-600 hover:bg-aviation-50 sm:min-h-0 sm:px-2 dark:text-aviation-300 dark:hover:bg-aviation-900/20">
            Lista
          </button>
        )}
      </div>
    );
  }
  return (
    <select aria-label={rotulo} value={valor} className={input}
      onChange={e => { if (e.target.value === DIGITAR) { setDigitando(true); onChange(''); } else onChange(e.target.value); }}>
      <option value="">Selecione</option>
      {pessoas.efetivo.length > 0 && <optgroup label="Efetivo do dia">{pessoas.efetivo.map(n => <option key={n} value={n}>{n}</option>)}</optgroup>}
      {pessoas.outros.length > 0 && <optgroup label="Outros bombeiros">{pessoas.outros.map(n => <option key={n} value={n}>{n}</option>)}</optgroup>}
      <option value={DIGITAR}>✎ Digitar outro nome…</option>
    </select>
  );
}

/** Teste de sirene: hora, ou "Não houve" (aí não precisa da hora). */
function LinhaSirene({ titulo, quando, valor, onChange }: {
  titulo: string; quando: string; valor: TesteSirene; onChange: (v: TesteSirene) => void;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_7rem_auto] items-center gap-2 border-t border-graphite-100 py-2 first:border-t-0 dark:border-border-dark">
      <div className="min-w-0">
        <p className="text-sm font-medium text-graphite-900 dark:text-graphite-100">{titulo}</p>
        <p className="text-xs text-graphite-500 dark:text-graphite-400">{quando}</p>
      </div>
      <input type="time" aria-label={`Hora do ${titulo}`} value={valor.naoHouve ? '' : valor.hora} disabled={valor.naoHouve}
        onChange={e => onChange({ hora: e.target.value, naoHouve: false })} className={`${input} disabled:opacity-50`} />
      <button type="button" aria-pressed={valor.naoHouve} onClick={() => onChange({ hora: '', naoHouve: !valor.naoHouve })}
        className={`flex min-h-11 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition-colors sm:min-h-0 sm:py-2 ${valor.naoHouve
          ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-800/60 dark:bg-red-900/20 dark:text-red-300'
          : 'border-graphite-300/60 text-graphite-600 hover:bg-graphite-50 dark:border-border-dark dark:text-graphite-300 dark:hover:bg-surface-hover'}`}>
        <X className="h-4 w-4" /> Não houve
      </button>
    </div>
  );
}

function vazio(): DadosFimPlantao {
  return {
    checklist: CHECKLIST_PADRAO.map(item => ({ ...item })),
    radio: [],
    sireneApoc: { ...SIRENE_VAZIA },
    sireneTorre: { ...SIRENE_VAZIA },
    movimentacoes: [],
    despedida: DESPEDIDA_PADRAO,
  };
}

export default function FimPlantao() {
  const { equipeEfetiva, user } = useContextoOperacional();
  const equipeTravada = isComunicante(user) && !!equipeEfetiva;
  const [data, setData] = useState(hojeLocalISO());
  const [equipe, setEquipe] = useState('');
  const [dados, setDados] = useState<DadosFimPlantao>(vazio);
  const [salvo, setSalvo] = useState<FimPlantaoSalvo | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [recarregar, setRecarregar] = useState(0);
  const [automaticas, setAutomaticas] = useState<MovimentacaoAutomatica[]>([]);
  const [origemRadio, setOrigemRadio] = useState<'ocorrencia' | 'mensal' | ''>('');
  /** Escala de rádio lançada em LRO/Ocorrências para este plantão (pode chegar depois de salvo). */
  const [radioLancado, setRadioLancado] = useState<HorarioRadio[]>([]);

  useEffect(() => {
    if (!equipe && equipeEfetiva && (EQUIPES as readonly string[]).includes(equipeEfetiva)) {
      setEquipe(equipeEfetiva);
      // De madrugada, quem é da noite ainda está no plantão do dia anterior.
      setData(dataDoPlantaoAtual(equipeEfetiva));
    }
  }, [equipeEfetiva, equipe]);

  // Já salvo: abre como está. Se não: rádio da escala mensal, hidrômetro do início de plantão
  // e o que seguia com alteração no relatório anterior (ex.: anteparo inoperante).
  useEffect(() => {
    if (!equipe || !data) return;
    let cancelado = false;
    setCarregando(true);
    setErro('');
    (async () => {
      try {
        const existente = await obterFimPlantao(data, equipe);
        if (cancelado) return;
        if (existente) {
          setSalvo(existente);
          setDados({ ...vazio(), ...existente.dados });
          setOrigemRadio('');
          return;
        }
        setSalvo(null);
        const [completas, inicio, anterior, ocorrencias] = await Promise.all([
          listarCompletas().catch(() => [] as EscalaMensalCompleta[]),
          obterInicioPlantao(data, equipe).catch(() => null),
          obterFimPlantaoAnterior(data).catch(() => null),
          listarOcorrencias().catch(() => [] as Ocorrencia[]),
        ]);
        if (cancelado) return;
        // Rádio: a escala que o comunicante lançou em LRO/Ocorrências; sem ela, a escala mensal.
        const radioLancado = escalaRadioDasOcorrencias({ ocorrencias, equipe, dataPlantao: data });
        const parada = escalaMensalDoPlantao(completas, equipe, data)?.paradas.find(p => mesmoDiaISO(p.data, data));
        // Da escala mensal já com as trocas e os extras do dia (quem saiu → quem entrou no lugar).
        const pessoasDia = await carregarPessoasDoDia(equipe, data).catch(() => null);
        if (cancelado) return;
        const radioMensal: HorarioRadio[] = (parada?.radio || []).map(r => {
          const nome = r.pessoaNomeGuerra || r.pessoaNome;
          return { inicio: r.horario, fim: r.horarioFim, nome: pessoasDia?.troca.get(nome) ?? nome };
        });
        const radio = radioLancado.length ? radioLancado : radioMensal;
        setOrigemRadio(radioLancado.length ? 'ocorrencia' : radioMensal.length ? 'mensal' : '');
        const checklistAnterior = anterior?.dados?.checklist ?? [];
        const checklist = CHECKLIST_PADRAO.map(item => {
          const antes = checklistAnterior.find(a => a.nome === item.nome);
          const base: ItemChecklistPlantao = antes && !antes.ok ? { ...antes } : { ...item };
          if (item.nome !== HIDROMETRO) return base;
          const situacao = inicio?.dados?.hidrometroSituacao?.trim() || base.observacao;
          return {
            ...base,
            valor: inicio?.dados?.hidrometro || base.valor || '',
            observacao: situacao,
            ok: situacao ? false : base.ok,
          };
        });
        setDados({ ...vazio(), checklist, radio });
      } catch (err) {
        if (!cancelado) setErro(err instanceof Error ? err.message : 'Não foi possível carregar o fim de plantão.');
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => { cancelado = true; };
  }, [data, equipe, recarregar]);

  // Pessoas do plantão para escolher na escala de rádio (efetivo do dia e os demais bombeiros).
  const [pessoasDia, setPessoasDia] = useState<PessoasDoDia | null>(null);
  useEffect(() => {
    if (!equipe || !data) return;
    let cancelado = false;
    setPessoasDia(null);
    carregarPessoasDoDia(equipe, data).then(p => { if (!cancelado) setPessoasDia(p); }).catch(() => {});
    return () => { cancelado = true; };
  }, [data, equipe, recarregar]);

  // Ocorrências, inspeções e solicitações do plantão: sempre atualizadas, mesmo depois de salvo.
  useEffect(() => {
    if (!equipe || !data) return;
    let cancelado = false;
    Promise.all([listarOcorrencias().catch(() => [] as Ocorrencia[]), listarConferencias().catch(() => [] as Conferencia[])])
      .then(([ocorrencias, conferencias]) => {
        if (cancelado) return;
        setAutomaticas(movimentacoesDoPlantao({ ocorrencias, conferencias, equipe, dataPlantao: data }));
        setRadioLancado(escalaRadioDasOcorrencias({ ocorrencias, equipe, dataPlantao: data }));
      });
    return () => { cancelado = true; };
  }, [data, equipe, recarregar]);

  /** Lançadas nas telas + digitadas aqui, da noite para a madrugada. */
  const movimentacoesOrdenadas = useMemo(() => {
    // Se o teste já foi lançado como ocorrência/movimentação, não repete na mensagem.
    const jaLancado = (quem: RegExp) => [...automaticas, ...dados.movimentacoes]
      .some(m => /sirene/i.test(m.descricao) && quem.test(m.descricao));
    const apoc = jaLancado(/apoc/i) ? SIRENE_VAZIA : (dados.sireneApoc ?? SIRENE_VAZIA);
    const torre = jaLancado(/torre|twr/i) ? SIRENE_VAZIA : (dados.sireneTorre ?? SIRENE_VAZIA);
    const ordenadas = [
      ...automaticas,
      ...dados.movimentacoes.filter(m => m.descricao.trim()),
      // Teste sirene do APOC com hora entra na ordem do plantão.
      ...(apoc.hora && !apoc.naoHouve ? [{ hora: apoc.hora, descricao: 'Teste sirene APOC' }] : []),
    ]
      .map((m, i) => ({ m, i }))
      .sort((a, b) => ordemNoPlantao(a.m.hora, equipe) - ordemNoPlantao(b.m.hora, equipe) || a.i - b.i)
      .map(({ m }) => ({ hora: m.hora, descricao: m.descricao }));
    // Não houve o do APOC: abre a lista. O da torre é no fim do plantão: fecha a lista.
    if (apoc.naoHouve) ordenadas.unshift({ hora: '', descricao: 'Teste sirene APOC - Não houve ❌' });
    if (torre.naoHouve) ordenadas.push({ hora: '', descricao: 'Teste sirene da torre - Não houve ❌' });
    else if (torre.hora) ordenadas.push({ hora: torre.hora, descricao: 'Teste sirene da torre' });
    return ordenadas;
  }, [automaticas, dados.movimentacoes, dados.sireneApoc, dados.sireneTorre, equipe]);

  const mensagem = useMemo(
    () => montarMensagemFimPlantao(data, equipe || '-', dados, movimentacoesOrdenadas),
    [data, equipe, dados, movimentacoesOrdenadas],
  );

  const setItem = (i: number, parcial: Partial<ItemChecklistPlantao>) =>
    setDados(atual => ({ ...atual, checklist: atual.checklist.map((item, j) => (j === i ? { ...item, ...parcial } : item)) }));
  const setRadio = (i: number, parcial: Partial<HorarioRadio>) =>
    setDados(atual => ({ ...atual, radio: atual.radio.map((r, j) => (j === i ? { ...r, ...parcial } : r)) }));
  const setMov = (i: number, parcial: Partial<MovimentacaoPlantao>) =>
    setDados(atual => ({ ...atual, movimentacoes: atual.movimentacoes.map((m, j) => (j === i ? { ...m, ...parcial } : m)) }));

  async function salvar() {
    if (!equipe) { setErro('Escolha a equipe.'); return; }
    setSalvando(true);
    setErro('');
    try {
      setSalvo(await salvarFimPlantao({ data, equipe, dados, mensagem }));
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <PageContainer>
      <PageTitle icon={ClipboardCheck} title="Fim de plantão" subtitle="Relatório de serviço do comunicante para o chefe de equipe." />

      <div className={`${card} mb-4 flex flex-wrap items-end gap-3`}>
        <label className="w-44"><span className={label}>Data do plantão</span><input type="date" value={data} onChange={e => setData(e.target.value)} className={input} /></label>
        <label className="w-44"><span className={label}>Equipe</span>
          <select value={equipe} onChange={e => setEquipe(e.target.value)} disabled={equipeTravada} className={`${input} disabled:cursor-not-allowed disabled:opacity-70`}>
            <option value="">Selecione</option>
            {EQUIPES.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </label>
        {!salvo && equipe && (
          <button type="button" onClick={() => setRecarregar(v => v + 1)} className="flex min-h-11 items-center gap-2 rounded-xl border border-graphite-300/60 px-3 py-2 text-sm font-medium sm:min-h-0 text-graphite-700 hover:bg-graphite-50 dark:border-border-dark dark:text-graphite-200 dark:hover:bg-surface-hover">
            <RefreshCw className="h-4 w-4" /> Buscar de novo
          </button>
        )}
        <p className="text-xs text-graphite-500 dark:text-graphite-400">
          {salvo ? `Salvo por ${salvo.atualizadoPor} em ${new Date(salvo.atualizadoEm).toLocaleString('pt-BR')}.` : 'Ainda não salvo. Hidrômetro veio do início de plantão.'}
        </p>
      </div>

      {erro && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">{erro}</div>}

      {!equipe ? (
        <p className="rounded-2xl border border-dashed border-graphite-300 p-10 text-center text-sm text-graphite-500 dark:border-border-dark">Escolha a equipe para começar.</p>
      ) : carregando ? (
        <div role="status" className="flex items-center justify-center gap-3 py-16"><div className="h-7 w-7 animate-spin rounded-full border-4 border-aviation-500 border-t-transparent" /><span>Buscando dados do plantão...</span></div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-4">
            <section className={card}>
              <h2 className={tituloCard}>Checklist</h2>
              <ul className="divide-y divide-graphite-100 dark:divide-border-dark">
                {dados.checklist.map((item, i) => (
                  <li key={item.nome} className="flex flex-wrap items-center gap-3 py-2.5">
                    <span className="min-w-0 flex-1 text-sm font-medium text-graphite-800 dark:text-graphite-200">{item.nome}</span>
                    {item.nome === HIDROMETRO && (
                      <label className="flex items-center gap-1 text-xs text-graphite-500">
                        <span className="w-24"><input aria-label="Leitura do hidrômetro" inputMode="decimal" value={item.valor ?? ''} onChange={e => setItem(i, { valor: e.target.value })} placeholder="0907" className={input} /></span> m³
                      </label>
                    )}
                    <div role="group" aria-label={`Situação de ${item.nome}`} className="flex overflow-hidden rounded-xl border border-graphite-300/60 text-xs font-bold dark:border-border-dark">
                      <button type="button" aria-pressed={item.ok} onClick={() => setItem(i, { ok: true })} className={`min-h-11 px-4 py-2.5 sm:min-h-0 sm:px-3 sm:py-1.5 ${item.ok ? 'bg-emerald-500 text-white' : 'text-graphite-500 hover:bg-graphite-50 dark:hover:bg-surface-hover'}`}>✅ OK</button>
                      <button type="button" aria-pressed={!item.ok} onClick={() => setItem(i, { ok: false })} className={`min-h-11 px-4 py-2.5 sm:min-h-0 sm:px-3 sm:py-1.5 ${!item.ok ? 'bg-red-500 text-white' : 'text-graphite-500 hover:bg-graphite-50 dark:hover:bg-surface-hover'}`}>❌ Alteração</button>
                    </div>
                    {(!item.ok || item.nome === HIDROMETRO) && (
                      <input
                        aria-label={`Observação de ${item.nome}`}
                        value={item.observacao}
                        onChange={e => setItem(i, { observacao: e.target.value })}
                        placeholder={item.nome === HIDROMETRO ? 'Ex.: TRAVADO' : 'Ex.: INOPERANTE'}
                        className={`${input} basis-full ${!item.ok ? 'border-red-400 dark:border-red-500/60' : ''}`}
                      />
                    )}
                  </li>
                ))}
              </ul>
            </section>

            <section className={card}>
              <h2 className={tituloCard}>Escala de rádio</h2>
              <p className="mb-3 text-xs text-graphite-500 dark:text-graphite-400">
                {salvo
                  ? 'Escala salva neste relatório.'
                  : origemRadio === 'ocorrencia'
                    ? 'Veio da escala de rádio lançada em LRO/Ocorrências.'
                    : origemRadio === 'mensal'
                      ? 'Veio da escala mensal (nenhuma escala de rádio foi lançada em LRO/Ocorrências).'
                      : 'Lance a escala de rádio em LRO/Ocorrências ou adicione os horários aqui.'}
                {' '}Ajuste horários e nomes se alguém trocou ou fez horário diferente.
              </p>
              {radioLancado.length > 0 && JSON.stringify(radioLancado) !== JSON.stringify(dados.radio) && (
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-400/50 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                  <span>Há uma escala de rádio lançada em LRO/Ocorrências diferente desta ({radioLancado.length} horários).</span>
                  <button type="button" onClick={() => setDados(a => ({ ...a, radio: radioLancado }))} className="rounded-lg border border-amber-500/50 px-3 py-1 text-xs font-semibold hover:bg-amber-100 dark:hover:bg-amber-500/20">
                    Usar a escala lançada
                  </button>
                </div>
              )}
              <div className="space-y-2">
                {dados.radio.map((r, i) => (
                  <div key={i} className="grid grid-cols-[6.5rem_auto_6.5rem_minmax(0,1fr)_auto] items-center gap-2">
                    <input type="time" aria-label={`Início do horário ${i + 1}`} value={r.inicio} onChange={e => setRadio(i, { inicio: e.target.value })} className={input} />
                    <span className="text-sm text-graphite-400">às</span>
                    <input type="time" aria-label={`Fim do horário ${i + 1}`} value={r.fim} onChange={e => setRadio(i, { fim: e.target.value })} className={input} />
                    <SeletorRadio key={`${i}-${pessoasDia ? 'p' : 's'}`} rotulo={`Quem fica no rádio no horário ${i + 1}`} valor={r.nome} pessoas={pessoasDia} onChange={nome => setRadio(i, { nome })} />
                    <button type="button" title="Remover" aria-label={`Remover horário ${i + 1}`} onClick={() => setDados(a => ({ ...a, radio: a.radio.filter((_, j) => j !== i) }))} className={botaoRemover}><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setDados(a => ({ ...a, radio: [...a.radio, { inicio: a.radio.at(-1)?.fim ?? '', fim: '', nome: '' }] }))} className={botaoAdicionar}>
                <Plus className="h-4 w-4" /> Adicionar horário
              </button>
              {pessoasDia && pessoasDia.trocasTexto.length > 0 && (
                <p className="mt-3 text-xs text-graphite-500 dark:text-graphite-400">
                  Trocas e extras do dia (já aplicados na escala da escala mensal): {pessoasDia.trocasTexto.join(' · ')}
                </p>
              )}
            </section>

            <section className={card}>
              <h2 className={tituloCard}>Testes de sirene</h2>
              <LinhaSirene titulo="Teste sirene APOC" quando="Início do plantão" valor={dados.sireneApoc ?? SIRENE_VAZIA}
                onChange={v => setDados(a => ({ ...a, sireneApoc: v }))} />
              <LinhaSirene titulo="Teste sirene da torre" quando="Fim do plantão" valor={dados.sireneTorre ?? SIRENE_VAZIA}
                onChange={v => setDados(a => ({ ...a, sireneTorre: v }))} />
              <p className="mt-2 text-xs text-graphite-500 dark:text-graphite-400">Com "Não houve" marcado, não precisa da hora. Os dois testes entram nas movimentações.</p>
            </section>

            <section className={card}>
              <h2 className={tituloCard}>Movimentações do dia</h2>
              {automaticas.length > 0 && (
                <>
                  <p className="mb-2 text-xs text-graphite-500 dark:text-graphite-400">Lançadas em LRO/Ocorrências, Inspeções e Solicitações. Para corrigir, edite na tela de origem.</p>
                  <ul className="mb-4 divide-y divide-graphite-100 rounded-xl border border-graphite-200/70 dark:divide-border-dark dark:border-border-dark">
                    {[...automaticas]
                      .sort((a, b) => ordemNoPlantao(a.hora, equipe) - ordemNoPlantao(b.hora, equipe))
                      .map((m, i) => (
                        <li key={i} className="grid grid-cols-[3.5rem_6.5rem_minmax(0,1fr)] items-start gap-2 px-3 py-2 text-sm">
                          <span className="font-semibold tabular-nums text-graphite-900 dark:text-graphite-100">{m.hora || '--:--'}</span>
                          <span className="rounded-lg bg-aviation-50 px-2 py-0.5 text-center text-[11px] font-semibold text-aviation-700 dark:bg-aviation-900/20 dark:text-aviation-300">{m.origem}</span>
                          <span className="text-graphite-700 dark:text-graphite-200">{m.descricao}</span>
                        </li>
                      ))}
                  </ul>
                </>
              )}
              <p className="mb-2 text-xs text-graphite-500 dark:text-graphite-400">Outras movimentações (só vão para o relatório):</p>
              <div className="space-y-2">
                {dados.movimentacoes.map((m, i) => (
                  <div key={i} className="grid grid-cols-[6.5rem_minmax(0,1fr)_auto] items-start gap-2">
                    <input type="time" aria-label={`Hora da movimentação ${i + 1}`} value={m.hora} onChange={e => setMov(i, { hora: e.target.value })} className={input} />
                    <textarea rows={2} aria-label={`Descrição da movimentação ${i + 1}`} value={m.descricao} onChange={e => setMov(i, { descricao: e.target.value })} placeholder="Ex.: Teste rádio e sirene APOC" className={`${input} resize-y`} />
                    <button type="button" title="Remover" aria-label={`Remover movimentação ${i + 1}`} onClick={() => setDados(a => ({ ...a, movimentacoes: a.movimentacoes.filter((_, j) => j !== i) }))} className={botaoRemover}><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setDados(a => ({ ...a, movimentacoes: [...a.movimentacoes, { hora: new Date().toTimeString().slice(0, 5), descricao: '' }] }))}
                className={botaoAdicionar}
              >
                <Plus className="h-4 w-4" /> Adicionar movimentação
              </button>
            </section>

            <section className={card}>
              <h2 className={tituloCard}>Despedida</h2>
              <input aria-label="Mensagem de despedida" value={dados.despedida} onChange={e => setDados(a => ({ ...a, despedida: e.target.value }))} className={input} />
            </section>
          </div>

          <PainelMensagemPlantao titulo="Relatório de serviço" mensagem={mensagem} salvo={salvo} salvando={salvando} onSalvar={salvar} onErro={setErro} />
        </div>
      )}
    </PageContainer>
  );
}
