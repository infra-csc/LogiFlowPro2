import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Driver, insertDriverSchema } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { userCanWriteLogistics, userIsAdmin } from "@/lib/authz";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
} from "@/components/ui/form";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { EmptyState } from "@/components/empty-state";
import {
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, UserCog, Upload, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// `insertDriverSchema` already omits `id` and `createdAt` in shared/schema.ts,
// so we only extend with the stricter field-level validations here.
const driverFormSchema = insertDriverSchema.extend({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  cpf: z.string().length(11, "CPF deve ter 11 dígitos"),
  license: z.string().min(5, "Número da CNH é obrigatório"),
  phone: z.string().min(10, "Telefone é obrigatório"),
});

type DriverFormData = z.infer<typeof driverFormSchema>;

export default function DriversPage() {
  const { user } = useAuth();
  const canWrite = userCanWriteLogistics(user);
  const isAdmin = userIsAdmin(user);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [cnhFile, setCnhFile] = useState<File | null>(null);
  const { toast } = useToast();

  const { data: drivers = [], isLoading } = useQuery<Driver[]>({
    queryKey: ["/api/drivers"],
  });

  const form = useForm<DriverFormData>({
    resolver: zodResolver(driverFormSchema),
    defaultValues: {
      name: "",
      cpf: "",
      rg: undefined,
      sex: undefined,
      birthDate: undefined,
      license: "",
      phone: "",
      available: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: DriverFormData) => {
      const res = await apiRequest("POST", "/api/drivers", data);
      return await res.json();
    },
    onSuccess: async (driver: Driver) => {
      // If there's a CNH file, upload it
      if (cnhFile) {
        await uploadCnhMutation.mutateAsync({ driverId: driver.id, file: cnhFile });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      toast({
        title: "Motorista criado",
        description: "O motorista foi cadastrado com sucesso.",
      });
      setIsDialogOpen(false);
      form.reset();
      setCnhFile(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar motorista",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<DriverFormData> }) => {
      const res = await apiRequest("PATCH", `/api/drivers/${id}`, data);
      return await res.json();
    },
    onSuccess: async (driver: Driver) => {
      // If there's a new CNH file, upload it
      if (cnhFile) {
        await uploadCnhMutation.mutateAsync({ driverId: driver.id, file: cnhFile });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      toast({
        title: "Motorista atualizado",
        description: "As informações foram atualizadas com sucesso.",
      });
      setIsDialogOpen(false);
      setSelectedDriver(null);
      form.reset();
      setCnhFile(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar motorista",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/drivers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      toast({
        title: "Motorista removido",
        description: "O motorista foi removido com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao remover motorista",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const uploadCnhMutation = useMutation({
    mutationFn: async ({ driverId, file }: { driverId: string; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/drivers/${driverId}/cnh-upload`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Falha no upload da CNH");
      return await res.json();
    },
  });

  const handleSubmit = (data: DriverFormData) => {
    if (selectedDriver) {
      updateMutation.mutate({ id: selectedDriver.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (driver: Driver) => {
    setSelectedDriver(driver);
    
    // Normalize birthDate from ISO format to YYYY-MM-DD for date input
    let normalizedBirthDate = "";
    if (driver.birthDate) {
      try {
        const date = new Date(driver.birthDate);
        if (!isNaN(date.getTime())) {
          normalizedBirthDate = date.toISOString().split('T')[0];
        }
      } catch (e) {
        console.error("Error parsing birth date:", e);
      }
    }
    
    form.reset({
      name: driver.name,
      cpf: driver.cpf,
      rg: driver.rg || undefined,
      sex: driver.sex || undefined,
      birthDate: normalizedBirthDate || undefined,
      license: driver.license,
      phone: driver.phone,
      available: driver.available,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (driver: Driver) => {
    if (confirm(`Tem certeza que deseja remover ${driver.name}?`)) {
      deleteMutation.mutate(driver.id);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setCnhFile(event.target.files[0]);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Motoristas"
        description="Gerencie o cadastro de motoristas"
      >
        {canWrite && (
          <Button
            onClick={() => {
              setSelectedDriver(null);
              form.reset();
              setCnhFile(null);
              setIsDialogOpen(true);
            }}
            data-testid="button-create-driver"
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo Motorista
          </Button>
        )}
      </PageHeader>

      <Card className="border-border/60">
        <CardContent className="p-4">
          <div className="font-semibold text-base mb-1">Lista de Motoristas</div>
          <p className="text-sm text-muted-foreground mb-4">
            Total de {drivers.length} motorista{drivers.length !== 1 ? "s" : ""} cadastrado{drivers.length !== 1 ? "s" : ""}
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>CNH</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Disponível</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : drivers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Nenhum motorista cadastrado
                  </TableCell>
                </TableRow>
              ) : (
                drivers.map((driver) => (
                  <TableRow key={driver.id}>
                    <TableCell className="font-medium">{driver.name}</TableCell>
                    <TableCell>{driver.cpf}</TableCell>
                    <TableCell>{driver.license}</TableCell>
                    <TableCell>{driver.phone}</TableCell>
                    <TableCell>
                      <Badge variant={driver.available ? "secondary" : "outline"} className={!driver.available ? "text-muted-foreground" : ""}>
                        {driver.available ? "Disponível" : "Indisponível"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {driver.cnhImageUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(driver.cnhImageUrl!, "_blank")}
                            data-testid={`button-view-cnh-${driver.id}`}
                          >
                            <Download className="mr-2 h-3 w-3" />
                            Ver CNH
                          </Button>
                        )}
                        {canWrite && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(driver)}
                            data-testid={`button-edit-driver-${driver.id}`}
                          >
                            <UserCog className="mr-2 h-3 w-3" />
                            Editar
                          </Button>
                        )}
                        {isAdmin && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(driver)}
                            data-testid={`button-delete-driver-${driver.id}`}
                          >
                            Excluir
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Driver Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedDriver ? "Editar Motorista" : "Novo Motorista"}</DialogTitle>
            <DialogDescription>
              Preencha os dados do motorista
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Nome Completo</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="João da Silva" data-testid="input-driver-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cpf"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CPF</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="12345678900" maxLength={11} data-testid="input-driver-cpf" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="rg"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>RG (Opcional)</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} placeholder="123456789" data-testid="input-driver-rg" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sex"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sexo (Opcional)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-driver-sex">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="M">Masculino</SelectItem>
                          <SelectItem value="F">Feminino</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="birthDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Nascimento (Opcional)</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} type="date" data-testid="input-driver-birthdate" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="license"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número da CNH</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="12345678900" data-testid="input-driver-license" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="11987654321" data-testid="input-driver-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="col-span-2">
                  <FormLabel>Anexar CNH (imagem)</FormLabel>
                  <div className="mt-2">
                    <Input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleFileChange}
                      data-testid="input-driver-cnh-file"
                    />
                    {cnhFile && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Arquivo selecionado: {cnhFile.name}
                      </p>
                    )}
                    {selectedDriver?.cnhImageUrl && !cnhFile && (
                      <p className="text-sm text-muted-foreground mt-1">
                        CNH já anexada. Selecione um novo arquivo para substituir.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    setSelectedDriver(null);
                    form.reset();
                    setCnhFile(null);
                  }}
                  data-testid="button-cancel-driver"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-submit-driver"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? "Salvando..."
                    : selectedDriver
                    ? "Atualizar"
                    : "Criar Motorista"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
