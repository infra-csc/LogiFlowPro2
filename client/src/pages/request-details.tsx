import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Trash2, Send } from "lucide-react";
import { useState } from "react";
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
import { AddItemDialog } from "@/components/add-item-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type RequestItem = {
  id: string;
  requestId: string;
  productId: string;
  quantity: number;
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
};

const StatusBadge = ({ status }: { status: string }) => {
  const variants: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    draft: { label: "Rascunho", variant: "secondary" },
    pending_approval: { label: "Pendente", variant: "outline" },
    approved: { label: "Aprovado", variant: "default" },
    cutoff_locked: { label: "Bloqueado", variant: "destructive" }
  };

  const config = variants[status] || { label: status, variant: "outline" };
  return <Badge variant={config.variant} data-testid={`badge-status-${status}`}>{config.label}</Badge>;
};

export default function RequestDetails() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showAddItem, setShowAddItem] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { data: request, isLoading } = useQuery<MaterialRequest>({
    queryKey: ["/api/requests", id],
  });

  const { data: items = [] } = useQuery<RequestItem[]>({
    queryKey: ["/api/requests", id, "items"],
  });

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
      await apiRequest("PATCH", `/api/requests/${id}`, { status: "pending_approval" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests", id] });
      toast({
        title: "Enviado para aprovação",
        description: "A requisição foi submetida para aprovação",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Erro ao submeter",
        description: "Não foi possível submeter a requisição",
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

  const canEdit = request.status === "draft";

  const handleDelete = () => {
    deleteMutation.mutate();
    setShowDeleteDialog(false);
  };

  const handleSubmit = () => {
    submitMutation.mutate();
  };

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
          <StatusBadge status={request.status} />
        </div>

        <div className="flex gap-2">
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
                Submeter para Aprovação
              </Button>
            </>
          )}
        </div>
      </div>

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
                  className="flex items-center justify-between p-3 border rounded-md"
                  data-testid={`item-${item.id}`}
                >
                  <div className="flex-1">
                    <div className="font-medium">
                      {item.kit ? item.kit.name : item.product?.name}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {item.kit ? "Kit" : item.product?.sku}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-medium">{item.quantity}</div>
                      <div className="text-sm text-muted-foreground">
                        {item.product?.unit || "unid"}
                      </div>
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
    </div>
  );
}
