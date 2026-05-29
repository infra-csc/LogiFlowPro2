import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { userCanApproveMovement } from "@/lib/authz";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle, Clock, AlertCircle, ShieldAlert } from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { PageHeader, PageLoading, EmptyState } from "@/components";

interface Movement {
  id: string;
  movementNumber: string;
  name: string;
  status: string;
  createdBy: string;
  createdAt: string;
  movementTypeConfig?: {
    id: string;
    name: string;
    nature: string;
    group?: {
      name: string;
      color: string;
    };
  };
  events?: Array<{
    id: string;
    name: string;
  }>;
}

export default function MovementApprovals() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedMovement, setSelectedMovement] = useState<Movement | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const { data: pendingMovements = [], isLoading } = useQuery<Movement[]>({
    queryKey: ["/api/movements/pending-approval"],
  });

  const approveMutation = useMutation({
    mutationFn: async (movementId: string) => {
      const response = await apiRequest("POST", `/api/movements/${movementId}/approve`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/movements/pending-approval"] });
      queryClient.invalidateQueries({ queryKey: ["/api/movements"] });
      toast({
        title: "Movimentação Aprovada",
        description: "A movimentação foi aprovada com sucesso.",
      });
      setApproveDialogOpen(false);
      setSelectedMovement(null);
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao aprovar a movimentação.",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ movementId, reason }: { movementId: string; reason: string }) => {
      const response = await apiRequest("POST", `/api/movements/${movementId}/reject`, { reason });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/movements/pending-approval"] });
      queryClient.invalidateQueries({ queryKey: ["/api/movements"] });
      toast({
        title: "Movimentação Rejeitada",
        description: "A movimentação foi rejeitada com sucesso.",
      });
      setRejectDialogOpen(false);
      setSelectedMovement(null);
      setRejectionReason("");
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao rejeitar a movimentação.",
      });
    },
  });

  const handleApprove = (movement: Movement) => {
    setSelectedMovement(movement);
    setApproveDialogOpen(true);
  };

  const handleReject = (movement: Movement) => {
    setSelectedMovement(movement);
    setRejectDialogOpen(true);
  };

  const confirmApprove = () => {
    if (selectedMovement) {
      approveMutation.mutate(selectedMovement.id);
    }
  };

  const confirmReject = () => {
    if (selectedMovement && rejectionReason.trim()) {
      rejectMutation.mutate({
        movementId: selectedMovement.id,
        reason: rejectionReason.trim(),
      });
    }
  };

  const getNatureBadge = (nature: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      inbound: { label: "Entrada", className: "bg-green-500/10 text-green-700 dark:text-green-400" },
      outbound: { label: "Saída", className: "bg-red-500/10 text-red-700 dark:text-red-400" },
      transfer: { label: "Transferência", className: "bg-blue-500/10 text-blue-700 dark:text-blue-400" },
      adjustment: { label: "Ajuste", className: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400" },
    };

    const variant = variants[nature] || variants.transfer;
    return (
      <Badge variant="outline" className={variant.className} data-testid={`badge-nature-${nature}`}>
        {variant.label}
      </Badge>
    );
  };

  if (!userCanApproveMovement(user)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full" data-testid="card-access-denied">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              <div className="font-semibold text-base" data-testid="text-access-denied-title">Acesso negado</div>
            </div>
            <p className="text-sm text-muted-foreground" data-testid="text-access-denied-description">
              Você não tem permissão para acessar esta área. A aprovação de movimentações é restrita a administradores e supervisores.
            </p>
            <Button asChild variant="outline" data-testid="button-back-to-dashboard">
              <Link href="/">Voltar ao início</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Aprovações de Movimentações"
          description="Movimentações aguardando aprovação"
        />
        <PageLoading message="Carregando aprovações..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Aprovações de Movimentações"
        description="Movimentações aguardando aprovação"
      >
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-yellow-500" />
          <span className="text-2xl font-bold" data-testid="count-pending">
            {pendingMovements.length}
          </span>
        </div>
      </PageHeader>

      {pendingMovements.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Nenhuma aprovação pendente"
          description="Todas as movimentações foram processadas."
        />
      ) : (
        <div className="space-y-3">
          {pendingMovements.map((movement) => (
            <Card
              key={movement.id}
              className="hover-elevate border-border/60"
              data-testid={`card-movement-${movement.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground font-mono">{movement.movementNumber}</span>
                      {movement.movementTypeConfig?.nature && getNatureBadge(movement.movementTypeConfig.nature)}
                    </div>
                    <h3 className="font-semibold text-base text-foreground mt-1">{movement.name}</h3>
                    {movement.movementTypeConfig?.name && (
                      <p className="text-xs text-muted-foreground mt-0.5">{movement.movementTypeConfig.name}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleApprove(movement)}
                      data-testid={`button-approve-${movement.id}`}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleReject(movement)}
                      data-testid={`button-reject-${movement.id}`}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Rejeitar
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 pt-3 border-t border-border/40">
                  <div className="text-xs">
                    <span className="text-muted-foreground">Criado por:</span>{" "}
                    <span className="text-foreground font-medium">{movement.createdBy}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-muted-foreground">Data:</span>{" "}
                    <span className="text-foreground font-medium">{format(new Date(movement.createdAt), "dd/MM/yyyy HH:mm")}</span>
                  </div>
                  {movement.movementTypeConfig?.group && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">Grupo:</span>{" "}
                      <span className="text-foreground font-medium">{movement.movementTypeConfig.group.name}</span>
                    </div>
                  )}
                  {movement.events && movement.events.length > 0 && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">Eventos:</span>{" "}
                      <span className="text-foreground font-medium">{movement.events.map((e) => e.name).join(", ")}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Approve Confirmation Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent data-testid="dialog-approve">
          <DialogHeader>
            <DialogTitle>Confirmar Aprovação</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja aprovar a movimentação{" "}
              <strong>{selectedMovement?.movementNumber}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              <p className="text-sm">
                <strong>Nome:</strong> {selectedMovement?.name}
              </p>
              <p className="text-sm">
                <strong>Tipo:</strong> {selectedMovement?.movementTypeConfig?.name}
              </p>
              {selectedMovement?.events && selectedMovement.events.length > 0 && (
                <p className="text-sm">
                  <strong>Eventos:</strong> {selectedMovement.events.map((e) => e.name).join(", ")}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setApproveDialogOpen(false)}
              data-testid="button-cancel-approve"
            >
              Cancelar
            </Button>
            <Button
              onClick={confirmApprove}
              disabled={approveMutation.isPending}
              data-testid="button-confirm-approve"
            >
              {approveMutation.isPending ? "Aprovando..." : "Confirmar Aprovação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent data-testid="dialog-reject">
          <DialogHeader>
            <DialogTitle>Rejeitar Movimentação</DialogTitle>
            <DialogDescription>
              Informe o motivo da rejeição da movimentação{" "}
              <strong>{selectedMovement?.movementNumber}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <p className="text-sm">
                <strong>Nome:</strong> {selectedMovement?.name}
              </p>
              <p className="text-sm">
                <strong>Tipo:</strong> {selectedMovement?.movementTypeConfig?.name}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">Motivo da Rejeição *</Label>
              <Textarea
                id="rejection-reason"
                placeholder="Descreva o motivo da rejeição..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                data-testid="textarea-rejection-reason"
              />
              {!rejectionReason.trim() && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  O motivo é obrigatório
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectDialogOpen(false);
                setRejectionReason("");
              }}
              data-testid="button-cancel-reject"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
              disabled={!rejectionReason.trim() || rejectMutation.isPending}
              data-testid="button-confirm-reject"
            >
              {rejectMutation.isPending ? "Rejeitando..." : "Confirmar Rejeição"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
