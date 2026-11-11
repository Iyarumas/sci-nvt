import type { DadosInicioPlantao, ViaturaPlantao } from '../types/inicioPlantao';

function dataBR(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : iso;
}

function linha(rotulo: string, valor: string): string {
  return `${rotulo}: ${valor.trim() || '-'}`;
}

/**
 * Campos OK/COM ALTERAÇÃO: na mensagem vai só o que foi digitado na alteração
 * com o ❌ no final (ex.: "rádio com chiado ❌"). Sem texto, fica só ❌.
 */
function status(valor: string): string {
  const v = valor.trim();
  if (!v.startsWith('COM ALTERAÇÃO')) return v || '-';
  const texto = v.slice('COM ALTERAÇÃO'.length).replace(/^\s*-\s*/, '').trim();
  return texto ? `${texto} ❌` : '❌';
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
  linhas.push(`EPR's : ${status(v.epr)}`);
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
    linha('TWR', status(d.twr)),
    linha('Ramal', d.ramaisTwr),
    '',
    `Testes de rádio e hotline : ${status(d.testesRadioHotline)}`,
    '',
    linha('APOC', d.apoc),
    '',
    linha('SPO', d.spo),
    '',
    linha('Supervisão', d.supervisao),
    '',
    linha('PCM', d.pcm || ''),
    '',
    linha('Fiscal', d.fiscal),
    '',
    linha('Cabeceira', d.cabeceira),
    '',
    `Testes de hotline e rádio operacional : ${status(d.testesOperacional)}`,
    '',
    'SME🚑',
    `Ramal : ${d.smeRamal.trim() || '-'}`,
    '',
    `Motorista : ${d.smeMotorista.trim() || '-'}`,
    `Tec de enfermagem : ${d.smeTecEnfermagem.trim() || '-'}`,
    '',
    `Testes de ramal e rádio : ${status(d.smeTestes)}`,
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
    `Interno - ${status(d.caixaInterna)}`,
    `Externo - ${status(d.caixaExterna)}`,
    '',
    `⏱️ Hidrômetro do Reúso : ${d.hidrometro.trim() ? `${d.hidrometro.trim()}m³` : '-'}${d.hidrometroSituacao.trim() ? ` (${d.hidrometroSituacao.trim()})` : ''}`,
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
