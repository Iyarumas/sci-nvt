import { useState } from 'react';
import { Settings, Sun, Moon, Sidebar, PanelRight, MonitorSmartphone } from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';
import { PageTour } from '../../components/ui/PageTour';
import { useTheme } from '../../hooks/useTheme';

const CONFIGURACOES_TOUR_STEPS = [
  {
    selector: 'main h1',
    title: 'Configurações',
    body: 'Esta página reúne preferências visuais e informações básicas do sistema.',
    detail: 'Ela não é usada para lançar documentos ou dados operacionais. É o lugar para ajustar como a interface aparece para o usuário e conferir versão, ambiente e tema atual.',
  },
  {
    selector: 'main button',
    title: 'Aparência',
    body: 'O primeiro controle alterna entre modo claro e modo escuro.',
    detail: 'Use quando a iluminação do ambiente mudar ou quando preferir uma leitura com mais ou menos contraste. A troca altera a aparência geral das telas do sistema.',
  },
  {
    selector: 'main [class*="grid"] > div:nth-child(2)',
    title: 'Barra lateral',
    body: 'A seção Barra Lateral define como o menu lateral deve se comportar.',
    detail: 'A opção Fixa mantém a navegação sempre visível. A opção Auto-esconder deixa a área de trabalho mais livre e mostra o menu ao passar o mouse, quando esse comportamento estiver ativo na interface.',
  },
  {
    selector: 'main [class*="grid"] > div:nth-child(3)',
    title: 'Estilo dos cartões',
    body: 'Aqui você escolhe o estilo visual usado nos cards da interface.',
    detail: 'Os cartões ajudam a organizar informações como indicadores, listas e blocos de dados. O estilo muda a aparência, mas não altera os registros salvos no sistema.',
  },
  {
    selector: 'main [class*="grid"] > div:nth-child(4)',
    title: 'Informações do sistema',
    body: 'Esta área mostra versão, ambiente e tema atual.',
    detail: 'É útil para suporte e conferência. Se houver dúvida sobre atualização ou comportamento diferente entre desenvolvimento e produção, essas informações ajudam a identificar onde o sistema está rodando.',
  },
];

export function Configuracoes() {
  const { theme, toggleTheme } = useTheme();
  const [sidebarMode, setSidebarMode] = useState<'pinned' | 'peek'>('pinned');
  const [cardStyle, setCardStyle] = useState<'default' | 'glass' | 'bordered'>('default');

  return (
    <PageContainer>
      <PageTitle icon={Settings} title="Configurações" />

      <div className="grid gap-6 md:grid-cols-2">
        {/* Tema */}
        <div className="rounded-2xl border border-graphite-200 bg-white p-6 dark:border-border-dark dark:bg-surface-card">
          <h3 className="mb-4 text-sm font-bold text-graphite-900 dark:text-graphite-100">Aparência</h3>

          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl bg-graphite-50 p-4 dark:bg-surface-hover">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
                  {theme === 'light' ? <Sun className="h-5 w-5 text-amber-600" /> : <Moon className="h-5 w-5 text-amber-400" />}
                </div>
                <div>
                  <p className="text-sm font-bold text-graphite-900 dark:text-graphite-100">Modo {theme === 'light' ? 'Claro' : 'Escuro'}</p>
                  <p className="text-xs text-graphite-500">Alternar entre tema claro e escuro</p>
                </div>
              </div>
              <button onClick={toggleTheme}
                className={`relative h-7 w-12 rounded-full transition-colors ${theme === 'dark' ? 'bg-aviation-600' : 'bg-graphite-300'}`}>
                <span className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${theme === 'dark' ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="rounded-2xl border border-graphite-200 bg-white p-6 dark:border-border-dark dark:bg-surface-card">
          <h3 className="mb-4 text-sm font-bold text-graphite-900 dark:text-graphite-100">Barra Lateral</h3>

          <div className="space-y-3">
            {[
              { value: 'pinned', label: 'Fixa', desc: 'Sidebar sempre visível', icon: Sidebar },
              { value: 'peek', label: 'Auto-esconder', desc: 'Sidebar aparece ao passar o mouse', icon: PanelRight },
            ].map(opt => (
              <button key={opt.value} onClick={() => setSidebarMode(opt.value as 'pinned' | 'peek')}
                className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-all ${
                  sidebarMode === opt.value ? 'border-aviation-400 bg-aviation-50 dark:border-aviation-600 dark:bg-aviation-900/20' : 'border-graphite-200 bg-white dark:border-border-dark dark:bg-surface-card'
                }`}>
                <opt.icon className={`h-5 w-5 ${sidebarMode === opt.value ? 'text-aviation-600' : 'text-graphite-400'}`} />
                <div>
                  <p className={`text-sm font-bold ${sidebarMode === opt.value ? 'text-aviation-700' : 'text-graphite-700'} dark:text-graphite-100`}>{opt.label}</p>
                  <p className="text-xs text-graphite-500">{opt.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Cartões */}
        <div className="rounded-2xl border border-graphite-200 bg-white p-6 dark:border-border-dark dark:bg-surface-card">
          <h3 className="mb-4 text-sm font-bold text-graphite-900 dark:text-graphite-100">Estilo dos Cartões</h3>

          <div className="space-y-3">
            {[
              { value: 'default', label: 'Padrão', desc: 'Cartões com fundo sólido', icon: MonitorSmartphone },
              { value: 'glass', label: 'Vidro', desc: 'Efeito glassmorphism', icon: MonitorSmartphone },
              { value: 'bordered', label: 'Borda destacada', desc: 'Cartões com borda reforçada', icon: MonitorSmartphone },
            ].map(opt => (
              <button key={opt.value} onClick={() => setCardStyle(opt.value as 'default' | 'glass' | 'bordered')}
                className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-all ${
                  cardStyle === opt.value ? 'border-aviation-400 bg-aviation-50 dark:border-aviation-600 dark:bg-aviation-900/20' : 'border-graphite-200 bg-white dark:border-border-dark dark:bg-surface-card'
                }`}>
                <opt.icon className={`h-5 w-5 ${cardStyle === opt.value ? 'text-aviation-600' : 'text-graphite-400'}`} />
                <div>
                  <p className={`text-sm font-bold ${cardStyle === opt.value ? 'text-aviation-700' : 'text-graphite-700'} dark:text-graphite-100`}>{opt.label}</p>
                  <p className="text-xs text-graphite-500">{opt.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Informações */}
        <div className="rounded-2xl border border-graphite-200 bg-white p-6 dark:border-border-dark dark:bg-surface-card">
          <h3 className="mb-4 text-sm font-bold text-graphite-900 dark:text-graphite-100">Informações do Sistema</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between rounded-xl bg-graphite-50 px-4 py-3 dark:bg-surface-hover">
              <span className="text-graphite-600 dark:text-graphite-400">Versão</span>
              <span className="font-bold text-graphite-900 dark:text-graphite-100">v{__APP_VERSION__}</span>
            </div>
            <div className="flex justify-between rounded-xl bg-graphite-50 px-4 py-3 dark:bg-surface-hover">
              <span className="text-graphite-600 dark:text-graphite-400">Ambiente</span>
              <span className="font-bold text-graphite-900 dark:text-graphite-100">{import.meta.env.PROD ? 'Produção' : 'Desenvolvimento'}</span>
            </div>
            <div className="flex justify-between rounded-xl bg-graphite-50 px-4 py-3 dark:bg-surface-hover">
              <span className="text-graphite-600 dark:text-graphite-400">Tema Atual</span>
              <span className="font-bold text-graphite-900 dark:text-graphite-100">{theme === 'light' ? 'Claro' : 'Escuro'}</span>
            </div>
          </div>
        </div>
      </div>

      <PageTour
        steps={CONFIGURACOES_TOUR_STEPS}
        targetAttribute="data-configuracoes-tour"
        title="Abrir tutorial de Configurações"
        detailLabel="Como usar esta página"
      />
    </PageContainer>
  );
}

export default Configuracoes;
