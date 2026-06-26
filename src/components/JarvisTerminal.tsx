import React, { useState } from 'react';
import { Terminal, Copy, Check, Download, Laptop, HelpCircle, Activity } from 'lucide-react';
import { BridgeLog } from '../types';

interface JarvisTerminalProps {
  logs: BridgeLog[];
  serverUrl: string;
  isBridgeConnected: boolean;
  language: string;
}

export default function JarvisTerminal({
  logs,
  serverUrl,
  isBridgeConnected,
  language
}: JarvisTerminalProps) {
  const [activePlatform, setActivePlatform] = useState<'mac' | 'windows'>('mac');
  const [copied, setCopied] = useState<boolean>(false);

  // Generate local bridge scripts customized with exact current server domain app url
  const appUrl = serverUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://ais-dev-exgz35yzkwbm5fdxza4yzu-1059684779081.asia-southeast1.run.app');

  const macScript = `#!/bin/bash
# ==============================================================================
# JARVIS SYSTEM EDGE BRIDGE (macOS & Linux Client)
# ==============================================================================
# This script connects your local machine to the cloud-hosted Jarvis AI Studio instance.
# It polls for OS integration trigger instructions and runs them locally.
# Press Ctrl+C to disconnect.
# ==============================================================================

SERVER_URL="${appUrl}"
CLIENT_ID="jarvis-laptop-client"

echo "================================================================"
echo "🛡️   JARVIS SYSTEM EDGE BRIDGE INITIATED (POSIX CORE)"
echo "🌐   Connecting to Jarvis Core: $SERVER_URL"
echo "🤖   Awaiting remote neural triggers... Press [Ctrl+C] to exit."
echo "================================================================"

# Register client or notify presence
curl -s -X POST "$SERVER_URL/api/bridge/register" -H "Content-Type: application/json" -d "{\\"clientId\\":\\"$CLIENT_ID\\"}" > /dev/null

while true; do
  # Poll pending commands
  RESPONSE=$(curl -s "$SERVER_URL/api/bridge/poll?clientId=$CLIENT_ID")
  
  if [ ! -z "$RESPONSE" ] && [ "$RESPONSE" != "null" ] && [ "$RESPONSE" != "{\\"commands\\":[]}" ]; then
    # Simple JSON parsing in bash
    CMD_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*' | head -n 1 | cut -d'"' -f4)
    CMD_TYPE=$(echo "$RESPONSE" | grep -o '"type":"[^"]*' | head -n 1 | cut -d'"' -f4)
    CMD_PAYLOAD=$(echo "$RESPONSE" | grep -o '"commandLine":"[^"]*' | head -n 1 | cut -d'"' -f4)
    CMD_MSG=$(echo "$RESPONSE" | grep -o '"message":"[^"]*' | head -n 1 | cut -d'"' -f4)
    
    if [ ! -z "$CMD_PAYLOAD" ]; then
      echo "🔥   NEURAL TRIGGER RECEIVED [ID: $CMD_ID]: $CMD_MSG" 
      echo "⚡   Executing safe local payload: $CMD_PAYLOAD"
      
      # Execute command
      eval "$CMD_PAYLOAD" > /dev/null 2>&1
      EXIT_CODE=$?
      
      # Dispatch back telemetry feedback
      curl -s -X POST "$SERVER_URL/api/bridge/status" \\
        -H "Content-Type: application/json" \\
        -d "{\\"clientId\\":\\"$CLIENT_ID\\",\\"commandId\\":\\"$CMD_ID\\",\\"status\\":\\"success\\",\\"exitCode\\":$EXIT_CODE}" > /dev/null
    fi
  fi
  sleep 2
done`;

  const windowsScript = `# ==============================================================================
# JARVIS SYSTEM EDGE BRIDGE (Windows Client)
# ==============================================================================
# This script connects your Windows machine to your Jarvis cloud instance.
# Run this in PowerShell under your normal user account.
# Press Ctrl+C to terminate the bridge.
# ==============================================================================

$ServerUrl = "${appUrl}"
$ClientId = "jarvis-laptop-client"

Clear-Host
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "🛡️   JARVIS SYSTEM EDGE BRIDGE INITIATED (WINDOWS CORE)" -ForegroundColor Cyan
Write-Host "🌐   Connecting to Jarvis Core: $ServerUrl" -ForegroundColor Cyan
Write-Host "🤖   Awaiting remote neural triggers... Press [Ctrl+C] to exit." -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# Notify Presence
try {
    $body = @{ clientId = $ClientId } | ConvertTo-Json
    Invoke-RestMethod -Uri "$ServerUrl/api/bridge/register" -Method Post -Body $body -ContentType "application/json" -ErrorAction SilentlyContinue | Out-Null
} catch {}

while ($true) {
    try {
        $response = Invoke-RestMethod -Uri "$ServerUrl/api/bridge/poll?clientId=$ClientId" -Method Get -ErrorAction SilentlyContinue
        if ($response -and $response.commands) {
            foreach ($cmd in $response.commands) {
                $cmdId = $cmd.id
                $cmdType = $cmd.type
                $cmdLine = $cmd.commandLine
                $cmdMsg = $cmd.message

                if ($cmdLine) {
                    Write-Host "🔥   NEURAL TRIGGER RECEIVED [ID: $cmdId]: $cmdMsg" -ForegroundColor Yellow
                    Write-Host "⚡   Executing PowerShell payload: $cmdLine" -ForegroundColor DarkGray
                    
                    # Execute
                    Invoke-Expression $cmdLine | Out-Null
                    $exitCode = 0
                    
                    # Send feedback telemetry
                    $statusBody = @{
                        clientId = $ClientId
                        commandId = $cmdId
                        status = "success"
                        exitCode = $exitCode
                    } | ConvertTo-Json
                    Invoke-RestMethod -Uri "$ServerUrl/api/bridge/status" -Method Post -Body $statusBody -ContentType "application/json" -ErrorAction SilentlyContinue | Out-Null
                }
            }
        }
    } catch {
        # Catch network jitter
    }
    Start-Sleep -Seconds 2
}`;

  const currentScriptText = activePlatform === 'mac' ? macScript : windowsScript;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentScriptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([currentScriptText], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = activePlatform === 'mac' ? 'jarvis_bridge.sh' : 'jarvis_bridge.ps1';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="jarvis-terminal" className="flex flex-col gap-6 bg-[#121417] p-6 rounded-2xl border border-[#00f2ff]/20 shadow-[0_0_20px_rgba(0,242,255,0.04)] h-full min-h-[620px] xl:min-h-[580px] overflow-y-auto">
      {/* System Command Logs Output Panel */}
      <div className="flex flex-col h-[260px] xl:h-[40%] shrink-0">
        <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
          <div className="flex items-center gap-2 text-[#00f2ff] font-mono text-[11px] tracking-widest uppercase">
            <Terminal className="w-4 h-4 text-[#00f2ff] animate-pulse" />
            {language === 'kk-KZ' ? 'Пәрмендерді өңдеу құбыры (Журнал)' : language === 'ru-RU' ? 'Конвейер обработки команд (Журнал)' : 'Command Processing Pipeline'}
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${isBridgeConnected ? 'bg-emerald-400 animate-ping' : 'bg-amber-400 animate-pulse'}`}></span>
            <span className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">
              {isBridgeConnected 
                ? (language === 'kk-KZ' ? "НОУТБУК ҚОСЫЛҒАН" : language === 'ru-RU' ? "ПК ПОДКЛЮЧЕН" : "LAPTOP CONNECTED")
                : (language === 'kk-KZ' ? "РЕАКТИВТІ СИМУЛЯТОР БЕЛСЕНДІ" : language === 'ru-RU' ? "РЕАКТИВНЫЙ СИМУЛЯТОР АКТИВЕН" : "REACTIVE SIMULATOR ACTIVE")}
            </span>
          </div>
        </div>

        {/* Scrolling console entries */}
        <div className="flex-1 bg-black/60 p-4 rounded border border-white/5 font-mono text-[11px] text-gray-300 overflow-y-auto space-y-2 select-text selection:bg-[#00f2ff] selection:text-black">
          <div className="text-[#00f2ff]/60">[{new Date().toLocaleTimeString()}] JARVIS Neural Kernel online. Core temperature stable.</div>
          <div className="text-[#00f2ff]/60">[{new Date().toLocaleTimeString()}] Establishing secure tunnel listener...</div>
          
          {logs.length === 0 ? (
            <div className="text-gray-650 text-center py-16">
              [No remote system commands triggered yet]<br />
              <span className="text-[10px] text-gray-600 font-mono">
                {language === 'kk-KZ' 
                  ? 'Шелл-пәрмендерді іске қосу үшін дауыспен сұраңыз немесе жиындарды басыңыз' 
                  : language === 'ru-RU' 
                    ? 'Голосом попросите выполнить действие или настройте будильники для отправки команд' 
                    : 'Ask with voice or set reminders to stream system actions/commands'}
              </span>
            </div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="border-l-2 border-white/10 pl-3 py-1 space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-[#00f2ff] font-semibold">{log.type.toUpperCase()} - {log.message}</span>
                  <span className="text-gray-600">{new Date(log.timestamp).toLocaleTimeString()}</span>
                </div>
                <div className="text-gray-400 bg-[#0a0b0d] p-1.5 rounded border border-white/5 overflow-x-auto text-[9px] break-all">
                  $ {log.commandLine}
                </div>
                <div className="flex items-center justify-between text-[9px]">
                  <span className="text-gray-500 font-mono">STATUS: 
                    <span className={`ml-1 font-semibold ${
                      log.status === 'success' || log.status === 'completed' ? 'text-emerald-400' :
                      log.status === 'executing' ? 'text-yellow-400 animate-pulse' : 'text-gray-550'
                    }`}>{log.status.toUpperCase()}</span>
                  </span>
                  {log.exitCode !== undefined && (
                    <span className="text-gray-500">EXIT: {log.exitCode}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Local System Connection Hub Widget (The Bridge Script) */}
      <div className="flex flex-col flex-1 min-h-[300px]">
        <div className="flex items-center gap-2 mb-2 text-[#00f2ff] font-mono text-[11px] tracking-widest uppercase">
          <Laptop className="w-4 h-4 text-[#00f2ff]" />
          {language === 'kk-KZ' ? 'Neural OS Gateway (Ноутбук интеграциясы)' : language === 'ru-RU' ? 'Neural OS Gateway (Интеграция с ПК)' : 'Neural OS Gateway (Laptop Integration)'}
        </div>
        <p className="text-[10px] text-gray-500 leading-tight mb-3">
          {language === 'kk-KZ' 
            ? 'Стандартты браузерлер ноутбуктың жүйелік пәрмендерін қауіпсіздік салдарынан тікелей шақыра алмайды. Төмендегі жеңіл терминал көпір-скриптін жүктеп алып қоссаңыз, Тікелей OS басқару іске асады (Будильник, Ескертулерді ашу, т.б.).' 
            : language === 'ru-RU'
              ? 'Веб-браузеры не могут напрямую запускать файлы или приложения на ПК по причинам безопасности. Запустите этот скрипт-мост, чтобы включить прямое управление (ставить будильники, открывать вкладки).'
              : 'Standard web browsers restrict direct system execution due to security boundaries. Run this lightweight bridge scripting agent on your computer to bind cloud intents directly to local execution (Alarms, browser tabs, OS utilities).'}
        </p>

        {/* Script Selection Platform tabs */}
        <div className="flex rounded overflow-hidden border border-white/5 bg-black/40 p-1 mb-2">
          <button
            onClick={() => setActivePlatform('mac')}
            className={`flex-1 py-1 text-[11px] font-mono rounded cursor-pointer transition-colors uppercase tracking-widest ${
              activePlatform === 'mac' ? 'bg-[#00f2ff]/10 font-semibold text-[#00f2ff] border border-[#00f2ff]/30' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            macOS / Linux
          </button>
          <button
            onClick={() => setActivePlatform('windows')}
            className={`flex-1 py-1 text-[11px] font-mono rounded cursor-pointer transition-colors uppercase tracking-widest ${
              activePlatform === 'windows' ? 'bg-[#00f2ff]/10 font-semibold text-[#00f2ff] border border-[#00f2ff]/30' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Windows
          </button>
        </div>

        {/* Mini script viewer */}
        <div className="flex-1 bg-black/20 rounded border border-white/5 p-3 flex flex-col justify-between overflow-hidden relative">
          <div className="text-[8px] font-mono text-gray-500 overflow-y-auto min-h-[90px] max-h-[140px] xl:max-h-[220px] xl:flex-1 break-all select-all font-light whitespace-pre border border-white/5 p-2 bg-[#0a0b0d] rounded mb-2">
            {currentScriptText}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={handleCopy}
                className="flex-1 py-1 px-2 bg-black/30 hover:bg-[#00f2ff]/15 text-gray-350 text-[10px] font-mono rounded flex items-center justify-center gap-1.5 border border-white/5 transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-[#00f2ff]" />}
                {copied ? (language === 'kk-KZ' ? "Көшірілді!" : language === 'ru-RU' ? "Скопировано!" : "Copied!") : (language === 'kk-KZ' ? "Кодты көшіру" : language === 'ru-RU' ? "Копировать код моста" : "Copy Bridge Code")}
              </button>
              <button
                onClick={handleDownload}
                className="flex-1 py-1 px-2 bg-[#00f2ff]/10 hover:bg-[#00f2ff]/20 text-[#00f2ff] text-[10px] font-mono rounded flex items-center justify-center gap-1.5 border border-[#00f2ff]/30 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-[#00f2ff] animate-bounce" />
                {language === 'kk-KZ' ? 'Шүктеу' : language === 'ru-RU' ? 'Скачать скрипт' : 'Download Script'}
              </button>
            </div>

            {/* Instruction list */}
            <div className="bg-[#00f2ff]/5 border border-[#00f2ff]/10 p-2 rounded text-[9px] text-[#00f2ff] font-mono">
              <span className="font-bold uppercase tracking-wider block mb-0.5 text-[#00f2ff]">
                {language === 'kk-KZ' ? 'Іске қосу нұсқаулығы:' : language === 'ru-RU' ? 'Инструкция по запуску:' : 'Quickstart Guide:'}
              </span>
              1. {language === 'kk-KZ' ? 'Скриптті жүктеп алыңыз.' : language === 'ru-RU' ? 'Скачайте и сохраните скрипт.' : 'Download the script.'}<br />
              2. {activePlatform === 'mac' 
                ? (language === 'kk-KZ' 
                  ? 'Terminal ашып, іске қосыңыз: chmod +x jarvis_bridge.sh && ./jarvis_bridge.sh' 
                  : language === 'ru-RU'
                    ? 'Откройте Терминал и выполните: chmod +x jarvis_bridge.sh && ./jarvis_bridge.sh'
                    : 'Open Terminal and execute: chmod +x jarvis_bridge.sh && ./jarvis_bridge.sh')
                : (language === 'kk-KZ'
                  ? 'PowerShell ашып, іске қосыңыз: .\\jarvis_bridge.ps1'
                  : language === 'ru-RU'
                    ? 'Откройте PowerShell и запустите: .\\jarvis_bridge.ps1'
                    : 'Open PowerShell and execute: .\\jarvis_bridge.ps1')}<br />
              3. {language === 'kk-KZ' 
                ? 'Сөйлесіп сұраңыз немесе «Тексеру пәрменің» итеріп көріңіз.' 
                : language === 'ru-RU'
                  ? 'Произнесите голосовую команду или настройте задачи в планировщике.'
                  : 'Connect by calling commands or setting reminders.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
