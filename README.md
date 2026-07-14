# GenshinMusicMap

原神提瓦特音乐地图 —— 以交互瓦片地图为载体，系统化绑定每一块地理区域与对应黎明/白天/黄昏/夜晚四段大世界 BGM，搭配原神同款游戏时钟，沉浸式浏览提瓦特场景配乐。

> 个人学习向非商用工具，不提供音乐资源商用分发。

## 当前状态：资源准备完成

已下载/整理的资源：

| 资源类型 | 数量 | 说明 |
|----------|------|------|
| 瓦片地图 | 3024 张 | 提瓦特全图，3 个缩放级别（z1-z3），米哈游官方图源，webp 格式 |
| 区域配置 | 49 个区域 | 覆盖蒙德/璃月/稻妻/须弥/枫丹/纳塔六大国度，含矩形边界坐标 |
| BGM 映射 | 41 个区域有曲目 | 四时段（黎明/白天/黄昏/夜晚）曲目名映射 |
| 占位音频 | 131 个 mp3 | ffmpeg 生成的音调占位文件，需替换为真实 BGM |

## 目录结构

```
GenshinMusicMap/
├── public/
│   ├── images/
│   │   ├── map/          # 瓦片地图 {z}/{x}_{y}.webp
│   │   └── covers/       # 唱片封面（待补充）
│   ├── audio/            # BGM 音频（当前为占位文件）
│   │   └── BGM下载说明.md # 真实BGM获取渠道与命名规范
│   └── data/
│       ├── regions.json       # 区域+BGM配置（核心配置文件）
│       └── map-anchors-raw.json # 原始区域锚点数据
└── 资源调研报告.md
```

## 瓦片地图说明

- 图源：米哈游官方互动地图（`act-webstatic.mihoyo.com`）
- 格式：`/images/map/{z}/{x}_{y}.webp`
- 缩放级别：z1(N3,18×8) / z2(N2,36×16) / z3(N1,72×32)
- 坐标系：L.CRS.Simple，转换参数见 regions.json 的 mapConfig

## BGM 音频说明

当前 `public/audio/` 为占位音频（3秒音调），需替换为真实 BGM：
- 下载渠道见 `public/audio/BGM下载说明.md`
- 文件命名：`{区域ID}_{时段}.mp3`（时段：dawn/day/dusk/night）
- 曲目清单见 regions.json

## 技术栈（待开发）

- Vite + Vue3 + CSS/SCSS
- Leaflet.js（瓦片地图、多边形绘制）
- Web Audio API（音频淡入淡出、独占播放）
- LocalStorage（本地持久化）
