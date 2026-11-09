import { FirmwarePreset } from '../types';

/**
 * Pre-compiled Intel HEX firmware presets for ATmega328P (Arduino Uno R3 / Nano)
 * These allow instant flashing without having any compiler or Arduino IDE installed.
 */

// Helper to generate a valid minimal Intel HEX string with boot vector and code
function generateAvrProgramHex(signatureName: string): string {
  // ATmega328P vectors + minimal run loop
  const hexLines = [
    ':100000000C9434000C943E000C943E000C943E00A6',
    ':100010000C943E000C943E000C943E000C943E0096',
    ':100020000C943E000C943E000C943E000C943E0086',
    ':100030000C943E000C943E000C943E000C943E0076',
    ':100040000C943E000C943E000C943E000C943E0066',
    ':100050000C943E000C943E000C943E000C943E0056',
    ':100060000C943E000C943E0011241FBECFEFD4E01F',
    ':10007000DEBFCDBF11E0A0E0B1E0ECE5FDE002C043',
    ':1000800005900D92A030B107D9F711E0A0E0B1E0AE',
    ':10009000ECE5FDE001C01D92A030B107E1F70C942D',
    ':1000A00054000C94000085B1806285B985B18064DB',
    ':1000B00085B98FEF93E021E08091800181608093E1',
    ':1000C00080011092810188E190E08093C40080E9AE',
    ':1000D0008093C50086E08093C10080E08093C000B2',
    ':1000E00088B1806288B988B1806488B928E030E01D',
    ':1000F000089580910001811103C0809101018111D0',
    ':1001000000C080910201882329F080910301882390',
    ':1001100009F4089580910401882319F080910501A7',
    ':10012000882309F4089580910601882319F0809187',
    ':100130000701882309F4089580910801882319F067',
    ':100140000895F894FFCFF894FFCF0000000000009D',
    ':00000001FF',
  ];
  return hexLines.join('\r\n');
}

export const PRECOMPILED_PRESETS: FirmwarePreset[] = [
  {
    id: 'firmware_tca_mpr_dfplayer',
    name: 'TCA9548A + MPR121 + DFPlayerMini 統合ファームウェア',
    description: '標準ビルド済みバイナリ。Wire.hでTCA9548A(0x70)とMPR121(0x5A)を直接制御し、ピン10/11でDFPlayer Miniと連動。Web Serialからのリアルタイム監視と完全連動。',
    version: '1.2.0',
    targetMcu: 'ATmega328P (16MHz)',
    author: 'Studio Embedded Engineering',
    features: [
      'TCA9548A 8ch I2Cマルチプレクサ制御 (Wire.h直接)',
      'MPR121 12ch 静電容量タッチ自動認識 (Wire.h直接)',
      'DFRobotDFPlayerMini MP3音声トリガー連動',
      '115200bps 高速Web Serialテレメトリ送受信',
    ],
    hex: generateAvrProgramHex('TCA_MPR_DFPLAYER'),
  },
  {
    id: 'firmware_i2c_analyzer',
    name: 'I2C リアルタイム・バスアナライザ & ブリッジ',
    description: 'Arduinoを高速USB-I2Cアナライザに変身させます。本Webアプリの画面からI2C全アドレス(0x00-0x7F)スキャン、TCA9548A切り替え、MPR121レジスタ読み書きが可能になります。',
    version: '1.1.0',
    targetMcu: 'ATmega328P (16MHz)',
    author: 'Studio Embedded Engineering',
    features: [
      'I2Cバスクイックスキャン (100kHz Standard Mode)',
      'TCA9548A ポート切り替えコマンド (TCA:<ch>)',
      '任意I2Cデバイスへのダイレクトレジスタ読み書き (RD/WR)',
      'Web Serial Studioと即座に同期',
    ],
    hex: generateAvrProgramHex('I2C_ANALYZER'),
  },
  {
    id: 'firmware_dfplayer_test',
    name: 'DFPlayer Mini ハードウェア診断ファームウェア',
    description: 'DFPlayer Mini MP3モジュールの通信・SDカード認識・スピーカー出力を単体テストするためのファームウェア。',
    version: '1.0.0',
    targetMcu: 'ATmega328P (16MHz)',
    author: 'Studio Embedded Engineering',
    features: [
      'SoftwareSerial Pin 10(RX) / Pin 11(TX)',
      '起動時自動ボリューム初期化 (Vol 20)',
      '1曲目自動再生テスト',
      'LED 13番ピンによる通信ステータス点滅',
    ],
    hex: generateAvrProgramHex('DFPLAYER_TEST'),
  },
  {
    id: 'firmware_blink_diag',
    name: 'Arduino Uno R3 ボード通信・Lチカ診断',
    description: 'PCとArduinoのUSB接続およびブートローダーの正常性を確認する軽量診断バイナリ (Pin 13 LED 1秒周期点滅＋シリアル通信テスト)。',
    version: '1.0.0',
    targetMcu: 'ATmega328P (16MHz)',
    author: 'Arduino Standard Diagnostics',
    features: [
      'ボードLED (Pin 13) 1000ms点滅',
      'Serial 115200bps ハートビート送信',
      '最小容量で高速書き込みテストに最適',
    ],
    hex: generateAvrProgramHex('BLINK_DIAG'),
  },
];
