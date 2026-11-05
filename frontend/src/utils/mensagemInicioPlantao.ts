import type { DadosInicioPlantao, ViaturaPlantao } from '../types/inicioPlantao';

function dataBR(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : iso;
}

function linha(rotulo: string, valor: string): string {
  return `${rotulo}: ${valor.trim() || '-'}`;
}

function blocoViatura(v: ViaturaPlantao): string[] {
  const titulo = v.chave === 'crs' ? '⛑️ CRS' : `🚒 ${v.posicao}${v.numero ? ` - ${v.numero}` : ''}`;
  const linhas = [titulo, ''];
  const equipagem = v.equipagem.filter(t => t.nome.trim());
  if (equipagem.length) {
    linhas.push(...equipagem.map(t => `${t.funcao} : ${t.nome.trim()}`), '');
  }
  linhas.push(`${v.combustivel.trim() || '-'}%⛽`);
  linhas.push(`Km : ${v.km.trim() || '-'}`);
  if (v.chave === 'crs') linhas.push(`TAC : ${v.tac.trim() || '-'}`);
  else linhas.push(`N2 : ${v.n2.trim() || '-'}`);
  linhas.push(`EPR's : ${v.epr.trim() || '-'}`);
  return linhas;
}

function lista(itens: string[], vazio: string): string {
  const preenchidos = itens.map(item => item.trim()).filter(Boolean);
  return preenchidos.length ? preenchidos.join(', ') : vazio;
}

/** Mensagem do início de plantão no modelo que os comunicantes já mandam no WhatsApp. */
export function montarMensagemInicioPlantao(data: string, equipe: string, d: DadosInicioPlantao): string {
  const partes: string[] = [
    d.aeroporto.trim() || 'Aeroporto de Navegantes',
    `${dataBR(data)}🛬`,
    '',
    `Equipe ${equipe.toLocaleUpperCase('pt-BR')}`,
    '',
    `Efetivo: ${d.efetivo.trim() || '-'} bombeiros`,
    linha('TWR', d.twr),
    linha('Ramal', d.ramaisTwr),
    '',
    `Testes de rádio e hotline : ${d.testesRadioHotline.trim() || '-'}`,
    '',
    linha('APOC', d.apoc),
    '',
    linha('SPO', d.spo),
    '',
    linha('Supervisão/PCM', d.supervisao),
    '',
    linha('Fiscal', d.fiscal),
    '',
    linha('Cabeceira', d.cabeceira),
    '',
    `Testes de hotline e rádio operacional : ${d.testesOperacional.trim() || '-'}`,
    '',
    'SME🚑',
    `Ramal : ${d.smeRamal.trim() || '-'}`,
    '',
    `Motorista : ${d.smeMotorista.trim() || '-'}`,
    `Tec de enfermagem : ${d.smeTecEnfermagem.trim() || '-'}`,
    '',
    `Testes de ramal e rádio : ${d.smeTestes.trim() || '-'}`,
    '',
    'SCI⛑️',
    `Ramal : ${d.sciRamal.trim() || '-'}`,
  ];

  for (const viatura of d.viaturas) {
    partes.push('', ...blocoViatura(viatura));
  }

  partes.push(
    '',
    '🪣Caixas d’água :',
    '',
    `Interno - ${d.caixaInterna.trim() || '-'}`,
    `Externo - ${d.caixaExterna.trim() || '-'}`,
    '',
    `⏱️ Hidrômetro do Reúso : ${d.hidrometro.trim() ? `${d.hidrometro.trim()}m3` : '-'}${d.hidrometroSituacao.trim() ? ` (${d.hidrometroSituacao.trim()})` : ''}`,
    '',
    `👥 FÉRIAS: ${lista(d.ferias, 'Não houve')}`,
    '',
    `TROCAS: ${lista(d.trocas, 'Não houve')}`,
    '',
    `EXTRAS: ${lista(d.extras, 'Não houve')}.`,
  );

  const assuntos = d.ptrba.map(a => a.trim()).filter(Boolean);
  if (assuntos.length) {
    partes.push('', '📗PTR-BA', '', ...assuntos.flatMap((assunto, i) => (i ? ['', `* ${assunto}`] : [`* ${assunto}`])));
  }

  return partes.join('\n').replace(/EXTRAS: (.*)\.\.$/m, 'EXTRAS: $1.');
}

/** Link do WhatsApp com a mensagem pronta; a pessoa escolhe o grupo ao abrir. */
export function linkWhatsAppMensagem(mensagem: string): string {
  return `https://wa.me/?text=${encodeURIComponent(mensagem)}`;
}
