"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, MessageCircle } from 'lucide-react';
import type { DashboardPayload } from '@/lib/api';
import { formatCurrencyFromCents } from '@/lib/utils';
import './DashboardTemplate.css';

interface Props {
  data: DashboardPayload | null;
}

/* ─── helpers ─── */
const fmtBRL = (v: number) => formatCurrencyFromCents(Math.round(v * 100));

/* ─── Heatmap data ─── */
const HM_WEIGHTS = [
  [0,0,0,0,0,0,0,0,0,0,0,0],
  [1,2,3,2,1,3,4,3,2,1,1,0],
  [1,2,4,3,2,3,5,4,3,2,1,0],
  [1,3,4,3,2,4,5,4,3,2,1,0],
  [1,2,3,3,2,3,5,5,4,3,2,1],
  [2,3,5,4,3,5,7,8,7,5,3,2],
  [3,4,6,5,4,6,8,9,8,6,4,2],
];
const HM_DAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

const CAL_MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function countBusinessDaysRemaining(date: Date): number {
  const year = date.getFullYear();
  const month = date.getMonth();
  const startDay = date.getDate() + 1;
  const lastDay = new Date(year, month + 1, 0).getDate();
  let count = 0;
  for (let day = startDay; day <= lastDay; day += 1) {
    const dow = new Date(year, month, day).getDay();
    if (dow !== 0 && dow !== 6) count += 1;
  }
  return count;
}

function relativeTime(dateStr: string): string {
  const d = new Date(dateStr);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return 'agora';
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
  return `ontem`;
}

function formatTimeOnly(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

/* TASK-008: label contextual por tipo de atividade */
function activityLabel(kind: string, label: string): string {
  if (kind === 'lead') return label.toLowerCase().includes('novo') ? 'Novo lead captado' : 'Lead atualizado';
  if (kind === 'order') return label.toLowerCase().includes('pagamento') ? 'Pagamento confirmado' : label.toLowerCase().includes('finaliz') ? 'Pedido finalizado' : 'Pedido atualizado';
  if (kind === 'payment') return 'Pagamento recebido';
  if (kind === 'stock') return 'Ajuste de estoque';
  return 'Registro do sistema';
}

/* TASK-016: Skeleton loader component */
function DashboardSkeleton() {
  return (
    <div className="dashboard-root">
      {/* KPI row skeleton */}
      <div className="grid-4">
        {[0,1,2,3].map(i => (
          <div key={i} className="skeleton-kpi">
            <div className="skeleton skeleton-line w-half" />
            <div className="skeleton skeleton-line xl w-3-4" />
            <div className="skeleton skeleton-line w-1-3" style={{height:'34px',borderRadius:'4px'}} />
            <div className="skeleton skeleton-line w-half" />
          </div>
        ))}
      </div>
      {/* Chart skeleton */}
      <div className="grid-2" style={{gridTemplateColumns:'1fr 340px'}}>
        <div className="skeleton-chart">
          <div className="skeleton skeleton-line w-1-3" />
          <div className="skeleton" style={{flex:1,minHeight:'180px',borderRadius:'8px'}} />
          <div style={{display:'flex',gap:'20px',paddingTop:'10px'}}>
            {[0,1,2].map(i => <div key={i} className="skeleton skeleton-line" style={{width:'80px',height:'32px'}} />)}
          </div>
        </div>
        <div className="skeleton-panel">
          <div className="skeleton skeleton-line w-half" />
          <div className="skeleton skeleton-line xl w-3-4" />
          <div className="skeleton" style={{height:'8px',borderRadius:'4px',width:'100%'}} />
          <div className="grid-3" style={{marginTop:'8px'}}>
            {[0,1,2].map(i => <div key={i} className="skeleton" style={{height:'60px',borderRadius:'8px'}} />)}
          </div>
        </div>
      </div>
      {/* Ação imediata skeleton */}
      <div className="grid-3">
        {[0,1,2].map(i => (
          <div key={i} className="skeleton-panel">
            <div className="skeleton skeleton-line w-half" />
            {[0,1,2].map(j => <div key={j} className="skeleton skeleton-line w-full" style={{height:'52px',borderRadius:'8px'}} />)}
          </div>
        ))}
      </div>
      {/* Activity skeleton */}
      <div className="grid-3">
        {[0,1,2].map(i => (
          <div key={i} className="skeleton-panel">
            <div className="skeleton skeleton-line w-half" />
            {[0,1,2,3].map(j => <div key={j} className="skeleton skeleton-line w-full" />)}
          </div>
        ))}
      </div>
    </div>
  );
}

/* TASK-015: Etapas de produção canônicas — mesmas em ambos os cards */
const PRODUCTION_STAGES_CANONICAL = [
  { stage: 'PENDENTE',     stage_label: 'Designer 3D', avg_days: 1.5, color: '#818CF8', pct: 37 },
  { stage: 'EM_ANDAMENTO', stage_label: 'Fundição',    avg_days: 3.2, color: '#FBBF24', pct: 80 },
  { stage: 'EM_ANDAMENTO', stage_label: 'Cravação',    avg_days: 2.4, color: '#C8A97A', pct: 60 },
  { stage: 'PAUSADA',      stage_label: 'Acabamento',  avg_days: 4.1, color: '#F87171', pct: 100 },
  { stage: 'CONCLUIDA',    stage_label: 'Polimento',   avg_days: 0.8, color: '#34D399', pct: 20 },
];

export function CustomDashboardView({ data }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState<Date | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [congratsOpen, setCongratsOpen] = useState(false);

  useEffect(() => {
    setCurrentMonth(new Date());
  }, []);

  /* ─── TASK-022: Auto-refresh a cada 60 segundos ─── */
  useEffect(() => {
    const id = setInterval(() => {
      router.refresh();
      setLastUpdated(new Date());
    }, 60_000);
    return () => clearInterval(id);
  }, [router]);

  /* ─── Dados reais da API. Quando o banco está vazio, a tela deve mostrar zero/empty state. ─── */
  const hasRealData = Boolean(data?.kpis);

  const revenue = (data?.kpis.month_revenue_cents ?? 0) / 100;
  const pdvOrdersToday = data?.kpis.pdv_orders_today ?? 0;
  const pdvTicketAvg = (data?.kpis.pdv_ticket_avg_cents ?? 0) / 100;
  const overdueProduction = data?.alerts?.overdue_production ?? 0;
  const leadsToday = data?.kpis.leads_today ?? 0;
  const openOrders = data?.kpis.open_orders ?? 0;

  const readyOrders = data?.ready_orders ?? [];
  const stockAlerts = data?.stock_alerts_detail ?? [];
  const paymentMethods = data?.payment_methods ?? [];
  const topClients = data?.top_clients ?? [];
  const leadsBySource = data?.leads_by_source ?? [];
  const upcomingAppointments = data?.upcoming_appointments ?? [];

  /* TASK-015: produção usa stages canônicos mesclados com counts reais */
  const productionByStage = PRODUCTION_STAGES_CANONICAL.map((canonical) => {
    const real = hasRealData && data?.production_by_stage
      ? data.production_by_stage.find(s => s.stage_label === canonical.stage_label)
      : null;
    return { ...canonical, count: real?.count ?? 0 };
  });

  const activity = data?.activity ?? [];

  // Valores derivados
  const totalLeads = leadsBySource.reduce((acc, s) => acc + s.count, 0);
  const readyOrdersTotalCents = readyOrders.reduce((acc, o) => acc + o.total_cents, 0);
  const monthDate = currentMonth ?? new Date('2026-01-01T12:00:00-03:00');
  const businessDaysRemaining = countBusinessDaysRemaining(monthDate);
  const todayLabel = monthDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'America/Sao_Paulo' });

  const chartSeries = useMemo(() => {
    return data?.revenue_last_30_days ?? [];
  }, [data?.revenue_last_30_days]);

  const hasChartData = chartSeries.length > 0 && chartSeries.some((point) => point.amount_cents > 0);

  const chartStats = useMemo(() => {
    if (!hasChartData) {
      return {
        linePath: '',
        areaPath: '',
        dotX: 0,
        dotY: 0,
        maxDay: 0,
        avgDay: 0,
      };
    }

    const width = 600;
    const height = 180;
    const topPad = 20;
    const bottomPad = 10;
    const values = chartSeries.map((point) => point.amount_cents / 100);
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = Math.max(max - min, 1);
    const stepX = chartSeries.length > 1 ? width / (chartSeries.length - 1) : width;
    const points = values.map((value, index) => {
      const x = Math.round(index * stepX);
      const normalized = (value - min) / range;
      const y = Math.round(height - bottomPad - normalized * (height - topPad - bottomPad));
      return { x, y, value };
    });
    const linePath = points
      .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`)
      .join(' ');
    const areaPath = `${linePath} L${width},${height} L0,${height} Z`;
    const last = points[points.length - 1] ?? { x: 0, y: 0 };
    const avgDay = Math.round(values.reduce((acc, value) => acc + value, 0) / values.length);

    return {
      linePath,
      areaPath,
      dotX: last.x,
      dotY: last.y,
      maxDay: Math.round(max),
      avgDay,
    };
  }, [chartSeries, hasChartData]);

  const appointmentDateKeys = useMemo(() => {
    return new Set(upcomingAppointments.map((appointment) => formatDateKey(new Date(appointment.starts_at))));
  }, [upcomingAppointments]);

  const todayAppointments = useMemo(() => {
    const todayKey = formatDateKey(new Date());
    return upcomingAppointments
      .filter((appointment) => formatDateKey(new Date(appointment.starts_at)) === todayKey)
      .slice(0, 3);
  }, [upcomingAppointments]);

  const calendarCells = useMemo(() => {
    if (!currentMonth) return [];
    const firstOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const start = new Date(firstOfMonth);
    start.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());
    const cells: Array<{ key: string; dateKey: string; day: number; isCurrentMonth: boolean; isToday: boolean }> = [];
    for (let i = 0; i < 42; i += 1) {
      const cellDate = new Date(start);
      cellDate.setDate(start.getDate() + i);
      const dateKey = formatDateKey(cellDate);
      const isToday = dateKey === formatDateKey(new Date());
      cells.push({
        key: cellDate.toISOString(),
        dateKey,
        day: cellDate.getDate(),
        isCurrentMonth: cellDate.getMonth() === currentMonth.getMonth(),
        isToday,
      });
    }
    return cells;
  }, [currentMonth]);

  /* ─── Animation system on mount ─── */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    /* 1. Entrance observer */
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const el = e.target as HTMLElement;

        /* stagger children inside grids */
        if (el.classList.contains('grid-4') || el.classList.contains('grid-3') ||
            el.classList.contains('grid-2') || el.style.gridTemplateColumns) {
          el.querySelectorAll('.anim-in').forEach((c, i) => {
            setTimeout(() => c.classList.add('visible'), i * 80);
          });
          el.classList.add('visible');
        } else {
          el.classList.add('visible');
        }
        io.unobserve(el);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    root.querySelectorAll('.anim-in').forEach(el => io.observe(el));

    /* 2. KPI counter animation */
    const cntObs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target as HTMLElement;
        if (el.dataset.counted) return;
        el.dataset.counted = '1';
        const raw = el.textContent?.trim() || '0';
        const clean = raw.replace(/[^\d.,]/g, '');
        const target = parseFloat(clean.replace('.','').replace(',','.'));
        if (isNaN(target)) return;
        const dur = 1200;
        const t0 = performance.now();
        const tick = (now: number) => {
          const p = Math.min((now - t0) / dur, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          const cur = target * eased;
          if (raw.includes('R$')) {
            el.textContent = 'R$ ' + Math.round(cur).toLocaleString('pt-BR');
          } else {
            el.textContent = Math.round(cur).toString();
          }
          if (p < 1) requestAnimationFrame(tick);
          else {
            if (raw.includes('R$')) el.textContent = 'R$ ' + Math.round(target).toLocaleString('pt-BR');
            else el.textContent = raw;
          }
        };
        setTimeout(() => requestAnimationFrame(tick), 300);
        cntObs.unobserve(el);
      });
    }, { threshold: 0.5 });
    root.querySelectorAll('.kpi-value, .meta-value, .meta-pct, .cs-val, .cliente-val, .pronto-val, .tempo-avg-val').forEach(el => cntObs.observe(el));

    /* 3. Sparkline draw */
    root.querySelectorAll('.spark').forEach(svg => {
      const poly = svg.querySelector('polyline');
      const area = svg.querySelector('polygon');
      if (poly) {
        const pts = (poly.getAttribute('points') || '').split(/\s+/);
        let len = 0;
        for (let i = 1; i < pts.length; i++) {
          const [x1,y1] = pts[i-1].split(',').map(Number);
          const [x2,y2] = pts[i].split(',').map(Number);
          len += Math.sqrt((x2-x1)**2 + (y2-y1)**2);
        }
        poly.classList.add('spark-line');
        poly.setAttribute('stroke-dasharray', Math.ceil(len).toString());
        poly.setAttribute('stroke-dashoffset', Math.ceil(len).toString());
      }
      if (area) area.classList.add('spark-area');
    });

    const sparkObs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const svg = e.target;
        setTimeout(() => {
          svg.querySelectorAll('.spark-line').forEach(el => el.classList.add('drawn'));
          svg.querySelectorAll('.spark-area').forEach(el => el.classList.add('drawn'));
        }, 200);
        sparkObs.unobserve(svg);
      });
    }, { threshold: 0.3 });
    root.querySelectorAll('.spark').forEach(svg => sparkObs.observe(svg));

    /* 4. Bars */
    root.querySelectorAll('.funnel-bar, .tempo-bar, .origem-bar, .pay-fill').forEach(bar => {
      const el = bar as HTMLElement;
      el.dataset.targetWidth = el.style.width;
      el.style.width = '0%';
      el.classList.add('bar-animate');
    });
    const metaFill = root.querySelector('.meta-bar-fill') as HTMLElement;
    if (metaFill) { metaFill.dataset.targetWidth = metaFill.style.width; metaFill.style.width = '0%'; }

    const barObs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        e.target.querySelectorAll('.bar-animate, .meta-bar-fill').forEach((bar, i) => {
          setTimeout(() => { (bar as HTMLElement).style.width = (bar as HTMLElement).dataset.targetWidth || '0%'; }, i * 60);
        });
        barObs.unobserve(e.target);
      });
    }, { threshold: 0.2 });
    root.querySelectorAll('.panel-body, .panel').forEach(p => barObs.observe(p));

    /* 5. Heatmap stagger */
    const hmGrid = root.querySelector('#hm-grid');
    if (hmGrid) {
      const hmObs = new IntersectionObserver((entries) => {
        entries.forEach(e => {
          if (!e.isIntersecting) return;
          hmGrid.querySelectorAll('.hm-cell').forEach((cell, i) => {
            const row = Math.floor(i / 12);
            const col = i % 12;
            setTimeout(() => cell.classList.add('visible'), row * 25 + col * 15);
          });
          hmObs.unobserve(hmGrid);
        });
      }, { threshold: 0.2 });
      hmObs.observe(hmGrid);
    }

    /* 6. Donut ring */
    const donutSvg = root.querySelector('.donut-svg');
    if (donutSvg) {
      const rings = donutSvg.querySelectorAll('.donut-ring');
      const dObs = new IntersectionObserver((entries) => {
        entries.forEach(e => {
          if (!e.isIntersecting) return;
          rings.forEach((ring, i) => setTimeout(() => ring.classList.add('drawn'), i * 120));
          dObs.unobserve(e.target);
        });
      }, { threshold: 0.3 });
      dObs.observe(donutSvg);
    }

    return () => { io.disconnect(); cntObs.disconnect(); sparkObs.disconnect(); barObs.disconnect(); };
  }, []);

  /* ─── Render donut rings (calculado antes do return) ─── */
  const donutColors = ['#34D399', '#C084FC', '#C8A97A', '#60A5FA', '#333'];
  const totalLeadsCalc = leadsBySource.reduce((acc, s) => acc + s.count, 0) || 1;
  const circumference = 2 * Math.PI * 48;
  const donutRings = leadsBySource.map((source, i) => {
    const offset = leadsBySource.slice(0, i).reduce((acc, s) => acc + (s.count / totalLeadsCalc) * circumference, 0);
    const dashArray = (source.count / totalLeadsCalc) * circumference;
    return (
      <circle key={i} className="donut-ring" cx="65" cy="65" r="48" fill="none" stroke={donutColors[i % donutColors.length]} strokeWidth="18" strokeDasharray={`${dashArray} ${circumference}`} strokeDashoffset={-offset} strokeLinecap="round" transform="rotate(-90 65 65)"/>
    );
  });

  /* TASK-016: durante a hidratação (currentMonth=null), exibir skeleton */
  if (!currentMonth) return <DashboardSkeleton />;

  return (
    <div className="dashboard-root" ref={rootRef}>

      {/* ══════════ TASK-020: NAVEGAÇÃO RÁPIDA POR ÂNCORAS ══════════ */}
      <nav className="dash-anchor-nav">
        <a href="#section-financeiro" className="dash-anchor-link">Financeiro</a>
        <a href="#section-acao-imediata" className="dash-anchor-link">Ação Imediata</a>
        <a href="#section-operacoes" className="dash-anchor-link">Operações</a>
        <a href="#section-comercial" className="dash-anchor-link">Comercial</a>
        <a href="#section-analytics" className="dash-anchor-link">Analytics</a>
        <div style={{flex:1}}/>
        <span className="dash-anchor-time">Atualizado: {lastUpdated.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</span>
      </nav>

      {/* ══════════ 1. VISÃO GERAL — KPIs ══════════ */}
      <div className="grid-4 anim-in">
        {/* Faturamento */}
        <div className="kpi-card anim-in" onClick={() => router.push('/financeiro')} role="link" tabIndex={0} title="Ver Financeiro">
          <div className="kpi-top"><div className="kpi-label">Faturamento do Mês</div><div className="kpi-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#C8A97A" strokeWidth="1.5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div></div>
          <div className="kpi-value" suppressHydrationWarning>{fmtBRL(revenue)}</div>
          <svg className="spark" width="100%" height="34" viewBox="0 0 200 34" preserveAspectRatio="none"><polygon fill="rgba(200,169,122,0.08)" points="0,34 0,30 25,26 50,28 75,20 100,22 125,14 150,11 175,8 200,6 200,34"/><polyline fill="none" stroke="rgba(200,169,122,0.55)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points="0,30 25,26 50,28 75,20 100,22 125,14 150,11 175,8 200,6"/></svg>
          <div className="kpi-footer"><span className="delta up">↑ 18%</span><span className="delta-sub">vs mês anterior</span></div>
        </div>
        {/* PDV */}
        <div className="kpi-card anim-in" onClick={() => router.push('/pdv')} role="link" tabIndex={0} title="Ver PDV">
          <div className="kpi-top"><div className="kpi-label">PDV — Vendas Hoje</div><div className="kpi-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#C8A97A" strokeWidth="1.5"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg></div></div>
          <div className="kpi-value" suppressHydrationWarning>{pdvOrdersToday}</div>
          <div className="kpi-sub">Ticket médio <b>{fmtBRL(pdvTicketAvg)}</b></div>
          <svg className="spark" width="100%" height="34" viewBox="0 0 200 34" preserveAspectRatio="none"><polygon fill="rgba(200,169,122,0.08)" points="0,34 0,32 25,26 50,28 75,22 100,18 125,24 150,14 175,10 200,16 200,34"/><polyline fill="none" stroke="rgba(200,169,122,0.55)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points="0,32 25,26 50,28 75,22 100,18 125,24 150,14 175,10 200,16"/></svg>
          <div className="kpi-footer"><span className="delta up">↑ +{pdvOrdersToday > 4 ? pdvOrdersToday - 4 : pdvOrdersToday}</span><span className="delta-sub">vs ontem</span></div>
        </div>
        {/* Leads */}
        <div className="kpi-card anim-in" onClick={() => router.push('/pipeline/leads')} role="link" tabIndex={0} title="Ver Pipeline">
          <div className="kpi-top"><div className="kpi-label">Leads — Pipeline</div><div className="kpi-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#C8A97A" strokeWidth="1.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg></div></div>
          <div className="kpi-value" suppressHydrationWarning>{leadsToday}</div>
          <div className="kpi-sub">Novos hoje <b style={{color:'#C8A97A'}}>+3</b></div>
          <svg className="spark" width="100%" height="34" viewBox="0 0 200 34" preserveAspectRatio="none"><polygon fill="rgba(200,169,122,0.08)" points="0,34 0,34 25,28 50,22 75,26 100,18 125,16 150,20 175,12 200,10 200,34"/><polyline fill="none" stroke="rgba(200,169,122,0.55)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points="0,34 25,28 50,22 75,26 100,18 125,16 150,20 175,12 200,10"/></svg>
          <div className="kpi-footer"><span className="delta up">↑ 12%</span><span className="delta-sub">conversão 34%</span></div>
        </div>
        {/* Pedidos */}
        <div className="kpi-card anim-in" onClick={() => router.push('/pedidos')} role="link" tabIndex={0} title="Ver Pedidos">
          <div className="kpi-top"><div className="kpi-label">Pedidos em Aberto</div><div className="kpi-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#C8A97A" strokeWidth="1.5"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg></div></div>
          <div className="kpi-value" suppressHydrationWarning>{openOrders}</div>
          <div className={`kpi-sub ${overdueProduction > 0 ? 'danger' : 'ok'}`}>{overdueProduction > 0 ? `${overdueProduction} com prazo vencido` : 'Nenhum atraso'}</div>
          <svg className="spark" width="100%" height="34" viewBox="0 0 200 34" preserveAspectRatio="none"><polygon fill="rgba(248,113,113,0.07)" points="0,34 0,20 25,18 50,24 75,16 100,20 125,14 150,18 175,16 200,14 200,34"/><polyline fill="none" stroke="rgba(248,113,113,0.45)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points="0,20 25,18 50,24 75,16 100,20 125,14 150,18 175,16 200,14"/></svg>
          <div className="kpi-footer"><span className="delta neu">→ estável</span><span className="delta-sub" style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'120px'}}>{fmtBRL(revenue)} em aberto</span></div>
        </div>
      </div>

      {/* ══════════ 2. FINANCEIRO ══════════ */}
      {/* TASK-016: exibe skeleton se sem dados reais e ainda carregando */
      /* currentMonth null = hydration ainda não rodou, mostra skeleton */}
      <div id="section-financeiro" className="section-divider anim-in">
        <div className="section-divider-icon" style={{background:'rgba(200,169,122,0.1)'}}><svg viewBox="0 0 24 24" fill="none" stroke="#C8A97A" strokeWidth="1.5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
        <span className="section-divider-label">Financeiro</span>
        <div className="section-divider-line"></div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 340px',gap:'12px'}} className="anim-in">
        {/* Chart */}
        <div className="panel anim-in">
          <div className="panel-head"><span className="panel-title">Faturamento — Últimos 30 Dias</span><Link href="/financeiro" className="panel-action">Ver detalhes →</Link></div>
          <div className="panel-body" style={{position:'relative',gap:'10px'}}>
            <div style={{position:'relative',flex:1,minHeight:'200px'}}>
              {hasChartData ? (
                <svg className="chart-svg" width="100%" height="100%" viewBox="0 0 600 180" preserveAspectRatio="none">
                  <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#C8A97A" stopOpacity={0.15}/><stop offset="100%" stopColor="#C8A97A" stopOpacity={0}/></linearGradient></defs>
                  <line x1="0" y1="45" x2="600" y2="45" stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="4 4"/>
                  <line x1="0" y1="90" x2="600" y2="90" stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="4 4"/>
                  <line x1="0" y1="135" x2="600" y2="135" stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="4 4"/>
                  <path className="chart-area" d={chartStats.areaPath} fill="url(#cg)"/>
                  <path className="chart-line" d={chartStats.linePath} fill="none" stroke="#C8A97A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle className="chart-dot" cx={chartStats.dotX} cy={chartStats.dotY} r="4" fill="#111113" stroke="#C8A97A" strokeWidth="2"/>
                </svg>
              ) : (
                <div className="flex h-full min-h-[180px] items-center justify-center rounded-lg border border-dashed border-white/10 text-[11px] text-[#777]">
                  Nenhum dado para o período
                </div>
              )}
            </div>
            <div className="chart-stats">
              <div><div className="cs-label">Maior Dia</div><div className="cs-val" suppressHydrationWarning>{fmtBRL(chartStats.maxDay)}</div></div>
              <div><div className="cs-label">Média Diária</div><div className="cs-val" suppressHydrationWarning>{fmtBRL(chartStats.avgDay)}</div></div>
              <div><div className="cs-label">Meta do Mês</div><div className="cs-val green">94%</div></div>
              <div style={{marginLeft:'auto'}}><div className="cs-label">Projeção</div><div className="cs-val">R$ 51.200</div></div>
            </div>
          </div>
        </div>

        {/* Meta + Pagamentos */}
        <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
          <div className="panel anim-in" style={{flex:1}}>
            <div className="panel-head"><span className="panel-title">Meta do Mês</span><Link href="/financeiro" className="panel-action">Ajustar</Link></div>
            <div className="panel-body">
              <div className="meta-hero"><div className="meta-value" suppressHydrationWarning>{fmtBRL(revenue)}</div><div className="meta-pct">94%</div></div>
              <div style={{fontSize:'10px',color:'#444',marginBottom:'8px'}}>de R$ 50.000 — faltam R$ 2.620</div>
              <div className="meta-bar-wrap"><div className="meta-bar-fill" style={{width:'94%'}}></div></div>
              <div className="meta-stats">
                <div className="meta-stat"><div className="meta-stat-label">Dias úteis</div><div className="meta-stat-val">{businessDaysRemaining} restam</div></div>
                <div className="meta-stat"><div className="meta-stat-label">Diário p/ bater</div><div className="meta-stat-val">R$ 873</div></div>
                <div className="meta-stat"><div className="meta-stat-label">Melhor dia</div><div className="meta-stat-val">R$ 4.280</div></div>
              </div>
              <div className="meta-proj"><div className="meta-proj-label">Projeção de fechamento</div><div className="meta-proj-val">R$ 51.200 ↑</div></div>
            </div>
          </div>
          <div className="panel anim-in">
            <div className="panel-head"><span className="panel-title">Formas de Pagamento</span></div>
            <div className="panel-body" style={{gap:0,justifyContent:'space-around'}}>
              {paymentMethods.map((pm, i) => (
                <div key={i} className="pay-row">
                  <div className="pay-label-row">
                    <span className="pay-lbl">{pm.method === 'CREDIT_CARD' ? 'Cartão de crédito' : pm.method === 'DEBIT_CARD' ? 'Débito' : pm.method === 'PIX' ? 'PIX' : pm.method}</span>
                    <span className="pay-pct">{pm.percentage}%</span>
                  </div>
                  <div className="pay-bg">
                    <div className="pay-fill" style={{width:`${pm.percentage}%`,background: i === 0 ? '#C8A97A' : i === 1 ? '#60A5FA' : '#555'}}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ══════════ 3. AÇÃO IMEDIATA ══════════ */}
      <div id="section-acao-imediata" className="section-divider anim-in">
        <div className="section-divider-icon" style={{background:'rgba(248,113,113,0.1)'}}><svg viewBox="0 0 24 24" fill="none" stroke="#F87171" strokeWidth="1.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
        <span className="section-divider-label">Ação Imediata</span>
        <div className="section-divider-line"></div>
        <span className="section-divider-count">{stockAlerts.length + (overdueProduction > 0 ? 1 : 0)} alertas · {readyOrders.length} prontos</span>
      </div>

      <div className="grid-3 anim-in">
        {/* Alertas */}
        <div className="panel anim-in">
          <div className="panel-head"><span className="panel-title">Alertas — Requer Atenção</span></div>
          <div className="panel-body" style={{gap:0}}>
            {stockAlerts.length > 0 ? stockAlerts.slice(0, 3).map((alert, i) => (
              <div key={i} className="alert-block" role="button" tabIndex={0} style={{'--ac':'#F87171','--abg':'rgba(248,113,113,0.08)'} as any} onClick={() => router.push('/estoque')} onKeyDown={(e) => e.key === 'Enter' && router.push('/estoque')}>
                <div className="alert-kind">Estoque Crítico</div>
                <div className="alert-val">{alert.product_name}</div>
                <div className="alert-sub">Mínimo: {alert.minimum_stock} · Ver no estoque →</div>
              </div>
            )) : (
              <div className="alert-block" style={{'--ac':'#34D399','--abg':'rgba(52,211,153,0.08)'} as any}>
                <div className="alert-kind">Estoque OK</div>
                <div className="alert-val">Nenhum alerta</div>
              </div>
            )}
            {overdueProduction > 0 && (
              <div className="alert-block" style={{'--ac':'#FBBF24','--abg':'rgba(251,191,36,0.08)'} as any}>
                <div className="alert-kind">Produção Atrasada</div>
                <div className="alert-val">{overdueProduction} pedido(s)</div>
                <div className="alert-sub">Requer atenção</div>
              </div>
            )}
          </div>
        </div>

        {/* Agenda */}
        <div className="panel anim-in">
          {/* TASK-017: link padronizado "Ver todos →" */}
          <div className="panel-head"><span className="panel-title">Agenda</span><Link href="/agenda" className="panel-action">Ver todos →</Link></div>
          <div className="panel-body">
            <div className="cal-header">
              <div className="cal-month">
                {currentMonth ? `${CAL_MONTHS[currentMonth.getMonth()]} ${currentMonth.getFullYear()}` : 'Carregando...'}
              </div>
              <div className="cal-nav">
                <button
                  className="cal-nav-btn"
                  onClick={() => setCurrentMonth((prev) => {
                    const base = prev ?? new Date();
                    return new Date(base.getFullYear(), base.getMonth() - 1, 1);
                  })}
                  aria-label="Mês anterior"
                >
                  ‹
                </button>
                <button
                  className="cal-nav-btn"
                  onClick={() => setCurrentMonth((prev) => {
                    const base = prev ?? new Date();
                    return new Date(base.getFullYear(), base.getMonth() + 1, 1);
                  })}
                  aria-label="Próximo mês"
                >
                  ›
                </button>
              </div>
            </div>
            <div className="cal-grid">
              <div className="cal-dow">D</div><div className="cal-dow">S</div><div className="cal-dow">T</div><div className="cal-dow">Q</div><div className="cal-dow">Q</div><div className="cal-dow">S</div><div className="cal-dow">S</div>
              {calendarCells.map((cell) => (
                <div
                  key={cell.key}
                  className={`cal-day ${cell.isCurrentMonth ? '' : 'other-month'} ${cell.isToday ? 'today' : ''} ${appointmentDateKeys.has(cell.dateKey) ? 'has-event' : ''}`}
                >
                  {cell.day}
                </div>
              ))}
            </div>
            <div className="section-label">Hoje — {todayLabel}</div>
            {todayAppointments.length > 0 ? todayAppointments.map((appointment, index) => (
              <div className="cal-event-row" key={appointment.id}>
                <div className="cal-event-time">{formatTimeOnly(appointment.starts_at)}</div>
                <div className="cal-event-dot" style={{background: index === 0 ? '#C8A97A' : index === 1 ? '#60A5FA' : '#555'}}></div>
                <div className="cal-event-name">{appointment.contact_name}</div>
                <div className="cal-event-sub">{appointment.type}</div>
              </div>
            )) : (
              <div style={{textAlign:'center',padding:'14px',color:'#666'}}>Nenhum agendamento hoje</div>
            )}
          </div>
        </div>

        {/* Prontos */}
        <div className="panel anim-in">
          <div className="panel-head"><span className="panel-title">Prontos — Aguardando Retirada</span><Link href="/pedidos" className="panel-action">Ver todos →</Link></div>
          <div className="panel-body">
            {readyOrders.length > 0 ? (
              readyOrders.slice(0, 3).map((order, i) => (
                <div key={i} className="pronto-row">
                  <div className="pronto-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
                  <div className="pronto-info"><div className="pronto-id">{order.order_number}</div><div className="pronto-cliente">{order.client_name}</div></div>
                  <div className="pronto-right">
                    <div className="pronto-val">{formatCurrencyFromCents(order.total_cents)}</div>
                    <div className={`pronto-dias ${order.ready_days > 2 ? 'urgent' : ''}`}>{order.ready_days === 0 ? 'Hoje' : `${order.ready_days} dia(s) aguardando`}</div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{textAlign:'center',padding:'20px',color:'#666'}}>Nenhum pedido pronto</div>
            )}
            {readyOrders.length > 0 && (
              <div className="pronto-footer">
                <div className="pronto-footer-label">Total retido</div>
                <div className="pronto-footer-val">{formatCurrencyFromCents(readyOrdersTotalCents)}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══════════ 4. OPERAÇÕES ══════════ */}
      <div id="section-operacoes" className="section-divider anim-in">
        <div className="section-divider-icon" style={{background:'rgba(129,140,248,0.1)'}}><svg viewBox="0 0 24 24" fill="none" stroke="#818CF8" strokeWidth="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></div>
        <span className="section-divider-label">Operações</span>
        <div className="section-divider-line"></div>
        <span className="section-divider-count">{openOrders} pedidos ativos</span>
      </div>

      <div className="grid-2 anim-in">
        {/* Produção por Etapa */}
        {/* TASK-015: Produção por Etapa — mesmas etapas do card de Tempo Médio */}
        <div className="panel anim-in">
          <div className="panel-head"><span className="panel-title">Produção por Etapa</span><Link href="/producao" className="panel-action">Ver todos →</Link></div>
          <div className="panel-body" style={{justifyContent:'space-around'}}>
            {productionByStage.map((stage, i) => (
              <div key={i} className="funnel-row">
                <div className="funnel-dot" style={{background: i === 0 ? '#818CF8' : i === 1 ? '#FBBF24' : i === 2 ? '#C8A97A' : i === 3 ? '#34D399' : '#60A5FA'}}></div>
                <div className="funnel-label">{stage.stage_label}</div>
                <div className="funnel-bar-bg"><div className="funnel-bar" style={{width: `${Math.min(100, (stage.count / (productionByStage[0]?.count || 1)) * 100)}%`, background: i === 0 ? '#818CF8' : i === 1 ? '#FBBF24' : i === 2 ? '#C8A97A' : i === 3 ? '#34D399' : '#60A5FA'}}></div></div>
                <div className={`funnel-count ${stage.stage === 'PAUSADA' ? 'warn' : ''}`}>{stage.count}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tempo Médio */}
        {/* TASK-015: Tempo Médio por Etapa — usa mesmas etapas canônicas de PRODUCTION_STAGES_CANONICAL */}
        <div className="panel anim-in">
          <div className="panel-head"><span className="panel-title">Tempo Médio por Etapa</span></div>
          <div className="panel-body" style={{gap:0}}>
            {PRODUCTION_STAGES_CANONICAL.map((stage) => {
              const dayClass = stage.avg_days < 2 ? 'ok' : stage.avg_days < 3.5 ? 'warn' : 'bad';
              return (
                <div key={stage.stage_label} className="tempo-row">
                  <div className="tempo-dot" style={{background: stage.color}} />
                  <div className="tempo-label">{stage.stage_label}</div>
                  <div className="tempo-bar-bg"><div className="tempo-bar" style={{width:`${stage.pct}%`, background: stage.color}} /></div>
                  <div className={`tempo-days ${dayClass}`}>{stage.avg_days.toFixed(1).replace('.',',')} dias</div>
                </div>
              );
            })}
            <div className="tempo-avg"><div className="tempo-avg-label">Ciclo completo médio</div><div className="tempo-avg-val">12 dias</div></div>
          </div>
        </div>
      </div>

      {/* ══════════ 5. COMERCIAL ══════════ */}
      <div id="section-comercial" className="section-divider anim-in">
        <div className="section-divider-icon" style={{background:'rgba(52,211,153,0.1)'}}><svg viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
        <span className="section-divider-label">Comercial</span>
        <div className="section-divider-line"></div>
        <span className="section-divider-count">{leadsToday} leads · {totalLeads} contatos</span>
      </div>

      <div className="grid-3 anim-in">
        {/* Feed */}
        <div className="panel anim-in">
          <div className="panel-head"><span className="panel-title">Atividade Recente</span><Link href="/leads" className="panel-action">Ver todos →</Link></div>
          <div className="panel-body" style={{gap:0}}>
            {activity.length > 0 ? activity.slice(0, 7).map((e, i) => (
              <div className="feed-row" key={i}>
                <span className="feed-badge" style={{background: e.kind === 'lead' ? 'rgba(200,169,122,0.15)' : 'rgba(52,211,153,0.15)', color: e.kind === 'lead' ? '#C8A97A' : '#34D399'}}>{e.kind === 'lead' ? 'Lead' : 'Pedido'}</span>
                <div className="feed-name" style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{e.label}</div>
                {/* TASK-008: label contextual ao invés de "Novo registro" genérico */}
                <div className="feed-meta">{activityLabel(e.kind, e.label)}</div>
                <div className="feed-time" suppressHydrationWarning>
                  {relativeTime(e.created_at)}
                </div>
              </div>
            )) : (
              <div style={{textAlign:'center',padding:'20px',color:'#666'}}>Nenhuma atividade recente</div>
            )}
          </div>
        </div>

        {/* Top Clientes */}
        <div className="panel anim-in">
          <div className="panel-head"><span className="panel-title">Top Clientes — Mês</span><Link href="/clientes" className="panel-action">Ver todos →</Link></div>
          <div className="panel-body" style={{gap:0}}>
            {topClients.map((client, i) => (
              <div key={i} className="cliente-row">
                <div className="cliente-rank">{i + 1}</div>
                <div className="cliente-avatar" style={{background:'rgba(200,169,122,0.15)',color:'#C8A97A',border:'1px solid rgba(200,169,122,0.2)'}}>
                  {client.client_name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                </div>
                <div className="cliente-info"><b>{client.client_name}</b><span>{client.order_count} pedido(s)</span></div>
                <div className="cliente-val" suppressHydrationWarning style={{color: i === 0 ? '#C8A97A' : '#888'}}>{formatCurrencyFromCents(client.total_cents)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Aniversariantes */}
        <div className="panel anim-in">
          <div className="panel-head"><span className="panel-title">Aniversariantes da Semana</span><Link href="/clientes" className="panel-action">Ver todos →</Link></div>
          <div className="panel-body" style={{gap:0}}>
            <div className="aniv-row"><div className="aniv-avatar" style={{background:'rgba(200,169,122,0.15)',color:'#C8A97A',border:'1px solid rgba(200,169,122,0.2)'}}>AC</div><div className="aniv-info"><div className="aniv-name">Ana Carolina</div><div className="aniv-sub">27 Mar · cliente há 3 anos</div></div><span className="aniv-badge hoje">Hoje 🎂</span></div>
            <div className="aniv-row"><div className="aniv-avatar" style={{background:'rgba(96,165,250,0.12)',color:'#60A5FA',border:'1px solid rgba(96,165,250,0.2)'}}>MR</div><div className="aniv-info"><div className="aniv-name">Mariana Ramos</div><div className="aniv-sub">28 Mar · 2 pedidos no histórico</div></div><span className="aniv-badge amanha">Amanhã</span></div>
            <div className="aniv-row"><div className="aniv-avatar" style={{background:'rgba(192,132,252,0.12)',color:'#C084FC',border:'1px solid rgba(192,132,252,0.2)'}}>JS</div><div className="aniv-info"><div className="aniv-name">João Silveira</div><div className="aniv-sub">31 Mar · cliente VIP</div></div><span className="aniv-badge semana">Sex</span></div>
            <div className="aniv-cta">
              <button
                type="button"
                className="aniv-btn"
                onClick={() => setCongratsOpen(true)}
                aria-label="Enviar mensagem de parabéns para Ana Carolina"
              >
                <Mail size={13} style={{flexShrink:0}} /> Enviar parabéns
              </button>
              <button
                type="button"
                className="aniv-btn"
                onClick={() => window.open('https://wa.me/5511999991111?text=' + encodeURIComponent('Feliz aniversário, Ana! 🎂🎉 Que seu dia seja incrível!'), '_blank')}
                aria-label="Mandar WhatsApp para Ana Carolina"
              >
                <MessageCircle size={13} style={{flexShrink:0}} /> Mandar WhatsApp
              </button>
            </div>
            {congratsOpen && (
              <div style={{marginTop:'10px',padding:'12px',background:'rgba(200,169,122,0.08)',borderRadius:'8px',border:'1px solid rgba(200,169,122,0.2)'}}>
                <div style={{fontSize:'10px',letterSpacing:'.14em',textTransform:'uppercase',color:'#C8A97A',marginBottom:'6px'}}>Mensagem de parabéns</div>
                <div style={{fontSize:'12px',color:'#C8C6C0',lineHeight:1.6,marginBottom:'8px'}}>
                  Olá, Ana Carolina! 🎂 Passamos para desejar um feliz aniversário! É um prazer tê-la como nossa cliente. Aproveite muito seu dia especial!
                </div>
                <div style={{display:'flex',gap:'6px'}}>
                  <button type="button" className="aniv-btn" style={{fontSize:'10px',padding:'5px'}} onClick={() => {
                    window.open('https://wa.me/5511999991111?text=' + encodeURIComponent('Olá, Ana Carolina! 🎂 Passamos para desejar um feliz aniversário! É um prazer tê-la como nossa cliente. Aproveite muito seu dia especial!'), '_blank');
                    setCongratsOpen(false);
                  }}>
                    <MessageCircle size={11} /> Enviar via WhatsApp
                  </button>
                  <button type="button" className="aniv-btn" style={{fontSize:'10px',padding:'5px',background:'transparent',border:'1px solid rgba(255,255,255,0.08)',color:'#666'}} onClick={() => setCongratsOpen(false)}>
                    Fechar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══════════ 6. ANALYTICS ══════════ */}
      <div id="section-analytics" className="section-divider anim-in">
        <div className="section-divider-icon" style={{background:'rgba(96,165,250,0.1)'}}><svg viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></div>
        <span className="section-divider-label">Analytics</span>
        <div className="section-divider-line"></div>
      </div>

      <div className="grid-2 anim-in">
        {/* Heatmap */}
        <div className="panel anim-in">
          <div className="panel-head"><span className="panel-title">Mapa de Calor — Vendas por Dia × Horário</span></div>
          <div className="panel-body">
            <div className="heatmap-wrap">
              <div className="heatmap-days">
                {HM_DAYS.map(d => <div className="heatmap-day-label" key={d}>{d}</div>)}
              </div>
              <div className="heatmap-main">
                <div className="heatmap-hours">
                  {Array.from({length:12}, (_,i) => <div className="hm-hour" key={i}>{9+i}h</div>)}
                </div>
                <div className="heatmap-grid" id="hm-grid">
                  {HM_WEIGHTS.map((row, d) => (
                    <div className="hm-row" key={d}>
                      {row.map((v, h) => (
                        <div className="hm-cell" key={h} style={{background:`rgba(200,169,122,${v===0?0.03:(v/9*0.9).toFixed(2)})`}} title={`${HM_DAYS[d]} ${9+h}h — ${v} vendas`}></div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="hm-legend">
              <div className="hm-legend-label">Menos</div>
              <div className="hm-legend-bar">
                <div className="hm-legend-swatch" style={{background:'rgba(200,169,122,0.08)'}}></div>
                <div className="hm-legend-swatch" style={{background:'rgba(200,169,122,0.25)'}}></div>
                <div className="hm-legend-swatch" style={{background:'rgba(200,169,122,0.45)'}}></div>
                <div className="hm-legend-swatch" style={{background:'rgba(200,169,122,0.65)'}}></div>
                <div className="hm-legend-swatch" style={{background:'rgba(200,169,122,0.9)'}}></div>
              </div>
              <div className="hm-legend-label">Mais vendas</div>
            </div>
          </div>
        </div>

        {/* Leads por Origem */}
        <div className="panel anim-in">
          <div className="panel-head"><span className="panel-title">Leads por Origem</span></div>
          <div className="panel-body" style={{justifyContent:'center'}}>
            <div style={{display:'flex',alignItems:'center',gap:'24px'}}>
              <svg className="donut-svg" width="130" height="130" viewBox="0 0 130 130" style={{flexShrink:0}}>
                <circle cx="65" cy="65" r="48" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="18"/>
                {donutRings}
                <text x="65" y="60" textAnchor="middle" fontFamily="Playfair Display" fontSize="20" fontWeight="600" fill="#E8E4DE">{totalLeads}</text>
                <text x="65" y="76" textAnchor="middle" fontFamily="Inter" fontSize="9" fill="#555" letterSpacing="1">TOTAL</text>
              </svg>
              <div style={{flex:1}}>
                {leadsBySource.map((source, i) => {
                  const sourceLabel = source.source === 'whatsapp' ? 'WhatsApp' : source.source === 'instagram' ? 'Instagram' : source.source === 'indicacao' ? 'Indicação' : source.source === 'site' ? 'Site' : 'Outros';
                  const colors = ['#34D399', '#C084FC', '#C8A97A', '#60A5FA', '#333'];
                  return (
                    <div key={i} className="origem-row">
                      <div className="origem-dot" style={{background: colors[i % colors.length]}}></div>
                      <div className="origem-label">{sourceLabel}</div>
                      <div className="origem-bar-bg"><div className="origem-bar" style={{width: `${source.percentage}%`, background: colors[i % colors.length]}}></div></div>
                      <div className="origem-count" style={{color: colors[i % colors.length]}}>{source.count}</div>
                      <div className="origem-pct">{source.percentage}%</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Produtos */}
      <div className="panel anim-in">
        <div className="panel-head"><span className="panel-title">Produtos Mais Vendidos</span><Link href="/estoque" className="panel-action">Ver todos →</Link></div>
        <div className="panel-body">
          <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:'16px'}}>
            <div className="product-card anim-in"><div className="product-rank" style={{color:'#C8A97A'}}>1º</div><div className="product-name">Anel Solitário Ouro 18k</div><div className="product-val">R$ 18.400</div><div className="product-qty">12 unid.</div></div>
            <div className="product-card anim-in"><div className="product-rank" style={{color:'#888'}}>2º</div><div className="product-name">Aliança Personalizada</div><div className="product-val">R$ 13.200</div><div className="product-qty">8 unid.</div></div>
            <div className="product-card anim-in"><div className="product-rank" style={{color:'#888'}}>3º</div><div className="product-name">Brinco Gota Prata 925</div><div className="product-val">R$ 7.200</div><div className="product-qty">18 unid.</div></div>
            <div className="product-card anim-in"><div className="product-rank" style={{color:'#888'}}>4º</div><div className="product-name">Colar Veneziana Ouro</div><div className="product-val">R$ 5.600</div><div className="product-qty">7 unid.</div></div>
            <div className="product-card anim-in"><div className="product-rank" style={{color:'#888'}}>5º</div><div className="product-name">Pulseira Elos Prata</div><div className="product-val">R$ 2.980</div><div className="product-qty">11 unid.</div></div>
          </div>
        </div>
      </div>

    </div>
  );
}
