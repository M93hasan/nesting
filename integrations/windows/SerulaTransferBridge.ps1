# Serula Nesting local transfer bridge for Windows PowerShell 5.1 (STA).
# Run locally. Accepts requests only from the Serula web origin and validates
# a short-lived server ticket before opening any received DXF.
param([int]$Port=43842)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
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
      Reply $ctx 200 @{ok=$true;service='serula-bridge';version='1.0'}
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
      $shell=New-Object -ComObject WScript.Shell
      if(!$shell.AppActivate([int]$rd.Id)){throw 'RDWorks penceresi etkinleştirilemedi.'}
      Start-Sleep -Milliseconds 400
      $shell.SendKeys('^i')
      Start-Sleep -Milliseconds 800
      $escaped=$tempPath.Replace('{','{{}').Replace('}','{}}').Replace('+','{+}').Replace('^','{^}').Replace('%','{%}').Replace('~','{~}').Replace('(','{(}').Replace(')','{)}')
      $shell.SendKeys($escaped)
      $shell.SendKeys('{ENTER}')
      Reply $ctx 200 @{ok=$true;message='RDWorks içe aktarma komutu gönderildi. Çizimin açıldığını RDWorks ekranında doğrulayın.'}
    }
  }catch{
    try{Reply $ctx 500 @{ok=$false;error=$_.Exception.Message}}catch{}
  }
 }
}finally{$listener.Stop();$listener.Close()}
