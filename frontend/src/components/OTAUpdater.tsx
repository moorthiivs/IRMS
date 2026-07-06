import { useEffect } from 'react';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { Capacitor } from '@capacitor/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';

export function OTAUpdater() {
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      CapacitorUpdater.notifyAppReady();
      checkForUpdates();
    }
  }, []);

  const checkForUpdates = async () => {
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      // The update url is the base URL without /api, or we can just hardcode the domain if needed.
      // Assuming VITE_API_URL is https://example.com/api, we want https://example.com
      let origin = '';
      try {
        const urlObj = new URL(baseUrl);
        origin = urlObj.origin;
      } catch (e) {
        origin = 'https://irms-gzasfnghh6g2b3hu.centralindia-01.azurewebsites.net';
      }

      const res = await fetch(`${origin}/version.json?t=${Date.now()}`);
      if (!res.ok) return;
      
      const data = await res.json();
      const remoteVersion = data.version;
      const localVersion = localStorage.getItem('app_version') || 'built-in';

      if (remoteVersion && remoteVersion !== localVersion) {
        modals.openConfirmModal({
          title: 'New Version Available',
          children: 'A new update is available. Would you like to update the app now? The application will restart.',
          labels: { confirm: 'Update Now', cancel: 'Later' },
          onConfirm: async () => {
            try {
              notifications.show({
                id: 'ota-update',
                loading: true,
                title: 'Updating...',
                message: 'Downloading the latest version',
                autoClose: false,
                withCloseButton: false,
              });

              const versionInfo = await CapacitorUpdater.download({
                url: `${origin}/update.zip`,
                version: remoteVersion,
              });
              
              localStorage.setItem('app_version', remoteVersion);
              await CapacitorUpdater.set(versionInfo);
            } catch (err) {
              console.error('Failed to apply update', err);
              notifications.update({
                id: 'ota-update',
                loading: false,
                title: 'Update Failed',
                message: 'Failed to download or apply the update. Please try again later.',
                color: 'red',
                autoClose: 5000,
              });
            }
          }
        });
      }
    } catch (error) {
      console.error('Update check failed:', error);
    }
  };

  return null;
}
