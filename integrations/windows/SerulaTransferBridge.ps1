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
using System.Collections.Generic;
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
    [DllImport("user32.dll")] public static extern IntPtr GetWindow(IntPtr h, uint command);
    [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder output, int max);
    public delegate bool EnumWindowsCallback(IntPtr h, IntPtr extra);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsCallback callback, IntPtr extra);
    public static IntPtr[] VisibleWindows() {
        List<IntPtr> result = new List<IntPtr>();
        EnumWindows((h, extra) => { if(IsWindowVisible(h)) result.Add(h); return true; }, IntPtr.Zero);
        return result.ToArray();
    }
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
# The stock RDWorks Open dialog often has a different process/thread context
# than its owner. Checking only the foreground PID incorrectly rejects it.
function IsRDWorksWindow([IntPtr]$window,[int]$rdProcessId) {
  for($i=0;$i -lt 10 -and $window -ne [IntPtr]::Zero;$i++){
    [uint32]$ownerPid=0
    $null=[SerulaWindowApi]::GetWindowThreadProcessId($window,[ref]$ownerPid)
    if([int]$ownerPid -eq $rdProcessId){return $true}
    $window=[SerulaWindowApi]::GetWindow($window,4) # GW_OWNER
  }
  return $false
}
function IsImportWindow([IntPtr]$window,$rd,[IntPtr]$mainHandle) {
  if($window -eq [IntPtr]::Zero -or $window -eq $mainHandle){return $false}
  if(![SerulaWindowApi]::IsWindowVisible($window)){return $false}
  if(!(IsRDWorksWindow $window ([int]$rd.Id))){return $false}
  $class=New-Object System.Text.StringBuilder 256
  $caption=New-Object System.Text.StringBuilder 256
  $null=[SerulaWindowApi]::GetClassName($window,$class,$class.Capacity)
  $null=[SerulaWindowApi]::GetWindowText($window,$caption,$caption.Capacity)
  return ($class.ToString() -eq '#32770' -or $caption.ToString() -match '(?i)import|open|dosya|aç|öffnen|ouvrir|abrir|导入|打开')
}
function Wait-RDWorksImportDialog($rd,[IntPtr]$mainHandle) {
  for($i=0;$i -lt 42;$i++){
    $foreground=[SerulaWindowApi]::GetForegroundWindow()
    if(IsImportWindow $foreground $rd $mainHandle){return $foreground}
    foreach($window in [SerulaWindowApi]::VisibleWindows()){
      if(IsImportWindow $window $rd $mainHandle){return $window}
    }
    Start-Sleep -Milliseconds 150
  }
  return [IntPtr]::Zero
}
function Import-DxfThroughDialog([IntPtr]$dialog,[string]$path) {
  # Use Windows UI Automation (the dialog's actual filename edit + Open
  # button), avoiding keyboard focus races and locale-dependent hotkeys.
  Add-Type -AssemblyName UIAutomationClient
  Add-Type -AssemblyName UIAutomationTypes
  $root=[System.Windows.Automation.AutomationElement]::FromHandle($dialog)
  if($null -eq $root){throw 'RDWorks Import penceresi UI Automation ile erişilebilir değil.'}
  $nodes=$root.FindAll(
    [System.Windows.Automation.TreeScope]::Descendants,
    [System.Windows.Automation.Condition]::TrueCondition
  )
  $fields=@()
  $openButtons=@()
  foreach($element in $nodes){
    try{
      if(!$element.Current.IsEnabled){continue}
      $controlType=$element.Current.ControlType
      $id=[string]$element.Current.AutomationId
      $name=[string]$element.Current.Name
      if($controlType -eq [System.Windows.Automation.ControlType]::Edit -or
         $controlType -eq [System.Windows.Automation.ControlType]::ComboBox){
        $score=0
        if($id -eq '1148'){$score=100}
        elseif($name -match '(?i)file\s*name|dosya\s*adı|dateiname|nom du fichier|nome file|nombre de archivo|文件名'){$score=85}
        elseif($controlType -eq [System.Windows.Automation.ControlType]::Edit -and $name -notmatch '(?i)search|ara|suchen'){$score=10}
        if($score -gt 0){$fields+=@{element=$element;score=$score}}
      }
      if($controlType -eq [System.Windows.Automation.ControlType]::Button){
        $score=0
        if($id -eq '1'){$score=100}
        elseif($name -match '(?i)^(open|aç|ouvrir|öffnen|abrir|打开)(\b|[(&\s])'){$score=80}
        if($score -gt 0){$openButtons+=@{element=$element;score=$score}}
      }
    }catch{/* Skip stale or inaccessible UIA elements. */}
  }
  $setFilename=$false
  foreach($entry in ($fields | Sort-Object -Property score -Descending)){
    $pattern=$null
    try{
      if($entry.element.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern,[ref]$pattern)){
        ([System.Windows.Automation.ValuePattern]$pattern).SetValue($path)
        $setFilename=$true
        break
      }
    }catch{/* Some RDWorks dialogs expose read-only combo boxes. */}
  }
  if(!$setFilename){
    # Only keyboard fallback after the matching file dialog has been identified.
    # Never paste into a random foreground application.
    $null=[SerulaWindowApi]::SetForegroundWindow($dialog)
    Start-Sleep -Milliseconds 140
    if([SerulaWindowApi]::GetForegroundWindow() -ne $dialog){
      throw 'RDWorks Import dosya alanına erişilemedi; dosya penceresi odaklanamadı.'
    }
    $editable=@($fields | Sort-Object -Property score -Descending |
      Where-Object {$_.element.Current.ControlType -eq [System.Windows.Automation.ControlType]::Edit} |
      Select-Object -First 1)
    if($editable.Count -eq 0){throw 'RDWorks dosya adı alanı bulunamadı.'}
    $editable[0].element.SetFocus()
    $oldClipboard=[System.Windows.Forms.Clipboard]::GetDataObject()
    try{
      [System.Windows.Forms.Clipboard]::SetText($path)
      $shell=New-Object -ComObject WScript.Shell
      $shell.SendKeys('^a')
      $shell.SendKeys('^v')
      Start-Sleep -Milliseconds 160
    }finally{
      if($null -ne $oldClipboard){
        try{[System.Windows.Forms.Clipboard]::SetDataObject($oldClipboard,$true)}catch{}
      }
    }
  }
  $clicked=$false
  foreach($entry in ($openButtons | Sort-Object -Property score -Descending)){
    $pattern=$null
    try{
      if($entry.element.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern,[ref]$pattern)){
        ([System.Windows.Automation.InvokePattern]$pattern).Invoke()
        $clicked=$true
        break
      }
    }catch{/* Try the next file-open button. */}
  }
  if(!$clicked){
    $null=[SerulaWindowApi]::SetForegroundWindow($dialog)
    Start-Sleep -Milliseconds 100
    if([SerulaWindowApi]::GetForegroundWindow() -ne $dialog){
      throw 'RDWorks Aç düğmesi otomatik etkinleştirilemedi.'
    }
    (New-Object -ComObject WScript.Shell).SendKeys('{ENTER}')
  }
  # A closed file picker is evidence that the selection was accepted, but not
  # proof of cutting readiness. Never start a laser job from this bridge.
  for($i=0;$i -lt 32;$i++){
    Start-Sleep -Milliseconds 160
    if(![SerulaWindowApi]::IsWindow($dialog)){return}
    if(![SerulaWindowApi]::IsWindowVisible($dialog)){return}
  }
  throw 'RDWorks dosya seçme penceresi kapanmadı. Dosya filtresi veya bir uyarı penceresi olabilir.'
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
      Reply $ctx 200 @{ok=$true;service='serula-bridge';version='1.3'}
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
      $dialog=Wait-RDWorksImportDialog $rd ([IntPtr]$rd.MainWindowHandle)
      if($dialog -eq [IntPtr]::Zero){
        throw 'RDWorks Import penceresi açılmadı. Aktarım gönderilmedi; RDWorks sürümünün Ctrl+I Import kısayolunu desteklediğini kontrol edin.'
      }
      Import-DxfThroughDialog $dialog $tempPath
      Reply $ctx 200 @{ok=$true;message='Yerleştirilmiş DXF, RDWorks Import penceresine otomatik gönderildi. RDWorks çalışma alanında çizimi ve ölçüleri kontrol edin.'}
    }
  }catch{
    try{Reply $ctx 500 @{ok=$false;error=$_.Exception.Message}}catch{}
  }
 }
}finally{$listener.Stop();$listener.Close()}
