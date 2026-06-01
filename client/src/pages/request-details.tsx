import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, Trash2, Send, Calendar, AlertCircle, Copy, Save, ClipboardList, Package } from "lucide-react";
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
import { StatusBadge as SharedStatusBadge } from "@/components/status-badge";
import type { Event } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { EmptyState } from "@/components/empty-state";
import { PageSection } from "@/components/page-section";
import { DataCard } from "@/components/data-card";
import { ActionBar } from "@/components/action-bar";

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
      toast({ title: "Requisicao excluida", description: "A requisicao foi excluida com sucesso" });
      navigate("/requests");
    },
    onError: () => {
      toast({ variant: "destructive", title: "Erro ao excluir", description: "Nao foi possivel excluir a requisicao" });
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
      queryClient.invalidateQueries({ queryKey: ["/api/requests", id] });
      toast({ title: "Enviado para aprovacao", description: "A requisicao foi submetida para aprovacao" });
    },
    onError: (error: any) => {
      let description = "Nao foi possivel submeter a requisicao";
      if (error?.windowStart && error?.windowEnd) {
        const start = new Date(error.windowStart);
        const end = new Date(error.windowEnd);
        description = `${error.error}\n\nPeriodo permitido: ${start.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })} ate ${end.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}`;
      } else if (error?.error) {
        description = error.error;
      }
      toast({ variant: "destructive", title: "Erro ao submeter", description });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      await apiRequest("DELETE", `/api/request-items/${itemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests", id, "items"] });
      toast({ title: "Item removido", description: "O item foi removido da requisicao" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Erro ao remover", description: "Nao foi possivel remover o item" });
    },
  });

  const updateNotesMutation = useMutation({
    mutationFn: async (notesValue: string) => {
      return apiRequest("PATCH", `/api/requests/${id}`, { notes: notesValue || null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests", id] });
      toast({ title: "Observacoes atualizadas", description: "As observacoes foram salvas com sucesso" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Erro ao salvar", description: "Nao foi possivel salvar as observacoes" });
    },
  });

  useEffect(() => {
    if (request) {
      setNotes(request.notes || "");
    }
  }, [request]);

  if (isLoading) {
    return <PageLoading message="Carregando requisicao..." />;
  }

  if (!request) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Requisicao nao encontrada"
        description="A requisicao solicitada nao existe ou voce nao tem acesso."
      />
    );
  }

  const isOwner = user && request.requestedBy === user.id;
  const isAdmin = user && (user as any).isAdmin === true;
  const canEdit = request.status === "draft" && (isOwner || isAdmin);

  const handleDelete = () => {
    deleteMutation.mutate();
    setShowDeleteDialog(false);
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
          {canEdit && (
            <>
              <Button variant="outline" size="sm" onClick={() => setShowDeleteDialog(true)} data-testid="button-delete-request">
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </Button>
              <Button size="sm" onClick={handleSubmit} disabled={items.length === 0} data-testid="button-submit-approval">
                <Send className="h-4 w-4 mr-2" />
                Enviar
              </Button>
            </>
          )}
        </ActionBar>
      </PageHeader>

      {/* Status badge abaixo do header */}
      <div className="flex items-center gap-2">
        <SharedStatusBadge status={request.status} />
        <span className="text-xs text-muted-foreground font-mono">{request.id.slice(0, 8)}</span>
      </div>

      {/* Alerta de janela */}
      {canEdit && requestWindowInfo && !requestWindowInfo.isWithinWindow && (
        <Alert variant="destructive" data-testid="alert-requisition-window">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5" />
            <AlertDescription className="text-sm">
              {requestWindowInfo.isBeforeWindow && (
                <span>
                  <strong>Atencao:</strong> Requisicoes para este evento ainda nao estao permitidas.
                  <br />
                  <span className="text-xs">Periodo: {requestWindowInfo.start} ate {requestWindowInfo.end}</span>
                </span>
              )}
              {requestWindowInfo.isAfterWindow && (
                <span>
                  <strong>Atencao:</strong> O periodo de requisicao para este evento ja foi encerrado.
                  <br />
                  <span className="text-xs">Periodo permitido era: {requestWindowInfo.start} ate {requestWindowInfo.end}</span>
                </span>
              )}
            </AlertDescription>
          </div>
        </Alert>
      )}

      {/* Resumo em DataCards */}
      <PageSection>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <DataCard title="Solicitante" icon={Package} meta={[{ label: "Nome", value: request.requestedByUser?.name || "Usuario" }]} />
          <DataCard title="Status" icon={Calendar} meta={[{ label: "Atual", value: "" }]}>
            <SharedStatusBadge status={request.status} />
          </DataCard>
          <DataCard title="Criacao" icon={Calendar} meta={[{ label: "Data", value: formatDate(request.createdAt) }]} />
          <DataCard title="Evento" icon={Package} meta={[{ label: "Nome", value: request.event?.name || "—" }]} />
          {request.submittedAt && (
            <DataCard title="Submissao" icon={Calendar} meta={[{ label: "Data", value: formatDate(request.submittedAt) }]} />
          )}
          {request.approvedAt && (
            <DataCard title={request.status === "rejected" ? "Rejeicao" : "Aprovacao"} icon={Calendar} meta={[{ label: "Data", value: formatDate(request.approvedAt) }]} />
          )}
        </div>
      </PageSection>

      {/* Observacoes */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="font-semibold text-base">Observacoes</div>
          <div className="mt-3 pt-3 border-t border-border/40">
            {canEdit ? (
              <div className="space-y-3">
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Adicione observacoes sobre a requisicao (opcional)"
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
                {request.notes || "Nenhuma observacao"}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Materiais */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold text-base">
              Materiais Requisitados
              {items.length > 0 && (
                <span className="ml-2 text-sm text-muted-foreground">({items.length} item{items.length > 1 ? "s" : ""})</span>
              )}
            </div>
            {canEdit && (
              <Button size="sm" onClick={() => setShowAddItem(true)} data-testid="button-add-item">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
            )}
          </div>
          <div className="mt-3 pt-3 border-t border-border/40">
            {items.length === 0 ? (
              <EmptyState
                icon={Package}
                title="Nenhum material adicionado"
                description={canEdit ? "Clique em \"Adicionar\" para incluir produtos ou kits." : "Esta requisicao nao possui materiais."}
                action={
                  canEdit
                    ? { label: "Adicionar Material", onClick: () => setShowAddItem(true) }
                    : undefined
                }
              />
            ) : (
              <div className="space-y-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="border rounded-lg p-3 hover-elevate"
                    data-testid={`item-${item.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">
                            {item.kit ? item.kit.name : item.product?.name}
                          </span>
                          {!canEdit && item.approvalStatus && (
                            <SharedStatusBadge status={item.approvalStatus} />
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {item.kit ? "Kit" : item.product?.sku} •
                          {item.approvalStatus === "approved" ? (
                            <span className="font-medium text-chart-4">
                              {" "}Aprovado: {item.approvedQuantity} de {item.quantity} {item.product?.unit || "unid"}
                            </span>
                          ) : item.approvalStatus === "rejected" ? (
                            <span className="font-medium text-destructive">
                              {" "}Rejeitado: {item.quantity} {item.product?.unit || "unid"}
                            </span>
                          ) : (
                            <span> Quantidade: {item.quantity} {item.product?.unit || "unid"}</span>
                          )}
                        </div>
                        {item.approvalStatus === "rejected" && item.rejectionReason && (
                          <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded text-sm">
                            <p className="font-medium text-destructive">Motivo da rejeicao:</p>
                            <p className="text-destructive/90 mt-1">{item.rejectionReason}</p>
                          </div>
                        )}
                        {item.notes && (
                          <div className="mt-2 p-2 bg-muted/50 rounded text-sm">
                            <p className="font-medium text-muted-foreground">Observacoes:</p>
                            <p className="mt-1" data-testid={`text-item-notes-${item.id}`}>{item.notes}</p>
                          </div>
                        )}
                      </div>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteItemMutation.mutate(item.id);
                          }}
                          data-testid={`button-remove-item-${item.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Requisicao</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta requisicao? Esta acao nao pode ser desfeita.
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
      <AddItemDialog open={showAddItem} onOpenChange={setShowAddItem} requestId={id!} />

      {/* Duplicate */}
      <DuplicateRequestDialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog} requestId={id!} currentArea={request.area} itemCount={items.length} />
    </div>
  );
}
