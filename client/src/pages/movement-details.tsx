import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useQueries, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  Maximize2,
  Minimize2,
  Edit,
  Clock,
  User,
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
  Activity,
  CheckCheck,
  RotateCcw,
  ChevronRight,
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
import type {
  Movement,
  MovementItem,
  Product,
  LoadingOrderItem,
  MovementTypeConfig,
  MovementAuditLog,
  MovementAttachment,
  Kit,
  BomLine,
} from "@shared/schema";

// ── Kit BOM formula evaluator (mirrors server calcKitLineQty) ─────────────────
function calcKitItemQty(
  formula: string,
  multiplier: number,
  parameters: Record<string, number>,
  productId: string,
): number {
  const f = (formula ?? "").trim();
  if (f === "?") return Math.max(0, Math.round(parameters[productId] ?? 0));
  try {
    let expr = f;
    for (const [name, val] of Object.entries(parameters)) {
      expr = expr.replace(new RegExp(`\\b${name}\\b`, "g"), String(val));
    }
    const sanitized = expr.replace(/[^0-9+\-*/().\s]/g, "");
    if (sanitized !== expr) return 0;
    const result = Function('"use strict"; return (' + sanitized + ")")() as number;
    return Math.max(0, Math.round(result * multiplier));
  } catch { return 0; }
}

type MovementRequestRef = { id: string; area: string; event?: { id: string; name: string } };

type MovementWithDetails = Movement & {
  loadingOrder?: { id: string; orderNumber: string };
  /** legacy single-request ref (kept for backwards compat) */
  request?: MovementRequestRef;
  /** junction-table array of all linked requests */
  requests?: MovementRequestRef[];
  dock?: { id: string; name: string };
  events?: Array<{ id: string; name: string; sku: string }>;
  trips?: Array<{ id: string; description: string | null; status: string; departureDateTime: string | null; loadingStartTime: string | null }>;
  movementTypeConfig?: MovementTypeConfig;
};

type LoadingOrderItemWithProduct = LoadingOrderItem & { product: Product };

type ExpectedItem = {
  productId: string;
  product: Product;
  expectedQuantity: number;
  loadedQuantity: number;
  remaining: number;
  kitRefs?: Array<{ kitId: string; kitName: string }>;
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

  // ── Operational state ──────────────────────────────────────────────────────
  const [focusMode, setFocusMode] = useState(false);
  const [operationalMode, setOperationalMode] = useState<"unit" | "batch">(() => {
    try {
      return (sessionStorage.getItem("movement-op-mode") as "unit" | "batch") || "batch";
    } catch {
      return "batch";
    }
  });

  // ── Scanner state ───────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [scannedSku, setScannedSku] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [ownerName, setOwnerName] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSelectOpen, setIsSelectOpen] = useState(false);

  // ── Undo state ──────────────────────────────────────────────────────────────
  const [undoState, setUndoState] = useState<{
    itemId: string;
    productName: string;
    quantity: number;
  } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Exception dialog (only for exceeded qty) ───────────────────────────────
  const [showExceptionDialog, setShowExceptionDialog] = useState(false);

  // ── Load all pending dialog ─────────────────────────────────────────────────
  const [showLoadAllDialog, setShowLoadAllDialog] = useState(false);

  // ── Other dialogs ───────────────────────────────────────────────────────────
  const [showEditStatusDialog, setShowEditStatusDialog] = useState(false);
  const [newStatus, setNewStatus] = useState<string>("");

  // ── List filters ────────────────────────────────────────────────────────────
  const [auditSearchQuery, setAuditSearchQuery] = useState("");
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [orderSearchQuery, setOrderSearchQuery] = useState("");
  const [loadedSearchQuery, setLoadedSearchQuery] = useState("");
  const [expectedFilter, setExpectedFilter] = useState<"all" | "pending" | "complete" | "exceeded">("all");
  const [auditFilter, setAuditFilter] = useState<"all" | "items" | "status" | "evidence">("all");

  // ── Evidence state ──────────────────────────────────────────────────────────
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
  const [uploadCategory, setUploadCategory] = useState("other");
  const [uploadCaption, setUploadCaption] = useState("");
  const [uploadProductId, setUploadProductId] = useState("");
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [evidenceCategoryFilter, setEvidenceCategoryFilter] = useState("all");

  // ── Refs ────────────────────────────────────────────────────────────────────
  const searchInputRef = useRef<HTMLInputElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Track pending add metadata for undo
  const pendingAddRef = useRef<{ productName: string; quantity: number; mode: "unit" | "batch" } | null>(null);

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data: suppliers = [] } = useQuery<Array<{ id: string; name: string }>>({
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

  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });

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
      const res = await fetch(`/api/loading-orders/${movement?.loadingOrderId}/items`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch loading order items");
      return res.json();
    },
    enabled: !!movement?.loadingOrderId,
  });

  // Resolve canonical request ID (for UI label) and all linked IDs (for fetching)
  const canonicalRequestId = (movement as any)?.requests?.[0]?.id ?? movement?.requestId;
  const allRequestIds = useMemo<string[]>(() => {
    const junctionIds: string[] = ((movement as any)?.requests ?? []).map((r: { id: string }) => r.id);
    if (junctionIds.length > 0) return junctionIds;
    const legacy = (movement as any)?.requestId as string | undefined;
    return legacy ? [legacy] : [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(((movement as any)?.requests ?? []).map((r: { id: string }) => r.id)), (movement as any)?.requestId]);

  const requestItemsResults = useQueries({
    queries: allRequestIds.map((id) => ({
      queryKey: ["/api/requests", id, "items"] as [string, string, string],
      queryFn: async () => {
        const res = await fetch(`/api/requests/${id}/items`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to fetch request items");
        return res.json() as Promise<Array<{ id: string; productId: string | null; kitId: string | null; quantity: number; approvedQuantity: number | null; approvalStatus: string; product: Product | null; kit: Kit | null; kitParameters: Record<string, number> | null }>>;
      },
      enabled: !movement?.loadingOrderId,
    })),
  });

  // Flatten items from all linked requests into a single list
  type RequestItemRich = {
    id: string; productId: string | null; kitId: string | null;
    quantity: number; approvedQuantity: number | null; approvalStatus: string;
    product: Product | null; kit: Kit | null; kitParameters: Record<string, number> | null;
  };

  const requestItemsData = useMemo(
    () => requestItemsResults.flatMap((r) => r.data ?? []) as RequestItemRich[],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(requestItemsResults.map((r) => r.data))],
  );

  // Fetch BOM for each unique kit found in request items (for expansion)
  const uniqueKitIdsInRequests = useMemo(
    () => Array.from(new Set(requestItemsData.filter((ri) => ri.kitId).map((ri) => ri.kitId!))),
    [requestItemsData],
  );

  const kitBomQueries = useQueries({
    queries: uniqueKitIdsInRequests.map((kitId) => ({
      queryKey: ["/api/kits", kitId, "bom"] as [string, string, string],
      queryFn: async () => {
        const res = await fetch(`/api/kits/${kitId}/bom`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to fetch kit BOM");
        return res.json() as Promise<BomLine[]>;
      },
      enabled: uniqueKitIdsInRequests.length > 0,
    })),
  });

  // Map kitId → BomLine[]
  const kitBomMap = useMemo(() => {
    const map = new Map<string, BomLine[]>();
    uniqueKitIdsInRequests.forEach((kitId, idx) => {
      const data = kitBomQueries[idx]?.data;
      if (data) map.set(kitId, data);
    });
    return map;
  }, [uniqueKitIdsInRequests, kitBomQueries]);

  const { data: relatedMovements = [] } = useQuery<Movement[]>({
    queryKey: [`/api/loading-orders/${movement?.loadingOrderId}/movements`],
    enabled: !!movement?.loadingOrderId,
  });

  const relatedMovementItemsQueries = useQueries({
    queries: relatedMovements.map((mov) => ({
      queryKey: ["/api/movements", mov.id, "items"],
      queryFn: async () => {
        const res = await fetch(`/api/movements/${mov.id}/items`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to fetch movement items");
        return res.json() as Promise<MovementItem[]>;
      },
      enabled: !!mov.id,
    })),
  });

  const allRelatedMovementItems = useMemo(() => {
    const allItems: MovementItem[] = [];
    relatedMovementItemsQueries.forEach((query) => {
      if (query.data) allItems.push(...query.data);
    });
    return allItems;
  }, [relatedMovementItemsQueries]);

  // ── Computed ────────────────────────────────────────────────────────────────
  const expectedProductIds = useMemo(
    () => new Set(loadingOrderItems.map((item) => item.productId)),
    [loadingOrderItems]
  );

  const consolidatedLoadedItems = useMemo(() => {
    const itemsByProduct = new Map<
      string,
      { productId: string; totalQuantity: number; itemIds: string[]; isNotInOrder: boolean; ownerTypes: Set<string>; owners: Set<string> }
    >();
    movementItems.forEach((item) => {
      const existing = itemsByProduct.get(item.productId);
      if (existing) {
        existing.totalQuantity += item.quantity;
        existing.itemIds.push(item.id);
        if (item.ownerType) existing.ownerTypes.add(item.ownerType);
        if (item.ownerName) existing.owners.add(item.ownerName);
      } else {
        const isNotInOrder = movement?.loadingOrderId ? !expectedProductIds.has(item.productId) : false;
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

  const expectedItems: ExpectedItem[] = useMemo(() => {
    if (loadingOrderItems.length > 0) {
      const itemsToConsider = movement?.loadingOrderId ? allRelatedMovementItems : movementItems;
      return loadingOrderItems.map((orderItem) => {
        const expectedProductSku = orderItem.product.sku;
        const loadedQuantity = itemsToConsider
          .filter((item) => {
            if (item.productId === orderItem.productId) return true;
            const loadedProduct = products.find((p) => p.id === item.productId);
            if (loadedProduct?.productType === "variante" && loadedProduct.equivalentSku === expectedProductSku) return true;
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
    }
    if (requestItemsData.length > 0) {
      // Consolidate products from direct items + kit BOM expansion
      const byProduct = new Map<string, { product: Product; expectedQuantity: number; kitRefs: Array<{ kitId: string; kitName: string }> }>();

      const addProduct = (prod: Product, qty: number, kitRef?: { kitId: string; kitName: string }) => {
        if (qty <= 0) return;
        const existing = byProduct.get(prod.id);
        if (existing) {
          existing.expectedQuantity += qty;
          if (kitRef && !existing.kitRefs.find((k) => k.kitId === kitRef.kitId)) {
            existing.kitRefs.push(kitRef);
          }
        } else {
          byProduct.set(prod.id, { product: prod, expectedQuantity: qty, kitRefs: kitRef ? [kitRef] : [] });
        }
      };

      for (const ri of requestItemsData) {
        const qty = ri.approvedQuantity != null && ri.approvedQuantity > 0 ? ri.approvedQuantity : ri.quantity;

        if (ri.productId && ri.product) {
          // Direct product item — no kit ref
          addProduct(ri.product as Product, qty);
        } else if (ri.kitId) {
          // Kit item — expand via BOM, tagging each component with the kit reference
          const kitRef = { kitId: ri.kitId, kitName: (ri.kit as Kit | null)?.name ?? ri.kitId };
          const bomLines = kitBomMap.get(ri.kitId);
          if (bomLines) {
            const params = (ri.kitParameters as Record<string, number> | null) ?? {};
            for (const line of bomLines) {
              const lineQty = calcKitItemQty(line.quantityFormula, qty, params, line.productId);
              if (lineQty > 0) {
                const prod = products.find((p) => p.id === line.productId);
                if (prod) addProduct(prod, lineQty, kitRef);
              }
            }
          }
          // BOM not yet loaded → skip; expectedItems re-computes when kitBomMap updates
        }
      }

      return Array.from(byProduct.entries()).map(([productId, { product, expectedQuantity, kitRefs }]) => {
        const loadedQuantity = movementItems
          .filter((item) => item.productId === productId)
          .reduce((sum, item) => sum + item.quantity, 0);
        return {
          productId,
          product,
          expectedQuantity,
          loadedQuantity,
          remaining: Math.max(0, expectedQuantity - loadedQuantity),
          kitRefs: kitRefs.length > 0 ? kitRefs : undefined,
        };
      });
    }
    return [];
  }, [loadingOrderItems, requestItemsData, movementItems, movement?.loadingOrderId, allRelatedMovementItems, products, kitBomMap]);

  const totalExpected = expectedItems.reduce((s, i) => s + i.expectedQuantity, 0);
  const totalLoaded = expectedItems.reduce((s, i) => s + i.loadedQuantity, 0);
  const totalExceeded = expectedItems.reduce((s, i) => s + Math.max(0, i.loadedQuantity - i.expectedQuantity), 0);
  const totalPending = expectedItems.reduce((s, i) => s + Math.max(0, i.expectedQuantity - i.loadedQuantity), 0);
  const progress = totalExpected > 0 ? Math.round((totalLoaded / totalExpected) * 100) : 0;
  const completedProductCount = expectedItems.filter(
    (i) => i.remaining === 0 && i.loadedQuantity <= i.expectedQuantity
  ).length;
  const pendingItems = expectedItems.filter(
    (i) => i.remaining > 0 && i.loadedQuantity <= i.expectedQuantity
  );
  const pendingUnitsCount = pendingItems.reduce((s, i) => s + i.remaining, 0);

  const filteredExpectedItems = useMemo(() => {
    let items = expectedItems;
    if (orderSearchQuery.trim()) {
      const q = orderSearchQuery.toLowerCase();
      items = items.filter(
        (i) =>
          i.product.name.toLowerCase().includes(q) ||
          i.product.sku?.toLowerCase().includes(q) ||
          i.product.barcode?.toLowerCase().includes(q)
      );
    }
    if (expectedFilter !== "all") {
      items = items.filter((i) => {
        const isExceeded = i.loadedQuantity > i.expectedQuantity;
        const isComplete = i.remaining === 0 && !isExceeded;
        const isPending = i.remaining > 0;
        if (expectedFilter === "pending") return isPending;
        if (expectedFilter === "complete") return isComplete;
        if (expectedFilter === "exceeded") return isExceeded;
        return true;
      });
    }
    return items;
  }, [expectedItems, orderSearchQuery, expectedFilter]);

  const filteredLoadedItems = useMemo(() => {
    if (!loadedSearchQuery.trim()) return consolidatedLoadedItems;
    const q = loadedSearchQuery.toLowerCase();
    return consolidatedLoadedItems.filter((item) => {
      const p = products.find((x) => x.id === item.productId);
      return p?.name.toLowerCase().includes(q) || p?.sku?.toLowerCase().includes(q) || p?.barcode?.toLowerCase().includes(q);
    });
  }, [consolidatedLoadedItems, loadedSearchQuery, products]);

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return products
      .filter((p) => p.sku?.toLowerCase().includes(q) || p.barcode?.toLowerCase().includes(q) || p.name.toLowerCase().includes(q))
      .slice(0, 50);
  }, [searchQuery, products]);

  const filteredAttachments = useMemo(() => {
    if (evidenceCategoryFilter === "all") return attachments;
    if (evidenceCategoryFilter === "images") return attachments.filter((a) => a.fileType === "image");
    if (evidenceCategoryFilter === "videos") return attachments.filter((a) => a.fileType === "video");
    return attachments.filter((a) => a.category === evidenceCategoryFilter);
  }, [attachments, evidenceCategoryFilter]);

  const filteredAuditLogs = useMemo(() => {
    let logs = auditLogs;
    if (auditFilter === "items") logs = logs.filter((l) => ["item_added", "item_removed", "item_quantity_changed"].includes(l.action));
    else if (auditFilter === "status") logs = logs.filter((l) => l.action === "status_changed");
    else if (auditFilter === "evidence") logs = logs.filter((l) => l.action === "evidence_added");
    if (auditSearchQuery.trim()) {
      const q = auditSearchQuery.toLowerCase();
      logs = logs.filter((l) => {
        const m = l.metadata as any;
        return (
          m?.productName?.toLowerCase().includes(q) ||
          m?.sku?.toLowerCase().includes(q) ||
          l.actorName?.toLowerCase().includes(q)
        );
      });
    }
    return logs;
  }, [auditLogs, auditFilter, auditSearchQuery]);

  const MONTHS_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const formatDatePT = (d: Date) => `${d.getDate()} de ${MONTHS_PT[d.getMonth()]} de ${d.getFullYear()}`;

  const groupedAuditLogs = useMemo(() => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
    const yesterdayKey = `${yesterday.getFullYear()}-${yesterday.getMonth()}-${yesterday.getDate()}`;

    const groups: Array<{ dateKey: string; label: string; logs: typeof filteredAuditLogs }> = [];
    const seen = new Map<string, number>();

    filteredAuditLogs.forEach((log) => {
      const d = new Date(log.occurredAt);
      const dateKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!seen.has(dateKey)) {
        let label: string;
        if (dateKey === todayKey) label = "HOJE — " + formatDatePT(d).toUpperCase();
        else if (dateKey === yesterdayKey) label = "ONTEM — " + formatDatePT(d).toUpperCase();
        else label = formatDatePT(d).toUpperCase();
        seen.set(dateKey, groups.length);
        groups.push({ dateKey, label, logs: [log] });
      } else {
        groups[seen.get(dateKey)!].logs.push(log);
      }
    });
    return groups;
  }, [filteredAuditLogs]);

  const getLogTitle = (log: MovementAuditLog) => {
    const m = log.metadata as any;
    const qty: number = m?.quantity ?? 0;
    const unitLabel = qty === 1 ? "unidade" : "unidades";
    const name: string = m?.productName ?? "";
    switch (log.action) {
      case "item_added": return `Registrou ${qty} ${unitLabel} de ${name}`;
      case "item_removed": return `Removeu ${qty} ${unitLabel} de ${name}`;
      case "item_quantity_changed": return `Ajustou quantidade de ${name}`;
      case "status_changed": return "Status alterado";
      case "evidence_added": return m?.fileType === "image" ? "Foto anexada" : "Vídeo anexado";
      default: return log.action;
    }
  };

  const getLogDetails = (log: MovementAuditLog): string[] => {
    const m = log.metadata as any;
    const ctx = log.context as any;
    const details: string[] = [];
    switch (log.action) {
      case "item_added": {
        const prev: number = m?.previousQuantity ?? 0;
        const next = prev + (m?.quantity ?? 0);
        details.push(`Quantidade carregada: ${prev} → ${next}`);
        if (m?.sku) details.push(`SKU: ${m.sku}`);
        break;
      }
      case "item_removed": {
        if (m?.previousQuantity != null) {
          const next = Math.max(0, m.previousQuantity - (m?.quantity ?? 0));
          details.push(`Quantidade carregada: ${m.previousQuantity} → ${next}`);
        }
        if (m?.sku) details.push(`SKU: ${m.sku}`);
        break;
      }
      case "item_quantity_changed": {
        if (m?.previousQuantity != null && m?.newQuantity != null) {
          details.push(`Quantidade: ${m.previousQuantity} → ${m.newQuantity}`);
        }
        if (m?.quantityDecremented != null) details.push(`Ajuste: −${m.quantityDecremented}`);
        if (m?.sku) details.push(`SKU: ${m.sku}`);
        break;
      }
      case "status_changed": {
        const prev = getStatusLabel(ctx?.previousStatus);
        const next = getStatusLabel(ctx?.newStatus);
        details.push(`${prev} → ${next}`);
        break;
      }
      case "evidence_added": {
        if (m?.fileName) details.push(`Arquivo: ${m.fileName}`);
        if (m?.isPostCompletion) details.push("Adicionada após a conclusão da movimentação");
        break;
      }
    }
    return details;
  };

  const getLogSource = (log: MovementAuditLog): string | undefined => {
    const m = log.metadata as any;
    return m?.source as string | undefined;
  };

  const getLogIconConfig = (action: string) => {
    switch (action) {
      case "item_added": return { bg: "bg-emerald-500/15 border-emerald-500/40 text-emerald-400", line: "bg-emerald-500/20" };
      case "item_removed": return { bg: "bg-rose-500/15 border-rose-500/40 text-rose-400", line: "bg-rose-500/20" };
      case "item_quantity_changed": return { bg: "bg-amber-500/15 border-amber-500/40 text-amber-400", line: "bg-amber-500/20" };
      case "status_changed": return { bg: "bg-sky-500/15 border-sky-500/40 text-sky-400", line: "bg-sky-500/20" };
      case "evidence_added": return { bg: "bg-violet-500/15 border-violet-500/40 text-violet-400", line: "bg-violet-500/20" };
      default: return { bg: "bg-muted/40 border-border text-muted-foreground", line: "bg-border/40" };
    }
  };

  const getLogIconEl = (action: string) => {
    switch (action) {
      case "item_added": return <Plus className="h-2.5 w-2.5" />;
      case "item_removed": return <Minus className="h-2.5 w-2.5" />;
      case "item_quantity_changed": return <Edit className="h-2.5 w-2.5" />;
      case "status_changed": return <Activity className="h-2.5 w-2.5" />;
      case "evidence_added": return <Camera className="h-2.5 w-2.5" />;
      default: return <Clock className="h-2.5 w-2.5" />;
    }
  };

  const toggleLogExpanded = (logId: string) => {
    setExpandedLogs((prev) => {
      const next = new Set(prev);
      if (next.has(logId)) next.delete(logId);
      else next.add(logId);
      return next;
    });
  };

  const evidenceByProduct = useMemo(() => {
    const map = new Map<string, number>();
    attachments.forEach((a) => {
      if (a.productId) map.set(a.productId, (map.get(a.productId) || 0) + 1);
    });
    return map;
  }, [attachments]);

  const isEditable = movement?.status === "in_progress";
  const photoCount = attachments.filter((a) => a.fileType === "image").length;
  const videoCount = attachments.filter((a) => a.fileType === "video").length;

  // ── Scanner helpers ─────────────────────────────────────────────────────────
  const selectedExpectedItem = useMemo(() => {
    if (!selectedProduct) return null;
    return expectedItems.find((i) => i.productId === selectedProduct.id) ?? null;
  }, [selectedProduct, expectedItems]);

  const willExceedExpected = useMemo(() => {
    if (!selectedExpectedItem) return false;
    return selectedExpectedItem.loadedQuantity + quantity > selectedExpectedItem.expectedQuantity;
  }, [selectedExpectedItem, quantity]);

  const excessUnits = useMemo(() => {
    if (!willExceedExpected || !selectedExpectedItem) return 0;
    return selectedExpectedItem.loadedQuantity + quantity - selectedExpectedItem.expectedQuantity;
  }, [willExceedExpected, selectedExpectedItem, quantity]);

  const getRegisterLabel = () => {
    if (addItemMutation.isPending) return "Registrando...";
    const exp = selectedExpectedItem;
    if (exp) {
      if (exp.remaining > 0 && quantity === exp.remaining) return `Carregar restante: ${exp.remaining}`;
      if (exp.remaining === 0 && quantity > 0) return `Adicionar excedente: ${quantity}`;
      if (willExceedExpected) return "Adicionar como excedente";
    }
    return quantity === 1 ? "Registrar 1 unidade" : `Registrar ${quantity} unidades`;
  };

  // ── Mutations ───────────────────────────────────────────────────────────────
  const addItemMutation = useMutation({
    mutationFn: async (data: {
      productId: string;
      quantity: number;
      scannedSku?: string;
      ownerName?: string;
      ownerType?: string;
    }) => {
      const res = await apiRequest("POST", `/api/movements/${id}/items`, { movementId: id, ...data });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to add item");
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/movements", id, "items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/movements", id, "audit-logs"] });

      const pending = pendingAddRef.current;
      const mode = pending?.mode || operationalMode;

      // Set undo state
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      if (data?.id && pending) {
        setUndoState({ itemId: data.id, productName: pending.productName, quantity: pending.quantity });
        undoTimerRef.current = setTimeout(() => setUndoState(null), 6000);
      }

      // Clear based on mode
      if (mode === "unit") {
        setSelectedProduct(null);
        setSearchQuery("");
        setScannedSku("");
      }
      setQuantity(1);
      setOwnerName("");
      setShowSuggestions(false);
      setShowExceptionDialog(false);
      pendingAddRef.current = null;

      // Return focus to scanner
      setTimeout(() => {
        searchInputRef.current?.focus();
        if (mode === "unit") searchInputRef.current?.select();
      }, 100);
    },
    onError: (error: Error) => {
      pendingAddRef.current = null;
      toast({ title: "Erro ao registrar", description: error.message, variant: "destructive" });
    },
  });

  const undoItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const res = await apiRequest("DELETE", `/api/movements/${id}/items/${itemId}`);
      if (!res.ok) throw new Error("Falha ao desfazer");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/movements", id, "items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/movements", id, "audit-logs"] });
      setUndoState(null);
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      toast({ title: "Ação desfeita", description: "O lançamento foi removido." });
    },
    onError: (err: Error) => {
      toast({ title: "Não foi possível desfazer", description: err.message, variant: "destructive" });
    },
  });

  const loadAllPendingMutation = useMutation({
    mutationFn: async (items: ExpectedItem[]) => {
      for (const item of items) {
        const res = await apiRequest("POST", `/api/movements/${id}/items`, {
          movementId: id,
          productId: item.productId,
          quantity: item.remaining,
          scannedSku: item.product.sku || undefined,
          ownerType: "owned",
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || `Falha ao adicionar ${item.product.name}`);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/movements", id, "items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/movements", id, "audit-logs"] });
      setShowLoadAllDialog(false);
      toast({ title: "Pendências registradas", description: `Todas as quantidades pendentes foram carregadas.` });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao carregar todos", description: err.message, variant: "destructive" });
    },
  });

  const decrementItemMutation = useMutation({
    mutationFn: async (productId: string) => {
      const productItems = movementItems
        .filter((item) => item.productId === productId)
        .sort((a, b) => new Date(b.processedAt).getTime() - new Date(a.processedAt).getTime());
      if (productItems.length === 0) throw new Error("No items found for this product");
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
      toast({ title: "Unidade removida" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao remover unidade", description: error.message, variant: "destructive" });
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: async (productId: string) => {
      const productItems = movementItems.filter((item) => item.productId === productId);
      if (productItems.length === 0) throw new Error("No items found for this product");
      await Promise.all(productItems.map((item) => apiRequest("DELETE", `/api/movements/${id}/items/${item.id}`)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/movements", id, "items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/movements", id, "audit-logs"] });
      toast({ title: "Item removido" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao remover item", description: error.message, variant: "destructive" });
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
      toast({ title: "Status atualizado" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar status", description: error.message, variant: "destructive" });
    },
  });

  const uploadAttachmentMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch(`/api/movements/${id}/attachments`, { method: "POST", body: formData, credentials: "include" });
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
      toast({ title: "Evidência enviada" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" });
    },
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: async (attachmentId: string) => {
      const res = await fetch(`/api/movements/${id}/attachments/${attachmentId}`, { method: "DELETE", credentials: "include" });
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

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleStartMovement = () => updateStatusMutation.mutate("in_progress");
  const handlePauseMovement = () => updateStatusMutation.mutate("paused");
  const handleContinueMovement = () => updateStatusMutation.mutate("in_progress");
  const handleFinishMovement = () => updateStatusMutation.mutate("completed");

  const toggleFocusMode = () => {
    const next = !focusMode;
    setFocusMode(next);
    if (next && sidebar.open) sidebar.setOpen(false);
    else if (!next && !sidebar.open) sidebar.setOpen(true);
  };

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setSearchQuery(product.name);
    setShowSuggestions(false);
    setTimeout(() => {
      quantityInputRef.current?.focus();
      quantityInputRef.current?.select();
    }, 100);
  };

  const handleSelectFromExpectedItem = (item: ExpectedItem) => {
    setSearchQuery(item.product.sku || item.product.name);
    setSelectedProduct(item.product);
    setShowSuggestions(false);
    setTimeout(() => {
      quantityInputRef.current?.focus();
      quantityInputRef.current?.select();
    }, 100);
  };

  const handleUndo = () => {
    if (!undoState || undoItemMutation.isPending) return;
    undoItemMutation.mutate(undoState.itemId);
  };

  const executeAdd = (productId: string, qty: number, options: { scannedSku?: string; ownerName?: string; ownerType?: string; productName: string }) => {
    if (!isEditable) {
      toast({ title: "Movimentação não está em andamento", variant: "destructive" });
      return;
    }
    pendingAddRef.current = { productName: options.productName, quantity: qty, mode: operationalMode };
    addItemMutation.mutate({
      productId,
      quantity: qty,
      scannedSku: options.scannedSku,
      ownerName: options.ownerName,
      ownerType: options.ownerType || "owned",
    });
  };

  const handleAddItem = () => {
    if (!isEditable || !selectedProduct || addItemMutation.isPending) return;
    if (selectedProduct.requiresSupplier && !ownerName.trim()) {
      toast({ title: "Proprietário obrigatório", description: "Informe o fornecedor antes de registrar.", variant: "destructive" });
      return;
    }
    if (willExceedExpected) {
      setShowExceptionDialog(true);
      return;
    }
    executeAdd(selectedProduct.id, quantity, {
      scannedSku: scannedSku || selectedProduct.sku || undefined,
      ownerName: selectedProduct.requiresSupplier ? ownerName : undefined,
      ownerType: selectedProduct.requiresSupplier ? selectedProduct.ownership || "owned" : "owned",
      productName: selectedProduct.name,
    });
  };

  const handleConfirmException = () => {
    if (!selectedProduct) return;
    executeAdd(selectedProduct.id, quantity, {
      scannedSku: scannedSku || selectedProduct.sku || undefined,
      ownerName: selectedProduct.requiresSupplier ? ownerName : undefined,
      ownerType: selectedProduct.requiresSupplier ? selectedProduct.ownership || "owned" : "owned",
      productName: selectedProduct.name,
    });
  };

  const handleLoadRemaining = (item: ExpectedItem) => {
    if (!isEditable || item.remaining <= 0) return;
    const product = products.find((p) => p.id === item.productId);
    if (!product) return;
    if (product.requiresSupplier) {
      handleSelectFromExpectedItem(item);
      setQuantity(item.remaining);
      return;
    }
    pendingAddRef.current = { productName: product.name, quantity: item.remaining, mode: operationalMode };
    addItemMutation.mutate({
      productId: item.productId,
      quantity: item.remaining,
      scannedSku: product.sku || undefined,
      ownerType: "owned",
    });
  };

  const handleSetOperationalMode = (mode: "unit" | "batch") => {
    setOperationalMode(mode);
    try { sessionStorage.setItem("movement-op-mode", mode); } catch {}
  };

  // ── Evidence helpers ────────────────────────────────────────────────────────
  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFile(file);
    setUploadPreviewUrl(URL.createObjectURL(file));
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

  // ── Effects ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (selectedProduct) {
      setTimeout(() => {
        quantityInputRef.current?.focus();
        quantityInputRef.current?.select();
      }, 100);
    }
  }, [selectedProduct]);

  useEffect(() => {
    if (showEditStatusDialog && movement) setNewStatus(movement.status);
  }, [showEditStatusDialog, movement]);

  useEffect(() => {
    const handleClickOutside = () => setShowSuggestions(false);
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // Esc on scanner clears selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedProduct && !showExceptionDialog && !showEditStatusDialog && !showUploadDialog) {
        setSelectedProduct(null);
        setQuantity(1);
        setSearchQuery("");
        setOwnerName("");
        setTimeout(() => { searchInputRef.current?.focus(); }, 50);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedProduct, showExceptionDialog, showEditStatusDialog, showUploadDialog]);

  useEffect(() => {
    return () => { if (undoTimerRef.current) clearTimeout(undoTimerRef.current); };
  }, []);

  // ── Loading / not found ─────────────────────────────────────────────────────
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

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 relative">
      {/* Focus toggle */}
      <div className="fixed top-20 right-6 z-50">
        <Button variant="outline" size="icon" onClick={toggleFocusMode} data-testid="button-toggle-focus" title={focusMode ? "Sair do modo foco" : "Entrar em modo foco"}>
          {focusMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
      </div>

      {/* Header */}
      {!focusMode && (
        <PageHeader title={movement.name} description={movement.movementNumber}>
          {userCanChangeMovementStatusFreely(user) && (
            <Button variant="outline" onClick={() => setShowEditStatusDialog(true)} data-testid="button-edit-status">
              <Edit className="h-4 w-4 mr-2" />
              Editar Status
            </Button>
          )}
          {movement.status === "created" && userCanManageMovementItems(user) && (
            <Button onClick={handleStartMovement} disabled={updateStatusMutation.isPending} data-testid="button-start">
              <PlayCircle className="h-4 w-4 mr-2" />
              Iniciar
            </Button>
          )}
          {movement.status === "in_progress" && userCanManageMovementItems(user) && (
            <>
              <Button variant="outline" onClick={handlePauseMovement} disabled={updateStatusMutation.isPending} data-testid="button-pause">
                <PauseCircle className="h-4 w-4 mr-2" />
                Pausar
              </Button>
              <Button onClick={handleFinishMovement} disabled={updateStatusMutation.isPending} data-testid="button-finish">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Finalizar
              </Button>
            </>
          )}
          {movement.status === "paused" && userCanManageMovementItems(user) && (
            <Button onClick={handleContinueMovement} disabled={updateStatusMutation.isPending} data-testid="button-continue">
              <PlayCircle className="h-4 w-4 mr-2" />
              Continuar
            </Button>
          )}
          <Button variant="outline" size="icon" onClick={() => navigate("/movements")} data-testid="button-back" title="Voltar">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </PageHeader>
      )}

      {/* Resumo operacional — stats cards */}
      {!focusMode && (
        <PageSection>
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-2">
            <Card className="border-border/60 min-w-0">
              <CardContent className="p-2.5 flex flex-col min-h-[80px]">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">
                  <BarChart3 className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">Status</span>
                </div>
                <div className="mt-auto pt-1.5"><StatusBadge status={movement.status} /></div>
              </CardContent>
            </Card>
            <Card className="border-border/60 min-w-0">
              <CardContent className="p-2.5 flex flex-col min-h-[80px]">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">
                  <ClipboardList className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">Esperados</span>
                </div>
                <div className="mt-auto pt-1">
                  <div className="text-xl font-bold tabular-nums leading-none">{totalExpected}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">unidades</div>
                </div>
              </CardContent>
            </Card>
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
            <Card className={`border-border/60 min-w-0 ${totalPending > 0 ? "border-amber-500/40 bg-amber-500/5" : ""}`}>
              <CardContent className="p-2.5 flex flex-col min-h-[80px]">
                <div className={`flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide ${totalPending > 0 ? "text-amber-500" : "text-muted-foreground"}`}>
                  <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">Pendentes</span>
                </div>
                <div className="mt-auto pt-1">
                  <div className={`text-xl font-bold tabular-nums leading-none ${totalPending > 0 ? "text-amber-500" : ""}`}>{totalPending}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">unidades</div>
                </div>
              </CardContent>
            </Card>
            <Card className={`border-border/60 min-w-0 ${totalExceeded > 0 ? "border-rose-500/40 bg-rose-500/5" : ""}`}>
              <CardContent className="p-2.5 flex flex-col min-h-[80px]">
                <div className={`flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide ${totalExceeded > 0 ? "text-rose-500" : "text-muted-foreground"}`}>
                  <Plus className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">Excedentes</span>
                </div>
                <div className="mt-auto pt-1">
                  <div className={`text-xl font-bold tabular-nums leading-none ${totalExceeded > 0 ? "text-rose-500" : ""}`}>{totalExceeded}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">unidades</div>
                </div>
              </CardContent>
            </Card>
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
          {/* Contexto da movimentação */}
          <div className="mt-3 space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-0.5">Contexto da movimentação</p>

            {/* Row A — primary links: Evento / Requisição / Plano de viagens / Ordem */}
            {(() => {
              const allLinkedRequests: MovementRequestRef[] =
                (movement.requests && movement.requests.length > 0)
                  ? movement.requests
                  : movement.request
                    ? [movement.request]
                    : [];
              return (movement.events?.length || allLinkedRequests.length || movement.trips?.length || movement.loadingOrder) ? (
                <div className="rounded-lg overflow-hidden border border-border/60">
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-px bg-border/40">
                    {movement.events && movement.events.length > 0 && (
                      <div className="bg-card p-3 flex flex-col gap-0.5 min-w-0">
                        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                          <Tag className="h-3 w-3 shrink-0" />Evento
                        </div>
                        <p className="text-sm font-semibold leading-snug line-clamp-2 mt-0.5" title={movement.events.map((e) => e.name).join(", ")}>
                          {movement.events.map((e) => e.name).join(", ")}
                        </p>
                      </div>
                    )}
                    {allLinkedRequests.length > 0 && (
                      <div className="bg-card p-3 flex flex-col gap-0.5 min-w-0">
                        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                          <ClipboardList className="h-3 w-3 shrink-0" />
                          {allLinkedRequests.length === 1 ? "Requisição" : `Requisições (${allLinkedRequests.length})`}
                        </div>
                        <div className="mt-0.5 space-y-1.5">
                          {allLinkedRequests.map((req) => {
                            const label = `${req.event?.name ? req.event.name + " — " : ""}${req.area}`;
                            return (
                              <a
                                key={req.id}
                                href={`/requests/${req.id}`}
                                className="block text-sm font-semibold leading-snug text-primary hover:underline"
                                title={label}
                                onClick={(e) => { e.stopPropagation(); navigate(`/requests/${req.id}`); e.preventDefault(); }}
                              >
                                {label}
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {movement.trips && movement.trips.length > 0 && (
                    <div className="bg-card p-3 flex flex-col gap-0.5 min-w-0">
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                        <Truck className="h-3 w-3 shrink-0" />Plano de viagens
                      </div>
                      <p className="text-sm font-semibold leading-snug line-clamp-2 mt-0.5" title={movement.trips.map((t) => t.description || `Viagem ${t.id.slice(0, 8)}`).join(", ")}>
                        {movement.trips.map((t) => t.description || `Viagem ${t.id.slice(0, 8)}`).join(", ")}
                      </p>
                    </div>
                  )}
                  {movement.loadingOrder && (
                    <div className="bg-card p-3 flex flex-col gap-0.5 min-w-0">
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                        <Layers className="h-3 w-3 shrink-0" />Ordem de carregamento
                      </div>
                      <p className="text-sm font-semibold leading-snug line-clamp-2 mt-0.5">
                        {movement.loadingOrder.orderNumber}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : null;
            })()}

            {/* Row B — operational details: Tipo / Sentido / Veículo / Doca / Criado em */}
            <div className="rounded-lg overflow-hidden border border-border/60">
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-px bg-border/40">
                <div className="bg-card p-3 flex flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    <Tag className="h-3 w-3 shrink-0" />Tipo
                  </div>
                  <p className="text-sm font-medium leading-snug mt-0.5">{movement.movementTypeConfig?.name || "Não informado"}</p>
                </div>
                <div className="bg-card p-3 flex flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    <Activity className="h-3 w-3 shrink-0" />Sentido
                  </div>
                  <div className="mt-1">
                    {movement.movementTypeConfig?.nature === "inbound" && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">Entrada</Badge>
                    )}
                    {movement.movementTypeConfig?.nature === "outbound" && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">Saída</Badge>
                    )}
                    {!movement.movementTypeConfig?.nature && (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
                <div className="bg-card p-3 flex flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    <Truck className="h-3 w-3 shrink-0" />Veículo
                  </div>
                  <p className={`text-sm font-medium leading-snug mt-0.5 ${!movement.vehiclePlate ? "text-muted-foreground" : ""}`}>
                    {movement.vehiclePlate || "Não informado"}
                  </p>
                </div>
                <div className="bg-card p-3 flex flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    <MapPin className="h-3 w-3 shrink-0" />Doca
                  </div>
                  <p className={`text-sm font-medium leading-snug mt-0.5 ${!movement.dock?.name ? "text-muted-foreground" : ""}`}>
                    {movement.dock?.name || "Não informada"}
                  </p>
                </div>
                <div className="bg-card p-3 flex flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    <Calendar className="h-3 w-3 shrink-0" />Criado em
                  </div>
                  <p className="text-sm font-medium leading-snug mt-0.5">
                    {movement.createdAt ? format(new Date(movement.createdAt), "dd/MM/yyyy 'às' HH:mm") : "—"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </PageSection>
      )}

      {/* Barra de evidências */}
      {!focusMode && (
        <PageSection>
          <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg border border-border/60 bg-muted/20">
            <div className="flex items-center gap-2.5 min-w-0">
              <Camera className="h-4 w-4 text-muted-foreground shrink-0" />
              {photoCount + videoCount === 0 ? (
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-snug">Nenhuma evidência anexada</p>
                  <p className="text-xs text-muted-foreground leading-snug">Recomendamos registrar fotos ou vídeos durante o carregamento.</p>
                </div>
              ) : (
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-snug">{photoCount + videoCount} {photoCount + videoCount === 1 ? "evidência registrada" : "evidências registradas"}</p>
                  <p className="text-xs text-muted-foreground leading-snug">
                    {[photoCount > 0 && `${photoCount} ${photoCount === 1 ? "foto" : "fotos"}`, videoCount > 0 && `${videoCount} ${videoCount === 1 ? "vídeo" : "vídeos"}`].filter(Boolean).join(" · ")}
                  </p>
                </div>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-xs shrink-0"
              onClick={() => { const el = document.getElementById("section-evidencias"); if (el) el.scrollIntoView({ behavior: "smooth" }); }}
              data-testid="button-evidence-action"
            >
              {photoCount + videoCount === 0 ? "Adicionar evidência" : "Ver evidências"}
            </Button>
          </div>
        </PageSection>
      )}

      {/* Alertas operacionais */}
      {!focusMode && (() => {
        const alerts: Array<{ type: "warning" | "error" | "info" | "muted"; icon: React.ElementType; message: string }> = [];
        if (movement.status === "paused") alerts.push({ type: "warning", icon: PauseCircle, message: "Movimentação pausada — escaneamento interrompido. Clique em \"Continuar\" para retomar." });
        if (movement.status === "completed") alerts.push({ type: "info", icon: CheckCheck, message: "Movimentação finalizada — modo somente consulta. Você ainda pode adicionar evidências." });
        if (totalPending > 0 && movement.status === "in_progress") alerts.push({ type: "warning", icon: AlertTriangle, message: `${totalPending} unidade${totalPending !== 1 ? "s" : ""} pendente${totalPending !== 1 ? "s" : ""} em ${pendingItems.length} produto${pendingItems.length !== 1 ? "s" : ""} — carregamento ainda não concluído` });
        if (totalExceeded > 0) alerts.push({ type: "error", icon: AlertTriangle, message: `${totalExceeded} unidade${totalExceeded !== 1 ? "s" : ""} excedente${totalExceeded !== 1 ? "s" : ""} acima da quantidade prevista` });
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

      {/* Scanner não disponível */}
      {!isEditable && movement?.status && (
        <PageSection>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {movement.status === "pending_approval" && "Movimentação pendente de aprovação. Aguarde para registrar produtos."}
              {movement.status === "paused" && "Movimentação pausada. Clique em 'Continuar' para retomar o escaneamento."}
              {movement.status === "completed" && "Movimentação finalizada. Não é possível adicionar ou modificar produtos."}
              {movement.status === "cancelled" && "Movimentação cancelada."}
              {movement.status === "created" && "Clique em 'Iniciar' para começar a registrar produtos."}
            </AlertDescription>
          </Alert>
        </PageSection>
      )}

      {/* Scanner de Produtos */}
      {isEditable && userCanManageMovementItems(user) && (
        <PageSection title="Scanner de Produtos" description="Registre produtos via SKU, código de barras ou nome">
          <Card className="border-border/60">
            <CardContent className="p-3 space-y-3">
              {/* Mode toggle + search row */}
              <div className="flex gap-2 items-center flex-wrap">
                {/* Mode toggle */}
                <div className="flex items-center gap-0.5 p-0.5 bg-muted rounded-md shrink-0">
                  <Button
                    size="sm"
                    variant={operationalMode === "unit" ? "default" : "ghost"}
                    className="h-7 text-xs px-2.5"
                    onClick={() => handleSetOperationalMode("unit")}
                    data-testid="button-mode-unit"
                  >
                    Leitura unitária
                  </Button>
                  <Button
                    size="sm"
                    variant={operationalMode === "batch" ? "default" : "ghost"}
                    className="h-7 text-xs px-2.5"
                    onClick={() => handleSetOperationalMode("batch")}
                    data-testid="button-mode-batch"
                  >
                    Lançamento em lote
                  </Button>
                </div>

                {/* Search input */}
                <div className="flex-1 min-w-48 relative">
                  <Scan className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    ref={searchInputRef}
                    placeholder="Digite ou escaneie SKU, código de barras ou nome"
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
                            <p className="text-xs text-muted-foreground">{product.sku}{product.barcode && ` · ${product.barcode}`}</p>
                          </button>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </div>
                <Button
                  size="icon"
                  variant="outline"
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
                    onClick={() => { setSelectedProduct(null); setQuantity(1); setSearchQuery(""); setOwnerName(""); }}
                    data-testid="button-clear"
                    title="Limpar seleção (Esc)"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Undo banner */}
              {undoState && (
                <div className="flex items-center justify-between gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-sm" data-testid="banner-undo">
                  <span className="text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5 inline mr-1.5" />
                    {undoState.quantity} {undoState.quantity === 1 ? "unidade" : "unidades"} de{" "}
                    <span className="font-semibold">{undoState.productName}</span>{" "}
                    {undoState.quantity === 1 ? "registrada" : "registradas"}.
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs shrink-0"
                    onClick={handleUndo}
                    disabled={undoItemMutation.isPending}
                    data-testid="button-undo"
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Desfazer
                  </Button>
                </div>
              )}

              {/* Product card */}
              {selectedProduct && (
                <div className={`border rounded-lg ${willExceedExpected ? "bg-destructive/10 border-destructive/50" : "bg-muted/30 border-border/60"}`}>
                  <div className="p-3 space-y-3">
                    {/* Product header */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold leading-snug" data-testid="text-selected-product">{selectedProduct.name}</h3>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">
                          SKU: {selectedProduct.sku}{selectedProduct.barcode && ` · ${selectedProduct.barcode}`}
                        </p>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        {willExceedExpected && (
                          <Badge className="bg-destructive text-destructive-foreground no-default-hover-elevate">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Excedente
                          </Badge>
                        )}
                        {selectedExpectedItem && selectedExpectedItem.remaining === 0 && !willExceedExpected && (
                          <Badge className="bg-emerald-500 text-white no-default-hover-elevate">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Completo
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* 3-column stats */}
                    {selectedExpectedItem && (
                      <div className="grid grid-cols-3 gap-2">
                        <div className="text-center py-2.5 bg-muted/50 rounded-md">
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Solicitado</div>
                          <div className="text-2xl font-bold tabular-nums">{selectedExpectedItem.expectedQuantity}</div>
                        </div>
                        <div className="text-center py-2.5 bg-emerald-500/10 rounded-md">
                          <div className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase tracking-wide mb-1">Carregado</div>
                          <div className="text-2xl font-bold tabular-nums text-emerald-500">{selectedExpectedItem.loadedQuantity}</div>
                        </div>
                        <div className={`text-center py-2.5 rounded-md ${willExceedExpected ? "bg-destructive/10" : selectedExpectedItem.remaining > 0 ? "bg-amber-500/10" : "bg-emerald-500/10"}`}>
                          <div className={`text-[10px] uppercase tracking-wide mb-1 ${willExceedExpected ? "text-destructive" : selectedExpectedItem.remaining > 0 ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                            {willExceedExpected ? "Excedente" : "Restante"}
                          </div>
                          <div className={`text-2xl font-bold tabular-nums ${willExceedExpected ? "text-destructive" : selectedExpectedItem.remaining > 0 ? "text-amber-500" : "text-emerald-500"}`}>
                            {willExceedExpected ? excessUnits : selectedExpectedItem.remaining}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Supplier (inline when required) */}
                    {selectedProduct.requiresSupplier && (
                      <div>
                        <Label className="text-xs mb-1.5 block text-amber-700 dark:text-amber-400 font-medium">
                          <AlertTriangle className="h-3 w-3 inline mr-1" />
                          Proprietário / Fornecedor *
                        </Label>
                        <Select value={ownerName} onValueChange={setOwnerName} onOpenChange={setIsSelectOpen}>
                          <SelectTrigger data-testid="select-owner-name" className="h-9">
                            <SelectValue placeholder="Selecione o fornecedor..." />
                          </SelectTrigger>
                          <SelectContent position="popper" sideOffset={4}>
                            {suppliers.filter((s) => s.name).map((supplier) => (
                              <SelectItem key={supplier.id} value={supplier.name}>{supplier.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Quantity + register row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* -/quantity/+ */}
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" onClick={() => setQuantity(Math.max(1, quantity - 1))} data-testid="button-decrease-quantity">
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Input
                          ref={quantityInputRef}
                          type="number"
                          min="1"
                          value={quantity}
                          onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); handleAddItem(); }
                          }}
                          className={`w-16 text-center font-bold text-base ${willExceedExpected ? "border-destructive" : ""}`}
                          data-testid="input-quantity"
                        />
                        <Button variant="outline" size="icon" onClick={() => setQuantity(quantity + 1)} data-testid="button-increase-quantity">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Quick: "Restante" shortcut in batch mode */}
                      {operationalMode === "batch" && selectedExpectedItem && selectedExpectedItem.remaining > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 text-xs"
                          onClick={() => setQuantity(selectedExpectedItem.remaining)}
                          data-testid="button-set-remaining"
                        >
                          Restante: {selectedExpectedItem.remaining}
                        </Button>
                      )}

                      <div className="flex-1" />

                      {/* Main register button */}
                      <Button
                        onClick={handleAddItem}
                        disabled={addItemMutation.isPending || (selectedProduct.requiresSupplier && !ownerName.trim())}
                        data-testid="button-add-item"
                        variant={willExceedExpected ? "destructive" : "default"}
                        className="gap-1.5"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {getRegisterLabel()}
                        <Badge variant="outline" className="bg-background/20 text-[10px] px-1 py-0 hidden sm:flex">ENTER</Badge>
                      </Button>
                    </div>

                    {/* Excess warning */}
                    {willExceedExpected && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        Esta quantidade gera {excessUnits} unidade{excessUnits !== 1 ? "s" : ""} excedente{excessUnits !== 1 ? "s" : ""}. Uma confirmação será exibida.
                      </p>
                    )}
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
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  Resumo da Conferência
                </div>
                {auditLogs.length > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    Última ação:{" "}
                    <span className="font-medium text-foreground">{auditLogs[0]?.actorName}</span>
                    {" · "}{format(new Date(auditLogs[0]?.occurredAt), "HH:mm")}
                  </div>
                )}
              </div>

              {/* Progress bar */}
              <div className="mb-4">
                <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                  <span>
                    Progresso geral:{" "}
                    <span className={`font-semibold ${progress === 100 ? "text-emerald-500" : "text-foreground"}`}>{progress}%</span>
                  </span>
                  <span>{totalLoaded} de {totalExpected} unidades</span>
                </div>
                <Progress value={Math.min(progress, 100)} className="h-2" />
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="text-center">
                  <div className="text-lg font-bold text-emerald-500 tabular-nums">{completedProductCount}</div>
                  <div className="text-xs text-muted-foreground">de {expectedItems.length} produtos completos</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold tabular-nums">{totalLoaded}</div>
                  <div className="text-xs text-muted-foreground">unidades carregadas</div>
                </div>
                <div className="text-center">
                  <div className={`text-lg font-bold tabular-nums ${totalPending > 0 ? "text-amber-500" : ""}`}>{totalPending}</div>
                  <div className="text-xs text-muted-foreground">unidades pendentes</div>
                </div>
                <div className="text-center">
                  <div className={`text-lg font-bold tabular-nums ${totalExceeded > 0 ? "text-rose-500" : ""}`}>{totalExceeded}</div>
                  <div className="text-xs text-muted-foreground">unidades excedentes</div>
                </div>
              </div>

              {/* Load all pending */}
              {isEditable && userCanManageMovementItems(user) && pendingItems.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border/40 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowLoadAllDialog(true)}
                    data-testid="button-load-all-pending"
                  >
                    <CheckCheck className="h-4 w-4 mr-1.5" />
                    Carregar todos os restantes
                    <Badge variant="outline" className="ml-1.5 h-4 px-1 text-[10px] no-default-hover-elevate no-default-active-elevate">
                      {pendingUnitsCount}
                    </Badge>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </PageSection>
      )}

      {/* Lista dupla: Esperado vs Carregado */}
      {(() => {
        const isInbound = movement?.movementTypeConfig?.nature === "inbound";
        const totalRegistered = consolidatedLoadedItems.length;
        const sectionTitle = expectedItems.length > 0
          ? `Itens — ${expectedItems.length} produto${expectedItems.length !== 1 ? "s" : ""}`
          : totalRegistered > 0
            ? `Itens — ${totalRegistered} produto${totalRegistered !== 1 ? "s" : ""} registrado${totalRegistered !== 1 ? "s" : ""}`
            : "Itens — 0 produtos";
        const sectionDesc = isInbound
          ? "Registre os produtos recebidos no retorno"
          : "Acompanhe o progresso de carregamento";
        return (
      <PageSection
        title={sectionTitle}
        description={sectionDesc}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Itens da Requisição/Ordem */}
          {expectedItems.length > 0 && (
            <Card className="border-border/60">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3 font-semibold text-base">
                  <ClipboardList className="h-5 w-5" />
                  {canonicalRequestId && !movement?.loadingOrderId
                    ? `Produtos da Requisição — ${expectedItems.length} produto${expectedItems.length !== 1 ? "s" : ""}`
                    : `Produtos da Ordem — ${expectedItems.length} produto${expectedItems.length !== 1 ? "s" : ""}`}
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
                      pending: expectedItems.filter((i) => i.remaining > 0).length,
                      complete: expectedItems.filter((i) => i.remaining === 0 && i.loadedQuantity <= i.expectedQuantity).length,
                      exceeded: expectedItems.filter((i) => i.loadedQuantity > i.expectedQuantity).length,
                    };
                    const labels = { all: "Todos", pending: "Pendentes", complete: "Completos", exceeded: "Excedidos" };
                    return (
                      <Button key={f} variant={expectedFilter === f ? "default" : "outline"} size="sm" onClick={() => setExpectedFilter(f)} className="text-xs h-7">
                        {labels[f]} ({counts[f]})
                      </Button>
                    );
                  })}
                </div>
                <div className="overflow-y-auto max-h-[480px] pr-2" style={{ scrollbarWidth: "thin" }}>
                  <div className="space-y-2">
                    {filteredExpectedItems.length === 0 ? (
                      <div className="text-center text-muted-foreground py-8">
                        <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-20" />
                        <p className="text-sm">{orderSearchQuery ? "Nenhum produto encontrado" : "Nenhum produto na ordem"}</p>
                      </div>
                    ) : (
                      filteredExpectedItems.map((item) => {
                        const percentComplete = item.expectedQuantity > 0
                          ? Math.round((item.loadedQuantity / item.expectedQuantity) * 100)
                          : 0;
                        const isExceeded = item.loadedQuantity > item.expectedQuantity;
                        const isComplete = item.remaining === 0 && !isExceeded;
                        const excess = isExceeded ? item.loadedQuantity - item.expectedQuantity : 0;
                        return (
                          <div
                            key={item.productId}
                            className={`border rounded-lg p-3 space-y-2 cursor-pointer hover-elevate ${isExceeded ? "bg-destructive/10 border-destructive" : isComplete ? "bg-emerald-500/10 border-emerald-500/50" : ""}`}
                            onClick={() => {
                              if (movement.status === "in_progress" || movement.status === "paused") {
                                handleSelectFromExpectedItem(item);
                              }
                            }}
                            data-testid={`expected-item-${item.productId}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm leading-snug">{item.product.name}</p>
                                <p className="text-xs text-muted-foreground font-mono mt-0.5">SKU: {item.product.sku}</p>
                                {item.kitRefs && item.kitRefs.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {item.kitRefs.map((kr) => (
                                      <span
                                        key={kr.kitId}
                                        className="inline-flex items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wide bg-primary/15 text-primary px-1.5 py-px rounded-sm"
                                      >
                                        <Layers className="h-2.5 w-2.5" />
                                        {kr.kitName}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="shrink-0">
                                {isExceeded && <Badge className="bg-rose-500 text-white no-default-hover-elevate text-xs"><AlertTriangle className="h-3 w-3 mr-1" />Excedido</Badge>}
                                {isComplete && <Badge className="bg-emerald-500 text-white no-default-hover-elevate text-xs"><CheckCircle2 className="h-3 w-3 mr-1" />Completo</Badge>}
                              </div>
                            </div>
                            {/* Progress bar */}
                            <div className="space-y-1">
                              {isExceeded ? (
                                <div className="w-full bg-muted rounded-full h-1.5 flex overflow-hidden">
                                  <div className="h-full bg-emerald-500" style={{ width: `${(item.expectedQuantity / item.loadedQuantity) * 100}%` }} />
                                  <div className="h-full bg-destructive" style={{ width: `${(excess / item.loadedQuantity) * 100}%` }} />
                                </div>
                              ) : (
                                <div className="w-full bg-muted rounded-full h-1.5">
                                  <div className={`h-full rounded-full transition-all ${isComplete ? "bg-emerald-500" : percentComplete >= 50 ? "bg-amber-500" : percentComplete > 0 ? "bg-blue-500" : ""}`} style={{ width: `${percentComplete}%` }} />
                                </div>
                              )}
                              {/* 3-col mini stats */}
                              <div className="flex justify-between text-[11px] pt-0.5">
                                <span className="text-muted-foreground">Sol: <span className="font-semibold text-foreground">{item.expectedQuantity}</span></span>
                                <span className="text-muted-foreground">Carr: <span className="font-semibold text-emerald-500">{item.loadedQuantity}</span></span>
                                {isExceeded
                                  ? <span className="text-destructive font-semibold">+{excess} excedente</span>
                                  : isComplete
                                    ? <span className="text-emerald-500 font-semibold">Completo</span>
                                    : <span className="text-amber-500 font-semibold">Falta: {item.remaining}</span>
                                }
                              </div>
                            </div>
                            {/* Load remaining button */}
                            {item.remaining > 0 && isEditable && userCanManageMovementItems(user) && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs w-full mt-1"
                                disabled={addItemMutation.isPending}
                                onClick={(e) => { e.stopPropagation(); handleLoadRemaining(item); }}
                                data-testid={`button-load-remaining-${item.productId}`}
                              >
                                <PackageCheck className="h-3 w-3 mr-1.5" />
                                Carregar restante: {item.remaining}
                              </Button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Itens Carregados */}
          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3 font-semibold text-base">
                <PackageCheck className="h-5 w-5" />
                Produtos Registrados — {consolidatedLoadedItems.length} produto{consolidatedLoadedItems.length !== 1 ? "s" : ""} / {movementItems.reduce((s, i) => s + i.quantity, 0)} unidade{movementItems.reduce((s, i) => s + i.quantity, 0) !== 1 ? "s" : ""}
              </div>
              {(consolidatedLoadedItems.some((i) => i.isNotInOrder) || consolidatedLoadedItems.some((i) => i.ownerTypes.has("rented"))) && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {consolidatedLoadedItems.filter((i) => i.isNotInOrder).length > 0 && (
                    <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-200 border-amber-300 dark:border-amber-700">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {consolidatedLoadedItems.filter((i) => i.isNotInOrder).length} fora da ordem
                    </Badge>
                  )}
                  {consolidatedLoadedItems.filter((i) => i.ownerTypes.has("rented")).length > 0 && (
                    <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700">
                      {consolidatedLoadedItems.filter((i) => i.ownerTypes.has("rented")).length} locados
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
              <div className="overflow-y-auto max-h-[480px] pr-2" style={{ scrollbarWidth: "thin" }}>
                {filteredLoadedItems.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <PackageCheck className="h-8 w-8 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">{loadedSearchQuery ? "Nenhum produto encontrado" : "Nenhum produto registrado ainda"}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredLoadedItems.map((item) => {
                      const product = products.find((p) => p.id === item.productId);
                      return (
                        <div
                          key={item.productId}
                          className={`p-3 border rounded-lg hover-elevate ${item.isNotInOrder ? "bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800" : ""}`}
                          data-testid={`item-${item.productId}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="font-medium text-sm">{product?.name || "Produto desconhecido"}</p>
                                {item.isNotInOrder && (
                                  <Badge variant="outline" className="text-[10px] bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-200 border-amber-300 dark:border-amber-700">
                                    Fora da ordem
                                  </Badge>
                                )}
                                {item.ownerTypes.has("rented") && (
                                  <Badge variant="outline" className="text-[10px] bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700">LOCADO</Badge>
                                )}
                                {item.ownerTypes.has("third_party") && (
                                  <Badge variant="outline" className="text-[10px] bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700">TERCEIROS</Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-3 flex-wrap mt-0.5">
                                <p className="text-xs font-mono text-muted-foreground">{product?.sku || "-"}</p>
                                {item.owners.size > 0 && <p className="text-xs text-muted-foreground">{Array.from(item.owners).join(", ")}</p>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {evidenceByProduct.get(item.productId) && (
                                <Badge
                                  variant="outline"
                                  className="text-xs cursor-pointer"
                                  onClick={() => { setUploadProductId(item.productId); const el = document.getElementById("section-evidencias"); if (el) el.scrollIntoView({ behavior: "smooth" }); }}
                                  title="Ver evidências deste produto"
                                  data-testid={`badge-evidence-${item.productId}`}
                                >
                                  <Camera className="h-3 w-3 mr-1" />{evidenceByProduct.get(item.productId)}
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-base px-3 py-0.5 font-bold tabular-nums no-default-hover-elevate no-default-active-elevate">
                                {item.totalQuantity}x
                              </Badge>
                            </div>
                          </div>
                          {movement?.status === "in_progress" && userCanManageMovementItems(user) && (
                            <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border/40">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => decrementItemMutation.mutate(item.productId)}
                                disabled={!isEditable || decrementItemMutation.isPending}
                                data-testid={`button-decrement-${item.productId}`}
                                title="Remover 1 unidade"
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => removeItemMutation.mutate(item.productId)}
                                disabled={!isEditable || removeItemMutation.isPending}
                                data-testid={`button-remove-${item.productId}`}
                                className="text-destructive"
                                title="Remover item completo"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                              <span className="text-xs text-muted-foreground">
                                {item.totalQuantity} unidade{item.totalQuantity !== 1 ? "s" : ""}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </PageSection>
        );
      })()}

      {/* Evidências */}
      {!focusMode && (
        <PageSection id="section-evidencias" title="Evidências" description="Fotos e vídeos vinculados à movimentação">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                {(["all", "images", "videos", "damage", "loss", "before", "after", "other"] as const).map((f) => {
                  const labels: Record<string, string> = { all: "Todos", images: "Fotos", videos: "Vídeos", damage: "Avaria", loss: "Perda", before: "Antes", after: "Depois", other: "Outros" };
                  const counts: Record<string, number> = {
                    all: attachments.length, images: attachments.filter((a) => a.fileType === "image").length,
                    videos: attachments.filter((a) => a.fileType === "video").length,
                    damage: attachments.filter((a) => a.category === "damage").length,
                    loss: attachments.filter((a) => a.category === "loss").length,
                    before: attachments.filter((a) => a.category === "before").length,
                    after: attachments.filter((a) => a.category === "after").length,
                    other: attachments.filter((a) => a.category === "other").length,
                  };
                  if (f !== "all" && counts[f] === 0) return null;
                  return (
                    <Button key={f} variant={evidenceCategoryFilter === f ? "default" : "outline"} size="sm" className="text-xs h-7" onClick={() => setEvidenceCategoryFilter(f)} data-testid={`filter-evidence-${f}`}>
                      {labels[f]}
                      {counts[f] > 0 && <Badge variant="outline" className="ml-1.5 h-4 px-1 text-[10px] no-default-hover-elevate no-default-active-elevate">{counts[f]}</Badge>}
                    </Button>
                  );
                })}
              </div>
              {userCanManageMovementItems(user) && (
                <Button size="sm" onClick={() => openUploadDialog()} data-testid="button-upload-evidence">
                  <Upload className="h-4 w-4 mr-2" />
                  Adicionar evidência
                </Button>
              )}
            </div>
            {filteredAttachments.length === 0 ? (
              <Card className="border-border/60">
                <CardContent className="p-8 text-center text-muted-foreground">
                  <Camera className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Nenhuma evidência registrada</p>
                  <p className="text-sm mt-1">
                    {userCanManageMovementItems(user) ? "Clique em 'Adicionar evidência' para anexar fotos ou vídeos." : "Evidências serão exibidas aqui quando adicionadas."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {filteredAttachments.map((att) => {
                  const linkedProduct = att.productId ? products.find((p) => p.id === att.productId) : null;
                  const categoryLabels: Record<string, string> = { damage: "Avaria", loss: "Perda", before: "Antes", after: "Depois", other: "Outro" };
                  return (
                    <div key={att.id} className="group border border-border/60 rounded-lg overflow-hidden hover-elevate" data-testid={`evidence-card-${att.id}`}>
                      <div className="relative aspect-video bg-muted cursor-pointer" onClick={() => { if (att.fileType === "image") setLightboxUrl(att.fileUrl); else setVideoUrl(att.fileUrl); }}>
                        {att.fileType === "image" ? (
                          <img src={att.fileUrl} alt={att.caption || att.fileName} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-muted"><Film className="h-8 w-8 text-muted-foreground" /></div>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          {att.fileType === "image" ? <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" /> : <Play className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />}
                        </div>
                        {att.isPostCompletion && (
                          <div className="absolute top-1 left-1">
                            <Badge variant="outline" className="text-[9px] px-1 py-0 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700">Pós-conclusão</Badge>
                          </div>
                        )}
                      </div>
                      <div className="p-2 space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{categoryLabels[att.category] || att.category}</Badge>
                          {userCanManageMovementItems(user) && (
                            <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-destructive" onClick={() => deleteAttachmentMutation.mutate(att.id)} disabled={deleteAttachmentMutation.isPending} data-testid={`button-delete-evidence-${att.id}`} title="Remover evidência">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        {att.caption && <p className="text-xs text-muted-foreground truncate" title={att.caption}>{att.caption}</p>}
                        {linkedProduct && <p className="text-xs font-medium truncate" title={linkedProduct.name}>{linkedProduct.name}</p>}
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

      {/* Histórico */}
      {!focusMode && (
        <PageSection>
          {/* Custom header */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="font-semibold text-sm leading-snug">Histórico</h3>
              <p className="text-xs text-muted-foreground">Registro completo de ações realizadas nesta movimentação</p>
            </div>
            <Badge variant="outline" className="text-xs no-default-hover-elevate no-default-active-elevate">
              {auditLogs.length} {auditLogs.length === 1 ? "ação registrada" : "ações registradas"}
            </Badge>
          </div>

          {auditLogs.length === 0 ? (
            <Card className="border-border/60">
              <CardContent className="p-8 text-center text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm font-medium">Nenhuma ação registrada</p>
                <p className="text-xs mt-1">Alterações de itens, status e evidências aparecerão aqui.</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/60">
              <CardContent className="p-4 space-y-3">
                {/* Filters + search row */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex flex-wrap gap-1">
                    {([
                      { key: "all" as const, label: "Todos", count: auditLogs.length },
                      { key: "items" as const, label: "Movimentações de itens", count: auditLogs.filter((l) => ["item_added","item_removed","item_quantity_changed"].includes(l.action)).length },
                      { key: "status" as const, label: "Alterações de status", count: auditLogs.filter((l) => l.action === "status_changed").length },
                      { key: "evidence" as const, label: "Evidências", count: auditLogs.filter((l) => l.action === "evidence_added").length },
                    ]).map(({ key, label, count }) => {
                      if (key !== "all" && count === 0) return null;
                      return (
                        <Button key={key} variant={auditFilter === key ? "default" : "outline"} size="sm" className="text-xs h-7" onClick={() => setAuditFilter(key)} data-testid={`filter-audit-${key}`}>
                          {label}
                          <Badge variant="outline" className="ml-1.5 h-4 px-1 text-[10px] no-default-hover-elevate no-default-active-elevate">{count}</Badge>
                        </Button>
                      );
                    })}
                  </div>
                  {/* Search */}
                  <div className="flex-1 min-w-40 relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      value={auditSearchQuery}
                      onChange={(e) => setAuditSearchQuery(e.target.value)}
                      placeholder="Buscar por produto, SKU ou usuário..."
                      className="pl-8 h-7 text-xs"
                      data-testid="input-search-audit"
                    />
                    {auditSearchQuery && (
                      <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setAuditSearchQuery("")}>
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Timeline */}
                <div className="max-h-[520px] overflow-y-auto -mx-1 px-1" style={{ scrollbarWidth: "thin" }}>
                  {groupedAuditLogs.length === 0 ? (
                    <div className="text-center text-muted-foreground py-6">
                      <Search className="h-6 w-6 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">Nenhum resultado para este filtro</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {groupedAuditLogs.map((group) => (
                        <div key={group.dateKey}>
                          {/* Date separator */}
                          <div className="flex items-center gap-2 mb-2">
                            <div className="h-px flex-1 bg-border/40" />
                            <span className="text-[10px] font-semibold text-muted-foreground tracking-widest px-1">{group.label}</span>
                            <div className="h-px flex-1 bg-border/40" />
                          </div>

                          {/* Entries for this day */}
                          <div className="relative pl-6">
                            {/* Vertical timeline line — stops before last entry's icon */}
                            {group.logs.length > 1 && (
                              <div
                                className="absolute left-[9px] top-3 w-px bg-border/40"
                                style={{ height: `calc(100% - 22px)` }}
                              />
                            )}
                            <div className="space-y-0.5">
                              {group.logs.map((log) => {
                                const iconCfg = getLogIconConfig(log.action);
                                const title = getLogTitle(log);
                                const details = getLogDetails(log);
                                const source = getLogSource(log);
                                const isExpanded = expandedLogs.has(log.id);
                                const occurredAt = new Date(log.occurredAt);
                                const hasExpandable = details.length > 0;

                                return (
                                  <div
                                    key={log.id}
                                    className="relative flex items-start gap-3 py-1.5"
                                    data-testid={`audit-log-${log.id}`}
                                  >
                                    {/* Icon dot */}
                                    <div className={`relative z-10 flex-shrink-0 mt-0.5 w-[18px] h-[18px] rounded-full border flex items-center justify-center ${iconCfg.bg}`}>
                                      {getLogIconEl(log.action)}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                      {/* Main row: title + time */}
                                      <div className="flex items-start justify-between gap-2">
                                        <button
                                          onClick={() => hasExpandable && toggleLogExpanded(log.id)}
                                          className={`text-left flex-1 min-w-0 ${hasExpandable ? "cursor-pointer" : "cursor-default"}`}
                                          data-testid={`audit-toggle-${log.id}`}
                                        >
                                          <span className="text-sm font-medium leading-snug">{title}</span>
                                        </button>
                                        <span
                                          className="text-xs text-muted-foreground tabular-nums shrink-0 cursor-default select-none"
                                          title={format(occurredAt, "dd/MM/yyyy 'às' HH:mm:ss")}
                                        >
                                          {format(occurredAt, "HH:mm")}
                                        </span>
                                      </div>

                                      {/* First detail line — always visible as preview */}
                                      {details.length > 0 && !isExpanded && (
                                        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{details[0]}</p>
                                      )}

                                      {/* Actor + source */}
                                      <p className="text-xs text-muted-foreground mt-0.5">
                                        {log.actorName}
                                        {source && <span className="opacity-70"> · {source}</span>}
                                      </p>

                                      {/* Expanded details panel */}
                                      {isExpanded && (
                                        <div className="mt-1.5 p-2.5 bg-muted/30 rounded-md text-xs space-y-1 border border-border/40">
                                          {details.map((d, i) => (
                                            <p key={i} className="text-muted-foreground">{d}</p>
                                          ))}
                                          <p className="text-muted-foreground/60 pt-0.5 border-t border-border/30 mt-1">
                                            {format(occurredAt, "dd/MM/yyyy 'às' HH:mm:ss")}
                                          </p>
                                        </div>
                                      )}

                                      {/* Expand / collapse toggle */}
                                      {hasExpandable && (
                                        <button
                                          onClick={() => toggleLogExpanded(log.id)}
                                          className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground mt-0.5 flex items-center gap-0.5 transition-colors"
                                          data-testid={`audit-expand-${log.id}`}
                                        >
                                          {isExpanded ? "Recolher" : "Ver detalhes"}
                                          <ChevronRight className={`h-2.5 w-2.5 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </PageSection>
      )}

      {/* Exception Dialog — Exceeded quantity */}
      <Dialog open={showExceptionDialog} onOpenChange={setShowExceptionDialog}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-exception">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirmar quantidade excedente
            </DialogTitle>
            <DialogDescription>
              A quantidade informada ultrapassa o previsto para este produto.
            </DialogDescription>
          </DialogHeader>
          {selectedProduct && selectedExpectedItem && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-muted/40 rounded-lg">
                <p className="font-semibold">{selectedProduct.name}</p>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">SKU: {selectedProduct.sku}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="p-2.5 bg-muted/30 rounded-md">
                  <div className="text-xs text-muted-foreground mb-0.5">Solicitado</div>
                  <div className="font-bold text-lg tabular-nums">{selectedExpectedItem.expectedQuantity}</div>
                </div>
                <div className="p-2.5 bg-muted/30 rounded-md">
                  <div className="text-xs text-muted-foreground mb-0.5">Já carregado</div>
                  <div className="font-bold text-lg tabular-nums">{selectedExpectedItem.loadedQuantity}</div>
                </div>
                <div className="p-2.5 bg-muted/30 rounded-md">
                  <div className="text-xs text-muted-foreground mb-0.5">Nova quantidade</div>
                  <div className="font-bold text-lg tabular-nums">{quantity}</div>
                </div>
                <div className="p-2.5 bg-destructive/10 border border-destructive/30 rounded-md">
                  <div className="text-xs text-destructive mb-0.5">Excedente gerado</div>
                  <div className="font-bold text-lg tabular-nums text-destructive">+{excessUnits}</div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowExceptionDialog(false)} data-testid="button-cancel-exception">
              Voltar e corrigir
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmException}
              disabled={addItemMutation.isPending}
              data-testid="button-confirm-exception"
            >
              {addItemMutation.isPending ? "Registrando..." : "Registrar com excedente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Load All Pending Dialog */}
      <Dialog open={showLoadAllDialog} onOpenChange={setShowLoadAllDialog}>
        <DialogContent className="sm:max-w-sm" data-testid="dialog-load-all">
          <DialogHeader>
            <DialogTitle>Registrar todas as pendências?</DialogTitle>
            <DialogDescription>
              Isso vai registrar automaticamente toda a quantidade pendente de cada produto.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <div className="p-3 bg-muted/40 rounded-lg space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Produtos</span>
                <span className="font-semibold">{pendingItems.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Unidades</span>
                <span className="font-semibold">{pendingUnitsCount}</span>
              </div>
            </div>
            {pendingItems.some((i) => products.find((p) => p.id === i.productId)?.requiresSupplier) && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Produtos locados ou consignados serão ignorados. Registre-os manualmente para informar o fornecedor.
                </AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowLoadAllDialog(false)} data-testid="button-cancel-load-all">Cancelar</Button>
            <Button
              onClick={() => {
                const itemsToLoad = pendingItems.filter((i) => !products.find((p) => p.id === i.productId)?.requiresSupplier);
                loadAllPendingMutation.mutate(itemsToLoad);
              }}
              disabled={loadAllPendingMutation.isPending}
              data-testid="button-confirm-load-all"
            >
              {loadAllPendingMutation.isPending ? "Registrando..." : "Registrar pendências"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Status Dialog */}
      <Dialog open={showEditStatusDialog} onOpenChange={setShowEditStatusDialog}>
        <DialogContent data-testid="dialog-edit-status">
          <DialogHeader>
            <DialogTitle>Editar Status da Movimentação</DialogTitle>
            <DialogDescription>Selecione o novo status para esta movimentação</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="new-status" className="mb-2 block">Novo Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger id="new-status" data-testid="select-new-status"><SelectValue placeholder="Selecione o status..." /></SelectTrigger>
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
            <Button variant="outline" onClick={() => { setShowEditStatusDialog(false); setNewStatus(""); }} data-testid="button-cancel-edit-status">Cancelar</Button>
            <Button onClick={() => { if (newStatus) updateStatusMutation.mutate(newStatus); }} disabled={!newStatus || updateStatusMutation.isPending} data-testid="button-confirm-edit-status">
              {updateStatusMutation.isPending ? "Atualizando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Evidence Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={(open) => {
        if (!open) { setUploadFile(null); setUploadPreviewUrl(null); setUploadCategory("other"); setUploadCaption(""); setUploadProductId(""); }
        setShowUploadDialog(open);
      }}>
        <DialogContent className="max-w-lg" data-testid="dialog-upload-evidence">
          <DialogHeader>
            <DialogTitle>Adicionar Evidência</DialogTitle>
            <DialogDescription>Anexe uma foto ou vídeo à movimentação</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="mb-2 block">Arquivo</Label>
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp,video/mp4,video/quicktime,video/webm" className="hidden" onChange={handleFileSelected} data-testid="input-file-evidence" />
              {!uploadFile ? (
                <button type="button" className="w-full border-2 border-dashed border-border rounded-lg p-8 text-center hover-elevate cursor-pointer" onClick={() => fileInputRef.current?.click()} data-testid="button-pick-file">
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
                      <Film className="h-8 w-8 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{uploadFile.name}</p>
                        <p className="text-xs text-muted-foreground">{(uploadFile.size / 1024 / 1024).toFixed(1)} MB</p>
                      </div>
                    </div>
                  )}
                  <div className="p-2 border-t border-border/40">
                    <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => { setUploadFile(null); setUploadPreviewUrl(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>
                      <X className="h-3 w-3 mr-1" />
                      Trocar arquivo
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="upload-category" className="mb-2 block">Categoria</Label>
              <Select value={uploadCategory} onValueChange={setUploadCategory}>
                <SelectTrigger id="upload-category" data-testid="select-evidence-category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="other">Outro</SelectItem>
                  <SelectItem value="before">Antes da movimentação</SelectItem>
                  <SelectItem value="after">Após a movimentação</SelectItem>
                  <SelectItem value="damage">Avaria</SelectItem>
                  <SelectItem value="loss">Perda / Divergência</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {consolidatedLoadedItems.length > 0 && (
              <div>
                <Label htmlFor="upload-product" className="mb-2 block">Produto (opcional)</Label>
                <Select value={uploadProductId || "none"} onValueChange={(v) => setUploadProductId(v === "none" ? "" : v)}>
                  <SelectTrigger id="upload-product" data-testid="select-evidence-product"><SelectValue placeholder="Vincular a um produto..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum — geral</SelectItem>
                    {consolidatedLoadedItems.map((item) => {
                      const p = products.find((x) => x.id === item.productId);
                      return p ? <SelectItem key={item.productId} value={item.productId}>{p.name}</SelectItem> : null;
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label htmlFor="upload-caption" className="mb-2 block">Descrição (opcional)</Label>
              <Textarea id="upload-caption" placeholder="Descreva o que a imagem mostra..." value={uploadCaption} onChange={(e) => setUploadCaption(e.target.value)} rows={2} className="resize-none" data-testid="input-evidence-caption" />
            </div>
            {movement?.status === "completed" && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">Esta movimentação está finalizada. A evidência será marcada como "pós-conclusão".</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)} data-testid="button-cancel-upload-evidence">Cancelar</Button>
            <Button onClick={handleUploadSubmit} disabled={!uploadFile || uploadAttachmentMutation.isPending} data-testid="button-confirm-upload-evidence">
              {uploadAttachmentMutation.isPending ? "Enviando..." : "Enviar evidência"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox */}
      <Dialog open={!!lightboxUrl} onOpenChange={(open) => { if (!open) setLightboxUrl(null); }}>
        <DialogContent className="max-w-4xl p-2" data-testid="dialog-lightbox">
          <DialogHeader className="px-2 pt-2 pb-0"><DialogTitle className="sr-only">Visualização de imagem</DialogTitle></DialogHeader>
          <div className="flex items-center justify-center bg-muted/50 rounded-md overflow-hidden">
            {lightboxUrl && <img src={lightboxUrl} alt="Evidência" className="max-h-[80vh] max-w-full object-contain" />}
          </div>
        </DialogContent>
      </Dialog>

      {/* Video player */}
      <Dialog open={!!videoUrl} onOpenChange={(open) => { if (!open) setVideoUrl(null); }}>
        <DialogContent className="max-w-3xl p-2" data-testid="dialog-video-player">
          <DialogHeader className="px-2 pt-2 pb-0"><DialogTitle className="sr-only">Reprodução de vídeo</DialogTitle></DialogHeader>
          <div className="bg-black rounded-md overflow-hidden">
            {videoUrl && <video src={videoUrl} controls autoPlay className="w-full max-h-[75vh]" data-testid="video-evidence-player" />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
