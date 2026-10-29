// 造数:2023-01 ~ 2024-12 的销售明细,带区域差异、季节性和增长趋势;固定随机种子,结果可复现。
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

const REGIONS = {
  华东: { w: 1.5, provinces: ['上海', '江苏', '浙江', '山东'] },
  华北: { w: 1.2, provinces: ['北京', '天津', '河北'] },
  华南: { w: 1.3, provinces: ['广东', '广西', '福建'] },
  西南: { w: 0.8, provinces: ['四川', '重庆', '云南'] },
  东北: { w: 0.6, provinces: ['辽宁', '吉林', '黑龙江'] },
  西北: { w: 0.45, provinces: ['陕西', '甘肃', '新疆'] },
};
const CATEGORIES = [
  { name: '办公设备', price: 1800, margin: 0.18 },
  { name: '家具', price: 2600, margin: 0.1 },
  { name: '办公耗材', price: 120, margin: 0.32 },
  { name: '电子产品', price: 3400, margin: 0.14 },
];
const SEGMENTS = ['企业', '个人', '小微企业'];

const pad = (n) => String(n).padStart(2, '0');

export function makeSampleRows(n = 4000) {
  const r = rng(42);
  const regionNames = Object.keys(REGIONS);
  const totalW = regionNames.reduce((a, k) => a + REGIONS[k].w, 0);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const rows = [];
  for (let i = 0; i < n; i++) {
    // 按月份季节性抽样:Q4 旺季、2 月淡季,整体逐月增长
    let monthIdx;
    for (;;) {
      monthIdx = Math.floor(r() * 24);
      const m = monthIdx % 12;
      const season = [0.8, 0.6, 0.9, 0.95, 1, 1, 0.95, 1, 1.1, 1.15, 1.35, 1.5][m];
      const growth = 0.75 + (monthIdx / 24) * 0.5;
      if (r() < (season * growth) / 2.1) break;
    }
    const year = 2023 + Math.floor(monthIdx / 12);
    const month = (monthIdx % 12) + 1;
    const day = 1 + Math.floor(r() * 28);

    let x = r() * totalW;
    let region = regionNames[0];
    for (const k of regionNames) { if ((x -= REGIONS[k].w) <= 0) { region = k; break; } }
    const cat = pick(CATEGORIES);
    const qty = 1 + Math.floor(r() * r() * 12);
    const discount = pick([0, 0, 0, 0.05, 0.1, 0.1, 0.15, 0.2, 0.3]);
    const amount = Math.round(cat.price * (0.6 + r() * 0.9) * qty * (1 - discount));
    const profit = Math.round(amount * (cat.margin - discount * 0.9 + (r() - 0.5) * 0.08));
    rows.push({
      订单日期: `${year}-${pad(month)}-${pad(day)}`,
      大区: region,
      省份: pick(REGIONS[region].provinces),
      产品类别: cat.name,
      客户类型: pick(SEGMENTS),
      销售金额: amount,
      利润: profit,
      销量: qty,
      折扣: discount,
    });
  }
  return rows.sort((a, b) => (a.订单日期 < b.订单日期 ? -1 : 1));
}
