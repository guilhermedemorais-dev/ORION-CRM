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
                    gold: '#BFA06A',
                    'gold-light': '#D4B87E',
                    'gold-dark': '#8B7145',
                },
                surface: {
                    sidebar: '#0A0A0C',
                    card: '#131316',
                    elevated: '#1A1A1E',
                    overlay: '#0F0F11',
                },
                canvas: {
                    DEFAULT: '#080809',
                    card: '#131316',
                    border: 'rgba(255,255,255,0.08)',
                },
                status: {
                    novo: '#F0A040',
                    qualificado: '#4A9EFF',
                    proposta: '#9C6FDE',
                    negociacao: '#E05252',
                    convertido: '#4CAF82',
                    perdido: '#6B7280',
                    rascunho: '#9CA3AF',
                    aguard_pag: '#F0A040',
                    pago: '#4CAF82',
                    producao: '#4A9EFF',
                    enviado: '#9C6FDE',
                    cancelado: '#E05252',
                },
            },
            fontFamily: {
                sans: ['var(--font-orion-sans)'],
                serif: ['var(--font-orion-serif)'],
                mono: ['var(--font-orion-mono)'],
                editorial: ['var(--font-orion-accent-serif)'],
                alt: ['var(--font-orion-alt-sans)'],
            },
            borderRadius: {
                DEFAULT: '8px',
                sm: '6px',
                md: '8px',
                lg: '12px',
                xl: '16px',
            },
            boxShadow: {
                card: '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
                'card-hover': '0 16px 40px rgba(0,0,0,0.4)',
                gold: '0 0 0 3px rgba(191,160,106,0.12)',
            },
            backgroundImage: {
                'orion-grid':
                    'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0)',
                'orion-glow':
                    'radial-gradient(circle at top, rgba(191,160,106,0.12), transparent 52%)',
            },
        },
    },
    plugins: [],
};

export default config;
