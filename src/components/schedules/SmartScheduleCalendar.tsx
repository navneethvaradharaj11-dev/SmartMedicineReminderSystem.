import { useEffect, useMemo, useState } from "react";
import type { DateRange, DayContentProps } from "react-day-picker";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Minus,
  MoonStar,
  Plus,
  Sunrise,
  SunMedium,
  Timer,
  Trash2,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { enUS, ta } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AppLanguage } from "@/lib/appLanguage";
import {
  SmartMedicineDayStatus,
  SmartMedicineSchedule,
  SmartMedicineScheduleDraft,
  SmartMedicineTimeSlot,
  SmartMedicineTimeSlotKind,
  enumerateScheduleDates,
  fromDateKey,
  getScheduleDayNumber,
  getScheduleProgress,
  isScheduleActiveOn,
  toDateKey,
} from "@/lib/smartMedicineSchedule";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SmartScheduleCalendarProps {
  language?: AppLanguage;
  demoMode?: boolean;
  schedules: SmartMedicineSchedule[];
  onCreateSchedule: (draft: SmartMedicineScheduleDraft) => void;
  onUpdateDayStatus: (scheduleId: string, dateKey: string, status: SmartMedicineDayStatus) => void;
  onRemoveSchedule: (scheduleId: string) => void;
}

const SmartScheduleCalendar = ({
  language = "en",
  demoMode = false,
  schedules,
  onCreateSchedule,
  onUpdateDayStatus,
  onRemoveSchedule,
}: SmartScheduleCalendarProps) => {
  const copy =
    language === "ta"
      ? {
          title: "ஸ்மார்ட் மருந்து அட்டவணை காலண்டர்",
          subtitle:
            "சில நாட்களுக்கு மட்டும் எடுத்துக்கொள்ள வேண்டிய மருந்துகளுக்கு தொடக்க தேதி, முடிவு தேதி, தினசரி நேரங்கள் மற்றும் முன்னேற்றத்தை அமைக்கவும்.",
          medicineName: "மருந்து பெயர்",
          medicinePlaceholder: "எ.கா. Azithromycin 500 mg",
          chooseRange: "தேதி வரம்பை தேர்ந்தெடுக்கவும்",
          chooseSlots: "நேரங்களை தேர்ந்தெடுக்கவும்",
          morning: "காலை",
          afternoon: "மதியம்",
          night: "இரவு",
          custom: "தனிப்பயன்",
          customTime: "தனிப்பயன் நேரம்",
          createCourse: "புதிய மருந்துக் கால அட்டவணை அமைக்கவும்",
          activeCourses: "செயலில் உள்ள மருந்துக் கால அட்டவணைகள்",
          noCourses: "இன்னும் எந்த தற்காலிக மருந்துக் கால அட்டவணையும் உருவாக்கப்படவில்லை.",
          progress: "முன்னேற்றம்",
          dayProgress: (completed: number, total: number) => `${total} இல் ${completed} நாட்கள் முடிந்தது`,
          completedDays: "முடிந்த நாட்கள்",
          remainingDays: "மீதமுள்ள நாட்கள்",
          missedDays: "தவறிய நாட்கள்",
          selectedDay: "தேர்ந்தெடுத்த நாள்",
          markTaken: "எடுத்ததாக குறிக்கவும்",
          markMissed: "தவறியதாக குறிக்கவும்",
          reset: "மீட்டமை",
          removeCourse: "கால அட்டவணையை நீக்கு",
          startDate: "தொடக்க தேதி",
          endDate: "முடிவு தேதி",
          timesPerDay: "ஒரு நாளில் நேரங்கள்",
          day: "நாள்",
          of: "இல்",
          statusTaken: "எடுத்தார்",
          statusMissed: "தவறியது",
          statusPending: "நிலுவையில்",
          createFirst: "முதலில் மருந்து பெயர், தேதி வரம்பு மற்றும் நேரங்களை தேர்வு செய்யவும்",
          scheduleCreated: "ஸ்மார்ட் மருந்துக் கால அட்டவணை உருவாக்கப்பட்டது",
          courseRemoved: "மருந்துக் கால அட்டவணை நீக்கப்பட்டது",
          demoReadOnlyTitle: "டெமோ முறை படிக்க மட்டும்",
          demoReadOnlyDescription: "உண்மையான கால அட்டவணையை மாற்ற டெமோ முறையை அணைக்கவும்.",
        }
      : {
          title: "Smart Medicine Scheduling Calendar",
          subtitle:
            "Create temporary medicine courses with a start date, end date, daily time slots, and progress tracking.",
          medicineName: "Medicine name",
          medicinePlaceholder: "e.g. Azithromycin 500 mg",
          chooseRange: "Choose date range",
          chooseSlots: "Choose time slots",
          morning: "Morning",
          afternoon: "Afternoon",
          night: "Night",
          custom: "Custom",
          customTime: "Custom time",
          createCourse: "Create course schedule",
          activeCourses: "Active course schedules",
          noCourses: "No temporary medicine course created yet.",
          progress: "Progress",
          dayProgress: (completed: number, total: number) => `Day ${completed} of ${total} completed`,
          completedDays: "Completed days",
          remainingDays: "Remaining days",
          missedDays: "Missed days",
          selectedDay: "Selected day",
          markTaken: "Mark Taken",
          markMissed: "Mark Missed",
          reset: "Reset",
          removeCourse: "Remove Course",
          startDate: "Start date",
          endDate: "End date",
          timesPerDay: "Times per day",
          day: "Day",
          of: "of",
          statusTaken: "Taken",
          statusMissed: "Missed",
          statusPending: "Pending",
          createFirst: "Select a medicine name, date range, and at least one time slot",
          scheduleCreated: "Smart course created",
          courseRemoved: "Course removed",
          demoReadOnlyTitle: "Demo mode is read-only",
          demoReadOnlyDescription: "Turn off Demo mode to edit real course schedules.",
        };

  const [medicineName, setMedicineName] = useState("");
  const [range, setRange] = useState<DateRange | undefined>();
  const [selectedKinds, setSelectedKinds] = useState<SmartMedicineTimeSlotKind[]>(["custom"]);
  const [customTime, setCustomTime] = useState("08:00");
  const [timePeriod, setTimePeriod] = useState<"AM" | "PM">("AM");
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(schedules[0]?.id ?? null);
  const [selectedDayKey, setSelectedDayKey] = useState<string>(toDateKey(new Date()));
  const [createOpen, setCreateOpen] = useState(false);

  const notifyDemoReadOnly = () => {
    toast.info(copy.demoReadOnlyTitle, {
      description: copy.demoReadOnlyDescription,
    });
  };

  useEffect(() => {
    if (!schedules.length) {
      setSelectedScheduleId(null);
      return;
    }

    setSelectedScheduleId((current) =>
      current && schedules.some((schedule) => schedule.id === current) ? current : schedules[0].id
    );
  }, [schedules]);

  const selectedSchedule = schedules.find((schedule) => schedule.id === selectedScheduleId) ?? null;

  useEffect(() => {
    if (!selectedSchedule) return;
    const todayKey = toDateKey(new Date());
    setSelectedDayKey(isScheduleActiveOn(selectedSchedule, todayKey) ? todayKey : selectedSchedule.startDate);
  }, [selectedScheduleId, selectedSchedule]);

  const presetSlotIcons: Record<SmartMedicineTimeSlotKind, typeof Sunrise> = {
    morning: Sunrise,
    afternoon: SunMedium,
    night: MoonStar,
    custom: Timer,
  };
  const calendarLocale = language === "ta" ? ta : enUS;

  const localizedSlotLabel = (kind: SmartMedicineTimeSlotKind) =>
    ({
      morning: copy.morning,
      afternoon: copy.afternoon,
      night: copy.night,
      custom: copy.custom,
    })[kind];

  function toTwentyFourHourTime(value: string, period: "AM" | "PM") {
    const [rawHour, minute] = value.split(":").map(Number);
    const hour = period === "AM" ? rawHour % 12 : (rawHour % 12) + 12;
    return `${String(hour).padStart(2, "0")}:${String(minute || 0).padStart(2, "0")}`;
  }

  const draftedTimeSlots = useMemo<SmartMedicineTimeSlot[]>(() => {
    const presets: SmartMedicineTimeSlot[] = [];

    if (selectedKinds.includes("morning")) {
      presets.push({ id: "morning", kind: "morning", label: copy.morning, time: "08:00" });
    }
    if (selectedKinds.includes("afternoon")) {
      presets.push({ id: "afternoon", kind: "afternoon", label: copy.afternoon, time: "13:00" });
    }
    if (selectedKinds.includes("night")) {
      presets.push({ id: "night", kind: "night", label: copy.night, time: "20:00" });
    }
    if (selectedKinds.includes("custom") && customTime) {
      presets.push({
        id: `custom-${customTime}-${timePeriod}`,
        kind: "custom",
        label: copy.custom,
        time: toTwentyFourHourTime(customTime, timePeriod),
      });
    }

    return presets;
  }, [copy.afternoon, copy.custom, copy.morning, copy.night, customTime, selectedKinds, timePeriod]);

  const selectedDayEntry = selectedSchedule?.dailyStatus[selectedDayKey];
  const selectedScheduleProgress = selectedSchedule ? getScheduleProgress(selectedSchedule) : null;
  const selectedScheduleDates = selectedSchedule
    ? enumerateScheduleDates(selectedSchedule.startDate, selectedSchedule.endDate)
    : [];

  const handleToggleKind = (kind: SmartMedicineTimeSlotKind) => {
    setSelectedKinds((current) =>
      current.includes(kind) ? current.filter((value) => value !== kind) : [...current, kind]
    );
  };

  const adjustCustomTime = (field: "hour" | "minute", delta: number) => {
    setCustomTime((current) => {
      const [hour, minute] = current.split(":").map(Number);
      if (field === "hour") {
        const nextHour = ((hour - 1 + delta + 12) % 12) + 1;
        return `${String(nextHour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      }

      const nextMinute = (minute + delta + 60) % 60;
      return `${String(hour).padStart(2, "0")}:${String(nextMinute).padStart(2, "0")}`;
    });
    setSelectedKinds(["custom"]);
  };

  const setCustomTimePart = (field: "hour" | "minute", rawValue: string) => {
    const digits = rawValue.replace(/\D/g, "");
    if (!digits) return;

    setCustomTime((current) => {
      const [hour, minute] = current.split(":").map(Number);
      const parsed = Number(digits.slice(-2));

      if (field === "hour") {
        const nextHour = Math.min(12, Math.max(1, parsed));
        return `${String(nextHour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      }

      const nextMinute = Math.min(59, Math.max(0, parsed));
      return `${String(hour).padStart(2, "0")}:${String(nextMinute).padStart(2, "0")}`;
    });
    setSelectedKinds(["custom"]);
  };

  const handleCreateSchedule = () => {
    if (demoMode) {
      notifyDemoReadOnly();
      setCreateOpen(false);
      return;
    }

    if (!medicineName.trim() || !range?.from || !range?.to || draftedTimeSlots.length === 0) {
      toast.error(copy.createFirst);
      return;
    }

    const draft: SmartMedicineScheduleDraft = {
      medicineName,
      startDate: toDateKey(range.from),
      endDate: toDateKey(range.to),
      timeSlots: draftedTimeSlots,
    };

    onCreateSchedule(draft);
    toast.success(copy.scheduleCreated, {
      description: `${draft.medicineName} - ${format(range.from, "MMM d")} to ${format(range.to, "MMM d")}`,
    });
    setMedicineName("");
    setRange(undefined);
    setSelectedKinds(["custom"]);
    setCustomTime("08:00");
    setTimePeriod("AM");
    setCreateOpen(false);
  };

  const handleRemoveSchedule = (scheduleId: string) => {
    if (demoMode) {
      notifyDemoReadOnly();
      return;
    }

    onRemoveSchedule(scheduleId);
    toast(copy.courseRemoved);
  };

  const handleUpdateDayStatus = (status: SmartMedicineDayStatus) => {
    if (!selectedSchedule) return;

    if (demoMode) {
      notifyDemoReadOnly();
      return;
    }

    onUpdateDayStatus(selectedSchedule.id, selectedDayKey, status);
  };

  const activeDateSet = new Set(selectedScheduleDates);
  const completedDates = selectedScheduleDates.filter(
    (dateKey) => selectedSchedule?.dailyStatus[dateKey]?.status === "taken"
  );
  const missedDates = selectedScheduleDates.filter(
    (dateKey) => selectedSchedule?.dailyStatus[dateKey]?.status === "missed"
  );

  const calendarModifiers = {
    active: selectedScheduleDates.map(fromDateKey),
    completed: completedDates.map(fromDateKey),
    missed: missedDates.map(fromDateKey),
    focused: selectedDayKey ? [fromDateKey(selectedDayKey)] : [],
  };

  const dayStatusLabel =
    selectedDayEntry?.status === "taken"
      ? copy.statusTaken
      : selectedDayEntry?.status === "missed"
        ? copy.statusMissed
        : copy.statusPending;

  const DayContent = ({ date }: DayContentProps) => {
    const dateKey = toDateKey(date);
    const entry = selectedSchedule?.dailyStatus[dateKey];
    const selected = dateKey === selectedDayKey;
    const active = activeDateSet.has(dateKey);

    return (
      <div
        className={cn(
          "relative mx-auto flex h-11 w-11 items-center justify-center rounded-full font-bold transition-colors",
          active && "bg-primary-soft/70 text-primary",
          entry?.status === "taken" && "bg-success text-success-foreground",
          entry?.status === "missed" && "bg-destructive text-destructive-foreground",
          selected && "ring-2 ring-primary ring-offset-4 ring-offset-background"
        )}
      >
        <span>{format(date, "d")}</span>
      </div>
    );
  };

  return (
    <section className="rounded-3xl border border-border/60 bg-card p-4 shadow-card">
      <div className="mb-4">
        <div className="flex items-start gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="break-words text-lg font-extrabold text-foreground">{copy.title}</h3>
            <p className="text-sm leading-6 text-muted-foreground">{copy.subtitle}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="rounded-3xl border border-border/60 bg-card-gradient p-4 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-widest text-primary">{copy.activeCourses}</p>
              <p className="mt-1 text-sm font-medium text-muted-foreground">
                {schedules.length} {language === "ta" ? "course" : "course schedule(s)"}
              </p>
            </div>
            <Button
              type="button"
              onClick={() => {
                if (demoMode) {
                  notifyDemoReadOnly();
                  return;
                }
                setCreateOpen(true);
              }}
              className="h-11 shrink-0 rounded-2xl bg-primary px-4 font-bold text-primary-foreground"
            >
              <Plus className="mr-2 h-5 w-5" />
              {language === "ta" ? "சேர்" : "Add"}
            </Button>
          </div>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-h-[84vh] w-[calc(100vw-2rem)] max-w-[440px] overflow-y-auto rounded-3xl border-border bg-card p-4 text-foreground">
            <DialogHeader>
              <DialogTitle className="pr-7 text-lg font-extrabold text-foreground">{copy.createCourse}</DialogTitle>
              <DialogDescription className="text-sm leading-5">{copy.subtitle}</DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {copy.medicineName}
                </label>
                <Input
                  value={medicineName}
                  onChange={(event) => setMedicineName(event.target.value)}
                  placeholder={copy.medicinePlaceholder}
                  className="h-11 rounded-2xl text-sm"
                />
              </div>

              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {copy.chooseRange}
                </p>
                <div className="rounded-2xl border border-border bg-background/80">
                  <Calendar
                    mode="range"
                    locale={calendarLocale}
                    selected={range}
                    onSelect={setRange}
                    numberOfMonths={1}
                    className="w-full p-3"
                    classNames={{
                      months: "block w-full",
                      month: "w-full space-y-3",
                      caption: "relative flex min-h-8 items-center justify-center px-10 pb-1",
                      caption_label: "text-base font-extrabold text-foreground",
                      nav: "flex items-center",
                      nav_button:
                        "flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background p-0 text-muted-foreground opacity-100 shadow-none hover:bg-secondary hover:text-foreground",
                      nav_button_previous: "absolute left-1 top-0",
                      nav_button_next: "absolute right-1 top-0",
                      table: "w-full table-fixed border-collapse",
                      head_row: "grid grid-cols-7",
                      head_cell: "flex h-8 items-center justify-center text-xs font-semibold text-muted-foreground",
                      row: "mt-1.5 grid grid-cols-7",
                      cell: "flex h-10 min-w-0 items-center justify-center p-0 text-center",
                      day: "h-9 w-9 rounded-full p-0 text-sm font-semibold",
                      day_selected:
                        "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                      day_today: "bg-primary-soft text-primary",
                      day_outside: "text-muted-foreground opacity-45",
                      day_range_middle: "bg-primary-soft text-primary",
                    }}
                  />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm font-semibold text-foreground">
                  <div className="rounded-2xl bg-secondary px-3 py-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{copy.startDate}</p>
                    <p>{range?.from ? format(range.from, "PPP") : "--"}</p>
                  </div>
                  <div className="rounded-2xl bg-secondary px-3 py-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{copy.endDate}</p>
                    <p>{range?.to ? format(range.to, "PPP") : "--"}</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-foreground">
                  {copy.customTime}
                </label>
                <div className="mt-1 rounded-2xl border border-border bg-background p-2.5">
                  <div className="mb-2.5 flex items-center justify-between rounded-2xl bg-primary-soft px-3 py-2.5">
                    <div className="flex items-center gap-2 text-primary">
                      <Clock3 className="h-4 w-4" />
                      <span className="text-xl font-extrabold tabular-nums">
                        {customTime} {timePeriod}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-[1fr_1fr_3.25rem] gap-2">
                    <CourseTimeStepper
                      label={language === "ta" ? "மணி" : "Hour"}
                      value={customTime.split(":")[0]}
                      onChange={(value) => setCustomTimePart("hour", value)}
                      onIncrement={() => adjustCustomTime("hour", 1)}
                      onDecrement={() => adjustCustomTime("hour", -1)}
                    />
                    <CourseTimeStepper
                      label={language === "ta" ? "நிமிடம்" : "Minute"}
                      value={customTime.split(":")[1]}
                      onChange={(value) => setCustomTimePart("minute", value)}
                      onIncrement={() => adjustCustomTime("minute", 1)}
                      onDecrement={() => adjustCustomTime("minute", -1)}
                    />
                    <div className="grid overflow-hidden rounded-2xl border border-border bg-card">
                      {(["AM", "PM"] as const).map((period) => (
                        <button
                          key={period}
                          type="button"
                          onClick={() => {
                            setTimePeriod(period);
                            setSelectedKinds(["custom"]);
                          }}
                          className={cn(
                            "text-sm font-extrabold transition-colors",
                            timePeriod === period ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                          )}
                        >
                          {period}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleCreateSchedule}
                className="h-11 w-full rounded-2xl bg-primary font-bold text-primary-foreground hover:opacity-95"
              >
                <Plus className="mr-2 h-5 w-5" />
                {copy.createCourse}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <div className="space-y-4 rounded-3xl border border-border/60 bg-background/80 p-3">
          {selectedSchedule ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold uppercase tracking-widest text-primary">{copy.progress}</p>
                  <h4 className="break-words text-xl font-extrabold text-foreground">{selectedSchedule.medicineName}</h4>
                  <p className="text-sm font-medium text-muted-foreground">
                    {copy.dayProgress(
                      selectedScheduleProgress?.completedDays || 0,
                      selectedScheduleProgress?.totalDays || 0
                    )}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleRemoveSchedule(selectedSchedule.id)}
                  className="rounded-2xl"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {copy.removeCourse}
                </Button>
              </div>

              <div className="hidden grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-3">
                <ProgressCard label={copy.completedDays} value={selectedScheduleProgress?.completedDays || 0} tone="success" />
                <ProgressCard label={copy.remainingDays} value={selectedScheduleProgress?.remainingDays || 0} tone="primary" />
                <ProgressCard label={copy.missedDays} value={selectedScheduleProgress?.missedDays || 0} tone="destructive" />
              </div>

              <div className="rounded-2xl border border-border bg-card px-4 py-4">
                <Calendar
                  mode="single"
                  locale={calendarLocale}
                  selected={selectedDayKey ? fromDateKey(selectedDayKey) : undefined}
                  onSelect={(date) => {
                    if (!date) return;
                    const dateKey = toDateKey(date);
                    if (activeDateSet.has(dateKey)) {
                      setSelectedDayKey(dateKey);
                    }
                  }}
                  modifiers={calendarModifiers}
                  modifiersClassNames={{
                    active: "bg-transparent hover:bg-transparent",
                    completed: "bg-transparent hover:bg-transparent",
                    missed: "bg-transparent hover:bg-transparent",
                    focused: "bg-transparent hover:bg-transparent",
                  }}
                  disabled={(date) => !activeDateSet.has(toDateKey(date))}
                  className="w-full p-0"
                  classNames={{
                    months: "block w-full",
                    month: "w-full space-y-4",
                    caption: "relative flex min-h-9 items-center justify-center px-12 pb-2",
                    caption_label: "text-base font-extrabold text-foreground",
                    nav: "flex items-center",
                    nav_button:
                      "flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background p-0 text-muted-foreground opacity-100 shadow-none hover:bg-secondary hover:text-foreground",
                    nav_button_previous: "absolute left-1 top-0",
                    nav_button_next: "absolute right-1 top-0",
                    table: "w-full table-fixed border-collapse",
                    head_row: "grid grid-cols-7",
                    head_cell: "flex h-9 items-center justify-center text-sm font-semibold text-muted-foreground",
                    row: "mt-2 grid grid-cols-7",
                    cell: "flex h-14 min-w-0 items-center justify-center p-0 text-center",
                    day: "h-14 w-full rounded-none p-0 text-base font-semibold hover:bg-transparent focus:bg-transparent",
                    day_outside: "text-muted-foreground opacity-45",
                    day_disabled: "text-muted-foreground opacity-50",
                  }}
                  components={{ DayContent }}
                />
              </div>

              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      {copy.selectedDay}
                    </p>
                    <p className="font-bold text-foreground">
                      {fromDateKey(selectedDayKey).toLocaleDateString(
                        language === "ta" ? "ta-IN" : "en-US",
                        { weekday: "long", month: "long", day: "numeric" }
                      )}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-bold",
                      selectedDayEntry?.status === "taken"
                        ? "bg-success-soft text-success"
                        : selectedDayEntry?.status === "missed"
                          ? "bg-destructive-soft text-destructive"
                          : "bg-primary-soft text-primary"
                    )}
                  >
                    {dayStatusLabel}
                  </span>
                </div>

                <div className="mb-3 flex flex-wrap gap-2">
                  {selectedSchedule.timeSlots.map((slot) => (
                    <span
                      key={slot.id}
                      className="inline-flex max-w-full items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs font-bold text-foreground"
                    >
                      <Clock3 className="h-3.5 w-3.5" />
                      {localizedSlotLabel(slot.kind)} - {slot.time}
                    </span>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleUpdateDayStatus("taken")}
                    className="h-auto min-h-12 whitespace-normal rounded-2xl border-success/30 px-3 py-2 text-center leading-5 text-success hover:bg-success-soft"
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 break-words">{copy.markTaken}</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleUpdateDayStatus("missed")}
                    className="h-auto min-h-12 whitespace-normal rounded-2xl border-destructive/30 px-3 py-2 text-center leading-5 text-destructive hover:bg-destructive-soft"
                  >
                    <XCircle className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 break-words">{copy.markMissed}</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleUpdateDayStatus("pending")}
                    className="h-auto min-h-12 whitespace-normal rounded-2xl px-3 py-2 text-center leading-5"
                  >
                    <span className="min-w-0 break-words">{copy.reset}</span>
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-secondary/40 px-4 py-10 text-center text-sm font-medium text-muted-foreground">
              {copy.noCourses}
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 hidden">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-extrabold uppercase tracking-wider text-foreground">
            {copy.activeCourses}
          </h4>
          <span className="text-xs font-semibold text-muted-foreground">{schedules.length}</span>
        </div>

        <div className="space-y-3">
          {schedules.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-secondary/40 px-4 py-8 text-center text-sm font-medium text-muted-foreground">
              {copy.noCourses}
            </div>
          ) : (
            schedules.map((schedule) => {
              const progress = getScheduleProgress(schedule);
              const dayNumber = getScheduleDayNumber(schedule, selectedDayKey);
              const selected = schedule.id === selectedScheduleId;

              return (
                <button
                  key={schedule.id}
                  type="button"
                  onClick={() => setSelectedScheduleId(schedule.id)}
                  className={cn(
                    "w-full rounded-2xl border p-4 text-left transition-all",
                    selected
                      ? "border-primary bg-primary-soft/40 shadow-soft"
                      : "border-border bg-card hover:bg-secondary/30"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words font-bold text-foreground">{schedule.medicineName}</p>
                      <p className="text-sm font-medium text-muted-foreground">
                        {format(fromDateKey(schedule.startDate), "MMM d")} - {format(fromDateKey(schedule.endDate), "MMM d")}
                      </p>
                    </div>
                    <span className="max-w-full break-words rounded-full bg-card px-3 py-1 text-xs font-bold text-primary">
                      {copy.day} {Math.max(dayNumber, 1)} {copy.of} {progress.totalDays}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {schedule.timeSlots.map((slot) => (
                      <span
                        key={slot.id}
                        className="inline-flex max-w-full items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-bold text-foreground"
                      >
                        {localizedSlotLabel(slot.kind)} - {slot.time}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
};

const ProgressCard = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "primary" | "success" | "destructive";
}) => {
  const tones = {
    primary: "bg-primary-soft text-primary",
    success: "bg-success-soft text-success",
    destructive: "bg-destructive-soft text-destructive",
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-3 text-center">
      <div className={cn("mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-2xl", tones[tone])}>
        <CalendarDays className="h-4 w-4" />
      </div>
      <p className="text-xl font-extrabold text-foreground">{value}</p>
      <p className="break-words text-[11px] font-semibold uppercase tracking-wide leading-4 text-muted-foreground">{label}</p>
    </div>
  );
};

const CourseTimeStepper = ({
  label,
  value,
  onChange,
  onIncrement,
  onDecrement,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onIncrement: () => void;
  onDecrement: () => void;
}) => (
  <div className="rounded-2xl border border-border bg-card p-1.5 text-center">
    <p className="mb-1 text-[10px] font-bold uppercase text-muted-foreground">{label}</p>
    <div className="flex items-center justify-center gap-1.5">
      <button
        type="button"
        onClick={onDecrement}
        className="flex h-7 w-7 items-center justify-center rounded-xl bg-secondary text-foreground"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={2}
        className="h-7 w-8 rounded-lg border-0 bg-transparent p-0 text-center text-base font-extrabold tabular-nums text-foreground outline-none focus:bg-secondary"
        aria-label={label}
      />
      <button
        type="button"
        onClick={onIncrement}
        className="flex h-7 w-7 items-center justify-center rounded-xl bg-primary text-primary-foreground"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  </div>
);

export default SmartScheduleCalendar;
