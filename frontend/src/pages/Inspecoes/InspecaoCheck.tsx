import { useState, useEffect, useMemo } from 'react';
import { Flame, Droplets, Search, Check, CalendarDays, Users, ChevronDown, Info, ClipboardCheck } from 'lucide-react';
import { listarExtintores } from '../../services/extintorService';
import { listarHidrantes } from '../../services/hidranteService';
import { listarBombeiros } from '../../services/bombeiroService';
import { criarConferencia } from '../../services/conferenciaService';
import { useContextoOperacional } from '../../hooks/useContextoOperacional';
import type { Extintor } from '../../types/extintor';
import type { Hidrante } from '../../types/hidrante';
import type { Bombeiro, Equipe } from '../../types/bombeiro';
import type { ItemChecklist, StatusItemChecklist } from '../../types/conferencia';
import { CHECKLIST_EXTINTOR, CHECKLIST_HIDRANTE, STATUS_ITEM_CHECKLIST_OPTIONS } from '../../types/conferencia';
import { EQUIPE_OPTIONS } from '../../types/bombeiro';
import { dataLocalISO, formatarDataBR } from '../../utils/datas';

type Step = 'buscar' | 'checklist' | 'sucesso';
type TipoBusca = 'extintor' | 'hidrante';

const CARGO_ABBREV: Record<string, string> = {
  'BA-2': 'BA2', 'BA-MC': 'MC', 'BA-CE': 'CE', 'BA-LR': 'LR',
  'BA-RE': 'RE', 'GS': 'GS', 'OC': 'OC',
};

function calcularDataProxima(dataAtual: Date, meses: number): string {
  const d = new Date(dataAtual);
  d.setMonth(d.getMonth() + meses);
  return dataLocalISO(d);
}

export function InspecaoCheck() {
  const { canManageGlobal, canManageEquipe, equipeEfetiva } = useContextoOperacional();
  const [step, setStep] = useState<Step>('buscar');
  const [tipo, setTipo] = useState<TipoBusca>('extintor');
  const [busca, setBusca] = useState('');
  const [extintores, setExtintores] = useState<Extintor[]>([]);
  const [hidrantes, setHidrantes] = useState<Hidrante[]>([]);
  const [bombeiros, setBombeiros] = useState<Bombeiro[]>([]);
  const [equipamento, setEquipamento] = useState<Extintor | Hidrante | null>(null);
  const [itens, setItens] = useState<ItemChecklist[]>([]);
  const [equipeSelecionada, setEquipeSelecionada] = useState<Equipe | ''>('');
  const [pessoaSelecionada, setPessoaSelecionada] = useState<Bombeiro | null>(null);
  const [buscaPessoa, setBuscaPessoa] = useState('');
  const [pessoaOpen, setPessoaOpen] = useState(false);
  const [resultadoFinal, setResultadoFinal] = useState<'Aprovado' | 'Reprovado' | null>(null);
  const [obs, setObs] = useState('');
  const [saving, setSaving] = useState(false);
  const [dataProxima, setDataProxima] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => { carregar(); }, []);

  useEffect(() => {
    if (!canManageGlobal && equipeEfetiva) setEquipeSelecionada(equipeEfetiva);
  }, [canManageGlobal, equipeEfetiva]);

  async function carregar() {
    const [e, h, b] = await Promise.all([listarExtintores(), listarHidrantes(), listarBombeiros()]);
    setExtintores(e);
    setHidrantes(h);
    setBombeiros(b);
  }

  const resultados = useMemo(() => {
    if (!busca || busca.length < 2) return [];
    const t = busca.toLowerCase();
    if (tipo === 'extintor') {
      return extintores.filter(e =>
        (e.numeroExtintor || '').toLowerCase().includes(t) ||
        (e.numeroSerie || '').toLowerCase().includes(t)
      );
    }
    return hidrantes.filter(h => (h.numero || '').toLowerCase().includes(t));
  }, [extintores, hidrantes, busca, tipo]);

  const bombeirosFiltrados = useMemo(() => {
    let lista = bombeiros;
    if (equipeSelecionada) lista = lista.filter(b => b.equipe === equipeSelecionada);
    if (buscaPessoa) {
      const t = buscaPessoa.toLowerCase();
      lista = lista.filter(b =>
        (b.nomeGuerra || '').toLowerCase().includes(t) ||
        (b.nomeCompleto || '').toLowerCase().includes(t)
      );
    }
    return lista;
  }, [bombeiros, equipeSelecionada, buscaPessoa]);

  function selecionar(item: Extintor | Hidrante) {
    const checklist = tipo === 'extintor' ? CHECKLIST_EXTINTOR : CHECKLIST_HIDRANTE;
    setEquipamento(item);
    setItens(checklist.map((pergunta, idx) => ({
      id: `${tipo}-${idx}`, pergunta, status: 'OK' as StatusItemChecklist, observacao: '',
    })));
    setEquipeSelecionada(canManageGlobal ? '' : equipeEfetiva || '');
    setPessoaSelecionada(null);
    setResultadoFinal(null);
    setObs('');
    setStep('checklist');
  }

  function getLabel(item: Extintor | Hidrante): string {
    if (tipo === 'extintor') {
      const e = item as Extintor;
      return e.numeroExtintor || e.numeroSerie || 'Sem ID';
    }
    return (item as Hidrante).numero || 'Sem ID';
  }

  function getIntervalo(): number {
    if (!equipamento) return 6;
    if (tipo === 'extintor') return parseInt((equipamento as Extintor).intervaloConferencia) || 6;
    return parseInt((equipamento as Hidrante).intervaloConferencia) || 6;
  }

  async function handleSalvar() {
    if (!equipamento || !pessoaSelecionada || !resultadoFinal) return;
    if (!canManageEquipe(pessoaSelecionada.equipe)) {
      setErro('Você só pode registrar conferências para sua equipe efetiva.');
      return;
    }
    setSaving(true);
    setErro('');
    try {
      const now = new Date();
      const proxima = calcularDataProxima(now, getIntervalo());
      setDataProxima(proxima);

      await criarConferencia({
        tipo: tipo === 'extintor' ? 'Extintor' : 'Hidrante',
        itemId: equipamento.id,
        itemNome: getLabel(equipamento),
        itemNumero: tipo === 'extintor' ? (equipamento as Extintor).numeroExtintor || (equipamento as Extintor).numeroSerie : (equipamento as Hidrante).numero,
        itemLocalizacao: equipamento.localizacao,
        dataConferencia: now.toISOString(),
        inspetorUsername: pessoaSelecionada.email || '',
        inspetorNomeGuerra: pessoaSelecionada.nomeGuerra,
        inspetorCargo: CARGO_ABBREV[pessoaSelecionada.cargo] || pessoaSelecionada.cargo,
        equipe: pessoaSelecionada.equipe,
        itens,
        resultadoFinal,
        observacoes: obs,
        dataProximaInspecao: proxima,
        createdBy: pessoaSelecionada.email || '',
      });
      setStep('sucesso');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  function reiniciar() {
    setStep('buscar');
    setBusca('');
    setEquipamento(null);
    setItens([]);
    setEquipeSelecionada('');
    setPessoaSelecionada(null);
    setResultadoFinal(null);
    setObs('');
    setDataProxima('');
    setErro('');
  }

  if (step === 'sucesso') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-graphite-50 to-white p-4 dark:from-graphite-900 dark:to-graphite-950">
        <div className="mx-auto max-w-lg pt-12 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="mb-2 text-2xl font-bold text-green-700 dark:text-green-400">Inspeção Registrada!</h1>
          <p className="text-sm text-graphite-600 dark:text-graphite-400">
            {equipamento ? getLabel(equipamento) : ''} — {resultadoFinal}
          </p>
          {dataProxima && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 shadow-sm dark:bg-surface-card">
              <CalendarDays className="h-4 w-4 text-aviation-600" />
              <span className="text-sm text-graphite-700 dark:text-graphite-300">
                Próxima inspeção: <strong>{formatarDataBR(dataProxima)}</strong>
              </span>
            </div>
          )}
          <button onClick={reiniciar}
            className="mt-8 block w-full rounded-xl bg-aviation-600 py-3 text-sm font-medium text-white">
            Nova Inspeção
          </button>
        </div>
      </div>
    );
  }

  if (step === 'checklist' && equipamento) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-graphite-50 to-white p-4 dark:from-graphite-900 dark:to-graphite-950">
        <div className="mx-auto max-w-lg">
          <button onClick={() => { setStep('buscar'); setEquipamento(null); }}
            className="mb-4 text-sm text-graphite-500 hover:text-graphite-700 dark:text-graphite-400">
            ← Voltar
          </button>

          <div className="mb-4 flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm dark:bg-surface-card">
            {tipo === 'extintor'
              ? <Flame className="h-6 w-6 text-red-500" />
              : <Droplets className="h-6 w-6 text-blue-500" />
            }
            <div>
              <p className="font-bold text-graphite-900 dark:text-graphite-100">{getLabel(equipamento)}</p>
              <p className="text-xs text-graphite-500 dark:text-graphite-400">{equipamento.localizacao}</p>
            </div>
          </div>

          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">
            Checklist ({itens.length} itens)
          </h3>

          <div className="space-y-2 mb-4">
            {itens.map((item, idx) => (
              <div key={item.id} className="rounded-xl bg-white p-3 shadow-sm dark:bg-surface-card">
                <p className="mb-2 text-sm font-medium text-graphite-900 dark:text-graphite-100">
                  <span className="mr-1 text-graphite-400">{idx + 1}.</span> {item.pergunta}
                </p>
                <div className="flex gap-1.5">
                  {STATUS_ITEM_CHECKLIST_OPTIONS.map(o => (
                    <button key={o.value} onClick={() => setItens(prev => prev.map((it, i) => i === idx ? { ...it, status: o.value } : it))}
                      className={`flex-1 rounded-lg border px-2 py-2 text-xs font-medium transition-all ${
                        item.status === o.value
                          ? o.color
                          : 'border-graphite-200 bg-white text-graphite-400 dark:border-graphite-600 dark:bg-graphite-800'
                      }`}>
                      {o.label}
                    </button>
                  ))}
                </div>
                {item.status === 'Pendência' && (
                  <input type="text" value={item.observacao}
                    onChange={e => setItens(prev => prev.map((it, i) => i === idx ? { ...it, observacao: e.target.value } : it))}
                    placeholder="Descreva a pendência..."
                    className="mt-2 w-full rounded-lg border border-graphite-200 bg-graphite-50 px-3 py-2 text-xs dark:border-graphite-600 dark:bg-graphite-800 dark:text-graphite-100" />
                )}
              </div>
            ))}
          </div>

          <div className="mb-4 rounded-xl bg-white p-4 shadow-sm dark:bg-surface-card">
            <div className="mb-2 flex items-center gap-2">
              <Users className="h-4 w-4 text-graphite-500" />
              <span className="text-xs font-semibold uppercase text-graphite-500">Equipe e Responsável</span>
            </div>

            <div className="mb-3 flex flex-wrap gap-1.5">
              {EQUIPE_OPTIONS.filter(eq => canManageGlobal || eq === equipeEfetiva).map(eq => (
                <button key={eq} onClick={() => { setEquipeSelecionada(eq); setPessoaSelecionada(null); }}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                    equipeSelecionada === eq
                      ? 'border-aviation-500 bg-aviation-50 text-aviation-700'
                      : 'border-graphite-200 text-graphite-500 dark:border-graphite-600'
                  }`}>
                  {eq}
                </button>
              ))}
            </div>

            {equipeSelecionada && (
              <div className="relative">
                <button onClick={() => setPessoaOpen(!pessoaOpen)}
                  className="flex w-full items-center justify-between rounded-lg border border-graphite-300 bg-white px-3 py-2 text-sm dark:border-graphite-600 dark:bg-graphite-800 dark:text-graphite-100">
                  {pessoaSelecionada
                    ? <span>{pessoaSelecionada.nomeGuerra} <span className="text-graphite-400">[{CARGO_ABBREV[pessoaSelecionada.cargo]}]</span></span>
                    : <span className="text-graphite-400">Selecionar pessoa...</span>
                  }
                  <ChevronDown className={`h-4 w-4 ${pessoaOpen ? 'rotate-180' : ''}`} />
                </button>
                {pessoaOpen && (
                  <div className="absolute z-20 mt-1 w-full rounded-lg border border-graphite-200 bg-white shadow-lg dark:border-graphite-600 dark:bg-surface-elevated">
                    <div className="p-2">
                      <input type="text" value={buscaPessoa} onChange={e => setBuscaPessoa(e.target.value)}
                        placeholder="Buscar..." autoFocus
                        className="w-full rounded-md border border-graphite-200 px-2 py-1.5 text-xs dark:border-graphite-600 dark:bg-graphite-800" />
                    </div>
                    <div className="max-h-40 overflow-y-auto">
                      {bombeirosFiltrados.map(b => (
                        <button key={b.id} onClick={() => { setPessoaSelecionada(b); setPessoaOpen(false); setBuscaPessoa(''); }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-graphite-50 dark:hover:bg-surface-hover">
                          <span className="font-semibold">{b.nomeGuerra}</span>
                          <span className="text-xs text-graphite-400">[{CARGO_ABBREV[b.cargo]}]</span>
                        </button>
                      ))}
                      {bombeirosFiltrados.length === 0 && <p className="px-3 py-2 text-xs text-graphite-400">Nenhum resultado</p>}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mb-4">
            <textarea value={obs} onChange={e => setObs(e.target.value)}
              className="w-full rounded-xl border border-graphite-300 bg-white px-3 py-2.5 text-sm dark:border-graphite-600 dark:bg-graphite-800 dark:text-graphite-100"
              rows={2} placeholder="Observações..." />
          </div>

          {erro && <p className="mb-3 text-sm text-red-500">{erro}</p>}

          <button onClick={async () => {
            const pendencias = itens.filter(i => i.status === 'Pendência').length;
            setResultadoFinal(pendencias > 0 ? 'Reprovado' : 'Aprovado');
            await handleSalvar();
          }}
            disabled={!pessoaSelecionada || saving}
            className="w-full rounded-xl bg-aviation-600 py-3 text-sm font-medium text-white disabled:opacity-50">
            {saving ? 'Salvando...' : 'Finalizar e Salvar'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-graphite-50 to-white p-4 dark:from-graphite-900 dark:to-graphite-950">
      <div className="mx-auto max-w-lg pt-8">
        <div className="mb-6 text-center">
          <ClipboardCheck className="mx-auto mb-2 h-10 w-10 text-aviation-600" />
          <h1 className="text-xl font-bold text-graphite-900 dark:text-graphite-100">Inspeção Rápida</h1>
          <p className="text-sm text-graphite-500 dark:text-graphite-400">Informe o número do equipamento</p>
        </div>

        <div className="mb-4 flex gap-2">
          <button onClick={() => { setTipo('extintor'); setBusca(''); }}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all ${
              tipo === 'extintor'
                ? 'bg-red-500 text-white shadow-md'
                : 'bg-white text-graphite-600 border border-graphite-200 dark:bg-surface-card dark:border-graphite-600'
            }`}>
            <Flame className="h-4 w-4" /> Extintor
          </button>
          <button onClick={() => { setTipo('hidrante'); setBusca(''); }}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all ${
              tipo === 'hidrante'
                ? 'bg-blue-500 text-white shadow-md'
                : 'bg-white text-graphite-600 border border-graphite-200 dark:bg-surface-card dark:border-graphite-600'
            }`}>
            <Droplets className="h-4 w-4" /> Hidrante
          </button>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite-400" />
          <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
            placeholder={tipo === 'extintor' ? 'Nº do extintor ou série...' : 'Nº do hidrante...'}
            className="w-full rounded-xl border border-graphite-300 bg-white py-3 pl-10 pr-4 text-sm text-graphite-900 outline-none dark:border-graphite-600 dark:bg-surface-card dark:text-graphite-100"
            autoFocus />
        </div>

        {resultados.length > 0 && (
          <div className="space-y-2">
            {resultados.map(item => (
              <button key={item.id} onClick={() => selecionar(item)}
                className="flex w-full items-center gap-3 rounded-xl bg-white p-4 text-left shadow-sm transition-all hover:shadow-md dark:bg-surface-card">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                  tipo === 'extintor' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                }`}>
                  {tipo === 'extintor' ? <Flame className="h-5 w-5" /> : <Droplets className="h-5 w-5" />}
                </div>
                <div>
                  <p className="font-semibold text-graphite-900 dark:text-graphite-100">{getLabel(item)}</p>
                  <p className="text-xs text-graphite-500 dark:text-graphite-400">{item.localizacao}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {busca.length >= 2 && resultados.length === 0 && (
          <div className="mt-8 text-center text-sm text-graphite-400 dark:text-graphite-500">
            Nenhum {tipo === 'extintor' ? 'extintor' : 'hidrante'} encontrado para "{busca}"
          </div>
        )}
      </div>
    </div>
  );
}

export default InspecaoCheck;
