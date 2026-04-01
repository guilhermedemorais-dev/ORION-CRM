import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { query } from '../db/pool.js';

export interface AppointmentReminderJob {
    appointmentId: string;
}

const QUEUE_NAME = 'appointment-reminders';

let queue: Queue<AppointmentReminderJob> | null = null;
let worker: Worker<AppointmentReminderJob> | null = null;

function getBullConnection(): ConnectionOptions {
    const redisUrl = new URL(env().REDIS_URL);

    return {
        host: redisUrl.hostname,
        port: Number.parseInt(redisUrl.port || '6379', 10),
        username: redisUrl.username || undefined,
        password: redisUrl.password || undefined,
        db: Number.parseInt(redisUrl.pathname.replace('/', '') || '0', 10),
        maxRetriesPerRequest: null,
    };
}

function getQueue(): Queue<AppointmentReminderJob> {
    if (!queue) {
        queue = new Queue<AppointmentReminderJob>(QUEUE_NAME, {
            connection: getBullConnection(),
        });
    }

    return queue;
}

export async function enqueueAppointmentReminderJob(params: {
    appointmentId: string;
    delayMs: number;
}): Promise<void> {
    await getQueue().add('send-reminder', { appointmentId: params.appointmentId }, {
        delay: params.delayMs,
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 5000,
        },
        removeOnComplete: 100,
        removeOnFail: 200,
    });

    logger.info(
        { appointmentId: params.appointmentId, delayMs: params.delayMs },
        'Appointment reminder job enqueued'
    );
}

export function initializeAppointmentReminderWorker(): void {
    if (worker) {
        return;
    }

    worker = new Worker<AppointmentReminderJob>(
        QUEUE_NAME,
        async (job) => {
            const { appointmentId } = job.data;

            logger.info({ appointmentId }, 'Processing appointment reminder');

            // Fetch appointment + lead/customer
            const result = await query<{
                id: string;
                type: string;
                starts_at: string;
                status: string;
                lead_whatsapp: string | null;
                customer_whatsapp: string | null;
                lead_name: string | null;
                customer_name: string | null;
                reminder_sent_at: string | null;
            }>(
                `SELECT a.id, a.type, a.starts_at, a.status,
                        l.whatsapp_number AS lead_whatsapp, l.name AS lead_name,
                        c.whatsapp_number AS customer_whatsapp, c.name AS customer_name,
                        a.reminder_sent_at
                 FROM appointments a
                 LEFT JOIN leads l ON l.id = a.lead_id
                 LEFT JOIN customers c ON c.id = a.customer_id
                 WHERE a.id = $1`,
                [appointmentId]
            );

            const appt = result.rows[0];
            if (!appt) {
                logger.warn({ appointmentId }, 'Appointment not found, skipping reminder');
                return;
            }

            // Skip if already sent or cancelled
            if (appt.reminder_sent_at) {
                logger.info({ appointmentId }, 'Reminder already sent, skipping');
                return;
            }
            if (appt.status === 'CANCELADO' || appt.status === 'CONCLUIDO') {
                logger.info({ appointmentId, status: appt.status }, 'Appointment is cancelled/completed, skipping reminder');
                return;
            }

            const whatsappNumber = appt.lead_whatsapp || appt.customer_whatsapp;
            if (!whatsappNumber) {
                logger.warn({ appointmentId }, 'No WhatsApp number available for reminder');
                return;
            }

            const contactName = appt.lead_name || appt.customer_name || 'Cliente';
            const dateStr = new Date(appt.starts_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
            const timeStr = new Date(appt.starts_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            const message = `Olá ${contactName}! 👋\n\n⏰ Lembrete: Seu agendamento é amanhã!\n📅 ${dateStr}\n🕐 ${timeStr}\n📝 ${appt.type}\n\nPor favor, confirme sua presença respondendo essa mensagem.\nCaso precise reagendar, entre em contato conosco. ✨`;

            // Get webhook key
            const keysResult = await query<{ key_value: string }>('SELECT key_value FROM webhook_keys WHERE revoked_at IS NULL LIMIT 1');
            const settingsResult = await query<{ internal_webhook_key: string | null }>('SELECT internal_webhook_key FROM settings LIMIT 1');
            const apiKey = keysResult.rows[0]?.key_value || settingsResult.rows[0]?.internal_webhook_key || env().N8N_API_KEY;

            if (apiKey) {
                const n8nUrl = env().N8N_WEBHOOK_URL || `http://localhost:${env().PORT}/api/v1/n8n/bot-reply`;

                try {
                    await fetch(n8nUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`,
                        },
                        body: JSON.stringify({
                            whatsapp_number: whatsappNumber,
                            content: message,
                        }),
                    });

                    logger.info({ appointmentId, whatsappNumber }, 'Appointment reminder sent via n8n');
                } catch (err) {
                    logger.error({ err, appointmentId }, 'Failed to send appointment reminder via n8n');
                    throw err; // Rethrow so BullMQ retries
                }
            } else {
                logger.warn({ appointmentId }, 'No webhook key configured, cannot send reminder');
            }

            // Mark reminder as sent
            await query(
                `UPDATE appointments SET reminder_sent_at = NOW(), updated_at = NOW() WHERE id = $1`,
                [appointmentId]
            );
        },
        {
            connection: getBullConnection(),
            concurrency: 3,
        }
    );

    worker.on('failed', (job, error) => {
        logger.error(
            {
                err: error,
                jobId: job?.id,
                appointmentId: job?.data.appointmentId,
            },
            'Appointment reminder worker failed'
        );
    });

    logger.info('Appointment reminder worker initialized');
}

export async function shutdownAppointmentReminderWorker(): Promise<void> {
    if (worker) {
        await worker.close();
        worker = null;
    }

    if (queue) {
        await queue.close();
        queue = null;
    }
}
