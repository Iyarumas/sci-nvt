import { useState, useEffect, useRef, useMemo } from 'react';
import {
  X, Bell, MessageCircle, Users, Send, Search, ArrowLeft,
  CheckCheck, Trash2, User, MessageSquare,
} from 'lucide-react';
import { useAuth, type UserRole, ROLE_LABELS } from '../../context/AuthContext';
import { listarBombeiros, listarBombeirosResumido } from '../../services/bombeiroService';
import {
  mensagensGerais, conversaCom, enviarMensagem, marcarLida, contarNaoLidas,
} from '../../services/chatService';
import {
  gerarNotificacoes, listarNotificacoesPorEquipe,
  marcarNotificacaoLida as marcarNotifLida,
  marcarTodasNotificacoesLidas, limparNotificacoes,
} from '../../services/notificacaoService';
import type { Notificacao } from '../../services/notificacaoService';
import type { Equipe } from '../../types/bombeiro';

const USERS_KEY = 'sescinc-users';

interface StoredUser {
  name: string;
  role: UserRole;
  previousRole?: UserRole;
}

function getStoredUsers(): Record<string, StoredUser> {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || '{}');
  } catch {
    return {};
  }
}

interface ChatUser {
  username: string;
  name: string;
  role: UserRole;
  previousRole?: UserRole;
}

function getChatUsers(currentUsername: string): ChatUser[] {
  const users = getStoredUsers();
  return Object.entries(users)
    .filter(([key]) => key !== currentUsername)
    .map(([key, u]) => ({ username: key, name: u.name, role: u.role, previousRole: u.previousRole }));
}

const PRESENCE_KEY = 'sescinc-presence';
const PRESENCE_TTL = 120_000;

function touchPresence(myUsername: string) {
  if (!myUsername) return;
  try {
    const raw = localStorage.getItem(PRESENCE_KEY);
    const data: Record<string, number> = raw ? JSON.parse(raw) : {};
    data[myUsername] = Date.now();
    localStorage.setItem(PRESENCE_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
}

function getOnlineUsers(): Set<string> {
  try {
    const raw = localStorage.getItem(PRESENCE_KEY);
    if (!raw) return new Set();
    const data: Record<string, number> = JSON.parse(raw);
    const now = Date.now();
    const online = new Set<string>();
    for (const [user, ts] of Object.entries(data)) {
      if (now - ts < PRESENCE_TTL) online.add(user);
    }
    return online;
  } catch {
    return new Set();
  }
}

type RightTab = 'chat' | 'notificacoes' | 'contatos';
type ChatSubTab = 'geral' | 'privado';

function formatTimeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Agora';
  if (min < 60) return `${min}min`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h`;
  const dias = Math.floor(hrs / 24);
  return `${dias}d`;
}

const TIPO_ICONE: Record<string, typeof Bell> = {
  info: Bell,
  alerta: Bell,
  sucesso: CheckCheck,
  erro: Trash2,
};

const TIPO_COR: Record<string, string> = {
  info: 'text-blue-400',
  alerta: 'text-yellow-400',
  sucesso: 'text-green-400',
  erro: 'text-red-400',
};

export function RightPanel({ onClose, openTab = 'chat' }: { onClose: () => void; openTab?: RightTab }) {
  const { user, effectiveRole } = useAuth();
  const username = user?.username || '';
  const [tab, setTab] = useState<RightTab>(openTab);
  const [chatSubTab, setChatSubTab] = useState<ChatSubTab>('geral');
  const [msg, setMsg] = useState('');
  const [busca, setBusca] = useState('');
  const [conversaComUser, setConversaComUser] = useState<string | null>(null);
  const [conversaComNome, setConversaComNome] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [chatUsers, setChatUsers] = useState<ChatUser[]>([]);
  const [bombeirosEquipes, setBombeirosEquipes] = useState<{ nomeGuerra: string; equipe: Equipe }[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    setChatUsers(getChatUsers(username));
    async function carregarEquipes() {
      try {
        const data = await listarBombeirosResumido();
        setBombeirosEquipes(data);
      } catch { /* ignore */ }
    }
    carregarEquipes();

    touchPresence(username);
    setOnlineUsers(getOnlineUsers());
    const interval = setInterval(() => {
      touchPresence(username);
      setOnlineUsers(getOnlineUsers());
    }, 30_000);
    const onFocus = () => { touchPresence(username); setOnlineUsers(getOnlineUsers()); };
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(interval); window.removeEventListener('focus', onFocus); };
  }, [username]);

  const userEquipes = useMemo(() => {
    const isGlobal = effectiveRole === 'desenvolvedor' || effectiveRole === 'admin' || effectiveRole === 'gerente';
    if (isGlobal) return null;
    const b = bombeirosEquipes.find(x =>
      x.nomeGuerra.toLowerCase() === username.toLowerCase()
    );
    return b ? [b.equipe] as Equipe[] : null;
  }, [bombeirosEquipes, username, effectiveRole]);

  async function carregarNotificacoes() {
    const geradas = await gerarNotificacoes();
    const filtradas = userEquipes ? listarNotificacoesPorEquipe(userEquipes) : geradas;
    setNotificacoes(filtradas);
  }

  useEffect(() => { carregarNotificacoes(); }, []);

  const usuariosFiltrados = useMemo(() => {
    if (!busca) return chatUsers;
    const t = busca.toLowerCase();
    return chatUsers.filter(u =>
      u.name.toLowerCase().includes(t) ||
      u.username.toLowerCase().includes(t)
    );
  }, [chatUsers, busca]);

  const [gerais, setGerais] = useState<any[]>([]);
  const [privadas, setPrivadas] = useState<any[]>([]);
  const [totalNaoLidas, setTotalNaoLidas] = useState(0);
  const naoLidas = notificacoes.filter(n => !n.lida).length;

  useEffect(() => {
    mensagensGerais().then(setGerais).catch(() => {});
    contarNaoLidas(username).then(setTotalNaoLidas).catch(() => {});
  }, [refresh, username]);

  useEffect(() => {
    if (conversaComUser) {
      conversaCom(username, conversaComUser).then(setPrivadas).catch(() => {});
    } else {
      setPrivadas([]);
    }
  }, [username, conversaComUser, refresh]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [gerais, privadas, chatSubTab]);

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
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function marcarTodasLidas() {
    marcarTodasNotificacoesLidas(userEquipes || undefined);
    carregarNotificacoes();
  }

  function handleLimparNotificacoes() {
    limparNotificacoes();
    setNotificacoes([]);
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function formatDay(iso: string) {
    const d = new Date(iso);
    const hoje = new Date();
    if (d.toDateString() === hoje.toDateString()) return 'Hoje';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }

  const mensagensAtuais = chatSubTab === 'geral' ? gerais : privadas;

  return (
    <div className="fixed right-0 top-0 z-50 flex h-screen justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        onClick={e => e.stopPropagation()}
        className="relative flex h-screen w-[360px] flex-col bg-graphite-950 border-l border-white/10 shadow-2xl shadow-black/60 animate-slideInRight"
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-border-dark px-5 py-4">
          <div className="flex items-center gap-3">
            {conversaComUser && (
              <button onClick={() => { setConversaComUser(null); setConversaComNome(''); }}
                className="rounded-lg p-1.5 text-graphite-400 transition-colors hover:bg-surface-card hover:text-graphite-200">
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-aviation-500 to-aviation-700 shadow-md shadow-aviation-500/20">
              <MessageSquare className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                {conversaComUser ? conversaComNome :
                 tab === 'chat' ? 'Chat' :
                 tab === 'notificacoes' ? 'Notificações' : 'Contatos'}
              </h2>
              <p className="text-[11px] text-graphite-500">
                {conversaComUser ? 'Mensagem privada' :
                 tab === 'chat' ? (chatSubTab === 'geral' ? 'Canal geral' : `${chatUsers.length} usuarios`) :
                 tab === 'notificacoes' ? `${naoLidas} não lida(s)` :
                 `${chatUsers.length} cadastrado(s)`}
              </p>
            </div>
          </div>
          <button onClick={onClose}
            className="rounded-lg p-2 text-graphite-500 transition-all hover:bg-surface-card hover:text-graphite-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Tabs ── */}
        {!conversaComUser && (
          <div className="flex border-b border-border-dark">
            {([
              { key: 'chat' as RightTab, icon: MessageCircle, label: 'Chat', badge: totalNaoLidas },
              { key: 'notificacoes' as RightTab, icon: Bell, label: 'Notificações', badge: naoLidas },
              { key: 'contatos' as RightTab, icon: Users, label: 'Contatos', badge: 0 },
            ]).map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`relative flex flex-1 items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors ${
                  tab === t.key
                    ? 'text-white after:absolute after:bottom-0 after:left-4 after:right-4 after:h-[2px] after:rounded-full after:bg-aviation-500'
                    : 'text-graphite-500 hover:text-graphite-300'
                }`}>
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
                {t.badge > 0 && (
                  <span className="ml-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-alert-red px-1 text-[9px] font-bold text-white">
                    {t.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* ── Content ── */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">

          {/* ═══ CHAT ═══ */}
          {tab === 'chat' && !conversaComUser && (
            <>
              {/* Sub-tabs Geral/Privado */}
              <div className="flex border-b border-border-dark">
                <button onClick={() => setChatSubTab('geral')}
                  className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors ${
                    chatSubTab === 'geral'
                      ? 'text-aviation-400 border-b-2 border-aviation-500'
                      : 'text-graphite-500 hover:text-graphite-300'
                  }`}>
                  <Users className="h-3.5 w-3.5" /> Geral
                </button>
                <button onClick={() => setChatSubTab('privado')}
                  className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors ${
                    chatSubTab === 'privado'
                      ? 'text-aviation-400 border-b-2 border-aviation-500'
                      : 'text-graphite-500 hover:text-graphite-300'
                  }`}>
                  <User className="h-3.5 w-3.5" /> Privado
                  {totalNaoLidas > 0 && (
                    <span className="ml-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-alert-red px-1 text-[9px] font-bold text-white">
                      {totalNaoLidas}
                    </span>
                  )}
                </button>
              </div>

              {/* Search no privado */}
              {chatSubTab === 'privado' && (
                <div className="px-4 py-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-graphite-600" />
                    <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
                      placeholder="Buscar pessoa..."
                      className="w-full rounded-xl border border-border-dark bg-surface-card py-2.5 pl-9 pr-3 text-xs text-graphite-100 placeholder-graphite-600 outline-none transition-colors focus:border-aviation-500/50 focus:ring-1 focus:ring-aviation-500/20" />
                  </div>
                </div>
              )}

              {/* Lista de usuários (privado) */}
              {chatSubTab === 'privado' && (
                <div className="px-3">
                  {usuariosFiltrados.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Users className="mb-3 h-8 w-8 text-graphite-700" />
                      <p className="text-xs text-graphite-500">Nenhuma pessoa encontrada.</p>
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      {usuariosFiltrados.map(u => {
                        const initials = u.name.charAt(0).toUpperCase();
                        const isViewerDev = effectiveRole === 'desenvolvedor';
                        const isTargetAdmin = u.role === 'admin';
                        const displayLabel = isTargetAdmin && !isViewerDev && u.username !== username
                          ? (u.previousRole ? (ROLE_LABELS[u.previousRole] || u.previousRole) : 'Admin')
                          : (ROLE_LABELS[u.role] || u.role);
                        const extraLabel = isTargetAdmin && (isViewerDev || u.username === username) && u.previousRole
                          ? ` + ${ROLE_LABELS[u.previousRole] || u.previousRole}`
                          : '';
                        return (
                          <button key={u.username}
                            onClick={() => { setConversaComUser(u.username); setConversaComNome(u.name); setBusca(''); }}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all hover:bg-surface-card active:scale-[0.98]">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-aviation-500 to-aviation-700 text-xs font-bold text-white shadow-md shadow-aviation-500/10">
                              {initials}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-graphite-100 truncate">{u.name}</p>
                              <p className="text-[11px] text-graphite-500">{u.username} · {displayLabel}{extraLabel}</p>
                            </div>
                            <MessageCircle className="h-4 w-4 shrink-0 text-graphite-700" />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Mensagens gerais */}
              {chatSubTab === 'geral' && (
                <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-4 py-3">
                  {mensagensAtuais.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16">
                      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-card">
                        <MessageCircle className="h-7 w-7 text-graphite-600" />
                      </div>
                      <p className="text-sm font-semibold text-graphite-300">Nenhuma mensagem</p>
                      <p className="mt-1 text-xs text-graphite-600">Envie a primeira mensagem para o canal geral</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {mensagensAtuais.map((m, i) => {
                        const isMe = m.de === username;
                        const showDay = i === 0 || formatDay(m.createdAt) !== formatDay(mensagensAtuais[i - 1].createdAt);
                        return (
                          <div key={m.id}>
                            {showDay && (
                              <div className="my-3 flex items-center gap-3">
                                <div className="h-px flex-1 bg-border-dark" />
                                <span className="text-[10px] font-medium text-graphite-600">{formatDay(m.createdAt)}</span>
                                <div className="h-px flex-1 bg-border-dark" />
                              </div>
                            )}
                            <div className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                              {!isMe && (
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-aviation-500 to-aviation-700 text-[10px] font-bold text-white">
                                  {m.deNome?.charAt(0)?.toUpperCase() || '?'}
                                </div>
                              )}
                              <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                                {!isMe && (
                                  <p className="mb-1 text-[11px] font-semibold text-graphite-400">{m.deNome}</p>
                                )}
                                <div className={`rounded-2xl px-3.5 py-2.5 ${
                                  isMe
                                    ? 'bg-aviation-600 text-white rounded-br-md'
                                    : 'bg-surface-card text-graphite-100 rounded-bl-md border border-border-dark'
                                }`}>
                                  <p className="text-[13px] leading-relaxed">{m.texto}</p>
                                </div>
                                <p className={`mt-1 text-[10px] ${isMe ? 'text-right text-graphite-600' : 'text-graphite-600'}`}>
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
              )}

              {/* Input geral */}
              {chatSubTab === 'geral' && (
                <div className="border-t border-border-dark px-4 py-3">
                  <div className="flex items-end gap-2">
                    <textarea
                      ref={inputRef}
                      value={msg}
                      onChange={e => setMsg(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Enviar mensagem para todos..."
                      rows={1}
                      className="min-h-[40px] max-h-24 flex-1 resize-none rounded-xl border border-border-dark bg-surface-card px-4 py-2.5 text-[13px] text-graphite-100 placeholder-graphite-600 outline-none transition-all focus:border-aviation-500/50 focus:ring-1 focus:ring-aviation-500/20"
                    />
                    <button onClick={handleSend} disabled={!msg.trim()}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-aviation-600 text-white transition-all hover:bg-aviation-500 disabled:opacity-20 disabled:cursor-not-allowed active:scale-95 shadow-lg shadow-aviation-600/20">
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ═══ CONVERSA PRIVADA ═══ */}
          {conversaComUser && (
            <>
              <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-4 py-3">
                {mensagensAtuais.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-card">
                      <MessageCircle className="h-7 w-7 text-graphite-600" />
                    </div>
                    <p className="text-sm font-semibold text-graphite-300">Início da conversa</p>
                    <p className="mt-1 text-xs text-graphite-600">Envie a primeira mensagem para {conversaComNome}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {mensagensAtuais.map((m, i) => {
                      const isMe = m.de === username;
                      const showDay = i === 0 || formatDay(m.createdAt) !== formatDay(mensagensAtuais[i - 1].createdAt);
                      return (
                        <div key={m.id}>
                          {showDay && (
                            <div className="my-3 flex items-center gap-3">
                              <div className="h-px flex-1 bg-border-dark" />
                              <span className="text-[10px] font-medium text-graphite-600">{formatDay(m.createdAt)}</span>
                              <div className="h-px flex-1 bg-border-dark" />
                            </div>
                          )}
                          <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 ${
                              isMe
                                ? 'bg-aviation-600 text-white rounded-br-md'
                                : 'bg-surface-card text-graphite-100 rounded-bl-md border border-border-dark'
                            }`}>
                              <p className="text-[13px] leading-relaxed">{m.texto}</p>
                            </div>
                          </div>
                          <p className={`mt-1 text-[10px] ${isMe ? 'text-right text-graphite-600' : 'text-graphite-600'}`}>
                            {formatTime(m.createdAt)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="border-t border-border-dark px-4 py-3">
                <div className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    value={msg}
                    onChange={e => setMsg(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Mensagem para ${conversaComNome}...`}
                    rows={1}
                    className="min-h-[40px] max-h-24 flex-1 resize-none rounded-xl border border-border-dark bg-surface-card px-4 py-2.5 text-[13px] text-graphite-100 placeholder-graphite-600 outline-none transition-all focus:border-aviation-500/50 focus:ring-1 focus:ring-aviation-500/20"
                  />
                  <button onClick={handleSend} disabled={!msg.trim()}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-aviation-600 text-white transition-all hover:bg-aviation-500 disabled:opacity-20 disabled:cursor-not-allowed active:scale-95 shadow-lg shadow-aviation-600/20">
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ═══ NOTIFICAÇÕES ═══ */}
          {tab === 'notificacoes' && !conversaComUser && (
            <div className="p-4">
              {notificacoes.length > 0 && (
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-[11px] font-medium text-graphite-500">{notificacoes.length} notificação(ões)</span>
                  <div className="flex gap-1">
                    <button onClick={marcarTodasLidas}
                      className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-graphite-500 transition-colors hover:bg-surface-card hover:text-graphite-200">
                      <CheckCheck className="h-3 w-3" /> Lidas
                    </button>
                    <button onClick={handleLimparNotificacoes}
                      className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-graphite-500 transition-colors hover:bg-red-500/10 hover:text-red-400">
                      <Trash2 className="h-3 w-3" /> Limpar
                    </button>
                  </div>
                </div>
              )}

              {notificacoes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-card">
                    <Bell className="h-7 w-7 text-graphite-600" />
                  </div>
                  <p className="text-sm font-semibold text-graphite-300">Nenhuma notificação</p>
                  <p className="mt-1 text-xs text-graphite-600">Tudo certo por aqui!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {notificacoes.map(n => {
                    const Icone = TIPO_ICONE[n.tipo] || Bell;
                    return (
                      <div key={n.id}
                        onClick={() => !n.lida && marcarNotifLida(n.id)}
                        className={`group relative rounded-xl border p-3.5 transition-all hover:shadow-md cursor-pointer ${
                          n.lida
                            ? 'border-border-dark bg-surface-card/50'
                            : 'border-aviation-500/20 bg-surface-card'
                        }`}>
                        {!n.lida && (
                          <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-aviation-500" />
                        )}
                        <div className="flex items-start gap-3">
                          <div className={`shrink-0 ${TIPO_COR[n.tipo]}`}>
                            <Icone className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm font-semibold ${n.lida ? 'text-graphite-400' : 'text-graphite-100'}`}>{n.titulo}</p>
                            <p className="mt-0.5 text-xs text-graphite-500 line-clamp-2">{n.descricao}</p>
                            <p className="mt-1.5 text-[10px] text-graphite-600">{formatTimeAgo(n.createdAt)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ═══ CONTATOS ═══ */}
          {tab === 'contatos' && !conversaComUser && (
            <div className="p-4">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-graphite-600" />
                <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
                  placeholder="Buscar contato..."
                  className="w-full rounded-xl border border-border-dark bg-surface-card py-2.5 pl-9 pr-3 text-xs text-graphite-100 placeholder-graphite-600 outline-none transition-colors focus:border-aviation-500/50 focus:ring-1 focus:ring-aviation-500/20" />
              </div>

              {usuariosFiltrados.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-card">
                    <Users className="h-7 w-7 text-graphite-600" />
                  </div>
                  <p className="text-sm font-semibold text-graphite-300">Nenhum contato</p>
                  <p className="mt-1 text-xs text-graphite-600">Nenhum funcionário encontrado.</p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {usuariosFiltrados.map(u => {
                    const initials = u.name.charAt(0).toUpperCase();
                    const isViewerDev = effectiveRole === 'desenvolvedor';
                    const isTargetAdmin = u.role === 'admin';
                    const displayLabel = isTargetAdmin && !isViewerDev && u.username !== username
                      ? (u.previousRole ? (ROLE_LABELS[u.previousRole] || u.previousRole) : 'Admin')
                      : (ROLE_LABELS[u.role] || u.role);
                    const extraLabel = isTargetAdmin && (isViewerDev || u.username === username) && u.previousRole
                      ? ` + ${ROLE_LABELS[u.previousRole] || u.previousRole}`
                      : '';
                    return (
                      <button key={u.username}
                        onClick={() => { setTab('chat'); setChatSubTab('privado'); setConversaComUser(u.username); setConversaComNome(u.name); setBusca(''); }}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-all hover:bg-surface-card active:scale-[0.98]">
                        <div className="relative">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-aviation-500 to-aviation-700 text-sm font-bold text-white shadow-md shadow-aviation-500/10">
                            {initials}
                          </div>
                          {onlineUsers.has(u.username) ? (
                            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-graphite-950 bg-green-500" />
                          ) : (
                            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-graphite-950 bg-red-500" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-graphite-100 truncate">{u.name}</p>
                          <p className="text-[11px] text-graphite-500">{u.username} · {displayLabel}{extraLabel}</p>
                        </div>
                        <MessageCircle className="h-4 w-4 shrink-0 text-graphite-700" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
