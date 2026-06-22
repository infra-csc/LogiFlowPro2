import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Package,
  Boxes,
  Plus,
  Minus,
} from "lucide-react";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type RequestItem = {
  id: string;
  requestId: string;
  productId: string;
  quantity: number;
  approvalStatus: string;
  approvedQuantity?: number;
  rejectionReason?: string;
  kitId?: string;
  kitParameters?: any;
  notes?: string;
  product?: { id: string; name: string; sku: string; unit: string };
  kit?: { id: string; name: string };
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
  rejectionReason?: string;
  notes?: string;
  createdAt: string;
  event?: { id: string; name: string; client: string; eventDate: string };
  requestedByUser?: { id: string; name: string; username: string };
};

type ItemApproval = {
  itemId: string;
  status: "pending" | "approved" | "rejected";
  approvedQuantity: number;
  rejectionReason: string;
};

function fmtDate(iso: string, includeTime = false) {
  return format(
    new Date(iso),
    includeTime ? "dd/MM/yyyy 'às' HH:mm" : "dd/MM/yyyy",
    { locale: ptBR }
  );
}

function MetaCell({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </p>
      <p className="text-sm font-medium text-foreground truncate">{value || "—"}</p>
    </div>
  );
}

export default function ApprovalDetail() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [itemApprovals, setItemApprovals] = useState<Map<string, ItemApproval>>(
    new Map()
  );
  const [comments, setComments] = useState("");
  const [showApproveAllDialog, setShowApproveAllDialog] = useState(false);
  const [showRejectAllDialog, setShowRejectAllDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const { data: request, isLoading: loadingRequest } = useQuery<MaterialRequest>({
    queryKey: ["/api/requests", id],
  });

  const { data: items = [], isLoading: loadingItems } = useQuery<RequestItem[]>({
    queryKey: ["/api/requests", id, "items"],
  });

  const approveAllMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/requests/${id}/approve-all`, {
        comments,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      toast({ title: "Aprovação completa", description: "Todos os itens foram aprovados com sucesso." });
      navigate("/approvals");
    },
    onError: () => {
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível aprovar a requisição." });
    },
  });

  const rejectAllMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/requests/${id}/reject-all`, {
        reason: rejectReason,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      toast({ title: "Requisição rejeitada", description: "Toda a requisição foi rejeitada." });
      navigate("/approvals");
    },
    onError: () => {
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível rejeitar a requisição." });
    },
  });

  const approvePartialMutation = useMutation({
    mutationFn: async () => {
      const approvals = Array.from(itemApprovals.values());
      const response = await apiRequest("POST", `/api/requests/${id}/approve-partial`, {
        itemApprovals: approvals,
        comments,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      toast({ title: "Processado com sucesso", description: "Aprovação parcial realizada." });
      navigate("/approvals");
    },
    onError: () => {
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível processar a requisição." });
    },
  });

  const handleItemToggle = (itemId: string, item: RequestItem) => {
    const newSelected = new Set(selectedItems);
    const newApprovals = new Map(itemApprovals);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
      newApprovals.delete(itemId);
    } else {
      newSelected.add(itemId);
      newApprovals.set(itemId, {
        itemId,
        status: "approved",
        approvedQuantity: item.quantity,
        rejectionReason: "",
      });
    }
    setSelectedItems(newSelected);
    setItemApprovals(newApprovals);
  };

  const handleApprovalChange = (itemId: string, field: string, value: any) => {
    const newApprovals = new Map(itemApprovals);
    const current = newApprovals.get(itemId) || {
      itemId,
      status: "approved" as const,
      approvedQuantity: 0,
      rejectionReason: "",
    };
    newApprovals.set(itemId, { ...current, [field]: value });
    setItemApprovals(newApprovals);
  };

  const handleSelectAll = () => {
    const allSelected = selectedItems.size === items.length && items.length > 0;
    if (allSelected) {
      setSelectedItems(new Set());
      setItemApprovals(new Map());
    } else {
      const newSelected = new Set(items.map((i: RequestItem) => i.id));
      const newApprovals = new Map<string, ItemApproval>();
      items.forEach((item: RequestItem) => {
        newApprovals.set(item.id, {
          itemId: item.id,
          status: "approved",
          approvedQuantity: item.quantity,
          rejectionReason: "",
        });
      });
      setSelectedItems(newSelected);
      setItemApprovals(newApprovals);
    }
  };

  const handleSubmitPartial = () => {
    if (itemApprovals.size === 0) {
      toast({ variant: "destructive", title: "Erro", description: "Selecione pelo menos um item." });
      return;
    }
    approvePartialMutation.mutate();
  };

  const isLoading = loadingRequest || loadingItems;
  const canApprove = request?.status === "pending_approval";
  const allSelected = items.length > 0 && selectedItems.size === items.length;
  const isPending =
    approveAllMutation.isPending ||
    rejectAllMutation.isPending ||
    approvePartialMutation.isPending;

  if (isLoading) return <PageLoading message="Carregando requisição..." />;

  if (!request) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Requisição não encontrada"
        description="A requisição solicitada não existe."
        action={{ label: "Voltar para aprovações", onClick: () => navigate("/approvals") }}
      />
    );
  }

  // Compute item summaries for the read-only view
  const approvedCount = items.filter((i) => i.approvalStatus === "approved").length;
  const rejectedCount = items.filter((i) => i.approvalStatus === "rejected").length;

  return (
    <div className="space-y-5">
      {/* ── Back button ─────────────────────────────────────────── */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate("/approvals")}
        data-testid="button-back"
        className="-ml-2"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Aprovações
      </Button>

      {/* ── Page header ─────────────────────────────────────────── */}
      <PageHeader
        title="Aprovação de Requisição"
        description={
          [request.event?.name, request.area].filter(Boolean).join(" · ") || "—"
        }
      >
        <StatusBadge status={request.status} />
      </PageHeader>

      {/* ── Resumo operacional ───────────────────────────────────── */}
      <div className="rounded-lg border border-border/60 bg-card">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-px bg-border/40">
          {[
            { label: "Evento", value: request.event?.name },
            { label: "Cliente", value: request.event?.client },
            { label: "Área", value: request.area },
            { label: "Solicitante", value: request.requestedByUser?.name },
            request.submittedAt
              ? { label: "Enviado em", value: fmtDate(request.submittedAt, true) }
              : null,
            request.event?.eventDate
              ? { label: "Data do Evento", value: fmtDate(request.event.eventDate) }
              : null,
            !canApprove && request.approvedBy
              ? { label: "Processado por", value: request.approvedBy }
              : null,
            !canApprove && request.approvedAt
              ? { label: "Processado em", value: fmtDate(request.approvedAt, true) }
              : null,
            { label: "Total de Itens", value: String(items.length) },
            !canApprove
              ? { label: "Aprovados", value: String(approvedCount) }
              : null,
            !canApprove
              ? { label: "Rejeitados", value: String(rejectedCount) }
              : null,
          ]
            .filter(Boolean)
            .map((cell) => (
              <div key={cell!.label} className="bg-card px-4 py-3">
                <MetaCell label={cell!.label} value={cell!.value} />
              </div>
            ))}
        </div>
      </div>

      {/* Rejection reason if processed */}
      {request.rejectionReason && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3">
          <p className="text-sm font-medium text-destructive mb-1">Motivo da Rejeição Global:</p>
          <p className="text-sm">{request.rejectionReason}</p>
        </div>
      )}

      {/* ── Itens da Requisição ──────────────────────────────────── */}
      <Card className="border-border/60">
        <CardContent className="p-4">
          {/* Section header + select all */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="font-semibold text-base">
              Itens da Requisição{" "}
              <span className="text-muted-foreground font-normal text-sm">
                ({items.length})
              </span>
            </span>
            {canApprove && items.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                data-testid="button-select-all"
              >
                {allSelected
                  ? `Limpar seleção (${items.length})`
                  : `Selecionar todos (${items.length})`}
              </Button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">Nenhum item nesta requisição.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item: RequestItem) => {
                const isSelected = selectedItems.has(item.id);
                const approval = itemApprovals.get(item.id);
                const isApproved = approval?.status === "approved";
                const isRejected = approval?.status === "rejected";
                const isPartial =
                  isApproved &&
                  approval?.approvedQuantity !== undefined &&
                  approval.approvedQuantity < item.quantity;
                const productName = item.product?.name || item.kit?.name || "—";
                const sku = item.product?.sku;
                const unit = item.product?.unit || "";

                return (
                  <div
                    key={item.id}
                    className={`rounded-lg border px-4 py-3 transition-colors ${
                      isSelected
                        ? "border-primary/50 bg-primary/5"
                        : "border-border/60 bg-card"
                    }`}
                    data-testid={`item-${item.id}`}
                  >
                    {/* Item row */}
                    <div className="flex items-start gap-3">
                      {canApprove && (
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleItemToggle(item.id, item)}
                          data-testid={`checkbox-item-${item.id}`}
                          className="mt-0.5 shrink-0"
                          aria-label={`Selecionar ${productName}`}
                        />
                      )}

                      <div className="flex-1 min-w-0">
                        {/* Product info */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {item.kit ? (
                                <Boxes className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              ) : (
                                <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              )}
                              <span className="font-medium text-sm text-foreground">
                                {productName}
                              </span>
                              {sku && (
                                <span className="font-mono text-[11px] text-muted-foreground">
                                  {sku}
                                </span>
                              )}
                            </div>

                            {/* Quantity display */}
                            {!canApprove ? (
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                {item.approvalStatus === "approved" ? (
                                  <>
                                    <span className="text-xs text-muted-foreground">
                                      Aprovado:
                                    </span>
                                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                      {item.approvedQuantity}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      de {item.quantity} {unit}
                                    </span>
                                    {item.approvedQuantity !== undefined &&
                                      item.approvedQuantity < item.quantity && (
                                        <Badge
                                          variant="outline"
                                          className="text-[10px] border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10"
                                        >
                                          Aprovação parcial
                                        </Badge>
                                      )}
                                  </>
                                ) : item.approvalStatus === "rejected" ? (
                                  <>
                                    <span className="text-xs text-muted-foreground">
                                      Rejeitado:
                                    </span>
                                    <span className="text-xs font-semibold text-destructive">
                                      {item.quantity} {unit}
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    {item.quantity} {unit}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Solicitado:{" "}
                                <span className="font-medium text-foreground">
                                  {item.quantity} {unit}
                                </span>
                              </p>
                            )}
                          </div>

                          {!canApprove && <StatusBadge status={item.approvalStatus} />}
                        </div>

                        {/* Controls for selected item (can-approve mode) */}
                        {isSelected && canApprove && (
                          <div className="mt-2.5 pt-2.5 border-t border-border/40 space-y-2">
                            {/* Approve / Reject toggle */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <Button
                                size="sm"
                                variant={isApproved ? "default" : "outline"}
                                onClick={() => handleApprovalChange(item.id, "status", "approved")}
                                data-testid={`button-approve-${item.id}`}
                                aria-pressed={isApproved}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                Aprovar
                              </Button>
                              <Button
                                size="sm"
                                variant={isRejected ? "destructive" : "outline"}
                                onClick={() => handleApprovalChange(item.id, "status", "rejected")}
                                data-testid={`button-reject-${item.id}`}
                                aria-pressed={isRejected}
                              >
                                <XCircle className="h-3.5 w-3.5 mr-1" />
                                Rejeitar
                              </Button>
                            </div>

                            {/* Approved quantity */}
                            {isApproved && (
                              <div className="flex items-center gap-2 flex-wrap">
                                <Label className="text-xs font-medium whitespace-nowrap">
                                  Qtd. aprovada
                                </Label>
                                {(() => {
                                  const current = approval?.approvedQuantity ?? item.quantity;
                                  const setQty = (v: number) => {
                                    const clamped = Math.max(0, Math.min(item.quantity, v));
                                    handleApprovalChange(item.id, "approvedQuantity", clamped);
                                  };
                                  return (
                                    <div className="flex items-center h-8 rounded-md border border-border bg-background overflow-hidden">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 rounded-none no-default-hover-elevate hover-elevate active-elevate-2"
                                        disabled={current <= 0}
                                        onClick={() => setQty(current - 1)}
                                        data-testid={`button-decrease-quantity-${item.id}`}
                                        aria-label="Diminuir quantidade"
                                      >
                                        <Minus className="h-3.5 w-3.5" />
                                      </Button>
                                      <input
                                        type="number"
                                        min="0"
                                        max={item.quantity}
                                        value={current}
                                        onChange={(e) => {
                                          const val =
                                            e.target.value === "" ? 0 : Number(e.target.value);
                                          setQty(val);
                                        }}
                                        className="w-12 h-8 bg-transparent text-center text-sm font-semibold text-foreground focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        data-testid={`input-quantity-${item.id}`}
                                        aria-label="Quantidade aprovada"
                                      />
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 rounded-none no-default-hover-elevate hover-elevate active-elevate-2"
                                        disabled={current >= item.quantity}
                                        onClick={() => setQty(current + 1)}
                                        data-testid={`button-increase-quantity-${item.id}`}
                                        aria-label="Aumentar quantidade"
                                      >
                                        <Plus className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  );
                                })()}
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  de {item.quantity} {unit}
                                </span>
                                {isPartial && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10"
                                  >
                                    Aprovação parcial
                                  </Badge>
                                )}
                              </div>
                            )}

                            {/* Rejection reason */}
                            {isRejected && (
                              <div className="space-y-1">
                                <Label className="text-xs font-medium">
                                  Motivo da rejeição
                                </Label>
                                <Textarea
                                  value={approval?.rejectionReason || ""}
                                  onChange={(e) =>
                                    handleApprovalChange(
                                      item.id,
                                      "rejectionReason",
                                      e.target.value
                                    )
                                  }
                                  placeholder="Explique o motivo da rejeição deste item..."
                                  className="min-h-14 text-sm"
                                  data-testid={`textarea-reason-${item.id}`}
                                />
                              </div>
                            )}
                          </div>
                        )}

                        {/* Read-only rejection reason */}
                        {!canApprove && item.rejectionReason && (
                          <div className="mt-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
                            <p className="text-xs font-medium text-destructive">
                              Motivo da rejeição:
                            </p>
                            <p className="text-xs mt-0.5">{item.rejectionReason}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Comments (only for pending) ──────────────────────────── */}
      {canApprove && items.length > 0 && (
        <Card className="border-border/60">
          <CardContent className="p-4 space-y-2">
            <Label htmlFor="comments" className="font-semibold text-sm">
              Comentário
            </Label>
            <Textarea
              id="comments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Adicione um comentário para justificar a decisão (opcional)..."
              className="min-h-16 text-sm"
              data-testid="textarea-comments"
            />
          </CardContent>
        </Card>
      )}

      {/* ── Sticky action bar ────────────────────────────────────── */}
      {canApprove && items.length > 0 && (
        <div
          className="sticky bottom-0 z-50 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 px-4 py-3 rounded-lg border border-border/60 bg-card/90 backdrop-blur-sm"
          data-testid="action-bar"
        >
          {/* Summary */}
          <div className="flex-1 text-sm text-muted-foreground min-w-0">
            {selectedItems.size > 0 ? (
              <span>
                <span className="font-semibold text-foreground">{selectedItems.size}</span>{" "}
                {selectedItems.size === 1 ? "item selecionado" : "itens selecionados"}{" "}
                &middot; Total: {items.length}
              </span>
            ) : (
              <span>Total: {items.length} {items.length === 1 ? "item" : "itens"}</span>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 flex-wrap sm:flex-nowrap">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowRejectAllDialog(true)}
              disabled={isPending}
              data-testid="button-reject-all"
              className="flex-1 sm:flex-none"
            >
              <XCircle className="h-4 w-4 mr-1.5" />
              Rejeitar Tudo
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSubmitPartial}
              disabled={itemApprovals.size === 0 || isPending}
              data-testid="button-approve-selected"
              className="flex-1 sm:flex-none"
            >
              Processar Selecionados ({itemApprovals.size})
            </Button>
            <Button
              size="sm"
              onClick={() => setShowApproveAllDialog(true)}
              disabled={isPending}
              data-testid="button-approve-all"
              className="flex-1 sm:flex-none"
            >
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              Aprovar Tudo
            </Button>
          </div>
        </div>
      )}

      {/* ── Approve All Dialog ───────────────────────────────────── */}
      <AlertDialog open={showApproveAllDialog} onOpenChange={setShowApproveAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aprovar todos os itens?</AlertDialogTitle>
            <AlertDialogDescription>
              Os {items.length} itens serão aprovados com as quantidades solicitadas. Esta ação
              não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                approveAllMutation.mutate();
                setShowApproveAllDialog(false);
              }}
            >
              Confirmar Aprovação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Reject All Dialog ────────────────────────────────────── */}
      <AlertDialog open={showRejectAllDialog} onOpenChange={setShowRejectAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rejeitar toda a requisição?</AlertDialogTitle>
            <AlertDialogDescription>
              Os {items.length} itens serão rejeitados. Informe o motivo da rejeição abaixo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-3">
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Motivo da rejeição completa..."
              className="min-h-20 text-sm"
              data-testid="textarea-reject-reason"
              aria-label="Motivo da rejeição"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => {
                if (!rejectReason.trim()) {
                  toast({
                    variant: "destructive",
                    title: "Erro",
                    description: "Informe o motivo da rejeição.",
                  });
                  return;
                }
                rejectAllMutation.mutate();
                setShowRejectAllDialog(false);
              }}
            >
              Confirmar Rejeição
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
