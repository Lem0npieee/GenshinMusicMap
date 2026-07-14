import { ref } from 'vue'

const FADE_IN_MS = 600
const FADE_OUT_MS = 600
const CROSSFADE_MS = 1800

let currentAudio = null
let currentUrl = ''
let playbackCommandId = 0
const managedAudios = new Set()
const audioStates = new Map()

export const isPlaying = ref(false)
export const currentRegion = ref(null)
export const currentPeriod = ref(null)
export const volume = ref(0.7)
export const isLooping = ref(true)
export const isLoading = ref(false)
export const audioError = ref('')

export function initAudio() {
  // 保留为点击区域时的同步入口；真正的 Audio 会在 playRegion 中创建。
}

function resolveAudioUrl(url) {
  if (!url) return ''
  if (/^(https?:|data:|blob:)/i.test(url)) return url
  const base = import.meta.env.BASE_URL || '/'
  return `${base.replace(/\/$/, '')}/${url.replace(/^\.\//, '').replace(/^\//, '')}`
}

function getAudioUrl(info) {
  return info?.streamUrl || info?.onlineUrl || info?.url || info?.file || ''
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value))
}

function getAudioState(audio) {
  if (!audioStates.has(audio)) {
    audioStates.set(audio, { gain: 1, frame: 0, resolve: null })
  }
  return audioStates.get(audio)
}

function applyAudioVolume(audio) {
  const state = getAudioState(audio)
  audio.volume = clamp(volume.value * state.gain)
}

function cancelFade(audio) {
  const state = audioStates.get(audio)
  if (!state) return
  if (state.frame) cancelAnimationFrame(state.frame)
  state.frame = 0
  if (state.resolve) state.resolve(false)
  state.resolve = null
}

function fadeAudio(audio, targetGain, duration) {
  if (!audio) return Promise.resolve(false)
  cancelFade(audio)
  const state = getAudioState(audio)
  const startGain = state.gain
  const target = clamp(targetGain)

  if (duration <= 0 || Math.abs(startGain - target) < 0.0001) {
    state.gain = target
    applyAudioVolume(audio)
    return Promise.resolve(true)
  }

  return new Promise(resolve => {
    const startedAt = performance.now()
    state.resolve = resolve

    const step = now => {
      const progress = clamp((now - startedAt) / duration)
      const eased = 0.5 - Math.cos(Math.PI * progress) / 2
      state.gain = startGain + (target - startGain) * eased
      applyAudioVolume(audio)

      if (progress < 1) {
        state.frame = requestAnimationFrame(step)
        return
      }

      state.frame = 0
      state.resolve = null
      resolve(true)
    }

    state.frame = requestAnimationFrame(step)
  })
}

function disposeAudio(audio) {
  if (!audio) return
  cancelFade(audio)
  audio.onended = null
  audio.onerror = null
  audio.pause()
  audio.removeAttribute('src')
  audio.load()
  managedAudios.delete(audio)
  audioStates.delete(audio)
}

async function fadeOutAndDispose(audio, duration = CROSSFADE_MS) {
  const completed = await fadeAudio(audio, 0, duration)
  if (completed) disposeAudio(audio)
}

export async function playRegion(region, period, options = {}) {
  if (!region || !region.bgm || !region.bgm[period]) return
  const info = region.bgm[period]
  const url = getAudioUrl(info)
  if (!url) {
    currentRegion.value = region
    currentPeriod.value = period
    audioError.value = '当前时段暂无可播放音频源'
    await pause()
    return
  }

  const resolvedUrl = resolveAudioUrl(url)
  if (
    !options.force &&
    currentRegion.value?.id === region.id &&
    currentPeriod.value === period &&
    currentUrl === resolvedUrl &&
    isPlaying.value
  ) {
    return
  }

  const commandId = ++playbackCommandId
  isLoading.value = true
  audioError.value = ''

  const audio = new Audio(resolvedUrl)
  audio.preload = 'auto'
  audio.loop = isLooping.value
  managedAudios.add(audio)
  const state = getAudioState(audio)
  state.gain = 0
  applyAudioVolume(audio)

  audio.onended = () => {
    if (currentAudio === audio) isPlaying.value = false
  }
  audio.onerror = () => {
    if (currentAudio === audio) {
      isPlaying.value = false
      isLoading.value = false
      audioError.value = '音频加载失败，请检查在线音源是否可访问'
    }
  }

  try {
    await audio.play()
    if (commandId !== playbackCommandId) {
      disposeAudio(audio)
      return
    }

    const previousAudios = [...managedAudios].filter(item => item !== audio)
    currentAudio = audio
    currentUrl = resolvedUrl
    currentRegion.value = region
    currentPeriod.value = period
    isPlaying.value = true

    for (const previous of previousAudios) {
      void fadeOutAndDispose(previous, CROSSFADE_MS)
    }
    void fadeAudio(audio, 1, FADE_IN_MS)
  } catch (error) {
    console.error('音频播放失败:', resolvedUrl, error)
    disposeAudio(audio)
    if (commandId === playbackCommandId) {
      audioError.value = '浏览器无法播放该音频源'
      isPlaying.value = false
    }
  } finally {
    if (commandId === playbackCommandId) isLoading.value = false
  }
}

export async function pause() {
  const audio = currentAudio
  if (!audio) return
  const commandId = ++playbackCommandId
  isPlaying.value = false
  const completed = await fadeAudio(audio, 0, FADE_OUT_MS)
  if (completed && commandId === playbackCommandId && currentAudio === audio && !isPlaying.value) {
    audio.pause()
  }
}

export async function resume() {
  if (!currentAudio) {
    if (currentRegion.value && currentPeriod.value) {
      await playRegion(currentRegion.value, currentPeriod.value)
    }
    return
  }

  const audio = currentAudio
  const commandId = ++playbackCommandId
  try {
    await audio.play()
    if (commandId !== playbackCommandId || currentAudio !== audio) return
    isPlaying.value = true
    audioError.value = ''
    void fadeAudio(audio, 1, FADE_IN_MS)
  } catch (error) {
    console.error('恢复播放失败:', error)
    if (commandId === playbackCommandId) audioError.value = '浏览器无法恢复播放'
  }
}

export function togglePlay() {
  if (isPlaying.value) void pause()
  else void resume()
}

export function setVolume(value) {
  volume.value = clamp(value)
  for (const audio of managedAudios) applyAudioVolume(audio)
}

export function toggleLoop() {
  isLooping.value = !isLooping.value
  for (const audio of managedAudios) audio.loop = isLooping.value
}

export async function reload() {
  if (!currentRegion.value || !currentPeriod.value) return
  await playRegion(currentRegion.value, currentPeriod.value, { force: true })
}

export async function switchPeriod(period) {
  if (!currentRegion.value) return
  const region = currentRegion.value
  if (currentPeriod.value === period) return
  await playRegion(region, period)
}

export async function preloadRegion() {
  // 在线流式播放不预取整首音频，避免浪费带宽。
}
