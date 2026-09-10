/**
 * Notification Service
 *
 * Handles FCM device token registration for push notifications.
 * Requires a development build. In Expo Go every function here is a no-op.
 */
import type * as NotificationsModule from 'expo-notifications';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { API_BASE_URL } from '@/config';
import { getAccessToken } from '@/utils/storage';
import { authenticatedFetch } from './authenticated-fetch';

type Notifications = typeof NotificationsModule;

// Expo Go dropped Android push support in SDK 53 and throws the moment
// expo-notifications is imported. auth.store imports this file and the tab layout
// imports auth.store, so that throw blanked every screen. Load it lazily instead:
// a development build still gets pushes, Expo Go just goes without them.
const IN_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let cachedModule: Notifications | null | undefined;

/** The native module, or null wherever it cannot be loaded. */
export function getNotifications(): Notifications | null {
    if (cachedModule !== undefined) return cachedModule;
    if (IN_EXPO_GO) {
        console.warn('[Notifications] Running in Expo Go — push notifications are disabled.');
        cachedModule = null;
        return null;
    }
    try {
        // Must stay lazy; a static import throws on load in Expo Go.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        cachedModule = require('expo-notifications') as Notifications;
    } catch (error) {
        console.warn('[Notifications] Module unavailable:', error);
        cachedModule = null;
    }
    return cachedModule;
}

// ─── Foreground notification behaviour ───────────────────────────────────────
getNotifications()?.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

// ─── Android notification channel ────────────────────────────────────────────
export async function setupAndroidChannel() {
    const Notifications = getNotifications();
    if (!Notifications || Platform.OS !== 'android') return;

    await Notifications.setNotificationChannelAsync('default', {
        name: 'Avelon Notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#000000',
        sound: 'default',
    });
}

// ─── Request permission & get FCM token ──────────────────────────────────────
export async function getFCMToken(): Promise<string | null> {
    const Notifications = getNotifications();
    if (!Notifications) return null;

    if (!Device.isDevice) {
        console.warn('[Notifications] Push notifications only work on a physical device.');
        return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== 'granted') {
        console.warn('[Notifications] Permission not granted.');
        return null;
    }

    // getExpoPushTokenAsync works in both Expo Go and custom builds
    const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
    if (!projectId) {
        console.warn('[Notifications] EXPO_PUBLIC_EAS_PROJECT_ID is not configured.');
        return null;
    }
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    return tokenData.data;
}

// ─── Register token with backend ─────────────────────────────────────────────
export async function registerDeviceToken(): Promise<void> {
    try {
        await setupAndroidChannel();

        const token = await getFCMToken();
        if (!token) return;

        const platform =
            Platform.OS === 'ios' ? 'IOS' :
            Platform.OS === 'android' ? 'ANDROID' : 'WEB';

        const accessToken = await getAccessToken();
        if (!accessToken) return;

        await authenticatedFetch(`${API_BASE_URL}/notifications/device-token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ token, platform }),
        });

        console.log('[Notifications] Device token registered.');
    } catch (error) {
        // Non-fatal — app still works, user just won't get pushes
        console.warn('[Notifications] Failed to register device token:', error);
    }
}

// ─── Unregister token with backend (on logout) ───────────────────────────────
export async function unregisterDeviceToken(): Promise<void> {
    try {
        const token = await getFCMToken();
        if (!token) return;

        const accessToken = await getAccessToken();
        if (!accessToken) return;

        await authenticatedFetch(`${API_BASE_URL}/notifications/device-token`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ token }),
        });

        console.log('[Notifications] Device token unregistered.');
    } catch (error) {
        console.warn('[Notifications] Failed to unregister device token:', error);
    }
}
