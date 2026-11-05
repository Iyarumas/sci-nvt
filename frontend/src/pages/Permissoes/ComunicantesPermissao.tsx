import { useEffect, useMemo, useState } from 'react';
import { Radio, Search } from 'lucide-react';
import { listarBombeiros } from '../../services/bombeiroService';
import { alternarComunicante, listarUsuarios, type Usuario } from '../../services/usuarioService';
import type { Bombeiro } from '../../types/bombeiro';

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Quem é comunicante: entra pela tela "Bem-vindo à Central" e só vê as telas da central
 * (início e fim de plantão, ocorrências, inspeções e solicitações).
 */
export function ComunicantesPermissao() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [bombeiros, setBombeiros] = useState<Bombeiro[]>([]);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [alterando, setAlterando] = useState<string | null>(null);
  const [erro, setErro] = useState('');

  async function carregar() {
    const [lista, pessoas] = await Promise.all([listarUsuarios(), listarBombeiros().catch(() => [] as Bombeiro[])]);
    setUsuarios(lista);
    setBombeiros(pessoas);
  }

  useEffect(() => {
    carregar()
      .catch(err => setErro(err instanceof Error ? err.message : 'Não foi possível carregar os usuários.'))
      .finally(() => setCarregando(false));
  }, []);

  const linhas = useMemo(() => {
    const porId = new Map(bombeiros.map(b => [b.id, b]));
    const termo = normalizar(busca.trim());
    return usuarios
      .filter(u => u.role !== 'desenvolvedor' && u.role !== 'admin' && u.role !== 'sem_funcao')
      .map(u => ({ usuario: u, pessoa: u.personType === 'bombeiro' && u.personId ? porId.get(u.personId) : undefined }))
      .filter(({ usuario, pessoa }) => !termo || normalizar(`${usuario.name} ${usuario.username} ${pessoa?.nomeGuerra ?? ''} ${pessoa?.equipe ?? ''}`).includes(termo))
      .sort((a, b) => Number(b.usuario.role === 'comunicante') - Number(a.usuario.role === 'comunicante')
        || (a.pessoa?.nomeGuerra || a.usuario.name).localeCompare(b.pessoa?.nomeGuerra || b.usuario.name, 'pt-BR'));
  }, [usuarios, bombeiros, busca]);

  const total = usuarios.filter(u => u.role === 'comunicante').length;

  async function alternar(usuario: Usuario) {
    setAlterando(usuario.username);
    setErro('');
    try {
      await alternarComunicante(usuario);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível alterar a permissão.');
    } finally {
      setAlterando(null);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-graphite-200 bg-white p-5 dark:border-border-dark dark:bg-surface-card">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-graphite-900 dark:text-graphite-100">
            <Radio className="h-5 w-5 text-teal-600 dark:text-teal-400" /> Comunicantes
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-graphite-500 dark:text-graphite-400">
            Quem estiver marcado entra pela tela "Bem-vindo à Central" e só vê o início e o fim de plantão,
            as ocorrências, as inspeções e as solicitações. Desmarcando, a pessoa volta para a permissão que tinha antes.
          </p>
        </div>
        <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 dark:bg-teal-900/20 dark:text-teal-300">
          {total} comunicante(s)
        </span>
      </div>

      <label className="relative mb-3 block max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite-400" />
        <input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Pesquisar por nome ou equipe"
          aria-label="Pesquisar usuário"
          className="w-full rounded-xl border border-graphite-300 bg-white py-2 pl-9 pr-3 text-sm dark:border-border-dark dark:bg-surface-card dark:text-graphite-100"
        />
      </label>

      {erro && <p role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">{erro}</p>}

      {carregando ? (
        <p className="py-6 text-center text-sm text-graphite-500">Carregando usuários...</p>
      ) : (
        <ul className="max-h-[28rem] divide-y divide-graphite-100 overflow-y-auto rounded-xl border border-graphite-200 dark:divide-border-dark dark:border-border-dark">
          {linhas.map(({ usuario, pessoa }) => {
            const ativo = usuario.role === 'comunicante';
            return (
              <li key={usuario.username} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-graphite-900 dark:text-graphite-100">
                    {pessoa?.nomeGuerra || usuario.name}
                  </span>
                  <span className="block truncate text-xs text-graphite-500 dark:text-graphite-400">
                    {[pessoa?.cargo, pessoa?.equipe, usuario.username].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={ativo}
                  aria-label={`Comunicante: ${pessoa?.nomeGuerra || usuario.name}`}
                  disabled={alterando === usuario.username}
                  onClick={() => alternar(usuario)}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${ativo ? 'bg-teal-600' : 'bg-graphite-300 dark:bg-graphite-600'}`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${ativo ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </li>
            );
          })}
          {linhas.length === 0 && <li className="px-4 py-6 text-center text-sm text-graphite-500">Nenhum usuário encontrado.</li>}
        </ul>
      )}
    </section>
  );
}
