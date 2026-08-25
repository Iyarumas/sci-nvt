import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';
import { formatarDataBR } from '../utils/datas';
import { nomeDocumentoOperacional } from '../utils/documentFileNames';

function cb(checked: boolean) {
  const fill = checked ? '✓' : '';
  return `<span style="display:inline-flex; align-items:center; justify-content:center; width:9px; height:9px; border:1px solid #000; font-size:8px; line-height:1; vertical-align:middle; position:relative; top:0; font-weight:bold; color:#000;">${fill}</span>`;
}

function escapeHTML(value: unknown): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function textoMultilinha(value: unknown, fallback = 'SEM ALTERAÇÕES'): string {
  const texto = String(value || '').trim();
  return texto ? escapeHTML(texto) : fallback;
}

function secaoCheckbox(titulo: string, temAlteracao: boolean, texto: string): string {
  return `<table class="mb" style="border:1px solid #000; border-collapse:separate; border-spacing:0;">
    <tr><td colspan="6" style="border:none; border-bottom:1px solid #000; font-weight:bold; font-size:11px; background:#d4d4d4; text-align:center; padding:2px 3px;">${titulo}</td></tr>
    <tr><td style="border:none; padding:2px 40px; font-size:11px;">${cb(temAlteracao)} ABAIXO &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${cb(!temAlteracao)} SEM ALTERAÇÕES</td></tr>
    <tr><td style="border:none; border-top:1px solid #000; padding:6px 8px; font-size:11px; line-height:1.25; white-space:pre-wrap;">${textoMultilinha(texto)}</td></tr>
  </table>`;
}

function motivoSubstituicaoLabel(motivo: string | undefined): string {
  if (motivo === 'ferias') return 'Férias';
  if (motivo === 'afastamento') return 'Afastamento';
  if (motivo === 'substituicao') return 'Substituição';
  return 'Cascata';
}

export function dividirEmLancamentos(texto: string): string[] {
  const linhas = texto.split('\n');
  const blocos: string[] = [];
  let atual: string[] = [];
  const iniciaLancamento = (l: string) => /^\d{1,2}:\d{2}\s*-/.test(l.trim());
  const temCabecalho = linhas.some(l => iniciaLancamento(l));
  if (temCabecalho) {
    for (const linha of linhas) {
      const l = linha.trim();
      if (!l) continue;
      if (iniciaLancamento(l) && atual.length > 0) {
        blocos.push(atual.join('\n'));
        atual = [];
      }
      atual.push(linha);
    }
    if (atual.length > 0) blocos.push(atual.join('\n'));
    return blocos;
  }
  for (const linha of linhas) {
    if (!linha.trim()) {
      if (atual.length > 0) {
        blocos.push(atual.join('\n'));
        atual = [];
      }
    } else {
      atual.push(linha);
    }
  }
  if (atual.length > 0) blocos.push(atual.join('\n'));
  return blocos;
}

function linhasLancamento(blocos: string[]): string {
  return blocos.map((bloco, i) => {
    const conteudo = bloco.replace(/\n/g, '<br />');
    const espaco = i > 0 ? '<tr><td style="border:none; padding:2px 8px; font-size:11px;">&nbsp;</td></tr>' : '';
    return `${espaco}<tr><td style="border:none; padding:2px 8px; font-size:11px;">${conteudo}</td></tr>`;
  }).join('');
}

export function montarHTML(dados: Record<string, unknown>, showMarkers = false, isPdf = false): string {
  const e = (k: string, fallback = '') => String(dados[k] ?? fallback);

  const logoUrl = e('logoUrl', '/assets/med-group-logo.png');
  const equipeNome = e('equipeNome').toUpperCase();
  const dataInicio = e('dataInicio');
  const dataFim = e('dataFim');
  const chefeEquipe = e('chefeEquipe').toUpperCase();
  const comunic = e('comunicacao').toUpperCase();
  const dataAss = e('dataAssinatura', formatarDataBR(new Date()));
  const cidade = e('cidade', 'NAVEGANTES');
  const uf = e('uf', 'SC');
  const extTexto = e('extTexto');
  const equipTexto = e('equipTexto');
  const edifTexto = e('edifTexto');
  const tpTexto = e('tpTexto');
  const tpTemAlteracao = !!dados.tpTemAlteracao;
  const extTemAlteracao = !!dados.extTemAlteracao;
  const equipTemAlteracao = !!dados.equipTemAlteracao;
  const edifTemAlteracao = !!dados.edifTemAlteracao;

  const dataPartes = dataAss.replace(/\//g, '-').split('-');
  const dataObj = dataPartes.length === 3
    ? { dia: dataPartes[0], mes: dataPartes[1], ano: dataPartes[2] }
    : { dia: new Date().getDate().toString().padStart(2, '0'), mes: (new Date().getMonth() + 1).toString(), ano: new Date().getFullYear().toString() };

  const nomeMes = (m: string) => {
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return meses[parseInt(m) - 1] || m;
  };

  const chefeAss = e('chefeAssinatura', chefeEquipe).toUpperCase();
  const gerenteAss = e('gerenteAssinatura').toUpperCase();
  const coordAss = e('coordenadorAssinatura').toUpperCase();

  const instrucoes = (dados.instrucoes as string[]) || [];
  const instrucoesHorarios = (dados.instrucoesHorarios as string[]) || [];
  const frota = (dados.frota as Array<Record<string, string>>) || [];
  const ocorrenciasXII = Array.isArray(dados.ocorrenciasXII)
    ? dividirEmLancamentos((dados.ocorrenciasXII as string[]).join('\n\n'))
    : dividirEmLancamentos(String(dados.ocorrenciasXII || ''));
  const solicitacoes = Array.isArray(dados.solicitacoes)
    ? dividirEmLancamentos((dados.solicitacoes as string[]).join('\n\n'))
    : dividirEmLancamentos(String(dados.solicitacoes || ''));
  const substituicao = (dados.substituicao as Array<Record<string, string>>) || [];
  const substituicoesAtivas = (dados.substituicoesAtivas as Array<Record<string, string>>) || [];
  const cci2 = (dados.cci2 as Array<Record<string, string>>) || [];
  const cci3 = (dados.cci3 as Array<Record<string, string>>) || [];
  const crs = (dados.crs as Array<Record<string, string>>) || [];
  const temEmergencia = dados.emergenciaXI as string | undefined;
  const temSubstituicao = substituicao.length > 0;
  const temSubstituicoesAtivas = substituicoesAtivas.length > 0;
  const ocorrenciasNA = e('ocorrenciasNA');
  const inspecoes = e('inspecoes');

  const nome = (items: Array<Record<string, string>>, idx: number) => (items[idx]?.nome || '').toUpperCase();
  const cci2HTML = `<div style="display:grid; grid-template-columns:1fr 1fr 1fr; text-align:left;"><div><span class="b">BA-CE</span> <span>${nome(cci2, 0)}</span></div><div><span class="b">BA-MC</span> <span>${nome(cci2, 1)}</span></div><div><span class="b">BA-2</span> <span>${nome(cci2, 2)}</span></div></div>`;
  const cci3HTML = `<div style="display:grid; grid-template-columns:1fr 1fr 1fr; text-align:left;"><div><span class="b">BA-MC</span> <span>${nome(cci3, 0)}</span></div><div><span class="b">BA-2</span> <span>${nome(cci3, 1)}</span></div><div><span class="b">BA-2</span> <span>${nome(cci3, 2)}</span></div></div>`;
  const crsHTML = `<div style="display:grid; grid-template-columns:1fr 1fr 1fr 1fr; text-align:left;"><div><span class="b">BA-LR</span> <span>${nome(crs, 0)}</span></div><div><span class="b">BA-MC</span> <span>${nome(crs, 1)}</span></div><div><span class="b">BA-RE</span> <span>${nome(crs, 2)}</span></div><div><span class="b">BA-RE</span> <span>${nome(crs, 3)}</span></div></div>`;

  const instrucoesHTML = instrucoes.length > 0
    ? `<tr><td colspan="7" style="border-left:1px solid #000; border-right:1px solid #000; padding:4px 5px; font-size:10px; vertical-align:top; min-height:40px;"><div style="height:1em;"></div>${instrucoes.map((item, i) => `<div style="display:flex; justify-content:space-between; font-size:10px; padding-right:90px;"><span>${item}</span><span style="white-space:nowrap;">${instrucoesHorarios[i] || ''}</span></div>${i < instrucoes.length - 1 ? '<div style=\"height:1em;\"></div>' : ''}`).join('')}<div style="height:1em;"></div></td></tr>`
    : `<tr><td colspan="7" style="border-left:1px solid #000; border-right:1px solid #000; padding:4px 5px; font-size:10px; vertical-align:top; min-height:40px;"><div style="height:1em;"></div></td></tr>`;

  const PREFIXOS_FIXOS = ['F2 X6', 'F3 X6', 'FRT X6', ''];
  const frotaLinhas = frota.length > 0 ? frota.map((f, i) => `
    <tr style="border-top:1px solid #000; border-bottom:1px solid #000;"><td class="b" style="border:none; border-left:1px solid #000; font-size:11px; padding-right:16px; white-space:nowrap; width:50px;">${f.viatura || (i === frota.length - 1 ? '' : '—')}</td><td style="border:none; font-size:11px; padding-left:0; white-space:nowrap; width:40px;">${PREFIXOS_FIXOS[i] || ''}</td><td style="border-left:none; border-right:1px solid #000; font-size:11px; padding:2px 8px; white-space:nowrap;">KM INICIAL</td><td style="border-left:none; border-right:1px solid #000; font-size:11px; padding:2px 16px; white-space:nowrap;">${f.kmIni || ''}</td><td style="border-left:none; border-right:1px solid #000; font-size:11px; padding:2px 8px; white-space:nowrap;">KM FINAL</td><td style="border-left:none; border-right:1px solid #000; font-size:11px; padding:2px 16px; white-space:nowrap;">${f.kmFim || ''}</td><td style="border-left:none; border-right:1px solid #000; font-size:11px; padding:2px 5px; width:100%;">${f.situacao || ''}</td></tr>
  `).join('') : `
    <tr style="border-top:1px solid #000; border-bottom:1px solid #000;"><td class="b" style="border:none; border-left:1px solid #000; font-size:11px; padding-right:16px; white-space:nowrap; width:50px;">CCI 319</td><td style="border:none; font-size:11px; padding-left:0; white-space:nowrap; width:40px;">F2 X6</td><td style="border-left:none; border-right:1px solid #000; font-size:11px; padding:2px 8px; white-space:nowrap;">KM INICIAL</td><td style="border-left:none; border-right:1px solid #000; font-size:11px; padding:2px 16px; white-space:nowrap;"></td><td style="border-left:none; border-right:1px solid #000; font-size:11px; padding:2px 8px; white-space:nowrap;">KM FINAL</td><td style="border-left:none; border-right:1px solid #000; font-size:11px; padding:2px 16px; white-space:nowrap;"></td><td style="border-left:none; border-right:1px solid #000; font-size:11px; padding:2px 5px; width:100%;"></td></tr>
    <tr style="border-top:1px solid #000; border-bottom:1px solid #000;"><td class="b" style="border:none; border-left:1px solid #000; font-size:11px; padding-right:16px; white-space:nowrap; width:50px;">CCI 320</td><td style="border:none; font-size:11px; padding-left:0; white-space:nowrap; width:40px;">F3 X6</td><td style="border-left:none; border-right:1px solid #000; font-size:11px; padding:2px 8px; white-space:nowrap;">KM INICIAL</td><td style="border-left:none; border-right:1px solid #000; font-size:11px; padding:2px 16px; white-space:nowrap;"></td><td style="border-left:none; border-right:1px solid #000; font-size:11px; padding:2px 8px; white-space:nowrap;">KM FINAL</td><td style="border-left:none; border-right:1px solid #000; font-size:11px; padding:2px 16px; white-space:nowrap;"></td><td style="border-left:none; border-right:1px solid #000; font-size:11px; padding:2px 5px; width:100%;"></td></tr>
    <tr style="border-top:1px solid #000; border-bottom:1px solid #000;"><td class="b" style="border:none; border-left:1px solid #000; font-size:11px; padding-right:16px; white-space:nowrap; width:50px;">CCI 333</td><td style="border:none; font-size:11px; padding-left:0; white-space:nowrap; width:40px;">FRT X6</td><td style="border-left:none; border-right:1px solid #000; font-size:11px; padding:4px 8px; white-space:nowrap;">KM INICIAL</td><td style="border-left:none; border-right:1px solid #000; font-size:11px; padding:4px 16px; white-space:nowrap;"></td><td style="border-left:none; border-right:1px solid #000; font-size:11px; padding:4px 8px; white-space:nowrap;">KM FINAL</td><td style="border-left:none; border-right:1px solid #000; font-size:11px; padding:4px 16px; white-space:nowrap;"></td><td style="border-left:none; border-right:1px solid #000; font-size:11px; padding:4px 5px; width:100%;"></td></tr>
    <tr style="border-top:1px solid #000; border-bottom:1px solid #000;"><td class="b" style="border:none; border-left:1px solid #000; font-size:11px; padding-right:16px; white-space:nowrap; width:50px;">CRS</td><td style="border:none; font-size:11px; padding-left:0; white-space:nowrap; width:40px;"></td><td style="border-left:none; border-right:1px solid #000; font-size:11px; padding:2px 8px; white-space:nowrap;">KM INICIAL</td><td style="border-left:none; border-right:1px solid #000; font-size:11px; padding:2px 16px; white-space:nowrap;"></td><td style="border-left:none; border-right:1px solid #000; font-size:11px; padding:2px 8px; white-space:nowrap;">KM FINAL</td><td style="border-left:none; border-right:1px solid #000; font-size:11px; padding:2px 16px; white-space:nowrap;"></td><td style="border-left:none; border-right:1px solid #000; font-size:11px; padding:2px 5px; width:100%;"></td></tr>
  `;

  const subHTML = temSubstituicao
    ? substituicao.map(s => `
      <tr><td colspan="7" style="border-top:none; border-bottom:none; border-left:1px solid #000; border-right:1px solid #000; padding:3px 4px; font-size:11px;"><div style="display:grid; grid-template-columns:2fr 1fr 2fr; text-align:center;"><div><span class="b" style="font-size:11px;">${s.funcao1 || 'BA-2'}</span> <span style="font-size:11px;">${(s.nome1 || '').toUpperCase()}</span></div><div style="align-self:center;"><span style="font-size:14px;">→</span></div><div><span class="b" style="font-size:11px;">${s.funcao2 || 'BA-2'}</span> <span style="font-size:11px;">${(s.nome2 || '').toUpperCase()}</span></div></div></td></tr>
    `).join('')
    : '';

  const substituicoesAtivasHTML = temSubstituicoesAtivas
    ? `<tr><td style="border-top:1px solid #000; border-bottom:1px solid #000; padding:2px 3px; font-weight:bold; font-size:11px; background:#d4d4d4; text-align:center;" colspan="7">CADEIA DE SUBSTITUIÇÕES (FÉRIAS / TEMPORÁRIAS / CASCATA)</td></tr>
${substituicoesAtivas.map(s => `
    <tr><td colspan="7" style="border-top:none; border-bottom:none; border-left:1px solid #000; border-right:1px solid #000; padding:3px 4px; font-size:11px;"><div style="display:grid; grid-template-columns:2fr 1fr 2fr; text-align:center; align-items:center;"><div><span class="b" style="font-size:11px;">${s.cargoAusente || ''}</span> <span style="font-size:11px;">${(s.nomeAusente || '').toUpperCase()}</span></div><div style="align-self:center;"><span style="font-size:14px;">→</span></div><div><span class="b" style="font-size:11px;">${s.cargoPresente || ''}</span> <span style="font-size:11px;">${(s.nomePresente || '').toUpperCase()}</span></div></div><div style="font-size:10px; color:#555; text-align:center; margin-top:2px;">${motivoSubstituicaoLabel(s.motivo)} · Nível ${s.nivel || 1}</div></td></tr>
  `).join('')}`
    : '';

  const ocorrenciasHTML = ocorrenciasXII.length > 0
    ? linhasLancamento(ocorrenciasXII)
    : '<tr><td style="border:none; padding:10px 4px; font-size:11px;"></td></tr>';

  const solicitacoesHTML = solicitacoes.length > 0
    ? linhasLancamento(solicitacoes)
    : '<tr><td style="border:none; height:16px;"></td></tr>';

  const ocorrenciasNAHTML = ocorrenciasNA
    ? ocorrenciasNA.split('\n').filter(Boolean).map(o => `<tr><td style="border:none; padding:2px 8px; font-size:11px;">${o}</td></tr>`).join('')
    : '<tr><td style="border:none; height:14px;"></td></tr>';

  const inspecoesHTML = inspecoes
    ? linhasLancamento(dividirEmLancamentos(inspecoes))
    : '<tr><td style="border:none; height:14px;"></td></tr>';

  const frotaCombinada = frota.map(f => `${f.combIni || '—'}→${f.combFim || '—'}`).join(', ') || '';

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${nomeDocumentoOperacional(dataInicio, 'LRO', equipeNome, '')}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  @page { size: A4; margin: 15mm 10mm; }
  body { margin: 0; background: #ddd; font-family: Arial, sans-serif; font-size: 7.5px; line-height: 1.2; color: #000; }
  .page { background: #fff; width: 210mm; min-height: 297mm; padding: 4mm 6mm; box-shadow: 0 4px 12px rgba(0,0,0,0.2); margin: 0 auto 10px; }
  @media print {
    @page { size: A4; margin: 15mm 10mm; }
    body { background: #fff; padding: 0; margin: 0; }
    .page { box-shadow: none; margin: 0; padding: 0; width: 100%; min-height: auto; }
    table { page-break-inside: avoid; }
    .sec-title { page-break-after: avoid; }
    .marker-assinatura { display: none !important; }
  }
  table { width: 100%; border-collapse: collapse; page-break-inside: avoid; }
  td, th { border: 1px solid #000; padding: 5px 5px; font-size: 7.5px; text-align: left; vertical-align: top; }
  .b { font-weight: bold; }
  .c { text-align: center; }
  .sec-title td { font-weight: bold; font-size: 11px; background: #d4d4d4; padding: 5px 5px; text-align:center; }
  .mb { margin-top: 2px; margin-bottom: 2px; }
</style>
</head><body>
<div class="page">

  <!-- HEADER -->
  <table style="margin-bottom:3px;">
    <tr>
      <td rowspan="4" style="width:3cm; text-align:center; vertical-align:middle; padding:2px 2px;">
        <img src="${logoUrl}" style="width:100%; height:100%; max-height:2cm; object-fit:contain; display:block; margin:0 auto;" alt="med+ Group" />
      </td>
      <td style="width:70%; padding:2px 2px; text-align:center; vertical-align:middle;">
        <div style="font-size:8px; font-weight:bold;">FORMULÁRIO (FOR)</div>
      </td>
      <td colspan="2" style="text-align:center; padding:2px 2px; font-size:7px; vertical-align:middle;"><span class="b">Código:</span></td>
    </tr>
    <tr>
      <td rowspan="3" style="width:70%; padding:4px 6px; text-align:center; vertical-align:middle;">
        <div style="font-size:12px; font-weight:bold; text-transform:uppercase; padding:1px 0;">LIVRO ATA DE CHEFE DE EQUIPE</div>
      </td>
      <td colspan="2" style="text-align:center; padding:2px 3px; font-size:9px; vertical-align:middle;">MMS.BR.BA.FOR.001</td>
    </tr>
    <tr>
      <td style="width:9%; text-align:center; padding:2px 2px; font-size:7px; vertical-align:middle;"><span class="b">Revisão:</span></td>
      <td style="width:9%; text-align:center; padding:2px 2px; font-size:7px; vertical-align:middle;"><span class="b">Página:</span></td>
    </tr>
    <tr>
      <td style="text-align:center; padding:2px 3px; font-size:9px; vertical-align:middle;">00</td>
      <td style="text-align:center; padding:2px 3px; font-size:9px; vertical-align:middle;"><span class="page-num"></span> de <span class="page-total"></span></td>
    </tr>
  </table>

  <!-- SUBTÍTULOS + IDENTIFICAÇÃO -->
  <table class="mb">
    <tr><td class="b c" style="font-size:10px; padding:5px 5px;" colspan="5">SERVIÇO DE SALVAMENTO E COMBATE A INCÊNDIO - SESCINC</td></tr>
    <tr><td class="b c" style="font-size:10px; padding:5px 5px;" colspan="5">REGISTRO DE OCORRÊNCIA RELATIVO AO SERVIÇO DE CHEFE DE EQUIPE AO SESCINC</td></tr>
    <tr><td class="b" style="font-size:10px; width:25%; background:#d4d4d4; padding:5px 5px;" colspan="5">IDENTIFICAÇÃO DO AEROPORTO:</td></tr>
    <tr><td class="b" style="font-size:10px; padding:5px 5px;" colspan="5">SBNF - AEROPORTO INTERNACIONAL MINISTRO VICTOR KONDER</td></tr>
    <tr><td class="b" style="font-size:10px; width:7%; padding:5px 5px;">PLANTÃO:</td><td class="b" style="font-size:10px; width:5%; background:#d4d4d4; padding:5px 5px;">Data início:</td><td style="font-size:10px; width:10%; padding:5px 5px;">${formatarDataBR(dataInicio)}</td><td class="b" style="font-size:10px; width:5%; background:#d4d4d4; padding:5px 5px;">Data do fim:</td><td style="font-size:10px; width:10%; padding:5px 5px;">${formatarDataBR(dataFim)}</td></tr>
  </table>

  <!-- I. EQUIPE -->
  <table style="margin-bottom:0;">
    <tr class="sec-title"><td colspan="7" style="font-size:11px; background:#fff;">I. EQUIPE DE SERVIÇO ${equipeNome}</td></tr>
    <tr><td class="b" colspan="3" style="font-size:11px; width:22%">1.1. Chefe de Equipe:</td><td style="font-size:11px;" colspan="4">${chefeEquipe}</td></tr>
    <tr><td class="b" colspan="3" style="font-size:11px;">1.2. Comunicação BA-OC:</td><td style="font-size:11px;" colspan="4">${comunic}</td></tr>
    <tr><td class="b" colspan="7" style="font-size:11px; padding:5px 5px;">1.3. Equipagem dos CCI - EM LINHA, CCI - RT e CRS:</td></tr>
    <tr><td class="b" style="font-size:11px; width:1%; white-space:nowrap; border-bottom:none; border-right:none;">CCI 2</td><td colspan="6" style="font-size:11px; border-bottom:none; border-left:none;">${cci2HTML}</td></tr>
    <tr><td class="b" style="font-size:11px; white-space:nowrap; border-top:none; border-bottom:none; border-right:none;">CCI 3</td><td colspan="6" style="font-size:11px; border-top:none; border-bottom:none; border-left:none;">${cci3HTML}</td></tr>
    <tr><td class="b" style="font-size:11px; white-space:nowrap; border-top:none; border-right:none;">CRS</td><td colspan="6" style="font-size:11px; border-top:none; border-left:none;">${crsHTML}</td></tr>
    <tr><td class="b" colspan="7" style="font-size:11px;">1.3. Substituições de BA: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${cb(temSubstituicao)} ABAIXO &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${cb(!temSubstituicao)} NÃO HOUVE</td></tr>
    ${subHTML}
    ${substituicoesAtivasHTML}
    <tr><td style="border-top:1px solid #000; border-bottom:1px solid #000; padding:2px 3px; font-weight:bold; font-size:11px; background:#d4d4d4; text-align:center;" colspan="7">II. INSTRUÇÕES</td></tr>
    ${instrucoesHTML}
    <tr class="sec-title"><td colspan="7">III. SITUAÇÃO OPERACIONAL DA FROTA DO SESCINC:</td></tr>
    ${frotaLinhas}
  </table>

  <!-- IV -->
  <table class="mb" style="border:1px solid #000; border-collapse:separate; border-spacing:0;">
    <tr><td style="border:none; border-bottom:1px solid #000; font-weight:bold; font-size:11px; background:#d4d4d4; text-align:center; padding:2px 3px;">IV. SITUAÇÃO OPERACIONAL DA CENTRAL FAÍSCA, EQUIPAMENTOS DE COMUNICAÇÃO E ALARME:</td></tr>
    <tr><td style="border:none; border-bottom:1px solid #000; padding:2px 8px; font-size:11px;"><span class="b">3.1 CENTRAL FAÍSCA:</span></td></tr>
    <tr><td style="border:none; border-bottom:1px solid #000; padding:2px 8px; font-size:11px;">${e('centralFaisca', 'SEM ALTERAÇÕES')}</td></tr>
    <tr><td style="border:none; border-bottom:1px solid #000; padding:2px 8px; font-size:11px;"><span class="b">3.2 RÁDIOS, HOTLINE, SISTEMA DE ALARME:</span></td></tr>
    <tr><td style="border:none; padding:2px 8px; font-size:11px;">${e('radioComunicacao', 'SEM ALTERAÇÕES')}</td></tr>
  </table>

  ${secaoCheckbox('V. SITUAÇÃO OPERACIONAL DOS TP, EPR EM LINHA E EM ESTOQUE', tpTemAlteracao, tpTexto)}
  ${secaoCheckbox('VI. SITUAÇÃO OPERACIONAL DOS AGENTES EXTINTORES (LGE E PQ) E NITROGÊNIO EM LINHA E ESTOQUE', extTemAlteracao, extTexto)}
  ${secaoCheckbox('VII. SITUAÇÃO OPERACIONAL DOS EQUIPAMENTOS E MATERIAIS DO SESCINC', equipTemAlteracao, equipTexto)}
  ${secaoCheckbox('VIII. SITUAÇÃO OPERACIONAL DAS EDIFICAÇÕES / INSTALAÇÕES DA SCI', edifTemAlteracao, edifTexto)}

  <!-- IX -->
  <table class="mb" style="border:1px solid #000; border-collapse:separate; border-spacing:0;">
    <tr><td style="border:none; border-bottom:1px solid #000; font-weight:bold; font-size:11px; background:#d4d4d4; text-align:center; padding:2px 3px;">IX. OCORRÊNCIAS NÃO AERONÁUTICAS</td></tr>
    ${ocorrenciasNAHTML}
  </table>

  <!-- X -->
  <table class="mb" style="border:1px solid #000; border-collapse:separate; border-spacing:0;">
    <tr><td style="border:none; border-bottom:1px solid #000; font-weight:bold; font-size:11px; background:#d4d4d4; text-align:center; padding:2px 3px;">X. INSPEÇÕES TÉCNICAS E VISTORIAS</td></tr>
    ${inspecoesHTML}
  </table>

  <!-- XI -->
  <table class="mb" style="border:1px solid #000; border-collapse:separate; border-spacing:0;">
    <tr><td colspan="6" style="border:none; border-bottom:1px solid #000; font-weight:bold; font-size:11px; background:#d4d4d4; text-align:center; padding:2px 3px;">XI. EMERGÊNCIAS AERONÁUTICAS</td></tr>
    ${temEmergencia ? `<tr><td style="border:none; padding:2px 8px; font-size:11px;">${temEmergencia}</td></tr>` : '<tr><td style="border:none; height:14px;"></td></tr>'}
  </table>

  <!-- XII -->
  <table class="mb" style="border:1px solid #000; border-collapse:separate; border-spacing:0;">
    <tr><td colspan="6" style="border:none; border-bottom:1px solid #000; font-weight:bold; font-size:11px; background:#d4d4d4; text-align:center; padding:2px 3px;">XII. OUTRAS OCORRÊNCIAS</td></tr>
    ${ocorrenciasHTML}
  </table>

  <!-- XIII -->
  <table class="mb" style="border:1px solid #000; border-collapse:separate; border-spacing:0;">
    <tr><td colspan="6" style="border:none; border-bottom:1px solid #000; font-weight:bold; font-size:11px; background:#d4d4d4; text-align:center; padding:2px 3px;">XIII. SOLICITAÇÕES EFETUADAS A CCR</td></tr>
    ${solicitacoesHTML}
  </table>

  <!-- ASSINATURAS -->
  <table class="mb" style="border:1px solid #000; border-collapse:separate; border-spacing:0;">
    <tr><td colspan="6" style="border:none; border-bottom:1px solid #000; font-weight:bold; font-size:10px; background:#d4d4d4; text-align:center; padding:2px 3px;">LOCAL, DATA E ASSINATURAS</td></tr>
    <tr><td colspan="6" style="border:none; padding:6px 4px; font-size:10px; text-align:right;">${cidade} - ${uf}, ${dataObj.dia} de ${nomeMes(dataObj.mes)} de ${dataObj.ano}</td></tr>
    <tr><td colspan="6" style="border:none; padding:0 4px; font-size:10px; text-align:right;">(cidade) &nbsp;&nbsp;&nbsp; (dia) &nbsp;&nbsp;&nbsp; (mês) &nbsp;&nbsp;&nbsp; (ano)</td></tr>
    <tr><td style="border:none; height:40px;"></td></tr>
    <tr>
      <td style="width:33%; border:none; text-align:center; padding:0 16px;">
        ${showMarkers ? '<div class="marker-assinatura" style="font-size:7px; color:#2196F3; font-weight:bold; margin-bottom:1px;">▼ ASSINATURA DO BA-CE</div>' : ''}
        <div style="border-top:1px solid #000; padding-top:6px; font-size:9px; font-weight:bold;">CHEFE DE EQUIPE:</div>
        <div style="font-size:9px; margin-top:8px; min-height:24px; text-transform:uppercase;">${chefeAss}</div>
      </td>
      <td style="width:33%; border:none; text-align:center; padding:0 16px;">
        ${showMarkers ? '<div class="marker-assinatura" style="font-size:7px; color:#4CAF50; font-weight:bold; margin-bottom:1px;">▼ ASSINATURA DO EMBAIXADOR</div>' : ''}
        <div style="border-top:1px solid #000; padding-top:6px; font-size:9px; font-weight:bold;">GERENTE DO SESCINC SBNF:</div>
        <div style="font-size:9px; margin-top:8px; min-height:24px; text-transform:uppercase;">${gerenteAss}</div>
      </td>
      <td style="width:33%; border:none; text-align:center; padding:0 16px;">
        ${showMarkers ? '<div class="marker-assinatura" style="font-size:7px; color:#FF9800; font-weight:bold; margin-bottom:1px;">▼ ASSINATURA DO COORDENADOR</div>' : ''}
        <div style="border-top:1px solid #000; padding-top:6px; font-size:9px; font-weight:bold;">COORD DE PREV E EMERG:</div>
        <div style="font-size:9px; margin-top:8px; min-height:24px; text-transform:uppercase;">${coordAss}</div>
      </td>
    </tr>
  </table>

</div>
<script>
  document.addEventListener('DOMContentLoaded', function() {
    var pages = document.querySelectorAll('.page');
    pages.forEach(function(page, index) {
      var pageNum = page.querySelector('.page-num');
      var pageTotal = page.querySelector('.page-total');
      if (pageNum) pageNum.textContent = (index + 1);
      if (pageTotal) pageTotal.textContent = pages.length;
    });
  });
  window.onbeforeprint = function() {
    var pages = document.querySelectorAll('.page');
    pages.forEach(function(page, index) {
      var pageNum = page.querySelector('.page-num');
      var pageTotal = page.querySelector('.page-total');
      if (pageNum) pageNum.textContent = (index + 1);
      if (pageTotal) pageTotal.textContent = pages.length;
    });
  };
</script>
</body></html>`;
}

export async function gerarPDF(dados: Record<string, unknown>): Promise<Blob> {
  const A4_W = 794;
  const A4_H = 1123;

  const html = montarHTML(dados).replace(
    '</head>',
    `<base href="${window.location.origin}/">\n</head>`
  );

  const iframe = document.createElement('iframe');
  iframe.style.width = `${A4_W}px`;
  iframe.style.position = 'fixed';
  iframe.style.left = '-9999px';
  iframe.style.top = '0';
  iframe.style.border = 'none';
  iframe.style.background = '#fff';
  document.body.appendChild(iframe);

  const idoc = iframe.contentDocument!;
  idoc.open();
  idoc.write(html);
  idoc.close();

  await new Promise<void>(resolve => {
    let check = () => {
      const body = idoc.body;
      if (body && body.querySelectorAll('img').length > 0) {
        const allLoaded = Array.from(body.querySelectorAll('img')).every(i => i.complete && i.naturalWidth > 0);
        if (allLoaded) { resolve(); return; }
      }
      if (body && body.scrollHeight > 100) { resolve(); return; }
      setTimeout(check, 200);
    };
    setTimeout(check, 300);
    setTimeout(() => resolve(), 5000);
  });

  await new Promise(r => setTimeout(r, 500));

  const idocBody = idoc.body;

  try {
    const totalHeight = idocBody.scrollHeight;
    const pages = Math.ceil(totalHeight / A4_H);
    const doc = new jsPDF({ format: 'a4', unit: 'mm' });

    for (let i = 0; i < pages; i++) {
      idocBody.style.transform = `translateY(-${i * A4_H}px)`;
      idocBody.style.width = `${A4_W}px`;
      idocBody.style.height = `${A4_H}px`;
      idocBody.style.overflow = 'hidden';

      const canvas = await toPng(idocBody, {
        width: A4_W,
        height: A4_H,
        pixelRatio: 2,
      });

      if (i > 0) doc.addPage();
      doc.addImage(canvas, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
      doc.setFontSize(9);
      doc.setTextColor(0);
      doc.text(`${i + 1} de ${pages}`, 192, 36, { align: 'right' });
    }

    return doc.output('blob');
  } finally {
    document.body.removeChild(iframe);
  }
}
