<template>
  <div class="game-clock" :class="period">
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
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  time: { type: Number, default: 8 },
  timeString: { type: String, default: '08:00' },
  period: { type: String, default: 'day' },
  periodInfo: { type: Object, default: () => ({}) },
  isRunning: { type: Boolean, default: false },
  speed: { type: Number, default: 1 }
})

defineEmits(['toggle-play', 'set-time', 'set-speed'])

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
  return { transform: `rotate(${angle}deg) translateY(-48px)` }
}
</script>

<style scoped>
.game-clock {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 1000;
  background: rgba(22, 33, 62, 0.92);
  border: 1px solid rgba(212, 168, 67, 0.3);
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  width: 240px;
  backdrop-filter: blur(8px);
}

/* 时钟圆盘 */
.clock-dial {
  position: relative;
  width: 180px;
  height: 180px;
  margin: 0 auto 12px;
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
  top: 50%; left: 50%;
  width: 3px; height: 42%;
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
  margin-bottom: 10px;
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
