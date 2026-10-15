import jsPDF from 'jspdf';
import type { RelatorioFerias } from '../types/relatorioFerias';
import { MESES } from '../types/ferias';
import { formatarDataBR } from '../utils/datas';
import { carregarMedGroupLogo, drawMedGroupLogo } from './pdfLogo';

const X = 10;
const W = 277;
const LIMITE = 195;
const ALTURA_LINHA = 3.8;
const AZUL: [number, number, number] = [30, 58, 95];
const periodo = (inicio: string, fim: string) => `${formatarDataBR(inicio)} a ${fim === '9999-12-31' ? 'Indeterminado' : formatarDataBR(fim)}`;

async function carregarLogoSciNvt(): Promise<string> {
  const response = await fetch('/sci-nvt-logo.png');
  if (!response.ok) throw new Error('Não foi possível carregar o logo da SCI NVT.');
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Não foi possível ler o logo da SCI NVT.'));
    reader.readAsDataURL(blob);
  });
}

export function nomeArquivoRelatorioFerias(relatorio: Pick<RelatorioFerias, 'mes' | 'ano'>): string {
  return `Relatorio_Ferias_${String(relatorio.mes).padStart(2, '0')}-${relatorio.ano}.pdf`;
}

/** O mesmo PDF é usado na prévia, impressão e download; tabelas continuam em novas páginas. */
export async function gerarRelatorioFeriasPdf(relatorio: RelatorioFerias): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({ title: `Relatório de Férias - ${MESES[relatorio.mes - 1]} ${relatorio.ano}`, creator: 'SESCINC Manager' });
  const [logo, logoSci] = await Promise.all([carregarMedGroupLogo(), carregarLogoSciNvt()]);
  const dimensoesSci = doc.getImageProperties(logoSci);
  const escalaSci = Math.min(30 / dimensoesSci.width, 17 / dimensoesSci.height);
  const larguraSci = dimensoesSci.width * escalaSci;
  const alturaSci = dimensoesSci.height * escalaSci;
  let y = 0;

  function novaPagina(adicionar = true) {
    if (adicionar) doc.addPage();
    doc.setTextColor(...AZUL);
    doc.setDrawColor(185, 198, 215);
    drawMedGroupLogo(doc, logo, X, 7, 30, 13);
    doc.addImage(logoSci, 'PNG', X + W - larguraSci, 5 + (17 - alturaSci) / 2, larguraSci, alturaSci);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('RELATÓRIO MENSAL DE FÉRIAS', 148.5, 13, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`${MESES[relatorio.mes - 1].toLocaleUpperCase('pt-BR')} / ${relatorio.ano}`, 148.5, 19, { align: 'center' });
    doc.setDrawColor(185, 198, 215);
    doc.line(X, 24, X + W, 24);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(65, 75, 90);
    doc.text('SCI NVT - Quadro de Efetivos | Férias iniciadas no mês selecionado. Períodos de gozo completos.', X, 29);
    y = 34;
  }

  function cabecalhoTabela(titulo: string, colunas: string[], larguras: number[]) {
    doc.setFillColor(...AZUL);
    doc.rect(X, y, W, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(titulo, X + 3, y + 4.7);
    y += 7;
    let x = X;
    doc.setFontSize(8);
    doc.setTextColor(...AZUL);
    doc.setDrawColor(190, 200, 215);
    for (let i = 0; i < colunas.length; i++) {
      doc.setFillColor(233, 239, 247);
      doc.rect(x, y, larguras[i], 7, 'FD');
      doc.text(colunas[i], x + 2, y + 4.7);
      x += larguras[i];
    }
    y += 7;
  }

  function tabela(titulo: string, colunas: string[], larguras: number[], linhas: string[][], colunasIdentificacao = 0) {
    if (y + 28 > LIMITE) novaPagina();
    cabecalhoTabela(titulo, colunas, larguras);
    for (const valores of linhas) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const textos = valores.map((valor, index) => doc.splitTextToSize(valor || '-', larguras[index] - 4) as string[]);
      let restante = Math.max(...textos.map(texto => texto.length));
      let deslocamento = 0;
      while (restante > 0) {
        if (y + 4 + ALTURA_LINHA > LIMITE) {
          novaPagina();
          cabecalhoTabela(`${titulo} (continuação)`, colunas, larguras);
        }
        const quantidade = Math.min(restante, Math.floor((LIMITE - y - 4) / ALTURA_LINHA));
        const altura = quantidade * ALTURA_LINHA + 4;
        let x = X;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(30, 38, 50);
        doc.setDrawColor(190, 200, 215);
        textos.forEach((texto, index) => {
          doc.rect(x, y, larguras[index], altura);
          // Repete a identificação se uma cadeia longa continuar em outra página.
          const trecho = deslocamento > 0 && index < colunasIdentificacao && texto.length <= deslocamento
            ? texto.slice(0, quantidade)
            : texto.slice(deslocamento, deslocamento + quantidade);
          if (trecho.length) doc.text(trecho, x + 2, y + 4, { lineHeightFactor: ALTURA_LINHA / (8 * 0.352778) });
          x += larguras[index];
        });
        y += altura;
        restante -= quantidade;
        deslocamento += quantidade;
        if (restante > 0) {
          novaPagina();
          cabecalhoTabela(`${titulo} (continuação)`, colunas, larguras);
        }
      }
    }
    y += 6;
  }

  novaPagina(false);
  const total = relatorio.equipes.reduce((soma, equipe) => soma + equipe.pessoas.length, 0);
  doc.setFontSize(8);
  doc.text(`${total} período(s) de férias | ${relatorio.equipes.length} equipe(s)${relatorio.incluirAfastados ? ` | ${relatorio.afastados.length} afastamento(s)` : ''}`, X, y + 2);
  y += 7;
  if (!total) {
    doc.text('Nenhuma pessoa com férias iniciadas neste mês.', X, y + 3);
    y += 12;
  }
  for (const grupo of relatorio.equipes) {
    tabela(`EQUIPE ${grupo.equipe.toLocaleUpperCase('pt-BR')}`,
      ['Pessoa / função de origem', 'Período de gozo', 'Período aquisitivo', 'Substituições / funções exercidas no mês'],
      [50, 38, 38, 151], grupo.pessoas.map(pessoa => [
        `${pessoa.nome}\n${pessoa.cargo}`,
        `${periodo(pessoa.dataInicio, pessoa.dataFim)}\n${pessoa.dias} dia(s)`,
        pessoa.aquisitivoInicio ? `${periodo(pessoa.aquisitivoInicio, pessoa.aquisitivoFim)}\nPeríodo nº ${pessoa.periodoNumero}` : `Não informado\nPeríodo nº ${pessoa.periodoNumero || '-'}`,
        pessoa.coberturas.length ? pessoa.coberturas.map(cobertura =>
          `${cobertura.nome}${cobertura.cargoOriginal ? ` (${cobertura.cargoOriginal})` : ''} assume ${cobertura.cargoExercido || 'função não informada'} na equipe ${cobertura.equipe}.\nSubstitui ${cobertura.substituindoNome} | ${periodo(cobertura.dataInicio, cobertura.dataFim)}`
        ).join('\n\n') : 'Sem substituição disponível registrada para o período.',
      ]), 3);
  }
  if (relatorio.incluirAfastados) {
    tabela('PESSOAS AFASTADAS NO MÊS', ['Pessoa', 'Equipe / função', 'Tipo de afastamento', 'Motivo', 'Período do afastamento', 'Retorno previsto'],
      [49, 29, 40, 69, 58, 32], relatorio.afastados.length ? relatorio.afastados.map(pessoa => [
        pessoa.nome, `${pessoa.equipe}\n${pessoa.cargo}`, pessoa.tipoAfastamento, pessoa.motivo || 'Não informado',
        periodo(pessoa.dataInicio, pessoa.dataFim), pessoa.retorno ? formatarDataBR(pessoa.retorno) : 'Sem previsão',
      ]) : [['Nenhuma pessoa afastada neste mês.', '-', '-', '-', '-', '-']], 2);
  }
  const paginas = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= paginas; pagina++) {
    doc.setPage(pagina);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(85, 95, 110);
    doc.text(`Relatório de Férias - ${MESES[relatorio.mes - 1]} / ${relatorio.ano}`, X, 204);
    doc.text(`Página ${pagina} de ${paginas}`, X + W, 204, { align: 'right' });
  }
  return doc.output('blob');
}
