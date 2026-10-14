# One-click installation for Serula Nesting local Windows bridge.
# Bridge source is pinned to a specific GitHub commit. Run as the current user.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$commit = '8f0617d3ffdcb210c8d4c9fbe71fe0f28e682dad'
$url = "https://raw.githubusercontent.com/M93hasan/nesting/$commit/integrations/windows/SerulaTransferBridge.ps1"
$blobSha = '363cf3d4e287bdc9a6fe34531a0ce58f531cc4e5'
$prefix = 'http://127.0.0.1:43842/'
$folder = Join-Path $env:LOCALAPPDATA 'SerulaBridge'
$file = Join-Path $folder 'SerulaTransferBridge.ps1'
$startup = Join-Path ([Environment]::GetFolderPath('Startup')) 'Serula Bridge.lnk'
$healthUrl = 'http://127.0.0.1:43842/health'

function Healthy {
  try {
    $v = Invoke-RestMethod -Method Get -Uri $healthUrl -TimeoutSec 2
    return ($v.ok -eq $true -and $v.service -eq 'serula-bridge')
  } catch { return $false }
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
$temp = Join-Path $env:TEMP ('serula-install-' + [guid]::NewGuid().ToString('N') + '.ps1')
try {
  Write-Host 'Downloading Serula Bridge from an immutable GitHub revision...'
  Invoke-WebRequest -Uri $url -OutFile $temp -TimeoutSec 30 -UseBasicParsing
  Check-Source $temp
  Copy-Item -LiteralPath $temp -Destination $file -Force
} finally { Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue }

if (-not (Healthy)) {
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
