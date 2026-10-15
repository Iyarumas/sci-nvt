import { BadRequestException } from '@nestjs/common';

// Coluna OC da referência; manter alinhado com frontend/src/types/ptrb.ts.
export const NUMEROS_ASSUNTOS_PTRBA_APOC = [1, 2, 6, 12, 13, 14, 17] as const;

interface Participante {
  funcao: string;
  nomeCompleto: string;
  situacao: string;
}

interface Evidencia {
  horaInicio: string;
  horaTermino: string;
  assunto: string;
  descricao: string;
  imagem: string;
}

function listaJSON<T>(value: unknown): T[] {
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch {
      throw new BadRequestException('Dados do PTR-BA inválidos.');
    }
  }
  if (value == null) return [];
  if (!Array.isArray(value)) throw new BadRequestException('Dados do PTR-BA inválidos.');
  return value as T[];
}

/** Compacta instruções inteiras, mantendo as duas fotos e remapeando INSTR. n. */
export function montarCopiaPTRBAApoc(origem: Record<string, unknown>): Record<string, unknown> | null {
  if (origem.is_apoc) return null;
  const participantes = listaJSON<Participante>(origem.participantes)
    .filter(p => p?.funcao?.trim().toUpperCase() === 'APOC' && p.nomeCompleto?.trim())
    .map(p => ({ ...p, funcao: 'APOC' }));
  if (!participantes.length) return null;

  const evidencias = listaJSON<Evidencia>(origem.evidencias);
  const compactadas: Evidencia[] = [];
  const posicoes = new Map<number, number>();
  for (let index = 0; index < 6; index += 2) {
    const primeira = evidencias[index];
    const segunda = evidencias[index + 1];
    const assunto = primeira?.assunto || segunda?.assunto || '';
    const match = assunto.match(/^\s*(\d{1,2})(?:\s*[.)-]|\s*$)/);
    if (!match || !(NUMEROS_ASSUNTOS_PTRBA_APOC as readonly number[]).includes(Number(match[1]))) continue;
    const dados = {
      assunto,
      horaInicio: primeira?.horaInicio || segunda?.horaInicio || '',
      horaTermino: primeira?.horaTermino || segunda?.horaTermino || '',
      descricao: primeira?.descricao || segunda?.descricao || '',
    };
    posicoes.set(index / 2 + 1, compactadas.length / 2 + 1);
    compactadas.push(
      { ...dados, imagem: primeira?.imagem || '' },
      { ...dados, imagem: segunda?.imagem || '' },
    );
  }
  if (!compactadas.length) return null;

  for (const participante of participantes) {
    if (!participante.situacao?.startsWith('INSTR.')) continue;
    const instrucoes = (participante.situacao.match(/\d+/g) || [])
      .map(numero => posicoes.get(Number(numero))).filter(numero => numero !== undefined);
    participante.situacao = instrucoes.length ? `INSTR. ${instrucoes.join('-')}` : 'P';
  }

  return {
    origem_ptrba_id: origem.id,
    is_apoc: true,
    is_extra: origem.is_extra === true,
    created_by: origem.created_by || '',
    updated_by: origem.updated_by || '',
    updated_at: origem.updated_at,
    data: origem.data,
    equipe: origem.equipe,
    identificacao_aeroporto: origem.identificacao_aeroporto || '',
    observacoes: origem.observacoes || '',
    chefe_equipe: origem.chefe_equipe || '',
    participantes: JSON.stringify(participantes),
    evidencias: JSON.stringify(compactadas),
  };
}
