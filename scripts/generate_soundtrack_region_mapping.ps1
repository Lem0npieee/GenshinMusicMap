param(
  [string]$OutputPath = 'doc/音频-区域映射表.md'
)

$ErrorActionPreference = 'Stop'
$ApiUrl = 'https://genshin-impact.fandom.com/api.php'
$LocationCategory = 'Category:Location Soundtracks'
$CombatCategory = 'Category:Combat Soundtracks'

function ConvertTo-QueryString {
  param([hashtable]$Parameters)

  return (($Parameters.GetEnumerator() | Sort-Object Key | ForEach-Object {
    '{0}={1}' -f [uri]::EscapeDataString([string]$_.Key), [uri]::EscapeDataString([string]$_.Value)
  }) -join '&')
}

function Invoke-FandomApi {
  param(
    [hashtable]$Parameters,
    [ValidateSet('Get', 'Post')]
    [string]$Method = 'Get'
  )

  for ($attempt = 1; $attempt -le 4; $attempt++) {
    try {
      if ($Method -eq 'Post') {
        $response = Invoke-WebRequest -Uri $ApiUrl -Method Post -Body $Parameters -UseBasicParsing -TimeoutSec 120
      } else {
        $uri = '{0}?{1}' -f $ApiUrl, (ConvertTo-QueryString $Parameters)
        $response = Invoke-WebRequest -Uri $uri -UseBasicParsing -TimeoutSec 120
      }

      $result = $response.Content | ConvertFrom-Json
      if ($result.error) {
        throw ('Fandom API error: {0}' -f $result.error.info)
      }
      return $result
    } catch {
      if ($attempt -eq 4) { throw }
      Start-Sleep -Seconds ($attempt * 2)
    }
  }
}

function Get-CategoryTitles {
  param([string]$Category)

  $titles = [System.Collections.Generic.List[string]]::new()
  $continueToken = $null

  do {
    $parameters = @{
      action      = 'query'
      list        = 'categorymembers'
      cmtitle     = $Category
      cmnamespace = 0
      cmlimit     = 'max'
      format      = 'json'
      formatversion = 2
    }
    if ($continueToken) { $parameters.cmcontinue = $continueToken }

    $result = Invoke-FandomApi -Parameters $parameters
    foreach ($member in $result.query.categorymembers) {
      $titles.Add([string]$member.title)
    }
    $continueToken = if ($result.continue) { $result.continue.cmcontinue } else { $null }
  } while ($continueToken)

  return @($titles)
}

function Get-SoundtrackPages {
  param([string[]]$Titles)

  $pages = [System.Collections.Generic.List[object]]::new()
  $batchSize = 25

  for ($offset = 0; $offset -lt $Titles.Count; $offset += $batchSize) {
    $last = [Math]::Min($offset + $batchSize - 1, $Titles.Count - 1)
    $batch = @($Titles[$offset..$last])
    $parameters = @{
      action        = 'query'
      prop          = 'revisions'
      rvprop        = 'content'
      rvslots       = 'main'
      titles        = ($batch -join '|')
      redirects     = 1
      format        = 'json'
      formatversion = 2
    }

    $result = Invoke-FandomApi -Parameters $parameters -Method Post
    foreach ($page in $result.query.pages) {
      if ($page.missing -or -not $page.revisions) { continue }
      $pages.Add([pscustomobject]@{
        Title   = [string]$page.title
        WikiText = [string]$page.revisions[0].slots.main.content
      })
    }

    Write-Progress -Activity '读取 Fandom 曲目页面' -Status ("{0}/{1}" -f ($last + 1), $Titles.Count) -PercentComplete ((($last + 1) / $Titles.Count) * 100)
  }

  Write-Progress -Activity '读取 Fandom 曲目页面' -Completed
  return @($pages)
}

function Get-FandomChineseNames {
  param([string[]]$Titles)

  $resultMap = @{}
  $batchSize = 25

  for ($offset = 0; $offset -lt $Titles.Count; $offset += $batchSize) {
    $last = [Math]::Min($offset + $batchSize - 1, $Titles.Count - 1)
    $batch = @($Titles[$offset..$last])
    $parameters = @{
      action        = 'query'
      prop          = 'revisions'
      rvprop        = 'content'
      rvslots       = 'main'
      titles        = ($batch -join '|')
      redirects     = 1
      format        = 'json'
      formatversion = 2
    }

    $apiResult = Invoke-FandomApi -Parameters $parameters -Method Post
    $forward = @{}
    foreach ($item in @($apiResult.query.normalized)) {
      if ($item.from -and $item.to) { $forward[[string]$item.from] = [string]$item.to }
    }
    foreach ($item in @($apiResult.query.redirects)) {
      if ($item.from -and $item.to) { $forward[[string]$item.from] = [string]$item.to }
    }

    $pageTexts = @{}
    foreach ($page in $apiResult.query.pages) {
      if ($page.missing -or -not $page.revisions) { continue }
      $pageTexts[[string]$page.title] = [string]$page.revisions[0].slots.main.content
    }

    foreach ($originalTitle in $batch) {
      $resolvedTitle = [string]$originalTitle
      $visited = @{}
      while ($forward.ContainsKey($resolvedTitle) -and -not $visited.ContainsKey($resolvedTitle)) {
        $visited[$resolvedTitle] = $true
        $resolvedTitle = $forward[$resolvedTitle]
      }
      if (-not $pageTexts.ContainsKey($resolvedTitle)) { continue }

      $wikiText = $pageTexts[$resolvedTitle]
      $languageMatches = [regex]::Matches(
        $wikiText,
        '(?m)^\|[ \t]*(?:(?<order>\d+)_)?zhs[ \t]*=[ \t]*(?<value>[^\r\n]+)'
      )
      if ($languageMatches.Count -eq 0) { continue }

      $selected = $languageMatches | Where-Object { -not $_.Groups['order'].Success } | Select-Object -First 1
      if (-not $selected) {
        $selected = $languageMatches | Where-Object { $_.Groups['order'].Value -eq '1' } | Select-Object -First 1
      }
      if (-not $selected) { $selected = $languageMatches[0] }

      $chineseName = Convert-WikiTextToPlain $selected.Groups['value'].Value
      if ($chineseName) { $resultMap[[string]$originalTitle] = $chineseName }
    }

    Write-Progress -Activity '读取 Fandom 中文地名' -Status ("{0}/{1}" -f ($last + 1), $Titles.Count) -PercentComplete ((($last + 1) / $Titles.Count) * 100)
  }

  Write-Progress -Activity '读取 Fandom 中文地名' -Completed
  return $resultMap
}

function Convert-WikiTextToPlain {
  param([AllowEmptyString()][string]$Value)

  if ([string]::IsNullOrWhiteSpace($Value)) { return '' }
  $plain = $Value
  $plain = [regex]::Replace($plain, '<!--.*?-->', '', 'Singleline')
  $plain = [regex]::Replace($plain, '<ref\b.*?</ref>', '', 'Singleline')
  $plain = [regex]::Replace($plain, '<ref\b[^>]*/>', '')
  $plain = $plain -replace '\{\{!\}\}', '|'
  $plain = [regex]::Replace($plain, '\[\[(?:[^\]|]+\|)?([^\]]+)\]\]', '$1')
  $plain = [regex]::Replace($plain, '\{\{(?:tt|Tooltip)\|([^|}]+)(?:\|[^}]*)?\}\}', '$1', 'IgnoreCase')
  $plain = [regex]::Replace($plain, '\{\{(?:lang|Lang)\|[^|}]+\|([^}]+)\}\}', '$1')
  $plain = $plain -replace "'''?", ''
  $plain = [regex]::Replace($plain, '<[^>]+>', '')
  $plain = $plain -replace "\r?\n", ' '
  $plain = [System.Net.WebUtility]::HtmlDecode($plain)
  return ([regex]::Replace($plain, '\s+', ' ')).Trim()
}

function Get-TemplateParameter {
  param(
    [string]$WikiText,
    [string]$Name
  )

  # 这里只允许横向空白，不能用 \s；否则空参数会跨行吞掉下一个参数。
  $pattern = '(?m)^\|[ \t]*{0}[ \t]*=[ \t]*(?<value>[^\r\n]*)' -f [regex]::Escape($Name)
  $match = [regex]::Match($WikiText, $pattern)
  if (-not $match.Success) { return '' }
  return Convert-WikiTextToPlain $match.Groups['value'].Value
}

function Get-LocationValues {
  param([string]$WikiText)

  $usageMatch = [regex]::Match($WikiText, '(?ms)^\{\{Soundtrack Usage\b(?<body>.*?)^\}\}')
  if (-not $usageMatch.Success) { return @() }

  $body = $usageMatch.Groups['body'].Value + "`n}}"
  $matches = [regex]::Matches(
    $body,
    '(?ms)^\|\s*location\d*\s*=\s*(?<value>.*?)(?=^\|\s*[A-Za-z0-9_]+\s*=|^\}\})'
  )

  $values = [System.Collections.Generic.List[string]]::new()
  foreach ($match in $matches) {
    $value = ($match.Groups['value'].Value -replace "\r?\n", ' ').Trim()
    if ($value) { $values.Add($value) }
  }
  return @($values)
}

function ConvertTo-MarkdownText {
  param([AllowEmptyString()][string]$Value)

  if ($null -eq $Value) { return '' }
  return (($Value -replace '\|', '\|') -replace "\r?\n", ' ').Trim()
}

function Get-PageUrl {
  param([string]$Title)

  $escaped = [uri]::EscapeDataString($Title.Replace(' ', '_')).Replace('%2F', '/')
  return 'https://genshin-impact.fandom.com/wiki/{0}' -f $escaped
}

Write-Host '读取曲目分类...'
$locationTitles = @(Get-CategoryTitles -Category $LocationCategory)
$combatTitles = @(Get-CategoryTitles -Category $CombatCategory)

$combatSet = @{}
foreach ($title in $combatTitles) { $combatSet[$title] = $true }

$allTitles = @($locationTitles + $combatTitles | Sort-Object -Unique)
Write-Host ("场景曲分类 {0} 首，战斗曲分类 {1} 首，并集 {2} 首。" -f $locationTitles.Count, $combatTitles.Count, $allTitles.Count)

$pages = @(Get-SoundtrackPages -Titles $allTitles)
$rows = [System.Collections.Generic.List[object]]::new()
$unresolved = [System.Collections.Generic.List[string]]::new()
$broadWildAreas = @('Mondstadt', 'Liyue', 'Inazuma', 'Sumeru', 'Fontaine', 'Natlan', 'Nod-Krai', 'Nod Krai', 'Snezhnaya', 'Teyvat')

foreach ($page in $pages) {
  $title = $page.Title
  $wikiText = $page.WikiText
  $album = Get-TemplateParameter -WikiText $wikiText -Name 'album'
  $disc = Get-TemplateParameter -WikiText $wikiText -Name 'disc'
  $number = Get-TemplateParameter -WikiText $wikiText -Name 'number'
  $isCombatPage = $combatSet.ContainsKey($title)
  $locationValues = @(Get-LocationValues -WikiText $wikiText)
  $pageRowCount = 0

  foreach ($locationValue in $locationValues) {
    $entries = @([regex]::Split($locationValue, '\s*;;\s*') | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    foreach ($entryValue in $entries) {
      $entry = Convert-WikiTextToPlain $entryValue
      if (-not $entry) { continue }

      $parts = $entry -split '//', 2
      $locationAndVariant = $parts[0].Trim()
      $conditions = if ($parts.Count -gt 1) { (($parts[1] -replace '\s*;\s*', '、').Trim()).Trim('、') } else { '' }

      $variantParts = @($locationAndVariant -split '\\')
      $location = $variantParts[0].Trim()
      $variants = if ($variantParts.Count -gt 1) { @($variantParts[1..($variantParts.Count - 1)] | Where-Object { $_ }) } else { @() }
      $conditionParts = @($conditions -split '\\')
      $conditions = $conditionParts[0].Trim()
      $conditionVariants = if ($conditionParts.Count -gt 1) { @($conditionParts[1..($conditionParts.Count - 1)] | Where-Object { $_ }) } else { @() }
      $isCombat = $isCombatPage -or ($variants -contains 'combat') -or ($conditionVariants -contains 'combat')
      $isWild = ($variants -contains 'wild') -or ($broadWildAreas -contains $location)

      $otherVariants = @($variants + $conditionVariants | Where-Object { $_ -notin @('combat', 'wild') })
      if ($otherVariants.Count -gt 0) {
        $variantText = $otherVariants -join '、'
        $conditions = if ($conditions) { '{0}、{1}' -f $conditions, $variantText } else { $variantText }
      }
      $conditions = ($conditions -replace '[、;,\s]+$', '').Trim()

      if ($isCombat) {
        $area = if ($location) { '战斗曲（{0}）' -f $location } else { '战斗曲' }
        $kind = '战斗曲'
      } elseif ($isWild) {
        $area = if ($location) { '野外（{0}）' -f $location } else { '野外' }
        $kind = '野外场景曲'
      } else {
        $area = if ($location) { $location } else { '待核实' }
        $kind = '区域场景曲'
      }

      $rows.Add([pscustomobject]@{
        BaseLabel  = $area
        MappingName = ''
        Track      = ($title -replace ' \(Soundtrack\)$', '')
        PageTitle  = $title
        Area       = $area
        Conditions = $conditions
        Kind       = $kind
        Album      = $album
        Disc       = $disc
        Number     = $number
      })
      $pageRowCount++
    }
  }

  if ($pageRowCount -eq 0) {
    if ($isCombatPage) {
      $rows.Add([pscustomobject]@{
        BaseLabel   = '战斗曲'
        MappingName = ''
        Track       = ($title -replace ' \(Soundtrack\)$', '')
        PageTitle   = $title
        Area        = '战斗曲'
        Conditions  = ''
        Kind        = '战斗曲'
        Album       = $album
        Disc        = $disc
        Number      = $number
      })
    } else {
      $unresolved.Add($title)
      $rows.Add([pscustomobject]@{
        BaseLabel   = '待核实'
        MappingName = ''
        Track       = ($title -replace ' \(Soundtrack\)$', '')
        PageTitle   = $title
        Area        = '待核实'
        Conditions  = ''
        Kind        = '区域场景曲'
        Album       = $album
        Disc        = $disc
        Number      = $number
      })
    }
  }
}

# 同一曲目在同一区域的完全重复记录只保留一次。
$rows = @($rows | Sort-Object PageTitle, Area, Conditions -Unique)
$rows = @($rows | Sort-Object BaseLabel, Album, Disc, Number, Track, Conditions)

# 从“对应区域/类型”中提取实际地点页标题，再读取 Fandom Other Languages 的简中名。
$translationContexts = [System.Collections.Generic.List[string]]::new()
foreach ($row in $rows) {
  $context = ''
  if ($row.Area -match '^(?:野外|战斗曲)（(?<context>.*)）$') {
    $context = $matches['context']
  } elseif ($row.Area -notin @('野外', '战斗曲', '待核实')) {
    $context = $row.Area
  }
  $context = $context.Trim().Trim('"').Trim("'")
  $row | Add-Member -NotePropertyName TranslationContext -NotePropertyValue $context
  $row | Add-Member -NotePropertyName ChineseArea -NotePropertyValue ''
  $row | Add-Member -NotePropertyName ChineseMappingName -NotePropertyValue ''
  if ($context) { $translationContexts.Add($context) }
}

$translationContexts = @($translationContexts | Sort-Object -Unique)
Write-Host ("读取 {0} 个区域/对象的 Fandom 简中名称..." -f $translationContexts.Count)
$chineseNameMap = Get-FandomChineseNames -Titles $translationContexts

foreach ($row in $rows) {
  $chineseContext = if ($row.TranslationContext -and $chineseNameMap.ContainsKey($row.TranslationContext)) {
    $chineseNameMap[$row.TranslationContext]
  } elseif ($row.TranslationContext) {
    '待补充：{0}' -f $row.TranslationContext
  } else {
    ''
  }

  if ($row.Area -match '^野外（') {
    $row.ChineseArea = '野外（{0}）' -f $chineseContext
  } elseif ($row.Area -eq '野外') {
    $row.ChineseArea = '野外'
  } elseif ($row.Area -match '^战斗曲（') {
    $row.ChineseArea = '战斗曲（{0}）' -f $chineseContext
  } elseif ($row.Area -eq '战斗曲') {
    $row.ChineseArea = '战斗曲'
  } elseif ($row.Area -eq '待核实') {
    $row.ChineseArea = '待核实'
  } else {
    $row.ChineseArea = $chineseContext
  }
}

$totals = @{}
$chineseTotals = @{}
foreach ($row in $rows) {
  if (-not $totals.ContainsKey($row.BaseLabel)) { $totals[$row.BaseLabel] = 0 }
  $totals[$row.BaseLabel]++
  if (-not $chineseTotals.ContainsKey($row.ChineseArea)) { $chineseTotals[$row.ChineseArea] = 0 }
  $chineseTotals[$row.ChineseArea]++
}

$counters = @{}
$chineseCounters = @{}
foreach ($row in $rows) {
  if (-not $counters.ContainsKey($row.BaseLabel)) { $counters[$row.BaseLabel] = 0 }
  $counters[$row.BaseLabel]++
  $row.MappingName = if ($totals[$row.BaseLabel] -gt 1) {
    '{0} {1}' -f $row.BaseLabel, $counters[$row.BaseLabel]
  } else {
    $row.BaseLabel
  }
  if (-not $chineseCounters.ContainsKey($row.ChineseArea)) { $chineseCounters[$row.ChineseArea] = 0 }
  $chineseCounters[$row.ChineseArea]++
  $row.ChineseMappingName = if ($chineseTotals[$row.ChineseArea] -gt 1) {
    '{0} {1}' -f $row.ChineseArea, $chineseCounters[$row.ChineseArea]
  } else {
    $row.ChineseArea
  }
}

$locationPageCount = @($allTitles | Where-Object { -not $combatSet.ContainsKey($_) }).Count
$combatPageCount = $combatTitles.Count
$combatRowCount = @($rows | Where-Object { $_.Kind -eq '战斗曲' }).Count
$wildRowCount = @($rows | Where-Object { $_.Kind -eq '野外场景曲' }).Count
$areaRowCount = @($rows | Where-Object { $_.Kind -eq '区域场景曲' }).Count
$translatedContextCount = @($translationContexts | Where-Object { $chineseNameMap.ContainsKey($_) }).Count
$missingTranslationContexts = @($translationContexts | Where-Object { -not $chineseNameMap.ContainsKey($_) })

$lines = [System.Collections.Generic.List[string]]::new()
$lines.Add('# 原神大世界音频—区域映射表')
$lines.Add('')
$lines.Add('> 数据源：[Genshin Impact Wiki — Soundtrack](https://genshin-impact.fandom.com/wiki/Soundtrack)、[Soundtrack/List](https://genshin-impact.fandom.com/wiki/Soundtrack/List)、[Location Soundtracks](https://genshin-impact.fandom.com/wiki/Category:Location_Soundtracks) 与 [Combat Soundtracks](https://genshin-impact.fandom.com/wiki/Category:Combat_Soundtracks)。')
$lines.Add(('> 生成日期：{0}；数据为生成时 Fandom 页面快照，后续版本新增曲目需重新运行脚本。' -f (Get-Date -Format 'yyyy-MM-dd')))
$lines.Add('')
$lines.Add('## 收录与标注规则')
$lines.Add('')
$lines.Add('- 收录 Fandom `Location Soundtracks` 和 `Combat Soundtracks` 两个分类的并集；只出现在剧情、活动、宣传片、角色演示或尘歌壶中的曲目不计入。')
$lines.Add('- 一首曲目对应多个大世界地点时，拆成多行，确保每行都是一条明确的“音频—区域”映射。')
$lines.Add('- Fandom 只标注国度、没有具体地点时，归为“野外（国度）”；标记为 `combat` 或属于战斗曲分类时，归为“战斗曲（区域）”。')
$lines.Add('- 同一区域或同一类型存在多首曲目时，在“映射名”后依次标注 1、2、3……；“对应区域/类型”列保留未编号的归一化值。')
$lines.Add('- 英文地点名保留 Fandom 原文；中文地点名读取对应 Fandom 地点页 `Other Languages` 的 `zhs`（简体中文）字段，多名称页面优先采用 `1_zhs`。')
$lines.Add('- Fandom 地点页未提供简中字段时，中文列标记为“待补充：英文名”；歌曲名暂时保留英文。')
$lines.Add('- 时段和天气等条件单独列出，避免与地点名混合。')
$lines.Add('')
$lines.Add('## 统计')
$lines.Add('')
$lines.Add(('- 场景曲页面：{0} 首' -f $locationPageCount))
$lines.Add(('- 战斗曲页面：{0} 首' -f $combatPageCount))
$lines.Add(('- 去重后的曲目页面总数：{0} 首' -f $allTitles.Count))
$lines.Add(('- 展开后的音频—区域映射：{0} 条（具体区域 {1}、野外 {2}、战斗曲 {3}）' -f $rows.Count, $areaRowCount, $wildRowCount, $combatRowCount))
$lines.Add(('- 唯一区域/对象：{0} 个；已取得 Fandom 简中名 {1} 个，待补充 {2} 个' -f $translationContexts.Count, $translatedContextCount, $missingTranslationContexts.Count))
$lines.Add(('- 待人工核实：{0} 首' -f $unresolved.Count))
$lines.Add('')
$lines.Add('## 音频—区域映射')
$lines.Add('')
$lines.Add('| 映射名 | 中文映射名 | 音频 | 对应区域/类型 | 中文对应区域/类型 | 时段/条件 | 分类 | 专辑 | 盘-序号 |')
$lines.Add('|---|---|---|---|---|---|---|---|---|')

foreach ($row in $rows) {
  $url = Get-PageUrl -Title $row.PageTitle
  $trackLink = '[{0}]({1})' -f (ConvertTo-MarkdownText $row.Track), $url
  $discNumber = if ($row.Disc -and $row.Number) { '{0}-{1}' -f $row.Disc, $row.Number } elseif ($row.Number) { $row.Number } else { '' }
  $lineValues = @(
    (ConvertTo-MarkdownText $row.MappingName),
    (ConvertTo-MarkdownText $row.ChineseMappingName),
    $trackLink,
    (ConvertTo-MarkdownText $row.Area),
    (ConvertTo-MarkdownText $row.ChineseArea),
    (ConvertTo-MarkdownText $row.Conditions),
    (ConvertTo-MarkdownText $row.Kind),
    (ConvertTo-MarkdownText $row.Album),
    (ConvertTo-MarkdownText $discNumber)
  )
  $lines.Add(('| {0} | {1} | {2} | {3} | {4} | {5} | {6} | {7} | {8} |' -f $lineValues))
}

if ($missingTranslationContexts.Count -gt 0) {
  $lines.Add('')
  $lines.Add('## 中文地名待补充')
  $lines.Add('')
  $lines.Add('以下区域或对象的 Fandom 页面在生成时没有可解析的简体中文 `zhs` 字段：')
  $lines.Add('')
  foreach ($context in $missingTranslationContexts) {
    $lines.Add(('- [{0}]({1})' -f (ConvertTo-MarkdownText $context), (Get-PageUrl -Title $context)))
  }
}

if ($unresolved.Count -gt 0) {
  $lines.Add('')
  $lines.Add('## 待人工核实')
  $lines.Add('')
  $lines.Add('以下页面属于场景曲分类，但页面源码中没有可解析的 `location` 字段：')
  $lines.Add('')
  foreach ($title in ($unresolved | Sort-Object -Unique)) {
    $lines.Add('- [{0}]({1})' -f (ConvertTo-MarkdownText $title), (Get-PageUrl -Title $title))
  }
}

$resolvedOutput = if ([IO.Path]::IsPathRooted($OutputPath)) {
  $OutputPath
} else {
  Join-Path (Get-Location).Path $OutputPath
}
$outputDirectory = Split-Path -Parent $resolvedOutput
if (-not (Test-Path -LiteralPath $outputDirectory)) {
  New-Item -ItemType Directory -Path $outputDirectory | Out-Null
}

$utf8WithoutBom = [System.Text.UTF8Encoding]::new($false)
[IO.File]::WriteAllLines($resolvedOutput, $lines, $utf8WithoutBom)
Write-Host ("已生成：{0}" -f $resolvedOutput)
