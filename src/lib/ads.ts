import { Capacitor, registerPlugin } from "@capacitor/core";

interface RazorAdsPlugin {
  showInterstitial(): Promise<void>;
  showRewarded(): Promise<{ earned: boolean }>;
  showPrivacyOptions(): Promise<void>;
}

const RazorAds = registerPlugin<RazorAdsPlugin>("RazorAds");

export async function showInterstitial(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try { await RazorAds.showInterstitial(); } catch { /* ads never block gameplay */ }
}

export async function showRewarded(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try { return !!(await RazorAds.showRewarded()).earned; } catch { return false; }
}

export async function showPrivacyOptions(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try { await RazorAds.showPrivacyOptions(); } catch { /* privacy form may be unavailable */ }
}
