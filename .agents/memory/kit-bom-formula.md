---
name: Kit BOM formula expansion
description: How kit BOM line quantities are calculated — fixed vs variable formulas, semantics, and where the logic lives.
---

# Kit BOM formula expansion

## Semântica das fórmulas

- **Fórmula `"?"` (variável):** o valor em `kitParameters[productId]` é o **total absoluto** informado pelo usuário — NÃO deve ser multiplicado pelo número de kits. Exemplo: usuário pede 10 kits e informa 20 fechamentos → total = 20, não 200.
- **Demais fórmulas** (ex: `"4"`, `"qty*2"`): o resultado da fórmula é a quantidade **por kit** e é multiplicado pelo número de kits (`multiplier`).

**Por quê:** componentes variáveis são totais únicos para o pedido inteiro, não quantidades por unidade de kit.

**Como aplicar:** em `calcKitLineQty` (server/routes.ts), o branch `f === "?"` deve retornar `parameters[productId]` diretamente, sem multiplicar por `multiplier`.

## Duplicação — risco de divergência

A lógica de avaliação existe em dois lugares:
- **Server:** `calcKitLineQty` em `server/routes.ts` (endpoint materials-summary e expansão de loading orders)
- **Client:** `calcFinalQty` (dialog de adição de item ao carrinho da requisição)

Qualquer mudança na semântica de fórmula, substituição de parâmetros, arredondamento ou clamping deve ser espelhada nos dois pontos. Considerar extrair um helper compartilhado em `shared/` se voltar a divergir.
