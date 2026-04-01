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
import analyticsRoutes from './routes/analytics.routes.js';
import assistantRoutes from './routes/assistant.routes.js';
import automationsRoutes from './routes/automations.routes.js';
import customersRoutes from './routes/customers.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import financialRoutes from './routes/financial.routes.js';
import inboxRoutes from './routes/inbox.routes.js';
import integrationsRoutes from './routes/integrations.routes.js';
import mercadopagoRoutes from './routes/mercadopago.routes.js';
import n8nRoutes from './routes/n8n.routes.js';
import notificationsRoutes from './routes/notifications.routes.js';
import ordersRoutes from './routes/orders.routes.js';
import operatorRoutes from './routes/operator.routes.js';
import pipelineRoutes from './routes/pipeline.routes.js';
import pipelinesRoutes from './routes/pipelines.routes.js';
import publicRoutes from './routes/public.routes.js';
import leadsRoutes from './routes/leads.routes.js';
import paymentsRoutes from './routes/payments.routes.js';
import pdvRoutes from './routes/pdv.routes.js';
import productsRoutes from './routes/products.routes.js';
import productionRoutes from './routes/production.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import storeRoutes from './routes/store.routes.js';
import storeSettingsRoutes from './routes/store-settings.routes.js';
import usersRoutes from './routes/users.routes.js';
import whatsappRoutes from './routes/whatsapp.routes.js';
import whatsappAdminRoutes from './routes/whatsapp-admin.routes.js';
import attendanceRoutes from './routes/attendance.routes.js';
import rendersRoutes from './routes/renders.routes.js';
import serviceOrdersRoutes from './routes/service-orders.routes.js';
import deliveriesRoutes from './routes/deliveries.routes.js';
import carriersRoutes from './routes/carriers.routes.js';
import whatsappProvidersRoutes from './routes/whatsapp-providers.routes.js';
import searchRoutes from './routes/search.routes.js';
import integrationProvidersRoutes from './routes/integration-providers.routes.js';
import appointmentsRoutes from './routes/appointments.routes.js';
import { initializeWhatsAppWebhookWorker, shutdownWhatsAppWebhookWorker } from './workers/whatsappWebhook.worker.js';
import { initializeAppointmentReminderWorker, shutdownAppointmentReminderWorker } from './workers/appointmentReminder.worker.js';
import { seedN8nSystemWorkflows } from './startup/seed-n8n-workflows.js';

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
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/assistant', assistantRoutes);
app.use('/api/v1/automations', automationsRoutes);
app.use('/api/v1/public', publicRoutes);
app.use('/api/v1/store', storeRoutes);
app.use('/api/v1/leads', leadsRoutes);
app.use('/api/v1/customers', customersRoutes);
app.use('/api/v1/customers', attendanceRoutes);
app.use('/api/v1/blocks', attendanceRoutes);
app.use('/api/v1/renders', rendersRoutes);
app.use('/api/v1/blocks', rendersRoutes);
app.use('/api/v1/customers', serviceOrdersRoutes);
app.use('/api/v1/service-orders', serviceOrdersRoutes);
app.use('/api/v1/customers', deliveriesRoutes);
app.use('/api/v1/deliveries', deliveriesRoutes);
app.use('/api/v1/carriers', carriersRoutes);
app.use('/api/v1/whatsapp-providers', whatsappProvidersRoutes);
app.use('/api/v1/integration-providers', integrationProvidersRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/products', productsRoutes);
app.use('/api/v1/financial-entries', financialRoutes);
app.use('/api/v1/financeiro', financialRoutes);
app.use('/api/v1/payments', paymentsRoutes);
app.use('/api/v1', mercadopagoRoutes);
app.use('/api/v1/pdv', pdvRoutes);
app.use('/api/v1/inbox', inboxRoutes);
app.use('/api/v1/integrations', integrationsRoutes);
app.use('/api/v1/notifications', notificationsRoutes);
app.use('/api/v1/orders', ordersRoutes);
app.use('/api/v1/production-orders', productionRoutes);
app.use('/api/v1/operator', operatorRoutes);
app.use('/api/v1/n8n', n8nRoutes);
app.use('/api/v1/pipeline', pipelineRoutes);
app.use('/api/v1/pipelines', pipelinesRoutes);
app.use('/api/v1/settings/store', storeSettingsRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/org', settingsRoutes);
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/appointments', appointmentsRoutes);
app.use('/api/v1/webhooks/whatsapp', whatsappRoutes);
app.use('/api/v1/whatsapp', whatsappAdminRoutes);

// Internal routes (not exposed via NGINX)
app.use('/api/internal/search', searchRoutes);

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
        // await ensureSettingsSingleton(); // Temporarily disabled to prevent crash loops on fresh db
        initializeWhatsAppWebhookWorker();
        initializeAppointmentReminderWorker();
        // await seedN8nSystemWorkflows(); // n8n runs in a separate isolated container

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
            await shutdownAppointmentReminderWorker();
            await closePool();
            await closeRedis();
            logger.info('All connections closed.');
            process.exit(0);
        });
    } else {
        await shutdownWhatsAppWebhookWorker();
        await shutdownAppointmentReminderWorker();
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
