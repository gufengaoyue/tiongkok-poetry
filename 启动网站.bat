@echo off
chcp 65001 >nul
title 墨澜 · 中国古典诗词数字档案
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  if exist "D:\Program Files\nodejs\node.exe" (
    set "PATH=D:\Program Files\nodejs;%PATH%"
  ) else (
    echo.
    echo  未检测到 Node.js，请先安装 Node.js 18 或更高版本：
    echo  https://nodejs.org/
    echo.
    pause
    exit /b 1
  )
)

if not exist "web\dist\index.html" (
  echo  未找到前端构建产物，正在安装依赖并构建，请稍候...
  pushd web
  call npm install
  call npm run build
  popd
)

netstat -ano | findstr ":5177" | findstr "LISTENING" >nul
if not errorlevel 1 (
  echo  服务已在运行，正在打开页面...
  start "" "http://127.0.0.1:5177"
  ping -n 3 127.0.0.1 >nul
  exit /b 0
)

echo  正在启动墨澜服务，首次载入语料约需 3-5 秒...
start "MOLAN" /min cmd /c "node server\index.js"
ping -n 6 127.0.0.1 >nul
start "" "http://127.0.0.1:5177"
echo.
echo  已打开  http://127.0.0.1:5177
echo  如需停止服务，关闭标题为 MOLAN 的最小化命令行窗口即可。
echo.
ping -n 4 127.0.0.1 >nul
