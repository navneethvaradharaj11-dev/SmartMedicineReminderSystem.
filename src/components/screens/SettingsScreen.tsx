import { ReactNode, SetStateAction, useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  Clock,
  Minus,
  Pill,
  Plus,
  Trash2,
} from "lucide-react";
import ScreenHeader from "@/components/ScreenHeader";
import SmartScheduleCalendar from "@/components/schedules/SmartScheduleCalendar";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Schedule } from "@/data/medicine";
import { AppLanguage } from "@/lib/appLanguage";
import {
  SmartMedicineDayStatus,
  SmartMedicineSchedule,
  SmartMedicineScheduleDraft,
} from "@/lib/smartMedicineSchedule";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SettingsScreenProps {
  language?: AppLanguage;
  pillBoxConnected?: boolean;
  systemDeviceReady?: boolean;
  nativeWindowsKnown?: boolean;
  nativeWindowsConnected?: boolean;
  connectionTransport?: "serial" | "bluetooth" | null;
  deviceName?: string;
  schedules: Schedule[];
  onSchedulesChange: (updater: SetStateAction<Schedule[]>) => void;
  snoozeMinutes: number;
  onSnoozeMinutesChange: (minutes: number) => void;
  smartSchedules: SmartMedicineSchedule[];
  onCreateSmartSchedule: (draft: SmartMedicineScheduleDraft) => void;
  onUpdateSmartScheduleDayStatus: (
    scheduleId: string,
    dateKey: string,
    status: SmartMedicineDayStatus
  ) => void;
  onRemoveSmartSchedule: (scheduleId: string) => void;
  demoMode?: boolean;
}

const SettingsScreen = ({
  language = "en",
  pillBoxConnected = false,
  systemDeviceReady = false,
  nativeWindowsKnown = false,
  nativeWindowsConnected = false,
  connectionTransport,
  deviceName,
  schedules,
  onSchedulesChange,
  snoozeMinutes,
  onSnoozeMinutesChange,
  smartSchedules,
  onCreateSmartSchedule,
  onUpdateSmartScheduleDayStatus,
  onRemoveSmartSchedule,
  demoMode = false,
}: SettingsScreenProps) => {
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTime, setNewTime] = useState("08:00");
  const [timePeriod, setTimePeriod] = useState<"AM" | "PM">("AM");
  const screenRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    screenRef.current?.scrollTo({ top: 0 });
  }, []);

  const copy =
    language === "ta"
      ? {
          title: "அமைப்புகள்",
          subtitle: "உங்கள் நினைவூட்டல்களை நிர்வகிக்கவும்",
          sections: {
            medicineTimes: "மருந்து நேரங்கள்",
            reminderInterval: "நினைவூட்டல் இடைவெளி",
            alerts: "எச்சரிக்கைகள்",
            device: "சாதனம்",
          },
          cancel: "ரத்து செய்யவும்",
          addMedicine: "புதிய மருந்தை சேர்க்கவும்",
          medicineName: "மருந்து பெயர்",
          medicinePlaceholder: "எ.கா. Vitamin C - 500 mg",
          time: "நேரம்",
          addMedicineButton: "மருந்தை சேர்க்கவும்",
          snoozeBy: "நினைவூட்டலை இத்தனை நேரம் ஒத்திவைக்கவும்",
          minutesShort: "நிமி",
          enableReminders: "நினைவூட்டல்களை இயக்கவும்",
          soundAlerts: "ஒலி எச்சரிக்கைகள்",
          voiceGuidance: "டாக்பேக் முறை",
          testVoice: "டாக்பேக் சோதனை",
          smartPillBox: "ஸ்மார்ட் மருந்துப் பெட்டி",
          connected: "இணைக்கப்பட்டுள்ளது",
          connectedInWindows: "இந்த சாதனத்தில் இணைக்கப்பட்டுள்ளது",
          pairedAndReady: "இணைக்கப்பட்டு தயாராக உள்ளது",
          disconnected: "துண்டிக்கப்பட்டது",
          noDeviceConnected: "எந்த சாதனமும் இணைக்கப்படவில்லை",
          unnamedConnectedDevice: "பெயரில்லா இணைக்கப்பட்ட சாதனம்",
          windowsConnectedDevice: "இணைக்கப்பட்ட சாதனம்",
          savedDeviceAccess: "சேமித்த சாதன அணுகல் கண்டறியப்பட்டது",
          pairFirst: "முதலில் புளூடூத் அமைப்புகளில் இணைக்கவும்",
          connectedDevice: "இணைக்கப்பட்ட சாதனம்",
          rememberedDevice: "நினைவில் உள்ள சாதனம்",
          windowsSeesDevice: "இந்த சாதனம் கண்டறியப்பட்டது, ஆனால் தற்போது இணைக்கப்படவில்லை",
          enterMedicine: "மருந்தின் பெயரை உள்ளிடவும்",
          medicineAdded: "மருந்து சேர்க்கப்பட்டது",
          activeTransportVia: "வழியாக",
        }
      : {
          title: "Settings",
          subtitle: "Manage your reminders",
          sections: {
            medicineTimes: "Medicine Times",
            reminderInterval: "Reminder Interval",
            alerts: "Alerts",
            device: "Device",
          },
          cancel: "Cancel",
          addMedicine: "Add new medicine",
          medicineName: "Medicine name",
          medicinePlaceholder: "e.g. Vitamin C - 500 mg",
          time: "Time",
          addMedicineButton: "Add medicine",
          snoozeBy: "Snooze reminder by",
          minutesShort: "min",
          enableReminders: "Enable reminders",
          soundAlerts: "Sound alerts",
          voiceGuidance: "TalkBack mode",
          testVoice: "Test TalkBack",
          smartPillBox: "Smart pill box",
          connected: "Connected",
          connectedInWindows: "Connected on this device",
          pairedAndReady: "Paired and ready",
          disconnected: "Disconnected",
          noDeviceConnected: "No device connected",
          unnamedConnectedDevice: "Unnamed connected device",
          windowsConnectedDevice: "Connected device",
          savedDeviceAccess: "Saved device access detected",
          pairFirst: "Pair in Bluetooth settings first",
          connectedDevice: "Connected device",
          rememberedDevice: "Remembered device",
          windowsSeesDevice: "This device was detected, but it is not currently connected",
          enterMedicine: "Please enter a medicine name",
          medicineAdded: "Medicine added",
          activeTransportVia: "via",
        };

  const handleAdd = () => {
    if (demoMode) {
      toast.info("Demo mode is read-only", {
        description: "Turn off Demo mode to edit real medicines.",
      });
      return;
    }

    if (!newName.trim()) {
      toast.error(copy.enterMedicine);
      return;
    }

    const [rawHour, mm] = newTime.split(":").map(Number);
    const period = timePeriod;
    const displayHour = rawHour;
    const timeStr = `${displayHour}:${String(mm).padStart(2, "0")} ${period}`;

    onSchedulesChange((prev) => [
      ...prev,
      {
        id: `s${Date.now()}`,
        name: newName.trim(),
        time: timeStr,
        enabled: true,
        stock: 30,
        expiresInDays: 180,
      },
    ]);

    setNewName("");
    setNewTime("08:00");
    setTimePeriod("AM");
    setShowAdd(false);
    toast.success(copy.medicineAdded, { description: `${newName} - ${timeStr}` });
  };

  const adjustNewTime = (field: "hour" | "minute", delta: number) => {
    setNewTime((current) => {
      const [hour, minute] = current.split(":").map(Number);
      if (field === "hour") {
        const nextHour = ((hour - 1 + delta + 12) % 12) + 1;
        return `${String(nextHour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      }

      const nextMinute = (minute + delta + 60) % 60;
      return `${String(hour).padStart(2, "0")}:${String(nextMinute).padStart(2, "0")}`;
    });
  };

  const setNewTimePart = (field: "hour" | "minute", rawValue: string) => {
    const digits = rawValue.replace(/\D/g, "");
    if (!digits) return;

    setNewTime((current) => {
      const [hour, minute] = current.split(":").map(Number);
      const parsed = Number(digits.slice(-2));

      if (field === "hour") {
        const nextHour = Math.min(12, Math.max(1, parsed));
        return `${String(nextHour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      }

      const nextMinute = Math.min(59, Math.max(0, parsed));
      return `${String(hour).padStart(2, "0")}:${String(nextMinute).padStart(2, "0")}`;
    });
  };

  const updateSnoozeMinutes = (value: number) => {
    if (!Number.isFinite(value)) return;
    onSnoozeMinutesChange(Math.min(180, Math.max(1, Math.round(value))));
  };

  const handleRemoveMedicine = (scheduleId: string) => {
    if (demoMode) {
      toast.info("Demo mode is read-only", {
        description: "Turn off Demo mode to remove real medicines.",
      });
      return;
    }

    const removedSchedule = schedules.find((schedule) => schedule.id === scheduleId);
    onSchedulesChange((prev) => prev.filter((schedule) => schedule.id !== scheduleId));
    toast.success(language === "ta" ? "மருந்து நீக்கப்பட்டது" : "Medicine removed", {
      description: removedSchedule?.name,
    });
  };

  const activeSchedules = schedules.filter((schedule) => schedule.enabled).length;
  return (
    <div ref={screenRef} className="flex-1 overflow-y-auto bg-page text-foreground">
      <ScreenHeader title={copy.title} subtitle={copy.subtitle} />
      <div className="mx-auto w-full max-w-xl space-y-4 px-5 pb-28 sm:px-6">
        {demoMode && (
          <div className="rounded-2xl border border-primary/20 bg-primary-soft px-4 py-3 text-sm font-bold text-primary shadow-card">
            Demo mode is active. Medicine and course edits are locked for the client walkthrough.
          </div>
        )}

        <section className="grid grid-cols-2 gap-3">
          <StatusTile
            Icon={Pill}
            label={language === "ta" ? "Active meds" : "Active meds"}
            value={`${activeSchedules}/${schedules.length}`}
            tone="success"
          />
          <StatusTile
            Icon={CalendarDays}
            label={language === "ta" ? "Course calendar" : "Course calendar"}
            value={String(smartSchedules.length)}
            tone={smartSchedules.length ? "primary" : "muted"}
          />
        </section>

        <Section title={copy.sections.medicineTimes}>
          <ul className="overflow-hidden rounded-2xl border border-border bg-card shadow-card divide-y divide-border">
            {schedules.map((schedule) => {
              return (
                <li key={schedule.id} className="flex flex-wrap items-center gap-3 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft">
                    <Pill className="h-5 w-5 text-primary" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="break-words font-semibold text-foreground">{schedule.name}</p>
                    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      {schedule.time}
                    </p>
                  </div>

                  <div className="ml-auto flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleRemoveMedicine(schedule.id)}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground shadow-card transition-colors hover:border-destructive/35 hover:bg-destructive-soft hover:text-destructive"
                      aria-label={`Remove ${schedule.name}`}
                      title="Remove"
                    >
                      <Trash2 className="h-4.5 w-4.5" strokeWidth={2.25} />
                    </button>
                    <Switch
                      checked={schedule.enabled}
                      disabled={demoMode}
                      onCheckedChange={(checked) =>
                        onSchedulesChange((prev) =>
                          prev.map((item) =>
                            item.id === schedule.id ? { ...item, enabled: checked } : item
                          )
                        )
                      }
                    />
                  </div>
                </li>
              );
            })}

            <li>
              <button
                onClick={() => setShowAdd(true)}
                className="flex w-full items-center gap-3 p-4 text-left font-semibold text-primary transition-colors hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-dashed border-primary/40">
                  <Plus className="h-5 w-5" />
                </div>
                {copy.addMedicine}
              </button>
            </li>
          </ul>
        </Section>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogContent className="max-h-[80vh] w-[calc(100vw-2rem)] max-w-[420px] overflow-y-auto rounded-3xl border-border bg-card p-4 text-foreground">
            <DialogHeader>
              <DialogTitle className="pr-7 text-lg font-extrabold text-foreground">{copy.addMedicine}</DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-foreground">
                  {copy.medicineName}
                </label>
                <Input
                  placeholder={copy.medicinePlaceholder}
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  className="mt-1 h-11 rounded-xl bg-background text-sm text-foreground"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-foreground">
                  {copy.time}
                </label>
                <div className="mt-1 rounded-2xl border border-border bg-background p-2.5">
                  <div className="mb-2.5 flex items-center justify-between rounded-2xl bg-primary-soft px-3 py-2.5">
                    <div className="flex items-center gap-2 text-primary">
                      <Clock className="h-4 w-4" />
                      <span className="text-xl font-extrabold tabular-nums">
                        {newTime} {timePeriod}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-[1fr_1fr_3.25rem] gap-2">
                    <TimeStepper
                      label={language === "ta" ? "மணி" : "Hour"}
                      value={newTime.split(":")[0]}
                      onChange={(value) => setNewTimePart("hour", value)}
                      onIncrement={() => adjustNewTime("hour", 1)}
                      onDecrement={() => adjustNewTime("hour", -1)}
                    />
                    <TimeStepper
                      label={language === "ta" ? "நிமிடம்" : "Minute"}
                      value={newTime.split(":")[1]}
                      onChange={(value) => setNewTimePart("minute", value)}
                      onIncrement={() => adjustNewTime("minute", 1)}
                      onDecrement={() => adjustNewTime("minute", -1)}
                    />
                    <div className="grid overflow-hidden rounded-2xl border border-border bg-card">
                      {(["AM", "PM"] as const).map((period) => (
                        <button
                          key={period}
                          type="button"
                          onClick={() => setTimePeriod(period)}
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
                onClick={handleAdd}
                className="h-11 w-full rounded-xl bg-primary font-bold text-primary-foreground hover:opacity-95"
              >
                <Plus className="mr-1.5 h-5 w-5" strokeWidth={2.5} />
                {copy.addMedicineButton}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Section title={language === "ta" ? "Course calendar" : "Course calendar"}>
          <SmartScheduleCalendar
            language={language}
            demoMode={demoMode}
            schedules={smartSchedules}
            onCreateSchedule={onCreateSmartSchedule}
            onUpdateDayStatus={onUpdateSmartScheduleDayStatus}
            onRemoveSchedule={onRemoveSmartSchedule}
          />
        </Section>

        <Section title={copy.sections.reminderInterval}>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">{copy.snoozeBy}</p>
              <span className="shrink-0 rounded-full bg-primary-soft px-3 py-1 text-xs font-extrabold text-primary">
                {snoozeMinutes} {copy.minutesShort}
              </span>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(90px,1fr))] gap-2">
              {[5, 10, 15, 30].map((minutes) => (
                <button
                  key={minutes}
                  onClick={() => updateSnoozeMinutes(minutes)}
                  className={cn(
                    "min-h-11 rounded-xl border px-2 py-2.5 text-sm font-bold leading-5 transition-colors",
                    snoozeMinutes === minutes
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:bg-secondary"
                  )}
                >
                  {minutes} {copy.minutesShort}
                </button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-[2.75rem_1fr_2.75rem] gap-2">
              <button
                type="button"
                onClick={() => updateSnoozeMinutes(snoozeMinutes - 1)}
                className="flex h-11 items-center justify-center rounded-xl border border-border bg-background text-foreground transition-colors hover:bg-secondary"
                aria-label="Decrease snooze"
              >
                <Minus className="h-4 w-4" />
              </button>
              <div className="relative">
                <Input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={snoozeMinutes}
                  onChange={(event) => updateSnoozeMinutes(Number(event.target.value.replace(/\D/g, "")))}
                  className="h-11 rounded-xl bg-background pr-16 text-center text-base font-extrabold text-foreground"
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                  {copy.minutesShort}
                </span>
              </div>
              <button
                type="button"
                onClick={() => updateSnoozeMinutes(snoozeMinutes + 1)}
                className="flex h-11 items-center justify-center rounded-xl border border-border bg-primary text-primary-foreground transition-opacity hover:opacity-90"
                aria-label="Increase snooze"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        </Section>

      </div>
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section>
    <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</h2>
    {children}
  </section>
);

const StatusTile = ({
  Icon,
  label,
  value,
  tone,
}: {
  Icon: typeof Pill;
  label: string;
  value: string;
  tone: "primary" | "success" | "muted";
}) => {
  const tones = {
    primary: "bg-primary-soft text-primary",
    success: "bg-success-soft text-success",
    muted: "bg-muted text-muted-foreground",
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-center gap-3">
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="break-words text-[11px] font-bold uppercase leading-4 text-muted-foreground">{label}</p>
          <p className="mt-0.5 break-words text-lg font-extrabold text-foreground">{value}</p>
        </div>
      </div>
    </div>
  );
};

const TimeStepper = ({
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

export default SettingsScreen;
