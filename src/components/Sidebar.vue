<template>
  <!-- 折叠态：展开按钮 -->
  <div v-if="!sidebarOpen" class="sidebar-collapsed" @click="$emit('toggle-sidebar')">
    <span class="collapse-icon">☰</span>
  </div>

  <!-- 展开态：侧边栏面板 -->
  <transition name="slide">
    <div v-if="sidebarOpen" class="sidebar">
      <!-- 折叠按钮 -->
      <div class="sidebar-header">
        <span class="sidebar-title">🎵 提瓦特音乐地图</span>
        <button class="btn-collapse" @click="$emit('toggle-sidebar')">✕</button>
      </div>

      <div class="sidebar-body">
        <!-- 地图控制区 -->
        <div class="section">
          <div class="section-title">🗺️ 地图控制</div>
          <div class="layer-buttons">
            <button
              v-for="layer in layers"
              :key="layer.id"
              class="layer-btn"
              :class="{ active: currentLayer === layer.id }"
              @click="$emit('layer-change', layer.id)"
            >{{ layer.icon }} {{ layer.name }}</button>
          </div>
          <button class="btn-reset" @click="$emit('reset-view')">📍 重置视角</button>
        </div>

        <!-- 时钟状态区 -->
        <div class="section">
          <div class="section-title">🕐 时钟状态</div>
          <div class="clock-status">
            <span class="clock-time" :style="{ color: clockState?.periodInfo?.color || '#e0e0e0' }">
              {{ clockState?.timeString || '08:00' }}
            </span>
            <span class="clock-period">
              {{ clockState?.periodInfo?.icon }} {{ clockState?.periodInfo?.name }}
            </span>
            <span class="clock-running">
              {{ clockState?.isRunning ? '▶ 流逝中 ' + (clockState?.speed || 1) + 'x' : '⏸ 已暂停' }}
            </span>
          </div>
        </div>

        <!-- 歌单检索区 -->
        <div class="section section-playlist">
          <div class="section-title">🎶 L3 区域歌单</div>
          <!-- 国度筛选标签 -->
          <div class="nation-tabs">
            <button
              v-for="n in nations"
              :key="n"
              class="nation-tab"
              :class="{ active: activeNation === n }"
              :style="activeNation === n ? { borderColor: nationColor(n), color: nationColor(n) } : {}"
              @click="activeNation = n"
            >{{ n }}</button>
          </div>
          <!-- 区域列表 -->
          <div class="region-list">
            <div
              v-for="region in filteredRegions"
              :key="region.id"
              class="region-item"
              :class="{
                active: currentRegion?.id === region.id,
                disabled: !hasBgm(region)
              }"
              @click="hasBgm(region) && $emit('region-select', region)"
            >
              <span class="region-dot" :style="{ background: nationColor(region.nation) }"></span>
              <span class="region-label">
                <span v-if="region.parentName" class="region-parent">{{ region.parentName }}</span>
                <span class="region-name">{{ region.name }}</span>
              </span>
              <span class="region-status">{{ hasBgm(region) ? region.nation : '暂无专属曲目' }}</span>
              <span v-if="currentRegion?.id === region.id" class="playing-icon">🔊</span>
            </div>
            <div v-if="filteredRegions.length === 0" class="empty-hint">该国度暂无区域数据</div>
          </div>
        </div>
      </div>

      <!-- 版权说明 -->
      <div class="sidebar-footer">
        <span>个人学习·非商用</span>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, computed } from 'vue'
import { NATION_COLORS } from '../data/config.js'

const props = defineProps({
  regions: { type: Array, default: () => [] },
  currentLayer: { type: String, default: 'surface' },
  currentRegion: { type: Object, default: null },
  clockState: { type: Object, default: () => ({}) },
  sidebarOpen: { type: Boolean, default: true }
})

defineEmits(['layer-change', 'reset-view', 'region-select', 'toggle-sidebar'])

const layers = [
  { id: 'surface', name: '地表', icon: '🗺️' },
  { id: 'underground', name: '地下', icon: '⛏️' },
  { id: 'underwater', name: '水下', icon: '🌊' }
]

const nations = ['全部', '蒙德', '璃月', '稻妻', '须弥', '枫丹', '纳塔']
const activeNation = ref('全部')

const filteredRegions = computed(() => {
  if (!props.regions) return []
  if (activeNation.value === '全部') return props.regions
  return props.regions.filter(r => r.nation === activeNation.value)
})

function hasBgm(region) {
  if (!region?.bgm) return false
  return Object.values(region.bgm).some(b => b && b.file)
}

function nationColor(nation) {
  return NATION_COLORS[nation] || '#d4a843'
}
</script>

<style scoped>
.sidebar {
  position: absolute;
  top: 0; left: 0;
  width: 280px;
  height: 100%;
  background: rgba(22, 33, 62, 0.92);
  backdrop-filter: blur(12px);
  border-radius: 0 8px 8px 0;
  box-shadow: 4px 0 20px rgba(0,0,0,0.5);
  display: flex;
  flex-direction: column;
  z-index: 1000;
}

.sidebar-collapsed {
  position: absolute;
  top: 16px; left: 16px;
  width: 44px; height: 44px;
  background: rgba(22, 33, 62, 0.92);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 1000;
  box-shadow: 0 2px 10px rgba(0,0,0,0.4);
  transition: background 0.2s;
}
.sidebar-collapsed:hover { background: rgba(30, 45, 80, 0.95); }
.collapse-icon { font-size: 20px; color: #d4a843; }

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(212, 168, 67, 0.2);
  flex-shrink: 0;
}
.sidebar-title {
  font-size: 15px;
  font-weight: 600;
  color: #d4a843;
}
.btn-collapse {
  background: none;
  border: none;
  color: #a0a0b0;
  font-size: 16px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}
.btn-collapse:hover { color: #e0e0e0; background: rgba(255,255,255,0.1); }

.sidebar-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 14px;
}

.section {
  margin-bottom: 20px;
}
.section-title {
  font-size: 13px;
  font-weight: 600;
  color: #a0a0b0;
  margin-bottom: 10px;
  text-transform: uppercase;
  letter-spacing: 1px;
}
.section-playlist {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* 分层按钮 */
.layer-buttons {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
}
.layer-btn {
  flex: 1;
  padding: 8px 4px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 6px;
  color: #a0a0b0;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.layer-btn:hover { background: rgba(255,255,255,0.1); color: #e0e0e0; }
.layer-btn.active {
  background: rgba(212, 168, 67, 0.15);
  border-color: #d4a843;
  color: #d4a843;
}
.btn-reset {
  width: 100%;
  padding: 8px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 6px;
  color: #a0a0b0;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-reset:hover { background: rgba(255,255,255,0.1); color: #e0e0e0; }

/* 时钟状态 */
.clock-status {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  background: rgba(0,0,0,0.2);
  border-radius: 6px;
}
.clock-time {
  font-size: 28px;
  font-weight: 700;
  font-family: 'Courier New', monospace;
}
.clock-period {
  font-size: 14px;
  color: #e0e0e0;
}
.clock-running {
  font-size: 12px;
  color: #a0a0b0;
}

/* 国度筛选 */
.nation-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 10px;
}
.nation-tab {
  padding: 4px 10px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px;
  color: #a0a0b0;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.nation-tab:hover { background: rgba(255,255,255,0.1); }
.nation-tab.active {
  background: rgba(255,255,255,0.08);
}

/* 区域列表 */
.region-list {
  max-height: 400px;
  overflow-y: auto;
}
.region-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}
.region-item:hover { background: rgba(255,255,255,0.08); }
.region-item.active { background: rgba(212, 168, 67, 0.12); }
.region-item.disabled { opacity: 0.4; cursor: default; }
.region-item.disabled:hover { background: none; }

.region-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.region-label {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.region-parent {
  font-size: 10px;
  color: #747486;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.region-name {
  font-size: 13px;
  color: #e0e0e0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.region-status {
  font-size: 11px;
  color: #a0a0b0;
  max-width: 72px;
  text-align: right;
}
.playing-icon {
  font-size: 14px;
  animation: pulse 1.5s infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.empty-hint {
  padding: 20px;
  text-align: center;
  color: #a0a0b0;
  font-size: 13px;
}

/* 底部 */
.sidebar-footer {
  padding: 8px 16px;
  border-top: 1px solid rgba(212, 168, 67, 0.15);
  text-align: center;
  font-size: 11px;
  color: #606070;
  flex-shrink: 0;
}

/* 滑入动画 */
.slide-enter-active, .slide-leave-active {
  transition: transform 0.3s ease;
}
.slide-enter-from, .slide-leave-to {
  transform: translateX(-100%);
}
</style>
