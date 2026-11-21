# 生成 EdgeOne 控制台上传用的 ZIP。
# 用法：npm run edgeone:zip
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root 'web\dist-edgeone'
$zip  = Join-Path $root 'molan-edgeone.zip'

if (-not (Test-Path (Join-Path $dist 'index.html'))) {
  throw "未找到 web\dist-edgeone\index.html，请先运行 npm run edgeone:build"
}

$items = Get-ChildItem -LiteralPath $dist -Force |
  Where-Object { $_.Name -notin @('.edgeone', 'dist-edgeone.zip') }

if (Test-Path -LiteralPath $zip) {
  Remove-Item -LiteralPath $zip -Force
}

Compress-Archive -Path $items.FullName -DestinationPath $zip -CompressionLevel Optimal
$size = [math]::Round((Get-Item -LiteralPath $zip).Length / 1MB, 1)
Write-Host "[edgeone] 已生成 $zip（$size MB）"
