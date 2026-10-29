import express from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseWorkbook } from './excel.js';
import { describeColumns } from './infer.js';
import { makeSampleRows } from './sample.js';
import * as store from './store.js';

const PORT = Number(process.env.PORT || 3000);
const MAX_ROWS = 200_000;

const app = express();
app.use(express.json({ limit: '2mb' }));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

async function importRows(name, headers, rows) {
  if (rows.length > MAX_ROWS) throw Object.assign(new Error(`数据有 ${rows.length} 行,超过上限 ${MAX_ROWS} 行`), { status: 413 });
  return store.createDataset({ name, columns: describeColumns(headers, rows), rows });
}

app.get('/api/datasets', async (_req, res) => res.json(await store.listDatasets()));

app.post('/api/datasets', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '没有收到文件' });
  const name = Buffer.from(req.file.originalname, 'latin1').toString('utf8'); // multer 把中文文件名按 latin1 解码
  const { headers, rows } = parseWorkbook(req.file.buffer);
  res.json(await importRows(name, headers, rows));
});

app.post('/api/datasets/sample', async (_req, res) => {
  const rows = makeSampleRows();
  res.json(await importRows('示例_销售明细(造数)', Object.keys(rows[0]), rows));
});

app.get('/api/datasets/:id', async (req, res) => {
  const ds = await store.getDataset(req.params.id);
  if (!ds) return res.status(404).json({ error: '数据集不存在' });
  res.json(ds);
});

app.patch('/api/datasets/:id/columns/:name', async (req, res) => {
  const meta = await store.updateColumn(req.params.id, req.params.name, req.body ?? {});
  if (!meta) return res.status(404).json({ error: '数据集或字段不存在' });
  res.json(meta);
});

app.delete('/api/datasets/:id', async (req, res) => { await store.deleteDataset(req.params.id); res.json({ ok: true }); });

app.get('/api/charts', async (req, res) => res.json(await store.listCharts(req.query.datasetId)));
app.post('/api/charts', async (req, res) => {
  const { id, datasetId, name, config } = req.body ?? {};
  if (!datasetId || !config) return res.status(400).json({ error: '缺少 datasetId 或 config' });
  res.json(await store.saveChart({ id, datasetId, name: String(name || '未命名图表').slice(0, 80), config }));
});
app.delete('/api/charts/:id', async (req, res) => { await store.deleteChart(req.params.id); res.json({ ok: true }); });

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '../web/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err, _req, res, _next) => {
  if (!err.status) console.error(err);
  res.status(err.status || (err.code === 'LIMIT_FILE_SIZE' ? 413 : 500)).json({ error: err.code === 'LIMIT_FILE_SIZE' ? '文件超过 50MB' : err.message });
});

app.listen(PORT, () => console.log(`Flint Chart Studio: http://localhost:${PORT}`));
