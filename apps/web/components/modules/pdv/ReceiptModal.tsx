'use client';

import { useEffect, useRef, useState } from 'react';

export interface StoreReceiptSettings {
    company_name: string;
    cnpj?: string | null;
    phone?: string | null;
    address?: Record<string, string> | null;
    pix_key?: string | null;
    receipt_thanks_message?: string | null;
    receipt_exchange_policy?: string | null;
    receipt_warranty?: string | null;
}

export interface ReceiptOrderItem {
    name: string;
    code: string;
    metal?: string | null;
    weight_grams?: number | null;
    quantity: number;
    unitPriceCents: number;
}

export interface ReceiptOrder {
    orderId?: string;
    orderNumber: string;
    createdAt: Date;
    items: ReceiptOrderItem[];
    subtotalCents: number;
    discountCents: number;
    totalCents: number;
    paymentMethod: 'DINHEIRO' | 'PIX' | 'CARTAO_DEBITO' | 'CARTAO_CREDITO' | 'LINK_PAGAMENTO';
    cashReceivedCents?: number;
    installments?: number;
    paymentUrl?: string;
}

interface ReceiptModalProps {
    order: ReceiptOrder;
    customer?: { id: string; name: string; phone?: string; email?: string; cpf_cnpj?: string } | null;
    attendant: string;
    settings: StoreReceiptSettings;
    onClose: () => void;
    onNewSale: () => void;
}

function fmtCurrency(cents: number) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

function fmtDateTime(date: Date) {
    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    }).format(date).replace(', ', ' às ');
}

function fmtAddress(address: Record<string, string> | null | undefined): string {
    if (!address) return '';
    const parts: string[] = [];
    if (address['street']) parts.push(address['street']);
    if (address['number']) parts.push(address['number']);
    if (address['city'] && address['state']) parts.push(`${address['city']} - ${address['state']}`);
    else if (address['city']) parts.push(address['city']);
    return parts.join(' · ');
}

function initials(name: string): string {
    return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

const PAYMENT_LABELS: Record<string, string> = {
    DINHEIRO: 'Dinheiro',
    PIX: 'PIX',
    CARTAO_DEBITO: 'Cartão de Débito',
    CARTAO_CREDITO: 'Cartão de Crédito',
    LINK_PAGAMENTO: 'Link Mercado Pago',
};

export function ReceiptModal({ order, customer, attendant, settings, onClose, onNewSale }: ReceiptModalProps) {
    const [pixCopied, setPixCopied] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);
    const [nfeLoading, setNfeLoading] = useState(false);
    const [nfeMsg, setNfeMsg] = useState<string | null>(null);
    const nfeMsgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const trocoCents = order.paymentMethod === 'DINHEIRO' && order.cashReceivedCents
        ? Math.max(0, order.cashReceivedCents - order.totalCents)
        : 0;

    const addressStr = fmtAddress(order.paymentMethod === 'PIX' ? null : settings.address);

    useEffect(() => {
        const style = document.createElement('style');
        style.id = 'receipt-print-style';
        // visibility:hidden em TUDO, visibility:visible só no receipt e seus filhos
        // Funciona independente de quantos wrappers o Next.js adiciona no DOM
        style.textContent = `
            @media print {
                * { visibility: hidden !important; }
                #receipt-print-area,
                #receipt-print-area * { visibility: visible !important; }

                #receipt-print-area {
                    position: fixed !important;
                    top: 0 !important;
                    left: 50% !important;
                    transform: translateX(-50%) !important;
                    width: 80mm !important;
                    max-width: 80mm !important;
                    max-height: none !important;
                    overflow: visible !important;
                    padding: 8mm !important;
                    background: white !important;
                    color: black !important;
                    font-size: 10px !important;
                    box-shadow: none !important;
                    border: none !important;
                    border-radius: 0 !important;
                    z-index: 9999 !important;
                }
                .receipt-actions,
                .receipt-nf-row,
                .receipt-hint { visibility: hidden !important; height: 0 !important; overflow: hidden !important; }
                .receipt-store-name { color: #B8924A !important; }
                .receipt-item-total { color: #B8924A !important; }
                .receipt-total-value span { color: #B8924A !important; }
                .receipt-order-barcode {
                    visibility: visible !important;
                    display: block !important;
                    font-family: monospace !important;
                    font-size: 8px !important;
                    letter-spacing: 3px !important;
                    text-align: center !important;
                    margin-top: 8px !important;
                    color: #999 !important;
                }
            }
        `;
        document.head.appendChild(style);
        return () => { document.getElementById('receipt-print-style')?.remove(); };
    }, []);

    function copyText(text: string, set: (v: boolean) => void) {
        navigator.clipboard?.writeText(text).catch(() => {});
        set(true);
        setTimeout(() => set(false), 2000);
    }

    const storeInfoParts: string[] = [];
    if (addressStr) storeInfoParts.push(addressStr);
    if (settings.cnpj) storeInfoParts.push(`CNPJ: ${settings.cnpj}`);
    if (settings.phone) storeInfoParts.push(settings.phone);

    return (
        <div id="receipt-overlay" className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-[4px]">
            <div
                id="receipt-print-area"
                className="mx-4 flex max-h-[92vh] w-full max-w-[430px] flex-col overflow-hidden rounded-[16px] border border-[rgba(255,255,255,0.11)] bg-[#18181C] shadow-[0_24px_72px_rgba(0,0,0,0.7)]"
            >
                {/* HEADER */}
                <div className="flex-shrink-0 border-b border-[rgba(255,255,255,0.07)] px-6 pb-4 pt-5 text-center">
                    <div className="mx-auto mb-2.5 flex h-[50px] w-[50px] items-center justify-center rounded-[14px] border border-[rgba(76,175,130,0.25)] bg-[rgba(76,175,130,0.12)] text-[24px]">
                        ✅
                    </div>
                    <p className="font-serif text-[19px] font-bold text-[#EDE8E0]">Venda Concluída!</p>
                    <p className="mt-1 text-[12px] text-[#4A4A52]">{order.orderNumber} · Estoque descontado</p>
                </div>

                {/* SCROLLABLE BODY */}
                <div className="flex-1 overflow-y-auto px-6 py-4 [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-thumb]:bg-[rgba(255,255,255,0.07)]">

                    {/* Store info */}
                    <div className="mb-3 border-b border-dashed border-[rgba(255,255,255,0.11)] pb-3 text-center">
                        <p className="receipt-store-name font-serif text-[15px] font-bold tracking-[0.5px] text-[#C8A97A]">
                            {settings.company_name}
                        </p>
                        {storeInfoParts.length > 0 && (
                            <p className="mt-1 text-[10px] leading-[1.7] text-[#4A4A52]">
                                {storeInfoParts.join(' · ')}
                            </p>
                        )}
                    </div>

                    {/* Meta: date + attendant */}
                    <div className="mb-2.5 grid grid-cols-2 gap-x-3 gap-y-1">
                        <div className="flex flex-col">
                            <span className="text-[9px] uppercase tracking-[0.5px] text-[#4A4A52]">Data / Hora</span>
                            <span className="mt-0.5 text-[12px] font-semibold text-[#EDE8E0]">
                                {fmtDateTime(order.createdAt)}
                            </span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[9px] uppercase tracking-[0.5px] text-[#4A4A52]">Atendente</span>
                            <span className="mt-0.5 text-[12px] font-semibold text-[#EDE8E0]">{attendant}</span>
                        </div>
                    </div>

                    {/* Customer badge */}
                    {customer && (
                        <div className="mb-3 flex items-center gap-2 rounded-[7px] border border-[rgba(200,169,122,0.28)] bg-[rgba(200,169,122,0.12)] px-3 py-2">
                            <div className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full border border-[rgba(200,169,122,0.3)] bg-[rgba(200,169,122,0.2)] text-[11px] font-bold text-[#C8A97A]">
                                {initials(customer.name)}
                            </div>
                            <div className="min-w-0">
                                <p className="text-[12px] font-semibold text-[#EDE8E0]">{customer.name}</p>
                                <p className="text-[10px] text-[#4A4A52]">
                                    {[customer.cpf_cnpj, customer.phone].filter(Boolean).join(' · ')}
                                </p>
                            </div>
                        </div>
                    )}

                    <hr className="my-2.5 border-dashed border-[rgba(255,255,255,0.11)]" />

                    {/* Items */}
                    {order.items.map((item, i) => {
                        const detail = [item.code, item.metal, item.weight_grams ? `${item.weight_grams}g` : null, `${item.quantity} un × ${fmtCurrency(item.unitPriceCents)}`].filter(Boolean).join(' · ');
                        return (
                            <div key={i} className="mb-2.5 flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-[13px] font-semibold text-[#EDE8E0]">{item.name}</p>
                                    <p className="mt-0.5 text-[10px] text-[#4A4A52]">{detail}</p>
                                </div>
                                <span className="receipt-item-total flex-shrink-0 font-serif text-[13px] font-bold text-[#C8A97A]">
                                    {fmtCurrency(item.unitPriceCents * item.quantity)}
                                </span>
                            </div>
                        );
                    })}

                    <hr className="my-2.5 border-dashed border-[rgba(255,255,255,0.11)]" />

                    {/* Totals */}
                    <div className="mb-1 flex justify-between text-[11px]">
                        <span className="text-[#888480]">Subtotal</span>
                        <span className="font-semibold text-[#EDE8E0]">{fmtCurrency(order.subtotalCents)}</span>
                    </div>
                    {order.discountCents > 0 && (
                        <div className="mb-1 flex justify-between text-[11px]">
                            <span className="text-[#888480]">Desconto</span>
                            <span className="font-semibold text-[#E05252]">− {fmtCurrency(order.discountCents)}</span>
                        </div>
                    )}
                    <div className="receipt-total-value mt-2 flex justify-between border-t border-[rgba(255,255,255,0.11)] pt-2">
                        <span className="text-[14px] font-bold text-[#EDE8E0]">Total</span>
                        <span className="font-serif text-[20px] font-bold text-[#C8A97A]">{fmtCurrency(order.totalCents)}</span>
                    </div>

                    {/* Payment box */}
                    <div className="mt-2.5 rounded-[8px] border border-[rgba(255,255,255,0.07)] bg-[#202026] px-3 py-2.5">
                        <div className="mb-1 flex justify-between text-[11px]">
                            <span className="text-[#4A4A52]">Forma de pagamento</span>
                            <span className="font-semibold text-[#EDE8E0]">{PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod}</span>
                        </div>

                        {order.paymentMethod === 'DINHEIRO' && order.cashReceivedCents !== undefined && (
                            <>
                                <div className="mb-1 flex justify-between text-[11px]">
                                    <span className="text-[#4A4A52]">Valor recebido</span>
                                    <span className="font-semibold text-[#EDE8E0]">{fmtCurrency(order.cashReceivedCents)}</span>
                                </div>
                                <div className="flex justify-between text-[11px]">
                                    <span className="text-[#4A4A52]">Troco</span>
                                    <span className="font-semibold text-[#4CAF82]">{fmtCurrency(trocoCents)}</span>
                                </div>
                            </>
                        )}

                        {order.paymentMethod === 'PIX' && (
                            <>
                                <div className="mb-2 flex justify-between text-[11px]">
                                    <span className="text-[#4A4A52]">Status</span>
                                    <span className="font-semibold text-[#4CAF82]">✓ Confirmado</span>
                                </div>
                                {settings.pix_key && (
                                    <div className="border-t border-[rgba(255,255,255,0.07)] pt-2">
                                        <p className="mb-1 text-[9px] text-[#4A4A52]">Chave PIX</p>
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-mono text-[11px] font-semibold text-[#888480]">{settings.pix_key}</span>
                                            <button
                                                type="button"
                                                onClick={() => copyText(settings.pix_key!, setPixCopied)}
                                                className="flex-shrink-0 rounded-[4px] border border-[rgba(200,169,122,0.3)] bg-[rgba(200,169,122,0.15)] px-1.5 py-0.5 text-[9px] font-semibold text-[#C8A97A]"
                                            >
                                                {pixCopied ? '✓' : '📋'}
                                            </button>
                                        </div>
                                        <p className="mt-1 text-[11px] font-bold text-[#C8A97A]">{fmtCurrency(order.totalCents)}</p>
                                    </div>
                                )}
                            </>
                        )}

                        {order.paymentMethod === 'CARTAO_CREDITO' && order.installments && order.installments > 1 && (
                            <div className="flex justify-between text-[11px]">
                                <span className="text-[#4A4A52]">Parcelas</span>
                                <span className="font-semibold text-[#EDE8E0]">
                                    {order.installments}× de {fmtCurrency(Math.ceil(order.totalCents / order.installments))}
                                </span>
                            </div>
                        )}

                        {order.paymentMethod === 'LINK_PAGAMENTO' && order.paymentUrl && (
                            <>
                                <div className="mt-2 border-t border-[rgba(255,255,255,0.07)] pt-2">
                                    <p className="mb-1 text-[9px] text-[#4A4A52]">Link de pagamento</p>
                                    <div className="flex items-center gap-2">
                                        <p className="min-w-0 flex-1 truncate font-mono text-[10px] text-[#C8A97A]">{order.paymentUrl}</p>
                                        <button
                                            type="button"
                                            onClick={() => copyText(order.paymentUrl!, setLinkCopied)}
                                            className="flex-shrink-0 rounded-[4px] border border-[rgba(200,169,122,0.3)] bg-[rgba(200,169,122,0.15)] px-1.5 py-0.5 text-[9px] font-semibold text-[#C8A97A]"
                                        >
                                            {linkCopied ? '✓' : '📋'}
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="mt-3 border-t border-dashed border-[rgba(255,255,255,0.11)] pt-3 text-center">
                        {settings.receipt_thanks_message && (
                            <p className="mb-1.5 font-serif text-[12px] text-[#C8A97A]">{settings.receipt_thanks_message}</p>
                        )}
                        <p className="text-[10px] leading-[1.7] text-[#4A4A52]">
                            {[settings.receipt_exchange_policy, settings.receipt_warranty].filter(Boolean).join(' · ')}
                        </p>
                        {settings.phone && (
                            <p className="mt-1 text-[10px] text-[#4A4A52]">{settings.phone}</p>
                        )}
                        <p className="receipt-order-barcode mt-2 hidden font-mono text-[8px] tracking-[3px] text-[#4A4A52]">
                            ||| {order.orderNumber} |||
                        </p>
                    </div>

                </div>

                {/* MAIN ACTIONS */}
                <div className="receipt-actions flex-shrink-0 flex gap-1.5 px-6 pb-2 pt-3">
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Fechar recibo"
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[8px] border border-[rgba(255,255,255,0.11)] bg-transparent text-[14px] text-[#4A4A52] transition hover:border-[rgba(224,82,82,0.4)] hover:text-[#E05252]"
                    >
                        ✕
                    </button>
                    <button
                        type="button"
                        onClick={() => window.print()}
                        className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[8px] border border-[rgba(255,255,255,0.11)] bg-[#202026] text-[11px] font-semibold text-[#EDE8E0] transition hover:border-[rgba(200,169,122,0.3)] hover:text-[#C8A97A]"
                    >
                        🖨️ Imprimir
                    </button>
                    <button
                        type="button"
                        onClick={onNewSale}
                        className="flex h-9 flex-1 items-center justify-center rounded-[8px] bg-[#C8A97A] text-[11px] font-bold text-black transition hover:bg-[#E8D5B0]"
                    >
                        Nova Venda
                    </button>
                </div>

                {/* NF / ENVIO row (only if customer linked) */}
                {customer && (
                    <>
                        <div className="receipt-nf-row flex-shrink-0 flex gap-1.5 px-6 pb-3">
                            <button
                                type="button"
                                disabled={nfeLoading}
                                onClick={async () => {
                                    if (!order.orderId) { setNfeMsg('ID do pedido indisponível.'); return; }
                                    setNfeLoading(true);
                                    try {
                                        const res = await fetch(`/api/internal/orders/${order.orderId}/nfe`, { method: 'POST' });
                                        const data = (await res.json()) as { message?: string };
                                        if (nfeMsgTimer.current) clearTimeout(nfeMsgTimer.current);
                                        setNfeMsg(data.message ?? (res.ok ? 'NF-e solicitada!' : 'Erro ao solicitar NF-e.'));
                                        nfeMsgTimer.current = setTimeout(() => setNfeMsg(null), 4000);
                                    } finally {
                                        setNfeLoading(false);
                                    }
                                }}
                                className="flex h-[34px] flex-1 items-center justify-center gap-1 rounded-[8px] border border-[rgba(167,139,250,0.25)] bg-[rgba(167,139,250,0.12)] text-[11px] font-semibold text-[#A78BFA] transition hover:bg-[rgba(167,139,250,0.2)] disabled:opacity-50"
                            >
                                {nfeLoading ? '⏳' : '🧾'} NF-e
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    if (!order.orderId) {
                                        // fallback direto se ID não disponível
                                        const phone = customer.phone?.replace(/\D/g, '') ?? '';
                                        const msg = encodeURIComponent(`Olá ${customer.name.split(' ')[0]}! Segue o comprovante da sua compra ${order.orderNumber} — Total: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.totalCents / 100)}. Obrigado pela preferência! 🙏`);
                                        window.open(`https://wa.me/55${phone}?text=${msg}`, '_blank');
                                        return;
                                    }
                                    const res = await fetch(`/api/internal/orders/${order.orderId}/send-receipt`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ channel: 'whatsapp' }),
                                    });
                                    if (res.ok) {
                                        const data = (await res.json()) as { url?: string };
                                        if (data.url) window.open(data.url, '_blank');
                                    } else {
                                        const data = (await res.json().catch(() => ({}))) as { message?: string };
                                        alert(data.message ?? 'Erro ao enviar comprovante.');
                                    }
                                }}
                                className="flex h-[34px] flex-1 items-center justify-center gap-1 rounded-[8px] border border-[rgba(37,211,102,0.25)] bg-[rgba(37,211,102,0.12)] text-[11px] font-semibold text-[#25D366] transition hover:bg-[rgba(37,211,102,0.2)]"
                            >
                                💬 WhatsApp
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    if (!order.orderId) {
                                        if (!customer.email) { alert('Cliente sem e-mail cadastrado.'); return; }
                                        const subject = encodeURIComponent(`Comprovante ${order.orderNumber}`);
                                        const body = encodeURIComponent(`Olá ${customer.name.split(' ')[0]},\n\nSegue o comprovante da sua compra.\n\nPedido: ${order.orderNumber}\nTotal: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.totalCents / 100)}\n\nObrigado pela preferência!`);
                                        window.location.href = `mailto:${customer.email}?subject=${subject}&body=${body}`;
                                        return;
                                    }
                                    const res = await fetch(`/api/internal/orders/${order.orderId}/send-receipt`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ channel: 'email' }),
                                    });
                                    if (res.ok) {
                                        const data = (await res.json()) as { email?: string };
                                        if (data.email) {
                                            const subject = encodeURIComponent(`Comprovante ${order.orderNumber}`);
                                            const bodyText = encodeURIComponent(`Olá ${customer.name.split(' ')[0]},\n\nSegue o comprovante da sua compra.\n\nPedido: ${order.orderNumber}\nTotal: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.totalCents / 100)}\n\nObrigado pela preferência!`);
                                            window.location.href = `mailto:${data.email}?subject=${subject}&body=${bodyText}`;
                                        }
                                    } else {
                                        const data = (await res.json().catch(() => ({}))) as { message?: string };
                                        alert(data.message ?? 'Erro ao enviar comprovante.');
                                    }
                                }}
                                className="flex h-[34px] flex-1 items-center justify-center gap-1 rounded-[8px] border border-[rgba(74,158,255,0.2)] bg-[rgba(74,158,255,0.1)] text-[11px] font-semibold text-[#4A9EFF] transition hover:bg-[rgba(74,158,255,0.2)]"
                            >
                                ✉️ E-mail
                            </button>
                        </div>
                        {nfeMsg && (
                            <p className="receipt-hint flex-shrink-0 pb-1 text-center text-[10px] text-[#A78BFA]">{nfeMsg}</p>
                        )}
                        <p className="receipt-hint flex-shrink-0 pb-3 text-center text-[10px] text-[#4A4A52]">
                            Disponível pois {customer.name.split(' ')[0]} está vinculado
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}
