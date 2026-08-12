import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username || !password || !confirmPassword) {
      setError('Preencha todos os campos.');
      return;
    }
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não conferem.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await register(username, username, password, 'lider');
      navigate('/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao cadastrar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <div className="flex w-full flex-col justify-center px-6 lg:w-1/2 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl shadow-sm shadow-aviation-500/20">
              <img src="/logobombeiro.jpeg" alt="SCI NVT" className="h-full w-full object-cover" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-graphite-900 dark:text-graphite-100">
SCI NVT
              </h1>
              <p className="text-xs text-graphite-500">
                Sistema de Controle Operacional
              </p>
            </div>
          </div>

          <h2 className="mb-2 text-2xl font-bold text-graphite-900 dark:text-graphite-100">
            Criar conta
          </h2>
          <p className="mb-8 text-sm text-graphite-500">
            Preencha os dados para se cadastrar no sistema.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-graphite-700 dark:text-graphite-300">
                Usuário
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite-400" />
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="seu.usuario"
                  className="w-full rounded-xl border border-graphite-300/60 bg-white/70 py-2.5 pl-10 pr-4 text-sm text-graphite-900 backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-graphite-700 dark:text-graphite-300">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full rounded-xl border border-graphite-300/60 bg-white/70 py-2.5 pl-10 pr-11 text-sm text-graphite-900 backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-graphite-400 hover:text-graphite-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-graphite-700 dark:text-graphite-300">
                Confirmar senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repita a senha"
                  className="w-full rounded-xl border border-graphite-300/60 bg-white/70 py-2.5 pl-10 pr-4 text-sm text-graphite-900 backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated"
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-alert-red">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all duration-200 hover:shadow-xl hover:shadow-aviation-500/30 hover:from-aviation-500 hover:to-aviation-600 disabled:opacity-60 active:scale-[0.98]"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loading ? 'Cadastrando...' : 'Cadastrar'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-graphite-500">
            Já tem conta?{' '}
            <Link to="/login" className="font-medium text-aviation-600 hover:text-aviation-700 dark:text-aviation-400">
              Faça login
            </Link>
          </p>

          <p className="mt-6 text-center text-xs text-graphite-400">
            © 2026 SCI NVT. Todos os direitos reservados.
          </p>
        </div>
      </div>

      <div className="hidden lg:flex lg:w-1/2">
        <div className="relative flex w-full flex-col items-center justify-center overflow-hidden p-16">
          <img src="/entradalogin.jpeg" alt="SCI NVT" className="absolute inset-0 h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-0 bg-black/40" />
          <div className="relative z-10 text-center">
            <h2 className="text-2xl font-bold text-white drop-shadow-lg">
              Junte-se ao SCI NVT
            </h2>
            <p className="mt-4 max-w-md text-white/80 drop-shadow">
              Crie sua conta e tenha acesso a todas as ferramentas de gestão
              operacional do sistema.
            </p>
            <div className="mt-12 grid grid-cols-3 gap-6">
              {['Segurança', 'Tecnologia', 'Eficiência'].map(item => (
                <div
                  key={item}
                  className="flex flex-col items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-6 py-4 backdrop-blur-sm"
                >
                  <span className="text-xs font-medium uppercase tracking-wider text-white">
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
