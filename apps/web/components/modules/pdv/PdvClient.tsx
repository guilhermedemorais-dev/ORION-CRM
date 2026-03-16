'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ReceiptModal } from './ReceiptModal';
import type { ReceiptOrder, StoreReceiptSettings } from './ReceiptModal';

interface Product {
    id: string;
    code: string;
    name: string;
    price_cents: number;
    stock_quantity: number;
    minimum_stock: number;
    category: string | null;
    is_active: boolean;
    metal?: string | null;
    weight_grams?: number | null;
}

interface CartItem {
    productId: string;
    name: string;
    code: string;
    priceCents: number;
    stock: number;
    quantity: number;
    metal?: string | null;
    weight_grams?: number | null;
}

interface LinkedCustomer {
    id: string;
    name: string;
    phone: string;
    cpf: string | null;
    email?: string | null;
}

interface CustomOrder {
    id: string;
    order_number: string;
    customer_name: string;
    design_description: string | null;
    total_amount_cents: number;
    signal_amount_cents: number;
    remaining_amount_cents: number;
}

type PaymentMethod = 'DINHEIRO' | 'PIX' | 'CARTAO_DEBITO' | 'CARTAO_CREDITO' | 'LINK_PAGAMENTO';

const CATEGORIES = ['Todos', 'Anel', 'Colar', 'Brinco', 'Pulseira', 'Outro'];

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: string }[] = [
    { value: 'DINHEIRO', label: 'Dinheiro', icon: '💵' },
    { value: 'PIX', label: 'PIX', icon: '📱' },
    { value: 'CARTAO_DEBITO', label: 'Débito', icon: '💳' },
    { value: 'CARTAO_CREDITO', label: 'Crédito', icon: '💳' },
    { value: 'LINK_PAGAMENTO', label: 'Link MP', icon: '🔗' },
];

function fmtCurrency(cents: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

function initials(name: string): string {
    return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

export function PdvClient({
    userName,
    userRole,
    initialProducts,
    initialSettings,
}: {
    userName: string;
    userRole: string;
    initialProducts: Product[];
    initialSettings: StoreReceiptSettings | null;
}) {
    // ── Products ──
    const [products, setProducts] = useState<Product[]>(initialProducts);
    const [isLoadingProducts, setIsLoadingProducts] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('Todos');

    // ── Cart ──
    const [cart, setCart] = useState<Record<string, CartItem>>({});

    // ── Customer ──
    const [linkedCustomer, setLinkedCustomer] = useState<LinkedCustomer | null>(null);
    const [customerQuery, setCustomerQuery] = useState('');
    const [customerResults, setCustomerResults] = useState<LinkedCustomer[]>([]);
    const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
    const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
    const [quickFormOpen, setQuickFormOpen] = useState(false);
    const [qfName, setQfName] = useState('');
    const [qfPhone, setQfPhone] = useState('');
    const [qfEmail, setQfEmail] = useState('');
    const [qfCpf, setQfCpf] = useState('');
    const [qfSaving, setQfSaving] = useState(false);
    const [qfError, setQfError] = useState<string | null>(null);

    // ── Custom Order ──
    const [customOrderQuery, setCustomOrderQuery] = useState('');
    const [customOrderResults, setCustomOrderResults] = useState<CustomOrder[]>([]);
    const [customOrderLoading, setCustomOrderLoading] = useState(false);
    const [customOrderDropdownOpen, setCustomOrderDropdownOpen] = useState(false);
    const [linkedCustomOrder, setLinkedCustomOrder] = useState<CustomOrder | null>(null);

    // ── Payment ──
    const [discountType, setDiscountType] = useState<'real' | 'pct'>('real');
    const [discountValue, setDiscountValue] = useState('');
    const [selectedPayment, setSelectedPayment] = useState<PaymentMethod | null>(null);
    const [cashReceived, setCashReceived] = useState('');
    const [installments, setInstallments] = useState(1);
    const [pixCopied, setPixCopied] = useState(false);

    // ── Status ──
    const [isOnline, setIsOnline] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const [receipt, setReceipt] = useState<ReceiptOrder | null>(null);
    const [settings] = useState<StoreReceiptSettings>(initialSettings ?? { company_name: 'Orion' });

    const searchRef = useRef<HTMLInputElement>(null);
    const customerSearchRef = useRef<HTMLInputElement>(null);

    // ── Derived totals ──
    const cartItems = Object.values(cart);
    const subtotalCents = cartItems.reduce((s, i) => s + i.priceCents * i.quantity, 0);
    const discountCents = (() => {
        const v = parseFloat(discountValue) || 0;
        if (discountType === 'pct') return Math.min(Math.round(subtotalCents * v / 100), subtotalCents);
        return Math.min(Math.round(v * 100), subtotalCents);
    })();

    // When custom order is linked, total = products subtotal - discount + custom order remaining
    const customOrderRemaining = linkedCustomOrder?.remaining_amount_cents ?? 0;
    const totalCents = subtotalCents - discountCents + customOrderRemaining;

    const cashReceivedCents = Math.round((parseFloat(cashReceived) || 0) * 100);
    const trocoCents = selectedPayment === 'DINHEIRO' && cashReceivedCents > totalCents
        ? cashReceivedCents - totalCents
        : 0;

    const hasCart = cartItems.length > 0 || linkedCustomOrder !== null;
    const totalQty = cartItems.reduce((s, i) => s + i.quantity, 0);

    const canSubmit = isOnline &&
        hasCart &&
        selectedPayment !== null &&
        !isSubmitting &&
        !(selectedPayment === 'DINHEIRO' && cashReceivedCents < totalCents);

    // ── Load products ──
    const loadProducts = useCallback(async (q: string, cat: string) => {
        setIsLoadingProducts(true);
        try {
            const params = new URLSearchParams({ limit: '100' });
            if (q) params.set('q', q);
            if (cat !== 'Todos') params.set('category', cat);
            const res = await fetch(`/api/internal/products?${params.toString()}`, { cache: 'no-store' });
            if (!res.ok) throw new Error();
            const data = (await res.json()) as { data: Product[] };
            setProducts(data.data ?? []);
        } catch {
            setProducts([]);
        } finally {
            setIsLoadingProducts(false);
        }
    }, []);

    useEffect(() => {
        const t = setTimeout(() => void loadProducts(searchQuery, activeCategory), searchQuery ? 300 : 0);
        return () => clearTimeout(t);
    }, [searchQuery, activeCategory, loadProducts]);

    // ── Customer search ──
    const searchCustomers = useCallback(async (q: string) => {
        if (!q.trim()) { setCustomerResults([]); setCustomerDropdownOpen(false); return; }
        setCustomerSearchLoading(true);
        try {
            const res = await fetch(`/api/internal/customers?q=${encodeURIComponent(q)}&limit=5`, { cache: 'no-store' });
            if (!res.ok) throw new Error();
            const data = (await res.json()) as { data: { id: string; name: string; whatsapp_number: string; cpf: string | null; email: string | null }[] };
            setCustomerResults(data.data.map(c => ({ id: c.id, name: c.name, phone: c.whatsapp_number, cpf: c.cpf, email: c.email })));
            setCustomerDropdownOpen(true);
        } catch {
            setCustomerResults([]);
        } finally {
            setCustomerSearchLoading(false);
        }
    }, []);

    useEffect(() => {
        const t = setTimeout(() => void searchCustomers(customerQuery), 300);
        return () => clearTimeout(t);
    }, [customerQuery, searchCustomers]);

    // ── Custom order search ──
    const searchCustomOrders = useCallback(async (q: string) => {
        if (!q.trim()) { setCustomOrderResults([]); setCustomOrderDropdownOpen(false); return; }
        setCustomOrderLoading(true);
        try {
            const res = await fetch(`/api/internal/pdv/custom-orders?q=${encodeURIComponent(q)}`, { cache: 'no-store' });
            if (!res.ok) throw new Error();
            const data = (await res.json()) as { data: CustomOrder[] };
            setCustomOrderResults(data.data);
            setCustomOrderDropdownOpen(true);
        } catch {
            setCustomOrderResults([]);
        } finally {
            setCustomOrderLoading(false);
        }
    }, []);

    useEffect(() => {
        const t = setTimeout(() => void searchCustomOrders(customOrderQuery), 300);
        return () => clearTimeout(t);
    }, [customOrderQuery, searchCustomOrders]);

    // ── Keyboard ──
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'F2') { e.preventDefault(); searchRef.current?.focus(); }
            if (e.key === 'Escape') { setCustomerDropdownOpen(false); setCustomOrderDropdownOpen(false); }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    // ── Online status ──
    useEffect(() => {
        const goOnline = () => setIsOnline(true);
        const goOffline = () => setIsOnline(false);
        window.addEventListener('online', goOnline);
        window.addEventListener('offline', goOffline);
        return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline); };
    }, []);

    // ── Cart actions ──
    function addToCart(product: Product) {
        if (product.stock_quantity === 0) return;
        setCart(prev => {
            const existing = prev[product.id];
            if (existing) {
                if (existing.quantity >= product.stock_quantity) return prev;
                return { ...prev, [product.id]: { ...existing, quantity: existing.quantity + 1 } };
            }
            return {
                ...prev,
                [product.id]: {
                    productId: product.id,
                    name: product.name,
                    code: product.code,
                    priceCents: product.price_cents,
                    stock: product.stock_quantity,
                    quantity: 1,
                    metal: product.metal,
                    weight_grams: product.weight_grams,
                },
            };
        });
    }

    function changeQuantity(productId: string, delta: number) {
        setCart(prev => {
            const item = prev[productId];
            if (!item) return prev;
            const newQty = item.quantity + delta;
            if (newQty <= 0) { const { [productId]: _, ...rest } = prev; return rest; }
            if (newQty > item.stock) return prev;
            return { ...prev, [productId]: { ...item, quantity: newQty } };
        });
    }

    function removeFromCart(productId: string) {
        setCart(prev => { const { [productId]: _, ...rest } = prev; return rest; });
    }

    function clearCart() {
        setCart({});
        setSelectedPayment(null);
        setDiscountValue('');
        setCashReceived('');
        setInstallments(1);
        setSubmitError(null);
        setLinkedCustomer(null);
        setLinkedCustomOrder(null);
        setCustomerQuery('');
        setCustomOrderQuery('');
    }

    // ── Customer actions ──
    function linkCustomer(c: LinkedCustomer) {
        setLinkedCustomer(c);
        setCustomerDropdownOpen(false);
        setCustomerQuery('');
    }

    function unlinkCustomer() {
        setLinkedCustomer(null);
        setCustomerQuery('');
    }

    async function handleQuickSave() {
        if (!qfName.trim() || !qfPhone.trim()) return;
        setQfSaving(true);
        setQfError(null);
        try {
            const res = await fetch('/api/internal/pdv/quick-customer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: qfName.trim(), phone: qfPhone.trim(), email: qfEmail.trim() || null, cpf: qfCpf.trim() || null }),
            });
            if (!res.ok) {
                const e = (await res.json().catch(() => ({}))) as { message?: string };
                throw new Error(e.message ?? 'Erro ao salvar cliente.');
            }
            const c = (await res.json()) as { id: string; name: string; phone: string; cpf: string | null; existing: boolean };
            linkCustomer({ id: c.id, name: c.name, phone: c.phone, cpf: c.cpf, email: qfEmail.trim() || null });
            setQuickFormOpen(false);
            setQfName(''); setQfPhone(''); setQfEmail(''); setQfCpf('');
        } catch (e) {
            setQfError(e instanceof Error ? e.message : 'Erro desconhecido.');
        } finally {
            setQfSaving(false);
        }
    }

    // ── Custom order actions ──
    function linkCustomOrder(order: CustomOrder) {
        setLinkedCustomOrder(order);
        setCustomOrderDropdownOpen(false);
        setCustomOrderQuery('');
        // Auto-link customer if not already linked
        if (!linkedCustomer && order.customer_name) {
            // fetch customer by searching — but we don't have customer_id here
            // just show the name without linking (full customer link requires more)
        }
    }

    // ── Finalize ──
    async function handleFinalize() {
        if (!canSubmit || !selectedPayment) return;
        setIsSubmitting(true);
        setSubmitError(null);

        try {
            const items = cartItems.map(i => ({ product_id: i.productId, quantity: i.quantity }));
            const receiptItems = cartItems.map(i => ({
                name: i.name,
                code: i.code,
                metal: i.metal,
                weight_grams: i.weight_grams,
                quantity: i.quantity,
                unitPriceCents: i.priceCents,
            }));

            const customerId = linkedCustomer?.id ?? null;

            if (selectedPayment === 'LINK_PAGAMENTO') {
                const res = await fetch('/api/internal/pdv/mp-link', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ items, discount_cents: discountCents, notes: null, customer_id: customerId }),
                });
                if (!res.ok) {
                    const err = (await res.json().catch(() => ({}))) as { message?: string };
                    throw new Error(err.message ?? 'Erro ao gerar link de pagamento.');
                }
                const data = (await res.json()) as { order_id: string; order_number: string; payment_url: string };
                setReceipt({
                    orderId: data.order_id,
                    orderNumber: data.order_number,
                    createdAt: new Date(),
                    items: receiptItems,
                    subtotalCents,
                    discountCents,
                    totalCents,
                    paymentMethod: 'LINK_PAGAMENTO',
                    paymentUrl: data.payment_url,
                });
            } else {
                const res = await fetch('/api/internal/pdv/sales', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ items, payment_method: selectedPayment, discount_cents: discountCents, notes: null, customer_id: customerId }),
                });
                if (!res.ok) {
                    const err = (await res.json().catch(() => ({}))) as { message?: string };
                    throw new Error(err.message ?? 'Erro ao finalizar venda.');
                }
                const data = (await res.json()) as { order_id: string; receipt: { order_number: string } };
                setReceipt({
                    orderId: data.order_id,
                    orderNumber: data.receipt.order_number,
                    createdAt: new Date(),
                    items: receiptItems,
                    subtotalCents,
                    discountCents,
                    totalCents,
                    paymentMethod: selectedPayment,
                    cashReceivedCents: selectedPayment === 'DINHEIRO' ? cashReceivedCents : undefined,
                    installments: selectedPayment === 'CARTAO_CREDITO' ? installments : undefined,
                });
            }
        } catch (err) {
            setSubmitError(err instanceof Error ? err.message : 'Erro desconhecido.');
        } finally {
            setIsSubmitting(false);
        }
    }

    function handleNewSale() {
        setReceipt(null);
        clearCart();
    }

    function copyText(text: string, setCopied: (v: boolean) => void) {
        navigator.clipboard?.writeText(text).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    return (
        <>
            <div className="flex h-[calc(100vh-100px)] overflow-hidden rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#0A0A0B]">

                {/* ── LEFT PANEL ── */}
                <div className="flex flex-1 flex-col overflow-hidden border-r border-[rgba(255,255,255,0.07)]">

                    {/* Search + PDV header */}
                    <div className="flex-shrink-0 border-b border-[rgba(255,255,255,0.07)] bg-[#111113] px-5 py-3">
                        <div className="mb-3 flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#4A4A52]">Caixa e Comissões</p>
                                <p className="font-serif text-[15px] font-bold text-[#EDE8E0]">PDV — Ponto de Venda</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${isOnline ? 'border-[rgba(76,175,130,0.18)] bg-[rgba(76,175,130,0.12)] text-[#4CAF82]' : 'border-[rgba(224,82,82,0.18)] bg-[rgba(224,82,82,0.12)] text-[#E05252]'}`}>
                                    <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-[#4CAF82]' : 'bg-[#E05252]'}`} />
                                    {isOnline ? 'Online' : 'Sem conexão'}
                                </div>
                                <span className="text-xs text-[#888480]">{userName} · {userRole}</span>
                            </div>
                        </div>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4A4A52]">🔍</span>
                            <input
                                ref={searchRef}
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Buscar por nome ou código..."
                                className="h-9 w-full rounded-lg border border-[rgba(255,255,255,0.07)] bg-[#18181C] pl-8 pr-14 text-[13px] text-[#EDE8E0] placeholder:text-[#4A4A52] outline-none transition focus:border-[rgba(200,169,122,0.3)] focus:bg-[#202024]"
                            />
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-[rgba(255,255,255,0.07)] bg-[#202024] px-1.5 py-0.5 text-[10px] font-bold text-[#4A4A52]">F2</span>
                        </div>
                    </div>

                    {/* Category pills */}
                    <div className="flex flex-shrink-0 gap-1.5 overflow-x-auto border-b border-[rgba(255,255,255,0.07)] bg-[#111113] px-5 py-2 [&::-webkit-scrollbar]:hidden">
                        {CATEGORIES.map(cat => (
                            <button key={cat} type="button" onClick={() => setActiveCategory(cat)}
                                className={`flex-shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-medium transition ${activeCategory === cat ? 'border-[rgba(200,169,122,0.3)] bg-[rgba(200,169,122,0.15)] font-semibold text-[#C8A97A]' : 'border-[rgba(255,255,255,0.07)] text-[#888480] hover:bg-[rgba(255,255,255,0.035)] hover:text-[#EDE8E0]'}`}>
                                {cat}
                            </button>
                        ))}
                    </div>

                    {/* Product grid */}
                    <div className="flex-1 overflow-y-auto bg-[#0A0A0B] p-5 [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-thumb]:rounded-sm [&::-webkit-scrollbar-thumb]:bg-[rgba(255,255,255,0.07)]">
                        {isLoadingProducts ? (
                            <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-3 2xl:grid-cols-4">
                                {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-[168px] animate-pulse rounded-[10px] bg-[#18181C]" />)}
                            </div>
                        ) : products.length === 0 ? (
                            <div className="flex h-full flex-col items-center justify-center gap-3 text-[#4A4A52]">
                                <span className="text-4xl opacity-25">🔍</span>
                                <p className="text-sm">Nenhum produto encontrado.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-3 2xl:grid-cols-4">
                                {products.map(product => {
                                    const inCart = Boolean(cart[product.id]);
                                    const isOut = product.stock_quantity === 0;
                                    const isLast = product.stock_quantity === 1;
                                    return (
                                        <div key={product.id} onClick={() => addToCart(product)}
                                            className={`cursor-pointer overflow-hidden rounded-[10px] border bg-[#18181C] transition ${isOut ? 'cursor-not-allowed border-[rgba(255,255,255,0.07)] opacity-35' : inCart ? 'border-[rgba(200,169,122,0.3)] bg-[rgba(200,169,122,0.06)]' : 'border-[rgba(255,255,255,0.07)] hover:-translate-y-px hover:border-[rgba(200,169,122,0.3)] hover:bg-[#202024] hover:shadow-[0_4px_16px_rgba(0,0,0,0.4)]'}`}>
                                            <div className="flex aspect-square w-full items-center justify-center bg-[#202024] text-3xl">💎</div>
                                            <div className="px-2.5 pb-2.5 pt-2">
                                                <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-[0.5px] text-[#4A4A52]">{product.code}</p>
                                                <p className="mb-1.5 text-[12px] font-semibold leading-tight text-[#EDE8E0]">{product.name}</p>
                                                <p className="font-serif text-[14px] font-bold text-[#C8A97A]">{fmtCurrency(product.price_cents)}</p>
                                                <div className="mt-1.5 flex items-center justify-between">
                                                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${isOut ? 'bg-[rgba(224,82,82,0.12)] text-[#E05252]' : isLast ? 'bg-[rgba(240,160,64,0.12)] text-[#F0A040]' : 'bg-[rgba(76,175,130,0.12)] text-[#4CAF82]'}`}>
                                                        {isOut ? 'Sem estoque' : isLast ? 'Último' : `${product.stock_quantity} un`}
                                                    </span>
                                                    <button type="button" disabled={isOut} onClick={e => { e.stopPropagation(); addToCart(product); }}
                                                        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-[6px] bg-[#C8A97A] text-[15px] font-bold text-black transition hover:bg-[#E8D5B0] disabled:cursor-not-allowed disabled:bg-[#202024] disabled:text-[#4A4A52]">+</button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── RIGHT PANEL ── */}
                <div className="flex w-[370px] flex-shrink-0 flex-col overflow-hidden bg-[#111113]">
                    {/* Scrollable content */}
                    <div className="flex flex-1 flex-col overflow-y-auto [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-thumb]:rounded-sm [&::-webkit-scrollbar-thumb]:bg-[rgba(255,255,255,0.07)]">

                        {/* Cart header */}
                        <div className="flex flex-shrink-0 items-center justify-between border-b border-[rgba(255,255,255,0.07)] px-[18px] py-[13px]">
                            <div className="flex items-center gap-1.5 font-serif text-[15px] font-bold text-[#EDE8E0]">
                                Carrinho
                                {totalQty > 0 && <span className="rounded-full bg-[#C8A97A] px-1.5 py-0.5 text-[10px] font-bold text-black">{totalQty}</span>}
                            </div>
                            {hasCart && (
                                <button type="button" onClick={clearCart} className="text-[11px] text-[#4A4A52] transition hover:text-[#E05252]">Limpar tudo</button>
                            )}
                        </div>

                        {/* Cart items */}
                        <div className="px-[18px] py-2.5">
                            {cartItems.length === 0 && !linkedCustomOrder ? (
                                <div className="flex flex-col items-center justify-center gap-2.5 py-6 text-center text-[#4A4A52]">
                                    <span className="text-4xl opacity-25">🛍️</span>
                                    <p className="text-[12px] leading-relaxed">Carrinho vazio.<br />Clique em um produto para adicionar.</p>
                                </div>
                            ) : (
                                <>
                                    {cartItems.map(item => (
                                        <div key={item.productId} className="flex items-center gap-2 border-b border-[rgba(255,255,255,0.07)] py-2 last:border-b-0">
                                            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[6px] bg-[#202024] text-base">💎</div>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-[12px] font-semibold text-[#EDE8E0]">{item.name}</p>
                                                <p className="mt-px text-[11px] text-[#4A4A52]">{fmtCurrency(item.priceCents)} / un</p>
                                            </div>
                                            <div className="flex flex-shrink-0 items-center gap-1">
                                                <button type="button" onClick={() => changeQuantity(item.productId, -1)} aria-label="Diminuir"
                                                    className="flex h-[22px] w-[22px] items-center justify-center rounded-[5px] border border-[rgba(255,255,255,0.07)] bg-[#202024] text-[13px] font-bold text-[#EDE8E0] hover:border-[rgba(200,169,122,0.3)] hover:text-[#C8A97A]">−</button>
                                                <span className="min-w-[18px] text-center text-[13px] font-bold text-[#EDE8E0]">{item.quantity}</span>
                                                <button type="button" disabled={item.quantity >= item.stock} onClick={() => changeQuantity(item.productId, 1)} aria-label="Aumentar"
                                                    className="flex h-[22px] w-[22px] items-center justify-center rounded-[5px] border border-[rgba(255,255,255,0.07)] bg-[#202024] text-[13px] font-bold text-[#EDE8E0] hover:border-[rgba(200,169,122,0.3)] hover:text-[#C8A97A] disabled:cursor-not-allowed disabled:opacity-30">+</button>
                                            </div>
                                            <span className="min-w-[64px] flex-shrink-0 text-right font-serif text-[13px] font-bold text-[#C8A97A]">{fmtCurrency(item.priceCents * item.quantity)}</span>
                                            <button type="button" onClick={() => removeFromCart(item.productId)} aria-label="Remover" className="p-0.5 text-[13px] text-[#4A4A52] hover:text-[#E05252]">✕</button>
                                        </div>
                                    ))}

                                    {/* Custom order item */}
                                    {linkedCustomOrder && (
                                        <div className="mt-2 rounded-[8px] border border-[rgba(167,139,250,0.2)] bg-[rgba(167,139,250,0.06)] p-2.5">
                                            <div className="mb-1.5 flex items-center justify-between">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[14px]">💎</span>
                                                    <span className="text-[12px] font-semibold text-[#EDE8E0] truncate max-w-[160px]">
                                                        {linkedCustomOrder.design_description ?? 'Pedido personalizado'}
                                                    </span>
                                                    <span className="rounded-[4px] bg-[rgba(167,139,250,0.15)] px-1.5 py-0.5 text-[9px] font-bold text-[#A78BFA]">PERS</span>
                                                </div>
                                                <button type="button" onClick={() => setLinkedCustomOrder(null)} className="text-[11px] text-[#4A4A52] hover:text-[#E05252]">✕</button>
                                            </div>
                                            <p className="mb-2 text-[10px] text-[#4A4A52]">{linkedCustomOrder.order_number} · {linkedCustomOrder.customer_name}</p>
                                            <div className="grid grid-cols-3 gap-1.5">
                                                {[
                                                    { label: 'Total pedido', value: linkedCustomOrder.total_amount_cents, color: '#C8A97A' },
                                                    { label: 'Já pago', value: linkedCustomOrder.signal_amount_cents, color: '#4CAF82' },
                                                    { label: 'A cobrar', value: linkedCustomOrder.remaining_amount_cents, color: '#F0A040' },
                                                ].map(({ label, value, color }) => (
                                                    <div key={label} className="rounded-[5px] bg-[#18181C] p-1.5 text-center">
                                                        <p className="text-[8px] text-[#4A4A52]">{label}</p>
                                                        <p className="font-serif text-[11px] font-bold" style={{ color }}>{fmtCurrency(value)}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* ── CLIENTE section ── */}
                        <div className="border-t border-[rgba(255,255,255,0.07)] px-[18px] py-2.5">
                            <div className="mb-2 flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#4A4A52]">Cliente</span>
                                <span className="rounded bg-[#202026] px-1.5 py-0.5 text-[9px] text-[#4A4A52]">opcional</span>
                            </div>

                            {linkedCustomer ? (
                                <div className="flex items-center gap-2 rounded-[8px] border border-[rgba(200,169,122,0.28)] bg-[#202026] px-2.5 py-2">
                                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-[rgba(200,169,122,0.3)] bg-[rgba(200,169,122,0.15)] text-[11px] font-bold text-[#C8A97A]">
                                        {initials(linkedCustomer.name)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <a
                                            href={`/crm/clientes/${linkedCustomer.id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="block truncate text-[12px] font-semibold text-[#EDE8E0] hover:text-[#C8A97A] hover:underline"
                                        >
                                            {linkedCustomer.name}
                                        </a>
                                        <p className="text-[10px] text-[#4A4A52]">
                                            {[linkedCustomer.phone, linkedCustomer.cpf ? `CPF: ${linkedCustomer.cpf}` : null].filter(Boolean).join(' · ')}
                                        </p>
                                    </div>
                                    <button type="button" onClick={unlinkCustomer} className="text-[13px] text-[#4A4A52] hover:text-[#E05252]">✕</button>
                                </div>
                            ) : (
                                <>
                                    <div className="relative">
                                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-[#4A4A52]">🔍</span>
                                        <input
                                            ref={customerSearchRef}
                                            type="text"
                                            value={customerQuery}
                                            onChange={e => setCustomerQuery(e.target.value)}
                                            onFocus={() => customerQuery && setCustomerDropdownOpen(true)}
                                            placeholder="Nome, WhatsApp ou CPF..."
                                            className="h-[34px] w-full rounded-[7px] border border-[rgba(255,255,255,0.07)] bg-[#18181C] pl-7 pr-3 text-[12px] text-[#EDE8E0] placeholder:text-[#4A4A52] outline-none transition focus:border-[rgba(200,169,122,0.3)]"
                                        />
                                        {customerSearchLoading && (
                                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin rounded-full border border-[#C8A97A]/30 border-t-[#C8A97A]" />
                                        )}
                                    </div>

                                    {/* Search dropdown */}
                                    {customerDropdownOpen && customerResults.length > 0 && (
                                        <div className="mt-1 overflow-hidden rounded-[7px] border border-[rgba(255,255,255,0.11)] bg-[#18181C]">
                                            {customerResults.map(c => (
                                                <button key={c.id} type="button" onClick={() => linkCustomer(c)}
                                                    className="flex w-full items-center gap-2 border-b border-[rgba(255,255,255,0.07)] px-2.5 py-2 text-left last:border-b-0 hover:bg-[#202026]">
                                                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[rgba(200,169,122,0.15)] text-[10px] font-bold text-[#C8A97A]">
                                                        {initials(c.name)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="truncate text-[12px] font-semibold text-[#EDE8E0]">{c.name}</p>
                                                        <p className="text-[10px] text-[#4A4A52]">{c.phone}</p>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Quick form toggle */}
                                    {!quickFormOpen && (
                                        <button type="button" onClick={() => setQuickFormOpen(true)}
                                            className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-[7px] border border-dashed border-[rgba(200,169,122,0.28)] bg-[rgba(200,169,122,0.06)] py-1.5 text-[11px] font-semibold text-[#C8A97A] transition hover:bg-[rgba(200,169,122,0.12)]">
                                            + Cadastro rápido
                                        </button>
                                    )}

                                    {/* Quick form */}
                                    {quickFormOpen && (
                                        <div className="mt-1.5 flex flex-col gap-1.5">
                                            <input type="text" value={qfName} onChange={e => setQfName(e.target.value)} placeholder="Nome completo *"
                                                className="h-[30px] w-full rounded-[6px] border border-[rgba(255,255,255,0.07)] bg-[#202026] px-2.5 text-[12px] text-[#EDE8E0] placeholder:text-[#4A4A52] outline-none focus:border-[rgba(200,169,122,0.3)]" />
                                            <div className="grid grid-cols-2 gap-1.5">
                                                <input type="text" value={qfPhone} onChange={e => setQfPhone(e.target.value)} placeholder="WhatsApp *"
                                                    className="h-[30px] rounded-[6px] border border-[rgba(255,255,255,0.07)] bg-[#202026] px-2.5 text-[12px] text-[#EDE8E0] placeholder:text-[#4A4A52] outline-none focus:border-[rgba(200,169,122,0.3)]" />
                                                <input type="text" value={qfEmail} onChange={e => setQfEmail(e.target.value)} placeholder="E-mail"
                                                    className="h-[30px] rounded-[6px] border border-[rgba(255,255,255,0.07)] bg-[#202026] px-2.5 text-[12px] text-[#EDE8E0] placeholder:text-[#4A4A52] outline-none focus:border-[rgba(200,169,122,0.3)]" />
                                            </div>
                                            <input type="text" value={qfCpf} onChange={e => setQfCpf(e.target.value)} placeholder="CPF ou CNPJ"
                                                className="h-[30px] w-full rounded-[6px] border border-[rgba(255,255,255,0.07)] bg-[#202026] px-2.5 text-[12px] text-[#EDE8E0] placeholder:text-[#4A4A52] outline-none focus:border-[rgba(200,169,122,0.3)]" />
                                            {qfError && <p className="text-[10px] text-[#E05252]">{qfError}</p>}
                                            <div className="flex gap-1.5">
                                                <button type="button" onClick={() => { setQuickFormOpen(false); setQfError(null); }}
                                                    className="flex h-[28px] flex-1 items-center justify-center rounded-[6px] border border-[rgba(255,255,255,0.07)] text-[11px] font-semibold text-[#888480] hover:text-[#EDE8E0]">Cancelar</button>
                                                <button type="button" disabled={!qfName.trim() || !qfPhone.trim() || qfSaving} onClick={() => void handleQuickSave()}
                                                    className="flex h-[28px] flex-1 items-center justify-center rounded-[6px] bg-[#C8A97A] text-[11px] font-bold text-black transition hover:bg-[#E8D5B0] disabled:cursor-not-allowed disabled:bg-[#202026] disabled:text-[#4A4A52]">
                                                    {qfSaving ? '...' : 'Salvar e vincular'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* ── PEDIDO PERSONALIZADO section ── */}
                        <div className="border-t border-[rgba(255,255,255,0.07)] px-[18px] py-2.5">
                            <div className="mb-2 flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#4A4A52]">Pedido personalizado</span>
                                <span className="rounded bg-[#202026] px-1.5 py-0.5 text-[9px] text-[#4A4A52]">opcional</span>
                            </div>

                            {!linkedCustomOrder ? (
                                <div className="relative">
                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-[#4A4A52]">💎</span>
                                    <input
                                        type="text"
                                        value={customOrderQuery}
                                        onChange={e => setCustomOrderQuery(e.target.value)}
                                        onFocus={() => customOrderQuery && setCustomOrderDropdownOpen(true)}
                                        placeholder="Nº do pedido ou nome do cliente..."
                                        className="h-[34px] w-full rounded-[7px] border border-[rgba(255,255,255,0.07)] bg-[#18181C] pl-7 pr-3 text-[12px] text-[#EDE8E0] placeholder:text-[#4A4A52] outline-none transition focus:border-[rgba(167,139,250,0.4)]"
                                    />
                                    {customOrderLoading && (
                                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin rounded-full border border-[#A78BFA]/30 border-t-[#A78BFA]" />
                                    )}

                                    {customOrderDropdownOpen && customOrderResults.length > 0 && (
                                        <div className="mt-1 overflow-hidden rounded-[7px] border border-[rgba(255,255,255,0.11)] bg-[#18181C]">
                                            {customOrderResults.map(order => (
                                                <button key={order.id} type="button" onClick={() => linkCustomOrder(order)}
                                                    className="flex w-full flex-col gap-0.5 border-b border-[rgba(255,255,255,0.07)] px-2.5 py-2 text-left last:border-b-0 hover:bg-[#202026]">
                                                    <span className="text-[11px] font-bold text-[#A78BFA]">{order.order_number}</span>
                                                    <span className="truncate text-[12px] font-semibold text-[#EDE8E0]">{order.design_description ?? 'Pedido personalizado'}</span>
                                                    <span className="text-[10px] text-[#4A4A52]">
                                                        {order.customer_name} · Sinal: {fmtCurrency(order.signal_amount_cents)} · Restante: {fmtCurrency(order.remaining_amount_cents)}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {customOrderDropdownOpen && customOrderResults.length === 0 && !customOrderLoading && customOrderQuery.trim() && (
                                        <div className="mt-1 rounded-[7px] border border-[rgba(255,255,255,0.07)] bg-[#18181C] px-3 py-2 text-[11px] text-[#4A4A52]">
                                            Nenhum pedido personalizado encontrado.
                                        </div>
                                    )}
                                </div>
                            ) : null}
                        </div>

                        {/* ── DESCONTO ── */}
                        {hasCart && (
                            <div className="border-t border-[rgba(255,255,255,0.07)] px-[18px] py-2.5">
                                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.6px] text-[#4A4A52]">Desconto</p>
                                <div className="mb-1.5 flex gap-1.5">
                                    {(['real', 'pct'] as const).map(t => (
                                        <button key={t} type="button" onClick={() => { setDiscountType(t); setDiscountValue(''); }}
                                            className={`h-7 flex-1 rounded-[6px] border text-[11px] font-semibold transition ${discountType === t ? 'border-[rgba(200,169,122,0.3)] bg-[rgba(200,169,122,0.15)] text-[#C8A97A]' : 'border-[rgba(255,255,255,0.07)] text-[#888480]'}`}>
                                            {t === 'real' ? 'R$ Valor' : '% Percentual'}
                                        </button>
                                    ))}
                                </div>
                                <div className="relative">
                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-[#4A4A52]">{discountType === 'real' ? 'R$' : '%'}</span>
                                    <input type="number" min="0" value={discountValue} onChange={e => setDiscountValue(e.target.value)} placeholder="0,00"
                                        className="h-[34px] w-full rounded-[7px] border border-[rgba(255,255,255,0.07)] bg-[#18181C] pl-7 pr-3 text-[13px] text-[#EDE8E0] placeholder:text-[#4A4A52] outline-none focus:border-[rgba(200,169,122,0.3)]" />
                                </div>
                            </div>
                        )}

                        {/* ── TOTAIS ── */}
                        {hasCart && (
                            <div className="border-t border-[rgba(255,255,255,0.07)] px-[18px] py-2.5">
                                {linkedCustomOrder ? (
                                    <>
                                        {subtotalCents > 0 && (
                                            <div className="mb-1 flex justify-between text-[12px]">
                                                <span className="text-[#888480]">Produtos</span>
                                                <span className="font-semibold text-[#EDE8E0]">{fmtCurrency(subtotalCents - discountCents)}</span>
                                            </div>
                                        )}
                                        <div className="mb-1 flex justify-between text-[12px]">
                                            <span className="text-[#888480]">Valor do pedido</span>
                                            <span className="font-semibold text-[#EDE8E0]">{fmtCurrency(linkedCustomOrder.total_amount_cents)}</span>
                                        </div>
                                        <div className="mb-1 flex justify-between text-[12px]">
                                            <span className="text-[#888480]">Sinal já pago</span>
                                            <span className="font-semibold text-[#4CAF82]">− {fmtCurrency(linkedCustomOrder.signal_amount_cents)}</span>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="mb-1 flex justify-between text-[12px]">
                                            <span className="text-[#888480]">Subtotal</span>
                                            <span className="font-semibold text-[#EDE8E0]">{fmtCurrency(subtotalCents)}</span>
                                        </div>
                                        <div className="mb-1 flex justify-between text-[12px]">
                                            <span className="text-[#888480]">Desconto</span>
                                            <span className="font-semibold text-[#E05252]">{discountCents > 0 ? `− ${fmtCurrency(discountCents)}` : '− R$ 0,00'}</span>
                                        </div>
                                    </>
                                )}
                                <div className="mt-2 flex justify-between border-t border-[rgba(255,255,255,0.11)] pt-2">
                                    <span className="text-[14px] font-bold text-[#EDE8E0]">{linkedCustomOrder ? 'Total a cobrar' : 'Total'}</span>
                                    <span className="font-serif text-[19px] font-bold text-[#C8A97A]">{fmtCurrency(totalCents)}</span>
                                </div>
                                {selectedPayment === 'DINHEIRO' && cashReceivedCents > 0 && cashReceivedCents >= totalCents && (
                                    <div className="mt-1.5 flex items-center justify-between rounded-[7px] border border-[rgba(76,175,130,0.18)] bg-[rgba(76,175,130,0.12)] px-2.5 py-1.5">
                                        <span className="text-[11px] font-semibold text-[#4CAF82]">Troco</span>
                                        <span className="font-serif text-[14px] font-bold text-[#4CAF82]">{fmtCurrency(trocoCents)}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── PAGAMENTO ── */}
                        {hasCart && (
                            <div className="border-t border-[rgba(255,255,255,0.07)] px-[18px] py-2.5">
                                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.6px] text-[#4A4A52]">Forma de pagamento</p>
                                <div className="grid grid-cols-2 gap-1.5 [&>*:last-child:nth-child(odd)]:col-span-2">
                                    {PAYMENT_METHODS.map(method => (
                                        <button key={method.value} type="button"
                                            onClick={() => { setSelectedPayment(method.value); setCashReceived(''); setInstallments(1); }}
                                            className={`rounded-[8px] border px-2 py-2.5 text-center transition ${selectedPayment === method.value ? 'border-[rgba(200,169,122,0.3)] bg-[rgba(200,169,122,0.15)]' : 'border-[rgba(255,255,255,0.07)] bg-[#18181C] hover:border-[rgba(200,169,122,0.3)] hover:bg-[#202024]'}`}>
                                            <div className="text-[16px]">{method.icon}</div>
                                            <div className={`text-[11px] font-semibold ${selectedPayment === method.value ? 'text-[#C8A97A]' : 'text-[#888480]'}`}>{method.label}</div>
                                        </button>
                                    ))}
                                </div>

                                {selectedPayment === 'DINHEIRO' && (
                                    <div className="mt-2">
                                        <p className="mb-1.5 text-[11px] text-[#888480]">Valor recebido</p>
                                        <div className="relative">
                                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-[#4A4A52]">R$</span>
                                            <input type="number" min="0" value={cashReceived} onChange={e => setCashReceived(e.target.value)} placeholder="0,00"
                                                className="h-[34px] w-full rounded-[7px] border border-[rgba(255,255,255,0.07)] bg-[#18181C] pl-7 pr-3 font-serif text-[14px] font-bold text-[#EDE8E0] placeholder:text-[#4A4A52] outline-none focus:border-[rgba(200,169,122,0.3)]" />
                                        </div>
                                    </div>
                                )}

                                {selectedPayment === 'PIX' && (
                                    <div className="mt-2 rounded-[7px] border border-[rgba(255,255,255,0.07)] bg-[#18181C] px-3 py-2">
                                        <p className="mb-1 text-[10px] text-[#4A4A52]">Chave PIX</p>
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="min-w-0 truncate text-[12px] font-semibold text-[#EDE8E0]">
                                                {settings.pix_key || <span className="text-[#4A4A52]">Não configurada</span>}
                                            </p>
                                            {settings.pix_key && (
                                                <button type="button" onClick={() => copyText(settings.pix_key!, setPixCopied)}
                                                    className="flex-shrink-0 rounded-[5px] border border-[rgba(200,169,122,0.3)] bg-[rgba(200,169,122,0.15)] px-2 py-1 text-[10px] font-semibold text-[#C8A97A] hover:bg-[rgba(200,169,122,0.25)]">
                                                    {pixCopied ? '✓ Copiado' : '📋 Copiar'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {selectedPayment === 'CARTAO_CREDITO' && (
                                    <div className="mt-2">
                                        <p className="mb-1.5 text-[11px] text-[#888480]">Parcelas</p>
                                        <select aria-label="Parcelas" value={installments} onChange={e => setInstallments(Number(e.target.value))}
                                            className="h-[34px] w-full rounded-[7px] border border-[rgba(255,255,255,0.07)] bg-[#18181C] px-3 text-[12px] text-[#EDE8E0] outline-none focus:border-[rgba(200,169,122,0.3)]">
                                            <option value={1}>1× sem juros</option>
                                            <option value={2}>2× sem juros</option>
                                            <option value={3}>3× sem juros</option>
                                            <option value={4}>4× com juros (1,99%)</option>
                                            <option value={6}>6× com juros (1,99%)</option>
                                            <option value={12}>12× com juros (1,99%)</option>
                                        </select>
                                    </div>
                                )}

                                {selectedPayment === 'LINK_PAGAMENTO' && (
                                    <div className="mt-2 rounded-[7px] border border-[rgba(255,255,255,0.07)] bg-[#18181C] px-3 py-2">
                                        <p className="text-[11px] text-[#888480]">Um link de pagamento Mercado Pago será gerado ao finalizar a venda.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ── BOTTOM: error + finalize ── */}
                    <div className="flex-shrink-0 border-t border-[rgba(255,255,255,0.07)]">
                        {submitError && (
                            <div className="mx-[18px] mt-2 rounded-[7px] border border-[rgba(224,82,82,0.3)] bg-[rgba(224,82,82,0.1)] px-3 py-2 text-[12px] text-[#E05252]">
                                {submitError}
                            </div>
                        )}
                        <div className="px-[18px] pb-3.5 pt-2">
                            <button type="button" disabled={!canSubmit} onClick={() => void handleFinalize()}
                                className="flex h-[46px] w-full items-center justify-center rounded-[10px] bg-[#C8A97A] text-[14px] font-bold text-black transition hover:enabled:translate-y-[-1px] hover:enabled:bg-[#E8D5B0] hover:enabled:shadow-[0_4px_16px_rgba(200,169,122,0.2)] disabled:cursor-not-allowed disabled:bg-[#202024] disabled:text-[#4A4A52]">
                                {isSubmitting ? (
                                    <span className="flex items-center gap-2">
                                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                                        Processando...
                                    </span>
                                ) : 'Finalizar Venda'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── RECEIPT MODAL ── */}
            {receipt && (
                <ReceiptModal
                    order={receipt}
                    customer={linkedCustomer ? { id: linkedCustomer.id, name: linkedCustomer.name, phone: linkedCustomer.phone, email: linkedCustomer.email ?? undefined, cpf_cnpj: linkedCustomer.cpf ?? undefined } : null}
                    attendant={userName}
                    settings={settings}
                    onClose={() => setReceipt(null)}
                    onNewSale={handleNewSale}
                />
            )}
        </>
    );
}
