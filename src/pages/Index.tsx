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
  loadActiveUserProfile,
} from "@/lib/userProfile";
import {
  addAppNotification,
  AppNotification,
  loadAppNotifications,
  saveAppNotifications,
} from "@/lib/appNotifications";
import { toast } from "sonner";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { TextToSpeech } from "@capacitor-community/text-to-speech";

interface RingtonePickerPlugin {
  pickRingtone(options?: { existingUri?: string }): Promise<{ uri: string; title: string }>;
  playRingtone(options: { uri: string }): Promise<void>;
  stopRingtone(): Promise<void>;
  maximizeMediaVolume(): Promise<void>;
  openTtsSettings(): Promise<void>;
}

const RingtonePicker = registerPlugin<RingtonePickerPlugin>("RingtonePicker");

const HomeScreen = lazy(() => import("@/components/screens/HomeScreen"));
const NotificationsScreen = lazy(() => import("@/components/screens/NotificationsScreen"));
const SettingsScreen = lazy(() => import("@/components/screens/SettingsScreen"));
const ProfileScreen = lazy(() => import("@/components/screens/ProfileScreen"));

type FontSizePreference = "small" | "medium" | "large";
export type DoseTrackingStatus = "taken" | "missed";
export interface DoseTrackingRecord {
  scheduleId: string;
  dateKey: string;
  status: DoseTrackingStatus;
  updatedAt: string;
}

const SWIPEABLE_SCREENS: Screen[] = ["home", "notifications", "settings", "profile"];
const SWIPE_THRESHOLD_PX = 70;
const SWIPE_MAX_VERTICAL_DRIFT_PX = 90;
const MEDICINE_SCHEDULES_STORAGE_KEY = "gentle-dose-medicine-schedules-v1";
const SNOOZE_MINUTES_STORAGE_KEY = "gentle-dose-snooze-minutes";
const DOSE_TRACKING_STORAGE_KEY = "gentle-dose-dose-tracking-v1";
const VOICE_GUIDANCE_STORAGE_KEY = "gentle-dose-voice-guidance";
const REMINDERS_ENABLED_STORAGE_KEY = "gentle-dose-reminders-enabled";
const SOUND_ALERTS_STORAGE_KEY = "gentle-dose-sound-alerts";

const getNotificationId = (strId: string): number => {
  let hash = 0;
  for (let i = 0; i < strId.length; i++) {
    hash = strId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash | 0) % 2000000000;
};

const HEALTH_SUGGESTIONS_EN = [
  "Take your medicine with a full glass of water.",
  "Consistency is key! Try to take it at the same time every day.",
  "Check if this medicine should be taken before or after meals.",
  "Stay hydrated today! Drink plenty of water.",
  "A quick walk after your meal can help with digestion.",
  "Keep your medicines stored in a cool, dry place.",
  "If you feel dizzy, rest for a few minutes after taking your medicine.",
  "Remember: your health is your greatest wealth!"
];

const HEALTH_SUGGESTIONS_TA = [
  "உங்கள் மருந்தை ஒரு முழு கிளாஸ் தண்ணீருடன் எடுத்துக் கொள்ளுங்கள்.",
  "ஒரே நேரத்தில் மருந்து உட்கொள்வது சிறந்த பலனைத் தரும்.",
  "இந்த மருந்தை உணவுக்கு முன் அல்லது பின் எடுக்க வேண்டுமா என்று சரிபார்க்கவும்.",
  "இன்று உடலை நீரேற்றமாக வைத்திருங்கள்! நிறைய தண்ணீர் குடிக்கவும்.",
  "உணவுக்குப் பிறகு ஒரு சிறிய நடைப்பயிற்சி செரிமானத்திற்கு உதவும்.",
  "மருந்துகளை குளிர்ந்த, உலர்ந்த இடத்தில் சேமித்து வைக்கவும்.",
  "மயக்கமாக உணர்ந்தால், மருந்து எடுத்த பின் சில நிமிடங்கள் ஓய்வெடுங்கள்.",
  "உடல் நலமே சிறந்த செல்வம் என்பதை நினைவில் வையுங்கள்!"
];

const isAndroidWebViewRuntime = () =>
  typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);



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

export const checkIsVoiceMale = (name: string, voiceURI: string): boolean => {
  const text = `${name} | ${voiceURI}`.toLowerCase();
  const match = voiceURI.match(/-x-([a-z0-9]+)/);
  const variant = match ? match[1] : "";

  if (variant) {
    if (
      variant.endsWith("b") ||
      variant.endsWith("d") ||
      variant.endsWith("i") ||
      variant.endsWith("j") ||
      variant.endsWith("m") ||
      variant.endsWith("o") ||
      variant.includes("guy") ||
      variant.includes("man")
    ) {
      return true;
    }
    if (
      variant.endsWith("a") ||
      variant.endsWith("c") ||
      variant.endsWith("e") ||
      variant.endsWith("f") ||
      variant.endsWith("g") ||
      variant.endsWith("h") ||
      variant.endsWith("k") ||
      variant.endsWith("l") ||
      variant.endsWith("n") ||
      variant.includes("girl") ||
      variant.includes("woman")
    ) {
      return false;
    }
  }

  if (
    text.includes("#male") ||
    text.includes("david") ||
    text.includes("guy") ||
    text.includes("ian") ||
    text.includes("colin")
  ) {
    return true;
  }

  if (text.includes("male") && !text.includes("female")) {
    return true;
  }

  if (text.includes("man") && !text.includes("woman")) {
    return true;
  }

  return false;
};

const Index = () => {
  const [screen, setScreen] = useState<Screen>("home");
  const [reminderOpen, setReminderOpen] = useState(false);
  const [medicineSchedules, setMedicineSchedules] = useState<Schedule[]>(loadMedicineSchedules);
  const [medicineReminder, setMedicineReminder] = useState<MedicineTimeReminder | null>(null);
  const [doseTrackingRecords, setDoseTrackingRecords] = useState<DoseTrackingRecord[]>(loadDoseTrackingRecords);
  const [snoozeMinutes, setSnoozeMinutes] = useState(loadSnoozeMinutes);
  const activeMedicineReminderKeyRef = useRef<string | null>(null);
  const triggeredMedicineReminderKeysRef = useRef<Set<string>>(new Set());
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    const active = loadActiveUserProfile();
    if (active) return active;

    const defaultProfile = {
      fullName: "Navneeth",
      age: "68",
      patientId: "MM-1988",
      password: "1234"
    };

    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem("gentle-dose-active-profile-v1", JSON.stringify(defaultProfile));
        window.localStorage.setItem("gentle-dose-user-profiles-v1", JSON.stringify([defaultProfile]));
      } catch (e) {
        console.error("Failed to save default profile", e);
      }
    }
    return defaultProfile;
  });
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
  const [voiceGender, setVoiceGender] = useState<"female" | "male">(() => {
    if (typeof window === "undefined") return "female";
    return (window.localStorage.getItem("gentle-dose-voice-gender") as "female" | "male") || "male";
  });
  const [remindersEnabled, setRemindersEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(REMINDERS_ENABLED_STORAGE_KEY) !== "off";
  });
  const [soundAlerts, setSoundAlerts] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(SOUND_ALERTS_STORAGE_KEY) !== "off";
  });
  const [ringtoneUri, setRingtoneUri] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("gentle-dose-ringtone-uri") || "";
  });
  const [ringtoneTitle, setRingtoneTitle] = useState(() => {
    if (typeof window === "undefined") return "Default ringtone";
    return window.localStorage.getItem("gentle-dose-ringtone-title") || "Default ringtone";
  });
  const [notificationEvents, setNotificationEvents] = useState<AppNotification[]>(() =>
    typeof window === "undefined" ? [] : loadAppNotifications()
  );
  const [language, setLanguage] = useState<AppLanguage>(() => {
    if (typeof window === "undefined") return "en";
    return window.localStorage.getItem("gentle-dose-language") === "ta" ? "ta" : "en";
  });

  const medicineSchedulesRef = useRef(medicineSchedules);
  const snoozeMinutesRef = useRef(snoozeMinutes);
  const languageRef = useRef(language);
  const remindersEnabledRef = useRef(remindersEnabled);

  useEffect(() => { medicineSchedulesRef.current = medicineSchedules; }, [medicineSchedules]);
  useEffect(() => { snoozeMinutesRef.current = snoozeMinutes; }, [snoozeMinutes]);
  useEffect(() => { languageRef.current = language; }, [language]);
  useEffect(() => { remindersEnabledRef.current = remindersEnabled; }, [remindersEnabled]);

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
    window.localStorage.setItem("gentle-dose-voice-gender", voiceGender);
  }, [voiceGender]);

  useEffect(() => {
    window.localStorage.setItem(REMINDERS_ENABLED_STORAGE_KEY, remindersEnabled ? "on" : "off");
  }, [remindersEnabled]);

  useEffect(() => {
    window.localStorage.setItem(SOUND_ALERTS_STORAGE_KEY, soundAlerts ? "on" : "off");
  }, [soundAlerts]);

  useEffect(() => {
    window.localStorage.setItem("gentle-dose-ringtone-uri", ringtoneUri);
  }, [ringtoneUri]);

  useEffect(() => {
    window.localStorage.setItem("gentle-dose-ringtone-title", ringtoneTitle);
  }, [ringtoneTitle]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const registerActions = async () => {
      try {
        await LocalNotifications.registerActionTypes({
          types: [
            {
              id: 'MEDICINE_ACTIONS',
              actions: [
                {
                  id: 'take',
                  title: language === 'ta' ? 'எடுத்துக்கொண்டேன்' : 'Mark as Taken',
                  foreground: true
                },
                {
                  id: 'snooze',
                  title: language === 'ta' ? 'ஒத்திவை' : 'Snooze',
                  foreground: true
                }
              ]
            }
          ]
        });
        console.log("Successfully registered notification action types");
      } catch (err) {
        console.error("Failed to register notification action types:", err);
      }
    };

    registerActions();
  }, [language]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let listenerHandle: any;
    LocalNotifications.addListener(
      'localNotificationActionPerformed',
      async (notificationAction) => {
        const actionId = notificationAction.actionId;
        const notification = notificationAction.notification;
        console.log("Local notification action received:", actionId, notification);

        const extra = notification.extra;
        if (!extra || !extra.scheduleId) return;

        const scheduleId = extra.scheduleId;
        const medicineName = extra.medicineName;
        const dosage = extra.dosage;
        const time = extra.time;

        if (actionId === 'take') {
          handleTrackDose(scheduleId, 'taken');
          
          toast.success(
            languageRef.current === 'ta' ? 'மருந்து உட்கொண்டதாகக் குறிக்கப்பட்டது' : 'Marked as taken',
            { description: languageRef.current === 'ta' ? 'அறிவிப்பிலிருந்து உறுதி செய்யப்பட்டது' : 'Confirmed from notification action.' }
          );
          speak(
            languageRef.current === 'ta' ? 'மருந்து உட்கொண்டதாகக் குறிக்கப்பட்டது.' : 'Medicine marked as taken.',
            { force: true }
          );
        } else if (actionId === 'snooze') {
          const currentSnoozeMinutes = snoozeMinutesRef.current;
          const currentLanguage = languageRef.current;
          
          const snoozeKey = `snooze:${scheduleId}`;
          const snoozeTime = new Date(Date.now() + currentSnoozeMinutes * 60 * 1000);
          window.localStorage.setItem(snoozeKey, snoozeTime.toISOString());

          const hashId = getNotificationId(scheduleId) + 9999;
          
          await LocalNotifications.schedule({
            notifications: [
              {
                id: hashId,
                title: currentLanguage === 'ta' ? 'ஒத்திவைக்கப்பட்ட நினைவூட்டல்' : 'Snoozed Reminder',
                body: currentLanguage === 'ta'
                  ? `மீண்டும் நினைவூட்டல்: ${medicineName} (${dosage})`
                  : `Snoozed reminder: ${medicineName} (${dosage})`,
                channelId: 'medicine-reminders',
                actionTypeId: 'MEDICINE_ACTIONS',
                extra: {
                  scheduleId,
                  medicineName,
                  dosage,
                  time
                },
                schedule: {
                  at: snoozeTime,
                  allowWhileIdle: true
                }
              }
            ]
          });

          toast(
            currentLanguage === 'ta'
              ? `${currentSnoozeMinutes} நிமிடங்களுக்கு ஒத்திவைக்கப்பட்டுள்ளது`
              : `Snoozed for ${currentSnoozeMinutes} minute${currentSnoozeMinutes === 1 ? '' : 's'}`
          );
          
          speak(
            currentLanguage === 'ta'
              ? `நினைவூட்டல் ${currentSnoozeMinutes} நிமிடங்களுக்கு ஒத்திவைக்கப்பட்டுள்ளது.`
              : `Reminder snoozed for ${currentSnoozeMinutes} minutes.`,
            { force: true }
          );
        }
      }
    ).then((handle) => {
      listenerHandle = handle;
    });

    return () => {
      if (listenerHandle) {
        listenerHandle.remove();
      }
    };
  }, []);

  const rescheduleLocalNotifications = useCallback(async (schedules: Schedule[], enabled: boolean) => {
    if (!Capacitor.isNativePlatform()) return;

    try {
      const pending = await LocalNotifications.getPending();
      if (pending && pending.notifications.length > 0) {
        await LocalNotifications.cancel({
          notifications: pending.notifications.map((n) => ({ id: n.id }))
        });
      }

      if (!enabled) return;

      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== "granted") {
        const req = await LocalNotifications.requestPermissions();
        if (req.display !== "granted") {
          console.warn("Local notification permission not granted");
          return;
        }
      }

      await LocalNotifications.createChannel({
        id: 'medicine-reminders',
        name: 'Medicine Reminders',
        description: 'Notifications for medicine intake schedules',
        importance: 5,
        visibility: 1,
        vibration: true,
      });

      const notificationsToSchedule = [];
      for (const schedule of schedules) {
        if (!schedule.enabled) continue;

        const timeMinutes = scheduleTimeToMinutes(schedule.time);
        if (timeMinutes === null) continue;

        const hour = Math.floor(timeMinutes / 60);
        const minute = timeMinutes % 60;

        const [medicineName, ...dosageParts] = schedule.name.split(/\s+-\s+/);
        const dosage = dosageParts.join(" - ").trim() || "Scheduled medicine";

        const suggestions = language === "ta" ? HEALTH_SUGGESTIONS_TA : HEALTH_SUGGESTIONS_EN;
        const randomSuggestion = suggestions[Math.floor(Math.random() * suggestions.length)];
        
        const baseBody = language === "ta"
          ? `${medicineName} எடுத்துக்கொள்ள வேண்டிய நேரம். (${dosage} - ${schedule.time})`
          : `It is time to take ${medicineName}. (${dosage} - ${schedule.time})`;

        const fullBody = `${baseBody}\n💡 ${randomSuggestion}`;

        notificationsToSchedule.push({
          id: getNotificationId(schedule.id),
          title: language === "ta" ? "மருந்து நினைவூட்டல்" : "Medicine Reminder",
          body: fullBody,
          channelId: 'medicine-reminders',
          actionTypeId: 'MEDICINE_ACTIONS',
          extra: {
            scheduleId: schedule.id,
            medicineName,
            dosage,
            time: schedule.time
          },
          schedule: {
            on: {
              hour,
              minute
            },
            repeats: true,
            allowWhileIdle: true
          }
        });
      }

      if (notificationsToSchedule.length > 0) {
        await LocalNotifications.schedule({
          notifications: notificationsToSchedule
        });
        console.log(`Successfully scheduled ${notificationsToSchedule.length} local notifications with action buttons`);
      }
    } catch (err) {
      console.error("Failed to reschedule local notifications:", err);
    }
  }, [language]);

  useEffect(() => {
    rescheduleLocalNotifications(medicineSchedules, remindersEnabled);
  }, [medicineSchedules, remindersEnabled, rescheduleLocalNotifications]);

  const handleSelectRingtone = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) {
      toast.info(language === "ta" ? "ரிங்டோன் தேர்வு மொபைலில் மட்டுமே கிடைக்கும்" : "Ringtone picker is only available on mobile devices");
      return;
    }
    try {
      const result = await RingtonePicker.pickRingtone({ existingUri: ringtoneUri });
      if (result && result.uri !== undefined) {
        setRingtoneUri(result.uri);
        setRingtoneTitle(result.title || "Default Sound");
        toast.success(language === "ta" ? "ரிங்டோன் புதுப்பிக்கப்பட்டது" : "Alarm sound updated", {
          description: result.title || "Default Sound"
        });
      }
    } catch (err) {
      console.error("Failed to pick ringtone:", err);
    }
  }, [ringtoneUri, language]);

  const handleTestNotification = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) {
      toast.info(language === "ta" ? "அறிவிப்பு சோதனை மொபைலில் மட்டுமே கிடைக்கும்" : "Notification test is only available on mobile devices");
      return;
    }

    try {
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== "granted") {
        const req = await LocalNotifications.requestPermissions();
        if (req.display !== "granted") {
          toast.error(language === "ta" ? "அறிவிப்பு அனுமதி மறுக்கப்பட்டது" : "Notification permission denied");
          return;
        }
      }

      const suggestions = language === "ta" ? HEALTH_SUGGESTIONS_TA : HEALTH_SUGGESTIONS_EN;
      const randomSuggestion = suggestions[Math.floor(Math.random() * suggestions.length)];
      
      const title = language === "ta" ? "சோதனை நினைவூட்டல்" : "Test Medicine Reminder";
      const baseBody = language === "ta"
        ? "மருந்து எடுப்பதற்கான சோதனை அறிவிப்பு. (இருப்பு - 1 மாத்திரை)"
        : "This is a test notification for your medicine reminder. (1 tablet)";
      const fullBody = `${baseBody}\n💡 ${randomSuggestion}`;

      await LocalNotifications.schedule({
        notifications: [
          {
            id: 99999,
            title: title,
            body: fullBody,
            channelId: 'medicine-reminders',
            actionTypeId: 'MEDICINE_ACTIONS',
            extra: {
              scheduleId: 's1',
              medicineName: language === "ta" ? "மெட்ஃபார்மின்" : "Metformin",
              dosage: "500 mg",
              time: "9:30 AM"
            },
            schedule: {
              at: new Date(Date.now() + 1000),
              allowWhileIdle: true
            }
          }
        ]
      });

      toast.success(language === "ta" ? "சோதனை அறிவிப்பு அனுப்பப்பட்டது!" : "Test notification sent!");
    } catch (err) {
      console.error("Failed to send test notification:", err);
      toast.error(language === "ta" ? "அறிவிப்பு அனுப்ப முடியவில்லை" : "Failed to send test notification");
    }
  }, [language]);



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

      // 1. Check if already taken today
      const alreadyTaken = doseTrackingRecords.some(
        (record) => record.scheduleId === dueSchedule.id && record.dateKey === todayKey && record.status === "taken"
      );
      if (alreadyTaken) return;

      // 2. Check if currently snoozed
      const snoozeKey = `snooze:${dueSchedule.id}`;
      const snoozedUntilStr = window.localStorage.getItem(snoozeKey);
      if (snoozedUntilStr) {
        try {
          const snoozedUntil = new Date(snoozedUntilStr);
          if (now < snoozedUntil) {
            return; // Still snoozed, skip
          }
        } catch (e) {
          console.error("Failed to parse snooze date:", e);
        }
      }

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
    const intervalId = window.setInterval(checkMedicineScheduleReminders, 1000);
    return () => window.clearInterval(intervalId);
  }, [medicineSchedules, reminderOpen, remindersEnabled, userProfile, doseTrackingRecords]);

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
  const copy =
    language === "ta"
      ? {
          signedOut: "வெளியேறிவிட்டீர்கள்",
          markedTaken: "மருந்து உட்கொண்டதாகக் குறிக்கப்பட்டது",
          schedulePraise: "மிகவும் நன்று! மாத்திரைகளைத் சரியான நேரத்திற்கு உட்கொள்கிறீர்கள்.",
          snoozedTen: "10 நிமிடங்களுக்கு ஒத்திவைக்கப்பட்டுள்ளது",
          voiceReminder: (name: string, time: string) =>
            `${name} மாத்திரை உட்கொள்ளும் நேரம்: ${time}.`,
          voiceTaken: "மருந்து உட்கொண்டதாகக் குறிக்கப்பட்டது.",
          voiceTakenHardware: "மருந்துப் பெட்டி பொத்தான் மூலம் மருந்து உட்கொண்டது உறுதி செய்யப்பட்டது.",
          voiceSnoozed: (minutes: number) => `நினைவூட்டல் ${minutes} நிமிடங்களுக்கு ஒத்திவைக்கப்பட்டுள்ளது.`,
        }
      : {
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
      gain.gain.exponentialRampToValueAtTime(0.98, now + 0.02);
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

  const speakOnlineFallback = useCallback((text: string, lang: string) => {
    try {
      console.log(`[TTS Debug] Attempting online translation TTS fallback for text: "${text}"`);
      const tl = lang.split("-")[0];
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${tl}&client=tw-ob&q=${encodeURIComponent(text)}`;
      const audio = new Audio(url);
      audio.volume = 1.0;
      audio.play().then(() => {
        console.log("[TTS Debug] Online translation TTS playback started successfully.");
      }).catch((playErr) => {
        console.error("[TTS Debug] Online translation TTS audio play failed:", playErr);
      });
    } catch (e) {
      console.error("[TTS Debug] Online translation TTS creation failed:", e);
    }
  }, []);

  const speakWeb = useCallback(
    (spokenMessage: string, targetLang: string, options: { fallbackMessage?: string } = {}) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      const synth = window.speechSynthesis;

      const speakWithAvailableVoices = (voices: SpeechSynthesisVoice[]) => {
        // Filter voices by language
        let langVoices = voices.filter((voice) =>
          voice.lang.toLowerCase().startsWith(language === "ta" ? "ta" : "en")
        );
        if (langVoices.length === 0) {
          langVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith("en"));
        }

        // Filter out stubs if concrete voices exist
        const concreteVoices = langVoices.filter((voice) => {
          const uri = (voice.voiceURI || "").toLowerCase();
          return uri.includes("-x-") || uri.includes("-local") || uri.includes("-network");
        });
        const candidates = concreteVoices.length > 0 ? concreteVoices : langVoices;

        // Filter by gender keyword (checking both name and voiceURI)
        const isMale = voiceGender === "male";
        let genderVoices = candidates.filter((voice) => {
          const name = voice.name || "";
          const uri = voice.voiceURI || "";
          return checkIsVoiceMale(name, uri) === isMale;
        });

        const voiceList = genderVoices.length > 0 ? genderVoices : candidates;
        const matchingVoice =
          voiceList.find((v) => v.name.toLowerCase().includes("natural") || v.name.toLowerCase().includes("google") || v.voiceURI.toLowerCase().includes("natural")) ||
          voiceList[0];

        const targetLangCode = language === "ta" ? "ta-IN" : "en-US";
        const shouldUseEnglishFallback = language !== "ta" && !matchingVoice && options.fallbackMessage;
        const finalMessage = shouldUseEnglishFallback ? options.fallbackMessage || spokenMessage : spokenMessage;

        synth.cancel();
        synth.resume();

        const utterance = new SpeechSynthesisUtterance(finalMessage);
        utterance.lang = matchingVoice?.lang || targetLangCode;
        utterance.rate = language === "ta" ? 0.82 : 0.9;
        utterance.pitch = 1;
        utterance.volume = 1;
        if (matchingVoice) utterance.voice = matchingVoice;

        // 50ms delay between cancel and speak resolves silent audio glitches on Android
        window.setTimeout(() => {
          synth.speak(utterance);
        }, 50);

        window.setTimeout(() => synth.resume(), 120);
        window.setTimeout(() => synth.resume(), 280);
      };

      const voices = synth.getVoices();
      if (voices.length > 0) {
        speakWithAvailableVoices(voices);
        return;
      }

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
    [language, voiceGender]
  );

  const speak = useCallback(
    (message: string, options: { force?: boolean; fallbackMessage?: string; cue?: boolean } = {}) => {
      if (!voiceGuidance && !options.force) return;

      if (options.cue !== false) {
        playVoiceCue();
      }

      const targetLang = language === "ta" ? "ta-IN" : "en-US";
      const spokenMessage = (language !== "ta" && options.fallbackMessage) ? options.fallbackMessage : message;

      if (Capacitor.isNativePlatform()) {
        RingtonePicker.maximizeMediaVolume()
          .catch((err) => console.warn("Failed to maximize media volume:", err))
          .finally(async () => {
            let selectedVoiceIndex: number | undefined = undefined;
            let finalTargetLang = targetLang;
            let hasTamilVoice = false;

            try {
              const { voices } = await TextToSpeech.getSupportedVoices();
              console.log("[TTS Debug] Available native voices count:", voices ? voices.length : 0);
              if (voices && voices.length > 0) {
                voices.forEach((v, idx) => {
                  console.log(`[TTS Debug] Voice [${idx}]: name="${v.name}" lang="${v.lang}" voiceURI="${v.voiceURI}"`);
                });

                // Check if any Tamil voices exist
                const tamilVoices = voices.map((v, idx) => ({ voice: v, index: idx }))
                  .filter(({ voice }) => {
                    const l = voice.lang.toLowerCase();
                    const uri = (voice.voiceURI || "").toLowerCase();
                    const name = (voice.name || "").toLowerCase();
                    return l.startsWith("ta") || l.startsWith("tam") || uri.includes("tamil") || name.includes("tamil");
                  });

                if (tamilVoices.length > 0) {
                  hasTamilVoice = true;
                  console.log("[TTS Debug] Found native Tamil voices:", tamilVoices.length);
                }

                // Select matching voice based on current language
                const isTamil = language === "ta";
                let matchedVoices = isTamil ? tamilVoices : voices.map((v, idx) => ({ voice: v, index: idx }))
                  .filter(({ voice }) => {
                    const l = voice.lang.toLowerCase();
                    return l === "en-us" || l === "en_us";
                  });

                // Fallback to general English if no exact en-US voices are found
                if (!isTamil && matchedVoices.length === 0) {
                  matchedVoices = voices.map((v, idx) => ({ voice: v, index: idx }))
                    .filter(({ voice }) => {
                      const l = voice.lang.toLowerCase();
                      const uri = (voice.voiceURI || "").toLowerCase();
                      const name = (voice.name || "").toLowerCase();
                      return l.startsWith("en") || l.startsWith("eng") || uri.includes("english") || name.includes("english");
                    });
                }

                // Fallback to English if Tamil was requested but no Tamil voices were found
                if (isTamil && matchedVoices.length === 0) {
                  console.log("[TTS Debug] Tamil requested but no Tamil voices found. Falling back to English list.");
                  matchedVoices = voices.map((v, idx) => ({ voice: v, index: idx }))
                    .filter(({ voice }) => {
                      const l = voice.lang.toLowerCase();
                      const uri = (voice.voiceURI || "").toLowerCase();
                      const name = (voice.name || "").toLowerCase();
                      return l.startsWith("en") || l.startsWith("eng") || uri.includes("english") || name.includes("english");
                    });
                }

                // Filter out stubs if concrete voices exist
                const concreteVoices = matchedVoices.filter(({ voice }) => {
                  const uri = (voice.voiceURI || "").toLowerCase();
                  return uri.includes("-x-") || uri.includes("-local") || uri.includes("-network");
                });
                const candidates = concreteVoices.length > 0 ? concreteVoices : matchedVoices;

                if (candidates.length > 0) {
                  // Filter by gender keyword (checking both name and voiceURI)
                  const isMale = voiceGender === "male";
                  console.log(`[TTS Debug] Filtering matched voices for gender: ${voiceGender}`);
                  const genderMatched = candidates.filter(({ voice }) => {
                    const name = voice.name || "";
                    const uri = voice.voiceURI || "";
                    return checkIsVoiceMale(name, uri) === isMale;
                  });

                  const bestMatch = genderMatched.length > 0 ? genderMatched[0] : candidates[0];
                  selectedVoiceIndex = bestMatch.index;
                  finalTargetLang = bestMatch.voice.lang;
                  console.log(`[TTS Debug] Selected Voice Index: ${selectedVoiceIndex}, Name: "${bestMatch.voice.name}", Lang: "${bestMatch.voice.lang}", URI: "${bestMatch.voice.voiceURI}"`);
                } else {
                  console.log("[TTS Debug] No matching language voices found in voice list.");
                }
              } else {
                console.log("[TTS Debug] getSupportedVoices() returned empty or null array.");
              }
            } catch (err) {
              console.warn("[TTS Debug] Failed to query supported voices:", err);
            }

            if (language === "ta" && !hasTamilVoice) {
              try {
                const result = await TextToSpeech.getSupportedLanguages();
                console.log("[TTS Debug] Native Supported Languages list:", result.languages);
                const isTamilSupported = result.languages.some((lang) =>
                  lang.toLowerCase().startsWith("ta") || lang.toLowerCase().startsWith("tam")
                );

                if (!isTamilSupported) {
                  toast.error(
                    "தமிழ் குரல் நிறுவப்படவில்லை. அதை அமைக்க அமைப்புகள் திறக்கப்படும்.",
                    {
                      duration: 6000,
                      action: {
                        label: "அமைப்புகள்",
                        onClick: () => {
                          RingtonePicker.openTtsSettings();
                        }
                      }
                    }
                  );
                  
                  const englishMessage = options.fallbackMessage || "Tamil language voice data is not installed on your system. Please open Text-to-Speech settings to download it.";
                  TextToSpeech.speak({
                    text: englishMessage,
                    lang: "en-US",
                    rate: 0.9,
                    pitch: 1.0,
                    volume: 1.0,
                    category: "ambient",
                  }).catch((e) => console.error("Fallback English speech failed:", e));
                  return;
                }
              } catch (err) {
                console.warn("[TTS Debug] Failed to check supported languages:", err);
              }
            }

            const speakOptions: any = {
              text: spokenMessage,
              lang: finalTargetLang,
              rate: language === "ta" ? 0.82 : 0.9, // Aligning Tamil rate (0.82) with speakWeb
              pitch: 1.0,
              volume: 1.0,
              category: "ambient",
            };
            if (selectedVoiceIndex !== undefined) {
              speakOptions.voice = selectedVoiceIndex;
            }

            console.log(`[TTS Debug] TextToSpeech.speak options: text="${speakOptions.text}" lang="${speakOptions.lang}" voice=${speakOptions.voice}`);
            TextToSpeech.speak(speakOptions).catch((err) => {
              console.error("[TTS Debug] Native TextToSpeech failed:", err);
              if (language === "ta") {
                // Play via online translation TTS stream
                speakOnlineFallback(spokenMessage, targetLang);
                
                // Show a warning toast advising the user to download Tamil voice data
                toast.error(
                  "தமிழ் குரல் தரவு நிறுவப்படவில்லை. அதை அமைக்க அமைப்புகள் திறக்கப்படும்.",
                  {
                    duration: 8000,
                    action: {
                      label: "அமைப்புகள்",
                      onClick: () => {
                        RingtonePicker.openTtsSettings();
                      }
                    }
                  }
                );
              } else {
                speakWeb(spokenMessage, targetLang, options);
              }
            });
          });
      } else {
        speakWeb(spokenMessage, targetLang, options);
      }
    },
    [language, playVoiceCue, voiceGuidance, speakWeb, voiceGender, speakOnlineFallback]
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

  const isFirstVoiceGenderRender = useRef(true);
  useEffect(() => {
    if (isFirstVoiceGenderRender.current) {
      isFirstVoiceGenderRender.current = false;
      return;
    }

    const previewMessage = language === "ta"
      ? (voiceGender === "female"
          ? "குரல் பாத்திரம் அமைதி பெண் என மாற்றப்பட்டது."
          : "குரல் பாத்திரம் அமைதி ஆண் என மாற்றப்பட்டது.")
      : (voiceGender === "female"
          ? "Vocal persona set to Serene female."
          : "Vocal persona set to Calm male.");

    speak(previewMessage, { force: true });
  }, [voiceGender, language, speak]);

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

  // Software TalkBack: Announce screen navigation on transitions
  useEffect(() => {
    if (!voiceGuidance) return;

    let message = "";
    if (!userProfile) {
      message = language === "ta" ? "உள்நுழைவு திரை" : "Login screen";
    } else {
      const screenNames: Record<Screen, string> = {
        home: language === "ta" ? "முகப்பு திரை" : "Home screen",
        notifications: language === "ta" ? "அறிவிப்புகள் திரை" : "Notifications screen",
        settings: language === "ta" ? "அமைப்புகள் திரை" : "Settings screen",
        profile: language === "ta" ? "சுயவிவர திரை" : "Profile screen",
      };
      message = screenNames[screen] || "";
    }

    if (message) {
      speak(message, { cue: false });
    }
  }, [screen, userProfile, language, speak, voiceGuidance]);

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
    if (reminderOpen) {
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
              medicineSchedules={medicineSchedules}
              doseTrackingRecords={doseTrackingRecords}
              smartReminder={upcomingSmartReminder}
              onToggleTheme={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
              onToggleLanguage={() => setLanguage((current) => (current === "en" ? "ta" : "en"))}
              onLogout={handleLogout}
              onTriggerReminder={() => setReminderOpen(true)}
              onMarkSmartReminderTaken={handleMarkUpcomingSmartReminderTaken}
              onTrackDose={handleTrackDose}
            />
          )}
          {screen === "notifications" && (
            <NotificationsScreen
              language={language}
              notifications={notificationEvents}
            />
          )}
          {screen === "settings" && (
            <SettingsScreen 
              language={language}
              schedules={medicineSchedules}
              onSchedulesChange={setMedicineSchedules}
              snoozeMinutes={snoozeMinutes}
              onSnoozeMinutesChange={setSnoozeMinutes}
              smartSchedules={smartSchedules}
              onCreateSmartSchedule={addSmartSchedule}
              onUpdateSmartScheduleDayStatus={updateSmartScheduleDayStatus}
              onRemoveSmartSchedule={removeSmartSchedule}
            />
          )}
          {screen === "profile" && (
            <ProfileScreen
              language={language}
              userProfile={userProfile}
              onProfileChange={handleProfileChange}
              onBack={() => setScreen("home")}
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
              onTestNotification={handleTestNotification}
              voiceGender={voiceGender}
              onVoiceGenderChange={setVoiceGender}
              ringtoneUri={ringtoneUri}
              ringtoneTitle={ringtoneTitle}
              onSelectRingtone={handleSelectRingtone}
            />
          )}

        <ReminderAlert
          language={language}
          smartReminder={medicineReminder ? null : upcomingSmartReminder}
          medicineReminder={medicineReminder}
          open={reminderOpen}
          soundEnabled={soundAlerts}
          ringtoneUri={ringtoneUri}
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
              const snoozeKey = `snooze:${snoozedMedicineReminder.scheduleId}`;
              const snoozeTime = new Date(Date.now() + snoozeMinutes * 60 * 1000);
              window.localStorage.setItem(snoozeKey, snoozeTime.toISOString());

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
