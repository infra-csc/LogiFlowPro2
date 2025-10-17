import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, ClipboardList } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { format } from "date-fns";
import type { MaterialRequest, Event } from "@shared/schema";
import { RequestDialog } from "@/components/request-dialog";

interface RequestWithEvent extends MaterialRequest {
  event?: Event;
}

export default function Requests() {
  const [showDialog, setShowDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<MaterialRequest | undefined>();

  const { data: requests, isLoading } = useQuery<RequestWithEvent[]>({
    queryKey: ["/api/requests"],
  });

  const handleEdit = (request: MaterialRequest) => {
    setSelectedRequest(request);
    setShowDialog(true);
  };

  const handleClose = () => {
    setSelectedRequest(undefined);
    setShowDialog(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-sm text-muted-foreground">Carregando requisições...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Requisição de Materiais</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie requisições de materiais por área</p>
        </div>
        <Button onClick={() => setShowDialog(true)} data-testid="button-create-request">
          <Plus className="h-4 w-4 mr-2" />
          Nova Requisição
        </Button>
      </div>

      {!requests || requests.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <ClipboardList className="h-16 w-16 mx-auto text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">Nenhuma requisição ainda</h3>
              <p className="mt-2 text-sm text-muted-foreground">Crie requisições de materiais para seus eventos</p>
              <Button onClick={() => setShowDialog(true)} className="mt-4" data-testid="button-create-first-request">
                <Plus className="h-4 w-4 mr-2" />
                Nova Requisição
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <Card 
              key={request.id}
              className="hover-elevate cursor-pointer"
              onClick={() => handleEdit(request)}
              data-testid={`card-request-${request.id}`}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">
                    {request.event?.name} - {request.area}
                  </CardTitle>
                  <StatusBadge status={request.status} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Requested By</p>
                    <p className="text-sm font-medium">{request.requestedBy}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Created</p>
                    <p className="text-sm font-medium">
                      {format(new Date(request.createdAt), "MMM dd, yyyy")}
                    </p>
                  </div>
                  {request.approvedBy && (
                    <div>
                      <p className="text-xs text-muted-foreground">Approved By</p>
                      <p className="text-sm font-medium">{request.approvedBy}</p>
                    </div>
                  )}
                  {request.cutoffTime && (
                    <div>
                      <p className="text-xs text-muted-foreground">Cutoff</p>
                      <p className="text-sm font-medium">
                        {format(new Date(request.cutoffTime), "MMM dd, HH:mm")}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <RequestDialog 
        open={showDialog}
        onOpenChange={handleClose}
        request={selectedRequest}
      />
    </div>
  );
}
