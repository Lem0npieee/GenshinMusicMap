import { STORAGE_KEYS } from '../data/config.js'

export function useStorage() {
  function get(key, defaultValue = null) {
    try {
      const val = localStorage.getItem(key)
      return val !== null ? JSON.parse(val) : defaultValue
    } catch { return defaultValue }
  }
  function set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
  }
  function getVolume() { return get(STORAGE_KEYS.VOLUME, 0.7) }
  function setVolume(v) { set(STORAGE_KEYS.VOLUME, v) }
  function getClockSpeed() { return get(STORAGE_KEYS.CLOCK_SPEED, 1) }
  function setClockSpeed(s) { set(STORAGE_KEYS.CLOCK_SPEED, s) }
  function getClockRunning() { return get(STORAGE_KEYS.CLOCK_RUNNING, false) }
  function setClockRunning(r) { set(STORAGE_KEYS.CLOCK_RUNNING, r) }
  function getLayer() { return get(STORAGE_KEYS.LAYER, 'surface') }
  function setLayer(l) { set(STORAGE_KEYS.LAYER, l) }
  return { get, set, getVolume, setVolume, getClockSpeed, setClockSpeed, getClockRunning, setClockRunning, getLayer, setLayer }
}
