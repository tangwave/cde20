# 常驻启动 9527 法规问答后端 + 公网反向隧道
# 用法：
#   powershell -ExecutionPolicy Bypass -File start_backend.ps1
#   powershell -ExecutionPolicy Bypass -File start_backend.ps1 -Tunnel vps -VpsHost user@1.2.3.4
# 参数：
#   -Port            本地后端端口（默认 8090）
#   -Tunnel          none | localhost.run（默认，临时随机地址）| vps（需 VPS，稳定地址）
#   -VpsHost         仅 Tunnel=vps：如 user@your.vps（需已配 SSH 公钥免密）
#   -VpsRemotePort   VPS 上监听的远程端口（默认 80，需 VPS 有 80/443 权限或反代）
param(
  [int]$Port = 8090,
  [ValidateSet("none","localhost.run","vps")]
  [string]$Tunnel = "localhost.run",
  [string]$VpsHost = "",
  [int]$VpsRemotePort = 80
)

# 自动定位仓库根（包含 api/server.py 的目录），兼容「扁平仓库」与「quality-system-app 子目录」两种布局
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RepoRoot = $ScriptDir
for ($i = 0; $i -lt 4; $i++) {
  if (Test-Path (Join-Path $RepoRoot "api\server.py")) { break }
  $parent = Split-Path -Parent $RepoRoot
  if ($parent -eq $RepoRoot) { break }
  $RepoRoot = $parent
}
$env:PORT = [string]$Port

Write-Host "[start] 启动后端 api/server.py  (端口 $Port)"
$proc = Start-Process -FilePath "python" `
  -ArgumentList @("api\server.py") `
  -WorkingDirectory $RepoRoot `
  -PassThru -WindowStyle Hidden
Write-Host "[start] 后端 PID = $($proc.Id)"

switch ($Tunnel) {
  "localhost.run" {
    Write-Host "[tunnel] localhost.run 临时隧道（会话级，地址随机，免费匿名）..."
    Start-Process -FilePath "ssh" -WindowStyle Hidden -ArgumentList @(
      "-o","StrictHostKeyChecking=no",
      "-o","UserKnownHostsFile=/dev/null",
      "-o","PreferredAuthentications=none",
      "-o","ServerAliveInterval=30",
      "-R","80:localhost:$Port",
      "nokey@localhost.run"
    )
    Write-Host "[tunnel] 启动后查看输出获取 https://xxxx.lhr.life，填入前端 meta[qa-api-base]。"
  }
  "vps" {
    if (-not $VpsHost) { Write-Warning "Tunnel=vps 但未提供 -VpsHost，跳过隧道。"; break }
    Write-Host "[tunnel] 持久反向隧道到 $VpsHost（需 autossh + VPS 公网域名）..."
    Start-Process -FilePath "autossh" -WindowStyle Hidden -ArgumentList @(
      "-M","0",
      "-o","ServerAliveInterval=30",
      "-o","ServerAliveCountMax=3",
      "-R","${VpsRemotePort}:localhost:${Port}",
      $VpsHost
    )
    Write-Host "[tunnel] VPS 上用 Nginx 反代 127.0.0.1:${VpsRemotePort} 到你的域名即可。"
  }
  default { Write-Host "[tunnel] 未启用隧道；仅本地 http://localhost:$Port 可用。" }
}

Write-Host "[done] 后端常驻中。任务计划程序自启请见 install_autostart.ps1。"
