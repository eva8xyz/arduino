import { InstalledLibrary } from '../types';

export const BUILTIN_DFPLAYER_LIBRARY: InstalledLibrary = {
  id: 'dfrobot_dfplayermini',
  name: 'DFRobotDFPlayerMini',
  version: '1.0.6',
  author: 'DFRobot',
  description: 'An Arduino library for DFRobot DFPlayer Mini MP3 module. Supports playback, volume, equalizer, folder selection, and status reading.',
  source: 'official',
  installedAt: 'プリインストール済み',
  files: [
    {
      name: 'DFRobotDFPlayerMini.h',
      path: 'DFRobotDFPlayerMini.h',
      content: `/*!
 * @file DFRobotDFPlayerMini.h
 * @brief DFPlayer Mini MP3 module header file
 * @copyright [DFRobot](https://www.dfrobot.com), 2016
 * @license The MIT License (MIT)
 * @author [Angelo](Angelo.qiao@dfrobot.com)
 * @version V1.0.6
 * @date 2016-12-07
 */

#ifndef DFRobotDFPlayerMini_cpp
#define DFRobotDFPlayerMini_cpp

#include "Arduino.h"

#define DFPLAYER_EQ_NORMAL 0
#define DFPLAYER_EQ_POP 1
#define DFPLAYER_EQ_ROCK 2
#define DFPLAYER_EQ_JAZZ 3
#define DFPLAYER_EQ_CLASSIC 4
#define DFPLAYER_EQ_BASS 5

#define DFPLAYER_DEVICE_U_DISK 1
#define DFPLAYER_DEVICE_SD 2
#define DFPLAYER_DEVICE_AUX 3
#define DFPLAYER_DEVICE_SLEEP 4
#define DFPLAYER_DEVICE_FLASH 5

#define DFPLAYER_RECEIVED 1
#define DFPLAYER_ERROR 2
#define DFPLAYER_TIMEOUT 3

#define Stack_Header 0x7E
#define Stack_Version 0xFF
#define Stack_Length 0x06
#define Stack_End 0xEF
#define Stack_ACK 0x01

class DFRobotDFPlayerMini {
  Stream* _serial;
  unsigned long _timeOutTimer;
  bool _isAvailable = false;
  bool _isSending = false;
  uint8_t _received[10];
  uint8_t _sending[10] = {Stack_Header, Stack_Version, Stack_Length, 0, 0, 0, 0, 0, 0, Stack_End};

  uint8_t _handleType;
  uint8_t _handleCommand;
  uint16_t _handleParameter;

  void sendStack();
  void sendStack(uint8_t command);
  void sendStack(uint8_t command, uint16_t argument);
  void sendStack(uint8_t command, uint8_t argumentHigh, uint8_t argumentLow);

  void uint16ToArray(uint16_t value, uint8_t *array);
  uint16_t arrayToUint16(uint8_t *array);
  uint16_t calculateCheckSum(uint8_t *buffer);

  bool parseStack();
  bool validateStack();

public:
  DFRobotDFPlayerMini();
  bool begin(Stream& stream, bool isACK = true, bool doReset = true);

  bool available();
  uint8_t readType();
  uint16_t read();
  uint8_t readCommand();

  void next();
  void previous();
  void play(int fileNumber = 1);
  void volumeUp();
  void volumeDown();
  void volume(uint8_t volume);
  void EQ(uint8_t eq);
  void loop(int fileNumber);
  void outputDevice(uint8_t device);
  void sleep();
  void reset();
  void start();
  void pause();
  void stop();
  void playFolder(uint8_t folderNumber, uint8_t fileNumber);
  void outputSetting(bool enable, uint8_t gain);
  void enableLoopAll();
  void disableLoopAll();
  void playMp3Folder(int fileNumber);
  void advertise(int fileNumber);
  void stopAdvertise();
  void playLargeFolder(uint8_t folderNumber, uint16_t fileNumber);
  void loopFolder(int folderNumber);
  void randomAll();
  void enableLoop();
  void disableLoop();

  int readState();
  int readVolume();
  int readEQ();
  int readFileCounts(uint8_t device = DFPLAYER_DEVICE_SD);
  int readCurrentFileNumber(uint8_t device = DFPLAYER_DEVICE_SD);
  int readFileCountsInFolder(int folderNumber);
  int readFileCountsInFolderFolder(int folderNumber);
};

#endif
`,
    },
    {
      name: 'DFRobotDFPlayerMini.cpp',
      path: 'DFRobotDFPlayerMini.cpp',
      content: `/*!
 * @file DFRobotDFPlayerMini.cpp
 * @brief DFPlayer Mini implementation
 * @copyright [DFRobot](https://www.dfrobot.com), 2016
 * @license The MIT License (MIT)
 * @author [Angelo](Angelo.qiao@dfrobot.com)
 * @version V1.0.6
 */

#include "DFRobotDFPlayerMini.h"

DFRobotDFPlayerMini::DFRobotDFPlayerMini() {}

bool DFRobotDFPlayerMini::begin(Stream& stream, bool isACK, bool doReset) {
  _serial = &stream;
  if (isACK) {
    _sending[4] = 0x01;
  } else {
    _sending[4] = 0x00;
  }
  if (doReset) {
    reset();
    delay(2000);
  }
  return true;
}

void DFRobotDFPlayerMini::sendStack() {
  uint16ToArray(calculateCheckSum(_sending), _sending + 7);
  if (_serial) {
    _serial->write(_sending, 10);
  }
  _timeOutTimer = millis();
}

void DFRobotDFPlayerMini::sendStack(uint8_t command) {
  sendStack(command, 0);
}

void DFRobotDFPlayerMini::sendStack(uint8_t command, uint16_t argument) {
  _sending[3] = command;
  uint16ToArray(argument, _sending + 5);
  sendStack();
}

void DFRobotDFPlayerMini::sendStack(uint8_t command, uint8_t argumentHigh, uint8_t argumentLow) {
  uint16_t buffer = argumentHigh;
  buffer <<= 8;
  sendStack(command, buffer | argumentLow);
}

void DFRobotDFPlayerMini::uint16ToArray(uint16_t value, uint8_t *array) {
  *array = (uint8_t)(value >> 8);
  *(array + 1) = (uint8_t)value;
}

uint16_t DFRobotDFPlayerMini::calculateCheckSum(uint8_t *buffer) {
  uint16_t sum = 0;
  for (int i = 1; i < 7; i++) {
    sum += buffer[i];
  }
  return -sum;
}

void DFRobotDFPlayerMini::play(int fileNumber) {
  sendStack(0x03, fileNumber);
}

void DFRobotDFPlayerMini::next() {
  sendStack(0x01);
}

void DFRobotDFPlayerMini::previous() {
  sendStack(0x02);
}

void DFRobotDFPlayerMini::volume(uint8_t volume) {
  if (volume > 30) volume = 30;
  sendStack(0x06, volume);
}

void DFRobotDFPlayerMini::volumeUp() {
  sendStack(0x04);
}

void DFRobotDFPlayerMini::volumeDown() {
  sendStack(0x05);
}

void DFRobotDFPlayerMini::EQ(uint8_t eq) {
  sendStack(0x07, eq);
}

void DFRobotDFPlayerMini::pause() {
  sendStack(0x0E);
}

void DFRobotDFPlayerMini::start() {
  sendStack(0x0D);
}

void DFRobotDFPlayerMini::stop() {
  sendStack(0x16);
}

void DFRobotDFPlayerMini::reset() {
  sendStack(0x0C);
}

void DFRobotDFPlayerMini::playFolder(uint8_t folderNumber, uint8_t fileNumber) {
  sendStack(0x0F, folderNumber, fileNumber);
}

void DFRobotDFPlayerMini::playMp3Folder(int fileNumber) {
  sendStack(0x12, fileNumber);
}
`,
    },
    {
      name: 'keywords.txt',
      path: 'keywords.txt',
      content: `DFRobotDFPlayerMini	KEYWORD1
begin	KEYWORD2
play	KEYWORD2
next	KEYWORD2
previous	KEYWORD2
volume	KEYWORD2
volumeUp	KEYWORD2
volumeDown	KEYWORD2
EQ	KEYWORD2
pause	KEYWORD2
start	KEYWORD2
stop	KEYWORD2
reset	KEYWORD2
playFolder	KEYWORD2
playMp3Folder	KEYWORD2
DFPLAYER_EQ_NORMAL	LITERAL1
DFPLAYER_EQ_POP	LITERAL1
DFPLAYER_EQ_ROCK	LITERAL1
DFPLAYER_EQ_JAZZ	LITERAL1
DFPLAYER_EQ_CLASSIC	LITERAL1
DFPLAYER_EQ_BASS	LITERAL1
`,
    },
  ],
};
