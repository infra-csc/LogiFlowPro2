import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Calendar, MapPin, Clock } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Calendar className="h-16 w-16 mx-auto text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">Nenhum evento ainda</h3>
              <p className="mt-2 text-sm text-muted-foreground">Comece criando seu primeiro evento</p>
              <Button onClick={() => setShowDialog(true)} className="mt-4" data-testid="button-create-first-event">
                <Plus className="h-4 w-4 mr-2" />
                Criar Evento
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <Card 
              key={event.id} 
              className="hover-elevate cursor-pointer"
              onClick={() => handleEdit(event)}
              data-testid={`card-event-${event.id}`}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{event.name}</CardTitle>
                  <StatusBadge status={event.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 mr-2" />
                  {event.client}
                </div>
                <div className="flex items-center text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 mr-2" />
                  {event.location}
                </div>
                <div className="flex items-center text-sm text-muted-foreground">
                  <Clock className="h-4 w-4 mr-2" />
                  {format(new Date(event.eventDate), "MMM dd, yyyy")}
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
