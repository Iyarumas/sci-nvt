import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, MessageCircle, Save } from 'lucide-react';
import { linkWhatsAppMensagem } from '../../utils/mensagemInicioPlantao';

export const cardPlantao = 'rounded-2xl border border-graphite-200/70 bg-white/80 p-4 dark:border-border-dark dark:bg-surface-card/80';
export const tituloCardPlantao = 'mb-3 text-xs font-black uppercase tracking-wider text-aviation-600 dark:text-aviation-400';

/**
 * Coluna da direita do início e do fim de plantão: a mensagem pronta, o botão de salvar
 * e, depois de salvo, o QR Code que abre a mensagem no celular.
 */
export function PainelMensagemPlantao({
  titulo,
  mensagem,
  salvo,
  salvando,
  onSalvar,
  onErro,
}: {
  titulo: string;
  mensagem: string;
  salvo: { token: string; tokenExpiraEm: string; mensagem: string; atualizadoPor: string; atualizadoEm: string } | null;
  salvando: boolean;
  onSalvar: () => void;
  onErro: (mensagem: string) => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const [qr, setQr] = useState('');
  // O QR Code abre a mensagem salva: só aparece quando o que está na tela já foi salvo.
  const salvoEmDia = !!salvo && salvo.mensagem === mensagem;
  const linkPublico = salvoEmDia ? `${window.location.origin}/plantao/m/${salvo.token}` : '';

  useEffect(() => {
    if (!linkPublico) { setQr(''); return; }
    QRCode.toDataURL(linkPublico, { margin: 1, width: 220 }).then(setQr).catch(() => setQr(''));
  }, [linkPublico]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(mensagem);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      onErro('Não foi possível copiar. Selecione o texto e copie manualmente.');
    }
  }

  return (
    <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
      <section className={cardPlantao}>
        <h2 className={tituloCardPlantao}>{titulo}</h2>
        <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-xl bg-graphite-50 p-3 font-sans text-xs leading-relaxed text-graphite-800 dark:bg-surface-hover dark:text-graphite-200">{mensagem}</pre>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={onSalvar} disabled={salvando} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-aviation-500/20 hover:from-aviation-500 hover:to-aviation-600 disabled:opacity-60">
            <Save className="h-4 w-4" /> {salvando ? 'Salvando...' : salvoEmDia ? 'Salvo' : salvo ? 'Salvar alterações' : 'Salvar e gerar QR Code'}
          </button>
          <button type="button" onClick={copiar} className="flex items-center gap-2 rounded-xl border border-graphite-300/60 px-3 py-2.5 text-sm font-medium text-graphite-700 hover:bg-graphite-50 dark:border-border-dark dark:text-graphite-200 dark:hover:bg-surface-hover">
            {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copiado ? 'Copiada' : 'Copiar'}
          </button>
        </div>
      </section>

      {salvo && !salvoEmDia && (
        <p className="rounded-2xl border border-amber-400/50 bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          Há alterações que ainda não foram salvas. Salve para gerar o QR Code com a mensagem atualizada.
        </p>
      )}

      {salvoEmDia && (
        <section className={`${cardPlantao} text-center`}>
          <h2 className={tituloCardPlantao}>Enviar pelo celular</h2>
          {qr ? <img src={qr} alt="QR Code da mensagem" className="mx-auto h-52 w-52 rounded-xl bg-white p-2" /> : <p className="py-10 text-sm text-graphite-500">Gerando QR Code...</p>}
          <p className="mt-2 text-xs text-graphite-500 dark:text-graphite-400">
            Aponte a câmera do celular. Abre a mensagem pronta para mandar no WhatsApp. Salvo por {salvo.atualizadoPor} em {new Date(salvo.atualizadoEm).toLocaleString('pt-BR')}; o link vale até {new Date(salvo.tokenExpiraEm).toLocaleString('pt-BR')}.
          </p>
          <a href={linkWhatsAppMensagem(mensagem)} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10">
            <MessageCircle className="h-4 w-4" /> Abrir no WhatsApp deste computador
          </a>
        </section>
      )}
    </aside>
  );
}
