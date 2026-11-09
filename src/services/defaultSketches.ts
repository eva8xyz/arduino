import { SketchProject } from '../types';

export const DEFAULT_SKETCHES: SketchProject[] = [
  {
    id: 'tca_mpr_dfplayer_allinone',
    name: 'TCA9548A + MPR121 + DFPlayerMini 統合コントローラー',
    description: 'Wire.hによるTCA9548A・MPR121のI2C直接制御と、DFRobotDFPlayerMiniによる高音質MP3タッチ再生。Web連携シリアルプロトコル対応。',
    files: [
      {
        name: 'TCA9548A_MPR121_DFPlayer_Main.ino',
        isMain: true,
        content: `/**
 * ====================================================================
 * TCA9548A + MPR121 + DFRobotDFPlayerMini 統合コントローラー
 * ====================================================================
 * 
 * ■ 構成概要:
 *  - TCA9548A (I2C Mux: 0x70) : Wire.hを用いてチャンネル切り替え
 *  - MPR121   (静電容量タッチ: 0x5A): Wire.hを用いてレジスタを直接初期化・読出
 *  - DFPlayer Mini (MP3再生): SoftwareSerial (Pin 10=RX, Pin 11=TX) + DFRobotDFPlayerMini
 *  - Web Serial双方向通信: 本Webスタジオからのリアルタイムプレビュー＆制御に対応
 */

#include <Wire.h>
#include <SoftwareSerial.h>
#include "DFRobotDFPlayerMini.h"

// --- ハードウェア設定 ---
#define TCA9548A_ADDR   0x70  // TCA9548A デフォルトI2Cアドレス
#define MPR121_ADDR     0x5A  // MPR121 デフォルトI2Cアドレス (ADDRピン=GND時)
#define DFPLAYER_RX     10    // Arduino Pin 10 (DFPlayerのTXへ接続)
#define DFPLAYER_TX     11    // Arduino Pin 11 (1kΩ抵抗を挟んでDFPlayerのRXへ接続)
#define STATUS_LED      13    // Arduino本体LED (タッチ時に点灯)

// MPR121 レジスタ定義 (Wire.h直接制御用)
#define MPR121_TOUCHSTATUS_L 0x00
#define MPR121_TOUCHSTATUS_H 0x01
#define MPR121_FILTDATA_0L   0x04
#define MPR121_BASELINE_0    0x1E
#define MPR121_MHDR          0x2B
#define MPR121_NHDR          0x2C
#define MPR121_NCLR          0x2D
#define MPR121_FDLR          0x2E
#define MPR121_MHDF          0x2F
#define MPR121_NHDF          0x30
#define MPR121_NCLF          0x31
#define MPR121_FDLF          0x32
#define MPR121_NHDT          0x33
#define MPR121_NCLT          0x34
#define MPR121_FDLT          0x35
#define MPR121_ELE0_T        0x41
#define MPR121_ELE0_R        0x42
#define MPR121_ECR           0x5E
#define MPR121_SOFTRESET     0x80

// 通信インスタンス
SoftwareSerial mySoftwareSerial(DFPLAYER_RX, DFPLAYER_TX); // RX, TX
DFRobotDFPlayerMini myDFPlayer;

// 状態管理
uint8_t currentTcaChannel = 0;
uint16_t lastTouched = 0;
uint8_t currentVolume = 20;
bool isDFPlayerReady = false;

// ==========================================
// TCA9548A I2Cマルチプレクサ制御 (Wire.h直接)
// ==========================================
void tcaSelect(uint8_t channel) {
  if (channel > 7) return;
  Wire.beginTransmission(TCA9548A_ADDR);
  Wire.write(1 << channel); // 該当ビットを1にしてチャンネル有効化
  Wire.endTransmission();
  currentTcaChannel = channel;
}

void tcaDisableAll() {
  Wire.beginTransmission(TCA9548A_ADDR);
  Wire.write(0x00);
  Wire.endTransmission();
}

// ==========================================
// MPR121 静電容量センサ レジスタ直接制御 (Wire.h)
// ==========================================
void writeRegister(uint8_t i2cAddr, uint8_t reg, uint8_t val) {
  Wire.beginTransmission(i2cAddr);
  Wire.write(reg);
  Wire.write(val);
  Wire.endTransmission();
}

uint8_t readRegister8(uint8_t i2cAddr, uint8_t reg) {
  Wire.beginTransmission(i2cAddr);
  Wire.write(reg);
  Wire.endTransmission(false);
  Wire.requestFrom((int)i2cAddr, 1);
  if (Wire.available()) {
    return Wire.read();
  }
  return 0;
}

uint16_t readRegister16(uint8_t i2cAddr, uint8_t reg) {
  Wire.beginTransmission(i2cAddr);
  Wire.write(reg);
  Wire.endTransmission(false);
  Wire.requestFrom((int)i2cAddr, 2);
  if (Wire.available() >= 2) {
    uint8_t l = Wire.read();
    uint8_t h = Wire.read();
    return (h << 8) | l;
  }
  return 0;
}

bool initMPR121() {
  // 1. ソフトウェアリセット
  writeRegister(MPR121_ADDR, MPR121_SOFTRESET, 0x63);
  delay(10);

  // 2. 設定変更のためStopモードへ (ECR=0)
  writeRegister(MPR121_ADDR, MPR121_ECR, 0x00);

  // 3. AFE & フィルタ設定
  writeRegister(MPR121_ADDR, MPR121_MHDR, 0x01);
  writeRegister(MPR121_ADDR, MPR121_NHDR, 0x01);
  writeRegister(MPR121_ADDR, MPR121_NCLR, 0x0E);
  writeRegister(MPR121_ADDR, MPR121_FDLR, 0x00);

  writeRegister(MPR121_ADDR, MPR121_MHDF, 0x01);
  writeRegister(MPR121_ADDR, MPR121_NHDF, 0x05);
  writeRegister(MPR121_ADDR, MPR121_NCLF, 0x01);
  writeRegister(MPR121_ADDR, MPR121_FDLF, 0x00);

  writeRegister(MPR121_ADDR, MPR121_NHDT, 0x00);
  writeRegister(MPR121_ADDR, MPR121_NCLT, 0x00);
  writeRegister(MPR121_ADDR, MPR121_FDLT, 0x00);

  // 4. 各電極(0〜11)のタッチ/リリース閾値を設定
  for (uint8_t i = 0; i < 12; i++) {
    writeRegister(MPR121_ADDR, MPR121_ELE0_T + 2 * i, 12); // タッチ閾値
    writeRegister(MPR121_ADDR, MPR121_ELE0_R + 2 * i, 6);  // リリース閾値
  }

  // 5. 12電極すべてを有効化してRunモードへ移行 (基準値自動トラッキング有効)
  writeRegister(MPR121_ADDR, MPR121_ECR, 0x8C); // 1000 1100 = Baseline tracking 5 + 12 electrodes
  return true;
}

uint16_t readMPR121TouchStatus() {
  return readRegister16(MPR121_ADDR, MPR121_TOUCHSTATUS_L);
}

// ==========================================
// I2C バススキャン関数
// ==========================================
void scanI2CBus() {
  Serial.println(F("[I2C_SCAN_START]"));
  byte error, address;
  int nDevices = 0;
  for (address = 1; address < 127; address++) {
    Wire.beginTransmission(address);
    error = Wire.endTransmission();
    if (error == 0) {
      Serial.print(F("DEV:0x"));
      if (address < 16) Serial.print("0");
      Serial.println(address, HEX);
      nDevices++;
    }
  }
  Serial.print(F("[I2C_SCAN_END] Total: "));
  Serial.println(nDevices);
}

// ==========================================
// setup & loop
// ==========================================
void setup() {
  Serial.begin(115200);
  pinMode(STATUS_LED, OUTPUT);
  digitalWrite(STATUS_LED, LOW);

  // I2C初期化
  Wire.begin();
  Wire.setClock(100000); // 100kHz Standard Mode

  Serial.println(F("========================================"));
  Serial.println(F(" Web Arduino Flasher - TCA+MPR+DFPlayer "));
  Serial.println(F("========================================"));

  // TCA9548A チャンネル0選択
  tcaSelect(0);
  delay(10);

  // MPR121初期化
  Serial.print(F("Init MPR121 on TCA Ch 0... "));
  if (initMPR121()) {
    Serial.println(F("OK!"));
  } else {
    Serial.println(F("FAILED (Check wiring)"));
  }

  // DFPlayer Mini初期化
  mySoftwareSerial.begin(9600);
  Serial.print(F("Init DFPlayer Mini... "));
  if (myDFPlayer.begin(mySoftwareSerial)) {
    isDFPlayerReady = true;
    Serial.println(F("OK!"));
    myDFPlayer.volume(currentVolume);
    myDFPlayer.EQ(DFPLAYER_EQ_NORMAL);
  } else {
    Serial.println(F("DFPlayer not responding (check power & SD card)"));
  }

  Serial.println(F("[READY] System initialized. Waiting for touch or serial commands."));
}

void loop() {
  // 1. Web Serial コマンド受信処理
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\\n');
    cmd.trim();
    handleWebSerialCommand(cmd);
  }

  // 2. TCA9548A 選択中のチャンネル上のMPR121タッチ状態を読出
  tcaSelect(currentTcaChannel);
  uint16_t curTouched = readMPR121TouchStatus();

  // 電極0〜11の状態変化をチェック
  for (uint8_t i = 0; i < 12; i++) {
    bool isNowTouched = (curTouched & (1 << i));
    bool wasTouched   = (lastTouched & (1 << i));

    if (isNowTouched && !wasTouched) {
      // タッチされた瞬間
      digitalWrite(STATUS_LED, HIGH);
      int trackNumber = i + 1; // 電極0 -> トラック1, 電極1 -> トラック2...
      
      // Webスタジオへイベント送信
      Serial.print(F("[TOUCH_EVENT] CH:"));
      Serial.print(currentTcaChannel);
      Serial.print(F(" ELE:"));
      Serial.print(i);
      Serial.print(F(" STATE:1 PLAY:"));
      Serial.println(trackNumber);

      // DFPlayerでMP3再生
      if (isDFPlayerReady) {
        myDFPlayer.play(trackNumber);
      }
    }

    if (!isNowTouched && wasTouched) {
      // 離された瞬間
      digitalWrite(STATUS_LED, LOW);
      Serial.print(F("[TOUCH_EVENT] CH:"));
      Serial.print(currentTcaChannel);
      Serial.print(F(" ELE:"));
      Serial.print(i);
      Serial.println(F(" STATE:0"));
    }
  }

  lastTouched = curTouched;
  delay(30); // サンプリング周期約30ms
}

// ==========================================
// Web Serial コマンドパーサー
// ==========================================
void handleWebSerialCommand(String cmd) {
  if (cmd.startsWith("TCA:")) {
    int ch = cmd.substring(4).toInt();
    tcaSelect(ch);
    initMPR121();
    Serial.print(F("[TCA_SWITCHED] Channel: "));
    Serial.println(ch);
  } else if (cmd.startsWith("PLAY:")) {
    int track = cmd.substring(5).toInt();
    if (isDFPlayerReady) {
      myDFPlayer.play(track);
    }
    Serial.print(F("[DFP_PLAY] Track: "));
    Serial.println(track);
  } else if (cmd.startsWith("VOL:")) {
    int vol = cmd.substring(4).toInt();
    currentVolume = constrain(vol, 0, 30);
    if (isDFPlayerReady) {
      myDFPlayer.volume(currentVolume);
    }
    Serial.print(F("[DFP_VOL] Volume: "));
    Serial.println(currentVolume);
  } else if (cmd == "PAUSE") {
    if (isDFPlayerReady) myDFPlayer.pause();
    Serial.println(F("[DFP_PAUSE]"));
  } else if (cmd == "RESUME") {
    if (isDFPlayerReady) myDFPlayer.start();
    Serial.println(F("[DFP_RESUME]"));
  } else if (cmd == "NEXT") {
    if (isDFPlayerReady) myDFPlayer.next();
    Serial.println(F("[DFP_NEXT]"));
  } else if (cmd == "PREV") {
    if (isDFPlayerReady) myDFPlayer.previous();
    Serial.println(F("[DFP_PREV]"));
  } else if (cmd == "STOP") {
    if (isDFPlayerReady) myDFPlayer.stop();
    Serial.println(F("[DFP_STOP]"));
  } else if (cmd == "SCAN") {
    scanI2CBus();
  } else if (cmd == "PING") {
    Serial.println(F("PONG"));
  } else if (cmd.startsWith("REG_RD:")) {
    // 例: REG_RD:0x5A:0x00
    int firstColon = cmd.indexOf(':', 7);
    uint8_t addr = (uint8_t)strtol(cmd.substring(7, firstColon).c_str(), NULL, 16);
    uint8_t reg = (uint8_t)strtol(cmd.substring(firstColon + 1).c_str(), NULL, 16);
    uint8_t val = readRegister8(addr, reg);
    Serial.print(F("[REG_VAL] 0x"));
    Serial.print(addr, HEX);
    Serial.print(F(" 0x"));
    Serial.print(reg, HEX);
    Serial.print(F(" = 0x"));
    Serial.println(val, HEX);
  }
}
`,
      },
    ],
  },
  {
    id: 'i2c_live_bridge',
    name: 'I2C リアルタイム・インスペクター & ブリッジ',
    description: 'ArduinoをUSB-I2Cアナライザ化。TCA9548AとMPR121の全レジスタ読み書きおよびI2CバススキャンをWeb画面から直感的に操作可能。',
    files: [
      {
        name: 'I2C_Interactive_Bridge.ino',
        isMain: true,
        content: `/**
 * ====================================================================
 * I2C リアルタイム・インスペクター & USBブリッジ (Wire.h直接)
 * ====================================================================
 * 本スケッチを書き込むと、Webスタジオの「I2Cプレビュー＆制御」タブから
 * TCA9548Aのチャンネル切り替えや、MPR121の全レジスタ値の読み書き、
 * 静電容量センサのリアルタイム値をブラウザ上で視覚化できます。
 */

#include <Wire.h>

#define TCA_ADDR 0x70

void setup() {
  Serial.begin(115200);
  Wire.begin();
  Wire.setClock(100000);
  Serial.println(F("[I2C_BRIDGE_READY] Baud: 115200bps"));
}

void loop() {
  if (Serial.available()) {
    String line = Serial.readStringUntil('\\n');
    line.trim();
    if (line.length() == 0) return;

    if (line.startsWith("SCAN")) {
      Serial.println(F("[SCAN_START]"));
      for (byte addr = 1; addr < 127; addr++) {
        Wire.beginTransmission(addr);
        if (Wire.endTransmission() == 0) {
          Serial.print(F("FOUND:0x"));
          if (addr < 16) Serial.print("0");
          Serial.println(addr, HEX);
        }
      }
      Serial.println(F("[SCAN_END]"));
    } else if (line.startsWith("TCA:")) {
      int ch = line.substring(4).toInt();
      Wire.beginTransmission(TCA_ADDR);
      Wire.write(1 << ch);
      Wire.endTransmission();
      Serial.print(F("[TCA_OK] Channel: "));
      Serial.println(ch);
    } else if (line.startsWith("WR:")) {
      // 形式: WR:<addr_hex>:<reg_hex>:<val_hex>
      // 例: WR:5A:5E:8C
      int p1 = line.indexOf(':');
      int p2 = line.indexOf(':', p1 + 1);
      int p3 = line.indexOf(':', p2 + 1);
      if (p2 > 0 && p3 > 0) {
        uint8_t addr = (uint8_t)strtol(line.substring(p1 + 1, p2).c_str(), NULL, 16);
        uint8_t reg = (uint8_t)strtol(line.substring(p2 + 1, p3).c_str(), NULL, 16);
        uint8_t val = (uint8_t)strtol(line.substring(p3 + 1).c_str(), NULL, 16);
        Wire.beginTransmission(addr);
        Wire.write(reg);
        Wire.write(val);
        Wire.endTransmission();
        Serial.println(F("[WR_OK]"));
      }
    } else if (line.startsWith("RD:")) {
      // 形式: RD:<addr_hex>:<reg_hex>
      int p1 = line.indexOf(':');
      int p2 = line.indexOf(':', p1 + 1);
      if (p2 > 0) {
        uint8_t addr = (uint8_t)strtol(line.substring(p1 + 1, p2).c_str(), NULL, 16);
        uint8_t reg = (uint8_t)strtol(line.substring(p2 + 1).c_str(), NULL, 16);
        Wire.beginTransmission(addr);
        Wire.write(reg);
        Wire.endTransmission(false);
        Wire.requestFrom((int)addr, 1);
        if (Wire.available()) {
          uint8_t v = Wire.read();
          Serial.print(F("[RD_VAL] 0x"));
          if (v < 16) Serial.print("0");
          Serial.println(v, HEX);
        } else {
          Serial.println(F("[RD_ERR] No response"));
        }
      }
    }
  }
}
`,
      },
    ],
  },
  {
    id: 'dfplayer_tester',
    name: 'DFPlayer Mini 単体テストスケッチ',
    description: 'DFRobotDFPlayerMiniライブラリの全機能検証。シリアルモニタから再生/停止/音量/EQをテストできます。',
    files: [
      {
        name: 'DFPlayer_Tester.ino',
        isMain: true,
        content: `/**
 * DFPlayer Mini 単体テスト
 * ライブラリ: DFRobotDFPlayerMini
 */

#include <SoftwareSerial.h>
#include "DFRobotDFPlayerMini.h"

SoftwareSerial dfpSerial(10, 11); // RX (Pin 10), TX (Pin 11 -> 1k resistor -> DFPlayer RX)
DFRobotDFPlayerMini myDFPlayer;

void setup() {
  Serial.begin(115200);
  dfpSerial.begin(9600);

  Serial.println(F("DFPlayer Mini Tester Starting..."));
  if (!myDFPlayer.begin(dfpSerial)) {
    Serial.println(F("Unable to begin DFPlayer:"));
    Serial.println(F("1. Please check the connection."));
    Serial.println(F("2. Please insert the SD card."));
    while(true) delay(100);
  }

  Serial.println(F("DFPlayer Mini online!"));
  myDFPlayer.volume(20);
  myDFPlayer.play(1); // 1番目の曲を再生
}

void loop() {
  if (Serial.available()) {
    char c = Serial.read();
    if (c == 'p') {
      myDFPlayer.start();
      Serial.println(F("Play"));
    } else if (c == 's') {
      myDFPlayer.pause();
      Serial.println(F("Pause"));
    } else if (c == '+') {
      myDFPlayer.volumeUp();
      Serial.println(F("Vol Up"));
    } else if (c == '-') {
      myDFPlayer.volumeDown();
      Serial.println(F("Vol Down"));
    }
  }
}
`,
      },
    ],
  },
];
