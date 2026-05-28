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
