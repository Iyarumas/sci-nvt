import { useState } from 'react';
import { Settings, Sun, Moon, Sidebar, PanelRight, MonitorSmartphone } from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';
import { useTheme } from '../../hooks/useTheme';

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
    </PageContainer>
  );
}

export default Configuracoes;
