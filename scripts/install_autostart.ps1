# 注册 Windows「登录时自启」任务，令后端 + 隧道常驻（开机/登录自动运行）
# 管理员 PowerShell 运行：
#   powershell -ExecutionPolicy Bypass -File install_autostart.ps1
# 卸载：
#   Unregister-ScheduledTask -TaskName "PharmaKB-Backend" -Confirm:$false
param(
  [string]$Tunnel = "localhost.run",   # none | localhost.run | vps
  [string]$VpsHost = ""
)

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
$TaskName = "PharmaKB-Backend"
$PsArgs = "-ExecutionPolicy Bypass -File `"$PSScriptRoot\start_backend.ps1`" -Tunnel $Tunnel"
if ($VpsHost) { $PsArgs += " -VpsHost $VpsHost" }

$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $PsArgs
$Trigger = New-ScheduledTaskTrigger -AtLogOn
$Settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit 0 -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

# 当前用户身份运行（无需输入密码）；如需系统级常驻改为 -Group "SYSTEM"
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger `
  -Settings $Settings -Force | Out-Null

Write-Host "[ok] 已注册任务 '$TaskName'（登录时自启）。"
Write-Host "     立即运行：Start-ScheduledTask -TaskName '$TaskName'"
Write-Host "     查看：    Get-ScheduledTask -TaskName '$TaskName'"
Write-Host "     删除：    Unregister-ScheduledTask -TaskName '$TaskName' -Confirm:`$false"

# 备选：用 nssm 注册为 Windows 服务（更稳定，开机即起，不依赖登录）
#   nssm install PharmaKB "%REPOROOT%\..\venv\Scripts\python.exe"
#   nssm set PharmaKB AppParameters "api\server.py"
#   nssm set PharmaKB AppDirectory "%REPOROOT%"
#   nssm set PharmaKB AppEnvironmentExtra "PORT=8090"
#   nssm start PharmaKB
