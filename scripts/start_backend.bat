@echo off
REM 双击即可启动后端 + 隧道（等价于 powershell 调用 start_backend.ps1）
setlocal
pushd "%~dp0\.."
powershell -ExecutionPolicy Bypass -File "%~dp0start_backend.ps1" %*
popd
endlocal
