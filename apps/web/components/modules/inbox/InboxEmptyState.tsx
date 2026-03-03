import { EmptyState } from '@/components/ui/EmptyState';

export function InboxEmptyState() {
    return (
        <EmptyState
            title="Nenhuma conversa selecionada"
            description="Escolha uma conversa na coluna ao lado para abrir a thread e responder pelo CRM."
        />
    );
}
