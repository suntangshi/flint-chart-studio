// Flint 图表目录:类型、通道、属性、主题、交互,全部取自 flint-chart 自身的注册表
import {
  vlAllTemplateDefs, listThemePresets, supportedInteractionPresets, SemanticTypes,
  getChartOptions, validateChart, vlRecommendCharts, vlRecommendEncodings,
} from 'flint-chart';

// 需要地理边界(会去网上拉地图)或特殊数据形状(OHLC、无通道表格)的类型先不放进工作台
const HIDDEN = new Set(['Map', 'Choropleth', 'Candlestick Chart', 'Table']);
export const DEFS = Object.fromEntries(Object.values(vlAllTemplateDefs).filter((d) => !HIDDEN.has(d.chart)).map((d) => [d.chart, d]));

export const CHART_CN = {
  'Bar Chart': '柱状图', 'Grouped Bar Chart': '分组柱状图', 'Stacked Bar Chart': '堆叠柱状图', 'Lollipop Chart': '棒棒糖图',
  'Bullet Chart': '子弹图', 'Pyramid Chart': '金字塔图', 'Waterfall Chart': '瀑布图', 'Bar Table': '条形表格',
  'Line Chart': '折线图', 'Area Chart': '面积图', Streamgraph: '河流图', 'Range Area Chart': '区间面积图', Sparkline: '迷你折线',
  'Bump Chart': '排名变化图', 'Slope Chart': '斜率图', 'Candlestick Chart': 'K 线图',
  'Pie Chart': '饼图', 'Donut Chart': '环形图', 'Rose Chart': '玫瑰图',
  Histogram: '直方图', 'Density Plot': '密度图', 'Ridgeline Plot': '山脊图', 'ECDF Plot': '累积分布图', 'Violin Plot': '小提琴图',
  Boxplot: '箱线图', 'Strip Plot': '带状散点图',
  'Scatter Plot': '散点图', Regression: '回归图', 'Connected Scatter Plot': '连线散点图', 'Marginal Plot': '边际分布图',
  'Ranged Dot Plot': '哑铃图', Heatmap: '热力图', 'Calendar Heatmap': '日历热力图',
  'Radar Chart': '雷达图', 'Gantt Chart': '甘特图', 'KPI Card': 'KPI 卡片', Table: '表格', Map: '点地图', Choropleth: '分级地图',
};

export const GROUPS = [
  ['对比', ['Bar Chart', 'Grouped Bar Chart', 'Stacked Bar Chart', 'Lollipop Chart', 'Bullet Chart', 'Pyramid Chart', 'Waterfall Chart', 'Bar Table', 'Radar Chart']],
  ['趋势', ['Line Chart', 'Area Chart', 'Streamgraph', 'Range Area Chart', 'Sparkline', 'Bump Chart', 'Slope Chart', 'Candlestick Chart']],
  ['占比', ['Pie Chart', 'Donut Chart', 'Rose Chart']],
  ['分布', ['Histogram', 'Boxplot', 'Violin Plot', 'Density Plot', 'Ridgeline Plot', 'ECDF Plot', 'Strip Plot']],
  ['关系', ['Scatter Plot', 'Regression', 'Connected Scatter Plot', 'Marginal Plot', 'Ranged Dot Plot', 'Heatmap', 'Calendar Heatmap']],
  ['其他', ['KPI Card', 'Gantt Chart']],
].map(([g, list]) => [g, list.filter((t) => DEFS[t])]);
// 注册表里有、但上面没归类的类型,放进"其他",保证一个不漏
const grouped = new Set(GROUPS.flatMap(([, l]) => l));
GROUPS.at(-1)[1].push(...Object.keys(DEFS).filter((t) => !grouped.has(t)));

/** 这些类型画的是逐行明细(分布、关系),默认不聚合 */
export const RAW_TYPES = new Set(['Histogram', 'Boxplot', 'Violin Plot', 'Density Plot', 'Ridgeline Plot', 'ECDF Plot', 'Strip Plot',
  'Scatter Plot', 'Regression', 'Marginal Plot']);

export const CHANNEL_CN = {
  x: 'X 轴', y: 'Y 轴', x2: 'X 结束', y2: 'Y 结束', color: '颜色', size: '大小', shape: '形状', opacity: '透明度',
  detail: '细节', group: '分组', column: '列分面', row: '行分面', strokeDash: '线型', order: '顺序', text: '文本',
  open: '开盘', high: '最高', low: '最低', close: '收盘', metric: '指标名', value: '数值', goal: '目标',
  latitude: '纬度', longitude: '经度', angle: '角度', radius: '半径', id: '标识',
};
export const SECONDARY_CHANNELS = new Set(['shape', 'opacity', 'detail', 'strokeDash', 'column', 'row', 'order', 'text', 'id']);

export const PROP_CN = {
  Opacity: '透明度', 'Independent Y': '分面独立 Y 轴', 'Log X': 'X 对数轴', 'Log Y': 'Y 对数轴', 'Zero X': 'X 从 0 开始', 'Zero Y': 'Y 从 0 开始',
  Margins: '边际图', Stack: '堆叠方式', Bandwidth: '带宽', 'Max Bins': '最大分箱数', Whiskers: '须线算法', Outliers: '显示离群点',
  Method: '回归方法', 'Poly Order': '多项式阶数', Jitter: '抖动', Size: '大小', Corners: '圆角', 'X as': 'X 轴类型', 'Y as': 'Y 轴类型',
  Values: '显示数值', Dodge: '分组排布', 'Dot Size': '点大小', Totals: '合计柱', 'Task height': '任务条高度', Labels: '标签',
  Overlap: '重叠', Curve: '曲线', Order: '顺序', 'Trim tails': '裁剪尾部', Fill: '填充', Perspective: '透视', Skew: '倾斜', Tilt: '俯仰',
  'Mark values': '标注数值', 'Value max': '数值上限', Points: '显示数据点', Observations: '显示观测点', 'Median rule': '中位线',
  Contour: '轮廓', Widths: '宽度', 'Median width': '中位线宽度', 'Reference line': '参考线', 'Sparkline width': '迷你图宽度',
  'Name in label': '标签含名称', Donut: '环形', 'Sort slices': '扇区排序', Gap: '间隙', Alignment: '对齐', Filled: '填充',
  'Fill Opacity': '填充透明度', 'Line Width': '线宽', 'Max Rows': '最多行数', '% of total': '占总数百分比', Layout: '布局',
  'Card style': '卡片样式', 'Behind threshold': '低于阈值', Region: '地区', Projection: '投影', Center: '中心', Level: '层级',
};

export const THEMES = listThemePresets();

export const INTERACTIONS = [
  ['inspect', '悬停查看数值'], ['inspect-index', '悬停对比同一位置'], ['click-highlight', '点击高亮'],
  ['hover-group-focus', '悬停聚焦系列'], ['legend-toggle', '点图例开关系列'], ['brush-x', '横向刷选'],
  ['brush-zoom', '框选缩放'], ['drag-reorder', '拖拽排序'],
];
export function interactionsFor(chartType) {
  const def = DEFS[chartType];
  if (!def?.interactionSupport) return [];
  const ok = new Set(supportedInteractionPresets(def.interactionSupport));
  return INTERACTIONS.filter(([t]) => ok.has(t));
}

export const SEMANTIC_CN = {
  Category: '分类', Region: '大区', Country: '国家', State: '省/州', City: '城市', ID: '编号',
  Date: '日期', DateTime: '日期时间', Year: '年', Quarter: '季度', Month: '月', YearMonth: '年月', YearQuarter: '年季度',
  Amount: '金额', Profit: '利润(正负)', Price: '价格', Quantity: '数量', Count: '计数', Number: '数值', Percentage: '百分比',
  Rank: '排名', Score: '评分',
};
export const SEMANTIC_LIST = Object.keys(SemanticTypes);

export function recommend(rows, columns, max = 6) {
  const st = Object.fromEntries(columns.map((c) => [c.name, c.semantic]));
  try { return vlRecommendCharts(rows.slice(0, 1500), st, { max: max + 2 }).filter((r) => DEFS[r.chartType] && Object.keys(r.encodings).length).slice(0, max); } catch { return []; }
}
export function recommendEncodings(chartType, rows, columns) {
  const st = Object.fromEntries(columns.map((c) => [c.name, c.semantic]));
  try { return vlRecommendEncodings(chartType, rows.slice(0, 1500), st) ?? {}; } catch { return {}; }
}
export function chartOptions(spec) { try { return getChartOptions(spec); } catch { return []; } }
export function validate(spec) {
  try { return validateChart(spec, 'vegalite'); } catch (e) { return { valid: false, errors: [{ message: e.message }], warnings: [] }; }
}
