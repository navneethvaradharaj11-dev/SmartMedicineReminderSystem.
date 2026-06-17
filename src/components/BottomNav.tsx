import { Bell, Home, Clock, User } from "lucide-react";
import { AppLanguage } from "@/lib/appLanguage";
import { cn } from "@/lib/utils";

export type Screen = "home" | "notifications" | "settings" | "profile";

interface BottomNavProps {
  active: Screen;
  onChange: (screen: Screen) => void;
  language?: AppLanguage;
}

const navLabels: Record<AppLanguage, Record<Screen, string>> = {
  en: {
    home: "Home",
    notifications: "Alerts",
    settings: "Reminders",
    profile: "Profile",
  },
  ta: {
    home: "முகப்பு",
    notifications: "அறிவிப்புகள்",
    settings: "நினைவூட்டல்கள்",
    profile: "சுயவிவரம்",
  },
};

const items: { id: Screen; Icon: typeof Home }[] = [
  { id: "home", Icon: Home },
  { id: "notifications", Icon: Bell },
  { id: "settings", Icon: Clock },
  { id: "profile", Icon: User },
];

const BottomNav = ({ active, onChange, language = "en" }: BottomNavProps) => {
  const labels = navLabels[language];

  return (
    <nav className="relative z-10 border-t border-border bg-card/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-2.5 backdrop-blur-md">
      <ul className="grid grid-cols-4 gap-1">
        {items.map(({ id, Icon }) => {
          const isActive = active === id;
          const label = labels[id];
          return (
            <li key={id} className="min-w-0">
              <button
                onClick={() => onChange(id)}
                className={cn(
                  "relative flex min-h-[62px] w-full min-w-0 flex-col items-center justify-start gap-1 rounded-2xl px-1 py-2 transition-all duration-300",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
                aria-current={isActive ? "page" : undefined}
                aria-label={label}
                title={label}
              >
                <div
                  className={cn(
                    "flex h-8 w-11 items-center justify-center rounded-xl transition-all",
                    isActive && "bg-primary-soft"
                  )}
                >
                  <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className={cn("max-w-full text-center text-[10px] font-bold leading-3.5 [overflow-wrap:anywhere]", isActive && "text-primary")}>
                  {label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default BottomNav;
