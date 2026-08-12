import { useState } from 'react';
import {
  Plus, Trash2, Download, Eye, Grid,
} from 'lucide-react';
import { gerarGrade, downloadPdf, type GradeConfig } from '../../services/pdfService';
import { PdfPreview } from './PdfPreview';

interface Props {
  onBack: () => void;
  onSaveAsTemplate?: (blob: Blob, name: string) => void;
  isAdmin?: boolean;
}

const PRESETS: Record<string, Partial<GradeConfig>> = {
  'Tabela Simples': {
    colunas: [
      { label: 'Item', width: 1 },
      { label: 'Descricao', width: 3 },
      { label: 'Qtd', width: 1 },
    ],
    numLinhas: 10,
    alturaLinha: 25,
  },
  'Formulario de Troca': {
    titulo: 'FORMULARIO DE TROCA DE SERVICOS',
    colunas: [
      { label: 'Campo', width: 2 },
      { label: 'Valor', width: 3 },
    ],
    numLinhas: 12,
    alturaLinha: 22,
  },
  'Lista de Presenca': {
    titulo: 'LISTA DE PRESENCA',
    colunas: [
      { label: 'Nº', width: 0.5 },
      { label: 'Nome', width: 3 },
      { label: 'Funcao', width: 2 },
      { label: 'Assinatura', width: 2 },
    ],
    numLinhas: 20,
    alturaLinha: 20,
  },
  'Controle de EPI': {
    titulo: 'CONTROLE DE EPI',
    colunas: [
      { label: 'EPI', width: 2 },
      { label: 'Fabricante', width: 2 },
      { label: 'Validade', width: 1.5 },
      { label: 'Responsavel', width: 2 },
    ],
    numLinhas: 15,
    alturaLinha: 22,
  },
  'Relatorio de Ocorrencia': {
    titulo: 'RELATORIO DE OCORRENCIA',
    colunas: [
      { label: 'Data', width: 1.5 },
      { label: 'Hora', width: 1 },
      { label: 'Descricao', width: 3 },
      { label: 'Responsavel', width: 2 },
    ],
    numLinhas: 15,
    alturaLinha: 24,
  },
};

export function GridGenerator({ onBack, onSaveAsTemplate: _onSaveAsTemplate, isAdmin: _isAdmin }: Props) {
  const [titulo, setTitulo] = useState('');
  const [subtitulo, setSubtitulo] = useState('');
  const [colunas, setColunas] = useState<{ label: string; width: number }[]>([
    { label: 'Coluna 1', width: 1 },
    { label: 'Coluna 2', width: 2 },
  ]);
  const [numLinhas, setNumLinhas] = useState(10);
  const [alturaLinha, setAlturaLinha] = useState(25);
  const [margemEsquerda, setMargemEsquerda] = useState(40);
  const [margemDireita, setMargemDireita] = useState(40);
  const [margemTopo, setMargemTopo] = useState(50);
  const [margemBaixo, setMargemBaixo] = useState(40);
  const [fontSizeTitulo, setFontSizeTitulo] = useState(16);
  const [fontSizeCabecalho, setFontSizeCabecalho] = useState(10);
  const [fontSizeCelula, _setFontSizeCelula] = useState(10);
  const [larguraPagina, setLarguraPagina] = useState(595);
  const [alturaPagina, setAlturaPagina] = useState(842);
  const [corLinhas, setCorLinhas] = useState('#000000');
  const [espessuraLinhas, setEspessuraLinhas] = useState(1);
  const [previewBlob, setPreviewBlob] = useState<ArrayBuffer | null>(null);
  const [generating, setGenerating] = useState(false);

  function buildConfig(): GradeConfig {
    return {
      titulo, subtitulo, colunas, numLinhas, alturaLinha,
      margemEsquerda, margemDireita, margemTopo, margemBaixo,
      fontSizeTitulo, fontSizeCabecalho, fontSizeCelula,
      larguraPagina, alturaPagina, corLinhas, espessuraLinhas,
    };
  }

  async function handlePreview() {
    setGenerating(true);
    try {
      const blob = await gerarGrade(buildConfig());
      const arrayBuffer = await blob.arrayBuffer();
      setPreviewBlob(arrayBuffer);
    } catch {
      console.error('Erro ao gerar preview');
    } finally {
      setGenerating(false);
    }
  }

  async function handleDownload() {
    setGenerating(true);
    try {
      const blob = await gerarGrade(buildConfig());
      downloadPdf(blob, `${titulo || 'grade'}.pdf`);
    } catch {
      console.error('Erro ao gerar PDF');
    } finally {
      setGenerating(false);
    }
  }

  function applyPreset(name: string) {
    const p = PRESETS[name];
    if (!p) return;
    if (p.titulo !== undefined) setTitulo(p.titulo);
    if (p.colunas) setColunas(p.colunas);
    if (p.numLinhas !== undefined) setNumLinhas(p.numLinhas);
    if (p.alturaLinha !== undefined) setAlturaLinha(p.alturaLinha);
  }

  function addColumn() {
    setColunas([...colunas, { label: `Coluna ${colunas.length + 1}`, width: 1 }]);
  }

  function removeColumn(idx: number) {
    if (colunas.length <= 1) return;
    setColunas(colunas.filter((_, i) => i !== idx));
  }

  function updateColumn(idx: number, field: 'label' | 'width', value: string | number) {
    setColunas(colunas.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Grid className="h-6 w-6 text-aviation-600" />
        <h2 className="text-xl font-bold text-graphite-900 dark:text-graphite-100">Gerador de Grade</h2>
      </div>

      {/* Presets */}
      <div className="rounded-xl border border-graphite-200 bg-white p-4 dark:border-graphite-700 dark:bg-graphite-800">
        <h3 className="mb-3 text-sm font-semibold text-graphite-700 dark:text-graphite-300">Modelos Prontos</h3>
        <div className="flex flex-wrap gap-2">
          {Object.keys(PRESETS).map(name => (
            <button key={name} onClick={() => applyPreset(name)}
              className="rounded-lg border border-graphite-200 px-3 py-1.5 text-xs font-medium text-graphite-700 hover:bg-graphite-50 dark:border-graphite-700 dark:text-graphite-300 dark:hover:bg-graphite-700">
              {name}
            </button>
          ))}
        </div>
      </div>

      {/* Title & subtitle */}
      <div className="rounded-xl border border-graphite-200 bg-white p-4 dark:border-graphite-700 dark:bg-graphite-800">
        <h3 className="mb-3 text-sm font-semibold text-graphite-700 dark:text-graphite-300">Cabecalho</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-graphite-500">Titulo</label>
            <input type="text" value={titulo} onChange={e => setTitulo(e.target.value)}
              placeholder="Ex: LISTA DE PRESENCA"
              className="w-full rounded-lg border border-graphite-200 bg-white px-3 py-2 text-sm dark:border-graphite-700 dark:bg-graphite-800 dark:text-graphite-100" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-graphite-500">Subtitulo</label>
            <input type="text" value={subtitulo} onChange={e => setSubtitulo(e.target.value)}
              placeholder="Opcional"
              className="w-full rounded-lg border border-graphite-200 bg-white px-3 py-2 text-sm dark:border-graphite-700 dark:bg-graphite-800 dark:text-graphite-100" />
          </div>
        </div>
      </div>

      {/* Columns */}
      <div className="rounded-xl border border-graphite-200 bg-white p-4 dark:border-graphite-700 dark:bg-graphite-800">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-graphite-700 dark:text-graphite-300">Colunas ({colunas.length})</h3>
          <button onClick={addColumn}
            className="flex items-center gap-1 rounded-lg bg-aviation-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-aviation-700">
            <Plus className="h-3 w-3" /> Adicionar
          </button>
        </div>
        <div className="space-y-2">
          {colunas.map((col, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input type="text" value={col.label} onChange={e => updateColumn(idx, 'label', e.target.value)}
                placeholder="Nome da coluna"
                className="flex-1 rounded-lg border border-graphite-200 bg-white px-3 py-2 text-sm dark:border-graphite-700 dark:bg-graphite-800 dark:text-graphite-100" />
              <input type="number" value={col.width} onChange={e => updateColumn(idx, 'width', Number(e.target.value))}
                placeholder="Largura" min={0.5} step={0.5}
                className="w-20 rounded-lg border border-graphite-200 bg-white px-3 py-2 text-sm dark:border-graphite-700 dark:bg-graphite-800 dark:text-graphite-100" />
              <button onClick={() => removeColumn(idx)} disabled={colunas.length <= 1}
                className="rounded p-1.5 text-graphite-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-30">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Grid settings */}
      <div className="rounded-xl border border-graphite-200 bg-white p-4 dark:border-graphite-700 dark:bg-graphite-800">
        <h3 className="mb-3 text-sm font-semibold text-graphite-700 dark:text-graphite-300">Configuracoes da Grade</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs text-graphite-500">Linhas</label>
            <input type="number" value={numLinhas} onChange={e => setNumLinhas(Number(e.target.value))}
              min={1} max={100}
              className="w-full rounded-lg border border-graphite-200 bg-white px-3 py-2 text-sm dark:border-graphite-700 dark:bg-graphite-800 dark:text-graphite-100" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-graphite-500">Altura da linha</label>
            <input type="number" value={alturaLinha} onChange={e => setAlturaLinha(Number(e.target.value))}
              min={10} max={100}
              className="w-full rounded-lg border border-graphite-200 bg-white px-3 py-2 text-sm dark:border-graphite-700 dark:bg-graphite-800 dark:text-graphite-100" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-graphite-500">Espessura</label>
            <input type="number" value={espessuraLinhas} onChange={e => setEspessuraLinhas(Number(e.target.value))}
              min={0.5} max={5} step={0.5}
              className="w-full rounded-lg border border-graphite-200 bg-white px-3 py-2 text-sm dark:border-graphite-700 dark:bg-graphite-800 dark:text-graphite-100" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-graphite-500">Cor</label>
            <input type="color" value={corLinhas} onChange={e => setCorLinhas(e.target.value)}
              className="h-[38px] w-full cursor-pointer rounded-lg border border-graphite-200" />
          </div>
        </div>
      </div>

      {/* Margins & page size */}
      <div className="rounded-xl border border-graphite-200 bg-white p-4 dark:border-graphite-700 dark:bg-graphite-800">
        <h3 className="mb-3 text-sm font-semibold text-graphite-700 dark:text-graphite-300">Margens e Pagina</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs text-graphite-500">Margem Esquerda</label>
            <input type="number" value={margemEsquerda} onChange={e => setMargemEsquerda(Number(e.target.value))}
              className="w-full rounded-lg border border-graphite-200 bg-white px-3 py-2 text-sm dark:border-graphite-700 dark:bg-graphite-800 dark:text-graphite-100" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-graphite-500">Margem Direita</label>
            <input type="number" value={margemDireita} onChange={e => setMargemDireita(Number(e.target.value))}
              className="w-full rounded-lg border border-graphite-200 bg-white px-3 py-2 text-sm dark:border-graphite-700 dark:bg-graphite-800 dark:text-graphite-100" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-graphite-500">Margem Topo</label>
            <input type="number" value={margemTopo} onChange={e => setMargemTopo(Number(e.target.value))}
              className="w-full rounded-lg border border-graphite-200 bg-white px-3 py-2 text-sm dark:border-graphite-700 dark:bg-graphite-800 dark:text-graphite-100" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-graphite-500">Margem Baixo</label>
            <input type="number" value={margemBaixo} onChange={e => setMargemBaixo(Number(e.target.value))}
              className="w-full rounded-lg border border-graphite-200 bg-white px-3 py-2 text-sm dark:border-graphite-700 dark:bg-graphite-800 dark:text-graphite-100" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-graphite-500">Largura Pagina (px)</label>
            <input type="number" value={larguraPagina} onChange={e => setLarguraPagina(Number(e.target.value))}
              className="w-full rounded-lg border border-graphite-200 bg-white px-3 py-2 text-sm dark:border-graphite-700 dark:bg-graphite-800 dark:text-graphite-100" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-graphite-500">Altura Pagina (px)</label>
            <input type="number" value={alturaPagina} onChange={e => setAlturaPagina(Number(e.target.value))}
              className="w-full rounded-lg border border-graphite-200 bg-white px-3 py-2 text-sm dark:border-graphite-700 dark:bg-graphite-800 dark:text-graphite-100" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-graphite-500">Font Titulo</label>
            <input type="number" value={fontSizeTitulo} onChange={e => setFontSizeTitulo(Number(e.target.value))}
              className="w-full rounded-lg border border-graphite-200 bg-white px-3 py-2 text-sm dark:border-graphite-700 dark:bg-graphite-800 dark:text-graphite-100" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-graphite-500">Font Cabecalho</label>
            <input type="number" value={fontSizeCabecalho} onChange={e => setFontSizeCabecalho(Number(e.target.value))}
              className="w-full rounded-lg border border-graphite-200 bg-white px-3 py-2 text-sm dark:border-graphite-700 dark:bg-graphite-800 dark:text-graphite-100" />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button onClick={onBack}
          className="rounded-lg border border-graphite-200 px-4 py-2.5 text-sm font-medium text-graphite-700 hover:bg-graphite-50 dark:border-graphite-700 dark:text-graphite-200 dark:hover:bg-graphite-700">
          Voltar
        </button>
        <button onClick={handlePreview} disabled={generating}
          className="flex items-center gap-2 rounded-lg border border-graphite-200 bg-white px-4 py-2.5 text-sm font-medium text-graphite-700 hover:bg-graphite-50 dark:border-graphite-700 dark:bg-graphite-700 dark:text-graphite-200 disabled:opacity-50">
          <Eye className="h-4 w-4" /> {generating ? 'Gerando...' : 'Visualizar'}
        </button>
        <button onClick={handleDownload} disabled={generating}
          className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
          <Download className="h-4 w-4" /> Baixar PDF
        </button>
      </div>

      {/* Preview */}
      {previewBlob && (
        <div className="rounded-xl border border-graphite-200 bg-white p-4 dark:border-graphite-700 dark:bg-graphite-800">
          <h3 className="mb-3 text-sm font-semibold text-graphite-700 dark:text-graphite-300">Preview</h3>
          <div className="max-h-[600px] overflow-auto rounded-lg border border-graphite-200 dark:border-graphite-700">
            <PdfPreview pdfData={previewBlob} fields={[]} />
          </div>
        </div>
      )}
    </div>
  );
}
