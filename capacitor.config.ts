import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gentledose.app',
  appName: 'MediMind',
  webDir: 'dist',
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_notification_pill',
      iconColor: '#0d9488'
    }
  }
};

export default config;
