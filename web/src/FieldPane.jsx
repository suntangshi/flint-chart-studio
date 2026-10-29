import React, { useRef, useState } from 'react';
import { COUNT_FIELD } from './transform.js';
import { SEMANTIC_CN, SEMANTIC_LIST } from './flintMeta.js';

const ICON = { time: '◷', measure: '#', dimension: 'Abc' };

function Field({ col, onPick, onSemantic }) {
  const tip = col.range ? `范围 ${col.range.join(' ~ ')}` : col.values ? `${col.distinct} 个取值:${col.values.slice(0, 8).join('、')}` : `${col.distinct ?? ''} 个取值`;
  return (
    <li className={`field ${col.role}`} draggable onDragStart={(e) => { e.dataTransfer.setData('text/x-field', col.name); e.dataTransfer.effectAllowed = 'copy'; }} title={`${tip}\n点击放到下一个空通道,或拖到通道上`}>
      <button className="field-name" onClick={() => onPick(col.name)}>
        <span className="fi">{ICON[col.role]}</span>
        <span className="fn">{col.name}</span>
      </button>
      {onSemantic && (
        <select className="sem" value={col.semantic} onChange={(e) => onSemantic(col.name, e.target.value)} aria-label={`${col.name} 的语义类型`}>
          {SEMANTIC_LIST.map((s) => <option key={s} value={s}>{SEMANTIC_CN[s] ? `${SEMANTIC_CN[s]}` : s}</option>)}
        </select>
      )}
    </li>
  );
}

function CountField({ onPick }) {
  return (
    <li className="field measure" draggable onDragStart={(e) => e.dataTransfer.setData('text/x-field', COUNT_FIELD)} title="每组的行数">
      <button className="field-name" onClick={onPick}><span className="fi">#</span><span className="fn">记录数</span></button>
    </li>
  );
}

export default function FieldPane({ datasets, meta, busy, error, onSelect, onUpload, onSample, onDelete, onSemantic, onPick }) {
  const file = useRef(null);
  const [drag, setDrag] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const cols = meta?.columns ?? [];
  const dims = cols.filter((c) => c.role !== 'measure');
  const measures = cols.filter((c) => c.role === 'measure');

  return (
    <aside
      className={`col fields-col ${drag ? 'drag' : ''}`}
      onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDrag(true); } }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { if (!e.dataTransfer.files?.length) return; e.preventDefault(); setDrag(false); onUpload(e.dataTransfer.files[0]); }}
    >
      <div className="sec-title">数据源</div>
      <select className="ds-select" value={meta?.id ?? ''} onChange={(e) => onSelect(e.target.value)} disabled={!datasets.length}>
        {!datasets.length && <option value="">还没有数据集</option>}
        {datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>
      <div className="row-btns">
        <button className="btn" disabled={busy} onClick={() => file.current?.click()}>上传 Excel</button>
        <button className="btn ghost" disabled={busy} onClick={onSample}>示例数据</button>
        <input ref={file} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ''; }} />
      </div>
      {busy && <div className="note">正在处理…</div>}
      {error && <div className="note err">{error}</div>}

      {meta && (
        <>
          <div className="ds-meta">
            {meta.rowCount.toLocaleString()} 行 · {cols.length} 列
            {confirmDel ? (
              <span className="confirm"> 删除数据集和它的图表?<button onClick={() => { setConfirmDel(false); onDelete(meta.id); }}>删除</button><button onClick={() => setConfirmDel(false)}>取消</button></span>
            ) : <button className="link" onClick={() => setConfirmDel(true)}>删除</button>}
          </div>
          <div className="sec-title">维度</div>
          <ul className="fields">{dims.map((c) => <Field key={c.name} col={c} onPick={onPick} onSemantic={onSemantic} />)}</ul>
          <div className="sec-title">度量</div>
          <ul className="fields">
            {measures.map((c) => <Field key={c.name} col={c} onPick={onPick} onSemantic={onSemantic} />)}
            <CountField onPick={() => onPick(COUNT_FIELD)} />
          </ul>
          <p className="hint">右侧下拉是 Flint 语义类型,决定数字格式、零基线和配色;猜错了可以改。</p>
        </>
      )}
      {!meta && !busy && <p className="empty">上传一份 Excel(第一个工作表、首行表头),或点「示例数据」。也可以把文件拖到这里。</p>}
    </aside>
  );
}
