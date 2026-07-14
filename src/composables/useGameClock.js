import { ref, computed, onUnmounted } from 'vue'
import { getPeriod, TIME_PERIODS } from '../data/config.js'

export function useGameClock() {
  const time = ref(8.0)
  const isRunning = ref(false)
  const speed = ref(1)
  let timer = null
  let lastPeriod = getPeriod(8)
  const periodCallbacks = []

  const period = computed(() => getPeriod(Math.floor(time.value)))
  const periodInfo = computed(() => TIME_PERIODS[period.value])
  const hour = computed(() => Math.floor(time.value))
  const minute = computed(() => Math.floor((time.value % 1) * 60))
  const timeString = computed(() =>
    String(hour.value).padStart(2, '0') + ':' + String(minute.value).padStart(2, '0'))

  function notifyPeriodChange() {
    const p = period.value
    if (p !== lastPeriod) {
      lastPeriod = p
      periodCallbacks.forEach(cb => cb(p))
    }
  }

  function tick() {
    if (!isRunning.value) return
    // 现实1秒 = 游戏1分钟 × speed
    time.value += speed.value / 60
    if (time.value >= 24) time.value -= 24
    notifyPeriodChange()
  }

  function start() {
    if (timer) return
    isRunning.value = true
    timer = setInterval(tick, 1000)
  }
  function stop() {
    isRunning.value = false
    if (timer) { clearInterval(timer); timer = null }
  }
  function togglePlay() { isRunning.value ? stop() : start() }
  function setTime(t) {
    time.value = Math.max(0, Math.min(23.99, t))
    notifyPeriodChange()
  }
  function setSpeed(s) { speed.value = s }
  function onPeriodChange(cb) { periodCallbacks.push(cb) }

  onUnmounted(() => { if (timer) clearInterval(timer) })

  return {
    time, isRunning, speed, period, periodInfo, hour, minute, timeString,
    start, stop, togglePlay, setTime, setSpeed, onPeriodChange
  }
}
