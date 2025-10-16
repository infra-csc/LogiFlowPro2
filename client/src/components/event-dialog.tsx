import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
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
import type { Event, InsertEvent } from "@shared/schema";
import { insertEventSchema } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { useEffect } from "react";

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: Event;
}

export function EventDialog({ open, onOpenChange, event }: EventDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<InsertEvent>({
    resolver: zodResolver(insertEventSchema),
    defaultValues: {
      name: "",
      client: "",
      location: "",
      setupDate: new Date(),
      eventDate: new Date(),
      teardownDate: new Date(),
      status: "planning",
      notes: "",
      cutoffConfig: {},
    },
  });

  useEffect(() => {
    if (event) {
      form.reset({
        name: event.name,
        client: event.client,
        location: event.location,
        setupDate: new Date(event.setupDate),
        eventDate: new Date(event.eventDate),
        teardownDate: new Date(event.teardownDate),
        status: event.status,
        notes: event.notes || "",
        cutoffConfig: event.cutoffConfig || {},
      });
    } else {
      form.reset({
        name: "",
        client: "",
        location: "",
        setupDate: new Date(),
        eventDate: new Date(),
        teardownDate: new Date(),
        status: "planning",
        notes: "",
        cutoffConfig: {},
      });
    }
  }, [event, form, open]);

  const createMutation = useMutation({
    mutationFn: async (data: InsertEvent) => {
      return apiRequest("POST", "/api/events", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/recent-events"] });
      toast({ description: "Event created successfully" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ description: "Failed to create event", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: InsertEvent) => {
      return apiRequest("PATCH", `/api/events/${event?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/recent-events"] });
      toast({ description: "Event updated successfully" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ description: "Failed to update event", variant: "destructive" });
    },
  });

  const onSubmit = (data: InsertEvent) => {
    if (event) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{event ? "Edit Event" : "Create Event"}</DialogTitle>
          <DialogDescription>
            {event ? "Update event details and logistics" : "Set up a new event with dates and logistics"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event Name *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Tech Expo 2024" data-testid="input-event-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="client"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Client name" data-testid="input-client" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Convention Center, Hall A" data-testid="input-location" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="setupDate"
                render={({ field }) => {
                  const formatDateValue = (val: any) => {
                    if (!val) return "";
                    try {
                      const date = val instanceof Date ? val : new Date(val);
                      if (isNaN(date.getTime())) return "";
                      return format(date, "yyyy-MM-dd'T'HH:mm");
                    } catch {
                      return "";
                    }
                  };
                  
                  return (
                    <FormItem>
                      <FormLabel>Setup Date *</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          value={formatDateValue(field.value)}
                          onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : null)}
                          data-testid="input-setup-date"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              <FormField
                control={form.control}
                name="eventDate"
                render={({ field }) => {
                  const formatDateValue = (val: any) => {
                    if (!val) return "";
                    try {
                      const date = val instanceof Date ? val : new Date(val);
                      if (isNaN(date.getTime())) return "";
                      return format(date, "yyyy-MM-dd'T'HH:mm");
                    } catch {
                      return "";
                    }
                  };
                  
                  return (
                    <FormItem>
                      <FormLabel>Event Date *</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          value={formatDateValue(field.value)}
                          onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : null)}
                          data-testid="input-event-date"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              <FormField
                control={form.control}
                name="teardownDate"
                render={({ field }) => {
                  const formatDateValue = (val: any) => {
                    if (!val) return "";
                    try {
                      const date = val instanceof Date ? val : new Date(val);
                      if (isNaN(date.getTime())) return "";
                      return format(date, "yyyy-MM-dd'T'HH:mm");
                    } catch {
                      return "";
                    }
                  };
                  
                  return (
                    <FormItem>
                      <FormLabel>Teardown Date *</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          value={formatDateValue(field.value)}
                          onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : null)}
                          data-testid="input-teardown-date"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            </div>

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-status">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="planning">Planning</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value || ""}
                      placeholder="Additional event details..."
                      rows={3}
                      data-testid="input-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-submit-event"
              >
                {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : (event ? "Update" : "Create")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
