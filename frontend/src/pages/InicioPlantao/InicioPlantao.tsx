import { useEffect, useMemo, useState } from 'react';
import { Plus, Radio, RefreshCw, Trash2, X } from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';
import { useContextoOperacional } from '../../hooks/useContextoOperacional';
import { listarAPOCs } from '../../services/apocService';
import { listarBombeiros } from '../../services/bombeiroService';
import { listarFeriasGozo } from '../../services/feriasService';
import { obterInicioPlantao, obterInicioPlantaoAnterior, salvarInicioPlantao } from '../../services/inicioPlantaoService';
import { listarSubstituicoesTemporarias } from '../../services/substituicaoTemporariaService';
import { listarCompletas } from '../../services/escalaMensalService';
import { listarTrocasServicoAssinadas } from '../../services/efetivoOperacionalService';
import { listarVigencias, type VigenciaSubstituicao } from '../../services/vigenciaSubstituicaoService';
import type { SubstituicaoTemporaria } from '../../types/substituicaoTemporaria';
import type { EscalaMensalCompleta } from '../../types/escalaMensal';
import type { FeriasGozo } from '../../types/ferias';
import {
  montarEfetivoOperacional,
  montarExtrasAfastamentoDoDia,
  montarGuarnicoesExercicio,
  montarTrocasServicoDoDia,
} from '../../utils/efetivoOperacional';
import type { APOC } from '../../types/apoc';
import type { Bombeiro } from '../../types/bombeiro';
import type { EscalaDiaria } from '../../types/escala';
import { opcoesAssuntoPTRBA } from '../../types/ptrb';
import { isComunicante } from '../../utils/permissoes';
import { dataDoPlantaoAtual } from '../../utils/plantaoRegistros';
import { NUMEROS_CCI, type DadosInicioPlantao, type InicioPlantaoSalvo, type ViaturaPlantao } from '../../types/inicioPlantao';
import { hojeLocalISO } from '../../utils/datas';
import { montarMensagemInicioPlantao } from '../../utils/mensagemInicioPlantao';
import { PainelMensagemPlantao } from './PainelMensagemPlantao';

const EQUIPES = ['Alfa', 'Bravo', 'Charlie', 'Delta'] as const;
const STATUS = ['OK', 'COM ALTERAÇÃO'] as const;

const input = 'w-full rounded-xl border border-graphite-300/60 bg-white/70 px-3 py-2 text-sm transition-all focus:border-aviation-500/50 focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:scheme-dark';
const label = 'mb-1 block text-xs font-semibold text-graphite-600 dark:text-graphite-300';
const card = 'rounded-2xl border border-graphite-200/70 bg-white/80 p-4 dark:border-border-dark dark:bg-surface-card/80';
const tituloCard = 'mb-3 text-xs font-black uppercase tracking-wider text-aviation-600 dark:text-aviation-400';

function vazio(): DadosInicioPlantao {
  const viatura = (chave: ViaturaPlantao['chave'], posicao: string, numero: string): ViaturaPlantao => ({
    chave, posicao, numero, equipagem: [], combustivel: '', km: '', n2: '', tac: '', epr: 'OK',
  });
  return {
    aeroporto: 'Aeroporto de Navegantes',
    efetivo: '',
    twr: 'OK',
    // Ramais padrão; depois do primeiro salvo, vale o do último plantão.
    ramaisTwr: '9247 / 9248',
    testesRadioHotline: 'OK',
    apoc: '',
    spo: '',
    supervisao: '',
    pcm: '',
    fiscal: '',
    cabeceira: '',
    testesOperacional: 'OK',
    smeRamal: '9620',
    smeMotorista: '',
    smeTecEnfermagem: '',
    smeTestes: 'OK',
    sciRamal: '9345',
    viaturas: [
      viatura('faisca02', 'FAÍSCA 02', '333'),
      viatura('faisca03', 'FAÍSCA 03', '320'),
      viatura('faiscaRT', 'FAÍSCA RT', '319'),
      viatura('crs', 'CRS', ''),
    ],
    caixaInterna: 'OK',
    caixaExterna: 'OK',
    hidrometro: '',
    hidrometroSituacao: '',
    ferias: [],
    trocas: [],
    extras: [],
    ptrba: [],
  };
}

/** Equipagem de cada viatura a partir das guarnições do dia (escala mensal já com férias, extras e trocas). */
function preencherDasGuarnicoes(base: DadosInicioPlantao, g: EscalaDiaria['guarnicoes']): DadosInicioPlantao {
  const equipagens: Record<string, { funcao: string; nome: string }[]> = {
    faisca02: [{ funcao: 'BA-CE', nome: g.cci02?.baCe || '' }, { funcao: 'BA-MC', nome: g.cci02?.baMc || '' }, { funcao: 'BA-2', nome: g.cci02?.ba2 || '' }],
    faisca03: [{ funcao: 'BA-MC', nome: g.cci03?.baMc || '' }, { funcao: 'BA-2', nome: g.cci03?.ba2_1 || '' }, { funcao: 'BA-2', nome: g.cci03?.ba2_2 || '' }],
    faiscaRT: [],
    crs: [{ funcao: 'BA-LR', nome: g.crs?.baLr || '' }, { funcao: 'BA-MC', nome: g.crs?.baMc || '' }, { funcao: 'BA-RE', nome: g.crs?.baRe1 || '' }, { funcao: 'BA-RE', nome: g.crs?.baRe2 || '' }],
  };
  const efetivo = Object.values(equipagens).flat().filter(t => t.nome.trim()).length;
  return {
    ...base,
    efetivo: efetivo ? String(efetivo) : base.efetivo,
    viaturas: base.viaturas.map(v => ({ ...v, equipagem: equipagens[v.chave] ?? [] })),
  };
}

/** Repete do último plantão o que quase nunca muda: ramais, SPO, PCM, fiscal, cabeceira e posição das CCIs. */
function sugerirDoAnterior(base: DadosInicioPlantao, anterior: DadosInicioPlantao | undefined): DadosInicioPlantao {
  if (!anterior) return base;
  return {
    ...base,
    aeroporto: anterior.aeroporto || base.aeroporto,
    ramaisTwr: anterior.ramaisTwr,
    spo: anterior.spo,
    supervisao: anterior.supervisao,
    pcm: anterior.pcm ?? '',
    fiscal: anterior.fiscal,
    cabeceira: anterior.cabeceira,
    smeRamal: anterior.smeRamal,
    sciRamal: anterior.sciRamal,
    viaturas: base.viaturas.map(v => ({ ...v, numero: anterior.viaturas?.find(a => a.chave === v.chave)?.numero ?? v.numero })),
  };
}

function Campo({ rotulo, valor, onChange, placeholder, tipo = 'text', sugestoes }: {
  rotulo: string; valor: string; onChange: (v: string) => void; placeholder?: string; tipo?: string;
  /** id de um <datalist>: o navegador sugere nomes enquanto a pessoa digita. */
  sugestoes?: string;
}) {
  return (
    <label className="block">
      <span className={label}>{rotulo}</span>
      <input type={tipo} list={sugestoes} autoComplete={sugestoes ? 'off' : undefined} inputMode={tipo === 'number' ? 'decimal' : undefined} value={valor} placeholder={placeholder} onChange={e => onChange(e.target.value)} className={input} />
    </label>
  );
}

const SEPARADOR_NOMES = ' / ';
const separarNomes = (valor: string) => (valor ? valor.split(/\s*\/\s*/) : ['']);

/**
 * Campo de uma ou mais pessoas (APOC, SPO, Supervisão, PCM, Fiscal). Cada pessoa tem a sua linha;
 * "+ pessoa" abre mais uma. Os nomes ficam juntos no mesmo texto ("A / B"), como na mensagem.
 */
function CampoPessoas({ rotulo, valor, onChange, sugestoes }: {
  rotulo: string; valor: string; onChange: (v: string) => void; sugestoes?: string;
}) {
  const nomes = separarNomes(valor);
  const gravar = (lista: string[]) => onChange(lista.map(n => n.trim()).filter((n, i, l) => n || l.length === 1).join(SEPARADOR_NOMES));
  const mudar = (indice: number, texto: string) => {
    const lista = [...nomes];
    lista[indice] = texto.replace(/\//g, '');
    onChange(lista.join(SEPARADOR_NOMES));
  };
  return (
    <div className="block">
      <span className={label}>{rotulo}</span>
      <div className="space-y-1.5">
        {nomes.map((nome, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <input list={sugestoes} autoComplete="off" value={nome} aria-label={`${rotulo} ${i + 1}`}
              onChange={e => mudar(i, e.target.value)} onBlur={() => gravar(separarNomes(valor))} className={input} />
            {nomes.length > 1 && (
              <button type="button" onClick={() => gravar(nomes.filter((_, j) => j !== i))} aria-label={`Tirar ${rotulo} ${i + 1}`} title="Tirar esta pessoa"
                className="shrink-0 rounded-lg p-2 text-graphite-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"><X className="h-4 w-4" /></button>
            )}
          </div>
        ))}
      </div>
      <button type="button" onClick={() => onChange([...nomes, ''].join(SEPARADOR_NOMES))}
        className="mt-1.5 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-aviation-600 hover:bg-aviation-50 dark:text-aviation-300 dark:hover:bg-aviation-900/20">
        <Plus className="h-3.5 w-3.5" /> pessoa
      </button>
    </div>
  );
}

/**
 * Escolha da pessoa na viatura: primeiro quem está no plantão; depois os demais bombeiros
 * ativos, para trocas e extras que não vieram sozinhos.
 */
function SeletorPessoa({ rotulo, valor, efetivoDoDia, todos, onChange }: {
  rotulo: string; valor: string; efetivoDoDia: string[]; todos: Bombeiro[]; onChange: (nome: string) => void;
}) {
  const doDia = [...new Set(efetivoDoDia)].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const outros = [...new Set(todos.map(b => b.nomeGuerra).filter(n => n && !doDia.includes(n)))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const fora = valor && !doDia.includes(valor) && !outros.includes(valor);
  return (
    <select aria-label={rotulo} value={valor} onChange={e => onChange(e.target.value)} className={input}>
      <option value="">Selecione</option>
      {fora && <option value={valor}>{valor}</option>}
      {doDia.length > 0 && (
        <optgroup label="Efetivo do dia">
          {doDia.map(nome => <option key={nome} value={nome}>{nome}</option>)}
        </optgroup>
      )}
      <optgroup label="Outros bombeiros">
        {outros.map(nome => <option key={nome} value={nome}>{nome}</option>)}
      </optgroup>
    </select>
  );
}

const COM_ALTERACAO = 'COM ALTERAÇÃO';

/**
 * OK ou COM ALTERAÇÃO. Com alteração abre um campo para descrever, e o texto vai
 * junto na mensagem: "COM ALTERAÇÃO - rádio com chiado".
 */
function Status({ rotulo, valor, onChange }: { rotulo: string; valor: string; onChange: (v: string) => void }) {
  const alterado = valor.startsWith(COM_ALTERACAO);
  const detalhe = alterado ? valor.slice(COM_ALTERACAO.length).replace(/^\s*-\s*/, '') : '';
  return (
    <div className="block">
      <label className="block">
        <span className={label}>{rotulo}</span>
        <select value={alterado ? COM_ALTERACAO : 'OK'} onChange={e => onChange(e.target.value)} className={`${input} ${alterado ? 'border-amber-400 text-amber-800 dark:border-amber-500/60 dark:text-amber-300' : ''}`}>
          {STATUS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      {alterado && (
        <input
          aria-label={`Qual a alteração em ${rotulo}`}
          value={detalhe}
          autoFocus
          placeholder="Descreva a alteração"
          onChange={e => onChange(e.target.value.trim() ? `${COM_ALTERACAO} - ${e.target.value}` : COM_ALTERACAO)}
          className={`${input} mt-2 border-amber-400 dark:border-amber-500/60`}
        />
      )}
    </div>
  );
}

export default function InicioPlantao() {
  const { equipeEfetiva, user } = useContextoOperacional();
  // O comunicante preenche só o início de plantão da equipe dele.
  const equipeTravada = isComunicante(user) && !!equipeEfetiva;
  const [data, setData] = useState(hojeLocalISO());
  const [equipe, setEquipe] = useState<string>('');
  const [dados, setDados] = useState<DadosInicioPlantao>(vazio);
  const [salvo, setSalvo] = useState<InicioPlantaoSalvo | null>(null);
  const [apocs, setApocs] = useState<APOC[]>([]);
  const [bombeirosAtivos, setBombeirosAtivos] = useState<Bombeiro[]>([]);
  /** Nomes de guerra de quem está no plantão (escala mensal com férias, extras e trocas). */
  const [efetivoDoDiaNomes, setEfetivoDoDiaNomes] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [recarregar, setRecarregar] = useState(0);

  useEffect(() => {
    if (!equipe && equipeEfetiva && (EQUIPES as readonly string[]).includes(equipeEfetiva)) {
      setEquipe(equipeEfetiva);
      // De madrugada, quem é da noite ainda está no plantão do dia anterior.
      setData(dataDoPlantaoAtual(equipeEfetiva));
    }
  }, [equipeEfetiva, equipe]);

  useEffect(() => {
    listarAPOCs().then(setApocs).catch(() => setApocs([]));
    listarBombeiros().then(lista => setBombeirosAtivos(lista.filter(b => !b.dataDesligamento))).catch(() => setBombeirosAtivos([]));
  }, []);

  // Carrega o que já foi salvo; se ainda não existe, monta a partir da escala e do plantão anterior.
  useEffect(() => {
    if (!equipe || !data) return;
    let cancelado = false;
    setCarregando(true);
    setErro('');
    (async () => {
      try {
        const existente = await obterInicioPlantao(data, equipe);
        if (cancelado) return;
        if (existente) {
          setSalvo(existente);
          setDados({ ...vazio(), ...existente.dados });
          return;
        }
        setSalvo(null);
        // Mesma base da escala do dia: escala mensal + férias, substituições, extras e trocas de serviço assinadas.
        const [anterior, gozos, bombeiros, substituicoes, completas, vigencias, trocaFills] = await Promise.all([
          obterInicioPlantaoAnterior(data).catch(() => null),
          listarFeriasGozo({ equipe }).catch(() => [] as FeriasGozo[]),
          listarBombeiros().catch(() => [] as Bombeiro[]),
          listarSubstituicoesTemporarias().catch(() => [] as SubstituicaoTemporaria[]),
          listarCompletas().catch(() => [] as EscalaMensalCompleta[]),
          listarVigencias({ ativa: true }).catch(() => [] as VigenciaSubstituicao[]),
          listarTrocasServicoAssinadas().catch(() => []),
        ]);
        if (cancelado) return;
        const porId = new Map(bombeiros.map(b => [b.id, b]));
        const efetivoDoDia = montarEfetivoOperacional({
          bombeiros, feriasGozo: gozos, vigencias, trocaFills, escalasCompletas: completas,
          substituicoesTemporarias: substituicoes, equipe, dataPlantao: data,
        });
        setEfetivoDoDiaNomes(efetivoDoDia.map(entry => entry.bombeiro.nomeGuerra).filter(Boolean));
        const { guarnicoes } = montarGuarnicoesExercicio({
          efetivo: efetivoDoDia, bombeiros, escalasCompletas: completas, equipe, dataPlantao: data, hora: '08:00',
        });
        const ferias = gozos
          .filter(f => f.dataInicio <= data && f.dataFim >= data)
          .map(f => {
            const b = porId.get(f.funcionarioId);
            return b ? `${b.cargo} ${b.nomeGuerra}` : f.funcionarioNome;
          });
        const guerraPorNome = new Map(bombeiros.map(b => [b.nomeCompleto.trim().toLowerCase(), b.nomeGuerra]));
        const guerra = (nome: string) => guerraPorNome.get(nome.trim().toLowerCase()) || nome;
        const trocas = montarTrocasServicoDoDia({
          bombeiros, trocaFills, vigencias, feriasGozo: gozos, escalasCompletas: completas, equipe, dataPlantao: data,
        }).map(t => `${t.funcaoSaindo} ${guerra(t.nomeSaindo)} por ${t.funcaoEntrando} ${guerra(t.nomeEntrando)}`);
        const extras = montarExtrasAfastamentoDoDia({ bombeiros, substituicoes, vigencias, equipe, dataPlantao: data })
          .map(x => `${x.cargoExercido} ${x.substituto.nomeGuerra} no lugar de ${x.cargoAusente} ${x.ausente.nomeGuerra}`);
        // A escala diária é feita depois: os assuntos do PTR-BA são escolhidos pelo comunicante.
        const base = sugerirDoAnterior(vazio(), anterior?.dados);
        setDados({ ...preencherDasGuarnicoes(base, guarnicoes), ferias, trocas, extras, ptrba: [] });
      } catch (err) {
        if (!cancelado) setErro(err instanceof Error ? err.message : 'Não foi possível carregar o início de plantão.');
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => { cancelado = true; };
  }, [data, equipe, recarregar]);

  const mensagem = useMemo(() => montarMensagemInicioPlantao(data, equipe || '-', dados), [data, equipe, dados]);

  const set = <K extends keyof DadosInicioPlantao>(chave: K, valor: DadosInicioPlantao[K]) => setDados(atual => ({ ...atual, [chave]: valor }));
  const setViatura = (chave: ViaturaPlantao['chave'], parcial: Partial<ViaturaPlantao>) =>
    setDados(atual => ({ ...atual, viaturas: atual.viaturas.map(v => (v.chave === chave ? { ...v, ...parcial } : v)) }));

  /** Trocar a CCI de uma posição troca com a posição que estava com aquele número. */
  function trocarNumero(chave: ViaturaPlantao['chave'], numero: string) {
    setDados(atual => {
      const anterior = atual.viaturas.find(v => v.chave === chave)?.numero ?? '';
      return {
        ...atual,
        viaturas: atual.viaturas.map(v => {
          if (v.chave === chave) return { ...v, numero };
          if (v.numero === numero && v.chave !== 'crs') return { ...v, numero: anterior };
          return v;
        }),
      };
    });
  }

  async function salvar() {
    if (!equipe) { setErro('Escolha a equipe.'); return; }
    setSalvando(true);
    setErro('');
    try {
      setSalvo(await salvarInicioPlantao({ data, equipe, dados, mensagem }));
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }

  const listaTexto = (valor: string[]) => valor.join('\n');
  const textoLista = (texto: string) => texto.split('\n').map(l => l.trim()).filter(Boolean);

  return (
    <PageContainer>
      <PageTitle icon={Radio} title="Início de plantão" subtitle="Informações do comunicante. Viram a mensagem do dia e vão para o LRO." />

      <div className={`${card} mb-4 flex flex-wrap items-end gap-3`}>
        <label className="w-44"><span className={label}>Data do plantão</span><input type="date" value={data} onChange={e => setData(e.target.value)} className={input} /></label>
        <label className="w-44"><span className={label}>Equipe</span>
          <select value={equipe} onChange={e => setEquipe(e.target.value)} disabled={equipeTravada} className={`${input} disabled:cursor-not-allowed disabled:opacity-70`}>
            <option value="">Selecione</option>
            {EQUIPES.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </label>
        {!salvo && equipe && (
          <button type="button" onClick={() => setRecarregar(v => v + 1)} className="flex items-center gap-2 rounded-xl border border-graphite-300/60 px-3 py-2 text-sm font-medium text-graphite-700 hover:bg-graphite-50 dark:border-border-dark dark:text-graphite-200 dark:hover:bg-surface-hover">
            <RefreshCw className="h-4 w-4" /> Buscar de novo
          </button>
        )}
        <p className="text-xs text-graphite-500 dark:text-graphite-400">
          {salvo ? `Salvo por ${salvo.atualizadoPor} em ${new Date(salvo.atualizadoEm).toLocaleString('pt-BR')}.` : 'Ainda não salvo. Equipagem, férias, extras e trocas vieram da escala mensal; PTR-BA da escala do dia.'}
        </p>
      </div>

      {erro && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">{erro}</div>}

      {!equipe ? (
        <p className="rounded-2xl border border-dashed border-graphite-300 p-10 text-center text-sm text-graphite-500 dark:border-border-dark">Escolha a equipe para começar.</p>
      ) : carregando ? (
        <div role="status" className="flex items-center justify-center gap-3 py-16"><div className="h-7 w-7 animate-spin rounded-full border-4 border-aviation-500 border-t-transparent" /><span>Buscando escala do dia...</span></div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-4">
            <section className={card}>
              <h2 className={tituloCard}>Torre e operações</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Campo rotulo="Efetivo (bombeiros)" tipo="number" valor={dados.efetivo} onChange={v => set('efetivo', v)} />
                <Status rotulo="TWR" valor={dados.twr} onChange={v => set('twr', v)} />
                <Campo rotulo="Ramais da TWR" valor={dados.ramaisTwr} placeholder="9247 / 9248" onChange={v => set('ramaisTwr', v)} />
                <Status rotulo="Testes de rádio e hotline" valor={dados.testesRadioHotline} onChange={v => set('testesRadioHotline', v)} />
                <datalist id="apocs-plantao">{apocs.map(a => <option key={a.id} value={a.nomeGuerra} />)}</datalist>
                <CampoPessoas rotulo="APOC" valor={dados.apoc} sugestoes="apocs-plantao" onChange={v => set('apoc', v)} />
                <CampoPessoas rotulo="SPO" valor={dados.spo} sugestoes="apocs-plantao" onChange={v => set('spo', v)} />
                <CampoPessoas rotulo="Supervisão" valor={dados.supervisao} sugestoes="apocs-plantao" onChange={v => set('supervisao', v)} />
                <CampoPessoas rotulo="PCM" valor={dados.pcm} sugestoes="apocs-plantao" onChange={v => set('pcm', v)} />
                <CampoPessoas rotulo="Fiscal" valor={dados.fiscal} sugestoes="apocs-plantao" onChange={v => set('fiscal', v)} />
                <Campo rotulo="Cabeceira" valor={dados.cabeceira} placeholder="08" onChange={v => set('cabeceira', v)} />
                <Status rotulo="Testes de hotline e rádio operacional" valor={dados.testesOperacional} onChange={v => set('testesOperacional', v)} />
              </div>
            </section>

            <section className={card}>
              <h2 className={tituloCard}>SME e SCI</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Campo rotulo="Ramal do SME" valor={dados.smeRamal} onChange={v => set('smeRamal', v)} />
                <Campo rotulo="Motorista do SME" valor={dados.smeMotorista} onChange={v => set('smeMotorista', v)} />
                <Campo rotulo="Técnico de enfermagem" valor={dados.smeTecEnfermagem} onChange={v => set('smeTecEnfermagem', v)} />
                <Status rotulo="Testes de ramal e rádio (SME)" valor={dados.smeTestes} onChange={v => set('smeTestes', v)} />
                <Campo rotulo="Ramal do SCI" valor={dados.sciRamal} onChange={v => set('sciRamal', v)} />
              </div>
            </section>

            <section className={card}>
              <h2 className={tituloCard}>Viaturas</h2>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {dados.viaturas.map(v => (
                  <div key={v.chave} className="rounded-xl border border-graphite-200/70 p-3 dark:border-border-dark">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-graphite-900 dark:text-graphite-100">{v.chave === 'crs' ? '⛑️ CRS' : `🚒 ${v.posicao}`}</span>
                      {v.chave !== 'crs' && (
                        <select aria-label={`CCI na posição ${v.posicao}`} value={v.numero} onChange={e => trocarNumero(v.chave, e.target.value)} className={`${input} w-28`}>
                          {NUMEROS_CCI.map(n => <option key={n} value={n}>CCI {n}</option>)}
                        </select>
                      )}
                    </div>
                    {v.equipagem.length > 0 && (
                      <div className="mb-2 grid grid-cols-1 gap-2">
                        {v.equipagem.map((t, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="w-14 shrink-0 text-xs font-bold text-graphite-500">{t.funcao}</span>
                            <SeletorPessoa
                              rotulo={`${t.funcao} da ${v.posicao}`}
                              valor={t.nome}
                              efetivoDoDia={efetivoDoDiaNomes}
                              todos={bombeirosAtivos}
                              onChange={nome => setViatura(v.chave, { equipagem: v.equipagem.map((x, j) => (j === i ? { ...x, nome } : x)) })}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <Campo rotulo="Combustível %" tipo="number" valor={v.combustivel} onChange={x => setViatura(v.chave, { combustivel: x })} />
                      <Campo rotulo="Km" tipo="number" valor={v.km} onChange={x => setViatura(v.chave, { km: x })} />
                      {v.chave === 'crs'
                        ? <Campo rotulo="TAC" tipo="number" valor={v.tac} onChange={x => setViatura(v.chave, { tac: x })} />
                        : <Campo rotulo="N2" tipo="number" valor={v.n2} onChange={x => setViatura(v.chave, { n2: x })} />}
                      <Status rotulo="EPR's" valor={v.epr} onChange={x => setViatura(v.chave, { epr: x })} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className={card}>
              <h2 className={tituloCard}>Instalações</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Status rotulo="Caixa d’água interna" valor={dados.caixaInterna} onChange={v => set('caixaInterna', v)} />
                <Status rotulo="Caixa d’água externa" valor={dados.caixaExterna} onChange={v => set('caixaExterna', v)} />
                <Campo rotulo="Hidrômetro do reúso (m³)" tipo="number" valor={dados.hidrometro} onChange={v => set('hidrometro', v)} />
                <Campo rotulo="Situação do hidrômetro" valor={dados.hidrometroSituacao} placeholder="Inoperante" onChange={v => set('hidrometroSituacao', v)} />
              </div>
            </section>

            <section className={card}>
              <h2 className={tituloCard}>Efetivo</h2>
              <p className="mb-3 text-xs text-graphite-500 dark:text-graphite-400">Um por linha. Férias vêm da tela Férias, extras das Substituições aprovadas e trocas das Trocas de serviço assinadas; ajuste se precisar.</p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {([['ferias', 'Férias'], ['trocas', 'Trocas'], ['extras', 'Extras']] as const).map(([chave, nome]) => (
                  <label key={chave} className="block"><span className={label}>{nome}</span>
                    <textarea rows={3} value={listaTexto(dados[chave])} onChange={e => set(chave, textoLista(e.target.value))} placeholder="Não houve" className={`${input} resize-y`} />
                  </label>
                ))}
              </div>
            </section>

            <section className={card}>
              <h2 className={tituloCard}>PTR-BA</h2>
              <p className="mb-3 text-xs text-graphite-500 dark:text-graphite-400">Escolha os assuntos das instruções do dia. Use "Adicionar assunto" para quantos forem precisos.</p>
              <div className="space-y-2">
                {dados.ptrba.map((assunto, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-6 shrink-0 text-center text-xs font-bold text-graphite-500">{i + 1}</span>
                    <select
                      aria-label={`Assunto ${i + 1} do PTR-BA`}
                      value={assunto}
                      onChange={e => set('ptrba', dados.ptrba.map((a, j) => (j === i ? e.target.value : a)))}
                      className={input}
                    >
                      <option value="">Selecione o assunto</option>
                      {opcoesAssuntoPTRBA(assunto).map(opcao => <option key={opcao} value={opcao}>{opcao}</option>)}
                    </select>
                    <button
                      type="button"
                      aria-label={`Remover assunto ${i + 1}`}
                      title="Remover"
                      onClick={() => set('ptrba', dados.ptrba.filter((_, j) => j !== i))}
                      className="shrink-0 rounded-lg p-2 text-graphite-400 transition-colors hover:bg-red-500/10 hover:text-alert-red"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => set('ptrba', [...dados.ptrba, ''])}
                className="mt-3 flex items-center gap-2 rounded-xl border border-dashed border-aviation-400/60 px-4 py-2 text-sm font-semibold text-aviation-700 transition-colors hover:bg-aviation-50 dark:text-aviation-300 dark:hover:bg-aviation-900/20"
              >
                <Plus className="h-4 w-4" /> Adicionar assunto
              </button>
            </section>
          </div>

          <PainelMensagemPlantao titulo="Mensagem do dia" mensagem={mensagem} salvo={salvo} salvando={salvando} onSalvar={salvar} onErro={setErro} />
        </div>
      )}
    </PageContainer>
  );
}
