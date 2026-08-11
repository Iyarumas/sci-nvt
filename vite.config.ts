import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import pkg from './package.json' with { type: 'json' }

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const autentiqueToken = env.AUTENTIQUE_TOKEN || env.VITE_AUTENTIQUE_TOKEN

  return {
    plugins: [react(), tailwindcss()],
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    build: {
      target: 'es2020',
      sourcemap: false,
      cssMinify: true,
    },
    server: {
      host: true,
      port: 5173,
      proxy: {
        '/api/autentique-proxy': {
          target: 'https://api.sandbox.autentique.com.br',
          changeOrigin: true,
          rewrite: () => '/v2/graphql',
          headers: autentiqueToken ? { Authorization: `Bearer ${autentiqueToken}` } : undefined,
        },
      },
    },
  }
})
