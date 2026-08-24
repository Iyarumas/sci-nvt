import { useState, useEffect, useMemo } from 'react';
import { Users, Search, AlertCircle, X, Calendar, Shield, Droplets, User, Hash, IdCard, Car, Briefcase, Clock, FileText, Radio, Mail } from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';
import {
  listarBombeiros,
  buscarBombeiro,
  listarBombeirosPublico,
  buscarBombeiroPublico,
} from '../../services/bombeiroService';
import {
  listarAPOCs,
  buscarAPOC,
  listarAPOCsPublico,
  buscarAPOCPublico,
} from '../../services/apocService';
import { listarSubstituicoesTemporarias } from '../../services/substituicaoTemporariaService';
import type { Bombeiro } from '../../types/bombeiro';
import type { APOC } from '../../types/apoc';
import type { SubstituicaoTemporaria } from '../../types/substituicaoTemporaria';
import { CARGO_OPTIONS, EQUIPE_OPTIONS } from '../../types/bombeiro';
import { useDebounce } from '../../hooks/useDebounce';
import { useAuth } from '../../context/AuthContext';
import {
  canAcessarDadosPessoais,
  type AuthUserPermissao,
  podeVerDadosPessoaisBase,
  resolverContextoOperacional,
} from '../../utils/permissoes';
import { capitalizarNome } from '../../utils/capitalize';
import { formatarDataBR, hojeLocalISO } from '../../utils/datas';
import { PageTour } from '../../components/ui/PageTour';

type Tab = 'todos' | 'bombeiros' | 'apoc' | 'substituicoes';
type SituacaoBombeiro = 'Ativo' | 'Afastado' | 'Desligado';

const FUNCIONARIOS_TOUR_STEPS = [
  {
    selector: 'main h1',
    title: 'Funcionários',
    body: 'Esta tela é uma consulta geral de pessoas cadastradas no sistema.',
    detail: 'Ela junta bombeiros, APOC e situações temporárias para visualização. O cadastro completo continua nas telas Bombeiros e APOC.',
  },
  {
    selector: 'main input, main select',
    title: 'Busca e filtros',
    body: 'Pesquise por matrícula, nome ou equipe. Quando estiver vendo bombeiros, também é possível filtrar por equipe e cargo.',
    detail: 'Esses filtros ajudam a localizar rápido uma pessoa antes de abrir o detalhe ou confirmar a situação atual dela.',
  },
  {
    selector: 'main div.mb-6.flex.items-center.gap-1',
    title: 'Abas de visualização',
    body: 'As abas separam Todos, Bombeiros, APOC e Substituições/Afastamentos quando disponíveis.',
    detail: 'Use Todos para visão ampla, Bombeiros para efetivo operacional, APOC para Centro de Operações Aeroportuárias e Substituições para movimentações temporárias relacionadas.',
  },
  {
    selector: 'main table',
    title: 'Tabelas de pessoas',
    body: 'As tabelas mostram dados resumidos como matrícula, nome, nome de guerra, e-mail quando permitido, cargo, equipe, turno e situação.',
    detail: 'Ativo, Afastado e Desligado ajudam a entender se a pessoa está disponível para as rotinas do sistema naquele momento.',
  },
  {
    selector: 'main table tbody tr',
    title: 'Detalhes do funcionário',
    body: 'Clicar em uma linha de bombeiro abre os detalhes operacionais da pessoa.',
    detail: 'CPF, RG, número da CNH e dados pessoais completos aparecem somente para admin, desenvolvedor, GS e Embaixador.',
  },
];

function capitalize(str: string) {
  return capitalizarNome(str);
}

function labelCargo(valor: string) {
  const found = CARGO_OPTIONS.find(o => o.value === valor);
  return found ? found.label : valor;
}

function formatDate(d: string) {
  return formatarDataBR(d);
}

function podeVerDetalhesCompletosBase(user: AuthUserPermissao): boolean {
  return (
    podeVerDadosPessoaisBase(user) ||
    (user?.pessoa?.personType === 'bombeiro' && user.pessoa.equipe === 'Embaixador')
  );
}

function SituacaoBadge({ situacao }: { situacao: SituacaoBombeiro }) {
  if (situacao === 'Desligado') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-alert-red dark:bg-red-900/20">
        <AlertCircle className="h-3 w-3" />
        Desligado
      </span>
    );
  }
  if (situacao === 'Afastado') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-900/20 dark:text-orange-400">
        <Clock className="h-3 w-3" />
        Afastado
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-status-green/10 px-2.5 py-0.5 text-xs font-medium text-status-green">
      Ativo
    </span>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 rounded-2xl bg-gradient-to-br from-aviation-50 to-aviation-100 p-1.5 shadow-sm dark:from-aviation-900/30 dark:to-aviation-800/20">
        <Icon className="h-4 w-4 text-aviation-600 dark:text-aviation-400" />
      </div>
      <div>
        <p className="text-xs text-graphite-500 dark:text-graphite-400">{label}</p>
        <p className="text-sm font-medium text-graphite-900 dark:text-graphite-100">{value || '-'}</p>
      </div>
    </div>
  );
}

function BombeiroDetailModal({
  bombeiro,
  situacao,
  fullAccess,
  onClose,
}: {
  bombeiro: Bombeiro;
  situacao: SituacaoBombeiro;
  fullAccess: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4" onClick={onClose}>
      <div className="relative max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl bg-white/95 shadow-2xl shadow-black/5 backdrop-blur-sm dark:bg-surface-elevated/95 dark:shadow-black/20" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-graphite-200 px-6 py-4 dark:border-border-dark">
          <div className="flex items-center gap-3">
            {bombeiro.foto ? (
              <img src={bombeiro.foto} alt="" className="h-16 w-16 rounded-full object-cover ring-2 ring-aviation-500/30" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-aviation-600 text-sm font-bold text-white">
                {bombeiro.nomeGuerra.charAt(0)}
              </div>
            )}
            <div>
              <h2 className="text-lg font-bold text-graphite-900 dark:text-graphite-100">{capitalize(bombeiro.nomeCompleto)}</h2>
              <p className="text-sm text-graphite-500">{capitalize(bombeiro.nomeGuerra)} · {bombeiro.matricula}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl p-1.5 text-graphite-400 transition-all duration-200 hover:bg-graphite-100 hover:text-graphite-600 dark:hover:bg-surface-hover dark:hover:text-graphite-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-aviation-600 dark:text-aviation-400">
              {fullAccess ? 'Informações Pessoais' : 'Informações Operacionais'}
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {fullAccess && (
                <>
                  <InfoRow icon={Mail} label="E-mail" value={bombeiro.email} />
                  <InfoRow icon={IdCard} label="CPF" value={bombeiro.cpf} />
                  <InfoRow icon={IdCard} label="RG" value={bombeiro.rg} />
                  <InfoRow icon={Car} label="Número da CNH" value={bombeiro.cnhNumero} />
                </>
              )}
              <InfoRow icon={Car} label="Cat. CNH" value={bombeiro.cnhCategoria} />
              <InfoRow icon={Calendar} label="Validade CNH" value={formatDate(bombeiro.cnhValidade)} />
              <InfoRow icon={IdCard} label="Validade Credencial" value={formatDate(bombeiro.credencialValidade)} />
              <InfoRow icon={Droplets} label="Tipo Sanguíneo" value={bombeiro.tipoSanguineo} />
            </div>
          </div>

          <div className="border-t border-graphite-200 dark:border-border-dark" />

          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-aviation-600 dark:text-aviation-400">Dados Funcionais</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InfoRow icon={Hash} label="Matrícula MMS" value={bombeiro.matricula} />
              <InfoRow icon={User} label="Nome de Guerra" value={capitalize(bombeiro.nomeGuerra)} />
              {fullAccess && (
                <>
                  <InfoRow icon={Calendar} label="Nascimento" value={formatDate(bombeiro.dataNascimento)} />
                  <InfoRow icon={Calendar} label="Idade" value={String(bombeiro.idade || '')} />
                  <InfoRow icon={Calendar} label="Admissão" value={formatDate(bombeiro.dataAdmissao)} />
                </>
              )}
              <InfoRow icon={Briefcase} label="Cargo" value={labelCargo(bombeiro.cargo)} />
              <InfoRow icon={Shield} label="Equipe" value={bombeiro.equipe} />
              <InfoRow icon={Clock} label="Turno" value={bombeiro.turno} />
              <InfoRow icon={FileText} label="Situação" value={situacao} />
            </div>
          </div>

          {fullAccess && bombeiro.dataDesligamento && (
            <>
              <div className="border-t border-graphite-200 dark:border-border-dark" />
              <div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-alert-red">Desligamento</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <InfoRow icon={Calendar} label="Data de Desligamento" value={formatDate(bombeiro.dataDesligamento)} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function APOCDetailModal({ apoc, onClose }: { apoc: APOC; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 pt-10 pb-10" onClick={onClose}>
      <div className="relative w-full max-w-xl rounded-2xl bg-white/95 shadow-2xl shadow-black/5 backdrop-blur-sm dark:bg-surface-elevated/95 dark:shadow-black/20" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-graphite-200 px-6 py-4 dark:border-border-dark">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-aviation-500 to-aviation-700 text-sm font-bold text-white shadow-lg shadow-aviation-500/20">
              <Radio className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-graphite-900 dark:text-graphite-100">{capitalize(apoc.nomeCompleto)}</h2>
              <p className="text-sm text-graphite-500">{capitalize(apoc.nomeGuerra)}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl p-1.5 text-graphite-400 transition-all duration-200 hover:bg-graphite-100 hover:text-graphite-600 dark:hover:bg-surface-hover dark:hover:text-graphite-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-aviation-600 dark:text-aviation-400">Dados do APOC</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <InfoRow icon={User} label="Nome Completo" value={capitalize(apoc.nomeCompleto)} />
              <InfoRow icon={User} label="Nome de Guerra" value={capitalize(apoc.nomeGuerra)} />
              <InfoRow icon={Mail} label="E-mail" value={apoc.email} />
              <InfoRow icon={Radio} label="Função" value={apoc.funcao} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const TABS: { key: Tab; label: string; icon: any }[] = [
  { key: 'todos', label: 'Todos', icon: Users },
  { key: 'bombeiros', label: 'Bombeiros', icon: Shield },
  { key: 'apoc', label: 'APOC', icon: Radio },
];

export function Funcionarios() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('todos');
  const [termo, setTermo] = useState('');
  const [filterEquipe, setFilterEquipe] = useState('');
  const [filterCargo, setFilterCargo] = useState('');
  const [selecionado, setSelecionado] = useState<Bombeiro | APOC | null>(null);
  const [tipoSelecionado, setTipoSelecionado] = useState<'bombeiro' | 'apoc'>('bombeiro');
  const [canViewFullDetails, setCanViewFullDetails] = useState(() => podeVerDetalhesCompletosBase(user));

  const [allBombeiros, setAllBombeiros] = useState<Bombeiro[]>([]);
  const [allApocs, setAllApocs] = useState<APOC[]>([]);
  const [substituicoes, setSubstituicoes] = useState<SubstituicaoTemporaria[]>([]);
  const [bombeiros, setBombeiros] = useState<Bombeiro[]>([]);
  const [apocs, setApocs] = useState<APOC[]>([]);

  const debouncedTermo = useDebounce(termo, 400);

  useEffect(() => {
    let cancelled = false;
    setCanViewFullDetails(podeVerDetalhesCompletosBase(user));

    resolverContextoOperacional(user)
      .then(contexto => {
        if (!cancelled) setCanViewFullDetails(canAcessarDadosPessoais(contexto) || contexto.equipe === 'Embaixador');
      })
      .catch(() => {
        if (!cancelled) setCanViewFullDetails(podeVerDetalhesCompletosBase(user));
      });

    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    async function load() {
      const [bombeirosData, substituicoesData] = await Promise.all([
        canViewFullDetails ? listarBombeiros() : listarBombeirosPublico(),
        listarSubstituicoesTemporarias(),
      ]);
      setAllBombeiros(bombeirosData);
      setSubstituicoes(substituicoesData);
    }
    load();
  }, [canViewFullDetails]);

  useEffect(() => {
    async function load() {
      setAllApocs(await (canViewFullDetails ? listarAPOCs() : listarAPOCsPublico()));
    }
    load();
  }, [canViewFullDetails]);

  useEffect(() => {
    async function load() {
      let lista = debouncedTermo
        ? await (canViewFullDetails ? buscarBombeiro(debouncedTermo) : buscarBombeiroPublico(debouncedTermo))
        : allBombeiros;
      if (filterEquipe) lista = lista.filter(b => b.equipe === filterEquipe);
      if (filterCargo) lista = lista.filter(b => b.cargo === filterCargo);
      setBombeiros(lista);
    }
    load();
  }, [debouncedTermo, filterEquipe, filterCargo, allBombeiros, canViewFullDetails]);

  useEffect(() => {
    async function load() {
      if (!debouncedTermo) {
        setApocs(allApocs);
        return;
      }
      setApocs(await (canViewFullDetails ? buscarAPOC(debouncedTermo) : buscarAPOCPublico(debouncedTermo)));
    }
    load();
  }, [debouncedTermo, allApocs, canViewFullDetails]);

  const filteredBombeiros = tab === 'apoc' ? [] : bombeiros;
  const filteredApocs = tab === 'bombeiros' ? [] : apocs;
  const totalRegistros = filteredBombeiros.length + filteredApocs.length;
  const afastamentosAtivos = useMemo(() => {
    const hoje = hojeLocalISO();
    return new Set(substituicoes
      .filter(s => s.tipo === 'Afastamento' && s.status === 'Aprovada' && s.dataInicio <= hoje && s.dataFim >= hoje)
      .map(s => s.funcionarioId));
  }, [substituicoes]);

  function situacaoBombeiro(bombeiro: Bombeiro): SituacaoBombeiro {
    if (bombeiro.dataDesligamento) return 'Desligado';
    if (afastamentosAtivos.has(bombeiro.id)) return 'Afastado';
    return 'Ativo';
  }

  function getTabCount(key: Tab): number {
    if (key === 'todos') return allBombeiros.length + allApocs.length;
    if (key === 'bombeiros') return allBombeiros.length;
    return allApocs.length;
  }

  function handleSelectBombeiro(b: Bombeiro) {
    setSelecionado(b);
    setTipoSelecionado('bombeiro');
  }

  function handleSelectApoc(a: APOC) {
    if (!canViewFullDetails) return;
    setSelecionado(a);
    setTipoSelecionado('apoc');
  }

  return (
    <PageContainer>
      <div className="mb-6 flex items-center justify-between">
        <PageTitle icon={Users} title="Funcionários" />
      </div>

      {tab !== 'substituicoes' && (
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite-400" />
              <input
                type="text"
                value={termo}
                onChange={e => setTermo(e.target.value)}
                placeholder="Pesquisar por matrícula, nome ou equipe..."
                className="w-full rounded-xl border border-graphite-300/60 bg-white/70 py-2.5 pl-10 pr-4 text-sm text-graphite-900 placeholder-graphite-400 outline-none transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-graphite-600 dark:bg-graphite-800 dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-graphite-700"
              />
            </div>
            {(tab === 'todos' || tab === 'bombeiros') && (
              <>
                <select
                  value={filterEquipe}
                  onChange={e => setFilterEquipe(e.target.value)}
                  className="rounded-xl border border-graphite-300/60 bg-white/70 px-3 py-2.5 text-sm text-graphite-700 outline-none transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-graphite-600 dark:bg-graphite-800 dark:text-graphite-200 dark:focus:border-aviation-400/50 dark:focus:bg-graphite-700 dark:focus:text-graphite-100 dark:scheme-dark"
                >
                  <option value="">Todas as Equipes</option>
                  {EQUIPE_OPTIONS.map(e => <option key={e} value={e} className="dark:bg-graphite-700 dark:text-graphite-100">{e}</option>)}
                </select>
                <select
                  value={filterCargo}
                  onChange={e => setFilterCargo(e.target.value)}
                  className="rounded-xl border border-graphite-300/60 bg-white/70 px-3 py-2.5 text-sm text-graphite-700 outline-none transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-graphite-600 dark:bg-graphite-800 dark:text-graphite-200 dark:focus:border-aviation-400/50 dark:focus:bg-graphite-700 dark:focus:text-graphite-100 dark:scheme-dark"
                >
                  <option value="">Todos os Cargos</option>
                  {CARGO_OPTIONS.map(o => <option key={o.value} value={o.value} className="dark:bg-graphite-700 dark:text-graphite-100">{o.label}</option>)}
                </select>
              </>
            )}
          </div>
        </div>
      )}

      <div className="mb-6 flex items-center gap-1 rounded-xl border border-graphite-200/60 bg-graphite-50/80 p-1 dark:border-border-dark dark:bg-surface-card/50">
        {TABS.map(t => {
          const Icon = t.icon;
          const count = getTabCount(t.key);
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
                tab === t.key
                  ? 'bg-white text-aviation-700 shadow-sm dark:bg-graphite-900 dark:text-aviation-300'
                  : 'text-graphite-500 hover:text-graphite-700 dark:text-graphite-400 dark:hover:text-graphite-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
              <span className={`ml-1 rounded-full px-1.5 py-0.5 text-xs ${
                tab === t.key
                  ? 'bg-aviation-100 text-aviation-700 dark:bg-aviation-900/40 dark:text-aviation-300'
                  : 'bg-graphite-200/60 text-graphite-500 dark:bg-surface-hover/40 dark:text-graphite-400'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {totalRegistros === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300/60 bg-white/50 p-12 text-center backdrop-blur-sm dark:border-border-dark dark:bg-surface-card">
          <Users className="mb-4 h-12 w-12 text-graphite-300 dark:text-graphite-600" />
          <h3 className="mb-2 text-lg font-semibold text-graphite-700 dark:text-graphite-300">
            Nenhum funcionário encontrado
          </h3>
          <p className="text-sm text-graphite-400">
            {tab === 'apoc'
              ? 'Nenhum membro do APOC cadastrado ainda.'
              : tab === 'bombeiros'
                ? 'Nenhum bombeiro cadastrado ainda.'
                : 'Os funcionários cadastrados nos módulos de Bombeiros e APOC aparecerão aqui.'
            }
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredBombeiros.length > 0 && (tab === 'todos' || tab === 'bombeiros') && (
            <div>
              {tab === 'todos' && (
                <div className="mb-3 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-aviation-600 dark:text-aviation-400" />
                  <h3 className="text-sm font-semibold text-graphite-700 dark:text-graphite-300">
                    Bombeiros ({filteredBombeiros.length})
                  </h3>
                </div>
              )}
              <div className="overflow-x-auto rounded-2xl border border-graphite-200/60 bg-white/80 backdrop-blur-sm dark:border-border-dark dark:bg-surface-card">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-graphite-200 bg-graphite-50 text-left dark:border-border-dark dark:bg-surface-card">
                      <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Matrícula</th>
                      <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Nome</th>
                      <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Nome de Guerra</th>
                      {canViewFullDetails && <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">E-mail</th>}
                      <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Cargo</th>
                      <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Equipe</th>
                      <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Turno</th>
                      <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBombeiros.map(b => {
                      const situacao = situacaoBombeiro(b);
                      return (
                        <tr
                          key={b.id}
                          onClick={() => handleSelectBombeiro(b)}
                          className="cursor-pointer border-b border-graphite-100 transition-colors hover:bg-aviation-50/50 dark:border-border-dark dark:hover:bg-aviation-900/20"
                        >
                          <td className="px-4 py-3 font-medium text-graphite-900 dark:text-graphite-100">{b.matricula}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {b.foto && (
                                <img src={b.foto} alt="" className="h-8 w-8 rounded-full object-cover" />
                              )}
                              <span className="text-graphite-700 dark:text-graphite-300">{capitalize(b.nomeCompleto)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-graphite-700 dark:text-graphite-300">{capitalize(b.nomeGuerra)}</td>
                          {canViewFullDetails && <td className="px-4 py-3 text-xs text-graphite-500 dark:text-graphite-400">{b.email || '-'}</td>}
                          <td className="px-4 py-3 text-graphite-700 dark:text-graphite-300">{labelCargo(b.cargo)}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex rounded-full bg-aviation-50 px-2.5 py-0.5 text-xs font-medium text-aviation-700 dark:bg-aviation-900/30 dark:text-aviation-300">
                              {b.equipe}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-graphite-700 dark:text-graphite-300">{b.turno}</td>
                          <td className="px-4 py-3">
                            <SituacaoBadge situacao={situacao} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {filteredApocs.length > 0 && (tab === 'todos' || tab === 'apoc') && (
            <div>
              {tab === 'todos' && (
                <div className="mb-3 flex items-center gap-2">
                  <Radio className="h-4 w-4 text-aviation-600 dark:text-aviation-400" />
                  <h3 className="text-sm font-semibold text-graphite-700 dark:text-graphite-300">
                    APOC ({filteredApocs.length})
                  </h3>
                </div>
              )}
              <div className="overflow-x-auto rounded-2xl border border-graphite-200/60 bg-white/80 backdrop-blur-sm dark:border-border-dark dark:bg-surface-card">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-graphite-200 bg-graphite-50 text-left dark:border-border-dark dark:bg-surface-card">
                      <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Nome de Guerra</th>
                      <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Nome Completo</th>
                      {canViewFullDetails && <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">E-mail</th>}
                      <th className="px-4 py-3 font-semibold text-graphite-600 dark:text-graphite-300">Função</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredApocs.map(a => (
                      <tr
                        key={a.id}
                        onClick={canViewFullDetails ? () => handleSelectApoc(a) : undefined}
                        className={`border-b border-graphite-100 transition-colors dark:border-border-dark ${
                          canViewFullDetails
                            ? 'cursor-pointer hover:bg-aviation-50/50 dark:hover:bg-aviation-900/20'
                            : 'cursor-default'
                        }`}
                      >
                        <td className="px-4 py-3 font-medium text-graphite-900 dark:text-graphite-100">{capitalize(a.nomeGuerra)}</td>
                        <td className="px-4 py-3 text-graphite-700 dark:text-graphite-300">{capitalize(a.nomeCompleto)}</td>
                        {canViewFullDetails && <td className="px-4 py-3 text-graphite-700 dark:text-graphite-300">{a.email}</td>}
                        <td className="px-4 py-3">
                          <span className="inline-flex rounded-full bg-aviation-50 px-2.5 py-0.5 text-xs font-medium text-aviation-700 dark:bg-aviation-900/30 dark:text-aviation-300">
                            {a.funcao}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {selecionado && tipoSelecionado === 'bombeiro' && (
        <BombeiroDetailModal
          bombeiro={selecionado as Bombeiro}
          situacao={situacaoBombeiro(selecionado as Bombeiro)}
          fullAccess={canViewFullDetails}
          onClose={() => setSelecionado(null)}
        />
      )}
      {canViewFullDetails && selecionado && tipoSelecionado === 'apoc' && (
        <APOCDetailModal apoc={selecionado as APOC} onClose={() => setSelecionado(null)} />
      )}
      <PageTour
        steps={FUNCIONARIOS_TOUR_STEPS}
        targetAttribute="data-funcionarios-tour"
        title="Abrir tutorial de Funcionários"
        detailLabel="Consulta"
      />
    </PageContainer>
  );
}

export default Funcionarios;
