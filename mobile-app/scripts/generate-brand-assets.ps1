Add-Type -AssemblyName System.Drawing

$appRoot = Split-Path $PSScriptRoot -Parent
$assetsDir = Join-Path $appRoot 'assets'
$sourcePath = Join-Path $assetsDir 'brand\weathercheck-fixed\weathercheck-symbol-fixed.png'

if (-not (Test-Path $sourcePath)) {
  throw "Fixed brand symbol not found: $sourcePath"
}

function New-Canvas($size, $transparent = $false) {
  $bitmap = New-Object System.Drawing.Bitmap $size, $size
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  if ($transparent) {
    $graphics.Clear([System.Drawing.Color]::Transparent)
  } else {
    $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#f9faf7'))
  }
  return @($bitmap, $graphics)
}

function Save-BrandAsset($name, $size, $scale = 0.76, $transparent = $false, $monochrome = $false) {
  $canvas = New-Canvas $size $transparent
  $bitmap = $canvas[0]
  $graphics = $canvas[1]
  $source = [System.Drawing.Image]::FromFile($sourcePath)

  if ($scale -le 0) {
    $path = Join-Path $assetsDir $name
    $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $source.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
    return
  }

  $targetW = [math]::Round($size * $scale)
  $targetH = [math]::Round($targetW * $source.Height / $source.Width)
  if ($targetH -gt [math]::Round($size * $scale)) {
    $targetH = [math]::Round($size * $scale)
    $targetW = [math]::Round($targetH * $source.Width / $source.Height)
  }

  $x = [math]::Round(($size - $targetW) / 2)
  $y = [math]::Round(($size - $targetH) / 2)
  $dest = New-Object System.Drawing.Rectangle $x, $y, $targetW, $targetH

  if ($monochrome) {
    $imageAttr = New-Object System.Drawing.Imaging.ImageAttributes
    $matrix = New-Object System.Drawing.Imaging.ColorMatrix
    $matrix.Matrix00 = 0.299
    $matrix.Matrix01 = 0.299
    $matrix.Matrix02 = 0.299
    $matrix.Matrix10 = 0.587
    $matrix.Matrix11 = 0.587
    $matrix.Matrix12 = 0.587
    $matrix.Matrix20 = 0.114
    $matrix.Matrix21 = 0.114
    $matrix.Matrix22 = 0.114
    $matrix.Matrix33 = 1
    $matrix.Matrix44 = 1
    $imageAttr.SetColorMatrix($matrix)
    $graphics.DrawImage($source, $dest, 0, 0, $source.Width, $source.Height, [System.Drawing.GraphicsUnit]::Pixel, $imageAttr)
    $imageAttr.Dispose()
  } else {
    $graphics.DrawImage($source, $dest)
  }

  $path = Join-Path $assetsDir $name
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $source.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

Save-BrandAsset 'icon.png' 1024 0.78
Save-BrandAsset 'splash-icon.png' 1024 0.62 $true
Save-BrandAsset 'android-icon-background.png' 512 0.0
Save-BrandAsset 'android-icon-foreground.png' 512 0.76 $true
Save-BrandAsset 'android-icon-monochrome.png' 432 0.76 $true $true
Save-BrandAsset 'favicon.png' 48 0.88 $true

Write-Output 'Generated WeatherCheck brand assets from fixed logo source.'
