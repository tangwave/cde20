@echo off
REM 9527 法规问答后端启动器（花生壳内网穿透版）
REM 双击即常驻；或交给 Windows 计划任务「登录时」运行，实现开机自启。
setlocal
cd /d "%~dp0"
set PORT=8000
"C:\Users\tangw\.workbuddy\binaries\python\envs\default\Scripts\python.exe" api\server.py
endlocal
