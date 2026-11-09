import React, { useState, useEffect } from 'react';
import { 
  Sliders, Music, Radio, Volume2, VolumeX, Play, Pause, SkipBack, SkipForward, 
  RotateCcw, Sparkles, CheckCircle2, RefreshCw, Send, Search, Info, Activity, Layers
} from 'lucide-react';
import { MPR121Electrode, I2CChannelState, DFPlayerStatus } from '../types';
import { webSerialManager, SerialState } from '../services/webSerial';
import { audioSimulator } from '../services/audioSimulator';

interface I2CStudioProps {
  serialState: SerialState;
  onLogMessage: (text: string, direction: 'system' | 'tx' | 'rx' | 'error' | 'success') => void;
}

export const I2CStudio: React.FC<I2CStudioProps> = ({ serialState, onLogMessage }) => {
  // TCA9548A State (8 channels)
  const [activeChannel, setActiveChannel] = useState<number>(0);
  const [tcaChannels, setTcaChannels] = useState<I2CChannelState[]>([
    { channel: 0, enabled: true, detectedDevices: [0x5a] },
    { channel: 1, enabled: false, detectedDevices: [] },
    { channel: 2, enabled: false, detectedDevices: [] },
    { channel: 3, enabled: false, detectedDevices: [] },
    { channel: 4, enabled: false, detectedDevices: [] },
    { channel: 5, enabled: false, detectedDevices: [] },
    { channel: 6, enabled: false, detectedDevices: [] },
    { channel: 7, enabled: false, detectedDevices: [] },
  ]);

  // MPR121 12 Electrodes State
  const [electrodes, setElectrodes] = useState<MPR121Electrode[]>(() =>
    Array.from({ length: 12 }, (_, i) => ({
      index: i,
      touched: false,
      filteredValue: 380,
      baselineValue: 400,
      touchThreshold: 12,
      releaseThreshold: 6,
      assignedTrack: i + 1,
    }))
  );

  // DFPlayer Mini Status
  const [dfplayer, setDfPlayer] = useState<DFPlayerStatus>({
    isPlaying: false,
    currentTrack: 1,
    volume: 20,
    eqMode: 'Normal',
    totalTracks: 12,
    busy: false,
  });

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<number[]>([0x70, 0x5a]);

  // Direct Register Inspector
  const [regAddr, setRegAddr] = useState('5A');
  const [regOffset, setRegOffset] = useState('00');
  const [regValue, setRegValue] = useState('8C');
  const [regReadResult, setRegReadResult] = useState<string | null>(null);

  // Sync soundEnabled with simulator
  useEffect(() => {
    audioSimulator.setMuted(!soundEnabled);
  }, [soundEnabled]);

  // Listen to incoming serial messages for telemetry
  useEffect(() => {
    const unsub = webSerialManager.onLine((line) => {
      // Parse touch event: [TOUCH_EVENT] CH:0 ELE:2 STATE:1 PLAY:3
      if (line.includes('[TOUCH_EVENT]')) {
        const eleMatch = line.match(/ELE:(\d+)/);
        const stateMatch = line.match(/STATE:(\d+)/);
        const playMatch = line.match(/PLAY:(\d+)/);
        if (eleMatch && stateMatch) {
          const eleIdx = parseInt(eleMatch[1], 10);
          const isTouched = stateMatch[1] === '1';

          setElectrodes((prev) =>
            prev.map((ele) => (ele.index === eleIdx ? { ...ele, touched: isTouched } : ele))
          );

          if (isTouched) {
            audioSimulator.playTouchClick(eleIdx);
            if (playMatch) {
              const trackNum = parseInt(playMatch[1], 10);
              setDfPlayer((prev) => ({
                ...prev,
                isPlaying: true,
                currentTrack: trackNum,
                busy: true,
              }));
              audioSimulator.playTrack(trackNum, dfplayer.volume);
            }
          } else {
            setDfPlayer((prev) => ({ ...prev, busy: false }));
          }
        }
      }

      // Parse DFPlayer commands
      if (line.includes('[DFP_PLAY]')) {
        const trackMatch = line.match(/Track: (\d+)/);
        if (trackMatch) {
          const track = parseInt(trackMatch[1], 10);
          setDfPlayer((prev) => ({ ...prev, isPlaying: true, currentTrack: track }));
          audioSimulator.playTrack(track, dfplayer.volume);
        }
      }
      if (line.includes('[DFP_VOL]')) {
        const volMatch = line.match(/Volume: (\d+)/);
        if (volMatch) {
          setDfPlayer((prev) => ({ ...prev, volume: parseInt(volMatch[1], 10) }));
        }
      }
      if (line.includes('[DFP_PAUSE]') || line.includes('[DFP_STOP]')) {
        setDfPlayer((prev) => ({ ...prev, isPlaying: false }));
        audioSimulator.stop();
      }

      // Parse I2C scan result
      if (line.startsWith('DEV:0x') || line.startsWith('FOUND:0x')) {
        const hexStr = line.substring(line.indexOf('0x') + 2);
        const addr = parseInt(hexStr, 16);
        if (!isNaN(addr)) {
          setDiscoveredDevices((prev) => (prev.includes(addr) ? prev : [...prev, addr]));
        }
      }
      if (line.includes('[REG_VAL]')) {
        setRegReadResult(line.replace('[REG_VAL]', '').trim());
      }
    });

    return () => unsub();
  }, [dfplayer.volume]);

  // Switch TCA9548A Channel
  const handleSelectTcaChannel = async (channel: number) => {
    setActiveChannel(channel);
    setTcaChannels((prev) =>
      prev.map((c) => ({ ...c, enabled: c.channel === channel }))
    );

    if (serialState === 'connected') {
      try {
        await webSerialManager.writeLine(`TCA:${channel}`);
        onLogMessage(`TCA9548A チャンネル${channel}に切替コマンド送信`, 'tx');
      } catch (err: any) {
        onLogMessage(`TCA切替エラー: ${err.message}`, 'error');
      }
    }
  };

  // Simulate or trigger Electrode touch
  const handleTouchElectrode = async (index: number) => {
    const target = electrodes.find((e) => e.index === index);
    if (!target) return;

    const newTouched = !target.touched;
    setElectrodes((prev) =>
      prev.map((e) => (e.index === index ? { ...e, touched: newTouched } : e))
    );

    if (newTouched) {
      audioSimulator.playTouchClick(index);
      const track = target.assignedTrack;
      setDfPlayer((prev) => ({
        ...prev,
        isPlaying: true,
        currentTrack: track,
        busy: true,
      }));
      audioSimulator.playTrack(track, dfplayer.volume);

      if (serialState === 'connected') {
        try {
          await webSerialManager.writeLine(`PLAY:${track}`);
          onLogMessage(`電極ELE${index} タッチ検知 -> DFPlayer Track ${track} 再生コマンド送信`, 'tx');
        } catch {
          // ignore
        }
      }
    } else {
      setDfPlayer((prev) => ({ ...prev, busy: false }));
    }
  };

  // DFPlayer Controls
  const handlePlayTrack = async (track: number) => {
    setDfPlayer((prev) => ({ ...prev, isPlaying: true, currentTrack: track }));
    audioSimulator.playTrack(track, dfplayer.volume);
    if (serialState === 'connected') {
      try {
        await webSerialManager.writeLine(`PLAY:${track}`);
        onLogMessage(`DFPlayer Track ${track} 再生`, 'tx');
      } catch {
        // ignore
      }
    }
  };

  const handleTogglePlayPause = async () => {
    const nextState = !dfplayer.isPlaying;
    setDfPlayer((prev) => ({ ...prev, isPlaying: nextState }));
    if (nextState) {
      audioSimulator.playTrack(dfplayer.currentTrack, dfplayer.volume);
      if (serialState === 'connected') await webSerialManager.writeLine('RESUME');
    } else {
      audioSimulator.stop();
      if (serialState === 'connected') await webSerialManager.writeLine('PAUSE');
    }
  };

  const handleVolumeChange = async (newVol: number) => {
    const vol = Math.max(0, Math.min(30, newVol));
    setDfPlayer((prev) => ({ ...prev, volume: vol }));
    if (serialState === 'connected') {
      try {
        await webSerialManager.writeLine(`VOL:${vol}`);
      } catch {
        // ignore
      }
    }
  };

  const handleScanI2c = async () => {
    setIsScanning(true);
    setDiscoveredDevices([]);
    if (serialState === 'connected') {
      try {
        await webSerialManager.writeLine('SCAN');
        onLogMessage('I2Cバススキャン要求送信 (0x01-0x7F)...', 'tx');
      } catch (err: any) {
        onLogMessage(`スキャン送信エラー: ${err.message}`, 'error');
      }
    } else {
      // Simulate scan in offline mode
      setTimeout(() => {
        setDiscoveredDevices([0x70, 0x5a]);
        setIsScanning(false);
        onLogMessage('I2Cプレビュースキャン完了: 0x70 (TCA9548A), 0x5A (MPR121) 検出', 'system');
      }, 600);
      return;
    }
    setTimeout(() => setIsScanning(false), 2000);
  };

  const handleWriteRegister = async () => {
    if (serialState !== 'connected') {
      onLogMessage('注意: レジスタ書き込みを行うには「USB接続」を開始してください。', 'error');
      return;
    }
    try {
      const line = `WR:${regAddr}:${regOffset}:${regValue}`;
      await webSerialManager.writeLine(line);
      onLogMessage(`I2Cレジスタ書き込み送信: Addr 0x${regAddr}, Reg 0x${regOffset} <- 0x${regValue}`, 'tx');
    } catch (err: any) {
      onLogMessage(`レジスタ書き込み失敗: ${err.message}`, 'error');
    }
  };

  const handleReadRegister = async () => {
    if (serialState !== 'connected') {
      onLogMessage('注意: レジスタ読み出しを行うには「USB接続」を開始してください。', 'error');
      return;
    }
    try {
      const line = `RD:${regAddr}:${regOffset}`;
      await webSerialManager.writeLine(line);
      onLogMessage(`I2Cレジスタ読み出し要求: Addr 0x${regAddr}, Reg 0x${regOffset}`, 'tx');
    } catch (err: any) {
      onLogMessage(`レジスタ読み出し失敗: ${err.message}`, 'error');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Banner & Sound Toggle */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>I2C リアルタイム・プレビュー＆インタラクティブ制御</span>
              <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-normal">
                Wire.h 直接制御対応
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              TCA9548A(0x70)のマルチプレクス切り替え、MPR121(0x5A)の12電極タッチ、DFPlayer Mini音声を即座にテストできます。
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-center">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
              soundEnabled
                ? 'bg-cyan-950/60 border-cyan-500/40 text-cyan-300'
                : 'bg-slate-950/60 border-slate-800 text-slate-500'
            }`}
            title="ブラウザ内蔵オーディオシンセサイザーのON/OFF"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4" />}
            <span>ブラウザ発音シミュレータ: {soundEnabled ? '有効' : 'ミュート'}</span>
          </button>

          <button
            onClick={handleScanI2c}
            disabled={isScanning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-cyan-400' : ''}`} />
            <span>{isScanning ? 'スキャン中...' : 'I2Cバススキャン'}</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: TCA9548A 8-Channel Switcher */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">TCA9548A 8チャンネル I2Cマルチプレクサ (アドレス: 0x70)</h3>
            <span className="text-[11px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
              Wire.write(1 &lt;&lt; {activeChannel})
            </span>
          </div>
          <span className="text-xs text-slate-400">
            選択チャンネル: <strong className="text-cyan-300 font-mono">CH {activeChannel}</strong>
          </span>
        </div>

        {/* Channels Grid 0-7 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2.5">
          {tcaChannels.map((ch) => {
            const isSelected = ch.channel === activeChannel;
            return (
              <button
                key={ch.channel}
                onClick={() => handleSelectTcaChannel(ch.channel)}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all relative ${
                  isSelected
                    ? 'bg-gradient-to-b from-cyan-950/80 to-slate-900 border-cyan-400 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-400/40'
                    : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-800/40 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={`text-[10px] font-mono font-bold ${isSelected ? 'text-cyan-300' : 'text-slate-500'}`}>
                    SD{ch.channel}/SC{ch.channel}
                  </span>
                  <div
                    className={`w-2 h-2 rounded-full ${
                      isSelected ? 'bg-cyan-400 shadow-sm shadow-cyan-400 animate-pulse' : 'bg-slate-700'
                    }`}
                  />
                </div>
                <div className={`text-base font-bold font-mono ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                  CH {ch.channel}
                </div>
                <div className="text-[10px] text-slate-400">
                  {ch.channel === 0 ? 'MPR121 (0x5A)' : '未割当'}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* SECTION 2 & 3: MPR121 12-Channel Touch Visualizer + DFPlayer Mini Soundboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: MPR121 12 Electrodes Touch Map */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white">MPR121 静電容量タッチ 12電極 (アドレス: 0x5A)</h3>
            </div>
            <span className="text-[11px] text-slate-400">
              クリックでタッチシミュレート / Arduino実機タッチで連動
            </span>
          </div>

          {/* 12 Electrodes Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {electrodes.map((ele) => {
              return (
                <div
                  key={ele.index}
                  onClick={() => handleTouchElectrode(ele.index)}
                  className={`p-3.5 rounded-xl border select-none cursor-pointer transition-all ${
                    ele.touched
                      ? 'bg-gradient-to-br from-amber-500/20 via-cyan-500/20 to-blue-500/20 border-cyan-400 shadow-lg shadow-cyan-500/20 ring-2 ring-cyan-400'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-white">ELE{ele.index}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold ${
                        ele.touched
                          ? 'bg-cyan-500 text-slate-950 font-bold'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {ele.touched ? 'TOUCHED' : 'OFF'}
                    </span>
                  </div>

                  {/* Capacitive level bar */}
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                      <span>静電容量</span>
                      <span>{ele.touched ? 'High (接触)' : 'Normal'}</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-150 ${
                          ele.touched ? 'bg-cyan-400 w-full' : 'bg-slate-600 w-1/4'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Track link */}
                  <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">再生トリガー:</span>
                    <span className="text-cyan-300 font-mono font-semibold flex items-center gap-1">
                      <Music className="w-3 h-3" />
                      Track {ele.assignedTrack}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg text-xs text-slate-400 flex items-start gap-2">
            <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <span>
              <strong>Wire.h 制御の仕組み:</strong> MPR121は専用ライブラリ不要。Arduino標準の <code className="text-cyan-300">Wire.h</code> を用い、レジスタ <code className="text-cyan-300">0x00</code> と <code className="text-cyan-300">0x01</code> を16ビット一括読み出しすることで、電極0〜11のタッチビットを約30ms周期で直接ポーリングしています。
            </span>
          </div>
        </div>

        {/* Right: DFRobotDFPlayerMini Soundboard Controller */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Music className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white">DFRobotDFPlayerMini プレイヤー</h3>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${dfplayer.busy ? 'bg-amber-400 animate-ping' : 'bg-slate-700'}`} />
              <span className="text-[11px] font-mono text-slate-400">BUSY Pin: {dfplayer.busy ? '再生中' : '待機中'}</span>
            </div>
          </div>

          {/* Current Track Display */}
          <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">CURRENT TRACK</span>
              <div className="text-xl font-bold text-white font-mono flex items-center gap-2">
                <span>{String(dfplayer.currentTrack).padStart(4, '0')}.mp3</span>
                <span className={`text-xs px-2 py-0.5 rounded font-sans ${dfplayer.isPlaying ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 text-slate-400'}`}>
                  {dfplayer.isPlaying ? '再生中' : '停止中'}
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">VOLUME</span>
              <span className="text-lg font-bold text-cyan-300 font-mono">{dfplayer.volume} / 30</span>
            </div>
          </div>

          {/* Player Button Controls */}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => handlePlayTrack(Math.max(1, dfplayer.currentTrack - 1))}
              className="p-3 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 transition active:scale-95"
              title="前の曲"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            <button
              onClick={handleTogglePlayPause}
              className="p-4 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-bold shadow-lg shadow-cyan-500/25 transition active:scale-95"
              title={dfplayer.isPlaying ? '一時停止' : '再生'}
            >
              {dfplayer.isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
            </button>

            <button
              onClick={() => handlePlayTrack(dfplayer.currentTrack + 1)}
              className="p-3 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 transition active:scale-95"
              title="次の曲"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          {/* Volume Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-400 font-medium">
              <span className="flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                音量設定 (DFPlayer Command 0x06)
              </span>
              <span className="font-mono text-cyan-300">{dfplayer.volume} / 30</span>
            </div>
            <input
              type="range"
              min="0"
              max="30"
              value={dfplayer.volume}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
              className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
          </div>

          {/* Direct Track Quick Buttons */}
          <div className="space-y-2">
            <span className="text-xs text-slate-400 font-medium block">クイックトラック選曲 (1〜12曲)</span>
            <div className="grid grid-cols-6 gap-1.5">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((trk) => (
                <button
                  key={trk}
                  onClick={() => handlePlayTrack(trk)}
                  className={`py-1.5 text-xs font-mono font-bold rounded-lg border transition ${
                    dfplayer.currentTrack === trk && dfplayer.isPlaying
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/30'
                      : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  #{trk}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 4: Direct I2C Register Read/Write Inspector */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">I2C レジスタ・ダイレクトインスペクター</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            検出中デバイス: {discoveredDevices.map((d) => `0x${d.toString(16).toUpperCase()}`).join(', ') || 'なし'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-[11px] text-slate-400 block mb-1 font-medium">デバイスアドレス (HEX)</label>
            <input
              type="text"
              value={regAddr}
              onChange={(e) => setRegAddr(e.target.value)}
              placeholder="5A"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-1 font-medium">レジスタ番号 (HEX)</label>
            <input
              type="text"
              value={regOffset}
              onChange={(e) => setRegOffset(e.target.value)}
              placeholder="5E"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-1 font-medium">書込データ値 (HEX)</label>
            <input
              type="text"
              value={regValue}
              onChange={(e) => setRegValue(e.target.value)}
              placeholder="8C"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={handleReadRegister}
              className="flex-1 py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
            >
              読出 (Read)
            </button>
            <button
              onClick={handleWriteRegister}
              className="flex-1 py-1.5 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 text-xs font-semibold transition"
            >
              書込 (Write)
            </button>
          </div>
        </div>

        {regReadResult && (
          <div className="p-3 bg-slate-950 border border-cyan-500/30 rounded-lg text-xs font-mono text-cyan-300 flex items-center justify-between">
            <span>受信レジスタ値: {regReadResult}</span>
            <button onClick={() => setRegReadResult(null)} className="text-slate-500 hover:text-slate-300 text-[10px]">クリア</button>
          </div>
        )}
      </div>
    </div>
  );
};
