import React, { useState } from 'react';
import { AGGS, TIME_UNITS, COUNT_FIELD } from './transform.js';
import { DEFS, GROUPS, CHART_CN, CHANNEL_CN, SECONDARY_CHANNELS, PROP_CN, THEMES, interactionsFor } from './flintMeta.js';
import { bindingFor } from './config.js';

function Section({ title, children, extra }) {
  return (
    <section className="sec">
      <div className="sec-head"><span className="sec-title">{title}</span>{extra}</div>
      {children}
    </section>
  );
}

function ChannelSlot({ ch, b, columns, aggregate, onChange }) {
  const [over, setOver] = useState(false);
  const c = columns.find((x) => x.name === b?.field);
  const isCount = b?.field === COUNT_FIELD;
  const numeric = isCount || c?.role === 'measure';
  const aggOptions = numeric ? AGGS : AGGS.filter(([k]) => ['none', 'count', 'distinct'].includes(k));
  const showUnit = c?.role === 'time' && c.kind !== 'integer' && (!aggregate || !b?.agg || b.agg === 'none');
  const set = (field) => onChange(field ? (field === COUNT_FIELD ? { field } : bindingFor(field, columns, !aggregate)) : null);
  return (
    <div
      className={`slot ${over ? 'over' : ''} ${b?.field ? 'filled' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.getData('text/x-field'); if (f) set(f); }}
    >
      <label className="slot-label" htmlFor={`ch-${ch}`}>{CHANNEL_CN[ch] ?? ch}</label>
      <div className="slot-ctrls">
        <select id={`ch-${ch}`} value={b?.field ?? ''} onChange={(e) => set(e.target.value)}>
          <option value="">— 拖入或选择字段 —</option>
          {columns.map((x) => <option key={x.name} value={x.name}>{x.name}</option>)}
          {aggregate && <option value={COUNT_FIELD}>记录数</option>}
        </select>
        {b?.field && aggregate && !isCount && !(c?.role === 'time' && (b.agg ?? 'none') === 'none') && (
          <select className="mini" value={b.agg ?? 'none'} onChange={(e) => onChange({ ...b, agg: e.target.value })} aria-label="聚合方式">
            {aggOptions.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        )}
        {b?.field && showUnit && (
          <select className="mini" value={b.timeUnit ?? ''} onChange={(e) => onChange({ ...b, timeUnit: e.target.value })} aria-label="时间粒度">
            {TIME_UNITS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        )}
        {b?.field && <button className="x" onClick={() => onChange(null)} aria-label="清除">×</button>}
      </div>
    </div>
  );
}

function FilterRow({ f, col, onChange, onRemove }) {
  if (!col) return null;
  return (
    <div className="filter">
      <div className="filter-head"><b>{f.field}</b><button className="x" onClick={onRemove} aria-label="删除筛选">×</button></div>
      {f.op === 'in' ? (
        <div className="checks">
          {(col.values ?? []).map((v) => (
            <label key={String(v)}><input type="checkbox" checked={!f.values.length || f.values.includes(v)} onChange={(e) => {
              const all = col.values; const cur = f.values.length ? f.values : all;
              const next = e.target.checked ? [...cur, v] : cur.filter((x) => x !== v);
              onChange({ ...f, values: next.length === all.length ? [] : next });
            }} />{String(v)}</label>
          ))}
        </div>
      ) : (
        <div className="range">
          <input placeholder={`最小 ${col.range?.[0] ?? ''}`} value={f.min ?? ''} onChange={(e) => onChange({ ...f, min: e.target.value })} />
          <span>~</span>
          <input placeholder={`最大 ${col.range?.[1] ?? ''}`} value={f.max ?? ''} onChange={(e) => onChange({ ...f, max: e.target.value })} />
        </div>
      )}
    </div>
  );
}

function PropControl({ o, value, onChange }) {
  const label = PROP_CN[o.label] ?? o.label;
  if (o.type === 'binary') return <label className="prop check"><input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />{label}</label>;
  if (o.type === 'continuous') return (
    <label className="prop"><span>{label}<em>{value ?? o.defaultValue ?? ''}</em></span>
      <input type="range" min={o.min} max={o.max} step={o.step ?? 1} value={value ?? o.defaultValue ?? o.min} onChange={(e) => onChange(+e.target.value)} />
    </label>
  );
  return (
    <label className="prop"><span>{label}</span>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value)}>
        {o.options.map((x) => <option key={x.label} value={x.value ?? ''}>{x.label}</option>)}
      </select>
    </label>
  );
}

export default function ConfigPanel({ cfg, update, columns, options, recs, onApplyRec, onChangeType }) {
  const [moreCh, setMoreCh] = useState(false);
  const [filterField, setFilterField] = useState('');
  const def = DEFS[cfg.chartType];
  const channels = def?.channels ?? [];
  const main = channels.filter((c) => !SECONDARY_CHANNELS.has(c));
  const extra = channels.filter((c) => SECONDARY_CHANNELS.has(c));
  const aggregate = cfg.mode !== 'raw';
  const setBinding = (ch, b) => update((c) => { const e = { ...c.encodings }; if (b) e[ch] = b; else delete e[ch]; return { ...c, encodings: e }; });
  const applicable = options.filter((o) => o.applicable);
  const inter = interactionsFor(cfg.chartType);

  const addFilter = (name) => {
    const col = columns.find((c) => c.name === name);
    if (!col) return;
    const f = col.kind === 'text' ? { field: name, op: 'in', values: [] } : { field: name, op: 'range', min: '', max: '' };
    update((c) => ({ ...c, filters: [...c.filters, f] }));
    setFilterField('');
  };

  return (
    <div className="col config-col">
      <Section title="图表类型">
        <select className="type-select" value={cfg.chartType} onChange={(e) => onChangeType(e.target.value)}>
          {GROUPS.map(([g, list]) => <optgroup key={g} label={g}>{list.map((t) => <option key={t} value={t}>{CHART_CN[t] ?? t} · {t}</option>)}</optgroup>)}
        </select>
        {recs.length > 0 && (
          <div className="recs"><span>Flint 推荐:</span>
            {recs.map((r, i) => (
              <button key={i} className="chip" title={Object.entries(r.encodings).map(([k, v]) => `${CHANNEL_CN[k] ?? k}=${v}`).join(',')} onClick={() => onApplyRec(r)}>
                {CHART_CN[r.chartType] ?? r.chartType}
              </button>
            ))}
          </div>
        )}
      </Section>

      <Section title="字段映射" extra={
        <div className="seg" role="radiogroup" aria-label="数据模式">
          <button className={aggregate ? 'on' : ''} onClick={() => update((c) => ({ ...c, mode: 'aggregate', encodings: Object.fromEntries(Object.entries(c.encodings).map(([k, b]) => [k, b.field === COUNT_FIELD ? b : bindingFor(b.field, columns, false)])) }))}>汇总</button>
          <button className={!aggregate ? 'on' : ''} onClick={() => update((c) => ({ ...c, mode: 'raw', encodings: Object.fromEntries(Object.entries(c.encodings).filter(([, b]) => b.field !== COUNT_FIELD).map(([k, b]) => [k, { field: b.field }])) }))}>明细</button>
        </div>
      }>
        {main.map((ch) => <ChannelSlot key={ch} ch={ch} b={cfg.encodings[ch]} columns={columns} aggregate={aggregate} onChange={(b) => setBinding(ch, b)} />)}
        {extra.length > 0 && (
          <>
            <button className="link" onClick={() => setMoreCh((v) => !v)}>{moreCh ? '收起' : '更多通道'}({extra.map((c) => CHANNEL_CN[c] ?? c).join('、')})</button>
            {(moreCh || extra.some((c) => cfg.encodings[c])) && extra.map((ch) => <ChannelSlot key={ch} ch={ch} b={cfg.encodings[ch]} columns={columns} aggregate={aggregate} onChange={(b) => setBinding(ch, b)} />)}
          </>
        )}
      </Section>

      <Section title="筛选">
        {cfg.filters.map((f, i) => (
          <FilterRow key={i} f={f} col={columns.find((c) => c.name === f.field)}
            onChange={(nf) => update((c) => ({ ...c, filters: c.filters.map((x, j) => (j === i ? nf : x)) }))}
            onRemove={() => update((c) => ({ ...c, filters: c.filters.filter((_, j) => j !== i) }))} />
        ))}
        <select value={filterField} onChange={(e) => addFilter(e.target.value)} aria-label="添加筛选">
          <option value="">＋ 添加筛选字段</option>
          {columns.filter((c) => c.kind !== 'text' || c.values).map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
        </select>
      </Section>

      <Section title="排序与数量">
        <div className="inline">
          <select value={cfg.sort} onChange={(e) => update((c) => ({ ...c, sort: e.target.value }))} aria-label="排序">
            <option value="auto">自动(时间升序,否则按数值降序)</option>
            <option value="measure-desc">按数值降序</option>
            <option value="measure-asc">按数值升序</option>
            <option value="dim-asc">按类别名称</option>
            <option value="none">不排序</option>
          </select>
          <label className="topn">Top <input type="number" min="0" value={cfg.topN || ''} placeholder="全部" onChange={(e) => update((c) => ({ ...c, topN: +e.target.value || 0 }))} /></label>
        </div>
      </Section>

      {applicable.length > 0 && (
        <Section title="图表属性">
          <div className="props">
            {applicable.map((o) => <PropControl key={o.key} o={o} value={cfg.properties[o.key] ?? o.value}
              onChange={(v) => update((c) => ({ ...c, properties: { ...c.properties, [o.key]: v } }))} />)}
          </div>
        </Section>
      )}

      {inter.length > 0 && (
        <Section title="交互">
          <div className="checks two">
            {inter.map(([t, l]) => (
              <label key={t}><input type="checkbox" checked={cfg.interactions.includes(t)} onChange={(e) => update((c) => ({ ...c, interactions: e.target.checked ? [...c.interactions, t] : c.interactions.filter((x) => x !== t) }))} />{l}</label>
            ))}
          </div>
        </Section>
      )}

      <Section title="标题与样式">
        <input className="full" placeholder="标题(留空自动生成)" value={cfg.title} onChange={(e) => update((c) => ({ ...c, title: e.target.value }))} />
        <input className="full" placeholder="副标题:指标、范围、单位" value={cfg.subtitle} onChange={(e) => update((c) => ({ ...c, subtitle: e.target.value }))} />
        <div className="inline">
          <select value={cfg.theme} onChange={(e) => update((c) => ({ ...c, theme: e.target.value }))} aria-label="主题">
            {THEMES.map((t) => <option key={t.id} value={t.id} title={t.description}>{t.label}</option>)}
          </select>
          <label className="topn">高度 <input type="range" min="260" max="760" step="20" value={cfg.height} onChange={(e) => update((c) => ({ ...c, height: +e.target.value }))} /></label>
        </div>
      </Section>
    </div>
  );
}
