import { KeyboardEvent, useState, ReactNode } from "react";
import {
  ArrowLeft,
  User,
  IdCard,
  CalendarDays,
  Pencil,
  ChevronRight,
  LogOut,
  Bell,
  FileText,
  Mail,
  Megaphone,
  Phone,
  Type,
  Volume2,
  Music,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AppLanguage } from "@/lib/appLanguage";
import { UserProfile } from "@/lib/userProfile";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ProfileScreenProps {
  language?: AppLanguage;
  userProfile: UserProfile;
  onProfileChange: (profile: UserProfile) => void;
  onBack: () => void;
  onLogout: () => void;
  fontSize: FontSizePreference;
  onFontSizeChange: (size: FontSizePreference) => void;
  remindersEnabled: boolean;
  onRemindersEnabledChange: (enabled: boolean) => void;
  soundAlerts: boolean;
  onSoundAlertsChange: (enabled: boolean) => void;
  voiceGuidance: boolean;
  onVoiceGuidanceChange: (enabled: boolean) => void;
  onTestVoice: () => void;
  onTestNotification?: () => void;
  voiceGender?: "female" | "male";
  onVoiceGenderChange?: (gender: "female" | "male") => void;
  ringtoneUri?: string;
  ringtoneTitle?: string;
  onSelectRingtone?: () => void;
}

type FontSizePreference = "small" | "medium" | "large";

const ProfileScreen = ({
  language = "en",
  userProfile,
  onProfileChange,
  onBack,
  onLogout,
  fontSize,
  onFontSizeChange,
  remindersEnabled,
  onRemindersEnabledChange,
  soundAlerts,
  onSoundAlertsChange,
  voiceGuidance,
  onVoiceGuidanceChange,
  onTestVoice,
  onTestNotification,
  voiceGender = "female",
  onVoiceGenderChange,
  ringtoneUri = "",
  ringtoneTitle = "Default ringtone",
  onSelectRingtone,
}: ProfileScreenProps) => {
  const [name, setName] = useState(userProfile.fullName);
  const [age, setAge] = useState(userProfile.age);
  const [editing, setEditing] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  const copy =
    language === "ta"
      ? {
          title: "சுயவிவரம்",
          signOut: "வெளியேறு",
          patient: "நோயாளி",
          years: "வயது",
          userInfo: "பயனர் விபரங்கள்",
          save: "சேமிக்கவும்",
          edit: "திருத்தவும்",
          name: "பெயர்",
          age: "வயது",
          saveChanges: "மாற்றங்களைச் சேமி",
          fullName: "முழுப் பெயர்",
          patientId: "நோயாளி அடையாள எண்",
          healthSummary: "உடல்நலச் சுருக்கம்",
          perDay: "ஒரு நாள்",
          nextDose: "அடுத்த வேளை மருந்து",
          adherence: "பின்பற்றல் விகிதம்",
          healthAlerts: "உடல்நல எச்சரிக்கைகள்",
          missedDoses: "தவறவிட்ட மருந்துகள்",
          thisWeek: "இந்த வாரம்",
          expiryWarning: "காலாவதி எச்சரிக்கைகள்",
          soon: "விரைவில்",
          allFresh: "அனைத்தும் நல்ல நிலையில் உள்ளன",
          medicineStock: "மாத்திரை இருப்பு",
          low: "குறைவான இருப்பு",
          wellStocked: "போதுமான இருப்பு உள்ளது",
          settings: "அமைப்புகள்",
          editProfile: "சுயவிவரத்தைத் திருத்து",
          manageReminders: "நினைவூட்டல்களை நிர்வகி",
          notifications: "அறிவிப்புகள்",
          viewAllAlerts: "அனைத்து அறிவிப்புகளையும் பார்",
          notificationsEnabled: "அறிவிப்புகள் இயக்கப்பட்டது",
          notificationsMuted: "அறிவிப்புகள் அமைதியாக்கப்பட்டது",
          profileUpdated: "சுயவிவரம் புதுப்பிக்கப்பட்டது",
        }
      : {
          title: "My Profile",
          signOut: "Sign out",
          patient: "Patient",
          years: "years",
          userInfo: "User Information",
          save: "Save",
          edit: "Edit",
          name: "Name",
          age: "Age",
          saveChanges: "Save changes",
          fullName: "Full name",
          patientId: "Patient ID",
          healthSummary: "Health Summary",
          perDay: "Per day",
          nextDose: "Next dose",
          adherence: "Adherence",
          healthAlerts: "Health Alerts",
          missedDoses: "Missed doses",
          thisWeek: "this week",
          expiryWarning: "Expiry warning",
          soon: "soon",
          allFresh: "All fresh",
          medicineStock: "Medicine stock",
          low: "low",
          wellStocked: "Well stocked",
          settings: "Settings",
          editProfile: "Edit profile",
          manageReminders: "Manage reminders",
          notifications: "Notifications",
          viewAllAlerts: "View all alerts",
          notificationsEnabled: "Notifications enabled",
          notificationsMuted: "Notifications muted",
          profileUpdated: "Profile updated",
        };

  const patientId = userProfile.patientId;
  const initial = name.trim().charAt(0).toUpperCase() || "U";
  const ageValue = age.trim().toUpperCase() === "N/A" ? "N/A" : `${age} ${copy.years}`;

  const fontSizeOptions: { id: FontSizePreference; label: string }[] =
    language === "ta"
      ? [
          { id: "small", label: "சிறியது" },
          { id: "medium", label: "நடுத்தரம்" },
          { id: "large", label: "பெரியது" },
        ]
      : [
          { id: "small", label: "Small" },
          { id: "medium", label: "Medium" },
          { id: "large", label: "Large" },
        ];
  const contactEmail = "support@medimind.local";
  const contactPhone = "+91 98765 43210";
  const termsSections = [
    {
      title: "Medical reminder only",
      body: "MediMind helps you remember medicine times. It is not medical advice and does not replace a doctor, pharmacist, prescription, or emergency care.",
    },
    {
      title: "Follow your real instructions",
      body: "Always follow the medicine instructions given by your doctor or pharmacist, including dosage, food timing, course duration, missed-dose advice, and safety warnings.",
    },
    {
      title: "Local/offline data",
      body: "This app stores app data on this device/browser for offline use. If browser data is cleared or the device changes, local saved data may not move with it.",
    },
  ];

  const handleSave = () => {
    const trimmedName = name.trim();
    const normalizedAge = age.trim();
    const parsedAge = Number(normalizedAge);

    if (!trimmedName) {
      toast.error(language === "ta" ? "பெயரை உள்ளிடவும்" : "Please enter a name");
      return;
    }

    if (normalizedAge.toUpperCase() !== "N/A" && (!Number.isFinite(parsedAge) || parsedAge < 1 || parsedAge > 120)) {
      toast.error(language === "ta" ? "சரியான வயதை உள்ளிடவும்" : "Please enter a valid age");
      return;
    }

    const nextProfile = {
      ...userProfile,
      fullName: trimmedName,
      age: normalizedAge.toUpperCase() === "N/A" ? "N/A" : String(Math.round(parsedAge)),
    };

    setName(nextProfile.fullName);
    setAge(nextProfile.age);
    onProfileChange(nextProfile);
    setEditing(false);
    toast.success(copy.profileUpdated, {
      description: `${nextProfile.fullName} - ${nextProfile.age} ${copy.years}`,
    });
  };

  return (
    <div className="flex-1 overflow-y-auto bg-page">
      <div className="hero-surface relative overflow-hidden rounded-b-[2.5rem] bg-hero px-5 pb-16 pt-5 text-primary-foreground sm:px-6">
        <div className="mx-auto w-full max-w-xl">
          <div className="relative flex items-center justify-between gap-3">
            <button
              onClick={onBack}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 backdrop-blur hover:bg-white/25"
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" strokeWidth={2.4} />
            </button>
            <h1 className="min-w-0 break-words text-center text-base font-bold">{copy.title}</h1>
            <button
              onClick={onLogout}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 backdrop-blur hover:bg-white/25"
              aria-label={copy.signOut}
            >
              <LogOut className="h-4 w-4" strokeWidth={2.4} />
            </button>
          </div>

          <div className="relative mt-5 flex items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-white/20 text-3xl font-extrabold shadow-glow backdrop-blur">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-2xl font-extrabold">{name}</h2>
              <p className="break-words text-sm font-medium text-primary-foreground/80">
                {copy.patient} - {ageValue}
              </p>
              <div className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-2.5 py-1 text-[11px] font-bold">
                <IdCard className="h-3.5 w-3.5" />
                {patientId}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 -mt-10 space-y-5 px-4 pb-28 sm:px-5">
        <div className="mx-auto w-full max-w-xl space-y-5">
        <Card>
          <CardHeader
            Icon={User}
            title={copy.userInfo}
            action={
              <button
                onClick={() => (editing ? handleSave() : setEditing(true))}
                className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-bold text-primary"
              >
                <Pencil className="h-3 w-3" />
                {editing ? copy.save : copy.edit}
              </button>
            }
          />

          {editing ? (
            <div className="space-y-3 p-1">
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {copy.name}
                </label>
                <Input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 h-12 rounded-xl text-base" />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {copy.age}
                </label>
                <Input value={age} onChange={(event) => setAge(event.target.value)} className="mt-1 h-12 rounded-xl text-base" />
              </div>
              <Button onClick={handleSave} className="h-12 w-full rounded-xl font-bold">
                {copy.saveChanges}
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              <InfoRow Icon={User} label={copy.fullName} value={name} />
              <InfoRow Icon={CalendarDays} label={copy.age} value={ageValue} />
              <InfoRow Icon={IdCard} label={copy.patientId} value={patientId} />
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader Icon={Pencil} title={language === "ta" ? copy.settings : "Account"} />
          <ul className="divide-y divide-border">
            <ActionRow Icon={User} label={copy.editProfile} onClick={() => setEditing(true)} />
            <ActionRow Icon={LogOut} label="Switch account" onClick={onLogout} />
          </ul>
        </Card>

        <Card>
          <CardHeader Icon={Bell} title={language === "ta" ? "எச்சரிக்கை அமைப்புகள்" : "Alert Settings"} />
          <ul className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border">
            <ToggleRow
              Icon={Bell}
              label={language === "ta" ? "நினைவூட்டல்களை இயக்கவும்" : "Enable reminders"}
              checked={remindersEnabled}
              onChange={onRemindersEnabledChange}
            />
            <ToggleRow
              Icon={Volume2}
              label={language === "ta" ? "ஒலி அறிவிப்புகள்" : "Sound alerts"}
              checked={soundAlerts}
              onChange={onSoundAlertsChange}
            />
            {soundAlerts && (
              <li className="flex flex-col gap-2 p-4 bg-secondary/20">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground">
                    <Music className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">{language === "ta" ? "அலாரம் ஒலி" : "Alarm sound"}</p>
                    <p className="text-xs leading-5 text-muted-foreground">
                      {language === "ta" ? "தற்போதைய ஒலி" : "Current sound"}: <span className="font-bold text-primary">{ringtoneTitle || "Default ringtone"}</span>
                    </p>
                  </div>
                </div>
                <Button
                  onClick={onSelectRingtone}
                  className="mt-1 h-10 w-full rounded-xl bg-primary-soft text-primary font-bold hover:bg-primary/20"
                >
                  <Music className="mr-1.5 h-4 w-4" />
                  {language === "ta" ? "ஒலியை மாற்றவும்" : "Change sound"}
                </Button>
              </li>
            )}
            <ToggleRow
              Icon={Megaphone}
              label={language === "ta" ? "டாக்பேக் முறை (குரல் உதவி)" : "TalkBack mode"}
              checked={voiceGuidance}
              onChange={onVoiceGuidanceChange}
            />
          </ul>

          {voiceGuidance && (
            <div className="mt-4 border-t border-border pt-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {language === "ta" ? "குரல் பாத்திரம் (Vocal Persona)" : "Vocal Persona"}
              </p>
              <div className="grid grid-cols-2 gap-2 rounded-2xl bg-secondary p-1">
                <button
                  type="button"
                  onClick={() => onVoiceGenderChange?.("female")}
                  className={cn(
                    "min-h-[38px] rounded-xl text-xs font-extrabold transition-all duration-200",
                    voiceGender === "female"
                      ? "bg-card text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {language === "ta" ? "அமைதி (பெண்)" : "Serene (Female)"}
                </button>
                <button
                  type="button"
                  onClick={() => onVoiceGenderChange?.("male")}
                  className={cn(
                    "min-h-[38px] rounded-xl text-xs font-extrabold transition-all duration-200",
                    voiceGender === "male"
                      ? "bg-card text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {language === "ta" ? "அமைதி (ஆண்)" : "Calm (Male)"}
                </button>
              </div>
              <Button
                onClick={onTestVoice}
                className="mt-3 h-10 w-full rounded-xl bg-primary-soft text-primary font-bold hover:bg-primary/20"
              >
                <Megaphone className="mr-1.5 h-5 w-5" />
                {language === "ta" ? "குரல் உதவிச் சோதனை" : "Test TalkBack"}
              </Button>
            </div>
          )}

          {remindersEnabled && (
            <Button
              onClick={onTestNotification}
              className="mt-3 h-10 w-full rounded-xl bg-primary-soft text-primary font-bold hover:bg-primary/20"
            >
              <Bell className="mr-1.5 h-5 w-5" />
              {language === "ta" ? "அறிவிப்புச் சோதனை" : "Test Notification"}
            </Button>
          )}
        </Card>

        <Card>
          <CardHeader Icon={Type} title={language === "ta" ? "Appearance" : "Appearance"} />
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Type className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-foreground">{language === "ta" ? "Font size" : "Font size"}</p>
              <p className="text-sm leading-6 text-muted-foreground">
                {language === "ta" ? "Adjust the app text size" : "Adjust the app text size"}
              </p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(108px,1fr))] gap-2">
            {fontSizeOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => onFontSizeChange(option.id)}
                className={cn(
                  "min-h-11 rounded-xl border px-2 py-2 text-sm font-extrabold leading-5 transition-colors",
                  fontSize === option.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:bg-secondary"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader Icon={Mail} title={language === "ta" ? "Contact us" : "Contact us"} />
          <p className="text-sm leading-6 text-muted-foreground">
            {language === "ta" ? "அமைப்புகள் அல்லது நினைவூட்டல்களில் உதவி தேவையா?" : "Need help with setup or reminders?"}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setContactOpen(true)}
              className="h-auto min-h-11 w-full whitespace-normal rounded-2xl px-3 py-2 text-center font-bold leading-5"
            >
              <Mail className="mr-2 h-4 w-4" />
              {language === "ta" ? "Contact Us" : "Contact Us"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setTermsOpen(true)}
              className="h-auto min-h-11 w-full whitespace-normal rounded-2xl px-3 py-2 text-center font-bold leading-5"
            >
              <FileText className="mr-2 h-4 w-4" />
              {language === "ta" ? "Terms & Conditions" : "Terms & Conditions"}
            </Button>
          </div>
        </Card>
        </div>
      </div>

      <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
        <DialogContent className="max-h-[82vh] w-[calc(100vw-2rem)] max-w-[500px] overflow-y-auto rounded-3xl border-border bg-card p-5 text-foreground">
          <DialogHeader className="pr-7 text-left">
            <DialogTitle className="text-xl font-extrabold">Terms & Conditions</DialogTitle>
            <DialogDescription className="text-sm leading-6">
              Key safety and demo-use notes for MediMind.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {termsSections.map((section) => (
              <div key={section.title} className="rounded-2xl border border-border bg-background p-4">
                <p className="font-bold text-foreground">{section.title}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{section.body}</p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent className="max-h-[82vh] w-[calc(100vw-2rem)] max-w-[500px] overflow-y-auto rounded-3xl border-border bg-card p-5 text-foreground">
          <DialogHeader className="pr-7 text-left">
            <DialogTitle className="text-xl font-extrabold">Contact us</DialogTitle>
            <DialogDescription className="text-sm leading-6">
              Need help with setup or reminders?
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <a
              href={`mailto:${contactEmail}`}
              className="flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 text-left transition-colors hover:bg-secondary"
            >
              <Mail className="h-5 w-5 shrink-0 text-primary" />
              <span className="min-w-0 break-words text-sm font-semibold text-foreground">{contactEmail}</span>
            </a>
            <a
              href={`tel:${contactPhone.replace(/\s+/g, "")}`}
              className="flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 text-left transition-colors hover:bg-secondary"
            >
              <Phone className="h-5 w-5 shrink-0 text-primary" />
              <span className="min-w-0 break-words text-sm font-semibold text-foreground">{contactPhone}</span>
            </a>
            <p className="rounded-2xl bg-primary-soft px-4 py-3 text-sm font-semibold text-primary">
              Support hours: 9:00 AM - 6:00 PM
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Card = ({ children }: { children: ReactNode }) => (
  <section className="rounded-3xl border border-border/60 bg-card p-4 shadow-card">{children}</section>
);

const CardHeader = ({
  Icon,
  title,
  action,
}: {
  Icon: typeof User;
  title: string;
  action?: ReactNode;
}) => (
  <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
    <div className="flex min-w-0 items-center gap-2">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-soft">
        <Icon className="h-4 w-4 text-primary" strokeWidth={2.5} />
      </div>
      <h3 className="break-words text-sm font-extrabold uppercase tracking-wider text-foreground">{title}</h3>
    </div>
    {action}
  </div>
);

const InfoRow = ({ Icon, label, value }: { Icon: typeof User; label: string; value: string }) => (
  <li className="flex items-center gap-3 py-3">
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
      <Icon className="h-5 w-5 text-foreground" />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="break-words font-bold text-foreground">{value}</p>
    </div>
  </li>
);



const ActionRow = ({
  Icon,
  label,
  onClick,
}: {
  Icon: typeof User;
  label: string;
  onClick: () => void;
}) => (
  <li>
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl py-3 text-left transition-colors hover:bg-secondary/50"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <p className="min-w-0 flex-1 break-words font-semibold text-foreground">{label}</p>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
    </button>
  </li>
);

const ToggleRow = ({
  Icon,
  label,
  checked,
  onChange,
}: {
  Icon: typeof Bell;
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) => {
  const handleToggle = () => onChange(!checked);
  const handleKeyDown = (event: KeyboardEvent<HTMLLIElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    handleToggle();
  };

  return (
    <li
      role="switch"
      aria-checked={checked}
      tabIndex={0}
      data-talkback-label={label}
      onClick={handleToggle}
      onKeyDown={handleKeyDown}
      className="flex cursor-pointer items-center gap-3 p-4 transition-colors hover:bg-secondary/60 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ring active:bg-secondary"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
        <Icon className="h-5 w-5 text-foreground" />
      </div>
      <p className="min-w-0 flex-1 break-words font-semibold text-foreground">{label}</p>
      <Switch checked={checked} tabIndex={-1} aria-hidden="true" className="pointer-events-none shrink-0" />
    </li>
  );
};

export default ProfileScreen;
