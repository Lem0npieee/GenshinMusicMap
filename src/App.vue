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
  togglePlay, toggleLoop, reload,
  isPlaying, volume, isLooping, isLoading,
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
    regions.value = data.regions || []
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
      switchPeriod(newPeriod)
    }
  })
})

function onRegionClick(region) {
  initAudio() // 首次交互初始化音频
  currentRegion.value = region
  playerVisible.value = true
  playRegion(region, clock.period.value)
  preloadRegion(region)
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
