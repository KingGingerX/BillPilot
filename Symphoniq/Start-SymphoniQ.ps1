$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Url = "http://127.0.0.1:4173"
$ServerScript = Join-Path $Root "tools\serve.js"
$Dist = Join-Path $Root "dist"

function Test-SymphoniQServer {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 2
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

if (-not (Test-Path $Dist)) {
  Start-Process -FilePath "cmd.exe" -ArgumentList @("/c", "npm.cmd run build") -WorkingDirectory $Root -Wait -WindowStyle Hidden
}

if (-not (Test-SymphoniQServer)) {
  Start-Process -FilePath "node.exe" -ArgumentList @($ServerScript, $Dist) -WorkingDirectory $Root -WindowStyle Hidden

  $ready = $false
  for ($attempt = 0; $attempt -lt 20; $attempt += 1) {
    Start-Sleep -Milliseconds 250
    if (Test-SymphoniQServer) {
      $ready = $true
      break
    }
  }

  if (-not $ready) {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show("SymphoniQ did not start on $Url. Open PowerShell in $Root and run npm run validate.", "SymphoniQ")
    exit 1
  }
}

Start-Process "chrome.exe" -ArgumentList $Url
