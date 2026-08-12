import type { Equipe } from '../types/bombeiro';
import { listarAtivos } from './bombeiroService';
import { listarEPIs } from './epiService';
import { listarCertificacoes } from './certificacaoService';
import { listarCertificacoesCursos } from './certificacaoCursoService';
import { listarSubstituicoesTemporarias } from './substituicaoTemporariaService';

export interface Notificacao {
  id: string;
  titulo: string;
  descricao: string;
  tipo: 'info' | 'alerta' | 'sucesso' | 'erro';
  lida: boolean;
  equipe: Equipe;
  origem: 'ferias' | 'epi' | 'certificacao' | 'substituicao' | 'certificacao_curso' | 'credencial';
  createdAt: string;
}

const STORAGE_KEY = 'sescinc-notificacoes';

function getStored(): Notificacao[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveStored(list: Notificacao[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function diasRestantes(dataValidade: string): number {
  const agora = new Date();
  agora.setHours(0, 0, 0, 0);
  const validade = new Date(dataValidade + 'T00:00:00');
  return Math.ceil((validade.getTime() - agora.getTime()) / (1000 * 60 * 60 * 24));
}

async function calcularAlertasFerias(bombeiros: import('../types/bombeiro').Bombeiro[]): Promise<Omit<Notificacao, 'id' | 'lida' | 'createdAt'>[]> {
  const alertas: Omit<Notificacao, 'id' | 'lida' | 'createdAt'>[] = [];

  for (const b of bombeiros) {
    if (!b.dataAdmissao || !b.equipe) continue;
    const admissao = new Date(b.dataAdmissao);
    const vencimento = new Date(admissao);
    vencimento.setFullYear(vencimento.getFullYear() + 2);
    const dias = diasRestantes(vencimento.toISOString().slice(0, 10));

    if (dias <= 90 && dias > 0) {
      let tipo: Notificacao['tipo'] = 'info';
      if (dias <= 30) tipo = 'erro';
      else if (dias <= 60) tipo = 'alerta';

      alertas.push({
        titulo: 'Férias a vencer',
        descricao: `${b.nomeCompleto} — férias vencem em ${dias} dias (${new Date(vencimento).toLocaleDateString('pt-BR')})`,
        tipo,
        equipe: b.equipe,
        origem: 'ferias',
      });
    }
  }
  return alertas;
}

async function calcularAlertasEPI(bombeiros: import('../types/bombeiro').Bombeiro[]): Promise<Omit<Notificacao, 'id' | 'lida' | 'createdAt'>[]> {
  const alertas: Omit<Notificacao, 'id' | 'lida' | 'createdAt'>[] = [];
  const epis = await listarEPIs();

  for (const epi of epis) {
    if (!epi.dataValidade) continue;
    const dias = diasRestantes(epi.dataValidade);
    if (dias <= 30 && dias > 0) {
      const b = bombeiros.find(x => x.nomeCompleto === epi.colaborador);
      const equipe = b?.equipe || 'Embaixador';

      let tipo: Notificacao['tipo'] = 'info';
      if (dias <= 7) tipo = 'erro';
      else if (dias <= 15) tipo = 'alerta';

      alertas.push({
        titulo: 'EPI com CA vencendo',
        descricao: `${epi.nome} (CA: ${epi.ca}) de ${epi.colaborador} — vence em ${dias} dias`,
        tipo,
        equipe,
        origem: 'epi',
      });
    }
  }
  return alertas;
}

async function calcularAlertasCertificacao(bombeiros: import('../types/bombeiro').Bombeiro[]): Promise<Omit<Notificacao, 'id' | 'lida' | 'createdAt'>[]> {
  const alertas: Omit<Notificacao, 'id' | 'lida' | 'createdAt'>[] = [];
  const certificacoes = await listarCertificacoes();

  for (const cert of certificacoes) {
    if (!cert.dataValidade) continue;
    const dias = diasRestantes(cert.dataValidade);
    if (dias <= 90 && dias > 0) {
      const b = bombeiros.find(x => x.id === cert.funcionarioId);
      const equipe = b?.equipe || 'Embaixador';

      let tipo: Notificacao['tipo'] = 'info';
      if (dias <= 30) tipo = 'erro';
      else if (dias <= 60) tipo = 'alerta';

      alertas.push({
        titulo: 'Certificação NR a vencer',
        descricao: `${cert.funcionarioNome} — ${cert.nrNumero} vence em ${dias} dias (${new Date(cert.dataValidade + 'T00:00:00').toLocaleDateString('pt-BR')})`,
        tipo,
        equipe,
        origem: 'certificacao',
      });
    }
  }
  return alertas;
}

async function calcularAlertasSubstituicao(bombeiros: import('../types/bombeiro').Bombeiro[]): Promise<Omit<Notificacao, 'id' | 'lida' | 'createdAt'>[]> {
  const alertas: Omit<Notificacao, 'id' | 'lida' | 'createdAt'>[] = [];
  const subs = await listarSubstituicoesTemporarias();
  const pendentes = subs.filter(s => s.status === 'Pendente');

  const bombeirosMap = new Map(bombeiros.map(b => [b.id, b]));
  for (const sub of pendentes) {
    const equipe = bombeirosMap.get(sub.substitutoId)?.equipe || 'Embaixador';
    alertas.push({
      titulo: 'Substituição Pendente',
      descricao: `${sub.funcionarioNome} → ${sub.substitutoNome} (${sub.tipo}) — ${sub.dias} dias`,
      tipo: 'alerta',
      equipe,
      origem: 'substituicao',
    });
  }
  return alertas;
}

async function calcularAlertasCertificacaoCurso(bombeiros: import('../types/bombeiro').Bombeiro[]): Promise<Omit<Notificacao, 'id' | 'lida' | 'createdAt'>[]> {
  const alertas: Omit<Notificacao, 'id' | 'lida' | 'createdAt'>[] = [];
  const certificacoes = await listarCertificacoesCursos();

  for (const cert of certificacoes) {
    if (cert.semValidade || !cert.dataValidade) continue;
    const dias = diasRestantes(cert.dataValidade);
    if (dias <= 180 && dias > 0) {
      const b = bombeiros.find(x => x.id === cert.funcionarioId);
      const equipe = b?.equipe || 'Embaixador';

      let tipo: Notificacao['tipo'] = 'info';
      if (dias <= 30) tipo = 'erro';
      else if (dias <= 90) tipo = 'alerta';

      alertas.push({
        titulo: 'Certificado de Curso a vencer',
        descricao: `${cert.funcionarioNome} — ${cert.cursoNome} vence em ${dias} dias (${new Date(cert.dataValidade + 'T00:00:00').toLocaleDateString('pt-BR')})`,
        tipo,
        equipe,
        origem: 'certificacao_curso',
      });
    }
  }
  return alertas;
}

async function calcularAlertasCNH(bombeiros: import('../types/bombeiro').Bombeiro[]): Promise<Omit<Notificacao, 'id' | 'lida' | 'createdAt'>[]> {
  const alertas: Omit<Notificacao, 'id' | 'lida' | 'createdAt'>[] = [];
  for (const b of bombeiros) {
    if (!b.cnhValidade || !b.equipe) continue;
    const dias = diasRestantes(b.cnhValidade);
    if (dias <= 0) {
      alertas.push({
        titulo: 'CNH Vencida',
        descricao: `${b.nomeCompleto} — CNH venceu em ${new Date(b.cnhValidade + 'T00:00:00').toLocaleDateString('pt-BR')}. Não pode exercer BA-MC.`,
        tipo: 'erro',
        equipe: b.equipe,
        origem: 'certificacao',
      });
    } else if (dias <= 240) {
      let tipo: Notificacao['tipo'] = 'info';
      if (dias <= 60) tipo = 'erro';
      else if (dias <= 120) tipo = 'alerta';
      alertas.push({
        titulo: 'CNH próxima do vencimento',
        descricao: `${b.nomeCompleto} — CNH vence em ${dias} dias (${new Date(b.cnhValidade + 'T00:00:00').toLocaleDateString('pt-BR')})`,
        tipo,
        equipe: b.equipe,
        origem: 'certificacao',
      });
    }
  }
  return alertas;
}

async function calcularAlertasCVE(bombeiros: import('../types/bombeiro').Bombeiro[]): Promise<Omit<Notificacao, 'id' | 'lida' | 'createdAt'>[]> {
  const alertas: Omit<Notificacao, 'id' | 'lida' | 'createdAt'>[] = [];
  for (const b of bombeiros) {
    if (!b.cveValidade || !b.equipe) continue;
    const dias = diasRestantes(b.cveValidade);
    if (dias <= 0) {
      alertas.push({
        titulo: 'CVE Vencido',
        descricao: `${b.nomeCompleto} — CVE venceu em ${new Date(b.cveValidade + 'T00:00:00').toLocaleDateString('pt-BR')}. Não pode exercer BA-MC.`,
        tipo: 'erro',
        equipe: b.equipe,
        origem: 'certificacao_curso',
      });
    } else if (dias <= 365) {
      let tipo: Notificacao['tipo'] = 'info';
      if (dias <= 90) tipo = 'erro';
      else if (dias <= 180) tipo = 'alerta';
      alertas.push({
        titulo: 'CVE próximo do vencimento',
        descricao: `${b.nomeCompleto} — CVE vence em ${dias} dias (${new Date(b.cveValidade + 'T00:00:00').toLocaleDateString('pt-BR')})`,
        tipo,
        equipe: b.equipe,
        origem: 'certificacao_curso',
      });
    }
  }
  return alertas;
}

export async function gerarNotificacoes(): Promise<Notificacao[]> {
  const existentes = getStored();
  const existentesMap = new Map(existentes.map(n => [`${n.origem}-${n.descricao}`, n]));

  const bombeiros = await listarAtivos();

  const novosAlertas = [
    ...(await calcularAlertasFerias(bombeiros)),
    ...(await calcularAlertasEPI(bombeiros)),
    ...(await calcularAlertasCertificacao(bombeiros)),
    ...(await calcularAlertasSubstituicao(bombeiros)),
    ...(await calcularAlertasCertificacaoCurso(bombeiros)),
    ...(await calcularAlertasCredenciais(bombeiros)),
    ...(await calcularAlertasCNH(bombeiros)),
    ...(await calcularAlertasCVE(bombeiros)),
  ];

  const resultado: Notificacao[] = [];
  const chavesProcessadas = new Set<string>();
  const agora = new Date();

  for (const alerta of novosAlertas) {
    const chave = `${alerta.origem}-${alerta.descricao}`;
    chavesProcessadas.add(chave);
    const existente = existentesMap.get(chave);
    if (existente) {
      const criadoEm = new Date(existente.createdAt);
      const diasDesdeCriacao = Math.floor((agora.getTime() - criadoEm.getTime()) / (1000 * 60 * 60 * 24));
      if (alerta.origem === 'certificacao_curso' && diasDesdeCriacao >= 15 && existente.lida) {
        resultado.push({
          ...alerta,
          id: crypto.randomUUID(),
          lida: false,
          createdAt: new Date().toISOString(),
        });
      } else {
        resultado.push(existente);
      }
    } else {
      resultado.push({
        ...alerta,
        id: crypto.randomUUID(),
        lida: false,
        createdAt: new Date().toISOString(),
      });
    }
  }

  for (const existente of existentes) {
    const chave = `${existente.origem}-${existente.descricao}`;
    if (!chavesProcessadas.has(chave)) {
      resultado.push(existente);
    }
  }

  resultado.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  saveStored(resultado);
  return resultado;
}

export function listarTodasNotificacoes(): Notificacao[] {
  return getStored();
}

export function listarNotificacoesPorEquipe(equipes: Equipe[]): Notificacao[] {
  const conjunto = new Set(equipes);
  return getStored().filter(n => conjunto.has(n.equipe));
}

export function marcarNotificacaoLida(id: string) {
  const all = getStored();
  const idx = all.findIndex(n => n.id === id);
  if (idx !== -1) {
    all[idx] = { ...all[idx], lida: true };
    saveStored(all);
  }
}

export function marcarTodasNotificacoesLidas(equipes?: Equipe[]) {
  const all = getStored();
  const conjunto = equipes ? new Set(equipes) : null;
  const resultado = all.map(n => {
    if (conjunto && !conjunto.has(n.equipe)) return n;
    return { ...n, lida: true };
  });
  saveStored(resultado);
}

export function contarNaoLidas(equipes?: Equipe[]): number {
  const conjunto = equipes ? new Set(equipes) : null;
  return getStored().filter(n => {
    if (n.lida) return false;
    if (conjunto && !conjunto.has(n.equipe)) return false;
    return true;
  }).length;
}

export function limparNotificacoes() {
  localStorage.removeItem(STORAGE_KEY);
}

async function calcularAlertasCredenciais(bombeiros: import('../types/bombeiro').Bombeiro[]): Promise<Omit<Notificacao, 'id' | 'lida' | 'createdAt'>[]> {
  const alertas: Omit<Notificacao, 'id' | 'lida' | 'createdAt'>[] = [];
  try {
    const agora = new Date();
    const seisMeses = new Date(agora);
    seisMeses.setMonth(seisMeses.getMonth() + 6);

    for (const b of bombeiros) {
      if (!b.credencialValidade) continue;
      const venc = new Date(b.credencialValidade + 'T00:00:00');
      if (venc > agora && venc <= seisMeses) {
        const dias = Math.ceil((venc.getTime() - agora.getTime()) / 86400000);
        alertas.push({
          titulo: 'Credencial Próxima do Vencimento',
          descricao: `${b.nomeCompleto} (${b.nomeGuerra}) - Credencial vence em ${dias} dias. Necessário juntar documentação para refazer.`,
          tipo: 'alerta',
          equipe: b.equipe,
          origem: 'credencial',
        });
      }
    }
  } catch { /* ignorar */ }
  return alertas;
}
