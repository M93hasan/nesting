@echo off
setlocal EnableExtensions
title Serula Nesting - Tek Tik Kurulum
echo Serula Bridge otomatik kurulumu basliyor...
echo UAC onayi sorulursa sadece yerel baglanti izni icin EVET secin.
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';$url='https://raw.githubusercontent.com/M93hasan/nesting/0720dca9b3b5b119c6f3c3ff22f7c49c4895a8f5/integrations/windows/InstallSerulaBridge.ps1';$temp=Join-Path $env:TEMP ('SerulaInstall-'+[guid]::NewGuid().ToString('N')+'.ps1');try{[Net.ServicePointManager]::SecurityProtocol=[Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12;Invoke-WebRequest -Uri $url -UseBasicParsing -OutFile $temp -TimeoutSec 30;$bytes=[IO.File]::ReadAllBytes($temp);$head=[Text.Encoding]::ASCII.GetBytes('blob '+$bytes.Length+[char]0);$blob=New-Object byte[] ($head.Length+$bytes.Length);[Array]::Copy($head,0,$blob,0,$head.Length);[Array]::Copy($bytes,0,$blob,$head.Length,$bytes.Length);$actual=([BitConverter]::ToString([Security.Cryptography.SHA1]::Create().ComputeHash($blob))).Replace('-','').ToLowerInvariant();if($actual -ne 'aa004ab476aed32cc99594565e581f686d2a75d5'){throw 'Installer integrity check failed'};& $temp}catch{Write-Host ('INSTALL ERROR: '+$_.Exception.Message) -ForegroundColor Red;exit 1}finally{Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue}"
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
