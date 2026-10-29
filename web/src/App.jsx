import React, { useCallback, useEffect, useMemo, useState } from 'react';
import FieldPane from './FieldPane.jsx';
import ConfigPanel from './ConfigPanel.jsx';
import Preview from './Preview.jsx';
import { api } from './api.js';
import { buildTable, autoTitle, COUNT_FIELD } from './transform.js';
import { DEFS, SECONDARY_CHANNELS, CHART_CN, recommend, chartOptions, validate } from './flintMeta.js';
import { defaultConfig, changeType, fromRecommendation, bindingFor } from './config.js';

const LAST_DS = 'flint-studio:dataset';
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* 隐私模式等 */ } } };

export default function App() {
  const [datasets, setDatasets] = useState([]);
  const [meta, setMeta] = useState(null);
  const [rows, setRows] = useState([]);
  const [charts, setCharts] = useState([]);
  const [current, setCurrent] = useState(null); // { id?, name, cfg }
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const columns = meta?.columns ?? [];

  const openDataset = useCallback(async (id) => {
    if (!id) return;
    setBusy(true); setError('');
    try {
      const [{ meta: m, rows: r }, cs] = await Promise.all([api.dataset(id), api.charts(id)]);
      setMeta(m); setRows(r); setCharts(cs);
      setCurrent(cs[0] ? { id: cs[0].id, name: cs[0].name, cfg: cs[0].config } : { name: '图表 1', cfg: defaultConfig(m.columns, r) });
      setDirty(false); setStatus('');
      store.set(LAST_DS, id);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }, []);

  useEffect(() => {
    api.datasets().then((list) => {
      setDatasets(list);
      const last = store.get(LAST_DS);
      const pick = list.find((d) => d.id === last) ?? list[0];
      if (pick) openDataset(pick.id);
    }).catch((e) => setError(e.message));
  }, [openDataset]);

  const added = async (p) => {
    setBusy(true); setError('');
    try {
      const m = await p;
      setDatasets((l) => [m, ...l.filter((d) => d.id !== m.id)]);
      await openDataset(m.id);
    } catch (e) { setError(e.message); setBusy(false); }
  };

  const update = useCallback((fn) => { setCurrent((c) => ({ ...c, cfg: fn(c.cfg) })); setDirty(true); setStatus('未保存'); }, []);
  const cfg = current?.cfg;

  const recs = useMemo(() => (meta ? recommend(rows, columns, 6) : []), [meta, rows]); // eslint-disable-line

  const table = useMemo(() => (cfg && Object.keys(cfg.encodings).length ? buildTable(rows, columns, cfg) : null), [cfg, rows, columns]);
  const spec = useMemo(() => {
    if (!table || !Object.keys(table.encodings).length) return null;
    return {
      data: { values: table.values },
      semantic_types: table.semantic_types,
      chart_spec: { chartType: cfg.chartType, title: cfg.title || autoTitle(table.info), subtitle: cfg.subtitle || undefined, encodings: table.encodings, chartProperties: cfg.properties },
      theme_spec: cfg.theme,
      ...(cfg.interactions.length ? { interaction_spec: { interactions: cfg.interactions.map((type) => ({ type })) } } : {}),
    };
  }, [table, cfg]);
  const options = useMemo(() => (spec ? chartOptions(spec) : []), [spec]);
  const validation = useMemo(() => (spec ? validate(spec) : null), [spec]);

  const pickField = (field) => {
    if (!cfg) return;
    const channels = (DEFS[cfg.chartType]?.channels ?? []).filter((c) => !SECONDARY_CHANNELS.has(c));
    const free = channels.find((ch) => !cfg.encodings[ch]);
    if (!free) { setStatus('主要通道都占满了,把字段拖到具体通道上替换'); return; }
    const raw = cfg.mode === 'raw';
    if (raw && field === COUNT_FIELD) return;
    update((c) => ({ ...c, encodings: { ...c.encodings, [free]: field === COUNT_FIELD ? { field } : bindingFor(field, columns, raw) } }));
  };

  const setSemantic = async (name, semantic) => {
    try {
      const m = await api.updateColumn(meta.id, name, { semantic });
      setMeta((old) => ({ ...old, columns: m.columns }));
    } catch (e) { setError(e.message); }
  };

  const save = async (asNew) => {
    try {
      const saved = await api.saveChart({ id: asNew ? undefined : current.id, datasetId: meta.id, name: asNew ? `${current.name} 副本` : current.name, config: current.cfg });
      setCharts((l) => (l.some((c) => c.id === saved.id) ? l.map((c) => (c.id === saved.id ? saved : c)) : [...l, saved]));
      setCurrent({ id: saved.id, name: saved.name, cfg: saved.config });
      setDirty(false); setStatus('已保存');
    } catch (e) { setStatus('保存失败:' + e.message); }
  };

  const leave = () => !dirty || window.confirm('当前图表还没保存,确定离开?');
  const openChart = (c) => { if (c.id === current?.id || !leave()) return; setCurrent({ id: c.id, name: c.name, cfg: c.config }); setDirty(false); setStatus(''); };
  const newChart = () => { if (!leave()) return; setCurrent({ name: `图表 ${charts.length + 1}`, cfg: defaultConfig(columns, rows) }); setDirty(false); setStatus('未保存'); };
  const removeChart = async (c) => {
    await api.deleteChart(c.id);
    const rest = charts.filter((x) => x.id !== c.id);
    setCharts(rest);
    if (current?.id === c.id) setCurrent(rest[0] ? { id: rest[0].id, name: rest[0].name, cfg: rest[0].config } : { name: '图表 1', cfg: defaultConfig(columns, rows) });
  };

  return (
    <div className="app">
      <header className="top">
        <div className="brand">Flint 图表工作台</div>
        {meta && (
          <nav className="gallery" aria-label="已保存的图表">
            {charts.map((c) => (
              <span key={c.id} className={`gchip ${current?.id === c.id ? 'on' : ''}`}>
                <button onClick={() => openChart(c)} title={CHART_CN[c.config.chartType] ?? c.config.chartType}>{c.name}</button>
                <button className="gx" onClick={() => removeChart(c)} aria-label={`删除 ${c.name}`}>×</button>
              </span>
            ))}
            {current && !current.id && <span className="gchip on draft"><button>{current.name}(未保存)</button></span>}
            <button className="btn sm" onClick={newChart}>＋ 新建图表</button>
          </nav>
        )}
      </header>
      <div className="grid">
        <FieldPane datasets={datasets} meta={meta} busy={busy} error={error}
          onSelect={(id) => leave() && openDataset(id)} onUpload={(f) => added(api.upload(f))} onSample={() => added(api.sample())}
          onDelete={async (id) => { await api.deleteDataset(id); const l = datasets.filter((d) => d.id !== id); setDatasets(l); setMeta(null); setRows([]); setCharts([]); setCurrent(null); if (l[0]) openDataset(l[0].id); }}
          onSemantic={setSemantic} onPick={pickField} />
        {cfg ? (
          <>
            <ConfigPanel cfg={cfg} update={update} columns={columns} options={options} recs={recs}
              onApplyRec={(r) => update((c) => fromRecommendation(r, columns, c))}
              onChangeType={(t) => update((c) => changeType(c, t, columns, rows))} />
            <Preview spec={spec} table={table} validation={validation} height={cfg.height} chartKey={JSON.stringify(cfg) + meta.id + JSON.stringify(columns.map((c) => c.semantic))}
              name={current.name} onName={(n) => { setCurrent((c) => ({ ...c, name: n })); setDirty(true); setStatus('未保存'); }}
              onSave={() => save(false)} onSaveAs={() => save(true)} status={status} />
          </>
        ) : (
          <div className="col welcome"><h1>上传 Excel,配置出图</h1><p>左侧上传数据或加载示例数据。字段会按维度/度量分好,拖到通道上即可出图;图表类型、聚合、筛选、排序、属性、主题和交互都可以调,配置可以保存。</p></div>
        )}
      </div>
    </div>
  );
}
