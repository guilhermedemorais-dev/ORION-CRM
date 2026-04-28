import { emitToast } from '@/components/system/ToastProvider';

export const notify = {
    success: (title: string, description?: string) => emitToast('success', title, description),
    error: (title: string, description?: string) => emitToast('error', title, description, 6000),
    warning: (title: string, description?: string) => emitToast('warning', title, description),
    info: (title: string, description?: string) => emitToast('info', title, description),
};
