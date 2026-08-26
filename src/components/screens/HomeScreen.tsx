import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pill,
  Clock,
  CheckCircle2,
  Utensils,
  Bell,
  Sparkles,
  TrendingUp,
  Flame,
  Moon,
  Sun,
  Package,
  ShieldAlert,
  XCircle,
  CalendarDays,
  LogOut,
  Languages,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { nextDose, Schedule } from "@/data/medicine";
import { AppLanguage, getAppLocale } from "@/lib/appLanguage";
import { SmartScheduleReminder } from "@/lib/smartMedicineSchedule";
import type { DoseTrackingRecord, DoseTrackingStatus } from "@/pages/Index";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Status = "due" | "taken" | "missed";
type DetailKey = "today" | "week" | "streak" | "medicines" | "lowStock" | "expiring" | "doseHistory" | null;

const scheduleTimeToMinutes = (time: string) => {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3].toUpperCase();
  const hour24 = period === "AM" ? hour % 12 : (hour % 12) + 12;
  return hour24 * 60 + minute;
};

const splitScheduleName = (name: string) => {
  const [medicineName, ...dosageParts] = name.split(/\s+-\s+/);
  return {
    medicineName: medicineName.trim() || name,
    dosage: dosageParts.join(" - ").trim() || "Scheduled medicine",
  };
};

const getLocalDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const addDays = (date: Date, amount: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};

const notificationBackfillByDate: Record<string, { taken: number; missed: number; reminders: number }> = {
  "2026-05-04": { taken: 1, missed: 1, reminders: 1 },
  "2026-05-05": { taken: 1, missed: 0, reminders: 1 },
  "2026-05-06": { taken: 1, missed: 1, reminders: 1 },
  "2026-05-07": { taken: 1, missed: 0, reminders: 2 },
  "2026-05-08": { taken: 1, missed: 0, reminders: 2 },
  "2026-05-09": { taken: 1, missed: 1, reminders: 0 },
  "2026-05-10": { taken: 1, missed: 0, reminders: 1 },
  "2026-05-11": { taken: 2, missed: 1, reminders: 1 },
  "2026-05-12": { taken: 2, missed: 1, reminders: 1 },
};

interface HomeScreenProps {
  username: string;
  language: AppLanguage;
  theme: "light" | "dark";
  medicineSchedules: Schedule[];
  doseTrackingRecords: DoseTrackingRecord[];
  smartReminder?: SmartScheduleReminder | null;
  onToggleTheme: () => void;
  onToggleLanguage: () => void;
  onLogout: () => void;
  onTriggerReminder: () => void;
  onMarkSmartReminderTaken?: () => void;
  onTrackDose: (scheduleId: string, status: DoseTrackingStatus) => void;
}

const HomeScreen = ({
  username,
  language,
  theme,
  medicineSchedules,
  doseTrackingRecords,
  smartReminder,
  onToggleTheme,
  onToggleLanguage,
  onLogout,
  onTriggerReminder,
  onMarkSmartReminderTaken,
  onTrackDose,
}: HomeScreenProps) => {
  const [now, setNow] = useState(new Date());
  const [status, setStatus] = useState<Status>("due");
  const [detail, setDetail] = useState<DetailKey>(null);

  const announceStatButton = useCallback(
    (label: string, nextDetail: Exclude<DetailKey, null>) => {
      toast(label);

      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(label);
        utterance.lang = language === "ta" ? "ta-IN" : "en-US";
        window.speechSynthesis.speak(utterance);
      }

      setDetail(nextDetail);
    },
    [language]
  );

  useEffect(() => {
    const updateClock = () => setNow(new Date());
    const nowDate = new Date();
    const delayUntilNextMinute = (60 - nowDate.getSeconds()) * 1000 - nowDate.getMilliseconds();
    let intervalId: number | undefined;

    const timeoutId = window.setTimeout(() => {
      updateClock();
      intervalId = window.setInterval(updateClock, 60000);
    }, Math.max(1000, delayUntilNextMinute));

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId) window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    setStatus("due");
  }, [smartReminder?.scheduleId, smartReminder?.date, smartReminder?.time]);

  const locale = getAppLocale(language);
  const totalMeds = medicineSchedules.length;
  const lowStockMeds = medicineSchedules.filter((schedule) => schedule.stock <= 5);
  const expiringMeds = useMemo(
    () => medicineSchedules.filter((schedule) => schedule.expiresInDays <= 14),
    [medicineSchedules]
  );

  const todayKey = getLocalDateKey(now);
  const activeMedicineSchedules = medicineSchedules.filter((schedule) => schedule.enabled);
  const trackingByScheduleAndDate = useMemo(() => {
    const map = new Map<string, DoseTrackingRecord>();
    doseTrackingRecords.forEach((record) => map.set(`${record.scheduleId}:${record.dateKey}`, record));
    return map;
  }, [doseTrackingRecords]);
  const getTrackedStatus = (schedule: Schedule, dateKey: string): "taken" | "missed" | "left" => {
    const record = trackingByScheduleAndDate.get(`${schedule.id}:${dateKey}`);
    if (record?.status === "taken") return "taken";
    if (record?.status === "missed") return "missed";

    const scheduledMinutes = scheduleTimeToMinutes(schedule.time);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    if (dateKey < todayKey) return "missed";
    if (dateKey === todayKey && scheduledMinutes !== null && scheduledMinutes < nowMinutes) return "missed";
    return "left";
  };
  const todayTrackedDoses = activeMedicineSchedules.map((schedule) => ({
    schedule,
    status: getTrackedStatus(schedule, todayKey),
  }));
  const todayTaken = todayTrackedDoses.filter((dose) => dose.status === "taken").length;
  const todayMissed = todayTrackedDoses.filter((dose) => dose.status === "missed").length;
  const todayTotal = Math.max(todayTrackedDoses.length, 1);
  const todayLeft = Math.max(todayTotal - todayTaken - todayMissed, 0);
  const todayPercent = Math.round((todayTaken / todayTotal) * 100);
  const weekDates = Array.from({ length: 7 }, (_, index) => addDays(now, index - 6));
  const weeklyTrend = weekDates.map((date) => {
    const dateKey = getLocalDateKey(date);
    const hasUserTracking = doseTrackingRecords.some((record) => record.dateKey === dateKey);
    const notificationBackfill = notificationBackfillByDate[dateKey];
    const trackedTaken = activeMedicineSchedules.filter((schedule) => getTrackedStatus(schedule, dateKey) === "taken").length;
    const trackedMissed = activeMedicineSchedules.filter((schedule) => getTrackedStatus(schedule, dateKey) === "missed").length;
    const taken = hasUserTracking || !notificationBackfill ? trackedTaken : notificationBackfill.taken;
    const total =
      hasUserTracking || !notificationBackfill
        ? Math.max(activeMedicineSchedules.length, 1)
        : Math.max(notificationBackfill.taken + notificationBackfill.missed + notificationBackfill.reminders, 1);
    return {
      label: date.toLocaleDateString(locale, { weekday: "short" }),
      value: Math.round((taken / total) * 100),
      taken,
      missed: hasUserTracking || !notificationBackfill ? trackedMissed : notificationBackfill.missed,
      total,
    };
  });
  const weekTaken = weeklyTrend.reduce((sum, day) => sum + day.taken, 0);
  const weekTotal = weeklyTrend.reduce((sum, day) => sum + day.total, 0);
  const weekPercent = Math.round((weekTaken / Math.max(weekTotal, 1)) * 100);
  const { currentStreak, bestStreak } = useMemo(() => {
    const dateMap = new Map<string, { taken: number; missed: number }>();
    
    doseTrackingRecords.forEach((r) => {
      const entry = dateMap.get(r.dateKey) || { taken: 0, missed: 0 };
      if (r.status === "taken") entry.taken++;
      else if (r.status === "missed") entry.missed++;
      dateMap.set(r.dateKey, entry);
    });

    Object.entries(notificationBackfillByDate).forEach(([dateKey, stats]) => {
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, { taken: stats.taken, missed: stats.missed });
      }
    });

    const todayStr = getLocalDateKey(now);

    const isPerfectDay = (dateKey: string) => {
      const entry = dateMap.get(dateKey);
      if (!entry) return false;
      return entry.taken > 0 && entry.missed === 0;
    };

    const hasMissedDose = (dateKey: string) => {
      const entry = dateMap.get(dateKey);
      return entry ? entry.missed > 0 : false;
    };

    let curStreak = 0;
    const checkDate = new Date(now);

    const todayKey = getLocalDateKey(checkDate);
    if (hasMissedDose(todayKey)) {
      curStreak = 0;
    } else if (isPerfectDay(todayKey)) {
      curStreak = 1;
      checkDate.setDate(checkDate.getDate() - 1);
      while (true) {
        const key = getLocalDateKey(checkDate);
        if (isPerfectDay(key)) {
          curStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
    } else {
      checkDate.setDate(checkDate.getDate() - 1);
      while (true) {
        const key = getLocalDateKey(checkDate);
        if (isPerfectDay(key)) {
          curStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    const allRecordedDates = Array.from(dateMap.keys()).sort();
    let maxStreak = curStreak;
    
    if (allRecordedDates.length > 0) {
      let tempStreak = 0;
      const oldestDate = new Date(allRecordedDates[0]);
      const currentCheck = new Date(oldestDate);

      while (getLocalDateKey(currentCheck) <= todayStr) {
        const key = getLocalDateKey(currentCheck);
        const entry = dateMap.get(key);

        if (isPerfectDay(key)) {
          tempStreak++;
          if (tempStreak > maxStreak) {
            maxStreak = tempStreak;
          }
        } else {
          const isTodayCheck = key === todayStr;
          if (isTodayCheck && (!entry || (entry.taken === 0 && entry.missed === 0))) {
            // keep tempStreak
          } else {
            tempStreak = 0;
          }
        }
        currentCheck.setDate(currentCheck.getDate() + 1);
      }
    }

    return { currentStreak: curStreak, bestStreak: maxStreak };
  }, [doseTrackingRecords, now]);

  const milestoneDays = currentStreak < 7 ? 7 : currentStreak < 30 ? 30 : 100;
  const daysToGo = milestoneDays - currentStreak;

  const weekDetailItems = weeklyTrend.map((day) => ({
    title: day.label,
    subtitle: `${day.taken}/${day.total} ${language === "ta" ? "மாத்திரைகள் உட்கொள்ளப்பட்டன" : "doses taken"}`,
    tone: day.value === 100 ? "success" : day.value === 0 ? "destructive" : "warning",
    badge: `${day.value}%`,
    Icon: day.value === 100 ? CheckCircle2 : day.value === 0 ? XCircle : TrendingUp,
  }));

  const groupedHistory = {
    [language === "ta" ? "இன்று" : "Today"]: todayTrackedDoses.map(({ schedule, status }) => {
      const { medicineName, dosage } = splitScheduleName(schedule.name);
      return {
        id: schedule.id,
        name: medicineName,
        dosage,
        time: schedule.time,
        date: language === "ta" ? "இன்று" : "Today",
        status: status === "taken" ? "taken" : "missed",
      };
    }),
  };

  const copy =
    language === "ta"
      ? {
          greetings: {
            morning: "காலை வணக்கம்",
            afternoon: "மதிய வணக்கம்",
            evening: "மாலை வணக்கம்",
            night: "இரவு வணக்கம்",
          },
          pillBox: {
            connecting: "இணைக்கப்படுகிறது...",
            connected: "மருந்துப் பெட்டி",
            disconnected: "ஆஃப்லைன்",
          },
          theme: {
            day: "பகல் நிலை",
            night: "இரவு நிலை",
          },
          languageLabel: "தமிழ்",
          nextMedicine: "அடுத்த வேளை மருந்து",
          inTwelveMinutes: "12 நிமிடங்களில்",
          withFood: "உணவுடன்",
          dueNow: "உடனே உட்கொள்ளவும்",
          allTaken: "அனைத்தும் உட்கொள்ளப்பட்டன",
          missed: "தவறவிடப்பட்டது",
          markAsTaken: "உட்கொண்டதாகக் குறிக்கவும்",
          markedAsTaken: "உட்கொண்டதாகக் குறிக்கப்பட்டது",
          previewReminder: "நினைவூட்டல் முன்னோட்டம்",
          stats: {
            today: "இன்று",
            week: "இந்த வாரம்",
            streak: "தொடர் நாட்கள்",
            medicines: "மாத்திரைகள்",
            lowStock: "குறைந்த இருப்பு",
            expiring: "காலாவதி அருகில்",
          },
          details: {
            todayTitle: "இன்றைய மருந்து விபரம்",
            todayDescription: `${todayTaken}/${todayTrackedDoses.length} உட்கொள்ளப்பட்டது`,
            taken: "உட்கொள்ளப்பட்டது",
            missed: "தவறவிடப்பட்டது",
            weeklyTitle: "வாராந்திர பின்பற்றல் விகிதம்",
            weeklyDescription: `${weekPercent}% - இந்த வாரம் ${weekTotal} இல் ${weekTaken} முறை உட்கொள்ளப்பட்டது`,
            streakTitle: "தற்போதைய தொடர்",
            streakDescription: `${currentStreak} நாட்கள் தொடர்ந்து`,
            bestStreak: "சிறந்த தொடர்",
            bestStreakDescription: `${bestStreak} நாட்கள்`,
            thisStreak: "இந்த தொடர்",
            thisStreakDescription: `${currentStreak} நாட்கள்`,
            nextMilestone: "அடுத்த இலக்கு",
            milestoneBadge: milestoneDays === 7 ? "1 வார பேட்ஜ்" : milestoneDays === 30 ? "1 மாத பேட்ஜ்" : "100 நாட்கள் பேட்ஜ்",
            daysToGoLabel: daysToGo === 1 ? "இன்னும் 1 நாள்" : `இன்னும் ${daysToGo} நாட்கள்`,
            medicinesTitle: "அனைத்து மாத்திரைகள்",
            medicinesDescription: `${totalMeds} செயலில் உள்ளவை`,
            dailyAt: "தினமும்",
            active: "செயலில்",
            off: "ஆஃப்",
            lowStockTitle: "குறைந்த இருப்பு",
            lowStockDescription:
              lowStockMeds.length === 0
                ? "அனைத்து மாத்திரைகளும் போதுமான அளவில் உள்ளன"
                : `${lowStockMeds.length} மாத்திரைகளின் இருப்பு குறைவாக உள்ளது`,
            tabletsRemaining: "மாத்திரைகள் மட்டும் மீதம்",
            left: "மீதம்",
            stockedUp: "மாத்திரை இருப்பு போதுமானதாக உள்ளது",
            expiringTitle: "விரைவில் காலாவதியாகும்",
            expiringDescription:
              expiringMeds.length === 0
                ? "எதுவும் விரைவில் காலாவதியாகவில்லை"
                : `${expiringMeds.length} மருந்துகளுக்கு கவனம் தேவை`,
            expiresIn: "காலாவதி இன்னும்",
            day: "நாள்",
            days: "நாட்கள்",
            fresh: "நல்ல நிலையில் உள்ளது",
            expired: "காலாவதியானது",
            nothingHere: "பதிவுகள் இல்லை",
          },
        }
      : {
          greetings: {
            morning: "Good morning",
            afternoon: "Good afternoon",
            evening: "Good evening",
            night: "Good night",
          },
          pillBox: {
            connecting: "Connecting...",
            connected: "Pill box",
            disconnected: "Pill box off",
          },
          theme: {
            day: "Day mode",
            night: "Night mode",
          },
          languageLabel: "English",
          nextMedicine: "Next medicine",
          inTwelveMinutes: "in 12 min",
          withFood: "With food",
          dueNow: "Due now",
          allTaken: "All taken",
          missed: "Missed",
          markAsTaken: "Mark as Taken",
          markedAsTaken: "Marked as Taken",
          previewReminder: "Preview reminder alert",
          stats: {
            today: "Today",
            week: "This week",
            streak: "Streak",
            medicines: "Medicines",
            lowStock: "Low stock",
            expiring: "Expiring",
          },
          details: {
            todayTitle: "Today's doses",
            todayDescription: `${todayTaken} of ${todayTrackedDoses.length} taken so far`,
            taken: "Taken",
            missed: "Missed",
            weeklyTitle: "Weekly adherence",
            weeklyDescription: `${weekPercent}% - ${weekTaken} of ${weekTotal} doses taken this week`,
            streakTitle: "Current streak",
            streakDescription: `${currentStreak} day${currentStreak === 1 ? "" : "s"} in a row`,
            bestStreak: "Best streak",
            bestStreakDescription: `${bestStreak} day${bestStreak === 1 ? "" : "s"}`,
            thisStreak: "This streak",
            thisStreakDescription: `${currentStreak} day${currentStreak === 1 ? "" : "s"}`,
            nextMilestone: "Next milestone",
            milestoneBadge: milestoneDays === 7 ? "1 week badge" : milestoneDays === 30 ? "1 month badge" : "100 days badge",
            daysToGoLabel: `${daysToGo}d to go`,
            medicinesTitle: "All medicines",
            medicinesDescription: `${totalMeds} active medicines on schedule`,
            dailyAt: "Daily at",
            active: "Active",
            off: "Off",
            lowStockTitle: "Low stock",
            lowStockDescription:
              lowStockMeds.length === 0
                ? "All medicines well stocked"
                : `${lowStockMeds.length} medicine(s) running low`,
            tabletsRemaining: "tablets remaining",
            left: "left",
            stockedUp: "You're all stocked up",
            expiringTitle: "Expiring soon",
            expiringDescription:
              expiringMeds.length === 0
                ? "Nothing expiring soon"
                : `${expiringMeds.length} medicine(s) need attention`,
            expiresIn: "Expires in",
            day: "day",
            days: "days",
            fresh: "Fresh",
            expired: "Expired",
            allFresh: "All medicines fresh",
            nothingHere: "Nothing here",
          },
        };

  const timeStr = now.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
  const dateStr = now.toLocaleDateString(locale, { weekday: "long", month: "long", day: "numeric" });
  const hour = now.getHours();
  const isNight = theme === "dark";

  const greeting =
    hour >= 5 && hour < 12
      ? copy.greetings.morning
      : hour >= 12 && hour < 17
        ? copy.greetings.afternoon
        : hour >= 17 && hour < 21
          ? copy.greetings.evening
          : copy.greetings.night;

  const statusConfig = {
    due: { label: copy.dueNow, dot: "bg-warning" },
    taken: { label: copy.allTaken, dot: "bg-success" },
    missed: { label: copy.missed, dot: "bg-destructive" },
  }[status];
  const nextMedicineSchedule = useMemo(() => {
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    return medicineSchedules
      .filter((schedule) => schedule.enabled)
      .map((schedule) => {
        const minutes = scheduleTimeToMinutes(schedule.time);
        if (minutes === null) return null;
        const minutesUntil = (minutes - currentMinutes + 24 * 60) % (24 * 60);
        return { schedule, minutesUntil };
      })
      .filter((item): item is { schedule: Schedule; minutesUntil: number } => Boolean(item))
      .sort((a, b) => a.minutesUntil - b.minutesUntil)[0];
  }, [medicineSchedules, now]);

  const slotKindLabel = smartReminder
    ? ({
        morning: language === "ta" ? "காலை" : "Morning",
        afternoon: language === "ta" ? "மதியம்" : "Afternoon",
        night: language === "ta" ? "இரவு" : "Night",
        custom: language === "ta" ? "தனிப்பயன் நேரம்" : "Custom time",
      })[smartReminder.slotKind]
    : null;

  const formatHistoryDate = (value: string) => {
    const dateLabels = {
      Today: language === "ta" ? "இன்று" : "Today",
      Yesterday: language === "ta" ? "நேற்று" : "Yesterday",
    } as Record<string, string>;

    if (dateLabels[value]) return dateLabels[value];

    const parsedDate = new Date(`${value}, ${new Date().getFullYear()}`);
    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate.toLocaleDateString(locale, { month: "long", day: "numeric" });
    }

    return value;
  };

  const featuredReminder = nextMedicineSchedule
    ? {
        name: splitScheduleName(nextMedicineSchedule.schedule.name).medicineName,
        dosage: splitScheduleName(nextMedicineSchedule.schedule.name).dosage,
        time: nextMedicineSchedule.schedule.time,
        withFood: false,
        contextLabel:
          nextMedicineSchedule.minutesUntil === 0
            ? copy.dueNow
            : nextMedicineSchedule.minutesUntil < 60
              ? `${nextMedicineSchedule.minutesUntil} min`
              : language === "ta"
                ? "இன்று"
                : "Today",
      }
    : smartReminder
    ? {
        name: smartReminder.medicineName,
        dosage:
          language === "ta"
            ? `நாள் ${smartReminder.dayNumber}/${smartReminder.totalDays} • ${slotKindLabel}`
            : `Day ${smartReminder.dayNumber}/${smartReminder.totalDays} • ${slotKindLabel}`,
        time: smartReminder.time,
        withFood: false,
        contextLabel: smartReminder.isToday
          ? smartReminder.isOverdue
            ? copy.dueNow
            : language === "ta"
              ? "இன்றைய மருந்துக் கால அட்டவணை"
              : "Today's course"
          : new Date(`${smartReminder.date}T00:00:00`).toLocaleDateString(locale, {
              month: "short",
              day: "numeric",
            }),
      }
    : {
        name: nextDose.name,
        dosage: nextDose.dosage,
        time: nextDose.time,
        withFood: nextDose.withFood,
        contextLabel: copy.inTwelveMinutes,
      };

  const initial = username.trim().charAt(0).toUpperCase() || "U";

  return (
    <div className="flex-1 overflow-y-auto bg-page scrollbar-none">
      <div className="hero-surface relative overflow-hidden rounded-b-[1.75rem] bg-hero px-4 pb-11 pt-3.5 text-primary-foreground sm:px-5">
        <div className="mx-auto w-full max-w-xl">
          <div className="relative flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary-foreground/70">
                {greeting}
              </p>
              <h1 className="mt-0.5 break-words text-lg font-extrabold leading-tight">{username}</h1>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <button
                onClick={onLogout}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 backdrop-blur transition-colors hover:bg-white/25"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" strokeWidth={2.4} />
              </button>
            </div>
          </div>

          <div className="relative mt-2.5 flex items-center gap-2">
            <span className="tabular-nums text-3xl font-extrabold leading-none tracking-tight">{timeStr}</span>
            <span className="text-xs font-semibold text-primary-foreground/80 border-l border-white/20 pl-2">{dateStr}</span>
          </div>

          <div className="relative mt-3 flex flex-wrap items-center gap-1.5">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-2.5 py-1 backdrop-blur">
              <span className={cn("h-1.5 w-1.5 animate-soft-pulse rounded-full", statusConfig.dot)} />
              <span className="text-[10px] font-bold leading-none">{statusConfig.label}</span>
            </div>
            <ConnPillButton
              Icon={isNight ? Moon : Sun}
              label={isNight ? copy.theme.night : copy.theme.day}
              connected={true}
              onClick={onToggleTheme}
            />
            <ConnPillButton
              Icon={Languages}
              label={copy.languageLabel}
              connected={true}
              onClick={onToggleLanguage}
            />
          </div>
        </div>
      </div>

      <div className="relative z-10 -mt-7 px-4 sm:px-5">
        <div className="mx-auto w-full max-w-xl rounded-2xl border border-border/60 bg-card-gradient p-4 shadow-soft">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-widest text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              {copy.nextMedicine}
            </p>
            <span className="text-[10px] font-bold text-muted-foreground">{featuredReminder.contextLabel}</span>
          </div>

          <div className="mt-2.5 flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-hero shadow-glow">
              <Pill className="h-5.5 w-5.5 text-primary-foreground" strokeWidth={2.2} />
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="break-words text-lg font-extrabold leading-tight text-foreground">{featuredReminder.name}</h2>
              <p className="mt-0.5 break-words text-xs font-semibold text-muted-foreground">{featuredReminder.dosage}</p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <Chip Icon={Clock} label={featuredReminder.time} />
            {featuredReminder.withFood && <Chip Icon={Utensils} label={copy.withFood} />}
          </div>

          <div className="mt-3.5">
            <Button
              size="sm"
              onClick={() => {
                setStatus("taken");
                if (nextMedicineSchedule?.schedule.id) {
                  onTrackDose(nextMedicineSchedule.schedule.id, "taken");
                }
                onMarkSmartReminderTaken?.();
                toast.success(copy.markedAsTaken, {
                  description: `${featuredReminder.name} - ${featuredReminder.dosage}`,
                });
              }}
              disabled={status === "taken"}
              className={cn(
                "h-auto min-h-10 w-full whitespace-normal rounded-xl px-4 py-2 text-center text-xs font-bold leading-5 shadow-soft transition-all active:scale-[0.98]",
                status === "taken"
                  ? "bg-success/20 text-success border border-success/30 cursor-default"
                  : "bg-success text-success-foreground hover:bg-success/90"
              )}
            >
              <CheckCircle2 className="mr-1.5 h-4.5 w-4.5" strokeWidth={2.5} />
              {status === "taken" ? copy.markedAsTaken : copy.markAsTaken}
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-3 px-4 sm:px-5">
        <div className="mx-auto grid w-full max-w-xl grid-cols-3 gap-2">
          <Stat
            Icon={CheckCircle2}
            label={copy.stats.today}
            value={`${todayTaken}/${todayTrackedDoses.length}`}
            tone="primary"
            onClick={() => announceStatButton(copy.stats.today, "today")}
          />
          <Stat
            Icon={TrendingUp}
            label={copy.stats.week}
            value={`${weekPercent}%`}
            tone="success"
            onClick={() => announceStatButton(copy.stats.week, "week")}
          />
          <Stat
            Icon={Flame}
            label={copy.stats.streak}
            value={`${currentStreak}d`}
            tone="warning"
            onClick={() => announceStatButton(copy.stats.streak, "streak")}
          />
        </div>
      </div>

      <div className="mt-2.5 px-4 sm:px-5">
        <div className="mx-auto w-full max-w-xl flex items-center justify-between gap-1 rounded-2xl border border-border/40 bg-card/65 px-3 py-2 text-[10px] font-bold text-muted-foreground shadow-sm">
          <button
            type="button"
            onClick={() => announceStatButton(copy.stats.medicines, "medicines")}
            className="flex items-center gap-1 hover:text-primary transition-colors"
          >
            <Pill className="h-3.5 w-3.5 text-primary" />
            <span>{totalMeds} {language === "ta" ? "மருந்துகள்" : "Medicines"}</span>
          </button>
          <span className="h-3 w-px bg-border/80" />
          <button
            type="button"
            onClick={() => announceStatButton(copy.stats.lowStock, "lowStock")}
            className={cn("flex items-center gap-1 transition-colors hover:text-warning", lowStockMeds.length > 0 && "text-warning")}
          >
            <Package className="h-3.5 w-3.5" />
            <span>{lowStockMeds.length} {language === "ta" ? "குறைந்த இருப்பு" : "Low stock"}</span>
          </button>
          <span className="h-3 w-px bg-border/80" />
          <button
            type="button"
            onClick={() => announceStatButton(copy.stats.expiring, "expiring")}
            className={cn("flex items-center gap-1 transition-colors hover:text-destructive", expiringMeds.length > 0 && "text-destructive")}
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>{expiringMeds.length} {language === "ta" ? "காலாவதி" : "Expiring"}</span>
          </button>
        </div>
      </div>

      <div className="mt-2.5 px-4 sm:px-5">
        <div className="mx-auto w-full max-w-xl">
          <button
            type="button"
            onClick={() => setDetail("doseHistory")}
            className="w-full rounded-2xl border border-border/60 bg-card p-3 text-left shadow-card transition-all hover:shadow-soft active:scale-[0.99]"
          >
            <MiniBars
              data={weeklyTrend}
              label={language === "ta" ? "வார வரைபடம்" : "Weekly graph"}
              badge={`7 ${language === "ta" ? "நாட்கள்" : "days"}`}
            />
          </button>
        </div>
      </div>

      <div className="mt-2.5 px-4 pb-4 sm:px-5">
        <div className="mx-auto grid w-full max-w-xl gap-2">
          <section className="rounded-2xl border border-border/60 bg-card p-3 shadow-card">
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xs font-extrabold text-foreground">
                  {language === "ta" ? "இன்றைய சுருக்கம்" : "Today overview"}
                </h2>
                <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">
                  {language === "ta" ? "மருந்து நிலை மற்றும் வார முன்னேற்றம்" : "Dose status and weekly progress"}
                </p>
              </div>
              <ProgressBadge value={todayPercent} />
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              <MetricPill label={copy.details.taken} value={todayTaken} tone="success" />
              <MetricPill label={copy.details.missed} value={todayMissed} tone="destructive" />
              <MetricPill label={language === "ta" ? "மீதம்" : "Left"} value={todayLeft} tone="warning" />
            </div>
          </section>
        </div>
      </div>

      <Dialog open={detail !== null} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent
          onOpenAutoFocus={(event) => event.preventDefault()}
          className="max-h-[82vh] w-[calc(100vw-2rem)] max-w-[500px] overflow-y-auto rounded-3xl border-border bg-background p-5 text-foreground shadow-float sm:max-w-[500px]"
        >
          {detail === "doseHistory" && (
            <DoseHistoryView
              title={language === "ta" ? "மருந்து வரலாறு" : "Dose History"}
              description={language === "ta" ? "உங்கள் சமீபத்திய மருந்து பதிவு" : "Your recent medicine record"}
              grouped={groupedHistory}
              formatDate={formatHistoryDate}
              takenLabel={copy.details.taken}
              missedLabel={copy.details.missed}
            />
          )}

          {detail === "today" && (
            <DetailView
              title={copy.details.todayTitle}
              description={copy.details.todayDescription}
              items={todayTrackedDoses.map(({ schedule, status }) => {
                const { medicineName, dosage } = splitScheduleName(schedule.name);
                return {
                  title: medicineName,
                  subtitle: `${dosage} - ${schedule.time}`,
                  tone: status === "taken" ? "success" : status === "missed" ? "destructive" : "primary",
                  badge: status === "taken" ? copy.details.taken : status === "missed" ? copy.details.missed : (language === "ta" ? "மீதம்" : "Left"),
                  Icon: status === "taken" ? CheckCircle2 : status === "missed" ? XCircle : Clock,
                };
              })}
            />
          )}

          {detail === "week" && (
            <DetailView
              title={copy.details.weeklyTitle}
              description={copy.details.weeklyDescription}
              items={weekDetailItems}
            />
          )}

          {detail === "streak" && (
            <DetailView
              title={copy.details.streakTitle}
              description={copy.details.streakDescription}
              items={[
                { title: copy.details.bestStreak, subtitle: copy.details.bestStreakDescription, tone: "warning", badge: language === "ta" ? "சிறந்தது" : "Best", Icon: Flame },
                { title: copy.details.thisStreak, subtitle: copy.details.thisStreakDescription, tone: "primary", badge: `${currentStreak}d`, Icon: Flame },
                { title: copy.details.nextMilestone, subtitle: copy.details.milestoneBadge, tone: "success", badge: copy.details.daysToGoLabel, Icon: Sparkles },
              ]}
            />
          )}

          {detail === "medicines" && (
            <DetailView
              title={copy.details.medicinesTitle}
              description={copy.details.medicinesDescription}
              items={medicineSchedules.map((schedule) => ({
                title: schedule.name,
                subtitle: `${copy.details.dailyAt} ${schedule.time} - ${schedule.stock} ${copy.details.left}`,
                tone: schedule.enabled ? "primary" : "muted",
                badge: schedule.enabled ? copy.details.active : copy.details.off,
                Icon: Pill,
              }))}
            />
          )}

          {detail === "lowStock" && (
            <DetailView
              title={copy.details.lowStockTitle}
              description={copy.details.lowStockDescription}
              items={lowStockMeds.map((schedule) => ({
                title: schedule.name,
                subtitle:
                  language === "ta"
                    ? `${schedule.stock} ${copy.details.tabletsRemaining}`
                    : `Only ${schedule.stock} ${copy.details.tabletsRemaining}`,
                tone: "warning",
                badge: `${schedule.stock} ${copy.details.left}`,
                Icon: Package,
              }))}
              emptyText={copy.details.stockedUp}
            />
          )}

          {detail === "expiring" && (
            <DetailView
              title={copy.details.expiringTitle}
              description={copy.details.expiringDescription}
              items={expiringMeds.map((schedule) => ({
                title: schedule.name,
                subtitle: `${copy.details.expiresIn} ${schedule.expiresInDays} ${schedule.expiresInDays === 1 ? copy.details.day : copy.details.days}`,
                tone: schedule.expiresInDays <= 7 ? "destructive" : "warning",
                badge: `${schedule.expiresInDays}d`,
                Icon: CalendarDays,
              }))}
              emptyText={copy.details.allFresh}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const ConnPillButton = ({
  Icon,
  label,
  connected,
  busy,
  onClick,
}: {
  Icon: typeof Clock;
  label: string;
  connected: boolean;
  busy?: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={busy}
    className={cn(
      "inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-left text-[11px] font-bold leading-4 backdrop-blur transition-all active:scale-[0.96]",
      connected
        ? "border-white/30 bg-white/20 hover:bg-white/30"
        : "border-white/15 bg-white/5 text-primary-foreground/70 hover:bg-white/15",
      busy && "cursor-wait opacity-70"
    )}
  >
    <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
    <span className="min-w-0 [overflow-wrap:anywhere]">{label}</span>
    <span
      className={cn(
        "h-1.5 w-1.5 shrink-0 rounded-full",
        busy ? "animate-soft-pulse bg-warning" : connected ? "bg-success" : "bg-destructive"
      )}
    />
  </button>
);

const Chip = ({ Icon, label }: { Icon: typeof Clock; label: string }) => (
  <div className="flex min-w-0 items-center gap-1.5 rounded-xl bg-primary-soft px-3 py-1.5 text-sm font-bold text-primary">
    <Icon className="h-4 w-4 shrink-0" />
    <span className="min-w-0 break-words">{label}</span>
  </div>
);

const Stat = ({
  Icon,
  label,
  value,
  tone,
  onClick,
}: {
  Icon: typeof CheckCircle2;
  label: string;
  value: string;
  tone: "primary" | "success" | "warning" | "destructive";
  onClick?: () => void;
}) => {
  const tones = {
    primary: "bg-primary-soft text-primary",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    destructive: "bg-destructive-soft text-destructive",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="h-full min-w-0 rounded-2xl border border-border/60 bg-card px-2.5 py-3 text-left shadow-card transition-all hover:shadow-soft active:scale-[0.97]"
    >
      <div className={cn("mb-2 flex h-8 w-8 items-center justify-center rounded-xl", tones[tone])}>
        <Icon className="h-4 w-4" strokeWidth={2.5} />
      </div>
      <p className="text-lg font-extrabold leading-none text-foreground">{value}</p>
      <p className="mt-1 break-words text-[11px] font-semibold uppercase leading-4 text-muted-foreground">{label}</p>
    </button>
  );
};

const ProgressBadge = ({ value }: { value: number }) => (
  <div className="w-24 shrink-0 rounded-2xl bg-primary-soft px-3 py-2">
    <div className="mb-1 flex items-center justify-between">
      <span className="text-lg font-extrabold leading-none text-primary">{value}%</span>
    </div>
    <div className="h-2 overflow-hidden rounded-full bg-background">
      <div className="h-full rounded-full bg-primary animate-grow-x" style={{ width: `${value}%` }} />
    </div>
  </div>
);

const MetricPill = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "warning" | "destructive";
}) => {
  const tones = {
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    destructive: "bg-destructive-soft text-destructive",
  };

  return (
    <div className={cn("rounded-2xl px-3 py-2 text-center", tones[tone])}>
      <p className="text-lg font-extrabold leading-none">{value}</p>
      <p className="mt-1 break-words text-[10px] font-bold uppercase leading-3">{label}</p>
    </div>
  );
};

const MiniBars = ({
  data,
  label,
  badge,
  className,
}: {
  data: { label: string; value: number }[];
  label: string;
  badge?: string;
  className?: string;
}) => (
  <div className={className}>
    <div className="mb-3 flex items-center justify-between gap-3 px-1">
      <div>
        <p className="text-base font-extrabold text-foreground">{label}</p>
        <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">Dose progress by day</p>
      </div>
      <span className="rounded-full bg-primary-soft px-3 py-1.5 text-[11px] font-extrabold text-primary shadow-soft">
        {badge || `${Math.round(data.reduce((sum, item) => sum + item.value, 0) / data.length)}%`}
      </span>
    </div>
    <div className="grid h-32 grid-cols-7 items-end gap-2 rounded-3xl border border-border/50 bg-gradient-card px-3 pb-3 pt-4 shadow-card">
      {data.map((item, index) => (
        <div key={`${item.label}-${index}`} className="flex h-full min-w-0 flex-col items-center justify-end gap-2">
          <span
            className={cn(
              "text-[10px] font-extrabold leading-none",
              item.value >= 90 ? "text-success" : item.value >= 50 ? "text-primary" : "text-warning"
            )}
          >
            {item.value}%
          </span>
          <div className="flex h-16 w-6 items-end overflow-hidden rounded-full border border-border/70 bg-background shadow-inner">
            <div
              className={cn(
                "w-full rounded-full animate-grow-y transition-all",
                item.value >= 90
                  ? "bg-gradient-to-t from-success to-success/70"
                  : item.value >= 50
                    ? "bg-gradient-to-t from-primary to-primary-glow"
                    : "bg-gradient-to-t from-warning to-warning/70"
              )}
              style={{ height: `${Math.max(item.value, 8)}%` }}
            />
          </div>
          <span className="text-[10px] font-extrabold text-foreground/70">{item.label}</span>
        </div>
      ))}
    </div>
  </div>
);

type DetailItem = {
  title: string;
  subtitle: string;
  tone: "primary" | "success" | "warning" | "destructive" | "muted";
  badge: string;
  Icon: typeof CheckCircle2;
};

type TrackedDoseHistoryItem = {
  id: string;
  name: string;
  dosage: string;
  time: string;
  date: string;
  status: "taken" | "missed";
};

const DoseHistoryView = ({
  title,
  description,
  grouped,
  formatDate,
  takenLabel,
  missedLabel,
}: {
  title: string;
  description: string;
  grouped: Record<string, TrackedDoseHistoryItem[]>;
  formatDate: (value: string) => string;
  takenLabel: string;
  missedLabel: string;
}) => (
  <>
    <DialogHeader className="pr-7 text-left">
      <DialogTitle className="text-2xl font-extrabold">{title}</DialogTitle>
      <DialogDescription className="text-sm font-medium">{description}</DialogDescription>
    </DialogHeader>

    <div className="mt-5 space-y-6">
      {Object.entries(grouped).map(([date, doses]) => (
        <section key={date}>
          <h3 className="mb-3 px-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            {formatDate(date)}
          </h3>

          <ol className="relative pl-7">
            <span className="absolute bottom-2 left-2 top-2 w-0.5 rounded-full bg-border" />

            {doses.map((dose) => {
              const taken = dose.status === "taken";

              return (
                <li key={dose.id} className="relative pb-4 last:pb-0">
                  <span
                    className={cn(
                      "absolute -left-[1.4rem] top-3 h-4 w-4 rounded-full border-[3px] border-background shadow-card",
                      taken ? "bg-success" : "bg-destructive"
                    )}
                  />

                  <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-3.5 shadow-card">
                    <div
                      className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                        taken ? "bg-success-soft" : "bg-destructive-soft"
                      )}
                    >
                      <Pill className={cn("h-5 w-5", taken ? "text-success" : "text-destructive")} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="break-words font-bold text-foreground">{dose.name}</p>
                      <p className="break-words text-xs font-medium text-muted-foreground">
                        {dose.dosage} - {dose.time}
                      </p>
                    </div>

                    <div
                      className={cn(
                        "flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold",
                        taken ? "bg-success-soft text-success" : "bg-destructive-soft text-destructive"
                      )}
                    >
                      {taken ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                      {taken ? takenLabel : missedLabel}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  </>
);

const DetailView = ({
  title,
  description,
  items,
  emptyText,
}: {
  title: string;
  description: string;
  items: DetailItem[];
  emptyText?: string;
}) => {
  const tones = {
    primary: "bg-primary-soft text-primary",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    destructive: "bg-destructive-soft text-destructive",
    muted: "bg-muted text-muted-foreground",
  };

  return (
    <>
      <DialogHeader className="pr-7 text-left">
        <DialogTitle className="text-2xl font-extrabold">{title}</DialogTitle>
        <DialogDescription className="text-sm font-medium">{description}</DialogDescription>
      </DialogHeader>

      <div className="mt-4 space-y-2">
        {items.length === 0 ? (
          <div className="py-10 text-center font-semibold text-muted-foreground">
            {emptyText || "Nothing here"}
          </div>
        ) : (
          items.map((item, index) => (
            <div
              key={index}
              className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-3"
            >
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                  tones[item.tone]
                )}
              >
                <item.Icon className="h-5 w-5" strokeWidth={2.4} />
              </div>

              <div className="min-w-0 flex-1">
                <p className="break-words font-bold leading-snug text-foreground">{item.title}</p>
                <p className="break-words text-xs font-medium leading-5 text-muted-foreground">{item.subtitle}</p>
              </div>

              <span
                className={cn(
                  "whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold",
                  tones[item.tone]
                )}
              >
                {item.badge}
              </span>
            </div>
          ))
        )}
      </div>
    </>
  );
};

export default HomeScreen;
