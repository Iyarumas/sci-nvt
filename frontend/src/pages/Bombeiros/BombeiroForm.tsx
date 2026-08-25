import { useState, useEffect, useRef } from 'react';
import { X, Upload, Check, Move, RotateCcw, ZoomIn } from 'lucide-react';
import { capitalizarNome } from '../../utils/capitalize';
import type { Bombeiro, Cargo, Equipe, Turno, CatCNH, Sexo } from '../../types/bombeiro';
import {
  CARGO_OPTIONS,
  EQUIPE_OPTIONS,
  TURNO_OPTIONS,
  CNH_OPTIONS,
  SEXO_OPTIONS,
  UF_OPTIONS,
  ABBR_CARGO,
  turnoAutoPorEquipe,
  getHorarioTrabalho,
} from '../../types/bombeiro';
import { Autocomplete } from '../../components/documentos/Autocomplete';

interface Props {
  bombeiro?: Bombeiro | null;
  onSave: (data: Omit<Bombeiro, 'id' | 'createdAt' | 'updatedAt'>) => void | Promise<void>;
  onClose: () => void;
  serverError?: string;
}

function formatCPF(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

function formatCEP(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  return digits.replace(/^(\d{5})(\d)/, '$1-$2');
}

function formatTel(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return digits
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
}

function calcularIdade(dataNasc: string): number {
  if (!dataNasc) return 0;
  const hoje = new Date();
  const nasc = new Date(dataNasc);
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const mes = hoje.getMonth() - nasc.getMonth();
  if (mes < 0 || (mes === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade;
}

const inputClass = "w-full rounded-xl border border-graphite-300/60 bg-white/70 px-3 py-2.5 text-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-graphite-600 dark:bg-graphite-800 dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-graphite-700";
const selectClass = "w-full rounded-xl border border-graphite-300/60 bg-white/70 px-3 py-2.5 text-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-graphite-600 dark:bg-graphite-800 dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-graphite-700";
const disabledClass = "w-full rounded-xl border border-graphite-200/60 bg-graphite-100/50 px-3 py-2.5 text-sm text-graphite-500 cursor-not-allowed dark:border-graphite-600 dark:bg-graphite-800 dark:text-graphite-400";
const labelClass = "mb-1 block text-xs font-medium text-graphite-600 dark:text-graphite-400";
const PHOTO_PREVIEW_SIZE = 280;
const PHOTO_OUTPUT_SIZE = 512;

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <legend className="mb-3 text-xs font-semibold uppercase tracking-wider text-aviation-600 dark:text-aviation-400">
      {children}
    </legend>
  );
}

function FotoCropModal({
  src,
  onConfirm,
  onCancel,
}: {
  src: string;
  onConfirm: (foto: string) => void;
  onCancel: () => void;
}) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    setPosition({ x: 0, y: 0 });
    setZoom(1);
  }, [src]);

  const baseScale = imageSize.width && imageSize.height
    ? Math.max(PHOTO_PREVIEW_SIZE / imageSize.width, PHOTO_PREVIEW_SIZE / imageSize.height)
    : 1;
  const renderedWidth = imageSize.width ? imageSize.width * baseScale * zoom : PHOTO_PREVIEW_SIZE;
  const renderedHeight = imageSize.height ? imageSize.height * baseScale * zoom : PHOTO_PREVIEW_SIZE;

  function clampPosition(next: { x: number; y: number }, nextZoom = zoom) {
    if (!imageSize.width || !imageSize.height) return { x: 0, y: 0 };

    const scale = baseScale * nextZoom;
    const width = imageSize.width * scale;
    const height = imageSize.height * scale;
    const maxX = Math.max(0, (width - PHOTO_PREVIEW_SIZE) / 2);
    const maxY = Math.max(0, (height - PHOTO_PREVIEW_SIZE) / 2);

    return {
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    };
  }

  function updateZoom(value: number) {
    const nextZoom = Math.min(3, Math.max(1, value));
    setZoom(nextZoom);
    setPosition(current => clampPosition(current, nextZoom));
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: position.x,
      originY: position.y,
    };
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    setPosition(clampPosition({
      x: drag.originX + e.clientX - drag.startX,
      y: drag.originY + e.clientY - drag.startY,
    }));
  }

  function handlePointerEnd(e: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null;
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  function handleConfirm() {
    const image = imageRef.current;
    if (!image || !image.complete) return;

    const canvas = document.createElement('canvas');
    canvas.width = PHOTO_OUTPUT_SIZE;
    canvas.height = PHOTO_OUTPUT_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const outputScale = PHOTO_OUTPUT_SIZE / PHOTO_PREVIEW_SIZE;
    const imageLeft = (PHOTO_PREVIEW_SIZE - renderedWidth) / 2 + position.x;
    const imageTop = (PHOTO_PREVIEW_SIZE - renderedHeight) / 2 + position.y;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, PHOTO_OUTPUT_SIZE, PHOTO_OUTPUT_SIZE);
    ctx.drawImage(
      image,
      imageLeft * outputScale,
      imageTop * outputScale,
      renderedWidth * outputScale,
      renderedHeight * outputScale,
    );

    onConfirm(canvas.toDataURL('image/jpeg', 0.9));
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-graphite-200 bg-white shadow-2xl dark:border-border-dark dark:bg-surface-elevated">
        <div className="flex items-center justify-between border-b border-graphite-200 px-5 py-4 dark:border-border-dark">
          <div>
            <h3 className="text-base font-bold text-graphite-900 dark:text-graphite-100">Ajustar foto</h3>
            <p className="text-xs text-graphite-500 dark:text-graphite-400">Arraste para enquadrar e use o zoom se precisar.</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl p-1.5 text-graphite-400 transition-all hover:bg-graphite-100 hover:text-graphite-600 dark:hover:bg-surface-hover dark:hover:text-graphite-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-6 px-5 py-5 md:grid-cols-[auto,1fr]">
          <div
            className="relative h-[280px] w-[280px] cursor-grab touch-none overflow-hidden rounded-full border-4 border-aviation-500/70 bg-graphite-900 active:cursor-grabbing"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
          >
            <img
              ref={imageRef}
              src={src}
              alt="Prévia da foto"
              draggable={false}
              onLoad={e => {
                setImageSize({
                  width: e.currentTarget.naturalWidth,
                  height: e.currentTarget.naturalHeight,
                });
                setPosition({ x: 0, y: 0 });
                setZoom(1);
              }}
              className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
              style={{
                width: renderedWidth,
                height: renderedHeight,
                transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px)`,
              }}
            />
            <div className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-white/70 ring-offset-2 ring-offset-graphite-900" />
          </div>

          <div className="flex flex-col justify-between gap-5">
            <div className="space-y-4">
              <div className="rounded-xl border border-graphite-200 bg-graphite-50/70 p-4 dark:border-border-dark dark:bg-surface-card">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-graphite-800 dark:text-graphite-100">
                  <Move className="h-4 w-4 text-aviation-500" />
                  Posição
                </div>
                <p className="text-xs text-graphite-500 dark:text-graphite-400">Clique e arraste em cima da foto para deixar o rosto no centro.</p>
              </div>

              <div>
                <label className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">
                  <ZoomIn className="h-4 w-4" />
                  Zoom
                </label>
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.01"
                  value={zoom}
                  onChange={e => updateZoom(Number(e.target.value))}
                  className="w-full accent-aviation-600"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setPosition({ x: 0, y: 0 });
                  setZoom(1);
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-graphite-300/60 bg-white/80 px-4 py-2 text-sm font-medium text-graphite-700 transition-all hover:bg-graphite-50 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200 dark:hover:bg-surface-hover"
              >
                <RotateCcw className="h-4 w-4" />
                Centralizar
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="rounded-xl border border-graphite-300/60 bg-white/80 px-4 py-2 text-sm font-medium text-graphite-700 transition-all hover:bg-graphite-50 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200 dark:hover:bg-surface-hover"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all hover:from-aviation-500 hover:to-aviation-600"
              >
                <Check className="h-4 w-4" />
                Usar foto
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BombeiroForm({ bombeiro, onSave, onClose, serverError }: Props) {
  const [matricula, setMatricula] = useState('');
  const [nomeCompleto, setNomeCompleto] = useState('');
  const [nomeGuerra, setNomeGuerra] = useState('');
  const [email, setEmail] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [dataAdmissao, setDataAdmissao] = useState('');
  const [cargo, setCargo] = useState<Cargo>('BA-2');
  const [equipe, setEquipe] = useState<Equipe>('Alfa');
  const [turno, setTurno] = useState<Turno>('Diurno');
  const [tipoSanguineo, setTipoSanguineo] = useState('');
  const [cpf, setCpf] = useState('');
  const [rg, setRg] = useState('');
  const [temCnh, setTemCnh] = useState(false);
  const [cnhNumero, setCnhNumero] = useState('');
  const [cnhCategoria, setCnhCategoria] = useState<CatCNH>('');
  const [cnhValidade, setCnhValidade] = useState('');
  const [credencialValidade, setCredencialValidade] = useState('');
  const [foto, setFoto] = useState('');
  const [fotoParaAjustar, setFotoParaAjustar] = useState('');
  const [dataDesligamento, setDataDesligamento] = useState('');
  const [showDesligamento, setShowDesligamento] = useState(false);
  const [erro, setErro] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [endereco, setEndereco] = useState('');
  const [numeroEndereco, setNumeroEndereco] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cep, setCep] = useState('');
  const [uf, setUf] = useState('');
  const [municipio, setMunicipio] = useState('');
  const [loadingCep, setLoadingCep] = useState(false);
  const [cepErro, setCepErro] = useState('');
  const [celular, setCelular] = useState('');
  const [sexo, setSexo] = useState<Sexo>('M');
  const [cursoChefeEquipe, setCursoChefeEquipe] = useState(false);
  const [cursoMotoristaCCI, setCursoMotoristaCCI] = useState(false);
  const [cursoCVE, setCursoCVE] = useState(false);
  const [cveValidade, setCveValidade] = useState('');
  const [municipios, setMunicipios] = useState<string[]>([]);
  const [loadingMunicipios, setLoadingMunicipios] = useState(false);

  useEffect(() => {
    if (bombeiro) {
      setMatricula(bombeiro.matricula);
      setNomeCompleto(bombeiro.nomeCompleto);
      setNomeGuerra(bombeiro.nomeGuerra);
      setEmail(bombeiro.email || '');
      setDataNascimento(bombeiro.dataNascimento);
      setDataAdmissao(bombeiro.dataAdmissao);
      setCargo(bombeiro.cargo);
      setEquipe(bombeiro.equipe);
      setTurno(bombeiro.turno);
      setTipoSanguineo(bombeiro.tipoSanguineo?.toUpperCase() || '');
      setCpf(formatCPF(bombeiro.cpf));
      setRg(bombeiro.rg);
      const possuiCnh = !!(bombeiro.cnhNumero || bombeiro.cnhValidade || bombeiro.credencialValidade || bombeiro.cnhCategoria);
      setTemCnh(possuiCnh);
      setCnhNumero(bombeiro.cnhNumero || '');
      setCnhCategoria(possuiCnh ? (bombeiro.cnhCategoria || 'B') : '');
      setCnhValidade(bombeiro.cnhValidade || '');
      setCredencialValidade(bombeiro.credencialValidade || '');
      setFoto(bombeiro.foto);
      setDataDesligamento(bombeiro.dataDesligamento);
      if (bombeiro.dataDesligamento) setShowDesligamento(true);
      setEndereco(bombeiro.endereco || '');
      setNumeroEndereco(bombeiro.numeroEndereco || '');
      setComplemento(bombeiro.complemento || '');
      setBairro(bombeiro.bairro || '');
      setCep(bombeiro.cep || '');
      setUf(bombeiro.uf || '');
      setMunicipio(bombeiro.municipio || '');
      setCelular(bombeiro.celular || '');
      setSexo(bombeiro.sexo || 'M');
      setCursoChefeEquipe(bombeiro.cursoChefeEquipe || false);
      setCursoMotoristaCCI(bombeiro.cursoMotoristaCCI || false);
      setCursoCVE(bombeiro.cursoCVE || false);
      setCveValidade(bombeiro.cveValidade || '');
    }
  }, [bombeiro]);

  const idade = calcularIdade(dataNascimento);

  useEffect(() => {
    if (!uf) { setMunicipios([]); return; }
    let cancelled = false;
    setLoadingMunicipios(true);
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`)
      .then(r => r.json())
      .then((data: { nome: string }[]) => {
        if (cancelled) return;
        setMunicipios(data.map(m => m.nome).sort((a, b) => a.localeCompare(b)));
      })
      .catch(() => { if (!cancelled) setMunicipios([]); })
      .finally(() => { if (!cancelled) setLoadingMunicipios(false); });
    return () => { cancelled = true; };
  }, [uf]);

  useEffect(() => {
    const cepLimpo = cep.replace(/\D/g, '');
    if (cepLimpo.length !== 8) {
      setCepErro('');
      setLoadingCep(false);
      return;
    }

    const controller = new AbortController();
    setLoadingCep(true);
    setCepErro('');

    fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`, { signal: controller.signal })
      .then(r => r.json())
      .then(d => {
        if (d.erro) {
          setCepErro('CEP nÃ£o encontrado.');
          return;
        }
        if (d.logradouro) setEndereco(d.logradouro);
        if (d.bairro) setBairro(d.bairro);
        if (d.uf) setUf(d.uf);
        if (d.localidade) setMunicipio(d.localidade);
      })
      .catch(err => {
        if ((err as Error).name !== 'AbortError') setCepErro('NÃ£o foi possÃ­vel buscar o CEP.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingCep(false);
      });

    return () => controller.abort();
  }, [cep]);

  function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const input = e.currentTarget;
    const reader = new FileReader();
    reader.onload = () => {
      setFotoParaAjustar(reader.result as string);
      input.value = '';
    };
    reader.readAsDataURL(file);
  }

  function handleEquipeChange(novaEquipe: Equipe) {
    setEquipe(novaEquipe);
    setTurno(turnoAutoPorEquipe(novaEquipe, cargo));
  }

  function handleCargoChange(novoCargo: Cargo) {
    setCargo(novoCargo);
    setTurno(turnoAutoPorEquipe(equipe, novoCargo));
  }

  function handleTemCnhChange(checked: boolean) {
    setTemCnh(checked);
    if (checked) {
      if (!cnhCategoria) setCnhCategoria('B');
      return;
    }
    setCnhNumero('');
    setCnhCategoria('');
    setCnhValidade('');
    setCredencialValidade('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const cnhIncompleta = temCnh && (!cnhNumero || !cnhCategoria || !cnhValidade);
    if (!matricula || !nomeCompleto || !nomeGuerra || !cpf || !sexo || !dataNascimento || !tipoSanguineo || !email || !celular || !endereco || !numeroEndereco || !cep || !uf || !municipio || !dataAdmissao || cnhIncompleta) {
      setErro('Preencha todos os campos obrigatórios.');
      return;
    }
    setErro('');
    setSubmitting(true);
    try {
      await onSave({
      matricula,
      nomeCompleto: capitalizarNome(nomeCompleto),
      nomeGuerra: capitalizarNome(nomeGuerra),
      email,
      dataNascimento,
      idade,
      dataAdmissao,
      cargo,
      equipe,
      turno,
      tipoSanguineo,
      cpf: cpf.replace(/\D/g, ''),
      rg,
      cnhNumero: temCnh ? cnhNumero : '',
      cnhCategoria: temCnh ? cnhCategoria : '',
      cnhValidade: temCnh ? cnhValidade : '',
      credencialValidade: temCnh ? credencialValidade : '',
      foto,
      dataDesligamento,
      endereco,
      numeroEndereco,
      complemento,
      bairro,
      cep: cep.replace(/\D/g, ''),
      uf,
      municipio,
      celular: celular.replace(/\D/g, ''),
      sexo,
      cursoChefeEquipe,
      cursoMotoristaCCI,
      cursoCVE,
      cveValidade,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative flex h-full max-h-full w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl dark:bg-surface-elevated">
        <div className="flex shrink-0 items-center justify-between border-b border-graphite-200 px-6 py-4 dark:border-border-dark">
          <h2 className="text-lg font-bold text-graphite-900 dark:text-graphite-100">
            {bombeiro ? 'Editar Bombeiro' : 'Novo Bombeiro'}
          </h2>
          <button onClick={onClose}
            className="rounded-xl p-1.5 text-graphite-400 transition-all duration-200 hover:bg-graphite-100 hover:text-graphite-600 dark:hover:bg-surface-hover dark:hover:text-graphite-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {(erro || serverError) && <p className="text-sm text-alert-red dark:text-red-400">{erro || serverError}</p>}

            {/* Informações Pessoais */}
            <fieldset>
              <SectionTitle>Informações Pessoais</SectionTitle>
              <div className="flex gap-6">
                <div className="flex-1 grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-4">
                <div className="md:col-span-2">
                  <label className={labelClass}>Nome Completo *</label>
                  <input value={nomeCompleto} onChange={e => setNomeCompleto(e.target.value)} placeholder="Nome completo"
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Nome de Guerra *</label>
                  <input value={nomeGuerra} onChange={e => setNomeGuerra(e.target.value)} placeholder="Nome de guerra"
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>CPF *</label>
                  <input value={cpf} onChange={e => setCpf(formatCPF(e.target.value))} placeholder="000.000.000-00"
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>RG *</label>
                  <input value={rg} onChange={e => setRg(e.target.value)} placeholder="RG"
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Sexo *</label>
                  <select value={sexo} onChange={e => setSexo(e.target.value as Sexo)} className={selectClass}>
                    {SEXO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Data de Nascimento *</label>
                  <input type="date" value={dataNascimento} onChange={e => setDataNascimento(e.target.value)}
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Idade</label>
                  <input value={idade || ''} disabled className={disabledClass} />
                </div>
                <div>
                  <label className={labelClass}>Tipo Sanguíneo *</label>
                  <input value={tipoSanguineo} onChange={e => setTipoSanguineo(e.target.value.toUpperCase())} placeholder="Ex: A+"
                    className={inputClass} />
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass}>E-mail *</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemplo.com"
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Nº Celular *</label>
                  <input value={celular} onChange={e => setCelular(formatTel(e.target.value))} placeholder="(00) 00000-0000"
                    className={inputClass} />
                </div>
                </div>
                <div className="flex shrink-0 flex-col items-center gap-2 pt-6">
                  <label className="flex h-28 w-28 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-graphite-300/60 bg-white/50 transition-all duration-200 hover:border-aviation-500/50 hover:bg-aviation-50/30 dark:border-border-dark dark:bg-surface-card dark:hover:border-aviation-400/50">
                    {foto ? (
                      <img src={foto} alt="preview" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-graphite-400">
                        <Upload className="h-6 w-6" />
                        <span className="text-[10px]">Foto</span>
                      </div>
                    )}
                    <input type="file" accept="image/*" onChange={handleFotoChange} className="hidden" />
                  </label>
                  {foto && (
                    <div className="flex flex-col items-center gap-1">
                      <button type="button" onClick={() => setFotoParaAjustar(foto)}
                        className="text-[11px] font-medium text-aviation-600 underline transition-colors hover:text-aviation-700 dark:text-aviation-300 dark:hover:text-aviation-200">
                        Ajustar foto
                      </button>
                      <button type="button" onClick={() => setFoto('')}
                        className="text-[11px] text-graphite-400 underline transition-colors hover:text-alert-red dark:text-graphite-500">
                        Remover foto
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </fieldset>

            {/* Endereço */}
            <fieldset>
              <SectionTitle>Endereço</SectionTitle>
              <div className="grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-4">
                <div className="md:col-span-2">
                  <label className={labelClass}>Endereço *</label>
                  <input value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Rua, Avenida..."
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Nº *</label>
                  <input value={numeroEndereco} onChange={e => setNumeroEndereco(e.target.value)} placeholder="Número"
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Complemento</label>
                  <input value={complemento} onChange={e => setComplemento(e.target.value)} placeholder="Complemento"
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Bairro</label>
                  <input value={bairro} onChange={e => setBairro(e.target.value)} placeholder="Bairro"
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>CEP *</label>
                  <input value={cep} onChange={e => setCep(formatCEP(e.target.value))} placeholder="00000-000"
                    className={inputClass} />
                  {(loadingCep || cepErro) && (
                    <p className={`mt-0.5 text-[10px] ${cepErro ? 'text-alert-red dark:text-red-400' : 'text-graphite-400 dark:text-graphite-500'}`}>
                      {cepErro || 'Buscando CEP...'}
                    </p>
                  )}
                </div>
                <div>
                  <label className={labelClass}>UF *</label>
                  <select value={uf} onChange={e => { setUf(e.target.value); setMunicipio(''); }} className={selectClass}>
                    <option value="">Selecione</option>
                    {UF_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass}>Município *</label>
                  {uf ? (
                    loadingMunicipios ? (
                      <input disabled value="Carregando municípios..." className={disabledClass} />
                    ) : (
                      <Autocomplete
                        value={municipio}
                        onChange={setMunicipio}
                        options={municipios.map(m => ({ label: m }))}
                        placeholder="Buscar município..."
                        className={inputClass}
                      />
                    )
                  ) : (
                    <input disabled value="" placeholder="Selecione a UF primeiro" className={disabledClass} />
                  )}
                </div>
              </div>
            </fieldset>

            {/* Dados Funcionais */}
            <fieldset>
              <SectionTitle>Dados Funcionais</SectionTitle>
              <div className="grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-4">
                <div>
                  <label className={labelClass}>Matrícula MMS *</label>
                  <input value={matricula} onChange={e => setMatricula(e.target.value)} placeholder="MMS"
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Cargo *</label>
                  <select value={cargo} onChange={e => handleCargoChange(e.target.value as Cargo)} className={selectClass}>
                    {CARGO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Função Abreviada</label>
                  <input value={ABBR_CARGO[cargo] || cargo} disabled className={disabledClass} />
                </div>
                <div>
                  <label className={labelClass}>Data de Admissão *</label>
                  <input type="date" value={dataAdmissao} onChange={e => setDataAdmissao(e.target.value)}
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Equipe *</label>
                  <select value={equipe} onChange={e => handleEquipeChange(e.target.value as Equipe)} className={selectClass}>
                    {EQUIPE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Horário de Trabalho</label>
                  <input value={getHorarioTrabalho(equipe, cargo)} disabled className={disabledClass} />
                </div>
                <div>
                  <label className={labelClass}>Turno *</label>
                  <select value={turno} disabled className={disabledClass}>
                    {TURNO_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <p className="mt-0.5 text-[11px] text-graphite-400 dark:text-graphite-500">Definido automaticamente</p>
                </div>
                {showDesligamento && (
                  <div>
                    <label className={labelClass}>Data de Desligamento</label>
                    <input type="date" value={dataDesligamento} onChange={e => setDataDesligamento(e.target.value)}
                      className={inputClass} />
                  </div>
                )}
              </div>
            </fieldset>

            {/* CNH */}
            <fieldset>
              <SectionTitle>CNH</SectionTitle>
              <div className="space-y-3">
                <label className="flex w-fit items-center gap-3 rounded-xl border border-graphite-300/60 bg-white/70 px-4 py-3 transition-all duration-200 hover:border-aviation-500/50 cursor-pointer dark:border-border-dark dark:bg-surface-card">
                  <input
                    type="checkbox"
                    checked={temCnh}
                    onChange={e => handleTemCnhChange(e.target.checked)}
                    className="h-4 w-4 rounded border-graphite-300 text-aviation-600 focus:ring-aviation-500"
                  />
                  <span className="text-sm font-medium text-graphite-700 dark:text-graphite-200">Possui CNH</span>
                </label>
                {temCnh && (
                  <div className="grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-4">
                <div>
                  <label className={labelClass}>CNH nº *</label>
                  <input value={cnhNumero} onChange={e => setCnhNumero(e.target.value)} placeholder="Número da CNH"
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Categoria CNH *</label>
                  <select value={cnhCategoria} onChange={e => setCnhCategoria(e.target.value as CatCNH)} className={selectClass}>
                    {CNH_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Validade CNH *</label>
                  <input type="date" value={cnhValidade} onChange={e => setCnhValidade(e.target.value)}
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Validade Credencial</label>
                  <input type="date" value={credencialValidade} onChange={e => setCredencialValidade(e.target.value)}
                    className={inputClass} />
                  <p className="mt-0.5 text-[10px] text-graphite-400 dark:text-graphite-500">Quando faltar 6 meses, o chefe e gerente serão notificados</p>
                </div>
                  </div>
                )}
              </div>
            </fieldset>

            {/* Cursos */}
            <fieldset>
              <SectionTitle>Cursos</SectionTitle>
              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-3 rounded-xl border border-graphite-300/60 bg-white/70 px-4 py-3 transition-all duration-200 hover:border-aviation-500/50 cursor-pointer dark:border-border-dark dark:bg-surface-card">
                  <input
                    type="checkbox"
                    checked={cursoChefeEquipe}
                    onChange={e => setCursoChefeEquipe(e.target.checked)}
                    className="h-4 w-4 rounded border-graphite-300 text-aviation-600 focus:ring-aviation-500"
                  />
                  <span className="text-sm font-medium text-graphite-700 dark:text-graphite-200">Curso de Chefe de Equipe</span>
                </label>
                <label className="flex items-center gap-3 rounded-xl border border-graphite-300/60 bg-white/70 px-4 py-3 transition-all duration-200 hover:border-aviation-500/50 cursor-pointer dark:border-border-dark dark:bg-surface-card">
                  <input
                    type="checkbox"
                    checked={cursoMotoristaCCI}
                    onChange={e => setCursoMotoristaCCI(e.target.checked)}
                    className="h-4 w-4 rounded border-graphite-300 text-aviation-600 focus:ring-aviation-500"
                  />
                  <span className="text-sm font-medium text-graphite-700 dark:text-graphite-200">Curso de Motorista/Condutor de CCI</span>
                </label>
                <label className="flex items-center gap-3 rounded-xl border border-graphite-300/60 bg-white/70 px-4 py-3 transition-all duration-200 hover:border-aviation-500/50 cursor-pointer dark:border-border-dark dark:bg-surface-card">
                  <input
                    type="checkbox"
                    checked={cursoCVE}
                    onChange={e => setCursoCVE(e.target.checked)}
                    className="h-4 w-4 rounded border-graphite-300 text-aviation-600 focus:ring-aviation-500"
                  />
                  <span className="text-sm font-medium text-graphite-700 dark:text-graphite-200">Curso de Veículo de Emergência (CVE)</span>
                </label>
                {cursoCVE && (
                  <div className="col-span-2">
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">Validade do CVE</label>
                    <input type="date" value={cveValidade} onChange={e => setCveValidade(e.target.value)}
                      className="w-full rounded-xl border border-graphite-300/60 bg-white/70 px-3 py-2.5 text-sm backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated" />
                  </div>
                )}
              </div>
            </fieldset>
          </div>

          <div className="flex shrink-0 items-center justify-between border-t border-graphite-200 px-6 py-4 dark:border-border-dark">
            <div>
              {bombeiro && !showDesligamento && (
                <button type="button" onClick={() => setShowDesligamento(true)}
                  className="rounded-xl bg-gradient-to-r from-alert-red to-red-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-red-500/20 transition-all duration-200 hover:shadow-xl hover:shadow-red-500/30 hover:from-red-600 hover:to-red-700 active:scale-[0.98]">
                  Registrar Desligamento
                </button>
              )}
              {bombeiro && showDesligamento && (
                <button type="button" onClick={() => { setShowDesligamento(false); setDataDesligamento(''); }}
                  className="text-xs text-graphite-400 underline transition-colors hover:text-alert-red dark:text-graphite-500">
                  Remover desligamento
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={onClose}
                className="rounded-xl border border-graphite-300/60 bg-white/80 px-5 py-2.5 text-sm font-medium text-graphite-700 backdrop-blur-sm transition-all duration-200 hover:bg-graphite-50 hover:border-graphite-300 dark:border-border-dark dark:bg-surface-card/80 dark:text-graphite-200 dark:hover:bg-surface-hover/50">
                Cancelar
              </button>
              <button type="submit" disabled={submitting}
                className="rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all duration-200 hover:shadow-xl hover:shadow-aviation-500/30 hover:from-aviation-500 hover:to-aviation-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60">
                {submitting ? 'Salvando...' : (bombeiro ? 'Salvar Alterações' : 'Cadastrar')}
              </button>
            </div>
          </div>
        </form>
      </div>

      {fotoParaAjustar && (
        <FotoCropModal
          src={fotoParaAjustar}
          onCancel={() => setFotoParaAjustar('')}
          onConfirm={fotoAjustada => {
            setFoto(fotoAjustada);
            setFotoParaAjustar('');
          }}
        />
      )}
    </div>
  );
}
