import { Bluetooth, CheckCircle2, ExternalLink, Loader2, PlugZap, RefreshCw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Schedule } from "@/data/medicine";
import { AppLanguage } from "@/lib/appLanguage";
import { cn } from "@/lib/utils";

type SavedBluetoothDevice = {
  id?: string;
  name?: string;
  gatt?: {
    connected?: boolean;
  };
};

type NativeBluetoothSnapshotInfo = {
  supported?: boolean;
  devices?: Array<{
    name?: string;
    connected?: boolean;
    source?: string;
  }>;
  updatedAt?: string;
  error?: string;
  sourceUrl?: string;
};

interface BluetoothScreenProps {
  language?: AppLanguage;
  pillBoxConnected: boolean;
  pillBoxBusy: boolean;
  deviceName?: string;
  systemDeviceReady: boolean;
  nativeWindowsKnown?: boolean;
  nativeWindowsConnected?: boolean;
  nativeBluetoothSnapshot?: NativeBluetoothSnapshotInfo | null;
  connectionTransport?: "serial" | "bluetooth" | null;
  medicineSchedules: Schedule[];
  savedBluetoothDevices: SavedBluetoothDevice[];
  savedWindowsDeviceCount: number;
  canUseWindowsSerial: boolean;
  canScanBluetooth: boolean;
  canReconnectSavedBluetooth: boolean;
  demoMode?: boolean;
  onTogglePillBox: () => void;
  onReconnectSavedBluetooth: (device: SavedBluetoothDevice) => void;
  onConnectSavedWindowsDevice: () => void;
  onOpenSystemBluetooth: () => void;
}

const BluetoothScreen = ({
  language = "en",
  pillBoxConnected,
  pillBoxBusy,
  deviceName,
  systemDeviceReady,
  nativeWindowsKnown = false,
  nativeWindowsConnected = false,
  nativeBluetoothSnapshot,
  connectionTransport,
  medicineSchedules,
  savedBluetoothDevices,
  savedWindowsDeviceCount,
  canUseWindowsSerial,
  canScanBluetooth,
  canReconnectSavedBluetooth,
  demoMode = false,
  onTogglePillBox,
  onReconnectSavedBluetooth,
  onConnectSavedWindowsDevice,
  onOpenSystemBluetooth,
}: BluetoothScreenProps) => {
  const showWindowsStatus = !pillBoxConnected && nativeWindowsKnown;
  const showSavedAccess = !pillBoxConnected && (canReconnectSavedBluetooth || canUseWindowsSerial);
  const statusIconTone = nativeWindowsConnected ? "text-success" : "text-warning";
  const nativeBridgeDeviceCount = nativeBluetoothSnapshot?.devices?.length ?? 0;
  const nativeBridgeConnectedCount =
    nativeBluetoothSnapshot?.devices?.filter((device) => device.connected).length ?? 0;
  const nativeBridgeSupported = nativeBluetoothSnapshot?.supported === true;
  const nativeBridgeFresh = Boolean(nativeBluetoothSnapshot?.updatedAt);
  const nativeBridgeStatus = nativeBluetoothSnapshot
    ? nativeBluetoothSnapshot.supported
      ? `Native bridge: ${nativeBridgeConnectedCount}/${nativeBridgeDeviceCount} connected`
      : `Native bridge unavailable${nativeBluetoothSnapshot.error ? `: ${nativeBluetoothSnapshot.error}` : ""}`
    : "Native bridge: waiting for status";
  const copy =
    language === "ta"
      ? {
          title: "ஸ்மார்ட் மருந்துப் பெட்டி இணைப்பு",
          connected: "இணைக்கப்பட்டுள்ளது",
          connectedInWindows: "இந்த சாதனத்தில் இணைக்கப்பட்டுள்ளது",
          savedAccessAvailable: "சேமித்த சாதன அணுகல் உள்ளது",
          notConnected: "இணைக்கப்படவில்லை",
          liveAppConnection: "நேரடி செயலி இணைப்பு",
          windowsConnectedNote:
            "இந்த சாதனம் இப்போது இணைக்கப்பட்டுள்ளது. செயலிக்குள் நேரடி கட்டுப்பாடு வேண்டும் என்றால் மட்டும் மீண்டும் இணைக்கவும்.",
          windowsKnownNotePrefix: "இந்த சாதனம் கண்டறியப்பட்டது, ஆனால் தற்போதைய சோதனையில் இது இணைக்கப்படவில்லை:",
          savedAccessNote:
            "உலாவி பழைய சாதன அனுமதியை நினைவில் வைத்துள்ளது. புதிய தேடலுக்காக அருகிலுள்ள சாதனங்களைத் தேடவும்.",
          scanNote:
            "தேவைப்பட்டால் முதலில் சாதனத்தின் புளூடூத் அமைப்புகளில் மருந்துப் பெட்டியை இணைத்து, பிறகு இங்கிருந்து தேடவும்.",
          nativeSerialConnection: "நேட்டிவ் சீரியல் இணைப்பு",
          nativeBluetoothConnection: "புளூடூத் நேரடி இணைப்பு",
          windowsLiveConnected: "நேரடி நிலை: இணைக்கப்பட்டுள்ளது",
          windowsLiveDisconnected: "நேரடி நிலை: இணைக்கப்படவில்லை",
          disconnecting: "துண்டிக்கப்படுகிறது...",
          connecting: "இணைக்கப்படுகிறது...",
          disconnectPillBox: "மருந்துப் பெட்டியை துண்டிக்கவும்",
          scanNearbyDevices: "அருகிலுள்ள சாதனங்களைத் தேடவும்",
          connectDevice: "சாதனத்தை இணைக்கவும்",
          usePairedWindowsDevice: "ஏற்கனவே இணைத்த சாதனத்தை பயன்படுத்தவும்",
          savedAccess: "சேமித்த அணுகல்",
          rememberedDevices: "நினைவில் வைத்த சாதனங்கள்",
          rememberedDevicesNote:
            "சேமித்த புளூடூத் சாதனங்கள் இங்கே அதே செயலி தோற்றத்தில் காட்டப்படும். புதிய தேடலை இழக்காமல் நேரடியாக மீண்டும் இணைக்க பயன்படுத்தவும்.",
          unnamedSavedDevice: "பெயரில்லா சேமித்த புளூடூத் சாதனம்",
          alreadyConnected: "ஏற்கனவே இணைக்கப்பட்டுள்ளது",
          savedBrowserAccess: "சேமித்த உலாவி புளூடூத் அணுகல்",
          reconnect: "மீண்டும் இணைக்கவும்",
          savedWindowsDevice: "சேமித்த சாதனம்",
          savedWindowsPermissions: (count: number) =>
            `${count} சேமித்த சீரியல் அனுமதி${count === 1 ? "" : "கள்"} கிடைக்கின்றன`,
          openWindowsPicker: "சீரியல் சாதனத்தை சேமிக்க சாதனத் தேர்வியைத் திறக்கவும்",
          useSavedWindowsDevice: "சேமித்த சாதனத்தை பயன்படுத்தவும்",
          openBluetoothSettings: "புளூடூத் அமைப்புகளைத் திறக்கவும்",
          demoActive: "டெமோ இணைப்பு செயலில் உள்ளது",
          demoNote: "இந்த திரை வாடிக்கையாளர் விளக்கத்திற்காக இணைக்கப்பட்ட ஸ்மார்ட் மருந்துப் பெட்டியை மாதிரியாக காட்டுகிறது. உண்மையான புளூடூத் பயன்படுத்த முகப்பில் டெமோ முறையை அணைக்கவும்.",
          contactTitle: "எங்களை தொடர்பு கொள்ளவும்",
          contactSubtitle: "அமைப்பு, புளூடூத் அல்லது நினைவூட்டல்களுக்கு உதவி வேண்டுமா?",
          contactEmail: "support@medimind.local",
          contactPhone: "+91 98765 43210",
          supportHours: "உதவி நேரம்: காலை 9:00 - மாலை 6:00",
          contactButton: "தொடர்பு கொள்ளவும்",
          pillsRemainingTitle: "மீதமுள்ள மாத்திரைகள்",
          pillsRemainingSubtitle: "அனைத்து மருந்து இருப்புகளும்",
          tabletsLeft: "மீதம்",
          expired: "காலாவதியானது",
          expiresIn: "காலாவதி இன்னும்",
          fresh: "புதியது",
          termsButton: "விதிமுறைகள்",
          termsTitle: "விதிமுறைகள் மற்றும் நிபந்தனைகள்",
          termsDescription: "MediMind பயன்படுத்துவதற்கு முன் இந்த குறிப்புகளை படிக்கவும்.",
          tips: {
            scan:
              "அருகிலுள்ள சாதனங்களைத் தேடுதல்: இது உலாவியின் புளூடூத் சாதனத் தேர்வியைத் திறந்து அருகிலுள்ள சாதனங்களைப் புதிதாக தேடும்.",
            saved:
              "சேமித்த புளூடூத் சாதனங்கள்: இவை இப்போது செயலிக்குள் அதே தோற்றத்தில் பட்டியலிடப்படுகின்றன.",
            windows:
              "சேமித்த சாதனம்: HC-05 போன்ற பழைய புளூடூத் சீரியல் சாதனங்களுக்கு இதை பயன்படுத்தவும்.",
            status:
              "நிலை விளக்கம்: 'சேமித்த சாதன அணுகல் உள்ளது' என்றால் உலாவி பழைய அனுமதியை நினைவில் வைத்துள்ளது. 'இணைக்கப்பட்டுள்ளது' என்றால் இந்த செயலி தற்போது நேரடி இணைப்பைத் திறந்துள்ளது.",
          },
        }
      : {
          title: "Smart Pill Box Connection",
          connected: "Connected",
          connectedInWindows: "Bluetooth device connected successfully",
          savedAccessAvailable: "Saved device access available",
          notConnected: "Not connected",
          liveAppConnection: "Live app connection",
          windowsConnectedNote:
            "Windows reports a Bluetooth device is connected successfully. Use app connect only when you need direct pill box control.",
          windowsKnownNotePrefix:
            "This device was detected, but the current check says it is not connected right now:",
          savedAccessNote:
            "The browser remembers an older paired device or permission. Tap Scan Nearby Devices for a fresh scan.",
          scanNote:
            "Pair the pill box in system Bluetooth settings first if needed, then scan from here.",
          nativeSerialConnection: "Native serial connection",
          nativeBluetoothConnection: "Native Bluetooth connection",
          windowsLiveConnected: "Bluetooth device connected successfully",
          windowsLiveDisconnected: "Live status: disconnected",
          disconnecting: "Disconnecting...",
          connecting: "Connecting...",
          disconnectPillBox: "Disconnect Pill Box",
          scanNearbyDevices: "Scan Nearby Devices",
          connectDevice: "Connect Device",
          usePairedWindowsDevice: "Use Paired Device",
          savedAccess: "Saved Access",
          rememberedDevices: "Remembered devices",
          rememberedDevicesNote:
            "Saved Bluetooth devices are shown here in the same app theme. Use them to reconnect directly without losing the fresh-scan option.",
          unnamedSavedDevice: "Unnamed saved Bluetooth device",
          alreadyConnected: "Already connected",
          savedBrowserAccess: "Saved browser Bluetooth access",
          reconnect: "Reconnect",
          savedWindowsDevice: "Saved device",
          savedWindowsPermissions: (count: number) =>
            `${count} saved serial device permission${count === 1 ? "" : "s"} available`,
          openWindowsPicker: "Open the device picker if you want to save a serial device",
          useSavedWindowsDevice: "Use Saved Device",
          openBluetoothSettings: "Open Bluetooth Settings",
          demoActive: "Demo connection active",
          demoNote: "This screen is showing a simulated connected smart pill box for client presentation. Turn Demo mode off from Home to use real Bluetooth.",
          contactTitle: "Contact us",
          contactSubtitle: "Need help with setup, Bluetooth, or reminders?",
          contactEmail: "support@medimind.local",
          contactPhone: "+91 98765 43210",
          supportHours: "Support hours: 9:00 AM - 6:00 PM",
          contactButton: "Contact Us",
          pillsRemainingTitle: "Pills remaining",
          pillsRemainingSubtitle: "All medicine stock types",
          tabletsLeft: "left",
          expired: "Expired",
          expiresIn: "Expires in",
          fresh: "Fresh",
          termsButton: "Terms & Conditions",
          termsTitle: "Terms & Conditions",
          termsDescription: "Please read these points before using MediMind.",
          tips: {
            scan:
              "Scan Nearby Devices: this forces the browser Bluetooth picker and looks for nearby devices instead of just showing remembered ones.",
            saved:
              "Saved Bluetooth Devices: these are now listed inside the app UI itself, using the same theme as the rest of the screen.",
            windows:
              "Use Saved Device: keep this for HC-05 or other classic Bluetooth serial modules that usually connect through the serial picker.",
            status:
              "Status meaning: 'Saved device access available' means the browser remembers a past device permission. 'Connected' means this app currently has the live connection open.",
          },
        };

  const nativeConnectedLabel = "Bluetooth device connected successfully";
  const nativeConnectedNote =
    "Windows reports a Bluetooth device is connected successfully. Use app connect only when you need direct pill box control.";

  const statusLabel = pillBoxConnected
    ? `${copy.connected}${deviceName ? ` ${language === "ta" ? "- " : "to "}${deviceName}` : ""}`
    : nativeWindowsConnected
      ? `${nativeConnectedLabel}${deviceName ? ` ${language === "ta" ? "- " : "to "}${deviceName}` : ""}`
    : systemDeviceReady
      ? copy.savedAccessAvailable
      : copy.notConnected;

  const statusNote = pillBoxConnected
    ? `${copy.liveAppConnection}${connectionTransport ? ` ${language === "ta" ? "வழியாக" : "via"} ${connectionTransport}` : ""}`
    : nativeWindowsConnected
      ? nativeConnectedNote
    : nativeWindowsKnown && deviceName
      ? `${copy.windowsKnownNotePrefix} ${deviceName}.`
    : systemDeviceReady
      ? copy.savedAccessNote
      : copy.scanNote;
  const connectionScore = pillBoxConnected
    ? 100
    : nativeWindowsConnected
      ? 90
      : nativeBridgeSupported && nativeBridgeDeviceCount > 0
        ? 62
        : nativeBridgeFresh
          ? 32
          : systemDeviceReady
            ? 45
            : 8;
  const signalBars = [20, 40, 60, 80, 100];
  const connectionMetrics = [
    {
      label: "Connected",
      value: nativeBridgeConnectedCount,
      max: Math.max(1, nativeBridgeDeviceCount),
      tone: nativeBridgeConnectedCount > 0 || pillBoxConnected ? "bg-success" : "bg-destructive",
    },
    {
      label: "Detected",
      value: nativeBridgeDeviceCount,
      max: Math.max(1, nativeBridgeDeviceCount, 8),
      tone: nativeBridgeDeviceCount > 0 ? "bg-primary" : "bg-muted",
    },
    {
      label: "Bridge",
      value: nativeBridgeSupported ? 1 : 0,
      max: 1,
      tone: nativeBridgeSupported ? "bg-success" : "bg-destructive",
    },
  ];
  const termsSections =
    language === "ta"
      ? [
          {
            title: "மருந்து நினைவூட்டலுக்காக மட்டும்",
            body: "MediMind மருந்து நேரத்தை நினைவில் கொள்ள உதவும். இது மருத்துவ ஆலோசனை அல்ல; மருத்துவர், மருந்தாளர், மருந்துச் சீட்டு அல்லது அவசர சிகிச்சைக்கு மாற்றாக பயன்படுத்தக்கூடாது.",
          },
          {
            title: "உண்மையான வழிமுறைகளை பின்பற்றவும்",
            body: "மருந்து அளவு, உணவு நேரம், மருந்துக் கால அட்டவணை, தவறிய மருந்துக்கான வழிமுறை மற்றும் பாதுகாப்பு எச்சரிக்கைகள் போன்றவற்றில் உங்கள் மருத்துவர் அல்லது மருந்தாளர் கூறிய வழிமுறைகளையே பின்பற்றவும்.",
          },
          {
            title: "தரவு உள்ளீடுகள்",
            body: "மருந்து பெயர்கள், நேரங்கள், கால அட்டவணை தேதிகள், எடுத்தது/தவறியது நிலை, தொடர்பு விவரங்கள் மற்றும் சாதனப் பெயர்கள் செயலி பயன்பாட்டிற்காக உள்ளிடப்படலாம் அல்லது சேமிக்கப்படலாம். தவறான தகவல் தவறான நினைவூட்டலை உருவாக்கலாம், அதனால் கவனமாக சரிபார்க்கவும்.",
          },
          {
            title: "உள்ளூர் தரவு",
            body: "இந்த டெமோ செயலி தரவை இந்த சாதனம் அல்லது உலாவியில் இணையமில்லா பயன்பாட்டிற்காக சேமிக்கும். உலாவி தரவை அழித்தால், சாதனம் மாற்றினால், அல்லது கட்டுமான கோப்புகளை பகிர்ந்தால் அந்த உள்ளூர் தரவு தானாக செல்லாமல் இருக்கலாம்.",
          },
          {
            title: "புளூடூத் மற்றும் சாதன அணுகல்",
            body: "ஸ்மார்ட் மருந்துப் பெட்டி வசதிகள் உலாவி ஆதரவு, சாதன அனுமதிகள், புளூடூத்/சீரியல் இணைப்பு, மின்கலம் மற்றும் சாதன கிடைப்பதன்மை ஆகியவற்றை சார்ந்திருக்கும். முக்கியமான மருந்துகளை நீங்களே உறுதி செய்யவும்.",
          },
        ]
      : [
          {
            title: "Medical reminder only",
            body: "MediMind helps you remember medicine times. It is not medical advice and does not replace a doctor, pharmacist, prescription, or emergency care.",
          },
          {
            title: "Follow your real instructions",
            body: "Always follow the medicine instructions given by your doctor or pharmacist, including dosage, food timing, course duration, missed-dose advice, and safety warnings.",
          },
          {
            title: "Data entries",
            body: "Medicine names, times, course dates, taken/missed status, contact details, and device names are entered or saved for app use. Check entries carefully because wrong data can create wrong reminders.",
          },
          {
            title: "Local/offline data",
            body: "This demo stores app data on this device/browser for offline use. If you clear browser data, change device, or share a zip/build, that local data may not move with it.",
          },
          {
            title: "Bluetooth and device access",
            body: "Smart pill box features depend on browser support, device permissions, Bluetooth/serial pairing, battery, and device availability. Always confirm important doses yourself.",
          },
        ];
  const termsWithBluetoothNotes = [
    ...termsSections,
    {
      title: language === "ta" ? "Bluetooth notes" : "Bluetooth connection notes",
      body: `${copy.tips.scan} ${copy.tips.saved} ${copy.tips.windows} ${copy.tips.status}`,
    },
  ];
  const totalPillsRemaining = medicineSchedules.reduce((total, schedule) => total + schedule.stock, 0);

  return (
    <div className="flex-1 overflow-y-auto bg-page">
      <div className="mx-auto w-full max-w-xl space-y-5 px-5 pb-28 pt-10">
        <div className="flex flex-col items-center gap-6">
          <h1 className="text-center text-2xl font-bold text-foreground">{copy.title}</h1>

          {demoMode && (
            <div className="w-full rounded-2xl border border-primary/20 bg-primary-soft px-4 py-3 text-center text-sm font-bold leading-6 text-primary">
              {copy.demoNote}
            </div>
          )}

          <div className="flex max-w-lg flex-wrap items-center justify-center gap-3 text-center">
            <Bluetooth className="h-8 w-8 shrink-0 text-primary" strokeWidth={2.5} />
            <span className="break-words text-lg font-medium leading-snug text-foreground">{statusLabel}</span>
            {pillBoxConnected && <CheckCircle2 className="h-5 w-5 shrink-0 text-success" strokeWidth={2.5} />}
            {!pillBoxConnected && !systemDeviceReady && <XCircle className="h-5 w-5 shrink-0 text-destructive" strokeWidth={2.5} />}
            {!pillBoxConnected && (systemDeviceReady || nativeWindowsConnected) && (
              <PlugZap className={cn("h-5 w-5 shrink-0", statusIconTone)} strokeWidth={2.5} />
            )}
          </div>

          <p className="max-w-lg text-center text-sm leading-7 text-muted-foreground">{statusNote}</p>

          <div className="w-full rounded-3xl border border-border bg-card p-5 shadow-card">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                  {language === "ta" ? "இணைப்பு நிலை" : "Real Bluetooth status"}
                </p>
                <p className="mt-1 text-2xl font-extrabold text-foreground">{connectionScore}%</p>
              </div>
              <div className="flex h-16 items-end gap-1.5">
                {signalBars.map((bar) => (
                  <span
                    key={bar}
                    className={cn("w-4 rounded-full animate-grow-y", connectionScore >= bar ? "bg-success" : "bg-muted")}
                    style={{ height: `${Math.max(18, bar * 0.62)}px` }}
                  />
                ))}
              </div>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full animate-grow-x",
                  connectionScore >= 90 ? "bg-success" : connectionScore >= 50 ? "bg-warning" : "bg-destructive"
                )}
                style={{ width: `${connectionScore}%` }}
              />
            </div>

            <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(104px,1fr))] gap-2">
              {connectionMetrics.map((metric) => {
                const height = Math.max(12, Math.min(54, (metric.value / metric.max) * 54));
                return (
                  <div key={metric.label} className="rounded-2xl border border-border bg-background p-3">
                    <div className="flex h-14 items-end justify-center">
                      <span className={cn("w-8 rounded-t-lg", metric.tone)} style={{ height: `${height}px` }} />
                    </div>
                    <p className="mt-2 text-center text-lg font-extrabold text-foreground">{metric.value}</p>
                    <p className="break-words text-center text-[10px] font-bold uppercase leading-3 text-muted-foreground">
                      {metric.label}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {connectionTransport && pillBoxConnected && (
            <div className="rounded-full bg-success-soft px-4 py-2 text-center text-xs font-bold uppercase tracking-[0.18em] text-success">
              {connectionTransport === "serial" ? copy.nativeSerialConnection : copy.nativeBluetoothConnection}
            </div>
          )}

          {showWindowsStatus && (
            <div
              className={cn(
                "rounded-full px-4 py-2 text-center text-xs font-bold uppercase tracking-[0.18em]",
                nativeWindowsConnected
                  ? "bg-success-soft text-success"
                  : "bg-secondary text-muted-foreground"
              )}
            >
              {nativeWindowsConnected ? nativeConnectedLabel : copy.windowsLiveDisconnected}
            </div>
          )}

          <div className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm leading-6 text-muted-foreground">
            <p className="font-semibold text-foreground">{nativeBridgeStatus}</p>
            {nativeBluetoothSnapshot?.updatedAt && (
              <p className="mt-1 text-xs">
                Updated {nativeBluetoothSnapshot.updatedAt}
                {nativeBluetoothSnapshot.sourceUrl ? ` via ${nativeBluetoothSnapshot.sourceUrl}` : ""}
              </p>
            )}
            {nativeBluetoothSnapshot?.devices?.some((device) => device.connected) && (
              <div className="mt-2 space-y-1">
                {nativeBluetoothSnapshot.devices
                  .filter((device) => device.connected)
                  .slice(0, 3)
                  .map((device, index) => (
                    <p key={`${device.name || "device"}-${index}`} className="text-xs font-medium text-success">
                      {device.name || "Bluetooth device"} connected
                      {device.source ? ` (${device.source})` : ""}
                    </p>
                  ))}
              </div>
            )}
          </div>

          <div className="flex w-full flex-col gap-3">
            <Button
              onClick={onTogglePillBox}
              disabled={pillBoxBusy}
              className={cn(
                "h-14 w-full justify-center gap-3 rounded-2xl border border-primary/10 bg-primary-soft px-4 text-center text-base font-extrabold text-primary shadow-none hover:bg-primary-soft/80 whitespace-normal",
                pillBoxBusy && "cursor-wait opacity-70"
              )}
            >
              {pillBoxBusy ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {pillBoxConnected ? copy.disconnecting : copy.connecting}
                </>
              ) : demoMode ? (
                <>
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  {copy.demoActive}
                </>
              ) : pillBoxConnected ? (
                copy.disconnectPillBox
              ) : (
                <>
                  <Bluetooth className="h-5 w-5 shrink-0" />
                  {canScanBluetooth ? copy.scanNearbyDevices : copy.connectDevice}
                </>
              )}
            </Button>

            {!pillBoxConnected && canUseWindowsSerial && (
              <Button
                type="button"
                variant="outline"
                onClick={onConnectSavedWindowsDevice}
                disabled={pillBoxBusy}
                className="h-14 w-full justify-center gap-3 rounded-2xl border-primary/20 bg-card px-4 text-center text-base font-extrabold text-foreground shadow-card hover:bg-primary-soft hover:text-primary whitespace-normal"
              >
                <PlugZap className="h-5 w-5 shrink-0 text-primary" />
                {copy.usePairedWindowsDevice}
              </Button>
            )}
          </div>
        </div>

        {showSavedAccess && savedBluetoothDevices.length > 0 && (
          <div className="w-full rounded-3xl border border-border bg-card p-5 shadow-card">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{copy.savedAccess}</p>
            <p className="mt-2 text-base font-semibold text-foreground">{copy.rememberedDevices}</p>
            <p className="mt-1 text-sm leading-7 text-muted-foreground">{copy.rememberedDevicesNote}</p>

            <div className="mt-4 space-y-3">
              {savedBluetoothDevices.map((savedDevice, index) => (
                <div
                  key={savedDevice.id || `${savedDevice.name || "saved-device"}-${index}`}
                  className="rounded-2xl border border-border bg-primary-soft/40 p-4"
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                        <Bluetooth className="h-5 w-5" strokeWidth={2.4} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="break-words font-semibold text-foreground">
                          {savedDevice.name || copy.unnamedSavedDevice}
                        </p>
                        <p className="mt-1 text-xs font-medium leading-6 text-muted-foreground">
                          {savedDevice.gatt?.connected ? copy.alreadyConnected : copy.savedBrowserAccess}
                        </p>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => onReconnectSavedBluetooth(savedDevice)}
                      disabled={pillBoxBusy}
                      className="h-10 w-full rounded-2xl px-4 font-semibold"
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      {copy.reconnect}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          onClick={onOpenSystemBluetooth}
          className="h-14 w-full justify-center gap-3 rounded-2xl border-primary/20 bg-card px-4 text-center text-base font-extrabold text-foreground shadow-card hover:bg-primary-soft hover:text-primary whitespace-normal"
        >
          <ExternalLink className="h-5 w-5 shrink-0 text-primary" />
          {copy.openBluetoothSettings}
        </Button>

        <div className="w-full rounded-3xl border border-border bg-card p-5 shadow-card">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                {copy.pillsRemainingTitle}
              </p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{copy.pillsRemainingSubtitle}</p>
            </div>
            <div className="shrink-0 rounded-2xl bg-primary-soft px-3 py-2 text-center">
              <p className="text-xl font-extrabold text-primary">{totalPillsRemaining}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-primary/80">{copy.tabletsLeft}</p>
            </div>
          </div>

          <div className="grid gap-3">
            {medicineSchedules.map((schedule) => {
              const stockPercent = Math.min(100, Math.max(8, Math.round((schedule.stock / 30) * 100)));
              const stockTone =
                schedule.stock <= 5 ? "bg-warning" : schedule.stock <= 10 ? "bg-primary" : "bg-success";
              const expired = schedule.expiresInDays < 0;
              const expiringSoon = schedule.expiresInDays <= 14;
              const freshnessLabel = expired
                ? copy.expired
                : expiringSoon
                  ? `${copy.expiresIn} ${schedule.expiresInDays}d`
                  : copy.fresh;
              const freshnessTone = expired
                ? "bg-destructive-soft text-destructive"
                : expiringSoon
                  ? "bg-warning-soft text-warning"
                  : "bg-success-soft text-success";

              return (
                <div key={schedule.id} className="rounded-2xl border border-border bg-background p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 break-words text-sm font-bold leading-5 text-foreground">{schedule.name}</p>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                      <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-extrabold leading-4 text-foreground">
                        {schedule.stock} {copy.tabletsLeft}
                      </span>
                      <span className={cn("rounded-full px-2.5 py-1 text-xs font-extrabold leading-4", freshnessTone)}>
                        {freshnessLabel}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full rounded-full animate-grow-x", stockTone)} style={{ width: `${stockPercent}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
};

export default BluetoothScreen;
