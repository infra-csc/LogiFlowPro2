import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Package, ArrowLeft, CheckCircle2 } from "lucide-react";
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
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const forgotPasswordSchema = z.object({
  email: z.string().email("Email inválido"),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const form = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/auth/request-password-reset", data);

      if (response.ok) {
        setSuccess(true);
        toast({
          title: "Email enviado",
          description: "Se o email existe em nosso sistema, você receberá instruções para recuperar sua senha.",
        });
      } else {
        const error = await response.json();
        toast({
          variant: "destructive",
          title: "Erro",
          description: error.error || "Erro ao solicitar recuperação de senha",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao solicitar recuperação de senha",
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
              Recuperação de senha
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Esqueceu sua senha?</CardTitle>
              <CardDescription>
                Digite seu email para receber instruções de recuperação
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {success ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 p-4 bg-chart-4/10 border border-chart-4 rounded-lg">
                    <CheckCircle2 className="h-5 w-5 text-chart-4" />
                    <div>
                      <p className="font-medium">Email enviado com sucesso!</p>
                      <p className="text-sm text-muted-foreground">
                        Verifique sua caixa de entrada e siga as instruções.
                      </p>
                    </div>
                  </div>
                  <Link href="/auth">
                    <Button variant="outline" className="w-full" data-testid="button-back-to-login">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Voltar para o login
                    </Button>
                  </Link>
                </div>
              ) : (
                <>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="email"
                                placeholder="seu@email.com"
                                data-testid="input-email"
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
                            Enviando...
                          </>
                        ) : (
                          "Enviar instruções"
                        )}
                      </Button>
                    </form>
                  </Form>

                  <div className="text-center">
                    <Link href="/auth">
                      <Button variant="ghost" size="sm" data-testid="link-back-to-login">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Voltar para o login
                      </Button>
                    </Link>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Right side - Hero */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary/20 via-primary/10 to-background items-center justify-center p-12">
        <div className="max-w-lg text-center">
          <Package className="h-24 w-24 mx-auto mb-6 text-primary" />
          <h2 className="text-4xl font-bold mb-4">Recuperação de Senha</h2>
          <p className="text-lg text-muted-foreground mb-6">
            Não se preocupe! Enviaremos instruções para redefinir sua senha.
          </p>
          <div className="p-6 bg-card rounded-lg border">
            <h3 className="font-semibold mb-2">Como funciona?</h3>
            <ol className="text-left space-y-2 text-sm text-muted-foreground">
              <li>1. Digite seu email cadastrado</li>
              <li>2. Receba um link de recuperação por email</li>
              <li>3. Acesse o link e defina uma nova senha</li>
              <li>4. Faça login com sua nova senha</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
