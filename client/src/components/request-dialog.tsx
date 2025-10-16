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
import type { MaterialRequest, InsertMaterialRequest, Event } from "@shared/schema";
import { format } from "date-fns";

interface RequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request?: MaterialRequest;
}

const AREAS = [
  "Scenography",
  "Lighting",
  "Sound",
  "Video",
  "Stage",
  "Catering",
  "Registration",
  "General"
];

export function RequestDialog({ open, onOpenChange, request }: RequestDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Partial<InsertMaterialRequest>>({
    eventId: request?.eventId || "",
    area: request?.area || "",
    status: request?.status || "draft",
    requestedBy: request?.requestedBy || "",
    cutoffTime: request?.cutoffTime ? format(new Date(request.cutoffTime), "yyyy-MM-dd'T'HH:mm") : "",
    notes: request?.notes || "",
  });

  const { data: events } = useQuery<Event[]>({ queryKey: ["/api/events"] });

  const createMutation = useMutation({
    mutationFn: async (data: InsertMaterialRequest) => {
      return apiRequest("POST", "/api/requests", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      toast({ description: "Request created successfully" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ description: "Failed to create request", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<InsertMaterialRequest>) => {
      return apiRequest("PATCH", `/api/requests/${request?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      toast({ description: "Request updated successfully" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ description: "Failed to update request", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.eventId || !formData.area || !formData.requestedBy) {
      toast({ description: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    const submitData: InsertMaterialRequest = {
      eventId: formData.eventId,
      area: formData.area,
      status: formData.status as any || "draft",
      requestedBy: formData.requestedBy,
      cutoffTime: formData.cutoffTime ? new Date(formData.cutoffTime) : undefined,
      notes: formData.notes,
    };

    if (request) {
      updateMutation.mutate(submitData);
    } else {
      createMutation.mutate(submitData);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{request ? "Edit Request" : "New Material Request"}</DialogTitle>
          <DialogDescription>
            {request ? "Update material request details" : "Create a material request for an event"}
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
              <Label htmlFor="area">Area *</Label>
              <Select 
                value={formData.area}
                onValueChange={(value) => setFormData({ ...formData, area: value })}
              >
                <SelectTrigger data-testid="select-area">
                  <SelectValue placeholder="Select area" />
                </SelectTrigger>
                <SelectContent>
                  {AREAS.map((area) => (
                    <SelectItem key={area} value={area}>
                      {area}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="requestedBy">Requested By *</Label>
              <Input
                id="requestedBy"
                value={formData.requestedBy}
                onChange={(e) => setFormData({ ...formData, requestedBy: e.target.value })}
                placeholder="Name"
                data-testid="input-requested-by"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cutoffTime">Cutoff Time</Label>
              <Input
                id="cutoffTime"
                type="datetime-local"
                value={formData.cutoffTime}
                onChange={(e) => setFormData({ ...formData, cutoffTime: e.target.value })}
                data-testid="input-cutoff-time"
              />
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
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="pending_approval">Pending Approval</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="cutoff_locked">Cutoff Locked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes..."
              rows={3}
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
              data-testid="button-submit-request"
            >
              {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : (request ? "Update" : "Create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
