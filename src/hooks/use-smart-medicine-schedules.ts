import { useEffect, useMemo, useState } from "react";
import {
  SmartMedicineDayStatus,
  SmartMedicineSchedule,
  SmartMedicineScheduleDraft,
  createSmartMedicineSchedule,
  getUpcomingSmartReminder,
  seedSmartMedicineSchedules,
  updateScheduleDayStatus,
} from "@/lib/smartMedicineSchedule";

const STORAGE_KEY = "gentle-dose-smart-medicine-schedules-v1";

const loadSchedules = (): SmartMedicineSchedule[] => {
  if (typeof window === "undefined") return [];

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return seedSmartMedicineSchedules();
  }

  try {
    const parsed = JSON.parse(stored) as SmartMedicineSchedule[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : seedSmartMedicineSchedules();
  } catch (error) {
    console.error("Could not parse saved smart medicine schedules:", error);
    return seedSmartMedicineSchedules();
  }
};

export const useSmartMedicineSchedules = () => {
  const [smartSchedules, setSmartSchedules] = useState<SmartMedicineSchedule[]>(loadSchedules);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(smartSchedules));
  }, [smartSchedules]);

  const addSmartSchedule = (draft: SmartMedicineScheduleDraft) => {
    setSmartSchedules((current) => [...current, createSmartMedicineSchedule(draft)]);
  };

  const updateSmartScheduleDayStatus = (
    scheduleId: string,
    dateKey: string,
    status: SmartMedicineDayStatus
  ) => {
    setSmartSchedules((current) =>
      current.map((schedule) =>
        schedule.id === scheduleId ? updateScheduleDayStatus(schedule, dateKey, status) : schedule
      )
    );
  };

  const removeSmartSchedule = (scheduleId: string) => {
    setSmartSchedules((current) => current.filter((schedule) => schedule.id !== scheduleId));
  };

  const upcomingSmartReminder = useMemo(
    () => getUpcomingSmartReminder(smartSchedules, new Date()),
    [smartSchedules]
  );

  return {
    smartSchedules,
    addSmartSchedule,
    updateSmartScheduleDayStatus,
    removeSmartSchedule,
    upcomingSmartReminder,
  };
};
