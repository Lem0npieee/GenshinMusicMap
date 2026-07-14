<template>
  <Transition name="player-fade">
    <div v-if="visible && region" class="player-overlay" :class="{ 'ui-hidden': uiHidden }">
      <button
        class="visibility-toggle"
        type="button"
        :title="uiHidden ? '显示播放器' : '隐藏播放器'"
        :aria-label="uiHidden ? '显示播放器' : '隐藏播放器'"
        @click="uiHidden = !uiHidden"
      >
        <svg v-if="!uiHidden" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M2.5 12s3.4-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.4 6.5-9.5 6.5S2.5 12 2.5 12Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        <svg v-else viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 3l18 18" />
          <path d="M10.6 5.7A10.8 10.8 0 0 1 12 5.5c6.1 0 9.5 6.5 9.5 6.5a15 15 0 0 1-2.7 3.5M6.2 6.3C3.8 8.2 2.5 12 2.5 12s3.4 6.5 9.5 6.5a9.7 9.7 0 0 0 3.1-.5" />
        </svg>
      </button>

      <div v-show="!uiHidden" class="player-panel">

        <!-- 唱片封面 -->
        <div class="disc-section">
          <div class="disc-wrapper">
            <div
              ref="discRef"
              class="disc"
              :class="{ loading: isLoading && !isEmbedded }"
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
            <div class="tone-arm" :class="{ playing: discIsPlaying }">
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

        <div v-if="audioError && !isEmbedded" class="audio-error">
          <span>{{ audioError }}</span>
        </div>

        <!-- 网易云官方站外播放器：留在当前页面内播放。 -->
        <div v-if="isEmbedded" class="embedded-player">
          <iframe
            :key="autoplayEmbedUrl"
            :src="autoplayEmbedUrl"
            width="100%"
            height="96"
            frameborder="0"
            allow="autoplay; encrypted-media"
            sandbox="allow-scripts allow-same-origin"
            referrerpolicy="no-referrer"
            title="网易云音乐播放器"
            @load="onEmbeddedLoad"
          ></iframe>
        </div>

        <!-- 本地文件或媒体直链使用项目自带播放控件。 -->
        <div v-else class="controls-section">
          <button class="play-btn" @click="$emit('toggle-play')" :disabled="isLoading">
            <span v-if="isLoading">⏳</span>
            <span v-else-if="isPlaying">⏸</span>
            <span v-else>▶</span>
          </button>
        </div>

        <!-- 音量与循环 -->
        <div v-if="!isEmbedded" class="bottom-controls">
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { TIME_PERIODS } from '../data/config.js'

const props = defineProps({
  visible: Boolean,
  region: Object,
  period: String,
  isPlaying: Boolean,
  volume: { type: Number, default: 0.7 },
  isLooping: Boolean,
  isLoading: Boolean,
  audioError: { type: String, default: '' }
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
const isEmbedded = computed(() => Boolean(currentBgm.value?.embedUrl && !currentBgm.value?.streamUrl))
const embeddedReady = ref(false)
const discRef = ref(null)
const uiHidden = ref(false)
let discAngle = 0
let discSpeed = 0
let discFrame = 0
let lastFrameTime = 0
const targetDiscSpeed = 360 / 40000
const autoplayEmbedUrl = computed(() => {
  const url = currentBgm.value?.embedUrl || ''
  if (!url) return ''
  if (/([?&])auto=\d/.test(url)) return url.replace(/([?&])auto=\d/, '$1auto=1')
  return `${url}${url.includes('?') ? '&' : '?'}auto=1`
})
const discIsPlaying = computed(() => (
  isEmbedded.value
    ? embeddedReady.value
    : props.isPlaying && !props.isLoading
))

function updateDiscFrame(now) {
  const delta = lastFrameTime ? Math.min(now - lastFrameTime, 50) : 16
  lastFrameTime = now
  const target = discIsPlaying.value ? targetDiscSpeed : 0
  const rampDuration = target > discSpeed ? 2200 : 3000
  const maxChange = targetDiscSpeed * delta / rampDuration

  if (discSpeed < target) discSpeed = Math.min(target, discSpeed + maxChange)
  else if (discSpeed > target) discSpeed = Math.max(target, discSpeed - maxChange)

  discAngle = (discAngle + discSpeed * delta) % 360
  if (discRef.value) discRef.value.style.transform = `rotate(${discAngle}deg)`

  if (discSpeed > 0.00001 || target > 0) {
    discFrame = requestAnimationFrame(updateDiscFrame)
  } else {
    discFrame = 0
    lastFrameTime = 0
  }
}

function startDiscMotion() {
  if (discFrame) return
  lastFrameTime = 0
  discFrame = requestAnimationFrame(updateDiscFrame)
}

watch(autoplayEmbedUrl, () => {
  embeddedReady.value = false
})

watch(discIsPlaying, () => {
  startDiscMotion()
})

watch(discRef, async element => {
  if (!element) return
  await nextTick()
  element.style.transform = `rotate(${discAngle}deg)`
  startDiscMotion()
})

onMounted(() => {
  startDiscMotion()
})

onBeforeUnmount(() => {
  if (discFrame) cancelAnimationFrame(discFrame)
})

function onEmbeddedLoad() {
  embeddedReady.value = true
}

function onCoverError(e) {
  e.target.style.display = 'none'
}
</script>

<style scoped>
.player-overlay {
  position: fixed;
  top: 22px;
  right: 28px;
  width: min(380px, calc(100vw - 36px));
  z-index: 1000;
  pointer-events: none;
}

.player-panel {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  background: transparent;
  border: 0;
  box-shadow: none;
  padding: 12px 0 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 17px;
  pointer-events: auto;
}

/* 显示/隐藏按钮 */
.visibility-toggle {
  position: absolute;
  top: 0;
  right: 0;
  width: 32px;
  height: 32px;
  background: rgba(8, 13, 30, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #e6e8ef;
  font-size: 24px;
  cursor: pointer;
  line-height: 1;
  padding: 0;
  border-radius: 50%;
  transition: all 0.2s;
  display: grid;
  place-items: center;
  z-index: 10;
  pointer-events: auto;
}
.visibility-toggle svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.visibility-toggle:hover {
  color: #fff;
  background: rgba(8, 13, 30, 0.75);
  border-color: rgba(212, 168, 67, 0.7);
}

/* 唱片区域 */
.disc-section {
  margin-top: 2px;
}
.disc-wrapper {
  position: relative;
  width: 210px;
  height: 210px;
}
.disc {
  width: 210px;
  height: 210px;
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
.disc.loading {
  animation: pulse 1s ease-in-out infinite;
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
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--accent, #d4a843);
  border: 2px solid #333;
  z-index: 2;
}

/* 唱针 */
.tone-arm {
  position: absolute;
  top: -10px;
  right: -13px;
  width: 72px;
  height: 100px;
  transform-origin: top right;
  transform: rotate(-25deg);
  transition: transform 0.85s cubic-bezier(0.22, 1, 0.36, 1);
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
  width: 72px;
  height: 7px;
  background: linear-gradient(90deg, #fff2b0 0%, #f1bd4f 55%, #fff8d5 100%);
  border-radius: 3px;
  border: 1px solid rgba(76, 42, 0, 0.75);
  box-shadow: 0 2px 8px rgba(255, 200, 74, 0.7), 0 0 2px #fff;
}
.tone-arm-needle {
  position: absolute;
  bottom: 0;
  right: 2px;
  width: 10px;
  height: 18px;
  background: linear-gradient(180deg, #ffb18b, #ff574d);
  border-radius: 0 0 4px 4px;
  border: 1px solid rgba(92, 15, 12, 0.8);
  box-shadow: 0 2px 8px rgba(255, 87, 77, 0.85);
}

/* 信息区域 */
.info-section {
  text-align: center;
  width: 100%;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.85);
}
.track-name {
  font-size: 19px;
  font-weight: 600;
  color: #e0e0e0;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.track-meta {
  font-size: 14px;
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
  font-size: 14px;
  padding: 5px 14px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.08);
  color: var(--period-color, #d4a843);
  border: 1px solid rgba(212, 168, 67, 0.4);
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

.audio-error {
  width: 100%;
  padding: 8px 10px;
  border-radius: 6px;
  background: rgba(255, 118, 117, 0.12);
  color: #ffb4af;
  font-size: 12px;
  line-height: 1.4;
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
.embedded-player {
  width: 100%;
  height: 96px;
  overflow: hidden;
  border-radius: 10px;
  background: transparent;
  filter: drop-shadow(0 5px 14px rgba(0, 0, 0, 0.38));
}
.embedded-player iframe {
  display: block;
  border: 0;
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
  transform: translateY(-18px);
}
.player-fade-leave-to {
  opacity: 0;
  transform: translateY(-18px);
}

@media (max-width: 640px) {
  .player-overlay {
    top: 10px;
    right: 12px;
    width: min(340px, calc(100vw - 24px));
  }
  .player-panel {
    width: 100%;
  }
  .disc-wrapper,
  .disc {
    width: 180px;
    height: 180px;
  }
}
</style>
