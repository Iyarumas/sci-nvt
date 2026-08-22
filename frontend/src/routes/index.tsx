import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { Dashboard } from '../pages/Dashboard/Dashboard';
import { Login } from '../pages/Login/Login';
import { ConviteRegister } from '../pages/Login/ConviteRegister';
import { AguardandoFuncao } from '../pages/AguardandoFuncao/AguardandoFuncao';
import { AuthGuard } from '../components/layout/AuthGuard';
import { Loading } from '../components/ui/Loading';

function lazyPage(factory: () => Promise<{ default: React.ComponentType }>) {
  const Lazy = lazy(factory);
  return (
    <Suspense fallback={<Loading />}>
      <Lazy />
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/cadastro/convite/:codigo',
    element: <ConviteRegister />,
  },
  {
    path: '/aguardando-funcao',
    element: <AguardandoFuncao />,
  },
  {
    path: '/os/publica',
    element: lazyPage(() => import('../pages/Relatorios/OrdemServicoPublica')),
  },
  {
    path: '/',
    element: (
      <AuthGuard>
        <Layout />
      </AuthGuard>
    ),
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'cadastro/bombeiros', element: lazyPage(() => import('../pages/Bombeiros/Bombeiros')) },
      { path: 'cadastro/apoc', element: lazyPage(() => import('../pages/APOC/APOCs')) },
      { path: 'cadastro/equipamentos', element: lazyPage(() => import('../pages/Equipamentos/Equipamentos')) },
      { path: 'cadastro/extintores', element: lazyPage(() => import('../pages/Extintores/Extintores')) },
      { path: 'cadastro/agentes-extintores', element: lazyPage(() => import('../pages/AgentesExtintores/AgentesExtintores')) },
      { path: 'cadastro/hidrantes', element: lazyPage(() => import('../pages/Hidrantes/Hidrantes')) },
      { path: 'cadastro/viaturas', element: lazyPage(() => import('../pages/Viaturas/Viaturas')) },
      { path: 'cadastro/ferias', element: lazyPage(() => import('../pages/Ferias/Ferias')) },
      { path: 'cadastro/documentos', element: lazyPage(() => import('../pages/Documentos/Documentos')) },
      { path: 'ocorrencias', element: <Navigate to="/registros-diarios/bona-rea" replace /> },
      { path: 'inspecoes', element: <Navigate to="/registros-diarios/inspecoes" replace /> },
      { path: 'inspecoes/solicitacoes', element: <Navigate to="/registros-diarios/solicitacoes" replace /> },
      { path: 'inspecoes/check', element: <Navigate to="/registros-diarios/inspecoes/check" replace /> },
      { path: 'viaturas', element: lazyPage(() => import('../pages/Viaturas/ViaturasCCI')) },
      { path: 'epis', element: lazyPage(() => import('../pages/EPIs/EPIs')) },
      { path: 'checklists', element: lazyPage(() => import('../pages/Checklists/Checklists')) },
      { path: 'documentos', element: lazyPage(() => import('../pages/Documentos/Documentos')) },
      { path: 'documentos/trocas', element: lazyPage(() => import('../pages/Relatorios/Trocas')) },
      { path: 'escalas', element: lazyPage(() => import('../pages/Escalas/Escalas')) },
      { path: 'treinamentos', element: lazyPage(() => import('../pages/Treinamentos/Treinamentos')) },
      { path: 'treinamentos/posicionamento', element: lazyPage(() => import('../pages/Treinamentos/Posicionamento')) },
      { path: 'treinamentos/tempo-resposta', element: lazyPage(() => import('../pages/Treinamentos/TempoResposta')) },
      { path: 'treinamentos/tp-epr', element: lazyPage(() => import('../pages/Relatorios/TPEPR')) },
      { path: 'treinamentos/taf', element: lazyPage(() => import('../pages/Relatorios/TAF')) },
      { path: 'certificacoes', element: lazyPage(() => import('../pages/Certificacoes/Certificacoes')) },
      { path: 'funcionarios', element: lazyPage(() => import('../pages/Funcionarios/Funcionarios')) },
      { path: 'funcionarios/substituicoes', element: lazyPage(() => import('../pages/Funcionarios/Substituicoes')) },
      { path: 'estatisticas', element: lazyPage(() => import('../pages/Estatisticas/Estatisticas')) },
      { path: 'registros-diarios/ptr-ba', element: lazyPage(() => import('../pages/RegistrosDiarios/PTRBADiario')) },
      { path: 'registros-diarios/ptr-ba-completo', element: lazyPage(() => import('../pages/RegistrosDiarios/PTRBACompleto')) },
      { path: 'registros-diarios/lro-ocorrencias', element: lazyPage(() => import('../pages/RegistrosDiarios/LROOcorrencias')) },
      { path: 'registros-diarios/bona-rea', element: lazyPage(() => import('../pages/Ocorrencias/Ocorrencias')) },
      { path: 'registros-diarios/inspecoes', element: lazyPage(() => import('../pages/Inspecoes/Inspecoes')) },
      { path: 'registros-diarios/solicitacoes', element: lazyPage(() => import('../pages/Inspecoes/Solicitacoes')) },
      { path: 'registros-diarios/inspecoes/check', element: lazyPage(() => import('../pages/Inspecoes/InspecaoCheck')) },
      { path: 'relatorios/lro', element: lazyPage(() => import('../pages/Relatorios/LRO').then(m => ({ default: m.LRO }))) },
      { path: 'relatorios/gerar-lro', element: <Navigate to="/registros-diarios/gerar-lro" replace /> },
      { path: 'registros-diarios/gerar-lro', element: lazyPage(() => import('../pages/GerarLRO/GerarLRO')) },
      { path: 'registros-diarios/preview-lro', element: lazyPage(() => import('../pages/PreviewLRO/PreviewLRO')) },
      { path: 'relatorios/bona', element: lazyPage(() => import('../pages/Relatorios/BONA')) },
      { path: 'relatorios/ptr-ba', element: lazyPage(() => import('../pages/Relatorios/PTRBA')) },
      { path: 'relatorios/ptr-ba-registros', element: lazyPage(() => import('../pages/Relatorios/PTRBARegistros')) },
      { path: 'relatorios/exercicios', element: lazyPage(() => import('../pages/Relatorios/Exercicios')) },
      { path: 'relatorios/exercicios/taf', element: lazyPage(() => import('../pages/Relatorios/TAF')) },
      { path: 'relatorios/exercicios/tp-epr', element: lazyPage(() => import('../pages/Relatorios/TPEPR')) },
      { path: 'relatorios/ordem-servico', element: lazyPage(() => import('../pages/Relatorios/OrdemServico').then(m => ({ default: m.OrdemServico }))) },
      { path: 'relatorios/substituicoes', element: lazyPage(() => import('../pages/Funcionarios/Substituicoes')) },
      { path: 'relatorios/trocas', element: lazyPage(() => import('../pages/Relatorios/Trocas')) },
      { path: 'arquivo/:tipo?', element: lazyPage(() => import('../pages/Arquivo/Arquivo')) },
      { path: 'configuracoes', element: lazyPage(() => import('../pages/Configuracoes/Configuracoes')) },
      { path: 'usuarios', element: lazyPage(() => import('../pages/Usuarios/Usuarios')) },
      { path: 'perfil', element: lazyPage(() => import('../pages/Perfil/Perfil')) },
      { path: 'sair', element: <Navigate to="/login" replace /> },
    ],
  },
]);
