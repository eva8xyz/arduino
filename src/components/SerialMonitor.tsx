import React, { useState, useRef, useEffect } from 'react';
import { 
  Terminal, Send, Trash2, Download, ArrowDownCircle, CornerDownLeft, 
  CheckCircle2, AlertCircle, Cpu, Wifi 
} from 'lucide-react';
import { SerialLogMessage } from '../types';
import { webSerialManager, SerialState } from '../services/webSerial';

interface SerialMonitorProps {
  logs: SerialLogMessage[];
  setLogs: React.Dispatch<React.SetStateAction<SerialLogMessage[]>>;
  serialState: SerialState;
  baudRate: number;
  onConnectSerial: () => void;
}

export const SerialMonitor: React.FC<SerialMonitorProps> = ({
  logs,
  setLogs,
  serialState,
  baudRate,
  onConnectSerial,
}) => {
  const [inputText, setInputText] = useState('');
  const [lineEnding, setLineEnding] = useState<'\n' | '\r\n' | ''>('\n');
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleSendCommand = async () => {
    if (!inputText.trim()) return;
    if (serialState !== 'connected') {
      setLogs((prev) => [
        ...prev,
        {
          id: 'log_' + Date.now() + Math.random(),
          timestamp: new Date().toLocaleTimeString(),
          direction: 'error',
          text: 'エラー: シリアルポートが未接続です。「USB接続」を押してポートを開いてください。',
        },
      ]);
      return;
    }

    const fullCommand = inputText + lineEnding;
    try {
      await webSerialManager.write(fullCommand);
      setLogs((prev) => [
        ...prev,
        {
          id: 'log_' + Date.now() + Math.random(),
          timestamp: new Date().toLocaleTimeString(),
          direction: 'tx',
          text: inputText,
        },
      ]);
      setInputText('');
    } catch (err: any) {
      setLogs((prev) => [
        ...prev,
        {
          id: 'log_' + Date.now() + Math.random(),
          timestamp: new Date().toLocaleTimeString(),
          direction: 'error',
          text: `送信失敗: ${err.message}`,
        },
      ]);
    }
  };

  const handleQuickCommand = async (cmd: string) => {
    setInputText(cmd);
    if (serialState === 'connected') {
      try {
        await webSerialManager.write(cmd + lineEnding);
        setLogs((prev) => [
          ...prev,
          {
            id: 'log_' + Date.now() + Math.random(),
            timestamp: new Date().toLocaleTimeString(),
            direction: 'tx',
            text: cmd,
          },
        ]);
      } catch (err: any) {
        setLogs((prev) => [
          ...prev,
          {
            id: 'log_' + Date.now() + Math.random(),
            timestamp: new Date().toLocaleTimeString(),
            direction: 'error',
            text: `クイック送信エラー: ${err.message}`,
          },
        ]);
      }
    }
  };

  const handleClear = () => {
    setLogs([]);
  };

  const handleExportLog = () => {
    const text = logs.map((l) => `[${l.timestamp}] [${l.direction.toUpperCase()}] ${l.text}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `serial_log_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* Header bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>Web Serial リアルタイム・シリアルモニタ</span>
              <span className={`text-[11px] px-2 py-0.5 rounded font-mono font-medium ${
                serialState === 'connected' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 text-slate-400'
              }`}>
                {serialState === 'connected' ? `接続中 (${baudRate}bps)` : '未接続'}
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Arduinoとの間で送受信されるテレメトリやコマンドをリアルタイムで送受信・確認できます。
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded bg-slate-950 border-slate-700 text-cyan-500 focus:ring-0"
            />
            <span>自動スクロール</span>
          </label>

          <button
            onClick={handleClear}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
            title="ログ消去"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <button
            onClick={handleExportLog}
            className="p-1.5 text-slate-400 hover:text-cyan-300 hover:bg-slate-800 rounded-lg transition"
            title="ログをファイルに保存"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Terminal Display */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col h-[520px]">
        {/* Log Viewer */}
        <div
          ref={logContainerRef}
          className="flex-1 p-4 overflow-y-auto font-mono text-xs space-y-1.5 selection:bg-cyan-500/30"
        >
          {logs.length === 0 ? (
            <div className="text-slate-600 italic py-10 text-center">
              シリアルログはまだありません。USB接続するとArduinoからの送受信データが表示されます。
            </div>
          ) : (
            logs.map((log) => {
              const isRx = log.direction === 'rx';
              const isTx = log.direction === 'tx';
              const isErr = log.direction === 'error';
              const isSuccess = log.direction === 'success';

              return (
                <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                  <span className="text-slate-600 shrink-0 select-none">[{log.timestamp}]</span>
                  <span
                    className={`font-bold shrink-0 text-[10px] px-1 rounded select-none ${
                      isRx
                        ? 'bg-blue-500/20 text-blue-300'
                        : isTx
                        ? 'bg-amber-500/20 text-amber-300'
                        : isErr
                        ? 'bg-rose-500/20 text-rose-300'
                        : isSuccess
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {log.direction.toUpperCase()}
                  </span>
                  <span
                    className={`break-all ${
                      isRx
                        ? 'text-cyan-200'
                        : isTx
                        ? 'text-amber-200 font-semibold'
                        : isErr
                        ? 'text-rose-400'
                        : isSuccess
                        ? 'text-emerald-300'
                        : 'text-slate-400'
                    }`}
                  >
                    {log.text}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Quick Command Chips */}
        <div className="px-4 py-2 bg-slate-900/90 border-t border-slate-800/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <span className="text-[11px] text-slate-500 font-mono shrink-0">クイック送信:</span>
          {['SCAN', 'TCA:0', 'PLAY:1', 'VOL:20', 'PAUSE', 'RESUME', 'NEXT', 'PREV', 'PING'].map((chip) => (
            <button
              key={chip}
              onClick={() => handleQuickCommand(chip)}
              className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 border border-slate-700 transition shrink-0"
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Input & Send Bar */}
        <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2">
          <select
            value={lineEnding}
            onChange={(e) => setLineEnding(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-2 text-xs text-slate-300 font-mono focus:outline-none"
          >
            <option value={'\n'}>LF (\n)</option>
            <option value={'\r\n'}>CR+LF (\r\n)</option>
            <option value={''}>なし (None)</option>
          </select>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendCommand()}
            placeholder={
              serialState === 'connected'
                ? 'コマンドを入力してEnterで送信 (例: SCAN, TCA:0, PLAY:1, VOL:25)...'
                : 'USB接続後にコマンドを送信できます'
            }
            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
          />

          <button
            onClick={handleSendCommand}
            disabled={serialState !== 'connected' || !inputText.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-md transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="w-3.5 h-3.5" />
            <span>送信</span>
          </button>
        </div>
      </div>
    </div>
  );
};
