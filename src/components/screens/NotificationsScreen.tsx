import { AlertCircle, BellRing, CalendarX, CheckCircle2, Package } from "lucide-react";
import ScreenHeader from "@/components/ScreenHeader";
import { AlertType } from "@/data/medicine";
import { AppLanguage } from "@/lib/appLanguage";
import {
  AppNotification,
  getNotificationTimeline,
  groupNotifications,
  loadAppNotifications,
} from "@/lib/appNotifications";
import { cn } from "@/lib/utils";

const config: Record<AlertType, { Icon: typeof CheckCircle2; classes: string; iconBg: string }> = {
  reminder: { Icon: BellRing, classes: "text-primary", iconBg: "bg-primary-soft" },
  success: { Icon: CheckCircle2, classes: "text-success", iconBg: "bg-success-soft" },
  missed: { Icon: AlertCircle, classes: "text-destructive", iconBg: "bg-destructive-soft" },
  stock: { Icon: Package, classes: "text-warning", iconBg: "bg-warning-soft" },
  expired: { Icon: CalendarX, classes: "text-destructive", iconBg: "bg-destructive-soft" },
};

const tamilLabels = {
  title: "எச்சரிக்கைகள்",
  subtitle: "சமீபத்திய எச்சரிக்கைகள்",
  urgent: "கவனம்",
  emptyTitle: "எச்சரிக்கைகள் இல்லை",
  emptyBody: "மருந்து மற்றும் இருப்பு நிகழ்வுகள் இங்கே தோன்றும்.",
};

const NotificationsScreen = ({
  language = "en",
  notifications,
}: {
  language?: AppLanguage;
  notifications?: AppNotification[];
}) => {
  const notificationHistory = groupNotifications(
    getNotificationTimeline(notifications ?? loadAppNotifications())
  );
  const groupedNotifications = notificationHistory.reduce<Record<string, typeof notificationHistory>>((acc, alert) => {
    (acc[alert.group] ||= []).push(alert);
    return acc;
  }, {});
  const alertCounts = notificationHistory.reduce<Record<AlertType, number>>(
    (acc, alert) => {
      acc[alert.type] += 1;
      return acc;
    },
    { reminder: 0, success: 0, missed: 0, stock: 0, expired: 0 }
  );
  const urgentCount = alertCounts.missed + alertCounts.stock + alertCounts.expired;
  const copy =
    language === "ta"
      ? {
          title: tamilLabels.title,
          subtitle: `${notificationHistory.length} ${tamilLabels.subtitle}`,
          urgent: tamilLabels.urgent,
          emptyTitle: tamilLabels.emptyTitle,
          emptyBody: tamilLabels.emptyBody,
        }
      : {
          title: "Notifications",
          subtitle: `${notificationHistory.length} recent alerts`,
          urgent: "urgent",
          emptyTitle: "No alerts yet",
          emptyBody: "Dose, stock, and expiry events will appear here.",
        };

  return (
    <div className="flex-1 overflow-y-auto bg-page">
      <ScreenHeader title={copy.title} subtitle={copy.subtitle} />
      <div className="mx-auto w-full max-w-xl px-5 pb-28 sm:px-6">
        {notificationHistory.length > 0 && (
          <section className="mb-5 rounded-2xl border border-border/60 bg-card p-4 shadow-card">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-extrabold text-foreground">
                  {language === "ta" ? "எச்சரிக்கை வகைகள்" : "Alert types"}
                </h2>
                <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                  {language === "ta" ? "சமீபத்திய அறிவிப்புகள்" : "Breakdown of recent notifications"}
                </p>
              </div>
              <div className="rounded-2xl bg-destructive-soft px-3 py-2 text-center text-destructive">
                <p className="text-lg font-extrabold leading-none">{urgentCount}</p>
                <p className="mt-1 text-[10px] font-bold uppercase">{copy.urgent}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {(["success", "reminder", "missed", "stock"] as AlertType[]).map((type) => {
                const item = config[type];
                return (
                  <div key={type} className="flex items-center gap-2 rounded-2xl bg-muted/60 p-2">
                    <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl", item.iconBg)}>
                      <item.Icon className={cn("h-4 w-4", item.classes)} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold leading-none text-foreground">{alertCounts[type]}</p>
                      <p className="mt-1 truncate text-[10px] font-bold uppercase text-muted-foreground">{type}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {notificationHistory.length === 0 ? (
          <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-card">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <BellRing className="h-7 w-7" />
            </div>
            <h2 className="mt-4 text-lg font-extrabold text-foreground">{copy.emptyTitle}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy.emptyBody}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedNotifications).map(([group, groupAlerts]) => (
              <section key={group}>
                <div className="mb-3 flex items-center justify-between gap-3 px-1">
                  <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    {groupAlerts[0]?.groupLabel}
                  </h2>
                  <span className="rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-bold text-primary">
                    {groupAlerts.length}
                  </span>
                </div>

                <ul className="space-y-3">
                  {groupAlerts.map((alert) => {
                    const item = config[alert.type];
                    return (
                      <li
                        key={alert.id}
                        className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card-gradient p-4 shadow-card transition-shadow hover:shadow-soft"
                      >
                        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", item.iconBg)}>
                          <item.Icon className={cn("h-5 w-5", item.classes)} strokeWidth={2.3} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="break-words font-bold leading-snug text-foreground">{alert.title}</p>
                            <span className="mt-0.5 whitespace-nowrap text-[11px] font-semibold text-muted-foreground">
                              {alert.time}
                            </span>
                          </div>
                          <p className="mt-0.5 break-words text-sm font-medium text-muted-foreground">
                            {alert.message}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsScreen;
