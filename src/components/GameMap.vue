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

const { gameBoundsToLatLng, getCenter, mapConfig } = useMapConfig()
const mapContainer = ref(null)
let map = null
let tileLayer = null
let regionLayer = null
const regionRects = new Map() // id -> L.rectangle
const initialView = { center: getCenter(), zoom: mapConfig.defaultZoom }

// 区域默认样式
function getRegionStyle(region, isActive = false) {
  const color = NATION_COLORS[region.nation] || '#d4a843'
  if (isActive) {
    return { color: '#fff', weight: 3, opacity: 1, fillColor: color, fillOpacity: 0.3, dashArray: '' }
  }
  return { color, weight: 2, opacity: 0.5, fillColor: color, fillOpacity: 0.06, dashArray: '4 3' }
}

// 渲染区域多边形
function renderRegions() {
  if (!map || !regionLayer) return
  regionLayer.clearLayers()
  regionRects.clear()

  props.regions.forEach(region => {
    if (!region.bounds) return
    // 只显示当前图层的区域
    if (region.layer && region.layer !== props.currentLayer) return

    const bounds = gameBoundsToLatLng(region.bounds)
    const rect = L.rectangle(bounds, {
      ...getRegionStyle(region, region.id == props.currentRegionId),
      className: 'region-polygon'
    })

    // tooltip
    rect.bindTooltip(
      `<div class="region-tooltip">${region.name}<span class="nation-tag">${region.nation}</span></div>`,
      { sticky: true, direction: 'top', offset: [0, -5] }
    )

    // 悬浮高亮
    rect.on('mouseover', () => {
      const isActive = region.id == props.currentRegionId
      rect.setStyle({ fillOpacity: isActive ? 0.4 : 0.18, weight: 3, opacity: 0.9 })
    })
    rect.on('mouseout', () => {
      const isActive = region.id == props.currentRegionId
      rect.setStyle(getRegionStyle(region, isActive))
    })

    // 点击
    rect.on('click', () => {
      emit('region-click', region)
    })

    rect.addTo(regionLayer)
    regionRects.set(region.id, rect)
  })
}

// 初始化地图
onMounted(() => {
  map = L.map(mapContainer.value, {
    crs: L.CRS.Simple,
    center: initialView.center,
    zoom: initialView.zoom,
    minZoom: mapConfig.minZoom,
    maxZoom: mapConfig.maxZoom,
    zoomControl: false,
    attributionControl: false,
    zoomSnap: 1,
    zoomDelta: 1,
    maxBoundsViscosity: 0.8
  })

  // 瓦片图层
  tileLayer = L.tileLayer(mapConfig.tileUrl, {
    minZoom: mapConfig.minZoom,
    maxZoom: mapConfig.maxZoom,
    noWrap: true,
    bounds: L.latLngBounds(
      gameBoundsToLatLng({ l_x: 0, l_y: 16384, r_x: 36864, r_y: 0 })[0],
      gameBoundsToLatLng({ l_x: 0, l_y: 16384, r_x: 36864, r_y: 0 })[1]
    )
  }).addTo(map)

  // 区域图层
  regionLayer = L.layerGroup().addTo(map)

  renderRegions()
})

// 监听 regions 变化
watch(() => props.regions, () => {
  renderRegions()
}, { deep: false })

// 监听图层变化
watch(() => props.currentLayer, () => {
  renderRegions()
})

// 监听 currentRegionId 变化
watch(() => props.currentRegionId, (newId, oldId) => {
  if (oldId != null && regionRects.has(String(oldId))) {
    const r = props.regions.find(r => r.id == oldId)
    if (r) regionRects.get(String(oldId))?.setStyle(getRegionStyle(r, false))
  }
  if (newId != null && regionRects.has(String(newId))) {
    const r = props.regions.find(r => r.id == newId)
    if (r) regionRects.get(String(newId))?.setStyle(getRegionStyle(r, true))
  }
})

// 暴露方法
function flyToRegion(region) {
  if (!map || !region?.bounds) return
  const bounds = gameBoundsToLatLng(region.bounds)
  map.flyToBounds(L.latLngBounds(bounds[0], bounds[1]), {
    padding: [80, 80],
    duration: 0.8
  })
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

:deep(.leaflet-tooltip) {
  background: rgba(22, 33, 62, 0.92);
  border: 1px solid rgba(212, 168, 67, 0.3);
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  color: #e0e0e0;
  font-size: 13px;
  padding: 6px 12px;
}

:deep(.leaflet-tooltip-top:before) {
  border-top-color: rgba(22, 33, 62, 0.92);
}

:deep(.leaflet-container) {
  background: #0a0a1a;
  outline: none;
}

:deep(.leaflet-tile) {
  background: #0d0d22;
}
</style>
