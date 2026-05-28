import { useState, FormEvent, ReactNode } from "react";
import { Pill, User, Lock, Heart, ShieldCheck, Eye, EyeOff, Languages, CalendarDays, IdCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppLanguage } from "@/lib/appLanguage";
import { findUserProfile, generatePatientId, saveUserProfile, UserProfile } from "@/lib/userProfile";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface LoginScreenProps {
  language?: AppLanguage;
  onLogin: (profile: UserProfile) => void;
  onToggleLanguage: () => void;
}

type AuthMode = "signin" | "signup";

const LoginScreen = ({ language = "en", onLogin, onToggleLanguage }: LoginScreenProps) => {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const copy =
    language === "ta"
      ? {
          appTag: "ஸ்மார்ட் மருந்து நினைவூட்டல்",
          headlineTop: "உங்கள் தினசரி உடல்நலம்,",
          headlineBottom: "ஒருபோதும் தவறாமல்.",
          caring: "அக்கறை",
          secure: "பாதுகாப்பு",
          smartPillBox: "ஸ்மார்ட் மருந்துப் பெட்டி",
          languageToggle: "தமிழ்",
          signIn: "உள்நுழை",
          signUp: "பதிவு செய்",
          welcomeBack: "மீண்டும் வரவேற்கிறோம்",
          createAccount: "சுயவிவரம் உருவாக்கு",
          signInHelp: "சேமித்த நோயாளர் சுயவிவரத்துடன் உள்நுழையவும்.",
          signUpHelp: "நோயாளர் விவரங்களை ஒருமுறை உள்ளிடவும். இது சுயவிவரத்தில் காட்டப்படும்.",
          fullName: "முழு பெயர்",
          namePlaceholder: "எ.கா. நவநீத்",
          age: "வயது",
          agePlaceholder: "எ.கா. 68",
          patientId: "நோயாளர் எண்",
          password: "கடவுச்சொல்",
          hidePassword: "கடவுச்சொல்லை மறைக்கவும்",
          showPassword: "கடவுச்சொல்லைக் காட்டவும்",
          signingIn: "உள்நுழைகிறது...",
          creating: "சுயவிவரம் உருவாக்குகிறது...",
          signInStart: "உள்நுழை",
          signUpStart: "கணக்கு உருவாக்கு",
          localMode: "டெமோ செயலி - தரவு இந்த உலாவியில் மட்டும் சேமிக்கப்படும்",
          enterName: "முழு பெயரை உள்ளிடவும்",
          enterAge: "வயதை உள்ளிடவும்",
          invalidAge: "வயது 1 முதல் 120 வரை இருக்க வேண்டும்",
          passwordTooShort: "கடவுச்சொல் குறைந்தது 4 எழுத்துகள் இருக்க வேண்டும்",
          alreadyExists: "இந்த சுயவிவரம் ஏற்கனவே உள்ளது. உள்நுழையவும்.",
          welcomeToast: (name: string) => `வரவேற்கிறோம், ${name}`,
          createdToast: (name: string) => `${name} அவர்களின் சுயவிவரம் உருவாக்கப்பட்டது`,
        }
      : {
          appTag: "Smart medicine reminder",
          headlineTop: "Your daily health,",
          headlineBottom: "never missed.",
          caring: "Caring",
          secure: "Secure",
          smartPillBox: "Smart pill box",
          languageToggle: "English",
          signIn: "Sign in",
          signUp: "Sign up",
          welcomeBack: "Welcome back",
          createAccount: "Create profile",
          signInHelp: "Sign in with your saved patient profile.",
          signUpHelp: "Enter patient details once. The app will use this data in Profile.",
          fullName: "Full name",
          namePlaceholder: "e.g. Navneeth",
          age: "Age",
          agePlaceholder: "e.g. 68",
          patientId: "Patient ID",
          password: "Password",
          hidePassword: "Hide password",
          showPassword: "Show password",
          signingIn: "Signing in...",
          creating: "Creating profile...",
          signInStart: "Sign in",
          signUpStart: "Create account",
          localMode: "Local prototype - data is saved only in this browser",
          enterName: "Please enter full name",
          enterAge: "Please enter age",
          invalidAge: "Age must be between 1 and 120",
          passwordTooShort: "Password must be at least 4 characters",
          alreadyExists: "This profile already exists. Please sign in.",
          welcomeToast: (name: string) => `Welcome, ${name}`,
          createdToast: (name: string) => `Profile created for ${name}`,
        };

  const patientIdPreview = generatePatientId(fullName || "User");

  const validateBaseFields = () => {
    if (!fullName.trim()) {
      toast.error(copy.enterName);
      return false;
    }

    if (password.length < 4) {
      toast.error(copy.passwordTooShort);
      return false;
    }

    return true;
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!validateBaseFields()) return;

    const normalizedName = fullName.trim();
    const savedProfile = findUserProfile(normalizedName);

    if (mode === "signin") {
      const profileForLogin: UserProfile =
        savedProfile || {
          fullName: normalizedName,
          age: "N/A",
          patientId: patientIdPreview,
          password,
        };

      setLoading(true);
      setTimeout(() => {
        if (!savedProfile) {
          saveUserProfile(profileForLogin);
        }
        setLoading(false);
        toast.success(copy.welcomeToast(profileForLogin.fullName));
        onLogin(profileForLogin);
      }, 450);
      return;
    }

    const parsedAge = Number(age);
    if (!age.trim()) {
      toast.error(copy.enterAge);
      return;
    }

    if (!Number.isFinite(parsedAge) || parsedAge < 1 || parsedAge > 120) {
      toast.error(copy.invalidAge);
      return;
    }

    if (savedProfile) {
      toast.error(copy.alreadyExists);
      setMode("signin");
      return;
    }

    const nextProfile: UserProfile = {
      fullName: normalizedName,
      age: String(Math.round(parsedAge)),
      patientId: patientIdPreview,
      password,
    };

    setLoading(true);
    setTimeout(() => {
      saveUserProfile(nextProfile);
      setLoading(false);
      toast.success(copy.createdToast(nextProfile.fullName));
      onLogin(nextProfile);
    }, 450);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-page">
      <div className="hero-surface relative overflow-hidden rounded-b-[2.5rem] bg-hero px-5 pb-20 pt-14 text-primary-foreground sm:px-6">
        <div className="mx-auto w-full max-w-xl">
          <div className="relative flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 shadow-glow backdrop-blur">
                <Pill className="h-7 w-7" strokeWidth={2.4} />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-extrabold tracking-tight">MediMind</h1>
                <p className="text-xs font-semibold uppercase tracking-widest text-primary-foreground/80">
                  {copy.appTag}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onToggleLanguage}
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-white/20 bg-white/15 px-4 py-2 text-sm font-bold text-primary-foreground backdrop-blur transition-colors hover:bg-white/25"
              aria-label="Toggle language"
            >
              <Languages className="h-4 w-4" strokeWidth={2.4} />
              {copy.languageToggle}
            </button>
          </div>

          <h2 className="relative mt-8 break-words text-3xl font-extrabold leading-tight">
            {copy.headlineTop}
            <br />
            <span className="text-primary-foreground/85">{copy.headlineBottom}</span>
          </h2>

          <div className="relative mt-5 flex flex-wrap gap-2">
            <Badge Icon={Heart} label={copy.caring} />
            <Badge Icon={ShieldCheck} label={copy.secure} />
            <Badge Icon={Pill} label={copy.smartPillBox} />
          </div>
        </div>
      </div>

      <div className="relative z-10 -mt-12 px-4 pb-12 sm:px-5">
        <form
          onSubmit={handleSubmit}
          className="mx-auto w-full max-w-xl rounded-3xl border border-border/60 bg-card-gradient p-5 shadow-soft sm:p-6"
        >
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-secondary p-1">
            {(["signin", "signup"] as AuthMode[]).map((authMode) => (
              <button
                key={authMode}
                type="button"
                onClick={() => setMode(authMode)}
                className={cn(
                  "min-h-11 rounded-xl text-sm font-extrabold transition-colors",
                  mode === authMode ? "bg-card text-primary shadow-card" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {authMode === "signin" ? copy.signIn : copy.signUp}
              </button>
            ))}
          </div>

          <p className="mt-5 text-[11px] font-bold uppercase tracking-widest text-primary">
            {mode === "signin" ? copy.signIn : copy.signUp}
          </p>
          <h3 className="mt-1 text-xl font-extrabold text-foreground">
            {mode === "signin" ? copy.welcomeBack : copy.createAccount}
          </h3>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            {mode === "signin" ? copy.signInHelp : copy.signUpHelp}
          </p>

          <div className="mt-5 space-y-4">
            <FieldShell Icon={User} label={copy.fullName} htmlFor="fullName">
              <Input
                id="fullName"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder={copy.namePlaceholder}
                className="h-12 rounded-xl border-border/70 bg-background pl-10 text-base font-semibold"
                autoComplete="username"
              />
            </FieldShell>

            {mode === "signup" && (
              <>
                <FieldShell Icon={CalendarDays} label={copy.age} htmlFor="age">
                  <Input
                    id="age"
                    type="number"
                    min={1}
                    max={120}
                    value={age}
                    onChange={(event) => setAge(event.target.value)}
                    placeholder={copy.agePlaceholder}
                    className="h-12 rounded-xl border-border/70 bg-background pl-10 text-base font-semibold"
                    autoComplete="off"
                  />
                </FieldShell>

                <div className="rounded-2xl border border-border/60 bg-primary-soft/50 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-primary">
                    <IdCard className="h-4 w-4" />
                    {copy.patientId}
                  </div>
                  <p className="mt-1 text-lg font-extrabold text-foreground">{patientIdPreview}</p>
                </div>
              </>
            )}

            <FieldShell Icon={Lock} label={copy.password} htmlFor="password">
              <Input
                id="password"
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className="h-12 rounded-xl border-border/70 bg-background pl-10 pr-11 text-base font-semibold"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
              <button
                type="button"
                onClick={() => setShowPwd((current) => !current)}
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={showPwd ? copy.hidePassword : copy.showPassword}
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </FieldShell>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="mt-6 h-14 w-full rounded-2xl bg-hero text-base font-bold text-primary-foreground shadow-soft transition-all hover:opacity-95 active:scale-[0.98]"
          >
            {loading
              ? mode === "signin"
                ? copy.signingIn
                : copy.creating
              : mode === "signin"
                ? copy.signInStart
                : copy.signUpStart}
          </Button>

          <p className="mt-4 text-center text-xs font-medium text-muted-foreground">{copy.localMode}</p>
        </form>
      </div>
    </div>
  );
};

const FieldShell = ({
  Icon,
  label,
  htmlFor,
  children,
}: {
  Icon: typeof User;
  label: string;
  htmlFor: string;
  children: ReactNode;
}) => (
  <div className="space-y-1.5">
    <Label htmlFor={htmlFor} className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
      {label}
    </Label>
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      {children}
    </div>
  </div>
);

const Badge = ({ Icon, label }: { Icon: typeof Heart; label: string }) => (
  <div className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-2.5 py-1 text-[11px] font-bold backdrop-blur">
    <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
    {label}
  </div>
);

export default LoginScreen;
