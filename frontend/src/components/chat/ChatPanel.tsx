import { useState, useEffect, useRef, useMemo } from 'react';
import type { Bombeiro } from '../../types/bombeiro';
import { Search, Send, X, MessageCircle, Users, User, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { listarBombeiros } from '../../services/bombeiroService';
import {
  mensagensGerais, conversaCom, enviarMensagem, marcarLida, contarNaoLidas,
} from '../../services/chatService';


type Tab = 'geral' | 'privado';

export function ChatPanel({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const username = user?.username || '';
  const [tab, setTab] = useState<Tab>('geral');
  const [msg, setMsg] = useState('');
  const [busca, setBusca] = useState('');
  const [conversaComUser, setConversaComUser] = useState<string | null>(null);
  const [conversaComNome, setConversaComNome] = useState('');
  const [refresh, setRefresh] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [bombeiros, setBombeiros] = useState<Bombeiro[]>([]);
  const [gerais, setGerais] = useState<any[]>([]);
  const [privadas, setPrivadas] = useState<any[]>([]);
  const [totalNaoLidas, setTotalNaoLidas] = useState(0);

  useEffect(() => {
    async function carregar() {
      const data = await listarBombeiros();
      setBombeiros(data);
    }
    carregar();
  }, []);

  const usuariosDisponiveis = useMemo(() => {
    if (!busca) return bombeiros;
    const t = busca.toLowerCase();
    return bombeiros.filter(b =>
      b.nomeCompleto.toLowerCase().includes(t) ||
      b.nomeGuerra.toLowerCase().includes(t)
    );
  }, [bombeiros, busca]);

  useEffect(() => {
    mensagensGerais().then(setGerais).catch(() => {});
    if (username) {
      contarNaoLidas(username).then(setTotalNaoLidas).catch(() => {});
    }
  }, [refresh, username]);

  useEffect(() => {
    if (username && conversaComUser) {
      conversaCom(username, conversaComUser).then(setPrivadas).catch(() => {});
    } else {
      setPrivadas([]);
    }
  }, [username, conversaComUser, refresh]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [gerais, privadas, tab]);

  useEffect(() => {
    if (conversaComUser) {
      conversaCom(username, conversaComUser).then(msgs => {
        msgs.forEach(m => { if (!m.lida && m.de !== username) marcarLida(m.id); });
        setRefresh(r => r + 1);
      }).catch(() => {});
    }
  }, [conversaComUser, username]);

  function handleSend() {
    if (!msg.trim()) return;
    enviarMensagem({
      de: username,
      deNome: user?.name || username,
      para: conversaComUser,
      paraNome: conversaComNome || null,
      texto: msg.trim(),
    });
    setMsg('');
    setRefresh(r => r + 1);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function formatTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function formatDay(iso: string) {
    const d = new Date(iso);
    const hoje = new Date();
    if (d.toDateString() === hoje.toDateString()) return 'Hoje';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }

  const mensagensAtuais = tab === 'geral' ? gerais : privadas;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/30 sm:items-center sm:justify-center" onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        className="flex h-[70vh] w-full max-w-md flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl dark:bg-surface-elevated"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-graphite-200 px-4 py-3 dark:border-border-dark">
          {conversaComUser ? (
            <div className="flex items-center gap-2">
              <button onClick={() => { setConversaComUser(null); setConversaComNome(''); }}
                className="rounded-lg p-1 text-graphite-400 hover:bg-graphite-100 dark:hover:bg-surface-hover">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-aviation-500 to-aviation-700 text-xs font-bold text-white">
                {conversaComNome.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-bold text-graphite-900 dark:text-graphite-100">{conversaComNome}</p>
                <p className="text-[10px] text-graphite-400 dark:text-graphite-500">Mensagem privada</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-aviation-600 dark:text-aviation-400" />
              <h3 className="text-sm font-bold text-graphite-900 dark:text-graphite-100">
                {tab === 'geral' ? 'Chat Geral' : 'Conversas'}
              </h3>
              {totalNaoLidas > 0 && tab !== 'geral' && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-alert-red px-1.5 text-[10px] font-bold text-white">
                  {totalNaoLidas}
                </span>
              )}
            </div>
          )}
          <button onClick={onClose} className="rounded-lg p-1 text-graphite-400 hover:bg-graphite-100 dark:hover:bg-surface-hover">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        {!conversaComUser && (
          <div className="flex border-b border-graphite-200 dark:border-border-dark">
            <button onClick={() => setTab('geral')}
              className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                tab === 'geral'
                  ? 'border-b-2 border-aviation-600 text-aviation-700 dark:text-aviation-400'
                  : 'text-graphite-400 hover:text-graphite-600 dark:hover:text-graphite-300'
              }`}>
              <span className="flex items-center justify-center gap-1.5">
                <Users className="h-3.5 w-3.5" /> Geral
              </span>
            </button>
            <button onClick={() => setTab('privado')}
              className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                tab === 'privado'
                  ? 'border-b-2 border-aviation-600 text-aviation-700 dark:text-aviation-400'
                  : 'text-graphite-400 hover:text-graphite-600 dark:hover:text-graphite-300'
              }`}>
              <span className="flex items-center justify-center gap-1.5">
                <User className="h-3.5 w-3.5" /> Privado
                {totalNaoLidas > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-alert-red px-1 text-[9px] text-white">
                    {totalNaoLidas}
                  </span>
                )}
              </span>
            </button>
          </div>
        )}

        {/* Lista de pessoas (tab privado) */}
        {tab === 'privado' && !conversaComUser && (
          <div className="border-b border-graphite-200 px-3 py-2 dark:border-border-dark">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-graphite-400" />
              <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
                placeholder="Buscar pessoa..."
                className="w-full rounded-lg border border-graphite-300 bg-white py-2 pl-8 pr-3 text-xs text-graphite-900 placeholder-graphite-400 outline-none focus:border-aviation-500 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:placeholder:text-graphite-500 dark:focus:border-aviation-400" />
            </div>
          </div>
        )}

        {/* Mensagens ou lista */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3">
          {tab === 'privado' && !conversaComUser ? (
            <div className="space-y-1">
              {usuariosDisponiveis.map(b => {
                return (
                  <button key={b.id}
                    onClick={() => { setConversaComUser(b.nomeGuerra.toLowerCase()); setConversaComNome(b.nomeCompleto); setBusca(''); }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-graphite-100 dark:hover:bg-surface-hover">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-aviation-500 to-aviation-700 text-xs font-bold text-white">
                      {b.foto ? <img src={b.foto} className="h-full w-full rounded-full object-cover" /> : b.nomeGuerra.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-graphite-900 dark:text-graphite-100 truncate">{b.nomeCompleto}</p>
                      <p className="text-[10px] text-graphite-400 dark:text-graphite-500">{b.nomeGuerra} · Equipe {b.equipe}</p>
                    </div>
                  </button>
                );
              })}
              {usuariosDisponiveis.length === 0 && (
                <p className="py-6 text-center text-xs text-graphite-400 dark:text-graphite-500">Nenhuma pessoa encontrada.</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {mensagensAtuais.length === 0 && (
                <p className="py-8 text-center text-xs text-graphite-400 dark:text-graphite-500">
                  {tab === 'geral' ? 'Nenhuma mensagem ainda. Comece a conversa!' : 'Nenhuma mensagem. Envie a primeira!'}
                </p>
              )}
              {mensagensAtuais.map((m, i) => {
                const isMe = m.de === username;
                const showDay = i === 0 || formatDay(m.createdAt) !== formatDay(mensagensAtuais[i - 1].createdAt);
                return (
                  <div key={m.id}>
                    {showDay && (
                      <p className="mb-1 text-center text-[10px] font-medium text-graphite-400 dark:text-graphite-500">{formatDay(m.createdAt)}</p>
                    )}
                    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 ${
                        isMe
                          ? 'bg-aviation-600 text-white rounded-br-md'
                          : 'bg-graphite-100 text-graphite-900 rounded-bl-md dark:bg-surface-hover dark:text-graphite-100'
                      }`}>
                        {!isMe && tab === 'geral' && (
                          <p className="mb-0.5 text-[10px] font-bold text-aviation-700 dark:text-aviation-300">{m.deNome}</p>
                        )}
                        <p className="text-sm leading-snug">{m.texto}</p>
                        <p className={`mt-0.5 text-right text-[9px] ${isMe ? 'text-white/60' : 'text-graphite-400 dark:text-graphite-500'}`}>
                          {formatTime(m.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Input */}
        {(tab === 'geral' || conversaComUser) && (
          <div className="border-t border-graphite-200 px-3 py-3 dark:border-border-dark">
            <div className="flex items-end gap-2">
              <textarea
                value={msg}
                onChange={e => setMsg(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={tab === 'geral' ? 'Mensagem para todos...' : `Mensagem para ${conversaComNome}...`}
                rows={1}
                className="min-h-[38px] max-h-24 flex-1 resize-none rounded-xl border border-graphite-300 bg-white px-3 py-2 text-sm text-graphite-900 placeholder-graphite-400 outline-none focus:border-aviation-500 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:placeholder:text-graphite-500 dark:focus:border-aviation-400"
              />
              <button onClick={handleSend} disabled={!msg.trim()}
                className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl bg-aviation-600 text-white shadow-md transition-all hover:bg-aviation-700 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
