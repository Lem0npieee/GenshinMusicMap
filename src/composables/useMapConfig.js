import { MAP_CONFIG } from '../data/config.js'

export function useMapConfig() {
  // 游戏内像素坐标 → Leaflet LatLng
  // 游戏坐标系: 原点在地图中心(origin)，y向下为正
  // Leaflet CRS.Simple: lat向下为负, lng向右为正
  function gameToLatLng(gameX, gameY) {
    const { origin, totalSize } = MAP_CONFIG
    // 地图左上角的游戏坐标
    const left = origin[0] - totalSize[0] / 2
    const top = origin[1] + totalSize[1] / 2
    // 像素偏移
    const dx = gameX - left
    const dy = top - gameY // y轴翻转
    // 转为LatLng (z=maxZoom时, 1单位=1瓦片)
    const grid = MAP_CONFIG.grids[MAP_CONFIG.maxZoom]
    const lat = -dy / MAP_CONFIG.tileSize
    const lng = dx / MAP_CONFIG.tileSize
    return [lat, lng]
  }

  // 矩形边界(l_x,l_y,r_x,r_y) → Leaflet LatLngBounds
  function gameBoundsToLatLng(bounds) {
    const nw = gameToLatLng(bounds.l_x, bounds.l_y)   // 左上
    const se = gameToLatLng(bounds.r_x, bounds.r_y)   // 右下
    return [[nw[0], nw[1]], [se[0], se[1]]] // [[north, west], [south, east]]
  }

  // 矩形边界 → 多边形顶点数组
  function gameBoundsToPolygon(bounds) {
    const nw = gameToLatLng(bounds.l_x, bounds.l_y)
    const ne = gameToLatLng(bounds.r_x, bounds.l_y)
    const se = gameToLatLng(bounds.r_x, bounds.r_y)
    const sw = gameToLatLng(bounds.l_x, bounds.r_y)
    return [nw, ne, se, sw] // 闭合多边形
  }

  // 地图中心点 (提瓦特中心)
  function getCenter() {
    return gameToLatLng(MAP_CONFIG.origin[0], MAP_CONFIG.origin[1])
  }

  return { gameToLatLng, gameBoundsToLatLng, gameBoundsToPolygon, getCenter, mapConfig: MAP_CONFIG }
}
