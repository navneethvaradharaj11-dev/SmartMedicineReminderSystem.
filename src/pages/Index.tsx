import { lazy, Suspense, useCallback, useEffect, useRef, useState, startTransition, type TouchEvent } from "react";
import PhoneFrame from "@/components/PhoneFrame";
import BottomNav, { Screen } from "@/components/BottomNav";
import ReminderAlert, { MedicineTimeReminder } from "@/components/ReminderAlert";
import LoginScreen from "@/components/LoginScreen";
import { AppLanguage } from "@/lib/appLanguage";
import { initialSchedules, Schedule } from "@/data/medicine";
import { useSmartMedicineSchedules } from "@/hooks/use-smart-medicine-schedules";
import {
  getUpcomingSmartReminder,
  SmartMedicineDayStatus,
  SmartMedicineSchedule,
} from "@/lib/smartMedicineSchedule";
import {
  clearActiveUserProfile,
  saveActiveUserProfile,
  saveUserProfile,
  UserProfile,
} from "@/lib/userProfile";
import {
  addAppNotification,
  AppNotification,
  demoNotifications,
  loadAppNotifications,
  saveAppNotifications,
} from "@/lib/appNotifications";
import { toast } from "sonner";

const HomeScreen = lazy(() => import("@/components/screens/HomeScreen"));
const NotificationsScreen = lazy(() => import("@/components/screens/NotificationsScreen"));
const SettingsScreen = lazy(() => import("@/components/screens/SettingsScreen"));
const BluetoothScreen = lazy(() => import("@/components/screens/BluetoothScreen"));
const ProfileScreen = lazy(() => import("@/components/screens/ProfileScreen"));

type ConnectionTransport = "serial" | "bluetooth" | null;
type NativeBluetoothDevice = {
  name?: string;
  address?: string;
  connected?: boolean;
  source?: "bluetooth-le" | "bluetooth-classic" | "unknown";
};

type NativeBluetoothSnapshot = {
  supported?: boolean;
  devices?: NativeBluetoothDevice[];
  updatedAt?: string;
  error?: string;
  sourceUrl?: string;
};
type BrowserBluetoothDevice = any;
type BrowserSerialPort = any;
type FontSizePreference = "small" | "medium" | "large";
export type DoseTrackingStatus = "taken" | "missed";
type HardwareDoseEvent = {
  action: "ALERT" | "CONFIRMED" | "MISSED" | "SNOOZED" | "BUTTON";
  doseIndex: number | null;
  label: string;
  detail?: string;
  time?: string;
};
export interface DoseTrackingRecord {
  scheduleId: string;
  dateKey: string;
  status: DoseTrackingStatus;
  updatedAt: string;
}

const SWIPEABLE_SCREENS: Screen[] = ["home", "notifications", "bluetooth", "settings"];
const SWIPE_THRESHOLD_PX = 70;
const SWIPE_MAX_VERTICAL_DRIFT_PX = 90;
const DEVICE_REFRESH_INTERVAL_MS = 1500;
const LIVE_CONNECTION_CHECK_INTERVAL_MS = 750;
const NATIVE_BLUETOOTH_STATUS_URLS = [
  "/api/native-bluetooth/status",
  "http://127.0.0.1:8765/api/native-bluetooth/status",
];
const MEDICINE_SCHEDULES_STORAGE_KEY = "gentle-dose-medicine-schedules-v1";
const SNOOZE_MINUTES_STORAGE_KEY = "gentle-dose-snooze-minutes";
const DOSE_TRACKING_STORAGE_KEY = "gentle-dose-dose-tracking-v1";
const VOICE_GUIDANCE_STORAGE_KEY = "gentle-dose-voice-guidance";
const REMINDERS_ENABLED_STORAGE_KEY = "gentle-dose-reminders-enabled";
const SOUND_ALERTS_STORAGE_KEY = "gentle-dose-sound-alerts";
const DEMO_MODE_STORAGE_KEY = "gentle-dose-demo-mode";

const demoMedicineSchedules: Schedule[] = [
  { id: "demo-s1", name: "Metformin - 500 mg", time: "9:30 AM", enabled: true, stock: 22, expiresInDays: 120 },
  { id: "demo-s2", name: "Atorvastatin - 10 mg", time: "8:00 AM", enabled: true, stock: 14, expiresInDays: 60 },
  { id: "demo-s3", name: "Aspirin - 75 mg", time: "8:00 AM", enabled: true, stock: 5, expiresInDays: 200 },
  { id: "demo-s4", name: "Vitamin D", time: "1:00 PM", enabled: true, stock: 30, expiresInDays: 7 },
];

const ScreenLoading = () => (
  <div className="flex min-h-0 flex-1 items-center justify-center bg-page px-6 text-center">
    <div>
      <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-primary-soft border-t-primary" />
      <p className="mt-4 text-sm font-semibold text-muted-foreground">Loading...</p>
    </div>
  </div>
);

const loadSnoozeMinutes = () => {
  if (typeof window === "undefined") return 10;
  const stored = Number(window.localStorage.getItem(SNOOZE_MINUTES_STORAGE_KEY));
  return Number.isFinite(stored) && stored >= 1 ? Math.min(180, Math.round(stored)) : 10;
};

const loadMedicineSchedules = (): Schedule[] => {
  if (typeof window === "undefined") return initialSchedules;

  try {
    const stored = window.localStorage.getItem(MEDICINE_SCHEDULES_STORAGE_KEY);
    if (!stored) return initialSchedules;
    const parsed = JSON.parse(stored) as Schedule[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : initialSchedules;
  } catch (error) {
    console.error("Could not load medicine schedules:", error);
    return initialSchedules;
  }
};

const loadDoseTrackingRecords = (): DoseTrackingRecord[] => {
  if (typeof window === "undefined") return [];

  try {
    const stored = window.localStorage.getItem(DOSE_TRACKING_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as DoseTrackingRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Could not load dose tracking records:", error);
    return [];
  }
};

const getLocalDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const addDays = (date: Date, amount: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};

const createDemoDoseTrackingRecords = (date = new Date()): DoseTrackingRecord[] => {
  const demoPattern: DoseTrackingStatus[][] = [
    ["taken", "taken", "taken", "taken"],
    ["taken", "taken", "taken", "taken"],
    ["taken", "taken", "taken", "missed"],
    ["taken", "taken", "taken", "taken"],
    ["taken", "taken", "missed", "taken"],
    ["taken", "taken", "taken", "taken"],
    ["taken", "missed", "taken", "taken"],
  ];

  return demoPattern.flatMap((statuses, dayIndex) => {
    const dateKey = getLocalDateKey(addDays(date, dayIndex - (demoPattern.length - 1)));
    return statuses.map((status, scheduleIndex) => ({
      scheduleId: demoMedicineSchedules[scheduleIndex].id,
      dateKey,
      status,
      updatedAt: `${dateKey}T09:${String(30 + scheduleIndex).padStart(2, "0")}:00.000Z`,
    }));
  });
};

const createDemoSmartMedicineSchedules = (date = new Date()): SmartMedicineSchedule[] => {
  const startDate = getLocalDateKey(addDays(date, -6));
  const endDate = getLocalDateKey(addDays(date, 8));
  const slots = [
    { id: "demo-course-morning", kind: "morning" as const, label: "Morning", time: "08:00" },
    { id: "demo-course-night", kind: "night" as const, label: "Night", time: "20:00" },
  ];
  const statusByOffset = new Map<number, SmartMedicineDayStatus>([
    [-6, "taken"],
    [-5, "taken"],
    [-4, "taken"],
    [-3, "missed"],
    [-2, "taken"],
    [-1, "taken"],
    [0, "pending"],
  ]);

  const dailyStatus = Object.fromEntries(
    Array.from({ length: 15 }, (_, index) => {
      const offset = index - 6;
      const dateKey = getLocalDateKey(addDays(date, offset));
      const status = statusByOffset.get(offset) ?? "pending";

      return [
        dateKey,
        {
          date: dateKey,
          status,
          slotStatus: Object.fromEntries(slots.map((slot) => [slot.id, status])),
          updatedAt: offset <= 0 ? `${dateKey}T08:05:00.000Z` : undefined,
        },
      ];
    })
  );

  return [
    {
      id: "demo-course-amoxicillin",
      medicineName: "Amoxicillin - 5 day recovery course",
      startDate,
      endDate,
      timeSlots: slots,
      dailyStatus,
      createdAt: `${startDate}T07:30:00.000Z`,
    },
  ];
};

const scheduleTimeToMinutes = (time: string) => {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3].toUpperCase();
  const hour24 = period === "AM" ? hour % 12 : (hour % 12) + 12;
  return hour24 * 60 + minute;
};

const scheduleToReminder = (schedule: Schedule): MedicineTimeReminder => {
  const [medicineName, ...dosageParts] = schedule.name.split(/\s+-\s+/);
  return {
    scheduleId: schedule.id,
    medicineName: medicineName.trim() || schedule.name,
    dosage: dosageParts.join(" - ").trim() || "Scheduled medicine",
    time: schedule.time,
  };
};

const formatHardwareReminderTime = (time?: string) => {
  if (!time) return "Hardware reminder";

  const match = time.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return time;

  const hour24 = Number(match[1]);
  const minute = match[2];
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${minute} ${period}`;
};

const parseHardwareDoseEvent = (line: string): HardwareDoseEvent | null => {
  const parts = line.split("|").map((part) => part.trim());
  if (parts[0] !== "BT") return null;

  const action = parts[1] as HardwareDoseEvent["action"];
  if (
    action !== "ALERT" &&
    action !== "CONFIRMED" &&
    action !== "MISSED" &&
    action !== "SNOOZED" &&
    action !== "BUTTON"
  ) {
    return null;
  }

  const label = parts[2] || "Dose";
  const doseMatch = label.match(/dose\s+(\d+)/i);
  const doseIndex = doseMatch ? Number(doseMatch[1]) - 1 : null;

  return {
    action,
    doseIndex: doseIndex !== null && Number.isFinite(doseIndex) ? doseIndex : null,
    label,
    detail: parts[3],
    time: parts[4] || (action === "ALERT" ? parts[3] : undefined),
  };
};

const Index = () => {
  const [screen, setScreen] = useState<Screen>("home");
  const [profileOpen, setProfileOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [medicineSchedules, setMedicineSchedules] = useState<Schedule[]>(loadMedicineSchedules);
  const [medicineReminder, setMedicineReminder] = useState<MedicineTimeReminder | null>(null);
  const [doseTrackingRecords, setDoseTrackingRecords] = useState<DoseTrackingRecord[]>(loadDoseTrackingRecords);
  const [snoozeMinutes, setSnoozeMinutes] = useState(loadSnoozeMinutes);
  const activeMedicineReminderKeyRef = useRef<string | null>(null);
  const triggeredMedicineReminderKeysRef = useRef<Set<string>>(new Set());
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [fontSize, setFontSize] = useState<FontSizePreference>(() => {
    if (typeof window === "undefined") return "medium";
    const stored = window.localStorage.getItem("gentle-dose-font-size");
    return stored === "small" || stored === "large" ? stored : "medium";
  });
  const [voiceGuidance, setVoiceGuidance] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(VOICE_GUIDANCE_STORAGE_KEY) !== "off";
  });
  const [remindersEnabled, setRemindersEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(REMINDERS_ENABLED_STORAGE_KEY) !== "off";
  });
  const [soundAlerts, setSoundAlerts] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(SOUND_ALERTS_STORAGE_KEY) !== "off";
  });
  const [demoMode, setDemoMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(DEMO_MODE_STORAGE_KEY) === "on";
  });
  const [notificationEvents, setNotificationEvents] = useState<AppNotification[]>(() =>
    typeof window === "undefined" ? [] : loadAppNotifications()
  );
  const [language, setLanguage] = useState<AppLanguage>(() => {
    if (typeof window === "undefined") return "en";
    return window.localStorage.getItem("gentle-dose-language") === "ta" ? "ta" : "en";
  });

  // Apply theme to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = language;
    window.localStorage.setItem("gentle-dose-language", language);
  }, [language]);

  useEffect(() => {
    const root = document.documentElement;
    const fontSizes: Record<FontSizePreference, string> = {
      small: "14px",
      medium: "16px",
      large: "18px",
    };
    root.style.fontSize = fontSizes[fontSize];
    window.localStorage.setItem("gentle-dose-font-size", fontSize);
  }, [fontSize]);

  useEffect(() => {
    window.localStorage.setItem(MEDICINE_SCHEDULES_STORAGE_KEY, JSON.stringify(medicineSchedules));
  }, [medicineSchedules]);

  useEffect(() => {
    window.localStorage.setItem(DOSE_TRACKING_STORAGE_KEY, JSON.stringify(doseTrackingRecords));
  }, [doseTrackingRecords]);

  useEffect(() => {
    window.localStorage.setItem(SNOOZE_MINUTES_STORAGE_KEY, String(snoozeMinutes));
  }, [snoozeMinutes]);

  useEffect(() => {
    window.localStorage.setItem(VOICE_GUIDANCE_STORAGE_KEY, voiceGuidance ? "on" : "off");
  }, [voiceGuidance]);

  useEffect(() => {
    window.localStorage.setItem(REMINDERS_ENABLED_STORAGE_KEY, remindersEnabled ? "on" : "off");
  }, [remindersEnabled]);

  useEffect(() => {
    window.localStorage.setItem(SOUND_ALERTS_STORAGE_KEY, soundAlerts ? "on" : "off");
  }, [soundAlerts]);

  useEffect(() => {
    window.localStorage.setItem(DEMO_MODE_STORAGE_KEY, demoMode ? "on" : "off");
  }, [demoMode]);

  useEffect(() => {
    if (!userProfile || !remindersEnabled) return;

    const checkMedicineScheduleReminders = () => {
      if (reminderOpen) return;

      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const todayKey = getLocalDateKey(now);
      const dueSchedule = medicineSchedules.find(
        (schedule) => schedule.enabled && scheduleTimeToMinutes(schedule.time) === currentMinutes
      );

      if (!dueSchedule) return;

      const reminderKey = `${dueSchedule.id}:${todayKey}:${currentMinutes}`;
      if (triggeredMedicineReminderKeysRef.current.has(reminderKey)) return;

      triggeredMedicineReminderKeysRef.current.add(reminderKey);
      activeMedicineReminderKeyRef.current = reminderKey;
      setMedicineReminder(scheduleToReminder(dueSchedule));
      setReminderOpen(true);
      recordNotification({
        type: "reminder",
        title: "Medicine reminder",
        message: `${dueSchedule.name} is due now.`,
      });
    };

    checkMedicineScheduleReminders();
    const intervalId = window.setInterval(checkMedicineScheduleReminders, 15000);
    return () => window.clearInterval(intervalId);
  }, [medicineSchedules, reminderOpen, remindersEnabled, userProfile]);

  // Global Bluetooth State
  const [device, setDevice] = useState<BrowserBluetoothDevice | null>(null);
  const [port, setPort] = useState<BrowserSerialPort | null>(null);
  const [savedBluetoothDevices, setSavedBluetoothDevices] = useState<any[]>([]);
  const [savedSerialPorts, setSavedSerialPorts] = useState<any[]>([]);
  const [knownDeviceName, setKnownDeviceName] = useState<string>();
  const [systemDeviceReady, setSystemDeviceReady] = useState(false);
  const [pillBoxConnected, setPillBoxConnected] = useState(false);
  const [pillBoxBusy, setPillBoxBusy] = useState(false);
  const [connectionTransport, setConnectionTransport] = useState<ConnectionTransport>(null);
  const [nativeConnectedDevice, setNativeConnectedDevice] = useState<NativeBluetoothDevice | null>(null);
  const [nativeBluetoothSnapshot, setNativeBluetoothSnapshot] = useState<NativeBluetoothSnapshot | null>(null);
  const serialReaderRef = useRef<any>(null);
  const serialWriterBusyRef = useRef(false);
  const strictDisconnectAnnouncedRef = useRef(false);
  const blockedSerialPortRef = useRef<BrowserSerialPort | null>(null);
  const {
    smartSchedules,
    addSmartSchedule,
    updateSmartScheduleDayStatus,
    removeSmartSchedule,
    upcomingSmartReminder,
  } = useSmartMedicineSchedules();
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipeLastRef = useRef<{ x: number; y: number } | null>(null);
  const lastTalkBackAnnouncementRef = useRef<{ key: string; time: number }>({ key: "", time: 0 });

  const navAny = navigator as any;
  const isWindows = /Windows/i.test(navigator.userAgent);
  const supportsSerial = "serial" in navigator;
  const supportsBluetooth = "bluetooth" in navigator;
  const shouldPreferSerialConnection = isWindows && supportsSerial;
  const copy =
    language === "ta"
      ? {
          pillBoxDisconnected: "மருந்துப் பெட்டி துண்டிக்கப்பட்டது",
          bluetoothClosed: "புளூடூத் இணைப்பு மூடப்பட்டது",
          openingWindowsPicker: "சாதனத் தேர்வியைத் திறக்கிறது...",
          pillBoxConnected: "மருந்துப் பெட்டி இணைக்கப்பட்டது",
          nativeSerialConnected: "சீரியல் சாதனத் தேர்வு மூலம் இணைக்கப்பட்டது",
          connectingTo: (name: string) => `${name} சாதனத்துடன் இணைக்கப்படுகிறது...`,
          pairedWith: (name: string) => `${name} சாதனத்துடன் இணைக்கப்பட்டது`,
          connectionFailed: "இணைப்பு தோல்வியடைந்தது",
          reconnectingSavedWindows: "சேமித்த சாதனத்துடன் மீண்டும் இணைக்கிறது...",
          reconnectedSavedWindows: "சேமித்த சாதன அணுகலால் மீண்டும் இணைக்கப்பட்டது",
          windowsPickerFailed: "சாதனத் தேர்வியைத் திறக்க முடியவில்லை",
          reconnectingSavedBluetooth: (name: string) => `${name} சாதனத்துடன் மீண்டும் இணைக்கிறது...`,
          reconnectedTo: (name: string) => `${name} சாதனத்துடன் மீண்டும் இணைக்கப்பட்டது`,
          reconnectSavedBluetoothFailed: "சேமித்த புளூடூத் மீளிணைப்பு தோல்வியடைந்தது",
          bluetoothReconnectFailed: "சேமித்த புளூடூத் சாதனத்துடன் மீண்டும் இணைக்க முடியவில்லை",
          openBluetoothSettings: "உங்கள் சாதனத்தின் புளூடூத் அமைப்புகளைத் திறக்கவும்",
          pairThenReturn: "முதலில் அங்கே மருந்துப் பெட்டியை இணைத்து, பிறகு இங்கே திரும்பி இணைப்பு பொத்தானை அழுத்தவும்.",
          signedOut: "வெளியேறிவிட்டீர்கள்",
          markedTaken: "எடுத்ததாக குறிக்கப்பட்டது",
          schedulePraise: "நீங்கள் நேரத்தை சரியாகப் பின்பற்றுகிறீர்கள்.",
          snoozedTen: "10 நிமிடங்களுக்கு ஒத்திவைக்கப்பட்டது",
          voiceReminder: (name: string, time: string) =>
            `${name} மருந்தை எடுத்துக்கொள்ள வேண்டிய நேரம். நேரம் ${time}.`,
          voiceTaken: "மருந்து எடுத்ததாக குறிக்கப்பட்டது.",
          voiceTakenHardware: "மருந்துப் பெட்டி பொத்தான் மூலம் மருந்து எடுத்ததாக உறுதி செய்யப்பட்டது.",
          voiceSnoozed: (minutes: number) => `நினைவூட்டல் ${minutes} நிமிடங்களுக்கு ஒத்திவைக்கப்பட்டது.`,
        }
      : {
          pillBoxDisconnected: "Pill box disconnected",
          bluetoothClosed: "Bluetooth connection closed",
          openingWindowsPicker: "Opening device picker...",
          pillBoxConnected: "Pill box connected",
          nativeSerialConnected: "Connected through the native serial picker",
          connectingTo: (name: string) => `Connecting to ${name}...`,
          pairedWith: (name: string) => `Paired with ${name}`,
          connectionFailed: "Connection failed",
          reconnectingSavedWindows: "Reconnecting to saved device...",
          reconnectedSavedWindows: "Reconnected using saved device access",
          windowsPickerFailed: "Failed to open the device picker",
          reconnectingSavedBluetooth: (name: string) => `Reconnecting to ${name}...`,
          reconnectedTo: (name: string) => `Reconnected to ${name}`,
          reconnectSavedBluetoothFailed: "Saved Bluetooth reconnect failed",
          bluetoothReconnectFailed: "Could not reconnect to the saved Bluetooth device",
          openBluetoothSettings: "Open your device Bluetooth settings",
          pairThenReturn: "Pair the pill box there first, then return here and tap Connect.",
          signedOut: "Signed out",
          markedTaken: "Marked as taken",
          schedulePraise: "Great job staying on schedule.",
          snoozedTen: "Snoozed for 10 minutes",
          voiceReminder: (name: string, time: string) => `It is time to take ${name}. Scheduled time ${time}.`,
          voiceTaken: "Medicine marked as taken.",
          voiceTakenHardware: "Medicine confirmed from the pill box button.",
          voiceSnoozed: (minutes: number) =>
            `Reminder snoozed for ${minutes} minute${minutes === 1 ? "" : "s"}.`,
        };

  const playVoiceCue = useCallback(() => {
    if (!soundAlerts) return;
    if (typeof window === "undefined") return;

    const AudioContextConstructor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextConstructor) return;

    try {
      const audioContext = new AudioContextConstructor();
      const now = audioContext.currentTime;
      const gain = audioContext.createGain();
      const tone = audioContext.createOscillator();

      tone.type = "sine";
      tone.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.55, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

      tone.connect(gain);
      gain.connect(audioContext.destination);
      tone.start(now);
      tone.stop(now + 0.2);
      window.setTimeout(() => void audioContext.close(), 280);
    } catch (error) {
      console.warn("Voice cue could not play:", error);
    }
  }, [soundAlerts]);

  const speak = useCallback(
    (message: string, options: { force?: boolean; fallbackMessage?: string; cue?: boolean } = {}) => {
      if ((!voiceGuidance && !options.force) || typeof window === "undefined" || !("speechSynthesis" in window)) return;

      const synth = window.speechSynthesis;
      const targetLang = language === "ta" ? "ta-IN" : "en-US";

      if (options.cue !== false) {
        playVoiceCue();
      }

      const speakWithAvailableVoices = (voices: SpeechSynthesisVoice[]) => {
        const targetVoice =
          voices.find((voice) => voice.lang.toLowerCase() === targetLang.toLowerCase()) ||
          voices.find((voice) => voice.lang.toLowerCase().startsWith(language === "ta" ? "ta" : "en"));
        const englishFallbackVoice =
          voices.find((voice) => voice.lang.toLowerCase() === "en-in") ||
          voices.find((voice) => voice.lang.toLowerCase().startsWith("en"));

        // Keep Tamil text as Tamil. Some browsers can speak ta-IN by lang even
        // before exposing the voice object through getVoices().
        const shouldUseEnglishFallback = language !== "ta" && !targetVoice && options.fallbackMessage;
        const spokenMessage = shouldUseEnglishFallback ? options.fallbackMessage || message : message;
        const matchingVoice = targetVoice || (language === "ta" ? undefined : englishFallbackVoice);

        synth.cancel();
        synth.resume();

        const utterance = new SpeechSynthesisUtterance(spokenMessage);
        utterance.lang = matchingVoice?.lang || targetLang;
        utterance.rate = language === "ta" ? 0.82 : 0.9;
        utterance.pitch = 1;
        utterance.volume = 1;
        if (matchingVoice) utterance.voice = matchingVoice;

        synth.speak(utterance);
        window.setTimeout(() => synth.resume(), 40);
        window.setTimeout(() => synth.resume(), 160);
      };

      const voices = synth.getVoices();
      if (voices.length > 0) {
        speakWithAvailableVoices(voices);
        return;
      }

      // Chrome/Edge often populate speech voices asynchronously.
      const speakAfterVoicesLoad = () => {
        synth.removeEventListener("voiceschanged", speakAfterVoicesLoad);
        speakWithAvailableVoices(synth.getVoices());
      };

      synth.addEventListener("voiceschanged", speakAfterVoicesLoad);
      window.setTimeout(() => {
        synth.removeEventListener("voiceschanged", speakAfterVoicesLoad);
        if (!synth.speaking) speakWithAvailableVoices(synth.getVoices());
      }, 600);
    },
    [language, playVoiceCue, voiceGuidance]
  );

  const getVoiceTestMessage = useCallback(
    () =>
      language === "ta"
        ? "டாக்பேக் முறை இயங்குகிறது. திரையில் உள்ள பொத்தான்கள் மற்றும் அமைப்புகளை நான் வாசித்துக் காட்டுவேன்."
        : "TalkBack mode is working. I will read buttons, controls, and important alerts on this screen.",
    [language]
  );

  const getVoiceTestFallbackMessage = useCallback(
    () => "TalkBack mode is working. I will read buttons, controls, and important alerts on this screen.",
    []
  );

  const handleVoiceGuidanceChange = (enabled: boolean) => {
    setVoiceGuidance(enabled);
    if (enabled) {
      speak(getVoiceTestMessage(), { force: true, fallbackMessage: getVoiceTestFallbackMessage() });
    }
  };

  const handleTestVoice = () => {
    speak(getVoiceTestMessage(), { force: true, fallbackMessage: getVoiceTestFallbackMessage() });
  };

  const describeTalkBackTarget = useCallback(
    (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return null;

      const element = target.closest<HTMLElement>(
        'button, a, input, select, textarea, [role="button"], [role="switch"], [role="tab"], [tabindex]:not([tabindex="-1"])'
      );
      if (!element || element.getAttribute("aria-hidden") === "true") return null;

      const rawRole =
        element.getAttribute("role") ||
        (element.tagName === "BUTTON" ? "button" : "") ||
        (element.tagName === "A" ? "link" : "") ||
        (element.tagName === "INPUT" ? "input" : "");
      const role = rawRole.toLowerCase();
      const ariaLabel =
        element.getAttribute("data-talkback-label") || element.getAttribute("aria-label") || element.getAttribute("title") || "";
      const visibleText = element.innerText || element.textContent || "";
      const inputValue =
        element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
          ? element.value || element.placeholder
          : "";
      const rawLabel = (ariaLabel || inputValue || visibleText || "Control").replace(/\s+/g, " ").trim();
      const label = rawLabel
        .replace(/[,.]?\s*\b(push button|button)\b[,.]?/gi, "")
        .replace(/[,.]?\s*பொத்தான்[,.]?/gi, "")
        .trim();
      if (!label) return null;

      const isDisabled = element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true";
      const isPressed = element.getAttribute("aria-pressed");
      const isChecked =
        element.getAttribute("aria-checked") ??
        (element instanceof HTMLInputElement && ["checkbox", "radio"].includes(element.type)
          ? String(element.checked)
          : null);
      const isSelected = element.getAttribute("aria-selected");

      const englishRole =
        role === "switch"
          ? "switch"
          : role === "tab"
            ? "tab"
            : role === "link"
              ? "link"
              : element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
                ? "text field"
                : "button";
      const tamilRole =
        role === "switch"
          ? "மாற்றி"
          : role === "tab"
            ? "தாவல்"
            : role === "link"
              ? "இணைப்பு"
              : element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
                ? "உள்ளீட்டு புலம்"
                : "பொத்தான்";

      const englishState = [
        isChecked === "true" ? "on" : isChecked === "false" ? "off" : "",
        isPressed === "true" ? "pressed" : "",
        isSelected === "true" ? "selected" : "",
        isDisabled ? "disabled" : "",
      ].filter(Boolean);
      const tamilState = [
        isChecked === "true" ? "இயக்கத்தில்" : isChecked === "false" ? "நிறுத்தப்பட்டுள்ளது" : "",
        isPressed === "true" ? "அழுத்தப்பட்டுள்ளது" : "",
        isSelected === "true" ? "தேர்வு செய்யப்பட்டுள்ளது" : "",
        isDisabled ? "முடக்கப்பட்டுள்ளது" : "",
      ].filter(Boolean);
      const shouldSkipRole = englishRole === "button";
      const englishRolePhrase = shouldSkipRole ? "" : `. ${englishRole}`;
      const tamilRolePhrase = shouldSkipRole ? "" : `. ${tamilRole}`;

      return {
        key: `${role}:${label}:${isChecked ?? ""}:${isSelected ?? ""}:${isDisabled}`,
        message:
          language === "ta"
            ? `${label}${tamilRolePhrase}${tamilState.length ? `. ${tamilState.join(". ")}` : ""}.`
            : `${label}${englishRolePhrase}${englishState.length ? `. ${englishState.join(". ")}` : ""}.`,
        fallbackMessage: `${label}${englishRolePhrase}${englishState.length ? `. ${englishState.join(". ")}` : ""}.`,
      };
    },
    [language]
  );

  useEffect(() => {
    if (!voiceGuidance || typeof document === "undefined") return;

    const announceTarget = (target: EventTarget | null) => {
      const description = describeTalkBackTarget(target);
      if (!description) return;

      const now = Date.now();
      const last = lastTalkBackAnnouncementRef.current;
      if (last.key === description.key && now - last.time < 650) return;

      lastTalkBackAnnouncementRef.current = { key: description.key, time: now };
      speak(description.message, {
        fallbackMessage: description.fallbackMessage,
        cue: false,
      });
    };

    const handleFocusIn = (event: FocusEvent) => announceTarget(event.target);
    const handleClick = (event: MouseEvent) => announceTarget(event.target);

    document.addEventListener("focusin", handleFocusIn, true);
    document.addEventListener("click", handleClick, true);

    return () => {
      document.removeEventListener("focusin", handleFocusIn, true);
      document.removeEventListener("click", handleClick, true);
    };
  }, [describeTalkBackTarget, speak, voiceGuidance]);

  const activeReminderName = medicineReminder?.medicineName || upcomingSmartReminder?.medicineName;
  const activeReminderTime = medicineReminder?.time || upcomingSmartReminder?.time;

  useEffect(() => {
    if (!reminderOpen || !activeReminderName || !activeReminderTime) return;
    const message =
      language === "ta"
        ? `${activeReminderName} மருந்தை எடுத்துக்கொள்ள வேண்டிய நேரம். நேரம் ${activeReminderTime}.`
        : `It is time to take ${activeReminderName}. Scheduled time ${activeReminderTime}.`;
    speak(message, {
      fallbackMessage: `It is time to take ${activeReminderName}. Scheduled time ${activeReminderTime}.`,
    });
  }, [activeReminderName, activeReminderTime, language, reminderOpen, speak]);

  const normalizeDeviceKey = (value?: string | null) => value?.trim().toLowerCase() ?? "";
  const isSerialPortOpen = (candidatePort: BrowserSerialPort | null) =>
    Boolean(candidatePort?.readable || candidatePort?.writable);

  const connectBluetoothGattDevice = async (btDevice: BrowserBluetoothDevice) => {
    if (!btDevice?.gatt) {
      throw new Error("This device does not expose a Bluetooth GATT connection.");
    }

    const server = await btDevice.gatt.connect();
    if (!btDevice.gatt.connected && !server?.connected) {
      throw new Error("Bluetooth connection did not become active.");
    }

    return server;
  };

  const writeSerialLine = async (line: string) => {
    if (!port?.writable || connectionTransport !== "serial") {
      return false;
    }

    if (serialWriterBusyRef.current) {
      return true;
    }

    serialWriterBusyRef.current = true;
    let writer: any;
    try {
      writer = port.writable.getWriter();
      await writer.write(new TextEncoder().encode(`${line}\n`));
      return true;
    } catch (error) {
      console.error(`Serial write failed for ${line}:`, error);
      return false;
    } finally {
      writer?.releaseLock?.();
      serialWriterBusyRef.current = false;
    }
  };

  const sendPillBoxCommand = async (command: "ALARM:START" | "ALARM:STOP") => {
    const sent = await writeSerialLine(command);
    if (!sent) {
      handleStrictConnectionLoss(`Could not send ${command} to pill box.`);
    }
  };

  const pingSerialConnection = () => writeSerialLine("PING");

  const applyConnectedState = ({
    nextDevice,
    nextPort,
    nextName,
    nextTransport,
    ready = true,
  }: {
    nextDevice: BrowserBluetoothDevice | null;
    nextPort: BrowserSerialPort | null;
    nextName: string;
    nextTransport: Exclude<ConnectionTransport, null>;
    ready?: boolean;
  }) => {
    setDevice(nextDevice);
    setPort(nextPort);
    setKnownDeviceName(nextName);
    setSystemDeviceReady(ready);
    setPillBoxConnected(true);
    setConnectionTransport(nextTransport);
    strictDisconnectAnnouncedRef.current = false;
    blockedSerialPortRef.current = null;
  };

  const clearLiveConnectionState = () => {
    setPillBoxConnected(false);
    setConnectionTransport(null);
  };

  const closeSerialPort = async (targetPort: BrowserSerialPort | null) => {
    if (!targetPort) return;

    try {
      await serialReaderRef.current?.cancel?.();
    } catch (error) {
      console.warn("Could not cancel serial reader before closing:", error);
    }

    if (isSerialPortOpen(targetPort)) {
      await targetPort.close();
    }
  };

  const refreshKnownDevices = async () => {
    if (pillBoxBusy) return;

    let ready = false;
    let nextKnownName: string | undefined;
    let nextSavedBluetoothDevices: any[] = [];
    let nextSavedSerialPorts: any[] = [];
    let nextConnected = false;
    let nextTransport: ConnectionTransport = null;
    let nextDevice = device;
    let nextPort = port;

    const serialConnectionOpen = isSerialPortOpen(port) && port !== blockedSerialPortRef.current;
    if (serialConnectionOpen) {
      nextConnected = true;
      nextTransport = "serial";
      ready = true;
      nextKnownName = knownDeviceName || "Paired serial device";
    }

    if (device?.gatt?.connected) {
      nextConnected = true;
      nextTransport = "bluetooth";
      ready = true;
      nextKnownName = device.name || knownDeviceName || "Bluetooth device";
    }

    try {
      if (supportsSerial && navAny.serial?.getPorts) {
        const ports = await navAny.serial.getPorts();
        nextSavedSerialPorts = ports;

        if (ports.length > 0) {
          ready = true;
          if (!nextKnownName) {
            nextKnownName = "Paired device";
          }
        }
      }

      if (supportsBluetooth && navAny.bluetooth?.getDevices) {
        const devices = await navAny.bluetooth.getDevices();
        if (devices.length > 0) {
          nextSavedBluetoothDevices = devices;
          ready = true;

          const connectedRememberedDevice = devices.find((candidate: any) => candidate.gatt?.connected);
          if (connectedRememberedDevice) {
            nextDevice = connectedRememberedDevice;
            nextConnected = true;
            nextTransport = "bluetooth";
            nextKnownName = connectedRememberedDevice.name || "Bluetooth device";
          } else if (!nextKnownName) {
            nextKnownName = devices[0].name || "Saved Bluetooth access";
          }
        }
      }
    } catch (error) {
      console.error("Could not refresh native device access:", error);
    }

    if (!nextConnected) {
      if (device && !device.gatt?.connected) {
        nextDevice = null;
      }
      if (port && !serialConnectionOpen) {
        nextPort = null;
      }
    }

    setSystemDeviceReady(ready);
    setKnownDeviceName(nextKnownName);
    setSavedBluetoothDevices(nextSavedBluetoothDevices);
    setSavedSerialPorts(nextSavedSerialPorts);
    setPillBoxConnected(nextConnected);
    setConnectionTransport(nextTransport);

    if (nextDevice !== device) {
      setDevice(nextDevice);
    }

    if (nextPort !== port) {
      setPort(nextPort);
    }
  };

  const isLiveConnectionActive = () => {
    if (connectionTransport === "bluetooth") {
      return Boolean(device?.gatt?.connected);
    }

    if (connectionTransport === "serial") {
      return isSerialPortOpen(port);
    }

    return false;
  };

  const handleStrictConnectionLoss = (description = copy.bluetoothClosed) => {
    if (strictDisconnectAnnouncedRef.current) return;

    strictDisconnectAnnouncedRef.current = true;
    const lostPort = connectionTransport === "serial" ? port : null;
    if (lostPort) {
      blockedSerialPortRef.current = lostPort;
    }

    clearLiveConnectionState();
    setDevice((currentDevice: BrowserBluetoothDevice | null) =>
      currentDevice?.gatt?.connected ? currentDevice : null
    );
    setPort(null);
    setSystemDeviceReady(false);
    toast(copy.pillBoxDisconnected, { description });
    recordNotification({
      type: "missed",
      title: "Pill box connection lost",
      message: description,
    });
    speak(copy.pillBoxDisconnected, { fallbackMessage: "Pill box disconnected." });
    if (lostPort) {
      void closeSerialPort(lostPort).finally(() => {
        blockedSerialPortRef.current = null;
        void refreshKnownDevices();
      });
    } else {
      void refreshKnownDevices();
    }
  };

  const refreshNativeBluetoothStatus = async () => {
    try {
      let snapshot: NativeBluetoothSnapshot | null = null;

      for (const url of NATIVE_BLUETOOTH_STATUS_URLS) {
        try {
          const response = await fetch(url, {
            cache: "no-store",
            headers: { Accept: "application/json" },
          });

          if (response.ok) {
            snapshot = (await response.json()) as NativeBluetoothSnapshot;
            snapshot.sourceUrl = url;
            break;
          }
        } catch {
          // Try the next bridge URL. The direct native bridge is optional in web-only mode.
        }
      }

      if (!snapshot?.supported) {
        setNativeBluetoothSnapshot(
          snapshot ?? {
            supported: false,
            devices: [],
            error: "Native Bluetooth bridge is not running.",
          }
        );
        setNativeConnectedDevice(null);
        return;
      }

      setNativeBluetoothSnapshot(snapshot);

      const hintNames = new Set(
        [device?.name, knownDeviceName, ...savedBluetoothDevices.map((savedDevice: any) => savedDevice?.name)]
          .map((value) => normalizeDeviceKey(value))
          .filter(Boolean)
      );

      const matchedWindowsDevice =
        snapshot.devices?.find((candidate) => {
          const candidateKey = normalizeDeviceKey(candidate.name);
          return Boolean(candidateKey && hintNames.has(candidateKey));
        }) ??
        snapshot.devices?.find((candidate) => candidate.connected) ??
        null;

      setNativeConnectedDevice(matchedWindowsDevice);

      if (!pillBoxConnected && matchedWindowsDevice?.name) {
        setSystemDeviceReady(true);
        setKnownDeviceName((current) => current || matchedWindowsDevice.name);
      }
    } catch (error) {
      console.error("Could not refresh native Windows Bluetooth status:", error);
      setNativeBluetoothSnapshot({
        supported: false,
        devices: [],
        error: error instanceof Error ? error.message : "Could not refresh native Windows Bluetooth status.",
      });
      setNativeConnectedDevice(null);
    }
  };

  useEffect(() => {
    void refreshKnownDevices();
  }, []);

  useEffect(() => {
    void refreshNativeBluetoothStatus();

    const intervalId = window.setInterval(() => {
      void refreshNativeBluetoothStatus();
    }, DEVICE_REFRESH_INTERVAL_MS);

    const refreshOnFocus = () => {
      void refreshNativeBluetoothStatus();
    };

    window.addEventListener("focus", refreshOnFocus);
    window.addEventListener("pageshow", refreshOnFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshOnFocus);
      window.removeEventListener("pageshow", refreshOnFocus);
    };
  }, [device, knownDeviceName, pillBoxConnected, savedBluetoothDevices]);

  useEffect(() => {
    const refreshOnDemand = () => {
      void refreshKnownDevices();
    };

    const handleBluetoothAvailabilityChange = async () => {
      try {
        const available = navAny.bluetooth?.getAvailability ? await navAny.bluetooth.getAvailability() : true;
        if (!available && connectionTransport === "bluetooth" && pillBoxConnected) {
          handleStrictConnectionLoss("Bluetooth adapter is unavailable.");
          return;
        }
      } catch (error) {
        console.error("Could not read Bluetooth availability:", error);
      }

      void refreshKnownDevices();
    };

    const handleSerialDisconnect = (event: Event) => {
      if (connectionTransport === "serial" && pillBoxConnected && (!port || event.target === port)) {
        handleStrictConnectionLoss("Serial Bluetooth device disconnected.");
        return;
      }

      void refreshKnownDevices();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void refreshKnownDevices();
      }
    };

    const intervalId = window.setInterval(refreshOnDemand, DEVICE_REFRESH_INTERVAL_MS);

    window.addEventListener("focus", refreshOnDemand);
    window.addEventListener("pageshow", refreshOnDemand);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    navAny.bluetooth?.addEventListener?.("availabilitychanged", handleBluetoothAvailabilityChange);
    navAny.serial?.addEventListener?.("connect", refreshOnDemand);
    navAny.serial?.addEventListener?.("disconnect", handleSerialDisconnect);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshOnDemand);
      window.removeEventListener("pageshow", refreshOnDemand);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      navAny.bluetooth?.removeEventListener?.("availabilitychanged", handleBluetoothAvailabilityChange);
      navAny.serial?.removeEventListener?.("connect", refreshOnDemand);
      navAny.serial?.removeEventListener?.("disconnect", handleSerialDisconnect);
    };
  }, [connectionTransport, pillBoxBusy, device, port, knownDeviceName, pillBoxConnected]);

  useEffect(() => {
    if (!pillBoxConnected || pillBoxBusy) return;

    const verifyLiveConnection = async () => {
      if (!isLiveConnectionActive()) {
        handleStrictConnectionLoss("Live connection check failed.");
        return;
      }

      if (connectionTransport === "serial") {
        const heartbeatOk = await pingSerialConnection();
        if (!heartbeatOk) {
          handleStrictConnectionLoss("Serial Bluetooth heartbeat failed.");
        }
      }
    };

    void verifyLiveConnection();
    const intervalId = window.setInterval(verifyLiveConnection, LIVE_CONNECTION_CHECK_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [connectionTransport, device, pillBoxBusy, pillBoxConnected, port]);

  const markCurrentReminderTaken = useCallback(
    (source: "app" | "hardware" = "app") => {
      setReminderOpen(false);
      if (medicineReminder) {
        if (medicineReminder.scheduleId) {
          handleTrackDose(medicineReminder.scheduleId, "taken");
        }
        setMedicineReminder(null);
        activeMedicineReminderKeyRef.current = null;
      } else {
        handleMarkUpcomingSmartReminderTaken();
      }

      toast.success(copy.markedTaken, {
        description: source === "hardware" ? "Confirmed from pill box button." : copy.schedulePraise,
      });
      speak(source === "hardware" ? copy.voiceTakenHardware : copy.voiceTaken, {
        fallbackMessage:
          source === "hardware" ? "Medicine confirmed from the pill box button." : "Medicine marked as taken.",
      });
    },
    [copy, medicineReminder, speak, upcomingSmartReminder]
  );

  const handleHardwareLine = useCallback(
    (line: string) => {
      if (!line) return;

      const hardwareEvent = parseHardwareDoseEvent(line);
      if (hardwareEvent) {
        const schedule =
          hardwareEvent.doseIndex !== null ? medicineSchedules[hardwareEvent.doseIndex] : undefined;
        const doseName = schedule?.name || hardwareEvent.label;

        if (hardwareEvent.action === "ALERT") {
          setMedicineReminder(
            schedule
              ? scheduleToReminder(schedule)
              : {
                  medicineName: hardwareEvent.label,
                  dosage: "Hardware dose reminder",
                  time: formatHardwareReminderTime(hardwareEvent.time),
                }
          );
          setReminderOpen(true);
          recordNotification({
            type: "reminder",
            title: "Hardware medicine alert",
            message: `${doseName} is due now.`,
          });
          toast.info("Hardware medicine alert", {
            description: `${doseName} is due now.`,
          });
          return;
        }

        if (hardwareEvent.action === "CONFIRMED") {
          if (schedule) {
            handleTrackDose(schedule.id, "taken");
          }
          setReminderOpen(false);
          setMedicineReminder(null);
          activeMedicineReminderKeyRef.current = null;
          recordNotification({
            type: "success",
            title: "Dose confirmed from pill box",
            message: `${doseName} was confirmed via ${hardwareEvent.detail || "hardware"}.`,
          });
          toast.success("Dose confirmed from pill box", {
            description: `${doseName} was confirmed via ${hardwareEvent.detail || "hardware"}.`,
          });
          speak("Medicine confirmed from the pill box.", {
            fallbackMessage: "Medicine confirmed from the pill box.",
          });
          return;
        }

        if (hardwareEvent.action === "MISSED") {
          if (schedule) {
            handleTrackDose(schedule.id, "missed");
          }
          setReminderOpen(false);
          setMedicineReminder(null);
          activeMedicineReminderKeyRef.current = null;
          recordNotification({
            type: "missed",
            title: "Dose missed",
            message: `${doseName} was not confirmed before the hardware timeout.`,
          });
          toast.error("Dose missed", {
            description: `${doseName} was not confirmed before the hardware timeout.`,
          });
          speak("Dose missed. Caregiver alert needed.", {
            fallbackMessage: "Dose missed. Caregiver alert needed.",
          });
          return;
        }

        if (hardwareEvent.action === "SNOOZED") {
          setReminderOpen(false);
          recordNotification({
            type: "reminder",
            title: "Hardware snooze pressed",
            message: `${doseName} was snoozed from the pill box.`,
          });
          toast("Hardware snooze pressed", {
            description: `${doseName} was snoozed from the pill box.`,
          });
          return;
        }

        if (hardwareEvent.action === "BUTTON") {
          toast.info(`Hardware ${hardwareEvent.label}`, {
            description: hardwareEvent.detail || "Button signal received from pill box.",
          });
          return;
        }
      }

      if (line === "BTN:PRESSED") {
        void sendPillBoxCommand("ALARM:STOP");
        markCurrentReminderTaken("hardware");
        return;
      }

      if (line.startsWith("TIME:")) {
        return;
      }
    },
    [markCurrentReminderTaken, medicineSchedules, sendPillBoxCommand, speak]
  );

  useEffect(() => {
    if (!port?.readable || connectionTransport !== "serial" || !pillBoxConnected) return;

    let cancelled = false;
    let buffer = "";
    const decoder = new TextDecoder();

    const readSerialLines = async () => {
      const reader = port.readable.getReader();
      serialReaderRef.current = reader;

      try {
        while (!cancelled) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          while (buffer.includes("\n")) {
            const [line, rest] = buffer.split("\n", 2);
            buffer = rest;
            handleHardwareLine(line.trim());
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Serial read failed:", error);
          handleStrictConnectionLoss("Serial connection stopped responding.");
        }
      } finally {
        reader.releaseLock();
        if (serialReaderRef.current === reader) {
          serialReaderRef.current = null;
        }
        if (!cancelled && connectionTransport === "serial") {
          handleStrictConnectionLoss("Serial connection closed.");
        }
      }
    };

    void readSerialLines();

    return () => {
      cancelled = true;
      void serialReaderRef.current?.cancel?.();
    };
  }, [connectionTransport, handleHardwareLine, pillBoxConnected, port]);

  useEffect(() => {
    if (reminderOpen) {
      void sendPillBoxCommand("ALARM:START");
    }
  }, [reminderOpen, sendPillBoxCommand]);

  useEffect(() => {
    if (!device) return;

    const handleGattDisconnect = () => {
      handleStrictConnectionLoss(copy.bluetoothClosed);
    };

    device.addEventListener?.("gattserverdisconnected", handleGattDisconnect);

    return () => {
      device.removeEventListener?.("gattserverdisconnected", handleGattDisconnect);
    };
  }, [copy.bluetoothClosed, device]);

  const connectWithSerial = async () => {
    toast.loading(copy.openingWindowsPicker, { id: "pillbox" });
    const serialPort = await navAny.serial.requestPort();
    await serialPort.open({ baudRate: 9600 });
    applyConnectedState({
      nextDevice: null,
      nextPort: serialPort,
      nextName: "Paired serial device",
      nextTransport: "serial",
    });
    toast.success(copy.pillBoxConnected, {
      id: "pillbox",
      description: copy.nativeSerialConnected,
    });
    recordNotification({
      type: "success",
      title: "Pill box connected",
      message: "Connected through the native serial picker.",
    });
    speak(copy.pillBoxConnected, { fallbackMessage: "Pill box connected." });
  };

  const connectWithBluetooth = async () => {
    toast.loading(copy.openingWindowsPicker, { id: "pillbox" });
    const btDevice = await navAny.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: ["generic_access", "device_information", "battery_service"],
    });

    toast.loading(copy.connectingTo(btDevice.name || "Pill Box"), { id: "pillbox" });
    await connectBluetoothGattDevice(btDevice);

    applyConnectedState({
      nextDevice: btDevice,
      nextPort: null,
      nextName: btDevice.name || "Bluetooth device",
      nextTransport: "bluetooth",
    });
    toast.success(copy.pillBoxConnected, {
      id: "pillbox",
      description: copy.pairedWith(btDevice.name || "device"),
    });
    recordNotification({
      type: "success",
      title: "Pill box connected",
      message: `Connected to ${btDevice.name || "Bluetooth device"}.`,
    });
    speak(copy.pillBoxConnected, { fallbackMessage: "Pill box connected." });
  };

  const handlePillBoxToggle = async () => {
    if (pillBoxBusy) return;
    setPillBoxBusy(true);

    if (pillBoxConnected) {
      try {
        if (device?.gatt?.connected) device.gatt.disconnect();
        await closeSerialPort(port);
      } catch (err) {
        console.error("Disconnect error:", err);
      }
      clearLiveConnectionState();
      setPillBoxBusy(false);
      await refreshKnownDevices();
      toast(copy.pillBoxDisconnected, { description: copy.bluetoothClosed });
      recordNotification({
        type: "missed",
        title: "Pill box disconnected",
        message: "Bluetooth connection was closed.",
      });
      speak(copy.pillBoxDisconnected, { fallbackMessage: "Pill box disconnected." });
    } else {
      try {
        if (shouldPreferSerialConnection) {
          await connectWithSerial();
        } else if (supportsBluetooth) {
          await connectWithBluetooth();
        } else if (supportsSerial) {
          await connectWithSerial();
        } else {
          throw new Error("Bluetooth/Serial API not supported in this browser.");
        }
      } catch (error: any) {
        if (error.name !== "NotFoundError") {
          toast.error(copy.connectionFailed, { description: error.message || copy.connectionFailed });
        }
      } finally {
        setPillBoxBusy(false);
      }
    }
  };

  const handleConnectSavedWindowsDevice = async () => {
    if (pillBoxBusy || pillBoxConnected || !supportsSerial) return;

    setPillBoxBusy(true);
    try {
      const savedSerialPort = savedSerialPorts[0];

      if (savedSerialPort) {
        toast.loading(copy.reconnectingSavedWindows, { id: "pillbox" });
        if (!isSerialPortOpen(savedSerialPort)) {
          await savedSerialPort.open({ baudRate: 9600 });
        }
        applyConnectedState({
          nextDevice: null,
          nextPort: savedSerialPort,
          nextName: "Paired device",
          nextTransport: "serial",
        });
        toast.success(copy.pillBoxConnected, {
          id: "pillbox",
          description: copy.reconnectedSavedWindows,
        });
        recordNotification({
          type: "success",
          title: "Pill box reconnected",
          message: "Reconnected using saved device access.",
        });
        speak(copy.pillBoxConnected, { fallbackMessage: "Pill box connected." });
      } else {
        await connectWithSerial();
      }
    } catch (error: any) {
      if (error.name !== "NotFoundError") {
        toast.error(copy.connectionFailed, {
          description: error.message || copy.windowsPickerFailed,
        });
      }
    } finally {
      setPillBoxBusy(false);
    }
  };

  const handleReconnectSavedBluetooth = async (targetDevice: any) => {
    if (pillBoxBusy || pillBoxConnected || !targetDevice) return;

    setPillBoxBusy(true);
    try {
      toast.loading(copy.reconnectingSavedBluetooth(targetDevice.name || "saved device"), {
        id: "pillbox",
      });

      await connectBluetoothGattDevice(targetDevice);

      applyConnectedState({
        nextDevice: targetDevice,
        nextPort: null,
        nextName: targetDevice.name || "Saved Bluetooth device",
        nextTransport: "bluetooth",
      });
      toast.success(copy.pillBoxConnected, {
        id: "pillbox",
        description: copy.reconnectedTo(targetDevice.name || "saved device"),
      });
      recordNotification({
        type: "success",
        title: "Pill box reconnected",
        message: `Reconnected to ${targetDevice.name || "saved Bluetooth device"}.`,
      });
      speak(copy.pillBoxConnected, { fallbackMessage: "Pill box connected." });
    } catch (error: any) {
      if (error.name !== "NotFoundError") {
        toast.error(copy.reconnectSavedBluetoothFailed, {
          description: error.message || copy.bluetoothReconnectFailed,
        });
      }
    } finally {
      setPillBoxBusy(false);
    }
  };

  const handleOpenSystemBluetooth = () => {
    if (isWindows) {
      window.location.href = "ms-settings:bluetooth";
      return;
    }

    toast.info(copy.openBluetoothSettings, {
      description: copy.pairThenReturn,
    });
  };

  const handleLogout = () => {
    clearActiveUserProfile();
    setUserProfile(null);
    setScreen("home");
    toast(copy.signedOut);
  };

  const handleLogin = (profile: UserProfile) => {
    saveActiveUserProfile(profile);
    setUserProfile(profile);
  };

  const handleProfileChange = (profile: UserProfile) => {
    saveUserProfile(profile);
    setUserProfile(profile);
  };

  const recordNotification = (notification: Omit<AppNotification, "id" | "createdAt">) => {
    const nextNotification = addAppNotification(notification);
    setNotificationEvents((current) => [nextNotification, ...current].slice(0, 80));
  };

  const handleDemoModeToggle = () => {
    setDemoMode((current) => {
      const next = !current;
      if (next) {
        saveAppNotifications(demoNotifications);
        setNotificationEvents(demoNotifications);
        toast.success("Demo mode enabled", {
          description: "Client-safe sample data is active.",
        });
      } else {
        setNotificationEvents(loadAppNotifications());
        toast("Demo mode disabled");
      }
      return next;
    });
  };

  const handleMarkUpcomingSmartReminderTaken = () => {
    if (!upcomingSmartReminder) return;

    updateSmartScheduleDayStatus(upcomingSmartReminder.scheduleId, upcomingSmartReminder.date, "taken");
  };

  const handleTrackDose = (scheduleId: string, status: DoseTrackingStatus) => {
    const dateKey = getLocalDateKey(new Date());
    const schedule = medicineSchedules.find((item) => item.id === scheduleId);
    setDoseTrackingRecords((current) => {
      const nextRecord: DoseTrackingRecord = {
        scheduleId,
        dateKey,
        status,
        updatedAt: new Date().toISOString(),
      };

      return [
        nextRecord,
        ...current.filter((record) => !(record.scheduleId === scheduleId && record.dateKey === dateKey)),
      ];
    });
    recordNotification({
      type: status === "taken" ? "success" : "missed",
      title: status === "taken" ? "Dose marked as taken" : "Dose marked as missed",
      message: `${schedule?.name || "Medicine"} was marked ${status}.`,
    });
  };

  const moveScreenBySwipe = (direction: "next" | "previous") => {
    const currentIndex = SWIPEABLE_SCREENS.indexOf(screen);
    if (currentIndex === -1) return;

    const targetIndex =
      direction === "next"
        ? Math.min(currentIndex + 1, SWIPEABLE_SCREENS.length - 1)
        : Math.max(currentIndex - 1, 0);

    if (targetIndex === currentIndex) return;

    startTransition(() => {
      setScreen(SWIPEABLE_SCREENS[targetIndex]);
    });
  };

  const handleSwipeStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
    swipeLastRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleSwipeMove = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    swipeLastRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleSwipeEnd = () => {
    if (profileOpen || reminderOpen) {
      swipeStartRef.current = null;
      swipeLastRef.current = null;
      return;
    }

    const start = swipeStartRef.current;
    const end = swipeLastRef.current;

    swipeStartRef.current = null;
    swipeLastRef.current = null;

    if (!start || !end) return;

    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (absX < SWIPE_THRESHOLD_PX) return;
    if (absY > SWIPE_MAX_VERTICAL_DRIFT_PX) return;
    if (absX <= absY * 1.2) return;

    if (deltaX > 0) {
      moveScreenBySwipe("next");
    } else {
      moveScreenBySwipe("previous");
    }
  };

  const canReconnectSavedBluetooth = savedBluetoothDevices.length > 0;
  const nativeWindowsConnectionIsLive = Boolean(nativeConnectedDevice?.connected) && !pillBoxConnected;
  const effectivePillBoxConnected = demoMode || pillBoxConnected;
  const effectivePillBoxBusy = demoMode ? false : pillBoxBusy;
  const effectiveSchedules = demoMode ? demoMedicineSchedules : medicineSchedules;
  const effectiveDoseTrackingRecords = demoMode ? createDemoDoseTrackingRecords() : doseTrackingRecords;
  const effectiveSmartSchedules = demoMode ? createDemoSmartMedicineSchedules() : smartSchedules;
  const effectiveUpcomingSmartReminder = demoMode
    ? getUpcomingSmartReminder(effectiveSmartSchedules, new Date())
    : upcomingSmartReminder;
  const effectiveNotifications = demoMode ? demoNotifications : notificationEvents;
  const effectiveNativeBluetoothSnapshot: NativeBluetoothSnapshot | null = demoMode
    ? {
        supported: true,
        updatedAt: "Demo mode",
        sourceUrl: "demo",
        devices: [
          {
            name: "Demo Smart Pill Box",
            connected: true,
            source: "bluetooth-le",
          },
        ],
      }
    : nativeBluetoothSnapshot;
  const resolvedDeviceName = demoMode
    ? "Demo Smart Pill Box"
    : device?.name || knownDeviceName || nativeConnectedDevice?.name;
  const effectiveConnectionTransport = demoMode ? "bluetooth" : connectionTransport;
  const effectiveNativeWindowsConnected = demoMode || nativeWindowsConnectionIsLive;

  if (!userProfile) {
    return (
      <PhoneFrame>
        <LoginScreen
          language={language}
          onLogin={handleLogin}
          onToggleLanguage={() => setLanguage((current) => (current === "en" ? "ta" : "en"))}
        />
      </PhoneFrame>
    );
  }

  if (profileOpen) {
    return (
      <PhoneFrame>
        <Suspense fallback={<ScreenLoading />}>
          <ProfileScreen
            language={language}
            userProfile={userProfile}
            onProfileChange={handleProfileChange}
            onBack={() => setProfileOpen(false)}
            onLogout={handleLogout}
            fontSize={fontSize}
            onFontSizeChange={setFontSize}
            remindersEnabled={remindersEnabled}
            onRemindersEnabledChange={setRemindersEnabled}
            soundAlerts={soundAlerts}
            onSoundAlertsChange={setSoundAlerts}
            voiceGuidance={voiceGuidance}
            onVoiceGuidanceChange={handleVoiceGuidanceChange}
            onTestVoice={handleTestVoice}
            demoMode={demoMode}
          />
        </Suspense>
      </PhoneFrame>
    );
  }

  return (
    <PhoneFrame>
      <Suspense fallback={<ScreenLoading />}>
        <div
          className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
          onTouchStart={handleSwipeStart}
          onTouchMove={handleSwipeMove}
          onTouchEnd={handleSwipeEnd}
        >
          {screen === "home" && (
            <HomeScreen
              username={userProfile.fullName}
              language={language}
              theme={theme}
              medicineSchedules={effectiveSchedules}
              doseTrackingRecords={effectiveDoseTrackingRecords}
              smartReminder={effectiveUpcomingSmartReminder}
              onToggleTheme={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
              onToggleLanguage={() => setLanguage((current) => (current === "en" ? "ta" : "en"))}
              onLogout={handleLogout}
              onTriggerReminder={() => setReminderOpen(true)}
              onOpenProfile={() => setProfileOpen(true)}
              pillBoxConnected={effectivePillBoxConnected}
              pillBoxBusy={effectivePillBoxBusy}
              demoMode={demoMode}
              onTogglePillBox={
                demoMode
                  ? () =>
                      toast.info("Demo connection is simulated", {
                        description: "Turn off Demo mode to use real Bluetooth.",
                      })
                  : handlePillBoxToggle
              }
              onToggleDemoMode={handleDemoModeToggle}
              onMarkSmartReminderTaken={handleMarkUpcomingSmartReminderTaken}
              onTrackDose={
                demoMode
                  ? () =>
                      toast.info("Demo dashboard is pre-filled", {
                        description: "Turn off Demo mode to record real dose history.",
                      })
                  : handleTrackDose
              }
            />
          )}
          {screen === "notifications" && (
            <NotificationsScreen
              language={language}
              demoMode={demoMode}
              notifications={effectiveNotifications}
            />
          )}
          {screen === "bluetooth" && (
            <BluetoothScreen
              language={language}
              pillBoxConnected={effectivePillBoxConnected}
              pillBoxBusy={effectivePillBoxBusy}
              deviceName={resolvedDeviceName}
              connectionTransport={effectiveConnectionTransport}
              systemDeviceReady={demoMode || systemDeviceReady}
              nativeWindowsKnown={demoMode || Boolean(nativeConnectedDevice)}
              nativeWindowsConnected={effectiveNativeWindowsConnected}
              nativeBluetoothSnapshot={effectiveNativeBluetoothSnapshot}
              medicineSchedules={effectiveSchedules}
              savedBluetoothDevices={savedBluetoothDevices}
              savedWindowsDeviceCount={savedSerialPorts.length}
              canUseWindowsSerial={!demoMode && isWindows && supportsSerial}
              canScanBluetooth={!demoMode && supportsBluetooth && !shouldPreferSerialConnection}
              demoMode={demoMode}
              onTogglePillBox={
                demoMode
                  ? () =>
                      toast.info("Demo connection is simulated", {
                        description: "Turn off Demo mode to use real Bluetooth.",
                      })
                  : handlePillBoxToggle
              }
              canReconnectSavedBluetooth={canReconnectSavedBluetooth}
              onReconnectSavedBluetooth={handleReconnectSavedBluetooth}
              onConnectSavedWindowsDevice={handleConnectSavedWindowsDevice}
              onOpenSystemBluetooth={handleOpenSystemBluetooth}
            />
          )}
          {screen === "settings" && (
            <SettingsScreen 
              language={language}
              pillBoxConnected={effectivePillBoxConnected}
              systemDeviceReady={demoMode || systemDeviceReady}
              nativeWindowsKnown={demoMode || Boolean(nativeConnectedDevice)}
              connectionTransport={effectiveConnectionTransport}
              deviceName={resolvedDeviceName}
              nativeWindowsConnected={effectiveNativeWindowsConnected}
              schedules={effectiveSchedules}
              onSchedulesChange={setMedicineSchedules}
              snoozeMinutes={snoozeMinutes}
              onSnoozeMinutesChange={setSnoozeMinutes}
              smartSchedules={effectiveSmartSchedules}
              onCreateSmartSchedule={addSmartSchedule}
              onUpdateSmartScheduleDayStatus={updateSmartScheduleDayStatus}
              onRemoveSmartSchedule={removeSmartSchedule}
              demoMode={demoMode}
            />
          )}

        <ReminderAlert
          language={language}
          smartReminder={medicineReminder ? null : upcomingSmartReminder}
          medicineReminder={medicineReminder}
          open={reminderOpen}
          soundEnabled={soundAlerts}
          onTaken={() => markCurrentReminderTaken("app")}
          onSnooze={() => {
            const snoozedMedicineReminder = medicineReminder;
            setReminderOpen(false);
            setMedicineReminder(null);
            activeMedicineReminderKeyRef.current = null;
            toast(
              language === "ta"
                ? `${snoozeMinutes} நிமிடங்களுக்கு ஒத்திவைக்கப்பட்டது`
                : `Snoozed for ${snoozeMinutes} minute${snoozeMinutes === 1 ? "" : "s"}`
            );
            recordNotification({
              type: "reminder",
              title: "Reminder snoozed",
              message: `Reminder snoozed for ${snoozeMinutes} minute${snoozeMinutes === 1 ? "" : "s"}.`,
            });
            speak(copy.voiceSnoozed(snoozeMinutes), {
              fallbackMessage: `Reminder snoozed for ${snoozeMinutes} minute${snoozeMinutes === 1 ? "" : "s"}.`,
            });
            if (snoozedMedicineReminder) {
              window.setTimeout(() => {
                setMedicineReminder(snoozedMedicineReminder);
                setReminderOpen(true);
              }, snoozeMinutes * 60 * 1000);
            }
          }}
        />
        </div>
      </Suspense>
      <BottomNav active={screen} onChange={setScreen} language={language} />
    </PhoneFrame>
  );
};

export default Index;
