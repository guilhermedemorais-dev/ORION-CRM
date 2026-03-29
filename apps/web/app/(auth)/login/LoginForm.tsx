'use client';

import { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { loginAction } from '@/app/(auth)/login/actions';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

interface Props {
    error?: string;
}

function parseRetrySeconds(error: string): number | null {
    const match = error.match(/(\d+)\s*segundo/i);
    return match ? parseInt(match[1]!) : null;
}

export function LoginForm({ error }: Props) {
    const retrySeconds = error ? parseRetrySeconds(error) : null;
    const [countdown, setCountdown] = useState<number | null>(retrySeconds);
    const [showPassword, setShowPassword] = useState(false);
    const isRateLimited = countdown !== null && countdown > 0;

    useEffect(() => {
        if (!countdown || countdown <= 0) return;
        const interval = setInterval(() => {
            setCountdown(prev => {
                if (prev === null || prev <= 1) {
                    clearInterval(interval);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    return (
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
                    <div className="relative">
                        <Input id="password" name="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" required className="pr-10" />
                        <button
                            type="button"
                            onClick={() => setShowPassword(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                            tabIndex={-1}
                        >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                </div>

                {error ? (
                    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {isRateLimited
                            ? `Muitas tentativas. Tente em ${countdown} segundo${countdown === 1 ? '' : 's'}.`
                            : error}
                    </div>
                ) : null}

                <Button className="w-full justify-center" type="submit" disabled={isRateLimited}>
                    {isRateLimited ? `Aguarde ${countdown}s` : 'Entrar no CRM'}
                </Button>
            </form>
        </Card>
    );
}
