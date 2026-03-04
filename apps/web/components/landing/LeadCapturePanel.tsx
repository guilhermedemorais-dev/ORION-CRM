import { capturePublicLeadAction } from '@/app/actions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function LeadCapturePanel({
    status,
    message,
    fallbackUrl,
}: {
    status?: string;
    message?: string;
    fallbackUrl?: string;
}) {
    const toneClass = status === 'error'
        ? 'border-red-200 bg-red-50 text-red-700'
        : status === 'degraded'
            ? 'border-amber-200 bg-amber-50 text-amber-800'
            : 'border-emerald-200 bg-emerald-50 text-emerald-700';

    return (
        <section className="rounded-[28px] border border-canvas-border bg-white p-6 shadow-card lg:p-8">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-gold-dark">Atendimento ORION</p>
                    <h2 className="mt-3 font-serif text-3xl text-gray-900">Solicite atendimento consultivo</h2>
                </div>
                <div className="hidden h-14 w-14 items-center justify-center rounded-2xl bg-brand-gold text-surface-sidebar lg:flex">
                    CRM
                </div>
            </div>

            <p className="mt-4 text-sm leading-6 text-gray-600">
                Este formulario ja cai direto no CRM. Quando a automacao estiver configurada, o lead tambem segue para o n8n.
            </p>

            {status && message ? (
                <div className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${toneClass}`}>
                    <p>{message}</p>
                    {status === 'degraded' && fallbackUrl ? (
                        <a
                            href={fallbackUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-block font-semibold underline"
                        >
                            Falar direto no WhatsApp
                        </a>
                    ) : null}
                </div>
            ) : null}

            <form action={capturePublicLeadAction} className="mt-6 grid gap-4">
                <Input name="name" placeholder="Seu nome" required />
                <Input name="whatsapp_number" placeholder="WhatsApp com DDD. Ex: +55 11 99999-9999" required />
                <Input name="email" type="email" placeholder="Seu melhor email (opcional)" />
                <textarea
                    name="notes"
                    rows={4}
                    placeholder="Conte o que voce procura: aliancas, aneis, reposicao, atendimento no balcao..."
                    className="w-full rounded-md border border-canvas-border bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
                />
                <Button type="submit" className="justify-center">
                    Quero atendimento
                </Button>
            </form>
        </section>
    );
}
