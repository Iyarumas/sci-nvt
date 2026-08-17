const DATA_REFERENCIA = new Date('2026-07-21T12:00:00');
const UM_DIA_MS = 24 * 60 * 60 * 1000;

function dataLocalISO(data: Date): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function somarDiasISO(dataEntrada: string, dias: number): string {
  const [ano, mes, dia] = dataEntrada.split('-').map(Number);
  const data = new Date(ano, mes - 1, dia, 12, 0, 0, 0);
  data.setDate(data.getDate() + dias);
  return dataLocalISO(data);
}

export interface HorarioPlantao {
  horarioInicio: '07:00' | '19:00';
  horarioTermino: '19:00' | '07:00';
  turno: 'Diurno' | 'Noturno';
  tipo: 'diurno (12h)' | 'noturno (12h)';
}

export function equipesNoDia(data: Date): ['Alfa', 'Bravo'] | ['Charlie', 'Delta'] {
  const diff = Math.floor((data.getTime() - DATA_REFERENCIA.getTime()) / UM_DIA_MS);
  return diff % 2 === 0 ? ['Alfa', 'Bravo'] : ['Charlie', 'Delta'];
}

export function equipeEstaNoPlantao(equipe: string, data: Date): boolean {
  const equipes = equipesNoDia(data);
  return equipes.some(eq => eq === equipe);
}

export function horarioPlantaoPorEquipe(equipe: string): HorarioPlantao {
  if (equipe === 'Bravo' || equipe === 'Delta') {
    return {
      horarioInicio: '19:00',
      horarioTermino: '07:00',
      turno: 'Noturno',
      tipo: 'noturno (12h)',
    };
  }
  return {
    horarioInicio: '07:00',
    horarioTermino: '19:00',
    turno: 'Diurno',
    tipo: 'diurno (12h)',
  };
}

export function turnoPorEquipe(equipe: string): 'Diurno' | 'Noturno' | 'Ferista' | 'Administrativo' {
  if (equipe === 'Ferista') return 'Ferista';
  if (equipe === 'Embaixador') return 'Administrativo';
  return horarioPlantaoPorEquipe(equipe).turno;
}

export function dataSaidaPlantao(equipe: string, dataEntrada: string): string {
  if (!dataEntrada) return '';
  if (horarioPlantaoPorEquipe(equipe).turno === 'Noturno') return somarDiasISO(dataEntrada, 1);
  return dataEntrada;
}
