# Sistema de Produtos com Variantes e Equivalências - Plano de Implementação

## 📋 Visão Geral

Implementar um sistema que permita rastrear produtos próprios vs produtos locados/consignados, mantendo contabilização unificada nas ordens de carregamento através de equivalência de SKUs.

## 🎯 Objetivos

1. **Compatibilidade**: Ordens continuam usando SKUs principais (genéricos)
2. **Rastreabilidade**: Sistema registra SKU real escaneado e proprietário
3. **Simplicidade**: Operador escaneia qualquer SKU e sistema resolve automaticamente
4. **Auditoria**: Histórico completo de material próprio vs terceiros

## 🏗️ Estrutura de Dados

### Produtos Atuais (Já Existem)
```typescript
products {
  id: string
  sku: string (unique)
  name: string
  ownership: 'owned' | 'rented' | 'third_party'
  requiresSupplier: boolean  // ✅ JÁ EXISTE
  equivalentSku: string      // ✅ JÁ EXISTE (para linkar variantes)
  ...
}
```

### Mudanças Necessárias

#### 1. Adicionar Enum de Tipo de Produto
```sql
-- Migration
CREATE TYPE product_type AS ENUM ('principal', 'variante');

ALTER TABLE products 
ADD COLUMN product_type product_type NOT NULL DEFAULT 'principal';

-- Índice para performance
CREATE INDEX idx_products_equivalent_sku ON products(equivalent_sku) 
WHERE equivalent_sku IS NOT NULL;
```

#### 2. Atualizar Schema TypeScript
```typescript
// shared/schema.ts
export const productTypeEnum = pgEnum('product_type', ['principal', 'variante']);

export const products = pgTable("products", {
  // ... campos existentes
  productType: productTypeEnum("product_type").notNull().default("principal"),
  requiresSupplier: boolean("requires_supplier").notNull().default(false),
  equivalentSku: text("equivalent_sku"), // SKU do produto principal
});
```

#### 3. Adicionar Campos de Proprietário nos Itens de Movimento
```typescript
// shared/schema.ts
export const movementItems = pgTable("movement_items", {
  // ... campos existentes
  scannedSku: text("scanned_sku"), // SKU real que foi escaneado
  ownerName: text("owner_name"),   // Nome do proprietário/fornecedor
  ownerType: text("owner_type"),   // 'proprio', 'locado', 'consignado'
});
```

## 🔄 Lógica de Negócio

### Fluxo de Carregamento

#### 1. Escaneamento de Produto
```typescript
// Quando operador escaneia um SKU
async function handleProductScan(scannedSku: string) {
  // 1. Buscar produto pelo SKU escaneado
  const product = await getProductBySku(scannedSku);
  
  if (!product) {
    throw new Error("Produto não encontrado");
  }
  
  // 2. Determinar SKU a ser contabilizado
  const targetSku = product.productType === 'variante' 
    ? product.equivalentSku 
    : product.sku;
  
  // 3. Verificar se produto está na ordem
  const orderItem = loadingOrderItems.find(item => item.productSku === targetSku);
  
  if (!orderItem) {
    throw new Error("Produto não está na ordem de carregamento");
  }
  
  // 4. Abrir modal apropriado
  if (product.requiresSupplier) {
    openSupplierModal(product, targetSku);
  } else {
    openSimpleModal(product, targetSku);
  }
}
```

#### 2. Modal Simples (Produto Próprio)
```typescript
interface SimpleModalProps {
  product: Product;
  targetSku: string;
  onConfirm: (data: {
    quantity: number;
  }) => void;
}

// UI:
// 🟢 PRÓPRIO
// BTQ30_3000 - Box Truss Q30 3000mm
// Quantidade: [___]
// [Confirmar]
```

#### 3. Modal com Fornecedor (Produto Locado)
```typescript
interface SupplierModalProps {
  product: Product;
  targetSku: string;
  equivalentProduct: Product; // Produto principal
  onConfirm: (data: {
    quantity: number;
    ownerName: string;
    ownerType: 'locado' | 'consignado';
  }) => void;
}

// UI:
// 🟡 LOCADO
// BTQ30_3000_LOC - Box Truss Q30 3000mm (Locado)
// Contabilizado como: BTQ30_3000
// Quantidade: [___]
// Proprietário: [Dropdown com últimos usados + cadastrados] *obrigatório
// Tipo: [Locado/Consignado]
// ⚠️ Obrigatório para rastreamento de material de terceiros
// [Confirmar] (desabilitado se proprietário vazio)
```

#### 4. Criação do Item de Movimento
```typescript
async function createMovementItem(data: {
  movementId: string;
  productId: string;      // ID do produto principal
  scannedSku: string;     // SKU que foi escaneado
  quantity: number;
  ownerName?: string;
  ownerType?: string;
}) {
  // Criar item apontando para o produto principal
  const item = await db.insert(movementItems).values({
    movementId: data.movementId,
    productId: data.productId,  // Sempre o ID do produto principal
    scannedSku: data.scannedSku, // SKU real escaneado
    quantity: data.quantity,
    ownerName: data.ownerName,
    ownerType: data.ownerType || 'proprio',
  });
  
  return item;
}
```

## 🖥️ Interface do Usuário

### 1. Painel da Ordem (Esquerdo)
```typescript
// Mostra produtos PRINCIPAIS da ordem
interface OrderPanelItem {
  productSku: string;        // BTQ30_3000
  productName: string;
  expectedQuantity: number;  // 40
  loadedQuantity: number;    // 25 (soma de todos os SKUs equivalentes)
  progress: number;          // 62.5%
  status: 'pending' | 'complete' | 'excess';
}

// UI:
// BTQ30_3000 - Box Truss Q30 3000mm
// [=========>        ] 25/40 (62.5%)
// Faltam 15 unidades
```

### 2. Painel de Itens Carregados (Direito)
```typescript
// Mostra itens REAIS escaneados
interface LoadedItem {
  scannedSku: string;        // BTQ30_3000_LOC
  productName: string;
  quantity: number;          // 10
  ownerType: 'proprio' | 'locado' | 'consignado';
  ownerName?: string;        // "Fornecedor XYZ"
  targetSku: string;         // BTQ30_3000 (para qual produto da ordem conta)
}

// UI:
// 🟢 BTQ30_3000 - 15x (Próprio)
// 🟡 BTQ30_3000_LOC - 10x (Locado - Fornecedor XYZ)
// 💡 Total para BTQ30_3000: 25 unidades
// [Editar] [Remover]
```

### 3. Agrupamento Visual
```typescript
// Agrupar itens pelo SKU alvo
const groupedItems = loadedItems.reduce((acc, item) => {
  const key = item.targetSku;
  if (!acc[key]) acc[key] = [];
  acc[key].push(item);
  return acc;
}, {});

// Renderizar agrupado:
// BTQ30_3000 (25 unidades total)
//   ├─ 🟢 15x Próprio
//   └─ 🟡 10x Locado (Fornecedor XYZ)
```

## 📊 Queries e Performance

### 1. Buscar Produto Principal a partir de Variante
```typescript
async function getTargetProduct(scannedSku: string): Promise<Product> {
  const product = await db.query.products.findFirst({
    where: eq(products.sku, scannedSku)
  });
  
  if (!product) {
    throw new Error("Produto não encontrado");
  }
  
  // Se for variante, buscar o principal
  if (product.productType === 'variante' && product.equivalentSku) {
    const principal = await db.query.products.findFirst({
      where: eq(products.sku, product.equivalentSku)
    });
    
    if (!principal) {
      throw new Error("Produto principal não encontrado");
    }
    
    return principal;
  }
  
  return product;
}
```

### 2. Calcular Progresso da Ordem
```typescript
async function getOrderProgress(loadingOrderId: string) {
  // 1. Buscar itens esperados da ordem
  const orderItems = await db.query.loadingOrderItems.findMany({
    where: eq(loadingOrderItems.loadingOrderId, loadingOrderId),
    with: { product: true }
  });
  
  // 2. Buscar todos os movimentos da ordem
  const movements = await getMovementsByLoadingOrder(loadingOrderId);
  
  // 3. Buscar todos os itens de movimento
  const allMovementItems = await Promise.all(
    movements.map(m => getMovementItems(m.id))
  );
  
  // 4. Agrupar por produto principal
  const loadedByProduct = allMovementItems.flat().reduce((acc, item) => {
    const key = item.productId; // Sempre aponta para o principal
    acc[key] = (acc[key] || 0) + item.quantity;
    return acc;
  }, {} as Record<string, number>);
  
  // 5. Calcular progresso
  return orderItems.map(orderItem => ({
    productId: orderItem.productId,
    productSku: orderItem.product.sku,
    productName: orderItem.product.name,
    expected: orderItem.quantity,
    loaded: loadedByProduct[orderItem.productId] || 0,
    progress: ((loadedByProduct[orderItem.productId] || 0) / orderItem.quantity) * 100,
    status: calculateStatus(orderItem.quantity, loadedByProduct[orderItem.productId] || 0)
  }));
}
```

### 3. Histórico de Fornecedores
```typescript
// Buscar fornecedores usados recentemente
async function getRecentSuppliers(limit = 10): Promise<string[]> {
  const recent = await db
    .selectDistinct({ ownerName: movementItems.ownerName })
    .from(movementItems)
    .where(
      and(
        isNotNull(movementItems.ownerName),
        ne(movementItems.ownerType, 'proprio')
      )
    )
    .orderBy(desc(movementItems.processedAt))
    .limit(limit);
  
  return recent.map(r => r.ownerName).filter(Boolean);
}
```

## 📈 Relatórios e Auditoria

### 1. Relatório por Evento
```sql
-- Material próprio vs locado por evento
SELECT 
  e.name as evento,
  p.sku as produto,
  p.name as produto_nome,
  mi.owner_type as tipo,
  mi.owner_name as fornecedor,
  SUM(mi.quantity) as quantidade_total
FROM movement_items mi
JOIN movements m ON mi.movement_id = m.id
JOIN movement_events me ON m.id = me.movement_id
JOIN events e ON me.event_id = e.id
JOIN products p ON mi.product_id = p.id
WHERE e.id = :eventId
GROUP BY e.name, p.sku, p.name, mi.owner_type, mi.owner_name
ORDER BY p.sku, mi.owner_type;
```

### 2. Relatório por Fornecedor
```sql
-- Uso de material por fornecedor
SELECT 
  mi.owner_name as fornecedor,
  COUNT(DISTINCT m.id) as movimentacoes,
  COUNT(DISTINCT mi.product_id) as produtos_diferentes,
  SUM(mi.quantity) as quantidade_total,
  MIN(mi.processed_at) as primeira_utilizacao,
  MAX(mi.processed_at) as ultima_utilizacao
FROM movement_items mi
JOIN movements m ON mi.movement_id = m.id
WHERE mi.owner_type IN ('locado', 'consignado')
GROUP BY mi.owner_name
ORDER BY quantidade_total DESC;
```

### 3. Rastreamento Completo
```sql
-- Rastreamento de item específico
SELECT 
  mi.scanned_sku as sku_escaneado,
  p.sku as sku_contabilizado,
  mi.quantity,
  mi.owner_type,
  mi.owner_name,
  mi.processed_at,
  u.name as usuario,
  m.movement_number,
  e.name as evento
FROM movement_items mi
JOIN movements m ON mi.movement_id = m.id
JOIN products p ON mi.product_id = p.id
LEFT JOIN users u ON m.created_by = u.id
LEFT JOIN movement_events me ON m.id = me.movement_id
LEFT JOIN events e ON me.event_id = e.id
WHERE mi.scanned_sku = :sku
ORDER BY mi.processed_at DESC;
```

## 🔧 Configuração e Manutenção

### 1. Cadastro de Produto Variante

```typescript
// Interface de cadastro
interface ProductVariantForm {
  name: string;
  sku: string;              // BTQ30_3000_LOC
  principalSku: string;     // BTQ30_3000
  ownership: 'rented' | 'third_party';
  requiresSupplier: true;   // Sempre true para variantes
  productType: 'variante';  // Sempre variante
  // ... outros campos copiados do principal
}

// Validação
async function validateVariant(data: ProductVariantForm) {
  // 1. Verificar se SKU principal existe
  const principal = await getProductBySku(data.principalSku);
  if (!principal) {
    throw new Error("Produto principal não encontrado");
  }
  
  // 2. Verificar se principal é realmente principal
  if (principal.productType !== 'principal') {
    throw new Error("Produto referenciado não é um produto principal");
  }
  
  // 3. Verificar unicidade do SKU
  const existing = await getProductBySku(data.sku);
  if (existing) {
    throw new Error("SKU já cadastrado");
  }
  
  return true;
}
```

### 2. Interface de Gestão de Equivalências

```typescript
// Página de configuração: /config/product-variants
// Lista todos os produtos principais e suas variantes

interface ProductWithVariants {
  principal: Product;
  variants: Product[];
}

// UI:
// BTQ30_3000 - Box Truss Q30 3000mm
//   ├─ BTQ30_3000_LOC (Locado)
//   ├─ BTQ30_3000_CONS (Consignado)
//   └─ [+ Adicionar Variante]
```

## ⚠️ Validações e Regras

### 1. Validação no Escaneamento
```typescript
const validations = {
  // Produto deve existir
  productExists: (sku: string) => !!getProductBySku(sku),
  
  // Se for variante, principal deve existir
  principalExists: (product: Product) => {
    if (product.productType === 'variante') {
      return !!getProductBySku(product.equivalentSku);
    }
    return true;
  },
  
  // Produto (ou equivalente) deve estar na ordem
  inOrder: (targetSku: string, orderItems: LoadingOrderItem[]) => {
    return orderItems.some(item => item.product.sku === targetSku);
  },
  
  // Se requer fornecedor, deve informar
  supplierRequired: (product: Product, ownerName?: string) => {
    if (product.requiresSupplier) {
      return !!ownerName && ownerName.trim().length > 0;
    }
    return true;
  }
};
```

### 2. Validação na Criação de Variante
```typescript
const variantRules = {
  // Variante sempre requer fornecedor
  requiresSupplier: true,
  
  // Variante deve ter equivalentSku
  hasEquivalentSku: (data: ProductVariantForm) => !!data.principalSku,
  
  // Principal deve existir e ser do tipo principal
  validPrincipal: async (principalSku: string) => {
    const product = await getProductBySku(principalSku);
    return product && product.productType === 'principal';
  },
  
  // SKU único
  uniqueSku: async (sku: string) => {
    const existing = await getProductBySku(sku);
    return !existing;
  }
};
```

## 🚀 Ordem de Implementação

### Fase 1: Infraestrutura (Backend)
1. ✅ Criar migration para adicionar `product_type` enum
2. ✅ Atualizar schema TypeScript com novo campo
3. ✅ Adicionar campos `scannedSku`, `ownerName`, `ownerType` em `movementItems`
4. ✅ Criar migration para índices de performance
5. ✅ Atualizar tipos TypeScript e Zod schemas

### Fase 2: Lógica de Negócio
1. ✅ Implementar função `getTargetProduct()` para resolver equivalências
2. ✅ Atualizar `createMovementItem()` para aceitar campos de proprietário
3. ✅ Implementar query `getRecentSuppliers()`
4. ✅ Atualizar cálculo de progresso para somar variantes

### Fase 3: Interface - Modal de Confirmação
1. ✅ Criar componente `ProductConfirmModal` com duas variantes
2. ✅ Implementar detecção automática de tipo ao escanear
3. ✅ Adicionar dropdown de fornecedores com sugestões
4. ✅ Implementar validação obrigatória de fornecedor

### Fase 4: Interface - Painéis
1. ✅ Atualizar painel da ordem para mostrar total consolidado
2. ✅ Atualizar painel de itens carregados com badges de tipo
3. ✅ Implementar agrupamento visual por produto principal
4. ✅ Adicionar indicadores 🟢 próprio / 🟡 locado / 🔵 consignado

### Fase 5: Gestão de Produtos
1. ✅ Criar página `/config/product-variants`
2. ✅ Implementar CRUD de produtos variantes
3. ✅ Adicionar validações de equivalência
4. ✅ Interface para visualizar árvore principal→variantes

### Fase 6: Relatórios
1. ✅ Criar relatório de material próprio vs locado por evento
2. ✅ Criar relatório de uso por fornecedor
3. ✅ Adicionar filtros por tipo de propriedade
4. ✅ Exportação para Excel com detalhamento

## 📝 Notas de Implementação

### Backward Compatibility
- Produtos existentes: `productType = 'principal'` por padrão
- Itens de movimento existentes: `ownerType = 'proprio'` se null
- Sistema continua funcionando sem variantes cadastradas

### Performance
- Índice em `equivalent_sku` para queries rápidas
- Cache de fornecedores recentes em memória
- Agregação de progresso otimizada com joins

### UX
- Scanner foca automaticamente no campo após modal fechar
- Últimos fornecedores aparecem no topo do dropdown
- Validação em tempo real no formulário
- Feedback visual claro (badges coloridos)

## ✅ Benefícios Esperados

### Operacionais
- ✅ Zero mudança no processo de criação de ordens
- ✅ Operador escaneia qualquer SKU e sistema resolve
- ✅ Validação automática de fornecedor quando necessário
- ✅ Processo rápido e intuitivo

### Gerenciais
- ✅ Visibilidade total de material próprio vs terceiros
- ✅ Controle de custos por fornecedor
- ✅ Histórico completo para auditoria
- ✅ Relatórios detalhados por evento/fornecedor

### Técnicos
- ✅ Implementação não-invasiva
- ✅ Compatibilidade com dados existentes
- ✅ Performance otimizada com índices
- ✅ Escalável para novos tipos de propriedade

---

**Status**: 📋 Planejado - Aguardando aprovação para implementação

**Estimativa**: 30-45 minutos de desenvolvimento

**Prioridade**: Média - Funcionalidade de valor agregado para gestão avançada
