import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Trip, InsertTrip, Event, Vehicle, Driver, Dock } from "@shared/schema";
import { format } from "date-fns";

interface TripDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip?: Trip;
}

export function TripDialog({ open, onOpenChange, trip }: TripDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Partial<InsertTrip>>({
    eventId: trip?.eventId || "",
    vehicleId: trip?.vehicleId || "",
    driverId: trip?.driverId || "",
    dockId: trip?.dockId || "",
    scheduledStart: trip?.scheduledStart ? format(new Date(trip.scheduledStart), "yyyy-MM-dd'T'HH:mm") : "",
    scheduledEnd: trip?.scheduledEnd ? format(new Date(trip.scheduledEnd), "yyyy-MM-dd'T'HH:mm") : "",
    status: trip?.status || "planned",
    notes: trip?.notes || "",
  });

  const { data: events } = useQuery<Event[]>({ queryKey: ["/api/events"] });
  const { data: vehicles } = useQuery<Vehicle[]>({ queryKey: ["/api/vehicles"] });
  const { data: drivers } = useQuery<Driver[]>({ queryKey: ["/api/drivers"] });
  const { data: docks } = useQuery<Dock[]>({ queryKey: ["/api/docks"] });

  const createMutation = useMutation({
    mutationFn: async (data: InsertTrip) => {
      return apiRequest("POST", "/api/trips", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ description: "Trip created successfully" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ description: "Failed to create trip", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<InsertTrip>) => {
      return apiRequest("PATCH", `/api/trips/${trip?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      toast({ description: "Trip updated successfully" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ description: "Failed to update trip", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.eventId || !formData.vehicleId || !formData.driverId || 
        !formData.scheduledStart || !formData.scheduledEnd) {
      toast({ description: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    const submitData: InsertTrip = {
      eventId: formData.eventId,
      vehicleId: formData.vehicleId,
      driverId: formData.driverId,
      dockId: formData.dockId,
      scheduledStart: new Date(formData.scheduledStart),
      scheduledEnd: new Date(formData.scheduledEnd),
      status: formData.status as any || "planned",
      notes: formData.notes,
    };

    if (trip) {
      updateMutation.mutate(submitData);
    } else {
      createMutation.mutate(submitData);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{trip ? "Edit Trip" : "Plan Trip"}</DialogTitle>
          <DialogDescription>
            {trip ? "Update trip details" : "Schedule a new vehicle trip"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="eventId">Event *</Label>
            <Select 
              value={formData.eventId}
              onValueChange={(value) => setFormData({ ...formData, eventId: value })}
            >
              <SelectTrigger data-testid="select-event">
                <SelectValue placeholder="Select event" />
              </SelectTrigger>
              <SelectContent>
                {events?.map((event) => (
                  <SelectItem key={event.id} value={event.id}>
                    {event.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vehicleId">Vehicle *</Label>
              <Select 
                value={formData.vehicleId}
                onValueChange={(value) => setFormData({ ...formData, vehicleId: value })}
              >
                <SelectTrigger data-testid="select-vehicle">
                  <SelectValue placeholder="Select vehicle" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles?.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                      {vehicle.plate} - {vehicle.type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="driverId">Driver *</Label>
              <Select 
                value={formData.driverId}
                onValueChange={(value) => setFormData({ ...formData, driverId: value })}
              >
                <SelectTrigger data-testid="select-driver">
                  <SelectValue placeholder="Select driver" />
                </SelectTrigger>
                <SelectContent>
                  {drivers?.map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      {driver.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dockId">Dock (Optional)</Label>
            <Select 
              value={formData.dockId || ""}
              onValueChange={(value) => setFormData({ ...formData, dockId: value || undefined })}
            >
              <SelectTrigger data-testid="select-dock">
                <SelectValue placeholder="Select dock" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No dock</SelectItem>
                {docks?.map((dock) => (
                  <SelectItem key={dock.id} value={dock.id}>
                    {dock.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="scheduledStart">Scheduled Start *</Label>
              <Input
                id="scheduledStart"
                type="datetime-local"
                value={formData.scheduledStart}
                onChange={(e) => setFormData({ ...formData, scheduledStart: e.target.value })}
                data-testid="input-scheduled-start"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="scheduledEnd">Scheduled End *</Label>
              <Input
                id="scheduledEnd"
                type="datetime-local"
                value={formData.scheduledEnd}
                onChange={(e) => setFormData({ ...formData, scheduledEnd: e.target.value })}
                data-testid="input-scheduled-end"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select 
              value={formData.status as string}
              onValueChange={(value) => setFormData({ ...formData, status: value as any })}
            >
              <SelectTrigger data-testid="select-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="planned">Planned</SelectItem>
                <SelectItem value="loading">Loading</SelectItem>
                <SelectItem value="loaded">Loaded</SelectItem>
                <SelectItem value="in_transit">In Transit</SelectItem>
                <SelectItem value="at_destination">At Destination</SelectItem>
                <SelectItem value="unloading">Unloading</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Trip notes..."
              rows={2}
              data-testid="input-notes"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-submit-trip"
            >
              {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : (trip ? "Update" : "Create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
