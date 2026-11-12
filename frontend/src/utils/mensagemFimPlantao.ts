import { HIDROMETRO, type DadosFimPlantao, type ItemChecklistPlantao, type MovimentacaoPlantao } from '../types/fimPlantao';

function dataBR(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : iso;
}

function linhaChecklist(item: ItemChecklistPlantao): string {
  const marca = item.ok ? '✅' : '❌';
  const obs = item.observacao.trim();
  if (item.nome === HIDROMETRO) {
    const leitura = item.valor?.trim() ? `${item.valor.trim()}m³` : '-';
    return `${HIDROMETRO} : ${leitura}${obs ? `(${obs})` : ''}${marca}`;
  }
  // Na alteração vai só o que foi digitado; sem texto, só o ❌.
  if (!item.ok) return obs ? `${item.nome} : ${obs} ${marca}` : `${item.nome} ${marca}`;
  return `${item.nome} ${marca}`;
}

/** Relatório de serviço no modelo que os comunicantes já mandam para o chefe. */
export function montarMensagemFimPlantao(
  data: string,
  equipe: string,
  d: DadosFimPlantao,
  /** Já em ordem do plantão (noite e depois madrugada), incluindo as lançadas nas telas. */
  movimentacoesOrdenadas: MovimentacaoPlantao[] = d.movimentacoes,
): string {
  const partes: string[] = [
    `RELATÓRIO DE SERVIÇO EQUIPE ${equipe.toLocaleUpperCase('pt-BR')}`,
    `${dataBR(data)}🙏🏻🚒🧑‍🚒`,
  ];
  for (const item of d.checklist) partes.push('', linhaChecklist(item));

  const radio = d.radio.filter(r => r.nome.trim() || r.inicio || r.fim);
  if (radio.length) {
    partes.push('', 'Escala de Rádio', '', ...radio.map(r => `${r.inicio || '--:--'}/${r.fim || '--:--'} : ${r.nome.trim() || '-'}`));
  }

  const movimentacoes = movimentacoesOrdenadas.filter(m => m.descricao.trim());
  partes.push('', '', 'Movimentações do dia: ', '');
  if (movimentacoes.length) {
    movimentacoes.forEach((m, i) => {
      if (i) partes.push('');
      // Sem hora (ex.: teste de sirene que não houve): só o texto.
      partes.push(m.hora ? `${m.hora} - ${m.descricao.trim()}` : m.descricao.trim());
    });
  } else {
    partes.push('Sem alterações.');
  }

  if (d.despedida.trim()) partes.push('', '', d.despedida.trim());
  return partes.join('\n');
}
