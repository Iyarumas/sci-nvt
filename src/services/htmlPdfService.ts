import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

export function extrairVariaveis(html: string): string[] {
  const matches = html.match(/\{\{\s*(\w+)\s*\}\}/g);
  if (!matches) return [];
  return [...new Set(matches.map(m => m.replace(/\{\{\s*|\s*\}\}/g, '')))];
}

export function substituirVariaveis(html: string, dados: Record<string, string>): string {
  let result = html;
  for (const [key, value] of Object.entries(dados)) {
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi');
    result = result.replace(regex, value || '');
  }
  result = result.replace(/\{\{\s*\w+\s*\}\}/g, '');
  return result;
}

export interface GerarPdfHtmlParams {
  htmlTemplate: string;
  dados: Record<string, string>;
  pageWidth?: number;
  pageHeight?: number;
  margin?: number;
  logoUrl?: string;
}

export async function gerarPdfHtml({
  htmlTemplate,
  dados,
  pageWidth = 210,
  pageHeight = 297,
  margin = 20,
  logoUrl,
}: GerarPdfHtmlParams): Promise<Blob> {
  const html = substituirVariaveis(htmlTemplate, dados);
  const pdf = new jsPDF('p', 'mm', [pageWidth, pageHeight]);

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = `${pageWidth - margin * 2}mm`;
  container.style.background = '#ffffff';
  container.style.fontFamily = 'Arial, sans-serif';
  container.style.fontSize = '12px';
  container.style.lineHeight = '1.5';
  container.style.padding = '0';
  container.innerHTML = html;
  document.body.appendChild(container);

  const contentHeight = container.scrollHeight;
  const pageHeightPx = (pageHeight - margin * 2) * 3.78;
  const totalPages = Math.ceil(contentHeight / pageHeightPx);

  try {
    for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
      if (pageIndex > 0) pdf.addPage();

      const clipDiv = document.createElement('div');
      clipDiv.style.width = container.style.width;
      clipDiv.style.overflow = 'hidden';
      clipDiv.style.height = `${pageHeightPx}px`;
      clipDiv.style.background = '#ffffff';
      clipDiv.innerHTML = container.innerHTML;

      if (logoUrl) {
        const logoImg = document.createElement('img');
        logoImg.src = logoUrl;
        logoImg.style.width = '60mm';
        logoImg.style.margin = '10mm 0';
        logoImg.style.display = 'block';
        clipDiv.prepend(logoImg);
      }

      const pageBg = document.createElement('div');
      pageBg.style.position = 'absolute';
      pageBg.style.top = '0';
      pageBg.style.left = '0';
      pageBg.style.right = '0';
      pageBg.style.bottom = '0';
      pageBg.style.background = 'linear-gradient(180deg, #f8f9fa 0%, #ffffff 100%)';
      pageBg.style.zIndex = '-1';
      clipDiv.prepend(pageBg);

      document.body.appendChild(clipDiv);

      try {
        const dataUrl = await toPng(clipDiv, {
          quality: 1,
          pixelRatio: 2,
          canvasWidth: (pageWidth - margin * 2) * 3.78,
        });
        pdf.addImage(dataUrl, 'PNG', margin, margin, pageWidth - margin * 2, 0);
      } finally {
        document.body.removeChild(clipDiv);
      }
    }
  } finally {
    document.body.removeChild(container);
  }

  return pdf.output('blob');
}

export const TEMPLATE_DDS = `
<div style="padding: 20px; font-family: Arial, sans-serif;">
  <div style="text-align: center; margin-bottom: 20px; border-bottom: 3px solid #1a56db; padding-bottom: 15px;">
    <h1 style="color: #1a56db; margin: 0; font-size: 22px;">DIÁLOGO DIÁRIO DE SEGURANÇA</h1>
    <p style="color: #666; margin: 5px 0 0; font-size: 11px;">DDS - NBR 14280</p>
  </div>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
    <tr>
      <td style="padding: 4px; width: 25%; font-weight: bold; font-size: 11px;">Data:</td>
      <td style="padding: 4px; width: 25%; font-size: 11px; border-bottom: 1px solid #999;">{{data}}</td>
      <td style="padding: 4px; width: 25%; font-weight: bold; font-size: 11px;">Horário:</td>
      <td style="padding: 4px; width: 25%; font-size: 11px; border-bottom: 1px solid #999;">{{horario}}</td>
    </tr>
    <tr>
      <td style="padding: 4px; font-weight: bold; font-size: 11px;">Facilitador:</td>
      <td style="padding: 4px; font-size: 11px; border-bottom: 1px solid #999;" colspan="3">{{facilitador}}</td>
    </tr>
    <tr>
      <td style="padding: 4px; font-weight: bold; font-size: 11px;">Tema:</td>
      <td style="padding: 4px; font-size: 11px; border-bottom: 1px solid #999;" colspan="3">{{tema}}</td>
    </tr>
  </table>

  <div style="margin-bottom: 15px;">
    <h3 style="color: #1a56db; font-size: 13px; margin: 0 0 8px;">Conteúdo:</h3>
    <div style="border: 1px solid #ccc; border-radius: 4px; padding: 10px; min-height: 100px; font-size: 12px; line-height: 1.6; white-space: pre-wrap;">
      {{conteudo}}
    </div>
  </div>

  <div style="margin-bottom: 15px;">
    <h3 style="color: #1a56db; font-size: 13px; margin: 0 0 8px;">Participantes:</h3>
    <div style="border: 1px solid #ccc; border-radius: 4px; padding: 10px; font-size: 12px; white-space: pre-wrap;">
      {{participantes}}
    </div>
  </div>

  <div style="margin-top: 20px; display: flex; justify-content: space-between;">
    <div style="text-align: center; width: 45%;">
      <p style="margin: 0; font-size: 11px;">_________________________________</p>
      <p style="margin: 2px 0 0; font-size: 10px; color: #666;">Facilitador</p>
    </div>
    <div style="text-align: center; width: 45%;">
      <p style="margin: 0; font-size: 11px;">_________________________________</p>
      <p style="margin: 2px 0 0; font-size: 10px; color: #666;">Responsável</p>
    </div>
  </div>
</div>`;

export const TEMPLATE_LRO = `
<div style="padding: 15px 20px; font-family: Arial, sans-serif; font-size: 10px; line-height: 1.4; color: #222;">
  <div style="text-align: center; margin-bottom: 12px; border-bottom: 2px solid #1a56db; padding-bottom: 8px;">
    <h1 style="color: #1a56db; margin: 0; font-size: 16px;">LISTA DE RONDA OPERACIONAL</h1>
    <p style="color: #666; margin: 2px 0 0; font-size: 9px;">LRO - SCI NVT</p>
  </div>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
    <tr>
      <td style="padding: 2px 4px; width: 12%; font-weight: bold; font-size: 9px;">Equipe:</td>
      <td style="padding: 2px 4px; width: 15%; border-bottom: 1px solid #999;">{{equipe}}</td>
      <td style="padding: 2px 4px; width: 10%; font-weight: bold; font-size: 9px;">Turno:</td>
      <td style="padding: 2px 4px; width: 13%; border-bottom: 1px solid #999;">{{turno}}</td>
      <td style="padding: 2px 4px; width: 12%; font-weight: bold; font-size: 9px;">Data Entrada:</td>
      <td style="padding: 2px 4px; width: 15%; border-bottom: 1px solid #999;">{{dataEntrada}}</td>
      <td style="padding: 2px 4px; width: 10%; font-weight: bold; font-size: 9px;">Data Saída:</td>
      <td style="padding: 2px 4px; width: 13%; border-bottom: 1px solid #999;">{{dataSaida}}</td>
    </tr>
    <tr>
      <td style="padding: 2px 4px; font-weight: bold; font-size: 9px;">Chefe Equipe:</td>
      <td style="padding: 2px 4px; border-bottom: 1px solid #999;" colspan="3">{{chefeEquipe}}</td>
      <td style="padding: 2px 4px; font-weight: bold; font-size: 9px;">APOC:</td>
      <td style="padding: 2px 4px; border-bottom: 1px solid #999;" colspan="3">{{apoc}}</td>
    </tr>
  </table>

  <h3 style="color: #1a56db; font-size: 11px; margin: 8px 0 4px;">Escala</h3>
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 6px; font-size: 9px;">
    <tr style="background: #1a56db; color: #fff;">
      <th style="padding: 3px 4px; text-align: left; width: 20%;">Função</th>
      <th style="padding: 3px 4px; text-align: left; width: 30%;">CCI 02</th>
      <th style="padding: 3px 4px; text-align: left; width: 30%;">CCI 03</th>
      <th style="padding: 3px 4px; text-align: left; width: 20%;">CRS</th>
    </tr>
    {{escala_linhas}}
  </table>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 9px;">
    <tr>
      <td style="padding: 2px 4px; width: 15%; font-weight: bold;">Apoio/Outros:</td>
      <td style="padding: 2px 4px; border-bottom: 1px solid #999;" colspan="3">{{apoioOutros}}</td>
    </tr>
  </table>

  <h3 style="color: #1a56db; font-size: 11px; margin: 8px 0 4px;">Instruções do Dia</h3>
  <div style="border: 1px solid #ccc; border-radius: 3px; padding: 6px 8px; min-height: 30px; margin-bottom: 8px; font-size: 10px; white-space: pre-wrap;">
    {{instrucoes}}
  </div>

  <h3 style="color: #1a56db; font-size: 11px; margin: 8px 0 4px;">Veículos</h3>
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 6px; font-size: 8px;">
    <tr style="background: #1a56db; color: #fff;">
      <th style="padding: 2px 3px; text-align: left;">Item</th>
      <th style="padding: 2px 3px; text-align: center;">Faisca 2</th>
      <th style="padding: 2px 3px; text-align: center;">Faisca 3</th>
      <th style="padding: 2px 3px; text-align: center;">Faisca RT</th>
      <th style="padding: 2px 3px; text-align: center;">CRS</th>
    </tr>
    <tr><td style="padding: 2px 3px; font-weight: bold;">CCI 319</td><td style="padding: 2px 3px; text-align: center;">{{f2_cci319}}</td><td style="padding: 2px 3px; text-align: center;">{{f3_cci319}}</td><td style="padding: 2px 3px; text-align: center;">{{frt_cci319}}</td><td style="padding: 2px 3px; text-align: center;">-</td></tr>
    <tr><td style="padding: 2px 3px; font-weight: bold;">CCI 320</td><td style="padding: 2px 3px; text-align: center;">{{f2_cci320}}</td><td style="padding: 2px 3px; text-align: center;">{{f3_cci320}}</td><td style="padding: 2px 3px; text-align: center;">{{frt_cci320}}</td><td style="padding: 2px 3px; text-align: center;">-</td></tr>
    <tr><td style="padding: 2px 3px; font-weight: bold;">CCI 333</td><td style="padding: 2px 3px; text-align: center;">{{f2_cci333}}</td><td style="padding: 2px 3px; text-align: center;">{{f3_cci333}}</td><td style="padding: 2px 3px; text-align: center;">{{frt_cci333}}</td><td style="padding: 2px 3px; text-align: center;">-</td></tr>
    <tr><td style="padding: 2px 3px; font-weight: bold;">KM Inicial</td><td style="padding: 2px 3px; text-align: center;">{{f2_kmInicial}}</td><td style="padding: 2px 3px; text-align: center;">{{f3_kmInicial}}</td><td style="padding: 2px 3px; text-align: center;">{{frt_kmInicial}}</td><td style="padding: 2px 3px; text-align: center;">{{crs_kmOdoInicial}}</td></tr>
    <tr><td style="padding: 2px 3px; font-weight: bold;">KM Final</td><td style="padding: 2px 3px; text-align: center;">{{f2_kmFinal}}</td><td style="padding: 2px 3px; text-align: center;">{{f3_kmFinal}}</td><td style="padding: 2px 3px; text-align: center;">{{frt_kmFinal}}</td><td style="padding: 2px 3px; text-align: center;">{{crs_kmOdoFinal}}</td></tr>
    <tr><td style="padding: 2px 3px; font-weight: bold;">Comb. Inicial</td><td style="padding: 2px 3px; text-align: center;">{{f2_combInicial}}</td><td style="padding: 2px 3px; text-align: center;">{{f3_combInicial}}</td><td style="padding: 2px 3px; text-align: center;">{{frt_combInicial}}</td><td style="padding: 2px 3px; text-align: center;">{{crs_combInicial}}</td></tr>
    <tr><td style="padding: 2px 3px; font-weight: bold;">Comb. Final</td><td style="padding: 2px 3px; text-align: center;">{{f2_combFinal}}</td><td style="padding: 2px 3px; text-align: center;">{{f3_combFinal}}</td><td style="padding: 2px 3px; text-align: center;">{{frt_combFinal}}</td><td style="padding: 2px 3px; text-align: center;">{{crs_combFinal}}</td></tr>
    <tr><td style="padding: 2px 3px; font-weight: bold;">Nitrogênio</td><td style="padding: 2px 3px; text-align: center;">{{f2_nitrogenio}}</td><td style="padding: 2px 3px; text-align: center;">{{f3_nitrogenio}}</td><td style="padding: 2px 3px; text-align: center;">{{frt_nitrogenio}}</td><td style="padding: 2px 3px; text-align: center;">-</td></tr>
    <tr><td style="padding: 2px 3px; font-weight: bold;">Situação</td><td style="padding: 2px 3px; text-align: center;">-</td><td style="padding: 2px 3px; text-align: center;">-</td><td style="padding: 2px 3px; text-align: center;">-</td><td style="padding: 2px 3px; text-align: center;">{{crs_situacao}}</td></tr>
    <tr><td style="padding: 2px 3px; font-weight: bold;">Tacógrafo Inicial</td><td style="padding: 2px 3px; text-align: center;">-</td><td style="padding: 2px 3px; text-align: center;">-</td><td style="padding: 2px 3px; text-align: center;">-</td><td style="padding: 2px 3px; text-align: center;">{{crs_kmTacInicial}}</td></tr>
    <tr><td style="padding: 2px 3px; font-weight: bold;">Tacógrafo Final</td><td style="padding: 2px 3px; text-align: center;">-</td><td style="padding: 2px 3px; text-align: center;">-</td><td style="padding: 2px 3px; text-align: center;">-</td><td style="padding: 2px 3px; text-align: center;">{{crs_kmTacFinal}}</td></tr>
    <tr><td style="padding: 2px 3px; font-weight: bold;">EPR</td><td style="padding: 2px 3px; text-align: center;">{{f2_epr}}</td><td style="padding: 2px 3px; text-align: center;">{{f3_epr}}</td><td style="padding: 2px 3px; text-align: center;">{{frt_epr}}</td><td style="padding: 2px 3px; text-align: center;">{{crs_epr}}</td></tr>
  </table>

  <h3 style="color: #1a56db; font-size: 11px; margin: 8px 0 4px;">Situações Operacionais</h3>
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 6px; font-size: 9px;">
    <tr><td style="padding: 2px 4px; width: 30%; font-weight: bold;">Central Faísca:</td><td style="padding: 2px 4px; border-bottom: 1px solid #eee;">{{situacaoCentralFaisca}}</td></tr>
    <tr><td style="padding: 2px 4px; font-weight: bold;">Comunicação:</td><td style="padding: 2px 4px; border-bottom: 1px solid #eee;">{{situacaoComunicacao}}</td></tr>
    <tr><td style="padding: 2px 4px; font-weight: bold;">TP/EPR:</td><td style="padding: 2px 4px; border-bottom: 1px solid #eee;">{{situacaoTPEPR}}</td></tr>
    <tr><td style="padding: 2px 4px; font-weight: bold;">Agentes Extintores:</td><td style="padding: 2px 4px; border-bottom: 1px solid #eee;">{{situacaoAgentesExtintores}}</td></tr>
    <tr><td style="padding: 2px 4px; font-weight: bold;">Equipamentos:</td><td style="padding: 2px 4px; border-bottom: 1px solid #eee;">{{situacaoEquipamentos}}</td></tr>
    <tr><td style="padding: 2px 4px; font-weight: bold;">Edificações:</td><td style="padding: 2px 4px; border-bottom: 1px solid #eee;">{{situacaoEdificacoes}}</td></tr>
  </table>

  <h3 style="color: #1a56db; font-size: 11px; margin: 8px 0 4px;">Narrativas</h3>
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 6px; font-size: 9px;">
    <tr><td style="padding: 2px 4px; width: 25%; font-weight: bold;">Inspeções Técnicas:</td><td style="padding: 2px 4px; white-space: pre-wrap;">{{inspecoesTecnicas}}</td></tr>
    <tr><td style="padding: 2px 4px; font-weight: bold;">Emerg. Aeronáuticas:</td><td style="padding: 2px 4px; white-space: pre-wrap;">{{emergenciasAeronauticas}}</td></tr>
    <tr><td style="padding: 2px 4px; font-weight: bold;">Outras Ocorrências:</td><td style="padding: 2px 4px; white-space: pre-wrap;">{{outrasOcorrencias}}</td></tr>
  </table>

  <div style="margin-top: 15px; display: flex; justify-content: space-between;">
    <div style="text-align: center; width: 45%;">
      <p style="margin: 0; font-size: 9px;">_________________________________</p>
      <p style="margin: 2px 0 0; font-size: 8px; color: #666;">Chefe de Equipe</p>
    </div>
    <div style="text-align: center; width: 45%;">
      <p style="margin: 0; font-size: 9px;">_________________________________</p>
      <p style="margin: 2px 0 0; font-size: 8px; color: #666;">APOC</p>
    </div>
  </div>
</div>`;

export const TEMPLATE_TROCA_EXEMPLO = `
<div style="padding: 20px; font-family: Arial, sans-serif;">
  <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #dc2626; padding-bottom: 10px;">
    <img src="{{logo}}" style="height: 50px; margin-bottom: 10px;" alt="Logo" />
    <h1 style="color: #dc2626; margin: 0; font-size: 20px;">FORMULÁRIO DE TROCA DE SERVIÇO</h1>
  </div>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
    <tr>
      <td style="padding: 4px; width: 20%; font-weight: bold; font-size: 11px;">Solicitante:</td>
      <td style="padding: 4px; width: 55%; border-bottom: 1px solid #999; font-size: 11px;">{{solicitante}}</td>
      <td style="padding: 4px; width: 10%; font-weight: bold; font-size: 11px;">Data:</td>
      <td style="padding: 4px; width: 15%; border-bottom: 1px solid #999; font-size: 11px;">{{data}}</td>
    </tr>
    <tr>
      <td style="padding: 4px; font-weight: bold; font-size: 11px;">Solicitado:</td>
      <td style="padding: 4px; border-bottom: 1px solid #999; font-size: 11px;" colspan="3">{{solicitado}}</td>
    </tr>
    <tr>
      <td style="padding: 4px; font-weight: bold; font-size: 11px;">Data Solicitada:</td>
      <td style="padding: 4px; border-bottom: 1px solid #999; font-size: 11px;" colspan="3">{{data_solicitada}}</td>
    </tr>
  </table>

  <div style="margin-bottom: 15px;">
    <h3 style="color: #dc2626; font-size: 13px; margin: 0 0 8px;">Motivo da Troca:</h3>
    <div style="border: 1px solid #ccc; border-radius: 4px; padding: 10px; min-height: 60px; font-size: 12px; line-height: 1.6; white-space: pre-wrap;">
      {{motivo}}
    </div>
  </div>

  <div style="margin-bottom: 15px;">
    <h3 style="color: #dc2626; font-size: 13px; margin: 0 0 8px;">Observações:</h3>
    <div style="border: 1px solid #ccc; border-radius: 4px; padding: 10px; min-height: 80px; font-size: 12px; line-height: 1.6; white-space: pre-wrap;">
      {{observacoes}}
    </div>
  </div>

  <div style="margin-top: 25px; display: flex; justify-content: space-between;">
    <div style="text-align: center; width: 30%;">
      <p style="margin: 0; font-size: 11px;">_________________________________</p>
      <p style="margin: 2px 0 0; font-size: 10px; color: #666;">Solicitante</p>
    </div>
    <div style="text-align: center; width: 30%;">
      <p style="margin: 0; font-size: 11px;">_________________________________</p>
      <p style="margin: 2px 0 0; font-size: 10px; color: #666;">Solicitado</p>
    </div>
    <div style="text-align: center; width: 30%;">
      <p style="margin: 0; font-size: 11px;">_________________________________</p>
      <p style="margin: 2px 0 0; font-size: 10px; color: #666;">Gerente</p>
    </div>
  </div>
</div>`;
