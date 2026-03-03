import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { appendInboundMessage, upsertConversationFromInbound } from '../services/inbox.service.js';
import { parseWebhookPayload } from '../services/meta-whatsapp.service.js';

export interface WhatsAppWebhookJob {
    rawEvent: Record<string, unknown>;
    receivedAt: string;
    requestId: string;
}

const QUEUE_NAME = 'whatsapp-webhook';

let queue: Queue<WhatsAppWebhookJob> | null = null;
let worker: Worker<WhatsAppWebhookJob> | null = null;

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

function getQueue(): Queue<WhatsAppWebhookJob> {
    if (!queue) {
        queue = new Queue<WhatsAppWebhookJob>(QUEUE_NAME, {
            connection: getBullConnection(),
        });
    }

    return queue;
}

export async function enqueueWhatsAppWebhookJob(job: WhatsAppWebhookJob): Promise<void> {
    await getQueue().add('process-inbound-event', job, {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
    });
}

export function initializeWhatsAppWebhookWorker(): void {
    if (worker) {
        return;
    }

    worker = new Worker<WhatsAppWebhookJob>(
        QUEUE_NAME,
        async (job) => {
            const events = parseWebhookPayload(job.data.rawEvent);

            logger.info(
                {
                    requestId: job.data.requestId,
                    inboundEvents: events.length,
                },
                'Processing WhatsApp webhook batch'
            );

            for (const event of events) {
                const conversation = await upsertConversationFromInbound(event);
                const message = await appendInboundMessage({
                    conversationId: conversation.id,
                    metaMessageId: event.meta_message_id,
                    type: event.type,
                    content: event.content,
                    mediaUrl: event.media_url,
                });

                if (message) {
                    logger.info(
                        {
                            requestId: job.data.requestId,
                            metaMessageId: event.meta_message_id,
                            conversationId: conversation.id,
                        },
                        'Inbound WhatsApp message persisted'
                    );
                }
            }
        },
        {
            connection: getBullConnection(),
            concurrency: 5,
        }
    );

    worker.on('failed', (job, error) => {
        logger.error(
            {
                err: error,
                jobId: job?.id,
                requestId: job?.data.requestId,
            },
            'WhatsApp webhook worker failed'
        );
    });
}

export async function shutdownWhatsAppWebhookWorker(): Promise<void> {
    if (worker) {
        await worker.close();
        worker = null;
    }

    if (queue) {
        await queue.close();
        queue = null;
    }
}
