import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { LoadingOrder, Dock } from "@shared/schema";

const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  type: z.enum([
    "outbound_event",
    "inbound_event",
    "inbound_purchase",
    "inbound_rental",
    "outbound_rental_return",
    "internal_transfer",
    "inventory_adjustment",
  ]),
  loadingOrderId: z.string().optional(),
  vehiclePlate: z.string().optional(),
  dockId: z.string().min(1, "Doca é obrigatória"),
});

type FormData = z.infer<typeof formSchema>;

interface MovementDialogProps {
  children: React.ReactNode;
}

const typeLabels: Record<string, string> = {
  outbound_event: "Saída para Evento",
  inbound_event: "Retorno de Evento",
  inbound_purchase: "Entrada Produto Comprado",
  inbound_rental: "Entrada Produto Locado",
  outbound_rental_return: "Devolução Produto Locado",
  internal_transfer: "Transferência Interna",
  inventory_adjustment: "Ajuste de Inventário",
};

export function MovementDialog({ children }: MovementDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const { data: loadingOrders = [] } = useQuery<LoadingOrder[]>({
    queryKey: ["/api/loading-orders"],
  });

  const { data: docks = [] } = useQuery<Dock[]>({
    queryKey: ["/api/docks"],
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      type: "outbound_event",
      loadingOrderId: undefined,
      vehiclePlate: undefined,
      dockId: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await apiRequest("POST", "/api/movements", data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create movement");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Movimentação criada",
        description: "A movimentação foi criada com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/movements"] });
      setOpen(false);
      form.reset({
        name: "",
        type: "outbound_event",
        loadingOrderId: undefined,
        vehiclePlate: undefined,
        dockId: "",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar movimentação",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    // Normalize optional fields: convert empty strings to undefined
    const normalizedData = {
      ...data,
      loadingOrderId: data.loadingOrderId || undefined,
      vehiclePlate: data.vehiclePlate || undefined,
    };
    createMutation.mutate(normalizedData);
  };

  const approvedOrders = loadingOrders.filter(
    (order) => order.status === "approved" || order.status === "in_progress"
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl" data-testid="dialog-movement">
        <DialogHeader>
          <DialogTitle>Nova Movimentação</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Movimentação</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: Carga Evento Corporativo ABC"
                      data-testid="input-movement-name"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Movimentação</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-movement-type">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(typeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="loadingOrderId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ordem de Carregamento (Opcional)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-loading-order">
                        <SelectValue placeholder="Selecione uma ordem (opcional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {approvedOrders.map((order) => (
                        <SelectItem key={order.id} value={order.id}>
                          {order.orderNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="vehiclePlate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Placa do Veículo (Opcional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: ABC-1234"
                      data-testid="input-vehicle-plate"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dockId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Doca</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-dock">
                        <SelectValue placeholder="Selecione uma doca" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {docks.map((dock) => (
                        <SelectItem key={dock.id} value={dock.id}>
                          {dock.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                data-testid="button-cancel"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                data-testid="button-submit"
              >
                {createMutation.isPending ? "Criando..." : "Criar Movimentação"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
