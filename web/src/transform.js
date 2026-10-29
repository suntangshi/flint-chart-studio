// 浏览器端的数据准备:筛选 → 时间粒度 → 分组聚合 → 排序 → Top N。
// Flint 本身不做聚合,这里产出的就是喂给 Flint 的 data.values。

export const COUNT_FIELD = '__count__';
export const RAW_CAP = 5000;

export const AGGS = [['sum', '求和'], ['avg', '平均'], ['count', '计数'], ['distinct', '去重计数'], ['min', '最小'], ['max', '最大'], ['median', '中位数'], ['none', '不聚合']];
const AGG_CN = Object.fromEntries(AGGS);
export const TIME_UNITS = [['', '原值'], ['year', '年'], ['quarter', '季度'], ['month', '月'], ['week', '周'], ['day', '日']];
const UNIT_CN = Object.fromEntries(TIME_UNITS);
const UNIT_SEMANTIC = { year: 'Year', quarter: 'YearQuarter', month: 'YearMonth', week: 'YearWeek', day: 'Date' };

function isoWeek(y, m, d) {
  const t = new Date(Date.UTC(y, m - 1, d));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return [t.getUTCFullYear(), Math.ceil(((t - y0) / 86400000 + 1) / 7)];
}

function applyUnit(v, unit) {
  if (!unit || v === null || v === undefined || v === '') return v;
  const s = String(v);
  const y = +s.slice(0, 4), m = +s.slice(5, 7), d = +s.slice(8, 10);
  if (unit === 'year') return y;
  if (unit === 'quarter') return `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
  if (unit === 'month') return s.slice(0, 7);
  if (unit === 'day') return s.slice(0, 10);
  if (unit === 'week') { const [wy, w] = isoWeek(y, m, d); return `${wy}-W${String(w).padStart(2, '0')}`; }
  return v;
}

function passFilter(f, r) {
  const v = r[f.field];
  if (f.op === 'in') return !f.values?.length || f.values.includes(v);
  if (f.op === 'range') {
    if (v === null || v === undefined || v === '') return false;
    if (f.min !== '' && f.min !== undefined && f.min !== null && v < (typeof v === 'number' ? +f.min : f.min)) return false;
    if (f.max !== '' && f.max !== undefined && f.max !== null && v > (typeof v === 'number' ? +f.max : f.max)) return false;
  }
  return true;
}

const round = (x) => (typeof x === 'number' && !Number.isInteger(x) ? Math.round(x * 1e4) / 1e4 : x);

/**
 * rows: 原始行;columns: 数据集列描述(含用户改过的 semantic);cfg: 图表配置
 * 返回 { values, semantic_types, encodings(通道→列别名), info }
 */
export function buildTable(rows, columns, cfg) {
  const col = Object.fromEntries(columns.map((c) => [c.name, c]));
  const data = (cfg.filters ?? []).length ? rows.filter((r) => cfg.filters.every((f) => passFilter(f, r))) : rows;
  const aggregate = cfg.mode !== 'raw';

  const items = [];
  for (const [ch, b] of Object.entries(cfg.encodings ?? {})) {
    if (!b?.field) continue;
    const isCount = b.field === COUNT_FIELD;
    const c = col[b.field];
    if (!isCount && !c) continue;
    const unit = c?.role === 'time' && c.kind !== 'integer' ? b.timeUnit || '' : '';
    let agg = !aggregate ? 'none' : isCount ? 'count' : b.agg || 'none';
    if (!aggregate && isCount) continue; // 明细模式下"记录数"没有意义
    let alias, semantic;
    if (isCount) { alias = '记录数'; semantic = 'Count'; }
    else if (agg !== 'none') {
      alias = agg === 'sum' ? b.field : `${AGG_CN[agg]}(${b.field})`;
      semantic = agg === 'count' || agg === 'distinct' ? 'Count' : c.semantic;
    } else {
      alias = unit ? `${b.field}(${UNIT_CN[unit]})` : b.field;
      semantic = unit ? UNIT_SEMANTIC[unit] : c.semantic;
    }
    items.push({ ch, field: b.field, agg, unit, alias, semantic, time: c?.role === 'time' });
  }

  const semantic_types = {}, encodings = {};
  for (const it of items) { semantic_types[it.alias] = it.semantic; encodings[it.ch] = it.alias; }
  const uniq = (list) => [...new Map(list.map((i) => [i.alias, i])).values()];
  const dims = uniq(items.filter((i) => i.agg === 'none'));
  const measures = uniq(items.filter((i) => i.agg !== 'none'));

  let values, truncated = false;
  if (measures.length) {
    const groups = new Map();
    for (const r of data) {
      const keyVals = dims.map((d) => applyUnit(r[d.field], d.unit));
      const key = JSON.stringify(keyVals);
      let g = groups.get(key);
      if (!g) { g = { keyVals, acc: measures.map(() => ({ sum: 0, n: 0, min: null, max: null, set: null, list: null })) }; groups.set(key, g); }
      measures.forEach((m, i) => {
        const a = g.acc[i];
        if (m.agg === 'count') { a.n++; return; }
        const v = r[m.field];
        if (v === null || v === undefined || v === '') return;
        if (m.agg === 'distinct') { (a.set ??= new Set()).add(v); return; }
        if (m.agg === 'min' || m.agg === 'max') { // 日期字符串也能取最早/最晚
          if (a.min === null || v < a.min) a.min = v;
          if (a.max === null || v > a.max) a.max = v;
          return;
        }
        if (typeof v !== 'number') return;
        a.sum += v; a.n++;
        if (a.min === null || v < a.min) a.min = v;
        if (a.max === null || v > a.max) a.max = v;
        if (m.agg === 'median') (a.list ??= []).push(v);
      });
    }
    values = [...groups.values()].map((g) => {
      const o = {};
      dims.forEach((d, i) => { o[d.alias] = g.keyVals[i]; });
      measures.forEach((m, i) => {
        const a = g.acc[i];
        o[m.alias] = round(
          m.agg === 'count' ? a.n : m.agg === 'distinct' ? a.set?.size ?? 0 : m.agg === 'sum' ? a.sum
          : m.agg === 'avg' ? (a.n ? a.sum / a.n : null) : m.agg === 'min' ? a.min : m.agg === 'max' ? a.max
          : a.list ? median(a.list) : null,
        );
      });
      return o;
    });
  } else {
    truncated = data.length > RAW_CAP;
    values = data.slice(0, RAW_CAP).map((r) => Object.fromEntries(dims.map((d) => [d.alias, applyUnit(r[d.field], d.unit)])));
  }

  // 排序:Flint 按数据顺序画,所以顺序在这里定
  const sortMeasure = ['y', 'x', 'size', 'value', 'color'].map((ch) => measures.find((m) => m.ch === ch)).find(Boolean) ?? measures[0];
  const timeDim = dims.find((d) => d.time);
  const catDim = dims.find((d) => !d.time);
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const sort = cfg.sort || 'auto';
  if (sort !== 'none' && !(sort === 'auto' && !measures.length && !timeDim)) {
    values.sort((a, b) => {
      if (timeDim && sort === 'auto') { const c = cmp(a[timeDim.alias], b[timeDim.alias]); if (c) return c; }
      if (sortMeasure && (sort === 'auto' || sort === 'measure-desc')) return cmp(b[sortMeasure.alias], a[sortMeasure.alias]);
      if (sortMeasure && sort === 'measure-asc') return cmp(a[sortMeasure.alias], b[sortMeasure.alias]);
      const d = catDim ?? dims[0];
      return d ? cmp(a[d.alias], b[d.alias]) : 0;
    });
  }

  // Top N:按第一个分类维度的度量合计取前 N 个类别(保留它们的全部子分组)
  const topN = +cfg.topN || 0;
  if (topN > 0 && catDim && sortMeasure) {
    const totals = new Map();
    for (const v of values) totals.set(v[catDim.alias], (totals.get(v[catDim.alias]) ?? 0) + (v[sortMeasure.alias] ?? 0));
    const keep = new Set([...totals].sort((a, b) => b[1] - a[1]).slice(0, topN).map(([k]) => k));
    values = values.filter((v) => keep.has(v[catDim.alias]));
  }

  return { values, semantic_types, encodings, info: { inputRows: rows.length, filteredRows: data.length, outputRows: values.length, truncated, dims, measures } };
}

function median(list) {
  const s = [...list].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function autoTitle(info) {
  const m = info.measures.map((x) => x.alias).join('、');
  const d = info.dims.map((x) => x.alias).join(' × ');
  if (m && d) return `${m} · 按${d}`;
  return m || d || '';
}
