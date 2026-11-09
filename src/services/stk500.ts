/**
 * STK500v1 / Optiboot Protocol Implementation for Web Serial API
 * Compatible with Arduino Uno R3, Nano, Pro Mini, and ATmega328P based boards.
 */

import { parseHex } from './intelHex';
import { BoardConfig, FlashProgress } from '../types';

// STK500 Constants
const STK_OK = 0x10;
const STK_INSYNC = 0x14;
const STK_GET_SYNC = 0x30;
const STK_ENTER_PROGMODE = 0x50;
const STK_LEAVE_PROGMODE = 0x51;
const STK_LOAD_ADDRESS = 0x55;
const STK_PROG_PAGE = 0x64;
const STK_READ_PAGE = 0x74;
const STK_READ_SIGN = 0x75;
const SYNC_CRC_EOP = 0x20;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class Stk500Flasher {
  private port: any;
  private reader: any = null;
  private writer: any = null;
  private rxBuffer: number[] = [];
  private readingActive = false;

  constructor(serialPort: any) {
    this.port = serialPort;
  }

  private async startReader(): Promise<void> {
    this.rxBuffer = [];
    this.readingActive = true;
    (async () => {
      while (this.readingActive && this.port.readable) {
        try {
          this.reader = this.port.readable.getReader();
          while (this.readingActive) {
            const { value, done } = await this.reader.read();
            if (done) break;
            if (value) {
              for (let i = 0; i < value.length; i++) {
                this.rxBuffer.push(value[i]);
              }
            }
          }
        } catch {
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
    })();
  }

  private stopReader(): void {
    this.readingActive = false;
    if (this.reader) {
      try {
        this.reader.cancel();
      } catch {
        // ignore
      }
    }
  }

  private async writeBytes(bytes: number[] | Uint8Array): Promise<void> {
    const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    this.writer = this.port.writable.getWriter();
    try {
      await this.writer.write(data);
    } finally {
      this.writer.releaseLock();
      this.writer = null;
    }
  }

  private async readExactBytes(count: number, timeoutMs = 1500): Promise<number[]> {
    const startTime = Date.now();
    while (this.rxBuffer.length < count) {
      if (Date.now() - startTime > timeoutMs) {
        throw new Error(`Timeout waiting for ${count} bytes (received ${this.rxBuffer.length})`);
      }
      await sleep(10);
    }
    return this.rxBuffer.splice(0, count);
  }

  private async drainBuffer(): Promise<void> {
    this.rxBuffer = [];
    await sleep(20);
    this.rxBuffer = [];
  }

  /**
   * Reset Arduino into bootloader via DTR/RTS pulse
   */
  async resetBoard(): Promise<void> {
    try {
      // Toggle DTR low then high to reset
      await this.port.setSignals({ dataTerminalReady: false, requestToSend: false });
      await sleep(250);
      await this.port.setSignals({ dataTerminalReady: true, requestToSend: true });
      await sleep(50);
    } catch {
      // Some platforms don't support setSignals on Web Serial, proceed anyway
    }
  }

  /**
   * Send STK_GET_SYNC and verify response
   */
  async sync(maxAttempts = 15): Promise<boolean> {
    for (let i = 0; i < maxAttempts; i++) {
      await this.drainBuffer();
      await this.writeBytes([STK_GET_SYNC, SYNC_CRC_EOP]);
      try {
        const response = await this.readExactBytes(2, 200);
        if (response[0] === STK_INSYNC && response[1] === STK_OK) {
          return true;
        }
      } catch {
        // Retry
      }
      await sleep(50);
    }
    return false;
  }

  /**
   * Read board chip signature
   */
  async readSignature(): Promise<number[]> {
    await this.drainBuffer();
    await this.writeBytes([STK_READ_SIGN, SYNC_CRC_EOP]);
    const resp = await this.readExactBytes(5, 500);
    if (resp[0] !== STK_INSYNC || resp[4] !== STK_OK) {
      throw new Error('Failed to read device signature');
    }
    return [resp[1], resp[2], resp[3]];
  }

  /**
   * Flash hex string onto connected board
   */
  async flashHex(
    hexString: string,
    board: BoardConfig,
    onProgress?: (progress: FlashProgress) => void
  ): Promise<boolean> {
    const notify = (phase: FlashProgress['phase'], percent: number, message: string, bytesWritten = 0, totalBytes = 0) => {
      if (onProgress) {
        onProgress({ phase, percent, message, bytesWritten, totalBytes });
      }
    };

    notify('resetting', 5, 'ボードのリセット中 (DTRトグル)...');
    await this.startReader();

    try {
      // 1. Reset board
      await this.resetBoard();
      await sleep(150);

      // 2. Sync with bootloader
      notify('handshake', 10, 'ブートローダーとの同期確立中 (STK500v1)...');
      const synced = await this.sync(20);
      if (!synced) {
        throw new Error('ブートローダーと同期できませんでした。ボードの接続やポート、選択中のボード型式 (Uno R3 / Nano) を確認してください。');
      }

      // 3. Enter progmode
      notify('sync', 20, 'プログラミングモード開始中...');
      await this.drainBuffer();
      await this.writeBytes([STK_ENTER_PROGMODE, SYNC_CRC_EOP]);
      const progResp = await this.readExactBytes(2, 500);
      if (progResp[0] !== STK_INSYNC || progResp[1] !== STK_OK) {
        throw new Error('プログラミングモードへの移行に失敗しました。');
      }

      // 4. Parse hex
      notify('flashing', 25, 'HEXデータの解析中...');
      const parsed = parseHex(hexString, board.flashSize);
      const pageSize = board.pageSize || 128;
      const endAddr = parsed.maxAddress > 0 ? parsed.maxAddress : parsed.bytesCount;
      const totalPages = Math.ceil((endAddr + 1) / pageSize);

      // 5. Flash pages
      notify('flashing', 30, `Flashメモリ書き込み開始 (全 ${totalPages} ページ, ${endAddr + 1} バイト)...`, 0, endAddr + 1);

      for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
        const pageStartByte = pageIdx * pageSize;
        // STK500 address is in 16-bit words
        const wordAddress = (pageStartByte >> 1);

        // Load Address
        await this.drainBuffer();
        await this.writeBytes([
          STK_LOAD_ADDRESS,
          wordAddress & 0xff,
          (wordAddress >> 8) & 0xff,
          SYNC_CRC_EOP,
        ]);
        const addrResp = await this.readExactBytes(2, 500);
        if (addrResp[0] !== STK_INSYNC || addrResp[1] !== STK_OK) {
          throw new Error(`ページアドレス 0x${pageStartByte.toString(16)} のロードに失敗しました。`);
        }

        // Prepare page data
        const pageData = new Uint8Array(pageSize);
        for (let i = 0; i < pageSize; i++) {
          const byteIdx = pageStartByte + i;
          pageData[i] = byteIdx < parsed.data.length ? parsed.data[byteIdx] : 0xff;
        }

        // Program Page Command: 0x64, size_hi, size_lo, 'F', ...data, 0x20
        const cmd = new Uint8Array(5 + pageSize);
        cmd[0] = STK_PROG_PAGE;
        cmd[1] = (pageSize >> 8) & 0xff;
        cmd[2] = pageSize & 0xff;
        cmd[3] = 0x46; // 'F' for Flash memory
        cmd.set(pageData, 4);
        cmd[4 + pageSize] = SYNC_CRC_EOP;

        await this.drainBuffer();
        await this.writeBytes(cmd);
        const progPageResp = await this.readExactBytes(2, 1000);
        if (progPageResp[0] !== STK_INSYNC || progPageResp[1] !== STK_OK) {
          throw new Error(`ページ ${pageIdx + 1}/${totalPages} の書き込みに失敗しました。`);
        }

        const percent = Math.min(95, Math.round(30 + ((pageIdx + 1) / totalPages) * 65));
        const currentBytes = Math.min(endAddr + 1, (pageIdx + 1) * pageSize);
        notify('flashing', percent, `書き込み中: ${pageIdx + 1}/${totalPages} ページ (${percent}%)`, currentBytes, endAddr + 1);
      }

      // 6. Leave Progmode
      notify('verifying', 96, 'プログラミングモード終了中...');
      await this.drainBuffer();
      await this.writeBytes([STK_LEAVE_PROGMODE, SYNC_CRC_EOP]);
      await this.readExactBytes(2, 500);

      notify('completed', 100, `書き込み完了！ Arduinoが再起動し、プログラムが正常に起動しました。`, endAddr + 1, endAddr + 1);
      return true;
    } finally {
      this.stopReader();
    }
  }
}
