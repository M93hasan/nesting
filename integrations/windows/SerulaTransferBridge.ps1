# Serula Nesting local transfer bridge. CorelDRAW only.
param([int]$Port=43842)
$ErrorActionPreference='Stop'
$origin='https://serula.site'
$folder=Join-Path $env:LOCALAPPDATA 'SerulaBridge\Transfers'
[System.IO.Directory]::CreateDirectory($folder) | Out-Null
Get-ChildItem -LiteralPath $folder -Filter '*.dxf' -File -ErrorAction SilentlyContinue |
  Where-Object {$_.LastWriteTime -lt (Get-Date).AddDays(-7)} |
  Remove-Item -Force -ErrorAction SilentlyContinue
$listener=New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
try {$listener.Start()}catch {
  Write-Host "Serula Bridge dinleyemiyor. URL ACL ve portu kontrol edin."
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
try {
  while($listener.IsListening){
    $ctx=$listener.GetContext()
    try{
      $req=$ctx.Request
      if($req.HttpMethod -eq 'GET' -and $req.Url.AbsolutePath -eq '/health'){
        Reply $ctx 200 @{ok=$true;service='serula-bridge';version='1.6';supportedTargets=@('corel')}
        continue
      }
      if($req.Headers['Origin'] -ne $origin){
        Reply $ctx 403 @{ok=$false;error='Origin izinli değil.'}
        continue
      }
      if($req.HttpMethod -eq 'OPTIONS'){
        Reply $ctx 200 @{ok=$true}
        continue
      }
      if($req.HttpMethod -ne 'POST' -or $req.Url.AbsolutePath -ne '/transfer'){
        Reply $ctx 404 @{ok=$false;error='Bilinmeyen istek.'}
        continue
      }
      if($req.ContentLength64 -gt 15000000){
        Reply $ctx 413 @{ok=$false;error='DXF aktarımı 15 MB sınırını aşıyor.'}
        continue
      }
      $reader=New-Object System.IO.StreamReader($req.InputStream,[Text.Encoding]::UTF8)
      try{$raw=$reader.ReadToEnd()}finally{$reader.Close()}
      if($raw.Length -gt 15000000){
        Reply $ctx 413 @{ok=$false;error='Çok büyük istek.'}
        continue
      }
      $payload=$raw | ConvertFrom-Json
      $target=[string]$payload.target
      $ticket=[string]$payload.ticket
      $dxf=[string]$payload.dxf
      if($target -ne 'corel' -or $ticket -notmatch '^[a-f0-9]{64}$' -or
        $dxf.Length -lt 20 -or $dxf -notmatch '(?m)^EOF\s*$'){
        Reply $ctx 400 @{ok=$false;error='Geçersiz CorelDRAW aktarım verisi.'}
        continue
      }
      try{
        $permission=Invoke-RestMethod -Uri "$origin/api/transfer/redeem" -Method POST -ContentType 'application/json' -Body (@{ticket=$ticket;target=$target} | ConvertTo-Json -Compress) -TimeoutSec 15
        if($permission.ok -ne $true){throw 'Yetki reddedildi.'}
      }catch{
        Reply $ctx 403 @{ok=$false;error='Aktarım izni doğrulanamadı.'}
        continue
      }
      $tempPath=Join-Path $folder (([guid]::NewGuid().ToString('N'))+'.dxf')
      [System.IO.File]::WriteAllText($tempPath,$dxf,(New-Object System.Text.UTF8Encoding($false)))
      $app=$null
      foreach($progId in @('CorelDRAW.Application','CorelDRAW.Application.27','CorelDRAW.Application.26','CorelDRAW.Application.25','CorelDRAW.Application.24')){
        try{$app=New-Object -ComObject $progId;break}catch{}
      }
      if($null -eq $app){throw 'CorelDRAW COM otomasyonu bulunamadı. Program kurulu mu?'}
      $app.Visible=$true
      $null=$app.OpenDocument($tempPath)
      Reply $ctx 200 @{ok=$true;message='DXF CorelDRAW uygulamasında açıldı.'}
    }catch{
      try{Reply $ctx 500 @{ok=$false;error=$_.Exception.Message}}catch{}
    }
  }
}finally{$listener.Stop();$listener.Close()}
