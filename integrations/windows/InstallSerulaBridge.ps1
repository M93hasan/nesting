# One-click installation for Serula Nesting local Windows bridge.
# Bridge source is pinned to a specific GitHub commit. Run as the current user.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$commit = 'a66023e0f7b79642d281e5715d11dff86aa95029'
$url = "https://raw.githubusercontent.com/M93hasan/nesting/$commit/integrations/windows/SerulaTransferBridge.ps1"
$blobSha = 'de60a18d82883009afe12a2857dc7b36f7bbbab8'
$bridgeVersion = '1.5'
$prefix = 'http://127.0.0.1:43842/'
$folder = Join-Path $env:LOCALAPPDATA 'SerulaBridge'
$file = Join-Path $folder 'SerulaTransferBridge.ps1'
$startup = Join-Path ([Environment]::GetFolderPath('Startup')) 'Serula Bridge.lnk'
$healthUrl = 'http://127.0.0.1:43842/health'

function Healthy {
  try {
    $v = Invoke-RestMethod -Method Get -Uri $healthUrl -TimeoutSec 2
    return ($v.ok -eq $true -and $v.service -eq 'serula-bridge' -and
      [version]$v.version -ge [version]$bridgeVersion)
  } catch { return $false }
}
# Prevent web installation from overwriting a newer PC-bundled bridge.
function Keep-NewerBridge {
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { return $false }
  try {
    $existing = Get-Content -LiteralPath $file -Raw -ErrorAction Stop
    if ($existing -match "service='serula-bridge';version='([0-9]+(?:\.[0-9]+){1,3})'") {
      return ([version]$matches[1] -gt [version]$bridgeVersion)
    }
  } catch {}
  return $false
}
function Check-Source($path) {
  # Verify the precise Git blob, not just a filename on GitHub.
  $bytes = [IO.File]::ReadAllBytes($path)
  $prefixBytes = [Text.Encoding]::ASCII.GetBytes("blob $($bytes.Length)" + [char]0)
  $blob = New-Object byte[] ($prefixBytes.Length + $bytes.Length)
  [Array]::Copy($prefixBytes,0,$blob,0,$prefixBytes.Length)
  [Array]::Copy($bytes,0,$blob,$prefixBytes.Length,$bytes.Length)
  $hash = [Security.Cryptography.SHA1]::Create()
  try { $actual = ([BitConverter]::ToString($hash.ComputeHash($blob))).Replace('-','').ToLowerInvariant() }
  finally { $hash.Dispose() }
  if($actual -ne $blobSha) { throw 'Downloaded file failed version verification.' }
}

if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'Windows is required.' }
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
[IO.Directory]::CreateDirectory($folder) | Out-Null
if (Keep-NewerBridge) {
  Write-Host 'A newer Serula Bridge is already installed; keeping it.'
} else {
  $temp = Join-Path $env:TEMP ('serula-install-' + [guid]::NewGuid().ToString('N') + '.ps1')
  try {
    Write-Host 'Downloading Serula Bridge from an immutable GitHub revision...'
    Invoke-WebRequest -Uri $url -OutFile $temp -TimeoutSec 30 -UseBasicParsing
    Check-Source $temp
    # PowerShell 5.1 treats files without BOM as the local ANSI codepage.
    # Keep the UTF-8 BOM supplied by the pinned bridge source.
    Copy-Item -LiteralPath $temp -Destination $file -Force
  } finally { Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue }
}

if (-not (Healthy)) {
  # An older installed bridge stays alive after its PS1 file is replaced.
  # Stop only the current user's matching local script, never arbitrary PowerShell.
  $existing = @(Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction Stop |
    Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -and
      $_.CommandLine.Contains($file) -and $_.SessionId -eq (Get-Process -Id $PID).SessionId })
  foreach($process in $existing){
    Write-Host ("Stopping older Serula Bridge PID " + $process.ProcessId)
    Stop-Process -Id $process.ProcessId -Force -ErrorAction Stop
  }
  if($existing.Count -gt 0){Start-Sleep -Milliseconds 600}
  # If another process owns the localhost port, do not report a false success.
  try{
    $running=Invoke-RestMethod -Uri $healthUrl -TimeoutSec 2
    if($running.ok -eq $true -and $running.service -eq 'serula-bridge' -and $running.version -ne $bridgeVersion){
      throw 'An older Serula Bridge is still running. Close it and retry the installer.'
    }
  }catch{
    if($_.Exception.Message -like '*older Serula Bridge*'){throw}
  }
  & netsh.exe http show urlacl "url=$prefix" *> $null
  if ($LASTEXITCODE -ne 0) {
    # Only current Windows user is granted access, not everyone.
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    if($sid -notmatch '^S-1-[0-9-]+$'){throw 'Unable to determine Windows user SID.'}
    $cmd = "& netsh.exe http add urlacl url=$prefix " + ("'sddl=D:(A;;GX;;;" + $sid + ")'") + '; exit $LASTEXITCODE'
    $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($cmd))
    Write-Host 'Approve the one-time Windows administrator prompt for localhost access.'
    $grant = Start-Process powershell.exe -Verb RunAs -Wait -PassThru -ArgumentList @('-NoProfile','-EncodedCommand',$encoded)
    if($grant.ExitCode -ne 0){throw 'Localhost reservation failed or administrator permission was declined.'}
  }
  $args = '-NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $file + '"'
  $process = Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -ArgumentList $args -PassThru -WindowStyle Hidden
  $started = $false
  for($i=0;$i -lt 20;$i++) {
    Start-Sleep -Milliseconds 300
    if(Healthy){$started=$true;break}
    if($process.HasExited){break}
  }
  if(-not $started){throw 'Bridge could not start. Run the installed PS1 manually to see the error.'}
}

$sc = (New-Object -ComObject WScript.Shell).CreateShortcut($startup)
$sc.TargetPath = Join-Path $PSHOME 'powershell.exe'
$sc.Arguments = '-NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $file + '"'
$sc.WorkingDirectory = $folder
$sc.WindowStyle = 7
$sc.Description = 'Serula Nesting local CorelDRAW and RDWorks bridge'
$sc.Save()
Write-Host ''
Write-Host 'SERULA BRIDGE INSTALLED' -ForegroundColor Green
Write-Host "Ready: $healthUrl"
Write-Host 'Automatic start: enabled for this Windows user.'
