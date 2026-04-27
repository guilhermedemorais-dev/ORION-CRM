'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { apiRequest } from '@/lib/api';
import { parseCurrencyToCents } from '@/lib/financeiro';

const createFinancialLaunchSchema = z.object({
    tipo: z.enum(['receita', 'despesa']),
    descricao: z.string().trim().min(5).max(2000),
    valor: z.string().trim().min(1),
    data: z.string().date(),
    categoria: z.string().trim().min(2).max(100),
    payment_method: z.enum([
        'PIX',
        'CARTAO_CREDITO',
        'CARTAO_DEBITO',
        'DINHEIRO',
        'TRANSFERENCIA',
        'BOLETO',
        'LINK_PAGAMENTO',
    ]).optional().or(z.literal('')),
});

export async function createFinancialLaunchAction(formData: FormData) {
    const parsed = createFinancialLaunchSchema.safeParse({
        tipo: formData.get('tipo'),
        descricao: formData.get('descricao'),
        valor: formData.get('valor'),
        data: formData.get('data'),
        categoria: formData.get('categoria'),
        payment_method: formData.get('payment_method'),
    });

    if (!parsed.success) {
        redirect('/financeiro?error=Verifique%20os%20dados%20do%20lan%C3%A7amento.');
    }

    const amountCents = parseCurrencyToCents(parsed.data.valor);
    if (!amountCents) {
        redirect('/financeiro?error=Valor%20inv%C3%A1lido%20para%20o%20lan%C3%A7amento.');
    }

    const receiptFile = formData.get('comprovante');
    const hasReceiptFile = receiptFile instanceof File && receiptFile.size > 0;

    if (hasReceiptFile && receiptFile.size > 5 * 1024 * 1024) {
        redirect('/financeiro?error=Arquivo%20excede%20o%20limite%20de%205MB.');
    }

    let createdEntry: { id: string } | null = null;

    try {
        createdEntry = await apiRequest<{ id: string }>('/financeiro/lancamentos', {
            method: 'POST',
            body: JSON.stringify({
                tipo: parsed.data.tipo,
                descricao: parsed.data.descricao,
                valor: amountCents,
                data: parsed.data.data,
                categoria: parsed.data.categoria,
                payment_method: parsed.data.payment_method ?? '',
            }),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao registrar lançamento.';
        redirect(`/financeiro?error=${encodeURIComponent(message)}`);
    }

    if (hasReceiptFile && createdEntry) {
        try {
            const uploadData = new FormData();
            uploadData.set('file', receiptFile, receiptFile.name || 'comprovante');

            await apiRequest(`/financeiro/lancamentos/${createdEntry.id}/comprovante`, {
                method: 'POST',
                body: uploadData,
            });
        } catch (error) {
            revalidatePath('/financeiro');
            const message = error instanceof Error ? error.message : 'Falha ao enviar comprovante.';
            redirect(`/financeiro?error=${encodeURIComponent(`Lançamento criado, mas o comprovante falhou: ${message}`)}`);
        }
    }

    revalidatePath('/financeiro');
    redirect('/financeiro');
}

export const createExpenseAction = createFinancialLaunchAction;

export async function uploadFinancialReceiptAction(formData: FormData) {
    const idResult = z.string().uuid().safeParse(formData.get('id'));
    if (!idResult.success) {
        redirect('/financeiro?error=Lança​mento%20inválido.');
    }

    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) {
        redirect('/financeiro?error=Arquivo%20obrigatório.');
    }

    if (file.size > 5 * 1024 * 1024) {
        redirect('/financeiro?error=Arquivo%20excede%20o%20limite%20de%205MB.');
    }

    try {
        const uploadData = new FormData();
        uploadData.set('file', file, file.name || 'comprovante');

        await apiRequest(`/financeiro/lancamentos/${idResult.data}/comprovante`, {
            method: 'POST',
            body: uploadData,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao enviar comprovante.';
        redirect(`/financeiro?error=${encodeURIComponent(message)}`);
    }

    revalidatePath('/financeiro');
    redirect('/financeiro');
}
