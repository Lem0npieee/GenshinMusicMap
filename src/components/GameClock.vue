<template>
  <div class="clock-overlay" :class="{ 'ui-hidden': uiHidden }">
    <button
      class="visibility-toggle"
      type="button"
      :title="uiHidden ? '显示游戏时钟' : '隐藏游戏时钟'"
      :aria-label="uiHidden ? '显示游戏时钟' : '隐藏游戏时钟'"
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

    <div v-show="!uiHidden" class="game-clock" :class="period">
    <!-- 时钟圆盘 -->
    <div class="clock-dial">
      <!-- 天空半圆（上） -->
      <div class="sky-semicircle" :style="skyStyle"></div>
      <!-- 地面半圆（下） -->
      <div class="ground-semicircle"></div>
      <!-- 时间刻度 -->
      <div class="hour-marks">
        <span v-for="h in 24" :key="h" class="mark" :style="markStyle(h - 1)"></span>
      </div>
      <!-- 指针 -->
      <div class="hand" :style="handStyle"></div>
      <!-- 中心点 -->
      <div class="center-dot"></div>
      <!-- 中央数字显示 -->
      <div class="time-display">
        <div class="time-text">{{ timeString }}</div>
        <div class="period-label">
          <span class="period-icon">{{ periodInfo?.icon }}</span>
          <span class="period-name">{{ periodInfo?.name }}</span>
        </div>
      </div>
    </div>

    <!-- 控制区 -->
    <div class="clock-controls">
      <button class="ctrl-btn play-btn" @click="$emit('toggle-play')">
        {{ isRunning ? '⏸' : '▶' }}
      </button>
      <div class="speed-group">
        <button
          v-for="s in [1, 2, 4, 8]"
          :key="s"
          class="ctrl-btn speed-btn"
          :class="{ active: speed === s }"
          @click="$emit('set-speed', s)"
        >{{ s }}x</button>
      </div>
    </div>

    <!-- 时间滑块 -->
    <div class="time-slider">
      <input
        type="range"
        min="0"
        max="23.99"
        step="0.25"
        :value="time"
        @input="$emit('set-time', parseFloat($event.target.value))"
      />
      <div class="slider-labels">
        <span>00</span><span>06</span><span>12</span><span>18</span><span>24</span>
      </div>
    </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  time: { type: Number, default: 8 },
  timeString: { type: String, default: '08:00' },
  period: { type: String, default: 'day' },
  periodInfo: { type: Object, default: () => ({}) },
  isRunning: { type: Boolean, default: false },
  speed: { type: Number, default: 1 }
})

defineEmits(['toggle-play', 'set-time', 'set-speed'])
const uiHidden = ref(false)

// 天空渐变样式（随时段变化）
const skyStyle = computed(() => {
  const gradients = {
    dawn:  'linear-gradient(180deg, #1a1a3e 0%, #f9c270 100%)',
    day:   'linear-gradient(180deg, #4a90d9 0%, #7ec0ee 100%)',
    dusk:  'linear-gradient(180deg, #2a1a4e 0%, #e88c30 100%)',
    night: 'linear-gradient(180deg, #0a0a2e 0%, #4a5291 100%)'
  }
  return { background: gradients[props.period] || gradients.day }
})

// 指针角度：0点=顶部，顺时针
const handStyle = computed(() => {
  const angle = (props.time / 24) * 360
  return { transform: `translateX(-50%) rotate(${angle}deg)` }
})

// 刻度位置
function markStyle(h) {
  const angle = (h / 24) * 360
  return { transform: `rotate(${angle}deg) translateY(-96px)` }
}
</script>

<style scoped>
.clock-overlay {
  position: fixed;
  bottom: 20px;
  right: 28px;
  z-index: 1000;
  width: min(380px, calc(100vw - 36px));
  min-height: 340px;
  pointer-events: none;
}

.game-clock {
  box-sizing: border-box;
  width: 100%;
  background: transparent;
  border: 0;
  border-radius: 0;
  padding: 12px 0 0;
  box-shadow: none;
  backdrop-filter: none;
  pointer-events: auto;
}

.visibility-toggle {
  position: absolute;
  top: 0;
  right: 0;
  width: 32px;
  height: 32px;
  padding: 0;
  display: grid;
  place-items: center;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(8, 13, 30, 0.45);
  color: #e6e8ef;
  cursor: pointer;
  z-index: 10;
  pointer-events: auto;
  transition: all 0.2s;
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

/* 时钟圆盘 */
.clock-dial {
  position: relative;
  width: 210px;
  height: 210px;
  margin: 0 auto 16px;
  border-radius: 50%;
  overflow: hidden;
  border: 3px solid rgba(212, 168, 67, 0.4);
  box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.3);
}

.sky-semicircle {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 50%;
  transition: background 1s ease;
}

.ground-semicircle {
  position: absolute;
  bottom: 0; left: 0;
  width: 100%; height: 50%;
  background: linear-gradient(180deg, #2a2a3e 0%, #1a1a2e 100%);
}

/* 刻度 */
.hour-marks {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  pointer-events: none;
}
.mark {
  position: absolute;
  top: 50%; left: 50%;
  width: 2px; height: 6px;
  background: rgba(212, 168, 67, 0.3);
  transform-origin: center 0;
}
.mark:nth-child(6n+1) {
  height: 10px;
  background: rgba(212, 168, 67, 0.6);
}

/* 指针 */
.hand {
  position: absolute;
  top: auto;
  bottom: 50%;
  left: 50%;
  width: 3px;
  height: 42%;
  background: linear-gradient(180deg, #d4a843 0%, #e8be5a 100%);
  transform-origin: bottom center;
  border-radius: 2px;
  box-shadow: 0 0 6px rgba(212, 168, 67, 0.6);
  transition: transform 0.5s ease;
  z-index: 5;
}

.center-dot {
  position: absolute;
  top: 50%; left: 50%;
  width: 10px; height: 10px;
  background: #d4a843;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  z-index: 6;
  box-shadow: 0 0 8px rgba(212, 168, 67, 0.8);
}

/* 中央时间显示 */
.time-display {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  z-index: 7;
  pointer-events: none;
  margin-top: 20px;
}
.time-text {
  font-size: 22px;
  font-weight: bold;
  color: #fff;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
  letter-spacing: 1px;
}
.period-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
  margin-top: 2px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
}
.period-icon { margin-right: 3px; }

/* 控制区 */
.clock-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  margin-bottom: 14px;
}
.ctrl-btn {
  background: rgba(212, 168, 67, 0.15);
  border: 1px solid rgba(212, 168, 67, 0.3);
  color: #e0e0e0;
  border-radius: 6px;
  padding: 5px 10px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}
.ctrl-btn:hover {
  background: rgba(212, 168, 67, 0.3);
  border-color: #d4a843;
}
.ctrl-btn.active {
  background: #d4a843;
  color: #1a1a2e;
  font-weight: bold;
}
.play-btn {
  width: 36px; height: 36px;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.speed-group {
  display: flex;
  gap: 4px;
}
.speed-btn {
  padding: 5px 8px;
  font-size: 12px;
}

/* 时间滑块 */
.time-slider input[type="range"] {
  width: 100%;
  height: 6px;
  -webkit-appearance: none;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  outline: none;
}

@media (max-width: 640px) {
  .clock-overlay {
    right: 12px;
    bottom: 10px;
    width: min(340px, calc(100vw - 24px));
    min-height: 320px;
  }
}
.time-slider input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px; height: 14px;
  background: #d4a843;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 0 4px rgba(212, 168, 67, 0.6);
}
.slider-labels {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 4px;
}
</style>
