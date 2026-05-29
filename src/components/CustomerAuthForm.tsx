import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { cn } from "@/lib/utils";

const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
});

const registerSchema = loginSchema.extend({
  firstName: z.string().max(100).optional(),
  acceptsMarketing: z.boolean().optional(),
});

type LoginValues = z.infer<typeof loginSchema>;
type RegisterValues = z.infer<typeof registerSchema>;

type CustomerAuthFormProps = {
  mode: "login" | "register";
  onSubmit: (values: LoginValues | RegisterValues) => Promise<void>;
  className?: string;
};

export function CustomerAuthForm({ mode, onSubmit, className }: CustomerAuthFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const isRegister = mode === "register";

  const form = useForm<RegisterValues>({
    resolver: zodResolver(isRegister ? registerSchema : loginSchema),
    defaultValues: {
      email: "",
      password: "",
      firstName: "",
      acceptsMarketing: false,
    },
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className={cn("space-y-5", className)}>
        {isRegister && (
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm tracking-wide">Nome (opcional)</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    autoComplete="given-name"
                    className="border-gold/30 bg-background/80 focus-visible:ring-gold"
                    placeholder="Seu nome"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm tracking-wide">E-mail</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="email"
                  autoComplete="email"
                  className="border-gold/30 bg-background/80 focus-visible:ring-gold"
                  placeholder="voce@email.com"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm tracking-wide">Senha</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="password"
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  className="border-gold/30 bg-background/80 focus-visible:ring-gold"
                  placeholder="Mínimo 6 caracteres"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {isRegister && (
          <FormField
            control={form.control}
            name="acceptsMarketing"
            render={({ field }) => (
              <FormItem className="flex items-start gap-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="border-gold/50 data-[state=checked]:bg-gold data-[state=checked]:text-onyx mt-0.5"
                  />
                </FormControl>
                <FormLabel className="text-sm font-normal text-muted-foreground leading-snug cursor-pointer">
                  Quero receber novidades e ofertas da Bessa&apos;s Box
                </FormLabel>
              </FormItem>
            )}
          />
        )}

        <Button
          type="submit"
          disabled={submitting}
          className="w-full bg-gold text-onyx hover:bg-gold-soft font-medium tracking-wide h-11"
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : isRegister ? (
            "Criar conta"
          ) : (
            "Entrar"
          )}
        </Button>
      </form>
    </Form>
  );
}
