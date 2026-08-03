# 本机常驻启动 9527 法规问答后端（花生壳内网穿透版，无 ssh 隧道）
# 由 Windows 任务计划程序「登录时」调用；花生壳客户端负责把公网地址映射到 127.0.0.1:8000
param(
  [int]$Port = 8000
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RepoRoot  = $ScriptDir
for ($i = 0; $i -lt 4; $i++) {
  if (Test-Path (Join-Path $RepoRoot "api\server.py")) { break }
  $parent = Split-Path -Parent $RepoRoot
  if ($parent -eq $RepoRoot) { break }
  $RepoRoot = $parent
}

# 使用隔离 venv 的 python（依赖已装于此）
$VenvPy = "C:\Users\tangw\.workbuddy\binaries\python\envs\default\Scripts\python.exe"
if (-not (Test-Path $VenvPy)) {
  Write-Warning "未找到 venv python：$VenvPy ，回退到系统 python"
  $VenvPy = "python"
}

$env:PORT = [string]$Port
$LogFile = Join-Path $RepoRoot "backend.log"

try {
  # 用 cmd /c 启动，确保进程彻底脱离父 shell（独立于本会话/计划任务宿主）
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = "cmd.exe"
  $psi.Arguments = "/c ""`"$VenvPy`" api\server.py > `"$LogFile`" 2>&1"""
  $psi.WorkingDirectory = $RepoRoot
  $psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
  $psi.UseShellExecute = $false
  $p = [System.Diagnostics.Process]::Start($psi)
  Write-Host "[start] 已启动 9527 后端 (detached pid=$($p.Id), 端口 $Port)，日志-> $LogFile"
} catch {
  Write-Error "启动失败：$($_.Exception.Message)"
  exit 1
}
Write-Host "[done] 后端常驻中（端口 $Port）。花生壳客户端请添加映射：内网主机 127.0.0.1，内网端口 $Port。"
