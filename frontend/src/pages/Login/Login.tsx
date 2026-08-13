import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, User, Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const LOGIN_IMAGES = ['/entradalogin1.png', '/entradalogin2.png', '/entradalogin3.png', '/entradalogin4.png', '/entradalogin5.png'];

export function Login() {
  const bgImage = useMemo(() => LOGIN_IMAGES[Math.floor(Math.random() * LOGIN_IMAGES.length)], []);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const html = document.documentElement;
    const wasDark = html.classList.contains('dark');
    if (wasDark) html.classList.remove('dark');
    return () => { if (wasDark) html.classList.add('dark'); };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username || !password) {
      setError('Preencha todos os campos.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao autenticar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-white">
      <div className="flex w-full flex-col justify-center bg-white px-6 lg:w-2/5 lg:px-12 animate-fadeIn">
        <div className="mx-auto w-full max-w-xs">
          <div className="mb-6 flex items-center gap-3">
            <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl shadow-lg shadow-aviation-500/20">
              <img src="/logobombeiro.jpeg" alt="SCI NVT" className="h-full w-full object-cover" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-graphite-900">
                SCI NVT
              </h1>
              <p className="text-sm font-semibold text-graphite-900">
                Sistema de Controle Operacional
              </p>
            </div>
          </div>

          <div className="animate-slideUp">
            <h2 className="mb-1 text-2xl font-bold text-graphite-900">
              Bem-vindo de volta
            </h2>
            <p className="mb-8 text-sm font-medium text-graphite-900">
              Informe suas credenciais para acessar o sistema.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-bold text-graphite-900">
                  Usuário
                </label>
                <div className="relative group">
                  <User className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-600 transition-colors" />
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="Usuário"
                    className="w-full rounded-xl border border-graphite-400 bg-white py-3 pl-11 pr-4 text-base font-medium text-graphite-900 outline-none placeholder:text-gray-500 hover:border-graphite-500 focus:border-graphite-600 focus:ring-0"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-bold text-graphite-900">
                  Senha
                </label>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-600 transition-colors" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-graphite-400 bg-white py-3 pl-11 pr-11 text-base font-medium text-graphite-900 outline-none placeholder:text-gray-500 hover:border-graphite-500 focus:border-graphite-600 focus:ring-0"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-graphite-900 transition-all duration-200 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="animate-slideUp rounded-xl bg-red-50 px-4 py-3 text-sm text-alert-red">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all duration-200 hover:shadow-xl hover:shadow-aviation-500/30 hover:from-aviation-500 hover:to-aviation-600 active:scale-[0.98] disabled:opacity-60 disabled:hover:shadow-none"
              >
                {loading && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>
          </div>

          <p className="mt-8 text-center text-xs font-medium text-graphite-900 animate-fadeIn">
            © 2026 SCI NVT. Todos os direitos reservados.
          </p>
        </div>
      </div>

      <div className="hidden lg:flex lg:w-3/5">
        <div className="relative flex w-full flex-col items-center justify-center overflow-hidden p-16">
          <img src={bgImage} alt="SCI NVT" className="absolute inset-0 h-full w-full object-cover" style={{ filter: 'contrast(1.05) saturate(1.1)' }} />
          <div className="pointer-events-none absolute inset-0 bg-black/40" />
          <div className="relative z-10 animate-slideUp text-center">
            <h2 className="text-3xl font-bold text-white drop-shadow-lg">
              Centro de Controle<br />Operacional
            </h2>
            <p className="mt-4 max-w-md text-base text-white/80 leading-relaxed drop-shadow">
              Sistema integrado de gestão para monitoramento de viaturas,
              inspeções e controle operacional com padrão de excelência.
            </p>
            <div className="mt-12 flex justify-center gap-4">
              {[
                { label: 'Segurança', desc: 'Monitoramento 24h' },
                { label: 'Tecnologia', desc: 'Sistema integrado' },
                { label: 'Eficiência', desc: 'Gestão otimizada' },
              ].map(item => (
                <div
                  key={item.label}
                  className="group flex flex-1 flex-col items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 py-4 backdrop-blur-sm transition-all duration-300 hover:bg-white/20 hover:border-white/30 hover:shadow-lg hover:shadow-white/10"
                >
                  <span className="text-xs font-semibold uppercase tracking-widest text-white transition-colors group-hover:text-white">
                    {item.label}
                  </span>
                  <span className="text-[10px] text-white/60">{item.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
