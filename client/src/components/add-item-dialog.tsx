import { useState, useMemo, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Package, Boxes, Loader2, AlertCircle, Plus, Minus, X,
  ChevronDown, ChevronRight, Check, Trash2, MessageSquare, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Types ─────────────────────────────────────────────── */

export type Product = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  ownership: string;
  currentStock?: number;
};

type Kit = {
  id: string;
  name: string;
  description?: string;
};

type BomLine = {
  id: string;
  kitId: string;
  productId: string;
  quantityFormula: string;
  notes?: string;
};

type CartItem = {
  localId: string;
  // product items
  productId?: string;
  productName?: string;
  sku?: string;
  unit?: string;
  ownership?: string;
  // kit-as-whole items
  isKitItem?: boolean;
  kitParameters?: Record<string, number>;
  quantity: number;
  notes: string;
  showNotes: boolean;
  fromKitId?: string;
  fromKitName?: string;
};

type KitExpansion = {
  kitId: string;
  kitName: string;
  multiplier: number;
  parameters: Record<string, number>;
  bomLines: Array<{
    productId: string;
    productName: string;
    sku: string;
    unit: string;
    formula: string;
    baseQty: number;
    finalQty: number;
    notes: string;
  }>;
  isLoading: boolean;
  isExpanded: boolean;
};

export type AddItemDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  products: Product[];
  kits: Kit[];
  existingItems?: Array<{ productId: string; quantity: number }>;
  productsLoading?: boolean;
  kitsLoading?: boolean;
};

/* ─── Helpers ────────────────────────────────────────────── */

function parseBaseQty(formula: string): number {
  const n = parseFloat(formula.trim());
  return isNaN(n) ? 1 : Math.max(1, Math.round(n));
}

function extractVariables(formula: string): string[] {
  const tokens = formula.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) ?? [];
  return Array.from(new Set(tokens));
}

function calcFinalQty(formula: string, multiplier: number, parameters: Record<string, number>): number {
  try {
    let f = formula.trim();
    for (const [name, val] of Object.entries(parameters)) {
      f = f.replace(new RegExp(`\\b${name}\\b`, 'g'), String(val));
    }
    const sanitized = f.replace(/[^0-9+\-*/().\s]/g, '');
    if (sanitized !== f) return 0;
    const result = Function('"use strict"; return (' + sanitized + ')')() as number;
    return Math.max(0, Math.round(result * multiplier));
  } catch {
    return 0;
  }
}

function ownershipLabel(o: string): string {
  return o === "rented" ? "Locado" : o === "third_party" ? "Terceiros" : "Próprio";
}

function ownershipClass(o: string): string {
  return o === "rented"
    ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30"
    : o === "third_party"
    ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30"
    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
}

let _lid = 0;
const nextId = () => String(++_lid);

/* ─── CartRow sub-component ──────────────────────────────── */

function CartRow({
  item,
  onUpdate,
  onRemove,
}: {
  item: CartItem;
  onUpdate: (localId: string, updates: Partial<CartItem>) => void;
  onRemove: (localId: string) => void;
}) {
  return (
    <div className="border border-border/60 rounded-lg bg-background px-3 py-2">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {item.isKitItem ? (
              <>
                <Boxes className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                <span className="text-sm font-medium">{item.fromKitName}</span>
                <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 no-default-hover-elevate">
                  Kit
                </Badge>
              </>
            ) : (
              <>
                <span className="text-sm font-medium truncate">{item.productName}</span>
                <span className="text-xs font-mono text-muted-foreground">{item.sku}</span>
              </>
            )}
          </div>
          {item.showNotes && (
            <input
              type="text"
              placeholder="Observação (opcional)..."
              value={item.notes}
              onChange={(e) => onUpdate(item.localId, { notes: e.target.value })}
              className="mt-1.5 w-full text-xs bg-muted/50 border border-border/60 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
          <button
            onClick={() => onUpdate(item.localId, { showNotes: !item.showNotes })}
            className={cn(
              "p-1 rounded transition-colors",
              item.showNotes || item.notes ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
            title="Observação"
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onUpdate(item.localId, { quantity: Math.max(1, item.quantity - 1) })}
            className="w-6 h-6 rounded border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <Minus className="h-2.5 w-2.5" />
          </button>
          <input
            type="number"
            min="1"
            value={item.quantity}
            onChange={(e) => onUpdate(item.localId, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
            className="w-11 h-6 text-center text-xs font-semibold bg-background border border-border/60 rounded focus:outline-none focus:ring-1 focus:ring-ring [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button
            onClick={() => onUpdate(item.localId, { quantity: item.quantity + 1 })}
            className="w-6 h-6 rounded border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <Plus className="h-2.5 w-2.5" />
          </button>
          <span className="text-[10px] text-muted-foreground w-8 truncate">
            {item.isKitItem ? "kit(s)" : item.unit}
          </span>
          <button
            onClick={() => onRemove(item.localId)}
            className="p-1 text-muted-foreground hover:text-destructive transition-colors ml-0.5"
            data-testid={`button-remove-cart-${item.localId}`}
            title="Remover"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────── */

export function AddItemDialog({
  open,
  onOpenChange,
  requestId,
  products,
  kits,
  existingItems = [],
  productsLoading = false,
  kitsLoading = false,
}: AddItemDialogProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"products" | "kits">("products");
  const [productSearch, setProductSearch] = useState("");
  const [kitSearch, setKitSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [kitExpansions, setKitExpansions] = useState<Record<string, KitExpansion>>({});

  /* ── Derived ── */

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products.slice(0, 60);
    const q = productSearch.toLowerCase();
    return products.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q)
    ).slice(0, 60);
  }, [products, productSearch]);

  const filteredKits = useMemo(() => {
    if (!kitSearch.trim()) return kits;
    const q = kitSearch.toLowerCase();
    return kits.filter((k) => k.name.toLowerCase().includes(q));
  }, [kits, kitSearch]);

  const cartProductIds = useMemo(() => new Set(cart.filter((i) => !i.isKitItem).map((i) => i.productId as string)), [cart]);
  const isInCart = useCallback((id: string) => cartProductIds.has(id), [cartProductIds]);
  const isKitInCart = useCallback((id: string) => cart.some((i) => i.isKitItem && i.fromKitId === id), [cart]);
  const isAlreadyInRequest = useCallback(
    (id: string) => existingItems.some((e) => e.productId === id),
    [existingItems]
  );

  const productItemsCount = useMemo(() => cart.filter((i) => !i.isKitItem).length, [cart]);
  const kitItemsCount = useMemo(() => cart.filter((i) => i.isKitItem).length, [cart]);
  const totalUnits = useMemo(() => cart.filter((i) => !i.isKitItem).reduce((s, i) => s + i.quantity, 0), [cart]);
  const kitsInCart = kitItemsCount;

  /* ── Cart actions ── */

  const addProductToCart = useCallback(
    (product: Product) => {
      if (isInCart(product.id)) return;
      setCart((prev) => [
        ...prev,
        {
          localId: nextId(),
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          unit: product.unit,
          ownership: product.ownership || "owned",
          quantity: 1,
          notes: "",
          showNotes: false,
        },
      ]);
    },
    [isInCart]
  );

  const removeFromCart = useCallback((localId: string) => {
    setCart((prev) => prev.filter((i) => i.localId !== localId));
  }, []);

  const updateCartItem = useCallback((localId: string, updates: Partial<CartItem>) => {
    setCart((prev) => prev.map((i) => (i.localId === localId ? { ...i, ...updates } : i)));
  }, []);

  /* ── Kit expansion ── */

  const toggleKitExpansion = useCallback(
    async (kit: Kit) => {
      const existing = kitExpansions[kit.id];
      if (existing?.bomLines.length > 0) {
        setKitExpansions((prev) => ({
          ...prev,
          [kit.id]: { ...prev[kit.id], isExpanded: !prev[kit.id].isExpanded },
        }));
        return;
      }

      setKitExpansions((prev) => ({
        ...prev,
        [kit.id]: {
          kitId: kit.id,
          kitName: kit.name,
          multiplier: 1,
          parameters: {},
          bomLines: [],
          isLoading: true,
          isExpanded: true,
        },
      }));

      try {
        const res = await apiRequest("GET", `/api/kits/${kit.id}/bom`);
        const bomData: BomLine[] = await res.json();

        // Detect all variable names across BOM formulas
        const allVarNames = new Set<string>();
        bomData.forEach((line) => extractVariables(line.quantityFormula).forEach((v) => allVarNames.add(v)));
        const parameters: Record<string, number> = {};
        allVarNames.forEach((v) => { parameters[v] = 0; });

        const bomLines = bomData.map((line) => {
          const product = products.find((p) => p.id === line.productId);
          const baseQty = parseBaseQty(line.quantityFormula);
          return {
            productId: line.productId,
            productName: product?.name ?? "Produto desconhecido",
            sku: product?.sku ?? "—",
            unit: product?.unit ?? "unid",
            formula: line.quantityFormula,
            baseQty,
            finalQty: calcFinalQty(line.quantityFormula, 1, parameters),
            notes: line.notes ?? "",
          };
        });

        setKitExpansions((prev) => ({
          ...prev,
          [kit.id]: { ...prev[kit.id], bomLines, parameters, isLoading: false },
        }));
      } catch {
        setKitExpansions((prev) => {
          const copy = { ...prev };
          delete copy[kit.id];
          return copy;
        });
        toast({ variant: "destructive", title: "Erro ao carregar BOM do kit" });
      }
    },
    [kitExpansions, products, toast]
  );

  const updateKitMultiplier = useCallback((kitId: string, mult: number) => {
    const m = Math.max(1, mult);
    setKitExpansions((prev) => {
      const exp = prev[kitId];
      return {
        ...prev,
        [kitId]: {
          ...exp,
          multiplier: m,
          bomLines: exp.bomLines.map((l) => ({
            ...l,
            finalQty: calcFinalQty(l.formula, m, exp.parameters),
          })),
        },
      };
    });
  }, []);

  const updateKitParameter = useCallback((kitId: string, paramName: string, value: number) => {
    setKitExpansions((prev) => {
      const exp = prev[kitId];
      const newParams = { ...exp.parameters, [paramName]: value };
      return {
        ...prev,
        [kitId]: {
          ...exp,
          parameters: newParams,
          bomLines: exp.bomLines.map((l) => ({
            ...l,
            finalQty: calcFinalQty(l.formula, exp.multiplier, newParams),
          })),
        },
      };
    });
  }, []);

  const updateBomLineQty = useCallback((kitId: string, productId: string, qty: number) => {
    setKitExpansions((prev) => ({
      ...prev,
      [kitId]: {
        ...prev[kitId],
        bomLines: prev[kitId].bomLines.map((l) =>
          l.productId === productId ? { ...l, finalQty: Math.max(0, qty) } : l
        ),
      },
    }));
  }, []);

  const removeBomLine = useCallback((kitId: string, productId: string) => {
    setKitExpansions((prev) => ({
      ...prev,
      [kitId]: {
        ...prev[kitId],
        bomLines: prev[kitId].bomLines.filter((l) => l.productId !== productId),
      },
    }));
  }, []);

  const addKitToCart = useCallback(
    (kitId: string) => {
      const expansion = kitExpansions[kitId];
      if (!expansion) return;

      const hasParams = Object.keys(expansion.parameters).length > 0;

      setCart((prev) => {
        const withoutThisKit = prev.filter((i) => !(i.isKitItem && i.fromKitId === kitId));
        return [
          ...withoutThisKit,
          {
            localId: nextId(),
            isKitItem: true,
            fromKitId: kitId,
            fromKitName: expansion.kitName,
            quantity: expansion.multiplier,
            kitParameters: hasParams ? { ...expansion.parameters } : undefined,
            notes: "",
            showNotes: false,
          },
        ];
      });

      toast({
        title: `Kit "${expansion.kitName}" adicionado`,
        description: `${expansion.multiplier} kit(s) adicionado(s) à requisição`,
      });
    },
    [kitExpansions, toast]
  );

  /* ── Batch submit ── */

  const batchMutation = useMutation({
    mutationFn: async () => {
      const items = cart.map((item) =>
        item.isKitItem
          ? {
              kitId: item.fromKitId,
              quantity: item.quantity,
              notes: item.notes || undefined,
              kitParameters: item.kitParameters && Object.keys(item.kitParameters).length > 0
                ? item.kitParameters
                : undefined,
            }
          : { productId: item.productId, quantity: item.quantity, notes: item.notes || undefined }
      );
      const res = await apiRequest("POST", `/api/requests/${requestId}/items/batch`, { items });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Falha ao adicionar itens");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests", requestId, "items"] });
      const kitCount = cart.filter((i) => i.isKitItem).length;
      const prodCount = cart.filter((i) => !i.isKitItem).length;
      const parts: string[] = [];
      if (kitCount > 0) parts.push(`${kitCount} kit(s)`);
      if (prodCount > 0) parts.push(`${prodCount} produto(s)`);
      toast({
        title: "Materiais adicionados à requisição",
        description: parts.join(" e ") + " processado(s)",
      });
      handleClose();
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Erro", description: err.message });
    },
  });

  const handleClose = () => {
    setCart([]);
    setKitExpansions({});
    setProductSearch("");
    setKitSearch("");
    setActiveTab("products");
    onOpenChange(false);
  };

  const hasValidCart = cart.length > 0 && cart.every((i) => i.quantity >= 1);

  /* ── Render ── */

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(true); }}>
      <DialogContent className="max-w-4xl w-full overflow-hidden p-0 gap-0 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-border flex-shrink-0">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Adicionar materiais</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Busque produtos individuais ou selecione um kit para preencher a requisição.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Tabs + search bar */}
        <div className="px-6 pt-4 flex-shrink-0">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "products" | "kits")}>
              <TabsList className="h-9">
                <TabsTrigger value="products" className="gap-1.5 text-sm" data-testid="tab-products">
                  <Package className="h-4 w-4" />
                  Produtos
                  {products.length > 0 && (
                    <span className="ml-1 text-[10px] text-muted-foreground">({products.length})</span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="kits" className="gap-1.5 text-sm" data-testid="tab-kits">
                  <Boxes className="h-4 w-4" />
                  Kits
                  {kits.length > 0 && (
                    <span className="ml-1 text-[10px] text-muted-foreground">({kits.length})</span>
                  )}
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex items-center gap-2">
              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                  data-testid="button-clear-selection"
                >
                  <X className="h-3 w-3" />
                  Limpar seleção
                </button>
              )}
              <Badge variant="outline" className="text-xs no-default-hover-elevate">
                {cart.length} selecionado{cart.length !== 1 ? "s" : ""}
              </Badge>
            </div>
          </div>

          {activeTab === "products" ? (
            <Input
              placeholder="Buscar por nome, SKU ou código de barras..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="mb-3"
              data-testid="input-search-products"
              autoFocus
            />
          ) : (
            <Input
              placeholder="Buscar kit por nome..."
              value={kitSearch}
              onChange={(e) => setKitSearch(e.target.value)}
              className="mb-3"
              data-testid="input-search-kits"
            />
          )}
        </div>

        {/* Scrollable body */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 pb-4">
            {/* ── PRODUCTS TAB ── */}
            {activeTab === "products" && (
              <>
                {productsLoading ? (
                  <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Carregando produtos...
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="flex flex-col items-center py-12 gap-2 text-muted-foreground">
                    <AlertCircle className="h-8 w-8 opacity-25" />
                    <p className="text-sm">{productSearch ? "Nenhum produto encontrado" : "Nenhum produto disponível"}</p>
                  </div>
                ) : (
                  <div className="space-y-1 mb-4">
                    {filteredProducts.map((product) => {
                      const inCart = isInCart(product.id);
                      const alreadyInRequest = isAlreadyInRequest(product.id);
                      return (
                        <div
                          key={product.id}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 border transition-colors cursor-pointer",
                            inCart
                              ? "border-primary/40 bg-primary/5"
                              : "border-border/50 hover-elevate"
                          )}
                          onClick={() =>
                            inCart
                              ? removeFromCart(cart.find((i) => i.productId === product.id)!.localId)
                              : addProductToCart(product)
                          }
                          data-testid={`product-row-${product.id}`}
                        >
                          {/* Checkbox */}
                          <div
                            className={cn(
                              "w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors",
                              inCart ? "bg-primary border-primary" : "border-border/80"
                            )}
                          >
                            {inCart && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium leading-snug truncate">{product.name}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-xs font-mono text-muted-foreground">{product.sku}</span>
                              <span className="text-xs text-muted-foreground">{product.unit}</span>
                              <Badge
                                variant="outline"
                                className={cn("text-[10px] h-4 px-1.5 no-default-hover-elevate", ownershipClass(product.ownership))}
                              >
                                {ownershipLabel(product.ownership)}
                              </Badge>
                              {alreadyInRequest && (
                                <span className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                                  <AlertTriangle className="h-2.5 w-2.5" />
                                  Já na requisição (será somado)
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Stock (if available) */}
                          {product.currentStock !== undefined && (
                            <span className="text-xs text-muted-foreground flex-shrink-0">
                              Estoque: {product.currentStock}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Selected products in cart */}
                {cart.filter((i) => !i.isKitItem).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Selecionados — edite quantidade e observação
                    </p>
                    <div className="space-y-1.5">
                      {cart
                        .filter((i) => !i.isKitItem)
                        .map((item) => (
                          <CartRow
                            key={item.localId}
                            item={item}
                            onUpdate={updateCartItem}
                            onRemove={removeFromCart}
                          />
                        ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── KITS TAB ── */}
            {activeTab === "kits" && (
              <>
                {kitsLoading ? (
                  <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Carregando kits...
                  </div>
                ) : filteredKits.length === 0 ? (
                  <div className="flex flex-col items-center py-12 gap-2 text-muted-foreground">
                    <AlertCircle className="h-8 w-8 opacity-25" />
                    <p className="text-sm">{kitSearch ? "Nenhum kit encontrado" : "Nenhum kit disponível"}</p>
                  </div>
                ) : (
                  <div className="space-y-3 mb-4">
                    {filteredKits.map((kit) => {
                      const expansion = kitExpansions[kit.id];
                      const isExpanded = expansion?.isExpanded;
                      const isLoading = expansion?.isLoading;

                      return (
                        <div
                          key={kit.id}
                          className="border border-border/60 rounded-lg overflow-hidden"
                          data-testid={`kit-card-${kit.id}`}
                        >
                          {/* Kit row */}
                          <div className="flex items-center gap-3 p-3">
                            <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                              <Boxes className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold">{kit.name}</p>
                              {kit.description && (
                                <p className="text-xs text-muted-foreground truncate">{kit.description}</p>
                              )}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleKitExpansion(kit)}
                              className="flex-shrink-0 h-7 text-xs gap-1"
                              data-testid={`button-expand-kit-${kit.id}`}
                            >
                              {isLoading ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : isExpanded ? (
                                <ChevronDown className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5" />
                              )}
                              {isExpanded ? "Recolher" : "Visualizar"}
                            </Button>
                          </div>

                          {/* BOM expansion */}
                          {isExpanded && expansion && !isLoading && (
                            <div className="border-t border-border/40 p-3 bg-muted/20 space-y-3">
                              {/* Multiplier */}
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-muted-foreground font-medium">Quantidade de kits:</span>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => updateKitMultiplier(kit.id, expansion.multiplier - 1)}
                                    className="w-6 h-6 rounded border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                                  >
                                    <Minus className="h-2.5 w-2.5" />
                                  </button>
                                  <Input
                                    type="number"
                                    min="1"
                                    value={expansion.multiplier}
                                    onChange={(e) => updateKitMultiplier(kit.id, parseInt(e.target.value) || 1)}
                                    className="w-14 h-7 text-center text-sm px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    data-testid={`input-kit-multiplier-${kit.id}`}
                                  />
                                  <button
                                    onClick={() => updateKitMultiplier(kit.id, expansion.multiplier + 1)}
                                    className="w-6 h-6 rounded border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                                  >
                                    <Plus className="h-2.5 w-2.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Parameters section — only when kit has variable formulas */}
                              {Object.keys(expansion.parameters).length > 0 && (
                                <div className="bg-amber-500/5 border border-amber-500/20 rounded-md p-2.5 space-y-2">
                                  <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                                    Parâmetros do kit
                                  </p>
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                                    {Object.keys(expansion.parameters).map((param) => (
                                      <div key={param} className="flex items-center gap-2">
                                        <label className="text-xs text-muted-foreground capitalize flex-1 truncate">
                                          {param}
                                        </label>
                                        <Input
                                          type="number"
                                          min="0"
                                          value={expansion.parameters[param]}
                                          onChange={(e) =>
                                            updateKitParameter(kit.id, param, parseInt(e.target.value) || 0)
                                          }
                                          className="w-20 h-7 text-center text-xs px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                          data-testid={`input-kit-param-${kit.id}-${param}`}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* BOM lines */}
                              {expansion.bomLines.length === 0 ? (
                                <p className="text-xs text-muted-foreground py-1">Este kit não tem itens no BOM.</p>
                              ) : (
                                <div className="space-y-1">
                                  {/* Header */}
                                  <div className="grid grid-cols-[1fr_56px_100px_60px_20px] gap-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1">
                                    <span>Produto</span>
                                    <span>SKU</span>
                                    <span className="text-center">Base × Kits</span>
                                    <span className="text-center">Final</span>
                                    <span />
                                  </div>
                                  {expansion.bomLines.map((line) => {
                                    const hasParams = Object.keys(expansion.parameters).length > 0;
                                    const baseCalc = hasParams
                                      ? calcFinalQty(line.formula, 1, expansion.parameters)
                                      : line.baseQty;
                                    return (
                                    <div
                                      key={line.productId}
                                      className="grid grid-cols-[1fr_56px_100px_60px_20px] gap-2 items-center bg-background rounded-md px-2 py-1.5 border border-border/40"
                                    >
                                      <div className="min-w-0">
                                        <p className="text-xs font-medium truncate">{line.productName}</p>
                                        <p className="text-[10px] text-muted-foreground">{line.unit}</p>
                                      </div>
                                      <span className="text-xs font-mono text-muted-foreground truncate">{line.sku}</span>
                                      <span
                                        className="text-xs text-muted-foreground text-center font-mono truncate"
                                        title={hasParams ? line.formula : undefined}
                                      >
                                        {baseCalc} × {expansion.multiplier}
                                      </span>
                                      <Input
                                        type="number"
                                        min="0"
                                        value={line.finalQty}
                                        onChange={(e) =>
                                          updateBomLineQty(kit.id, line.productId, parseInt(e.target.value) || 0)
                                        }
                                        className="h-6 text-center text-xs px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                      />
                                      <button
                                        onClick={() => removeBomLine(kit.id, line.productId)}
                                        className="text-muted-foreground hover:text-destructive transition-colors"
                                        title="Remover este item do kit"
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </div>
                                    );
                                  })}
                                </div>
                              )}

                              <Button
                                size="sm"
                                className="w-full h-8 text-xs gap-1.5"
                                onClick={() => addKitToCart(kit.id)}
                                data-testid={`button-add-kit-${kit.id}`}
                              >
                                {isKitInCart(kit.id) ? (
                                  <>
                                    <Check className="h-3.5 w-3.5" />
                                    Atualizar kit na seleção
                                  </>
                                ) : (
                                  <>
                                    <Plus className="h-3.5 w-3.5" />
                                    Adicionar kit à seleção
                                  </>
                                )}
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Kit items in cart */}
                {cart.filter((i) => i.isKitItem).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Kits selecionados
                    </p>
                    <div className="space-y-1.5">
                      {cart
                        .filter((i) => i.isKitItem)
                        .map((item) => (
                          <CartRow
                            key={item.localId}
                            item={item}
                            onUpdate={updateCartItem}
                            onRemove={removeFromCart}
                          />
                        ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="border-t border-border bg-muted/30 px-6 py-3.5 flex-shrink-0">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="text-sm text-muted-foreground">
              {cart.length === 0 ? (
                <span>Nenhum item selecionado</span>
              ) : (
                <span>
                  {productItemsCount > 0 && (
                    <><span className="font-semibold text-foreground">{productItemsCount}</span> produto{productItemsCount !== 1 ? "s" : ""}{" "}</>
                  )}
                  {kitItemsCount > 0 && (
                    <>{productItemsCount > 0 ? "· " : ""}<span className="font-semibold text-foreground">{kitItemsCount}</span> kit{kitItemsCount !== 1 ? "s" : ""}{" "}</>
                  )}
                  {totalUnits > 0 && (
                    <>· <span className="font-semibold text-foreground">{totalUnits}</span> unid. (produtos)</>
                  )}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleClose} data-testid="button-cancel-add-items">
                Cancelar
              </Button>
              <Button
                onClick={() => batchMutation.mutate()}
                disabled={!hasValidCart || batchMutation.isPending}
                data-testid="button-submit-add-items"
              >
                {batchMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Adicionando...
                  </>
                ) : (
                  <>Adicionar materiais{cart.length > 0 ? ` (${cart.length})` : ""}</>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
