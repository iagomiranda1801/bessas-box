import { useState, useEffect, useRef, useCallback } from 'react';
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
import { cartLineKey } from '@/lib/product-sizes';
import { formatCep, validateCep } from '@/lib/shipping/cep-service';
import { cleanCpf, formatCpf, validateCpf } from '@/lib/cpf-utils';
import type { ShippingOption, CepInfo } from '@/lib/shipping/types';

function buildAddressFromCepInfo(info: CepInfo): string {
  return [info.street, info.neighborhood].filter(Boolean).join(', ');
}

function formatCepLocationLine(info: CepInfo): string {
  const parts = [info.street, info.neighborhood, info.city, info.state].filter(Boolean);
  return parts.join(' · ');
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

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

  const addressTouchedRef = useRef(false);
  const lastCalculatedCepRef = useRef<string | null>(null);
  const prevCepDigitsRef = useRef('');

  useEffect(() => {
    if (isLoggedIn && customerEmail) {
      setEmail(customerEmail);
    }
  }, [isLoggedIn, customerEmail]);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotalCents = totalCents;
  const shippingCostCents = selectedShipping?.costCents || 0;
  const finalTotalCents = subtotalCents + shippingCostCents;

  const applyCepAddress = useCallback((info: CepInfo) => {
    if (addressTouchedRef.current) return;
    const auto = buildAddressFromCepInfo(info);
    if (auto) setShippingAddress(auto);
  }, []);

  const calculateShipping = useCallback(async () => {
    if (!validateCep(shippingCep) || items.length === 0) return;

    const normalizedCep = formatCep(shippingCep);
    setLoadingShipping(true);
    try {
      const result = await calculateShippingFn({
        data: {
          cep: shippingCep,
          items: items.map((i) => ({
            productId: i.productId,
            size: i.size,
            quantity: i.quantity,
          })),
        },
      });

      if (!result.ok) {
        toast.error(result.message, { position: 'top-center' });
        return;
      }

      setCepInfo(result.cepInfo);
      applyCepAddress(result.cepInfo);
      setShippingOptions(result.options);
      setSelectedShipping(result.options[0] || null);
      lastCalculatedCepRef.current = normalizedCep;
    } catch {
      toast.error('Erro ao calcular frete', { position: 'top-center' });
    } finally {
      setLoadingShipping(false);
    }
  }, [shippingCep, items, applyCepAddress]);

  useEffect(() => {
    const digits = shippingCep.replace(/\D/g, '');
    if (digits !== prevCepDigitsRef.current) {
      prevCepDigitsRef.current = digits;
      if (digits.length < 8) {
        lastCalculatedCepRef.current = null;
        setCepInfo(null);
        setShippingOptions([]);
        setSelectedShipping(null);
      } else if (digits.length === 8) {
        addressTouchedRef.current = false;
        lastCalculatedCepRef.current = null;
      }
    }
  }, [shippingCep]);

  useEffect(() => {
    if (!validateCep(shippingCep) || items.length === 0) return;

    const normalizedCep = formatCep(shippingCep);
    if (lastCalculatedCepRef.current === normalizedCep) return;

    const timer = setTimeout(() => {
      void calculateShipping();
    }, 400);

    return () => clearTimeout(timer);
  }, [shippingCep, items.length, calculateShipping]);

  const handleCepBlur = () => {
    if (!validateCep(shippingCep) || items.length === 0) return;
    const normalizedCep = formatCep(shippingCep);
    if (lastCalculatedCepRef.current !== normalizedCep && !loadingShipping) {
      void calculateShipping();
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
          customerCpf: cleanCpf(customerCpf),
          shippingName: name,
          userId:
            isLoggedIn && customerUserId && isUuid(customerUserId)
              ? customerUserId
              : undefined,
          items: items.map((i) => ({
            productId: i.productId,
            size: i.size,
            quantity: i.quantity,
          })),
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
    } catch (error) {
      console.error('[checkout]', error);
      const message =
        error instanceof Error ? error.message : 'Não foi possível finalizar. Tente novamente.';
      const isNetwork =
        /fetch|network|failed to load/i.test(message) || message === 'Failed to fetch';
      toast.error(
        isNetwork
          ? 'Falha de conexão. Verifique sua internet e tente novamente.'
          : message || 'Não foi possível finalizar. Tente novamente.',
        { position: 'top-center' },
      );
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
      <SheetContent className="w-full sm:max-w-md bg-background border-gold/20 flex flex-col overflow-hidden h-full gap-0">
        <SheetHeader className="flex-shrink-0">
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
            <div className="flex-1 min-h-0 overflow-y-auto">
              <ul className="space-y-4 py-4">
                {items.map((item) => (
                  <li key={cartLineKey(item.productId, item.size)} className="flex gap-3">
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
                          onClick={() =>
                            updateQuantity(item.productId, item.size, item.quantity - 1)
                          }
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
                            const r = updateQuantity(
                            item.productId,
                            item.size,
                            item.quantity + 1,
                          );
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
                          onClick={() => removeItem(item.productId, item.size)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="border-t border-gold/20 pt-4 pb-4 space-y-3">
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
                    onChange={(e) => setShippingCep(formatCep(e.target.value))}
                    onBlur={handleCepBlur}
                    className="border-gold/30 flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={!validateCep(shippingCep) || loadingShipping}
                    onClick={() => void calculateShipping()}
                    className="border-gold/30"
                    aria-label="Calcular frete"
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
                  onChange={(e) => {
                    addressTouchedRef.current = true;
                    setShippingAddress(e.target.value);
                  }}
                  className="border-gold/30"
                />

                {cepInfo && !cepInfo.error && (
                  <p className="text-xs text-muted-foreground">{formatCepLocationLine(cepInfo)}</p>
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
              </div>
            </div>

            <div className="flex-shrink-0 border-t border-gold/20 pt-4 space-y-3 bg-background">
              <div className="space-y-1">
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
