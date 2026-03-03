import type { Config } from 'tailwindcss';

const config: Config = {
    content: [
        './app/**/*.{ts,tsx}',
        './components/**/*.{ts,tsx}',
        './lib/**/*.{ts,tsx}',
    ],
    theme: {
        extend: {
            colors: {
                brand: {
                    gold: '#C8A97A',
                    'gold-light': '#E8D5B0',
                    'gold-dark': '#A8895A',
                },
                surface: {
                    sidebar: '#0F0F0F',
                    card: '#1A1A1A',
                    overlay: '#141414',
                },
                canvas: {
                    DEFAULT: '#F8F7F5',
                    card: '#FFFFFF',
                    border: '#E8E5E0',
                },
                status: {
                    novo: '#F59E0B',
                    qualificado: '#3B82F6',
                    proposta: '#8B5CF6',
                    negociacao: '#EC4899',
                    convertido: '#10B981',
                    perdido: '#6B7280',
                    rascunho: '#9CA3AF',
                    aguard_pag: '#F59E0B',
                    pago: '#10B981',
                    producao: '#3B82F6',
                    enviado: '#8B5CF6',
                    cancelado: '#EF4444',
                },
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                serif: ['"Playfair Display"', 'Georgia', 'serif'],
            },
            borderRadius: {
                DEFAULT: '8px',
                sm: '4px',
                md: '8px',
                lg: '12px',
                xl: '16px',
            },
            boxShadow: {
                card: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
                'card-hover': '0 4px 12px rgba(0,0,0,0.12)',
                gold: '0 0 0 2px rgba(200,169,122,0.3)',
            },
        },
    },
    plugins: [],
};

export default config;
