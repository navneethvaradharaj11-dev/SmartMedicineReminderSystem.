# Rebuild Vite assets
Write-Host "Building web assets..." -ForegroundColor Cyan
npm.cmd run build

# Sync assets to Android project
Write-Host "Syncing assets to Android native project..." -ForegroundColor Cyan
npx.cmd cap sync android

# Replace symlinks with regular files to avoid Gradle build errors on Windows
Write-Host "Replacing symlinks with regular files in Android assets..." -ForegroundColor Cyan
Remove-Item -Path "android/app/src/main/assets/public" -Recurse -Force -ErrorAction Ignore
New-Item -ItemType Directory -Path "android/app/src/main/assets/public" -Force | Out-Null
Copy-Item -Path "dist/*" -Destination "android/app/src/main/assets/public" -Recurse -Force

# Compile APK using Gradle wrapper
Write-Host "Compiling APK using Gradle..." -ForegroundColor Cyan
Set-Location android
.\gradlew.bat assembleDebug
Set-Location ..

# Copy compiled APK to project root
Copy-Item -Path "android/app/build/outputs/apk/debug/app-debug.apk" -Destination "Gentle-Dose-debug.apk" -Force

# Check and install on active emulator
$adbPath = "C:\Users\Navneeth V\AppData\Local\Android\Sdk\platform-tools\adb.exe"
if (Test-Path $adbPath) {
    Write-Host "Installing APK onto connected emulator..." -ForegroundColor Cyan
    & $adbPath install -r Gentle-Dose-debug.apk
    
    Write-Host "Launching app on emulator..." -ForegroundColor Cyan
    & $adbPath shell monkey -p com.gentledose.app -c android.intent.category.LAUNCHER 1 | Out-Null
    Write-Host "App launched successfully!" -ForegroundColor Green
} else {
    Write-Host "ADB path not found at $adbPath. Could not auto-install to emulator." -ForegroundColor Yellow
}
