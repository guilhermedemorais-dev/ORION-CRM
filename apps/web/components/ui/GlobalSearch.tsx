'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, X, User, Package, ShoppingCart, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface SearchResult {
  id: string;
  type: 'customer' | 'product' | 'order' | 'lead';
  title: string;
  subtitle: string;
  url: string;
}

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GlobalSearch({ isOpen, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    const search = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/internal/search?q=${encodeURIComponent(query)}`);
        if (response.ok) {
          const data = await response.json();
          setResults(data.results || []);
        }
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(search, 300);
    return () => clearTimeout(timeoutId);
  }, [query]);

  const handleResultClick = (result: SearchResult) => {
    router.push(result.url);
    onClose();
  };

  const getIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'customer':
        return <User className="h-4 w-4" />;
      case 'product':
        return <Package className="h-4 w-4" />;
      case 'order':
        return <ShoppingCart className="h-4 w-4" />;
      case 'lead':
        return <FileText className="h-4 w-4" />;
      default:
        return <Search className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: SearchResult['type']) => {
    switch (type) {
      case 'customer':
        return 'Cliente';
      case 'product':
        return 'Produto';
      case 'order':
        return 'Pedido';
      case 'lead':
        return 'Lead';
      default:
        return type;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-2xl mx-4">
        <div className="bg-[color:var(--orion-canvas-card)] border border-white/10 rounded-lg shadow-2xl">
          {/* Search Input */}
          <div className="flex items-center gap-3 p-4 border-b border-white/10">
            <Search className="h-5 w-5 text-[color:var(--orion-text-muted)]" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar clientes, produtos, pedidos..."
              className="flex-1 bg-transparent text-[color:var(--orion-text)] placeholder-[color:var(--orion-text-muted)] outline-none"
            />
            <button
              onClick={onClose}
              className="p-1 rounded-md hover:bg-white/5 text-[color:var(--orion-text-muted)] hover:text-[color:var(--orion-text)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Results */}
          <div className="max-h-96 overflow-y-auto">
            {isLoading && (
              <div className="p-4 text-center text-[color:var(--orion-text-muted)]">
                Buscando...
              </div>
            )}

            {!isLoading && query.length < 2 && (
              <div className="p-4 text-center text-[color:var(--orion-text-muted)]">
                Digite pelo menos 2 caracteres para buscar
              </div>
            )}

            {!isLoading && query.length >= 2 && results.length === 0 && (
              <div className="p-4 text-center text-[color:var(--orion-text-muted)]">
                Nenhum resultado encontrado
              </div>
            )}

            {results.map((result) => (
              <button
                key={`${result.type}-${result.id}`}
                onClick={() => handleResultClick(result)}
                className="w-full flex items-center gap-3 p-3 hover:bg-white/5 text-left border-b border-white/5 last:border-b-0"
              >
                <div className="flex-shrink-0 text-[color:var(--orion-text-muted)]">
                  {getIcon(result.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[color:var(--orion-text)] truncate">
                    {result.title}
                  </div>
                  <div className="text-xs text-[color:var(--orion-text-muted)] truncate">
                    {result.subtitle}
                  </div>
                </div>
                <div className="flex-shrink-0 text-xs text-[color:var(--orion-text-muted)] bg-white/5 px-2 py-1 rounded">
                  {getTypeLabel(result.type)}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}