/**
 * Web Serial API Manager for Arduino Communication & Flashing
 */

export type SerialState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface SerialPortInfo {
  usbVendorId?: number;
  usbProductId?: number;
}

class WebSerialManager {
  private port: any = null;
  private reader: any = null;
  private writer: any = null;
  private isReading = false;
  private state: SerialState = 'disconnected';
  private currentBaudRate = 115200;
  private lineBuffer = '';

  private onDataCallbacks: ((data: string) => void)[] = [];
  private onLineCallbacks: ((line: string) => void)[] = [];
  private onStateCallbacks: ((state: SerialState, info?: string) => void)[] = [];

  isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  isInIframe(): boolean {
    try {
      return typeof window !== 'undefined' && window.self !== window.top;
    } catch {
      return true;
    }
  }

  getDiagnostics(): { supported: boolean; isIframe: boolean; browser: string } {
    const supported = this.isSupported();
    const isIframe = this.isInIframe();
    let browser = '不明';
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent;
      if (ua.includes('Edg/')) browser = 'Microsoft Edge';
      else if (ua.includes('Chrome/')) browser = 'Google Chrome';
      else if (ua.includes('Safari/')) browser = 'Apple Safari (Web Serial非対応)';
      else if (ua.includes('Firefox/')) browser = 'Mozilla Firefox (Web Serial非対応)';
    }
    return { supported, isIframe, browser };
  }

  getState(): SerialState {
    return this.state;
  }

  getPort(): any {
    return this.port;
  }

  getBaudRate(): number {
    return this.currentBaudRate;
  }

  onData(cb: (data: string) => void) {
    this.onDataCallbacks.push(cb);
    return () => {
      this.onDataCallbacks = this.onDataCallbacks.filter((c) => c !== cb);
    };
  }

  onLine(cb: (line: string) => void) {
    this.onLineCallbacks.push(cb);
    return () => {
      this.onLineCallbacks = this.onLineCallbacks.filter((c) => c !== cb);
    };
  }

  onStateChange(cb: (state: SerialState, info?: string) => void) {
    this.onStateCallbacks.push(cb);
    return () => {
      this.onStateCallbacks = this.onStateCallbacks.filter((c) => c !== cb);
    };
  }

  private setState(newState: SerialState, info?: string) {
    this.state = newState;
    this.onStateCallbacks.forEach((cb) => cb(newState, info));
  }

  async requestPortAndConnect(baudRate = 115200): Promise<boolean> {
    if (!this.isSupported()) {
      throw new Error('お使いのブラウザはWeb Serial APIに対応していません。Google ChromeまたはMicrosoft Edgeをご利用ください。');
    }

    try {
      this.setState('connecting', 'COMポートの選択を待機中...');
      const port = await (navigator as any).serial.requestPort({
        // Can filter by standard Arduino USB VID/PIDs if needed, or allow any serial
      });

      this.port = port;
      this.currentBaudRate = baudRate;
      await this.openPort(baudRate);
      return true;
    } catch (err: any) {
      if (err.name === 'NotFoundError') {
        this.setState('disconnected', '接続がキャンセルされました');
      } else {
        this.setState('error', err.message || '接続に失敗しました');
      }
      return false;
    }
  }

  async openPort(baudRate = 115200): Promise<void> {
    if (!this.port) throw new Error('Port not selected');
    this.currentBaudRate = baudRate;

    try {
      await this.port.open({
        baudRate: baudRate,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        flowControl: 'none',
        bufferSize: 16384,
      });

      const info = this.port.getInfo ? this.port.getInfo() : {};
      const vidPid = info.usbVendorId
        ? ` (VID: 0x${info.usbVendorId.toString(16).padStart(4, '0')} PID: 0x${(info.usbProductId || 0).toString(16).padStart(4, '0')})`
        : '';

      this.setState('connected', `接続成功: ${baudRate}bps${vidPid}`);
      this.startReading();
    } catch (err: any) {
      this.setState('error', `ポートオープンエラー: ${err.message}`);
      throw err;
    }
  }

  private async startReading(): Promise<void> {
    if (!this.port || !this.port.readable) return;
    this.isReading = true;
    const textDecoder = new TextDecoder();

    while (this.isReading && this.port && this.port.readable) {
      try {
        this.reader = this.port.readable.getReader();
        while (this.isReading) {
          const { value, done } = await this.reader.read();
          if (done) break;
          if (value) {
            const chunk = textDecoder.decode(value);
            this.onDataCallbacks.forEach((cb) => cb(chunk));

            // Parse lines
            this.lineBuffer += chunk;
            const lines = this.lineBuffer.split(/\r?\n/);
            this.lineBuffer = lines.pop() || '';
            for (const line of lines) {
              if (line.trim().length > 0) {
                this.onLineCallbacks.forEach((cb) => cb(line.trim()));
              }
            }
          }
        }
      } catch (err: any) {
        if (this.isReading) {
          // ignore transient reads if closed intentionally
        }
        break;
      } finally {
        if (this.reader) {
          try {
            this.reader.releaseLock();
          } catch {
            // ignore
          }
          this.reader = null;
        }
      }
    }
  }

  async pauseReading(): Promise<void> {
    this.isReading = false;
    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch {
        // ignore
      }
      try {
        this.reader.releaseLock();
      } catch {
        // ignore
      }
      this.reader = null;
    }
    // Give browser event loop time to release stream lock
    await new Promise((r) => setTimeout(r, 60));
  }

  async resumeReading(): Promise<void> {
    if (this.state === 'connected' && this.port && this.port.readable) {
      this.startReading();
    }
  }

  async write(data: string | Uint8Array): Promise<void> {
    if (!this.port || !this.port.writable) {
      throw new Error('シリアルポートが接続されていません。');
    }

    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    this.writer = this.port.writable.getWriter();
    try {
      await this.writer.write(bytes);
    } finally {
      this.writer.releaseLock();
      this.writer = null;
    }
  }

  async writeLine(line: string): Promise<void> {
    await this.write(line + '\r\n');
  }

  async disconnect(): Promise<void> {
    this.isReading = false;
    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch {
        // ignore
      }
      try {
        this.reader.releaseLock();
      } catch {
        // ignore
      }
      this.reader = null;
    }
    if (this.writer) {
      try {
        this.writer.releaseLock();
      } catch {
        // ignore
      }
      this.writer = null;
    }
    if (this.port) {
      try {
        await this.port.close();
      } catch {
        // ignore
      }
      this.port = null;
    }
    this.setState('disconnected', '切断されました');
  }
}

export const webSerialManager = new WebSerialManager();
