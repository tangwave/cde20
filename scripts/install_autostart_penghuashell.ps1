# 注册 Windows「登录时自启」任务，令 海云AI 后端常驻（花生壳穿透版，端口 8000）
# 以管理员 PowerShell 运行：
#   powershell -ExecutionPolicy Bypass -File install_autostart_penghuashell.ps1
# 卸载：
#   Unregister-ScheduledTask -TaskName "PharmaKB-9527" -Confirm:$false

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
$TaskName = "PharmaKB-9527"
$PsScript = Join-Path $RepoRoot "start_local_penghuashell.ps1"
$PsArgs   = "-ExecutionPolicy Bypass -File `"$PsScript`""

$Action   = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $PsArgs
$Trigger  = New-ScheduledTaskTrigger -AtLogOn
$Settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit 0 -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger `
  -Settings $Settings -Force | Out-Null

Write-Host "[ok] 已注册任务 '$TaskName'（登录时自启，调用 start_local_penghuashell.ps1）。"
Write-Host "     立即运行：Start-ScheduledTask -TaskName '$TaskName'"
Write-Host "     查看：    Get-ScheduledTask -TaskName '$TaskName'"
Write-Host "     删除：    Unregister-ScheduledTask -TaskName '$TaskName' -Confirm:`$false"
