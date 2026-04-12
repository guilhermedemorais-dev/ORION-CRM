'use client';

import { usePathname } from 'next/navigation';

export type HelpContext =
  | 'dashboard'
  | 'pdv'
  | 'estoque'
  | 'pedidos'
  | 'clientes'
  | 'financeiro'
  | 'analytics'
  | 'pipeline'
  | 'ficha-cliente'
  | 'inbox'
  | 'producao'
  | 'agenda'
  | 'automacoes'
  | 'loja'
  | 'ajustes'
  | 'settings';

export function useHelpContext(): HelpContext {
  const pathname = usePathname();

  // ficha-cliente must be checked before generic /clientes
  if (pathname.match(/\/clientes\/[^/]+/)) return 'ficha-cliente';
  if (pathname.includes('/pdv'))           return 'pdv';
  if (pathname.includes('/estoque'))       return 'estoque';
  if (pathname.includes('/pedidos'))       return 'pedidos';
  if (pathname.includes('/clientes'))      return 'clientes';
  if (pathname.includes('/financeiro'))    return 'financeiro';
  if (pathname.includes('/analytics'))     return 'analytics';
  if (pathname.includes('/pipeline'))      return 'pipeline';
  if (pathname.includes('/inbox'))         return 'inbox';
  if (pathname.includes('/producao'))      return 'producao';
  if (pathname.includes('/agenda'))        return 'agenda';
  if (pathname.includes('/automacoes'))    return 'automacoes';
  if (pathname.includes('/loja'))          return 'loja';
  if (pathname.includes('/ajustes'))       return 'ajustes';
  if (pathname.includes('/settings'))      return 'settings';
  return 'dashboard';
}
