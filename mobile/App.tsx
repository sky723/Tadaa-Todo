import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import * as Haptics from 'expo-haptics';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import Constants from 'expo-constants';

// Set EXPO_PUBLIC_WEB_URL (or expo.extra.webUrl) to the deployed Next.js app to get cloud sync.
// With no URL — or when the device is offline — the bundled standalone app runs instead.
const WEB_URL: string = process.env.EXPO_PUBLIC_WEB_URL || (Constants.expoConfig?.extra?.webUrl as string) || '';

/** Native haptics mirror the in-app sounds: tick → crisp tap, soft → light, success → notification. */
function onMessage(e: WebViewMessageEvent) {
  try {
    const { haptic } = JSON.parse(e.nativeEvent.data) as { haptic?: 'tick' | 'soft' | 'success' };
    if (haptic === 'tick') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    else if (haptic === 'soft') void Haptics.selectionAsync();
    else if (haptic === 'success') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch { /* ignore non-JSON messages */ }
}

export default function App() {
  const [offlineHtml, setOfflineHtml] = useState<string | null>(null);
  const [useOffline, setUseOffline] = useState(!WEB_URL);
  const ref = useRef<WebView>(null);

  useEffect(() => {
    (async () => {
      const asset = Asset.fromModule(require('./assets/app.html'));
      await asset.downloadAsync();
      if (asset.localUri) setOfflineHtml(await FileSystem.readAsStringAsync(asset.localUri));
    })().catch(() => setOfflineHtml('<h1>Tadaa</h1><p>Could not load the offline app.</p>'));
  }, []);

  const source = useOffline
    ? offlineHtml ? { html: offlineHtml, baseUrl: 'https://tadaa.local' } : undefined
    : { uri: WEB_URL };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      {source ? (
        <WebView
          ref={ref}
          source={source}
          style={styles.web}
          onMessage={onMessage}
          javaScriptEnabled
          domStorageEnabled
          // Web Audio needs to start without a separate native play gesture
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
          setSupportMultipleWindows={false}
          onError={() => setUseOffline(true)}
          onHttpError={() => setUseOffline(true)}
        />
      ) : (
        <View style={styles.center}><ActivityIndicator color="#FFD23F" /></View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#111111' },
  web: { flex: 1, backgroundColor: '#FFFBF0' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
