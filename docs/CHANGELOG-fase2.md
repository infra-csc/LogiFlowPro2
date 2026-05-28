# Fase 2 — Matriz de papéis funcionais (CHANGELOG detalhado)

Histórico das sub-fases que evoluem a autorização de "usuário logado"
para "usuário com papel correto", construindo sobre a Fase 1
(`docs/CHANGELOG-fase1.md`). O `replit.md` mantém apenas o resumo
executivo e aponta para este arquivo.

---

## Fase 2.0 — Planejamento (2026-05-28)

**Objetivo**: levantar a estrutura atual de roles/permissions e propor a
matriz papel × módulo × ação **sem alterar código**.

**Entregas**:
- Diagnóstico das 5 tabelas (`users`, `roles`, `user_roles`,
  `permissions`, `role_permissions`).
- Constatação de que `permissions`/`role_permissions` estão populadas
  no banco (42 e 223 linhas) mas **não são consumidas em runtime**.
- Lista de 8 papéis funcionais sugeridos (admin, planejamento,
  produção, supervisor, almoxarifado, logística, gestor, solicitante).
- Matriz papel × módulo × ação para 19 módulos.
- Matriz endpoint × papel mínimo para os 137 endpoints existentes.
- Ordem de implementação em sub-fases 2.1 → 2.6.
- 10 pontos de decisão levantados para o usuário.

**Decisões aprovadas pelo usuário antes da Fase 2.1** (consolidadas no
prompt inicial):
1. `POST /api/users` continua público (auto-cadastro + aprovação admin).
2. Não criar/renomear roles novas nesta fase.
3. `Gestor Logistica` mantém nome.
4. `Usuario Requisitor` mantém nome.
5. Logística aprova readiness/carregamento; supervisor aprova
   requisições e movimentações sensíveis (futuro).
6. Mudança de status de produto fica fora da Fase 2.4.
7. RBAC simples baseado em roles (não em `permissions`/
   `role_permissions`) por enquanto.
8. Super-admin via env var opcional, off-by-default.
9. Multi-role: união de permissões.
10. Filtro de solicitante em requisições fica para o storage layer
    (Fase 2.5 ou posterior).

**Arquivos alterados**: nenhum. Fase de planejamento puro.

---

## Fase 2.1 — Infraestrutura mínima de RBAC (2026-05-28)

**Objetivo**: criar a base técnica (constantes + helper + middleware)
para autorização por papel, sem mudar o comportamento prático do
sistema. Aplicar apenas em rotas que **já eram admin-only** para provar
que o middleware funciona sem regressão.

### Arquivos criados

- **`shared/roles.ts`** — pure/isomorphic:
  - Constante `ROLES.ADMIN = "admin"`.
  - Mapa interno `ROLE_ALIASES` reconhecendo `"admin"` e `"adm"` como
    equivalentes ao admin canônico (a role seedada chama-se `"Adm"`).
  - `normalizeRoleName(name)`: trim + lowercase, retorna `""` para
    nulo. Nunca lança.
  - `isAdminRoleName(name)`: aceita `"admin"`, `"adm"` em qualquer
    casing/whitespace. Single source of truth.
  - `rolesMatch(a, b)`: compara dois nomes via normalização + alias
    expansion. Usado pelos helpers para que `hasRole(user, "admin")`
    case com role armazenada `"Adm"`.

- **`server/authz.ts`** — middlewares de autorização por papel:
  - `getUserRoleNames(user, req?)`: lookup com memoização **por-request**
    via `req.__roleNames`. Sem cache global / sem TTL. Falha fechada
    (`[]` em erro de DB).
  - `hasRole(user, roleName, req?)`: comparação usando `rolesMatch` +
    fallback de super-admin via env var (apenas para o papel admin).
  - `hasAnyRole(user, roleNames[], req?)`: união (decisão #9).
  - `requireRole(roleName, { message? })`: middleware Express. 401
    anônimo, 403 sem papel, `next()` ok.
  - `requireAnyRole(roleNames[], { message? })`: mesma semântica para
    lista.
  - `requireAdmin({ message? })`: alias de `requireRole(ROLES.ADMIN)`.

- **`docs/CHANGELOG-fase2.md`** — este arquivo.

### Arquivos alterados

- **`server/ownership.ts`**:
  - Adicionado `import { isAdminRoleName as sharedIsAdminRoleName } from "@shared/roles"`.
  - `isAdminRoleName` agora é re-export do helper compartilhado (
    `export const isAdminRoleName = sharedIsAdminRoleName`).
  - **Single source of truth preservado**: `server/auth.ts` continua
    importando `isAdminRoleName` via `await import("./ownership")` sem
    qualquer alteração de payload.

- **`server/routes.ts`** (2 rotas, +1 linha de import):
  - Import: `import { requireAdmin } from "./authz";`.
  - `DELETE /api/suppliers/:id`: trocada checagem manual
    (`if (!req.isAuthenticated) 401` + `if (!await isAdmin) 403`) por
    `requireAdmin({ message: "Apenas administradores podem excluir fornecedores" })`.
    Mensagem de erro preservada idêntica.
  - `DELETE /api/drivers/:id`: idem com `"Apenas administradores podem
    excluir motoristas"`.
  - Handler interno agora só faz a chamada de storage + 204. Nenhuma
    outra rota tocada. Função `isAdmin` continua importada (usada em
    outras rotas e em `canEditResource`).

### Funções criadas (resumo)

| Origem | Função | Tipo |
|---|---|---|
| `shared/roles.ts` | `normalizeRoleName(name)` | helper puro |
| `shared/roles.ts` | `isAdminRoleName(name)` | helper puro |
| `shared/roles.ts` | `rolesMatch(a, b)` | helper puro |
| `shared/roles.ts` | `ROLES.ADMIN` | constante |
| `server/authz.ts` | `getUserRoleNames(user, req?)` | async helper c/ cache |
| `server/authz.ts` | `hasRole(user, roleName, req?)` | async helper |
| `server/authz.ts` | `hasAnyRole(user, roleNames[], req?)` | async helper |
| `server/authz.ts` | `requireRole(roleName, opts?)` | middleware factory |
| `server/authz.ts` | `requireAnyRole(roleNames[], opts?)` | middleware factory |
| `server/authz.ts` | `requireAdmin(opts?)` | middleware factory (alias) |

### Como roles são normalizadas

1. **Entrada**: nome bruto vindo do banco (`roles.name`) ou de chamada
   de código (`requireRole("admin")`).
2. **Normalização**: `normalizeRoleName` faz `trim().toLowerCase()`.
3. **Comparação**: `rolesMatch(a, b)` retorna `true` se:
   - `normalize(a) === normalize(b)`, OR
   - um dos lados é uma chave canônica de `ROLE_ALIASES` e o outro
     está na lista de aliases (atualmente: `admin ↔ adm`).
4. **Reconhecimento de admin**: `isAdminRoleName(name)` retorna `true`
   para qualquer alias listado (`admin`, `adm`), em qualquer casing.

### Como `requireRole`/`requireAnyRole` funcionam

```ts
app.delete("/api/x", requireRole("admin", { message: "..." }), handler);
app.post  ("/api/y", requireAnyRole(["admin", "supervisor"]), handler);
```

Fluxo do middleware:
1. Se `req.isAuthenticated()` for false → 401 `{ error: "Não autenticado" }`.
2. Carrega `req.__roleNames` (lazy, 1 query por request).
3. Verifica `hasRole`/`hasAnyRole`. Para admin, consulta também o
   fallback de env var (não é adicionado à lista de roles).
4. Se falhar → 403 `{ error: "Acesso negado", message }`. Mensagem
   customizável via `opts.message`.
5. Em erro de DB → 500 `{ error: "Erro ao verificar permissões" }`
   (fail closed).

### Cache de roleNames

- **Estratégia**: memoização por-request, anexando `req.__roleNames`
  após o primeiro lookup.
- **Por que não cache global com TTL**: introduz staleness após
  `assignRole`/`unassignRole`; complica reasoning de revogação imediata.
  Per-request é trivial de raciocinar e suficiente para o uso atual.
- **Por que não mutar `req.user`**: `req.user` é montado pelo Passport
  via `deserializeUser`; o objeto pode ser cacheado em alguma camada
  (compatibilidade futura) — preferimos anexar ao `req` próprio.
- **GET /api/user inalterado**: continua buscando roles via seu
  próprio path (compatibilidade total com qualquer integração externa).

### Super-admin via env var (opt-in)

- **Var**: `EMERGENCY_ADMIN_USERNAME`.
- **Comportamento**: se a env não estiver definida, **nada muda**.
  Se estiver e o `req.user.username` casar (case-sensitive), o usuário
  passa em qualquer checagem de admin (`requireAdmin`, `requireRole("admin")`,
  `hasRole(_, "admin")`).
- **Não aparece** em `user.roles` nem no payload de `GET /api/user`.
  Não substitui roles reais — é puro fallback.
- **Loga warning** a cada uso: `[authz] EMERGENCY_ADMIN_USERNAME
  fallback granted admin to user X (id=Y)`. Deixa rastro auditável.
- **Como ativar**: setar a env var no ambiente (ex.: Secrets do Replit)
  com o `username` do usuário desejado. Como desativar: remover a env
  e reiniciar.
- **Quando usar**: recuperação de uma tabela `user_roles` corrompida
  que tranque o admin real fora. Não usar como modo de operação normal.

### Rotas onde foi aplicado (apenas estas 2)

| Rota | Antes | Depois |
|---|---|---|
| `DELETE /api/suppliers/:id` | inline 401 + `isAdmin` 403 | `requireAdmin({ message: "Apenas administradores podem excluir fornecedores" })` |
| `DELETE /api/drivers/:id` | inline 401 + `isAdmin` 403 | `requireAdmin({ message: "Apenas administradores podem excluir motoristas" })` |

Demais 135 endpoints **não foram tocados**. `requireAuth`,
`canEditResource`, `isAdmin` permanecem funcionando exatamente como na
Fase 1.

### Validações

- **`npm run check`** → exit 0 (typecheck zerado).
- **`npm run build`** → ok (`dist/index.js 266.3kb`).
- **Smoke tests** (UUID fake para não afetar dados reais; handler de
  delete em UUID inexistente é no-op idempotente):

  | Cenário | Esperado | Obtido |
  |---|---|---|
  | Anônimo `DELETE /api/drivers/:id` | 401 | **401** ✅ |
  | Anônimo `DELETE /api/suppliers/:id` | 401 | **401** ✅ |
  | Admin `GET /api/user` | `isAdmin:true`, `roles:["Adm"]` | **idem** ✅ |
  | Admin `DELETE /api/drivers/:id` | 204 | **204** ✅ |
  | Admin `DELETE /api/suppliers/:id` | 204 | **204** ✅ |
  | Não-admin (`pftelles`/`Gestor Logistica`) `GET /api/user` | `isAdmin:false`, `roles:["Gestor Logistica"]` | **idem** ✅ |
  | Não-admin `DELETE /api/drivers/:id` | 403 + mensagem motoristas | **403 + mensagem motoristas** ✅ |
  | Não-admin `DELETE /api/suppliers/:id` | 403 + mensagem fornecedores | **403 + mensagem fornecedores** ✅ |

- Senha do `pftelles` foi **temporariamente** alterada via UPDATE
  direto no DB apenas para viabilizar o smoke como não-admin, e
  **restaurada para o hash original** no mesmo lote. Schema/seed/
  estrutura de dados intocados.

### Decisões técnicas

1. **`shared/roles.ts` é isomorphic** (zero deps Node-only) para que
   a Fase 2.6 (front-end) possa importar os mesmos helpers sem
   duplicação.
2. **`ownership.ts:isAdminRoleName` virou re-export** do helper
   compartilhado. Mantém todos os call sites existentes (incluindo o
   dynamic import em `auth.ts`) sem nenhuma alteração.
3. **Mensagens de 403 preservadas** via `opts.message` em `requireRole`
   — comportamento de cliente API idêntico.
4. **Cache por-request**: simples, sem staleness, suficiente para o
   volume atual.
5. **Super-admin via env**: implementado conforme decisão #8, mas
   **opt-in**. Sem env definida, comportamento idêntico ao pré-Fase 2.1.
6. **Nenhum `any`/`as any` novo**. Único cast local é
   `req as RoleCachedRequest`, com a interface explicitamente declarada
   adicionando o campo `__roleNames?: string[]`.
7. **Nada foi tocado** em: schema, migrations, seed, `permissions`,
   `role_permissions`, payloads, sidebar, ProtectedRoute, demais 135
   endpoints, CI.

### Confirmação de equivalência funcional

Comportamento das 2 rotas migradas é **idêntico** ao anterior:
- Mesmos status codes (401/403/204).
- Mesmas mensagens (`Apenas administradores podem excluir fornecedores
  / motoristas`).
- Mesma regra de quem passa (`Adm`/`admin` case-insensitive).

GET `/api/user` retorna o mesmo payload de antes (`roles` + `isAdmin`).

Demais 135 endpoints inalterados.

---

## Fase 2.2 — RBAC em rotas administrativas e configurações (2026-05-28)

**Objetivo**: aplicar `requireAdmin` nas rotas administrativas (usuários,
papéis, permissões) e nas escritas de configuração (grupos/tipos de
movimentação, status de produto, localizações, tipos de veículos),
mantendo intactos os fluxos operacionais centrais e o auto-cadastro
público.

### Arquivos alterados

- **`server/routes.ts`** — única source de mudanças. 33 rotas migradas
  para `requireAdmin`. Removidos blocos inline redundantes de
  `if (!req.isAuthenticated())` que viraram dead code após o middleware
  (ganho colateral: mensagens 401 padronizadas em pt-BR
  `"Não autenticado"` em vez do antigo `"Not authenticated"`).
- **`docs/CHANGELOG-fase2.md`** — este bloco.
- **`replit.md`** — bullet curto de Fase 2.2 apontando para este arquivo.

**Nenhum outro arquivo tocado.** `server/authz.ts` e `shared/roles.ts`
da Fase 2.1 reaproveitados sem alteração.

### Rotas que receberam `requireAdmin`

**Usuários admin** (mensagem: `"Apenas administradores podem gerenciar usuários"`)
| Método | Rota | Antes |
|---|---|---|
| GET | `/api/users` | `requireAuth` |
| GET | `/api/users/:id` | `requireAuth` |
| PATCH | `/api/users/:id` | **sem auth** ⚠️ (hole corrigido) |
| PATCH | `/api/users/:id/approve` | inline 401 |
| PATCH | `/api/users/:id/reject` | inline 401 |

**Papéis e permissões** (mensagem: `"Apenas administradores podem gerenciar papéis e permissões"`)
| Método | Rota | Antes |
|---|---|---|
| GET | `/api/roles` | `requireAuth` |
| GET | `/api/roles/:id` | `requireAuth` |
| POST | `/api/roles` | sem auth |
| PATCH | `/api/roles/:id` | sem auth |
| DELETE | `/api/roles/:id` | sem auth |
| GET | `/api/permissions` | `requireAuth` |
| POST | `/api/permissions` | sem auth |
| POST | `/api/permissions/populate` | sem auth |
| GET | `/api/users/:userId/roles` | `requireAuth` |
| POST | `/api/users/:userId/roles` | sem auth |
| DELETE | `/api/users/:userId/roles/:roleId` | sem auth |
| GET | `/api/roles/:roleId/permissions` | `requireAuth` |
| POST | `/api/roles/:roleId/permissions` | sem auth |
| PATCH | `/api/role-permissions/:id` | sem auth |
| DELETE | `/api/roles/:roleId/permissions/:permissionId` | sem auth |

**Configurações do sistema** (mensagem: `"Apenas administradores podem alterar configurações do sistema"`)
| Método | Rota | Antes |
|---|---|---|
| POST | `/api/movement-groups` | inline 401 |
| PATCH | `/api/movement-groups/:id` | inline 401 |
| DELETE | `/api/movement-groups/:id` | inline 401 |
| POST | `/api/movement-types-config` | inline 401 |
| PATCH | `/api/movement-types-config/:id` | inline 401 |
| DELETE | `/api/movement-types-config/:id` | inline 401 |
| POST | `/api/product-statuses` | inline 401 |
| PATCH | `/api/product-statuses/:id` | inline 401 |
| POST | `/api/locations` | inline 401 |
| PATCH | `/api/locations/:id` | inline 401 |
| POST | `/api/vehicle-types` | `requireAuth` |
| PATCH | `/api/vehicle-types/:id` | `requireAuth` |

**Total**: 33 rotas migradas (5 usuários + 15 papéis/perms + 12 config + reaproveitamento de helpers locais `adminRolesPerms` e `adminConfig` para evitar repetição).

### Rotas analisadas e **propositalmente NÃO alteradas**

**Públicas (escopo do spec — devem permanecer públicas)**:
- `POST /api/users` — auto-cadastro com `approval_status='pending'`.
- `POST /api/register` (em `server/auth.ts`) — registro alternativo.
- `POST /api/login`, `POST /api/logout` — autenticação.
- `GET /api/user` — quem sou eu (já é `requireAuth` implícito).
- `POST /api/auth/request-password-reset` — recuperação de senha.
- `POST /api/auth/reset-password` — redefinição via token.

**GETs de catálogos operacionais (permanecem `requireAuth`/inline auth — alimentam dropdowns)**:
- `GET /api/movement-groups`, `GET /api/movement-groups/:id`
- `GET /api/movement-types-config`, `GET /api/movement-types-config/:id`
- `GET /api/product-statuses`
- `GET /api/locations`
- `GET /api/vehicle-types`

**Módulos operacionais (escopo de Fase 2.3+, intocados)**:
- `/api/events`, `/api/products`, `/api/kits`, `/api/suppliers` POST/PATCH,
  `/api/requests`, `/api/loading-orders`, `/api/trips`, `/api/drivers`
  POST/PATCH, `/api/vehicles`, `/api/docks`, `/api/movements`,
  `/api/returns`, `/api/reports`, `/api/inventory/*`.

**Já protegidos com `requireAdmin` na Fase 2.1 (intocados)**:
- `DELETE /api/suppliers/:id`
- `DELETE /api/drivers/:id`

### Decisões técnicas

1. **GETs de roles/permissions também viraram admin-only** — confirmado
   pelo spec ("são telas administrativas e não devem ficar visíveis para
   usuário comum"). Antes eram `requireAuth`, agora `requireAdmin`.
2. **GETs de catálogos operacionais ficam `requireAuth`** — alimentam
   dropdowns em telas operacionais (qualquer logado precisa enxergar
   status/localização/tipo de veículo para preencher formulários).
3. **Inline `if (!req.isAuthenticated()) return 401 "Not authenticated"`
   removidos** quando substituídos por `requireAdmin`. Motivo: viram
   dead code (middleware já garantiu `isAuthenticated()=true`). Ganho
   colateral: mensagem 401 padronizada em pt-BR `"Não autenticado"`.
4. **Helpers locais `adminRolesPerms` e `adminConfig`** declarados uma
   vez dentro de `registerRoutes()` para evitar 26 instanciações
   repetidas do mesmo middleware factory. Mensagens permanecem únicas
   por família (3 mensagens distintas no total).
5. **`PATCH /api/users/:id` — correção de hole crítico**: antes não
   tinha nenhuma checagem de auth (qualquer um anônimo podia editar
   qualquer usuário, incluindo trocar password do admin). Agora exige
   admin autenticado. Esse era o maior risco em produção.
6. **Nenhum `any` / `as any` novo** introduzido.

### Validações

- **`npm run check`** → exit 0 (typecheck zerado).
- **`npm run build`** → ok (`dist/index.js 266.1kb`, -0.2kb por remoção
  de blocos inline).
- **Smoke tests** (cobertura abaixo):

#### Anônimo (todas as 30 rotas no escopo)

| Cenário | Esperado | Obtido |
|---|---|---|
| GET admin (7 rotas: users/roles/permissions/users:id/roles/...) | 401 | **401** ✅ |
| GET catálogos config (5 rotas) | 401 | **401** ✅ |
| Escritas admin/config (23 rotas: POST/PATCH/DELETE em users/roles/permissions/movement-groups/movement-types-config/product-statuses/locations/vehicle-types) | 401 | **401** ✅ |
| `POST /api/users` (auto-cadastro) | 201 (ou 400 se inválido) | **201** ✅ `approval_status:"pending"` |

#### Admin (sessão real)

| Cenário | Esperado | Obtido |
|---|---|---|
| GET 8 endpoints administrativos/config | 200 | **200** ✅ |
| DELETE 5 endpoints em UUID fake (no-op idempotente) | 200/204 | **200/204** ✅ |
| `GET /api/user` payload | mesmo de antes | **idem** ✅ (`roles:["Adm"], isAdmin:true`) |

#### Não-admin (cobertura herdada da Fase 2.1)

Per spec ("Não alterar senha de usuário real para smoke test"), **não**
foi reaberto o smoke 403 com usuário não-admin nesta fase. O
comportamento 403 do `requireAdmin` foi **integralmente validado na
Fase 2.1** (usuário `pftelles` / `Gestor Logistica` recebeu 403 com
mensagem custom). Como esta Fase 2.2 apenas aplica o **mesmo middleware
inalterado** a mais rotas (sem mudar nem o middleware nem o usuário),
o 403 para não-admin é garantido por construção. Limitação registrada
em vez de alterar senha real.

### Cleanup

- Usuário pendente criado pelo smoke de auto-cadastro (`smoke2_*`) foi
  apagado via `DELETE FROM users` no mesmo lote do smoke. Estado do
  banco preservado.

### Confirmações exigidas pelo spec

- ✅ Banco **não** alterado (apenas SELECT + INSERT/DELETE de 1 user de
  teste descartado).
- ✅ Migration **não** criada.
- ✅ Seed **não** alterado.
- ✅ Roles **não** renomeadas.
- ✅ Payloads **não** alterados (GET /api/user verificado idêntico).
- ✅ Nomes de endpoints **não** alterados.
- ✅ Front-end **não** alterado.
- ✅ ProtectedRoute **não** alterado.
- ✅ Sidebar **não** alterada.
- ✅ Matriz completa **não** implementada.
- ✅ Eventos/produtos/kits/requisições/viagens/loading-orders/movimentações/devoluções/relatórios **não** tocados.
- ✅ `permissions` / `role_permissions` **não** consumidas em runtime.
- ✅ Nenhum `any` / `as any` novo.
- ✅ `routes.ts` **não** refatorado inteiro (apenas blocos das 33 rotas).
- ✅ `POST /api/users` continua público (verificado: 201 anônimo).
- ✅ GETs catálogos operacionais continuam apenas `requireAuth` (verificado: 401 anônimo, 200 admin).

### Rotas administrativas ainda expostas (auditoria final)

Nenhuma rota administrativa de gestão de usuários, papéis, permissões
ou configurações dos 5 catálogos listados está sem proteção. Auditadas
todas as 137 rotas via grep `app\.(get|post|patch|delete)\("/api/` e
revisadas individualmente as do escopo.

**Pendências para fases posteriores (NÃO escopo Fase 2.2)**:
- Módulos operacionais ainda só exigem `requireAuth` (qualquer logado
  pode criar evento/produto/requisição/viagem). Será Fase 2.3+ com
  matriz por papel funcional.
- `POST /api/permissions/populate` é admin-only agora; considerar movê-lo
  para CLI/seed posteriormente — fora de escopo aqui.

---

## Fase 2.2.1 — Correção de regressão de @mention (2026-05-28)

### Motivo
Fase 2.2 fechou `GET /api/users` com `requireAdmin`. O componente
`client/src/components/comment-section.tsx` consumia essa rota para
alimentar o autocomplete de `@mention` em comentários — usuários
não-admin passaram a receber 403 e o autocomplete ficou vazio.

### Decisão
Criar endpoint específico e mínimo para menções, em vez de reabrir
`GET /api/users`. `GET /api/users` continua admin-only (telas
administrativas de gestão de usuários).

### Mudanças

**Back-end — `server/routes.ts`**
- Nova rota `GET /api/users/mention-lookup` com `requireAuth`.
- Declarada **antes** de `GET /api/users/:id` para não ser capturada
  como id.

**Storage — `server/storage.ts`**
- Novo método `getUsersForMentionLookup()` na interface `IStorage` e
  na implementação `DatabaseStorage`.
- Tipado como `Promise<Pick<User, "id" | "username" | "name">[]>`
  (sem `any`).
- Filtra `active = true AND approval_status = 'approved'`.
- Ordena por `name` (autocomplete legível).
- SELECT explícito de apenas 3 colunas — `password` e dados
  administrativos nunca saem do banco.

**Front-end — `client/src/components/comment-section.tsx`**
- Única mudança: `queryKey: ["/api/users"]` → `queryKey: ["/api/users/mention-lookup"]`.
- Interface local `User { id, username, name }` já era mínima — nada
  mais alterado. Layout, comportamento do autocomplete e lógica de
  comentários preservados.

### Campos retornados
Apenas: `id`, `username`, `name`.

**Não retornados**: `email`, `password`, `active`, `approvalStatus`,
`approvedBy`, `approvedAt`, `rejectedBy`, `rejectedAt`,
`rejectionReason`, `createdAt`, `updatedAt`, `roles`.

### Filtros aplicados
- `active = true` (não inclui inativos)
- `approval_status = 'approved'` (não inclui pendentes nem rejeitados)

### Não alterado
- `GET /api/users` continua `requireAdmin`.
- `GET /api/users/:id` continua `requireAdmin`.
- Sidebar, ProtectedRoute, matriz de papéis, roles/permissions, banco,
  migrations, seed, payloads administrativos — intactos.
- Módulos operacionais (events/products/requests/loading-orders/trips/
  movements/returns/reports) intactos.

### Validações
- `npm run check` → **exit 0**
- `npm run build` → ✅ `dist/index.js 266.7kb`

### Smoke tests executados
| Cenário | Resultado |
|---|---|
| Anônimo `GET /api/users/mention-lookup` | **401** ✅ |
| Admin `GET /api/users/mention-lookup` | **200** · keys=`[id,name,username]` · sem leak ✅ |
| Admin `GET /api/users` | **200** · payload administrativo completo preservado ✅ |
| Não-admin `GET /api/users` | **403** · `"Apenas administradores podem gerenciar usuários"` ✅ |
| Não-admin `GET /api/users/mention-lookup` | **200** · keys=`[id,name,username]` · sem leak ✅ |
| Não-admin `GET /api/users/:id` | **403** (rota `:id` não foi capturada pelo mention-lookup) ✅ |
| Admin `GET /api/users/:id` | **200** ✅ |

Usuário de teste não-admin criado via `POST /api/users` público + admin
approve, e removido ao fim (`DELETE FROM users` no mesmo lote).

---

## Fase 2.3 — RBAC em rotas de Logística (2026-05-28)

### Objetivo
Aplicar autorização por papel nas rotas operacionais de escrita do
módulo Logística: apenas usuários com role admin OU logística podem
criar/editar viagens, motoristas, veículos, docas e vínculos
trip↔ordem-de-carregamento.

### Não alterado
- Banco intocado. Sem migration. Sem seed.
- Role `Gestor Logistica` **não renomeada** no banco.
- Sem novas roles criadas. `permissions`/`role_permissions` não
  consumidas em runtime.
- Sidebar, ProtectedRoute, ProtectedRoute consumers, payloads — intactos.
- GETs de logística continuam apenas `requireAuth`:
  `/api/trips`, `/api/trips/:id`, `/api/drivers`, `/api/vehicles`,
  `/api/docks`, `/api/loading-orders/:id/trips`.

### Aliases/canonização criados — `shared/roles.ts`
- Adicionado `ROLES.LOGISTICA = "logistica"`.
- `ROLE_ALIASES[ROLES.LOGISTICA]` reconhece (case-insensitive via
  `normalizeRoleName`):
  - `"logistica"`
  - `"logística"` (acentuado)
  - `"gestor logistica"` (nome real do seed)
  - `"gestor logística"` (variante acentuada)
- `isAdminRoleName`, `rolesMatch`, `requireAdmin` e o alias
  `admin ↔ adm` preservados intactos.

### Rotas que receberam `requireAnyRole([ROLES.ADMIN, ROLES.LOGISTICA])`
10 rotas de escrita:

| Método | Rota | Notas |
|---|---|---|
| POST | `/api/trips` | Inline `if (!isAuthenticated)` substituído pelo middleware (mesma resposta 401) |
| PATCH | `/api/trips/:id` | Idem; `canEditResource(currentTrip.createdBy)` **preservado** após o gate de role |
| POST | `/api/trips/bulk` | — |
| POST | `/api/drivers` | — |
| PATCH | `/api/drivers/:id` | — |
| POST | `/api/drivers/:id/cnh-upload` | Middleware aplicado antes de `upload.single("file")` |
| POST | `/api/vehicles` | — |
| POST | `/api/docks` | — |
| POST | `/api/loading-orders/:id/trips` | Vínculo trip↔LO |
| DELETE | `/api/loading-orders/:id/trips` | Desvínculo trip↔LO |

### Rotas analisadas e propositalmente NÃO alteradas
- **Vehicles PATCH/DELETE, Docks PATCH/DELETE**: não existem no
  back-end hoje. Nada a fazer.
- **DELETE `/api/drivers/:id`**: permanece `requireAdmin` da Fase 2.1
  (delete de motorista segue admin-only).
- **Loading orders escrita "central"**: `POST /api/loading-orders`,
  `PATCH /api/loading-orders/:id`, `POST /api/loading-orders/:id/items`,
  approve/disapprove/mark-ready → escopo de fase posterior (misturam
  logística, almoxarifado e aprovação).
- **Movimentações, devoluções, requisições, produtos, kits,
  relatórios** → fora do escopo.
- **GETs** de logística → permanecem `requireAuth`.

### Validações
- `npm run check` → **exit 0**
- `npm run build` → ✅ `dist/index.js 269.6kb`

### Smoke tests executados

**Anônimo (esperado 401):**
- `POST /api/trips` → 401 ✓
- `POST /api/drivers` → 401 ✓
- `POST /api/vehicles` → 401 ✓
- `POST /api/docks` → 401 ✓

**Admin (`admin`/`admin123`):**
- `GET /api/user` → `isAdmin=true, roles=["Adm"]` ✓
- `DELETE /api/drivers/:id` → 204 ✓ (admin-only preservado)
- `PATCH /api/trips/:id` (sem ser owner) → 200 ✓ (admin override
  contornando ownership)

**Usuário com role `Gestor Logistica` (criado via
`POST /api/users` público + admin approve + `INSERT INTO user_roles`,
removido ao fim):**
- `GET /api/user` → `isAdmin=false, roles=["Gestor Logistica"]` ✓
  (confirmando que `"Gestor Logistica"` é reconhecido como
  `"logistica"` canônico pelas `requireAnyRole(...)` que aceitam ambos)
- `POST /api/drivers` → 201 ✓
- `PATCH /api/drivers/:id` → 200 ✓
- `POST /api/vehicles` → 201 ✓
- `POST /api/docks` → 201 ✓
- `POST /api/trips` → 201 ✓
- `PATCH /api/trips/:id` (own) → 200 ✓
- `POST /api/loading-orders/:id/trips` (LO fake) → 400 ✓ (role gate
  passou; 400 vindo da validação do corpo, não do RBAC)
- `POST /api/drivers/:id/cnh-upload` → role gate funcionando
- `DELETE /api/drivers/:id` → **403** ✓ (`"Apenas administradores
  podem excluir motoristas"`) — admin-only preservado.

**Usuário logística NÃO-owner (ownership preservada):**
- OWNER (logística) `PATCH /api/trips/:id` da própria trip → 200 ✓
- OTHER (logística, não-owner) `PATCH /api/trips/:id` → **403**
  ✓ (`"Apenas o criador pode editar esta viagem"`) — confirmando que
  `canEditResource` continua sendo aplicado após o role gate.
- ADMIN `PATCH /api/trips/:id` (não-owner) → 200 ✓

**Usuário SEM role logística (criado + aprovado + sem
`INSERT user_roles`, removido ao fim):**
- `POST /api/trips` → 403 ✓ (`"Apenas administradores ou logística
  podem criar viagens"`)
- `POST /api/drivers` → 403 ✓
- `POST /api/vehicles` → 403 ✓
- `POST /api/docks` → 403 ✓
- `POST /api/trips/bulk` → 403 ✓
- `POST /api/drivers/:id/cnh-upload` → 403 ✓

### Confirmações exigidas pelo spec
- ✅ `"Gestor Logistica"` reconhecido como `"logistica"` (verificado
  via login real do usuário com essa role, que conseguiu
  POST/PATCH em todos os endpoints protegidos).
- ✅ `DELETE /api/drivers/:id` continua admin-only (logística 403,
  admin 204).
- ✅ Front-end, banco, seed, `permissions`/`role_permissions` não
  foram alterados.
- ✅ Ownership (`canEditResource`) preservada em `PATCH /api/trips/:id`.

### Limitações de smoke
- `pftelles` (real holder de `Gestor Logistica` no seed) não foi
  usado: senha real desconhecida e spec proíbe alteração de senha
  de usuário real. Em vez disso, criamos usuários transientes via
  fluxo público (`POST /api/users` + admin approve), atribuímos a
  role real via `INSERT INTO user_roles`, executamos os smokes e
  removemos com `DELETE` (banco preservado). Isso prova que o
  canonical match contra o nome real da role no banco funciona.

---

## Fase 2.3.1 — Front-end alinhado ao RBAC (2026-05-28)

**Objetivo**: alinhar a UI ao gating já existente no back-end (Fases 2.2 e
2.3), escondendo afordâncias administrativas e de escrita logística para
quem não tem a role, **sem mexer em banco, seed, schema ou rotas**. Só
UX defensiva — o back continua sendo a fonte da verdade.

### Princípios
- **Não esconder listas.** Catálogos operacionais (veículos, motoristas,
  docas) continuam visíveis para qualquer usuário logado — eles
  alimentam fluxos do dia a dia. O que esconde são os botões/dialogs
  de criar/editar/excluir e os menus puramente administrativos.
- **Não duplicar regra.** O helper FE consome `ROLES` e `rolesMatch` de
  `shared/roles.ts`. Não há "isAdmin" reescrito no client.
- **Single source of truth no payload.** O `GET /api/user` já devolve
  `roles: string[]` e `isAdmin: boolean` (computados via
  `isAdminRoleName` no servidor). O front confia em `isAdmin` e
  apenas faz fallback alias-aware se o flag estiver ausente.
- **Defesa em profundidade.** Cada esconde-botão é redundância visual
  sobre o 403 do back. Bypass via DevTools/HTTP continua bloqueado
  pelas Fases 2.2/2.3.

### Entregas

**Helper FE de roles** (`client/src/lib/authz.ts`):
- `AuthUserLike` (shape permissivo aceita `useAuth().user` direto).
- `userIsAdmin(user)` — usa `user.isAdmin` quando presente; fallback
  scaneia `user.roles` com `rolesMatch(..., ROLES.ADMIN)`.
- `userHasRoleName(user, name)`, `userHasAnyRoleName(user, names)`.
- `userIsLogistica(user)`.
- `userCanWriteLogistics(user)` — mirror de
  `requireAnyRole([ADMIN, LOGISTICA])` do back.

**Tipo do payload de auth** (`client/src/hooks/use-auth.tsx`):
- Exportado `AuthUser = Omit<User,"password"> & { roles: string[]; isAdmin: boolean }`.
- `useQuery` agora tipado com `AuthUser` (antes era só `Omit<User,"password">`,
  mascarando os campos extras que o `/api/user` já entrega).

**`ProtectedRoute` com gate opcional** (`client/src/lib/protected-route.tsx`):
- Nova prop `requireAdmin?: boolean` (default `false`).
- Quando ligada e o usuário logado não é admin, renderiza uma tela
  amigável `<AccessDenied />` (Card shadcn, ícone `ShieldAlert`, link
  "Voltar ao Dashboard") em vez de redirect. Loading e
  not-authenticated continuam idênticos.

**Rotas admin-only no router** (`client/src/App.tsx`):
- `requireAdmin` aplicado em: `/config/users`, `/config/roles`,
  `/config/vehicle-types`, `/config/movement-groups`,
  `/config/movement-types`, `/config/product-statuses`,
  `/config/locations`.
- **Sem** `requireAdmin` em: `/config/vehicles`, `/config/drivers`,
  `/config/docks` (catálogos operacionais — qualquer logado vê a
  listagem; só o botão de escrita é gated).

**Sidebar filtrada** (`client/src/components/app-sidebar.tsx`):
- `ConfigItem` ganhou `adminOnly?: boolean`. Marcados como adminOnly:
  Usuários, Papéis e Permissões, Tipos de Veículos, Status de
  Produtos, Localizações.
- `visibleConfigItems = configItems.filter(...)` aplica o filtro
  contra `userIsAdmin(user)`.
- Bloco "Tipos de Movimentação" envolto em `{isAdmin && (...)}`.

**Páginas de logística com botões de escrita escondidos para
não-logística**:
- `pages/trips.tsx`: botão "Planejar Viagem" (header + empty-state),
  card clicável e calendar entry só ficam interativos quando
  `userCanWriteLogistics(user)`. Para não-logística os cards
  perdem `hover-elevate cursor-pointer` e `onClick`.
- `pages/drivers.tsx`: "Novo Motorista" e "Editar" gated por
  `canWrite`. "Excluir" gated por `isAdmin` (espelha
  `DELETE /api/drivers/:id` que continua admin-only).
- `pages/vehicles.tsx`: "Editar" e "Excluir" gated por `canWrite`.
- `pages/docks.tsx`: "Nova Doca" (DialogTrigger) gated por `canWrite`.
- `pages/trip-upload.tsx`: botão "Importar" recebe `!canWrite` no
  `disabled` (mantém o resto da página utilizável para inspecionar
  planilhas).
- `components/loading-order-dialog.tsx`: seção "Viagens" (vincular/
  desvincular) escondida quando `!canLinkTrips`. As demais seções
  do dialog ficam intactas — o gate cobre só o slice que mapeia
  para `POST/DELETE /api/loading-orders/:id/trips` (Fase 2.3).

### Não tocados
- Back-end, banco, migrations, seed, schema, `permissions`/
  `role_permissions`.
- Páginas e ações de requests, loading-orders (fora vínculo de
  viagens), movements, returns, reports, products, kits, suppliers,
  events — escopo de fases posteriores.
- Auto-cadastro público (`POST /api/users`), login, logout,
  password-reset.

### Validação
- `npm run check` zerado (front + back).
- `npm run build` passando.
- `GET /api/user` já entregava `roles`/`isAdmin` desde a Fase 2.1
  (confirmado em `server/auth.ts`); o tipo agora está refletido no
  client.

### Limitação conhecida
- A defesa de UI é "best effort": basta um usuário desativar
  JavaScript ou abrir as rotas direto para ver listas. Toda escrita
  efetiva continua barrada no back pelas Fases 2.2/2.3. Esconder
  botão **não é** controle de acesso — é redução de ruído.

---

## Fase 2.4 — RBAC em Catálogo/Estoque base (2026-05-28)

**Objetivo**: tornar escrita de Produtos, Kits e Fornecedores admin-only,
mantendo leitura disponível a qualquer logado (alimenta dropdowns,
listagens e telas de consulta de toda a aplicação).

### Back-end (`server/routes.ts`)

Aplicado `requireAdmin({ message: "Apenas administradores podem gerenciar {produtos|kits|fornecedores}" })` em **9 rotas de escrita**:

- `POST /api/products`
- `POST /api/products/bulk`
- `PATCH /api/products/:id`
- `PUT /api/products/:id/image` (removido check inline `isAuthenticated`)
- `POST /api/kits`
- `PATCH /api/kits/:id`
- `PUT /api/kits/:id/image` (removido check inline `isAuthenticated`)
- `POST /api/suppliers`
- `PATCH /api/suppliers/:id`

`DELETE /api/suppliers/:id` já era admin-only desde a Fase 2.1. Não há
DELETE de products/kits no código. GETs (`/api/products`, `/api/kits`,
`/api/suppliers`, `:id`, `by-sku`, `target`, `recent`, `bom`,
`recent-suppliers`) permanecem `requireAuth` — qualquer logado lê.

### Front-end (UX defensiva, back continua fonte da verdade)

- `pages/products.tsx`: botão "Adicionar Produto" (header + empty-state)
  e card `onClick`/`hover-elevate`/`cursor-pointer` gated por
  `canWrite = userIsAdmin(user)`. Cards continuam visíveis para todos.
- `pages/kits.tsx`: botões "Criar Kit" (header + empty-state),
  `button-configure-${id}` e card `onClick`/`hover-elevate` gated.
- `pages/suppliers.tsx`: `DialogTrigger` "Novo Fornecedor", botões
  Editar/Excluir por linha gated. Tabela continua visível para todos.
- `pages/product-upload.tsx`: botão "Importar" recebe `!canWrite` no
  `disabled` (preview/parse continuam disponíveis para inspecionar).
- `components/app-sidebar.tsx`: item "Upload em Lote" (`/products/upload`)
  ganhou `adminOnly: true` e é filtrado para não-admins. "Kits & BOM",
  "Listagem", "Variantes", "Fornecedores" continuam visíveis para todos.
- `components/{product-dialog,kit-dialog}.tsx`: não tocados — só são
  abertos pelos botões já gated nas páginas pai.

### Não tocados

- Banco, migrations, seed, schema, `permissions`/`role_permissions`.
- Nenhum novo papel.
- Demais módulos (requests, loading-orders, trips, movements, returns,
  reports, events) — escopo de fases posteriores.

### Validação

- `npm run check` zerado.
- `npm run build` passando.
- Smoke (curl com sessão admin vs. usuário transiente sem role admin):
  - Anônimo em 7 escritas → 401 "Não autenticado".
  - Não-admin em `POST /api/products|kits|suppliers`, `POST /products/bulk`,
    `PATCH /api/{products,kits,suppliers}/:id`, `PUT /api/{products,kits}/:id/image`
    → 403 com mensagem pt-BR específica.
  - Não-admin em `GET /api/products|kits|suppliers` → 200.
  - Admin em `POST /api/suppliers` → 201.
- Usuário transiente (`smokefase24`) criado e removido após smoke;
  fornecedor de teste removido.

---

## Fase 2.4.1 — Padronização técnica pós-Catálogo (2026-05-28)

**Objetivo**: substituir o check inline `req.isAuthenticated()` por
`requireAuth` em duas rotas GET remanescentes, sem alterar comportamento
funcional, payload, permissões ou front-end. Consolida a recomendação do
code review da Fase 2.4.

### Back-end (`server/routes.ts`)

Trocado check inline por middleware `requireAuth`:
- `GET /api/suppliers/recent`
- `GET /api/products/:sku/recent-suppliers`

Bloco removido em cada uma (4 linhas):
```ts
if (!req.isAuthenticated()) {
  return res.status(401).json({ error: "Not authenticated" });
}
```

Substituído por `requireAuth` como 2º argumento. Mensagem de 401 passa
de `"Not authenticated"` (en) para `"Não autenticado"` (pt-BR) —
consistente com o resto das rotas internas, já normalizado nas Fases
1.1/2.2.

### Validação

- `npm run check` zerado.
- `npm run build` passando.
- Smoke (anônimo / usuário logado transiente / admin):
  - Anônimo em ambas → 401 `{"error":"Não autenticado"}`.
  - Logado e admin em `GET /api/products/:sku/recent-suppliers` → 200,
    payloads idênticos (diff vazio).
  - Logado e admin em `GET /api/suppliers/recent` → 404 (pré-existente,
    ver "Pendência" abaixo); payloads idênticos.
- Usuário transiente `smokefase241` criado e removido após smoke.

### Pendência pré-existente (fora do escopo desta fase)

`GET /api/suppliers/recent` (linha 406) é mascarado por
`GET /api/suppliers/:id` (linha 323), que casa primeiro com `"recent"`
como `:id` e retorna 404 via `storage.getSupplier`. Isto **não foi
introduzido** pela Fase 2.4.1 — o mesmo 404 ocorria antes da troca pelo
`requireAuth` (mesmo arquivo, mesma ordem). Correção (mover a rota mais
específica para antes da paramétrica) fica anotada para uma sub-fase
futura de cleanup/ordem de rotas, fora do escopo desta padronização
puramente técnica.

### Não tocado

Banco, seed, migrations, schema, payloads, demais endpoints,
front-end, sidebar, ProtectedRoute, roles, `permissions`/
`role_permissions`, requests, loading-orders, trips, movements,
returns, reports.

---

## Fase 2.4.2 — Ordem de rotas em Fornecedores + fix SQL pré-existente (2026-05-28)

**Objetivo**: corrigir bug pré-existente em que `GET /api/suppliers/recent`
retornava 404 porque a rota estava declarada **depois** de
`GET /api/suppliers/:id`, sendo mascarada pelo parâmetro paramétrico.
Identificado durante o smoke da Fase 2.4.1.

### Back-end

#### `server/routes.ts` — reordenação de rotas

`GET /api/suppliers/recent` (estava na linha 406, depois de
`/api/suppliers/:id` e dos handlers POST/PATCH/DELETE) foi movido para
**logo após** `GET /api/suppliers` e **antes** de
`GET /api/suppliers/:id`. Nova ordem:

1. `GET /api/suppliers`
2. `GET /api/suppliers/recent` ← **mais específica vem antes**
3. `GET /api/suppliers/:id`
4. `POST /api/suppliers` (requireAdmin)
5. `PATCH /api/suppliers/:id` (requireAdmin)
6. `DELETE /api/suppliers/:id` (requireAdmin)

Comentário inline adicionado: `// Specific routes MUST come before generic :id route`.

**Não alterado** no handler: query string, payload, `requireAuth`,
`requireAdmin`, mensagens de erro, código de status.

#### `server/storage.ts` — fix SQL latente em `getRecentSuppliers`

A reordenação expôs um bug que nunca havia executado (handler era
inalcançável). Erro Postgres `42P10`:
`for SELECT DISTINCT, ORDER BY expressions must appear in select list`.

Causa: `selectDistinct({ ownerName })` + `orderBy(desc(processedAt))` —
Postgres exige que toda coluna no ORDER BY apareça também no SELECT
DISTINCT.

**Fix mínimo** (preserva a semântica original "N nomes distintos mais
recentes"):
- `selectDistinct` → `select`
- adicionado `.groupBy(movementItems.ownerName)`
- `orderBy(desc(...))` → `orderBy(sql\`MAX(${processedAt}) DESC NULLS LAST\`)`

Mesma assinatura (`Promise<string[]>`), mesmo filtro WHERE, mesmo
mapeamento de retorno. Apenas a forma de deduplicar mudou de DISTINCT
para GROUP BY + MAX, que é o padrão SQL para "top N distintos por data
mais recente".

#### Auditoria rápida em Produtos

Verificada a ordem de `/api/products/by-sku/:sku`,
`/api/products/target/:sku`, `/api/products/:sku/recent-suppliers` e
`/api/products/:id`. **Sem risco**: `/api/products/:sku/recent-suppliers`
tem 2 segmentos após `/api/products`, enquanto `/api/products/:id` tem 1,
então `:id` não captura. Confirmado no smoke (200). Nenhuma reordenação
necessária em produtos.

### Validação

- `npm run check` zerado.
- `npm run build` passando (`dist/index.js 269.8kb`).
- Smoke (após restart do workflow para carregar novo storage):
  - Anônimo: `/suppliers/recent` 401, `/suppliers/:id` 401,
    `/products/:sku/recent-suppliers` 401.
  - Logado: `/suppliers/recent` **200** com payload `["R2R"]` (antes era
    404 → bug corrigido), `/suppliers/:id` 200, `/suppliers/nonexistent-id`
    404 com mensagem `"Supplier not found"` (comportamento preservado),
    `/products/:sku/recent-suppliers` 200.
  - Admin: idêntico a logado em `/suppliers/recent` (diff vazio).
- Usuário transiente `smokefase242` criado e removido após smoke.

### Não tocado

Banco, seed, migrations, schema, payloads, demais endpoints, front-end,
sidebar, ProtectedRoute, roles, `permissions`/`role_permissions`,
requests, loading-orders, trips, movements, returns, reports. Nenhum
RBAC novo. Nenhuma rota nova. Nenhuma alteração de mensagem.

---

## Fase 2.5.1 — RBAC em Ordens de Carregamento (2026-05-28)

**Objetivo**: fechar holes críticos abertos identificados na auditoria
da Fase 2.5 e aplicar RBAC mínimo em criação/edição/operação básica de
loading-orders, sem criar roles novas, sem alterar payloads, sem alterar
banco/seed/migration.

### Arquivos alterados

- `server/routes.ts` — 7 rotas de loading-orders.
- `server/routes-optimization.ts` — 1 rota (`POST /:id/optimize`).
- `client/src/pages/loading-orders.tsx` — UX defensiva (botão Nova
  Ordem, botão Edit por card).
- `client/src/components/loading-order-dialog.tsx` — submit do form
  gated por `userCanWriteLogistics`.
- `client/src/pages/loading-order-details.tsx` — botões Marcar como
  Pronta / Aprovar / Desaprovar gated por role.
- `client/src/components/loading-optimization-dialog.tsx` — botão
  Otimizar gated por `userCanWriteLogistics`.

### Rotas que receberam `requireAnyRole([ADMIN, LOGISTICA])`

| Método | Rota | Antes | Mensagem 403 |
|---|---|---|---|
| POST | `/api/loading-orders` | inline `req.isAuthenticated()` | "Apenas administradores ou logística podem gerenciar ordens de carregamento" |
| PATCH | `/api/loading-orders/:id` | inline `req.isAuthenticated()` + `canEditResource` | idem (ownership preservado após o role gate) |
| POST | `/api/loading-orders/:id/items` | `requireAuth` apenas | "Apenas administradores ou logística podem adicionar itens à ordem" |
| POST | `/api/loading-orders/:id/mark-ready` | **NENHUM** middleware (hole crítico) | "Apenas administradores ou logística podem marcar ordem como pronta" |
| POST | `/api/loading-orders/:id/optimize` | inline `if (!req.user)` + mensagem em inglês | "Apenas administradores ou logística podem executar otimizações" |

### Rotas que receberam `requireAdmin` (provisório)

| Método | Rota | Antes | Mensagem 403 |
|---|---|---|---|
| POST | `/api/loading-orders/:id/approve` | **NENHUM** middleware (hole crítico) | "Apenas administradores podem aprovar ou desaprovar ordens de carregamento" |
| POST | `/api/loading-orders/:id/disapprove` | **NENHUM** middleware (hole crítico) | idem |

**Motivo do admin-only provisório**: a role funcional natural para
aprovação seria "Supervisor/Aprovador", que **não existe no banco**.
Decisão D2/D3 da auditoria 2.5: não criar role nesta fase. Até existir
Supervisor (planejado para Fase 2.6), admin é o único papel autorizado
a aprovar/desaprovar.

### Regras de status preservadas (sem alterações)

- `mark-ready` exige `status='draft'`.
- `approve` exige `status='ready'`.
- `disapprove` exige `status='approved'`.
- `PATCH /:id` mantém bloqueio para `completed`/`cancelled` e para
  ordens com movimentos `in_progress`.
- `POST /:id/items` ganhou checagem nova mínima: bloqueia inserção de
  item em ordem `completed` ou `cancelled` (com mensagem pt-BR clara).
  Sem essa checagem, qualquer logística podia injetar item em ordem já
  encerrada. Nenhuma outra regra de consolidação foi alterada.

### Ownership preservado

- `PATCH /api/loading-orders/:id`: role gate → `canEditResource` (admin
  override, owner pode editar).
- `POST /api/loading-orders`: continua gravando `createdBy = req.user.id`.

### Front-end — UX defensiva (back continua a fonte da verdade)

- `loading-orders.tsx`:
  - Botão "Nova Ordem" (header) escondido se `!userCanWriteLogistics(user)`.
  - Botão "Nova Ordem" do empty-state idem.
  - Botão Edit do card idem.
  - Click no card (leitura/navegação) **mantido para qualquer logado**.
- `loading-order-dialog.tsx`:
  - `canEdit` agora exige `userCanWriteLogistics` **além** de
    `canEditData?.canEdit`.
  - Submit bloqueado com toast pt-BR se faltar a role.
  - Bloco "Viagens" já estava gated desde a Fase 2.3.1 (mantido).
- `loading-order-details.tsx`:
  - "Marcar como Pronta" escondido se não for Admin/Logística.
  - "Aprovar para Carga" e "Desaprovar" escondidos se não for Admin.
  - Leitura da página (cards, progresso, movimentos) mantida para
    qualquer logado.
- `loading-optimization-dialog.tsx`:
  - Botão "Otimizar" escondido se `!userCanWriteLogistics(user)`.
  - Resultados anteriores de otimização continuam visíveis para leitura.

Sidebar **não foi tocada** — leitura de loading-orders continua
permitida para todo logado.

### Resultado de `npm run check`

Zerado.

### Resultado de `npm run build`

Passou (`dist/index.js 271.4kb`).

### Smoke tests executados

**Personas**:
- `admin` (role real `Adm`, existente).
- `smk_log_*` (transiente, role `Gestor Logistica` via `INSERT
  user_roles`, deletado ao final).
- `smk_usr_*` (transiente, role `Usuario Requisitor`, deletado ao final).
- Anônimo (sem cookie).

**Anônimo** (todos retornaram **401 "Não autenticado"**):
- `POST /api/loading-orders`
- `PATCH /api/loading-orders/:id`
- `POST /api/loading-orders/:id/items`
- `POST /api/loading-orders/:id/mark-ready`
- `POST /api/loading-orders/:id/approve`
- `POST /api/loading-orders/:id/disapprove`
- `POST /api/loading-orders/:id/optimize`

**Admin**:
- `GET /api/loading-orders` → 200.
- `GET /api/loading-orders/:id` → 200.
- `POST /api/loading-orders/:id/optimize` → 404 (sem `vehicleTypeId` no
  body — comportamento de negócio preservado, role gate passou).

**Gestor Logistica** (`smk_log_*`):
- `GET /api/loading-orders` → 200.
- `POST /api/loading-orders` (body inválido) → 400 (validação Zod;
  role gate passou).
- `PATCH /api/loading-orders/:id` em ordem criada pelo admin → **403**
  (ownership bloqueia logística não-owner — exatamente como o padrão
  da Fase 2.3 em `PATCH /api/trips/:id`).
- `POST /api/loading-orders/:id/items` (body inválido) → 400
  (role gate passou; falhou na validação do item).
- `POST /api/loading-orders/:id/mark-ready` → **200** com payload
  `status: "ready"` (era a rota mais crítica: antes qualquer anônimo
  podia chamar).
- `POST /api/loading-orders/:id/approve` → **403** "Apenas
  administradores podem aprovar ou desaprovar ordens de carregamento".
- `POST /api/loading-orders/:id/disapprove` → **403** mesma mensagem.
- `POST /api/loading-orders/:id/optimize` → 404 (sem `vehicleTypeId`;
  role gate passou).

**Usuário comum** (`smk_usr_*`, role `Usuario Requisitor`):
- `GET /api/loading-orders` → **200**.
- `GET /api/loading-orders/:id` → **200**.
- `POST /api/loading-orders` → **403**.
- `PATCH /api/loading-orders/:id` → **403**.
- `POST /api/loading-orders/:id/items` → **403**.
- `POST /api/loading-orders/:id/mark-ready` → **403**.
- `POST /api/loading-orders/:id/approve` → **403**.
- `POST /api/loading-orders/:id/disapprove` → **403**.
- `POST /api/loading-orders/:id/optimize` → **403**.

Ordem de teste (`0f322024-...-TESTE`) restaurada para `status='draft'`
ao final. Usuários transientes deletados.

### Confirmações

- ✅ **Anônimo não consegue mais alterar status de ordem de
  carregamento.** Os três holes críticos (`mark-ready`, `approve`,
  `disapprove`) e o `optimize` estão fechados.
- ✅ `approve`/`disapprove` ficaram **admin-only provisoriamente** até
  existir role Supervisor/Aprovador (Fase 2.6).
- ✅ GETs de loading-orders continuam liberados para qualquer usuário
  logado (incluindo `Usuario Requisitor`).
- ✅ Banco, seed, migration, schema, payloads, endpoints,
  `permissions`/`role_permissions` **não foram alterados**.
- ✅ Nenhuma role nova foi criada.
- ✅ Nenhum `as any` foi introduzido.
- ✅ Algoritmo de otimização e persistência dos resultados intocados.
- ✅ `POST/DELETE /api/loading-orders/:id/trips` (já protegidos na
  Fase 2.3) intocados.
- ✅ Sidebar e ProtectedRoute intocados.
- ✅ Demais módulos (requests, movements, returns, products, kits,
  suppliers, trips, drivers, vehicles, docks, reports) intocados.

### Limitações conhecidas / dívida para a Fase 2.6

- Aprovação centralizada no admin é **conservadora**. A intenção é que
  exista um papel "Supervisor/Aprovador" que pegue essa
  responsabilidade. Quando a role for criada, basta trocar `requireAdmin`
  por `requireAnyRole([ADMIN, SUPERVISOR])` nas duas rotas.
- `POST /:id/items` provisoriamente em Logística. A intenção é
  migrar para `requireAnyRole([ADMIN, LOGISTICA, ALMOXARIFADO])` quando
  a role Almoxarifado for criada.
- Não há `DELETE /api/loading-orders/:id` no código; quando existir,
  deverá ser admin-only ou owner+admin.
- Mensagens internas em inglês remanescentes (`"Loading order not
  found"`, `"Only ready orders can be approved"`, etc.) **não foram
  padronizadas nesta fase** para manter o diff cirúrgico. Padronização
  pt-BR de mensagens internas fica como dívida menor.

---

## Fase 2.5.2 — Limpeza de documentação (2026-05-28)

**Escopo**: somente documentação. Nenhuma alteração funcional.

### Arquivos alterados

- `replit.md` — enxugado de 266 para ~90 linhas. Histórico detalhado por subfase removido (já consolidado nos changelogs). Mantidos: Overview, User Preferences, Estado Atual resumido, Histórico de Fases em formato bullet, System Architecture, External Dependencies, links para os documentos relacionados.
- `docs/RBAC-future-guide.md` — **novo**. Recebeu a seção "Guia de Implementação Futura: Sistema Avançado de Papéis e Permissões" que estava no final do `replit.md` (roadmap de longo prazo, não estado atual).
- `docs/CHANGELOG-fase2.md` — esta entrada.

### O que foi removido/resumido do replit.md

- Bloco "Recent Changes (2025-11-01)" sobre Ownership-Based Permissions → já coberto em `CHANGELOG-fase1.md`.
- Lista detalhada das sub-fases 1, 1.1 a 1.6 (linhas longas por subfase) → substituída por bullet resumido com link para `CHANGELOG-fase1.md`.
- Lista detalhada das sub-fases 2.0 a 2.5.1 + 2.2.1 (parágrafos extensos) → substituída por bullets curtos por subfase, todos com link para `CHANGELOG-fase2.md`.
- Seção "Guia de Implementação Futura" (≈ 160 linhas, roadmap de fases 3 a 6 ainda não implementadas) → movida integralmente para `docs/RBAC-future-guide.md`.

### O que foi preservado no replit.md

- Overview do projeto.
- User Preferences (comunicação simples, pt-BR).
- Estado Atual resumido (auth, ownership, RBAC, fonte única `isAdmin`, qualidade).
- Sumário cronológico de Fase 1 e Fase 2 (bullets de uma linha por subfase com link para o changelog).
- Próximas fases (2.6 + roadmap longo).
- System Architecture (UI/UX, Tech Implementations, Key Features, Design Choices).
- External Dependencies.
- Bloco "Documentos relacionados" com ponteiros.

### Informação movida de replit.md para outros arquivos

- "Guia de Implementação Futura: Sistema Avançado de Papéis e Permissões" → `docs/RBAC-future-guide.md` (preservado integralmente, sem corte). Conteúdo é roadmap futuro, não histórico — por isso foi para um doc próprio em vez de um changelog.
- Nenhuma informação detalhada de fases anteriores foi perdida: tudo que estava no `replit.md` já existia em `docs/CHANGELOG-fase1.md` ou `docs/CHANGELOG-fase2.md` em forma mais completa.

### Validação

- `npm run check` zerado.
- `npm run build` não foi executado (mudança é só documentação; build já estava passando na 2.5.1).
- Sem alterações em back-end, front-end, banco, seed, migration, schema, endpoints, payloads, permissões, roles, refator de código, `package.json`, ou CI.

### Confirmação de não-funcional

Nenhum `.ts`/`.tsx`/`.sql`/`.json` de código foi tocado. `git diff --stat` esperado apenas em `replit.md`, `docs/RBAC-future-guide.md` (novo) e `docs/CHANGELOG-fase2.md`.
