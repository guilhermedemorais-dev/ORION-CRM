import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export default function LandingPage() {
    const session = getSession();
    
    if (session) {
        redirect('/dashboard');
    }
    
    redirect('/login');
}
