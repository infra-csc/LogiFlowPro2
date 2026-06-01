import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Calendar, MapPin, Clock, Building2 } from "lucide-react";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { format } from "date-fns";
import type { Event } from "@shared/schema";
import { EventDialog } from "@/components/event-dialog";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { EmptyState } from "@/components/empty-state";

export default function Events() {
  const [showDialog, setShowDialog] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | undefined>();

  const { data: events, isLoading } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  const handleEdit = (event: Event) => {
    setSelectedEvent(event);
    setShowDialog(true);
  };

  const handleClose = () => {
    setSelectedEvent(undefined);
    setShowDialog(false);
  };

  if (isLoading) {
    return (
      <PageLoading message="Carregando eventos..." />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Eventos"
        description="Gerencie cronogramas e logística de eventos"
      >
        <Button onClick={() => setShowDialog(true)} data-testid="button-create-event">
          <Plus className="h-4 w-4 mr-2" />
          Criar Evento
        </Button>
      </PageHeader>

      {!events || events.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="Nenhum evento ainda"
          description="Comece criando seu primeiro evento"
          action={{ label: "Criar Evento", onClick: () => setShowDialog(true) }}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <Card
              key={event.id}
              className="hover-elevate border-border/60 cursor-pointer"
              onClick={() => handleEdit(event)}
              data-testid={`card-event-${event.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <StatusBadge status={event.status} />
                    </div>
                    <h3 className="font-semibold text-base text-foreground">{event.name}</h3>
                    <div className="mt-2 pt-2 border-t border-border/40 space-y-1 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>{event.client}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>{event.location}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>{format(new Date(event.eventDate), "dd/MM/yyyy")}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <EventDialog 
        open={showDialog} 
        onOpenChange={handleClose}
        event={selectedEvent}
      />
    </div>
  );
}
