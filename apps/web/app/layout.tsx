import type { Metadata } from 'next';
import '@/app/globals.css';

export const metadata: Metadata = {
    title: 'ORION CRM',
    description: 'Painel operacional da ORION',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="pt-BR">
            <body>{children}</body>
        </html>
    );
}
