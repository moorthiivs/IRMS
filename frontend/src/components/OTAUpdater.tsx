import { useEffect, useState } from 'react';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { Capacitor } from '@capacitor/core';
import { notifications } from '@mantine/notifications';
import { Button } from '@mantine/core';
import { motion, AnimatePresence } from 'framer-motion';

export function OTAUpdater() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [remoteVersion, setRemoteVersion] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [downloadPercent, setDownloadPercent] = useState(0);
  const [originUrl, setOriginUrl] = useState('');

  useEffect(() => {
    // Only check for OTA updates on Native platforms (Android/iOS)
    if (Capacitor.isNativePlatform()) {
      CapacitorUpdater.notifyAppReady();
      checkForUpdates();

      // Listen for download progress
      const listener = CapacitorUpdater.addListener('download', (info: any) => {
        setDownloadPercent(Math.round(info.percent));
      });

      const handleForceUpdate = () => {
        checkForUpdates(true);
      };
      window.addEventListener('force-ota-update', handleForceUpdate);

      return () => {
        listener.then(l => l.remove());
        window.removeEventListener('force-ota-update', handleForceUpdate);
      };
    }
  }, []);

  const checkForUpdates = async (forceShow = false) => {
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      let origin = '';
      try {
        const urlObj = new URL(baseUrl);
        origin = urlObj.origin;
      } catch (e) {
        origin = 'https://irms-gzasfnghh6g2b3hu.centralindia-01.azurewebsites.net';
      }
      setOriginUrl(origin);

      const res = await fetch(`${origin}/version.json?t=${Date.now()}`);
      if (!res.ok) return;
      
      const data = await res.json();
      const version = data.version;
      const localVersion = localStorage.getItem('app_version') || 'built-in';
      const skippedVersion = localStorage.getItem('skipped_version');

      if (version && version !== localVersion && (forceShow || version !== skippedVersion)) {
        setRemoteVersion(version);
        setUpdateAvailable(true);
      }
    } catch (error) {
      console.error('Update check failed:', error);
    }
  };

  const handleUpdate = async () => {
    if (!remoteVersion) return;
    setUpdating(true);
    setDownloadPercent(0);
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
        url: `${originUrl}/update.zip`,
        version: remoteVersion,
      });
      
      localStorage.setItem('app_version', remoteVersion);
      await CapacitorUpdater.set(versionInfo);
    } catch (err) {
      console.error('Failed to apply update', err);
      setUpdating(false);
      notifications.update({
        id: 'ota-update',
        loading: false,
        title: 'Update Failed',
        message: 'Failed to download or apply the update. Please try again later.',
        color: 'red',
        autoClose: 5000,
      });
    }
  };

  const handleSkip = () => {
    if (remoteVersion) {
      localStorage.setItem('skipped_version', remoteVersion);
    }
    setUpdateAvailable(false);
  };

  return (
    <AnimatePresence>
      {updateAvailable && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="fixed inset-0 z-[9999] bg-white dark:bg-[#1a1b1e] flex flex-col items-center justify-center p-8 text-center"
        >
          {/* Illustration Section */}
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="mb-10 w-full max-w-sm"
          >
            <img 
              src="/update_illustration.png" 
              alt="Update App" 
              className="w-full h-auto object-contain drop-shadow-sm" 
              onError={(e) => {
                // Fallback if image not found
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            className="flex flex-col items-center w-full"
          >
            <h1 className="text-3xl font-extrabold text-slate-800 dark:text-gray-100 mb-4 tracking-tight">
              Time To Update!
            </h1>
            
            <p className="text-slate-500 dark:text-gray-400 text-sm md:text-base max-w-[280px] leading-relaxed mb-8 font-medium">
              We added lots of new features and fix some bugs to make your experience as smooth as possible
            </p>

            {updating && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mb-6 w-full max-w-[240px]"
              >
                <div className="w-full bg-slate-100 dark:bg-[#2c2e33] rounded-full h-2 mb-2 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-pink-500 to-orange-400 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${downloadPercent}%` }}
                  ></div>
                </div>
                <p className="text-xs text-orange-500 font-bold animate-pulse">
                  ⚠️ Please do not close the app
                </p>
              </motion.div>
            )}

            <Button
              size="xl"
              radius="xl"
              onClick={handleUpdate}
              disabled={updating}
              className={`w-full max-w-[280px] text-white font-bold text-lg tracking-wide shadow-xl shadow-pink-500/30 bg-gradient-to-r from-pink-500 to-orange-400 hover:opacity-90 transition-all duration-300 transform hover:-translate-y-1 ${updating ? 'opacity-90 cursor-not-allowed transform-none hover:transform-none' : 'active:scale-95'}`}
            >
              {updating ? `UPDATING... ${downloadPercent}%` : 'UPDATE APP'}
            </Button>

            {!updating && (
              <Button
                size="xl"
                radius="xl"
                variant="light"
                color="gray"
                onClick={handleSkip}
                className="mt-4 w-full max-w-[280px] text-slate-500 font-bold text-base tracking-wide hover:bg-slate-200 transition-all duration-300 active:scale-95"
              >
                NOT NOW
              </Button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
