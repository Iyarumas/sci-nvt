import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, FileText, ShieldCheck, XCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  aprovarAutorizacaoRegistrosDiarios,
  listarBombeirosParaAutorizacaoRegistrosDiarios,
  rejeitarAutorizacaoRegistrosDiarios,
} from '../../services/bombeiroService';
import type { Bombeiro } from '../../types/bombeiro';
import { formatarDataBR } from '../../utils/datas';
import { resolverContextoOperacional } from '../../utils/permissoes';

const ESCOPO_AUTORIZACAO = [
  'Criar e editar PTR-BA por Instrução da equipe autorizada',
  'Criar e editar PTR-BA Completo da equipe autorizada',
  'Criar e editar LRO/Ocorrências da equipe autorizada',
  'Criar e editar rascunhos do Gerar LRO da equipe autorizada',
];
const EQUIPES_REGISTROS_DIARIOS = ['Alfa', 'Bravo', 'Charlie', 'Delta'];

function nomePessoa(bombeiro: Bombeiro): string {
  return [bombeiro.cargo, bombeiro.nomeGuerra || bombeiro.nomeCompleto].filter(Boolean).join(' - ');
}

function equipeAutorizada(bombeiro: Bombeiro): string {
  if (bombeiro.autorizacaoRegistrosDiariosEquipe) return bombeiro.autorizacaoRegistrosDiariosEquipe;
  return EQUIPES_REGISTROS_DIARIOS.includes(bombeiro.equipe) ? bombeiro.equipe : '';
}

export function ChefeRegistrosDiariosAuthAlert() {
  const { user } = useAuth();
  const [pendentes, setPendentes] = useState<Bombeiro[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [decisoes, setDecisoes] = useState<Record<string, 'aprovado' | 'recusado'>>({});
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      if (!user?.username || user.pessoa?.personType !== 'bombeiro') return;

      try {
        const contexto = await resolverContextoOperacional(user);
        if (contexto.cargoFixo !== 'BA-CE' || !contexto.equipeFixa) return;

        const bombeiros = await listarBombeirosParaAutorizacaoRegistrosDiarios();
        if (cancelado) return;

        setPendentes(
          bombeiros.filter(bombeiro =>
            bombeiro.id !== contexto.bombeiroId &&
            !bombeiro.dataDesligamento &&
            !bombeiro.autorizadoRegistrosDiarios &&
            equipeAutorizada(bombeiro) === contexto.equipeFixa &&
            bombeiro.autorizacaoRegistrosDiariosStatus === 'pendente'
          )
        );
      } catch (error) {
        console.warn('Não foi possível carregar solicitações de autorização dos registros diários.', error);
      }
    }

    carregar();

    return () => {
      cancelado = true;
    };
  }, [user]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach(timer => window.clearTimeout(timer));
    };
  }, []);

  async function decidir(bombeiro: Bombeiro, aprovado: boolean) {
    const decisor = user?.username || user?.name || '';
    const decisao = aprovado ? 'aprovado' : 'recusado';
    setLoadingId(bombeiro.id);
    try {
      if (aprovado) {
        await aprovarAutorizacaoRegistrosDiarios(bombeiro.id, decisor);
      } else {
        await rejeitarAutorizacaoRegistrosDiarios(bombeiro.id, decisor);
      }
      setDecisoes(atuais => ({ ...atuais, [bombeiro.id]: decisao }));

      const timer = window.setTimeout(() => {
        setPendentes(lista => lista.filter(item => item.id !== bombeiro.id));
        setDecisoes(atuais => {
          const proximas = { ...atuais };
          delete proximas[bombeiro.id];
          return proximas;
        });
      }, 850);
      timersRef.current.push(timer);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Não foi possível registrar a decisão.');
    } finally {
      setLoadingId(null);
    }
  }

  if (pendentes.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[125] flex items-start justify-center overflow-y-auto bg-black/70 p-3 backdrop-blur-sm sm:items-center sm:p-4">
      <style>{`
        @keyframes registros-auth-stamp {
          0% { opacity: 0; transform: scale(1.45) rotate(-14deg); }
          58% { opacity: 1; transform: scale(0.94) rotate(-8deg); }
          78% { transform: scale(1.03) rotate(-9deg); }
          100% { opacity: 1; transform: scale(1) rotate(-9deg); }
        }
        .registros-auth-stamp {
          animation: registros-auth-stamp 460ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }
      `}</style>
      <div className="my-2 w-full max-w-4xl overflow-hidden rounded-2xl border border-aviation-400/70 bg-[#101827] text-white shadow-2xl shadow-black/40">
        <div className="h-2 w-full bg-aviation-500" />
        <div className="border-b border-white/10 p-5 text-center sm:p-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-aviation-500/20 text-aviation-100 ring-1 ring-aviation-300/30">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <p className="mt-4 text-xs font-black uppercase tracking-wider text-aviation-200">Autorização do chefe</p>
          <h2 className="mt-1 text-2xl font-black leading-tight">Solicitação para registros diários</h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm font-medium leading-relaxed text-white/70">
            Revise quem poderá criar e editar registros diários da equipe indicada. Essa autorização não permite excluir nenhum registro.
          </p>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-4 sm:p-6">
          <div className="grid gap-4 lg:grid-cols-2">
            {pendentes.map(bombeiro => {
              const decisao = decisoes[bombeiro.id];
              return (
              <div key={bombeiro.id} className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                {decisao && (
                  <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/35 backdrop-blur-[1px]">
                    <div
                      className={`registros-auth-stamp rounded-2xl border-4 px-7 py-4 text-3xl font-black uppercase tracking-[0.16em] sm:text-4xl ${
                        decisao === 'aprovado'
                          ? 'border-emerald-300 bg-emerald-500/15 text-emerald-100 shadow-2xl shadow-emerald-950/40'
                          : 'border-red-300 bg-red-500/15 text-red-100 shadow-2xl shadow-red-950/40'
                      }`}
                    >
                      {decisao === 'aprovado' ? 'Aprovado' : 'Recusado'}
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-aviation-300/50 bg-aviation-500/20">
                    {bombeiro.foto ? (
                      <img src={bombeiro.foto} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-lg font-black">{(bombeiro.nomeGuerra || bombeiro.nomeCompleto || '?').charAt(0)}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-black">{nomePessoa(bombeiro)}</h3>
                    <p className="text-sm font-semibold text-white/60">
                      Equipe de cadastro {bombeiro.equipe} · Autorização para {equipeAutorizada(bombeiro)}
                    </p>
                    {bombeiro.autorizacaoRegistrosDiariosSolicitadoPor && (
                      <p className="mt-1 text-xs text-white/45">
                        Solicitado por {bombeiro.autorizacaoRegistrosDiariosSolicitadoPor}
                        {bombeiro.autorizacaoRegistrosDiariosSolicitadoEm ? ` em ${formatarDataBR(bombeiro.autorizacaoRegistrosDiariosSolicitadoEm)}` : ''}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-aviation-300/20 bg-aviation-500/10 p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-aviation-100">
                    <FileText className="h-4 w-4" />
                    Poderá criar e editar
                  </div>
                  <ul className="space-y-1.5">
                    {ESCOPO_AUTORIZACAO.map(item => (
                      <li key={item} className="flex gap-2 text-sm text-white/75">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-status-green" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex gap-2 rounded-xl border border-red-300/20 bg-red-500/10 p-3 text-sm font-semibold text-red-100">
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    Não poderá excluir registros. Excluir continua restrito às permissões antigas de chefia/admin/criador.
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => decidir(bombeiro, false)}
                    disabled={loadingId === bombeiro.id || !!decisao}
                    className="rounded-xl border border-red-300/30 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-100 transition hover:bg-red-500/20 disabled:opacity-50"
                  >
                    Recusar
                  </button>
                  <button
                    type="button"
                    onClick={() => decidir(bombeiro, true)}
                    disabled={loadingId === bombeiro.id || !!decisao}
                    className="rounded-xl bg-status-green px-4 py-2 text-sm font-black text-white transition hover:bg-emerald-500 disabled:opacity-50"
                  >
                    Aprovar
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
