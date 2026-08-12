export interface ChatMensagem {
  id: string;
  de: string;
  deNome: string;
  para: string | null;
  paraNome: string | null;
  texto: string;
  lida: boolean;
  createdAt: string;
}
