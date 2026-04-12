import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { AppError } from '../lib/errors.js';
import {
    getCopilotConfig,
    updateCopilotConfig,
    listSkills,
    createSkill,
    updateSkill,
    deleteSkill,
    generateSkill,
} from '../services/ai-copilot.service.js';

const router = Router();

// Todos os endpoints requerem autenticação
router.use(authenticate);

// ── Config ────────────────────────────────────────────────────────────────────

const updateConfigSchema = z.object({
    is_enabled: z.boolean().optional(),
    provider: z.enum(['qwen', 'openai', 'anthropic']).optional(),
    base_url: z.string().url('URL inválida.').optional().or(z.literal('')),
    api_key: z.string().max(500).optional(),
    model: z.string().min(1).max(100).optional(),
    temperature: z.number().min(0).max(2).optional(),
    max_tokens: z.number().int().min(1).max(8192).optional(),
    system_prompt: z.string().max(4000).optional(),
});

// GET /api/v1/ai-copilot/config
router.get(
    '/config',
    requireRole(['ROOT', 'ADMIN']),
    async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const config = await getCopilotConfig();
            res.json(config);
        } catch (error) {
            next(error);
        }
    }
);

// PUT /api/v1/ai-copilot/config
router.put(
    '/config',
    requireRole(['ROOT', 'ADMIN']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = updateConfigSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest('Dados de configuração inválidos.'));
                return;
            }
            const config = await updateCopilotConfig(parsed.data);
            res.json(config);
        } catch (error) {
            next(error);
        }
    }
);

// ── Skills ────────────────────────────────────────────────────────────────────

const createSkillSchema = z.object({
    name: z.string().trim().min(2).max(100),
    description: z.string().trim().min(5).max(500),
    category: z.enum(['global', 'atendimento', 'vendas', 'meta', 'geral']),
    system_prompt: z.string().trim().min(10).max(4000),
    is_active: z.boolean().optional(),
    sort_order: z.number().int().min(0).max(1000).optional(),
});

const updateSkillSchema = z.object({
    name: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().min(5).max(500).optional(),
    category: z.enum(['global', 'atendimento', 'vendas', 'meta', 'geral']).optional(),
    system_prompt: z.string().trim().min(10).max(4000).optional(),
    is_active: z.boolean().optional(),
    sort_order: z.number().int().min(0).max(1000).optional(),
});

// GET /api/v1/ai-copilot/skills
router.get(
    '/skills',
    requireRole(['ROOT', 'ADMIN']),
    async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const skills = await listSkills();
            res.json({ data: skills });
        } catch (error) {
            next(error);
        }
    }
);

// POST /api/v1/ai-copilot/skills
router.post(
    '/skills',
    requireRole(['ROOT', 'ADMIN']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) { next(AppError.unauthorized()); return; }

            const parsed = createSkillSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest('Dados da skill inválidos.'));
                return;
            }

            const skill = await createSkill({
                ...parsed.data,
                created_by: req.user.id,
            });

            res.status(201).json(skill);
        } catch (error) {
            next(error);
        }
    }
);

// PUT /api/v1/ai-copilot/skills/:id
router.put(
    '/skills/:id',
    requireRole(['ROOT', 'ADMIN']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const id = String(req.params['id'] ?? '');
            if (!id) { next(AppError.badRequest('ID obrigatório.')); return; }

            const parsed = updateSkillSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest('Dados da skill inválidos.'));
                return;
            }

            const skill = await updateSkill(id, parsed.data);
            res.json(skill);
        } catch (error) {
            next(error);
        }
    }
);

// DELETE /api/v1/ai-copilot/skills/:id
router.delete(
    '/skills/:id',
    requireRole(['ROOT', 'ADMIN']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const id = String(req.params['id'] ?? '');
            if (!id) { next(AppError.badRequest('ID obrigatório.')); return; }

            await deleteSkill(id);
            res.status(204).end();
        } catch (error) {
            next(error);
        }
    }
);

// ── Gerador de Skills ─────────────────────────────────────────────────────────

const generateSkillSchema = z.object({
    description: z.string().trim().min(10).max(1000),
});

// POST /api/v1/ai-copilot/skills/generate
router.post(
    '/skills/generate',
    requireRole(['ROOT', 'ADMIN']),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = generateSkillSchema.safeParse(req.body);
            if (!parsed.success) {
                next(AppError.badRequest('Descreva a skill com pelo menos 10 caracteres.'));
                return;
            }

            const generated = await generateSkill(parsed.data.description);
            res.json(generated);
        } catch (error) {
            next(error);
        }
    }
);

export default router;
