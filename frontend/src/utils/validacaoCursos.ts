import type { Bombeiro, Cargo } from '../types/bombeiro';

export type NivelRestricao = 'ok' | 'aviso' | 'bloqueado';

export interface ResultadoValidacaoCurso {
  nivel: NivelRestricao;
  titulo: string;
  mensagem: string;
}

const CARGO_LABELS: Record<string, string> = {
  'BA-CE': 'Chefe de Equipe',
  'BA-LR': 'Líder de Resgate',
  'BA-MC': 'Motorista/Operador de CCI',
  'BA-RE': 'Resgatista',
  'BA-2': 'Bombeiro de Aeródromo',
  'GS': 'Gerente de Seção',
  'OC': 'Operador de Comunicações',
};

export function labelCargo(cargo: string): string {
  return CARGO_LABELS[cargo] || cargo;
}

export function temCategoriaD(cnhCategoria: string): boolean {
  const categoria = cnhCategoria.toUpperCase();
  return categoria.includes('D') || categoria.includes('E');
}

function dataValida(d: string): Date | null {
  if (!d || d.trim() === '') return null;
  const dt = new Date(d + 'T00:00:00');
  return isNaN(dt.getTime()) ? null : dt;
}

function diasAte(data: string): number | null {
  const dt = dataValida(data);
  if (!dt) return null;
  return Math.floor((dt.getTime() - Date.now()) / 86400000);
}

export function validarCursoParaFuncao(
  bombeiro: Bombeiro,
  funcao: Cargo,
  veiculo?: 'crs' | 'cci',
): ResultadoValidacaoCurso | null {
  if (funcao === 'BA-CE' || funcao === 'BA-LR') {
    if (bombeiro.cursoChefeEquipe) {
      return null;
    }
    return {
      nivel: 'bloqueado',
      titulo: `Curso de Chefe de Equipe obrigatório`,
      mensagem: `${bombeiro.nomeGuerra} não possui o Curso de Chefe de Equipe. É obrigatório para exercer a função de ${labelCargo(funcao)}.`,
    };
  }

  if (funcao === 'BA-MC') {
    const cnhOk = temCategoriaD(bombeiro.cnhCategoria);
    const diasCnh = diasAte(bombeiro.cnhValidade);
    const diasCve = diasAte(bombeiro.cveValidade);
    const cnhVencida = diasCnh !== null && diasCnh < 0;
    const cveVencido = diasCve !== null && diasCve < 0;
    const cnhAVencer = diasCnh !== null && diasCnh >= 0 && diasCnh <= 240; // ~8 meses
    const cveAVencer = diasCve !== null && diasCve >= 0 && diasCve <= 365; // ~1 ano

    // Verificações que bloqueiam
    if (!bombeiro.cursoCVE) {
      return { nivel: 'bloqueado', titulo: 'Curso CVE obrigatório', mensagem: `${bombeiro.nomeGuerra} não possui o Curso CVE.` };
    }
    if (cveVencido) {
      return { nivel: 'bloqueado', titulo: 'CVE vencido', mensagem: `CVE de ${bombeiro.nomeGuerra} venceu em ${bombeiro.cveValidade}.` };
    }
    if (!cnhOk) {
      return { nivel: 'bloqueado', titulo: 'Sem Categoria D/E', mensagem: `${bombeiro.nomeGuerra} não possui CNH Categoria D ou E.` };
    }
    if (cnhVencida) {
      return { nivel: 'bloqueado', titulo: 'CNH vencida', mensagem: `CNH de ${bombeiro.nomeGuerra} venceu em ${bombeiro.cnhValidade}.` };
    }

    // Verificações específicas por veículo
    if (veiculo === 'cci') {
      if (!bombeiro.cursoMotoristaCCI) {
        return { nivel: 'bloqueado', titulo: 'Curso Motorista CCI obrigatório', mensagem: `${bombeiro.nomeGuerra} não possui o Curso de Motorista/Condutor de CCI.` };
      }
    }

    // Avisos de vencimento próximo
    if (cveAVencer && cnhAVencer) {
      return { nivel: 'aviso', titulo: 'CNH e CVE próximos do vencimento', mensagem: `CNH vence em ${diasCnh} dias e CVE vence em ${diasCve} dias.` };
    }
    if (cveAVencer) {
      return { nivel: 'aviso', titulo: 'CVE próximo do vencimento', mensagem: `CVE de ${bombeiro.nomeGuerra} vence em ${diasCve} dias.` };
    }
    if (cnhAVencer) {
      return { nivel: 'aviso', titulo: 'CNH próxima do vencimento', mensagem: `CNH de ${bombeiro.nomeGuerra} vence em ${diasCnh} dias.` };
    }

    // Aviso de só poder dirigir CRS (já existente)
    if (!bombeiro.cursoMotoristaCCI) {
      return {
        nivel: 'aviso',
        titulo: 'Somente pode dirigir o CRS',
        mensagem: `${bombeiro.nomeGuerra} não possui o Curso de Motorista/Condutor de CCI, mas possui Categoria D/E. Poderá dirigir apenas o CRS, não as viaturas CCI.`,
      };
    }

    return null;
  }

  return null;
}
