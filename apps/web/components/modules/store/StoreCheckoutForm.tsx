import { createStoreCheckoutAction } from '@/app/loja/actions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function StoreCheckoutForm({
    productId,
    productSlug,
}: {
    productId: string;
    productSlug: string;
}) {
    return (
        <form action={createStoreCheckoutAction} className="grid gap-3">
            <input type="hidden" name="product_id" value={productId} />
            <input type="hidden" name="product_slug" value={productSlug} />

            <Input name="customer_name" placeholder="Nome completo" required />
            <Input name="customer_email" type="email" placeholder="E-mail" />
            <Input name="customer_phone" placeholder="WhatsApp" />

            <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)_120px]">
                <Input name="cep" placeholder="CEP" required />
                <Input name="street" placeholder="Rua" required />
                <Input name="number" placeholder="Número" required />
            </div>

            <Input name="complement" placeholder="Complemento" />

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_84px]">
                <Input name="neighborhood" placeholder="Bairro" required />
                <Input name="city" placeholder="Cidade" required />
                <Input name="state" placeholder="UF" maxLength={2} required />
            </div>

            <Button type="submit" className="justify-center">
                Ir para o pagamento
            </Button>
        </form>
    );
}
