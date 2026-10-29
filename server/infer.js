// 由列值推断类型和 Flint 语义类型;语义类型只是初始猜测,用户可以在字段面板里改
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/;

const NAME_RULES = [
  [/利润|盈利|profit|margin/i, 'Profit'],
  [/率|占比|比例|折扣|percent|ratio|rate|discount|%/i, 'Percentage'],
  [/单价|价格|price/i, 'Price'],
  [/金额|销售额|销售|收入|营收|业绩|成本|费用|amount|revenue|sales|cost/i, 'Amount'],
  [/数量|销量|件数|个数|qty|quantity|units/i, 'Quantity'],
  [/次数|人数|count/i, 'Count'],
  [/排名|rank/i, 'Rank'],
  [/评分|得分|score|rating/i, 'Score'],
  [/年份|year/i, 'Year'],
];
const DIM_RULES = [
  [/国家|country/i, 'Country'],
  [/省|州|state|province/i, 'State'],
  [/城市|市|city/i, 'City'],
  [/大区|区域|地区|region/i, 'Region'],
  [/编号|id$|^id|编码|code/i, 'ID'],
];

export function inferColumn(name, values) {
  const vals = values.filter((v) => v !== null && v !== '' && v !== undefined);
  const base = { name };
  if (!vals.length) return { ...base, kind: 'text', role: 'dimension', semantic: 'Category' };

  if (vals.every((v) => typeof v === 'number' && Number.isFinite(v))) {
    const isInt = vals.every(Number.isInteger);
    // 4 位整数且名字像年份的,按年份当维度
    if (isInt && /年|year/i.test(name) && vals.every((v) => v >= 1900 && v <= 2100))
      return { ...base, kind: 'integer', role: 'time', semantic: 'Year' };
    const hit = NAME_RULES.find(([re]) => re.test(name));
    if (/编号|id$|^id|编码/i.test(name)) return { ...base, kind: 'integer', role: 'dimension', semantic: 'ID' };
    return { ...base, kind: isInt ? 'integer' : 'decimal', role: 'measure', semantic: hit ? hit[1] : 'Number' };
  }
  if (vals.every((v) => typeof v === 'string' && DATE_RE.test(v))) return { ...base, kind: 'date', role: 'time', semantic: 'Date' };
  if (vals.every((v) => typeof v === 'string' && (DATE_RE.test(v) || DATETIME_RE.test(v))))
    return { ...base, kind: 'datetime', role: 'time', semantic: 'DateTime' };

  const hit = DIM_RULES.find(([re]) => re.test(name));
  return { ...base, kind: 'text', role: 'dimension', semantic: hit ? hit[1] : 'Category' };
}

/** 给前端的列描述:补上不同值个数,文本列 ≤200 个不同值时附上取值(筛选器用) */
export function describeColumns(headers, rows) {
  return headers.map((h) => {
    const values = rows.map((r) => r[h]);
    const c = inferColumn(h, values);
    const distinct = new Set(values.filter((v) => v !== null && v !== ''));
    c.distinct = distinct.size;
    if (c.kind === 'text' && distinct.size <= 200) c.values = [...distinct].sort();
    if (c.role === 'measure' || c.role === 'time') {
      let lo = null, hi = null;
      for (const v of distinct) { if (lo === null || v < lo) lo = v; if (hi === null || v > hi) hi = v; }
      c.range = [lo, hi];
    }
    return c;
  });
}
