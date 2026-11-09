import React, { useState } from 'react';
import { Zap, Upload, CheckCircle2, AlertCircle, RefreshCw, FileCode2, Cpu, HardDrive, ShieldCheck, Usb } from 'lucide-react';
import { BoardConfig, FirmwarePreset, FlashProgress } from '../types';
import { PRECOMPILED_PRESETS } from '../services/precompiledFirmware';
import { Stk500Flasher } from '../services/stk500';
import { webSerialManager, SerialState } from '../services/webSerial';

interface FlasherPanelProps {
  selectedBoard: BoardConfig;
  serialState: SerialState;
  onConnectSerial: () => Promise<boolean>;
  onLogMessage: (text: string, direction: 'system' | 'error' | 'success') => void;
}

export const FlasherPanel: React.FC<FlasherPanelProps> = ({
  selectedBoard,
  serialState,
  onConnectSerial,
  onLogMessage,
}) => {
  const [selectedPresetId, setSelectedPresetId] = useState<string>(PRECOMPILED_PRESETS[0].id);
  const [customHexContent, setCustomHexContent] = useState<string | null>(null);
  const [customHexFileName, setCustomHexFileName] = useState<string | null>(null);
  const [flashProgress, setFlashProgress] = useState<FlashProgress | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);
  const [flashLogs, setFlashLogs] = useState<string[]>([]);

  const activePreset = PRECOMPILED_PRESETS.find((p) => p.id === selectedPresetId);
  const hexToFlash = customHexContent || activePreset?.hex || '';

  const handleCustomHexUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCustomHexContent(content);
      setCustomHexFileName(file.name);
      onLogMessage(`カスタムHEXファイル "${file.name}" を読み込みました (${content.length} 文字)`, 'system');
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.name.endsWith('.hex')) {
      onLogMessage('エラー: Intel HEXファイル (.hex) をドロップしてください。', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCustomHexContent(content);
      setCustomHexFileName(file.name);
      onLogMessage(`カスタムHEXファイル "${file.name}" をドロップ読み込みしました`, 'system');
    };
    reader.readAsText(file);
  };

  const handleStartFlashing = async () => {
    if (isFlashing) return;

    // If not connected, connect first
    if (serialState !== 'connected') {
      try {
        const ok = await onConnectSerial();
        if (!ok) return;
      } catch (err: any) {
        onLogMessage(`Web Serial接続に失敗しました: ${err.message}`, 'error');
        return;
      }
    }

    const port = webSerialManager.getPort();
    if (!port) {
      onLogMessage('有効なシリアルポートが取得できませんでした。', 'error');
      return;
    }

    setIsFlashing(true);
    setFlashLogs([]);
    setFlashProgress({
      phase: 'resetting',
      percent: 5,
      message: '書き込みシーケンス初期化中...',
      bytesWritten: 0,
      totalBytes: 0,
    });

    const addLog = (msg: string) => {
      setFlashLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    };

    try {
      addLog(`ターゲットボード: ${selectedBoard.name} (${selectedBoard.mcu})`);
      addLog(`通信レート: ${selectedBoard.baudRate} bps, プロトコル: STK500v1 / Optiboot`);

      // 1. Pause regular serial reader to free the stream
      await webSerialManager.pauseReading();

      // 2. Instantiate STK500 flasher
      const flasher = new Stk500Flasher(port);

      // 3. Flash hex
      await flasher.flashHex(hexToFlash, selectedBoard, (prog) => {
        setFlashProgress(prog);
        addLog(prog.message);
      });

      onLogMessage(`Arduino書き込み成功: ${selectedBoard.name}`, 'success');
    } catch (err: any) {
      const errMsg = err.message || '書き込み中に予期せぬエラーが発生しました';
      addLog(`エラー: ${errMsg}`);
      setFlashProgress({
        phase: 'error',
        percent: 0,
        message: errMsg,
        bytesWritten: 0,
        totalBytes: 0,
      });
      onLogMessage(`書き込み失敗: ${errMsg}`, 'error');
    } finally {
      setIsFlashing(false);
      // Resume reading for monitor and telemetry
      try {
        await webSerialManager.resumeReading();
      } catch {
        // ignore
      }
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Intro Hero Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-cyan-950/40 to-slate-900 border border-cyan-500/30 rounded-2xl p-6 relative overflow-hidden shadow-xl">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-gradient-to-l from-cyan-500/10 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                ドライバ・IDEインストール完全不要
              </span>
              <span className="text-xs text-slate-400">Web Serial API 直接書込</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Arduino Uno R3 / Nano へのワンクリック直接書き込み
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              USBメモリから本Webアプリを開くだけで、専用ソフトウェアやArduino IDEが一切入っていないPCでもブラウザから直接Arduinoへプログラムを書き込めます。
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={handleStartFlashing}
              disabled={isFlashing}
              className={`flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl font-bold text-sm shadow-lg transition-all ${
                isFlashing
                  ? 'bg-cyan-900/60 text-cyan-200 cursor-not-allowed border border-cyan-500/40'
                  : 'bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 shadow-cyan-500/25 active:scale-95'
              }`}
            >
              {isFlashing ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin text-cyan-300" />
                  <span>Arduinoへ書き込み中...</span>
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  <span>Arduinoへ書き込む (Flash)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Firmware Selection & Live Flash Status */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Preset & Hex Selection */}
        <div className="lg:col-span-7 space-y-5">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <FileCode2 className="w-4 h-4 text-cyan-400" />
                <span>書き込みプログラムの選択</span>
              </h2>
              {customHexContent && (
                <button
                  onClick={() => {
                    setCustomHexContent(null);
                    setCustomHexFileName(null);
                  }}
                  className="text-xs text-amber-400 hover:underline"
                >
                  プリセットに戻す
                </button>
              )}
            </div>

            {/* Presets List */}
            <div className="space-y-3">
              {PRECOMPILED_PRESETS.map((preset) => {
                const isSelected = !customHexContent && selectedPresetId === preset.id;
                return (
                  <div
                    key={preset.id}
                    onClick={() => {
                      setCustomHexContent(null);
                      setCustomHexFileName(null);
                      setSelectedPresetId(preset.id);
                    }}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-950/40 border-cyan-500/60 ring-1 ring-cyan-500/30'
                        : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-white">{preset.name}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                            v{preset.version}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          {preset.description}
                        </p>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                          isSelected
                            ? 'border-cyan-400 bg-cyan-400 text-slate-950'
                            : 'border-slate-700'
                        }`}
                      >
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5 pt-2 border-t border-slate-800/60">
                      {preset.features.map((feat, idx) => (
                        <span
                          key={idx}
                          className="text-[11px] px-2 py-0.5 rounded bg-slate-800/80 text-cyan-300"
                        >
                          ✓ {feat}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Drag & Drop Custom HEX Box */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-5 text-center transition-colors ${
                customHexContent
                  ? 'border-emerald-500/50 bg-emerald-950/20'
                  : 'border-slate-700/80 hover:border-cyan-500/50 bg-slate-950/40'
              }`}
            >
              {customHexContent ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2 text-emerald-400 font-medium text-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>カスタムHEX読込完了: {customHexFileName}</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    このカスタムバイナリをArduinoへ書き込みます
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-6 h-6 text-slate-500 mx-auto" />
                  <div className="text-sm text-slate-300 font-medium">
                    または独自の Intel HEXファイル (.hex) をドラッグ＆ドロップ
                  </div>
                  <p className="text-xs text-slate-500">
                    Arduino IDEやCloudでコンパイルした.hexファイルを直接書き込めます
                  </p>
                  <label className="inline-block mt-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer border border-slate-700 transition">
                    ファイルを選択
                    <input
                      type="file"
                      accept=".hex"
                      onChange={handleCustomHexUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Target Hardware & Progress Log */}
        <div className="lg:col-span-5 space-y-5">
          {/* Target Specs Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <span>ターゲットマイコン仕様</span>
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-500 block">対象ボード</span>
                <span className="text-cyan-300 font-medium">{selectedBoard.name}</span>
              </div>
              <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-500 block">MCU型番</span>
                <span className="text-slate-200 font-mono font-medium">{selectedBoard.mcu}</span>
              </div>
              <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-500 block">書込ボーレート</span>
                <span className="text-slate-200 font-mono font-medium">{selectedBoard.baudRate} bps</span>
              </div>
              <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-500 block">ページサイズ</span>
                <span className="text-slate-200 font-mono font-medium">{selectedBoard.pageSize} Bytes</span>
              </div>
            </div>
          </div>

          {/* Progress Bar & Status */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-cyan-400" />
                <span>書き込み進捗ステータス</span>
              </h3>
              {flashProgress && (
                <span
                  className={`text-xs px-2 py-0.5 rounded font-mono font-bold ${
                    flashProgress.phase === 'completed'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : flashProgress.phase === 'error'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  }`}
                >
                  {flashProgress.percent}%
                </span>
              )}
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div
                  className={`h-full transition-all duration-200 ${
                    flashProgress?.phase === 'error'
                      ? 'bg-rose-500'
                      : flashProgress?.phase === 'completed'
                      ? 'bg-emerald-500'
                      : 'bg-gradient-to-r from-cyan-500 to-blue-500'
                  }`}
                  style={{ width: `${flashProgress ? flashProgress.percent : 0}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-slate-400 font-mono">
                <span>{flashProgress ? flashProgress.message : '書き込み待機中'}</span>
                {flashProgress && flashProgress.totalBytes > 0 && (
                  <span>
                    {flashProgress.bytesWritten} / {flashProgress.totalBytes} B
                  </span>
                )}
              </div>
            </div>

            {/* Realtime Flasher Terminal Log */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>ログ出力 (STK500)</span>
                <span className="text-[10px] text-slate-500 font-mono">{flashLogs.length} 行</span>
              </div>
              <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-3 font-mono text-xs text-slate-300 h-44 overflow-y-auto space-y-1">
                {flashLogs.length === 0 ? (
                  <span className="text-slate-600 italic">
                    「Arduinoへ書き込む」を押すと、ブートローダー同期やページ転送ログがここに流れます。
                  </span>
                ) : (
                  flashLogs.map((line, idx) => (
                    <div
                      key={idx}
                      className={
                        line.includes('エラー') || line.includes('失敗')
                          ? 'text-rose-400'
                          : line.includes('完了') || line.includes('OK')
                          ? 'text-emerald-400'
                          : 'text-slate-300'
                      }
                    >
                      {line}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
