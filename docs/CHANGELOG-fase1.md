# Fase 1 — Endurecimento da base (CHANGELOG detalhado)

Histórico completo das sub-fases que estabilizaram autenticação, tipos e
qualidade do código antes da Fase 2 (matriz de papéis funcionais). O
`replit.md` mantém apenas o resumo executivo e aponta para este arquivo.

---

## Fase 1 — Autenticação nas rotas de escrita sensíveis (2026-05-27)

**Objetivo**: fechar rotas POST/PATCH/DELETE críticas que estavam abertas
ou com checagem condicional fraca, e introduzir ownership como base.

**Arquivos principais alterados**:
- `server/routes.ts`
- `server/storage.ts` (adicionado `getRequestItem(id)`)
- `server/ownership.ts` (criado: `canEditResource`, `canDeleteResource`,
  `isAdmin`, `getUserInfo`)
- Frontend: `client/src/pages/request-details.tsx` (mostra/oculta botões
  edit/delete via verificação de ownership)

**Resultado**:
- `DELETE /api/request-items/:id`: passa a exigir autenticação e checa
  ownership via lookup do request pai (só dono ou admin).
- `DELETE /api/suppliers/:id`: exige autenticação + admin.
- `DELETE /api/drivers/:id`: exige autenticação + admin.
- `PATCH /api/requests/:id`: removido o ownership condicional (que só
  rodava em status `draft`); agora valida sempre. Bloqueia transições
  diretas para `approved`/`rejected` — essas precisam ir pelas rotas
  dedicadas de approve/reject.
- `POST /api/requests/:id/items`: exige autenticação + ownership do
  request pai.
- Convertidos campos `requestedBy`/`createdBy` de texto para FK em
  `users.id` para suportar ownership consistente.
- Rotas POST passam a auto-popular o criador a partir do usuário
  autenticado.

**Validações**: smoke manual de cada rota com curl (admin, dono,
não-dono, anônimo).

**Observação**: este é o alicerce de ownership consumido por todas as
fases seguintes.

---

## Fase 1.1 — Proteção de rotas GET internas (2026-05-28, Lotes A + B)

**Objetivo**: fechar leitura interna que estava pública.

**Arquivos alterados**:
- `server/routes.ts`

**Resultado**:
- **Lote A**: `requireAuth` em 46 rotas GET (dashboard, eventos, kits,
  fornecedores, produtos, requisições, veículos, motoristas, docas,
  viagens, ordens de carregamento, movimentações, devoluções, usuários,
  papéis, permissões, otimizações, relatórios).
- **Lote B**: `GET /api/loading-orders/:id/can-edit` — última GET interna
  ainda pública — fechada.
- `/api/user` mantido inalterado (Passport interno).
- `/api/login`, `/api/register`, `/api/forgot-password`,
  `/api/reset-password` seguem públicas como esperado.

**Validações**: smoke anônimo → 401 em cada rota.

**Observação**: nenhuma alteração em banco, payloads, regras de negócio
ou front-end.

---

## Fase 1.2 — Correção de TypeScript no back-end (2026-05-28)

**Objetivo**: zerar erros de `npm run check` no server.

**Arquivos principais alterados**:
- `shared/schema.ts` (removido o `: any` da tabela `users`)
- `server/ownership.ts` (novo `type AuthUser = Omit<User, "password">`
  em `canEditResource`/`canDeleteResource`/`isAdmin`/`getUserInfo`)
- `server/routes-optimization.ts` (correções de tipos alinhadas ao
  schema real)

**Resultado**:
- **Causa raiz**: `export const users: any = pgTable(...)` poluía a
  inferência do Drizzle para todos os campos de `users` e tornava
  `db.insert(users).returning()` não iterável, quebrando vários pontos
  em `auth.ts`, `routes.ts` e `storage.ts`. Removido o `: any`.
- **Cascata exposta**: `req.user` é `Omit<User, "password">` (Passport
  retira a senha no serialize), mas funções em `ownership.ts` recebiam
  `User` completo. Tipo local `AuthUser` resolveu sem mudar call-sites.
- `routes-optimization.ts`:
  - `completedAt: true` → `completedAt: new Date()` em 4 pontos.
  - Colunas `decimal(...)` recebem strings via `.toFixed(2)`
    (`confidenceScore`, `utilizationPercentage`,
    `weightDistributionScore`, `totalDistanceKm`,
    `fuelEstimateLiters`). Payload de saída inalterado.
  - `arrivalTime` agora `.toISOString()`.
  - `.filter(Boolean)` → type predicate
    `.filter((x): x is string => x !== null)`.
  - `trip.unloadingLocation ?? undefined`.

**Validações**: `npm run check` zerado para server. Nenhum `any` ou
`as any` introduzido.

**Observação**: erros remanescentes no front-end ficaram para a Fase 1.3
por escopo declarado.

---

## Fase 1.3 — Correção de TypeScript no front-end (2026-05-28)

**Objetivo**: zerar erros de `npm run check` no client.

**Arquivos principais alterados**:
- `client/src/components/ObjectUploader.tsx` (exporta novo alias
  `ObjectUploaderResult = UploadResult<Meta, Record<string, never>>`)
- `client/src/components/kit-dialog.tsx`
- `client/src/components/product-dialog.tsx`
- `client/src/pages/dashboard.tsx`
- `client/src/pages/drivers.tsx`

**Resultado**:
- `ObjectUploader`: contrato do `onComplete` realinhado ao tipo emitido
  pelo Uppy (`UploadResult<Meta, Body>`). Consumidores (kit-dialog,
  product-dialog) atualizados para o novo alias. Lógica de
  `handleUploadComplete` intocada.
- `dashboard.tsx:213`: `<Button variant="link">` (variant inexistente)
  trocado para `variant="ghost"` + classes utilitárias preservando a
  aparência de link inline.
- `drivers.tsx`: `driverFormSchema = insertDriverSchema.extend({...})
  .omit({ id, createdAt })` re-omitia chaves que `insertDriverSchema` já
  omite, colapsando `DriverFormData` para `never` e propagando 9 erros
  nos `FormField name=...`. Removida a chamada `.omit` redundante.

**Validações**: `npm run check` zerado. Smoke confirma criação (201) e
edição (200) de driver.

**Observação**: nenhum `any`/`as any` novo, apenas um alias de tipo
exportado.

---

## Fase 1.4 — Correção de admin/isAdmin (2026-05-28)

**Objetivo**: corrigir 403 indevido em rotas admin-only para o usuário
admin.

**Arquivos principais alterados**:
- `server/ownership.ts` (`isAdmin`)
- `server/auth.ts` (`GET /api/user`)

**Resultado**:
- **Causa raiz**: a role administrativa no seed chama-se `Adm` (pt-BR) e
  está corretamente atribuída ao usuário `admin` via `user_roles`. O
  código comparava contra a literal `'admin'`, então `isAdmin` voltava
  `false` para o admin → 403 em qualquer rota admin-only e front-end
  inteiro sub-permissionado.
- **Correção**: comparação case-insensitive aceitando `'admin'` e
  `'adm'` em ambos os pontos. Nenhuma role nova concedida — só passa a
  honrar a role já atribuída.
- Auditada (sem remoção, fica para Fase 1.5) a existência de 3
  declarações de `GET /api/users` em `routes.ts` (linhas 1994, 2723 e
  3059). Express resolve a primeira, então 2723 e 3059 eram código
  morto.

**Validações**: anônimo `DELETE /api/drivers/:id` → 401; não-admin
(`Gestor Logistica`) → 403; admin → 204; admin `GET /api/user` →
`isAdmin:true`; CRUD de motorista pelo admin ok ponta-a-ponta.

**Observação**: nenhuma alteração em banco, migrations, payloads, rotas,
regras de negócio ou front-end.

---

## Fase 1.5 — Remoção de duplicação de `GET /api/users` e consolidação de `isAdmin` (2026-05-28)

**Objetivo**: eliminar código morto identificado na Fase 1.4 e ter uma
fonte única para a regra de admin, evitando drift futuro.

**Arquivos principais alterados**:
- `server/routes.ts` (removidas as 2 GET duplicadas; comentários `NOTE:`
  no lugar)
- `server/ownership.ts` (novo helper puro `isAdminRoleName(name)`)
- `server/auth.ts` (`GET /api/user` consome `isAdminRoleName` via
  `await import("./ownership")`)

**Resultado**:
- Removidas as 2 declarações inalcançáveis de `GET /api/users` (as que
  antes ficavam nas linhas 2723 e 3059). A rota ativa em
  `routes.ts:1994` (com `requireAuth`) é preservada e já devolve um
  superset dos campos exigidos por @mention e user-management.
- `GET /api/users/:id` (declarado uma única vez) preservado intacto.
- Nova função pura `isAdminRoleName(name)` em `ownership.ts`: sem DB,
  sem `req`, aceita `'admin'` e `'adm'` case-insensitive. Consumida por
  (a) `isAdmin()` no próprio `ownership.ts` e (b) `GET /api/user` em
  `auth.ts`.
- **Sem dependência circular**: antes da mudança, nem `auth.ts` nem
  `ownership.ts` se referenciavam. Agora `auth.ts` depende
  unidirecionalmente de `ownership.ts` via dynamic import (padrão já
  existente no mesmo handler).

**Validações** (smoke completo):
- Admin `GET /api/user` → `isAdmin:true`
- Admin `GET /api/users` → 200, 3 usuários, superset de campos
- Admin `GET /api/users/:id` → 200
- Admin `DELETE /api/drivers/:id` → 204
- Não-admin `GET /api/user` → `isAdmin:false`
- Não-admin `DELETE /api/drivers/:id` → 403
- Anônimo `GET /api/users` → 401
- Anônimo `GET /api/users/:id` → 401
- `npm run check` → exit 0
- `npm run build` → ok

**Observação**: nenhuma alteração em banco, migrations, payloads, nomes
de rotas, regras de negócio, front-end ou ownership de outras entidades.

---

## Fase 1.6 — CI básico e organização da documentação da Fase 1 (2026-05-28)

**Objetivo**: rede de segurança mínima antes da Fase 2 (typecheck +
build automáticos em push/PR) e consolidação do histórico das sub-fases
da Fase 1.

**Arquivos criados**:
- `.github/workflows/ci.yml` — workflow GitHub Actions rodando
  `npm ci` → `npm run check` → `npm run build` em push/PR nas branches
  `main`, `master` e `develop`.
- `docs/CHANGELOG-fase1.md` — este arquivo.

**Arquivos alterados**:
- `replit.md` — trimado: notas detalhadas das Fases 1.0–1.5
  substituídas por um resumo executivo apontando para este CHANGELOG.

**Resultado**:
- Toda alteração futura passa por typecheck e build automaticamente.
- `replit.md` volta a caber confortavelmente no contexto.
- Scripts do `package.json` (`dev`, `build`, `start`, `check`,
  `db:push`) preservados intactos — nenhum script novo foi criado.

**Validações**:
- `npm run check` → exit 0
- `npm run build` → ok
- YAML do workflow conferido por parsing.

**Observação**: nenhuma alteração em código de aplicação, banco,
migrations, endpoints, payloads, autenticação, permissões, front-end ou
layout.
