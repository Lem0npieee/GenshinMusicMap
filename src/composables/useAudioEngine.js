import { ref } from 'vue'

// 全局单例音频引擎
let audioCtx = null
let gainNode = null
let currentSource = null
let preloadBuffer = null
const FADE_MS = 800

export const isPlaying = ref(false)
export const currentRegion = ref(null)
export const currentPeriod = ref(null)
export const volume = ref(0.7)
export const isLooping = ref(true)
export const isLoading = ref(false)

export function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    gainNode = audioCtx.createGain()
    gainNode.gain.value = volume.value
    gainNode.connect(audioCtx.destination)
  }
  if (audioCtx.state === 'suspended') audioCtx.resume()
}

async function loadAudio(url) {
  const res = await fetch(url)
  const arr = await res.arrayBuffer()
  return await audioCtx.decodeAudioData(arr)
}

function stopCurrent(fade = true) {
  if (!currentSource) return
  const old = currentSource
  if (fade && audioCtx) {
    const t = audioCtx.currentTime
    gainNode.gain.cancelScheduledValues(t)
    gainNode.gain.setValueAtTime(gainNode.gain.value, t)
    gainNode.gain.linearRampToValueAtTime(0, t + FADE_MS / 1000)
    setTimeout(() => { try { old.stop() } catch {} }, FADE_MS + 50)
  } else {
    try { old.stop() } catch {}
  }
  currentSource = null
}

function playBuffer(buffer, region, period) {
  if (!audioCtx) return
  stopCurrent()
  const src = audioCtx.createBufferSource()
  src.buffer = buffer
  src.loop = isLooping.value
  src.connect(gainNode)
  const t = audioCtx.currentTime
  gainNode.gain.cancelScheduledValues(t)
  gainNode.gain.setValueAtTime(0, t)
  gainNode.gain.linearRampToValueAtTime(volume.value, t + FADE_MS / 1000)
  src.start()
  currentSource = src
  currentRegion.value = region
  currentPeriod.value = period
  isPlaying.value = true
  src.onended = () => {
    if (currentSource === src) isPlaying.value = false
  }
}

export async function playRegion(region, period) {
  if (!region || !region.bgm || !region.bgm[period]) return
  const info = region.bgm[period]
  if (!info.file) return
  initAudio()
  // 同区域同时段已在播放则跳过
  if (currentRegion.value?.id === region.id && currentPeriod.value === period && isPlaying.value) return
  isLoading.value = true
  try {
    const buf = await loadAudio(info.file)
    playBuffer(buf, region, period)
  } catch (e) {
    console.error('音频加载失败:', info.file, e)
  }
  isLoading.value = false
}

export function pause() {
  if (audioCtx && currentSource) {
    audioCtx.suspend()
    isPlaying.value = false
  }
}

export function resume() {
  if (audioCtx && currentSource) {
    audioCtx.resume()
    isPlaying.value = true
  }
}

export function togglePlay() {
  if (isPlaying.value) pause()
  else resume()
}

export function setVolume(v) {
  volume.value = v
  if (gainNode && audioCtx) {
    const t = audioCtx.currentTime
    gainNode.gain.cancelScheduledValues(t)
    gainNode.gain.linearRampToValueAtTime(v, t + 0.1)
  }
}

export function toggleLoop() {
  isLooping.value = !isLooping.value
  if (currentSource) currentSource.loop = isLooping.value
}

export async function reload() {
  if (!currentRegion.value || !currentPeriod.value) return
  const r = currentRegion.value
  const p = currentPeriod.value
  await playRegion(r, p)
}

// 切换时段（时钟联动），使用预加载优化
export async function switchPeriod(period) {
  if (!currentRegion.value) return
  const r = currentRegion.value
  if (currentPeriod.value === period) return
  await playRegion(r, period)
}

// 预加载区域音频
export async function preloadRegion(region) {
  if (!region?.bgm) return
  initAudio()
  const periods = ['dawn', 'day', 'dusk', 'night']
  for (const p of periods) {
    const info = region.bgm[p]
    if (info?.file && !preloadBuffer?.[region.id + '_' + p]) {
      try {
        const buf = await loadAudio(info.file)
        preloadBuffer = preloadBuffer || {}
        preloadBuffer[region.id + '_' + p] = buf
      } catch {}
    }
  }
}
