# Serula Nesting local transfer bridge for Windows PowerShell 5.1 (STA).
# Run locally. Accepts requests only from the Serula web origin and validates
# a short-lived server ticket before opening any received DXF.
param([int]$Port=43842)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
# Native activation is needed when Windows denies WScript.Shell.AppActivate.
# Never send keys unless the target RDWorks process owns the foreground window.
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class SerulaWindowApi {
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr h, int mode);
    [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr h);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    [DllImport("user32.dll")] public static extern int GetClassName(IntPtr h, StringBuilder buffer, int max);
    [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint source, uint dest, bool attach);
    [DllImport("user32.dll")] public static extern void keybd_event(byte virtualKey, byte scanCode, uint flags, UIntPtr extraInfo);
}
'@
function ForegroundProcessId {
  $handle=[SerulaWindowApi]::GetForegroundWindow()
  if($handle -eq [IntPtr]::Zero){return 0}
  [uint32]$processId=0
  $null=[SerulaWindowApi]::GetWindowThreadProcessId($handle,[ref]$processId)
  return [int]$processId
}
function Activate-RDWorks($rd) {
  $handle=[IntPtr]$rd.MainWindowHandle
  if($handle -eq [IntPtr]::Zero){return $false}
  $shell=New-Object -ComObject WScript.Shell
  for($attempt=0;$attempt -lt 4;$attempt++){
    if((ForegroundProcessId) -eq $rd.Id){return $true}
    $null=[SerulaWindowApi]::ShowWindowAsync($handle,9) # SW_RESTORE
    try{$null=$shell.AppActivate([int]$rd.Id)}catch{}
    if((ForegroundProcessId) -eq $rd.Id){return $true}
    try{$null=$shell.AppActivate([string]$rd.MainWindowTitle)}catch{}
    if((ForegroundProcessId) -eq $rd.Id){return $true}
    $null=[SerulaWindowApi]::BringWindowToTop($handle)
    $null=[SerulaWindowApi]::SetForegroundWindow($handle)
    if((ForegroundProcessId) -eq $rd.Id){return $true}
    $foreground=[SerulaWindowApi]::GetForegroundWindow()
    [uint32]$foregroundPid=0
    [uint32]$targetPid=0
    $foregroundThread=if($foreground -ne [IntPtr]::Zero){[SerulaWindowApi]::GetWindowThreadProcessId($foreground,[ref]$foregroundPid)}else{0}
    $targetThread=[SerulaWindowApi]::GetWindowThreadProcessId($handle,[ref]$targetPid)
    $ownThread=[SerulaWindowApi]::GetCurrentThreadId()
    if($targetThread -ne 0 -and $foregroundThread -ne 0){
      $attachedForeground=$false;$attachedTarget=$false
      try{
        if($ownThread -ne $foregroundThread){$attachedForeground=[SerulaWindowApi]::AttachThreadInput($ownThread,$foregroundThread,$true)}
        if($ownThread -ne $targetThread){$attachedTarget=[SerulaWindowApi]::AttachThreadInput($ownThread,$targetThread,$true)}
        $null=[SerulaWindowApi]::BringWindowToTop($handle)
        $null=[SerulaWindowApi]::SetForegroundWindow($handle)
      }finally{
        if($attachedTarget){$null=[SerulaWindowApi]::AttachThreadInput($ownThread,$targetThread,$false)}
        if($attachedForeground){$null=[SerulaWindowApi]::AttachThreadInput($ownThread,$foregroundThread,$false)}
      }
      if((ForegroundProcessId) -eq $rd.Id){return $true}
    }
    # Windows blocks SetForegroundWindow for background services, even if the
    # target HWND is valid. A synthetic Alt key transition sometimes permits
    # activation; we still verify the true foreground owner before SendKeys.
    if($attempt -eq 2){
      [SerulaWindowApi]::keybd_event(0x12,0,0,[UIntPtr]::Zero)
      [SerulaWindowApi]::keybd_event(0x12,0,2,[UIntPtr]::Zero)
      $null=[SerulaWindowApi]::ShowWindowAsync($handle,9)
      $null=[SerulaWindowApi]::SetForegroundWindow($handle)
      Start-Sleep -Milliseconds 200
      if((ForegroundProcessId) -eq $rd.Id){return $true}
    }
    Start-Sleep -Milliseconds 250
  }
  return $false
}
function Wait-RDWorksImportDialog($rd,$mainHandle) {
  for($i=0;$i -lt 20;$i++){
    Start-Sleep -Milliseconds 150
    $active=[SerulaWindowApi]::GetForegroundWindow()
    if($active -eq [IntPtr]::Zero -or $active -eq $mainHandle){continue}
    if((ForegroundProcessId) -ne $rd.Id){continue}
    # Only type into a separate dialog owned by RDWorks, never the drawing canvas.
    return $true
  }
  return $false
}
$origin='https://serula.site'
$folder=Join-Path $env:LOCALAPPDATA 'SerulaBridge\Transfers'
[System.IO.Directory]::CreateDirectory($folder) | Out-Null
# Remove previous temporary drawings older than seven days.
Get-ChildItem -LiteralPath $folder -Filter '*.dxf' -File -ErrorAction SilentlyContinue | Where-Object {$_.LastWriteTime -lt (Get-Date).AddDays(-7)} | Remove-Item -Force -ErrorAction SilentlyContinue
$listener=New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
try {$listener.Start()}catch {
  Write-Host "Bridge dinleyemiyor. Portu kontrol edin veya URL ACL için yönetici yetkisi tanımlayın: netsh http add urlacl url=http://127.0.0.1:$Port/ user=$env:USERDOMAIN\$env:USERNAME"
  throw
}
function Reply($context,[int]$status,$payload){
  $response=$context.Response
  $response.StatusCode=$status
  $response.ContentType='application/json; charset=utf-8'
  $response.Headers.Add('Access-Control-Allow-Origin',$origin)
  $response.Headers.Add('Access-Control-Allow-Methods','GET, POST, OPTIONS')
  $response.Headers.Add('Access-Control-Allow-Headers','content-type')
  $response.Headers.Add('Access-Control-Allow-Private-Network','true')
  $response.Headers.Add('Vary','Origin')
  $data=[Text.Encoding]::UTF8.GetBytes(($payload | ConvertTo-Json -Compress -Depth 8))
  $response.ContentLength64=$data.Length
  $response.OutputStream.Write($data,0,$data.Length)
  $response.OutputStream.Close()
}
Write-Host "Serula Bridge hazır: http://127.0.0.1:$Port/health"
try {
 while($listener.IsListening){
  $ctx=$listener.GetContext()
  try{
    $req=$ctx.Request
    $reqOrigin=$req.Headers['Origin']
    if($req.HttpMethod -eq 'GET' -and $req.Url.AbsolutePath -eq '/health'){
      Reply $ctx 200 @{ok=$true;service='serula-bridge';version='1.2'}
      continue
    }
    if($reqOrigin -ne $origin){Reply $ctx 403 @{ok=$false;error='Origin izinli değil.'};continue}
    if($req.HttpMethod -eq 'OPTIONS'){Reply $ctx 200 @{ok=$true};continue}
    if($req.HttpMethod -ne 'POST' -or $req.Url.AbsolutePath -ne '/transfer'){Reply $ctx 404 @{ok=$false;error='Bilinmeyen istek.'};continue}
    if($req.ContentLength64 -gt 15000000){Reply $ctx 413 @{ok=$false;error='DXF aktarımı 15 MB sınırını aşıyor.'};continue}
    $reader=New-Object System.IO.StreamReader($req.InputStream,[Text.Encoding]::UTF8)
    $raw=$reader.ReadToEnd();$reader.Close()
    if($raw.Length -gt 15000000){Reply $ctx 413 @{ok=$false;error='Çok büyük istek.'};continue}
    $data=$raw | ConvertFrom-Json
    $target=[string]$data.target
    $ticket=[string]$data.ticket
    $dxf=[string]$data.dxf
    if($target -notin @('corel','rdworks') -or $ticket -notmatch '^[a-f0-9]{64}$' -or $dxf.Length -lt 20 -or $dxf -notmatch '(?m)^EOF\s*$'){
      Reply $ctx 400 @{ok=$false;error='Geçersiz aktarım verisi.'};continue
    }
    # A browser UI toggle alone is not permission. Verify the one-time ticket
    # against Cloudflare, so disabled users cannot submit payloads to this bridge.
    try{
      $permission=Invoke-RestMethod -Uri "$origin/api/transfer/redeem" -Method POST -ContentType 'application/json' -Body (@{ticket=$ticket;target=$target} | ConvertTo-Json -Compress) -TimeoutSec 15
      if($permission.ok -ne $true){throw 'Yetki reddedildi.'}
    }catch{Reply $ctx 403 @{ok=$false;error='Aktarım izni doğrulanamadı.'};continue}
    $tempPath=Join-Path $folder (([guid]::NewGuid().ToString('N'))+'.dxf')
    [System.IO.File]::WriteAllText($tempPath,$dxf,(New-Object System.Text.UTF8Encoding($false)))
    if($target -eq 'corel'){
      $app=$null
      foreach($progId in @('CorelDRAW.Application','CorelDRAW.Application.27','CorelDRAW.Application.26','CorelDRAW.Application.25','CorelDRAW.Application.24')){
        try {$app=New-Object -ComObject $progId;break}catch{}
      }
      if($null -eq $app){throw 'CorelDRAW COM otomasyonu bulunamadı. Program kurulu mu?'}
      $app.Visible=$true
      $null=$app.OpenDocument($tempPath)
      Reply $ctx 200 @{ok=$true;message="DXF, CorelDRAW'da açıldı. Kalıcı dosya kaydı yapılmadı."}
    }else{
      # RDWorks does not provide a reliable public automation API. Request its
      # Import dialog via UI. User should verify the file in RDWorks afterward.
      $rd=Get-Process -ErrorAction SilentlyContinue | Where-Object {$_.ProcessName -match '^(RDWorks.*|RDLaser.*)$' -and $_.MainWindowHandle -ne 0} | Select-Object -First 1
      if(!$rd){throw 'RDWorks açık değil. RDWorks penceresini başlatın.'}
      if(!(Activate-RDWorks $rd)){
        # Windows sometimes refuses keyboard focus regardless of Win32 calls.
        # Avoid typing into the wrong window. Leave the prepared, authorized
        # DXF in the temporary folder and put its path on the clipboard instead.
        try{
          [System.Windows.Forms.Clipboard]::SetText($tempPath)
          throw 'RDWorks Windows tarafindan one getirilemedi. DXF dosya yolu panoya kopyalandi. RDWorks penceresine tiklayin, Ctrl+I ve Ctrl+V ardindan Enter basin. Yeniden DXF kaydetmenize gerek yok. RDWorks yonetici olarak aciksa normal yetkiyle yeniden baslatin.'
        }catch{
          if($_.Exception.Message -like 'RDWorks Windows tarafindan*'){throw}
          throw ('RDWorks penceresi etkinlestirilemedi. Gecici DXF: '+$tempPath+' ; RDWorks uzerinden Ctrl+I ile bu yolu acin.')
        }
      }
      $shell=New-Object -ComObject WScript.Shell
      $shell.SendKeys('^i')
      if(!(Wait-RDWorksImportDialog $rd ([IntPtr]$rd.MainWindowHandle))){
        throw 'RDWorks icinde Import penceresi algilanamadi. RDWorks surumunde Ctrl+I ile Import acildigini kontrol edin.'
      }
      # Clipboard paste supports paths containing Turkish/Unicode user names.
      # Restore the original clipboard data after the filename is submitted.
      $oldClipboard=[System.Windows.Forms.Clipboard]::GetDataObject()
      try{
        [System.Windows.Forms.Clipboard]::SetText($tempPath)
        $shell.SendKeys('^v')
        Start-Sleep -Milliseconds 200
        if((ForegroundProcessId) -ne $rd.Id){throw 'RDWorks dosya secme penceresi odagi kaybetti. Komut iptal edildi.'}
        $shell.SendKeys('{ENTER}')
      }finally{
        if($null -ne $oldClipboard){try{[System.Windows.Forms.Clipboard]::SetDataObject($oldClipboard,$true)}catch{}}
      }
      Reply $ctx 200 @{ok=$true;message='RDWorks dosya ice aktarma komutu gonderildi. Parcalarin acildigini RDWorks penceresinde kontrol edin.'}
    }
  }catch{
    try{Reply $ctx 500 @{ok=$false;error=$_.Exception.Message}}catch{}
  }
 }
}finally{$listener.Stop();$listener.Close()}
