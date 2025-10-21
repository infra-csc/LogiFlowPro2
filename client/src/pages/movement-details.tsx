import { useState, useRef, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  PlayCircle,
  PauseCircle,
  CheckCircle2,
  Search,
  Scan,
  Plus,
  Minus,
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

  const { data: loadingOrderItems = [] } = useQuery<LoadingOrderItem[]>({
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

  const handleSearch = () => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return;

    const product = products.find(
      (p) =>
        p.sku?.toLowerCase() === query ||
        p.barcode?.toLowerCase() === query ||
        p.name.toLowerCase().includes(query)
    );

    if (product) {
      setSelectedProduct(product);
    } else {
      toast({
        title: "Produto não encontrado",
        description: "Nenhum produto foi encontrado com esse código.",
        variant: "destructive",
      });
    }
  };

  const handleAddItem = () => {
    if (!selectedProduct) return;
    addItemMutation.mutate({
      productId: selectedProduct.id,
      quantity,
    });
  };

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "Enter" && searchQuery && !selectedProduct) {
        handleSearch();
      }
    };
    window.addEventListener("keypress", handleKeyPress);
    return () => window.removeEventListener("keypress", handleKeyPress);
  }, [searchQuery, selectedProduct]);

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

  const expectedItems = loadingOrderItems.length;
  const scannedItems = movementItems.reduce((sum, item) => sum + item.quantity, 0);
  const progress = expectedItems > 0 ? Math.round((scannedItems / expectedItems) * 100) : 0;

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
            <p className="text-lg font-semibold">
              {scannedItems} / {expectedItems} ({progress}%)
            </p>
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
            <div className="flex gap-2">
              <Input
                ref={searchInputRef}
                placeholder="Digite ou escaneie o código do produto..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") handleSearch();
                }}
                disabled={!!selectedProduct}
                data-testid="input-search-product"
                className="text-lg"
                autoFocus
              />
              <Button
                onClick={handleSearch}
                disabled={!searchQuery || !!selectedProduct}
                data-testid="button-search"
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>

            {selectedProduct && (
              <div className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-lg" data-testid="text-selected-product">
                      {selectedProduct.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      SKU: {selectedProduct.sku} | Código: {selectedProduct.barcode || "-"}
                    </p>
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
                      className="w-20 text-center"
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
                  >
                    {addItemMutation.isPending ? "Adicionando..." : "Confirmar Item"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Lista de Itens Escaneados */}
      <Card>
        <CardHeader>
          <CardTitle>Itens Escaneados ({movementItems.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {movementItems.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum item escaneado ainda
            </p>
          ) : (
            <div className="space-y-2">
              {movementItems.map((item) => {
                const product = products.find((p) => p.id === item.productId);
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                    data-testid={`item-${item.id}`}
                  >
                    <div>
                      <p className="font-medium">{product?.name || "Produto desconhecido"}</p>
                      <p className="text-sm text-muted-foreground">
                        SKU: {product?.sku || "-"}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-lg px-4 py-1">
                      {item.quantity}x
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
