import { requireSession } from '@/lib/auth';
import { HelpClient } from './_components/HelpClient';

interface PageProps {
    searchParams?: { secao?: string };
}

export default function AjudaPage({ searchParams }: PageProps) {
    requireSession();
    return <HelpClient initialSectionId={searchParams?.secao ?? null} />;
}
