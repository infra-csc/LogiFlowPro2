import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Package, CheckCircle2, AlertTriangle } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { apiRequest } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

const resetPasswordSchema = z.object({
  newPassword: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  confirmPassword: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('token');
    
    if (!tokenParam) {
      setError("Token de recuperação não encontrado");
    } else {
      setToken(tokenParam);
    }
  }, []);

  const form = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!token) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Token inválido",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/auth/reset-password", {
        token,
        newPassword: data.newPassword,
      });

      if (response.ok) {
        setSuccess(true);
        toast({
          title: "Senha alterada",
          description: "Sua senha foi alterada com sucesso. Você já pode fazer login.",
        });
        
        // Redirect to login after 3 seconds
        setTimeout(() => {
          setLocation("/auth");
        }, 3000);
      } else {
        const error = await response.json();
        toast({
          variant: "destructive",
          title: "Erro",
          description: error.error || "Erro ao resetar senha",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao resetar senha",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Package className="h-10 w-10 text-primary" />
              <h1 className="text-3xl font-bold">Sistema de Logística</h1>
            </div>
            <p className="text-muted-foreground">
              Redefinir senha
            </p>
          </div>

          <Card className="border-border/60">
            <CardHeader>
              <CardTitle>Definir nova senha</CardTitle>
              <CardDescription>
                Digite sua nova senha abaixo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 p-4 bg-destructive/10 border border-destructive rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    <div>
                      <p className="font-medium">Token inválido ou expirado</p>
                      <p className="text-sm text-muted-foreground">
                        {error}
                      </p>
                    </div>
                  </div>
                  <Link href="/forgot-password">
                    <Button variant="default" className="w-full" data-testid="button-request-new-token">
                      Solicitar novo link
                    </Button>
                  </Link>
                </div>
              ) : success ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 p-4 bg-chart-4/10 border border-chart-4 rounded-lg">
                    <CheckCircle2 className="h-5 w-5 text-chart-4" />
                    <div>
                      <p className="font-medium">Senha alterada com sucesso!</p>
                      <p className="text-sm text-muted-foreground">
                        Redirecionando para o login...
                      </p>
                    </div>
                  </div>
                  <Link href="/auth">
                    <Button variant="outline" className="w-full" data-testid="button-go-to-login">
                      Ir para o login
                    </Button>
                  </Link>
                </div>
              ) : (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="newPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nova Senha</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="password"
                              placeholder="Mínimo 6 caracteres"
                              data-testid="input-new-password"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirmar Nova Senha</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="password"
                              placeholder="Digite a senha novamente"
                              data-testid="input-confirm-password"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isLoading}
                      data-testid="button-submit"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Alterando senha...
                        </>
                      ) : (
                        "Alterar senha"
                      )}
                    </Button>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Right side - Hero */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary/20 via-primary/10 to-background items-center justify-center p-12">
        <div className="max-w-lg text-center">
          <Package className="h-24 w-24 mx-auto mb-6 text-primary" />
          <h2 className="text-4xl font-bold mb-4">Redefinir Senha</h2>
          <p className="text-lg text-muted-foreground mb-6">
            Escolha uma senha forte para manter sua conta segura.
          </p>
          <div className="p-6 bg-card rounded-lg border">
            <h3 className="font-semibold mb-2">Dicas para uma senha segura</h3>
            <ul className="text-left space-y-2 text-sm text-muted-foreground">
              <li>• Use no mínimo 6 caracteres</li>
              <li>• Combine letras e números</li>
              <li>• Evite informações pessoais</li>
              <li>• Não reutilize senhas de outros serviços</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
