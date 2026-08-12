# RTK Query - Documentação

## Visão Geral

O projeto utiliza Redux Toolkit (RTK) com RTK Query para gerenciamento de estado e cache de dados. Todos os dados são persistidos no localStorage.

## Estrutura

```
src/
├── store/
│   ├── index.ts              # Configuração do store
│   └── api/
│       ├── baseApi.ts        # API base com tags
│       ├── apocApi.ts        # Endpoints para APOCs
│       ├── bombeiroApi.ts    # Endpoints para Bombeiros
│       ├── certificacaoApi.ts # Endpoints para Certificações
│       ├── chatApi.ts        # Endpoints para Chat
│       ├── epiApi.ts         # Endpoints para EPIs
│       ├── escalaApi.ts      # Endpoints para Escalas
│       ├── feriasApi.ts      # Endpoints para Férias
│       ├── lroApi.ts         # Endpoints para LROs
│       ├── ocorrenciaApi.ts  # Endpoints para Ocorrências
│       ├── ptrbApi.ts        # Endpoints para PTRBs
│       └── viaturaApi.ts     # Endpoints para Viaturas
```

## Uso

### Hooks de Query (Read)

```tsx
import { useListarBombeirosQuery } from '../store/api/bombeiroApi';

function MeuComponente() {
  const { data, isLoading, error } = useListarBombeirosQuery();
  
  if (isLoading) return <div>Carregando...</div>;
  if (error) return <div>Erro ao carregar</div>;
  
  return (
    <ul>
      {data?.map(bombeiro => (
        <li key={bombeiro.id}>{bombeiro.nomeCompleto}</li>
      ))}
    </ul>
  );
}
```

### Hooks de Mutation (Create/Update/Delete)

```tsx
import { useCriarBombeiroMutation, useExcluirBombeiroMutation } from '../store/api/bombeiroApi';

function FormularioBombeiro() {
  const [criarBombeiro, { isLoading }] = useCriarBombeiroMutation();
  const [excluirBombeiro] = useExcluirBombeiroMutation();
  
  const handleCriar = async () => {
    await criarBombeiro({
      matricula: '12345',
      nomeCompleto: 'João Silva',
      // ... outros campos
    });
  };
  
  const handleExcluir = async (id: string) => {
    await excluirBombeiro(id);
  };
  
  return (
    <button onClick={handleCriar} disabled={isLoading}>
      Criar Bombeiro
    </button>
  );
}
```

## Tags e Cache

Cada API define tags para invalidação automática de cache:

- `LIST`: Lista geral de registros
- `ID específico`: Registro individual

Quando um registro é criado, atualizado ou excluído, as tags correspondentes são invalidadas, atualizando automaticamente os componentes que dependem desses dados.

## APIs Disponíveis

### APOC API
- `useListarAPOCsQuery` - Lista todos
- `useBuscarAPOCsQuery(termo)` - Busca por termo
- `useCriarAPOCMutation` - Cria novo
- `useAtualizarAPOCMutation` - Atualiza existente
- `useExcluirAPOCMutation` - Exclui registro

### Bombeiro API
- `useListarBombeirosQuery` - Lista todos
- `useBuscarBombeirosQuery(termo)` - Busca por termo
- `useObterBombeiroQuery(id)` - Obtém por ID
- `useListarBombeirosAtivosQuery` - Lista apenas ativos
- `useCriarBombeiroMutation` - Cria novo
- `useAtualizarBombeiroMutation` - Atualiza existente
- `useExcluirBombeiroMutation` - Exclui registro

### Viatura API
- `useListarViaturasQuery` - Lista todos
- `useBuscarViaturasQuery(termo)` - Busca por termo
- `useCriarViaturaMutation` - Cria novo
- `useAtualizarViaturaMutation` - Atualiza existente
- `useExcluirViaturaMutation` - Exclui registro

### Certificação API
- `useListarCertificacoesQuery` - Lista todos
- `useCertificacoesPorFuncionarioQuery(id)` - Lista por funcionário
- `useCriarCertificacaoMutation` - Cria novo
- `useAtualizarCertificacaoMutation` - Atualiza existente
- `useExcluirCertificacaoMutation` - Exclui registro

### EPI API
- `useListarEPIsQuery` - Lista todos
- `useCriarEPIMutation` - Cria novo
- `useAtualizarEPIMutation` - Atualiza existente
- `useExcluirEPIMutation` - Exclui registro

### Escala API
- `useListarEscalasQuery` - Lista todos
- `useListarEscalasPorUsuarioQuery(username)` - Lista por usuário
- `useObterEscalaQuery(id)` - Obtém por ID
- `useCriarEscalaMutation` - Cria novo
- `useAtualizarEscalaMutation` - Atualiza existente
- `useExcluirEscalaMutation` - Exclui registro

### Férias API
- `useListarFeriasQuery` - Lista todos
- `useFeriasPorFuncionarioQuery(id)` - Lista por funcionário
- `useCriarFeriasMutation` - Cria novo
- `useAtualizarFeriasMutation` - Atualiza existente
- `useExcluirFeriasMutation` - Exclui registro

### LRO API
- `useListarLROsQuery` - Lista todos
- `useListarLROsPorUsuarioQuery(username)` - Lista por usuário
- `useObterLROQuery(id)` - Obtém por ID
- `useCriarLROMutation` - Cria novo
- `useAtualizarLROMutation` - Atualiza existente
- `useExcluirLROMutation` - Exclui registro

### Ocorrência API
- `useListarOcorrenciasQuery(storageKey?)` - Lista todos
- `useCriarOcorrenciaMutation` - Cria novo
- `useAtualizarOcorrenciaMutation` - Atualiza existente
- `useExcluirOcorrenciaMutation` - Exclui registro

### PTRB API
- `useListarPTRBsQuery` - Lista todos
- `useListarPTRBsPorUsuarioQuery(username)` - Lista por usuário
- `useObterPTRBQuery(id)` - Obtém por ID
- `useCriarPTRBMutation` - Cria novo
- `useAtualizarPTRBMutation` - Atualiza existente
- `useExcluirPTRBMutation` - Exclui registro

### Chat API
- `useListarMensagensQuery` - Lista todos
- `useMensagensGeraisQuery` - Lista mensagens gerais
- `useMensagensPrivadasQuery(usuario)` - Lista privadas
- `useConversaComQuery({ usuario1, usuario2 })` - Conversa específica
- `useContarNaoLidasQuery(usuario)` - Conta não lidas
- `useEnviarMensagemMutation` - Envia mensagem
- `useMarcarLidaMutation` - Marca como lida
