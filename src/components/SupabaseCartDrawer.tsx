import { useState, useEffect } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { Loader2, Minus, Plus, ShoppingBag, Trash2, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { createSupabaseOrderFn } from '@/lib/checkout.server';
import { calculateShippingFn } from '@/lib/shipping.server';
import { formatCents } from '@/lib/admin-utils';
import { useSupabaseCartStore } from '@/stores/supabaseCartStore';
import { useCustomerStore } from '@/stores/customerStore';
import { formatCep, validateCep } from '@/lib/shipping/cep-service';
import { formatCpf, validateCpf } from '@/lib/cpf-utils';
import type { ShippingOption, CepInfo } from '@/lib/shipping/types';

export function SupabaseCartDrawer() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [shippingName, setShippingName] = useState('');
  const [shippingCep, setShippingCep] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [customerCpf, setCustomerCpf] = useState('');
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [selectedShipping, setSelectedShipping] = useState<ShippingOption | null>(null);
  const [cepInfo, setCepInfo] = useState<CepInfo | null>(null);
  const [loadingShipping, setLoadingShipping] = useState(false);
  const items = useSupabaseCartStore((s) => s.items);
  const updateQuantity = useSupabaseCartStore((s) => s.updateQuantity);
  const removeItem = useSupabaseCartStore((s) => s.removeItem);
  const clearCart = useSupabaseCartStore((s) => s.clearCart);
  const totalCents = useSupabaseCartStore((s) => s.totalCents());

  const customerEmail = useCustomerStore((s) => s.email);
  const customerUserId = useCustomerStore((s) => s.userId);
  const isLoggedIn = useCustomerStore((s) => s.isLoggedIn());

  useEffect(() => {
    if (isLoggedIn && customerEmail) {
      setEmail(customerEmail);
    }
  }, [isLoggedIn, customerEmail]);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotalCents = totalCents;
  const shippingCostCents = selectedShipping?.costCents || 0;
  const finalTotalCents = subtotalCents + shippingCostCents;

  const calculateShipping = async () => {
    if (!validateCep(shippingCep) || items.length === 0) return;

    setLoadingShipping(true);
    try {
      const result = await calculateShippingFn({
        data: {
          cep: shippingCep,
          items: items.map(i => ({ productId: i.productId, quantity: i.quantity })),
        },
      });

      if (!result.ok) {
        toast.error(result.message, { position: 'top-center' });
        return;
      }

      setCepInfo(result.cepInfo);
      setShippingOptions(result.options);
      setSelectedShipping(result.options[0] || null); // seleciona a mais barata
    } catch (error) {
      toast.error('Erro ao calcular frete', { position: 'top-center' });
    } finally {
      setLoadingShipping(false);
    }
  };

  const handleCheckout = async () => {
    const trimmedEmail = email.trim();
    const name = shippingName.trim();
    const address = shippingAddress.trim();
    
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast.error('Informe um e-mail válido.', { position: 'top-center' });
      return;
    }
    if (!name) {
      toast.error('Informe o nome para entrega.', { position: 'top-center' });
      return;
    }
    if (!validateCep(shippingCep)) {
      toast.error('Informe um CEP válido.', { position: 'top-center' });
      return;
    }
    if (!address) {
      toast.error('Informe o endereço completo.', { position: 'top-center' });
      return;
    }
    if (!selectedShipping) {
      toast.error('Selecione uma opção de entrega.', { position: 'top-center' });
      return;
    }
    if (!validateCpf(customerCpf)) {
      toast.error('Informe um CPF válido.', { position: 'top-center' });
      return;
    }
    if (items.length === 0) return;

    setLoading(true);
    try {
      const result = await createSupabaseOrderFn({
        data: {
          customerEmail: trimmedEmail,
          customerCpf,
          shippingName: name,
          userId: isLoggedIn && customerUserId ? customerUserId : undefined,
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          shippingCep: formatCep(shippingCep),
          shippingCity: cepInfo?.city,
          shippingState: cepInfo?.state,
          isLocalDelivery: selectedShipping.isLocal,
          shippingCostCents: selectedShipping.costCents,
          shippingMethod: selectedShipping.method,
          carrierService: selectedShipping.carrierService,
          shippingAddress: {
            street: address,
            neighborhood: cepInfo?.neighborhood,
            cep: formatCep(shippingCep),
            city: cepInfo?.city,
            state: cepInfo?.state,
          },
        },
      });
      if (!result.ok) {
        toast.error(result.message, { position: 'top-center' });
        return;
      }
      clearCart();
      setIsOpen(false);
      navigate({ to: '/checkout/pagar/$orderId', params: { orderId: result.orderId } });
    } catch {
      toast.error('Não foi possível finalizar. Tente novamente.', { position: 'top-center' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-foreground hover:text-gold"
          aria-label="Sacola"
        >
          <ShoppingBag className="w-5 h-5" />
          {totalItems > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gold text-onyx text-xs flex items-center justify-center font-medium">
              {totalItems}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md bg-background border-gold/20 flex flex-col">
        <SheetHeader>
          <SheetTitle className="font-display">Sacola</SheetTitle>
          <SheetDescription>Checkout Bessa&apos;s Box</SheetDescription>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
            <p>Sua sacola está vazia.</p>
            <Button asChild variant="outline" className="border-gold/40" onClick={() => setIsOpen(false)}>
              <Link to="/colecao">Ver coleção</Link>
            </Button>
          </div>
        ) : (
          <>
            <ul className="flex-1 overflow-y-auto space-y-4 py-4">
              {items.map((item) => (
                <li key={item.productId} className="flex gap-3">
                  {item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="w-16 h-16 object-cover rounded border border-gold/20"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    <p className="text-xs text-gold">{formatCents(item.priceCents * item.quantity)}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-7 w-7 border-gold/30"
                        onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="text-sm w-6 text-center">{item.quantity}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-7 w-7 border-gold/30"
                        onClick={() => {
                          const r = updateQuantity(item.productId, item.quantity + 1);
                          if (!r.ok) toast.error(r.message, { position: 'top-center' });
                        }}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground"
                        onClick={() => removeItem(item.productId)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="border-t border-gold/20 pt-4 space-y-3">
              <Input
                placeholder="E-mail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border-gold/30"
              />
              <Input
                placeholder="Nome completo (entrega)"
                value={shippingName}
                onChange={(e) => setShippingName(e.target.value)}
                className="border-gold/30"
              />
              <Input
                placeholder="CPF"
                value={customerCpf}
                onChange={(e) => setCustomerCpf(formatCpf(e.target.value))}
                className="border-gold/30"
                inputMode="numeric"
              />
              <div className="flex gap-2">
                <Input
                  placeholder="CEP (ex: 38400-100)"
                  value={shippingCep}
                  onChange={(e) => {
                    const formatted = formatCep(e.target.value);
                    setShippingCep(formatted);
                    if (formatted !== e.target.value && validateCep(formatted)) {
                      calculateShipping();
                    }
                  }}
                  className="border-gold/30 flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={!validateCep(shippingCep) || loadingShipping}
                  onClick={calculateShipping}
                  className="border-gold/30"
                >
                  {loadingShipping ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Truck className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <Input
                placeholder="Endereço completo (rua, número, bairro)"
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                className="border-gold/30"
              />
              
              {cepInfo && (
                <p className="text-xs text-muted-foreground">
                  {cepInfo.city}, {cepInfo.state}
                </p>
              )}

              {shippingOptions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Entrega</p>
                  {shippingOptions.map((option) => (
                    <label
                      key={option.id}
                      className="flex items-center justify-between p-2 border rounded cursor-pointer hover:bg-gold/5 border-gold/20"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="shipping"
                          checked={selectedShipping?.id === option.id}
                          onChange={() => setSelectedShipping(option)}
                          className="text-gold"
                        />
                        <div>
                          <p className="text-sm font-medium">{option.serviceName}</p>
                          <p className="text-xs text-muted-foreground">
                            {option.estimatedDaysMin === option.estimatedDaysMax
                              ? `${option.estimatedDaysMin} dia${option.estimatedDaysMin > 1 ? 's' : ''}`
                              : `${option.estimatedDaysMin}-${option.estimatedDaysMax} dias`}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-medium text-gold">
                        {formatCents(option.costCents)}
                      </span>
                    </label>
                  ))}
                </div>
              )}

              <div className="space-y-1 pt-2 border-t border-gold/20">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCents(subtotalCents)}</span>
                </div>
                {selectedShipping && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Entrega</span>
                    <span>{formatCents(shippingCostCents)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-foreground">Total</span>
                  <span className="text-gold">{formatCents(finalTotalCents)}</span>
                </div>
              </div>
              <Button
                className="w-full bg-gold text-onyx hover:bg-gold-soft"
                disabled={loading}
                onClick={handleCheckout}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processando…
                  </>
                ) : (
                  'Pagar com Pix'
                )}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
