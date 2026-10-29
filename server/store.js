// 文件存储:data/datasets/<id>.meta.json + <id>.rows.json,data/charts.json
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.env.DATA_DIR || path.resolve('data');
const DS = path.join(ROOT, 'datasets');
const CHARTS = path.join(ROOT, 'charts.json');

await fs.mkdir(DS, { recursive: true });

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value));
  await fs.rename(tmp, file); // 原子替换,写一半时进程退出也不会留下坏文件
}
const readJson = async (file, fallback) => {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return fallback; throw e; }
};
const newId = () => crypto.randomBytes(6).toString('hex');
const safeId = (id) => { if (!/^[a-f0-9]{12}$/.test(id)) throw Object.assign(new Error('无效的 id'), { status: 400 }); return id; };

export async function listDatasets() {
  const files = (await fs.readdir(DS).catch(() => [])).filter((f) => f.endsWith('.meta.json'));
  const metas = await Promise.all(files.map((f) => readJson(path.join(DS, f))));
  return metas.filter(Boolean).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function createDataset({ name, columns, rows }) {
  const meta = { id: newId(), name, rowCount: rows.length, columns, createdAt: new Date().toISOString() };
  await writeJson(path.join(DS, `${meta.id}.rows.json`), rows);
  await writeJson(path.join(DS, `${meta.id}.meta.json`), meta);
  return meta;
}
export async function getDataset(id) {
  safeId(id);
  const meta = await readJson(path.join(DS, `${id}.meta.json`), null);
  if (!meta) return null;
  return { meta, rows: await readJson(path.join(DS, `${id}.rows.json`), []) };
}
export async function updateColumn(id, name, patch) {
  safeId(id);
  const file = path.join(DS, `${id}.meta.json`);
  const meta = await readJson(file, null);
  if (!meta) return null;
  const col = meta.columns.find((c) => c.name === name);
  if (!col) return null;
  if (patch.semantic) col.semantic = String(patch.semantic);
  if (patch.role && ['dimension', 'measure', 'time'].includes(patch.role)) col.role = patch.role;
  await writeJson(file, meta);
  return meta;
}
export async function deleteDataset(id) {
  safeId(id);
  await Promise.all([`${id}.meta.json`, `${id}.rows.json`].map((f) => fs.rm(path.join(DS, f), { force: true })));
  const charts = await readJson(CHARTS, []);
  await writeJson(CHARTS, charts.filter((c) => c.datasetId !== id));
}

export async function listCharts(datasetId) {
  const charts = await readJson(CHARTS, []);
  return datasetId ? charts.filter((c) => c.datasetId === datasetId) : charts;
}
export async function saveChart({ id, datasetId, name, config }) {
  const charts = await readJson(CHARTS, []);
  const now = new Date().toISOString();
  let chart = id && charts.find((c) => c.id === id);
  if (chart) Object.assign(chart, { name, config, updatedAt: now });
  else { chart = { id: newId(), datasetId: safeId(datasetId), name, config, createdAt: now, updatedAt: now }; charts.push(chart); }
  await writeJson(CHARTS, charts);
  return chart;
}
export async function deleteChart(id) {
  safeId(id);
  const charts = await readJson(CHARTS, []);
  await writeJson(CHARTS, charts.filter((c) => c.id !== id));
}
