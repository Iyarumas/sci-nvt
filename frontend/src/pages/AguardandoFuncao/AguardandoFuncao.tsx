import { Clock, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function AguardandoFuncao() {
  const navigate = useNavigate();

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div className="mx-4 w-full max-w-md rounded-2xl border border-white/20 bg-white/90 p-8 text-center shadow-2xl backdrop-blur-xl dark:border-graphite-700/50 dark:bg-graphite-900/90">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
          <Clock className="h-10 w-10 text-amber-500" />
        </div>
        <h1 className="mb-3 text-2xl font-bold text-graphite-900 dark:text-graphite-100">
          Aguardando Liberação
        </h1>
        <p className="mb-2 text-sm text-graphite-500">
          Sua conta foi criada com sucesso, mas ainda não foi vinculada a um cadastro.
        </p>
        <p className="mb-8 text-sm text-graphite-500">
          Aguarde o administrador designar uma função a você para acessar o sistema.
        </p>
        <button
          onClick={() => navigate('/login')}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-8 py-3 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all hover:shadow-xl hover:from-aviation-500 hover:to-aviation-600"
        >
          Voltar ao Login <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default AguardandoFuncao;
