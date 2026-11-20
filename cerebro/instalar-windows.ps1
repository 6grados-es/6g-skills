# instalar-windows.ps1 - instala el cerebro de 6 Grados en Windows. No necesita git ni Node: solo PowerShell, que ya trae Windows.
#
#   irm https://raw.githubusercontent.com/6grados-es/6g-skills/main/cerebro/instalar-windows.ps1 | iex
#   powershell -ExecutionPolicy Bypass -File instalar-windows.ps1 -Destino <carpeta>    pone 'Cerebro' dentro de esa carpeta
#   (tambien: $env:CEREBRO_DESTINO = "<carpeta>" antes de lanzarlo)
#   $env:CEREBRO_PRUEBA = 1 deja lanzarlo fuera de Windows (solo para probarlo con PowerShell en Mac o Linux).
#
# Baja la plantilla de https://github.com/6grados-es/cerebro-simple y la copia como carpeta 'Cerebro' dentro de la nube
# que ya uses (OneDrive, Google Drive o iCloud Drive) o, si no hay ninguna, en Documentos.
# Nunca pisa un cerebro que ya exista y no lee, mueve ni borra ningun otro archivo tuyo.
param([string]$Destino = $env:CEREBRO_DESTINO)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch {}

$ZipUrl = 'https://github.com/6grados-es/cerebro-simple/archive/refs/heads/main.zip'
$Nombre = 'Cerebro'
function Ok($m)    { Write-Host "  [ok] $m" -ForegroundColor Green }
function Mal($m)   { Write-Host "  [x]  $m" -ForegroundColor Red }
function Aviso($m) { Write-Host "  [!]  $m" -ForegroundColor Yellow }

function Instalar-Cerebro {
  Write-Host '==> Cerebro de 6 Grados - instalador de Windows'

  $esWindows = ($env:OS -eq 'Windows_NT') -or ($PSVersionTable.PSVersion.Major -ge 6 -and $IsWindows)
  if (-not $esWindows -and -not $env:CEREBRO_PRUEBA) {
    Mal 'Este instalador es para Windows. En Mac abre Terminal y pega:'
    Write-Host '      curl -fsSL https://raw.githubusercontent.com/6grados-es/6g-skills/main/cerebro/instalar-mac.sh | bash'
    return 1
  }

  # 1. Donde va la carpeta: la nube que ya este sincronizada en este ordenador; si no hay, Documentos.
  if (-not $Destino) {
    $nubes = @()
    foreach ($v in 'OneDrive', 'OneDriveConsumer', 'OneDriveCommercial') {
      $p = [Environment]::GetEnvironmentVariable($v)
      if ($p -and (Test-Path -LiteralPath $p) -and ($nubes.Ruta -notcontains $p)) { $nubes += [pscustomobject]@{ Nombre = "OneDrive ($(Split-Path $p -Leaf))"; Ruta = $p } }
    }
    $candidatosDrive = @()
    foreach ($letra in 'G', 'H', 'I', 'J', 'K') { foreach ($u in 'Mi unidad', 'My Drive') { $candidatosDrive += "${letra}:\$u" } }
    if ($env:USERPROFILE) { foreach ($u in 'Mi unidad', 'My Drive', 'Google Drive') { $candidatosDrive += (Join-Path $env:USERPROFILE $u) } }
    foreach ($p in $candidatosDrive) {
      if (Test-Path -LiteralPath $p) { $nubes += [pscustomobject]@{ Nombre = "Google Drive ($p)"; Ruta = $p }; break }
    }
    if ($env:USERPROFILE) {
      $ic = Join-Path $env:USERPROFILE 'iCloudDrive'
      if (Test-Path -LiteralPath $ic) { $nubes += [pscustomobject]@{ Nombre = 'iCloud Drive'; Ruta = $ic } }
    }

    if ($nubes.Count -eq 0) {
      $Destino = [Environment]::GetFolderPath('MyDocuments')
      Aviso 'No he encontrado ninguna nube sincronizada (OneDrive, Google Drive, iCloud Drive): va a Documentos.'
      Aviso 'Ahi no tiene copia de seguridad: cuando tengas una nube, mueve la carpeta dentro.'
    } elseif ($nubes.Count -eq 1) {
      $Destino = $nubes[0].Ruta; Ok "Nube encontrada: $($nubes[0].Nombre)"
    } else {
      # Ya hay un cerebro en alguna de ellas: esa manda.
      foreach ($n in $nubes) { if (Test-Path -LiteralPath (Join-Path (Join-Path $n.Ruta $Nombre) 'CLAUDE.md')) { $Destino = $n.Ruta } }
      if (-not $Destino) {
        Write-Host "  Tienes varias nubes. En cual pongo la carpeta $Nombre?"
        for ($i = 0; $i -lt $nubes.Count; $i++) { Write-Host "    $($i + 1). $($nubes[$i].Nombre)" }
        $eleccion = 1
        try {
          $r = Read-Host '  Escribe el numero y pulsa Intro [1]'
          if ($r -match '^\d+$' -and [int]$r -ge 1 -and [int]$r -le $nubes.Count) { $eleccion = [int]$r }
        } catch {}
        $Destino = $nubes[$eleccion - 1].Ruta
        Ok "Va a: $($nubes[$eleccion - 1].Nombre) (para otra: -Destino <carpeta>)"
      }
    }
  }

  if (-not (Test-Path -LiteralPath $Destino -PathType Container)) { Mal "No existe la carpeta $Destino"; return 1 }
  $Cerebro = Join-Path $Destino $Nombre

  # 2. Nunca se pisa un cerebro que ya existe.
  if (Test-Path -LiteralPath (Join-Path $Cerebro 'CLAUDE.md')) {
    Ok "Ya tienes un cerebro en: $Cerebro"
    Write-Host '  No he tocado nada. Abrelo en la pestana Code de la app de Claude y sigue usandolo.'
    return 0
  }
  if ((Test-Path -LiteralPath $Cerebro) -and (Get-ChildItem -LiteralPath $Cerebro -Force | Select-Object -First 1)) {
    Mal "Ya existe $Cerebro y tiene cosas dentro que no son un cerebro. No la toco."
    Write-Host '  Cambiale el nombre a esa carpeta, o elige otro sitio con: -Destino <carpeta>'
    return 1
  }

  # 3. Bajar la plantilla y copiarla (tambien la carpeta oculta .claude).
  $tmp = Join-Path ([IO.Path]::GetTempPath()) ("cerebro-" + [Guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $tmp | Out-Null
  try {
    Write-Host '  Bajando la plantilla...'
    $zip = Join-Path $tmp 'cerebro.zip'
    try { Invoke-WebRequest -Uri $ZipUrl -OutFile $zip -UseBasicParsing }
    catch { Mal 'No he podido bajar la plantilla. Mira si tienes internet y repite.'; return 1 }
    Expand-Archive -LiteralPath $zip -DestinationPath $tmp -Force
    $plantilla = Get-ChildItem -LiteralPath $tmp -Directory | ForEach-Object { Join-Path $_.FullName 'plantilla' } |
      Where-Object { Test-Path -LiteralPath (Join-Path $_ 'CLAUDE.md') } | Select-Object -First 1
    if (-not $plantilla) { Mal 'El zip no trae la carpeta plantilla. Avisa a 6 Grados (hola@6grados.es).'; return 1 }
    Get-ChildItem -LiteralPath $plantilla -Recurse -Force -Directory -Filter '__pycache__' | Remove-Item -Recurse -Force
    New-Item -ItemType Directory -Path $Cerebro -Force | Out-Null
    Get-ChildItem -LiteralPath $plantilla -Force | Copy-Item -Destination $Cerebro -Recurse -Force
  } finally {
    Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
  }

  # 4. Comprobar.
  $falta = $false
  foreach ($f in 'CLAUDE.md', 'INDICE.md', 'fichas/yo.md', '.claude/skills/instalar-cerebro/SKILL.md') {
    if (-not (Test-Path -LiteralPath (Join-Path $Cerebro $f))) { Mal "Falta $f"; $falta = $true }
  }
  if ($falta) { Mal "La copia ha quedado a medias en $Cerebro. Borra esa carpeta y repite."; return 1 }
  Ok "Cerebro instalado en: $Cerebro"

  # 5. Python: lo usa 'Instala mi cerebro' para leer tus chats antiguos.
  $hayPython = $false
  foreach ($c in 'python', 'python3', 'py') {
    if (Get-Command $c -ErrorAction SilentlyContinue) {
      try { $v = & $c --version 2>&1; if ("$v" -match 'Python 3\.') { $hayPython = $true; break } } catch {}
    }
  }
  if ($hayPython) { Ok 'Python 3 esta instalado' }
  else { Aviso 'No encuentro Python 3. Hace falta para leer tus chats antiguos: instalalo desde la Microsoft Store (busca Python) o desde https://www.python.org/downloads/' }

  Write-Host ''
  Write-Host 'Siguientes pasos:'
  Write-Host '  1. Abre la app de Claude y entra en la pestana Code.'
  Write-Host "  2. Elige como carpeta de trabajo: $Cerebro"
  Write-Host '     y dejala por defecto. Modelo: Sonnet o superior.'
  Write-Host '  3. En un chat nuevo escribe: Instala mi cerebro'
  Write-Host '     Te explicara como pedir la exportacion de tus chats de Claude y los leera para llenarlo.'
  return 0
}

$codigo = Instalar-Cerebro
if ($MyInvocation.MyCommand.Path) { exit $codigo }
