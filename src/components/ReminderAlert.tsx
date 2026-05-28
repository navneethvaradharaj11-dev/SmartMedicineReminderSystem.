import { useEffect, useRef } from "react";
import { Pill, Clock, Check, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { nextDose } from "@/data/medicine";
import { AppLanguage } from "@/lib/appLanguage";
import { SmartScheduleReminder } from "@/lib/smartMedicineSchedule";

export interface MedicineTimeReminder {
  scheduleId?: string;
  medicineName: string;
  dosage?: string;
  time: string;
}

interface ReminderAlertProps {
  language?: AppLanguage;
  smartReminder?: SmartScheduleReminder | null;
  medicineReminder?: MedicineTimeReminder | null;
  open: boolean;
  soundEnabled?: boolean;
  onTaken: () => void;
  onSnooze: () => void;
}

const ReminderAlert = ({
  language = "en",
  smartReminder,
  medicineReminder,
  open,
  soundEnabled = true,
  onTaken,
  onSnooze,
}: ReminderAlertProps) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const alarmIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open || !soundEnabled || typeof window === "undefined") return;

    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) return;

    const audioContext = new AudioContextConstructor();
    audioContextRef.current = audioContext;

    const playAlarmPulse = () => {
      if (audioContext.state === "closed") return;

      void audioContext.resume();

      const now = audioContext.currentTime;
      const masterGain = audioContext.createGain();
      const compressor = audioContext.createDynamicsCompressor();

      compressor.threshold.setValueAtTime(-26, now);
      compressor.knee.setValueAtTime(18, now);
      compressor.ratio.setValueAtTime(3, now);
      compressor.attack.setValueAtTime(0.02, now);
      compressor.release.setValueAtTime(0.3, now);

      masterGain.gain.setValueAtTime(0.0001, now);
      masterGain.gain.linearRampToValueAtTime(0.32, now + 0.08);
      masterGain.gain.setValueAtTime(0.32, now + 0.38);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.72);

      masterGain.connect(compressor);
      compressor.connect(audioContext.destination);

      const alarmTones = [
        { frequency: 523.25, start: 0, duration: 0.42, type: "sine" as OscillatorType },
        { frequency: 659.25, start: 0.16, duration: 0.48, type: "triangle" as OscillatorType },
      ];

      alarmTones.forEach(({ frequency, start, duration, type }) => {
        const tone = audioContext.createOscillator();

        tone.type = type;
        tone.frequency.setValueAtTime(frequency, now + start);
        tone.connect(masterGain);
        tone.start(now + start);
        tone.stop(now + start + duration);
      });
    };

    playAlarmPulse();
    alarmIntervalRef.current = window.setInterval(playAlarmPulse, 2400);

    return () => {
      if (alarmIntervalRef.current !== null) {
        window.clearInterval(alarmIntervalRef.current);
        alarmIntervalRef.current = null;
      }

      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        void audioContextRef.current.close();
      }
      audioContextRef.current = null;
    };
  }, [open, soundEnabled]);

  if (!open) return null;

  const copy =
    language === "ta"
      ? {
          title: "மருந்து எடுத்துக்கொள்ள வேண்டிய நேரம்",
          snooze: "ஒத்திவைக்கவும்",
          taken: "எடுத்துவிட்டேன்",
        }
      : {
          title: "Time for your medicine",
          snooze: "Snooze",
          taken: "Taken",
        };

  const reminderTitle = smartReminder?.medicineName || medicineReminder?.medicineName || nextDose.name;
  const reminderSubtitle = smartReminder
    ? language === "ta"
      ? `நாள் ${smartReminder.dayNumber}/${smartReminder.totalDays} • ${smartReminder.slotLabel}`
      : `Day ${smartReminder.dayNumber}/${smartReminder.totalDays} • ${smartReminder.slotLabel}`
    : medicineReminder?.dosage || nextDose.dosage;
  const reminderTime = smartReminder?.time || medicineReminder?.time || nextDose.time;

  return (
    <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/45 p-4 backdrop-blur-sm animate-in fade-in duration-200 sm:items-center">
      <div
        className="w-full max-w-md rounded-3xl border border-border/60 bg-card p-5 shadow-float animate-in slide-in-from-bottom duration-300 sm:p-6"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="medicine-reminder-title"
        aria-live="assertive"
      >
        <div className="flex flex-col items-center text-center">
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-primary-soft text-primary shadow-soft">
            <Pill className="h-11 w-11 text-primary" strokeWidth={2.2} />
            <span className="absolute inset-0 animate-pulse rounded-full border-4 border-primary/20" />
          </div>
          <h2 id="medicine-reminder-title" className="mt-5 break-words text-2xl font-extrabold leading-tight text-foreground">
            {copy.title}
          </h2>
          <p className="mt-1.5 break-words text-base font-medium leading-6 text-muted-foreground">
            {reminderTitle} - {reminderSubtitle}
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-primary-soft px-3 py-1.5 text-sm font-bold text-primary">
            <Clock className="h-4 w-4" />
            {reminderTime}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-3">
          <Button
            onClick={onSnooze}
            variant="outline"
            className="h-auto min-h-14 whitespace-normal rounded-2xl border-2 px-3 py-3 text-center text-base font-bold leading-5 hover:bg-secondary"
          >
            <BellOff className="mr-2 h-5 w-5" />
            {copy.snooze}
          </Button>
          <Button
            onClick={onTaken}
            className="h-auto min-h-14 whitespace-normal rounded-2xl bg-success-gradient px-3 py-3 text-center text-base font-bold leading-5 text-success-foreground shadow-soft hover:opacity-95"
          >
            <Check className="mr-2 h-5 w-5" strokeWidth={2.8} />
            {copy.taken}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ReminderAlert;
