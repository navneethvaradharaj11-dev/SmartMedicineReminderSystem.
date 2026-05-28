#include <Wire.h>
#include <SoftwareSerial.h>
#include "RTClib.h"

#define PIN_BUZZER        8
#define PIN_LED           7
#define PIN_BTN_CONFIRM   2
#define PIN_BTN_SNOOZE    3
#define PIN_LIMIT_SWITCH  4
#define PIN_BT_TX         9
#define PIN_BT_RX         10

#define MAX_DOSES 4
#define MISSED_TIMEOUT_SEC 60
#define SNOOZE_MINUTES 5
#define NIGHT_START_HOUR 21
#define NIGHT_END_HOUR   6
#define BT_BAUD 9600
#define BUTTON_PRESSED LOW
#define BUZZER_TONE_HZ 2000

struct DoseTime {
  uint8_t hour;
  uint8_t minute;
};

DoseTime schedule[MAX_DOSES] = {
  { 8,  0},
  {13,  0},
  {18,  0},
  {21, 30}
};

RTC_DS3231 rtc;
SoftwareSerial bluetooth(PIN_BT_RX, PIN_BT_TX);

bool alertActive = false;
bool doseConfirmed = false;
bool snoozed = false;
int currentDoseIndex = -1;
long alertStartMillis = 0;
long snoozeStartMillis = 0;
bool doseTakenToday[MAX_DOSES];
int lastCheckedMinute = -1;

unsigned long lastDebounceConfirm = 0;
unsigned long lastDebounceSnooze = 0;
unsigned long lastDebounceBox = 0;
#define DEBOUNCE_MS 50

void setup() {
  Serial.begin(BT_BAUD);
  Serial.setTimeout(20);
  bluetooth.begin(BT_BAUD);
  bluetooth.setTimeout(20);

  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_LED, OUTPUT);
  pinMode(PIN_BTN_CONFIRM, INPUT_PULLUP);
  pinMode(PIN_BTN_SNOOZE, INPUT_PULLUP);
  pinMode(PIN_LIMIT_SWITCH, INPUT_PULLUP);

  allOutputsOff();
  runStartupOutputTest();

  if (!rtc.begin()) {
    Serial.println("ERROR: DS3231 RTC not found. Check wiring.");
    while (true) {
      digitalWrite(PIN_LED, HIGH);
      delay(200);
      digitalWrite(PIN_LED, LOW);
      delay(200);
    }
  }

  if (rtc.lostPower()) {
    Serial.println("RTC lost power - setting time to compile time.");
    rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));
  }

  resetDailyTracking();

  for (int i = 0; i < 3; i++) {
    digitalWrite(PIN_LED, HIGH);
    delay(200);
    digitalWrite(PIN_LED, LOW);
    delay(200);
  }

  Serial.println("=== Smart Medicine Reminder System Started ===");
  printSchedule();
}

void loop() {
  DateTime now = rtc.now();

  handleBluetoothCommands(now);
  checkSchedule(now);

  if (alertActive) {
    handleActiveAlert(now);
  }

  checkInputs();
  updateNightLED(now);

  if (now.hour() == 0 && now.minute() == 0 && now.second() == 0) {
    resetDailyTracking();
    Serial.println("--- New day: dose tracking reset ---");
  }

  delay(100);
}

void handleBluetoothCommands(DateTime now) {
  if (!bluetooth.available()) return;

  String command = bluetooth.readStringUntil('\n');
  command.trim();
  if (command.length() == 0) return;

  sendBt("BT|COMMAND|" + command);

  if (command == "PING") {
    sendBt("PONG");
    return;
  }

  if (command == "ALARM:START") {
    if (!alertActive) {
      int doseIndex = findNearestDoseIndex(now);
      triggerAlert(doseIndex, now);
    }
    return;
  }

  if (command == "ALARM:STOP") {
    stopAlertOutputs();
    alertActive = false;
    snoozed = false;
    return;
  }
}

int findNearestDoseIndex(DateTime now) {
  int currentMinutes = now.hour() * 60 + now.minute();
  int bestIndex = 0;
  int bestDiff = 24 * 60;

  for (int i = 0; i < MAX_DOSES; i++) {
    int doseMinutes = schedule[i].hour * 60 + schedule[i].minute;
    int diff = abs(currentMinutes - doseMinutes);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIndex = i;
    }
  }

  return bestIndex;
}

void checkSchedule(DateTime now) {
  if (now.minute() == lastCheckedMinute) return;

  for (int i = 0; i < MAX_DOSES; i++) {
    if (now.hour() == schedule[i].hour &&
        now.minute() == schedule[i].minute &&
        !doseTakenToday[i] &&
        !alertActive) {

      lastCheckedMinute = now.minute();
      triggerAlert(i, now);
      return;
    }
  }
}

void triggerAlert(int doseIndex, DateTime now) {
  alertActive = true;
  doseConfirmed = false;
  snoozed = false;
  currentDoseIndex = doseIndex;
  alertStartMillis = millis();

  Serial.print("ALERT: Time to take dose ");
  Serial.print(doseIndex + 1);
  Serial.print(" at ");
  printTime(now);
  Serial.println();

  sendBt(
    String("BT|ALERT|Dose ") +
      String(doseIndex + 1) +
      "|" +
      String(schedule[doseIndex].hour) +
      ":" +
      (schedule[doseIndex].minute < 10 ? "0" : "") +
      String(schedule[doseIndex].minute)
  );

  digitalWrite(PIN_LED, HIGH);

  if (!isNightTime(now)) {
    beep(3);
  } else {
    Serial.println("Night mode: buzzer suppressed, LED alert on.");
  }
}

void handleActiveAlert(DateTime now) {
  long elapsed = millis() - alertStartMillis;

  if (!snoozed && !isNightTime(now)) {
    static long lastBeepMillis = 0;
    if (millis() - lastBeepMillis > 10000) {
      beep(1);
      lastBeepMillis = millis();
    }
  }

  if (snoozed) {
    long snoozeElapsed = millis() - snoozeStartMillis;
    if (snoozeElapsed >= (long)SNOOZE_MINUTES * 60 * 1000) {
      snoozed = false;
      alertStartMillis = millis();
      digitalWrite(PIN_LED, HIGH);
      Serial.println("Snooze expired - re-alerting.");
      if (!isNightTime(now)) beep(2);
    }
    return;
  }

  if (elapsed >= (long)MISSED_TIMEOUT_SEC * 1000) {
    markMissed(now);
  }
}

void checkInputs() {
  if (digitalRead(PIN_BTN_CONFIRM) == BUTTON_PRESSED) {
    if (millis() - lastDebounceConfirm > DEBOUNCE_MS) {
      lastDebounceConfirm = millis();
      sendBt("BT|BUTTON|Confirm|Pressed");
      if (alertActive) {
        confirmDose("Button press");
      } else {
        sendBt("BT|BUTTON|Confirm|Ignored because no alert is active");
      }
    }
  }

  if (digitalRead(PIN_LIMIT_SWITCH) == BUTTON_PRESSED) {
    if (millis() - lastDebounceBox > DEBOUNCE_MS) {
      lastDebounceBox = millis();
      sendBt("BT|BUTTON|Box opened|Pressed");
      if (alertActive) {
        confirmDose("Box opened");
      } else {
        sendBt("BT|BUTTON|Box opened|Ignored because no alert is active");
      }
    }
  }

  if (digitalRead(PIN_BTN_SNOOZE) == BUTTON_PRESSED) {
    if (millis() - lastDebounceSnooze > DEBOUNCE_MS) {
      lastDebounceSnooze = millis();
      sendBt("BT|BUTTON|Snooze|Pressed");
      if (alertActive && !snoozed) {
        snoozeDose();
      } else {
        sendBt("BT|BUTTON|Snooze|Ignored because no alert is active");
      }
    }
  }
}

void confirmDose(const char* method) {
  DateTime now = rtc.now();

  alertActive = false;
  doseConfirmed = true;
  snoozed = false;

  if (currentDoseIndex >= 0) {
    doseTakenToday[currentDoseIndex] = true;
  }

  noTone(PIN_BUZZER);
  digitalWrite(PIN_BUZZER, LOW);
  digitalWrite(PIN_LED, LOW);

  for (int i = 0; i < 3; i++) {
    digitalWrite(PIN_LED, HIGH);
    delay(300);
    digitalWrite(PIN_LED, LOW);
    delay(300);
  }

  digitalWrite(PIN_LED, HIGH);
  delay(5000);
  digitalWrite(PIN_LED, LOW);

  Serial.print("CONFIRMED: Dose ");
  Serial.print(currentDoseIndex + 1);
  Serial.print(" taken via ");
  Serial.print(method);
  Serial.print(" at ");
  printTime(now);
  Serial.println();

  sendBt(
    String("BT|CONFIRMED|Dose ") +
      String(currentDoseIndex + 1) +
      "|" +
      String(method) +
      "|" +
      formatTime(now)
  );
}

void stopAlertOutputs() {
  noTone(PIN_BUZZER);
  digitalWrite(PIN_BUZZER, LOW);
  digitalWrite(PIN_LED, LOW);
}

void snoozeDose() {
  snoozed = true;
  snoozeStartMillis = millis();

  digitalWrite(PIN_BUZZER, LOW);
  digitalWrite(PIN_LED, LOW);

  Serial.print("SNOOZED: Dose ");
  Serial.print(currentDoseIndex + 1);
  Serial.print(" - will re-alert in ");
  Serial.print(SNOOZE_MINUTES);
  Serial.println(" minutes.");

  sendBt(
    String("BT|SNOOZED|Dose ") +
      String(currentDoseIndex + 1) +
      "|" +
      String(SNOOZE_MINUTES) +
      " minutes"
  );

  playBuzzer(500);
}

void markMissed(DateTime now) {
  alertActive = false;
  snoozed = false;

  digitalWrite(PIN_LED, LOW);

  Serial.print("MISSED: Dose ");
  Serial.print(currentDoseIndex + 1);
  Serial.print(" was NOT taken by ");
  printTime(now);
  Serial.println();

  sendBt(
    String("BT|MISSED|Dose ") +
      String(currentDoseIndex + 1) +
      "|Caregiver alert|" +
      formatTime(now)
  );

  for (int i = 0; i < 10; i++) {
    digitalWrite(PIN_LED, HIGH);
    tone(PIN_BUZZER, BUZZER_TONE_HZ);
    delay(300);

    digitalWrite(PIN_LED, LOW);
    noTone(PIN_BUZZER);
    digitalWrite(PIN_BUZZER, LOW);
    delay(300);
  }
}

bool isNightTime(DateTime now) {
  uint8_t h = now.hour();
  return (h >= NIGHT_START_HOUR || h < NIGHT_END_HOUR);
}

void updateNightLED(DateTime now) {
  if (!alertActive) {
    digitalWrite(PIN_LED, LOW);
  }
}

void beep(int times) {
  for (int i = 0; i < times; i++) {
    playBuzzer(300);
    delay(200);
  }
}

void playBuzzer(unsigned long durationMs) {
  tone(PIN_BUZZER, BUZZER_TONE_HZ);
  delay(durationMs);
  noTone(PIN_BUZZER);
  digitalWrite(PIN_BUZZER, LOW);
}

void runStartupOutputTest() {
  sendBt("BT|DIAG|OUTPUT_TEST|START");

  digitalWrite(PIN_LED, HIGH);
  delay(500);
  digitalWrite(PIN_LED, LOW);

  playBuzzer(350);

  sendBt("BT|DIAG|OUTPUT_TEST|DONE");
}

void allOutputsOff() {
  digitalWrite(PIN_BUZZER, LOW);
  digitalWrite(PIN_LED, LOW);
}

void resetDailyTracking() {
  for (int i = 0; i < MAX_DOSES; i++) {
    doseTakenToday[i] = false;
  }
  lastCheckedMinute = -1;
}

void printTime(DateTime now) {
  Serial.print(now.hour());
  Serial.print(":");
  if (now.minute() < 10) Serial.print("0");
  Serial.print(now.minute());
  Serial.print(":");
  if (now.second() < 10) Serial.print("0");
  Serial.print(now.second());
}

String formatTime(DateTime now) {
  String value = String(now.hour()) + ":";
  if (now.minute() < 10) value += "0";
  value += String(now.minute()) + ":";
  if (now.second() < 10) value += "0";
  value += String(now.second());
  return value;
}

void printSchedule() {
  Serial.println("--- Medicine Schedule ---");
  for (int i = 0; i < MAX_DOSES; i++) {
    Serial.print("Dose ");
    Serial.print(i + 1);
    Serial.print(": ");
    Serial.print(schedule[i].hour);
    Serial.print(":");
    if (schedule[i].minute < 10) Serial.print("0");
    Serial.println(schedule[i].minute);
  }
  Serial.println("-------------------------");
}

void sendBt(const String& message) {
  bluetooth.println(message);
  Serial.println(message);
}
