# TASK-11 — Hierarquia de Usuários & Permissões

**Depende de:** TASK-02
**Arquivos:** `apps/api/src/middleware/permissions.ts` + `apps/web/hooks/usePermissions.ts`

---

## 11.1 Roles do sistema

| Role | Código | Descrição |
|------|--------|-----------|
| Mestre | `MESTRE` | Acesso completo — técnico + operacional |
| Admin | `ADMIN` | Dono — sem acesso a ajustes técnicos |
| Atendente | `ATENDENTE` | Cadastro, PDV, Estoque, Kanban, Atendimento, Entrega |
| Produção | `PRODUCAO` | Kanban OS, Ordem de Serviço, Entrega |
| Designer 3D | `DESIGNER_3D` | Receber OS, upload de arquivos 3D, atualizar etapas |

---

## 11.2 Matriz de permissões por módulo

```typescript
const PERMISSIONS = {
  // Painel do Cliente
  'client.view':           ['MESTRE','ADMIN','ATENDENTE'],
  'client.edit':           ['MESTRE','ADMIN','ATENDENTE'],
  'client.delete':         ['MESTRE','ADMIN'],

  // Atendimento
  'attendance.view':       ['MESTRE','ADMIN','ATENDENTE'],
  'attendance.create':     ['MESTRE','ADMIN','ATENDENTE'],
  'attendance.edit':       ['MESTRE','ADMIN','ATENDENTE'],
  'attendance.delete':     ['MESTRE','ADMIN'],

  // IA 3D
  'ai_render.create':      ['MESTRE','ADMIN','ATENDENTE'],
  'ai_render.approve':     ['MESTRE','ADMIN','ATENDENTE'],

  // Proposta
  'proposal.view':         ['MESTRE','ADMIN','ATENDENTE'],
  'proposal.create':       ['MESTRE','ADMIN','ATENDENTE'],

  // Pedidos
  'order.view':            ['MESTRE','ADMIN','ATENDENTE','PRODUCAO','DESIGNER_3D'],
  'order.create':          ['MESTRE','ADMIN','ATENDENTE'],
  'order.edit':            ['MESTRE','ADMIN'],

  // OS
  'so.view':               ['MESTRE','ADMIN','ATENDENTE','PRODUCAO','DESIGNER_3D'],
  'so.create':             ['MESTRE','ADMIN','ATENDENTE'],
  'so.edit_step':          ['MESTRE','ADMIN','PRODUCAO','DESIGNER_3D'],
  'so.upload_3d':          ['MESTRE','ADMIN','DESIGNER_3D'],
  'so.delete':             ['MESTRE','ADMIN'],

  // Entrega
  'delivery.view':         ['MESTRE','ADMIN','ATENDENTE','PRODUCAO','DESIGNER_3D'],
  'delivery.update_status':['MESTRE','ADMIN','ATENDENTE','PRODUCAO'],

  // Financeiro / NF-e
  'nfe.emit':              ['MESTRE','ADMIN'],
  'financial.view':        ['MESTRE','ADMIN'],

  // Admin-only
  'settings.view':         ['MESTRE'],
  'pipeline.configure':    ['MESTRE'],
  'users.manage':          ['MESTRE','ADMIN'],
}
```

---

## 11.3 Middleware backend

```typescript
// apps/api/src/middleware/permissions.ts

export function requirePermission(permission: string) {
  return (req, res, next) => {
    const userRole = req.user?.role
    if (!userRole) return res.status(401).json({ error: 'Unauthorized' })

    const allowed = PERMISSIONS[permission]
    if (!allowed || !allowed.includes(userRole)) {
      return res.status(403).json({
        error: 'Forbidden',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: permission,
        userRole
      })
    }
    next()
  }
}

// Uso nas rotas:
router.post('/service-orders/:id/files',
  requireAuth,
  requirePermission('so.upload_3d'),
  uploadHandler
)
```

---

## 11.4 Hook frontend

```typescript
// apps/web/hooks/usePermissions.ts
export function usePermissions() {
  const { user } = useAuth()

  const can = (permission: string): boolean => {
    const allowed = PERMISSIONS[permission]
    return allowed?.includes(user?.role) ?? false
  }

  return { can, role: user?.role }
}

// Uso nos componentes:
const { can } = usePermissions()
{can('nfe.emit') && <button>🧾 Emitir NF-e</button>}
{can('so.upload_3d') && <button>+ Adicionar arquivo 3D</button>}
```

---

## 11.5 UI de criação de usuário (Ajustes → Usuários)

```
Formulário de novo usuário:
  Nome | E-mail | Senha | Role (select)

Abaixo do select de role:
  Checkbox matrix de permissões personalizadas (override)
  Agrupadas por módulo: Cliente / Atendimento / OS / Entrega / Financeiro / Admin

  Se checkbox marcado → sobrescreve a permissão padrão da role
  Salvar em users.custom_permissions JSONB

PATCH /api/v1/users/:id { role, custom_permissions }
```

---

## 11.6 Banco — coluna `custom_permissions`

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS
  custom_permissions JSONB DEFAULT '{}',
  role VARCHAR(20) DEFAULT 'ATENDENTE';
-- roles: MESTRE | ADMIN | ATENDENTE | PRODUCAO | DESIGNER_3D
```

---

## 11.7 Lógica de permissão com override

```typescript
function userCan(user: User, permission: string): boolean {
  // Verificar override personalizado primeiro
  if (user.custom_permissions?.[permission] !== undefined) {
    return user.custom_permissions[permission]
  }
  // Fallback para permissão padrão da role
  return PERMISSIONS[permission]?.includes(user.role) ?? false
}
```

---

## DoD
- [ ] Coluna `role` e `custom_permissions` em `users`
- [ ] `requirePermission` middleware funcional
- [ ] `usePermissions` hook funcional
- [ ] Botões/seções ocultados conforme role
- [ ] UI de criação de usuário com checkbox matrix
- [ ] Override de permissão salva e respeita no frontend e backend
- [ ] `tsc --noEmit` limpo
