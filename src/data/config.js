// 时段划分规则
export const TIME_PERIODS = {
  dawn:  { name: '黎明', range: [5, 9],    color: '#f9c270', icon: '🌅' },
  day:   { name: '白天', range: [9, 17],   color: '#7ec0ee', icon: '☀️' },
  dusk:  { name: '黄昏', range: [17, 20],  color: '#e88c30', icon: '🌇' },
  night: { name: '夜晚', range: [20, 29],  color: '#4a5291', icon: '🌙' } // 20~次日04:59 用 20~29 表示
}

// 根据小时获取时段
export function getPeriod(hour) {
  const h = hour % 24
  if (h >= 5 && h < 9) return 'dawn'
  if (h >= 9 && h < 17) return 'day'
  if (h >= 17 && h < 20) return 'dusk'
  return 'night'
}

// 地图配置（米哈游官方瓦片坐标系）
export const MAP_CONFIG = {
  tileUrl: './images/map/{z}/{x}_{y}.webp',
  minZoom: 1,
  maxZoom: 3,
  defaultZoom: 2,
  // 坐标转换参数（来自米哈游API detail_v2）
  origin: [23793, 6208],
  totalSize: [36864, 16384],
  // API 坐标中每个最高级瓦片覆盖 512 个单位；本地图片实际为 256px。
  // 在 Leaflet z=3 下，一个瓦片横跨 32 个 CRS.Simple 坐标单位，
  // 因此游戏/API 坐标需要除以 512 / 32 = 16。
  coordinateScale: 16,
  leafletTileSize: 256,
  // 各缩放级别瓦片网格
  grids: {
    1: { x: 18, y: 8 },
    2: { x: 36, y: 16 },
    3: { x: 72, y: 32 }
  }
}

// 国度配色
export const NATION_COLORS = {
  '蒙德': '#7ec0ee',
  '璃月': '#e8a838',
  '稻妻': '#a040a0',
  '须弥': '#5cb85c',
  '枫丹': '#4a90d9',
  '纳塔': '#e8702a'
}

// 本地存储键名
export const STORAGE_KEYS = {
  VOLUME: 'gmm_volume',
  CLOCK_SPEED: 'gmm_clock_speed',
  CLOCK_RUNNING: 'gmm_clock_running',
  LAYER: 'gmm_layer',
  SIDEBAR_OPEN: 'gmm_sidebar_open'
}
