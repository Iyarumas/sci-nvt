import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { listarPrePreenchimentos } from '../../services/prePreenchimentoService';
import type { PrePreenchimento, TelaPrePreenchimento } from '../../types/prePreenchimento';

/** Trechos que a pessoa completa à mão, como "Informado TWR e APOC ....". */
const TEM_LACUNA = /\.{3,}|,\.{2,}/;

/**
 * Lista "Usar pré-preenchimento" das telas de registro: preenche Tipo e Descrição com o modelo
 * que o administrador cadastrou para a tela. A pessoa continua podendo mudar tudo depois.
 * Sem modelos cadastrados para a tela, não aparece.
 */
export function PrePreenchimentoSelect({
  tela,
  tipoAtual,
  descricaoAtual,
  onAplicar,
  inputClassName,
}: {
  tela: TelaPrePreenchimento;
  tipoAtual: string;
  descricaoAtual: string;
  onAplicar: (tipo: string, descricao: string) => void;
  inputClassName: string;
}) {
  const [modelos, setModelos] = useState<PrePreenchimento[]>([]);
  const [aplicado, setAplicado] = useState<PrePreenchimento | null>(null);

  useEffect(() => {
    let ativo = true;
    listarPrePreenchimentos(tela)
      .then(lista => { if (ativo) setModelos(lista); })
      .catch(() => { if (ativo) setModelos([]); });
    return () => { ativo = false; };
  }, [tela]);

  if (!modelos.length) return null;

  function escolher(id: string) {
    const modelo = modelos.find(m => m.id === id);
    if (!modelo) return;
    const jaEscrito = tipoAtual.trim() || descricaoAtual.trim();
    const igual = tipoAtual.trim() === modelo.tipo && descricaoAtual.trim() === modelo.descricao;
    if (jaEscrito && !igual && !window.confirm('Substituir o Tipo e a Descrição que já estão escritos pelo pré-preenchimento?')) return;
    onAplicar(modelo.tipo, modelo.descricao);
    setAplicado(modelo);
  }

  const lacuna = aplicado && descricaoAtual === aplicado.descricao && TEM_LACUNA.test(aplicado.descricao);

  return (
    <div className="rounded-xl border border-aviation-200/70 bg-aviation-50/60 p-3 dark:border-aviation-800/40 dark:bg-aviation-900/20">
      <label htmlFor={`pre-preenchimento-${tela}`} className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-aviation-700 dark:text-aviation-300">
        <Sparkles className="h-3.5 w-3.5" /> Usar pré-preenchimento (opcional)
      </label>
      <select
        id={`pre-preenchimento-${tela}`}
        value=""
        onChange={e => escolher(e.target.value)}
        className={inputClassName}
      >
        <option value="">{aplicado ? `Aplicado: ${aplicado.tipo} (escolher outro)` : 'Escolha um modelo para preencher Tipo e Descrição'}</option>
        {modelos.map(m => <option key={m.id} value={m.id}>{m.tipo}</option>)}
      </select>
      <p className="mt-1.5 text-xs text-graphite-500 dark:text-graphite-400">
        {lacuna
          ? 'Complete os trechos com "...." na descrição (nomes, empresa, status) antes de salvar.'
          : 'O texto entra no padrão e você ajusta o que for preciso antes de salvar.'}
      </p>
    </div>
  );
}
