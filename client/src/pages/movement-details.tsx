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
  Camera,
  ImageIcon,
  Film,
  Upload,
  Trash2,
  ZoomIn,
  Play,
  TrendingUp,
  Calendar,
  Info,
  Activity,
  Filter,
  CheckCheck,
  ListFilter,
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
import { Textarea } from "@/components/ui/textarea";
import type { Movement, MovementItem, Product, LoadingOrderItem, MovementTypeConfig, MovementAuditLog, MovementAttachment } from "@shared/schema";

type MovementWithDetails = Movement & {
  loadingOrder?: {
    id: string;
    orderNumber: string;
  };
  request?: {
    id: string;
    area: string;
    event?: { id: string; name: string };
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Evidence state
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
  const [uploadCategory, setUploadCategory] = useState("other");
  const [uploadCaption, setUploadCaption] = useState("");
  const [uploadProductId, setUploadProductId] = useState("");
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [evidenceCategoryFilter, setEvidenceCategoryFilter] = useState("all");
  const [auditFilter, setAuditFilter] = useState<"all"|"items"|"status"|"evidence">("all");

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

  const { data: attachments = [] } = useQuery<MovementAttachment[]>({
    queryKey: ["/api/movements", id, "attachments"],
    queryFn: async () => {
      const res = await fetch(`/api/movements/${id}/attachments`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch attachments");
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
      .slice(0, 50);
  }, [searchQuery, products]);

  // Determine if the movement can be edited (items can be added/modified/deleted)
  const isEditable = movement?.status === "in_progress";

  // Evidence computed values
  const photoCount = attachments.filter(a => a.fileType === "image").length;
  const videoCount = attachments.filter(a => a.fileType === "video").length;

  const filteredAttachments = useMemo(() => {
    if (evidenceCategoryFilter === "all") return attachments;
    if (evidenceCategoryFilter === "images") return attachments.filter(a => a.fileType === "image");
    if (evidenceCategoryFilter === "videos") return attachments.filter(a => a.fileType === "video");
    return attachments.filter(a => a.category === evidenceCategoryFilter);
  }, [attachments, evidenceCategoryFilter]);

  // Filter audit logs by type
  const filteredAuditLogs = useMemo(() => {
    if (auditFilter === "all") return auditLogs;
    if (auditFilter === "items") return auditLogs.filter(l => ["item_added","item_removed","item_quantity_changed"].includes(l.action));
    if (auditFilter === "status") return auditLogs.filter(l => l.action === "status_changed");
    if (auditFilter === "evidence") return auditLogs.filter(l => l.action === "evidence_added");
    return auditLogs;
  }, [auditLogs, auditFilter]);

  // Map of productId → evidence count
  const evidenceByProduct = useMemo(() => {
    const map = new Map<string, number>();
    attachments.forEach(a => {
      if (a.productId) map.set(a.productId, (map.get(a.productId) || 0) + 1);
    });
    return map;
  }, [attachments]);

  // Evidence handlers
  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFile(file);
    const url = URL.createObjectURL(file);
    setUploadPreviewUrl(url);
  }

  function handleUploadSubmit() {
    if (!uploadFile) return;
    const formData = new FormData();
    formData.append("file", uploadFile);
    formData.append("category", uploadCategory);
    if (uploadCaption.trim()) formData.append("caption", uploadCaption);
    if (uploadProductId) formData.append("productId", uploadProductId);
    uploadAttachmentMutation.mutate(formData);
  }

  function openUploadDialog(productId?: string) {
    setUploadFile(null);
    setUploadPreviewUrl(null);
    setUploadCategory("other");
    setUploadCaption("");
    setUploadProductId(productId || "");
    setShowUploadDialog(true);
  }

  const uploadAttachmentMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch(`/api/movements/${id}/attachments`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any).error || "Falha ao enviar arquivo");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/movements", id, "attachments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/movements", id, "audit-logs"] });
      setShowUploadDialog(false);
      setUploadFile(null);
      setUploadPreviewUrl(null);
      setUploadCategory("other");
      setUploadCaption("");
      setUploadProductId("");
      toast({ title: "Evidência enviada", description: "Arquivo anexado com sucesso." });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" });
    },
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: async (attachmentId: string) => {
      const res = await fetch(`/api/movements/${id}/attachments/${attachmentId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao remover evidência");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/movements", id, "attachments"] });
      toast({ title: "Evidência removida" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" });
    },
  });

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
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-2">
            {/* Status */}
            <Card className="border-border/60 min-w-0">
              <CardContent className="p-2.5 flex flex-col min-h-[80px]">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">
                  <BarChart3 className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">Status</span>
                </div>
                <div className="mt-auto pt-1.5">
                  <StatusBadge status={movement.status} />
                </div>
              </CardContent>
            </Card>

            {/* Esperados */}
            <Card className="border-border/60 min-w-0">
              <CardContent className="p-2.5 flex flex-col min-h-[80px]">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">
                  <ClipboardList className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">Esperados</span>
                </div>
                <div className="mt-auto pt-1">
                  <div className="text-xl font-bold tabular-nums leading-none">{totalExpected}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">na ordem</div>
                </div>
              </CardContent>
            </Card>

            {/* Carregados */}
            <Card className={`border-border/60 min-w-0 ${totalExpected > 0 && totalLoaded >= totalExpected ? "border-emerald-500/40 bg-emerald-500/5" : ""}`}>
              <CardContent className="p-2.5 flex flex-col min-h-[80px]">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">
                  <PackageCheck className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">Carregados</span>
                </div>
                <div className="mt-auto pt-1">
                  <div className={`text-xl font-bold tabular-nums leading-none ${totalExpected > 0 && totalLoaded >= totalExpected ? "text-emerald-500" : ""}`}>{totalLoaded}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">unidades</div>
                </div>
              </CardContent>
            </Card>

            {/* Pendentes */}
            <Card className={`border-border/60 min-w-0 transition-colors ${totalPending > 0 ? "border-amber-500/40 bg-amber-500/5" : ""}`}>
              <CardContent className="p-2.5 flex flex-col min-h-[80px]">
                <div className={`flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide ${totalPending > 0 ? "text-amber-500" : "text-muted-foreground"}`}>
                  <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">Pendentes</span>
                </div>
                <div className="mt-auto pt-1">
                  <div className={`text-xl font-bold tabular-nums leading-none ${totalPending > 0 ? "text-amber-500" : ""}`}>{totalPending}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">faltam</div>
                </div>
              </CardContent>
            </Card>

            {/* Excedentes */}
            <Card className={`border-border/60 min-w-0 transition-colors ${totalExceeded > 0 ? "border-rose-500/40 bg-rose-500/5" : ""}`}>
              <CardContent className="p-2.5 flex flex-col min-h-[80px]">
                <div className={`flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide ${totalExceeded > 0 ? "text-rose-500" : "text-muted-foreground"}`}>
                  <Plus className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">Excedentes</span>
                </div>
                <div className="mt-auto pt-1">
                  <div className={`text-xl font-bold tabular-nums leading-none ${totalExceeded > 0 ? "text-rose-500" : ""}`}>{totalExceeded}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">além</div>
                </div>
              </CardContent>
            </Card>

            {/* Progresso */}
            <Card className="border-border/60 min-w-0">
              <CardContent className="p-2.5 flex flex-col min-h-[80px]">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">
                  <TrendingUp className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">Progresso</span>
                </div>
                <div className="mt-auto pt-1">
                  <div className={`text-xl font-bold tabular-nums leading-none ${progress === 100 ? "text-emerald-500" : progress >= 50 ? "text-amber-500" : progress > 0 ? "text-foreground" : "text-muted-foreground"}`}>{progress}%</div>
                  <Progress value={Math.min(progress, 100)} className="h-1 mt-1.5" />
                </div>
              </CardContent>
            </Card>

            {/* Evidências (clickable) */}
            <button
              className="text-left border rounded-lg border-border/60 hover-elevate active-elevate-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-w-0"
              onClick={() => { const el = document.getElementById("section-evidencias"); if (el) el.scrollIntoView({ behavior: "smooth" }); }}
              data-testid="card-evidence-count"
            >
              <div className="p-2.5 flex flex-col min-h-[80px]">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">
                  <Camera className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">Evidências</span>
                </div>
                <div className="mt-auto pt-1">
                  <div className="text-xl font-bold tabular-nums leading-none">{photoCount + videoCount}</div>
                  <div className="flex gap-1.5 mt-0.5 flex-wrap">
                    {photoCount > 0 && <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><ImageIcon className="h-2.5 w-2.5" />{photoCount}</span>}
                    {videoCount > 0 && <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Film className="h-2.5 w-2.5" />{videoCount}</span>}
                    {photoCount === 0 && videoCount === 0 && <span className="text-[10px] text-muted-foreground">ver</span>}
                  </div>
                </div>
              </div>
            </button>
          </div>

          {/* Metadados */}
          <div className="mt-3 pt-3 border-t border-border/40 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              Doca: <span className="text-foreground font-medium">{movement.dock?.name || "—"}</span>
            </span>
            <span className="flex items-center gap-1">
              <Truck className="h-3.5 w-3.5" />
              Veículo: <span className="text-foreground font-medium">{movement.vehiclePlate || "—"}</span>
            </span>
            <span className="flex items-center gap-1">
              <Tag className="h-3.5 w-3.5" />
              Tipo: <span className="text-foreground font-medium">{movement.movementTypeConfig?.name || "—"}</span>
            </span>
            {movement.loadingOrder && (
              <span className="flex items-center gap-1">
                <Layers className="h-3.5 w-3.5" />
                Ordem: <span className="text-foreground font-medium">{movement.loadingOrder.orderNumber}</span>
              </span>
            )}
            {movement.request && (
              <span className="flex items-center gap-1">
                <Layers className="h-3.5 w-3.5" />
                Requisição: <span className="text-foreground font-medium">
                  {movement.request.event?.name ? `${movement.request.event.name} — ` : ""}{movement.request.area}
                </span>
              </span>
            )}
            {movement.events && movement.events.length > 0 && (
              <span className="flex items-center gap-1">
                <Tag className="h-3.5 w-3.5" />
                Evento: <span className="text-foreground font-medium">{movement.events.map(e => e.name).join(", ")}</span>
              </span>
            )}
            {movement.createdAt && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                Criado: <span className="text-foreground font-medium">{format(new Date(movement.createdAt), "dd/MM/yy HH:mm")}</span>
              </span>
            )}
          </div>
        </PageSection>
      )}

      {/* Alertas Operacionais */}
      {!focusMode && (() => {
        const hasPostCompletionEvidence = attachments.some(a => a.isPostCompletion);
        const alerts: Array<{ type: "warning"|"error"|"info"|"muted"; icon: React.ElementType; message: string }> = [];
        if (movement.status === "paused") alerts.push({ type: "warning", icon: PauseCircle, message: "Movimentação pausada — escaneamento temporariamente interrompido. Clique em \"Continuar\" para retomar." });
        if (movement.status === "completed") alerts.push({ type: "info", icon: CheckCheck, message: "Movimentação finalizada — modo somente consulta. Você ainda pode adicionar evidências." });
        if (totalPending > 0 && movement.status === "in_progress") alerts.push({ type: "warning", icon: AlertTriangle, message: `${totalPending} ${totalPending === 1 ? "item pendente" : "itens pendentes"} — carregamento ainda não concluído` });
        if (totalExceeded > 0) alerts.push({ type: "error", icon: AlertTriangle, message: `${totalExceeded} ${totalExceeded === 1 ? "item excedeu" : "itens excederam"} a quantidade prevista` });
        if (hasPostCompletionEvidence) alerts.push({ type: "info", icon: Camera, message: "Há evidências adicionadas após a finalização desta movimentação" });
        if (movement.status === "in_progress" && attachments.length === 0) alerts.push({ type: "muted", icon: Camera, message: "Nenhuma evidência anexada ainda — recomendamos registrar fotos durante o carregamento" });
        if (alerts.length === 0) return null;
        const colorMap = {
          warning: "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400",
          error: "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400",
          info: "bg-sky-500/10 border-sky-500/30 text-sky-600 dark:text-sky-400",
          muted: "bg-muted/40 border-border/40 text-muted-foreground",
        };
        return (
          <PageSection>
            <div className="flex flex-col gap-2">
              {alerts.map((alert, idx) => {
                const Icon = alert.icon;
                return (
                  <div key={idx} className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border text-sm ${colorMap[alert.type]}`} data-testid={`alert-${alert.type}-${idx}`}>
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span>{alert.message}</span>
                  </div>
                );
              })}
            </div>
          </PageSection>
        );
      })()}

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
          <Card className="border-border/60">
            <CardContent className="p-3 space-y-3">
              {/* Search row */}
              <div className="flex gap-2 relative">
                <div className="flex-1 relative">
                  <Scan className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    ref={searchInputRef}
                    placeholder="SKU, código de barras ou nome..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowSuggestions(true);
                      if (!e.target.value.trim()) setSelectedProduct(null);
                    }}
                    onClick={(e) => { e.stopPropagation(); if (searchQuery.trim()) setShowSuggestions(true); }}
                    disabled={!!selectedProduct}
                    data-testid="input-search-product"
                    className="pl-9"
                    autoFocus
                  />
                  {showSuggestions && filteredProducts.length > 0 && !selectedProduct && (
                    <Card className="absolute top-full left-0 right-0 mt-1 z-50 max-h-72 overflow-auto border-border/60">
                      <CardContent className="p-0">
                        {filteredProducts.map((product) => (
                          <button
                            key={product.id}
                            onClick={(e) => { e.stopPropagation(); handleSelectProduct(product); }}
                            className="w-full text-left p-3 hover-elevate active-elevate-2 border-b last:border-b-0"
                            data-testid={`suggestion-${product.id}`}
                          >
                            <p className="font-medium text-sm">{product.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {product.sku}{product.barcode && ` · ${product.barcode}`}
                            </p>
                          </button>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </div>
                <Button
                  onClick={() => { if (filteredProducts.length === 1) handleSelectProduct(filteredProducts[0]); }}
                  disabled={!searchQuery || !!selectedProduct || filteredProducts.length !== 1}
                  data-testid="button-search"
                  title="Buscar produto"
                >
                  <Search className="h-4 w-4" />
                </Button>
                {selectedProduct && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => { setSelectedProduct(null); setQuantity(1); setSearchQuery(""); }}
                    data-testid="button-clear"
                    title="Limpar seleção"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
                <Badge variant="outline" className="hidden sm:flex items-center gap-1 text-xs px-2 self-center">
                  <Keyboard className="h-3 w-3" />
                  Auto-focus
                </Badge>
              </div>

              {/* Product card — compact horizontal layout */}
              {selectedProduct && (
                <div className={`border rounded-lg ${willExceedExpected ? "bg-destructive/10 border-destructive/60" : "bg-muted/40 border-border/60"}`}>
                  <div className="p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                    {/* Left: product info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm leading-snug" data-testid="text-selected-product">
                        {selectedProduct.name}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {selectedProduct.sku}{selectedProduct.barcode && ` · ${selectedProduct.barcode}`}
                      </p>
                      {selectedExpectedItem && (
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5">
                          <span className="text-xs text-muted-foreground">Esperado: <span className="font-semibold text-foreground">{selectedExpectedItem.expectedQuantity}</span></span>
                          <span className="text-xs text-muted-foreground">Carregado: <span className="font-semibold text-foreground">{selectedExpectedItem.loadedQuantity}</span></span>
                          <span className={`text-xs font-semibold ${selectedExpectedItem.remaining > 0 ? "text-amber-500" : "text-emerald-500"}`}>
                            {selectedExpectedItem.remaining > 0 ? `Faltam: ${selectedExpectedItem.remaining}` : "Completo"}
                          </span>
                        </div>
                      )}
                      {willExceedExpected && (
                        <p className="text-xs text-destructive font-medium mt-1 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Excederá: {selectedExpectedItem!.loadedQuantity + quantity} / {selectedExpectedItem!.expectedQuantity}
                        </p>
                      )}
                    </div>

                    {/* Right: quantity controls + confirm */}
                    <div className="flex items-center gap-2 flex-shrink-0">
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
                            e.preventDefault();
                            e.stopPropagation();
                            handleAddItem();
                          }
                        }}
                        className={`w-16 text-center font-bold text-base ${willExceedExpected ? "border-destructive" : ""}`}
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
                      <Button
                        onClick={handleAddItem}
                        disabled={addItemMutation.isPending}
                        data-testid="button-add-item"
                        variant={willExceedExpected ? "destructive" : "default"}
                        className="gap-1.5"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {addItemMutation.isPending ? "..." : "Confirmar"}
                        <Badge variant="outline" className="bg-background/20 text-[10px] px-1 py-0 hidden sm:flex">ENTER</Badge>
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </PageSection>
      )}

      {/* Resumo da Conferência */}
      {!focusMode && expectedItems.length > 0 && (
        <PageSection>
          <Card className="border-border/60 bg-muted/20">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2 text-sm font-semibold">
                <Activity className="h-4 w-4 text-muted-foreground" />
                Resumo da Conferência
              </div>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-sm text-muted-foreground">
                    Completos: <span className="font-semibold text-foreground">{expectedItems.filter(i => i.remaining === 0 && i.loadedQuantity <= i.expectedQuantity).length}</span>
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-amber-500" />
                  <span className="text-sm text-muted-foreground">
                    Pendentes: <span className="font-semibold text-amber-500">{expectedItems.filter(i => i.remaining > 0).length}</span>
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-rose-500" />
                  <span className="text-sm text-muted-foreground">
                    Excedidos: <span className={`font-semibold ${totalExceeded > 0 ? "text-rose-500" : "text-foreground"}`}>{expectedItems.filter(i => i.loadedQuantity > i.expectedQuantity).length}</span>
                  </span>
                </div>
                {auditLogs.length > 0 && (
                  <div className="flex items-center gap-1.5 ml-auto text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>Última ação: <span className="font-medium text-foreground">{auditLogs[0]?.actorName}</span> · {format(new Date(auditLogs[0]?.occurredAt), "HH:mm")}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </PageSection>
      )}

      {/* Lista dupla: Esperado vs Carregado */}
      <PageSection title="Itens" description="Acompanhe o progresso de carregamento">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Itens Esperados (da Ordem) */}
          {expectedItems.length > 0 && (
            <Card className="border-border/60">
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
              <ScrollArea className="max-h-[420px] pr-4" style={{ scrollbarWidth: 'thin' }}>
                <div className="space-y-2">
                  {filteredExpectedItems.length === 0 ? (
                    <div className="text-center text-muted-foreground py-6">
                      <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">{orderSearchQuery ? "Nenhum item encontrado" : "Nenhum item na ordem"}</p>
                    </div>
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
                          {isExceeded ? (
                            <div className="w-full bg-muted rounded-full h-2 flex overflow-hidden">
                              <div className="h-full bg-emerald-500" style={{ width: `${(item.expectedQuantity / item.loadedQuantity) * 100}%` }} />
                              <div className="h-full bg-destructive" style={{ width: `${((item.loadedQuantity - item.expectedQuantity) / item.loadedQuantity) * 100}%` }} />
                            </div>
                          ) : (
                            <div className="w-full bg-muted rounded-full h-2">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  isComplete
                                    ? "bg-emerald-500"
                                    : percentComplete >= 50
                                    ? "bg-amber-500"
                                    : percentComplete > 0
                                    ? "bg-destructive"
                                    : ""
                                }`}
                                style={{ width: `${percentComplete}%` }}
                              />
                            </div>
                          )}
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
        <Card className="border-border/60">
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
            <ScrollArea className="max-h-[420px] pr-4" style={{ scrollbarWidth: 'thin' }}>
              {filteredLoadedItems.length === 0 ? (
                <div className="text-center text-muted-foreground py-6">
                  <PackageCheck className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">{loadedSearchQuery ? "Nenhum item encontrado" : "Nenhum item carregado ainda"}</p>
                </div>
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
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {evidenceByProduct.get(item.productId) && (
                            <Badge
                              variant="outline"
                              className="text-xs cursor-pointer"
                              onClick={() => {
                                setUploadProductId(item.productId);
                                const el = document.getElementById("section-evidencias");
                                if (el) el.scrollIntoView({ behavior: "smooth" });
                              }}
                              title="Ver evidências deste produto"
                              data-testid={`badge-evidence-${item.productId}`}
                            >
                              <Camera className="h-3 w-3 mr-1" />
                              {evidenceByProduct.get(item.productId)}
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-base px-3 py-0.5">
                            {item.totalQuantity}x
                          </Badge>
                        </div>
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

      {/* Evidências Section */}
      {!focusMode && (
        <PageSection
          id="section-evidencias"
          title="Evidências"
          description="Fotos e vídeos vinculados à movimentação"
        >
          <div className="space-y-3">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                {(["all", "images", "videos", "damage", "loss", "before", "after", "other"] as const).map((f) => {
                  const labels: Record<string, string> = {
                    all: "Todos", images: "Fotos", videos: "Vídeos",
                    damage: "Avaria", loss: "Perda", before: "Antes", after: "Depois", other: "Outros",
                  };
                  const counts: Record<string, number> = {
                    all: attachments.length,
                    images: attachments.filter(a => a.fileType === "image").length,
                    videos: attachments.filter(a => a.fileType === "video").length,
                    damage: attachments.filter(a => a.category === "damage").length,
                    loss: attachments.filter(a => a.category === "loss").length,
                    before: attachments.filter(a => a.category === "before").length,
                    after: attachments.filter(a => a.category === "after").length,
                    other: attachments.filter(a => a.category === "other").length,
                  };
                  if (f !== "all" && counts[f] === 0) return null;
                  return (
                    <Button
                      key={f}
                      variant={evidenceCategoryFilter === f ? "default" : "outline"}
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => setEvidenceCategoryFilter(f)}
                      data-testid={`filter-evidence-${f}`}
                    >
                      {labels[f]}
                      {counts[f] > 0 && (
                        <Badge variant="outline" className="ml-1.5 h-4 px-1 text-[10px]">
                          {counts[f]}
                        </Badge>
                      )}
                    </Button>
                  );
                })}
              </div>
              {userCanManageMovementItems(user) && (
                <Button
                  size="sm"
                  onClick={() => openUploadDialog()}
                  data-testid="button-upload-evidence"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Adicionar evidência
                </Button>
              )}
            </div>

            {/* Gallery grid */}
            {filteredAttachments.length === 0 ? (
              <Card className="border-border/60">
                <CardContent className="p-8 text-center text-muted-foreground">
                  <Camera className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Nenhuma evidência registrada</p>
                  <p className="text-sm mt-1">
                    {userCanManageMovementItems(user)
                      ? "Clique em 'Adicionar evidência' para anexar fotos ou vídeos."
                      : "Evidências serão exibidas aqui quando forem adicionadas."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {filteredAttachments.map((att) => {
                  const linkedProduct = att.productId ? products.find(p => p.id === att.productId) : null;
                  const categoryLabels: Record<string, string> = {
                    damage: "Avaria", loss: "Perda", before: "Antes", after: "Depois", other: "Outro",
                  };
                  return (
                    <div
                      key={att.id}
                      className="group border border-border/60 rounded-lg overflow-hidden hover-elevate"
                      data-testid={`evidence-card-${att.id}`}
                    >
                      {/* Thumbnail / preview */}
                      <div className="relative aspect-video bg-muted cursor-pointer" onClick={() => {
                        if (att.fileType === "image") setLightboxUrl(att.fileUrl);
                        else setVideoUrl(att.fileUrl);
                      }}>
                        {att.fileType === "image" ? (
                          <img
                            src={att.fileUrl}
                            alt={att.caption || att.fileName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-muted">
                            <Film className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          {att.fileType === "image" ? (
                            <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          ) : (
                            <Play className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </div>
                        {att.isPostCompletion && (
                          <div className="absolute top-1 left-1">
                            <Badge variant="outline" className="text-[9px] px-1 py-0 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700">
                              Pós-conclusão
                            </Badge>
                          </div>
                        )}
                      </div>
                      {/* Metadata */}
                      <div className="p-2 space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {categoryLabels[att.category] || att.category}
                          </Badge>
                          {userCanManageMovementItems(user) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 text-muted-foreground hover:text-destructive"
                              onClick={() => deleteAttachmentMutation.mutate(att.id)}
                              disabled={deleteAttachmentMutation.isPending}
                              data-testid={`button-delete-evidence-${att.id}`}
                              title="Remover evidência"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        {att.caption && (
                          <p className="text-xs text-muted-foreground truncate" title={att.caption}>{att.caption}</p>
                        )}
                        {linkedProduct && (
                          <p className="text-xs font-medium truncate" title={linkedProduct.name}>
                            {linkedProduct.name}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">{att.uploadedByName}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </PageSection>
      )}

      {/* Action History Section */}
      {!focusMode && auditLogs.length > 0 && (
        <PageSection title="Histórico" description="Registro de ações na movimentação">
          <Card className="border-border/60">
            <CardContent className="p-4">
              {/* Filter tabs */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {([
                  { key: "all" as const, label: "Todos", count: auditLogs.length },
                  { key: "items" as const, label: "Itens", count: auditLogs.filter(l => ["item_added","item_removed","item_quantity_changed"].includes(l.action)).length },
                  { key: "status" as const, label: "Status", count: auditLogs.filter(l => l.action === "status_changed").length },
                  { key: "evidence" as const, label: "Evidências", count: auditLogs.filter(l => l.action === "evidence_added").length },
                ]).map(({ key, label, count }) => {
                  if (key !== "all" && count === 0) return null;
                  return (
                    <Button
                      key={key}
                      variant={auditFilter === key ? "default" : "outline"}
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => setAuditFilter(key)}
                      data-testid={`filter-audit-${key}`}
                    >
                      {label}
                      <Badge variant="outline" className="ml-1.5 h-4 px-1 text-[10px] no-default-hover-elevate no-default-active-elevate">
                        {count}
                      </Badge>
                    </Button>
                  );
                })}
              </div>

              <ScrollArea className="h-[300px] pr-4" style={{ scrollbarWidth: 'thin' }}>
                {filteredAuditLogs.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">Nenhum evento neste filtro</p>
                ) : (
                  <div className="relative pl-6">
                    {/* Timeline vertical line */}
                    <div className="absolute left-2 top-2 bottom-2 w-px bg-border/40" />
                    <div className="space-y-0.5">
                      {filteredAuditLogs.map((log, idx) => {
                        const getActionMeta = () => {
                          switch (log.action) {
                            case "item_added":
                              return { icon: <Plus className="h-3 w-3" />, color: "bg-emerald-500 text-white", label: "Item adicionado" };
                            case "item_removed":
                              return { icon: <Minus className="h-3 w-3" />, color: "bg-rose-500 text-white", label: "Item removido" };
                            case "status_changed":
                              return { icon: <Activity className="h-3 w-3" />, color: "bg-sky-500 text-white", label: "Status alterado" };
                            case "item_quantity_changed":
                              return { icon: <Edit className="h-3 w-3" />, color: "bg-amber-500 text-white", label: "Quantidade ajustada" };
                            case "evidence_added":
                              return { icon: <Camera className="h-3 w-3" />, color: "bg-violet-500 text-white", label: "Evidência adicionada" };
                            default:
                              return { icon: <Clock className="h-3 w-3" />, color: "bg-muted-foreground/50 text-white", label: log.action };
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
                              return `${getStatusLabel(context?.previousStatus)} → ${getStatusLabel(context?.newStatus)}`;
                            case "item_quantity_changed":
                              return `${metadata?.productName}: ${metadata?.previousQuantity} → ${metadata?.newQuantity}`;
                            case "evidence_added": {
                              const typeLabel = metadata?.fileType === "image" ? "Foto" : "Vídeo";
                              const post = metadata?.isPostCompletion ? " (pós-conclusão)" : "";
                              return `${typeLabel} anexada${post}${metadata?.fileName ? `: ${metadata.fileName}` : ""}`;
                            }
                            default:
                              return log.action;
                          }
                        };
                        const meta = getActionMeta();
                        return (
                          <div
                            key={log.id}
                            className="flex items-start gap-3 py-2.5 relative"
                            data-testid={`audit-log-${log.id}`}
                          >
                            {/* Icon dot on timeline */}
                            <div className={`absolute -left-4 flex-shrink-0 h-5 w-5 rounded-full flex items-center justify-center z-10 ${meta.color}`}>
                              {meta.icon}
                            </div>
                            <div className="flex-1 min-w-0 pl-1">
                              <p className="text-sm font-medium leading-snug">{getActionDescription()}</p>
                              <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {log.actorName}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {format(new Date(log.occurredAt), "dd/MM/yy HH:mm")}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </PageSection>
      )}

      {/* Upload Evidence Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={(open) => {
        if (!open) {
          setUploadFile(null);
          setUploadPreviewUrl(null);
          setUploadCategory("other");
          setUploadCaption("");
          setUploadProductId("");
        }
        setShowUploadDialog(open);
      }}>
        <DialogContent className="max-w-lg" data-testid="dialog-upload-evidence">
          <DialogHeader>
            <DialogTitle>Adicionar Evidência</DialogTitle>
            <DialogDescription>
              Anexe uma foto ou vídeo à movimentação
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* File picker */}
            <div>
              <Label className="mb-2 block">Arquivo</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,video/mp4,video/quicktime,video/webm"
                className="hidden"
                onChange={handleFileSelected}
                data-testid="input-file-evidence"
              />
              {!uploadFile ? (
                <button
                  type="button"
                  className="w-full border-2 border-dashed border-border rounded-lg p-8 text-center hover-elevate cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="button-pick-file"
                >
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-medium">Clique para selecionar</p>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WebP, MP4, MOV, WebM</p>
                </button>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  {uploadFile.type.startsWith("image/") && uploadPreviewUrl ? (
                    <img src={uploadPreviewUrl} alt="Preview" className="w-full max-h-48 object-contain bg-muted" />
                  ) : (
                    <div className="p-4 bg-muted flex items-center gap-3">
                      <Film className="h-8 w-8 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{uploadFile.name}</p>
                        <p className="text-xs text-muted-foreground">{(uploadFile.size / 1024 / 1024).toFixed(1)} MB</p>
                      </div>
                    </div>
                  )}
                  <div className="p-2 border-t border-border/40">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground"
                      onClick={() => {
                        setUploadFile(null);
                        setUploadPreviewUrl(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Trocar arquivo
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Category */}
            <div>
              <Label htmlFor="upload-category" className="mb-2 block">Categoria</Label>
              <Select value={uploadCategory} onValueChange={setUploadCategory}>
                <SelectTrigger id="upload-category" data-testid="select-evidence-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="other">Outro</SelectItem>
                  <SelectItem value="before">Antes da movimentação</SelectItem>
                  <SelectItem value="after">Após a movimentação</SelectItem>
                  <SelectItem value="damage">Avaria</SelectItem>
                  <SelectItem value="loss">Perda / Divergência</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Product link (optional) */}
            {consolidatedLoadedItems.length > 0 && (
              <div>
                <Label htmlFor="upload-product" className="mb-2 block">
                  Produto (opcional)
                </Label>
                <Select value={uploadProductId || "none"} onValueChange={v => setUploadProductId(v === "none" ? "" : v)}>
                  <SelectTrigger id="upload-product" data-testid="select-evidence-product">
                    <SelectValue placeholder="Vincular a um produto..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum — geral</SelectItem>
                    {consolidatedLoadedItems.map(item => {
                      const p = products.find(x => x.id === item.productId);
                      return p ? (
                        <SelectItem key={item.productId} value={item.productId}>
                          {p.name}
                        </SelectItem>
                      ) : null;
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Caption */}
            <div>
              <Label htmlFor="upload-caption" className="mb-2 block">Descrição (opcional)</Label>
              <Textarea
                id="upload-caption"
                placeholder="Descreva o que a imagem mostra..."
                value={uploadCaption}
                onChange={(e) => setUploadCaption(e.target.value)}
                rows={2}
                className="resize-none"
                data-testid="input-evidence-caption"
              />
            </div>

            {movement?.status === "completed" && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Esta movimentação está finalizada. A evidência será marcada como "pós-conclusão".
                </AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowUploadDialog(false)}
              data-testid="button-cancel-upload-evidence"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUploadSubmit}
              disabled={!uploadFile || uploadAttachmentMutation.isPending}
              data-testid="button-confirm-upload-evidence"
            >
              {uploadAttachmentMutation.isPending ? "Enviando..." : "Enviar evidência"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox Dialog */}
      <Dialog open={!!lightboxUrl} onOpenChange={(open) => { if (!open) setLightboxUrl(null); }}>
        <DialogContent className="max-w-4xl p-2" data-testid="dialog-lightbox">
          <DialogHeader className="px-2 pt-2 pb-0">
            <DialogTitle className="sr-only">Visualização de imagem</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center bg-muted/50 rounded-md overflow-hidden">
            {lightboxUrl && (
              <img
                src={lightboxUrl}
                alt="Evidência"
                className="max-h-[80vh] max-w-full object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Video Player Dialog */}
      <Dialog open={!!videoUrl} onOpenChange={(open) => { if (!open) setVideoUrl(null); }}>
        <DialogContent className="max-w-3xl p-2" data-testid="dialog-video-player">
          <DialogHeader className="px-2 pt-2 pb-0">
            <DialogTitle className="sr-only">Reprodução de vídeo</DialogTitle>
          </DialogHeader>
          <div className="bg-black rounded-md overflow-hidden">
            {videoUrl && (
              <video
                src={videoUrl}
                controls
                autoPlay
                className="w-full max-h-[75vh]"
                data-testid="video-evidence-player"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
