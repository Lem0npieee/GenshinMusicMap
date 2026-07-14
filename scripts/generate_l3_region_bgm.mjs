import fs from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const regionsPath = path.join(root, 'public', 'data', 'regions.json')
const docDir = path.join(root, 'doc')
const reportPath = path.join(docDir, 'l3-region-audio-report.csv')
const noBoundaryReportPath = path.join(docDir, 'l3-mapping-locations-without-boundary.csv')

function normalize(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[「」『』“”"']/g, '')
    .replace(/[·・•\s]/g, '')
    .replace(/（.*?）/g, '')
}

function parseTrack(cell) {
  const match = String(cell || '').match(/^\[([^\]]+)\]\(([^)]+)\)$/)
  return match ? { title: match[1], fandomUrl: match[2] } : { title: '', fandomUrl: '' }
}

function classifyTime(value) {
  const time = String(value || '').toLowerCase()
  if (!time) return ['any']
  if (/day\s*(?:and|\/|、)\s*night|all (?:day|times)|any time/.test(time)) return ['dawn', 'day', 'dusk', 'night']

  const periods = []
  if (/dawn|sunrise|before dawn|early morning/.test(time)) periods.push('dawn')
  if (/\bday\b|daytime|noon|morning|sunny|clear sky/.test(time)) periods.push('day')
  if (/dusk|sunset|evening|eventide|twilight/.test(time)) periods.push('dusk')
  if (/night|midnight/.test(time)) periods.push('night')
  return periods.length ? [...new Set(periods)] : ['any']
}

function chooseBgm(rows, regionId) {
  const byPeriod = { dawn: [], day: [], dusk: [], night: [], any: [] }
  for (const row of rows) {
    if (/^Unnamed\b/i.test(row.trackTitle)) continue
    for (const period of classifyTime(row.time)) byPeriod[period].push(row)
  }

  const hasTimedRows = ['dawn', 'day', 'dusk', 'night'].some(period => byPeriod[period].length)
  const selected = {
    dawn: byPeriod.dawn[0] || byPeriod.day[0] || (!hasTimedRows ? byPeriod.any[0] : null),
    day: byPeriod.day[0] || (!hasTimedRows ? byPeriod.any[0] : null),
    dusk: byPeriod.dusk[0] || byPeriod.night[0] || (!hasTimedRows ? byPeriod.any[0] : null),
    night: byPeriod.night[0] || (!hasTimedRows ? byPeriod.any[0] : null)
  }

  return Object.fromEntries(Object.entries(selected).map(([period, row]) => [period, row ? {
    title: row.trackTitle,
    file: `audio/l3_${regionId}_${period}.mp3`,
    cover: `images/covers/${regionId}.jpg`,
    fandomUrl: row.fandomUrl,
    album: row.album,
    discNo: row.discNo
  } : {
    title: '',
    file: '',
    cover: `images/covers/${regionId}.jpg`
  }]))
}

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}

const markdownFiles = (await fs.readdir(docDir))
  .filter(name => name.endsWith('.md'))
  .map(name => ({ name, size: 0 }))
for (const item of markdownFiles) item.size = (await fs.stat(path.join(docDir, item.name))).size
markdownFiles.sort((a, b) => b.size - a.size)
if (!markdownFiles.length) throw new Error('No mapping markdown found in doc/')

const mappingPath = path.join(docDir, markdownFiles[0].name)
const markdown = await fs.readFile(mappingPath, 'utf8')
const mappingRows = []
for (const line of markdown.split(/\r?\n/)) {
  if (!line.startsWith('| ') || line.includes('---')) continue
  const cells = line.split('|').slice(1, -1).map(cell => cell.trim())
  if (cells.length < 9 || !cells[2].startsWith('[')) continue
  const track = parseTrack(cells[2])
  if (!track.title) continue
  mappingRows.push({
    sceneEn: cells[0],
    sceneZh: cells[1],
    trackTitle: track.title,
    fandomUrl: track.fandomUrl,
    locationEn: cells[3],
    locationZh: cells[4],
    time: cells[5],
    category: cells[6],
    album: cells[7],
    discNo: cells[8]
  })
}

const locations = new Map()
for (const row of mappingRows) {
  const key = normalize(row.locationZh)
  if (!key || key.startsWith('待补充')) continue
  if (!locations.has(key)) locations.set(key, [])
  locations.get(key).push(row)
}

function matchLocation(name) {
  const key = normalize(name)
  if (locations.has(key)) return { method: 'exact', locationKey: key, rows: locations.get(key) }

  const candidates = [...locations.entries()].filter(([locationKey]) => {
    const shortLength = Math.min(key.length, locationKey.length)
    const lengthGap = Math.abs(key.length - locationKey.length)
    return shortLength >= 4 && lengthGap <= 3 && (key.includes(locationKey) || locationKey.includes(key))
  })
  if (candidates.length === 1) return { method: 'contained-name', locationKey: candidates[0][0], rows: candidates[0][1] }
  return { method: candidates.length ? 'ambiguous' : 'none', locationKey: '', rows: [] }
}

const data = JSON.parse(await fs.readFile(regionsPath, 'utf8'))
const report = []
let leafCount = 0
let matchedCount = 0
const usedLocationKeys = new Set()

for (const parent of data.regions || []) {
  const leaves = parent.children?.length ? parent.children : [parent]
  for (const leaf of leaves) {
    leafCount += 1
    const match = matchLocation(leaf.name)
    if (match.locationKey) usedLocationKeys.add(match.locationKey)
    leaf.level = 3
    leaf.bgm = chooseBgm(match.rows, leaf.id)
    const hasPlayableBgm = Object.values(leaf.bgm).some(item => item.title)
    if (hasPlayableBgm) matchedCount += 1

    report.push({
      id: leaf.id,
      nation: leaf.nation || parent.nation,
      parentId: parent.children?.length ? parent.id : '',
      parentName: parent.children?.length ? parent.name : '',
      name: leaf.name,
      matchMethod: match.method,
      mappingLocation: match.rows[0]?.locationZh || '',
      mappingRows: match.rows.length,
      dawn: leaf.bgm.dawn.title,
      day: leaf.bgm.day.title,
      dusk: leaf.bgm.dusk.title,
      night: leaf.bgm.night.title,
      status: hasPlayableBgm ? 'matched' : 'empty-no-l3-specific-track'
    })
  }
}

await fs.writeFile(regionsPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
const columns = ['id', 'nation', 'parentId', 'parentName', 'name', 'matchMethod', 'mappingLocation', 'mappingRows', 'dawn', 'day', 'dusk', 'night', 'status']
const csv = [columns.map(csvCell).join(','), ...report.map(row => columns.map(column => csvCell(row[column])).join(','))].join('\r\n')
await fs.writeFile(reportPath, `\ufeff${csv}\r\n`, 'utf8')

const noBoundaryRows = [...locations.entries()]
  .filter(([key]) => !usedLocationKeys.has(key))
  .map(([, rows]) => ({
    locationEn: rows[0]?.locationEn || '',
    locationZh: rows[0]?.locationZh || '',
    mappingRows: rows.length,
    category: [...new Set(rows.map(row => row.category))].join(' / '),
    reason: 'no-l3-map-boundary'
  }))
  .sort((a, b) => a.locationEn.localeCompare(b.locationEn, 'en'))
const noBoundaryColumns = ['locationEn', 'locationZh', 'mappingRows', 'category', 'reason']
const noBoundaryCsv = [
  noBoundaryColumns.map(csvCell).join(','),
  ...noBoundaryRows.map(row => noBoundaryColumns.map(column => csvCell(row[column])).join(','))
].join('\r\n')
await fs.writeFile(noBoundaryReportPath, `\ufeff${noBoundaryCsv}\r\n`, 'utf8')

const playablePeriods = report.reduce((sum, row) => sum + ['dawn', 'day', 'dusk', 'night'].filter(period => row[period]).length, 0)
console.log(`L3 leaves: ${leafCount}`)
console.log(`Matched L3 leaves: ${matchedCount}`)
console.log(`Empty L3 leaves: ${leafCount - matchedCount}`)
console.log(`Playable period entries: ${playablePeriods}`)
console.log(`Report: ${path.relative(root, reportPath)}`)
console.log(`Mapping locations without an L3 boundary: ${noBoundaryRows.length}`)
console.log(`No-boundary report: ${path.relative(root, noBoundaryReportPath)}`)
