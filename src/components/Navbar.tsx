import React from 'react';
import { Cpu, Usb, Zap, Sliders, Code2, FolderArchive, Terminal, HelpCircle, CheckCircle2, AlertTriangle } from 'lucide-react';
import { BoardConfig } from '../types';
import { SUPPORTED_BOARDS } from '../services/boards';
import { SerialState } from '../services/webSerial';

interface NavbarProps {
  activeTab: 'flasher' | 'i2c' | 'editor' | 'libraries' | 'serial';
  setActiveTab: (tab: 'flasher' | 'i2c' | 'editor' | 'libraries' | 'serial') => void;
  selectedBoard: BoardConfig;
  setSelectedBoard: (board: BoardConfig) => void;
  serialState: SerialState;
  serialStatusMessage: string;
  baudRate: number;
  setBaudRate: (baud: number) => void;
  onConnectSerial: () => void;
  onDisconnectSerial: () => void;
  onOpenWiringGuide: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  selectedBoard,
  setSelectedBoard,
  serialState,
  serialStatusMessage,
  baudRate,
  setBaudRate,
  onConnectSerial,
  onDisconnectSerial,
  onOpenWiringGuide,
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-white font-bold ring-1 ring-cyan-400/30">
              <Cpu className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-white tracking-tight">Web Arduino Studio</span>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-full">
                  IDE不要・ローカル動作
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Web Serial 書き込み / TCA9548A・MPR121 I2Cプレビュー / DFPlayer Mini
              </p>
            </div>
          </div>

          {/* Hardware & Serial Controls */}
          <div className="flex items-center gap-3">
            {/* Board Selector */}
            <div className="hidden md:flex items-center gap-1.5 bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300">
              <span className="text-slate-500 font-medium">ボード:</span>
              <select
                value={selectedBoard.id}
                onChange={(e) => {
                  const b = SUPPORTED_BOARDS.find((x) => x.id === e.target.value);
                  if (b) setSelectedBoard(b);
                }}
                className="bg-transparent text-cyan-400 font-medium focus:outline-none cursor-pointer"
              >
                {SUPPORTED_BOARDS.map((b) => (
                  <option key={b.id} value={b.id} className="bg-slate-900 text-slate-200">
                    {b.name} ({b.mcu})
                  </option>
                ))}
              </select>
            </div>

            {/* Baud Rate */}
            <div className="hidden lg:flex items-center gap-1.5 bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300">
              <span className="text-slate-500 font-medium">速度:</span>
              <select
                value={baudRate}
                onChange={(e) => setBaudRate(Number(e.target.value))}
                className="bg-transparent text-slate-200 font-mono focus:outline-none cursor-pointer"
              >
                <option value={115200} className="bg-slate-900">115200 bps</option>
                <option value={57600} className="bg-slate-900">57600 bps</option>
                <option value={38400} className="bg-slate-900">38400 bps</option>
                <option value={9600} className="bg-slate-900">9600 bps</option>
              </select>
            </div>

            {/* Wiring Help Button */}
            <button
              onClick={onOpenWiringGuide}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-300 px-2.5 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-950/60 transition-colors"
              title="TCA9548A・MPR121・DFPlayerの結線配線図を見る"
            >
              <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">配線・ピンアサイン</span>
            </button>

            {/* Web Serial Connect / Disconnect */}
            {serialState === 'connected' ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/50 border border-emerald-500/40 text-emerald-400 text-xs">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="font-medium hidden sm:inline">USB接続中</span>
                </div>
                <button
                  onClick={onDisconnectSerial}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                >
                  切断
                </button>
              </div>
            ) : (
              <button
                onClick={onConnectSerial}
                disabled={serialState === 'connecting'}
                className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-md shadow-cyan-500/20 active:scale-95 transition disabled:opacity-50"
              >
                <Usb className="w-3.5 h-3.5" />
                <span>{serialState === 'connecting' ? '接続中...' : 'USB接続 (Web Serial)'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 overflow-x-auto py-2 border-t border-slate-800/80 no-scrollbar">
          <button
            onClick={() => setActiveTab('flasher')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'flasher'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Arduino書き込み (Flasher)</span>
          </button>

          <button
            onClick={() => setActiveTab('i2c')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'i2c'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>I2Cプレビュー＆制御 (TCA・MPR・DFP)</span>
          </button>

          <button
            onClick={() => setActiveTab('editor')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'editor'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>スケッチエディタ (.ino編集/出力)</span>
          </button>

          <button
            onClick={() => setActiveTab('libraries')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'libraries'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <FolderArchive className="w-3.5 h-3.5" />
            <span>ライブラリ管理 (DFPlayerMini)</span>
          </button>

          <button
            onClick={() => setActiveTab('serial')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'serial'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>シリアルモニタ</span>
          </button>
        </div>
      </div>
    </header>
  );
};
