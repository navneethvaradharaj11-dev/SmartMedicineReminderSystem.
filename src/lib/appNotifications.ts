import { AlertType } from "@/data/medicine";

export type AppNotification = {
  id: string;
  type: AlertType;
  title: string;
  message: string;
  createdAt: string;
};

export type GroupedNotification = AppNotification & {
  group: string;
  groupLabel: string;
  time: string;
};

const STORAGE_KEY = "gentle-dose-app-notifications-v1";
const MAX_EVENTS = 80;


export const olderNotificationHistory: AppNotification[] = [
  {
    id: "history-missed-dose",
    type: "missed",
    title: "Dose missed",
    message: "Metformin 500 mg was not confirmed before the reminder window ended.",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "history-course-progress",
    type: "success",
    title: "Course progress updated",
    message: "Amoxicillin Day 1 was marked as taken.",
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "history-refill",
    type: "stock",
    title: "Refill reminder",
    message: "Aspirin stock may last only 5 more days.",
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "history-expiry-check",
    type: "expired",
    title: "Expiry check completed",
    message: "One medicine bottle needs attention this week.",
    createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "history-dose-logged",
    type: "success",
    title: "Dose logged",
    message: "Atorvastatin 10 mg was added to history.",
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export const getNotificationTimeline = (recentNotifications = loadAppNotifications()) => {
  const seen = new Set<string>();
  const newestFirst = (a: AppNotification, b: AppNotification) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

  return [[...recentNotifications].sort(newestFirst), [...olderNotificationHistory].sort(newestFirst)]
    .flat()
    .filter((notification) => {
      if (seen.has(notification.id)) return false;
      seen.add(notification.id);
      return true;
    });
};

export const loadAppNotifications = (): AppNotification[] => {
  if (typeof window === "undefined") return [];

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as AppNotification[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Could not load app notifications:", error);
    return [];
  }
};

export const saveAppNotifications = (notifications: AppNotification[]) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, MAX_EVENTS)));
};

export const addAppNotification = (notification: Omit<AppNotification, "id" | "createdAt">) => {
  const nextNotification: AppNotification = {
    ...notification,
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  const next = [nextNotification, ...loadAppNotifications()].slice(0, MAX_EVENTS);
  saveAppNotifications(next);
  return nextNotification;
};

export const formatNotificationTime = (createdAt: string) => {
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return "";

  const elapsedMinutes = Math.max(0, Math.round((Date.now() - created) / 60000));
  if (elapsedMinutes < 1) return "Just now";
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;

  const elapsedHours = Math.round(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;

  const elapsedDays = Math.round(elapsedHours / 24);
  return elapsedDays === 1 ? "Yesterday" : `${elapsedDays}d ago`;
};

const getDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const groupNotifications = (notifications: AppNotification[]): GroupedNotification[] => {
  const todayKey = getDateKey(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = getDateKey(yesterday);

  return notifications.map((notification) => {
    const date = new Date(notification.createdAt);
    const key = Number.isNaN(date.getTime()) ? todayKey : getDateKey(date);
    const groupLabel =
      key === todayKey
        ? "Today"
        : key === yesterdayKey
          ? "Yesterday"
          : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

    return {
      ...notification,
      group: key,
      groupLabel,
      time: formatNotificationTime(notification.createdAt),
    };
  });
};
