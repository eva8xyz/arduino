import React, { useState } from 'react';
import { 
  Code2, Download, Copy, Check, Upload, FileCode, Play, Sparkles, FolderOpen, 
  RefreshCw, Save, Zap, AlertCircle 
} from 'lucide-react';
import JSZip from 'jszip';
import { SketchProject, SketchFile, InstalledLibrary } from '../types';
import { DEFAULT_SKETCHES } from '../services/defaultSketches';

interface CodeEditorProps {
  currentProject: SketchProject;
  setCurrentProject: React.Dispatch<React.SetStateAction<SketchProject>>;
  libraries: InstalledLibrary[];
  onLogMessage: (text: string, direction: 'system' | 'error' | 'success') => void;
  onNavigateToFlasher: () => void;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  currentProject,
  setCurrentProject,
  libraries,
  onLogMessage,
  onNavigateToFlasher,
}) => {
  const [activeFileName, setActiveFileName] = useState<string>(
    currentProject.files[0]?.name || 'sketch.ino'
  );
  const [copied, setCopied] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const activeFile = currentProject.files.find((f) => f.name === activeFileName) || currentProject.files[0];

  const handleCodeChange = (newContent: string) => {
    setCurrentProject((prev) => ({
      ...prev,
      files: prev.files.map((f) => (f.name === activeFileName ? { ...f, content: newContent } : f)),
    }));
  };

  const handleCopy = () => {
    if (!activeFile) return;
    navigator.clipboard.writeText(activeFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onLogMessage(`コードをクリップボードにコピーしました (${activeFile.name})`, 'system');
  };

  // Export single .ino file
  const handleDownloadIno = () => {
    if (!activeFile) return;
    const blob = new Blob([activeFile.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFile.name.endsWith('.ino') ? activeFile.name : `${currentProject.name}.ino`;
    a.click();
    URL.revokeObjectURL(url);
    onLogMessage(`.inoファイルをダウンロードしました: ${a.download}`, 'success');
  };

  // Export full project ZIP (including libraries)
  const handleDownloadZip = async () => {
    const zip = new JSZip();
    const folder = zip.folder(currentProject.name) || zip;

    // Add sketch files
    currentProject.files.forEach((f) => {
      folder.file(f.name, f.content);
    });

    // Add bundled libraries (e.g. DFRobotDFPlayerMini)
    const srcFolder = folder.folder('src') || folder;
    libraries.forEach((lib) => {
      lib.files.forEach((f) => {
        srcFolder.file(f.name, f.content);
      });
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentProject.name}_with_libraries.zip`;
    a.click();
    URL.revokeObjectURL(url);
    onLogMessage(`ライブラリ同梱の完全プロジェクトZIPをダウンロードしました`, 'success');
  };

  // Import local .ino file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const fileName = file.name;
      setCurrentProject((prev) => {
        const withoutOld = prev.files.filter((f) => f.name !== fileName);
        return {
          ...prev,
          name: fileName.replace(/\.ino$/i, ''),
          files: [{ name: fileName, content: text, isMain: true }, ...withoutOld],
        };
      });
      setActiveFileName(fileName);
      onLogMessage(`既存の.inoプロジェクト "${fileName}" を読み込みました`, 'success');
    };
    reader.readAsText(file);
  };

  // Drag and drop .ino
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.ino') || file.name.endsWith('.cpp') || file.name.endsWith('.h'))) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setCurrentProject((prev) => ({
          ...prev,
          name: file.name.replace(/\.(ino|cpp|h)$/i, ''),
          files: [{ name: file.name, content: text, isMain: true }, ...prev.files.filter((f) => f.name !== file.name)],
        }));
        setActiveFileName(file.name);
        onLogMessage(`ドロップされた "${file.name}" をエディタに読み込みました`, 'success');
      };
      reader.readAsText(file);
    }
  };

  const handleSelectTemplate = (templateId: string) => {
    const tmpl = DEFAULT_SKETCHES.find((s) => s.id === templateId);
    if (tmpl) {
      setCurrentProject(tmpl);
      setActiveFileName(tmpl.files[0]?.name || 'sketch.ino');
      onLogMessage(`テンプレート "${tmpl.name}" を読み込みました`, 'system');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Top Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Template Quick Loader */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-400 font-medium">スケッチ読込:</span>
          <select
            value={currentProject.id}
            onChange={(e) => handleSelectTemplate(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-cyan-300 font-medium focus:outline-none focus:border-cyan-500"
          >
            {DEFAULT_SKETCHES.map((s) => (
              <option key={s.id} value={s.id} className="bg-slate-900 text-slate-200">
                {s.name}
              </option>
            ))}
          </select>

          {/* Import .ino file button */}
          <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer transition">
            <Upload className="w-3.5 h-3.5 text-cyan-400" />
            <span>.inoファイルを開く</span>
            <input
              type="file"
              accept=".ino,.cpp,.h"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        {/* Export / Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'コピー完了' : 'コードコピー'}</span>
          </button>

          <button
            onClick={handleDownloadIno}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            title="編集した.inoファイルを保存"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>.ino出力</span>
          </button>

          <button
            onClick={handleDownloadZip}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            title="DFPlayerMiniライブラリ同梱のZIPアーカイブを出力"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>完全ZIP出力 (ライブラリ同梱)</span>
          </button>

          <button
            onClick={onNavigateToFlasher}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 shadow-md transition active:scale-95"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>書き込み画面へ</span>
          </button>
        </div>
      </div>

      {/* Editor & Multi-file Tabs */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={`bg-slate-900 border rounded-xl overflow-hidden shadow-xl transition-all ${
          dragActive ? 'border-cyan-400 ring-2 ring-cyan-400/30' : 'border-slate-800'
        }`}
      >
        {/* Tabs Bar */}
        <div className="bg-slate-950 border-b border-slate-800/80 px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {currentProject.files.map((file) => (
              <button
                key={file.name}
                onClick={() => setActiveFileName(file.name)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono transition ${
                  file.name === activeFileName
                    ? 'bg-slate-800 text-cyan-300 border border-slate-700 font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                <span>{file.name}</span>
              </button>
            ))}
          </div>

          <div className="text-[11px] text-slate-500 font-mono hidden sm:block">
            {activeFile?.content.split('\n').length || 0} 行
          </div>
        </div>

        {/* Code Editor Textarea */}
        <div className="relative flex">
          {/* Line Numbers Bar */}
          <div className="bg-slate-950/70 py-4 px-3 select-none text-right font-mono text-xs text-slate-600 border-r border-slate-800/60 hidden sm:block">
            {activeFile?.content.split('\n').map((_, idx) => (
              <div key={idx} className="leading-6">
                {idx + 1}
              </div>
            ))}
          </div>

          {/* Text Area */}
          <textarea
            value={activeFile?.content || ''}
            onChange={(e) => handleCodeChange(e.target.value)}
            spellCheck={false}
            className="flex-1 bg-slate-950 py-4 px-4 font-mono text-xs text-slate-200 leading-6 resize-none focus:outline-none min-h-[580px] selection:bg-cyan-500/30"
          />
        </div>
      </div>
    </div>
  );
};
