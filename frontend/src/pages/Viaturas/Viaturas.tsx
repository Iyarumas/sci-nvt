import { useState, useEffect, useMemo } from 'react';
import { Truck, Search, Plus, Pencil, Trash2, X, Save } from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';
import { useAuth } from '../../context/AuthContext';
import { listarViaturas, criarViatura, atualizarViatura, excluirViatura } from '../../services/viaturaService';
import type { Viatura, StatusViatura, TipoViatura, TipoCCI, CategoriaCAT, SistemaRadio, SistemaSinalizacao } from '../../types/viatura';
import { TIPO_VIATURA_OPTIONS, STATUS_VIATURA_OPTIONS, TIPO_CCI_OPTIONS, CATEGORIA_CAT_OPTIONS, SISTEMA_RADIO_OPTIONS, SISTEMA_SINALIZACAO_OPTIONS } from '../../types/viatura';
import { useDebounce } from '../../hooks/useDebounce';
import { canGerenciarCadastroModulo, resolverContextoOperacional } from '../../utils/permissoes';
import { PageTour } from '../../components/ui/PageTour';

function statusColor(s: StatusViatura) {
  return STATUS_VIATURA_OPTIONS.find(o => o.value === s)?.color || '';
}

const inputCls = 'w-full rounded-xl border border-graphite-300 bg-white px-3 py-2.5 text-sm text-graphite-900 transition-all hover:border-graphite-400 focus:border-aviation-500 focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400 dark:focus:ring-aviation-400/10';
const labelCls = 'mb-1 block text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400';

const VIATURAS_CADASTRO_TOUR_STEPS = [
  {
    selector: 'main h1',
    title: 'Cadastro de viaturas',
    body: 'Esta tela cadastra as viaturas CCI e demais veículos, com prefixo, placa, tipo, CAT, status, marca, modelo e dados técnicos.',
    detail: 'O cadastro técnico é separado da tela Viaturas CCI, que acompanha panes e histórico. Aqui você mantém a ficha da viatura atualizada.',
  },
  {
    selector: 'main button',
    title: 'Nova viatura',
    body: 'O botão Nova Viatura abre o formulário completo da viatura.',
    detail: 'Para CCI, preencha capacidade de água, LGE, pó químico, bomba, canhões, autoproteção, carretéis, rádio, sinalização, km e horas de motor quando disponíveis.',
  },
  {
    selector: 'main input, main select',
    title: 'Pesquisa e tipo',
    body: 'A busca encontra prefixo, placa, marca ou modelo. O filtro de tipo separa CCI de outros veículos cadastrados.',
    detail: 'Quando quiser revisar somente as viaturas de combate, filtre por CCI e confira também o status para identificar veículo operacional ou fora de serviço.',
  },
  {
    selector: 'main .space-y-3',
    title: 'Cards das viaturas',
    body: 'Os cards mostram prefixo, tipo, tipo CCI, status, placa, marca, modelo, ano e, quando for CCI, capacidades e componentes principais.',
    detail: 'Esses dados ajudam a equipe a conferir rapidamente a viatura correta e seus recursos principais antes de registros ou inspeções.',
  },
  {
    selector: 'main .space-y-3 button, main button',
    title: 'Edição e exclusão',
    body: 'Nos cards, o lápis edita a viatura e a lixeira exclui, conforme a permissão do usuário.',
    detail: 'Use edição para atualizar km, horas de motor, status e dados técnicos. Excluir deve ser reservado para cadastro duplicado ou registro criado por engano.',
  },
];

export function Viaturas() {
  const { user } = useAuth();
  const [lista, setLista] = useState<Viatura[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [termo, setTermo] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<Viatura | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const debouncedTermo = useDebounce(termo, 400);

  useEffect(() => { listarViaturas().then(setLista); }, []);

  useEffect(() => {
    let cancelled = false;
    resolverContextoOperacional(user)
      .then(contexto => {
        if (!cancelled) setCanManage(canGerenciarCadastroModulo(contexto, 'viaturas'));
      })
      .catch(() => {
        if (!cancelled) setCanManage(false);
      });
    return () => { cancelled = true; };
  }, [user]);

  const filtrados = useMemo(() => lista.filter(v => {
    const mt = !debouncedTermo || v.prefixo.toLowerCase().includes(debouncedTermo.toLowerCase()) || v.placa.toLowerCase().includes(debouncedTermo.toLowerCase()) || v.marca.toLowerCase().includes(debouncedTermo.toLowerCase()) || v.modelo.toLowerCase().includes(debouncedTermo.toLowerCase());
    const mf = !filterTipo || v.tipo === filterTipo;
    return mt && mf;
  }), [lista, debouncedTermo, filterTipo]);

  const emptyForm = useMemo(() => ({
    prefixo: '', placa: '', renavam: '', tipo: 'CCI' as TipoViatura, tipoCCI: 'CCI-2' as TipoCCI, categoriaCAT: 'CAT A' as CategoriaCAT,
    status: 'Operacional' as StatusViatura, marca: '', modelo: '', ano: '', quilometragem: '', horasMotor: '',
    cartaoCombustivel: '', capacidadeAgua: '', capacidadeLGE: '', moduloPQuimico: '', bombaModelo: '', bombaVazao: '',
    canhaoTetoModelo: '', canhaoTetoAlcance: '', canhaoTetoVazao: '', canhaoParachoqueModelo: '', canhaoParachoqueAlcance: '', canhaoParachoqueVazao: '',
    autoprotecaoQtd: '', autoprotecaoLocal: '', carreteisQtd: '', proporcionalidade: '', radioSistema: 'UHF' as SistemaRadio,
    giroflexSirene: 'Funcional' as SistemaSinalizacao, observacoes: '', fotoUrl: '', manualUrl: '', createdBy: '',
  } as Omit<Viatura, 'id' | 'createdAt' | 'updatedAt'>), []);

  const [form, setForm] = useState(emptyForm);

  function openNew() {
    if (!canManage) return;
    setEditando(null);
    setForm({ ...emptyForm });
    setFormOpen(true);
  }

  function openEdit(v: Viatura) {
    if (!canManage) return;
    setEditando(v);
    setForm({
      prefixo: v.prefixo, placa: v.placa, renavam: v.renavam, tipo: v.tipo, tipoCCI: v.tipoCCI, categoriaCAT: v.categoriaCAT,
      status: v.status, marca: v.marca, modelo: v.modelo, ano: v.ano, quilometragem: v.quilometragem, horasMotor: v.horasMotor,
      cartaoCombustivel: v.cartaoCombustivel, capacidadeAgua: v.capacidadeAgua, capacidadeLGE: v.capacidadeLGE, moduloPQuimico: v.moduloPQuimico,
      bombaModelo: v.bombaModelo, bombaVazao: v.bombaVazao, canhaoTetoModelo: v.canhaoTetoModelo, canhaoTetoAlcance: v.canhaoTetoAlcance,
      canhaoTetoVazao: v.canhaoTetoVazao, canhaoParachoqueModelo: v.canhaoParachoqueModelo, canhaoParachoqueAlcance: v.canhaoParachoqueAlcance,
      canhaoParachoqueVazao: v.canhaoParachoqueVazao, autoprotecaoQtd: v.autoprotecaoQtd, autoprotecaoLocal: v.autoprotecaoLocal,
      carreteisQtd: v.carreteisQtd, proporcionalidade: v.proporcionalidade, radioSistema: v.radioSistema, giroflexSirene: v.giroflexSirene,
      observacoes: v.observacoes, fotoUrl: v.fotoUrl, manualUrl: v.manualUrl, createdBy: '',
    });
    setFormOpen(true);
  }

  async function handleSave() {
    if (!canManage) return;
    setSaving(true);
    try {
      if (editando) {
        await atualizarViatura(editando.id, form);
      } else {
        await criarViatura({ ...form, createdBy: user?.username || '' });
      }
      setFormOpen(false);
      setLista(await listarViaturas());
    } catch { alert('Erro ao salvar'); } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!canManage) return;
    try {
      await excluirViatura(id);
      setConfirmDelete(null);
      setLista(await listarViaturas());
    } catch (err) {
      alert('Erro ao excluir: ' + (err instanceof Error ? err.message : 'Erro desconhecido'));
    }
  }

  return (
    <PageContainer>
      <div className="mb-6 flex items-center justify-between">
        <PageTitle icon={Truck} title="Viaturas CCI" />
        {canManage && (
          <button onClick={openNew} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all hover:shadow-xl active:scale-[0.98]">
            <Plus className="h-4 w-4" /> Nova Viatura
          </button>
        )}
      </div>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite-400" />
          <input value={termo} onChange={e => setTermo(e.target.value)} placeholder="Pesquisar por prefixo, placa, marca..." className="w-full rounded-xl border border-graphite-300/60 bg-white/70 py-2.5 pl-10 pr-4 text-sm outline-none dark:border-graphite-600 dark:bg-graphite-800 dark:text-graphite-100" />
        </div>
        <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)} className="rounded-xl border border-graphite-300/60 bg-white/70 px-3 py-2.5 text-sm dark:border-graphite-600 dark:bg-graphite-800 dark:text-graphite-200">
          <option value="">Todos os Tipos</option>
          {TIPO_VIATURA_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <span className="text-sm text-graphite-500">{filtrados.length} viatura(s)</span>
      </div>

      {filtrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300 bg-white/50 p-12 text-center dark:border-border-dark dark:bg-surface-card">
          <Truck className="mb-4 h-12 w-12 text-graphite-300 dark:text-graphite-600" />
          <h3 className="text-lg font-semibold text-graphite-700 dark:text-graphite-300">Nenhuma viatura encontrada</h3>
        </div>
      ) : (
        <div className="space-y-3">
          {filtrados.map(v => (
            <div key={v.id} className="rounded-2xl border border-graphite-200 bg-white/80 p-4 transition-all hover:shadow-md dark:border-border-dark dark:bg-surface-card">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {v.fotoUrl ? (
                    <img src={v.fotoUrl} alt={v.prefixo} className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-graphite-100 to-graphite-200 dark:from-graphite-700 dark:to-graphite-800">
                      <Truck className="h-7 w-7 text-graphite-400" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-bold text-graphite-900 dark:text-graphite-100">{v.prefixo}</h3>
                      <span className="rounded-full bg-aviation-50 px-2 py-0.5 text-xs font-medium text-aviation-700 dark:bg-aviation-900/30 dark:text-aviation-300">{v.tipo}</span>
                      {v.tipo === 'CCI' && <span className="rounded-full bg-graphite-100 px-2 py-0.5 text-xs font-medium dark:bg-graphite-700 dark:text-graphite-300">{v.tipoCCI}</span>}
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(v.status)}`}>{v.status}</span>
                    </div>
                    <p className="text-sm text-graphite-500 dark:text-graphite-400">{v.placa ? `Placa: ${v.placa}` : ''}{v.marca ? ` · ${v.marca} ${v.modelo}` : ''}{v.ano ? ` · ${v.ano}` : ''}</p>
                  </div>
                </div>
                {canManage && (
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEdit(v)} className="rounded-xl p-1.5 text-graphite-400 hover:bg-graphite-100 hover:text-graphite-600 dark:hover:bg-surface-hover"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => setConfirmDelete(v.id)} className="rounded-xl p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"><Trash2 className="h-4 w-4" /></button>
                  </div>
                )}
              </div>
              {v.tipo === 'CCI' && (
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-graphite-500 dark:text-graphite-400">
                  {v.capacidadeAgua && <span>Água: {v.capacidadeAgua}L</span>}
                  {v.capacidadeLGE && <span>· LGE: {v.capacidadeLGE}L</span>}
                  {v.moduloPQuimico && <span>· Pó: {v.moduloPQuimico}kg</span>}
                  {v.bombaModelo && <span>· Bomba: {v.bombaModelo}</span>}
                  {v.quilometragem && <span>· {v.quilometragem} km</span>}
                  {v.horasMotor && <span>· {v.horasMotor}h motor</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 py-8">
          <div className="relative w-full max-w-3xl mx-4 rounded-2xl bg-white shadow-2xl dark:bg-surface-elevated">
            <div className="flex items-center justify-between border-b border-graphite-200 px-6 py-4 dark:border-border-dark">
              <h2 className="text-lg font-bold text-graphite-900 dark:text-graphite-100">{editando ? 'Editar' : 'Nova'} Viatura</h2>
              <button onClick={() => setFormOpen(false)} className="rounded-xl p-1.5 text-graphite-400 hover:bg-graphite-100 dark:hover:bg-surface-hover"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-5 p-6 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div><label className={labelCls}>Prefixo *</label><input value={form.prefixo} onChange={e => setForm(p => ({ ...p, prefixo: e.target.value }))} placeholder="Ex: CCI-02" className={inputCls} /></div>
                <div><label className={labelCls}>Placa</label><input value={form.placa} onChange={e => setForm(p => ({ ...p, placa: e.target.value }))} className={inputCls} /></div>
                <div><label className={labelCls}>Renavam</label><input value={form.renavam} onChange={e => setForm(p => ({ ...p, renavam: e.target.value }))} className={inputCls} /></div>
                <div><label className={labelCls}>Tipo</label><select value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value as TipoViatura }))} className={inputCls}>{TIPO_VIATURA_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                {form.tipo === 'CCI' && <div><label className={labelCls}>Tipo CCI</label><select value={form.tipoCCI} onChange={e => setForm(p => ({ ...p, tipoCCI: e.target.value as TipoCCI }))} className={inputCls}>{TIPO_CCI_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}</select></div>}
                <div><label className={labelCls}>Categoria CAT</label><select value={form.categoriaCAT} onChange={e => setForm(p => ({ ...p, categoriaCAT: e.target.value as CategoriaCAT }))} className={inputCls}>{CATEGORIA_CAT_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                <div><label className={labelCls}>Status</label><select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as StatusViatura }))} className={inputCls}>{STATUS_VIATURA_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
                <div><label className={labelCls}>Marca</label><input value={form.marca} onChange={e => setForm(p => ({ ...p, marca: e.target.value }))} className={inputCls} /></div>
                <div><label className={labelCls}>Modelo</label><input value={form.modelo} onChange={e => setForm(p => ({ ...p, modelo: e.target.value }))} className={inputCls} /></div>
                <div><label className={labelCls}>Ano</label><input value={form.ano} onChange={e => setForm(p => ({ ...p, ano: e.target.value }))} className={inputCls} /></div>
                <div><label className={labelCls}>Km</label><input value={form.quilometragem} onChange={e => setForm(p => ({ ...p, quilometragem: e.target.value }))} className={inputCls} /></div>
                <div><label className={labelCls}>Horas Motor</label><input value={form.horasMotor} onChange={e => setForm(p => ({ ...p, horasMotor: e.target.value }))} className={inputCls} /></div>
                <div><label className={labelCls}>Cartão Combustível</label><input value={form.cartaoCombustivel} onChange={e => setForm(p => ({ ...p, cartaoCombustivel: e.target.value }))} className={inputCls} /></div>
              </div>
              {form.tipo === 'CCI' && (
                <>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-aviation-600">Especificações Técnicas CCI</h4>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div><label className={labelCls}>Capacidade Água (L)</label><input value={form.capacidadeAgua} onChange={e => setForm(p => ({ ...p, capacidadeAgua: e.target.value }))} className={inputCls} /></div>
                    <div><label className={labelCls}>Capacidade LGE (L)</label><input value={form.capacidadeLGE} onChange={e => setForm(p => ({ ...p, capacidadeLGE: e.target.value }))} className={inputCls} /></div>
                    <div><label className={labelCls}>Módulo Pó Químico</label><input value={form.moduloPQuimico} onChange={e => setForm(p => ({ ...p, moduloPQuimico: e.target.value }))} className={inputCls} /></div>
                    <div><label className={labelCls}>Bomba Modelo</label><input value={form.bombaModelo} onChange={e => setForm(p => ({ ...p, bombaModelo: e.target.value }))} className={inputCls} /></div>
                    <div><label className={labelCls}>Bomba Vazão</label><input value={form.bombaVazao} onChange={e => setForm(p => ({ ...p, bombaVazao: e.target.value }))} className={inputCls} /></div>
                    <div><label className={labelCls}>Canhão Teto Modelo</label><input value={form.canhaoTetoModelo} onChange={e => setForm(p => ({ ...p, canhaoTetoModelo: e.target.value }))} className={inputCls} /></div>
                    <div><label className={labelCls}>Canhão Teto Alcance</label><input value={form.canhaoTetoAlcance} onChange={e => setForm(p => ({ ...p, canhaoTetoAlcance: e.target.value }))} className={inputCls} /></div>
                    <div><label className={labelCls}>Canhão Teto Vazão</label><input value={form.canhaoTetoVazao} onChange={e => setForm(p => ({ ...p, canhaoTetoVazao: e.target.value }))} className={inputCls} /></div>
                    <div><label className={labelCls}>Canhão Parach. Modelo</label><input value={form.canhaoParachoqueModelo} onChange={e => setForm(p => ({ ...p, canhaoParachoqueModelo: e.target.value }))} className={inputCls} /></div>
                    <div><label className={labelCls}>Canhão Parach. Alcance</label><input value={form.canhaoParachoqueAlcance} onChange={e => setForm(p => ({ ...p, canhaoParachoqueAlcance: e.target.value }))} className={inputCls} /></div>
                    <div><label className={labelCls}>Canhão Parach. Vazão</label><input value={form.canhaoParachoqueVazao} onChange={e => setForm(p => ({ ...p, canhaoParachoqueVazao: e.target.value }))} className={inputCls} /></div>
                    <div><label className={labelCls}>Autoproteção Qtd</label><input value={form.autoprotecaoQtd} onChange={e => setForm(p => ({ ...p, autoprotecaoQtd: e.target.value }))} className={inputCls} /></div>
                    <div><label className={labelCls}>Autoproteção Local</label><input value={form.autoprotecaoLocal} onChange={e => setForm(p => ({ ...p, autoprotecaoLocal: e.target.value }))} className={inputCls} /></div>
                    <div><label className={labelCls}>Carretéis Qtd</label><input value={form.carreteisQtd} onChange={e => setForm(p => ({ ...p, carreteisQtd: e.target.value }))} className={inputCls} /></div>
                    <div><label className={labelCls}>Proporcionalidade</label><input value={form.proporcionalidade} onChange={e => setForm(p => ({ ...p, proporcionalidade: e.target.value }))} className={inputCls} /></div>
                  </div>
                </>
              )}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div><label className={labelCls}>Sistema de Rádio</label><select value={form.radioSistema} onChange={e => setForm(p => ({ ...p, radioSistema: e.target.value as SistemaRadio }))} className={inputCls}>{SISTEMA_RADIO_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
                <div><label className={labelCls}>Giroflex/Sirene</label><select value={form.giroflexSirene} onChange={e => setForm(p => ({ ...p, giroflexSirene: e.target.value as SistemaSinalizacao }))} className={inputCls}>{SISTEMA_SINALIZACAO_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
              </div>
              <div><label className={labelCls}>Observações</label><textarea value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} rows={3} className={inputCls} /></div>
            </div>
            <div className="flex justify-end gap-3 border-t border-graphite-200 px-6 py-4 dark:border-border-dark">
              <button onClick={() => setFormOpen(false)} className="rounded-xl border border-graphite-300 bg-white px-4 py-2.5 text-sm font-medium text-graphite-700 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200">Cancelar</button>
              <button onClick={handleSave} disabled={!form.prefixo || saving} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg disabled:opacity-50"><Save className="h-4 w-4" /> Salvar</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-surface-elevated">
            <h3 className="mb-2 text-lg font-bold text-graphite-900 dark:text-graphite-100">Confirmar exclusão</h3>
            <p className="mb-6 text-sm text-graphite-500">Tem certeza que deseja excluir esta viatura?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(null)} className="rounded-xl border border-graphite-300 bg-white px-4 py-2.5 text-sm font-medium text-graphite-700 dark:bg-surface-card">Cancelar</button>
              <button onClick={() => handleDelete(confirmDelete)} className="rounded-xl bg-gradient-to-r from-alert-red to-red-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg">Excluir</button>
            </div>
          </div>
        </div>
      )}
      <PageTour
        steps={VIATURAS_CADASTRO_TOUR_STEPS}
        targetAttribute="data-viaturas-cadastro-tour"
        title="Abrir tutorial de Cadastro de Viaturas"
        detailLabel="Ficha da viatura"
      />
    </PageContainer>
  );
}

export default Viaturas;
