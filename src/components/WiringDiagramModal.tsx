import React from 'react';
import { X, Cpu, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';

interface WiringDiagramModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WiringDiagramModal: React.FC<WiringDiagramModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-slate-800 p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Arduino Uno R3 + TCA9548A + MPR121 + DFPlayer Mini 配線・結線ガイド
              </h3>
              <p className="text-xs text-slate-400">
                回路ショート防止と安定動作のためのピンアサイン一覧表
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 text-sm">
          {/* Important Warning Notice */}
          <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-300 text-xs flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
            <div className="space-y-1">
              <strong className="font-bold">DFPlayer MiniのRXピン保護について:</strong>
              <p className="leading-relaxed text-amber-200/90">
                Arduino Unoのデジタル出力は5Vですが、DFPlayer Miniのシリアル信号入力(RX)は3.3V耐圧です。ノイズ防止および破損を防ぐため、<strong>Arduino Pin 11 (TX) と DFPlayer MiniのRXピンの間に「1kΩ抵抗」</strong>を直列に挟むことを推奨します。
              </p>
            </div>
          </div>

          {/* Section 1: TCA9548A Wiring */}
          <div className="space-y-3">
            <h4 className="font-bold text-white flex items-center gap-2 text-sm border-b border-slate-800 pb-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              1. Arduino Uno R3 ⇄ TCA9548A (I2Cマルチプレクサ 0x70)
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <th className="p-2 text-left">Arduino Uno Pin</th>
                    <th className="p-2 text-left">TCA9548A Pin</th>
                    <th className="p-2 text-left">機能・説明</th>
                    <th className="p-2 text-left">推奨線色</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  <tr>
                    <td className="p-2 font-bold text-cyan-300">5V</td>
                    <td className="p-2 font-bold">VIN / VCC</td>
                    <td className="p-2 font-sans">電源供給 (5V)</td>
                    <td className="p-2 text-rose-400">赤 (Red)</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-bold text-slate-400">GND</td>
                    <td className="p-2 font-bold">GND</td>
                    <td className="p-2 font-sans">グラウンド共通接地</td>
                    <td className="p-2 text-slate-400">黒 (Black)</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-bold text-cyan-300">A4 (またはSDA)</td>
                    <td className="p-2 font-bold">SDA</td>
                    <td className="p-2 font-sans">I2C データバス (Wire.h)</td>
                    <td className="p-2 text-blue-400">青 (Blue)</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-bold text-cyan-300">A5 (またはSCL)</td>
                    <td className="p-2 font-bold">SCL</td>
                    <td className="p-2 font-sans">I2C クロックバス (Wire.h)</td>
                    <td className="p-2 text-amber-400">黄 (Yellow)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: MPR121 Wiring */}
          <div className="space-y-3">
            <h4 className="font-bold text-white flex items-center gap-2 text-sm border-b border-slate-800 pb-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              2. TCA9548A ⇄ MPR121 (静電容量タッチセンサ 0x5A)
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <th className="p-2 text-left">TCA9548A / 電源</th>
                    <th className="p-2 text-left">MPR121 Pin</th>
                    <th className="p-2 text-left">機能・説明</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  <tr>
                    <td className="p-2 font-bold text-cyan-300">3.3V (Uno電源)</td>
                    <td className="p-2 font-bold">3.3V / VCC</td>
                    <td className="p-2 font-sans">MPR121用電源 (※3.3V推奨)</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-bold text-slate-400">GND</td>
                    <td className="p-2 font-bold">GND</td>
                    <td className="p-2 font-sans">共通GND</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-bold text-cyan-300">SD0 (チャンネル0)</td>
                    <td className="p-2 font-bold">SDA</td>
                    <td className="p-2 font-sans">Mux CH0 I2Cデータ</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-bold text-cyan-300">SC0 (チャンネル0)</td>
                    <td className="p-2 font-bold">SCL</td>
                    <td className="p-2 font-sans">Mux CH0 I2Cクロック</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-bold text-slate-400">GNDに接続</td>
                    <td className="p-2 font-bold">ADDR</td>
                    <td className="p-2 font-sans">アドレス設定: 0x5Aに固定</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-bold text-slate-400">アルミ箔や導電テープ</td>
                    <td className="p-2 font-bold">ELE0 〜 ELE11</td>
                    <td className="p-2 font-sans">12個のタッチ電極パッド</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: DFPlayer Mini Wiring */}
          <div className="space-y-3">
            <h4 className="font-bold text-white flex items-center gap-2 text-sm border-b border-slate-800 pb-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              3. Arduino Uno R3 ⇄ DFRobot DFPlayer Mini (MP3再生)
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <th className="p-2 text-left">Arduino Uno Pin</th>
                    <th className="p-2 text-left">DFPlayer Pin</th>
                    <th className="p-2 text-left">結線上の重要ポイント</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  <tr>
                    <td className="p-2 font-bold text-cyan-300">5V</td>
                    <td className="p-2 font-bold">VCC (Pin 1)</td>
                    <td className="p-2 font-sans">安定した電源供給 (大音量時は別電源も推奨)</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-bold text-slate-400">GND</td>
                    <td className="p-2 font-bold">GND (Pin 7 / 10)</td>
                    <td className="p-2 font-sans">共通GND</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-bold text-cyan-300">Pin 10 (SoftwareSerial RX)</td>
                    <td className="p-2 font-bold">TX (Pin 3)</td>
                    <td className="p-2 font-sans">直接接続OK</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-bold text-cyan-300">Pin 11 (SoftwareSerial TX)</td>
                    <td className="p-2 font-bold">RX (Pin 2)</td>
                    <td className="p-2 font-sans font-bold text-amber-300">
                      ※1kΩ抵抗を直列に接続して降圧保護
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2 font-bold text-slate-400">スピーカー端子(+)</td>
                    <td className="p-2 font-bold">SPK_1 (Pin 6)</td>
                    <td className="p-2 font-sans">3W 4〜8Ω スピーカー</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-bold text-slate-400">スピーカー端子(-)</td>
                    <td className="p-2 font-bold">SPK_2 (Pin 8)</td>
                    <td className="p-2 font-sans">3W 4〜8Ω スピーカー</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* MicroSD card notes */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <h5 className="font-bold text-white text-xs flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              MicroSDカード内のMP3ファイル配置方法
            </h5>
            <p className="text-xs text-slate-400 leading-relaxed">
              SDカードは <strong>FAT32</strong> でフォーマットしてください。<br />
              ルートフォルダまたは <code className="text-cyan-300 font-mono">/mp3/</code> フォルダ内に、
              <code className="text-cyan-300 font-mono">0001.mp3</code>, <code className="text-cyan-300 font-mono">0002.mp3</code>, ... <code className="text-cyan-300 font-mono">0012.mp3</code> のように4桁の番号で保存すると、MPR121の電極0〜11と1対1で対応して即座に再生されます。
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-slate-900 border-t border-slate-800 p-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
