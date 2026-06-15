import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, Trash2, Send, AlertCircle, Copy, Save, ClipboardList, Package, CheckCircle2, XCircle, Clock, Pencil, Check, X, Boxes } from "lucide-react";
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

export default function RequestDetails() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [showAddItem, setShowAddItem] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
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
    mutationFn: async ({ itemId, quantity, notes }: { itemId: string; quantity: number; notes?: string }) => {
      return apiRequest("PATCH", `/api/request-items/${itemId}`, { quantity, notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests", id, "items"] });
      toast({ title: "Item atualizado", description: "Quantidade e observações atualizadas" });
      setEditingItemId(null);
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
                {items.map((item) => {
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
                            <div className="flex items-center gap-3 flex-wrap">
                              <div className="flex items-center gap-2">
                                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Quantidade</label>
                                <input
                                  type="number"
                                  min="1"
                                  value={editQuantity}
                                  onChange={(e) => setEditQuantity(e.target.value)}
                                  className="w-20 h-9 px-2 rounded-md bg-background border border-border text-sm font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  data-testid={`input-edit-quantity-${item.id}`}
                                />
                                <span className="text-xs text-muted-foreground">{item.product?.unit || "unid"}</span>
                              </div>
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
                                    updateItemMutation.mutate({ itemId: item.id, quantity: qty, notes: editNotes || undefined });
                                  }}
                                  data-testid={`button-save-item-${item.id}`}
                                >
                                  <Check className="h-4 w-4 text-chart-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setEditingItemId(null)}
                                  data-testid={`button-cancel-edit-item-${item.id}`}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
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
                                    onClick={() => {
                                      setEditingItemId(item.id);
                                      setEditQuantity(String(item.quantity));
                                      setEditNotes(item.notes || "");
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
