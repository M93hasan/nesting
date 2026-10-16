@echo off
setlocal EnableExtensions
title Serula Nesting - Tek Tik Kurulum
echo Serula Bridge otomatik kurulumu basliyor...
echo UAC onayi sorulursa sadece yerel baglanti izni icin EVET secin.
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';$url='https://raw.githubusercontent.com/M93hasan/nesting/bbf1ca40e4c9fa5c58c48e18c4a0c7a07999e2ad/integrations/windows/InstallSerulaBridge.ps1';$temp=Join-Path $env:TEMP ('SerulaInstall-'+[guid]::NewGuid().ToString('N')+'.ps1');try{[Net.ServicePointManager]::SecurityProtocol=[Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12;Invoke-WebRequest -Uri $url -UseBasicParsing -OutFile $temp -TimeoutSec 30;$bytes=[IO.File]::ReadAllBytes($temp);$head=[Text.Encoding]::ASCII.GetBytes('blob '+$bytes.Length+[char]0);$blob=New-Object byte[] ($head.Length+$bytes.Length);[Array]::Copy($head,0,$blob,0,$head.Length);[Array]::Copy($bytes,0,$blob,$head.Length,$bytes.Length);$actual=([BitConverter]::ToString([Security.Cryptography.SHA1]::Create().ComputeHash($blob))).Replace('-','').ToLowerInvariant();if($actual -ne 'd736b9e84e055e1dec76b3c652842a9ec8d6b7f9'){throw 'Installer integrity check failed'};& $temp}catch{Write-Host ('INSTALL ERROR: '+$_.Exception.Message) -ForegroundColor Red;exit 1}finally{Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue}"
if errorlevel 1 goto failed
echo.
echo Kurulum tamamlandi. Serula Nesting icinden aktarmayi deneyebilirsiniz.
pause
exit /b 0
:failed
echo.
echo Kurulum basarisiz. Yukaridaki hata mesajini kontrol edin.
pause
exit /b 1
