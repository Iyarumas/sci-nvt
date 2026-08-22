export type ChecklistTotalPrintLayout = 'padrao' | 'equipamentos';

export interface ChecklistTotalPrintRow {
  secao?: string;
  quantidade?: string;
  exig?: string;
  disp?: string;
  item?: string;
}

export interface ChecklistTotalPrintPage {
  rows: ChecklistTotalPrintRow[];
}

export interface ChecklistTotalPrintDocument {
  id: string;
  label: string;
  titulo: string;
  identificacaoLabel: string;
  identificacaoValor: string;
  layout: ChecklistTotalPrintLayout;
  pages: ChecklistTotalPrintPage[];
}

export const CHECKLIST_TOTAL_PRINT_DOCUMENTS: ChecklistTotalPrintDocument[] = [
  {
    "id": "sala-de-observa-o-oc-1",
    "label": "SALA DE OBSERVAÇÃO - OC",
    "titulo": "CHECKLIST DIÁRIO DA SALA DE OBSERVAÇÃO",
    "identificacaoLabel": "IDENTIFICAÇÃO DO LOCAL",
    "identificacaoValor": "SALA DE OBSERVAÇÃO - OC",
    "layout": "padrao",
    "pages": [
      {
        "rows": [
          {
            "secao": "ESTAÇÕES DE RÁDIO"
          },
          {
            "quantidade": "1",
            "item": "Estação fixa"
          },
          {
            "quantidade": "2",
            "item": "Estações portáteis (rádios portáteis) (OC e BA-LR)"
          },
          {
            "quantidade": "2",
            "item": "Carregadores para os rádios portáteis"
          },
          {
            "quantidade": "2",
            "item": "Baterias reserva"
          },
          {
            "secao": "LINHAS TELEFÔNICAS"
          },
          {
            "quantidade": "1",
            "item": "Hotline entre OC e COA/COE"
          },
          {
            "quantidade": "1",
            "item": "Campainha auxiliar do Hotline entre OC e COA/COE"
          },
          {
            "quantidade": "1",
            "item": "Hotline entre OC e TWR"
          },
          {
            "quantidade": "1",
            "item": "Ramal (9206)"
          },
          {
            "quantidade": "1",
            "item": "Campainha auxiliar do Ramal (9206)"
          },
          {
            "secao": "SISTEMA DE ALARME"
          },
          {
            "quantidade": "1",
            "item": "Sirene interna (botoeira)"
          },
          {
            "quantidade": "1",
            "item": "Tablet Sistema de Alarmes e Chamados"
          },
          {
            "quantidade": "X",
            "item": "Sirene remota (TWR)"
          },
          {
            "quantidade": "1",
            "item": "Amplificador de som"
          },
          {
            "secao": "OBSERVAÇÃO DA ÁREA DE MOVIMENTOS DE AERONAVES"
          },
          {
            "quantidade": "X",
            "item": "Sistema de câmeras (site)"
          },
          {
            "quantidade": "1",
            "item": "Monitor"
          },
          {
            "quantidade": "1",
            "item": "CPU"
          },
          {
            "quantidade": "1",
            "item": "Teclado"
          },
          {
            "quantidade": "1",
            "item": "Mouse"
          },
          {
            "quantidade": "1",
            "item": "Nobreak"
          },
          {
            "quantidade": "1",
            "item": "Bateria"
          },
          {
            "secao": "DOCUMENTOS E PUBLICAÇÕES"
          },
          {
            "quantidade": "1",
            "item": "PCINC"
          },
          {
            "quantidade": "1",
            "item": "PASTA COM POP´s MEDMAIS"
          },
          {
            "quantidade": "1",
            "item": "PLEM"
          },
          {
            "quantidade": "1",
            "item": "Mapa de grade interno"
          },
          {
            "quantidade": "1",
            "item": "Mapa de grade externo"
          },
          {
            "quantidade": "10",
            "item": "Fluxogramas de acionamento"
          },
          {
            "quantidade": "1",
            "item": "Prancheta com fichas de Emergências Aeronáuticas"
          },
          {
            "quantidade": "1",
            "item": "Lista de Ramais CCR NVT"
          },
          {
            "quantidade": "5",
            "item": "Check-list das Viaturas e Equipamentos"
          }
        ]
      },
      {
        "rows": [
          {
            "secao": "OUTROS EQUIPAMENTOS"
          },
          {
            "quantidade": "1",
            "item": "Central do sistema de detecção e alarme de incêndio"
          },
          {
            "quantidade": "1",
            "item": "Fonte de alimentação do sistema de incêndio"
          },
          {
            "quantidade": "2",
            "item": "Filtros de linha"
          },
          {
            "quantidade": "2",
            "item": "Ar condicionado"
          },
          {
            "quantidade": "1",
            "item": "Controle do ar condicionado"
          },
          {
            "quantidade": "1",
            "item": "Celular Operacional com Capa e Pelicula"
          },
          {
            "quantidade": "1",
            "item": "Carregador de Celular"
          },
          {
            "quantidade": "4",
            "item": "Chaves (Grupo Gerador e Ferramentaria)"
          },
          {
            "secao": "MOBÍLIA"
          },
          {
            "quantidade": "1",
            "item": "Quadro de Escala"
          },
          {
            "quantidade": "1",
            "item": "Porta nomes para escala"
          },
          {
            "quantidade": "1",
            "item": "Painel de Informações MedMais"
          },
          {
            "quantidade": "1",
            "item": "Gaveteiro"
          },
          {
            "quantidade": "1",
            "item": "Mesa Longa"
          },
          {
            "quantidade": "1",
            "item": "Mesa Escolar"
          },
          {
            "quantidade": "2",
            "item": "Cadeiras giratórias"
          },
          {
            "quantidade": "1",
            "item": "Lixeira"
          }
        ]
      }
    ]
  },
  {
    "id": "crs-superestrutura-2",
    "label": "CRS - SUPERESTRUTURA",
    "titulo": "CHECKLIST DIÁRIO CRS - SUPERESTRUTURA",
    "identificacaoLabel": "IDENTIFICAÇÃO DA VIATURA",
    "identificacaoValor": "CRS - SUPERESTRUTURA",
    "layout": "padrao",
    "pages": [
      {
        "rows": [
          {
            "quantidade": "1",
            "item": "Lataria"
          },
          {
            "quantidade": "2",
            "item": "Limpeza geral do carro"
          },
          {
            "quantidade": "3",
            "item": "Nível do óleo do motor"
          },
          {
            "quantidade": "4",
            "item": "Nível do fluído de arrefecimento"
          },
          {
            "quantidade": "5",
            "item": "Nível do fluído da direção"
          },
          {
            "quantidade": "6",
            "item": "Ignição"
          },
          {
            "quantidade": "7",
            "item": "Partida do motor de tração"
          },
          {
            "quantidade": "8",
            "item": "Painel de instrumentos e advertência"
          },
          {
            "quantidade": "9",
            "item": "Nível de combustível"
          },
          {
            "quantidade": "10",
            "item": "Tacógrafo"
          },
          {
            "quantidade": "11",
            "item": "Buzina"
          },
          {
            "quantidade": "12",
            "item": "Limpador de pára-brisas"
          },
          {
            "quantidade": "13",
            "item": "Faróis"
          },
          {
            "quantidade": "14",
            "item": "Setas direcionais"
          },
          {
            "quantidade": "15",
            "item": "Luz de ré"
          },
          {
            "quantidade": "16",
            "item": "Luz cidade"
          },
          {
            "quantidade": "17",
            "item": "Luz de freio"
          },
          {
            "quantidade": "18",
            "item": "Pisca alerta"
          },
          {
            "quantidade": "19",
            "item": "Iluminação geral da cabine"
          },
          {
            "quantidade": "20",
            "item": "Rádio transceptor"
          },
          {
            "quantidade": "21",
            "item": "Iluminação externa"
          },
          {
            "quantidade": "22",
            "item": "Iluminação interna do baú"
          },
          {
            "quantidade": "23",
            "item": "Giroflex"
          },
          {
            "quantidade": "24",
            "item": "Rádio fone"
          },
          {
            "quantidade": "25",
            "item": "Sirene"
          },
          {
            "quantidade": "26",
            "item": "Mapa de grade"
          },
          {
            "quantidade": "27",
            "item": "5 unidades de ficha de emergência"
          },
          {
            "quantidade": "28",
            "item": "Calibragem dos pneus"
          },
          {
            "quantidade": "29",
            "item": "Direção"
          },
          {
            "quantidade": "30",
            "item": "Freios"
          },
          {
            "quantidade": "31",
            "item": "Suspensão"
          },
          {
            "quantidade": "32",
            "item": "Encaixe caixa de marchas"
          },
          {
            "quantidade": "33",
            "item": "Temperatura do motor"
          },
          {
            "quantidade": "34",
            "item": "Ferramentas do chassis"
          },
          {
            "quantidade": "35",
            "item": "Macaco"
          },
          {
            "quantidade": "36",
            "item": "Triângulo de sinalização"
          },
          {
            "quantidade": "37",
            "item": "Guincho completo com controle"
          }
        ]
      },
      {
        "rows": [
          {
            "quantidade": "38",
            "item": "Tomada externa"
          },
          {
            "quantidade": "39",
            "item": "Megafone"
          },
          {
            "quantidade": "40",
            "item": "Ar Condicionado"
          }
        ]
      }
    ]
  },
  {
    "id": "crs-equipamentos-3",
    "label": "CRS - EQUIPAMENTOS",
    "titulo": "CHECKLIST DIÁRIO CRS - EQUIPAMENTOS",
    "identificacaoLabel": "IDENTIFICAÇÃO DA VIATURA",
    "identificacaoValor": "CRS - EQUIPAMENTOS",
    "layout": "equipamentos",
    "pages": [
      {
        "rows": [
          {
            "secao": "COMPARTIMENTO 01 Mot."
          },
          {
            "exig": "X",
            "disp": "2",
            "item": "Lanterna Balizadora"
          },
          {
            "secao": "COMPARTIMENTO 02"
          },
          {
            "exig": "X",
            "disp": "1",
            "item": "Almofada pneumática pequena"
          },
          {
            "secao": "COMPARTIMENTO 03"
          },
          {
            "exig": "X",
            "disp": "2",
            "item": "Almofada pneumática média"
          },
          {
            "exig": "X",
            "disp": "1",
            "item": "Almofada pneumática grande"
          },
          {
            "exig": "1",
            "disp": "1",
            "item": "Serra sabre"
          },
          {
            "exig": "X",
            "disp": "1",
            "item": "Bolsa de mangueiras e bloqueadores almofadas pneumáticas."
          },
          {
            "exig": "X",
            "disp": "1",
            "item": "Bolsa com 02 redes de captura de mamíf."
          },
          {
            "exig": "X",
            "disp": "6",
            "item": "Cones de sinalização com lastro"
          },
          {
            "secao": "COMPARTIMENTO 04"
          },
          {
            "exig": "X",
            "disp": "1",
            "item": "Motoabrasivo com disco de multi corte"
          },
          {
            "exig": "X",
            "disp": "1",
            "item": "Disco moto abrasivo de vídea (concreto)"
          },
          {
            "exig": "X",
            "disp": "1",
            "item": "Bolsa de ferramentas moto abrasivo"
          },
          {
            "exig": "X",
            "disp": "1",
            "item": "Misturador de Combustível Sthill"
          },
          {
            "exig": "X",
            "disp": "1",
            "item": "Combustível puro"
          },
          {
            "exig": "X",
            "disp": "1",
            "item": "Óleo dois tempos"
          },
          {
            "exig": "X",
            "disp": "3",
            "item": "Funis"
          },
          {
            "exig": "X",
            "disp": "1",
            "item": "Caixa de ferramentas"
          },
          {
            "secao": "COMPARTIMENTO 05"
          },
          {
            "exig": "1",
            "disp": "1",
            "item": "Motogerador elétrico"
          },
          {
            "exig": "X",
            "disp": "1",
            "item": "Cabo adaptador 220v Pequeno"
          },
          {
            "secao": "COMPARTIMENTO 06 SUPERIOR"
          },
          {
            "exig": "3",
            "disp": "4",
            "item": "Maca rígida"
          },
          {
            "exig": "3",
            "disp": "4",
            "item": "Gancho ou garra de salvamento(croque)"
          },
          {
            "exig": "1",
            "disp": "1",
            "item": "Machado de resgate grande sem cunha"
          },
          {
            "exig": "1",
            "disp": "1",
            "item": "Pé de cabra 165cm"
          },
          {
            "exig": "X",
            "disp": "1",
            "item": "Lonas"
          },
          {
            "exig": "X",
            "disp": "1",
            "item": "Alavanca 180cm"
          },
          {
            "exig": "X",
            "disp": "1",
            "item": "Pá Reta"
          },
          {
            "exig": "X",
            "disp": "1",
            "item": "Enxada"
          },
          {
            "exig": "X",
            "disp": "1",
            "item": "Pé de cabra 95cm"
          },
          {
            "exig": "X",
            "disp": "2",
            "item": "Laço cambão"
          },
          {
            "exig": "X",
            "disp": "1",
            "item": "Pinça para cobras e serpentes"
          }
        ]
      },
      {
        "rows": [
          {
            "exig": "X",
            "disp": "1",
            "item": "Gancho para cobras e serpentes"
          },
          {
            "exig": "X",
            "disp": "1",
            "item": "Puça de lona para captura de animais"
          },
          {
            "secao": "COMPARTIMENTO 06 INFERIOR"
          },
          {
            "exig": "1",
            "disp": "1",
            "item": "Equipamento de Oxigenoterapia Portátil"
          },
          {
            "exig": "X",
            "disp": "1",
            "item": "Cilindros p/ almofadas pneumáticas/ reserva"
          },
          {
            "exig": "6",
            "disp": "<2>",
            "item": "EPR completo"
          },
          {
            "exig": "1",
            "disp": "1",
            "item": "Extintor portátil CO2 4kg"
          },
          {
            "exig": "1",
            "disp": "1",
            "item": "Extintor portátil Pó Químico ABC 4kg"
          },
          {
            "exig": "3",
            "disp": "4",
            "item": "Manta Anti Chama"
          },
          {
            "exig": "X",
            "disp": "2",
            "item": "Mascara de EPR Carona ( Resgate )"
          },
          {
            "secao": "COMPARTIMENTO 07 SUPERIOR"
          },
          {
            "exig": "X",
            "disp": "2",
            "item": "Corda de salvamento \"\"trava quedas\"\" 16 kn - 50m"
          },
          {
            "exig": "X",
            "disp": "1",
            "item": "Cinta catraca 1,5 tons"
          },
          {
            "exig": "X",
            "disp": "2",
            "item": "Machado de resgate pequena com cunha"
          },
          {
            "exig": "1",
            "disp": "1",
            "item": "Pé de cabra 65cm"
          },
          {
            "exig": "X",
            "disp": "2",
            "item": "Correntes da ferramenta expansora"
          },
          {
            "exig": "X",
            "disp": "1",
            "item": "Alicate cortante 17cm - corta frio"
          },
          {
            "exig": "X",
            "disp": "1",
            "item": "Divisor"
          },
          {
            "exig": "X",
            "disp": "3",
            "item": "Redução"
          },
          {
            "exig": "X",
            "disp": "1",
            "item": "Chave de hidrantes"
          },
          {
            "secao": "COMPARTIMENTO 07 INFERIOR"
          },
          {
            "exig": "1",
            "disp": "1",
            "item": "Motobomba do desencarcerador hidráulico"
          },
          {
            "exig": "1",
            "disp": "1",
            "item": "Desencarcerador hidráulico expansora"
          },
          {
            "exig": "1",
            "disp": "1",
            "item": "Desencarcerador hidráulico cilindro expansor"
          },
          {
            "exig": "1",
            "disp": "1",
            "item": "Desencarcerador hidráulico cortador"
          },
          {
            "exig": "1",
            "disp": "2",
            "item": "Mangueiras hidráulicas desencarcerador"
          },
          {
            "exig": "X",
            "disp": "1",
            "item": "Suporte de coluna"
          },
          {
            "exig": "X",
            "disp": "1",
            "item": "Manta resistente ao fogo palco"
          },
          {
            "secao": "COMPARTIMENTO 08 CABINE RE"
          },
          {
            "exig": "X",
            "disp": "2",
            "item": "Head block ( Imobilizador de Cabeça )"
          },
          {
            "exig": "3",
            "disp": "3",
            "item": "Kit médico de primeiros socorros"
          },
          {
            "exig": "2",
            "disp": "4",
            "item": "Colar cervical regulável ( PP,P,M,G )"
          },
          {
            "exig": "8",
            "disp": "8",
            "item": "Talas moldáveis"
          },
          {
            "exig": "2",
            "disp": "2",
            "item": "Colete de imobilização dorsal - KED"
          },
          {
            "exig": "6",
            "disp": "<3>",
            "item": "EPR completo"
          },
          {
            "exig": "X",
            "disp": "1",
            "item": "Manual Abquim"
          },
          {
            "exig": "X",
            "disp": "1",
            "item": "Mega Fone Portátil"
          },
          {
            "exig": "X",
            "disp": "1",
            "item": "Esguicho tipo Pistola Regulável (Viper)"
          }
        ]
      },
      {
        "rows": [
          {
            "secao": "COMPARTIMENTO 09 CABINE LR"
          },
          {
            "exig": "6",
            "disp": "6",
            "item": "Ferramenta Corta Cinto"
          },
          {
            "exig": "X",
            "disp": "1",
            "item": "Binóculo"
          },
          {
            "exig": "X",
            "disp": "1",
            "item": "Rolos de fita de isolamento"
          },
          {
            "exig": "6",
            "disp": "<1>",
            "item": "EPR completo"
          },
          {
            "exig": "4",
            "disp": "4",
            "item": "Lanterna manual"
          },
          {
            "secao": "COMPARTIMENTO SUPERIOR TETO"
          },
          {
            "exig": "1",
            "disp": "1",
            "item": "Torre de iluminação"
          },
          {
            "exig": "2",
            "disp": "1",
            "item": "Escada extensora"
          }
        ]
      }
    ]
  },
  {
    "id": "cci-319-superestrutura-4",
    "label": "CCI 319 - SUPERESTRUTURA",
    "titulo": "CHECKLIST DIÁRIO CCI 319 SUPERESTRUTURA",
    "identificacaoLabel": "IDENTIFICAÇÃO DA VIATURA",
    "identificacaoValor": "CCI 319 - SUPERESTRUTURA",
    "layout": "padrao",
    "pages": [
      {
        "rows": [
          {
            "quantidade": "1",
            "item": "Lataria, pintura"
          },
          {
            "quantidade": "2",
            "item": "Limpeza geral do carro"
          },
          {
            "quantidade": "3",
            "item": "Nível do óleo do motor"
          },
          {
            "quantidade": "4",
            "item": "Nível do fluído de arrefecimento"
          },
          {
            "quantidade": "5",
            "item": "Nível do ARLA 32 (Painel de direção ADBLUE)"
          },
          {
            "quantidade": "6",
            "item": "Regulagem banco do operador"
          },
          {
            "quantidade": "7",
            "item": "Tacógrafo"
          },
          {
            "quantidade": "8",
            "item": "Ignição"
          },
          {
            "quantidade": "9",
            "item": "Partida do motor de tração"
          },
          {
            "quantidade": "10",
            "item": "Painel de instrumentos e advertências"
          },
          {
            "quantidade": "11",
            "item": "Nível de combustível"
          },
          {
            "quantidade": "12",
            "item": "Buzina"
          },
          {
            "quantidade": "13",
            "item": "Limpador de pára-brisas"
          },
          {
            "quantidade": "14",
            "item": "Pára-brisas e retrovisores"
          },
          {
            "quantidade": "15",
            "item": "Faróis"
          },
          {
            "quantidade": "16",
            "item": "Setas direcionais e pisca alerta"
          },
          {
            "quantidade": "17",
            "item": "Luz de ré, cidade e freio"
          },
          {
            "quantidade": "18",
            "item": "Iluminação geral da cabine"
          },
          {
            "quantidade": "19",
            "item": "Rádio transceptor e rádio fone"
          },
          {
            "quantidade": "20",
            "item": "Giroflex e sirene"
          },
          {
            "quantidade": "21",
            "item": "Mapa de grade"
          },
          {
            "quantidade": "22",
            "item": "Iluminação interna compartimentos"
          },
          {
            "quantidade": "23",
            "item": "Iluminação externa / Luzes de trabalho"
          },
          {
            "quantidade": "24",
            "item": "Calibragem de pneus (visual)"
          },
          {
            "quantidade": "25",
            "item": "Direção e suspensão"
          },
          {
            "quantidade": "26",
            "item": "Freios, freio estacion. e freio motor (50% e 100%)"
          },
          {
            "quantidade": "27",
            "item": "Encaixe caixa de marchas"
          },
          {
            "quantidade": "28",
            "item": "Temperatura do motor e pressão do óleo"
          },
          {
            "quantidade": "29",
            "item": "Sistema DEVS e MADASS"
          },
          {
            "quantidade": "30",
            "item": "LG & ALERT"
          },
          {
            "quantidade": "31",
            "item": "Painéis de operção / TFT"
          },
          {
            "quantidade": "32",
            "item": "Nível do tanque de água"
          },
          {
            "quantidade": "33",
            "item": "Partida do motor estacionário"
          },
          {
            "quantidade": "34",
            "item": "Bomba de incêndio"
          },
          {
            "quantidade": "35",
            "item": "Canhão monitor de teto"
          },
          {
            "quantidade": "36",
            "item": "Canhão monitor de pára-choque"
          }
        ]
      },
      {
        "rows": [
          {
            "quantidade": "37",
            "item": "Comandos joystick operador e salvamento"
          },
          {
            "quantidade": "38",
            "item": "Sistema de escorva"
          },
          {
            "quantidade": "39",
            "item": "Pressão do cilindro de nitrogênio"
          },
          {
            "quantidade": "40",
            "item": "Nível do tanque de LGE"
          },
          {
            "quantidade": "41",
            "item": "Triângulo de sinalização"
          },
          {
            "quantidade": "42",
            "item": "Extintor ABC 2kg"
          },
          {
            "quantidade": "43",
            "item": "Alavanca de elevação da cabina"
          }
        ]
      }
    ]
  },
  {
    "id": "cci-319-equipamentos-5",
    "label": "CCI 319 - EQUIPAMENTOS",
    "titulo": "CHECKLIST DIÁRIO CCI 319 EQUIPAMENTOS",
    "identificacaoLabel": "IDENTIFICAÇÃO DA VIATURA",
    "identificacaoValor": "CCI 319 - EQUIPAMENTOS",
    "layout": "padrao",
    "pages": [
      {
        "rows": [
          {
            "secao": "COMPARTIMENTO 01"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade persiana"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade plataforma"
          },
          {
            "quantidade": "2",
            "item": "Chave para mangote de sucção"
          },
          {
            "quantidade": "1",
            "item": "Chave operação manual LGE"
          },
          {
            "quantidade": "1",
            "item": "Chave operação manual válvula tanque bomba"
          },
          {
            "quantidade": "1",
            "item": "Ralo de sucção"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade IHM Bomba"
          },
          {
            "secao": "COMPARTIMENTO 02"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade da persiana"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade da expedição lateral"
          },
          {
            "quantidade": "1",
            "item": "Redução"
          },
          {
            "quantidade": "1",
            "item": "Esguicho regulavél com fechamento rápido"
          },
          {
            "quantidade": "1",
            "item": "Mangueira tipo 4 1½ polegadas 30 metros"
          },
          {
            "quantidade": "1",
            "item": "Mangueira tipo 4 2½ polegadas 30 metros"
          },
          {
            "quantidade": "2",
            "item": "Chave Storz"
          },
          {
            "secao": "COMPARTIMENTO 03"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade da persiana"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade IHM PQS"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade carretel de PQ"
          },
          {
            "quantidade": "1",
            "item": "Mangueira tipo 4 1½ polegadas 30 metros"
          },
          {
            "quantidade": "1",
            "item": "Manivela de operação manual carretel"
          },
          {
            "quantidade": "1",
            "item": "Plataforma degrau da escada"
          },
          {
            "secao": "COMPARTIMENTO 04"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade da plataforma"
          },
          {
            "quantidade": "1",
            "item": "Chave Storz"
          },
          {
            "secao": "COMPARTIMENTO 05"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade da persiana"
          },
          {
            "quantidade": "1",
            "item": "Chave de operação manual do PQS"
          },
          {
            "secao": "COMPARTIMENTO 06"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade da persiana"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade IHM PQS"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade carretel de PQ"
          },
          {
            "quantidade": "1",
            "item": "Manivela de operação manual carretel"
          },
          {
            "quantidade": "1",
            "item": "Mangueira tipo 4 1½ polegadas 30 metros"
          },
          {
            "quantidade": "1",
            "item": "Capacete de proteção válvula cilindro N²"
          },
          {
            "quantidade": "2",
            "item": "Calços de pneu plásticos da VTR"
          }
        ]
      },
      {
        "rows": [
          {
            "secao": "COMPARTIMENTO 07"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade da plataforma"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade dos bocais de abastecimento por pressão"
          },
          {
            "quantidade": "1",
            "item": "Chave Storz"
          },
          {
            "secao": "COMPARTIMENTO 08"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade da persiana"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade da expedição lateral"
          },
          {
            "quantidade": "1",
            "item": "Redução"
          },
          {
            "quantidade": "1",
            "item": "Esguicho regulavél com fechamento rápido"
          },
          {
            "quantidade": "1",
            "item": "Mangueira tipo 4 1½ polegadas 30 metros"
          },
          {
            "quantidade": "1",
            "item": "Mangueira tipo 4 2½ polegadas 30 metros"
          },
          {
            "secao": "COMPARTIMENTO 09 (CABINE)"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade travas de liberação dos EPRs"
          },
          {
            "quantidade": "3",
            "item": "Equipamentos de proteção respiratória completos"
          },
          {
            "secao": "COMPARTIMENTO 10 (TETO)"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade da escada"
          },
          {
            "quantidade": "2",
            "item": "Mangotes de sucção"
          },
          {
            "quantidade": "1",
            "item": "Lance base da escada prolongável"
          },
          {
            "quantidade": "3",
            "item": "Lances extensores da escada prolongável"
          },
          {
            "quantidade": "1",
            "item": "Chave operação manual do canhão superior"
          },
          {
            "quantidade": "1",
            "item": "Chave de abertura manual da válvula bomba tanque"
          }
        ]
      }
    ]
  },
  {
    "id": "cci-320-superestrutura-6",
    "label": "CCI 320 - SUPERESTRUTURA",
    "titulo": "CHECKLIST DIÁRIO CCI 320 SUPERESTRUTURA",
    "identificacaoLabel": "IDENTIFICAÇÃO DA VIATURA",
    "identificacaoValor": "CCI 320 - SUPERESTRUTURA",
    "layout": "padrao",
    "pages": [
      {
        "rows": [
          {
            "quantidade": "1",
            "item": "Lataria, pintura"
          },
          {
            "quantidade": "2",
            "item": "Limpeza geral do carro"
          },
          {
            "quantidade": "3",
            "item": "Nível do óleo do motor"
          },
          {
            "quantidade": "4",
            "item": "Nível do fluído de arrefecimento"
          },
          {
            "quantidade": "5",
            "item": "Nível do ARLA 32 (Painel de direção ADBLUE)"
          },
          {
            "quantidade": "6",
            "item": "Regulagem banco do operador"
          },
          {
            "quantidade": "7",
            "item": "Tacógrafo"
          },
          {
            "quantidade": "8",
            "item": "Ignição"
          },
          {
            "quantidade": "9",
            "item": "Partida do motor de tração"
          },
          {
            "quantidade": "10",
            "item": "Painel de instrumentos e advertências"
          },
          {
            "quantidade": "11",
            "item": "Nível de combustível"
          },
          {
            "quantidade": "12",
            "item": "Buzina"
          },
          {
            "quantidade": "13",
            "item": "Limpador de pára-brisas"
          },
          {
            "quantidade": "14",
            "item": "Pára-brisas e retrovisores"
          },
          {
            "quantidade": "15",
            "item": "Faróis"
          },
          {
            "quantidade": "16",
            "item": "Setas direcionais e pisca alerta"
          },
          {
            "quantidade": "17",
            "item": "Luz de ré, cidade e freio"
          },
          {
            "quantidade": "18",
            "item": "Iluminação geral da cabine"
          },
          {
            "quantidade": "19",
            "item": "Rádio transceptor e rádio fone"
          },
          {
            "quantidade": "20",
            "item": "Giroflex e sirene"
          },
          {
            "quantidade": "21",
            "item": "Mapa de grade"
          },
          {
            "quantidade": "22",
            "item": "Iluminação interna compartimentos"
          },
          {
            "quantidade": "23",
            "item": "Iluminação externa / Luzes de trabalho"
          },
          {
            "quantidade": "24",
            "item": "Calibragem de pneus (visual)"
          },
          {
            "quantidade": "25",
            "item": "Direção e suspensão"
          },
          {
            "quantidade": "26",
            "item": "Freios, freio estacion. e freio motor (50% e 100%)"
          },
          {
            "quantidade": "27",
            "item": "Encaixe caixa de marchas"
          },
          {
            "quantidade": "28",
            "item": "Temperatura do motor e pressão do óleo"
          },
          {
            "quantidade": "29",
            "item": "Sistema DEVS e MADASS"
          },
          {
            "quantidade": "30",
            "item": "LG & ALERT"
          },
          {
            "quantidade": "31",
            "item": "Painéis de operção / TFT"
          },
          {
            "quantidade": "32",
            "item": "Nível do tanque de água"
          },
          {
            "quantidade": "33",
            "item": "Partida do motor estacionário"
          },
          {
            "quantidade": "34",
            "item": "Bomba de incêndio"
          },
          {
            "quantidade": "35",
            "item": "Canhão monitor de teto"
          }
        ]
      },
      {
        "rows": [
          {
            "quantidade": "36",
            "item": "Canhão monitor de pára-choque"
          },
          {
            "quantidade": "37",
            "item": "Comandos joystick operador e salvamento"
          },
          {
            "quantidade": "38",
            "item": "Sistema de escorva"
          },
          {
            "quantidade": "39",
            "item": "Pressão do cilindro de nitrogênio"
          },
          {
            "quantidade": "40",
            "item": "Nível do tanque de LGE"
          },
          {
            "quantidade": "41",
            "item": "Triângulo de sinalização"
          },
          {
            "quantidade": "42",
            "item": "Extintor ABC 2kg"
          },
          {
            "quantidade": "43",
            "item": "Alavanca de elevação da cabina"
          }
        ]
      }
    ]
  },
  {
    "id": "cci-320-equipamentos-7",
    "label": "CCI 320 - EQUIPAMENTOS",
    "titulo": "CHECKLIST DIÁRIO CCI 320 EQUIPAMENTOS",
    "identificacaoLabel": "IDENTIFICAÇÃO DA VIATURA",
    "identificacaoValor": "CCI 320 - EQUIPAMENTOS",
    "layout": "padrao",
    "pages": [
      {
        "rows": [
          {
            "secao": "COMPARTIMENTO 01"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade persiana"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade plataforma"
          },
          {
            "quantidade": "2",
            "item": "Chave para mangote de sucção"
          },
          {
            "quantidade": "1",
            "item": "Chave operação manual LGE"
          },
          {
            "quantidade": "1",
            "item": "Chave operação manual válvula tanque bomba"
          },
          {
            "quantidade": "1",
            "item": "Ralo de sucção"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade IHM Bomba"
          },
          {
            "secao": "COMPARTIMENTO 02"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade da persiana"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade da expedição lateral"
          },
          {
            "quantidade": "1",
            "item": "Redução"
          },
          {
            "quantidade": "1",
            "item": "Esguicho regulavél com fechamento rápido"
          },
          {
            "quantidade": "1",
            "item": "Mangueira tipo 4 1½ polegadas 30 metros"
          },
          {
            "quantidade": "1",
            "item": "Mangueira tipo 4 2½ polegadas 30 metros"
          },
          {
            "quantidade": "2",
            "item": "Chave Storz"
          },
          {
            "secao": "COMPARTIMENTO 03"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade da persiana"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade IHM PQS"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade carretel de PQ"
          },
          {
            "quantidade": "1",
            "item": "Mangueira tipo 4 1½ polegadas 30 metros"
          },
          {
            "quantidade": "1",
            "item": "Manivela de operação manual carretel"
          },
          {
            "quantidade": "1",
            "item": "Plataforma degrau da escada"
          },
          {
            "secao": "COMPARTIMENTO 04"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade da plataforma"
          },
          {
            "quantidade": "1",
            "item": "Chave Storz"
          },
          {
            "secao": "COMPARTIMENTO 05"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade da persiana"
          },
          {
            "quantidade": "1",
            "item": "Chave de operação manual do PQS"
          },
          {
            "secao": "COMPARTIMENTO 06"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade da persiana"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade IHM PQS"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade carretel de PQ"
          },
          {
            "quantidade": "1",
            "item": "Manivela de operação manual carretel"
          },
          {
            "quantidade": "1",
            "item": "Mangueira tipo 4 1½ polegadas 30 metros"
          },
          {
            "quantidade": "1",
            "item": "Capacete de proteção válvula cilindro N²"
          },
          {
            "quantidade": "2",
            "item": "Calços de pneu plásticos da VTR"
          }
        ]
      },
      {
        "rows": [
          {
            "secao": "COMPARTIMENTO 07"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade da plataforma"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade dos bocais de abastecimento por pressão"
          },
          {
            "quantidade": "1",
            "item": "Chave Storz"
          },
          {
            "secao": "COMPARTIMENTO 08"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade da persiana"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade da expedição lateral"
          },
          {
            "quantidade": "1",
            "item": "Redução"
          },
          {
            "quantidade": "1",
            "item": "Esguicho regulavél com fechamento rápido"
          },
          {
            "quantidade": "1",
            "item": "Mangueira tipo 4 1½ polegadas 30 metros"
          },
          {
            "quantidade": "1",
            "item": "Mangueira tipo 4 2½ polegadas 30 metros"
          },
          {
            "secao": "COMPARTIMENTO 09 (CABINE)"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade travas de liberação dos EPRs"
          },
          {
            "quantidade": "3",
            "item": "Equipamentos de proteção respiratória completos"
          },
          {
            "secao": "COMPARTIMENTO 10 (TETO)"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade da escada"
          },
          {
            "quantidade": "2",
            "item": "Mangotes de sucção"
          },
          {
            "quantidade": "1",
            "item": "Lance base da escada prolongável"
          },
          {
            "quantidade": "3",
            "item": "Lances extensores da escada prolongável"
          },
          {
            "quantidade": "1",
            "item": "Chave operação manual do canhão superior"
          },
          {
            "quantidade": "1",
            "item": "Chave de abertura manual da válvula bomba tanque"
          }
        ]
      }
    ]
  },
  {
    "id": "cci-333-superestrutura-8",
    "label": "CCI 333 - SUPERESTRUTURA",
    "titulo": "CHECKLIST DIÁRIO CCI 333 SUPERESTRUTURA",
    "identificacaoLabel": "IDENTIFICAÇÃO DA VIATURA",
    "identificacaoValor": "CCI 333 - SUPERESTRUTURA",
    "layout": "padrao",
    "pages": [
      {
        "rows": [
          {
            "quantidade": "1",
            "item": "Lataria, pintura"
          },
          {
            "quantidade": "2",
            "item": "Limpeza geral do carro"
          },
          {
            "quantidade": "3",
            "item": "Nível do óleo do motor"
          },
          {
            "quantidade": "4",
            "item": "Nível do fluído de arrefecimento"
          },
          {
            "quantidade": "5",
            "item": "Nível do ARLA 32 (Painel de direção ADBLUE)"
          },
          {
            "quantidade": "6",
            "item": "Regulagem banco do operador"
          },
          {
            "quantidade": "7",
            "item": "Tacógrafo"
          },
          {
            "quantidade": "8",
            "item": "Ignição"
          },
          {
            "quantidade": "9",
            "item": "Partida do motor de tração"
          },
          {
            "quantidade": "10",
            "item": "Painel de instrumentos e advertências"
          },
          {
            "quantidade": "11",
            "item": "Nível de combustível"
          },
          {
            "quantidade": "12",
            "item": "Buzina"
          },
          {
            "quantidade": "13",
            "item": "Limpador de pára-brisas"
          },
          {
            "quantidade": "14",
            "item": "Pára-brisas e retrovisores"
          },
          {
            "quantidade": "15",
            "item": "Faróis"
          },
          {
            "quantidade": "16",
            "item": "Setas direcionais e pisca alerta"
          },
          {
            "quantidade": "17",
            "item": "Luz de ré, cidade e freio"
          },
          {
            "quantidade": "18",
            "item": "Iluminação geral da cabine"
          },
          {
            "quantidade": "19",
            "item": "Rádio transceptor e rádio fone"
          },
          {
            "quantidade": "20",
            "item": "Giroflex e sirene"
          },
          {
            "quantidade": "21",
            "item": "Mapa de grade"
          },
          {
            "quantidade": "22",
            "item": "Iluminação interna compartimentos"
          },
          {
            "quantidade": "23",
            "item": "Iluminação externa / Luzes de trabalho"
          },
          {
            "quantidade": "24",
            "item": "Calibragem de pneus (visual)"
          },
          {
            "quantidade": "25",
            "item": "Direção e suspensão"
          },
          {
            "quantidade": "26",
            "item": "Freios, freio estacion. e freio motor (50% e 100%)"
          },
          {
            "quantidade": "27",
            "item": "Encaixe caixa de marchas"
          },
          {
            "quantidade": "28",
            "item": "Temperatura do motor e pressão do óleo"
          },
          {
            "quantidade": "29",
            "item": "Sistema DEVS e MADASS"
          },
          {
            "quantidade": "30",
            "item": "LG & ALERT"
          },
          {
            "quantidade": "31",
            "item": "Painéis de operção / TFT"
          },
          {
            "quantidade": "32",
            "item": "Nível do tanque de água"
          },
          {
            "quantidade": "33",
            "item": "Partida do motor estacionário"
          },
          {
            "quantidade": "34",
            "item": "Bomba de incêndio"
          },
          {
            "quantidade": "35",
            "item": "Canhão monitor de teto"
          }
        ]
      },
      {
        "rows": [
          {
            "quantidade": "36",
            "item": "Canhão monitor de pára-choque"
          },
          {
            "quantidade": "37",
            "item": "Comandos joystick operador e salvamento"
          },
          {
            "quantidade": "38",
            "item": "Sistema de escorva"
          },
          {
            "quantidade": "39",
            "item": "Pressão do cilindro de nitrogênio"
          },
          {
            "quantidade": "40",
            "item": "Nível do tanque de LGE"
          },
          {
            "quantidade": "41",
            "item": "Triângulo de sinalização"
          },
          {
            "quantidade": "42",
            "item": "Extintor ABC 2kg"
          },
          {
            "quantidade": "43",
            "item": "Alavanca de elevação da cabina"
          }
        ]
      }
    ]
  },
  {
    "id": "cci-333-superestrutura-9",
    "label": "CCI 333 - SUPERESTRUTURA",
    "titulo": "CHECKLIST DIÁRIO CCI 333 SUPERESTRUTURA",
    "identificacaoLabel": "IDENTIFICAÇÃO DA VIATURA",
    "identificacaoValor": "CCI 333 - SUPERESTRUTURA",
    "layout": "padrao",
    "pages": [
      {
        "rows": [
          {
            "quantidade": "1",
            "item": "Lataria, pintura"
          },
          {
            "quantidade": "2",
            "item": "Limpeza geral do carro"
          },
          {
            "quantidade": "3",
            "item": "Nível do óleo do motor"
          },
          {
            "quantidade": "4",
            "item": "Nível do fluído de arrefecimento"
          },
          {
            "quantidade": "5",
            "item": "Nível do ARLA 32 (Painel de direção ADBLUE)"
          },
          {
            "quantidade": "6",
            "item": "Regulagem banco do operador"
          },
          {
            "quantidade": "7",
            "item": "Tacógrafo"
          },
          {
            "quantidade": "8",
            "item": "Ignição"
          },
          {
            "quantidade": "9",
            "item": "Partida do motor de tração"
          },
          {
            "quantidade": "10",
            "item": "Painel de instrumentos e advertências"
          },
          {
            "quantidade": "11",
            "item": "Nível de combustível"
          },
          {
            "quantidade": "12",
            "item": "Buzina"
          },
          {
            "quantidade": "13",
            "item": "Limpador de pára-brisas"
          },
          {
            "quantidade": "14",
            "item": "Pára-brisas e retrovisores"
          },
          {
            "quantidade": "15",
            "item": "Faróis"
          },
          {
            "quantidade": "16",
            "item": "Setas direcionais e pisca alerta"
          },
          {
            "quantidade": "17",
            "item": "Luz de ré, cidade e freio"
          },
          {
            "quantidade": "18",
            "item": "Iluminação geral da cabine"
          },
          {
            "quantidade": "19",
            "item": "Rádio transceptor e rádio fone"
          },
          {
            "quantidade": "20",
            "item": "Giroflex e sirene"
          },
          {
            "quantidade": "21",
            "item": "Mapa de grade"
          },
          {
            "quantidade": "22",
            "item": "Iluminação interna compartimentos"
          },
          {
            "quantidade": "23",
            "item": "Iluminação externa / Luzes de trabalho"
          },
          {
            "quantidade": "24",
            "item": "Calibragem de pneus (visual)"
          },
          {
            "quantidade": "25",
            "item": "Direção e suspensão"
          },
          {
            "quantidade": "26",
            "item": "Freios, freio estacion. e freio motor (50% e 100%)"
          },
          {
            "quantidade": "27",
            "item": "Encaixe caixa de marchas"
          },
          {
            "quantidade": "28",
            "item": "Temperatura do motor e pressão do óleo"
          },
          {
            "quantidade": "29",
            "item": "Sistema DEVS e MADASS"
          },
          {
            "quantidade": "30",
            "item": "LG & ALERT"
          },
          {
            "quantidade": "31",
            "item": "Painéis de operção / TFT"
          },
          {
            "quantidade": "32",
            "item": "Nível do tanque de água"
          },
          {
            "quantidade": "33",
            "item": "Partida do motor estacionário"
          },
          {
            "quantidade": "34",
            "item": "Bomba de incêndio"
          },
          {
            "quantidade": "35",
            "item": "Canhão monitor de teto"
          },
          {
            "quantidade": "36",
            "item": "Canhão monitor de pára-choque"
          }
        ]
      },
      {
        "rows": [
          {
            "quantidade": "37",
            "item": "Comandos joystick operador e salvamento"
          },
          {
            "quantidade": "38",
            "item": "Sistema de escorva"
          },
          {
            "quantidade": "39",
            "item": "Pressão do cilindro de nitrogênio"
          },
          {
            "quantidade": "40",
            "item": "Nível do tanque de LGE"
          },
          {
            "quantidade": "41",
            "item": "Triângulo de sinalização"
          },
          {
            "quantidade": "42",
            "item": "Extintor ABC 2kg"
          },
          {
            "quantidade": "43",
            "item": "Alavanca de elevação da cabina"
          }
        ]
      }
    ]
  },
  {
    "id": "cci-333-equipamentos-10",
    "label": "CCI 333 - EQUIPAMENTOS",
    "titulo": "CHECKLIST DIÁRIO CCI 333 EQUIPAMENTOS",
    "identificacaoLabel": "IDENTIFICAÇÃO DA VIATURA",
    "identificacaoValor": "CCI 333 - EQUIPAMENTOS",
    "layout": "padrao",
    "pages": [
      {
        "rows": [
          {
            "secao": "COMPARTIMENTO 01"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade persiana"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade plataforma"
          },
          {
            "quantidade": "2",
            "item": "Chave para mangote de sucção"
          },
          {
            "quantidade": "1",
            "item": "Chave operação manual LGE"
          },
          {
            "quantidade": "1",
            "item": "Chave operação manual válvula tanque bomba"
          },
          {
            "quantidade": "1",
            "item": "Ralo de sucção"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade IHM Bomba"
          },
          {
            "secao": "COMPARTIMENTO 02"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade da persiana"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade da expedição lateral"
          },
          {
            "quantidade": "1",
            "item": "Redução"
          },
          {
            "quantidade": "1",
            "item": "Esguicho regulavél com fechamento rápido"
          },
          {
            "quantidade": "1",
            "item": "Mangueira tipo 4 1½ polegadas 30 metros"
          },
          {
            "quantidade": "1",
            "item": "Mangueira tipo 4 2½ polegadas 30 metros"
          },
          {
            "quantidade": "2",
            "item": "Chave Storz"
          },
          {
            "secao": "COMPARTIMENTO 03"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade da persiana"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade IHM PQS"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade carretel de PQ"
          },
          {
            "quantidade": "1",
            "item": "Mangueira tipo 4 1½ polegadas 30 metros"
          },
          {
            "quantidade": "1",
            "item": "Manivela de operação manual carretel"
          },
          {
            "quantidade": "1",
            "item": "Plataforma degrau da escada"
          },
          {
            "secao": "COMPARTIMENTO 04"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade da plataforma"
          },
          {
            "quantidade": "1",
            "item": "Chave Storz"
          },
          {
            "secao": "COMPARTIMENTO 05"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade da persiana"
          },
          {
            "quantidade": "1",
            "item": "Chave de operação manual do PQS"
          },
          {
            "secao": "COMPARTIMENTO 06"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade da persiana"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade IHM PQS"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade carretel de PQ"
          },
          {
            "quantidade": "1",
            "item": "Manivela de operação manual carretel"
          },
          {
            "quantidade": "1",
            "item": "Mangueira tipo 4 1½ polegadas 30 metros"
          },
          {
            "quantidade": "1",
            "item": "Capacete de proteção válvula cilindro N²"
          },
          {
            "quantidade": "2",
            "item": "Calços de pneu plásticos da VTR"
          }
        ]
      },
      {
        "rows": [
          {
            "secao": "COMPARTIMENTO 07"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade da plataforma"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade dos bocais de abastecimento por pressão"
          },
          {
            "quantidade": "1",
            "item": "Chave Storz"
          },
          {
            "secao": "COMPARTIMENTO 08"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade da persiana"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade da expedição lateral"
          },
          {
            "quantidade": "1",
            "item": "Redução"
          },
          {
            "quantidade": "1",
            "item": "Esguicho regulavél com fechamento rápido"
          },
          {
            "quantidade": "1",
            "item": "Mangueira tipo 4 1½ polegadas 30 metros"
          },
          {
            "quantidade": "1",
            "item": "Mangueira tipo 4 2½ polegadas 30 metros"
          },
          {
            "secao": "COMPARTIMENTO 09 (CABINE)"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade travas de liberação dos EPRs"
          },
          {
            "quantidade": "3",
            "item": "Equipamentos de proteção respiratória completos"
          },
          {
            "secao": "COMPARTIMENTO 10 (TETO)"
          },
          {
            "quantidade": "X",
            "item": "Operacionalidade da escada"
          },
          {
            "quantidade": "2",
            "item": "Mangotes de sucção"
          },
          {
            "quantidade": "1",
            "item": "Lance base da escada prolongável"
          },
          {
            "quantidade": "3",
            "item": "Lances extensores da escada prolongável"
          },
          {
            "quantidade": "1",
            "item": "Chave operação manual do canhão superior"
          },
          {
            "quantidade": "1",
            "item": "Chave de abertura manual da válvula bomba tanque"
          }
        ]
      }
    ]
  }
];
