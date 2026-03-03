import express from 'express';
import type { Request } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { loadEnv } from './config/env.js';
import { query, closePool } from './db/pool.js';
import { logger } from './lib/logger.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { instanceStatusMiddleware } from './middleware/instanceStatus.js';
import { errorHandler } from './middleware/errorHandler.js';
import { closeRedis } from './db/redis.js';

// Routes
import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';
import customersRoutes from './routes/customers.routes.js';
import inboxRoutes from './routes/inbox.routes.js';
import operatorRoutes from './routes/operator.routes.js';
import leadsRoutes from './routes/leads.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import whatsappRoutes from './routes/whatsapp.routes.js';
import { initializeWhatsAppWebhookWorker, shutdownWhatsAppWebhookWorker } from './workers/whatsappWebhook.worker.js';

// ---- Bootstrap ----

const config = loadEnv();
const app = express();

// ---- Global Middleware ----

app.use(requestIdMiddleware);
app.use(helmet());
app.use(cors({
    origin: config.FRONTEND_URL || '*',
    credentials: true,
}));
app.use(express.json({
    limit: '10mb',
    verify: (req, _res, buffer) => {
        (req as Request).rawBody = buffer.toString('utf8');
    },
}));
app.use(cookieParser());

// Instance status check — runs BEFORE auth
app.use(instanceStatusMiddleware);

// Request logging
app.use((req, _res, next) => {
    const start = Date.now();
    _res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info({
            requestId: req.requestId,
            method: req.method,
            path: req.path,
            statusCode: _res.statusCode,
            durationMs: duration,
            userId: req.user?.id,
        }, `${req.method} ${req.path} ${_res.statusCode}`);
    });
    next();
});

// ---- Routes ----

app.use('/health', healthRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/leads', leadsRoutes);
app.use('/api/v1/customers', customersRoutes);
app.use('/api/v1/inbox', inboxRoutes);
app.use('/api/v1/operator', operatorRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/webhooks/whatsapp', whatsappRoutes);

// 404 handler
app.use((_req, res) => {
    res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Recurso não encontrado.',
    });
});

// Global error handler
app.use(errorHandler);

// ---- Start Server ----

let server: ReturnType<typeof app.listen> | null = null;

async function ensureSettingsSingleton(): Promise<void> {
    const result = await query<{ id: string }>('SELECT id FROM settings LIMIT 1');

    if (!result.rows[0]) {
        throw new Error('Settings singleton is missing. Run migrations before starting the API.');
    }
}

async function startServer(): Promise<void> {
    try {
        await ensureSettingsSingleton();
        initializeWhatsAppWebhookWorker();

        server = app.listen(config.PORT, () => {
            logger.info({ port: config.PORT, env: config.NODE_ENV }, `🌟 ORION API running on port ${config.PORT}`);
        });
    } catch (err) {
        logger.fatal({ err }, 'Failed to bootstrap ORION API');
        await closePool();
        await closeRedis();
        process.exit(1);
    }
}

void startServer();

// ---- Graceful Shutdown ----

const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down gracefully...');

    if (server) {
        server.close(async () => {
            await shutdownWhatsAppWebhookWorker();
            await closePool();
            await closeRedis();
            logger.info('All connections closed.');
            process.exit(0);
        });
    } else {
        await shutdownWhatsAppWebhookWorker();
        await closePool();
        await closeRedis();
        logger.info('All connections closed.');
        process.exit(0);
    }

    // Force shutdown after 10 seconds
    setTimeout(() => {
        logger.error('Force shutdown after timeout');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
