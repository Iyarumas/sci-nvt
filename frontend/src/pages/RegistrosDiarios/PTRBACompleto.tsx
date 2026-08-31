import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  FileText,
  Image,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { PdfPreview } from '../../components/documentos/PdfPreview';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';
import { SearchSelect, type AtivoItem } from '../../components/ui/SearchSelect';
import { useContextoOperacional } from '../../hooks/useContextoOperacional';
import {
  canCriarRegistrosDiarios,
  canEditarRegistroDiario,
  canEscolherEquipeRegistrosDiarios,
  canExcluirRegistroDiario,
  equipePadraoRegistrosDiarios,
} from '../../utils/permissoes';
import { listarAPOCs } from '../../services/apocService';
import { listarBombeiros } from '../../services/bombeiroService';
import { listarEscalas } from '../../services/escalaService';
import { listarFeriasGozo } from '../../services/feriasService';
import { baixarPTRBACompletoPdf, gerarPTRBACompletoPdf } from '../../services/ptrbaCompletoPdfService';
import {
  atualizarPTRBACompleto,
  criarPTRBACompleto,
  excluirPTRBACompleto,
  listarPTRBACompletos,
} from '../../services/ptrbaCompletoService';
import { listarSubstituicoesTemporarias } from '../../services/substituicaoTemporariaService';
import { listarVigencias } from '../../services/vigenciaSubstituicaoService';
import { listarDocumentos, listarPreenchimentos } from '../../services/documentoService';
import { formatarDataBR, hojeLocalISO, mesmoDiaISO } from '../../utils/datas';
import { resumoAuditoria } from '../../utils/auditoria';
import { montarEfetivoOperacional, montarOpcoesEfetivoOperacional } from '../../utils/efetivoOperacional';
import type { APOC } from '../../types/apoc';
import type { Bombeiro, Equipe } from '../../types/bombeiro';
import type { EscalaDiaria } from '../../types/escala';
import type { FeriasGozo } from '../../types/ferias';
import { ASSUNTOS } from '../../types/ptrb';
import type { SubstituicaoTemporaria } from '../../types/substituicaoTemporaria';
import {
  criarEvidenciasPTRBACompletoVazias,
  criarParticipantesPTRBACompletoVazios,
  normalizarEvidenciasPTRBACompleto,
  normalizarParticipantesPTRBACompleto,
  PTRBA_COMPLETO_EVIDENCIA_PARES,
  PTRBA_COMPLETO_EQUIPES,
  PTRBA_COMPLETO_FUNCOES,
  PTRBA_COMPLETO_SITUACAO_DESCRICOES,
  PTRBA_COMPLETO_SITUACOES,
} from '../../types/ptrbaCompleto';
import type {
  PTRBACompleto,
  PTRBACompletoEvidencia,
  PTRBACompletoInput,
  PTRBACompletoParticipante,
} from '../../types/ptrbaCompleto';
import { PageTour } from '../../components/ui/PageTour';

const MESES = ['', 'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const ANOS = Array.from({ length: 6 }, (_, i) => (new Date().getFullYear() - i).toString());
const EVIDENCIA_VAZIA: PTRBACompletoEvidencia = {
  horaInicio: '',
  horaTermino: '',
  assunto: '',
  imagem: '',
  descricao: '',
};
const SITUACOES_TOOLTIP = PTRBA_COMPLETO_SITUACOES
  .map(situacao => `${situacao} = ${PTRBA_COMPLETO_SITUACAO_DESCRICOES[situacao] || situacao}`)
  .join('\n');

const PTRBA_COMPLETO_TOUR_STEPS = [
  {
    selector: 'main h1',
    title: 'PTR-BA',
    body: 'Esta página registra o PTR-BA do plantão, com efetivo, instruções e evidências.',
    detail: 'Aqui o documento reúne o conjunto do dia e pode gerar PDF com as informações e imagens.',
  },
  {
    selector: 'main select',
    title: 'Filtros de registros',
    body: 'Filtre por ano, mês e equipe para encontrar PTR-BAs já feitos.',
    detail: 'Use a lista para abrir, baixar PDF, editar ou excluir registros conforme sua permissão.',
  },
  {
    selector: 'main button',
    title: 'Novo PTR-BA',
    body: 'O botão abre o formulário do PTR-BA.',
    detail: 'O sistema pode usar a escala diária, trocas e vigências para ajudar a montar participantes e informações do plantão.',
  },
  {
    selector: 'main input, main textarea, main select',
    title: 'Dados do plantão',
    body: 'No formulário, preencha aeroporto, data, equipe, horários, participantes, situações e observações.',
    detail: 'Confira nomes e funções porque o PDF final depende exatamente desses campos.',
  },
  {
    selector: 'main textarea, main img, main input[type="file"]',
    title: 'Evidências e instruções',
    body: 'As evidências registram assuntos, horários, fotos e descrições das instruções do plantão.',
    detail: 'Cada evidência deve representar uma instrução real. Fotos erradas ou ausentes deixam o documento final incompleto.',
  },
  {
    selector: 'main .space-y-3, main table',
    title: 'Visualizar e baixar PDF',
    body: 'Clique em um card para abrir os detalhes do PTR-BA completo na própria lista.',
    detail: 'No rodapé dos detalhes ficam as ações de ver documento, baixar PDF, editar ou excluir conforme sua permissão.',
  },
];
type CampoCompartilhadoEvidencia = Exclude<keyof PTRBACompletoEvidencia, 'imagem'>;
type InstrucaoPTRNumero = 1 | 2 | 3;
type InstrucaoPTRDaEscala = {
  numero: InstrucaoPTRNumero;
  funcao: string;
  nomeGuerra: string;
  assunto: string;
};

const AEROPORTO_KEY = 'sescinc-aeroporto';
const AEROPORTO_DEFAULT = 'SBNF - Aeroporto Internacional de Navegantes';

function getUltimoAeroporto(): string {
  try {
    return localStorage.getItem(AEROPORTO_KEY) || AEROPORTO_DEFAULT;
  } catch {
    return AEROPORTO_DEFAULT;
  }
}

function salvarUltimoAeroporto(valor: string) {
  try {
    if (valor) localStorage.setItem(AEROPORTO_KEY, valor);
  } catch {
    /* ignore */
  }
}

function formatDate(value: string): string {
  return formatarDataBR(value);
}

function evidenciaResumo(ev: PTRBACompletoEvidencia): string {
  const periodo = ev.horaInicio || ev.horaTermino ? `${ev.horaInicio || '--:--'} as ${ev.horaTermino || '--:--'}` : 'Sem horario';
  return `${periodo} - ${ev.assunto || 'Sem assunto'}`;
}

function evidenciaPreenchida(ev: PTRBACompletoEvidencia): boolean {
  return !!(ev.assunto || ev.imagem || ev.horaInicio || ev.horaTermino || ev.descricao);
}

function evidenciasEmPares(evidencias: PTRBACompletoEvidencia[]) {
  return PTRBA_COMPLETO_EVIDENCIA_PARES.map(([primeiroIndex, segundoIndex], grupoIndex) => {
    const primeira = evidencias[primeiroIndex] || EVIDENCIA_VAZIA;
    const segunda = evidencias[segundoIndex] || EVIDENCIA_VAZIA;
    return { grupoIndex, primeiroIndex, segundoIndex, primeira, segunda };
  }).filter(({ primeira, segunda }) => evidenciaPreenchida(primeira) || evidenciaPreenchida(segunda));
}

function normalizarBusca(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function extrairInstrucoesPTREscala(escala?: EscalaDiaria): InstrucaoPTRDaEscala[] {
  if (!escala) return [];
  return [
    { numero: 1 as const, slot: escala.ptr1 },
    { numero: 2 as const, slot: escala.ptr2 },
    { numero: 3 as const, slot: escala.ptr3 },
  ].map(({ numero, slot }) => ({
    numero,
    funcao: String(slot?.funcao || '').trim(),
    nomeGuerra: String(slot?.nomeGuerra || '').trim(),
    assunto: String(slot?.assunto || '').trim(),
  })).filter(instrucao => instrucao.nomeGuerra || instrucao.assunto);
}

function resolverPessoaInstrutor(nomeGuerra: string, opcoes: AtivoItem[], funcao?: string): AtivoItem | null {
  const nomeAlvo = normalizarBusca(nomeGuerra);
  if (!nomeAlvo) return null;
  const cargoAlvo = normalizarBusca(funcao || '');
  const pontuadas = opcoes.map(pessoa => {
    const nomes = [pessoa.nomeGuerra, pessoa.nomeCompleto].map(normalizarBusca).filter(Boolean);
    const cargoOk = !cargoAlvo || normalizarBusca(pessoa.cargo || '') === cargoAlvo;
    const exato = nomes.some(nome => nome === nomeAlvo);
    const parcial = nomeAlvo.length > 2 && nomes.some(nome => nome.includes(nomeAlvo) || nomeAlvo.includes(nome));
    const score = exato && cargoOk ? 4 : exato ? 3 : parcial && cargoOk ? 2 : parcial ? 1 : 0;
    return { pessoa, score };
  }).filter(item => item.score > 0).sort((a, b) => b.score - a.score);
  return pontuadas[0]?.pessoa || null;
}

function situacaoInstrutor(numeros: InstrucaoPTRNumero[]): string {
  const unicos = Array.from(new Set(numeros)).sort((a, b) => a - b);
  if (unicos.length === 0) return 'P';
  if (unicos.length === 1) return `INSTR. ${unicos[0]}`;
  if (unicos.length === 3) return 'INSTR. 1-2-3';
  if (unicos.includes(1) && unicos.includes(3)) return 'INSTR. 1-3';
  return `INSTR. ${unicos.join('-')}`;
}

function montarInicial(equipePadrao?: string | null): Omit<PTRBACompleto, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'> {
  const equipe = PTRBA_COMPLETO_EQUIPES.includes(equipePadrao as Equipe) ? equipePadrao as Equipe : '';
  return {
    data: hojeLocalISO(),
    equipe,
    identificacaoAeroporto: getUltimoAeroporto(),
    observacoes: '',
    chefeEquipe: '',
    participantes: criarParticipantesPTRBACompletoVazios(),
    evidencias: criarEvidenciasPTRBACompletoVazias(),
  };
}

async function reduzirImagem(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Erro ao ler imagem.'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Imagem invalida.'));
    image.src = dataUrl;
  });

  const maxW = 1280;
  const maxH = 900;
  const ratio = Math.min(1, maxW / img.width, maxH / img.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.width * ratio));
  canvas.height = Math.max(1, Math.round(img.height * ratio));
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.82);
}

function PTRBACompletoForm({
  registro,
  onCancel,
  onSave,
  bombeiros,
  apocs,
  feriasGozo,
  substituicoesTemporarias,
  escalasDiarias,
  vigencias,
  trocaFills,
  canEscolherEquipe,
  equipeEfetiva,
}: {
  registro?: PTRBACompleto;
  onCancel: () => void;
  onSave: (input: Omit<PTRBACompletoInput, 'createdBy' | 'updatedBy'>) => void;
  bombeiros: Bombeiro[];
  apocs: APOC[];
  feriasGozo: FeriasGozo[];
  substituicoesTemporarias: SubstituicaoTemporaria[];
  escalasDiarias: EscalaDiaria[];
  vigencias: any[];
  trocaFills: any[];
  canEscolherEquipe: boolean;
  equipeEfetiva: string | null;
}) {
  const [form, setForm] = useState(() => montarInicial(canEscolherEquipe ? null : equipeEfetiva));
  const ultimaAutoFill = useRef('');
  const ultimaEscalaPTRFill = useRef('');

  useEffect(() => {
    if (registro) {
      setForm({
        data: registro.data,
        equipe: registro.equipe,
        identificacaoAeroporto: registro.identificacaoAeroporto,
        observacoes: registro.observacoes,
        chefeEquipe: registro.chefeEquipe,
        participantes: normalizarParticipantesPTRBACompleto(registro.participantes),
        evidencias: normalizarEvidenciasPTRBACompleto(registro.evidencias),
      });
      return;
    }
    setForm(montarInicial(canEscolherEquipe ? null : equipeEfetiva));
  }, [registro, canEscolherEquipe, equipeEfetiva]);

  const opcoesParticipantes: AtivoItem[] = useMemo(() => {
    const efetivo = montarEfetivoOperacional({
      bombeiros,
      feriasGozo,
      vigencias,
      trocaFills,
      substituicoesTemporarias,
      equipe: form.equipe,
      dataPlantao: form.data,
    });
    const bombeirosList = montarOpcoesEfetivoOperacional(efetivo, form.equipe);
    const apocsList = apocs.map(a => ({
      id: a.id,
      nomeGuerra: a.nomeGuerra,
      nomeCompleto: a.nomeCompleto,
      cargo: 'APOC',
      equipe: a.equipe,
    }));
    return [...bombeirosList, ...apocsList];
  }, [bombeiros, apocs, feriasGozo, vigencias, trocaFills, substituicoesTemporarias, form.equipe, form.data]);

  useEffect(() => {
    if (registro) return;
    if (!form.equipe) return;
    const chave = `${form.equipe}-${form.data}`;
    if (ultimaAutoFill.current === chave) return;
    ultimaAutoFill.current = chave;
    const usados = new Set<string>();
    const membros = opcoesParticipantes.filter(p => p.equipe === form.equipe && p.cargo !== 'APOC');
    const preenchidos = criarParticipantesPTRBACompletoVazios().map(slot => {
      const pessoa = membros.find(b => b.cargo === slot.funcao && !usados.has(b.id));
      if (!pessoa) return { funcao: '', nomeCompleto: '', situacao: '' };
      usados.add(pessoa.id);
      return {
        ...slot,
        nomeCompleto: pessoa.nomeCompleto,
      };
    });
    const chefeEquipe = preenchidos.find(p => p.funcao === 'BA-CE')?.nomeCompleto || '';
    setForm(f => ({ ...f, participantes: preenchidos, chefeEquipe }));
  }, [registro, form.equipe, form.data, opcoesParticipantes]);

  useEffect(() => {
    if (registro) return;
    if (!form.equipe) return;
    const escala = escalasDiarias.find(e => e.equipe === form.equipe && mesmoDiaISO(e.dataPlantao, form.data));
    const instrucoesBase = extrairInstrucoesPTREscala(escala);
    if (!escala || instrucoesBase.length === 0) return;

    const assinatura = instrucoesBase
      .map(instrucao => `${instrucao.numero}:${instrucao.funcao}:${instrucao.nomeGuerra}:${instrucao.assunto}`)
      .join('|');
    const chave = `${form.equipe}-${form.data}-${escala.id}-${assinatura}`;
    if (ultimaEscalaPTRFill.current === chave) return;
    ultimaEscalaPTRFill.current = chave;

    const instrucoes = instrucoesBase.map(instrucao => ({
      ...instrucao,
      pessoa: resolverPessoaInstrutor(instrucao.nomeGuerra, opcoesParticipantes, instrucao.funcao),
    }));

    setForm(f => {
      const participantes = normalizarParticipantesPTRBACompleto(f.participantes);
      const grupos = new Map<string, {
        numeros: InstrucaoPTRNumero[];
        nomeCompleto: string;
        funcao: string;
      }>();

      instrucoes.forEach(instrucao => {
        if (!instrucao.nomeGuerra) return;
        const nomeCompleto = instrucao.pessoa?.nomeCompleto || instrucao.nomeGuerra;
        const chavePessoa = instrucao.pessoa?.id || normalizarBusca(nomeCompleto);
        const atual = grupos.get(chavePessoa) || {
          numeros: [],
          nomeCompleto,
          funcao: instrucao.pessoa?.cargo || instrucao.funcao,
        };
        atual.numeros.push(instrucao.numero);
        if (!atual.funcao) atual.funcao = instrucao.funcao;
        grupos.set(chavePessoa, atual);
      });

      Array.from(grupos.values()).forEach(grupo => {
        const nomeKey = normalizarBusca(grupo.nomeCompleto);
        let index = participantes.findIndex(p => normalizarBusca(p.nomeCompleto) === nomeKey);
        if (index < 0 && grupo.funcao) {
          index = participantes.findIndex(p => !p.nomeCompleto && p.funcao === grupo.funcao);
        }
        if (index < 0) {
          index = participantes.findIndex(p => !p.nomeCompleto);
        }
        if (index < 0) return;

        const atual = participantes[index];
        participantes[index] = {
          funcao: atual.funcao || grupo.funcao,
          nomeCompleto: grupo.nomeCompleto,
          situacao: situacaoInstrutor(grupo.numeros),
        };
      });

      const evidencias = normalizarEvidenciasPTRBACompleto(f.evidencias);
      instrucoes.forEach(instrucao => {
        if (!instrucao.assunto) return;
        const par = PTRBA_COMPLETO_EVIDENCIA_PARES[instrucao.numero - 1];
        if (!par) return;
        par.forEach(index => {
          evidencias[index] = { ...evidencias[index], assunto: instrucao.assunto };
        });
      });

      const chefeEquipe = participantes.find(p => p.funcao === 'BA-CE' && p.nomeCompleto)?.nomeCompleto || f.chefeEquipe;
      return { ...f, participantes, evidencias, chefeEquipe };
    });
  }, [registro, escalasDiarias, form.equipe, form.data, opcoesParticipantes]);

  function updateEquipe(equipe: string) {
    if (!canEscolherEquipe) return;
    if (!equipe) {
      ultimaAutoFill.current = '';
      ultimaEscalaPTRFill.current = '';
      setForm(f => ({
        ...f,
        equipe: '',
        chefeEquipe: '',
        participantes: criarParticipantesPTRBACompletoVazios(),
      }));
      return;
    }
    setForm(f => ({ ...f, equipe }));
  }

  function updateParticipante(index: number, field: keyof PTRBACompletoParticipante, value: string) {
    setForm(f => {
      const participantes = [...f.participantes];
      participantes[index] = { ...participantes[index], [field]: value };
      const chefeEquipe = participantes.find(p => p.funcao === 'BA-CE' && p.nomeCompleto)?.nomeCompleto || f.chefeEquipe;
      return { ...f, participantes, chefeEquipe };
    });
  }

  function updateEvidencia(index: number, field: keyof PTRBACompletoEvidencia, value: string) {
    setForm(f => {
      const evidencias = [...f.evidencias];
      evidencias[index] = { ...evidencias[index], [field]: value };
      return { ...f, evidencias };
    });
  }

  function updateEvidenciaPar(index: number, field: CampoCompartilhadoEvidencia, value: string) {
    setForm(f => {
      const evidencias = [...f.evidencias];
      const par = PTRBA_COMPLETO_EVIDENCIA_PARES.find(([primeiroIndex, segundoIndex]) =>
        primeiroIndex === index || segundoIndex === index
      );
      const indices = par ? [par[0], par[1]] : [index];

      indices.forEach(evidenciaIndex => {
        evidencias[evidenciaIndex] = { ...evidencias[evidenciaIndex], [field]: value };
      });

      return { ...f, evidencias };
    });
  }

  async function handleImagem(index: number, event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const imagem = await reduzirImagem(file);
      updateEvidencia(index, 'imagem', imagem);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao carregar imagem.');
    } finally {
      event.target.value = '';
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.equipe) {
      alert('Selecione a equipe.');
      return;
    }
    salvarUltimoAeroporto(form.identificacaoAeroporto);
    onSave({
      ...form,
      participantes: normalizarParticipantesPTRBACompleto(form.participantes),
      evidencias: normalizarEvidenciasPTRBACompleto(form.evidencias),
      chefeEquipe: form.chefeEquipe || form.participantes.find(p => p.funcao === 'BA-CE')?.nomeCompleto || '',
    });
  }

  const input = 'w-full rounded-xl border border-graphite-300/60 bg-white/70 px-3 py-2.5 text-sm backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated';
  const inputDisabled = 'w-full rounded-xl border border-graphite-200/60 bg-graphite-100/50 px-3 py-2.5 text-sm text-graphite-400 dark:border-border-dark dark:bg-surface-card/50 dark:text-graphite-500';
  const label = 'mb-1.5 block text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400';
  const card = 'rounded-2xl border border-graphite-200/60 bg-white/80 p-6 shadow-sm backdrop-blur-sm dark:border-border-dark dark:bg-surface-card/80';
  const cardTitle = 'mb-5 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-aviation-600 dark:text-aviation-400';

  function imagemField(idx: number, titulo: string) {
    const ev = form.evidencias[idx];
    return (
      <div className="mt-3">
        <label className={label}>{titulo}</label>
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-graphite-300/70 bg-white/70 p-4 text-center text-sm text-graphite-500 transition-colors hover:border-aviation-400 hover:text-aviation-600 dark:border-border-dark dark:bg-surface-card dark:text-graphite-400">
          {ev?.imagem ? (
            <img src={ev.imagem} alt={titulo} className="max-h-52 w-full rounded-lg object-contain" />
          ) : (
            <>
              <Image className="mb-2 h-8 w-8 text-graphite-300" />
              Selecionar imagem
            </>
          )}
          <input type="file" accept="image/*" onChange={event => handleImagem(idx, event)} className="hidden" />
        </label>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className={card}>
        <h2 className={cardTitle}><FileText className="h-4 w-4" /> Informações Gerais</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className={label}>Data</label>
            <input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} className={input} />
          </div>
          <div>
            <label className={label}>Equipe</label>
            <select value={form.equipe} onChange={e => updateEquipe(e.target.value)} className={input} disabled={!canEscolherEquipe}>
              <option value="">Selecione equipe</option>
              {PTRBA_COMPLETO_EQUIPES
                .filter(eq => canEscolherEquipe || eq === equipeEfetiva)
                .map(eq => <option key={eq} value={eq}>{eq}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Identificacao do Aeroporto</label>
            <input value={form.identificacaoAeroporto} onChange={e => setForm(f => ({ ...f, identificacaoAeroporto: e.target.value }))} className={input} placeholder="Ex: Aeroporto de..." />
          </div>
          <div>
            <label className={label}>Chefe de Equipe</label>
            <input value={form.chefeEquipe} onChange={e => setForm(f => ({ ...f, chefeEquipe: e.target.value }))} className={input} placeholder="Nome do chefe" />
          </div>
        </div>
      </div>

      <div className={card}>
        <h2 className={cardTitle}><Plus className="h-4 w-4" /> Efetivo do PTR-BA</h2>
        <div className="space-y-3">
          {form.participantes.map((participante, index) => (
            <div key={index} className="grid grid-cols-1 gap-3 rounded-xl border border-graphite-200/60 bg-graphite-50/50 p-3 dark:border-border-dark dark:bg-surface-card/50 sm:grid-cols-[52px_130px_1fr_140px]">
              <div>
                <label className={label}>Ord</label>
                <input value={index + 1} disabled className={inputDisabled} />
              </div>
              <div>
                <label className={label}>Função</label>
                <select value={participante.funcao} onChange={e => updateParticipante(index, 'funcao', e.target.value)} className={input}>
                  <option value="">Selecione</option>
                  {PTRBA_COMPLETO_FUNCOES.map(funcao => <option key={funcao} value={funcao}>{funcao}</option>)}
                </select>
              </div>
              <div>
                <label className={label}>Nome Completo</label>
                <SearchSelect
                  value={participante.nomeCompleto}
                  onChange={value => updateParticipante(index, 'nomeCompleto', value)}
                  placeholder="Selecione o nome"
                  cargo={participante.funcao || undefined}
                  equipe={participante.funcao === 'APOC' ? undefined : String(form.equipe)}
                  valueField="nomeCompleto"
                  showCargo
                  showEquipe
                  options={opcoesParticipantes}
                />
              </div>
              <div>
                <label className={label}>Situação</label>
                <select
                  value={participante.situacao}
                  onChange={e => updateParticipante(index, 'situacao', e.target.value)}
                  className={input}
                  title={SITUACOES_TOOLTIP}
                >
                  <option value="" title={SITUACOES_TOOLTIP}>Selecione</option>
                  {PTRBA_COMPLETO_SITUACOES.map(situacao => (
                    <option
                      key={situacao}
                      value={situacao}
                      title={PTRBA_COMPLETO_SITUACAO_DESCRICOES[situacao] || situacao}
                    >
                      {situacao}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={card}>
        <h2 className={cardTitle}><Image className="h-4 w-4" /> Assuntos Ministrados e Evidencias</h2>
        <div className="space-y-4">
          {[0, 2, 4].map(base => {
            const idxDados = base;
            const idxFoto = base + 1;
            const dados = form.evidencias[idxDados] || EVIDENCIA_VAZIA;
            const instrucao = Math.floor(base / 2) + 1;
            return (
              <div key={base} className="rounded-xl border border-graphite-200/60 bg-graphite-50/50 p-4 dark:border-border-dark dark:bg-surface-card/50">
                <p className="mb-3 text-sm font-bold text-graphite-700 dark:text-graphite-200">Instrução {instrucao}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={label}>Hora Inicio</label>
                    <input type="time" value={dados.horaInicio} onChange={e => updateEvidenciaPar(idxDados, 'horaInicio', e.target.value)} className={input} />
                  </div>
                  <div>
                    <label className={label}>Hora Termino</label>
                    <input type="time" value={dados.horaTermino} onChange={e => updateEvidenciaPar(idxDados, 'horaTermino', e.target.value)} className={input} />
                  </div>
                </div>
                <div className="mt-3">
                  <label className={label}>Assunto</label>
                  <select value={dados.assunto} onChange={e => updateEvidenciaPar(idxDados, 'assunto', e.target.value)} className={input}>
                    <option value="">Selecione</option>
                    {ASSUNTOS.map(assunto => <option key={assunto} value={assunto}>{assunto}</option>)}
                  </select>
                </div>
                <div className="mt-3">
                  <label className={label}>Descrição Complementar</label>
                  <textarea value={dados.descricao} onChange={e => updateEvidenciaPar(idxDados, 'descricao', e.target.value)} rows={2} className={input} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-4">
                  {imagemField(idxDados, `Evidência ${idxDados + 1}`)}
                  {imagemField(idxFoto, `Evidência ${idxFoto + 1}`)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={card}>
        <h2 className={cardTitle}><FileText className="h-4 w-4" /> Observações</h2>
        <textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={4} className={input} />
      </div>

      <div className="flex justify-end gap-3">
        <button type="button" onClick={onCancel} className="rounded-xl border border-graphite-300/60 bg-white/80 px-4 py-2.5 text-sm font-medium text-graphite-700 shadow-sm backdrop-blur-sm transition-all hover:bg-graphite-50 dark:border-border-dark dark:bg-surface-card/80 dark:text-graphite-200">
          Cancelar
        </button>
        <button type="submit" className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all hover:from-aviation-500 hover:to-aviation-600">
          <Save className="h-4 w-4" /> {registro ? 'Salvar Alterações' : 'Criar PTR-BA'}
        </button>
      </div>
    </form>
  );
}

function PTRBACompletoCard({
  registro,
  canEdit,
  canDelete,
  downloading,
  previewing,
  auditoriaPessoas,
  onPreviewDocument,
  onEdit,
  onDelete,
  onDownload,
}: {
  registro: PTRBACompleto;
  canEdit: boolean;
  canDelete: boolean;
  downloading: boolean;
  previewing: boolean;
  auditoriaPessoas: Bombeiro[];
  onPreviewDocument: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDownload: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const gruposEvidencias = evidenciasEmPares(registro.evidencias);
  const evidenciasPreenchidas = registro.evidencias.filter(ev => ev.imagem);
  const participantesPreenchidos = registro.participantes.filter(p => p.nomeCompleto);
  const auditoria = resumoAuditoria(registro, auditoriaPessoas);
  const infoCards = [
    { label: 'Data do plantão', value: formatDate(registro.data) },
    { label: 'Equipe', value: registro.equipe },
    { label: 'Aeroporto', value: registro.identificacaoAeroporto || '-' },
    { label: 'Chefe da equipe', value: registro.chefeEquipe || '-' },
  ];

  return (
    <div className={`overflow-hidden rounded-2xl border bg-white/80 shadow-sm backdrop-blur-sm transition-all dark:bg-surface-card/80 ${
      expanded
        ? 'border-aviation-400/70 shadow-lg shadow-aviation-500/10 dark:border-aviation-500/50'
        : 'border-graphite-200/60 hover:border-aviation-300/60 dark:border-border-dark'
    }`}>
      <button
        type="button"
        onClick={() => setExpanded(value => !value)}
        className="flex w-full flex-col gap-4 p-5 text-left transition-all hover:bg-aviation-500/[0.03] lg:flex-row lg:items-start lg:justify-between"
      >
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-graphite-900 dark:text-graphite-100">
              PTR-BA - {registro.equipe} - {formatDate(registro.data)}
            </h3>
            <span className="rounded-full bg-aviation-50 px-2.5 py-1 text-xs font-semibold text-aviation-700 dark:bg-aviation-900/20 dark:text-aviation-300">
              {evidenciasPreenchidas.length} evidência(s)
            </span>
          </div>
          <p className="text-sm text-graphite-500 dark:text-graphite-400">
            {participantesPreenchidos.length} participante(s) preenchido(s)
            {registro.chefeEquipe ? ` - Chefe: ${registro.chefeEquipe}` : ''}
          </p>
          <p className="mt-1 text-xs text-graphite-500 dark:text-graphite-400">{auditoria}</p>
          {gruposEvidencias.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {gruposEvidencias.slice(0, 3).map(grupo => {
                const evidenciaPrincipal = evidenciaPreenchida(grupo.primeira) ? grupo.primeira : grupo.segunda;
                return (
                  <span key={grupo.grupoIndex} className="rounded-lg border border-graphite-200 bg-graphite-50 px-2.5 py-1 text-xs text-graphite-600 dark:border-border-dark dark:bg-surface-hover dark:text-graphite-300">
                    {evidenciaResumo(evidenciaPrincipal)}
                  </span>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 self-start rounded-xl border border-graphite-200 bg-graphite-50 px-3 py-2 text-sm font-semibold text-aviation-700 dark:border-border-dark dark:bg-surface-hover dark:text-aviation-300">
          {expanded ? 'Ocultar detalhes' : 'Ver detalhes'}
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-graphite-200/70 px-5 pb-5 pt-4 dark:border-border-dark">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {infoCards.map(cardInfo => (
              <div key={cardInfo.label} className="rounded-xl border border-graphite-200/70 bg-graphite-50/80 p-3 dark:border-border-dark dark:bg-surface-hover/70">
                <p className="text-[10px] font-black uppercase tracking-wider text-graphite-400 dark:text-graphite-500">{cardInfo.label}</p>
                <p className="mt-1 text-sm font-semibold text-graphite-900 dark:text-graphite-100">{cardInfo.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-graphite-200/70 bg-white/60 p-4 dark:border-border-dark dark:bg-surface-card/60">
            <h4 className="mb-3 text-xs font-black uppercase tracking-wider text-aviation-600 dark:text-aviation-400">Efetivo</h4>
            {participantesPreenchidos.length === 0 ? (
              <p className="text-sm text-graphite-500 dark:text-graphite-400">Nenhum participante preenchido.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-graphite-200 text-left text-xs uppercase tracking-wider text-graphite-400 dark:border-border-dark">
                      <th className="px-3 py-2">Ord</th>
                      <th className="px-3 py-2">Função</th>
                      <th className="px-3 py-2">Nome</th>
                      <th className="px-3 py-2">Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {participantesPreenchidos.map((participante, index) => (
                      <tr key={`${participante.nomeCompleto}-${index}`} className="border-b border-graphite-100 last:border-0 dark:border-border-dark">
                        <td className="px-3 py-2 font-medium text-graphite-700 dark:text-graphite-200">{index + 1}</td>
                        <td className="px-3 py-2 text-graphite-700 dark:text-graphite-200">{participante.funcao || '-'}</td>
                        <td className="px-3 py-2 font-semibold text-graphite-900 dark:text-graphite-100">{participante.nomeCompleto || '-'}</td>
                        <td className="px-3 py-2 text-graphite-700 dark:text-graphite-200">{participante.situacao || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {gruposEvidencias.length > 0 && (
            <div className="mt-4 space-y-3">
              {gruposEvidencias.map(grupo => {
                const evidenciaPrincipal = evidenciaPreenchida(grupo.primeira) ? grupo.primeira : grupo.segunda;
                const descricoes = Array.from(new Set(
                  [grupo.primeira.descricao, grupo.segunda.descricao]
                    .map(descricao => String(descricao || '').trim())
                    .filter(Boolean)
                ));
                const fotos = [
                  { evidencia: grupo.primeira, index: grupo.primeiroIndex },
                  { evidencia: grupo.segunda, index: grupo.segundoIndex },
                ].filter(item => item.evidencia.imagem);

                return (
                  <div key={grupo.grupoIndex} className="rounded-xl border border-graphite-200/70 bg-white/60 p-4 dark:border-border-dark dark:bg-surface-card/60">
                    <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-black uppercase tracking-wider text-aviation-600 dark:text-aviation-400">Instrução {grupo.grupoIndex + 1}</p>
                        <p className="text-sm font-semibold text-graphite-900 dark:text-graphite-100">{evidenciaResumo(evidenciaPrincipal)}</p>
                      </div>
                      <span className="w-fit rounded-full bg-graphite-100 px-2.5 py-1 text-xs font-semibold text-graphite-500 dark:bg-surface-hover dark:text-graphite-400">
                        {fotos.length} foto(s)
                      </span>
                    </div>
                    {descricoes.length > 0 && (
                      <p className="mb-3 whitespace-pre-wrap text-sm text-graphite-600 dark:text-graphite-300">{descricoes.join('\n\n')}</p>
                    )}
                    {fotos.length > 0 && (
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {fotos.map(({ evidencia, index }) => (
                          <img key={index} src={evidencia.imagem} alt={`Evidencia ${index + 1}`} className="max-h-64 w-full rounded-xl border border-graphite-200/70 bg-graphite-50 object-contain dark:border-border-dark dark:bg-surface-hover" />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {registro.observacoes && (
            <div className="mt-4 rounded-xl border border-graphite-200/70 bg-white/60 p-4 dark:border-border-dark dark:bg-surface-card/60">
              <h4 className="mb-2 text-xs font-black uppercase tracking-wider text-aviation-600 dark:text-aviation-400">Observações</h4>
              <p className="whitespace-pre-wrap text-sm text-graphite-600 dark:text-graphite-300">{registro.observacoes}</p>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-graphite-200/70 pt-4 dark:border-border-dark">
            <button type="button" onClick={onPreviewDocument} disabled={previewing} className="flex items-center gap-2 rounded-xl border border-aviation-300 bg-white px-4 py-2.5 text-sm font-semibold text-aviation-700 transition-all hover:bg-aviation-50 disabled:opacity-60 dark:border-aviation-700 dark:bg-aviation-900/20 dark:text-aviation-300">
              <Eye className="h-4 w-4" /> {previewing ? 'Abrindo documento' : 'Ver documento'}
            </button>
            <button type="button" onClick={onDownload} disabled={downloading} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-aviation-500/20 transition-all hover:from-aviation-500 hover:to-aviation-600 disabled:opacity-60">
              <Download className="h-4 w-4" /> {downloading ? 'Gerando PDF' : 'Download PDF'}
            </button>
            {canEdit && (
              <>
                <button type="button" onClick={onEdit} className="flex items-center gap-2 rounded-xl border border-graphite-300/60 bg-white/80 px-4 py-2.5 text-sm font-semibold text-graphite-700 transition-all hover:bg-graphite-50 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200">
                  <Pencil className="h-4 w-4" /> Editar
                </button>
                {canDelete && (
                  <button type="button" onClick={onDelete} className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-alert-red transition-all hover:bg-red-500/15">
                    <Trash2 className="h-4 w-4" /> Excluir
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PTRBACompletoPdfPreviewModal({
  title,
  pdfData,
  onClose,
}: {
  title: string;
  pdfData: ArrayBuffer | null;
  onClose: () => void;
}) {
  if (!pdfData) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex h-[92vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-xl shadow-black/10 dark:bg-surface-elevated">
        <div className="flex items-center justify-between gap-3 border-b border-graphite-200/70 px-5 py-4 dark:border-border-dark">
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-graphite-900 dark:text-graphite-100">{title}</p>
            <p className="text-xs text-graphite-500 dark:text-graphite-400">Visualização do PDF</p>
          </div>
          <button onClick={onClose} className="rounded-xl border border-graphite-300/60 bg-white/80 p-2 text-graphite-600 transition-all hover:bg-graphite-50 dark:border-border-dark dark:bg-surface-card dark:text-graphite-300" title="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-graphite-100/60 p-4 dark:bg-surface-card/40">
          <PdfPreview pdfData={pdfData} fields={[]} />
        </div>
      </div>
    </div>
  );
}

export function PTRBACompletoPage() {
  const { user, contexto, equipeEfetiva } = useContextoOperacional();
  const username = user?.username || '';
  const podeCriar = canCriarRegistrosDiarios(contexto);
  const canCreate = podeCriar;
  const canEscolherEquipe = canEscolherEquipeRegistrosDiarios(contexto);
  const equipePadrao = equipePadraoRegistrosDiarios(contexto) || equipeEfetiva;
  const [registros, setRegistros] = useState<PTRBACompleto[]>([]);
  const [bombeiros, setBombeiros] = useState<Bombeiro[]>([]);
  const [apocs, setApocs] = useState<APOC[]>([]);
  const [feriasGozo, setFeriasGozo] = useState<FeriasGozo[]>([]);
  const [substituicoesTemporarias, setSubstituicoesTemporarias] = useState<SubstituicaoTemporaria[]>([]);
  const [escalasDiarias, setEscalasDiarias] = useState<EscalaDiaria[]>([]);
  const [vigencias, setVigencias] = useState<any[]>([]);
  const [trocaFills, setTrocaFills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'list' | 'form'>('list');
  const [editando, setEditando] = useState<PTRBACompleto | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [previewPdfData, setPreviewPdfData] = useState<ArrayBuffer | null>(null);
  const [previewPdfTitle, setPreviewPdfTitle] = useState('');
  const [filtroAno, setFiltroAno] = useState(new Date().getFullYear().toString());
  const [filtroMes, setFiltroMes] = useState('');
  const [filtroEquipe, setFiltroEquipe] = useState('');
  const inputClass = 'rounded-xl border border-graphite-300/60 bg-white/70 px-3 py-2.5 text-sm backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated';

  const registrosFiltrados = registros.filter(registro => {
    if (filtroEquipe && registro.equipe !== filtroEquipe) return false;
    if (filtroAno && !registro.data.startsWith(filtroAno)) return false;
    if (filtroMes) {
      const d = new Date(`${registro.data}T12:00:00`);
      if (String(d.getMonth() + 1) !== filtroMes) return false;
    }
    return true;
  });

  async function carregar() {
    const lista = await listarPTRBACompletos();
    setRegistros(lista);
  }

  useEffect(() => {
    let cancelado = false;
    async function init() {
      try {
        setLoading(true);
        const [lista, b, a, gozos, substituicoes, v, escalas] = await Promise.all([
          listarPTRBACompletos(),
          listarBombeiros(),
          listarAPOCs(),
          listarFeriasGozo(),
          listarSubstituicoesTemporarias(),
          listarVigencias({ ativa: true }),
          listarEscalas(),
        ]);
        if (cancelado) return;
        setRegistros(lista);
        setBombeiros(b);
        setApocs(a);
        setFeriasGozo(gozos);
        setSubstituicoesTemporarias(substituicoes);
        setVigencias(v);
        setEscalasDiarias(escalas);
        try {
          const docs = await listarDocumentos();
          const trocaDoc = (docs as any[]).find((d: any) => d.name?.includes('TROCA') || d.source_module === 'trocas');
          if (trocaDoc) {
            const trocas = await listarPreenchimentos({ documentId: trocaDoc.id, status: 'signed' });
            if (!cancelado) setTrocaFills(trocas);
          }
        } catch { /* trocas são opcionais */ }
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Erro ao carregar PTR-BA.');
      } finally {
        if (!cancelado) setLoading(false);
      }
    }
    init();
    return () => { cancelado = true; };
  }, []);

  async function handleSave(input: Omit<PTRBACompletoInput, 'createdBy' | 'updatedBy'>) {
    try {
      if (editando?.id) {
        if (!canEditarRegistroDiario(contexto, editando, username, bombeiros)) {
          alert('Você só pode editar PTR-BA que você criou, que foi criado pelo chefe no caso de BA-LR, ou que pertence à sua equipe fixa autorizada.');
          return;
        }
      } else if (!canCriarRegistrosDiarios(contexto)) {
        alert('Você não tem permissão para criar PTR-BA.');
        return;
      }
      const equipeAlvo = canEscolherEquipe ? input.equipe : equipePadrao || input.equipe;
      const payload = { ...input, equipe: equipeAlvo as Equipe };
      if (editando?.id) {
        await atualizarPTRBACompleto(editando.id, { ...payload, updatedBy: username });
      } else {
        await criarPTRBACompleto({ ...payload, createdBy: username });
      }
      setEditando(null);
      await carregar();
      setMode('list');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao salvar PTR-BA.');
    }
  }

  async function handleDelete(id: string) {
    try {
      const alvo = registros.find(registro => registro.id === id);
      if (!alvo || !canExcluirRegistroDiario(contexto, alvo, username, bombeiros)) {
        alert('Você só pode excluir PTR-BA que você criou (ou que seu chefe de equipe criou, no caso de BA-LR).');
        setConfirmDelete(null);
        return;
      }
      await excluirPTRBACompleto(id);
      setConfirmDelete(null);
      await carregar();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir PTR-BA completo.');
    }
  }

  async function handleDownload(registro: PTRBACompleto) {
    try {
      setDownloadingId(registro.id);
      await baixarPTRBACompletoPdf(registro);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao gerar PDF.');
    } finally {
      setDownloadingId(null);
    }
  }

  async function handlePreviewPdf(registro: PTRBACompleto) {
    try {
      setPreviewingId(registro.id);
      const blob = await gerarPTRBACompletoPdf(registro);
      setPreviewPdfData(await blob.arrayBuffer());
      setPreviewPdfTitle(`PTR-BA - ${registro.equipe} - ${formatDate(registro.data)}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao visualizar PDF.');
    } finally {
      setPreviewingId(null);
    }
  }

  function closePreviewPdf() {
    setPreviewPdfData(null);
    setPreviewPdfTitle('');
  }

  if (mode === 'form') {
    return (
      <PageContainer>
        <PageTitle icon={FileText} title={`PTR-BA - ${editando ? 'Editar' : 'Novo'} Registro`} />
        <PTRBACompletoForm
          registro={editando || undefined}
          onCancel={() => { setMode('list'); setEditando(null); }}
          onSave={handleSave}
          bombeiros={bombeiros}
          apocs={apocs}
          feriasGozo={feriasGozo}
          substituicoesTemporarias={substituicoesTemporarias}
          escalasDiarias={escalasDiarias}
          vigencias={vigencias}
          trocaFills={trocaFills}
          canEscolherEquipe={canEscolherEquipe}
          equipeEfetiva={equipePadrao}
        />
      </PageContainer>
    );
  }

  if (loading) {
    return (
      <PageContainer>
        <PageTitle icon={FileText} title="PTR-BA" />
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-aviation-500 border-t-transparent" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageTitle icon={FileText} title="PTR-BA" />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <select value={filtroAno} onChange={e => setFiltroAno(e.target.value)} className={inputClass}>
            <option value="">Todos os anos</option>
            {ANOS.map(ano => <option key={ano} value={ano}>{ano}</option>)}
          </select>
          <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)} className={inputClass}>
            <option value="">Todos os meses</option>
            {MESES.slice(1).map((mes, index) => <option key={index + 1} value={index + 1}>{mes}</option>)}
          </select>
          <select value={filtroEquipe} onChange={e => setFiltroEquipe(e.target.value)} className={inputClass}>
            <option value="">Todas as equipes</option>
            {PTRBA_COMPLETO_EQUIPES.map(equipe => <option key={equipe} value={equipe}>{equipe}</option>)}
          </select>
          <p className="text-sm text-graphite-500 dark:text-graphite-400">{registrosFiltrados.length} registro(s)</p>
        </div>
        {canCreate && (
          <button onClick={() => { setEditando(null); setMode('form'); }} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all hover:from-aviation-500 hover:to-aviation-600">
            <Plus className="h-4 w-4" /> Novo PTR-BA
          </button>
        )}
      </div>

      {registrosFiltrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300/60 bg-white/50 p-12 text-center backdrop-blur-sm dark:border-border-dark dark:bg-surface-card">
          <FileText className="mb-4 h-12 w-12 text-graphite-300 dark:text-graphite-600" />
          <h3 className="mb-2 text-lg font-semibold text-graphite-700 dark:text-graphite-300">Nenhum registro encontrado</h3>
          <p className="text-sm text-graphite-400">{canCreate ? 'Clique em "Novo PTR-BA" para criar o primeiro.' : 'Nenhum registro disponível.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {registrosFiltrados.map(registro => {
            const podeAlterar = canEditarRegistroDiario(contexto, registro, username, bombeiros);
            const podeExcluir = canExcluirRegistroDiario(contexto, registro, username, bombeiros);
            return (
              <PTRBACompletoCard
                key={registro.id}
                registro={registro}
                canEdit={podeAlterar}
                canDelete={podeExcluir}
                downloading={downloadingId === registro.id}
                previewing={previewingId === registro.id}
                auditoriaPessoas={bombeiros}
                onPreviewDocument={() => handlePreviewPdf(registro)}
                onEdit={() => { setEditando(registro); setMode('form'); }}
                onDelete={() => setConfirmDelete(registro.id)}
                onDownload={() => handleDownload(registro)}
              />
            );
          })}
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white/95 p-6 shadow-xl shadow-black/5 backdrop-blur-sm dark:bg-surface-elevated/95">
            <h3 className="mb-2 text-lg font-bold text-graphite-900 dark:text-graphite-100">Confirmar exclusão</h3>
            <p className="mb-6 text-sm text-graphite-500 dark:text-graphite-400">Tem certeza que deseja excluir este PTR-BA?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(null)} className="rounded-xl border border-graphite-300/60 bg-white/80 px-4 py-2 text-sm font-medium text-graphite-700 shadow-sm backdrop-blur-sm transition-all hover:bg-graphite-50 dark:border-border-dark dark:bg-surface-card/80 dark:text-graphite-200">
                Cancelar
              </button>
              <button onClick={() => handleDelete(confirmDelete)} className="rounded-xl bg-gradient-to-r from-alert-red to-red-700 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-red-500/20 transition-all active:scale-[0.98]">
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
      <PTRBACompletoPdfPreviewModal title={previewPdfTitle} pdfData={previewPdfData} onClose={closePreviewPdf} />
      <PageTour
        steps={PTRBA_COMPLETO_TOUR_STEPS}
        targetAttribute="data-ptrba-completo-tour"
        title="Abrir tutorial de PTR-BA"
        detailLabel="PDF"
      />
    </PageContainer>
  );
}

export default PTRBACompletoPage;
