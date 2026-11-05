import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, Copy, MessageCircle } from 'lucide-react';
import { obterMensagemPublica } from '../../services/inicioPlantaoService';
import { linkWhatsAppMensagem } from '../../utils/mensagemInicioPlantao';

/** Página aberta pelo QR Code no celular: mostra a mensagem e manda para o WhatsApp. */
export default function MensagemPlantaoPublica() {
  const { token = '' } = useParams();
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    obterMensagemPublica(token)
      .then(r => setMensagem(r.mensagem))
      .catch(err => setErro(err instanceof Error ? err.message : 'Mensagem não encontrada.'));
  }, [token]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(mensagem);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sem permissão de área de transferência: o texto continua selecionável.
    }
  }

  return (
    <main className="min-h-dvh bg-graphite-50 px-4 py-6 text-graphite-900 dark:bg-surface-dark dark:text-graphite-100">
      <div className="mx-auto max-w-lg">
        <h1 className="mb-4 text-lg font-bold">Mensagem do início de plantão</h1>
        {erro ? (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">{erro}</p>
        ) : !mensagem ? (
          <p className="text-sm text-graphite-500">Carregando...</p>
        ) : (
          <>
            <a href={linkWhatsAppMensagem(mensagem)} className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-4 text-base font-bold text-white shadow-lg active:scale-[0.98]">
              <MessageCircle className="h-5 w-5" /> Enviar no WhatsApp
            </a>
            <button type="button" onClick={copiar} className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-graphite-300 px-4 py-3 text-sm font-semibold dark:border-border-dark">
              {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copiado ? 'Copiada' : 'Copiar mensagem'}
            </button>
            <pre className="whitespace-pre-wrap rounded-2xl bg-white p-4 font-sans text-sm leading-relaxed shadow-sm dark:bg-surface-card">{mensagem}</pre>
          </>
        )}
      </div>
    </main>
  );
}
