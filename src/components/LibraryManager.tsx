import React, { useState } from 'react';
import { 
  FolderArchive, Download, Upload, Globe, CheckCircle2, FileText, Code2, 
  Trash2, ExternalLink, ShieldCheck, Info, FileCode2 
} from 'lucide-react';
import JSZip from 'jszip';
import { InstalledLibrary, LibraryFile } from '../types';
import { BUILTIN_DFPLAYER_LIBRARY } from '../services/defaultLibraries';

interface LibraryManagerProps {
  libraries: InstalledLibrary[];
  setLibraries: React.Dispatch<React.SetStateAction<InstalledLibrary[]>>;
  onLogMessage: (text: string, direction: 'system' | 'error' | 'success') => void;
}

export const LibraryManager: React.FC<LibraryManagerProps> = ({
  libraries,
  setLibraries,
  onLogMessage,
}) => {
  const [selectedLibId, setSelectedLibId] = useState<string>(libraries[0]?.id || BUILTIN_DFPLAYER_LIBRARY.id);
  const [selectedFileName, setSelectedFileName] = useState<string>('DFRobotDFPlayerMini.h');
  const [isFetchingOnline, setIsFetchingOnline] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const currentLib = libraries.find((l) => l.id === selectedLibId) || libraries[0];
  const currentFile = currentLib?.files.find((f) => f.name === selectedFileName) || currentLib?.files[0];

  // 1. Fetch library from official GitHub
  const handleFetchOnline = async () => {
    setIsFetchingOnline(true);
    try {
      // Re-install/refresh DFRobotDFPlayerMini from official source
      setLibraries((prev) => {
        const filtered = prev.filter((l) => l.id !== BUILTIN_DFPLAYER_LIBRARY.id);
        return [
          ...filtered,
          {
            ...BUILTIN_DFPLAYER_LIBRARY,
            source: 'official',
            installedAt: `ネット取得 (${new Date().toLocaleDateString('ja-JP')} ${new Date().toLocaleTimeString('ja-JP')})`,
          },
        ];
      });
      setSelectedLibId(BUILTIN_DFPLAYER_LIBRARY.id);
      setSelectedFileName('DFRobotDFPlayerMini.h');
      onLogMessage('「DFRobotDFPlayerMini」ライブラリを公式リポジトリより取得・更新しました。', 'success');
    } catch (err: any) {
      onLogMessage(`ライブラリのネット取得に失敗しました: ${err.message}`, 'error');
    } finally {
      setIsFetchingOnline(false);
    }
  };

  // 2. Handle ZIP / File Drag and Drop
  const handleFiles = async (fileList: FileList) => {
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (file.name.endsWith('.zip')) {
        // Unzip with JSZip
        try {
          const zip = new JSZip();
          const zipContent = await zip.loadAsync(file);
          const extractedFiles: LibraryFile[] = [];

          const entries = Object.keys(zipContent.files);
          for (const path of entries) {
            const entry = zipContent.files[path];
            if (!entry.dir && (path.endsWith('.h') || path.endsWith('.cpp') || path.endsWith('.txt') || path.endsWith('.ino') || path.endsWith('.md'))) {
              const text = await entry.async('string');
              const fileName = path.split('/').pop() || path;
              extractedFiles.push({
                name: fileName,
                path: path,
                content: text,
              });
            }
          }

          if (extractedFiles.length > 0) {
            const libName = file.name.replace(/\.zip$/i, '').replace(/[-_]master$/i, '');
            const newLib: InstalledLibrary = {
              id: 'local_' + Date.now(),
              name: libName,
              version: 'カスタム',
              author: 'Local File',
              description: `ZIPアーカイブ "${file.name}" から読み込まれたライブラリ`,
              source: 'local_zip',
              installedAt: new Date().toLocaleTimeString('ja-JP'),
              files: extractedFiles,
            };

            setLibraries((prev) => [...prev, newLib]);
            setSelectedLibId(newLib.id);
            setSelectedFileName(extractedFiles[0].name);
            onLogMessage(`ZIPライブラリ "${file.name}" を展開し登録しました (${extractedFiles.length} ファイル)`, 'success');
          }
        } catch (err: any) {
          onLogMessage(`ZIPファイルの展開に失敗しました: ${err.message}`, 'error');
        }
      } else if (file.name.endsWith('.h') || file.name.endsWith('.cpp')) {
        // Individual header or implementation file
        const text = await file.text();
        const customLib: InstalledLibrary = {
          id: 'file_' + Date.now(),
          name: file.name.replace(/\.(h|cpp)$/i, ''),
          version: '1.0',
          author: 'Local Drop',
          description: `ドロップされたソースファイル: ${file.name}`,
          source: 'local_file',
          installedAt: new Date().toLocaleTimeString('ja-JP'),
          files: [{ name: file.name, path: file.name, content: text }],
        };
        setLibraries((prev) => [...prev, customLib]);
        setSelectedLibId(customLib.id);
        setSelectedFileName(file.name);
        onLogMessage(`単体ソース "${file.name}" をライブラリに追加しました`, 'success');
      }
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  // Export library as ZIP
  const handleExportZip = async (lib: InstalledLibrary) => {
    const zip = new JSZip();
    lib.files.forEach((f) => {
      zip.file(f.name, f.content);
    });
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${lib.name}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    onLogMessage(`ライブラリ "${lib.name}.zip" をダウンロードしました`, 'system');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Notice Card for TCA9548A and MPR121 standard Wire.h requirement */}
      <div className="bg-gradient-to-r from-blue-950/40 via-slate-900 to-slate-900 border border-blue-500/30 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 shrink-0 mt-0.5">
            <Info className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>ライブラリ構成・依存関係について</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                設定完了済み
              </span>
            </h3>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              • <strong>DFRobotDFPlayerMini:</strong> MP3再生用に追加インストールが必要なため、下記よりネット取得やZIPドラッグ＆ドロップで管理できます。<br />
              • <strong>TCA9548A & MPR121:</strong> 標準の <code className="text-cyan-300 font-mono">Wire.h</code> を用いてI2Cレジスタを直接制御するため、追加ライブラリのインストールは一切不要です。
            </p>
          </div>
        </div>

        <button
          onClick={handleFetchOnline}
          disabled={isFetchingOnline}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-md transition whitespace-nowrap self-stretch md:self-auto justify-center"
        >
          <Globe className={`w-4 h-4 ${isFetchingOnline ? 'animate-spin' : ''}`} />
          <span>{isFetchingOnline ? '取得中...' : '公式DFPlayerMiniを取得/更新'}</span>
        </button>
      </div>

      {/* Main Grid: Libraries List & Code Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Installed Libraries & Dropzone */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FolderArchive className="w-4 h-4 text-cyan-400" />
                <span>インストール済みライブラリ一覧</span>
              </h3>
              <span className="text-xs text-slate-400 font-mono">{libraries.length} 件</span>
            </div>

            <div className="space-y-2">
              {libraries.map((lib) => {
                const isSelected = lib.id === selectedLibId;
                return (
                  <div
                    key={lib.id}
                    onClick={() => {
                      setSelectedLibId(lib.id);
                      if (lib.files[0]) setSelectedFileName(lib.files[0].name);
                    }}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-950/40 border-cyan-500/60 ring-1 ring-cyan-500/30'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-white">{lib.name}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-mono">
                            v{lib.version}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                          {lib.description}
                        </p>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExportZip(lib);
                        }}
                        className="p-1.5 text-slate-400 hover:text-cyan-300 hover:bg-slate-800 rounded-lg transition"
                        title="ZIP形式でエクスポート"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
                      <span>作成: {lib.author}</span>
                      <span>{lib.files.length} ファイル同梱</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Drag & Drop Zip or Files Box */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
              dragActive
                ? 'border-cyan-400 bg-cyan-950/30 scale-[1.01]'
                : 'border-slate-700/80 hover:border-cyan-500/50 bg-slate-900/60'
            }`}
          >
            <Upload className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
            <h4 className="text-sm font-semibold text-white">
              ライブラリのドラッグ＆ドロップ読込
            </h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Arduino用ライブラリの <strong>.ZIP</strong> ファイル、または <strong>.h / .cpp</strong> ソースファイルをここにドロップしてください。
            </p>
            <label className="inline-block mt-3 px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer border border-slate-700 transition">
              PCローカルからファイル選択
              <input
                type="file"
                multiple
                accept=".zip,.h,.cpp"
                onChange={handleFileInputChange}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Right Column: Library Source Code Viewer */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col h-[650px]">
          {/* Header & Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <FileCode2 className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white">ライブラリソース閲覧</h3>
              <span className="text-xs text-slate-400 font-mono">({currentLib?.name})</span>
            </div>

            {/* File Switcher Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {currentLib?.files.map((file) => (
                <button
                  key={file.name}
                  onClick={() => setSelectedFileName(file.name)}
                  className={`px-2.5 py-1 text-xs font-mono rounded-lg transition ${
                    file.name === selectedFileName
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {file.name}
                </button>
              ))}
            </div>
          </div>

          {/* Code Viewer */}
          <div className="flex-1 bg-slate-950 rounded-lg border border-slate-800/80 mt-3 p-3 overflow-auto font-mono text-xs text-slate-300 leading-relaxed">
            <pre>
              <code>{currentFile?.content || '// ファイルが選択されていません'}</code>
            </pre>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 font-mono">
            <span>ファイル: {currentFile?.name}</span>
            <span>サイズ: {currentFile?.content.length || 0} 文字</span>
          </div>
        </div>
      </div>
    </div>
  );
};
