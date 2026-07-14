import fs from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const regionsPath = path.join(root, 'public', 'data', 'regions.json')
const outputPath = path.join(root, 'public', 'data', 'audio-sources.json')
const reportPath = path.join(root, 'doc', 'netease-match-report.csv')
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const verifiedSongIds = new Map([
  ['A Sweet Dream in Fontaine', '2130084919'],
  ['Fantasy of Ten Thousand Blossoms', '2041862695'],
  ['Solitary Breach', '2041862705'],
  ['Spice Road', '2041862713'],
  ['Across the Aridisols', '2041862745']
])

function normalize(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
    .trim()
}

function scoreSong(queryTitle, song) {
  const query = normalize(queryTitle)
  const name = normalize(song.name)
  const artists = normalize((song.artists || []).map(item => item.name).join(' '))
  const album = normalize(song.album?.name)
  const queryTokens = query.split(' ').filter(token => token.length > 1)
  const matchedTokens = queryTokens.filter(token => name.includes(token)).length
  const coverage = queryTokens.length ? matchedTokens / queryTokens.length : 0
  let score = 0

  if (name === query) score += 130
  else if (name.includes(query) || query.includes(name)) score += 100
  score += Math.round(coverage * 60)
  if (coverage === 1) score += 20
  if (artists.includes('hoyo mix') || artists.includes('hoyomix')) score += 80
  if (artists.includes('陈致逸') || artists.includes('yu peng chen')) score += 45
  if (album.includes('原神') || album.includes('genshin impact')) score += 35
  if (song.fee === 0) score += 5

  const derivativeWords = ['piano', 'cover', 'remix', 'lofi', 'lo fi', 'harp', 'orchestra', 'arrangement']
  if (derivativeWords.some(word => name.includes(word) && !query.includes(word))) score -= 80
  return score
}

function isMatchableTitle(title) {
  return !/^Unnamed\b/i.test(String(title || '').trim())
}

function isOfficialSong(song) {
  const artists = normalize((song.artists || []).map(item => item.name).join(' '))
  const album = normalize(song.album?.name)
  const officialArtist = artists.includes('hoyo mix') || artists.includes('hoyomix') || artists.includes('陈致逸') || artists.includes('yu peng chen')
  const genshinAlbum = album.includes('原神') || album.includes('genshin impact')
  return officialArtist && genshinAlbum
}

function isOfficialSource(source) {
  const artists = normalize(source?.artist)
  const album = normalize(source?.album)
  const officialArtist = artists.includes('hoyo mix') || artists.includes('hoyomix') || artists.includes('陈致逸') || artists.includes('yu peng chen')
  const genshinAlbum = album.includes('原神') || album.includes('genshin impact')
  return Boolean(source?.neteaseId && officialArtist && genshinAlbum)
}

async function getJson(url) {
  const response = await fetch(url, {
    headers: {
      Referer: 'https://music.163.com/',
      'User-Agent': 'Mozilla/5.0 (compatible; GenshinMusicMap/1.0)'
    }
  })
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
  return response.json()
}

async function searchSong(title) {
  let songs = []
  const queries = [`${title} HOYO-MiX`, title]
  for (const searchText of queries) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const query = encodeURIComponent(searchText)
      const url = `https://music.163.com/api/search/get/web?csrf_token=&s=${query}&type=1&offset=0&total=true&limit=20`
      const data = await getJson(url)
      songs = data.result?.songs || []
      if (songs.length) break
      await delay(700 * (attempt + 1))
    }
    if (songs.length) break
  }
  return songs
    .filter(isOfficialSong)
    .map(song => ({ song, score: scoreSong(title, song) }))
    .sort((a, b) => b.score - a.score)
}

async function getSongDetails(ids) {
  const details = new Map()
  for (let index = 0; index < ids.length; index += 100) {
    const batch = ids.slice(index, index + 100)
    const encodedIds = encodeURIComponent(JSON.stringify(batch.map(Number)))
    const data = await getJson(`https://music.163.com/api/song/detail/?ids=${encodedIds}`)
    for (const song of data.songs || []) details.set(String(song.id), song)
    await delay(200)
  }
  return details
}

async function getOfficialCatalog() {
  const playlist = await getJson('https://music.163.com/api/v6/playlist/detail?id=5010919615')
  const ids = (playlist.playlist?.trackIds || []).map(item => String(item.id))
  if (!ids.length) throw new Error('Official playlist returned no track IDs')
  const details = await getSongDetails(ids)
  return [...details.values()].filter(isOfficialSong)
}

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}

const data = JSON.parse(await fs.readFile(regionsPath, 'utf8'))
let existingSources = {}
try {
  existingSources = JSON.parse(await fs.readFile(outputPath, 'utf8'))
} catch {
  existingSources = {}
}
function appendEntries(target, region) {
  for (const [period, bgm] of Object.entries(region.bgm || {})) {
    if (!bgm?.title || !bgm?.file) continue
    target.push({ file: bgm.file, title: bgm.title, regionId: region.id, regionName: region.name, period })
  }
}

const allEntries = []
const entries = []
for (const region of data.regions || []) {
  appendEntries(allEntries, region)
  for (const child of region.children || []) appendEntries(allEntries, child)
  const leaves = region.children?.length ? region.children : [region]
  for (const leaf of leaves) appendEntries(entries, leaf)
}

const titles = [...new Set(entries.map(item => item.title))]
const cachedByTitle = new Map()
for (const entry of allEntries) {
  const source = existingSources[entry.file]
  if (isOfficialSource(source)) cachedByTitle.set(entry.title, source)
}

let officialCatalog = []
if (titles.some(title => !verifiedSongIds.has(title) && !cachedByTitle.has(title))) {
  try {
    officialCatalog = await getOfficialCatalog()
    console.log(`Loaded ${officialCatalog.length} official playlist tracks`)
  } catch (error) {
    process.stderr.write(`Official playlist catalog unavailable: ${error.message}\n`)
  }
}
const matches = new Map()
for (let index = 0; index < titles.length; index += 1) {
  const title = titles[index]
  if (!isMatchableTitle(title)) {
    matches.set(title, null)
    process.stdout.write(`[${index + 1}/${titles.length}] SKIP unpublished ${title}\n`)
    continue
  }
  const verifiedId = verifiedSongIds.get(title)
  if (verifiedId) {
    matches.set(title, { verified: true, score: 999, song: { id: verifiedId } })
    process.stdout.write(`[${index + 1}/${titles.length}] VERIFIED ${title}\n`)
    continue
  }
  const cached = cachedByTitle.get(title)
  if (cached) {
    matches.set(title, { cached: true, score: 999, source: cached })
    process.stdout.write(`[${index + 1}/${titles.length}] CACHED ${title}\n`)
    continue
  }
  const catalogCandidates = officialCatalog
    .map(song => ({ song, score: scoreSong(title, song) }))
    .filter(candidate => candidate.score >= 150)
    .sort((a, b) => b.score - a.score)
  if (catalogCandidates.length) {
    const best = catalogCandidates[0]
    matches.set(title, best)
    process.stdout.write(`[${index + 1}/${titles.length}] CATALOG ${best.score} ${title}\n`)
    continue
  }
  try {
    const candidates = await searchSong(title)
    const best = candidates[0]
    matches.set(title, best && best.score >= 150 ? best : null)
    process.stdout.write(`[${index + 1}/${titles.length}] ${best?.score ?? 0} ${title}\n`)
  } catch (error) {
    matches.set(title, null)
    process.stderr.write(`[${index + 1}/${titles.length}] ERROR ${title}: ${error.message}\n`)
  }
  await delay(450)
}

const matchedIds = [...new Set([...matches.values()]
  .filter(Boolean)
  .map(item => String(item.source?.neteaseId || item.song?.id))
  .filter(Boolean))]
const details = await getSongDetails(matchedIds)
const sources = {}
const report = []

for (const entry of entries) {
  const match = matches.get(entry.title)
  const cached = match?.source
  const matchedId = cached?.neteaseId || match?.song?.id
  const detail = matchedId ? details.get(String(matchedId)) : null
  const id = detail?.id || matchedId
  const artist = detail
    ? (detail.artists || []).map(item => item.name).join(' / ')
    : cached?.artist || (match?.song?.artists || []).map(item => item.name).join(' / ')
  const album = detail?.album?.name || cached?.album || match?.song?.album?.name || ''
  const cover = detail?.album?.picUrl || detail?.album?.blurPicUrl || cached?.cover || ''

  if (id) {
    sources[entry.file] = {
      provider: 'netease',
      neteaseId: String(id),
      streamUrl: `https://music.163.com/song/media/outer/url?id=${id}.mp3`,
      embedUrl: `https://music.163.com/outchain/player?type=2&id=${id}&auto=1&height=66`,
      cover,
      artist,
      album
    }
  }

  report.push({
    ...entry,
    status: id ? 'matched' : 'unmatched',
    score: match?.score || 0,
    neteaseId: id || '',
    matchedTitle: detail?.name || match?.song?.name || '',
    artist,
    album,
    cover
  })
}

await fs.mkdir(path.dirname(outputPath), { recursive: true })
await fs.mkdir(path.dirname(reportPath), { recursive: true })
await fs.writeFile(outputPath, `${JSON.stringify(sources, null, 2)}\n`, 'utf8')

const columns = ['file', 'title', 'regionId', 'regionName', 'period', 'status', 'score', 'neteaseId', 'matchedTitle', 'artist', 'album', 'cover']
const csv = [columns.map(csvCell).join(','), ...report.map(row => columns.map(column => csvCell(row[column])).join(','))].join('\r\n')
await fs.writeFile(reportPath, `\ufeff${csv}\r\n`, 'utf8')

const matched = report.filter(item => item.status === 'matched').length
console.log(`Wrote ${matched}/${report.length} entries to ${path.relative(root, outputPath)}`)
console.log(`Review report: ${path.relative(root, reportPath)}`)
