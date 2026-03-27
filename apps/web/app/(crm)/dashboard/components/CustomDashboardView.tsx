"use client";

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import type { DashboardPayload } from '@/lib/api';
import { formatCurrencyFromCents } from '@/lib/utils';
import './DashboardTemplate.css';

interface Props {
  data: DashboardPayload;
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

export function CustomDashboardView({ data }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  /* ─── KPIs from real data ─── */
  const revenue = (data.kpis.month_revenue_cents || 0) / 100;
  const leads   = data.kpis.leads_today || 0;
  const open    = data.kpis.open_orders || 0;

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

  return (
    <div className="dashboard-root" ref={rootRef}>

      {/* ══════════ 1. VISÃO GERAL — KPIs ══════════ */}
      <div className="grid-4 anim-in">
        {/* Faturamento */}
        <div className="kpi-card anim-in">
          <div className="kpi-top"><div className="kpi-label">Faturamento do Mês</div><div className="kpi-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#C8A97A" strokeWidth="1.5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div></div>
          <div className="kpi-value">{fmtBRL(revenue)}</div>
          <svg className="spark" width="100%" height="34" viewBox="0 0 200 34" preserveAspectRatio="none"><polygon fill="rgba(200,169,122,0.08)" points="0,34 0,30 25,26 50,28 75,20 100,22 125,14 150,11 175,8 200,6 200,34"/><polyline fill="none" stroke="rgba(200,169,122,0.55)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points="0,30 25,26 50,28 75,20 100,22 125,14 150,11 175,8 200,6"/></svg>
          <div className="kpi-footer"><span className="delta up">↑ 18%</span><span className="delta-sub">vs mês anterior</span></div>
        </div>
        {/* PDV */}
        <div className="kpi-card anim-in">
          <div className="kpi-top"><div className="kpi-label">PDV — Vendas Hoje</div><div className="kpi-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#C8A97A" strokeWidth="1.5"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg></div></div>
          <div className="kpi-value">7</div>
          <div className="kpi-sub">Ticket médio <b>R$ 1.240</b></div>
          <svg className="spark" width="100%" height="34" viewBox="0 0 200 34" preserveAspectRatio="none"><polygon fill="rgba(200,169,122,0.08)" points="0,34 0,32 25,26 50,28 75,22 100,18 125,24 150,14 175,10 200,16 200,34"/><polyline fill="none" stroke="rgba(200,169,122,0.55)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points="0,32 25,26 50,28 75,22 100,18 125,24 150,14 175,10 200,16"/></svg>
          <div className="kpi-footer"><span className="delta up">↑ +3</span><span className="delta-sub">vs ontem</span></div>
        </div>
        {/* Leads */}
        <div className="kpi-card anim-in">
          <div className="kpi-top"><div className="kpi-label">Leads — Pipeline</div><div className="kpi-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#C8A97A" strokeWidth="1.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg></div></div>
          <div className="kpi-value">{leads || 24}</div>
          <div className="kpi-sub">Novos hoje <b style={{color:'#C8A97A'}}>+3</b></div>
          <svg className="spark" width="100%" height="34" viewBox="0 0 200 34" preserveAspectRatio="none"><polygon fill="rgba(200,169,122,0.08)" points="0,34 0,34 25,28 50,22 75,26 100,18 125,16 150,20 175,12 200,10 200,34"/><polyline fill="none" stroke="rgba(200,169,122,0.55)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points="0,34 25,28 50,22 75,26 100,18 125,16 150,20 175,12 200,10"/></svg>
          <div className="kpi-footer"><span className="delta up">↑ 12%</span><span className="delta-sub">conversão 34%</span></div>
        </div>
        {/* Pedidos */}
        <div className="kpi-card anim-in">
          <div className="kpi-top"><div className="kpi-label">Pedidos em Aberto</div><div className="kpi-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#C8A97A" strokeWidth="1.5"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg></div></div>
          <div className="kpi-value">{open || 12}</div>
          <div className="kpi-sub danger">3 com prazo vencido</div>
          <svg className="spark" width="100%" height="34" viewBox="0 0 200 34" preserveAspectRatio="none"><polygon fill="rgba(248,113,113,0.07)" points="0,34 0,20 25,18 50,24 75,16 100,20 125,14 150,18 175,16 200,14 200,34"/><polyline fill="none" stroke="rgba(248,113,113,0.45)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points="0,20 25,18 50,24 75,16 100,20 125,14 150,18 175,16 200,14"/></svg>
          <div className="kpi-footer"><span className="delta neu">→ estável</span><span className="delta-sub">R$ 28.400 em aberto</span></div>
        </div>
      </div>

      {/* ══════════ 2. FINANCEIRO ══════════ */}
      <div className="section-divider anim-in">
        <div className="section-divider-icon" style={{background:'rgba(200,169,122,0.1)'}}><svg viewBox="0 0 24 24" fill="none" stroke="#C8A97A" strokeWidth="1.5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
        <span className="section-divider-label">Financeiro</span>
        <div className="section-divider-line"></div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 340px',gap:'12px'}} className="anim-in">
        {/* Chart */}
        <div className="panel anim-in">
          <div className="panel-head"><span className="panel-title">Faturamento — Últimos 30 Dias</span><Link href="/financeiro" className="panel-action">Exportar</Link></div>
          <div className="panel-body" style={{position:'relative',gap:'10px'}}>
            <div style={{position:'relative',flex:1,minHeight:'200px'}}>
              <svg className="chart-svg" width="100%" height="100%" viewBox="0 0 600 180" preserveAspectRatio="none">
                <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#C8A97A" stopOpacity={0.15}/><stop offset="100%" stopColor="#C8A97A" stopOpacity={0}/></linearGradient></defs>
                <line x1="0" y1="45" x2="600" y2="45" stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="4 4"/>
                <line x1="0" y1="90" x2="600" y2="90" stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="4 4"/>
                <line x1="0" y1="135" x2="600" y2="135" stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="4 4"/>
                <path className="chart-area" d="M0,170 L50,150 L100,155 L150,130 L200,125 L250,95 L300,105 L350,75 L400,70 L450,40 L500,55 L550,25 L600,35 L600,180 L0,180 Z" fill="url(#cg)"/>
                <path className="chart-line" d="M0,170 L50,150 L100,155 L150,130 L200,125 L250,95 L300,105 L350,75 L400,70 L450,40 L500,55 L550,25 L600,35" fill="none" stroke="#C8A97A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                <circle className="chart-dot" cx="600" cy="35" r="4" fill="#111113" stroke="#C8A97A" strokeWidth="2"/>
              </svg>
            </div>
            <div className="chart-stats">
              <div><div className="cs-label">Maior Dia</div><div className="cs-val">R$ 4.280</div></div>
              <div><div className="cs-label">Média Diária</div><div className="cs-val">R$ 1.579</div></div>
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
              <div className="meta-hero"><div className="meta-value">{fmtBRL(revenue)}</div><div className="meta-pct">94%</div></div>
              <div style={{fontSize:'10px',color:'#444',marginBottom:'8px'}}>de R$ 50.000 — faltam R$ 2.620</div>
              <div className="meta-bar-wrap"><div className="meta-bar-fill" style={{width:'94%'}}></div></div>
              <div className="meta-stats">
                <div className="meta-stat"><div className="meta-stat-label">Dias úteis</div><div className="meta-stat-val">3 restam</div></div>
                <div className="meta-stat"><div className="meta-stat-label">Diário p/ bater</div><div className="meta-stat-val">R$ 873</div></div>
                <div className="meta-stat"><div className="meta-stat-label">Melhor dia</div><div className="meta-stat-val">R$ 4.280</div></div>
              </div>
              <div className="meta-proj"><div className="meta-proj-label">Projeção de fechamento</div><div className="meta-proj-val">R$ 51.200 ↑</div></div>
            </div>
          </div>
          <div className="panel anim-in">
            <div className="panel-head"><span className="panel-title">Formas de Pagamento</span></div>
            <div className="panel-body" style={{gap:0,justifyContent:'space-around'}}>
              <div className="pay-row"><div className="pay-label-row"><span className="pay-lbl">Cartão de crédito</span><span className="pay-pct">52%</span></div><div className="pay-bg"><div className="pay-fill" style={{width:'52%',background:'#C8A97A'}}></div></div></div>
              <div className="pay-row"><div className="pay-label-row"><span className="pay-lbl">PIX</span><span className="pay-pct">31%</span></div><div className="pay-bg"><div className="pay-fill" style={{width:'31%',background:'#60A5FA'}}></div></div></div>
              <div className="pay-row"><div className="pay-label-row"><span className="pay-lbl">Débito</span><span className="pay-pct">17%</span></div><div className="pay-bg"><div className="pay-fill" style={{width:'17%',background:'#555'}}></div></div></div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════ 3. AÇÃO IMEDIATA ══════════ */}
      <div className="section-divider anim-in">
        <div className="section-divider-icon" style={{background:'rgba(248,113,113,0.1)'}}><svg viewBox="0 0 24 24" fill="none" stroke="#F87171" strokeWidth="1.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
        <span className="section-divider-label">Ação Imediata</span>
        <div className="section-divider-line"></div>
        <span className="section-divider-count">3 alertas · 3 prontos</span>
      </div>

      <div className="grid-3 anim-in">
        {/* Alertas */}
        <div className="panel anim-in">
          <div className="panel-head"><span className="panel-title">Alertas — Requer Atenção</span></div>
          <div className="panel-body" style={{gap:0}}>
            <div className="alert-block" style={{'--ac':'#F87171','--abg':'rgba(248,113,113,0.08)'} as any}><div className="alert-kind">Estoque Crítico</div><div className="alert-val">Ouro 18k — 3g restantes</div><div className="alert-sub">Mínimo: 10g</div></div>
            <div className="alert-block" style={{'--ac':'#F87171','--abg':'rgba(248,113,113,0.08)'} as any}><div className="alert-kind">Estoque Crítico</div><div className="alert-val">Prata 925 — 8g restantes</div><div className="alert-sub">Mínimo: 20g</div></div>
            <div className="alert-block" style={{'--ac':'#FBBF24','--abg':'rgba(251,191,36,0.08)'} as any}><div className="alert-kind">Produção Atrasada</div><div className="alert-val">Pedido #PED-0042</div><div className="alert-sub">2 dias de atraso</div></div>
          </div>
        </div>

        {/* Agenda */}
        <div className="panel anim-in">
          <div className="panel-head"><span className="panel-title">Agenda</span><Link href="/agenda" className="panel-action">Ver completo →</Link></div>
          <div className="panel-body">
            <div className="cal-header"><div className="cal-month">Março 2026</div><div className="cal-nav"><button className="cal-nav-btn">‹</button><button className="cal-nav-btn">›</button></div></div>
            <div className="cal-grid">
              <div className="cal-dow">D</div><div className="cal-dow">S</div><div className="cal-dow">T</div><div className="cal-dow">Q</div><div className="cal-dow">Q</div><div className="cal-dow">S</div><div className="cal-dow">S</div>
              <div className="cal-day other-month">23</div><div className="cal-day other-month">24</div><div className="cal-day other-month">25</div><div className="cal-day other-month">26</div><div className="cal-day other-month">27</div><div className="cal-day other-month">28</div><div className="cal-day">1</div>
              <div className="cal-day">2</div><div className="cal-day has-event">3</div><div className="cal-day">4</div><div className="cal-day has-event">5</div><div className="cal-day">6</div><div className="cal-day has-event">7</div><div className="cal-day">8</div>
              <div className="cal-day">9</div><div className="cal-day has-event">10</div><div className="cal-day">11</div><div className="cal-day">12</div><div className="cal-day has-event">13</div><div className="cal-day">14</div><div className="cal-day">15</div>
              <div className="cal-day has-event">16</div><div className="cal-day">17</div><div className="cal-day has-event">18</div><div className="cal-day">19</div><div className="cal-day">20</div><div className="cal-day has-event">21</div><div className="cal-day">22</div>
              <div className="cal-day">23</div><div className="cal-day">24</div><div className="cal-day">25</div><div className="cal-day">26</div><div className="cal-day today">27</div><div className="cal-day has-event">28</div><div className="cal-day">29</div>
              <div className="cal-day">30</div><div className="cal-day has-event">31</div>
            </div>
            <div className="section-label">Hoje — 27 Mar</div>
            <div className="cal-event-row"><div className="cal-event-time">10:00</div><div className="cal-event-dot" style={{background:'#C8A97A'}}></div><div className="cal-event-name">Ana Lima</div><div className="cal-event-sub">Anel noivado</div></div>
            <div className="cal-event-row"><div className="cal-event-time">14:00</div><div className="cal-event-dot" style={{background:'#60A5FA'}}></div><div className="cal-event-name">Carlos Mendes</div><div className="cal-event-sub">Entrega pulseira</div></div>
            <div className="cal-event-row"><div className="cal-event-time">16:30</div><div className="cal-event-dot" style={{background:'#555'}}></div><div className="cal-event-name">Revisão orçamento</div><div className="cal-event-sub">#PED-0051</div></div>
          </div>
        </div>

        {/* Prontos */}
        <div className="panel anim-in">
          <div className="panel-head"><span className="panel-title">Prontos — Aguardando Retirada</span><Link href="/pedidos" className="panel-action">Ver todos</Link></div>
          <div className="panel-body">
            <div className="pronto-row"><div className="pronto-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div><div className="pronto-info"><div className="pronto-id">#PED-0041</div><div className="pronto-cliente">Ana Carolina — Anel solitário</div></div><div className="pronto-right"><div className="pronto-val">R$ 4.200</div><div className="pronto-dias urgent">3 dias aguardando</div></div></div>
            <div className="pronto-row"><div className="pronto-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div><div className="pronto-info"><div className="pronto-id">#PED-0039</div><div className="pronto-cliente">Roberto Lima — Brincos</div></div><div className="pronto-right"><div className="pronto-val">R$ 1.200</div><div className="pronto-dias">1 dia aguardando</div></div></div>
            <div className="pronto-row"><div className="pronto-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div><div className="pronto-info"><div className="pronto-id">#PED-0044</div><div className="pronto-cliente">Julia Siqueira — Aliança</div></div><div className="pronto-right"><div className="pronto-val">R$ 3.800</div><div className="pronto-dias">Hoje</div></div></div>
            <div className="pronto-footer"><div className="pronto-footer-label">Total retido</div><div className="pronto-footer-val">R$ 9.200</div></div>
          </div>
        </div>
      </div>

      {/* ══════════ 4. OPERAÇÕES ══════════ */}
      <div className="section-divider anim-in">
        <div className="section-divider-icon" style={{background:'rgba(129,140,248,0.1)'}}><svg viewBox="0 0 24 24" fill="none" stroke="#818CF8" strokeWidth="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></div>
        <span className="section-divider-label">Operações</span>
        <div className="section-divider-line"></div>
        <span className="section-divider-count">12 pedidos ativos</span>
      </div>

      <div className="grid-2 anim-in">
        {/* Produção por Etapa */}
        <div className="panel anim-in">
          <div className="panel-head"><span className="panel-title">Produção por Etapa</span><Link href="/producao" className="panel-action">Ver tudo →</Link></div>
          <div className="panel-body" style={{justifyContent:'space-around'}}>
            <div className="funnel-row"><div className="funnel-dot" style={{background:'#818CF8'}}></div><div className="funnel-label">Designer 3D</div><div className="funnel-bar-bg"><div className="funnel-bar" style={{width:'80%',background:'#818CF8'}}></div></div><div className="funnel-count">4</div></div>
            <div className="funnel-row"><div className="funnel-dot" style={{background:'#FBBF24'}}></div><div className="funnel-label">Fabricação</div><div className="funnel-bar-bg"><div className="funnel-bar" style={{width:'50%',background:'#FBBF24'}}></div></div><div className="funnel-count">2</div></div>
            <div className="funnel-row"><div className="funnel-dot" style={{background:'#C8A97A'}}></div><div className="funnel-label">Acabamento</div><div className="funnel-bar-bg"><div className="funnel-bar" style={{width:'50%',background:'#C8A97A'}}></div></div><div className="funnel-count warn">2</div></div>
            <div className="funnel-row"><div className="funnel-dot" style={{background:'#34D399'}}></div><div className="funnel-label">Entrega</div><div className="funnel-bar-bg"><div className="funnel-bar" style={{width:'25%',background:'#34D399'}}></div></div><div className="funnel-count">1</div></div>
            <div className="funnel-row"><div className="funnel-dot" style={{background:'#60A5FA'}}></div><div className="funnel-label">Atendimento</div><div className="funnel-bar-bg"><div className="funnel-bar" style={{width:'60%',background:'#60A5FA'}}></div></div><div className="funnel-count">3</div></div>
          </div>
        </div>

        {/* Tempo Médio */}
        <div className="panel anim-in">
          <div className="panel-head"><span className="panel-title">Tempo Médio por Etapa</span></div>
          <div className="panel-body" style={{gap:0}}>
            <div className="tempo-row"><div className="tempo-dot" style={{background:'#818CF8'}}></div><div className="tempo-label">Designer 3D</div><div className="tempo-bar-bg"><div className="tempo-bar" style={{width:'37%',background:'#818CF8'}}></div></div><div className="tempo-days ok">1,5 dias</div></div>
            <div className="tempo-row"><div className="tempo-dot" style={{background:'#FBBF24'}}></div><div className="tempo-label">Fundição</div><div className="tempo-bar-bg"><div className="tempo-bar" style={{width:'80%',background:'#FBBF24'}}></div></div><div className="tempo-days warn">3,2 dias</div></div>
            <div className="tempo-row"><div className="tempo-dot" style={{background:'#C8A97A'}}></div><div className="tempo-label">Cravação</div><div className="tempo-bar-bg"><div className="tempo-bar" style={{width:'60%',background:'#C8A97A'}}></div></div><div className="tempo-days warn">2,4 dias</div></div>
            <div className="tempo-row"><div className="tempo-dot" style={{background:'#F87171'}}></div><div className="tempo-label">Acabamento</div><div className="tempo-bar-bg"><div className="tempo-bar" style={{width:'100%',background:'#F87171'}}></div></div><div className="tempo-days bad">4,1 dias</div></div>
            <div className="tempo-row"><div className="tempo-dot" style={{background:'#34D399'}}></div><div className="tempo-label">Polimento</div><div className="tempo-bar-bg"><div className="tempo-bar" style={{width:'20%',background:'#34D399'}}></div></div><div className="tempo-days ok">0,8 dias</div></div>
            <div className="tempo-avg"><div className="tempo-avg-label">Ciclo completo médio</div><div className="tempo-avg-val">12 dias</div></div>
          </div>
        </div>
      </div>

      {/* ══════════ 5. COMERCIAL ══════════ */}
      <div className="section-divider anim-in">
        <div className="section-divider-icon" style={{background:'rgba(52,211,153,0.1)'}}><svg viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
        <span className="section-divider-label">Comercial</span>
        <div className="section-divider-line"></div>
        <span className="section-divider-count">{leads || 24} leads · 87 contatos</span>
      </div>

      <div className="grid-3 anim-in">
        {/* Feed */}
        <div className="panel anim-in">
          <div className="panel-head"><span className="panel-title">Atividade Recente</span><Link href="/leads" className="panel-action">Ver histórico →</Link></div>
          <div className="panel-body" style={{gap:0}}>
            {data.activity.length > 0 ? data.activity.slice(0, 7).map((e, i) => (
              <div className="feed-row" key={i}>
                <span className="feed-badge" style={{background: e.kind === 'lead' ? 'rgba(200,169,122,0.15)' : 'rgba(52,211,153,0.15)', color: e.kind === 'lead' ? '#C8A97A' : '#34D399'}}>{e.kind === 'lead' ? 'Lead' : 'Pedido'}</span>
                <div className="feed-name" style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{e.label}</div>
                <div className="feed-meta">Novo registro</div>
                <div className="feed-time">{new Date(e.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div>
              </div>
            )) : (
              <>
                <div className="feed-row"><span className="feed-badge" style={{background:'rgba(200,169,122,0.15)',color:'#C8A97A'}}>Lead</span><div className="feed-name">Mariana Costa</div><div className="feed-meta">Anel solitário — R$ 3.800</div><div className="feed-time">há 12 min</div></div>
                <div className="feed-row"><span className="feed-badge" style={{background:'rgba(200,169,122,0.15)',color:'#C8A97A'}}>Pedido</span><div className="feed-name">Pedro Alves</div><div className="feed-meta">Aliança — Aprovado</div><div className="feed-time">há 34 min</div></div>
                <div className="feed-row"><span className="feed-badge" style={{background:'rgba(52,211,153,0.15)',color:'#34D399'}}>WhatsApp</span><div className="feed-name">Juliana Ramos</div><div className="feed-meta">Orçamento solicitado</div><div className="feed-time">há 1h</div></div>
                <div className="feed-row"><span className="feed-badge" style={{background:'rgba(251,191,36,0.15)',color:'#FBBF24'}}>Produção</span><div className="feed-name">#PED-0038</div><div className="feed-meta">Entrou em fabricação</div><div className="feed-time">há 2h</div></div>
              </>
            )}
          </div>
        </div>

        {/* Top Clientes */}
        <div className="panel anim-in">
          <div className="panel-head"><span className="panel-title">Top Clientes — Mês</span><Link href="/clientes" className="panel-action">Ver todos</Link></div>
          <div className="panel-body" style={{gap:0}}>
            <div className="cliente-row"><div className="cliente-rank">1</div><div className="cliente-avatar" style={{background:'rgba(200,169,122,0.15)',color:'#C8A97A',border:'1px solid rgba(200,169,122,0.2)'}}>AC</div><div className="cliente-info"><b>Ana Carolina</b><span>3 pedidos</span></div><div className="cliente-val" style={{color:'#C8A97A'}}>R$ 8.400</div></div>
            <div className="cliente-row"><div className="cliente-rank">2</div><div className="cliente-avatar" style={{background:'rgba(96,165,250,0.12)',color:'#60A5FA',border:'1px solid rgba(96,165,250,0.2)'}}>PM</div><div className="cliente-info"><b>Pedro Monteiro</b><span>2 pedidos</span></div><div className="cliente-val" style={{color:'#888'}}>R$ 5.200</div></div>
            <div className="cliente-row"><div className="cliente-rank">3</div><div className="cliente-avatar" style={{background:'rgba(251,191,36,0.12)',color:'#FBBF24',border:'1px solid rgba(251,191,36,0.2)'}}>JS</div><div className="cliente-info"><b>Julia Siqueira</b><span>1 pedido</span></div><div className="cliente-val" style={{color:'#888'}}>R$ 3.800</div></div>
          </div>
        </div>

        {/* Aniversariantes */}
        <div className="panel anim-in">
          <div className="panel-head"><span className="panel-title">Aniversariantes da Semana</span><Link href="/clientes" className="panel-action">Ver todos</Link></div>
          <div className="panel-body" style={{gap:0}}>
            <div className="aniv-row"><div className="aniv-avatar" style={{background:'rgba(200,169,122,0.15)',color:'#C8A97A',border:'1px solid rgba(200,169,122,0.2)'}}>AC</div><div className="aniv-info"><div className="aniv-name">Ana Carolina</div><div className="aniv-sub">27 Mar · cliente há 3 anos</div></div><span className="aniv-badge hoje">Hoje 🎂</span></div>
            <div className="aniv-row"><div className="aniv-avatar" style={{background:'rgba(96,165,250,0.12)',color:'#60A5FA',border:'1px solid rgba(96,165,250,0.2)'}}>MR</div><div className="aniv-info"><div className="aniv-name">Mariana Ramos</div><div className="aniv-sub">28 Mar · 2 pedidos no histórico</div></div><span className="aniv-badge amanha">Amanhã</span></div>
            <div className="aniv-row"><div className="aniv-avatar" style={{background:'rgba(192,132,252,0.12)',color:'#C084FC',border:'1px solid rgba(192,132,252,0.2)'}}>JS</div><div className="aniv-info"><div className="aniv-name">João Silveira</div><div className="aniv-sub">31 Mar · cliente VIP</div></div><span className="aniv-badge semana">Sex</span></div>
            <div className="aniv-cta"><div className="aniv-btn">✉ Enviar parabéns</div><div className="aniv-btn">💬 Mandar WhatsApp</div></div>
          </div>
        </div>
      </div>

      {/* ══════════ 6. ANALYTICS ══════════ */}
      <div className="section-divider anim-in">
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
                <circle className="donut-ring" cx="65" cy="65" r="48" fill="none" stroke="#34D399" strokeWidth="18" strokeDasharray="126.7 301.6" strokeDashoffset="0" strokeLinecap="round" transform="rotate(-90 65 65)" style={{'--target-offset':'0'} as any}/>
                <circle className="donut-ring" cx="65" cy="65" r="48" fill="none" stroke="#C084FC" strokeWidth="18" strokeDasharray="84.5 343.8" strokeDashoffset="-126.7" strokeLinecap="round" transform="rotate(-90 65 65)" style={{'--target-offset':'-126.7'} as any}/>
                <circle className="donut-ring" cx="65" cy="65" r="48" fill="none" stroke="#C8A97A" strokeWidth="18" strokeDasharray="54.3 374" strokeDashoffset="-211.2" strokeLinecap="round" transform="rotate(-90 65 65)" style={{'--target-offset':'-211.2'} as any}/>
                <circle className="donut-ring" cx="65" cy="65" r="48" fill="none" stroke="#60A5FA" strokeWidth="18" strokeDasharray="21.1 407.2" strokeDashoffset="-265.5" strokeLinecap="round" transform="rotate(-90 65 65)" style={{'--target-offset':'-265.5'} as any}/>
                <circle className="donut-ring" cx="65" cy="65" r="48" fill="none" stroke="#333" strokeWidth="18" strokeDasharray="15.1 413.2" strokeDashoffset="-286.6" strokeLinecap="round" transform="rotate(-90 65 65)" style={{'--target-offset':'-286.6'} as any}/>
                <text x="65" y="60" textAnchor="middle" fontFamily="Playfair Display" fontSize="20" fontWeight="600" fill="#E8E4DE">87</text>
                <text x="65" y="76" textAnchor="middle" fontFamily="Inter" fontSize="9" fill="#555" letterSpacing="1">TOTAL</text>
              </svg>
              <div style={{flex:1}}>
                <div className="origem-row"><div className="origem-dot" style={{background:'#34D399'}}></div><div className="origem-label">WhatsApp</div><div className="origem-bar-bg"><div className="origem-bar" style={{width:'100%',background:'#34D399'}}></div></div><div className="origem-count" style={{color:'#34D399'}}>36</div><div className="origem-pct">42%</div></div>
                <div className="origem-row"><div className="origem-dot" style={{background:'#C084FC'}}></div><div className="origem-label">Instagram</div><div className="origem-bar-bg"><div className="origem-bar" style={{width:'67%',background:'#C084FC'}}></div></div><div className="origem-count" style={{color:'#C084FC'}}>24</div><div className="origem-pct">28%</div></div>
                <div className="origem-row"><div className="origem-dot" style={{background:'#C8A97A'}}></div><div className="origem-label">Indicação</div><div className="origem-bar-bg"><div className="origem-bar" style={{width:'43%',background:'#C8A97A'}}></div></div><div className="origem-count" style={{color:'#C8A97A'}}>16</div><div className="origem-pct">18%</div></div>
                <div className="origem-row"><div className="origem-dot" style={{background:'#60A5FA'}}></div><div className="origem-label">Site</div><div className="origem-bar-bg"><div className="origem-bar" style={{width:'17%',background:'#60A5FA'}}></div></div><div className="origem-count" style={{color:'#60A5FA'}}>6</div><div className="origem-pct">7%</div></div>
                <div className="origem-row"><div className="origem-dot" style={{background:'#444'}}></div><div className="origem-label">Outros</div><div className="origem-bar-bg"><div className="origem-bar" style={{width:'12%',background:'#444'}}></div></div><div className="origem-count" style={{color:'#666'}}>5</div><div className="origem-pct">5%</div></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Produtos */}
      <div className="panel anim-in">
        <div className="panel-head"><span className="panel-title">Produtos Mais Vendidos</span><Link href="/estoque" className="panel-action">Ver catálogo</Link></div>
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
