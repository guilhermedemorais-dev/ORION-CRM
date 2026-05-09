import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { NextFunction, Request, Response } from 'express';
import type pg from 'pg';
import { AppError } from '../lib/errors.js';

const PIPE_A = '11111111-1111-1111-1111-111111111111';
const STAGE_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const STAGE_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const RULE = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const ORG = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

function queryResult<T extends pg.QueryResultRow>(rows: T[]): pg.QueryResult<T> {
    return {
        command: 'SELECT',
        rowCount: rows.length,
        oid: 0,
        fields: [],
        rows,
    };
}

async function withServer(
    app: express.Express,
    fn: (baseUrl: string) => Promise<void>
): Promise<void> {
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as AddressInfo;
    try {
        await fn(`http://127.0.0.1:${address.port}`);
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => error ? reject(error) : resolve());
        });
    }
}

test('pipeline rules route: GET /api/v1/pipelines/:id/rules returns mapped rules', async () => {
    process.env['DATABASE_URL'] = process.env['DATABASE_URL'] ?? 'postgres://user:pass@localhost:5432/orion_test';
    process.env['REDIS_URL'] = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
    process.env['JWT_SECRET'] = process.env['JWT_SECRET'] ?? '01234567890123456789012345678901';
    process.env['JWT_REFRESH_SECRET'] = process.env['JWT_REFRESH_SECRET'] ?? '01234567890123456789012345678901';
    process.env['OPERATOR_WEBHOOK_SECRET'] = process.env['OPERATOR_WEBHOOK_SECRET'] ?? '01234567890123456789012345678901';
    process.env['APP_URL'] = process.env['APP_URL'] ?? 'http://localhost:4000';
    process.env['FRONTEND_URL'] = process.env['FRONTEND_URL'] ?? 'http://localhost:3000';

    const { createPipelineRulesRouter } = await import('./pipeline-rules.routes.js');
    const queries: string[] = [];
    const app = express();
    app.use(express.json());
    app.use('/api/v1/pipelines/:id/rules', createPipelineRulesRouter({
        authenticate: (req: Request, _res: Response, next: NextFunction) => {
            req.user = {
                id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
                email: 'qa@example.com',
                role: 'ADMIN',
                name: 'QA',
            };
            next();
        },
        requirePermission: () => (_req: Request, _res: Response, next: NextFunction) => next(),
        getOrganizationId: async () => ORG,
        createAuditLog: async () => {},
        query: async <T extends pg.QueryResultRow = pg.QueryResultRow>(text: string): Promise<pg.QueryResult<T>> => {
            queries.push(text);
            if (text.includes('FROM pipelines')) {
                return queryResult([{ id: PIPE_A }]) as unknown as pg.QueryResult<T>;
            }
            if (text.includes('FROM pipeline_automation_rules')) {
                return queryResult([
                    {
                        id: RULE,
                        organization_id: ORG,
                        name: 'Criar card de producao',
                        description: null,
                        source_pipeline_id: PIPE_A,
                        source_stage_id: STAGE_A,
                        trigger_event: 'CARD_ENTERED_STAGE',
                        action_type: 'CREATE_LINKED_CARD',
                        target_pipeline_id: PIPE_A,
                        target_stage_id: STAGE_B,
                        link_strategy: 'KEEP_LEAD',
                        is_active: true,
                        created_by: null,
                        updated_by: null,
                        created_at: new Date('2026-05-09T12:00:00.000Z'),
                        updated_at: new Date('2026-05-09T12:00:00.000Z'),
                    },
                ]) as unknown as pg.QueryResult<T>;
            }
            throw new Error(`Unexpected query: ${text}`);
        },
    }));
    app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
        if (err instanceof AppError) {
            res.status(err.statusCode).json({ error: err.code, message: err.message, requestId: req.requestId });
            return;
        }
        res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
    });

    await withServer(app, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/v1/pipelines/${PIPE_A}/rules`, {
            headers: { authorization: 'Bearer test' },
        });
        const body = await response.json() as {
            data: Array<{ id: string; source_pipeline_id: string; target_stage_id: string }>;
        };

        assert.equal(response.status, 200);
        assert.equal(body.data.length, 1);
        assert.equal(body.data[0]?.id, RULE);
        assert.equal(body.data[0]?.source_pipeline_id, PIPE_A);
        assert.equal(body.data[0]?.target_stage_id, STAGE_B);
        assert.equal(queries.length, 2);
    });
});
