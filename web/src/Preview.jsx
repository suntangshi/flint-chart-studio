import React, { useEffect, useRef, useState } from 'react';
import { FlintChart } from 'flint-chart/react';

function download(name, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.setAttribute('download', name);
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function svgOf(box) {
  const svg = box?.querySelector('svg');
  if (!svg) return null;
  const clone = svg.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  return { text: new XMLSerializer().serializeToString(clone), w: svg.width.baseVal.value || svg.clientWidth, h: svg.height.baseVal.value || svg.clientHeight };
}

async function exportPng(box, name) {
  const s = svgOf(box);
  if (!s) return;
  const img = new Image();
  img.src = URL.createObjectURL(new Blob([s.text], { type: 'image/svg+xml' }));
  await img.decode();
  const canvas = Object.assign(document.createElement('canvas'), { width: s.w * 2, height: s.h * 2 });
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(2, 2); ctx.drawImage(img, 0, 0, s.w, s.h);
  canvas.toBlob((b) => b && download(`${name}.png`, b), 'image/png');
}

export default function Preview({ spec, table, validation, height, chartKey, name, onName, onSave, onSaveAs, status }) {
  const [tab, setTab] = useState('chart');
  const [width, setWidth] = useState(720);
  const [renderError, setRenderError] = useState('');
  const box = useRef(null);
  const wrap = useRef(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(Math.max(320, Math.floor(el.clientWidth - 32))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => setRenderError(''), [chartKey]);

  const errors = validation?.errors ?? [];
  const warnings = validation?.warnings ?? [];
  const sized = spec && { ...spec, chart_spec: { ...spec.chart_spec, baseSize: { width, height } } };
  const bucket = Math.round(width / 60); // 宽度变化 60px 以上才重新排版
  const safeName = (name || '图表').replace(/[\\/:*?"<>|]/g, '_');

  return (
    <div className="col preview-col" ref={wrap}>
      <div className="pv-bar">
        <input className="name" value={name} onChange={(e) => onName(e.target.value)} aria-label="图表名称" />
        <button className="btn" onClick={onSave}>保存</button>
        <button className="btn ghost" onClick={onSaveAs}>另存为</button>
        <span className="status">{status}</span>
        <span className="spacer" />
        <button className="btn ghost sm" onClick={() => { const s = svgOf(box.current); if (s) download(`${safeName}.svg`, new Blob([s.text], { type: 'image/svg+xml' })); }} disabled={tab !== 'chart'}>导出 SVG</button>
        <button className="btn ghost sm" onClick={() => exportPng(box.current, safeName)} disabled={tab !== 'chart'}>导出 PNG</button>
      </div>
      <nav className="tabs">
        {[['chart', '图表'], ['data', `数据(${table?.values.length ?? 0} 行)`], ['spec', 'Flint 规格'], ['check', `校验${errors.length ? ` · ${errors.length} 错误` : warnings.length ? ` · ${warnings.length} 提示` : ''}`]].map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </nav>

      <div className="paper">
        {tab === 'chart' && (
          !spec ? <div className="pv-empty">把字段拖到「字段映射」里的通道上,图表会实时出现在这里。</div>
          : errors.length ? <div className="pv-empty err">{errors.map((e, i) => <div key={i}>{e.message}</div>)}<div className="hint">看「校验」页了解详情,通常是缺少必需的通道。</div></div>
          : (
            <div ref={box} className="chart-box">
              <FlintChart key={chartKey + ':' + bucket} spec={sized} renderer="svg" fit="scale-down" width="100%" onError={(e) => setRenderError(e.message)} />
              {renderError && <div className="note err">渲染失败:{renderError}</div>}
              {table?.info.truncated && <div className="note">明细模式只画前 5,000 行(共 {table.info.filteredRows.toLocaleString()} 行)。</div>}
            </div>
          )
        )}
        {tab === 'data' && table && (
          <div className="tbl">
            <table>
              <thead><tr>{Object.keys(table.values[0] ?? {}).map((k) => <th key={k}>{k}<small>{table.semantic_types[k]}</small></th>)}</tr></thead>
              <tbody>{table.values.slice(0, 200).map((r, i) => <tr key={i}>{Object.keys(table.values[0]).map((k) => <td key={k}>{String(r[k] ?? '')}</td>)}</tr>)}</tbody>
            </table>
            <div className="hint">原始 {table.info.inputRows.toLocaleString()} 行 → 筛选后 {table.info.filteredRows.toLocaleString()} 行 → 送给 Flint {table.values.length.toLocaleString()} 行{table.values.length > 200 ? '(这里显示前 200 行)' : ''}</div>
          </div>
        )}
        {tab === 'spec' && spec && <pre className="code">{JSON.stringify({ ...sized, data: { values: [...spec.data.values.slice(0, 5), `…共 ${spec.data.values.length} 行`] } }, null, 2)}</pre>}
        {tab === 'check' && (
          <div className="checklist">
            {!validation && <p>还没有可校验的图表。</p>}
            {validation && !errors.length && !warnings.length && <p className="ok">✓ Flint 校验通过,没有问题。</p>}
            {errors.map((e, i) => <p key={'e' + i} className="err">✗ {e.message}</p>)}
            {warnings.map((w, i) => <p key={'w' + i} className="warn">! {w.message}</p>)}
          </div>
        )}
      </div>
    </div>
  );
}
