export const dynamic = 'force-dynamic';

import { requireSession } from '@/lib/auth';
import ChamadosClient from './components/ChamadosClient';

export default function ChamadosPage() {
    const session = requireSession();

    return <ChamadosClient userRole={session.user.role} />;
}
