@echo off
rem OpenClaw Gateway (v2026.3.13)
set "TMPDIR=C:\Users\hp\AppData\Local\Temp"
set "OPENCLAW_GATEWAY_PORT=18789"
set "OPENCLAW_SYSTEMD_UNIT=openclaw-gateway.service"
set "OPENCLAW_WINDOWS_TASK_NAME=OpenClaw Gateway"
set "OPENCLAW_SERVICE_MARKER=openclaw"
set "OPENCLAW_SERVICE_KIND=gateway"
set "OPENCLAW_SERVICE_VERSION=2026.3.13"
C:\nvm4w\nodejs\node.exe C:\Users\hp\AppData\Local\pnpm\global\5\.pnpm\openclaw@2026.3.13_@napi-rs_ef8f623cb295e7d13747596ca5953c36\node_modules\openclaw\dist\index.js gateway --port 18789
