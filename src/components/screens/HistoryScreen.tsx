import { CheckCircle2, XCircle, Pill } from "lucide-react";
import ScreenHeader from "@/components/ScreenHeader";
import { history } from "@/data/medicine";
import { AppLanguage, getAppLocale } from "@/lib/appLanguage";
import { cn } from "@/lib/utils";

const HistoryScreen = ({ language = "en" }: { language?: AppLanguage }) => {
  const locale = getAppLocale(language);
  const copy =
    language === "ta"
      ? {
          title: "மருந்து வரலாறு",
          subtitle: "உங்கள் சமீபத்திய மருந்து வரலாறு",
          adherenceTitle: "சிறந்த பின்பற்றல்!",
          adherenceSuffix: "மருந்துகள் எடுத்தார்",
          taken: "எடுத்தார்",
          missed: "தவறியது",
          dateLabels: {
            Today: "இன்று",
            Yesterday: "நேற்று",
          } as Record<string, string>,
        }
      : {
          title: "Dose History",
          subtitle: "Your recent medicine record",
          adherenceTitle: "Great adherence!",
          adherenceSuffix: "doses taken",
          taken: "Taken",
          missed: "Missed",
          dateLabels: {
            Today: "Today",
            Yesterday: "Yesterday",
          } as Record<string, string>,
        };

  const formatHistoryDate = (value: string) => {
    if (copy.dateLabels[value]) return copy.dateLabels[value];

    const parsedDate = new Date(`${value}, ${new Date().getFullYear()}`);
    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate.toLocaleDateString(locale, { month: "long", day: "numeric" });
    }

    return value;
  };

  const grouped = history.reduce<Record<string, typeof history>>((acc, dose) => {
    (acc[dose.date] ||= []).push(dose);
    return acc;
  }, {});

  const takenCount = history.filter((dose) => dose.status === "taken").length;
  const missedCount = history.filter((dose) => dose.status === "missed").length;
  const adherence = Math.round((takenCount / history.length) * 100);
  const weeklyBars = [
    { label: language === "ta" ? "தி" : "Mon", value: 100 },
    { label: language === "ta" ? "செ" : "Tue", value: 100 },
    { label: language === "ta" ? "பு" : "Wed", value: 67 },
    { label: language === "ta" ? "வி" : "Thu", value: 100 },
    { label: language === "ta" ? "வெ" : "Fri", value: 100 },
    { label: language === "ta" ? "சனி" : "Sat", value: 100 },
    { label: language === "ta" ? "ஞா" : "Sun", value: 67 },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-page">
      <ScreenHeader title={copy.title} subtitle={copy.subtitle} />

      <div className="px-5 sm:px-6">
        <div className="mx-auto mb-5 hidden w-full max-w-xl items-center gap-4 rounded-2xl border border-border/60 bg-card-gradient p-4 shadow-card">
          <div className="relative h-14 w-14 shrink-0">
            <svg className="h-14 w-14 -rotate-90">
              <circle cx="28" cy="28" r="24" stroke="hsl(var(--muted))" strokeWidth="5" fill="none" />
              <circle
                cx="28"
                cy="28"
                r="24"
                stroke="hsl(var(--success))"
                strokeWidth="5"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 24}
                strokeDashoffset={2 * Math.PI * 24 * (1 - adherence / 100)}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-extrabold text-success">
              {adherence}%
            </span>
          </div>

          <div className="flex-1">
            <p className="text-sm font-bold text-foreground">{copy.adherenceTitle}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {takenCount} / {history.length} {copy.adherenceSuffix}
            </p>
          </div>
        </div>

        <div className="mx-auto mb-5 grid w-full max-w-xl gap-3">
          <div className="hidden rounded-2xl border border-border/60 bg-card p-4 shadow-card">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-extrabold text-foreground">
                  {language === "ta" ? "நிலை பிரிவு" : "Status split"}
                </h2>
                <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                  {language === "ta" ? "எடுத்தது மற்றும் தவறியது" : "Taken versus missed doses"}
                </p>
              </div>
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-success-soft text-sm font-extrabold text-success">
                {takenCount}:{missedCount}
              </div>
            </div>
            <div className="grid grid-cols-[1fr_auto] items-center gap-4">
              <div className="h-5 overflow-hidden rounded-full bg-destructive-soft">
                <div className="h-full rounded-full bg-success animate-grow-x" style={{ width: `${adherence}%` }} />
              </div>
              <span className="text-sm font-extrabold text-foreground">{adherence}%</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <SplitStat label={copy.taken} value={takenCount} tone="success" />
              <SplitStat label={copy.missed} value={missedCount} tone="destructive" />
            </div>
          </div>

          <div className="rounded-3xl border border-border/60 bg-card p-4 shadow-card">
            <div className="mb-3 flex items-center justify-between gap-3 px-1">
              <h2 className="text-base font-extrabold text-foreground">
                {language === "ta" ? "வார வரைபடம்" : "Weekly graph"}
              </h2>
              <span className="rounded-full bg-primary-soft px-3 py-1.5 text-[11px] font-extrabold text-primary shadow-soft">
                7 {language === "ta" ? "நாட்கள்" : "days"}
              </span>
            </div>
            <div className="grid h-32 grid-cols-7 items-end gap-2 rounded-3xl border border-border/50 bg-gradient-card px-3 pb-3 pt-4 shadow-card">
              {weeklyBars.map((day) => (
                <div key={day.label} className="flex h-full min-w-0 flex-col items-center justify-end gap-2">
                  <span
                    className={cn(
                      "text-[10px] font-extrabold leading-none",
                      day.value >= 90 ? "text-success" : day.value >= 50 ? "text-primary" : "text-warning"
                    )}
                  >
                    {day.value}%
                  </span>
                  <div className="flex h-16 w-6 items-end overflow-hidden rounded-full border border-border/70 bg-background shadow-inner">
                    <div
                      className={cn(
                        "w-full rounded-full animate-grow-y transition-all",
                        day.value >= 90
                          ? "bg-gradient-to-t from-success to-success/70"
                          : day.value >= 50
                            ? "bg-gradient-to-t from-primary to-primary-glow"
                            : "bg-gradient-to-t from-warning to-warning/70"
                      )}
                      style={{ height: `${Math.max(day.value, 8)}%` }}
                    />
                  </div>
                  <span className="max-w-full truncate text-[10px] font-extrabold text-foreground/70">{day.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-xl space-y-6 px-5 pb-28 sm:px-6">
        {Object.entries(grouped).map(([date, doses]) => (
          <section key={date}>
            <h2 className="mb-3 px-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              {formatHistoryDate(date)}
            </h2>

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
                        {taken ? copy.taken : copy.missed}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
};

const SplitStat = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "destructive";
}) => (
  <div className={cn("rounded-2xl px-3 py-2", tone === "success" ? "bg-success-soft" : "bg-destructive-soft")}>
    <p className={cn("text-lg font-extrabold leading-none", tone === "success" ? "text-success" : "text-destructive")}>
      {value}
    </p>
    <p className="mt-1 text-[10px] font-bold uppercase text-muted-foreground">{label}</p>
  </div>
);

export default HistoryScreen;
