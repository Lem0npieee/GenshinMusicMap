<template>
  <Transition name="player-fade">
    <div v-if="visible && region" class="player-overlay">
      <div class="player-panel">
        <!-- 关闭按钮 -->
        <button class="close-btn" @click="$emit('close')" title="关闭播放器">×</button>

        <!-- 唱片封面 -->
        <div class="disc-section">
          <div class="disc-wrapper">
            <div
              class="disc"
              :class="{ spinning: isPlaying && !isLoading, loading: isLoading }"
            >
              <img
                v-if="currentBgm && currentBgm.cover"
                :src="currentBgm.cover"
                class="disc-cover"
                alt="封面"
                @error="onCoverError"
              />
              <div v-else class="disc-placeholder">🎵</div>
              <!-- 唱片中心孔 -->
              <div class="disc-center-hole"></div>
            </div>
            <!-- 唱针 -->
            <div class="tone-arm" :class="{ playing: isPlaying && !isLoading }">
              <div class="tone-arm-needle"></div>
            </div>
          </div>
        </div>

        <!-- 信息展示 -->
        <div class="info-section">
          <div class="track-name">
            {{ currentBgm && currentBgm.title ? currentBgm.title : '未知曲目' }}
          </div>
          <div class="track-meta">
            <span class="region-name">{{ region.name }}</span>
            <span class="separator">·</span>
            <span class="nation-name">{{ region.nation }}</span>
          </div>
          <div class="period-tag" :style="{ '--period-color': periodColor }">
            <span class="period-icon">{{ periodIcon }}</span>
            <span>{{ periodName }}</span>
          </div>
        </div>

        <!-- 加载状态 -->
        <div v-if="isLoading" class="loading-bar">
          <div class="loading-dot"></div>
          <div class="loading-dot"></div>
          <div class="loading-dot"></div>
          <span class="loading-text">加载中...</span>
        </div>

        <!-- 播放控件 -->
        <div class="controls-section">
          <button class="play-btn" @click="$emit('toggle-play')" :disabled="isLoading">
            <span v-if="isLoading">⏳</span>
            <span v-else-if="isPlaying">⏸</span>
            <span v-else>▶</span>
          </button>
        </div>

        <!-- 音量与循环 -->
        <div class="bottom-controls">
          <div class="volume-group">
            <span class="volume-icon">🔊</span>
            <input
              type="range"
              min="0"
              max="100"
              :value="Math.round(volume * 100)"
              @input="$emit('set-volume', $event.target.value / 100)"
              class="volume-slider"
            />
          </div>
          <button
            class="loop-btn"
            :class="{ active: isLooping }"
            @click="$emit('toggle-loop')"
            :title="isLooping ? '单曲循环: 开' : '单曲循环: 关'"
          >
            <span v-if="isLooping">🔁✓</span>
            <span v-else>🔁</span>
          </button>
          <button class="reload-btn" @click="$emit('reload')" title="重新加载" :disabled="isLoading">
            🔄
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { computed } from 'vue'
import { TIME_PERIODS } from '../data/config.js'

const props = defineProps({
  visible: Boolean,
  region: Object,
  period: String,
  isPlaying: Boolean,
  volume: { type: Number, default: 0.7 },
  isLooping: Boolean,
  isLoading: Boolean
})

const emit = defineEmits(['close', 'toggle-play', 'set-volume', 'toggle-loop', 'reload'])

const currentBgm = computed(() => {
  if (!props.region || !props.region.bgm) return null
  return props.region.bgm[props.period] || null
})

const periodInfo = computed(() => TIME_PERIODS[props.period] || TIME_PERIODS.day)
const periodName = computed(() => periodInfo.value.name)
const periodColor = computed(() => periodInfo.value.color)
const periodIcon = computed(() => periodInfo.value.icon)

function onCoverError(e) {
  e.target.style.display = 'none'
}
</script>

<style scoped>
.player-overlay {
  position: fixed;
  bottom: 120px;
  right: 24px;
  z-index: 1000;
}

.player-panel {
  position: relative;
  width: 280px;
  background: rgba(22, 33, 62, 0.95);
  border: 1px solid rgba(212, 168, 67, 0.3);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  backdrop-filter: blur(10px);
}

/* 关闭按钮 */
.close-btn {
  position: absolute;
  top: 8px;
  right: 10px;
  background: none;
  border: none;
  color: #a0a0b0;
  font-size: 22px;
  cursor: pointer;
  line-height: 1;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}
.close-btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}

/* 唱片区域 */
.disc-section {
  margin-top: 8px;
}
.disc-wrapper {
  position: relative;
  width: 140px;
  height: 140px;
}
.disc {
  width: 140px;
  height: 140px;
  border-radius: 50%;
  background: radial-gradient(circle at center, #2a2a4a 0%, #1a1a2e 60%, #0a0a1a 100%);
  border: 3px solid #333;
  box-shadow: 0 4px 16px rgba(0,0,0,0.5), inset 0 0 20px rgba(0,0,0,0.6);
  overflow: hidden;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}
.disc.spinning {
  animation: spin 4s linear infinite;
}
.disc.loading {
  animation: pulse 1s ease-in-out infinite;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

.disc-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}
.disc-placeholder {
  font-size: 48px;
  opacity: 0.6;
}

/* 唱片中心孔 */
.disc-center-hole {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--accent, #d4a843);
  border: 2px solid #333;
  z-index: 2;
}

/* 唱针 */
.tone-arm {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 50px;
  height: 70px;
  transform-origin: top right;
  transform: rotate(-25deg);
  transition: transform 0.5s ease;
  z-index: 3;
  pointer-events: none;
}
.tone-arm.playing {
  transform: rotate(5deg);
}
.tone-arm::before {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 50px;
  height: 6px;
  background: linear-gradient(to right, #888, #ccc);
  border-radius: 3px;
}
.tone-arm-needle {
  position: absolute;
  bottom: 0;
  right: 2px;
  width: 8px;
  height: 14px;
  background: #aaa;
  border-radius: 0 0 4px 4px;
}

/* 信息区域 */
.info-section {
  text-align: center;
  width: 100%;
}
.track-name {
  font-size: 15px;
  font-weight: 600;
  color: #e0e0e0;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.track-meta {
  font-size: 12px;
  color: #a0a0b0;
  margin-bottom: 6px;
}
.region-name { font-weight: 500; }
.separator { margin: 0 4px; }
.nation-name { color: var(--period-color, #d4a843); }
.period-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.08);
  color: var(--period-color, #d4a843);
  border: 1px solid var(--period-color, #d4a843);
  border-opacity: 0.3;
}

/* 加载状态 */
.loading-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #a0a0b0;
}
.loading-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #d4a843;
  animation: dot-bounce 1.4s ease-in-out infinite;
}
.loading-dot:nth-child(2) { animation-delay: 0.2s; }
.loading-dot:nth-child(3) { animation-delay: 0.4s; }
.loading-text { margin-left: 4px; }
@keyframes dot-bounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
  40% { transform: scale(1); opacity: 1; }
}

/* 播放控件 */
.controls-section {
  display: flex;
  justify-content: center;
}
.play-btn {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 2px solid #d4a843;
  background: rgba(212, 168, 67, 0.15);
  color: #d4a843;
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
.play-btn:hover:not(:disabled) {
  background: rgba(212, 168, 67, 0.3);
  transform: scale(1.05);
}
.play-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 底部控件 */
.bottom-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}
.volume-group {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
}
.volume-icon {
  font-size: 14px;
  opacity: 0.7;
}
.volume-slider {
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: rgba(255,255,255,0.1);
  border-radius: 2px;
  outline: none;
}
.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #d4a843;
  cursor: pointer;
}
.volume-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #d4a843;
  cursor: pointer;
  border: none;
}
.loop-btn, .reload-btn {
  background: none;
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}
.loop-btn:hover, .reload-btn:hover {
  background: rgba(255,255,255,0.08);
}
.loop-btn.active {
  border-color: #d4a843;
  color: #d4a843;
}
.reload-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* 过渡动画 */
.player-fade-enter-active, .player-fade-leave-active {
  transition: all 0.3s ease;
}
.player-fade-enter-from {
  opacity: 0;
  transform: translateY(20px);
}
.player-fade-leave-to {
  opacity: 0;
  transform: translateY(20px);
}
</style>
