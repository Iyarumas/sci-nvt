import { listarAtivos } from './bombeiroService';
import { listarDocumentos, listarPreenchimentos } from './documentoService';
import { listarFeriasGozo } from './feriasService';
import { listarCompletas } from './escalaMensalService';
import { listarSubstituicoesTemporarias } from './substituicaoTemporariaService';
import { listarVigencias } from './vigenciaSubstituicaoService';
import type { Document, DocumentFill } from '../types/document';
import { montarEfetivoOperacional, trocaServicoAprovada, trocaServicoTemCamposBasicos } from '../utils/efetivoOperacional';
import type { EfetivoOperacionalEntry } from '../utils/efetivoOperacional';

function normalizarTexto(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function documentoEhTrocaServico(doc: Pick<Document, 'name' | 'source_module'> | undefined | null): boolean {
  const sourceModule = normalizarTexto(doc?.source_module);
  const nome = normalizarTexto(doc?.name);
  return sourceModule === 'trocas' || nome.includes('troca') || nome.includes('permuta');
}

export async function listarTrocasServicoAssinadas(): Promise<DocumentFill[]> {
  const docs = await listarDocumentos();
  const trocaDocs = docs.filter(documentoEhTrocaServico);

  if (trocaDocs.length === 0) return [];

  const fills = await Promise.all(
    trocaDocs.map(doc => listarPreenchimentos({ documentId: doc.id }).catch(() => [])),
  );
  return fills.flat().filter(fill =>
    trocaServicoAprovada(fill) &&
    trocaServicoTemCamposBasicos(fill)
  );
}

export async function resolverEfetivoOperacional(
  equipe: string,
  dataPlantao: string,
): Promise<EfetivoOperacionalEntry[]> {
  const [bombeiros, feriasGozo, vigencias, trocaFills, substituicoesTemporarias, escalasCompletas] = await Promise.all([
    listarAtivos(),
    listarFeriasGozo(),
    listarVigencias({ ativa: true }),
    listarTrocasServicoAssinadas(),
    listarSubstituicoesTemporarias(),
    listarCompletas(),
  ]);

  return montarEfetivoOperacional({
    bombeiros,
    feriasGozo,
    vigencias,
    trocaFills,
    escalasCompletas,
    substituicoesTemporarias,
    equipe,
    dataPlantao,
  });
}
