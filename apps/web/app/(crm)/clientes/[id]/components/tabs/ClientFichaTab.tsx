'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { notify } from '@/lib/toast';
import type { CustomerFull } from '../types';

interface Props {
  customer: CustomerFull;
  customerId: string;
  entityType: 'customer' | 'lead';
  onUpdate: (updated: Partial<CustomerFull>) => void;
}

const inputStyle: React.CSSProperties = {
  height: '35px',
  background: '#1A1A1E',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: '7px',
  padding: '0 11px',
  fontSize: '12px',
  color: '#F0EDE8',
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: "'DM Sans', sans-serif",
  outline: 'none',
};

const textareaStyle: React.CSSProperties = {
  minHeight: '68px',
  background: '#1A1A1E',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: '7px',
  padding: '8px 11px',
  fontSize: '12px',
  color: '#F0EDE8',
  width: '100%',
  boxSizing: 'border-box',
  resize: 'vertical',
  fontFamily: "'DM Sans', sans-serif",
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  color: '#E8E4DE',
  display: 'block',
  marginBottom: '4px',
};

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

type FormState = {
  name: string;
  social_name: string;
  cpf: string;
  birth_date: string;
  rg: string;
  gender: string;
  whatsapp_number: string;
  email: string;
  instagram: string;
  phone_landline: string;
  zip_code: string;
  city: string;
  state: string;
  address_full: string;
  cnpj: string;
  company_name: string;
  company_address: string;
  preferred_metal: string;
  ring_size: string;
  preferred_channel: string;
  special_dates: string;
  remarketing_notes: string;
};

type FieldName = keyof FormState;

const REQUIRED_FIELDS: FieldName[] = ['name', 'whatsapp_number'];

const fieldLabels: Record<FieldName, string> = {
  name: 'Nome completo',
  social_name: 'Nome social',
  cpf: 'CPF',
  birth_date: 'Data de nascimento',
  rg: 'RG',
  gender: 'Gênero',
  whatsapp_number: 'WhatsApp',
  email: 'E-mail',
  instagram: 'Instagram',
  phone_landline: 'Telefone fixo',
  zip_code: 'CEP',
  city: 'Cidade',
  state: 'Estado',
  address_full: 'Endereço completo',
  cnpj: 'CNPJ',
  company_name: 'Razão social',
  company_address: 'Endereço empresarial',
  preferred_metal: 'Metal preferido',
  ring_size: 'Tamanho do aro',
  preferred_channel: 'Canal preferido',
  special_dates: 'Datas especiais',
  remarketing_notes: 'Observações para remarketing',
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.10em',
        textTransform: 'uppercase',
        color: '#7A7774',
        marginBottom: '12px',
        paddingBottom: '8px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {children}
    </div>
  );
}

async function readApiError(res: Response, fallbackCode: string): Promise<string> {
  try {
    const body = await res.json();
    const code = body?.error || fallbackCode;
    const message = body?.message || 'Erro desconhecido.';
    const reqId = body?.requestId ? ` · req: ${String(body.requestId).slice(0, 8)}` : '';
    const detailMsgs = Array.isArray(body?.details)
      ? body.details.map((d: { field?: string; message?: string }) => d.field ? `${d.field}: ${d.message}` : d.message).filter(Boolean).join('; ')
      : '';
    const detail = detailMsgs ? ` — ${detailMsgs}` : '';
    return `[${code}] ${message}${detail}${reqId}`;
  } catch {
    return `[${fallbackCode}] HTTP ${res.status} ${res.statusText}`;
  }
}

function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export default function ClientFichaTab({ customer, customerId, entityType, onUpdate }: Props) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: customer.name ?? '',
    social_name: customer.social_name ?? '',
    cpf: customer.cpf ?? '',
    birth_date: customer.birth_date ?? '',
    rg: customer.rg ?? '',
    gender: customer.gender ?? '',
    whatsapp_number: customer.whatsapp_number ?? '',
    email: customer.email ?? '',
    instagram: customer.instagram ?? '',
    phone_landline: customer.phone_landline ?? '',
    zip_code: customer.zip_code ?? '',
    city: customer.city ?? '',
    state: customer.state ?? '',
    address_full: customer.address_full ?? '',
    cnpj: customer.cnpj ?? '',
    company_name: customer.company_name ?? '',
    company_address: customer.company_address ?? '',
    preferred_metal: customer.preferred_metal ?? '',
    ring_size: customer.ring_size ?? '',
    preferred_channel: customer.preferred_channel ?? '',
    special_dates: customer.special_dates ?? '',
    remarketing_notes: customer.remarketing_notes ?? '',
  } satisfies FormState);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cepLoading, setCepLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, string>>>({});

  function getFieldStyle(field: FieldName): React.CSSProperties {
    return fieldErrors[field]
      ? { ...inputStyle, border: '1px solid rgba(224,82,82,0.75)' }
      : inputStyle;
  }

  function getTextareaFieldStyle(field: FieldName): React.CSSProperties {
    return fieldErrors[field]
      ? { ...textareaStyle, border: '1px solid rgba(224,82,82,0.75)' }
      : textareaStyle;
  }

  function renderFieldError(field: FieldName) {
    if (!fieldErrors[field]) return null;
    return (
      <div style={{ marginTop: '4px', fontSize: '11px', color: '#E05252' }}>
        {fieldErrors[field]}
      </div>
    );
  }

  function validateForm(values: FormState): Partial<Record<FieldName, string>> {
    const nextErrors: Partial<Record<FieldName, string>> = {};

    for (const field of REQUIRED_FIELDS) {
      if (!values[field].trim()) {
        nextErrors[field] = `${fieldLabels[field]} é obrigatório.`;
      }
    }

    if (values.whatsapp_number.trim() && !/^\+[1-9]\d{1,14}$/.test(values.whatsapp_number.trim())) {
      nextErrors.whatsapp_number = 'Use o formato E.164. Exemplo: +5511999998888';
    }

    if (values.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
      nextErrors.email = 'Informe um e-mail válido.';
    }

    const cpfDigits = values.cpf.replace(/\D/g, '');
    if (values.cpf.trim() && cpfDigits.length !== 11) {
      nextErrors.cpf = 'CPF deve ter 11 dígitos.';
    }

    if (values.state.trim() && values.state.trim().length !== 2) {
      nextErrors.state = 'Estado deve ter 2 letras.';
    }

    return nextErrors;
  }

  function handleChange(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setFieldErrors((prev) => {
        if (!prev[field]) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };
  }

  const handleCepBlur = useCallback(async () => {
    const cep = form.zip_code.replace(/\D/g, '');
    if (cep.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm((prev) => ({
          ...prev,
          city: data.localidade ?? prev.city,
          state: data.uf ?? prev.state,
          address_full: data.logradouro ? `${data.logradouro}, ${data.bairro}` : prev.address_full,
        }));
      }
    } catch {
      // ignore
    } finally {
      setCepLoading(false);
    }
  }, [form.zip_code]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const nextFieldErrors = validateForm(form);
    setFieldErrors(nextFieldErrors);

    if (Object.keys(nextFieldErrors).length > 0) {
      const firstMessage = Object.values(nextFieldErrors)[0] ?? 'Revise os campos obrigatórios.';
      setError(`[VALIDATION] ${firstMessage}`);
      notify.error('Revise a ficha do cliente', firstMessage);
      setSaving(false);
      return;
    }

    try {
      let targetId = customerId;

      let converted = false;
      if (entityType === 'lead') {
        const convertRes = await fetch(`/api/internal/leads/${customerId}/convert`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!convertRes.ok) {
          const msg = await readApiError(convertRes, 'CONVERT_FAILED');
          setError(msg);
          notify.error('Falha ao converter lead', msg);
          return;
        }
        const convertData = await convertRes.json();
        const newId = convertData?.customer?.id;
        if (!newId) {
          const msg = '[CONVERT_NO_ID] Conversão concluída mas servidor não retornou o ID do cliente.';
          setError(msg);
          notify.error('Erro na conversão', msg);
          return;
        }
        targetId = newId;
        converted = true;
      }

      const res = await fetch(`/api/internal/customers/${targetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const msg = await readApiError(res, 'PATCH_FAILED');
        setError(msg);
        notify.error('Falha ao salvar ficha', msg);
        return;
      }
      const data = await res.json();
      onUpdate({
        ...form,
        ...data,
        id: targetId,
      });

      notify.success(
        converted ? 'Lead convertido e ficha salva' : 'Ficha salva',
        converted ? `${form.name} agora é cliente.` : 'Alterações gravadas com sucesso.',
      );

      if (targetId !== customerId) {
        router.replace(`/clientes/${targetId}`);
      }
    } catch (err) {
      const msg = `[NETWORK_ERROR] ${err instanceof Error ? err.message : 'Erro desconhecido.'}`;
      setError(msg);
      notify.error('Erro de rede', msg);
    } finally {
      setSaving(false);
    }
  }

  const hasCpf = Boolean(form.cpf);

  return (
    <div style={{ maxWidth: '680px' }}>
      {/* CPF Badge */}
      <div style={{ marginBottom: '20px' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            background: hasCpf ? 'rgba(63,184,122,0.10)' : 'rgba(240,160,64,0.10)',
            border: `1px solid ${hasCpf ? 'rgba(63,184,122,0.25)' : 'rgba(240,160,64,0.25)'}`,
            borderRadius: '20px',
            padding: '3px 10px',
            fontSize: '11px',
            fontWeight: 600,
            color: hasCpf ? '#3FB87A' : '#F0A040',
          }}
        >
          {hasCpf ? '✓ Apto para NF-e' : '⚠ CPF necessário para NF-e'}
        </span>
      </div>

      {/* 1. Identificação */}
      <div style={{ marginBottom: '28px' }}>
        <SectionTitle>Identificação</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <FieldGroup label="Nome completo">
            <input style={getFieldStyle('name')} value={form.name} onChange={handleChange('name')} />
            {renderFieldError('name')}
          </FieldGroup>
          <FieldGroup label="Nome social">
            <input style={inputStyle} value={form.social_name} onChange={handleChange('social_name')} placeholder="Opcional" />
          </FieldGroup>
          <FieldGroup label="CPF">
            <input style={getFieldStyle('cpf')} value={form.cpf} onChange={handleChange('cpf')} placeholder="000.000.000-00" />
            {renderFieldError('cpf')}
          </FieldGroup>
          <FieldGroup label="Data de nascimento">
            <input style={inputStyle} type="date" value={form.birth_date} onChange={handleChange('birth_date')} />
          </FieldGroup>
          <FieldGroup label="RG">
            <input style={inputStyle} value={form.rg} onChange={handleChange('rg')} placeholder="Opcional" />
          </FieldGroup>
          <FieldGroup label="Gênero">
            <select
              aria-label="Gênero"
              style={{ ...inputStyle, cursor: 'pointer' }}
              value={form.gender}
              onChange={handleChange('gender')}
            >
              <option value="">Não informado</option>
              <option value="M">Masculino</option>
              <option value="F">Feminino</option>
              <option value="NB">Não-binário</option>
              <option value="O">Outro</option>
            </select>
          </FieldGroup>
        </div>
      </div>

      {/* 2. Contatos */}
      <div style={{ marginBottom: '28px' }}>
        <SectionTitle>Contatos</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <FieldGroup label="WhatsApp">
            <input style={getFieldStyle('whatsapp_number')} value={form.whatsapp_number} onChange={handleChange('whatsapp_number')} placeholder="+5511999999999" />
            {renderFieldError('whatsapp_number')}
          </FieldGroup>
          <FieldGroup label="E-mail">
            <input style={getFieldStyle('email')} type="text" inputMode="email" autoComplete="off" value={form.email} onChange={handleChange('email')} placeholder="email@exemplo.com" />
            {renderFieldError('email')}
          </FieldGroup>
          <FieldGroup label="Instagram">
            <input style={inputStyle} value={form.instagram} onChange={handleChange('instagram')} placeholder="@usuario" />
          </FieldGroup>
          <FieldGroup label="Telefone fixo">
            <input style={inputStyle} value={form.phone_landline} onChange={handleChange('phone_landline')} placeholder="(11) 3333-4444" />
          </FieldGroup>
        </div>
      </div>

      {/* 3. Endereço */}
      <div style={{ marginBottom: '28px' }}>
        <SectionTitle>Endereço</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <FieldGroup label={cepLoading ? 'CEP (buscando...)' : 'CEP'}>
            <input
              style={{ ...inputStyle, opacity: cepLoading ? 0.7 : 1 }}
              value={form.zip_code}
              onChange={handleChange('zip_code')}
              onBlur={handleCepBlur}
              placeholder="00000-000"
            />
          </FieldGroup>
          <FieldGroup label="Cidade">
            <input style={inputStyle} value={form.city} onChange={handleChange('city')} />
          </FieldGroup>
          <FieldGroup label="Estado">
            <input style={getFieldStyle('state')} value={form.state} onChange={handleChange('state')} placeholder="SP" maxLength={2} />
            {renderFieldError('state')}
          </FieldGroup>
          <div style={{ gridColumn: '1 / -1' }}>
            <FieldGroup label="Endereço completo">
              <input style={inputStyle} value={form.address_full} onChange={handleChange('address_full')} placeholder="Rua, número, complemento, bairro" />
            </FieldGroup>
          </div>
        </div>
      </div>

      {/* 4. Dados PJ */}
      <div style={{ marginBottom: '28px' }}>
        <SectionTitle>Dados PJ (opcional)</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <FieldGroup label="CNPJ">
            <input style={inputStyle} value={form.cnpj} onChange={handleChange('cnpj')} placeholder="00.000.000/0001-00" />
          </FieldGroup>
          <FieldGroup label="Razão social">
            <input style={inputStyle} value={form.company_name} onChange={handleChange('company_name')} />
          </FieldGroup>
          <div style={{ gridColumn: '1 / -1' }}>
            <FieldGroup label="Endereço empresarial">
              <input style={inputStyle} value={form.company_address} onChange={handleChange('company_address')} />
            </FieldGroup>
          </div>
        </div>
      </div>

      {/* 5. Preferências */}
      <div style={{ marginBottom: '28px' }}>
        <SectionTitle>Preferências</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <FieldGroup label="Metal preferido">
            <select aria-label="Metal preferido" style={{ ...inputStyle, cursor: 'pointer' }} value={form.preferred_metal} onChange={handleChange('preferred_metal')}>
              <option value="">Não informado</option>
              <option value="Ouro amarelo">Ouro amarelo</option>
              <option value="Ouro branco">Ouro branco</option>
              <option value="Ouro rosé">Ouro rosé</option>
              <option value="Prata">Prata</option>
              <option value="Platina">Platina</option>
            </select>
          </FieldGroup>
          <FieldGroup label="Tamanho do aro">
            <input style={inputStyle} value={form.ring_size} onChange={handleChange('ring_size')} placeholder="Ex: 15, 16, 17..." />
          </FieldGroup>
          <FieldGroup label="Canal preferido">
            <select aria-label="Canal preferido" style={{ ...inputStyle, cursor: 'pointer' }} value={form.preferred_channel} onChange={handleChange('preferred_channel')}>
              <option value="">Não informado</option>
              <option value="WhatsApp">WhatsApp</option>
              <option value="E-mail">E-mail</option>
              <option value="Telefone">Telefone</option>
              <option value="Presencial">Presencial</option>
              <option value="Instagram">Instagram</option>
            </select>
          </FieldGroup>
          <FieldGroup label="Datas especiais">
            <input style={inputStyle} value={form.special_dates} onChange={handleChange('special_dates')} placeholder="Aniversário, casamento..." />
          </FieldGroup>
          <div style={{ gridColumn: '1 / -1' }}>
            <FieldGroup label="Observações para remarketing">
              <textarea style={getTextareaFieldStyle('remarketing_notes')} value={form.remarketing_notes} onChange={handleChange('remarketing_notes')} placeholder="Gostos, interesses, histórico de compras relevante..." />
            </FieldGroup>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            background: 'rgba(224,82,82,0.10)',
            border: '1px solid rgba(224,82,82,0.25)',
            borderRadius: '7px',
            padding: '10px 12px',
            color: '#E05252',
            fontSize: '12px',
            marginBottom: '12px',
            wordBreak: 'break-word',
            fontFamily: 'ui-monospace, monospace',
          }}
        >
          {error}
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '16px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <span style={{ fontSize: '11px', color: '#7A7774' }}>
          Última atualização: {fmtDate(customer.updated_at)}{' '}
          {customer.assigned_to ? `· ${customer.assigned_to.name}` : ''}
        </span>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            height: '34px',
            padding: '0 20px',
            background: saving ? '#1A1A1E' : 'rgba(200,169,122,0.15)',
            border: '1px solid rgba(200,169,122,0.30)',
            borderRadius: '7px',
            color: '#C8A97A',
            fontSize: '12px',
            fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {saving ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </div>
    </div>
  );
}
