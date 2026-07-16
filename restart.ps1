# restart.ps1 — reliably kill servers by port and restart both.
$ErrorActionPreference = 'SilentlyContinue'

# Kill anything on port 3001 (backend) and 3000 (frontend) by owning PID.
foreach ($port in @(3001, 3000)) {
  $conns = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
  foreach ($c in $conns) {
    $p = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
    if ($p) { $p.Kill(); Write-Output "Killed PID $($p.Id) on port $port" }
  }
}
# Also kill any lingering tsx/vite node servers for this project.
Get-Process node -ErrorAction SilentlyContinue | ForEach-Object {
  $cmd = (Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)").CommandLine
  if ($cmd -match 'nimo-backend/server.js|tsx/dist/cli.mjs server.ts|nimo-os/server.ts') {
    $_.Kill(); Write-Output "Killed $cmd"
  }
}

Start-Sleep 2

# Start backend
Start-Process -FilePath node -ArgumentList "nimo-backend/server.js" `
  -WorkingDirectory "C:\Users\thaku\hackathon&projects\stitch_nimo_voice_assistant_app" `
  -RedirectStandardOutput "$env:TEMP\opencode\be.log" -RedirectStandardError "$env:TEMP\opencode\be.err" `
  -WindowStyle Hidden

# Start frontend (Vite dev server via tsx)
$psi = New-Object System.Diagnostics.ProcessStartInfo("node")
$psi.Arguments = "node_modules\tsx\dist\cli.mjs server.ts"
$psi.WorkingDirectory = "C:\Users\thaku\hackathon&projects\stitch_nimo_voice_assistant_app\nimo-os"
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $true
[System.Diagnostics.Process]::Start($psi)

Start-Sleep 5
try { $b = (Invoke-WebRequest -UseBasicParsing http://localhost:3001/api/health -TimeoutSec 5).Content; Write-Output "Backend: $b" } catch { Write-Output "Backend: DOWN" }
try { $f = Invoke-WebRequest -UseBasicParsing http://localhost:3000 -TimeoutSec 5; Write-Output "Frontend: UP ($($f.StatusCode))" } catch { Write-Output "Frontend: DOWN" }
