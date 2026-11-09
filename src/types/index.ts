export interface BoardConfig {
  id: string;
  name: string;
  mcu: string;
  baudRate: number;
  pageSize: number;
  flashSize: number;
  signature: number[];
  protocol: 'stk500v1' | 'stk500v2';
  description: string;
}

export interface FirmwarePreset {
  id: string;
  name: string;
  description: string;
  version: string;
  targetMcu: string;
  hex: string;
  author: string;
  features: string[];
}

export interface LibraryFile {
  name: string;
  path: string;
  content: string;
}

export interface InstalledLibrary {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  source: 'official' | 'local_zip' | 'local_file';
  installedAt: string;
  files: LibraryFile[];
}

export interface SketchFile {
  name: string;
  content: string;
  isMain?: boolean;
}

export interface SketchProject {
  id: string;
  name: string;
  description: string;
  files: SketchFile[];
}

export interface MPR121Electrode {
  index: number;
  touched: boolean;
  filteredValue: number;
  baselineValue: number;
  touchThreshold: number;
  releaseThreshold: number;
  assignedTrack: number;
}

export interface I2CChannelState {
  channel: number;
  enabled: boolean;
  detectedDevices: number[];
}

export interface DFPlayerStatus {
  isPlaying: boolean;
  currentTrack: number;
  volume: number;
  eqMode: 'Normal' | 'Pop' | 'Rock' | 'Jazz' | 'Classic' | 'Bass';
  totalTracks: number;
  busy: boolean;
}

export interface SerialLogMessage {
  id: string;
  timestamp: string;
  direction: 'rx' | 'tx' | 'system' | 'error' | 'success';
  text: string;
}

export interface FlashProgress {
  phase: 'idle' | 'resetting' | 'handshake' | 'sync' | 'flashing' | 'verifying' | 'completed' | 'error';
  percent: number;
  message: string;
  bytesWritten: number;
  totalBytes: number;
}
