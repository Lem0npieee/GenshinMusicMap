import { MAP_CONFIG } from '../data/config.js'

export function useMapConfig() {
  // 游戏内像素坐标 → Leaflet LatLng
  // 关键：origin 是游戏坐标 [0,0] 在瓦片像素坐标系中的位置
  // 公式: tile_pixel = game + origin; 然后 tile_pixel / coordinateScale = Leaflet坐标
  // 最高级瓦片每张覆盖 512 个 API 坐标单位，但图片按 256px 渲染；
  // Leaflet z=3 又会把 CRS.Simple 坐标放大 8 倍，所以换算比例为 16。
  // Leaflet CRS.Simple: lat向下为负(y轴翻转), lng向右为正
  function gameToLatLng(gameX, gameY) {
    const { origin, coordinateScale } = MAP_CONFIG
    const tileX = gameX + origin[0]
    const tileY = gameY + origin[1]
    const lat = -tileY / coordinateScale
    const lng = tileX / coordinateScale
    return [lat, lng]
  }

  // 矩形边界(l_x,l_y,r_x,r_y) → Leaflet LatLngBounds [[n,w],[s,e]]
  function gameBoundsToLatLng(bounds) {
    const nw = gameBoundsToLatLng_impl(bounds.l_x, bounds.l_y)   // 左上(north-west)
    const se = gameBoundsToLatLng_impl(bounds.r_x, bounds.r_y)   // 右下(south-east)
    // LatLngBounds 格式: [[southLat, westLng], [northLat, eastLng]]
    return [[se[0], nw[1]], [nw[0], se[1]]]
  }
  function gameBoundsToLatLng_impl(gx, gy) { return gameToLatLng(gx, gy) }

  // 矩形边界 → 多边形顶点数组（顺时针）
  function gameBoundsToPolygon(bounds) {
    const nw = gameToLatLng(bounds.l_x, bounds.l_y)
    const ne = gameToLatLng(bounds.r_x, bounds.l_y)
    const se = gameToLatLng(bounds.r_x, bounds.r_y)
    const sw = gameToLatLng(bounds.l_x, bounds.r_y)
    return [nw, ne, se, sw]
  }

  // 地图中心点 (游戏坐标 origin → 提瓦特中心)
  function getCenter() {
    // 地图中心是游戏坐标 [0, 0]
    return gameToLatLng(0, 0)
  }

  // 全图 LatLngBounds
  function getMapBounds() {
    // totalSize 描述的是从瓦片左上角 [0,0] 开始的完整画布尺寸，
    // 不能以游戏原点为中心对半展开，否则会产生负瓦片索引。
    const [width, height] = MAP_CONFIG.totalSize
    const scale = MAP_CONFIG.coordinateScale
    return [[-height / scale, 0], [0, width / scale]]
  }

  return { gameToLatLng, gameBoundsToLatLng, gameBoundsToPolygon, getCenter, getMapBounds, mapConfig: MAP_CONFIG }
}
