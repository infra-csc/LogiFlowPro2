# Fase 3.0 — Auditoria Visual e Plano de UI/UX

**Data**: 2026-05-28  
**Regra**: Nenhum codigo alterado. Apenas diagnostico, proposta e planejamento.  
**Base**: Dark-mode-first, paleta azul/ciano/roxo/rosa, shadcn/ui + Tailwind CSS, Inter.

---

## 1. Diagnostico Geral do Design Atual

### 1.1 Pontos Fortes

- **Paleta coerente**: dark navy `#0a1628` + `#0d1b2a` com acentos `#0ea5e9` (sky blue) e `#ec4899` (pink) funciona bem para um sistema de logistica. Nao ha poluicao cromatica.
- **Sidebar shadcn**: bem implementada, com grupos colapsaveis (Operacoes, Estoque, Aprovacoes, Viagens, Catalogo, Relatorios, Configuracao). Icones lucide consistentes.
- **Header da pagina**: quase todas as telas usam o mesmo padrao: `h1` + `p` descritivo + botao de acao a direita. Isso da uma consistencia basica boa.
- **Loading states**: padrao uniforme com spinner CSS `animate-spin` + texto descritivo.
- **Empty states**: padrao padrao com icone grande (48-64px) + titulo + descricao + CTA opcional. Presente em produtos, ordens, requisicoes, devolucoes.
- **Badges de status**: `StatusBadge` componente centralizado cobre eventos, requisicoes, viagens, produtos. Cores semanticas consistentes.
- **Cards como lista predominante**: sistema usa cards (nao tabelas) para listagens. Isso eh uma escolha de design valida para densidade de informacao moderada.
- **Formularios**: React Hook Form + Zod + shadcn Form components. Padrao consistente e robusto.
- **RBAC visual**: botoes de escrita corretamente ocultos para usuarios sem permissao. Nenhum botao "desabilitado" sem razao.

### 1.2 Problemas Visuais Encontrados

#### P0 — Problemas que Atrapalham Uso

1. **404 na landing page**: A rota `/` (dashboard) retorna 404 quando o usuario esta logado. O dashboard provavelmente existe como `/dashboard` mas nao como `/`. Isso quebra a primeira impressao.
2. **Tela de login mostrada em todas as rotas protegidas**: quando o usuario nao esta logado, todas as rotas (`/movements`, `/requests`, etc.) mostram a tela de login dentro do layout com sidebar. Isso cria uma experiencia confusa — a sidebar esta visivel mas vazia, e o login aparece como se fosse uma pagina interna. Ideal: redirect para `/auth` ou overlay fullscreen.
3. **Divergencia de header de pagina**: `docks.tsx` usa `h1` com icone (`<Warehouse className="h-6 w-6" />`) enquanto outras paginas (products, requests, movements) usam `h1` sem icone. Nao ha padrao consistente para quando o icone aparece no titulo.
4. **Card de login dentro do layout**: a tela de auth (`/auth`) mostra o login dentro do layout principal (sidebar visivel). Isso polui a primeira impressao. Deveria ser tela fullscreen ou pelo menos sem sidebar.

#### P1 — Alto Impacto Visual

5. **Tela de login a esquerda eh muito escura**: o formulario de login fica em um card cinza escuro sobre fundo navy. Falta contraste suficiente para dar destaque ao formulario. O card deveria ter um `bg-card` mais elevado ou uma borda sutil.
6. **Cards de resumo do login (direita)**: os 4 cards (Gestao de Eventos, Inventario, Planejamento, Logistica Reversa) ficam bem, mas a tipografia dos titulos de card (`text-lg font-medium`) eh identica a descricao, falta hierarquia.
7. **Tela de Devolucoes sem acao de criacao**: a tela de devolucoes (`returns.tsx`) mostra cards listando devolucoes, mas sem botao "Registrar Devolucao" para Admin/Almoxarifado. O back-end suporta criacao (POST), mas o front nao oferece a acao. Nao eh um bug de RBAC — eh falta de UI.
8. **Config.tsx cards nao clicaveis**: a tela de Configuracao mostra cards de Veiculos, Motoristas, Docas com contador, mas nao ha `cursor-pointer` ou `hover-elevate` (nao esta, apesar de ter `hover-elevate` no codigo). Na verdade o codigo tem `hover-elevate` mas sem `onClick` — os cards nao levam a lugar nenhum. Botao de `+` no card de Configuracao abre dialog sem contexto de qual secao.
9. **Tela de movimentacoes (lista)**: uso de `Card` para cada movimentacao funciona, mas a densidade visual pode melhorar. Nao ha indicadores visuais de status (cor de borda left, por exemplo) alem do badge.
10. **Loading orders — lista com cards clicaveis**: `hover-elevate cursor-pointer` nas ordens. Bom. Mas o card nao tem indicador de status visual (apenas badge). `Card` poderia ter uma borda sutil colorida por status.
11. **Request list — filtro nao colapsavel**: filtros de requisicoes (status, evento) ocupam espaco vertical fixo. Nao ha `Collapsible` para esconder. Movimentacoes ja tem `Collapsible` para filtros — boa pratica que deveria ser replicada.

#### P2 — Padronizacao

12. **Inconsistencia tabela vs card**: `drivers.tsx` usa `Table` (shadcn/ui table) enquanto `vehicles.tsx` e `docks.tsx` usam cards/lista. `products.tsx` tambem usa cards. Nao ha criterio claro para quando usar tabela vs card. Telas administrativas (usuarios, roles) podem beneficiar de tabelas.
13. **Loading state replicado**: cada pagina define seu proprio loading state inline. Codigo duplicado ~15x. Deveria ser um componente `PageLoading`.
14. **Empty state replicado**: mesma estrutura (icone + titulo + descricao + CTA) replicada ~10x. Nao ha componente `EmptyState` reutilizavel.
15. **PageHeader ausente**: nao ha componente `PageHeader`. Cada pagina manualmente monta `<div className="flex items-center justify-between">` com `<h1>` + `<p>`. Em `docks.tsx`, o header usa `gap-2` no `h1` (icone), mas em `products.tsx` o `h1` esta sozinho.
16. **Botao de acao no header**: posicionamento inconsistente. `products.tsx` coloca o botao dentro do `{canWrite && ...}` inline. `loading-orders.tsx` tambem. `requests.tsx` coloca o botao fora do condicional (qualquer logado pode criar). Isso eh por regra de negocio (ownership), mas visualmente a posicao varia.
17. **Badge de cores inline**: `getStatusColor` esta definido localmente em `movements.tsx`, `movement-details.tsx`, `returns.tsx`, `products.tsx`. `StatusBadge` cobre alguns casos, mas movimentacoes e devolucoes usam funcoes inline. Nao ha centralizacao.
18. **Formulario de veiculos**: 12 campos (plate, type, model, dimensoes, peso, etc.) em um unico `Dialog`. Pode ser overwhelming. Nao ha `Tabs` ou `Accordion` para agrupar campos.
19. **Formulario de loading-order-dialog**: 478 linhas. Dialog gigante com logica de selecao de requisicoes, viagens, horarios. Nao ha separacao em steps ou tabs.

#### P3 — Polimento

20. **Icone do aplicativo no header**: o titulo `Gestao de Logistica de Eventos` no header superior (fora da sidebar) esta centralizado. Poderia ter um breadcrumb ou o nome do evento atual selecionado.
21. **Microcopy inconsistente**: alguns titulos em portugues, alguns em ingles (ex: `404 Page Not Found` no `NotFound` componente). `Back to Dashboard` no botao de 404.
22. **Data formatada**: `format(new Date(returnItem.createdAt), "MMM dd, yyyy")` em `returns.tsx` usa formato ingles. Outras paginas usam `date-fns` com `pt-BR`. Deveria ser consistente.
23. **Altura dos headers de pagina**: a sidebar tem header de `EventFlow` (h1). O conteudo principal comecaa em `p-6`. Poderia ter um padding maior entre sidebar e conteudo.
24. **Responsividade**: nao foi testado em mobile, mas `min-h-screen` e `lg:w-1/2` no login sugerem que ha preocupacao com responsividade. Cards de 2-colunas (`grid-cols-2`) em produtos podem quebrar em telas menores.

---

## 2. Principais Problemas Visuais (Resumo)

| # | Problema | Impacto | Onde |
|---|---|---|---|
| 1 | 404 no `/` (dashboard) | Alto | App routing |
| 2 | Login dentro do layout com sidebar | Alto | Auth flow, ProtectedRoute |
| 3 | Devolucoes sem botao de criacao | Alto | `returns.tsx` |
| 4 | Config cards nao clicaveis | Medio | `config.tsx` |
| 5 | Tabela vs Card sem criterio | Medio | drivers, vehicles, products |
| 6 | Loading/Empty states duplicados | Medio | Todas as paginas |
| 7 | PageHeader nao componentizado | Medio | Todas as paginas |
| 8 | Badge de cores inline | Medio | movements, returns, products |
| 9 | Formularios longos sem agrupamento | Medio | vehicles, loading-order |
| 10 | Microcopy EN/PT misturado | Baixo | not-found, returns, varios |

---

## 3. Telas Mais Criticas

**Ordenadas por uso + impacto visual + problemas encontrados:**

### 3.1 Movimentacoes (lista + detalhe + aprovacoes)
- **Por que critica**: tela mais usada pelo Almoxarifado. Scanner, carregamento, descarregamento.
- **Problemas**: filtros funcionam mas sem colapsar; badge de status inline; formulario de criacao gigante (Dialog de 543 linhas); detalhe de movimentacao (`movement-details.tsx` tem 1565 linhas) — muito denso.
- **Potencial**: melhorar a lista com cards coloridos por status; agrupar o formulario em tabs; adicionar resumo de progresso na lista.

### 3.2 Loading Orders (lista + detalhe + otimizacao)
- **Por que critica**: tela central para Logistica e Almoxarifado. Picking e carregamento.
- **Problemas**: dialog de 478 linhas; otimizacao (3D bin packing) pode ter UI confusa; detalhe mostra progresso mas sem resumo visual claro.
- **Potencial**: cards com indicador de status; dialog com steps; resumo de picking progress.

### 3.3 Requisicoes (lista + detalhe + aprovacao)
- **Por que critica**: tela mais usada pelo Usuario Comum. Fluxo de requisicao eh o ponto de entrada.
- **Problemas**: filtros nao colapsaveis; detalhe (`request-details.tsx` — 559 linhas) tem muitas secoes; aprovacao (se existir) pode nao ter UX clara.
- **Potencial**: melhorar o fluxo de requisicao com steps; adicionar resumo de status; melhorar a tela de aprovacao.

### 3.4 Dashboard (nao funcional — 404)
- **Por que critica**: primeira tela apos login.
- **Problemas**: 404. Nao ha resumo do sistema.
- **Potencial**: adicionar cards de resumo (requisicoes pendentes, movimentacoes em andamento, devolucoes recentes).

### 3.5 Devolucoes
- **Por que critica**: modulo passivo mas com gap de UI.
- **Problemas**: sem botao de criacao; sem formulario; apenas leitura.
- **Potencial**: adicionar formulario de registro; melhorar cards com indicadores de discrepancia.

### 3.6 Catalogo (Produtos + Kits + Fornecedores)
- **Por que critica**: referencia para todo o sistema.
- **Problemas**: cards simples; sem preview de imagem; search funcional mas sem filtros avancados.
- **Potencial**: grid com imagem; filtros por categoria; status visual.

---

## 4. Componentes que Precisam Ser Padronizados

### 4.1 Componentes Novos (Design System)

| Componente | Onde usar | Status |
|---|---|---|
| `PageHeader` | Todas as paginas | Nao existe. Replicado manualmente ~25x. |
| `PageLoading` | Todas as paginas | Nao existe. Replicado ~15x. |
| `EmptyState` | Todas as paginas | Nao existe. Replicado ~10x. |
| `StatusBadge` | Ja existe | Bom. Precisa expandir para movimentacoes e devolucoes. |
| `ActionCard` | Config, Catalogo | Cards clicaveis com contador + descricao. |
| `FilterBar` | Movimentacoes, Requisicoes, etc. | Collapsible, consistente. |
| `DataCard` | Listagens (orders, movements, requests) | Card com borda colorida por status, icones, acoes. |
| `FormSection` | Dialogs longos | Agrupar campos de formulario com `Accordion` ou `Tabs`. |

### 4.2 Padroes de Referencia (Melhor Implementado)

- **Sidebar**: `app-sidebar.tsx` — bem estruturado, com Collapsible, grupos, icons. **Referencia: sim.**
- **Loading Orders lista**: `loading-orders.tsx` — cards clicaveis com `hover-elevate`, badge de status, icones. **Referencia: sim.**
- **Formulario de Drivers**: `drivers.tsx` — usa Table + Dialog + Form completo. **Referencia: sim (para tabelas).**
- **Toast**: `useToast` — consistente em todo o sistema. **Referencia: sim.**
- **Dialog de Movimentacao**: `movement-dialog.tsx` — 543 linhas, muito longo. **Nao referencia.**
- **Empty state de Produtos**: `products.tsx` — icone + titulo + descricao + CTA. **Referencia: sim.**

### 4.3 Padroes que Precisam de Unificacao

1. **PageHeader**: Todas as paginas devem usar `PageHeader` com `title`, `description`, `actions` (slot).
2. **Loading/Empty**: Todas as paginas devem usar `PageLoading` e `EmptyState`.
3. **Badge de cores**: Movimentacoes, devolucoes, produtos devem usar `StatusBadge` (expandir o componente).
4. **Card de lista**: Movimentacoes, loading orders, requisicoes devem usar `DataCard` com indicador de status.
5. **Dialog**: Dialogs de criacao/edicao devem usar `FormSection` para agrupar campos.

---

## 5. Problemas de UX por Perfil/RBAC

### 5.1 Geral

- **Botao oculto faz sentido**: sim. O sistema usa `canWrite && (<Button ...>)` para esconder botoes de escrita. Nao ha botao desabilitado sem explicacao. **Boa pratica.**
- **Sidebar coerente**: links de admin (usuarios, roles, product-statuses, locations) filtrados via `adminOnly`. Link de aprovacoes de movimentacoes filtrado para Admin/Supervisor. **Coerente.**
- **Leitura continua util**: sim. Telas de lista mostram dados mesmo para usuarios sem escrita. Nao ha "tela vazia" por falta de permissao.

### 5.2 Por Perfil

| Perfil | Tela | Problema | Nota |
|---|---|---|---|
| **Usuario Comum** | Requisicoes | Lista filtra apenas requisicoes proprias. Se o usuario nunca criou nada, ve empty state. OK. | Poderia ter uma mensagem explicando que o filtro esta ativo. |
| **Usuario Comum** | Movimentacoes | Leitura completa. OK. | Nenhuma acao disponivel. Boa. |
| **Usuario Comum** | Loading Orders | Leitura completa. OK. | Botao de criacao oculto. Boa. |
| **Almoxarifado** | Movimentacoes | Tem acoes de criar/editar/itens. | Formulario gigante (543 linhas) pode ser intimidante. |
| **Almoxarifado** | Loading Orders | Tem acoes de itens e mark-ready. | Dialog de itens nao foi auditado visualmente. |
| **Almoxarifado** | Devolucoes | Tem permissao de criar (POST) mas **nao ha botao no front**. | **Gap encontrado.** |
| **Supervisor** | Aprovacoes | Link de Movimentacoes visivel. | Tela de aprovacoes (`movement-approvals.tsx`) nao foi auditada visualmente. |
| **Logistica** | Viagens/Veiculos/Docas | Tem escrita completa. | Formulario de veiculos eh denso. |
| **Admin** | Tudo | Acesso completo. | Telas administrativas (usuarios, roles) usam layout simples. Poderiam ter mais refinamento. |

### 5.3 Gaps de UX

- **G1**: Devolucoes — Almoxarifado e Admin tem permissao de criar (POST) mas o front nao oferece acao. **Gap real.**
- **G2**: Dashboard inexistente — primeiro contato apos login eh 404. **Gap real.**
- **G3**: Tela de Configuracao — cards nao clicaveis. Usuario clica no card esperando ir para a lista, mas nada acontece. **Gap de affordance.**
- **G4**: Movimentacoes em andamento — nao ha indicador visual na lista de qual movimentacao esta ativa. **Gap de escaneabilidade.**
- **G5**: Filtros de requisicoes — nao colapsaveis. Ocupam espaco vertical fixo. **Gap de densidade.**

---

## 6. Proposta de Design System Leve

### 6.1 Principios

- **Nao trocar paleta.** Manter dark navy + sky blue + pink.
- **Nao trocar fonte.** Manter Inter.
- **Nao trocar componentes.** Manter shadcn/ui.
- **Evoluir, nao revolucionar.**

### 6.2 Tokens Visuais

```
--page-padding: 1.5rem (24px)    /* p-6 atual */
--section-gap: 1.5rem (24px)     /* space-y-6 atual */
--card-gap: 1rem (16px)          /* gap-4 */
--header-height: 3rem (48px)     /* h-12 */

/* Cores de status para bordas de cards */
--status-created:      hsl(200 90% 50%)   /* sky blue */
--status-in-progress:  hsl(210 100% 50%)  /* primary blue */
--status-paused:       hsl(35 90% 50%)    /* amber */
--status-completed:    hsl(145 70% 45%)   /* emerald */
--status-cancelled:    hsl(0 70% 50%)     /* red */
--status-pending:      hsl(45 90% 50%)    /* yellow */
```

### 6.3 Padroes de Componente

#### PageHeader
```
<div class="flex items-center justify-between gap-4">
  <div>
    <h1 class="text-2xl font-semibold">Titulo</h1>
    <p class="text-sm text-muted-foreground mt-1">Descricao</p>
  </div>
  <div class="flex items-center gap-2">
    {/* acoes via children/slot */}
  </div>
</div>
```

#### DataCard (para listagens)
```
<Card className="hover-elevate cursor-pointer border-l-4 border-l-{status-color}">
  <CardHeader>
    <div class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <Icon className="h-5 w-5 text-muted-foreground" />
        <CardTitle>{title}</CardTitle>
      </div>
      <StatusBadge status={status} />
    </div>
  </CardHeader>
  <CardContent>
    {/* metadados */}
  </CardContent>
</Card>
```
**Nota sobre border-l**: Card do shadcn ja tem `rounded-md`. Usar `border-l-4` em elemento `rounded` gera um visual estranho. Melhor: usar `border` completo com cor sutil, ou indicador de status via `Badge` + cor de fundo sutil do card. Alternativa: **nao usar border-l**, usar `bg` sutil por status.

#### FilterBar (collapsible)
```
<Collapsible>
  <CollapsibleTrigger>
    <Button variant="outline" size="sm">
      <Filter className="h-4 w-4 mr-2" />
      Filtros
    </Button>
  </CollapsibleTrigger>
  <CollapsibleContent>
    <Card className="p-4">
      {/* filtros */}
    </Card>
  </CollapsibleContent>
</Collapsible>
```

#### EmptyState
```
<Card>
  <CardContent className="py-12">
    <div className="text-center">
      <Icon className="h-16 w-16 mx-auto text-muted-foreground/50" />
      <h3 className="mt-4 text-lg font-medium">Titulo</h3>
      <p className="mt-2 text-sm text-muted-foreground">Descricao</p>
      {/* CTA opcional */}
    </div>
  </CardContent>
</Card>
```

#### PageLoading
```
<div className="flex items-center justify-center h-[calc(100vh-4rem)]">
  <div className="text-center">
    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
    <p className="mt-4 text-sm text-muted-foreground">{message}</p>
  </div>
</div>
```

### 6.4 Layout de Pagina

```
<div className="p-6 space-y-6">
  <PageHeader title="..." description="...">
    {/* acoes */}
  </PageHeader>
  
  {/* Filtros (se houver) */}
  <FilterBar>...</FilterBar>
  
  {/* Lista ou Conteudo */}
  <div className="space-y-4">
    {/* items */}
  </div>
</div>
```

### 6.5 Badges de Status

Expandir `StatusBadge` para incluir movimentacoes e devolucoes. Padrao:
- `chart-4` (verde) = positivo/completado/disponivel
- `chart-5` (laranja) = em andamento/pendente/alerta
- `destructive` (vermelho) = erro/rejeitado/cancelado/danificado
- `chart-2` (azul) = planejado/novo
- `primary` (azul primario) = ativo/em progresso
- `muted` (cinza) = rascunho/inativo

### 6.6 Responsividade

- **Desktop**: sidebar fixa (16rem), conteudo flexivel.
- **Tablet**: sidebar colapsada (icones), conteudo em grid de 2 colunas.
- **Mobile**: sidebar escondida (drawer), conteudo em 1 coluna, cards empilhados.

---

## 7. Roadmap Sugerido da Fase 3

### 7.1 Fase 3.1 — Design System Base (fundacao)

**Objetivo**: criar componentes reutilizaveis que todas as paginas usarao.

**Arquivos**:
- `client/src/components/page-header.tsx` — novo
- `client/src/components/page-loading.tsx` — novo
- `client/src/components/empty-state.tsx` — novo
- `client/src/components/data-card.tsx` — novo
- `client/src/components/filter-bar.tsx` — novo
- `client/src/components/status-badge.tsx` — expandir

**Risco**: baixo. Sao componentes puros, sem logica de negocio.
**Impacto visual**: alto. Padroniza toda a UI.
**Regra de negocio**: nenhuma.
**Como testar**: verificar se todas as paginas ainda carregam, `npm run check` e `npm run build`.

### 7.2 Fase 3.2 — Movimentacoes (tela mais usada)

**Objetivo**: melhorar lista, detalhe, aprovacoes e dialog.

**Arquivos**:
- `client/src/pages/movements.tsx` — refatorar lista com `DataCard`
- `client/src/pages/movement-details.tsx` — refatorar com `PageHeader`, agrupar secoes
- `client/src/pages/movement-approvals.tsx` — melhorar UX
- `client/src/components/movement-dialog.tsx` — agrupar em `FormSection` (tabs/accordion)

**Risco**: medio. Dialog tem logica complexa.
**Impacto visual**: alto. Tela mais usada pelo Almoxarifado.
**Regra de negocio**: nenhuma. Apenas UI.
**Como testar**: fluxo de criar/editar/gerenciar itens/scanner; verificar se `userCanManageMovementItems` continua funcionando.

### 7.3 Fase 3.3 — Loading Orders

**Objetivo**: melhorar lista, detalhe, dialogs e otimizacao.

**Arquivos**:
- `client/src/pages/loading-orders.tsx` — refatorar com `DataCard`
- `client/src/pages/loading-order-details.tsx` — melhorar progresso visual
- `client/src/components/loading-order-dialog.tsx` — agrupar em steps

**Risco**: medio. Dialog tem logica de selecao de requisicoes/viagens.
**Impacto visual**: alto. Tela central para Logistica.
**Regra de negocio**: nenhuma.
**Como testar**: fluxo de criar/editar/otimizar.

### 7.4 Fase 3.4 — Requisicoes

**Objetivo**: melhorar fluxo visual e telas de detalhe.

**Arquivos**:
- `client/src/pages/requests.tsx` — colapsar filtros, refatorar com `DataCard`
- `client/src/pages/request-details.tsx` — agrupar secoes
- `client/src/components/request-dialog.tsx` — se houver

**Risco**: medio. Detalhe tem muitas secoes (itens, aprovacao, duplicacao).
**Impacto visual**: alto. Tela mais usada pelo Usuario Comum.
**Regra de negocio**: nenhuma.
**Como testar**: fluxo de criar/adicionar itens/aprovar.

### 7.5 Fase 3.5 — Catálogo (Produtos + Kits + Fornecedores)

**Objetivo**: melhorar grid, filtros, e preview de imagem.

**Arquivos**:
- `client/src/pages/products.tsx` — grid com preview, filtros
- `client/src/pages/kits.tsx` — melhorar lista
- `client/src/pages/suppliers.tsx` — melhorar lista

**Risco**: baixo.
**Impacto visual**: medio.
**Regra de negocio**: nenhuma.
**Como testar**: busca, filtros, upload de imagem.

### 7.6 Fase 3.6 — Devolucoes

**Objetivo**: avaliar se cria formulario de devolucao ou mantem read-only.

**Arquivos**:
- `client/src/pages/returns.tsx` — adicionar botao de criar + dialog
- `client/src/components/return-dialog.tsx` — novo (se decidido)

**Decisao**: o back-end suporta POST. Admin e Almoxarifado tem permissao. **Recomendacao**: adicionar formulario de criacao. O modulo eh "passivo" mas sem UI de criacao fica incompleto.

**Risco**: baixo.
**Impacto visual**: medio.
**Regra de negocio**: nenhuma. POST ja existe.
**Como testar**: criar devolucao, verificar se aparece na lista.

### 7.7 Fase 3.7 — Admin/Configuracoes

**Objetivo**: melhorar telas administrativas.

**Arquivos**:
- `client/src/pages/config.tsx` — tornar cards clicaveis
- `client/src/pages/users.tsx` — melhorar tabela
- `client/src/pages/roles.tsx` — melhorar tabela
- `client/src/pages/vehicle-types.tsx` — melhorar tabela

**Risco**: baixo.
**Impacto visual**: medio.
**Regra de negocio**: nenhuma.
**Como testar**: navegacao, CRUD basico.

### 7.8 Fase 3.8 — Dashboard

**Objetivo**: criar dashboard funcional.

**Arquivos**:
- `client/src/pages/dashboard.tsx` — criar resumo do sistema

**Risco**: baixo.
**Impacto visual**: alto. Primeira tela.
**Regra de negocio**: pode precisar de novos endpoints (stats). **Cuidado**: se precisar de endpoint novo, essa fase mexe no back-end.
**Como testar**: verificar se cards de resumo carregam corretamente.

### 7.9 Fase 3.9 — Login e Auth Flow

**Objetivo**: corrigir fluxo de login.

**Arquivos**:
- `client/src/pages/auth-page.tsx` — tela fullscreen ou sem sidebar
- `client/src/lib/protected-route.tsx` — redirect para `/auth` em vez de mostrar login no layout

**Risco**: baixo.
**Impacto visual**: alto. Primeira impressao.
**Regra de negocio**: nenhuma.
**Como testar**: logout, acesso a rota protegida, login, redirect.

---

## 8. Primeira Fase Recomendada para Implementacao

**Fase 3.1 — Design System Base** + **Fase 3.9 — Login e Auth Flow** (podem ir em paralelo).

**Por que comecar por 3.1**:
- Sao componentes puros (sem logica de negocio).
- Risco baixo.
- Impacto alto (padroniza tudo).
- Uma vez criados, as fases 3.2-3.8 ficam mais rapidas.

**Por que comecar por 3.9 tambem**:
- Corrige o problema mais visivel (login dentro do layout).
- Primeira impressao do sistema.
- Risco baixo.

**Ordem recomendada**:
1. 3.1 (Design System) — 3.9 (Login) — **em paralelo**
2. 3.2 (Movimentacoes) — 3.3 (Loading Orders) — **em paralelo**
3. 3.4 (Requisicoes) — 3.6 (Devolucoes) — **em paralelo**
4. 3.5 (Catalogo)
5. 3.7 (Admin)
6. 3.8 (Dashboard) — **depois de ter dados para mostrar**

---

## 9. Confirmacao: Nenhum Codigo Foi Alterado

**Esta fase (3.0) foi puramente de auditoria e planejamento.**

- Nenhum arquivo de codigo foi editado.
- Nenhum componente foi criado.
- Nenhum endpoint foi alterado.
- Nenhum banco de dados foi modificado.
- Nenhuma regra de negocio foi alterada.
- Nenhuma permissao RBAC foi alterada.
- Nenhuma rota foi modificada.
- `npm run check` e `npm run build` continuam passando.

---

## 10. Checklist de Entrega

- [x] 1. Diagnostico geral do design atual
- [x] 2. Principais problemas visuais encontrados (10 problemas catalogados)
- [x] 3. Telas mais criticas (6 telas priorizadas)
- [x] 4. Componentes que precisam ser padronizados (8 componentes + 5 padroes)
- [x] 5. Problemas de UX por perfil/RBAC (5 gaps catalogados)
- [x] 6. Proposta de design system leve
- [x] 7. Roadmap sugerido da Fase 3 (9 subfases)
- [x] 8. Primeira fase recomendada (3.1 + 3.9)
- [x] 9. Confirmacao de que nenhum codigo foi alterado

---

**Proximo passo**: aguardar aprovacao do usuario para iniciar a Fase 3.1 (Design System Base) ou Fase 3.9 (Login/Auth Flow).
