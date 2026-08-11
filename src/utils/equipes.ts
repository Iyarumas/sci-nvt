const DATA_REFERENCIA = new Date('2026-07-21T12:00:00');
const UM_DIA_MS = 24 * 60 * 60 * 1000;

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
  const d = new Date(`${dataEntrada}T12:00:00`);
  if (horarioPlantaoPorEquipe(equipe).turno === 'Noturno') d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}
