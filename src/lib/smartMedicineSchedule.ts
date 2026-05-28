import {
  addDays,
  eachDayOfInterval,
  format,
  isAfter,
  isBefore,
  isSameDay,
  parseISO,
  startOfDay,
} from "date-fns";

export type SmartMedicineTimeSlotKind = "morning" | "afternoon" | "night" | "custom";
export type SmartMedicineDayStatus = "pending" | "taken" | "missed";

export interface SmartMedicineTimeSlot {
  id: string;
  kind: SmartMedicineTimeSlotKind;
  label: string;
  time: string;
}

export interface SmartMedicineDayEntry {
  date: string;
  status: SmartMedicineDayStatus;
  slotStatus: Record<string, SmartMedicineDayStatus>;
  updatedAt?: string;
}

export interface SmartMedicineSchedule {
  id: string;
  medicineName: string;
  startDate: string;
  endDate: string;
  timeSlots: SmartMedicineTimeSlot[];
  dailyStatus: Record<string, SmartMedicineDayEntry>;
  createdAt: string;
}

export interface SmartMedicineScheduleDraft {
  medicineName: string;
  startDate: string;
  endDate: string;
  timeSlots: SmartMedicineTimeSlot[];
}

export interface SmartScheduleProgress {
  totalDays: number;
  completedDays: number;
  missedDays: number;
  remainingDays: number;
}

export interface SmartScheduleReminder {
  scheduleId: string;
  medicineName: string;
  date: string;
  time: string;
  slotKind: SmartMedicineTimeSlotKind;
  slotLabel: string;
  totalDays: number;
  dayNumber: number;
  isToday: boolean;
  isOverdue: boolean;
}

const pad = (value: number) => String(value).padStart(2, "0");

export const toDateKey = (value: Date | string) => {
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    return format(parseISO(value), "yyyy-MM-dd");
  }

  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
};

export const fromDateKey = (value: string) => parseISO(`${value}T00:00:00`);

export const sortTimeSlots = (timeSlots: SmartMedicineTimeSlot[]) =>
  [...timeSlots].sort((left, right) => left.time.localeCompare(right.time));

export const enumerateScheduleDates = (startDate: string, endDate: string) => {
  const start = fromDateKey(startDate);
  const end = fromDateKey(endDate);

  if (isAfter(start, end)) return [];

  return eachDayOfInterval({ start, end }).map((date) => toDateKey(date));
};

export const buildDailyStatusMap = (timeSlots: SmartMedicineTimeSlot[], startDate: string, endDate: string) =>
  Object.fromEntries(
    enumerateScheduleDates(startDate, endDate).map((dateKey) => [
      dateKey,
      {
        date: dateKey,
        status: "pending" as SmartMedicineDayStatus,
        slotStatus: Object.fromEntries(timeSlots.map((slot) => [slot.id, "pending" as SmartMedicineDayStatus])),
      },
    ])
  );

export const createSmartMedicineSchedule = (draft: SmartMedicineScheduleDraft): SmartMedicineSchedule => ({
  id: `course-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  medicineName: draft.medicineName.trim(),
  startDate: draft.startDate,
  endDate: draft.endDate,
  timeSlots: sortTimeSlots(draft.timeSlots),
  dailyStatus: buildDailyStatusMap(draft.timeSlots, draft.startDate, draft.endDate),
  createdAt: new Date().toISOString(),
});

export const getScheduleProgress = (schedule: SmartMedicineSchedule): SmartScheduleProgress => {
  const dayEntries = Object.values(schedule.dailyStatus);
  const completedDays = dayEntries.filter((entry) => entry.status === "taken").length;
  const missedDays = dayEntries.filter((entry) => entry.status === "missed").length;
  const totalDays = dayEntries.length;
  const remainingDays = dayEntries.filter((entry) => entry.status === "pending").length;

  return {
    totalDays,
    completedDays,
    missedDays,
    remainingDays,
  };
};

export const isScheduleActiveOn = (schedule: SmartMedicineSchedule, date: Date | string) => {
  const dateKey = toDateKey(date);
  return dateKey >= schedule.startDate && dateKey <= schedule.endDate;
};

export const getScheduleDayNumber = (schedule: SmartMedicineSchedule, dateKey: string) =>
  enumerateScheduleDates(schedule.startDate, schedule.endDate).findIndex((value) => value === dateKey) + 1;

export const updateScheduleDayStatus = (
  schedule: SmartMedicineSchedule,
  dateKey: string,
  status: SmartMedicineDayStatus
) => {
  const currentEntry = schedule.dailyStatus[dateKey];
  if (!currentEntry) return schedule;

  const nextSlotStatus = Object.fromEntries(
    Object.keys(currentEntry.slotStatus).map((slotId) => [slotId, status])
  );

  return {
    ...schedule,
    dailyStatus: {
      ...schedule.dailyStatus,
      [dateKey]: {
        ...currentEntry,
        status,
        slotStatus: nextSlotStatus,
        updatedAt: new Date().toISOString(),
      },
    },
  };
};

const buildReminderCandidate = (
  schedule: SmartMedicineSchedule,
  dateKey: string,
  now: Date
): SmartScheduleReminder | null => {
  const dayEntry = schedule.dailyStatus[dateKey];
  if (!dayEntry || dayEntry.status !== "pending") return null;

  const targetDate = fromDateKey(dateKey);
  const sortedSlots = sortTimeSlots(schedule.timeSlots);
  if (sortedSlots.length === 0) return null;

  const timeNow = format(now, "HH:mm");
  let chosenSlot = sortedSlots[0];
  let isOverdue = false;

  if (isSameDay(targetDate, now)) {
    const upcomingSlot = sortedSlots.find((slot) => slot.time >= timeNow);
    if (upcomingSlot) {
      chosenSlot = upcomingSlot;
    } else {
      chosenSlot = sortedSlots[sortedSlots.length - 1];
      isOverdue = true;
    }
  }

  return {
    scheduleId: schedule.id,
    medicineName: schedule.medicineName,
    date: dateKey,
    time: chosenSlot.time,
    slotKind: chosenSlot.kind,
    slotLabel: chosenSlot.label,
    totalDays: enumerateScheduleDates(schedule.startDate, schedule.endDate).length,
    dayNumber: getScheduleDayNumber(schedule, dateKey),
    isToday: isSameDay(targetDate, now),
    isOverdue,
  };
};

export const getUpcomingSmartReminder = (
  schedules: SmartMedicineSchedule[],
  now: Date = new Date()
): SmartScheduleReminder | null => {
  const today = startOfDay(now);
  let bestReminder: SmartScheduleReminder | null = null;
  let bestSortKey = Number.POSITIVE_INFINITY;

  schedules.forEach((schedule) => {
    const start = fromDateKey(schedule.startDate);
    const end = fromDateKey(schedule.endDate);

    if (isAfter(today, end)) return;

    const firstDate = isBefore(today, start) ? start : today;
    const dateKeys = eachDayOfInterval({ start: firstDate, end }).map((date) => toDateKey(date));

    dateKeys.forEach((dateKey) => {
      const reminder = buildReminderCandidate(schedule, dateKey, now);
      if (!reminder) return;

      const reminderDate = fromDateKey(reminder.date);
      const sortKey =
        reminder.isToday && reminder.isOverdue
          ? now.getTime()
          : reminderDate.getTime() + Number(reminder.time.slice(0, 2)) * 60 * 60 * 1000 + Number(reminder.time.slice(3, 5)) * 60 * 1000;

      if (sortKey < bestSortKey) {
        bestSortKey = sortKey;
        bestReminder = reminder;
      }
    });
  });

  return bestReminder;
};

export const seedSmartMedicineSchedules = (today: Date = new Date()): SmartMedicineSchedule[] => {
  const startDate = toDateKey(today);
  const endDate = toDateKey(addDays(today, 4));

  return [
    createSmartMedicineSchedule({
      medicineName: "Amoxicillin",
      startDate,
      endDate,
      timeSlots: [
        { id: "slot-morning", kind: "morning", label: "Morning", time: "08:00" },
        { id: "slot-night", kind: "night", label: "Night", time: "20:00" },
      ],
    }),
  ];
};
