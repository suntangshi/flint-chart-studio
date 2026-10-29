// 图表配置的创建与变换:选类型时按字段角色给出合理的通道映射
import { DEFS, RAW_TYPES, recommendEncodings, interactionsFor } from './flintMeta.js';
import { COUNT_FIELD } from './transform.js';

export function bindingFor(field, columns, raw) {
  if (field === COUNT_FIELD) return { field };
  const c = columns.find((x) => x.name === field);
  const b = { field };
  if (c?.role === 'measure' && !raw) b.agg = 'sum';
  if (c?.role === 'time' && c.kind !== 'integer' && !raw) b.timeUnit = 'month';
  return b;
}

/**
 * 按图表类型从三个字段池(时间 T、维度 D、度量 M)里挑字段。prefer 里的字段(当前图用到的)排在前面,
 * 这样换图表类型时尽量沿用用户已选的字段,只是换到合适的通道上。
 * 返回 { 通道: binding };挑不出来时返回 null,交给 Flint 自带的推荐。
 */
function suggest(chartType, columns, prefer = []) {
  const rank = (c) => { const i = prefer.indexOf(c.name); return i < 0 ? 1e3 : i; };
  const byPref = (list, tie) => [...list].sort((a, b) => rank(a) - rank(b) || tie(a, b));
  const T = byPref(columns.filter((c) => c.role === 'time'), () => 0);
  // 维度优先取基数小的(画颜色、分组更清楚)
  const D = byPref(columns.filter((c) => c.role === 'dimension' && c.semantic !== 'ID' && (c.distinct ?? 99) > 1), (a, b) => (a.distinct ?? 99) - (b.distinct ?? 99));
  const M = byPref(columns.filter((c) => c.role === 'measure'), () => 0);
  const small = (max) => D.find((d) => (d.distinct ?? 99) <= max);
  const t = T[0], d1 = D[0], d2 = D[1], m1 = M[0], m2 = M[1];
  const f = (c, extra = {}) => (c ? { field: c.name, ...extra } : null);
  const sum = (c) => f(c, { agg: 'sum' });
  const month = (c) => f(c, { timeUnit: c?.kind === 'integer' ? '' : 'month' });
  const cat = t ? month(t) : f(d1);
  const series = t ? f(small(8)) : f(d2);

  const plans = {
    'Bar Chart': { x: f(d1) ?? month(t), y: sum(m1) },
    'Lollipop Chart': { x: f(d1) ?? month(t), y: sum(m1) },
    'Bar Table': { y: f(d1), x: sum(m1) },
    'Grouped Bar Chart': { x: f(d1), y: sum(m1), group: f(d2) },
    'Stacked Bar Chart': { x: cat, y: sum(m1), color: t ? f(small(8)) : f(d2) },
    'Line Chart': { x: cat, y: sum(m1), color: series },
    'Area Chart': { x: cat, y: sum(m1), color: series },
    Streamgraph: { x: cat, y: sum(m1), color: f(small(10) ?? d1) },
    Sparkline: { x: cat, y: sum(m1), color: f(small(8) ?? d1) },
    'Bump Chart': { x: cat, y: sum(m1), color: f(small(10) ?? d1) },
    'Slope Chart': { x: t ? f(t, { timeUnit: t.kind === 'integer' ? '' : 'year' }) : f(d2), y: sum(m1), color: f(small(10) ?? d1) },
    'Range Area Chart': { x: cat, y: f(m1, { agg: 'min' }), y2: f(m1, { agg: 'max' }) },
    'Pie Chart': { size: sum(m1), color: f(small(8) ?? d1) },
    'Donut Chart': { size: sum(m1), color: f(small(8) ?? d1) },
    'Rose Chart': { x: f(small(12) ?? d1), y: sum(m1) },
    'Radar Chart': { x: f(d1), y: sum(m1), color: f(d2 && (d2.distinct ?? 99) <= 6 ? d2 : null) },
    Heatmap: { x: cat, y: t ? f(d1) : f(d2), color: sum(m1) },
    'Calendar Heatmap': { x: f(t, { timeUnit: 'day' }), color: sum(m1) },
    'Waterfall Chart': { x: cat, y: sum(M.find((c) => c.semantic === 'Profit') ?? m1) },
    'Pyramid Chart': { y: f(d1), x: sum(m1), color: f(D.find((d) => d !== d1 && (d.distinct ?? 99) <= 3)) },
    'Bullet Chart': { y: f(d1), x: sum(m1), goal: sum(m2) },
    'KPI Card': { metric: f(small(6) ?? d1), value: sum(m1) },
    'Gantt Chart': { y: f(d1), x: f(t, { agg: 'min' }), x2: f(T[1] ?? t, { agg: 'max' }) },
    'Ranged Dot Plot': { y: f(d1), x: sum(m1), color: f(D.find((d) => d !== d1 && (d.distinct ?? 99) <= 4)) },
    'Connected Scatter Plot': { x: sum(m2), y: sum(m1), order: month(t) },
    'Scatter Plot': { x: f(m2), y: f(m1), color: f(small(8)) },
    Regression: { x: f(m2), y: f(m1) },
    'Marginal Plot': { x: f(m2), y: f(m1) },
    'Strip Plot': { x: f(small(12) ?? d1), y: f(m1) },
    Histogram: { x: f(m1) },
    'Density Plot': { x: f(m1), color: f(small(5)) },
    'ECDF Plot': { x: f(m1), color: f(small(5)) },
    'Ridgeline Plot': { x: f(m1), y: f(small(10) ?? d1) },
    'Violin Plot': { x: f(small(8) ?? d1), y: f(m1) },
    Boxplot: { x: f(small(12) ?? d1), y: f(m1) },
  };
  const plan = plans[chartType];
  if (!plan) return null;
  const out = Object.fromEntries(Object.entries(plan).filter(([, b]) => b?.field));
  return Object.keys(out).length ? out : null;
}

const BASE = { filters: [], sort: 'auto', topN: 0, title: '', subtitle: '', theme: 'economist', height: 420, properties: {}, interactions: ['inspect'] };

function withType(prev, chartType, encodings) {
  return {
    ...BASE, ...prev,
    chartType,
    mode: RAW_TYPES.has(chartType) ? 'raw' : 'aggregate',
    encodings,
    properties: {},
    interactions: (prev.interactions ?? BASE.interactions).filter((t) => interactionsFor(chartType).some(([x]) => x === t)),
  };
}

/** 套用 Flint 推荐(推荐给的是原始字段,这里补上聚合和时间粒度) */
export function fromRecommendation(rec, columns, prev = {}) {
  const raw = RAW_TYPES.has(rec.chartType);
  const enc = {};
  for (const [ch, v] of Object.entries(rec.encodings ?? {})) {
    const field = typeof v === 'string' ? v : v?.field;
    if (field && DEFS[rec.chartType]?.channels.includes(ch)) enc[ch] = bindingFor(field, columns, raw);
  }
  return withType(prev, rec.chartType, enc);
}

export function defaultConfig(columns, rows) {
  const hasTime = columns.some((c) => c.role === 'time');
  return changeType({}, hasTime ? 'Line Chart' : 'Bar Chart', columns, rows);
}

/** 换图表类型:沿用当前用到的字段,按新类型的通道重新摆放 */
export function changeType(cfg, chartType, columns, rows) {
  const prefer = Object.values(cfg.encodings ?? {}).map((b) => b.field);
  const enc = suggest(chartType, columns, prefer);
  if (enc) return withType(cfg, chartType, enc);
  return fromRecommendation({ chartType, encodings: recommendEncodings(chartType, rows, columns) }, columns, cfg);
}
