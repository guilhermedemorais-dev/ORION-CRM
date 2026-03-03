import type { UserRole } from './entities.js';

declare global {
    namespace Express {
        interface Request {
            requestId: string;
            rawBody?: string;
            user?: {
                id: string;
                email: string;
                role: UserRole;
                name: string;
            };
        }
    }
}

export { };
