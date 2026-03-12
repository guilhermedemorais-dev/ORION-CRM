import { loginAction } from '@/app/(auth)/login/actions';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { fetchPublicSettings } from '@/lib/api';

export default async function LoginPage({
    searchParams,
}: {
    searchParams?: {
        error?: string;
    };
}) {
    const settings = await fetchPublicSettings();

    return (
        <main className="grid min-h-screen grid-cols-1 bg-canvas lg:grid-cols-[1.1fr_0.9fr]">
            <section className="flex items-center justify-center px-6 py-16">
                <div className="w-full max-w-md">
                    <p className="text-xs uppercase tracking-[0.2em] text-gray-500">ORIN CRM</p>
                    <h1 className="mt-3 font-serif text-4xl font-semibold text-gray-900">{settings.company_name}</h1>
                    <p className="mt-3 text-sm text-gray-600">
                        Entre com sua conta para acessar o pipeline, clientes e operação da joalheria.
                    </p>

                    <Card className="mt-8">
                        <form action={loginAction} className="space-y-4">
                            <div>
                                <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-gray-500" htmlFor="email">
                                    Email
                                </label>
                                <Input id="email" name="email" type="email" placeholder="voce@empresa.com" required />
                            </div>
                            <div>
                                <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-gray-500" htmlFor="password">
                                    Senha
                                </label>
                                <Input id="password" name="password" type="password" placeholder="••••••••" required />
                            </div>

                            {searchParams?.error ? (
                                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                    {searchParams.error}
                                </div>
                            ) : null}

                            <Button className="w-full justify-center" type="submit">
                                Entrar no CRM
                            </Button>
                        </form>
                    </Card>
                </div>
            </section>

            <section className="hidden border-l border-canvas-border bg-[radial-gradient(circle_at_top_left,_rgba(200,169,122,0.18),_transparent_45%),linear-gradient(180deg,#151515_0%,#0F0F0F_100%)] p-10 text-white lg:flex lg:flex-col lg:justify-between">
                <div>
                    <p className="text-sm uppercase tracking-[0.24em] text-brand-gold">Operação em tempo real</p>
                    <h2 className="mt-5 font-serif text-4xl font-semibold">A mesma base que move atendimento, pedidos e relacionamento.</h2>
                </div>

                <div className="grid gap-4">
                    <Card className="border-white/10 bg-white/5 text-white shadow-none">
                        <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Pipeline visual</p>
                        <p className="mt-3 text-sm text-gray-200">Leads e clientes organizados em um fluxo que o time entende de primeira.</p>
                    </Card>
                    <Card className="border-white/10 bg-white/5 text-white shadow-none">
                        <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Identidade ORION</p>
                        <p className="mt-3 text-sm text-gray-200">Sidebar escura, acentos dourados e tipografia pensada para joalheria, não para dashboard genérico.</p>
                    </Card>
                </div>
            </section>
        </main>
    );
}
