import { useState, useRef, useEffect, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft,
  PlayCircle,
  PauseCircle,
  CheckCircle2,
  Search,
  Scan,
  Plus,
  Minus,
  PackageCheck,
  ClipboardList,
  AlertTriangle,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Movement, MovementItem, Product, LoadingOrderItem } from "@shared/schema";

type MovementWithDetails = Movement & {
  loadingOrder?: {
    id: string;
    orderNumber: string;
  };
  dock?: {
    id: string;
    name: string;
  };
};

type LoadingOrderItemWithProduct = LoadingOrderItem & {
  product: Product;
};

type ExpectedItem = {
  productId: string;
  product: Product;
  expectedQuantity: number;
  loadedQuantity: number;
  remaining: number;
};

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    created: "bg-chart-5 text-white",
    in_progress: "bg-primary text-primary-foreground",
    paused: "bg-chart-5 text-white",
    completed: "bg-chart-4 text-white",
    cancelled: "bg-destructive text-destructive-foreground",
  };
  return colors[status] || "bg-muted text-muted-foreground";
};

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    created: "Criada",
    in_progress: "Em Andamento",
    paused: "Pausada",
    completed: "Finalizada",
    cancelled: "Cancelada",
  };
  return labels[status] || status;
};

export default function MovementDetails() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { data: movement, isLoading } = useQuery<MovementWithDetails>({
    queryKey: ["/api/movements", id],
    queryFn: async () => {
      const res = await fetch(`/api/movements/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch movement");
      return res.json();
    },
    enabled: !!id,
  });

  const { data: movementItems = [] } = useQuery<MovementItem[]>({
    queryKey: ["/api/movements", id, "items"],
    queryFn: async () => {
      const res = await fetch(`/api/movements/${id}/items`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch items");
      return res.json();
    },
    enabled: !!id,
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: loadingOrderItems = [] } = useQuery<LoadingOrderItemWithProduct[]>({
    queryKey: ["/api/loading-orders", movement?.loadingOrderId, "items"],
    queryFn: async () => {
      const res = await fetch(`/api/loading-orders/${movement?.loadingOrderId}/items`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch loading order items");
      return res.json();
    },
    enabled: !!movement?.loadingOrderId,
  });

  // Consolidate movement items by product
  const consolidatedLoadedItems = useMemo(() => {
    const itemsByProduct = new Map<string, { 
      productId: string; 
      totalQuantity: number; 
      itemIds: string[];
    }>();

    movementItems.forEach((item) => {
      const existing = itemsByProduct.get(item.productId);
      if (existing) {
        existing.totalQuantity += item.quantity;
        existing.itemIds.push(item.id);
      } else {
        itemsByProduct.set(item.productId, {
          productId: item.productId,
          totalQuantity: item.quantity,
          itemIds: [item.id],
        });
      }
    });

    return Array.from(itemsByProduct.values());
  }, [movementItems]);

  // Calculate expected items with loaded quantities
  const expectedItems: ExpectedItem[] = useMemo(() => {
    if (!loadingOrderItems.length) return [];

    return loadingOrderItems.map((orderItem) => {
      const loadedQuantity = movementItems
        .filter((item) => item.productId === orderItem.productId)
        .reduce((sum, item) => sum + item.quantity, 0);

      return {
        productId: orderItem.productId,
        product: orderItem.product,
        expectedQuantity: orderItem.consolidatedQuantity,
        loadedQuantity,
        remaining: Math.max(0, orderItem.consolidatedQuantity - loadedQuantity),
      };
    });
  }, [loadingOrderItems, movementItems]);

  // Calculate overall progress
  const totalExpected = expectedItems.reduce((sum, item) => sum + item.expectedQuantity, 0);
  const totalLoaded = expectedItems.reduce((sum, item) => sum + item.loadedQuantity, 0);
  const progress = totalExpected > 0 ? Math.round((totalLoaded / totalExpected) * 100) : 0;

  // Filter products based on search query
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return products
      .filter(
        (p) =>
          p.sku?.toLowerCase().includes(query) ||
          p.barcode?.toLowerCase().includes(query) ||
          p.name.toLowerCase().includes(query)
      )
      .slice(0, 10); // Limit to 10 suggestions
  }, [searchQuery, products]);

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const res = await apiRequest("PATCH", `/api/movements/${id}`, { status: newStatus });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update status");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/movements", id] });
      toast({ title: "Status atualizado" });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const addItemMutation = useMutation({
    mutationFn: async (data: { productId: string; quantity: number }) => {
      const res = await apiRequest("POST", `/api/movements/${id}/items`, {
        movementId: id,
        ...data,
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to add item");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/movements", id, "items"] });
      setSelectedProduct(null);
      setQuantity(1);
      setSearchQuery("");
      setShowSuggestions(false);
      toast({
        title: "Item adicionado",
        description: "O item foi adicionado à movimentação.",
      });
      searchInputRef.current?.focus();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao adicionar item",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const decrementItemMutation = useMutation({
    mutationFn: async (productId: string) => {
      // Find the most recent item for this product (using processedAt timestamp)
      const productItems = movementItems
        .filter((item) => item.productId === productId)
        .sort((a, b) => new Date(b.processedAt).getTime() - new Date(a.processedAt).getTime());
      
      if (productItems.length === 0) {
        throw new Error("No items found for this product");
      }

      const itemId = productItems[0].id;
      const res = await apiRequest("PATCH", `/api/movements/${id}/items/${itemId}/decrement`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to decrement item");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/movements", id, "items"] });
      toast({
        title: "Quantidade reduzida",
        description: "Uma unidade foi removida do item.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao remover unidade",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: async (productId: string) => {
      // Remove all items for this product
      const productItems = movementItems.filter((item) => item.productId === productId);
      
      if (productItems.length === 0) {
        throw new Error("No items found for this product");
      }

      // Delete all items for this product
      await Promise.all(
        productItems.map((item) =>
          apiRequest("DELETE", `/api/movements/${id}/items/${item.id}`)
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/movements", id, "items"] });
      toast({
        title: "Item removido completamente",
        description: "O item foi removido da movimentação.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao remover item",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleStartMovement = () => {
    updateStatusMutation.mutate("in_progress");
  };

  const handlePauseMovement = () => {
    updateStatusMutation.mutate("paused");
  };

  const handleContinueMovement = () => {
    updateStatusMutation.mutate("in_progress");
  };

  const handleFinishMovement = () => {
    updateStatusMutation.mutate("completed");
  };

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setSearchQuery(product.name);
    setShowSuggestions(false);
  };

  const handleSelectFromExpectedItem = (item: ExpectedItem) => {
    // Search by SKU to select the product
    setSearchQuery(item.product.sku || item.product.name);
    setSelectedProduct(item.product);
    setShowSuggestions(false);
    searchInputRef.current?.focus();
  };

  const handleAddItem = () => {
    if (!selectedProduct) return;
    addItemMutation.mutate({
      productId: selectedProduct.id,
      quantity,
    });
  };

  // Check if quantity exceeds expected
  const selectedExpectedItem = useMemo(() => {
    if (!selectedProduct) return null;
    return expectedItems.find((item) => item.productId === selectedProduct.id);
  }, [selectedProduct, expectedItems]);

  const willExceedExpected = useMemo(() => {
    if (!selectedExpectedItem) return false;
    const totalAfterAdd = selectedExpectedItem.loadedQuantity + quantity;
    return totalAfterAdd > selectedExpectedItem.expectedQuantity;
  }, [selectedExpectedItem, quantity]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "Enter" && selectedProduct) {
        handleAddItem();
      }
    };
    window.addEventListener("keypress", handleKeyPress);
    return () => window.removeEventListener("keypress", handleKeyPress);
  }, [selectedProduct, quantity]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowSuggestions(false);
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!movement) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Movimentação não encontrada</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate("/movements")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-movement-title">
              {movement.movementNumber}
            </h1>
            <p className="text-muted-foreground">{movement.name}</p>
            {movement.loadingOrder && (
              <p className="text-sm text-muted-foreground">
                Ordem: {movement.loadingOrder.orderNumber}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {movement.status === "created" && (
            <Button
              onClick={handleStartMovement}
              disabled={updateStatusMutation.isPending}
              data-testid="button-start"
            >
              <PlayCircle className="h-4 w-4 mr-2" />
              Iniciar Movimentação
            </Button>
          )}
          {movement.status === "in_progress" && (
            <>
              <Button
                variant="outline"
                onClick={handlePauseMovement}
                disabled={updateStatusMutation.isPending}
                data-testid="button-pause"
              >
                <PauseCircle className="h-4 w-4 mr-2" />
                Pausar
              </Button>
              <Button
                onClick={handleFinishMovement}
                disabled={updateStatusMutation.isPending}
                data-testid="button-finish"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Finalizar
              </Button>
            </>
          )}
          {movement.status === "paused" && (
            <Button
              onClick={handleContinueMovement}
              disabled={updateStatusMutation.isPending}
              data-testid="button-continue"
            >
              <PlayCircle className="h-4 w-4 mr-2" />
              Continuar
            </Button>
          )}
        </div>
      </div>

      {/* Status e Informações */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={getStatusColor(movement.status)}>
              {getStatusLabel(movement.status)}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Doca</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{movement.dock?.name || "-"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Veículo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{movement.vehiclePlate || "-"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Progresso</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold mb-2">
              {totalLoaded} / {totalExpected} ({progress}%)
            </p>
            <Progress value={progress} className="h-2" />
          </CardContent>
        </Card>
      </div>

      {/* Scanner */}
      {(movement.status === "in_progress" || movement.status === "paused") && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scan className="h-5 w-5" />
              Scanner de Produtos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Input
                    ref={searchInputRef}
                    placeholder="Digite SKU, código de barras ou nome do produto..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowSuggestions(true);
                      if (!e.target.value.trim()) {
                        setSelectedProduct(null);
                      }
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (searchQuery.trim()) {
                        setShowSuggestions(true);
                      }
                    }}
                    disabled={!!selectedProduct}
                    data-testid="input-search-product"
                    className="text-lg"
                    autoFocus
                  />
                  {showSuggestions && filteredProducts.length > 0 && !selectedProduct && (
                    <Card className="absolute top-full left-0 right-0 mt-1 z-50 max-h-80 overflow-auto">
                      <CardContent className="p-0">
                        {filteredProducts.map((product) => (
                          <button
                            key={product.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectProduct(product);
                            }}
                            className="w-full text-left p-3 hover-elevate active-elevate-2 border-b last:border-b-0"
                            data-testid={`suggestion-${product.id}`}
                          >
                            <p className="font-medium">{product.name}</p>
                            <p className="text-sm text-muted-foreground">
                              SKU: {product.sku} {product.barcode && `| Código: ${product.barcode}`}
                            </p>
                          </button>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </div>
                <Button
                  onClick={() => {
                    if (filteredProducts.length === 1) {
                      handleSelectProduct(filteredProducts[0]);
                    }
                  }}
                  disabled={!searchQuery || !!selectedProduct || filteredProducts.length !== 1}
                  data-testid="button-search"
                >
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {selectedProduct && (
              <div
                className={`border rounded-lg p-4 space-y-4 ${
                  willExceedExpected
                    ? "bg-destructive/10 border-destructive"
                    : "bg-accent/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg" data-testid="text-selected-product">
                      {selectedProduct.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      SKU: {selectedProduct.sku} | Código: {selectedProduct.barcode || "-"}
                    </p>
                    {selectedExpectedItem && (
                      <div className="mt-2 space-y-1">
                        <p className="text-sm">
                          <span className="text-muted-foreground">Esperado:</span>{" "}
                          <span className="font-medium">
                            {selectedExpectedItem.expectedQuantity}
                          </span>
                        </p>
                        <p className="text-sm">
                          <span className="text-muted-foreground">Já carregado:</span>{" "}
                          <span className="font-medium">
                            {selectedExpectedItem.loadedQuantity}
                          </span>
                        </p>
                        <p className="text-sm">
                          <span className="text-muted-foreground">Faltam:</span>{" "}
                          <span className="font-medium">{selectedExpectedItem.remaining}</span>
                        </p>
                      </div>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedProduct(null);
                      setQuantity(1);
                      setSearchQuery("");
                    }}
                    data-testid="button-clear"
                  >
                    Limpar
                  </Button>
                </div>

                {willExceedExpected && (
                  <div className="bg-destructive/20 border border-destructive rounded-md p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-destructive">
                          Atenção: Esta quantidade ({quantity}) excederá o esperado!
                        </p>
                        <p className="text-sm text-destructive/80 mt-1">
                          Total após adicionar:{" "}
                          {selectedExpectedItem!.loadedQuantity + quantity} /{" "}
                          {selectedExpectedItem!.expectedQuantity}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      data-testid="button-decrease-quantity"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className={`w-20 text-center ${
                        willExceedExpected ? "border-destructive" : ""
                      }`}
                      data-testid="input-quantity"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setQuantity(quantity + 1)}
                      data-testid="button-increase-quantity"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    onClick={handleAddItem}
                    disabled={addItemMutation.isPending}
                    className="flex-1"
                    data-testid="button-add-item"
                    variant={willExceedExpected ? "destructive" : "default"}
                  >
                    {addItemMutation.isPending ? "Adicionando..." : "Confirmar Item"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Lista dupla: Esperado vs Carregado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Itens Esperados (da Ordem) */}
        {expectedItems.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Itens da Ordem ({expectedItems.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-3">
                  {expectedItems.map((item) => {
                    const percentComplete = Math.round(
                      (item.loadedQuantity / item.expectedQuantity) * 100
                    );
                    const isExceeded = item.loadedQuantity > item.expectedQuantity;
                    const isComplete = item.remaining === 0 && !isExceeded;
                    const excess = isExceeded ? item.loadedQuantity - item.expectedQuantity : 0;

                    return (
                      <div
                        key={item.productId}
                        className={`border rounded-lg p-4 space-y-2 cursor-pointer hover-elevate active-elevate-2 ${
                          isExceeded
                            ? "bg-destructive/10 border-destructive"
                            : isComplete
                            ? "bg-chart-4/10 border-chart-4"
                            : ""
                        }`}
                        onClick={() => {
                          if (movement.status === "in_progress" || movement.status === "paused") {
                            handleSelectFromExpectedItem(item);
                          }
                        }}
                        data-testid={`expected-item-${item.productId}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium">{item.product.name}</p>
                            <p className="text-sm text-muted-foreground">
                              SKU: {item.product.sku}
                            </p>
                          </div>
                          {isExceeded && (
                            <Badge className="bg-destructive text-destructive-foreground">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Excedido
                            </Badge>
                          )}
                          {isComplete && (
                            <Badge className="bg-chart-4 text-white">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Completo
                            </Badge>
                          )}
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Progresso:</span>
                            <span className={`font-medium ${isExceeded ? "text-destructive" : ""}`}>
                              {item.loadedQuantity} / {item.expectedQuantity} ({percentComplete}%)
                            </span>
                          </div>
                          <Progress
                            value={Math.min(percentComplete, 100)}
                            className={`h-2 ${isExceeded ? "[&>div]:bg-destructive" : ""}`}
                          />
                          {item.remaining > 0 && (
                            <p className="text-sm text-muted-foreground">
                              Faltam: {item.remaining} unidades
                            </p>
                          )}
                          {isExceeded && (
                            <p className="text-sm text-destructive font-medium">
                              Excesso: +{excess} unidades
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Itens Carregados */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PackageCheck className="h-5 w-5" />
              Itens Carregados ({consolidatedLoadedItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px] pr-4">
              {consolidatedLoadedItems.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum item carregado ainda
                </p>
              ) : (
                <div className="space-y-2">
                  {consolidatedLoadedItems.map((item) => {
                    const product = products.find((p) => p.id === item.productId);
                    return (
                      <div
                        key={item.productId}
                        className="flex items-center justify-between gap-3 p-3 border rounded-lg hover-elevate"
                        data-testid={`item-${item.productId}`}
                      >
                        <div className="flex-1">
                          <p className="font-medium">{product?.name || "Produto desconhecido"}</p>
                          <p className="text-sm text-muted-foreground">
                            SKU: {product?.sku || "-"}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-lg px-4 py-1">
                          {item.totalQuantity}x
                        </Badge>
                        {movement?.status === "in_progress" && (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => decrementItemMutation.mutate(item.productId)}
                              disabled={decrementItemMutation.isPending}
                              data-testid={`button-decrement-${item.productId}`}
                              className="flex-shrink-0 h-8 w-8"
                              title="Remover 1 unidade"
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => removeItemMutation.mutate(item.productId)}
                              disabled={removeItemMutation.isPending}
                              data-testid={`button-remove-${item.productId}`}
                              className="flex-shrink-0 h-8 w-8 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                              title="Remover item completo"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
