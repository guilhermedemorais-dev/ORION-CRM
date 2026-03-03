import { sendInboxMessageAction } from '@/app/(crm)/inbox/actions';
import { Button } from '@/components/ui/Button';

export function InboxComposer({ conversationId }: { conversationId: string }) {
    return (
        <form action={sendInboxMessageAction} className="border-t border-canvas-border pt-4">
            <input type="hidden" name="conversation_id" value={conversationId} />

            <div className="rounded-2xl border border-canvas-border bg-white p-3 shadow-sm">
                <textarea
                    name="text"
                    required
                    rows={3}
                    placeholder="Digite a resposta para o cliente..."
                    className="w-full resize-none border-0 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
                />

                <div className="mt-3 flex items-center justify-between gap-3 border-t border-canvas-border pt-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-gray-500">Texto apenas neste bloco</p>
                    <Button type="submit">Enviar</Button>
                </div>
            </div>
        </form>
    );
}
