import { listarAtivos } from './bombeiroService';
import { listarDocumentos, listarPreenchimentos } from './documentoService';
import { listarFeriasGozo } from './feriasService';
import { listarVigencias } from './vigenciaSubstituicaoService';
import type { DocumentFill } from '../types/document';
import { montarEfetivoOperacional } from '../utils/efetivoOperacional';
import type { EfetivoOperacionalEntry } from '../utils/efetivoOperacional';

export async function listarTrocasServicoAssinadas(): Promise<DocumentFill[]> {
  const docs = await listarDocumentos();
  const trocaDocs = docs.filter(doc =>
    doc.source_module === 'trocas' ||
    doc.name.toLocaleUpperCase('pt-BR').includes('TROCA')
  );

  if (trocaDocs.length === 0) return [];

  const fills = await Promise.all(
    trocaDocs.map(doc => listarPreenchimentos({ documentId: doc.id, status: 'signed' })),
  );
  return fills.flat();
}

export async function resolverEfetivoOperacional(
  equipe: string,
  dataPlantao: string,
): Promise<EfetivoOperacionalEntry[]> {
  const [bombeiros, feriasGozo, vigencias, trocaFills] = await Promise.all([
    listarAtivos(),
    listarFeriasGozo(),
    listarVigencias({ ativa: true }),
    listarTrocasServicoAssinadas(),
  ]);

  return montarEfetivoOperacional({
    bombeiros,
    feriasGozo,
    vigencias,
    trocaFills,
    equipe,
    dataPlantao,
  });
}
