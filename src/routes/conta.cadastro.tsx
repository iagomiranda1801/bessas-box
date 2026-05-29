import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { CustomerAuthForm } from "@/components/CustomerAuthForm";
import { customerRegisterFn } from "@/lib/customer.server";
import { useCustomerStore } from "@/stores/customerStore";

type RegisterSearch = {
  returnTo?: string;
};

export const Route = createFileRoute("/conta/cadastro")({
  validateSearch: (search: Record<string, unknown>): RegisterSearch => ({
    returnTo: typeof search.returnTo === "string" ? search.returnTo : undefined,
  }),
  component: RegisterPage,
  head: () => ({
    meta: [
      { title: "Criar conta — Bessa's Box" },
      { name: "description", content: "Cadastre-se na Bessa's Box." },
    ],
  }),
});

function RegisterPage() {
  const navigate = useNavigate();
  const { returnTo } = Route.useSearch();
  const setSession = useCustomerStore((s) => s.setSession);

  const handleRegister = async (values: {
    email: string;
    password: string;
    firstName?: string;
    acceptsMarketing?: boolean;
  }) => {
    const result = await customerRegisterFn({
      data: {
        email: values.email,
        password: values.password,
        firstName: values.firstName || undefined,
        acceptsMarketing: values.acceptsMarketing,
      },
    });
    if (!result.ok) {
      toast.error(result.message, { position: "top-center" });
      return;
    }
    setSession(result.session);
    toast.success("Conta criada com sucesso!", { position: "top-center" });
    navigate({ to: returnTo || "/colecao" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground bg-mesh-dark">
      <SiteHeader homeOnlyNav={false} />

      <main className="pt-20 pb-0">
        <div className="max-w-md mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-gold mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Voltar à home
          </Link>

          <div className="premium-card rounded-xl p-8 sm:p-10 space-y-6 animate-fade-in-up">
            <div className="space-y-2 text-center sm:text-left">
              <p className="text-gold text-xs tracking-[0.25em] uppercase">Conta</p>
              <h1 className="font-display text-3xl sm:text-4xl">Criar conta</h1>
              <p className="text-sm text-muted-foreground">
                Cadastro opcional — você também pode comprar como convidado e pagar na Shopify.
              </p>
            </div>

            <CustomerAuthForm mode="register" onSubmit={handleRegister} />

            <p className="text-sm text-center text-muted-foreground">
              Já tem conta?{" "}
              <Link
                to="/conta/entrar"
                search={returnTo ? { returnTo } : undefined}
                className="text-gold hover:text-gold-soft transition-colors"
              >
                Entrar
              </Link>
            </p>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
