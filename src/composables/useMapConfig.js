import { MAP_CONFIG } from '../data/config.js'

export function useMapConfig() {
  // 游戏内像素坐标 → Leaflet LatLng
  // 关键：origin 是游戏坐标 [0,0] 在瓦片像素坐标系中的位置
  // 公式: tile_pixel = game + origin; 然后 tile_pixel / tileSize = Leaflet坐标
  // Leaflet CRS.Simple: lat向下为负(y轴翻转), lng向右为正
  function gameToLatLng(gameX, gameY) {
    const { origin, tileSize } = MAP_CONFIG
    const tileX = gameX + origin[0]
    const tileY = gameY + origin[1]
    const lat = -tileY / tileSize
    const lng = tileX / tileSize
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
    // 地图覆盖游戏坐标范围 [-originalSize/2, +originalSize/2]
    // 但用 totalSize 保守一些
    const halfW = MAP_CONFIG.totalSize[0] / 2
    const halfH = MAP_CONFIG.totalSize[1] / 2
    return gameBoundsToLatLng({ l_x: -halfW, l_y: -halfH, r_x: halfW, r_y: halfH })
  }

  return { gameToLatLng, gameBoundsToLatLng, gameBoundsToPolygon, getCenter, getMapBounds, mapConfig: MAP_CONFIG }
}
