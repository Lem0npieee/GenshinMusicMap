<template>
  <div ref="mapContainer" class="game-map"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import L from 'leaflet'
import { useMapConfig } from '../composables/useMapConfig.js'
import { NATION_COLORS } from '../data/config.js'

const props = defineProps({
  regions: { type: Array, default: () => [] },
  currentLayer: { type: String, default: 'surface' },
  currentRegionId: { type: [String, Number], default: null }
})

const emit = defineEmits('region-click')

const { gameBoundsToLatLng, getCenter, getMapBounds, mapConfig } = useMapConfig()
const mapContainer = ref(null)
let map = null
let tileLayer = null
let regionLayer = null
const regionRects = new Map()
const initialView = { center: getCenter(), zoom: mapConfig.defaultZoom }
const tileBaseUrl = `${import.meta.env.BASE_URL}images/map`

// 自定义瓦片层，支持 {x}_{y}.webp 格式的文件名
const GameTileLayer = L.GridLayer.extend({
  createTile: function (coords) {
    const tile = document.createElement('img')
    tile.alt = ''
    tile.decoding = 'async'
    tile.src = `${tileBaseUrl}/${coords.z}/${coords.x}_${coords.y}.webp`
    tile.style.width = '100%'
    tile.style.height = '100%'
    tile.style.display = 'block'
    tile.onerror = () => { tile.style.visibility = 'hidden' }
    return tile
  }
})

// 区域默认样式
function getRegionStyle(region, isActive = false) {
  const color = NATION_COLORS[region.nation] || '#d4a843'
  if (isActive) {
    return { color: '#fff', weight: 3, opacity: 1, fillColor: color, fillOpacity: 0.3, dashArray: '' }
  }
  return { color, weight: 2, opacity: 0.5, fillColor: color, fillOpacity: 0.06, dashArray: '4 3' }
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function hasBgm(region) {
  return Object.values(region?.bgm || {}).some(item => item?.title && item?.file)
}

// 渲染区域多边形
function renderRegions() {
  if (!map || !regionLayer) return
  regionLayer.clearLayers()
  regionRects.clear()
  props.regions.forEach(region => {
    if (!region.bounds) return
    if (region.layer && region.layer !== props.currentLayer) return
    const bounds = gameBoundsToLatLng(region.bounds)
    const rect = L.rectangle(bounds, {
      ...getRegionStyle(region, region.id == props.currentRegionId),
      className: 'region-polygon',
      interactive: true
    })
    const parentPath = region.parentName
      ? `<span class="region-parent">${escapeHtml(region.parentName)} ›</span>`
      : ''
    const bgmStatus = hasBgm(region) ? '' : '<span class="no-bgm-tag">暂无 L3 专属曲目</span>'
    rect.bindTooltip(
      `<div class="region-tooltip">${parentPath}<b>${escapeHtml(region.name)}</b><span class="nation-tag">${escapeHtml(region.nation)}</span>${bgmStatus}</div>`,
      { sticky: true, direction: 'top', offset: [0, -5], className: 'region-tooltip-wrapper' }
    )
    rect.on('mouseover', () => {
      const isActive = String(region.id) === String(props.currentRegionId)
      rect.setStyle({ fillOpacity: isActive ? 0.4 : 0.18, weight: 3, opacity: 0.9 })
    })
    rect.on('mouseout', () => {
      const isActive = String(region.id) === String(props.currentRegionId)
      rect.setStyle(getRegionStyle(region, isActive))
    })
    rect.on('click', () => emit('region-click', region))
    rect.addTo(regionLayer)
    regionRects.set(String(region.id), rect)
  })
}

// 初始化地图
onMounted(() => {
  const mapBounds = L.latLngBounds(getMapBounds())
  map = L.map(mapContainer.value, {
    crs: L.CRS.Simple,
    center: initialView.center,
    zoom: initialView.zoom,
    minZoom: mapConfig.minZoom,
    maxZoom: mapConfig.maxZoom,
    zoomControl: false,
    attributionControl: false,
    zoomSnap: 0.5,
    zoomDelta: 0.5,
    maxBounds: mapBounds,
    maxBoundsViscosity: 0.8,
    worldCopyJump: false
  })
  // 瓦片图层（自定义支持 {x}_{y}.webp 格式）
  tileLayer = new GameTileLayer({
    minZoom: mapConfig.minZoom,
    maxZoom: mapConfig.maxZoom,
    tileSize: mapConfig.leafletTileSize,
    noWrap: true,
    bounds: mapBounds
  }).addTo(map)
  regionLayer = L.layerGroup().addTo(map)
  renderRegions()
})

watch(() => props.regions, () => renderRegions(), { deep: false })
watch(() => props.currentLayer, () => renderRegions())
watch(() => props.currentRegionId, (newId, oldId) => {
  const oldKey = String(oldId)
  const newKey = String(newId)
  if (oldKey !== 'null' && oldKey !== 'undefined' && regionRects.has(oldKey)) {
    const r = props.regions.find(r => String(r.id) === oldKey)
    if (r) regionRects.get(oldKey)?.setStyle(getRegionStyle(r, false))
  }
  if (newKey !== 'null' && newKey !== 'undefined' && regionRects.has(newKey)) {
    const r = props.regions.find(r => String(r.id) === newKey)
    if (r) regionRects.get(newKey)?.setStyle(getRegionStyle(r, true))
  }
})

function flyToRegion(region) {
  if (!map || !region?.bounds) return
  const bounds = gameBoundsToLatLng(region.bounds)
  map.flyToBounds(L.latLngBounds(bounds[0], bounds[1]), { padding: [80, 80], duration: 0.8 })
}
function resetView() {
  if (!map) return
  map.flyTo(initialView.center, initialView.zoom, { duration: 0.8 })
}

defineExpose({ flyToRegion, resetView })

onUnmounted(() => {
  if (map) { map.remove(); map = null }
})
</script>

<style scoped>
.game-map {
  width: 100%;
  height: 100%;
  background: #0a0a1a;
  z-index: 1;
}
:deep(.region-polygon) {
  cursor: pointer;
  transition: fill-opacity 0.2s ease, stroke-opacity 0.2s ease;
}
:deep(.region-tooltip-wrapper) {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  padding: 0 !important;
}
:deep(.region-tooltip) {
  background: rgba(22, 33, 62, 0.95);
  border: 1px solid rgba(212, 168, 67, 0.4);
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  color: #e0e0e0;
  font-size: 13px;
  padding: 6px 12px;
}
:deep(.region-tooltip .nation-tag) {
  font-size: 11px;
  color: var(--text-secondary, #a0a0b0);
  margin-left: 6px;
}
:deep(.region-tooltip .region-parent) {
  display: block;
  margin-bottom: 2px;
  color: #8f91a2;
  font-size: 10px;
}
:deep(.region-tooltip .no-bgm-tag) {
  display: block;
  margin-top: 3px;
  color: #ffb4af;
  font-size: 10px;
}
:deep(.leaflet-tooltip-top:before) { display: none; }
:deep(.leaflet-container) {
  background: #0a0a1a;
  outline: none;
}
:deep(.leaflet-tile) {
  background: #0d0d22;
}
</style>
