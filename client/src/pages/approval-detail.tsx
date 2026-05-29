import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { EmptyState } from "@/components/empty-state";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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
import { ArrowLeft, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
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
  rejectionReason?: string;
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

type ItemApproval = {
  itemId: string;
  status: "pending" | "approved" | "rejected";
  approvedQuantity: number;
  rejectionReason: string;
};

const StatusBadge = ({ status }: { status: string }) => {
  const variants: Record<string, { label: string; className: string }> = {
    pending: { label: "Pendente", className: "bg-chart-3 text-white" },
    approved: { label: "Aprovado", className: "bg-chart-4 text-white" },
    rejected: { label: "Rejeitado", className: "bg-destructive text-destructive-foreground" },
  };

  const config = variants[status] || { label: status, className: "bg-muted text-muted-foreground" };
  return <Badge className={config.className}>{config.label}</Badge>;
};

export default function ApprovalDetail() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [itemApprovals, setItemApprovals] = useState<Map<string, ItemApproval>>(new Map());
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
      toast({
        title: "Aprovação completa",
        description: "Todos os itens foram aprovados com sucesso",
      });
      navigate("/approvals");
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível aprovar a requisição",
      });
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
      toast({
        title: "Requisição rejeitada",
        description: "Toda a requisição foi rejeitada",
      });
      navigate("/approvals");
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível rejeitar a requisição",
      });
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
      toast({
        title: "Processado com sucesso",
        description: "Aprovação parcial realizada",
      });
      navigate("/approvals");
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível processar a requisição",
      });
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
      status: "approved",
      approvedQuantity: 0,
      rejectionReason: "",
    };
    newApprovals.set(itemId, { ...current, [field]: value });
    setItemApprovals(newApprovals);
  };

  const handleSelectAll = () => {
    if (selectedItems.size === items.length) {
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
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Selecione pelo menos um item",
      });
      return;
    }
    approvePartialMutation.mutate();
  };

  const isLoading = loadingRequest || loadingItems;
  const canApprove = request?.status === "pending_approval";

  if (isLoading) {
    return (
      <PageLoading message="Carregando requisição..." />
    );
  }

  if (!request) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Requisição não encontrada"
        description="A requisição solicitada não existe"
        action={{
          label: "Voltar para aprovações",
          onClick: () => navigate("/approvals"),
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          onClick={() => navigate("/approvals")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <CardTitle>Detalhes da Requisição</CardTitle>
              <StatusBadge status={request.status} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-muted-foreground">Evento</span>
              <p className="font-semibold">{request.event?.name}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Cliente</span>
              <p className="font-semibold">{request.event?.client}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Área</span>
              <p className="font-semibold">{request.area}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Solicitante</span>
              <p className="font-semibold">{request.requestedByUser?.name || "Usuário não encontrado"}</p>
            </div>
            {request.submittedAt && (
              <div>
                <span className="text-sm text-muted-foreground">Data de Envio</span>
                <p className="font-semibold">
                  {format(new Date(request.submittedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
            )}
            {request.approvedBy && (
              <div>
                <span className="text-sm text-muted-foreground">Aprovado por</span>
                <p className="font-semibold">{request.approvedBy}</p>
              </div>
            )}
          </div>

          {request.rejectionReason && (
            <div className="bg-destructive/10 p-4 rounded-md">
              <p className="text-sm font-medium text-destructive mb-1">Motivo da Rejeição:</p>
              <p className="text-sm">{request.rejectionReason}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Itens da Requisição ({items.length})</CardTitle>
            {canApprove && items.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                data-testid="button-select-all"
              >
                {selectedItems.size === items.length ? "Desmarcar Todos" : "Selecionar Todos"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum item nesta requisição
            </p>
          ) : (
            <div className="space-y-4">
              {items.map((item: RequestItem) => {
                const isSelected = selectedItems.has(item.id);
                const approval = itemApprovals.get(item.id);
                const isApproved = approval?.status === "approved";
                const isRejected = approval?.status === "rejected";

                return (
                  <div
                    key={item.id}
                    className={`border rounded-lg p-4 ${
                      isSelected ? "border-primary bg-primary/5" : ""
                    }`}
                    data-testid={`item-${item.id}`}
                  >
                    <div className="flex items-start gap-4">
                      {canApprove && (
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleItemToggle(item.id, item)}
                          data-testid={`checkbox-item-${item.id}`}
                        />
                      )}

                      <div className="flex-1 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold">
                              {item.product?.name || item.kit?.name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {item.product?.sku} • 
                              {!canApprove && item.approvalStatus === "approved" ? (
                                <span className="font-medium text-chart-4">
                                  {" "}Aprovado: {item.approvedQuantity} de {item.quantity} {item.product?.unit}
                                </span>
                              ) : !canApprove && item.approvalStatus === "rejected" ? (
                                <span className="font-medium text-destructive">
                                  {" "}Rejeitado: {item.quantity} {item.product?.unit}
                                </span>
                              ) : (
                                <span> Quantidade: {item.quantity} {item.product?.unit}</span>
                              )}
                            </p>
                          </div>
                          {!canApprove && <StatusBadge status={item.approvalStatus} />}
                        </div>

                        {isSelected && canApprove && (
                          <div className="space-y-3 pt-3 border-t">
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant={isApproved ? "default" : "outline"}
                                onClick={() =>
                                  handleApprovalChange(item.id, "status", "approved")
                                }
                                data-testid={`button-approve-${item.id}`}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Aprovar
                              </Button>
                              <Button
                                size="sm"
                                variant={isRejected ? "destructive" : "outline"}
                                onClick={() =>
                                  handleApprovalChange(item.id, "status", "rejected")
                                }
                                data-testid={`button-reject-${item.id}`}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Rejeitar
                              </Button>
                            </div>

                            {isApproved && (
                              <div className="flex items-center gap-2">
                                <label className="text-sm font-medium w-40">
                                  Quantidade Aprovada:
                                </label>
                                <Input
                                  type="number"
                                  min="0"
                                  max={item.quantity}
                                  value={approval?.approvedQuantity ?? item.quantity}
                                  onChange={(e) => {
                                    const val = e.target.value === '' ? 0 : Number(e.target.value);
                                    handleApprovalChange(
                                      item.id,
                                      "approvedQuantity",
                                      val
                                    );
                                  }}
                                  className="w-32"
                                  data-testid={`input-quantity-${item.id}`}
                                />
                                <span className="text-sm text-muted-foreground">
                                  de {item.quantity}
                                </span>
                              </div>
                            )}

                            {isRejected && (
                              <div className="space-y-2">
                                <label className="text-sm font-medium">
                                  Motivo da Rejeição:
                                </label>
                                <Textarea
                                  value={approval?.rejectionReason || ""}
                                  onChange={(e) =>
                                    handleApprovalChange(
                                      item.id,
                                      "rejectionReason",
                                      e.target.value
                                    )
                                  }
                                  placeholder="Explique o motivo..."
                                  className="min-h-20"
                                  data-testid={`textarea-reason-${item.id}`}
                                />
                              </div>
                            )}
                          </div>
                        )}

                        {!canApprove && item.rejectionReason && (
                          <div className="bg-destructive/10 p-3 rounded text-sm">
                            <p className="font-medium text-destructive mb-1">
                              Motivo da Rejeição:
                            </p>
                            <p>{item.rejectionReason}</p>
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

      {canApprove && items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Comentários</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Adicione comentários sobre a aprovação (opcional)..."
              className="min-h-24"
              data-testid="textarea-comments"
            />
          </CardContent>
        </Card>
      )}

      {canApprove && items.length > 0 && (
        <div className="flex gap-3 justify-end">
          <Button
            variant="destructive"
            onClick={() => setShowRejectAllDialog(true)}
            data-testid="button-reject-all"
          >
            <XCircle className="h-4 w-4 mr-2" />
            Rejeitar Tudo
          </Button>
          <Button
            variant="outline"
            onClick={handleSubmitPartial}
            disabled={itemApprovals.size === 0 || approvePartialMutation.isPending}
            data-testid="button-approve-selected"
          >
            Processar Selecionados ({itemApprovals.size})
          </Button>
          <Button
            onClick={() => setShowApproveAllDialog(true)}
            data-testid="button-approve-all"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Aprovar Tudo
          </Button>
        </div>
      )}

      {/* Approve All Dialog */}
      <AlertDialog open={showApproveAllDialog} onOpenChange={setShowApproveAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aprovar Todos os Itens?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os {items.length} itens serão aprovados com as quantidades solicitadas.
              Esta ação não pode ser desfeita.
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

      {/* Reject All Dialog */}
      <AlertDialog open={showRejectAllDialog} onOpenChange={setShowRejectAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rejeitar Toda a Requisição?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os {items.length} itens serão rejeitados. Por favor, informe o motivo da
              rejeição.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Motivo da rejeição completa..."
              className="min-h-24"
              data-testid="textarea-reject-reason"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!rejectReason.trim()) {
                  toast({
                    variant: "destructive",
                    title: "Erro",
                    description: "Informe o motivo da rejeição",
                  });
                  return;
                }
                rejectAllMutation.mutate();
                setShowRejectAllDialog(false);
              }}
              className="bg-destructive text-destructive-foreground"
            >
              Confirmar Rejeição
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
