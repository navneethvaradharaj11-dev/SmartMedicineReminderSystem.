import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addAppNotification,
  getNotificationTimeline,
  groupNotifications,
  loadAppNotifications,
} from "@/lib/appNotifications";

describe("appNotifications", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-17T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stores new notification events at the top of localStorage", () => {
    addAppNotification({
      type: "success",
      title: "Dose marked as taken",
      message: "Metformin was marked taken.",
    });

    const stored = loadAppNotifications();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      type: "success",
      title: "Dose marked as taken",
    });
  });

  it("groups notifications by readable date labels", () => {
    const grouped = groupNotifications([
      {
        id: "today",
        type: "reminder",
        title: "Today",
        message: "Now",
        createdAt: "2026-05-17T09:58:00.000Z",
      },
      {
        id: "yesterday",
        type: "stock",
        title: "Yesterday",
        message: "Stock",
        createdAt: "2026-05-16T09:58:00.000Z",
      },
    ]);

    expect(grouped[0].groupLabel).toBe("Today");
    expect(grouped[0].time).toBe("2m ago");
    expect(grouped[1].groupLabel).toBe("Yesterday");
  });

  it("keeps older notification history below recent events", () => {
    const timeline = getNotificationTimeline([
      {
        id: "latest",
        type: "success",
        title: "Latest event",
        message: "A new event happened.",
        createdAt: "2026-05-17T09:59:00.000Z",
      },
    ]);

    expect(timeline[0].id).toBe("latest");
    expect(timeline.some((notification) => notification.id === "history-missed-dose")).toBe(true);
  });
});
