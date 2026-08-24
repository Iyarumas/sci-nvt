import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Calendar } from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';
import { EscalaDiariaView } from './EscalaDiaria';
import { EscalaMensal } from './EscalaMensal';

type Tab = 'diaria' | 'mensal';

export function Escalas() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'mensal' ? 'mensal' : 'diaria';
  const [tab, setTab] = useState<Tab>(initialTab);

  useEffect(() => {
    setTab(searchParams.get('tab') === 'mensal' ? 'mensal' : 'diaria');
  }, [searchParams]);

  function handleTabChange(nextTab: Tab) {
    setTab(nextTab);
    setSearchParams({ tab: nextTab });
  }

  return (
    <PageContainer>
      <div className="mb-6">
        <PageTitle icon={Calendar} title="Escalas" />
      </div>

      <div className="mb-6 border-b border-graphite-200 dark:border-border-dark">
        <div className="flex gap-6">
          <button
            onClick={() => handleTabChange('diaria')}
            className={`pb-3 text-sm font-medium transition-colors relative ${
              tab === 'diaria'
                ? 'text-aviation-600 dark:text-aviation-400'
                : 'text-graphite-500 hover:text-graphite-700 dark:hover:text-graphite-300'
            }`}
          >
            Escala Diária
            {tab === 'diaria' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-aviation-600 dark:bg-aviation-400" />
            )}
          </button>
          <button
            onClick={() => handleTabChange('mensal')}
            className={`pb-3 text-sm font-medium transition-colors relative ${
              tab === 'mensal'
                ? 'text-aviation-600 dark:text-aviation-400'
                : 'text-graphite-500 hover:text-graphite-700 dark:hover:text-graphite-300'
            }`}
          >
            Escala Mensal
            {tab === 'mensal' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-aviation-600 dark:bg-aviation-400" />
            )}
          </button>
        </div>
      </div>

      {tab === 'diaria' ? <EscalaDiariaView /> : <EscalaMensal />}
    </PageContainer>
  );
}

export default Escalas;
