import * as XLSX from 'xlsx';

const pad = (n) => String(n).padStart(2, '0');

function fmtDate(d) {
  // SheetJS 的日期有几十秒的时区漂移,先四舍五入到分钟再取本地分量
  const t = new Date(Math.round(d.getTime() / 60000) * 60000);
  const date = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
  const hasTime = t.getHours() || t.getMinutes();
  return hasTime ? `${date} ${pad(t.getHours())}:${pad(t.getMinutes())}:00` : date;
}

/** 读第一个 sheet:返回 { sheetName, headers, rows },日期统一成字符串。 */
export function parseWorkbook(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error('Excel 里没有工作表');
  const raw = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null, raw: true });
  if (!raw.length) throw new Error('第一个工作表是空的');

  const seen = new Map();
  const headers = Object.keys(raw[0]).map((h, i) => {
    let name = String(h).trim() || `列${i + 1}`;
    const n = seen.get(name) ?? 0;
    seen.set(name, n + 1);
    return n ? `${name}_${n + 1}` : name;
  });
  const keys = Object.keys(raw[0]);
  const rows = raw.map((r) =>
    Object.fromEntries(
      keys.map((k, i) => {
        const v = r[k];
        return [headers[i], v instanceof Date ? fmtDate(v) : v];
      }),
    ),
  );
  return { sheetName, headers, rows };
}
