async function req(url, opts) {
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `请求失败 (${res.status})`);
  return data;
}
const json = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export const api = {
  datasets: () => req('/api/datasets'),
  dataset: (id) => req(`/api/datasets/${id}`),
  upload: (file) => { const fd = new FormData(); fd.append('file', file); return req('/api/datasets', { method: 'POST', body: fd }); },
  sample: () => req('/api/datasets/sample', { method: 'POST' }),
  deleteDataset: (id) => req(`/api/datasets/${id}`, { method: 'DELETE' }),
  updateColumn: (id, name, patch) => req(`/api/datasets/${id}/columns/${encodeURIComponent(name)}`, json('PATCH', patch)),
  charts: (datasetId) => req(`/api/charts?datasetId=${datasetId}`),
  saveChart: (chart) => req('/api/charts', json('POST', chart)),
  deleteChart: (id) => req(`/api/charts/${id}`, { method: 'DELETE' }),
};
