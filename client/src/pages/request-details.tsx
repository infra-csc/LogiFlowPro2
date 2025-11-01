import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, Trash2, Send, Calendar, AlertCircle, Copy, Save } from "lucide-react";
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
    if (!event?.requestWindowStart || !event?.requestWindowEnd) {
      return null;
    }

    const now = new Date();
    const start = new Date(event.requestWindowStart);
    const end = new Date(event.requestWindowEnd);

    const formatDate = (date: Date) => {
      return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    const isBeforeWindow = now < start;
    const isAfterWindow = now > end;
    const isWithinWindow = !isBeforeWindow && !isAfterWindow;

    return {
      start: formatDate(start),
      end: formatDate(end),
      isBeforeWindow,
      isAfterWindow,
      isWithinWindow
    };
  }, [event]);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/requests/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Requisição excluída",
        description: "A requisição foi excluída com sucesso",
      });
      navigate("/requests");
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Erro ao excluir",
        description: "Não foi possível excluir a requisição",
      });
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
      toast({
        title: "Enviado para aprovação",
        description: "A requisição foi submetida para aprovação",
      });
    },
    onError: (error: any) => {
      let description = "Não foi possível submeter a requisição";
      
      // Check if error contains window information
      if (error?.windowStart && error?.windowEnd) {
        const start = new Date(error.windowStart);
        const end = new Date(error.windowEnd);
        description = `${error.error}\n\nPeríodo permitido: ${start.toLocaleString('pt-BR', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })} até ${end.toLocaleString('pt-BR', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}`;
      } else if (error?.error) {
        description = error.error;
      }
      
      toast({
        variant: "destructive",
        title: "Erro ao submeter",
        description: description,
      });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      await apiRequest("DELETE", `/api/request-items/${itemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests", id, "items"] });
      toast({
        title: "Item removido",
        description: "O item foi removido da requisição",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Erro ao remover",
        description: "Não foi possível remover o item",
      });
    },
  });

  const updateNotesMutation = useMutation({
    mutationFn: async (notesValue: string) => {
      return apiRequest("PATCH", `/api/requests/${id}`, { notes: notesValue || null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests", id] });
      toast({
        title: "Observações atualizadas",
        description: "As observações foram salvas com sucesso",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: "Não foi possível salvar as observações",
      });
    },
  });

  // Sync notes state with request data
  useEffect(() => {
    if (request) {
      setNotes(request.notes || "");
    }
  }, [request]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Requisição não encontrada</div>
      </div>
    );
  }

  // Check if user can edit (must be owner and status must be draft)
  const isOwner = user && request.requestedBy === user.id;
  const canEdit = request.status === "draft" && isOwner;

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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/requests")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{request.area}</h1>
            <p className="text-sm text-muted-foreground mt-1">{request.event?.name}</p>
          </div>
          <SharedStatusBadge status={request.status} />
        </div>

        <div className="flex gap-2">
          {items.length > 0 && (
            <Button
              variant="outline"
              onClick={() => setShowDuplicateDialog(true)}
              data-testid="button-duplicate-request"
            >
              <Copy className="h-4 w-4 mr-2" />
              Duplicar
            </Button>
          )}
          {canEdit && (
            <>
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(true)}
                data-testid="button-delete-request"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={items.length === 0}
                data-testid="button-submit-approval"
              >
                <Send className="h-4 w-4 mr-2" />
                Enviar
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Requisition Window Alert - Only show for draft requests outside the window */}
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

      {/* Request Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Informações da Requisição</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Solicitado por:</span>
            <span className="text-sm font-medium" data-testid="text-requested-by">
              {request.requestedByUser?.name || "Usuário não encontrado"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Data de criação:</span>
            <span className="text-sm font-medium" data-testid="text-created-at">
              {new Date(request.createdAt).toLocaleDateString('pt-BR', { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>
          {request.submittedAt && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Submetido em:</span>
              <span className="text-sm font-medium" data-testid="text-submitted-at">
                {new Date(request.submittedAt).toLocaleDateString('pt-BR', { 
                  day: '2-digit', 
                  month: '2-digit', 
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
          )}
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Observações:</span>
              {canEdit && notesChanged && (
                <Button
                  size="sm"
                  onClick={handleSaveNotes}
                  disabled={updateNotesMutation.isPending}
                  data-testid="button-save-notes"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {updateNotesMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              )}
            </div>
            {canEdit ? (
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Adicione observações sobre a requisição (opcional)"
                data-testid="input-edit-notes"
                rows={3}
              />
            ) : (
              <p className="text-sm" data-testid="text-notes">
                {request.notes || "Nenhuma observação"}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Items List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Materiais Requisitados</CardTitle>
            {canEdit && (
              <Button
                size="sm"
                onClick={() => setShowAddItem(true)}
                data-testid="button-add-item"
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Material
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Nenhum material adicionado ainda</p>
              {canEdit && (
                <p className="text-sm mt-2">Clique em "Adicionar Material" para começar</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="border rounded-md p-3"
                  data-testid={`item-${item.id}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium">
                        {item.kit ? item.kit.name : item.product?.name}
                      </div>
                      <div className="text-sm text-muted-foreground">
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
                          <p className="font-medium text-destructive">Motivo da rejeição:</p>
                          <p className="text-destructive/90 mt-1">{item.rejectionReason}</p>
                        </div>
                      )}
                      {item.notes && (
                        <div className="mt-2 p-2 bg-muted/50 rounded text-sm">
                          <p className="font-medium text-muted-foreground">Observações:</p>
                          <p className="mt-1" data-testid={`text-item-notes-${item.id}`}>{item.notes}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {!canEdit && item.approvalStatus && <SharedStatusBadge status={item.approvalStatus} />}
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
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
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
            <AlertDialogAction
              onClick={handleDelete}
              data-testid="button-confirm-delete"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Item Dialog */}
      <AddItemDialog
        open={showAddItem}
        onOpenChange={setShowAddItem}
        requestId={id!}
      />

      {/* Duplicate Request Dialog */}
      <DuplicateRequestDialog
        open={showDuplicateDialog}
        onOpenChange={setShowDuplicateDialog}
        requestId={id!}
        currentArea={request.area}
        itemCount={items.length}
      />
    </div>
  );
}
