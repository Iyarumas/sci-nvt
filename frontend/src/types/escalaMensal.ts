export type FuncaoPessoa = 'chefe' | 'lider' | 'ba-mc' | 'ba-2';
export type Veiculo = 'crs' | 'cciF2' | 'cciF3';
export type FuncaoVeiculo = 'BaMc' | 'BaCe' | 'BaLr' | 'Ba2' | 'Ba2-1' | 'Ba2-2';

export interface PessoaEscala {
  id: string;
  nome: string;
  nomeGuerra: string;
  funcao: FuncaoPessoa;
  veiculo: Veiculo;
  funcaoNoVeiculo: FuncaoVeiculo;
  isRadioFixo: boolean;
}

export interface VeiculosPlantao {
  crs: { baMc: string; baLr: string; ba2_1: string; ba2_2: string };
  cciF2: { baMc: string; baCe: string; ba2: string };
  cciF3: { baMc: string; ba2_1: string; ba2_2: string };
}

export interface RadioSlot {
  horario: string;
  horarioFim: string;
  pessoaNome: string;
  pessoaNomeGuerra: string;
  fixo: boolean;
}

export interface PessoaReferenciaMensal {
  id?: string;
  pessoaNome: string;
  pessoaNomeGuerra: string;
}

export interface ResponsabilidadeMensalItem extends PessoaReferenciaMensal {
  descricao: string;
}

export interface RadioMensalManual {
  comunicante?: PessoaReferenciaMensal;
  antesMeiaNoite?: PessoaReferenciaMensal[];
  depoisMeiaNoite?: PessoaReferenciaMensal[];
}

export interface PlantaoGerado {
  dia: number;
  data: string;
  veiculos: VeiculosPlantao;
  radio: RadioSlot[];
}

export interface EscalaMensalConfig {
  id: string;
  equipe: string;
  mes: number;
  ano: number;
  paridade: 'par' | 'impar';
  pessoas: PessoaEscala[];
  faxinaManual?: FaxinaMensalItem[];
  responsabilidadesManual?: ResponsabilidadeMensalItem[];
  radioManual?: RadioMensalManual;
  createdAt: string;
  updatedAt: string;
}

export interface FaxinaMensalItem {
  local: string;
  pessoaNome: string;
  pessoaNomeGuerra: string;
}

export interface EscalaMensalCompleta {
  config: EscalaMensalConfig;
  paradas: PlantaoGerado[];
  faxinaMensal: FaxinaMensalItem[];
  responsabilidades: ResponsabilidadeMensalItem[];
}

export const LOCAIS_FAXINA = [
  'Cozinha / Refeitório',
  'Sala de Comunicação / Aloj. Fem. / WC Fem.',
  'Vestiário Masc. / WC Vest. Masc.',
  'Corredores / Academia',
  'Garagem',
  'Auditório / Sala de TV',
  'Alojamento Masculino / WC Aloj.',
  "WC's Piso Térreo / WC Auditório",
  'Sala e WC Liderança',
  'Lixo',
] as const;

export const RESPONSABILIDADES_MENSAIS = [
  'Controle e abastecimento do cilindro (EPRA)',
  'Controle de abastecimento de RTI inferior e superior',
  'Check list almoxarifado (controle de materiais)',
  'Acompanhamento de manutenções',
  'Limpeza dos CCI',
] as const;

export const SLOTS_RADIO_NOTURNO = [
  { horario: '19:00', horarioFim: '20:00', fixo: true },
  { horario: '20:00', horarioFim: '21:00', fixo: false },
  { horario: '21:00', horarioFim: '22:00', fixo: false },
  { horario: '22:00', horarioFim: '23:00', fixo: false },
  { horario: '23:00', horarioFim: '00:00', fixo: false },
  { horario: '00:00', horarioFim: '01:30', fixo: false },
  { horario: '01:30', horarioFim: '03:00', fixo: false },
  { horario: '03:00', horarioFim: '04:30', fixo: false },
  { horario: '04:30', horarioFim: '06:00', fixo: false },
  { horario: '06:00', horarioFim: '07:00', fixo: true },
] as const;

export const SLOTS_RADIO_DIURNO = [
  { horario: '07:00', horarioFim: '08:00', fixo: true },
  { horario: '08:00', horarioFim: '09:00', fixo: false },
  { horario: '09:00', horarioFim: '10:00', fixo: false },
  { horario: '10:00', horarioFim: '11:00', fixo: false },
  { horario: '11:00', horarioFim: '12:00', fixo: false },
  { horario: '12:00', horarioFim: '13:30', fixo: false },
  { horario: '13:30', horarioFim: '15:00', fixo: false },
  { horario: '15:00', horarioFim: '16:30', fixo: false },
  { horario: '16:30', horarioFim: '18:00', fixo: false },
  { horario: '18:00', horarioFim: '19:00', fixo: true },
] as const;

export function equipeRadioDiurna(equipe: string) {
  return equipe === 'Alfa' || equipe === 'Charlie';
}

export function getSlotsRadio(equipe: string) {
  return equipeRadioDiurna(equipe) ? SLOTS_RADIO_DIURNO : SLOTS_RADIO_NOTURNO;
}

export function getRadioSplitIndex(slots: readonly { horario: string; fixo: boolean }[]) {
  const dinamicos = slots.filter(slot => !slot.fixo);
  const idxDivisor = dinamicos.findIndex(slot =>
    slot.horario === '00:00' ||
    slot.horario.startsWith('00:') ||
    slot.horario === '12:00' ||
    slot.horario.startsWith('12:')
  );
  return idxDivisor > 0 ? idxDivisor : Math.ceil(dinamicos.length / 2);
}
