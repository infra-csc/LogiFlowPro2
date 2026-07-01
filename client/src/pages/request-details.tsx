import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, Trash2, Send, AlertCircle, Copy, Save, ClipboardList, Package, CheckCircle2, XCircle, Clock, Pencil, Check, X, Boxes, Loader2, Layers } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AddItemDialog } from "@/components/add-item-dialog";
import { DuplicateRequestDialog } from "@/components/duplicate-request-dialog";
import { RequestDialog } from "@/components/request-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Event } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { EmptyState } from "@/components/empty-state";
import { ActionBar } from "@/components/action-bar";
import { StatusBadge } from "@/components/status-badge";

const itemStatusIcon: Record<string, typeof CheckCircle2> = {
  approved: CheckCircle2,
  rejected: XCircle,
  pending: Clock,
};

const itemStatusColor: Record<string, string> = {
  approved: "text-chart-4",
  rejected: "text-destructive",
  pending: "text-muted-foreground",
};

const itemStatusBg: Record<string, string> = {
  approved: "bg-chart-4/10 border-chart-4/20",
  rejected: "bg-destructive/10 border-destructive/20",
  pending: "bg-muted/50 border-border",
};

type RequestItem = {
  id: string;
  requestId: string;
  productId?: string | null;
  quantity: number;
  approvalStatus: string;
  approvedQuantity?: number;
  rejectionReason?: string;
  kitId?: string | null;
  kitParameters?: any;
  notes?: string;
  product?: {
    id: string;
    name: string;
    sku: string;
    unit: string;
  };
  kit?: {
    id: string;
    name: string;
  };
};

type MaterialRequest = {
  id: string;
  eventId: string;
  area: string;
  status: string;
  requestedBy: string;
  submittedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  cutoffTime?: string;
  notes?: string;
  rejectionReason?: string | null;
  createdAt: string;
  event?: {
    id: string;
    name: string;
    client: string;
    eventDate: string;
  };
  requestedByUser?: {
    id: string;
    name: string;
    username: string;
  };
};

// ─── Kit BOM helpers ─────────────────────────────────────────────────────────

function calcFinalQtyLocal(
  formula: string,
  multiplier: number,
  parameters: Record<string, number>,
  productId?: string,
): number {
  const f = formula.trim();
  if (f === "?") {
    return Math.max(0, Math.round(parameters[productId ?? ""] ?? 0));
  }
  // Simple integer/decimal — no eval needed
  const simple = parseFloat(f);
  if (!isNaN(simple) && String(simple) === f) {
    return Math.max(0, Math.round(simple * multiplier));
  }
  // Expression with variable substitution
  try {
    let expr = f;
    for (const [name, val] of Object.entries(parameters)) {
      expr = expr.replace(new RegExp(`\\b${name}\\b`, "g"), String(val));
    }
    const sanitized = expr.replace(/[^0-9+\-*/().\s]/g, "");
    if (sanitized !== expr) return 0;
    // eslint-disable-next-line no-new-func
    const result = Function('"use strict"; return (' + sanitized + ")")() as number;
    return Math.max(0, Math.round(result * multiplier));
  } catch {
    return 0;
  }
}

type BomLineData = { id: string; productId: string; quantityFormula: string; kitId: string };

function KitBomSummary({
  kitId,
  quantity,
  kitParameters,
  products,
}: {
  kitId: string;
  quantity: number;
  kitParameters?: Record<string, number>;
  products: Array<{ id: string; name: string; sku: string; unit?: string }>;
}) {
  const { data: bomLines = [], isLoading } = useQuery<BomLineData[]>({
    queryKey: ["/api/kits", kitId, "bom"],
  });

  if (isLoading) {
    return (
      <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Carregando componentes...
      </div>
    );
  }

  if (!bomLines.length) return null;

  const params = kitParameters ?? {};
  const lines = bomLines.map((line) => {
    const product = products.find((p) => p.id === line.productId);
    const isVariable = line.quantityFormula.trim() === "?";
    const qty = calcFinalQtyLocal(line.quantityFormula, quantity, params, line.productId);
    const qtyLabel = isVariable && qty === 0 ? "?" : String(qty);
    return { product, qty, qtyLabel, productId: line.productId, isVariable };
  });

  return (
    <div className="mt-3 border-t border-border/30 pt-2">
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
        <Layers className="h-3 w-3" />
        Componentes — {lines.length} produto{lines.length !== 1 ? "s" : ""}
      </div>
      <div className="grid gap-1">
        {lines.map(({ product, qtyLabel, productId, isVariable }) => (
          <div
            key={productId}
            className="flex items-center justify-between text-xs py-1 px-2 bg-muted/30 rounded"
            data-testid={`kit-bom-line-${productId}`}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="truncate text-foreground/80">
                {product?.name ?? "Produto desconhecido"}
              </span>
              {isVariable && (
                <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 font-semibold shrink-0">
                  var
                </span>
              )}
            </div>
            <span className="font-semibold tabular-nums text-foreground shrink-0 ml-3">
              {qtyLabel}× {(product as any)?.unit ?? "unid"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function RequestDetails() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [showAddItem, setShowAddItem] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteItemDialog, setShowDeleteItemDialog] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [showDeleteBatchDialog, setShowDeleteBatchDialog] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");

  const { data: request, isLoading } = useQuery<MaterialRequest>({
    queryKey: ["/api/requests", id],
  });

  const { data: items = [] } = useQuery<RequestItem[]>({
    queryKey: ["/api/requests", id, "items"],
  });

  const { data: event } = useQuery<Event>({
    queryKey: ["/api/events", request?.eventId],
    enabled: !!request?.eventId,
  });

  const { data: products = [], isLoading: productsLoading } = useQuery<{ id: string; name: string; sku: string; unit: string; ownership: string; currentStock?: number }[]>({
    queryKey: ["/api/products"],
  });

  const { data: kits = [], isLoading: kitsLoading } = useQuery<{
    id: string;
    name: string;
    description?: string;
    parameters: { name: string; type: "number" | "select"; unit?: string; options?: string[] }[];
  }[]>({
    queryKey: ["/api/kits"],
  });

  const requestWindowInfo = useMemo(() => {
    if (!event?.requestWindowStart || !event?.requestWindowEnd) return null;
    const now = new Date();
    const start = new Date(event.requestWindowStart);
    const end = new Date(event.requestWindowEnd);
    const formatDate = (date: Date) =>
      date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    return {
      start: formatDate(start),
      end: formatDate(end),
      isBeforeWindow: now < start,
      isAfterWindow: now > end,
      isWithinWindow: now >= start && now <= end,
    };
  }, [event]);

  const itemStats = useMemo(() => {
    const approved = items.filter(i => i.approvalStatus === "approved");
    const pending  = items.filter(i => i.approvalStatus === "pending");
    const rejected = items.filter(i => i.approvalStatus === "rejected");
    const kitsCount = items.filter(i => i.kitId && !i.productId).length;
    const divergentItems = approved.filter(i => i.approvedQuantity != null && i.approvedQuantity !== i.quantity);
    const totalDivergence = divergentItems.reduce((s, i) => s + ((i.approvedQuantity ?? 0) - i.quantity), 0);
    return {
      total: items.length,
      kitsCount,
      productsCount: items.length - kitsCount,
      totalRequestedUnits: items.reduce((s, i) => s + i.quantity, 0),
      totalApprovedUnits:  approved.reduce((s, i) => s + (i.approvedQuantity ?? 0), 0),
      approvedCount: approved.length,
      pendingCount:  pending.length,
      rejectedCount: rejected.length,
      divergentCount: divergentItems.length,
      totalDivergence,
    };
  }, [items]);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/requests/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Requisição excluída", description: "A requisição foi excluída com sucesso" });
      navigate("/requests");
    },
    onError: () => {
      toast({ variant: "destructive", title: "Erro ao excluir", description: "Não foi possível excluir a requisição" });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PATCH", `/api/requests/${id}`, { status: "pending_approval" });
      if (!response.ok) {
        const errorData = await response.json();
        throw errorData;
      }
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/requests", id] });
      toast({ title: "Enviado para aprovação", description: "A requisição foi submetida para aprovação" });
    },
    onError: (error: any) => {
      let description = "Não foi possível submeter a requisição";
      if (error?.windowStart && error?.windowEnd) {
        const start = new Date(error.windowStart);
        const end = new Date(error.windowEnd);
        description = `${error.error}\n\nPeríodo permitido: ${start.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })} até ${end.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}`;
      } else if (error?.error) {
        description = error.error;
      }
      toast({ variant: "destructive", title: "Erro ao submeter", description });
    },
  });

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState<string>("");
  const [editNotes, setEditNotes] = useState<string>("");
  const [kitEditBom, setKitEditBom] = useState<Array<{ productId: string; productName: string; unit: string }>>([]);
  const [kitEditVariableQtys, setKitEditVariableQtys] = useState<Record<string, number>>({});
  const [kitEditLoading, setKitEditLoading] = useState(false);

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      await apiRequest("DELETE", `/api/request-items/${itemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests", id, "items"] });
      toast({ title: "Item removido", description: "O item foi removido da requisição" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Erro ao remover", description: "Não foi possível remover o item" });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ itemId, quantity, notes, kitParameters }: { itemId: string; quantity: number; notes?: string; kitParameters?: Record<string, number> }) => {
      return apiRequest("PATCH", `/api/request-items/${itemId}`, { quantity, notes, kitParameters });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests", id, "items"] });
      toast({ title: "Item atualizado", description: "Quantidade e observações atualizadas" });
      setEditingItemId(null);
      setKitEditBom([]);
      setKitEditVariableQtys({});
    },
    onError: () => {
      toast({ variant: "destructive", title: "Erro ao atualizar", description: "Não foi possível atualizar o item" });
    },
  });

  const updateNotesMutation = useMutation({
    mutationFn: async (notesValue: string) => {
      return apiRequest("PATCH", `/api/requests/${id}`, { notes: notesValue || null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/requests", id] });
      toast({ title: "Observações atualizadas", description: "As observações foram salvas com sucesso" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Erro ao salvar", description: "Não foi possível salvar as observações" });
    },
  });

  useEffect(() => {
    if (request) {
      setNotes(request.notes || "");
    }
  }, [request]);

  if (isLoading) {
    return <PageLoading message="Carregando requisição..." />;
  }

  if (!request) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Requisição não encontrada"
        description="A requisição solicitada não existe ou você não tem acesso."
      />
    );
  }

  const isOwner = user && request.requestedBy === user.id;
  const isAdmin = user && (user as any).isAdmin === true;
  const canEdit = request.status === "draft" && (isOwner || isAdmin);
  // Admin can rename/edit metadata on draft OR pending_approval; owner only on draft
  const canRename = isAdmin
    ? ["draft", "pending_approval"].includes(request.status)
    : canEdit;
  // Admin can delete any non-approved request; owner can only delete their own draft
  const canDelete = isAdmin
    ? request.status !== "approved"
    : request.status === "draft" && !!isOwner;

  const handleDelete = () => {
    deleteMutation.mutate();
    setShowDeleteDialog(false);
  };

  const handleDeleteItem = () => {
    if (itemToDelete) {
      deleteItemMutation.mutate(itemToDelete);
    }
    setShowDeleteItemDialog(false);
    setItemToDelete(null);
  };

  const handleDeleteBatch = () => {
    const ids = Array.from(selectedItems);
    let completed = 0;
    let failed = 0;
    const deleteNext = (index: number) => {
      if (index >= ids.length) {
        if (failed === 0) {
          toast({ title: "Itens excluídos", description: `${completed} item(s) removido(s) com sucesso` });
        } else {
          toast({ variant: "destructive", title: "Erro parcial", description: `${completed} removido(s), ${failed} falha(s)` });
        }
        queryClient.invalidateQueries({ queryKey: ["/api/requests", id, "items"] });
        setShowDeleteBatchDialog(false);
        setSelectedItems(new Set());
        setSelectMode(false);
        return;
      }
      apiRequest("DELETE", `/api/request-items/${ids[index]}`).then(() => {
        completed++;
        deleteNext(index + 1);
      }).catch(() => {
        failed++;
        deleteNext(index + 1);
      });
    };
    deleteNext(0);
  };

  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(items.map(i => i.id)));
    }
  };

  const handleSubmit = () => {
    submitMutation.mutate();
  };

  const handleSaveNotes = () => {
    updateNotesMutation.mutate(notes);
  };

  const notesChanged = notes !== (request.notes || "");

  const formatDate = (date: string | undefined) => {
    if (!date) return "—";
    return new Date(date).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader title={request.area} description={request.event?.name || ""}>
        <ActionBar>
          <Button variant="outline" size="sm" onClick={() => navigate("/requests")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          {items.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setShowDuplicateDialog(true)} data-testid="button-duplicate-request">
              <Copy className="h-4 w-4 mr-2" />
              Duplicar
            </Button>
          )}
          {canRename && (
            <Button variant="outline" size="sm" onClick={() => setShowEditDialog(true)} data-testid="button-edit-request">
              <Pencil className="h-4 w-4 mr-2" />
              Editar
            </Button>
          )}
          {canDelete && (
            <Button variant="outline" size="sm" onClick={() => setShowDeleteDialog(true)} data-testid="button-delete-request">
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir
            </Button>
          )}
          {canEdit && (
            <Button size="sm" onClick={handleSubmit} disabled={items.length === 0} data-testid="button-submit-approval">
              <Send className="h-4 w-4 mr-2" />
              Enviar
            </Button>
          )}
        </ActionBar>
      </PageHeader>

      {/* Status + ID row */}
      <div className="flex items-center gap-3">
        <StatusBadge status={request.status} />
        <span className="text-xs text-muted-foreground font-mono tracking-widest">#{request.id.slice(0, 8).toUpperCase()}</span>
      </div>

      {/* Request window alert */}
      {canEdit && requestWindowInfo && !requestWindowInfo.isWithinWindow && (
        <Alert variant="destructive" data-testid="alert-requisition-window">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5" />
            <AlertDescription className="text-sm">
              {requestWindowInfo.isBeforeWindow && (
                <span>
                  <strong>Atenção:</strong> Requisições para este evento ainda não estão permitidas.
                  <br />
                  <span className="text-xs">Período: {requestWindowInfo.start} até {requestWindowInfo.end}</span>
                </span>
              )}
              {requestWindowInfo.isAfterWindow && (
                <span>
                  <strong>Atenção:</strong> O período de requisição para este evento já foi encerrado.
                  <br />
                  <span className="text-xs">Período permitido era: {requestWindowInfo.start} até {requestWindowInfo.end}</span>
                </span>
              )}
            </AlertDescription>
          </div>
        </Alert>
      )}

      {/* Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        <Card className="border-border/60">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium mb-1">Solicitante</p>
            <p className="font-semibold text-base text-foreground">{request.requestedByUser?.name || "Usuário"}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium mb-2">Status</p>
            <StatusBadge status={request.status} />
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium mb-1">Criação</p>
            <p className="font-semibold text-base text-foreground">{formatDate(request.createdAt)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium mb-1">Evento</p>
            <p className="font-semibold text-base text-foreground">{request.event?.name || "—"}</p>
          </CardContent>
        </Card>
        {request.submittedAt && (
          <Card className="border-border/60">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground font-medium mb-1">Submissão</p>
              <p className="font-semibold text-base text-foreground">{formatDate(request.submittedAt)}</p>
            </CardContent>
          </Card>
        )}
        {request.approvedAt && (
          <Card className="border-border/60">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground font-medium mb-1">
                {request.status === "rejected" ? "Rejeição" : "Aprovação"}
              </p>
              <p className="font-semibold text-base text-foreground">{formatDate(request.approvedAt)}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Observações */}
      <Card className="border-border/60">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
            <div className="font-semibold text-base">Observações</div>
          </div>
          <div className="pt-3 border-t border-border/40">
            {canEdit ? (
              <div className="space-y-3">
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Adicione observações sobre a requisição (opcional)"
                  data-testid="input-edit-notes"
                  rows={3}
                />
                {notesChanged && (
                  <div className="flex justify-end">
                    <Button size="sm" onClick={handleSaveNotes} disabled={updateNotesMutation.isPending} data-testid="button-save-notes">
                      <Save className="h-4 w-4 mr-2" />
                      {updateNotesMutation.isPending ? "Salvando..." : "Salvar"}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground" data-testid="text-notes">
                {request.notes || "Nenhuma observação"}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Materiais */}
      <Card className="border-border/60">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              <div className="font-semibold text-base">
                Materiais Requisitados
              </div>
              {items.length > 0 && (
                <span className="text-sm font-medium px-2.5 py-0.5 bg-muted rounded-full text-foreground">
                  {items.length} item{items.length > 1 ? "s" : ""}
                </span>
              )}
            </div>
            {canEdit && (
              <div className="flex items-center gap-2">
                {items.length > 1 && (
                  <Button
                    variant={selectMode ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => {
                      setSelectMode(!selectMode);
                      setSelectedItems(new Set());
                    }}
                    data-testid="button-select-mode"
                  >
                    {selectMode ? "Cancelar" : "Selecionar"}
                  </Button>
                )}
                {selectMode && selectedItems.size > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowDeleteBatchDialog(true)}
                    data-testid="button-delete-batch"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir {selectedItems.size}
                  </Button>
                )}
                <Button size="sm" onClick={() => setShowAddItem(true)} data-testid="button-add-item">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar
                </Button>
              </div>
            )}
          </div>
          <div className="pt-3 border-t border-border/40">
            {itemStats.total > 0 && (
              <div className={`grid gap-2 mb-4 ${request.status === "draft" ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-5"}`}>
                {/* Itens */}
                <div className="bg-muted/40 border border-border/40 rounded-lg p-2.5 flex flex-col gap-0.5">
                  <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <Package className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">Itens</span>
                  </div>
                  <div className="text-xl font-bold tabular-nums leading-none pt-1">{itemStats.total}</div>
                  {itemStats.kitsCount > 0 && (
                    <div className="text-[10px] text-muted-foreground">
                      {itemStats.productsCount > 0 ? `${itemStats.productsCount} prod · ` : ""}{itemStats.kitsCount} kit{itemStats.kitsCount !== 1 ? "s" : ""}
                    </div>
                  )}
                </div>

                {/* Unidades solicitadas */}
                <div className="bg-muted/40 border border-border/40 rounded-lg p-2.5 flex flex-col gap-0.5">
                  <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <ClipboardList className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">Solicitadas</span>
                  </div>
                  <div className="text-xl font-bold tabular-nums leading-none pt-1">{itemStats.totalRequestedUnits}</div>
                  <div className="text-[10px] text-muted-foreground">unidades</div>
                </div>

                {/* Aprovados — only after submission */}
                {request.status !== "draft" && (
                  <div className={`border rounded-lg p-2.5 flex flex-col gap-0.5 ${itemStats.approvedCount > 0 ? "bg-chart-4/10 border-chart-4/30" : "bg-muted/40 border-border/40"}`}>
                    <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">Aprovados</span>
                    </div>
                    <div className={`text-xl font-bold tabular-nums leading-none pt-1 ${itemStats.approvedCount > 0 ? "text-chart-4" : ""}`}>{itemStats.approvedCount}</div>
                    {itemStats.totalApprovedUnits > 0 && (
                      <div className="text-[10px] text-muted-foreground">{itemStats.totalApprovedUnits} unid.</div>
                    )}
                  </div>
                )}

                {/* Pendentes */}
                {request.status !== "draft" && (
                  <div className={`border rounded-lg p-2.5 flex flex-col gap-0.5 ${itemStats.pendingCount > 0 ? "bg-amber-500/10 border-amber-500/30" : "bg-muted/40 border-border/40"}`}>
                    <div className={`flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide ${itemStats.pendingCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                      <Clock className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">Pendentes</span>
                    </div>
                    <div className={`text-xl font-bold tabular-nums leading-none pt-1 ${itemStats.pendingCount > 0 ? "text-amber-500" : ""}`}>{itemStats.pendingCount}</div>
                  </div>
                )}

                {/* Rejeitados */}
                {request.status !== "draft" && (
                  <div className={`border rounded-lg p-2.5 flex flex-col gap-0.5 ${itemStats.rejectedCount > 0 ? "bg-destructive/10 border-destructive/30" : "bg-muted/40 border-border/40"}`}>
                    <div className={`flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide ${itemStats.rejectedCount > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                      <XCircle className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">Rejeitados</span>
                    </div>
                    <div className={`text-xl font-bold tabular-nums leading-none pt-1 ${itemStats.rejectedCount > 0 ? "text-destructive" : ""}`}>{itemStats.rejectedCount}</div>
                  </div>
                )}
              </div>
            )}

            {/* Divergence notice */}
            {request.status !== "draft" && itemStats.divergentCount > 0 && (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/8 px-3 py-2.5">
                <AlertCircle className="h-4 w-4 text-amber-500 dark:text-amber-400 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <span className="font-semibold text-amber-600 dark:text-amber-400">
                    {itemStats.divergentCount} item{itemStats.divergentCount !== 1 ? "ns" : ""} com divergência de quantidade
                  </span>
                  <span className="text-muted-foreground ml-1.5">
                    — saldo total:{" "}
                    <span className={`font-semibold ${itemStats.totalDivergence < 0 ? "text-amber-500 dark:text-amber-400" : "text-primary"}`}>
                      {itemStats.totalDivergence > 0 ? "+" : ""}{itemStats.totalDivergence} unid.
                    </span>
                    {itemStats.totalDivergence < 0 ? " aprovadas a menos" : " aprovadas a mais"} do que solicitado
                  </span>
                </div>
              </div>
            )}

            {items.length === 0 ? (
              <EmptyState
                icon={Package}
                title="Nenhum material adicionado"
                description={canEdit ? "Clique em \"Adicionar\" para incluir produtos ou kits." : "Esta requisição não possui materiais."}
                action={
                  canEdit
                    ? { label: "Adicionar Material", onClick: () => setShowAddItem(true) }
                    : undefined
                }
              />
            ) : (
              <div className="space-y-3">
                {[...items].sort((a, b) => {
                  const nameA = (a.kit?.name ?? a.product?.name ?? "").toLowerCase();
                  const nameB = (b.kit?.name ?? b.product?.name ?? "").toLowerCase();
                  return nameA.localeCompare(nameB, "pt-BR");
                }).map((item) => {
                  const StatusIcon = itemStatusIcon[item.approvalStatus] || Clock;
                  const statusColor = itemStatusColor[item.approvalStatus] || "text-muted-foreground";
                  const statusBg = itemStatusBg[item.approvalStatus] || "bg-muted/50 border-border";
                  const isApproved = item.approvalStatus === "approved";
                  const isRejected = item.approvalStatus === "rejected";

                  return (
                    <div
                      key={item.id}
                      className={`group border rounded-lg p-4 transition-all hover-elevate ${statusBg} ${selectMode && selectedItems.has(item.id) ? "ring-1 ring-primary bg-primary/5" : ""}`}
                      data-testid={`item-${item.id}`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        {/* Left: icon + name + SKU */}
                        <div className="flex items-start gap-4 flex-1 min-w-0">
                          {selectMode && (
                            <div className="flex items-center pt-1">
                              <button
                                onClick={() => toggleItemSelection(item.id)}
                                className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedItems.has(item.id) ? "bg-primary border-primary" : "border-border"}`}
                                data-testid={`checkbox-item-${item.id}`}
                              >
                                {selectedItems.has(item.id) && <Check className="h-3 w-3 text-primary-foreground" />}
                              </button>
                            </div>
                          )}
                          <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center text-primary shrink-0">
                            {item.kitId && !item.productId ? (
                              <Boxes className="h-5 w-5 text-purple-500" />
                            ) : (
                              <Package className="h-5 w-5" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-foreground">
                              {item.kitId && !item.productId
                                ? item.kit?.name ?? "Kit"
                                : item.product?.name}
                            </p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {item.kitId && !item.productId ? (
                                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30">
                                  <Boxes className="h-2.5 w-2.5" />
                                  Kit
                                </span>
                              ) : (
                                <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                                  {item.product?.sku ?? "—"}
                                </span>
                              )}
                              {!canEdit && item.approvalStatus && (
                                <span className={`text-xs ${statusColor}`}>
                                  {item.approvalStatus === "approved" ? "Aprovado" : item.approvalStatus === "rejected" ? "Rejeitado" : "Pendente"}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right: quantity + actions (compact) */}
                        <div className="flex items-center gap-4 sm:text-right">
                          {editingItemId === item.id ? (
                            <div className="flex flex-col gap-3 items-end">
                              {/* Multiplier row */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                                  {item.kitId && !item.productId ? "Qtd. de kits" : "Quantidade"}
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  value={editQuantity}
                                  onChange={(e) => setEditQuantity(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      const qty = parseInt(editQuantity);
                                      if (isNaN(qty) || qty < 1) {
                                        toast({ variant: "destructive", title: "Erro", description: "Quantidade deve ser maior que zero" });
                                        return;
                                      }
                                      const kitParams = item.kitId && !item.productId && Object.keys(kitEditVariableQtys).length > 0
                                        ? kitEditVariableQtys
                                        : undefined;
                                      updateItemMutation.mutate({ itemId: item.id, quantity: qty, notes: editNotes || undefined, kitParameters: kitParams });
                                    }
                                  }}
                                  className="w-20 h-9 px-2 rounded-md bg-background border border-border text-sm font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  data-testid={`input-edit-quantity-${item.id}`}
                                />
                                <span className="text-xs text-muted-foreground">{item.product?.unit || "unid"}</span>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      const qty = parseInt(editQuantity);
                                      if (isNaN(qty) || qty < 1) {
                                        toast({ variant: "destructive", title: "Erro", description: "Quantidade deve ser maior que zero" });
                                        return;
                                      }
                                      const kitParams = item.kitId && !item.productId && Object.keys(kitEditVariableQtys).length > 0
                                        ? kitEditVariableQtys
                                        : undefined;
                                      updateItemMutation.mutate({ itemId: item.id, quantity: qty, notes: editNotes || undefined, kitParameters: kitParams });
                                    }}
                                    data-testid={`button-save-item-${item.id}`}
                                  >
                                    <Check className="h-4 w-4 text-chart-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => { setEditingItemId(null); setKitEditBom([]); setKitEditVariableQtys({}); }}
                                    data-testid={`button-cancel-edit-item-${item.id}`}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                              {/* Variable kit items */}
                              {item.kitId && !item.productId && (
                                kitEditLoading ? (
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground w-full">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando itens variáveis...
                                  </div>
                                ) : kitEditBom.length > 0 ? (
                                  <div className="w-full rounded-md border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">Itens variáveis</p>
                                    {kitEditBom.map((bom) => (
                                      <div key={bom.productId} className="flex items-center gap-2">
                                        <span className="text-xs flex-1 truncate">{bom.productName}</span>
                                        <input
                                          type="number"
                                          min="0"
                                          value={kitEditVariableQtys[bom.productId] ?? 0}
                                          onChange={(e) => setKitEditVariableQtys((prev) => ({ ...prev, [bom.productId]: parseInt(e.target.value) || 0 }))}
                                          className="w-16 h-7 px-2 rounded-md bg-background border border-border text-sm font-semibold text-center focus:outline-none focus:ring-1 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        />
                                        <span className="text-xs text-muted-foreground w-10 truncate">{bom.unit}</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : null
                              )}
                            </div>
                          ) : (
                            <>
                              <div>
                                <p className="text-[10px] uppercase tracking-tighter text-muted-foreground font-bold mb-1">Requisitado</p>
                                <p className="font-semibold text-base text-primary">
                                  {item.quantity} <span className="text-sm font-normal">{item.product?.unit || "unid"}</span>
                                </p>
                              </div>
                              {/* Aprovado only when not draft */}
                              {request.status !== "draft" && (
                                <div>
                                  <p className="text-[10px] uppercase tracking-tighter text-muted-foreground font-bold mb-1">Aprovado</p>
                                  <p className={`font-semibold text-base ${isApproved ? "text-chart-4" : isRejected ? "text-destructive" : "text-muted-foreground"}`}>
                                    {isApproved ? item.approvedQuantity : isRejected ? "—" : "—"}
                                    {isApproved && <span className="text-sm font-normal"> {item.product?.unit || "unid"}</span>}
                                  </p>
                                  {isApproved && item.approvedQuantity != null && item.approvedQuantity !== item.quantity && (
                                    <p className={`text-[10px] font-semibold mt-0.5 ${item.approvedQuantity < item.quantity ? "text-amber-500 dark:text-amber-400" : "text-primary"}`}>
                                      {item.approvedQuantity < item.quantity
                                        ? `−${item.quantity - item.approvedQuantity} do solicitado`
                                        : `+${item.approvedQuantity - item.quantity} do solicitado`}
                                    </p>
                                  )}
                                </div>
                              )}
                              {request.status !== "draft" && (
                                <StatusIcon className={`h-5 w-5 ${statusColor} shrink-0`} />
                              )}
                              {/* Action buttons inline (draft only) */}
                              {canEdit && (
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={async () => {
                                      setEditingItemId(item.id);
                                      setEditQuantity(String(item.quantity));
                                      setEditNotes(item.notes || "");
                                      setKitEditBom([]);
                                      setKitEditVariableQtys({});
                                      if (item.kitId && !item.productId) {
                                        setKitEditLoading(true);
                                        try {
                                          const res = await apiRequest("GET", `/api/kits/${item.kitId}/bom`);
                                          const bom: Array<{ productId: string; quantityFormula: string }> = await res.json();
                                          const varLines = bom.filter((l) => l.quantityFormula.trim() === '?');
                                          if (varLines.length > 0) {
                                            setKitEditBom(varLines.map((l) => ({
                                              productId: l.productId,
                                              productName: products.find((p) => p.id === l.productId)?.name ?? l.productId,
                                              unit: (products as any[]).find((p) => p.id === l.productId)?.unit ?? "unid",
                                            })));
                                            const qtys: Record<string, number> = {};
                                            varLines.forEach((l) => {
                                              qtys[l.productId] = ((item as any).kitParameters)?.[l.productId] ?? 0;
                                            });
                                            setKitEditVariableQtys(qtys);
                                          }
                                        } finally {
                                          setKitEditLoading(false);
                                        }
                                      }
                                    }}
                                    data-testid={`button-edit-item-${item.id}`}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setItemToDelete(item.id);
                                      setShowDeleteItemDialog(true);
                                    }}
                                    data-testid={`button-remove-item-${item.id}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* Rejection reason */}
                      {isRejected && item.rejectionReason && (
                        <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                          <div className="text-sm">
                            <p className="font-medium text-destructive">Motivo da rejeição:</p>
                            <p className="text-destructive/90 mt-1">{item.rejectionReason}</p>
                          </div>
                        </div>
                      )}

                      {/* Item notes */}
                      {item.notes && (
                        <div className="mt-3 p-3 bg-muted/50 rounded text-sm">
                          <p className="font-medium text-muted-foreground">Observações:</p>
                          <p className="mt-1" data-testid={`text-item-notes-${item.id}`}>{item.notes}</p>
                        </div>
                      )}

                      {/* Kit BOM expansion — real-time when editing */}
                      {item.kitId && !item.productId && (
                        <KitBomSummary
                          kitId={item.kitId}
                          quantity={
                            editingItemId === item.id
                              ? (parseInt(editQuantity) || item.quantity)
                              : item.quantity
                          }
                          kitParameters={
                            editingItemId === item.id && Object.keys(kitEditVariableQtys).length > 0
                              ? kitEditVariableQtys
                              : ((item as any).kitParameters as Record<string, number> | undefined)
                          }
                          products={products}
                        />
                      )}

                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Requisição</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta requisição? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} data-testid="button-confirm-delete">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Item */}
      <AddItemDialog
        open={showAddItem}
        onOpenChange={setShowAddItem}
        requestId={id!}
        products={products}
        kits={kits}
        existingItems={items.filter((i) => i.productId).map((i) => ({ productId: i.productId as string, quantity: i.quantity }))}
        productsLoading={productsLoading}
        kitsLoading={kitsLoading}
      />

      {/* Duplicate */}
      <DuplicateRequestDialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog} requestId={id!} currentArea={request.area} itemCount={items.length} />
      <RequestDialog open={showEditDialog} onOpenChange={setShowEditDialog} request={request as any} />

      {/* Delete Item Confirmation */}
      <AlertDialog open={showDeleteItemDialog} onOpenChange={setShowDeleteItemDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Item</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este item da requisição? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-item">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteItem} data-testid="button-confirm-delete-item">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Batch Confirmation */}
      <AlertDialog open={showDeleteBatchDialog} onOpenChange={setShowDeleteBatchDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Itens</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover {selectedItems.size} item(s) da requisição? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-batch">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBatch} data-testid="button-confirm-delete-batch">
              Remover {selectedItems.size}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
