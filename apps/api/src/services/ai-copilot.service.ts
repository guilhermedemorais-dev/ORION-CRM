import { query } from '../db/pool.js';
import { AppError } from '../lib/errors.js';

export interface AiCopilotConfig {
    id: string;
    is_enabled: boolean;
    provider: string;
    base_url: string;
    api_key_enc: string | null;
    model: string;
    temperature: number;
    max_tokens: number;
    system_prompt: string | null;
    created_at: string;
    updated_at: string;
}

export interface AiSkill {
    id: string;
    name: string;
    description: string;
    category: string;
    system_prompt: string;
    is_global: boolean;
    is_active: boolean;
    sort_order: number;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface AiCopilotConfigPublic extends Omit<AiCopilotConfig, 'api_key_enc'> {
    has_api_key: boolean;
    api_key_masked: string | null;
}

// ── Config ────────────────────────────────────────────────────────────────────

export async function getCopilotConfig(): Promise<AiCopilotConfigPublic> {
    const result = await query<AiCopilotConfig>(
        `SELECT * FROM ai_copilot_config LIMIT 1`
    );

    const row = result.rows[0];
    if (!row) {
        throw AppError.internal('Configuração do copiloto não encontrada.');
    }

    return sanitizeConfig(row);
}

export async function updateCopilotConfig(input: {
    is_enabled?: boolean;
    provider?: string;
    base_url?: string;
    api_key?: string;
    model?: string;
    temperature?: number;
    max_tokens?: number;
    system_prompt?: string;
}): Promise<AiCopilotConfigPublic> {
    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];

    if (input.is_enabled !== undefined) {
        params.push(input.is_enabled);
        sets.push(`is_enabled = $${params.length}`);
    }
    if (input.provider !== undefined) {
        params.push(input.provider);
        sets.push(`provider = $${params.length}`);
    }
    if (input.base_url !== undefined) {
        params.push(input.base_url);
        sets.push(`base_url = $${params.length}`);
    }
    if (input.api_key !== undefined && input.api_key !== '') {
        params.push(input.api_key);
        sets.push(`api_key_enc = $${params.length}`);
    }
    if (input.model !== undefined) {
        params.push(input.model);
        sets.push(`model = $${params.length}`);
    }
    if (input.temperature !== undefined) {
        params.push(input.temperature);
        sets.push(`temperature = $${params.length}`);
    }
    if (input.max_tokens !== undefined) {
        params.push(input.max_tokens);
        sets.push(`max_tokens = $${params.length}`);
    }
    if (input.system_prompt !== undefined) {
        params.push(input.system_prompt);
        sets.push(`system_prompt = $${params.length}`);
    }

    const result = await query<AiCopilotConfig>(
        `UPDATE ai_copilot_config SET ${sets.join(', ')} RETURNING *`
    );

    const row = result.rows[0];
    if (!row) throw AppError.internal('Falha ao atualizar configuração.');

    return sanitizeConfig(row);
}

function sanitizeConfig(row: AiCopilotConfig): AiCopilotConfigPublic {
    const { api_key_enc, ...rest } = row;
    const hasKey = Boolean(api_key_enc && api_key_enc.length > 4);
    const masked = hasKey
        ? `${'*'.repeat(Math.max(0, (api_key_enc?.length ?? 8) - 4))}${api_key_enc?.slice(-4) ?? ''}`
        : null;

    return {
        ...rest,
        has_api_key: hasKey,
        api_key_masked: masked,
    };
}

// ── Recuperar chave sem mascarar (uso interno apenas) ─────────────────────────

export async function getCopilotApiKeyRaw(): Promise<string | null> {
    const result = await query<{ api_key_enc: string | null }>(
        `SELECT api_key_enc FROM ai_copilot_config LIMIT 1`
    );
    return result.rows[0]?.api_key_enc ?? null;
}

// ── Skills ────────────────────────────────────────────────────────────────────

export async function listSkills(): Promise<AiSkill[]> {
    const result = await query<AiSkill>(
        `SELECT * FROM ai_skills ORDER BY sort_order ASC, created_at ASC`
    );
    return result.rows;
}

export async function listActiveSkills(): Promise<AiSkill[]> {
    const result = await query<AiSkill>(
        `SELECT * FROM ai_skills WHERE is_active = TRUE ORDER BY sort_order ASC`
    );
    return result.rows;
}

export async function createSkill(input: {
    name: string;
    description: string;
    category: string;
    system_prompt: string;
    is_active?: boolean;
    sort_order?: number;
    created_by?: string;
}): Promise<AiSkill> {
    const result = await query<AiSkill>(
        `INSERT INTO ai_skills (name, description, category, system_prompt, is_active, sort_order, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
            input.name,
            input.description,
            input.category,
            input.system_prompt,
            input.is_active ?? true,
            input.sort_order ?? 50,
            input.created_by ?? null,
        ]
    );

    const row = result.rows[0];
    if (!row) throw AppError.internal('Falha ao criar skill.');
    return row;
}

export async function updateSkill(
    id: string,
    input: {
        name?: string;
        description?: string;
        category?: string;
        system_prompt?: string;
        is_active?: boolean;
        sort_order?: number;
    }
): Promise<AiSkill> {
    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];

    if (input.name !== undefined) {
        params.push(input.name);
        sets.push(`name = $${params.length}`);
    }
    if (input.description !== undefined) {
        params.push(input.description);
        sets.push(`description = $${params.length}`);
    }
    if (input.category !== undefined) {
        params.push(input.category);
        sets.push(`category = $${params.length}`);
    }
    if (input.system_prompt !== undefined) {
        params.push(input.system_prompt);
        sets.push(`system_prompt = $${params.length}`);
    }
    if (input.is_active !== undefined) {
        params.push(input.is_active);
        sets.push(`is_active = $${params.length}`);
    }
    if (input.sort_order !== undefined) {
        params.push(input.sort_order);
        sets.push(`sort_order = $${params.length}`);
    }

    params.push(id);
    const result = await query<AiSkill>(
        `UPDATE ai_skills SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
        params
    );

    const row = result.rows[0];
    if (!row) throw AppError.notFound('Skill não encontrada.');
    return row;
}

export async function deleteSkill(id: string): Promise<void> {
    // Skills globais não podem ser deletadas
    const check = await query<{ is_global: boolean }>(
        `SELECT is_global FROM ai_skills WHERE id = $1`,
        [id]
    );

    const skill = check.rows[0];
    if (!skill) throw AppError.notFound('Skill não encontrada.');
    if (skill.is_global) {
        throw AppError.forbidden('Skills globais não podem ser excluídas.');
    }

    await query(`DELETE FROM ai_skills WHERE id = $1`, [id]);
}

// ── Gerador de Skills via LLM ─────────────────────────────────────────────────

export interface GeneratedSkill {
    name: string;
    description: string;
    category: string;
    system_prompt: string;
}

export async function generateSkill(description: string): Promise<GeneratedSkill> {
    const configResult = await query<AiCopilotConfig>(
        `SELECT * FROM ai_copilot_config LIMIT 1`
    );
    const config = configResult.rows[0];

    if (!config?.api_key_enc) {
        throw AppError.badRequest('Configure a API Key do Qwen antes de gerar skills automaticamente.');
    }

    const metaSkillResult = await query<{ system_prompt: string }>(
        `SELECT system_prompt FROM ai_skills WHERE category = 'meta' AND is_active = TRUE LIMIT 1`
    );
    const metaPrompt = metaSkillResult.rows[0]?.system_prompt ?? '';

    const systemPrompt = [
        'Você é um gerador de skills para o CRM ORION de uma joalheria.',
        metaPrompt,
        'Retorne APENAS o JSON, sem markdown, sem explicação adicional.',
    ].join('\n\n');

    const userMessage = `Crie uma skill para: ${description}`;

    const response = await fetch(`${config.base_url}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.api_key_enc}`,
        },
        body: JSON.stringify({
            model: config.model,
            temperature: 0.3,
            max_tokens: 1024,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage },
            ],
        }),
    });

    if (!response.ok) {
        const errText = await response.text();
        throw AppError.serviceUnavailable(
            'AI_GENERATE_ERROR',
            `Erro ao gerar skill via LLM: ${response.status} — ${errText.slice(0, 200)}`
        );
    }

    const data = await response.json() as {
        choices: Array<{ message: { content: string } }>;
    };

    const content = data.choices[0]?.message?.content ?? '';

    let parsed: GeneratedSkill;
    try {
        // Remove possível markdown fence ```json ... ```
        const jsonStr = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
        parsed = JSON.parse(jsonStr) as GeneratedSkill;
    } catch {
        throw AppError.internal(`LLM retornou JSON inválido: ${content.slice(0, 300)}`);
    }

    if (!parsed.name || !parsed.system_prompt) {
        throw AppError.internal('Skill gerada incompleta. Tente reformular a descrição.');
    }

    return {
        name: parsed.name,
        description: parsed.description ?? description,
        category: parsed.category ?? 'geral',
        system_prompt: parsed.system_prompt,
    };
}

// ── Montagem do system prompt completo (usado pelo assistant.service) ──────────

export async function buildCopilotSystemPrompt(basePrompt: string): Promise<string> {
    const skills = await listActiveSkills();

    if (skills.length === 0) return basePrompt;

    const skillsText = skills
        .map((skill) => skill.system_prompt.trim())
        .join('\n\n---\n\n');

    return `${basePrompt}\n\n--- SKILLS ATIVAS ---\n\n${skillsText}`;
}
