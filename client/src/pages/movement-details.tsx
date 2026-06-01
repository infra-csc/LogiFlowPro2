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
  BarChart3,
  Truck,
  MapPin,
  Tag,
  Layers,
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
  const [expectedFilter, setExpectedFilter] = useState<"all" | "pending" | "complete" | "exceeded">("all");
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
  const totalExceeded = expectedItems.reduce((sum, item) => sum + Math.max(0, item.loadedQuantity - item.expectedQuantity), 0);
  const totalPending = expectedItems.reduce((sum, item) => sum + Math.max(0, item.expectedQuantity - item.loadedQuantity), 0);
  const progress = totalExpected > 0 ? Math.round((totalLoaded / totalExpected) * 100) : 0;

  // Filter expected items based on order search query + status filter
  const filteredExpectedItems = useMemo(() => {
    let items = expectedItems;
    if (orderSearchQuery.trim()) {
      const query = orderSearchQuery.toLowerCase();
      items = items.filter(
        (item) =>
          item.product.name.toLowerCase().includes(query) ||
          item.product.sku?.toLowerCase().includes(query) ||
          item.product.barcode?.toLowerCase().includes(query)
      );
    }
    if (expectedFilter !== "all") {
      items = items.filter((item) => {
        const isExceeded = item.loadedQuantity > item.expectedQuantity;
        const isComplete = item.remaining === 0 && !isExceeded;
        const isPending = item.remaining > 0;
        if (expectedFilter === "pending") return isPending;
        if (expectedFilter === "complete") return isComplete;
        if (expectedFilter === "exceeded") return isExceeded;
        return true;
      });
    }
    return items;
  }, [expectedItems, orderSearchQuery, expectedFilter]);

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
          title={movement.name}
          description={movement.movementNumber}
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

      {/* Resumo Operacional */}
      {!focusMode && (
        <PageSection>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <BarChart3 className="h-4 w-4" />
                  Status
                </div>
                <div className="mt-1">
                  <StatusBadge status={movement.status} />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ClipboardList className="h-4 w-4" />
                  Esperados
                </div>
                <div className="mt-1 text-xl font-semibold">{totalExpected}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <PackageCheck className="h-4 w-4" />
                  Carregados
                </div>
                <div className="mt-1 text-xl font-semibold">{totalLoaded}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertTriangle className="h-4 w-4" />
                  Pendentes
                </div>
                <div className="mt-1 text-xl font-semibold">{totalPending}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Plus className="h-4 w-4" />
                  Excedentes
                </div>
                <div className={`mt-1 text-xl font-semibold ${totalExceeded > 0 ? "text-rose-500" : ""}`}>
                  {totalExceeded}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <BarChart3 className="h-4 w-4" />
                  Progresso
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-xl font-semibold">{progress}%</span>
                  <Progress value={progress} className="h-2 w-16 flex-1" />
                </div>
              </CardContent>
            </Card>
          </div>
          {/* Metadados */}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              Doca: <span className="text-foreground font-medium">{movement.dock?.name || "-"}</span>
            </span>
            <span className="flex items-center gap-1">
              <Truck className="h-3.5 w-3.5" />
              Veículo: <span className="text-foreground font-medium">{movement.vehiclePlate || "-"}</span>
            </span>
            <span className="flex items-center gap-1">
              <Tag className="h-3.5 w-3.5" />
              Tipo: <span className="text-foreground font-medium">{movement.movementTypeConfig?.name || "-"}</span>
            </span>
            {movement.loadingOrder && (
              <span className="flex items-center gap-1">
                <Layers className="h-3.5 w-3.5" />
                Ordem: <span className="text-foreground font-medium">{movement.loadingOrder.orderNumber}</span>
              </span>
            )}
            {movement.events && movement.events.length > 0 && (
              <span className="flex items-center gap-1">
                <Tag className="h-3.5 w-3.5" />
                Evento: <span className="text-foreground font-medium">{movement.events.map(e => e.name).join(", ")}</span>
              </span>
            )}
          </div>
        </PageSection>
      )}

      {/* Scanner */}
      {!isEditable && movement?.status && (
        <PageSection>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {movement.status === "pending_approval" && "Movimentação pendente de aprovação. Aguarde a aprovação para registrar produtos."}
              {movement.status === "paused" && "Movimentação pausada. Leitura temporariamente interrompida. Clique em 'Continuar' para retomar."}
              {movement.status === "completed" && "Movimentação finalizada. Não é possível adicionar ou modificar produtos."}
              {movement.status === "cancelled" && "Movimentação cancelada. Não é possível adicionar ou modificar produtos."}
              {movement.status === "created" && "Clique em 'Iniciar' para começar a registrar produtos."}
            </AlertDescription>
          </Alert>
        </PageSection>
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
                    : "bg-muted/50"
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
                  <div className="bg-destructive/10 border border-destructive/40 rounded-md p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-destructive">
                          Quantidade excederá o esperado
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
      <PageSection title="Itens" description="Acompanhe o progresso de carregamento">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Itens Esperados (da Ordem) */}
          {expectedItems.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3 font-semibold text-base">
                  <ClipboardList className="h-5 w-5" />
                  Itens da Ordem ({expectedItems.length})
                </div>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, SKU ou código de barras..."
                  value={orderSearchQuery}
                  onChange={(e) => setOrderSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-order-items"
                />
              </div>
              {/* Filtros rápidos */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {(["all", "pending", "complete", "exceeded"] as const).map((f) => {
                  const counts = {
                    all: expectedItems.length,
                    pending: expectedItems.filter(i => i.remaining > 0).length,
                    complete: expectedItems.filter(i => i.remaining === 0 && i.loadedQuantity <= i.expectedQuantity).length,
                    exceeded: expectedItems.filter(i => i.loadedQuantity > i.expectedQuantity).length,
                  };
                  const labels = { all: "Todos", pending: "Pendentes", complete: "Completos", exceeded: "Excedidos" };
                  const isActive = expectedFilter === f;
                  return (
                    <Button
                      key={f}
                      variant={isActive ? "default" : "outline"}
                      size="sm"
                      onClick={() => setExpectedFilter(f)}
                      className="text-xs h-7"
                    >
                      {labels[f]} ({counts[f]})
                    </Button>
                  );
                })}
              </div>
              <ScrollArea className="h-[460px] pr-4" style={{ scrollbarWidth: 'thin' }}>
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
                        className={`border rounded-lg p-3 space-y-2 cursor-pointer hover-elevate ${
                          isExceeded
                            ? "bg-destructive/10 border-destructive"
                            : isComplete
                            ? "bg-emerald-500/10 border-emerald-500"
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
                            <Badge className="bg-rose-500 text-white no-default-hover-elevate">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Excedido
                            </Badge>
                          )}
                          {isComplete && (
                            <Badge className="bg-emerald-500 text-white no-default-hover-elevate">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Completo
                            </Badge>
                          )}
                        </div>
                        <div className="mt-2 pt-2 border-t border-border/40 space-y-1">
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
            {/* Resumo de alertas */}
            {(consolidatedLoadedItems.some(i => i.isNotInOrder) || consolidatedLoadedItems.some(i => i.ownerTypes.has("rented"))) && (
              <div className="flex flex-wrap gap-2 mb-3">
                {consolidatedLoadedItems.filter(i => i.isNotInOrder).length > 0 && (
                  <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-200 border-amber-300 dark:border-amber-700">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {consolidatedLoadedItems.filter(i => i.isNotInOrder).length} fora da ordem
                  </Badge>
                )}
                {consolidatedLoadedItems.filter(i => i.ownerTypes.has("rented")).length > 0 && (
                  <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700">
                    {consolidatedLoadedItems.filter(i => i.ownerTypes.has("rented")).length} locados
                  </Badge>
                )}
              </div>
            )}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, SKU ou código de barras..."
                value={loadedSearchQuery}
                onChange={(e) => setLoadedSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-loaded-items"
              />
            </div>
            <ScrollArea className="h-[460px] pr-4" style={{ scrollbarWidth: 'thin' }}>
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
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm truncate">{product?.name || "Produto desconhecido"}</p>
                            {item.isNotInOrder && (
                              <Badge variant="outline" className="text-xs bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-200 border-amber-300 dark:border-amber-700">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Fora da ordem
                              </Badge>
                            )}
                            {item.ownerTypes.has("rented") && (
                              <Badge variant="outline" className="text-xs bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700">
                                LOCADO
                              </Badge>
                            )}
                            {item.ownerTypes.has("third_party") && (
                              <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700">
                                TERCEIROS
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 flex-wrap mt-0.5">
                            <p className="text-xs font-mono text-muted-foreground">
                              {product?.sku || "-"}
                            </p>
                            {item.owners.size > 0 && (
                              <p className="text-xs text-muted-foreground">
                                {Array.from(item.owners).join(", ")}
                              </p>
                            )}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-base px-3 py-0.5 flex-shrink-0">
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
                              className="flex-shrink-0"
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
                              className="flex-shrink-0 text-destructive"
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
      </PageSection>

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
              <div className="space-y-4 p-4 bg-muted rounded-lg border">
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

              <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
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
                <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-300 dark:border-yellow-700">
                  <div className="flex items-center gap-2 mb-4">
                    <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {selectedProduct.ownership === 'rented' ? 'LOCADO' : 'CONSIGNADO'}
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
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Campo obrigatório para rastreamento de material de terceiros
                    </p>
                  </div>
                </div>
              )}

              {willExceedExpected && (
                <div className="p-4 bg-destructive/10 border border-destructive/40 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-destructive text-sm">
                        Quantidade excederá o esperado
                      </p>
                      <p className="text-sm text-destructive/80 mt-1">
                        Adicionando {quantity} unidades, mas só faltam {selectedExpectedItem!.remaining}.
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
        <PageSection title="Histórico" description="Registro de ações na movimentação">
          <Card>
            <CardContent className="p-4">
              <ScrollArea className="h-[320px] pr-4" style={{ scrollbarWidth: 'thin' }}>
                <div className="space-y-2">
                  {auditLogs.map((log, index) => {
                    const getActionIcon = () => {
                      switch (log.action) {
                        case "item_added": return <Plus className="h-3.5 w-3.5 text-emerald-500" />;
                        case "item_removed": return <Minus className="h-3.5 w-3.5 text-rose-500" />;
                        case "status_changed": return <FileText className="h-3.5 w-3.5 text-sky-500" />;
                        case "item_quantity_changed": return <FileText className="h-3.5 w-3.5 text-sky-500" />;
                        default: return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
                      }
                    };

                    const getActionDescription = () => {
                      const metadata = log.metadata as any;
                      const context = log.context as any;
                      switch (log.action) {
                        case "item_added":
                          return `Adicionou ${metadata?.quantity}x ${metadata?.productName}`;
                        case "item_removed":
                          return `Removeu ${metadata?.quantity}x ${metadata?.productName}`;
                        case "status_changed":
                          return `Status: ${getStatusLabel(context?.previousStatus)} → ${getStatusLabel(context?.newStatus)}`;
                        case "item_quantity_changed":
                          return `${metadata?.productName}: ${metadata?.previousQuantity} → ${metadata?.newQuantity}`;
                        default:
                          return log.action;
                      }
                    };

                    return (
                      <div
                        key={log.id}
                        className="flex items-start gap-2.5 py-2 px-2 border-b last:border-b-0 border-border/40"
                        data-testid={`audit-log-${log.id}`}
                      >
                        <div className="mt-0.5 flex-shrink-0">{getActionIcon()}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{getActionDescription()}</p>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {log.actorName}
                            </span>
                            <span>
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
        </PageSection>
      )}
    </div>
  );
}
