// Central de Ajuda — índice de seções.
//
// Cada feature implementada deve registrar sua seção aqui.
// Editar conteúdo em `_content/<id>.ts` (markdown simples como string).

import { welcomeContent } from './welcome';
import { pipelinesContent } from './pipelines';
import { rulesContent } from './rules';
import { fichaPermissionsContent } from './ficha-permissions';
import { estoqueCategoriasContent } from './estoque-categorias';

export interface HelpSection {
    id: string;
    title: string;
    group: string;
    body: string;
}

export const HELP_SECTIONS: HelpSection[] = [
    welcomeContent,
    pipelinesContent,
    rulesContent,
    estoqueCategoriasContent,
    fichaPermissionsContent,
];

export const HELP_GROUPS = Array.from(
    new Set(HELP_SECTIONS.map((s) => s.group)),
);
