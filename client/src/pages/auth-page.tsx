import { useState } from "react";
import { Redirect, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Loader2, Package } from "lucide-react";
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

const loginSchema = z.object({
  username: z.string().min(3, "Usuário deve ter no mínimo 3 caracteres"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
});

const registerSchema = z.object({
  username: z.string().min(3, "Usuário deve ter no mínimo 3 caracteres"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  name: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("Email inválido"),
});

type LoginFormData = z.infer<typeof loginSchema>;
type RegisterFormData = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      password: "",
      name: "",
      email: "",
    },
  });

  // Redirect if already logged in
  if (user) {
    return <Redirect to="/" />;
  }

  const onLogin = (data: LoginFormData) => {
    loginMutation.mutate(data);
  };

  const onRegister = (data: RegisterFormData) => {
    registerMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Package className="h-7 w-7 text-primary" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight">Sistema de Logística</h1>
            </div>
            <p className="text-muted-foreground">
              Gerenciamento de eventos e operações de armazém
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "login" | "register")}>
            <TabsList className="grid w-full grid-cols-2 bg-muted/50 rounded-lg border">
              <TabsTrigger value="login" data-testid="tab-login">Entrar</TabsTrigger>
              <TabsTrigger value="register" data-testid="tab-register">Criar Conta</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-4">
              <Card className="shadow-sm border border-border/60">
                <CardHeader className="space-y-1">
                  <CardTitle className="text-xl">Entrar no Sistema</CardTitle>
                  <CardDescription>
                    Digite suas credenciais para acessar o sistema
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...loginForm}>
                    <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                      <FormField
                        control={loginForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Usuário</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="Digite seu usuário"
                                data-testid="input-login-username"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={loginForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Senha</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="password"
                                placeholder="Digite sua senha"
                                data-testid="input-login-password"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button
                        type="submit"
                        className="w-full"
                        disabled={loginMutation.isPending}
                        data-testid="button-login-submit"
                      >
                        {loginMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Entrando...
                          </>
                        ) : (
                          "Entrar"
                        )}
                      </Button>

                      <div className="text-center">
                        <Link href="/forgot-password">
                          <Button variant="ghost" size="sm" data-testid="link-forgot-password">
                            Esqueceu sua senha?
                          </Button>
                        </Link>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="register" className="mt-4">
              <Card className="shadow-sm border border-border/60">
                <CardHeader className="space-y-1">
                  <CardTitle className="text-xl">Criar Nova Conta</CardTitle>
                  <CardDescription>
                    Preencha os dados abaixo para criar sua conta
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...registerForm}>
                    <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
                      <FormField
                        control={registerForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome Completo</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="Digite seu nome completo"
                                data-testid="input-register-name"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={registerForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="email"
                                placeholder="seu@email.com"
                                data-testid="input-register-email"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={registerForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Usuário</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="Digite um nome de usuário"
                                data-testid="input-register-username"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={registerForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Senha</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="password"
                                placeholder="Mínimo 6 caracteres"
                                data-testid="input-register-password"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button
                        type="submit"
                        className="w-full"
                        disabled={registerMutation.isPending}
                        data-testid="button-register-submit"
                      >
                        {registerMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Criando conta...
                          </>
                        ) : (
                          "Criar Conta"
                        )}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Right side - Hero */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary/15 via-primary/5 to-background items-center justify-center p-12">
        <div className="max-w-lg text-center">
          <div className="h-24 w-24 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Package className="h-14 w-14 text-primary" />
          </div>
          <h2 className="text-4xl font-bold mb-4">Sistema de Gestão de Logística</h2>
          <p className="text-lg text-muted-foreground mb-8">
            Gerencie eventos, requisições de materiais, estoque, planos de viagens e devoluções de forma integrada e eficiente.
          </p>
          <div className="grid grid-cols-2 gap-4 text-left">
            <div className="p-4 bg-card/80 backdrop-blur-sm rounded-lg border shadow-sm">
              <h3 className="font-semibold mb-2 text-sm">Gestão de Eventos</h3>
              <p className="text-sm text-muted-foreground">
                Controle completo de montagem e desmontagem
              </p>
            </div>
            <div className="p-4 bg-card/80 backdrop-blur-sm rounded-lg border shadow-sm">
              <h3 className="font-semibold mb-2 text-sm">Inventário</h3>
              <p className="text-sm text-muted-foreground">
                Projeção temporal e rastreamento
              </p>
            </div>
            <div className="p-4 bg-card/80 backdrop-blur-sm rounded-lg border shadow-sm">
              <h3 className="font-semibold mb-2 text-sm">Planejamento</h3>
              <p className="text-sm text-muted-foreground">
                Planos de viagens e carregamento otimizado
              </p>
            </div>
            <div className="p-4 bg-card/80 backdrop-blur-sm rounded-lg border shadow-sm">
              <h3 className="font-semibold mb-2 text-sm">Logística Reversa</h3>
              <p className="text-sm text-muted-foreground">
                Gestão de devoluções e avarias
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
