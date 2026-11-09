/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { FlasherPanel } from './components/FlasherPanel';
import { I2CStudio } from './components/I2CStudio';
import { CodeEditor } from './components/CodeEditor';
import { LibraryManager } from './components/LibraryManager';
import { SerialMonitor } from './components/SerialMonitor';
import { WiringDiagramModal } from './components/WiringDiagramModal';
import { BoardConfig, SerialLogMessage, SketchProject, InstalledLibrary } from './types';
import { SUPPORTED_BOARDS } from './services/boards';
import { DEFAULT_SKETCHES } from './services/defaultSketches';
import { BUILTIN_DFPLAYER_LIBRARY } from './services/defaultLibraries';
import { webSerialManager, SerialState } from './services/webSerial';

export default function App() {
  const [activeTab, setActiveTab] = useState<'flasher' | 'i2c' | 'editor' | 'libraries' | 'serial'>('flasher');
  const [selectedBoard, setSelectedBoard] = useState<BoardConfig>(SUPPORTED_BOARDS[0]);
  const [baudRate, setBaudRate] = useState<number>(115200);
  const [serialState, setSerialState] = useState<SerialState>('disconnected');
  const [serialStatusMessage, setSerialStatusMessage] = useState<string>('未接続');
  const [isWiringModalOpen, setIsWiringModalOpen] = useState<boolean>(false);

  // Sketch project & installed libraries state
  const [currentProject, setCurrentProject] = useState<SketchProject>(DEFAULT_SKETCHES[0]);
  const [libraries, setLibraries] = useState<InstalledLibrary[]>([BUILTIN_DFPLAYER_LIBRARY]);

  // Serial logs
  const [logs, setLogs] = useState<SerialLogMessage[]>([
    {
      id: 'init_log_1',
      timestamp: new Date().toLocaleTimeString(),
      direction: 'system',
      text: 'システム起動完了: Web Arduino Flasher & I2C Studio Ready (Chrome/Edge Web Serial対応)',
    },
    {
      id: 'init_log_2',
      timestamp: new Date().toLocaleTimeString(),
      direction: 'system',
      text: 'DFRobotDFPlayerMiniライブラリ インストール済み (TCA9548A・MPR121はWire.hレジスタ直接制御)',
    },
  ]);

  // Hook into Web Serial events
  useEffect(() => {
    const unsubState = webSerialManager.onStateChange((state, info) => {
      setSerialState(state);
      if (info) setSerialStatusMessage(info);
    });

    const unsubLine = webSerialManager.onLine((line) => {
      setLogs((prev) => [
        ...prev.slice(-300), // Keep last 300 logs
        {
          id: 'rx_' + Date.now() + Math.random(),
          timestamp: new Date().toLocaleTimeString(),
          direction: 'rx',
          text: line,
        },
      ]);
    });

    return () => {
      unsubState();
      unsubLine();
    };
  }, []);

  const handleConnectSerial = async (): Promise<boolean> => {
    try {
      const ok = await webSerialManager.requestPortAndConnect(baudRate);
      if (ok) {
        addLog(`Arduinoと接続しました (${baudRate} bps)`, 'success');
      }
      return ok;
    } catch (err: any) {
      addLog(`USB接続エラー: ${err.message}`, 'error');
      return false;
    }
  };

  const handleDisconnectSerial = async () => {
    await webSerialManager.disconnect();
    addLog('USBシリアルポートを切断しました', 'system');
  };

  const addLog = (text: string, direction: 'system' | 'tx' | 'rx' | 'error' | 'success') => {
    setLogs((prev) => [
      ...prev.slice(-300),
      {
        id: 'log_' + Date.now() + Math.random(),
        timestamp: new Date().toLocaleTimeString(),
        direction,
        text,
      },
    ]);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedBoard={selectedBoard}
        setSelectedBoard={setSelectedBoard}
        serialState={serialState}
        serialStatusMessage={serialStatusMessage}
        baudRate={baudRate}
        setBaudRate={setBaudRate}
        onConnectSerial={handleConnectSerial}
        onDisconnectSerial={handleDisconnectSerial}
        onOpenWiringGuide={() => setIsWiringModalOpen(true)}
      />

      {/* Browser & Iframe Diagnostics Banner */}
      {(!webSerialManager.isSupported() || webSerialManager.isInIframe()) && (
        <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            {!webSerialManager.isSupported() ? (
              <div className="flex items-center gap-2 text-amber-300">
                <span className="p-1 rounded bg-amber-500/20 text-amber-400 font-bold">要確認</span>
                <span>
                  お使いのブラウザはWeb Serial API（USB接続）に対応していません。Windows / Mac の <strong>Google Chrome</strong> または <strong>Microsoft Edge</strong> で開いてください。
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-cyan-300">
                <span className="p-1 rounded bg-cyan-500/20 text-cyan-400 font-bold">INFO</span>
                <span>
                  プレビュー枠内(iframe)ではブラウザのセキュリティ設定によりUSBアクセスが制限される場合があります。正常に接続できない場合は「新しいタブで開く」をお試しください。
                </span>
              </div>
            )}

            <button
              onClick={() => window.open(window.location.href, '_blank')}
              className="px-3 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 font-semibold whitespace-nowrap self-end sm:self-auto transition"
            >
              新しいタブで開く ↗
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
        {activeTab === 'flasher' && (
          <FlasherPanel
            selectedBoard={selectedBoard}
            serialState={serialState}
            onConnectSerial={handleConnectSerial}
            onLogMessage={addLog}
          />
        )}

        {activeTab === 'i2c' && (
          <I2CStudio
            serialState={serialState}
            onLogMessage={addLog}
          />
        )}

        {activeTab === 'editor' && (
          <CodeEditor
            currentProject={currentProject}
            setCurrentProject={setCurrentProject}
            libraries={libraries}
            onLogMessage={addLog}
            onNavigateToFlasher={() => setActiveTab('flasher')}
          />
        )}

        {activeTab === 'libraries' && (
          <LibraryManager
            libraries={libraries}
            setLibraries={setLibraries}
            onLogMessage={addLog}
          />
        )}

        {activeTab === 'serial' && (
          <SerialMonitor
            logs={logs}
            setLogs={setLogs}
            serialState={serialState}
            baudRate={baudRate}
            onConnectSerial={handleConnectSerial}
          />
        )}
      </main>

      {/* Wiring & Circuit Pinout Modal */}
      <WiringDiagramModal
        isOpen={isWiringModalOpen}
        onClose={() => setIsWiringModalOpen(false)}
      />

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            Web Arduino Flasher & I2C Studio • Web Serial API / STK500v1 / Wire.h / DFRobotDFPlayerMini
          </span>
          <span className="text-slate-600">
            IDE未導入のPCでもUSB接続するだけでブラウザから直接書き込み可能
          </span>
        </div>
      </footer>
    </div>
  );
}
