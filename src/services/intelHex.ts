/**
 * Intel HEX format parser and validator
 */

export interface ParsedHex {
  data: Uint8Array;
  startAddress: number;
  endAddress: number;
  bytesCount: number;
  maxAddress: number;
}

export function parseHex(hexString: string, memorySize = 32768): ParsedHex {
  const memory = new Uint8Array(memorySize);
  let baseAddress = 0;
  let minAddr = memorySize;
  let maxAddr = 0;
  let totalBytes = 0;

  const lines = hexString.split(/\r?\n/);

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const rawLine = lines[lineIndex].trim();
    if (!rawLine || rawLine.charAt(0) !== ':') {
      continue;
    }

    const byteCount = parseInt(rawLine.substring(1, 3), 16);
    const address = parseInt(rawLine.substring(3, 7), 16);
    const recordType = parseInt(rawLine.substring(7, 9), 16);
    const dataStr = rawLine.substring(9, 9 + byteCount * 2);
    const checksum = parseInt(rawLine.substring(9 + byteCount * 2, 11 + byteCount * 2), 16);

    // Verify checksum
    let sum = byteCount + (address >> 8) + (address & 0xff) + recordType;
    for (let i = 0; i < byteCount; i++) {
      sum += parseInt(dataStr.substring(i * 2, i * 2 + 2), 16);
    }
    const computedChecksum = (~sum + 1) & 0xff;
    if (computedChecksum !== checksum) {
      throw new Error(`Line ${lineIndex + 1}: Checksum error (expected 0x${checksum.toString(16)}, got 0x${computedChecksum.toString(16)})`);
    }

    if (recordType === 0x00) {
      // Data record
      const fullAddress = baseAddress + address;
      for (let i = 0; i < byteCount; i++) {
        const byte = parseInt(dataStr.substring(i * 2, i * 2 + 2), 16);
        const targetAddress = fullAddress + i;
        if (targetAddress < memorySize) {
          memory[targetAddress] = byte;
          if (targetAddress < minAddr) minAddr = targetAddress;
          if (targetAddress > maxAddr) maxAddr = targetAddress;
          totalBytes++;
        }
      }
    } else if (recordType === 0x01) {
      // End Of File
      break;
    } else if (recordType === 0x02) {
      // Extended Segment Address
      baseAddress = parseInt(dataStr, 16) << 4;
    } else if (recordType === 0x04) {
      // Extended Linear Address
      baseAddress = parseInt(dataStr, 16) << 16;
    }
  }

  return {
    data: memory,
    startAddress: minAddr < memorySize ? minAddr : 0,
    endAddress: maxAddr > 0 ? maxAddr : 0,
    bytesCount: totalBytes,
    maxAddress: maxAddr,
  };
}

/**
 * Creates an Intel HEX string from binary data
 */
export function createHex(data: Uint8Array, startAddress = 0, lineLength = 16): string {
  let output = '';
  let currentAddress = startAddress;

  for (let i = 0; i < data.length; i += lineLength) {
    const chunkLength = Math.min(lineLength, data.length - i);
    const addr = currentAddress + i;
    const byteCountHex = chunkLength.toString(16).padStart(2, '0').toUpperCase();
    const addrHex = addr.toString(16).padStart(4, '0').toUpperCase();
    const recordType = '00';

    let dataHex = '';
    let sum = chunkLength + (addr >> 8) + (addr & 0xff);

    for (let j = 0; j < chunkLength; j++) {
      const b = data[i + j];
      dataHex += b.toString(16).padStart(2, '0').toUpperCase();
      sum += b;
    }

    const checksum = ((~sum + 1) & 0xff).toString(16).padStart(2, '0').toUpperCase();
    output += `:${byteCountHex}${addrHex}${recordType}${dataHex}${checksum}\r\n`;
  }

  output += ':00000001FF\r\n';
  return output;
}
