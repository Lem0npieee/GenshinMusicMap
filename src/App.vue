<template>
  <div class="app-container">
    <!-- 地图模块 -->
    <GameMap
      ref="mapRef"
      :regions="regions"
      :current-layer="currentLayer"
      :current-region-id="currentRegion?.id"
      @region-click="onRegionClick"
    />

    <!-- 侧边栏 -->
    <Sidebar
      :regions="regions"
      :current-layer="currentLayer"
      :current-region="currentRegion"
      :clock-state="clockState"
      :sidebar-open="sidebarOpen"
      @layer-change="onLayerChange"
      @reset-view="onResetView"
      @region-select="onRegionSelect"
      @toggle-sidebar="sidebarOpen = !sidebarOpen"
    />

    <!-- 游戏时钟 -->
    <GameClock
      :time="clock.time.value"
      :time-string="clock.timeString.value"
      :period="clock.period.value"
      :period-info="clock.periodInfo.value"
      :is-running="clock.isRunning.value"
      :speed="clock.speed.value"
      @toggle-play="clock.togglePlay()"
      @set-time="clock.setTime"
      @set-speed="clock.setSpeed"
    />

    <!-- 唱片播放器弹窗 -->
    <PlayerPanel
      :visible="playerVisible"
      :region="currentRegion"
      :period="clock.period.value"
      :is-playing="isPlaying"
      :volume="volume"
      :is-looping="isLooping"
      :is-loading="isLoading"
      :audio-error="audioError"
      @close="onClosePlayer"
      @toggle-play="togglePlay"
      @set-volume="setVolume"
      @toggle-loop="toggleLoop"
      @reload="reload"
    />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import GameMap from './components/GameMap.vue'
import GameClock from './components/GameClock.vue'
import PlayerPanel from './components/PlayerPanel.vue'
import Sidebar from './components/Sidebar.vue'
import { useGameClock } from './composables/useGameClock.js'
import { useStorage } from './composables/useStorage.js'
import {
  playRegion, switchPeriod, initAudio, setVolume as engineSetVolume,
  togglePlay, toggleLoop, reload, pause,
  isPlaying, volume, isLooping, isLoading, audioError,
  preloadRegion
} from './composables/useAudioEngine.js'
import { STORAGE_KEYS } from './data/config.js'

const storage = useStorage()
const clock = useGameClock()

const regions = ref([])
const currentLayer = ref(storage.getLayer())
const currentRegion = ref(null)
const playerVisible = ref(false)
const sidebarOpen = ref(storage.get(STORAGE_KEYS.SIDEBAR_OPEN, true))
const mapRef = ref(null)

const clockState = computed(() => ({
  time: clock.time.value,
  timeString: clock.timeString.value,
  period: clock.period.value,
  periodInfo: clock.periodInfo.value,
  isRunning: clock.isRunning.value,
  speed: clock.speed.value
}))

// 加载区域配置
onMounted(async () => {
  try {
    const res = await fetch('./data/regions.json')
    const data = await res.json()
    regions.value = await applyAudioSources(flattenL3Regions(data.regions || []))
  } catch (e) {
    console.error('加载regions.json失败:', e)
  }
  // 恢复设置
  clock.setSpeed(storage.getClockSpeed())
  if (storage.getClockRunning()) clock.start()
  else clock.start() // 默认让时钟自动流逝
  // 时钟时段变化 → 联动切歌
  clock.onPeriodChange((newPeriod) => {
    if (currentRegion.value && playerVisible.value) {
      const info = currentRegion.value.bgm?.[newPeriod]
      if (info?.embedUrl && !info?.streamUrl) pause()
      else switchPeriod(newPeriod)
    }
  })
})

async function loadAudioSources() {
  try {
    const res = await fetch('./data/audio-sources.json', { cache: 'no-store' })
    if (!res.ok) return {}
    return await res.json()
  } catch {
    return {}
  }
}

function flattenL3Regions(regionList) {
  return regionList.flatMap(parent => {
    if (!parent.children?.length) return [{ ...parent, level: 3 }]
    return parent.children.map(child => ({
      ...child,
      nation: child.nation || parent.nation,
      layer: child.layer || parent.layer,
      parentId: parent.id,
      parentName: parent.name,
      level: 3
    }))
  })
}

async function applyAudioSources(regionList) {
  const sources = await loadAudioSources()
  return regionList.map(region => {
    if (!region.bgm) return region
    const bgm = { ...region.bgm }
    for (const period of ['dawn', 'day', 'dusk', 'night']) {
      const info = bgm[period]
      if (!info) continue
      const fileName = info.file ? info.file.split('/').pop() : ''
      const source = sources[info.file] || sources[fileName] || sources[info.title]
      const merged = typeof source === 'string' ? { streamUrl: source } : { ...(source || {}) }
      bgm[period] = {
        ...info,
        ...merged
      }
    }
    return { ...region, bgm }
  })
}

function onRegionClick(region) {
  initAudio() // 首次交互初始化音频
  currentRegion.value = region
  playerVisible.value = true
  const info = region.bgm?.[clock.period.value]
  if (info?.embedUrl && !info?.streamUrl) pause()
  else {
    playRegion(region, clock.period.value)
    preloadRegion(region)
  }
}

function onRegionSelect(region) {
  onRegionClick(region)
  mapRef.value?.flyToRegion(region)
}

function onClosePlayer() {
  playerVisible.value = false
}

function onLayerChange(layer) {
  currentLayer.value = layer
  storage.setLayer(layer)
}

function onResetView() {
  mapRef.value?.resetView()
}

function setVolume(v) {
  engineSetVolume(v)
  storage.setVolume(v)
}
</script>

<style scoped>
.app-container {
  width: 100%;
  height: 100%;
  position: relative;
}
</style>
