import { useState, useRef, useEffect, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useQueries, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
  Keyboard,
  Maximize2,
  Minimize2,
  Edit,
  Clock,
  User,
  FileText,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  userCanManageMovementItems,
  userCanChangeMovementStatusFreely,
} from "@/lib/authz";
import { useSidebar } from "@/components/ui/sidebar";
import { format } from "date-fns";
import { PageHeader, PageLoading, PageSection, StatusBadge } from "@/components";
import type { Movement, MovementItem, Product, LoadingOrderItem, MovementTypeConfig, MovementAuditLog } from "@shared/schema";

type MovementWithDetails = Movement & {
  loadingOrder?: {
    id: string;
    orderNumber: string;
  };
  dock?: {
    id: string;
    name: string;
  };
  events?: Array<{
    id: string;
    name: string;
    sku: string;
  }>;
  movementTypeConfig?: MovementTypeConfig;
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
  const { user } = useAuth();
  const sidebar = useSidebar();
  const [focusMode, setFocusMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [orderSearchQuery, setOrderSearchQuery] = useState("");
  const [loadedSearchQuery, setLoadedSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [scannedSku, setScannedSku] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [ownerName, setOwnerName] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showEditStatusDialog, setShowEditStatusDialog] = useState(false);
  const [newStatus, setNewStatus] = useState<string>("");
  const [isSelectOpen, setIsSelectOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  // Fetch all suppliers
  const { data: suppliers = [] } = useQuery<Array<{id: string, name: string}>>({
    queryKey: ["/api/suppliers"],
  });

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

  const { data: auditLogs = [] } = useQuery<MovementAuditLog[]>({
    queryKey: ["/api/movements", id, "audit-logs"],
    queryFn: async () => {
      const res = await fetch(`/api/movements/${id}/audit-logs`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch audit logs");
      return res.json();
    },
    enabled: !!id,
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

  // Fetch all movements with the same loading order ID
  const { data: relatedMovements = [] } = useQuery<Movement[]>({
    queryKey: [`/api/loading-orders/${movement?.loadingOrderId}/movements`],
    enabled: !!movement?.loadingOrderId,
  });

  // Fetch items for all related movements using useQueries
  const relatedMovementItemsQueries = useQueries({
    queries: relatedMovements.map(mov => ({
      queryKey: ["/api/movements", mov.id, "items"],
      queryFn: async () => {
        const res = await fetch(`/api/movements/${mov.id}/items`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to fetch movement items");
        return res.json() as Promise<MovementItem[]>;
      },
      enabled: !!mov.id,
    })),
  });

  // Combine all movement items from all related movements
  const allRelatedMovementItems = useMemo(() => {
    const allItems: MovementItem[] = [];
    relatedMovementItemsQueries.forEach(query => {
      if (query.data) {
        allItems.push(...query.data);
      }
    });
    return allItems;
  }, [relatedMovementItemsQueries]);

  // Get product IDs that are in the loading order
  const expectedProductIds = useMemo(() => {
    return new Set(loadingOrderItems.map(item => item.productId));
  }, [loadingOrderItems]);

  // Consolidate movement items by product
  const consolidatedLoadedItems = useMemo(() => {
    const itemsByProduct = new Map<string, { 
      productId: string; 
      totalQuantity: number; 
      itemIds: string[];
      isNotInOrder: boolean;
      ownerTypes: Set<string>;
      owners: Set<string>;
    }>();

    movementItems.forEach((item) => {
      const existing = itemsByProduct.get(item.productId);
      if (existing) {
        existing.totalQuantity += item.quantity;
        existing.itemIds.push(item.id);
        if (item.ownerType) existing.ownerTypes.add(item.ownerType);
        if (item.ownerName) existing.owners.add(item.ownerName);
      } else {
        // Check if this product is not in the loading order (only when there is a loading order)
        const isNotInOrder = movement?.loadingOrderId 
          ? !expectedProductIds.has(item.productId)
          : false;
        
        itemsByProduct.set(item.productId, {
          productId: item.productId,
          totalQuantity: item.quantity,
          itemIds: [item.id],
          isNotInOrder,
          ownerTypes: new Set(item.ownerType ? [item.ownerType] : []),
          owners: new Set(item.ownerName ? [item.ownerName] : []),
        });
      }
    });

    return Array.from(itemsByProduct.values());
  }, [movementItems, movement?.loadingOrderId, expectedProductIds]);

  // Calculate expected items with loaded quantities from ALL related movements
  const expectedItems: ExpectedItem[] = useMemo(() => {
    if (!loadingOrderItems.length) return [];

    // Use all related movement items if we have a loading order, otherwise use current movement items
    const itemsToConsider = movement?.loadingOrderId ? allRelatedMovementItems : movementItems;

    return loadingOrderItems.map((orderItem) => {
      // Get the SKU of the expected product
      const expectedProductSku = orderItem.product.sku;
      
      const loadedQuantity = itemsToConsider
        .filter((item) => {
          // Direct match by productId
          if (item.productId === orderItem.productId) return true;
          
          // Check if the loaded item is a variant of the expected product
          const loadedProduct = products.find(p => p.id === item.productId);
          if (loadedProduct?.productType === "variante" && loadedProduct.equivalentSku === expectedProductSku) {
            return true;
          }
          
          return false;
        })
        .reduce((sum, item) => sum + item.quantity, 0);

      return {
        productId: orderItem.productId,
        product: orderItem.product,
        expectedQuantity: orderItem.consolidatedQuantity,
        loadedQuantity,
        remaining: Math.max(0, orderItem.consolidatedQuantity - loadedQuantity),
      };
    });
  }, [loadingOrderItems, movementItems, movement?.loadingOrderId, allRelatedMovementItems, products]);

  // Calculate overall progress
  const totalExpected = expectedItems.reduce((sum, item) => sum + item.expectedQuantity, 0);
  const totalLoaded = expectedItems.reduce((sum, item) => sum + item.loadedQuantity, 0);
  const progress = totalExpected > 0 ? Math.round((totalLoaded / totalExpected) * 100) : 0;

  // Filter expected items based on order search query
  const filteredExpectedItems = useMemo(() => {
    if (!orderSearchQuery.trim()) return expectedItems;
    const query = orderSearchQuery.toLowerCase();
    return expectedItems.filter(
      (item) =>
        item.product.name.toLowerCase().includes(query) ||
        item.product.sku?.toLowerCase().includes(query) ||
        item.product.barcode?.toLowerCase().includes(query)
    );
  }, [expectedItems, orderSearchQuery]);

  // Filter loaded items based on loaded search query
  const filteredLoadedItems = useMemo(() => {
    if (!loadedSearchQuery.trim()) return consolidatedLoadedItems;
    const query = loadedSearchQuery.toLowerCase();
    return consolidatedLoadedItems.filter((item) => {
      const product = products.find((p) => p.id === item.productId);
      return (
        product?.name.toLowerCase().includes(query) ||
        product?.sku?.toLowerCase().includes(query) ||
        product?.barcode?.toLowerCase().includes(query)
      );
    });
  }, [consolidatedLoadedItems, loadedSearchQuery, products]);

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

  // Determine if the movement can be edited (items can be added/modified/deleted)
  const isEditable = movement?.status === "in_progress";

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const res = await apiRequest("PATCH", `/api/movements/${id}/status`, { status: newStatus });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update status");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/movements", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/movements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/movements", id, "audit-logs"] });
      setShowEditStatusDialog(false);
      setNewStatus("");
      toast({
        title: "Status atualizado",
        description: "O status da movimentação foi atualizado com sucesso.",
      });
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
    mutationFn: async (data: { 
      productId: string; 
      quantity: number;
      scannedSku?: string;
      ownerName?: string;
      ownerType?: string;
    }) => {
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
      queryClient.invalidateQueries({ queryKey: ["/api/movements", id, "audit-logs"] });
      setSelectedProduct(null);
      setScannedSku("");
      setQuantity(1);
      setOwnerName("");
      setSearchQuery("");
      setShowSuggestions(false);
      toast({
        title: "Item adicionado",
        description: "O item foi adicionado à movimentação.",
      });
      // Focus back on scanner input for next product
      setTimeout(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }, 100);
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
      queryClient.invalidateQueries({ queryKey: ["/api/movements", id, "audit-logs"] });
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

  const toggleFocusMode = () => {
    const newFocusMode = !focusMode;
    setFocusMode(newFocusMode);
    
    // Toggle sidebar when entering/exiting focus mode
    if (newFocusMode && sidebar.open) {
      sidebar.setOpen(false);
    } else if (!newFocusMode && !sidebar.open) {
      sidebar.setOpen(true);
    }
  };

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setSearchQuery(product.name);
    setShowSuggestions(false);
    // Focus quantity input after selecting product
    setTimeout(() => {
      quantityInputRef.current?.focus();
      quantityInputRef.current?.select();
    }, 100);
  };

  const handleSelectFromExpectedItem = (item: ExpectedItem) => {
    // Search by SKU to select the product
    setSearchQuery(item.product.sku || item.product.name);
    setSelectedProduct(item.product);
    setShowSuggestions(false);
    // Focus quantity input after selecting product
    setTimeout(() => {
      quantityInputRef.current?.focus();
      quantityInputRef.current?.select();
    }, 100);
  };

  const handleAddItem = () => {
    console.log('handleAddItem called', { selectedProduct: selectedProduct?.name, showConfirmDialog });
    
    if (!isEditable) {
      toast({
        title: "Não é possível adicionar produtos",
        description: "A movimentação precisa estar em andamento para registrar produtos.",
        variant: "destructive",
      });
      return;
    }
    
    if (!selectedProduct) return;
    // Open confirmation dialog instead of adding directly
    // Use setTimeout to ensure the dialog opens after the Enter key event is fully processed
    setTimeout(() => {
      setShowConfirmDialog(true);
      console.log('Dialog should be opening now');
    }, 0);
  };

  const handleConfirmAddItem = () => {
    if (!isEditable) {
      toast({
        title: "Não é possível adicionar produtos",
        description: "A movimentação precisa estar em andamento para registrar produtos.",
        variant: "destructive",
      });
      setShowConfirmDialog(false);
      return;
    }
    
    if (!selectedProduct) return;
    
    // Validate supplier for rented/consigned products
    if (selectedProduct.requiresSupplier && !ownerName.trim()) {
      toast({
        title: "Proprietário obrigatório",
        description: "Informe o proprietário/fornecedor para produtos locados ou consignados.",
        variant: "destructive",
      });
      return;
    }
    
    addItemMutation.mutate({
      productId: selectedProduct.id,
      quantity,
      scannedSku: scannedSku || selectedProduct.sku,
      ownerName: selectedProduct.requiresSupplier ? ownerName : undefined,
      ownerType: selectedProduct.requiresSupplier ? selectedProduct.ownership : "owned",
    });
    setShowConfirmDialog(false);
    setIsSelectOpen(false); // Reset Select state
  };

  const handleCancelAddItem = () => {
    setShowConfirmDialog(false);
    setIsSelectOpen(false); // Reset Select state
    // Return focus to quantity input
    setTimeout(() => quantityInputRef.current?.focus(), 100);
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

  // Auto-focus quantity input when product is selected
  useEffect(() => {
    if (selectedProduct) {
      setTimeout(() => {
        quantityInputRef.current?.focus();
        quantityInputRef.current?.select();
      }, 100);
    }
  }, [selectedProduct]);

  // Pre-populate status when edit dialog opens
  useEffect(() => {
    if (showEditStatusDialog && movement) {
      setNewStatus(movement.status);
    }
  }, [showEditStatusDialog, movement]);

  // Handle Enter key in confirmation dialog
  useEffect(() => {
    if (!showConfirmDialog) return;
    
    const handleDialogKeyPress = (e: KeyboardEvent) => {
      console.log('Dialog keydown:', e.key, 'isSelectOpen:', isSelectOpen);
      
      // If Select is open, don't handle Enter
      if (isSelectOpen) {
        console.log('Select is open, ignoring keydown');
        return;
      }
      
      if (e.key === "Enter") {
        console.log('Enter pressed in dialog, confirming...');
        e.preventDefault();
        e.stopPropagation();
        handleConfirmAddItem();
      } else if (e.key === "Escape") {
        console.log('Escape pressed in dialog, canceling...');
        e.preventDefault();
        e.stopPropagation();
        handleCancelAddItem();
      }
    };
    
    window.addEventListener("keydown", handleDialogKeyPress, true); // Use capture phase
    return () => window.removeEventListener("keydown", handleDialogKeyPress, true);
  }, [showConfirmDialog, selectedProduct, quantity, isSelectOpen, handleConfirmAddItem, handleCancelAddItem]);

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
      <div>
        <PageHeader title="Movimentação" description="Detalhes operacionais" />
        <PageLoading message="Carregando movimentação..." />
      </div>
    );
  }

  if (!movement) {
    return (
      <div>
        <PageHeader title="Movimentação" description="Detalhes operacionais" />
        <PageLoading message="Movimentação não encontrada" />
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {/* Botão de Modo Foco - Sempre visível */}
      <div className="fixed top-20 right-6 z-50">
        <Button
          variant="outline"
          size="icon"
          onClick={toggleFocusMode}
          data-testid="button-toggle-focus"
          title={focusMode ? "Sair do modo foco" : "Entrar em modo foco"}
        >
          {focusMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
      </div>

      {/* Header */}
      {!focusMode && (
        <PageHeader
          title={movement.movementNumber}
          description={
            movement.name +
            (movement.movementTypeConfig ? ` • ${movement.movementTypeConfig.name}` : "") +
            (movement.loadingOrder ? ` • Ordem: ${movement.loadingOrder.orderNumber}` : "")
          }
        >
          {userCanChangeMovementStatusFreely(user) && (
            <Button
              variant="outline"
              onClick={() => setShowEditStatusDialog(true)}
              data-testid="button-edit-status"
            >
              <Edit className="h-4 w-4 mr-2" />
              Editar Status
            </Button>
          )}
          {movement.status === "created" && userCanManageMovementItems(user) && (
            <Button
              onClick={handleStartMovement}
              disabled={updateStatusMutation.isPending}
              data-testid="button-start"
            >
              <PlayCircle className="h-4 w-4 mr-2" />
              Iniciar
            </Button>
          )}
          {movement.status === "in_progress" && userCanManageMovementItems(user) && (
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
          {movement.status === "paused" && userCanManageMovementItems(user) && (
            <Button
              onClick={handleContinueMovement}
              disabled={updateStatusMutation.isPending}
              data-testid="button-continue"
            >
              <PlayCircle className="h-4 w-4 mr-2" />
              Continuar
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate("/movements")}
            data-testid="button-back"
            title="Voltar"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </PageHeader>
      )}

      {/* Status e Informações */}
      {!focusMode && (
        <PageSection>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Status</p>
                <div className="mt-1">
                  <StatusBadge status={movement.status} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Doca</p>
                <p className="text-lg font-semibold">{movement.dock?.name || "-"}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Veículo</p>
                <p className="text-lg font-semibold">{movement.vehiclePlate || "-"}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Progresso</p>
                <p className="text-lg font-semibold mb-2">
                  {totalLoaded} / {totalExpected} ({progress}%)
                </p>
                <Progress value={progress} className="h-2" />
              </CardContent>
            </Card>
          </div>
        </PageSection>
      )}

      {/* Scanner */}
      {!isEditable && movement?.status && (
        <Alert className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {movement.status === "pending_approval" && "Movimentação pendente de aprovação. Aguarde a aprovação para registrar produtos."}
            {movement.status === "paused" && "Movimentação pausada. Clique em 'Retomar Movimentação' para continuar registrando produtos."}
            {movement.status === "completed" && "Movimentação finalizada. Não é possível adicionar ou modificar produtos."}
            {movement.status === "cancelled" && "Movimentação cancelada. Não é possível adicionar ou modificar produtos."}
            {movement.status === "created" && "Clique em 'Iniciar Movimentação' para começar a registrar produtos."}
          </AlertDescription>
        </Alert>
      )}

      {isEditable && userCanManageMovementItems(user) && (
        <PageSection title="Scanner de Produtos" description="Registre produtos via SKU, código de barras ou nome">
          <Card>
            <CardContent className="space-y-4 p-4">
            <div className="relative">
              <label className="block mb-2 font-medium flex items-center gap-2">
                Produto
                <Badge variant="outline" className="text-xs">
                  <Keyboard className="h-3 w-3 mr-1" />
                  Auto-focus
                </Badge>
              </label>
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

                <div className="space-y-3">
                  <label className="block font-medium flex items-center gap-2">
                    Quantidade
                    <Badge variant="outline" className="text-xs">
                      <Keyboard className="h-3 w-3 mr-1" />
                      Auto-select
                    </Badge>
                  </label>
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
                        ref={quantityInputRef}
                        type="number"
                        min="1"
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            console.log('Enter pressed on quantity input');
                            e.preventDefault();
                            e.stopPropagation();
                            handleAddItem();
                          }
                        }}
                        className={`w-24 text-center text-lg ${
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
                      className="flex-1 gap-2"
                      data-testid="button-add-item"
                      variant={willExceedExpected ? "destructive" : "default"}
                    >
                      {addItemMutation.isPending ? "Adicionando..." : "Confirmar Item"}
                      <Badge variant="outline" className="bg-background/20">ENTER</Badge>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </PageSection>
      )}

      {/* Lista dupla: Esperado vs Carregado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Itens Esperados (da Ordem) */}
        {expectedItems.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3 font-semibold text-base">
                <ClipboardList className="h-5 w-5" />
                Itens da Ordem ({expectedItems.length})
              </div>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, SKU ou código de barras..."
                  value={orderSearchQuery}
                  onChange={(e) => setOrderSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-order-items"
                />
              </div>
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-3">
                  {filteredExpectedItems.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      {orderSearchQuery ? "Nenhum item encontrado" : "Nenhum item na ordem"}
                    </p>
                  ) : (
                    filteredExpectedItems.map((item) => {
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
                  }))
                }
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Itens Carregados */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3 font-semibold text-base">
              <PackageCheck className="h-5 w-5" />
              Itens Carregados ({consolidatedLoadedItems.length})
            </div>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, SKU ou código de barras..."
                value={loadedSearchQuery}
                onChange={(e) => setLoadedSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-loaded-items"
              />
            </div>
            <ScrollArea className="h-[500px] pr-4">
              {filteredLoadedItems.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {loadedSearchQuery ? "Nenhum item encontrado" : "Nenhum item carregado ainda"}
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredLoadedItems.map((item) => {
                    const product = products.find((p) => p.id === item.productId);
                    return (
                      <div
                        key={item.productId}
                        className={`flex items-center justify-between gap-3 p-3 border rounded-lg hover-elevate ${
                          item.isNotInOrder ? "bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800" : ""
                        }`}
                        data-testid={`item-${item.productId}`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium">{product?.name || "Produto desconhecido"}</p>
                            {item.isNotInOrder && (
                              <Badge variant="outline" className="bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border-amber-400 dark:border-amber-600">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Produto não consta na ordem
                              </Badge>
                            )}
                            {item.ownerTypes.has("rented") && (
                              <Badge variant="outline" className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500">
                                🟡 LOCADO
                              </Badge>
                            )}
                            {item.ownerTypes.has("third_party") && (
                              <Badge variant="outline" className="bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500">
                                🔵 TERCEIROS
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 flex-wrap">
                            <p className="text-sm text-muted-foreground">
                              SKU: {product?.sku || "-"}
                            </p>
                            {item.owners.size > 0 && (
                              <p className="text-sm text-muted-foreground">
                                Fornecedor: {Array.from(item.owners).join(", ")}
                              </p>
                            )}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-lg px-4 py-1">
                          {item.totalQuantity}x
                        </Badge>
                        {movement?.status === "in_progress" && userCanManageMovementItems(user) && (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => decrementItemMutation.mutate(item.productId)}
                              disabled={!isEditable || decrementItemMutation.isPending}
                              data-testid={`button-decrement-${item.productId}`}
                              className="flex-shrink-0 h-8 w-8"
                              title={!isEditable ? "Movimentação precisa estar em andamento" : "Remover 1 unidade"}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => removeItemMutation.mutate(item.productId)}
                              disabled={!isEditable || removeItemMutation.isPending}
                              data-testid={`button-remove-${item.productId}`}
                              className="flex-shrink-0 h-8 w-8 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                              title={!isEditable ? "Movimentação precisa estar em andamento" : "Remover item completo"}
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

      {/* Modal de Confirmação */}
      <Dialog 
        open={showConfirmDialog} 
        onOpenChange={(open) => {
          console.log('Dialog onOpenChange:', open);
          setShowConfirmDialog(open);
        }}
      >
        <DialogContent 
          className="sm:max-w-[600px]"
          onKeyDown={(e) => {
            console.log('DialogContent keydown:', e.key, 'isSelectOpen:', isSelectOpen);
            
            // Ignore if Select dropdown is open
            if (isSelectOpen) {
              console.log('Select is open, ignoring keydown');
              return;
            }
            
            if (e.key === 'Enter') {
              console.log('Enter pressed in DialogContent, confirming...');
              e.preventDefault();
              e.stopPropagation();
              handleConfirmAddItem();
            } else if (e.key === 'Escape') {
              console.log('Escape pressed in DialogContent, canceling...');
              e.preventDefault();
              e.stopPropagation();
              handleCancelAddItem();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-2xl">Confirmar Adição de Item</DialogTitle>
            <DialogDescription>
              Verifique os dados do produto e quantidade antes de confirmar
            </DialogDescription>
          </DialogHeader>
          
          {selectedProduct && (
            <div className="space-y-6 py-4">
              <div className="space-y-4 p-6 bg-accent/20 rounded-lg border-2">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">PRODUTO</p>
                  <p className="text-4xl font-bold" data-testid="text-confirm-product-name">
                    {selectedProduct.name}
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">SKU</p>
                    <p className="text-2xl font-semibold">{selectedProduct.sku}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">CÓDIGO DE BARRAS</p>
                    <p className="text-2xl font-semibold">{selectedProduct.barcode || "-"}</p>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-primary/10 rounded-lg border-2 border-primary">
                <p className="text-sm text-muted-foreground mb-1">QUANTIDADE</p>
                <p className="text-6xl font-bold text-primary" data-testid="text-confirm-quantity">
                  {quantity}
                </p>
                {selectedExpectedItem && (
                  <div className="mt-4 space-y-1">
                    <p className="text-sm">
                      <span className="text-muted-foreground">Esperado:</span>{" "}
                      <span className="font-medium">{selectedExpectedItem.expectedQuantity}</span>
                    </p>
                    <p className="text-sm">
                      <span className="text-muted-foreground">Já carregado:</span>{" "}
                      <span className="font-medium">{selectedExpectedItem.loadedQuantity}</span>
                    </p>
                    <p className="text-sm">
                      <span className="text-muted-foreground">Total após adicionar:</span>{" "}
                      <span className="font-medium">{selectedExpectedItem.loadedQuantity + quantity}</span>
                    </p>
                  </div>
                )}
              </div>

              {/* Owner/Supplier fields for rented/consigned products */}
              {selectedProduct.requiresSupplier && (
                <div className="p-6 bg-yellow-500/10 rounded-lg border-2 border-yellow-500">
                  <div className="flex items-center gap-2 mb-4">
                    <Badge variant="outline" className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500">
                      🟡 {selectedProduct.ownership === 'rented' ? 'LOCADO' : 'CONSIGNADO'}
                    </Badge>
                    <p className="text-sm text-muted-foreground">
                      Rastreamento de material de terceiros
                    </p>
                  </div>
                  
                  <div>
                    <Label htmlFor="ownerName" className="text-sm font-medium mb-2 block">
                      Proprietário/Fornecedor *
                    </Label>
                    <Select 
                      value={ownerName} 
                      onValueChange={setOwnerName}
                      onOpenChange={setIsSelectOpen}
                    >
                      <SelectTrigger id="ownerName" data-testid="select-owner-name">
                        <SelectValue placeholder="Selecione o fornecedor..." />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {suppliers.filter(s => s.name).map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.name}>
                            {supplier.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-2">
                      ⚠️ Campo obrigatório para rastreamento de material de terceiros
                    </p>
                  </div>
                </div>
              )}

              {willExceedExpected && (
                <div className="p-4 bg-destructive/20 border-2 border-destructive rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-6 w-6 text-destructive mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-destructive text-lg">
                        ATENÇÃO: Quantidade excederá o esperado!
                      </p>
                      <p className="text-destructive/80 mt-1">
                        Você está adicionando {quantity} unidades, mas só faltam {selectedExpectedItem!.remaining}.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={handleCancelAddItem}
              data-testid="button-cancel-confirm"
              className="flex items-center gap-2"
            >
              Cancelar
              <Badge variant="outline" className="ml-1">ESC</Badge>
            </Button>
            <Button
              onClick={handleConfirmAddItem}
              disabled={addItemMutation.isPending}
              data-testid="button-confirm-add"
              ref={confirmButtonRef}
              variant={willExceedExpected ? "destructive" : "default"}
              className="flex items-center gap-2"
            >
              {addItemMutation.isPending ? "Adicionando..." : "Confirmar"}
              <Badge variant="outline" className="ml-1 bg-background/20">ENTER</Badge>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Status Dialog */}
      <Dialog open={showEditStatusDialog} onOpenChange={setShowEditStatusDialog}>
        <DialogContent data-testid="dialog-edit-status">
          <DialogHeader>
            <DialogTitle>Editar Status da Movimentação</DialogTitle>
            <DialogDescription>
              Selecione o novo status para esta movimentação
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="new-status" className="mb-2 block">Novo Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger id="new-status" data-testid="select-new-status">
                  <SelectValue placeholder="Selecione o status..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created">Criada</SelectItem>
                  <SelectItem value="in_progress">Em Andamento</SelectItem>
                  <SelectItem value="paused">Pausada</SelectItem>
                  <SelectItem value="completed">Finalizada</SelectItem>
                  <SelectItem value="cancelled">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowEditStatusDialog(false);
                setNewStatus("");
              }}
              data-testid="button-cancel-edit-status"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (newStatus) {
                  updateStatusMutation.mutate(newStatus);
                }
              }}
              disabled={!newStatus || updateStatusMutation.isPending}
              data-testid="button-confirm-edit-status"
            >
              {updateStatusMutation.isPending ? "Atualizando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Action History Section */}
      {!focusMode && auditLogs.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3 font-semibold text-base">
              <Clock className="h-5 w-5" />
              Histórico de Ações
            </div>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {auditLogs.map((log) => {
                  const getActionIcon = () => {
                    switch (log.action) {
                      case "item_added": return <Plus className="h-4 w-4 text-green-600" />;
                      case "item_removed": return <Minus className="h-4 w-4 text-red-600" />;
                      case "status_changed": return <FileText className="h-4 w-4 text-blue-600" />;
                      default: return <Clock className="h-4 w-4 text-gray-600" />;
                    }
                  };

                  const getActionDescription = () => {
                    const metadata = log.metadata as any;
                    const context = log.context as any;
                    
                    switch (log.action) {
                      case "item_added":
                        return `Adicionou ${metadata?.quantity}x ${metadata?.productName} (SKU: ${metadata?.sku})${metadata?.ownerName ? ` - ${metadata.ownerName}` : ""}`;
                      case "item_removed":
                        return `Removeu ${metadata?.quantity}x ${metadata?.productName} (SKU: ${metadata?.sku})${metadata?.ownerName ? ` - ${metadata.ownerName}` : ""}`;
                      case "status_changed":
                        return `Alterou status de ${getStatusLabel(context?.previousStatus)} para ${getStatusLabel(context?.newStatus)}`;
                      default:
                        return log.action;
                    }
                  };

                  return (
                    <div
                      key={log.id}
                      className="flex gap-3 p-3 border rounded-lg hover-elevate"
                      data-testid={`audit-log-${log.id}`}
                    >
                      <div className="mt-1">{getActionIcon()}</div>
                      <div className="flex-1">
                        <p className="font-medium">{getActionDescription()}</p>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {log.actorName}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(log.occurredAt), "dd/MM/yyyy HH:mm")}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
