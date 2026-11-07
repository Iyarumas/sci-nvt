/**
 * Depois de um deploy, uma aba que já estava aberta ainda conhece os nomes antigos dos arquivos
 * de cada tela (ex.: "Ocorrencias-BCxPkt1m.js"), que deixam de existir no servidor. Ao abrir uma
 * tela nova dá "Failed to fetch dynamically imported module". Em vez de mostrar o erro, a página
 * recarrega sozinha uma vez e já abre com a versão nova.
 */
const CHAVE = 'sci-nvt:recarregou-nova-versao';
const INTERVALO_MINIMO_MS = 30_000;

export function ehErroDeVersaoAntiga(erro: unknown): boolean {
  const mensagem = erro instanceof Error ? erro.message : String(erro ?? '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i.test(mensagem);
}

/** Recarrega uma vez; se já recarregou há pouco (o arquivo sumiu mesmo), deixa o erro aparecer. */
export function recarregarParaNovaVersao(): boolean {
  try {
    const ultima = Number(sessionStorage.getItem(CHAVE) || 0);
    if (Date.now() - ultima < INTERVALO_MINIMO_MS) return false;
    sessionStorage.setItem(CHAVE, String(Date.now()));
  } catch {
    // Sem sessionStorage, recarrega mesmo assim.
  }
  window.location.reload();
  return true;
}

/** Envolve um import() de tela: se falhar por versão antiga, recarrega em vez de quebrar. */
export function importarComRecarga<T>(factory: () => Promise<T>): () => Promise<T> {
  return () => factory().catch(erro => {
    if (ehErroDeVersaoAntiga(erro) && recarregarParaNovaVersao()) {
      // Segura a tela no "carregando" até a página recarregar.
      return new Promise<T>(() => {});
    }
    throw erro;
  });
}

/** Os arquivos que o Vite pré-carrega junto com uma tela também podem ter mudado de nome. */
export function instalarRecargaDeNovaVersao(): void {
  window.addEventListener('vite:preloadError', evento => {
    if (recarregarParaNovaVersao()) evento.preventDefault();
  });
}
