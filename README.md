# Flint 图表工作台

上传 Excel,在网页上用配置面板生成各种 [Flint](https://github.com/microsoft/flint-chart) 图表(类似 Tableau 的拖拽作图)。**不需要数据库,也不需要大模型。**

- **数据**:上传 `.xlsx / .xls / .csv`(取第一个工作表、首行表头),或一键加载示例销售数据。字段自动分成维度 / 度量,并猜测 Flint 语义类型(金额、利润、百分比、大区、日期……),猜错了可以在字段旁的下拉里改。
- **35 种图表**:柱状、分组/堆叠柱、折线、面积、河流图、饼/环/玫瑰、热力图、日历热力图、散点、回归、箱线、小提琴、直方图、密度、山脊、瀑布、子弹、金字塔、雷达、KPI 卡片、甘特图……(类型、通道、属性全部取自 flint-chart 的注册表)。
- **字段映射**:把字段拖到 X / Y / 颜色 / 大小 / 分组 / 分面等通道上,或点字段自动放进下一个空通道。换图表类型时会沿用已选字段并自动摆到合适的通道。
- **数据处理**:汇总 / 明细两种模式;聚合(求和、平均、计数、去重计数、最小、最大、中位数);日期粒度(年 / 季度 / 月 / 周 / 日);筛选(类别多选、数值/日期区间);排序;Top N。
- **图表属性**:按当前图表类型动态列出 Flint 支持的属性(圆角、显示数值、堆叠方式、对数轴、曲线、分箱数……)。
- **主题与交互**:14 套 Flint 主题;悬停查看、悬停对比、点击高亮、图例开关、刷选、框选缩放、拖拽排序等交互预设。
- **Flint 推荐**:根据数据一键套用 Flint 推荐的图表。
- **保存与导出**:图表配置保存在服务端,刷新后还在;可导出 SVG / PNG;能查看送给 Flint 的数据和完整 Flint 规格,以及 Flint 的校验结果。

## 运行

需要 Node 20+。

```bash
npm install
npm run build
npm start            # http://localhost:39015   端口用 PORT=xxxx 改
```

开发模式:`npm run dev:server` 和 `npm run dev:web` 各开一个终端,访问 Vite 的 http://localhost:5173(已把 `/api` 代理到 39015)。

数据和图表配置存在 `data/` 目录(`DATA_DIR` 环境变量可改位置),删掉即清空。

## 工作原理

```
Excel ──上传──▶ 服务端解析、推断列类型和语义类型 ──▶ data/datasets/<id>.*.json
                                                        │
浏览器:配置面板 ──▶ 筛选 → 日期粒度 → 分组聚合 → 排序 → Top N  (web/src/transform.js)
                                                        │
             Flint 规格 { data.values, semantic_types, chart_spec, theme_spec, interaction_spec }
                                                        │
                                              <FlintChart> 渲染(Vega-Lite)
```

Flint 本身只负责"画",不做聚合,所以分组聚合在浏览器里完成(20 万行以内都很快)。明细模式最多画 5,000 行。

## 目录

| 文件 | 作用 |
|---|---|
| `server/index.js` | API 与静态托管 |
| `server/store.js` | 数据集与图表配置的文件存储(原子写) |
| `server/infer.js` | 列类型 / 角色 / 语义类型推断 |
| `server/excel.js` `server/sample.js` | Excel 解析、示例数据 |
| `web/src/flintMeta.js` | 从 flint-chart 读取图表类型、通道、属性、主题、交互;中文名称 |
| `web/src/config.js` | 默认配置、换图表类型时的通道自动摆放 |
| `web/src/transform.js` | 筛选、日期粒度、聚合、排序、Top N |
| `web/src/FieldPane.jsx` `ConfigPanel.jsx` `Preview.jsx` `App.jsx` | 界面 |

## 接口

```
GET    /api/datasets                       数据集列表
POST   /api/datasets            (file)     上传 Excel
POST   /api/datasets/sample                加载示例数据
GET    /api/datasets/:id                   { meta, rows }
PATCH  /api/datasets/:id/columns/:name     { semantic?, role? } 修改字段语义类型 / 角色
DELETE /api/datasets/:id                   删除数据集及其图表
GET    /api/charts?datasetId=              图表列表
POST   /api/charts                         { id?, datasetId, name, config } 新建或更新
DELETE /api/charts/:id
```

## 已知限制

- 只读第一个工作表;超过 20 万行或 50MB 会拒绝。
- 暂未开放点地图、分级地图(需要联网拉地图边界)、K 线图(需要 OHLC 数据)和 Flint 的"表格"类型(用「数据」页代替)。
- 没有用户体系:所有人看到同一批数据集和图表,适合本机或内网个人使用。

## 部署到服务器

**方式一:Docker**(推荐,服务器只需装 Docker)

```bash
docker build -t flint-studio .
docker run -d --name flint-studio --restart unless-stopped -p 39015:39015 -v flint-data:/data flint-studio
```

**方式一补充:从 GitHub 拉取并自动更新**

```bash
sudo git clone https://github.com/<你的账号>/flint-chart-studio.git /opt/flint-chart-studio
cd /opt/flint-chart-studio && bash deploy/server-update.sh     # 首次构建并启动
# 之后加一条 crontab,每 5 分钟检查新代码,有更新就自动重建(见脚本开头注释)
```

**方式二:Node + systemd + Nginx**

1. 服务器装好 Node 20+,按 `deploy/flint-studio.service` 配好服务,按 `deploy/nginx.conf` 配好反向代理。
2. 在本机项目目录运行 `./deploy/deploy.sh user@你的服务器`,它会同步代码、构建、重启服务并自检。

注意:应用没有登录功能,放到公网前请在 Nginx 上加访问控制(如 `auth_basic`),或只在内网开放。
