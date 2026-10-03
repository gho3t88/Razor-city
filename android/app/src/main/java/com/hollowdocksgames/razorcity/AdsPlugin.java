package com.hollowdocksgames.razorcity;

import androidx.annotation.NonNull;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.UserMessagingPlatform;

@CapacitorPlugin(name = "RazorAds")
public class AdsPlugin extends Plugin {
    private static final String PROD_INTERSTITIAL = "ca-app-pub-7161742587808200/7897443874";
    private static final String PROD_REWARDED = "ca-app-pub-7161742587808200/9729400293";
    private static final String TEST_INTERSTITIAL = "ca-app-pub-3940256099942544/1033173712";
    private static final String TEST_REWARDED = "ca-app-pub-3940256099942544/5224354917";

    private String interstitialId() { return isDebugBuild() ? TEST_INTERSTITIAL : PROD_INTERSTITIAL; }
    private String rewardedId() { return isDebugBuild() ? TEST_REWARDED : PROD_REWARDED; }

    private boolean isDebugBuild() {
        return (getContext().getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0;
    }

    private boolean canRequestAds() {
        ConsentInformation consentInformation = UserMessagingPlatform.getConsentInformation(getContext());
        return consentInformation.canRequestAds();
    }

    @PluginMethod
    public void showInterstitial(PluginCall call) {
        if (!canRequestAds()) { call.resolve(); return; }
        getActivity().runOnUiThread(() ->
            InterstitialAd.load(getContext(), interstitialId(), new AdRequest.Builder().build(),
                new InterstitialAdLoadCallback() {
                    @Override public void onAdLoaded(@NonNull InterstitialAd ad) {
                        ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                            @Override public void onAdDismissedFullScreenContent() { call.resolve(); }
                            @Override public void onAdFailedToShowFullScreenContent(@NonNull AdError e) { call.resolve(); }
                        });
                        ad.show(getActivity());
                    }
                    @Override public void onAdFailedToLoad(@NonNull LoadAdError e) { call.resolve(); }
                })
        );
    }

    @PluginMethod
    public void showRewarded(PluginCall call) {
        if (!canRequestAds()) { call.resolve(new JSObject().put("earned", false)); return; }
        getActivity().runOnUiThread(() ->
            RewardedAd.load(getContext(), rewardedId(), new AdRequest.Builder().build(),
                new RewardedAdLoadCallback() {
                    @Override public void onAdLoaded(@NonNull RewardedAd ad) {
                        final boolean[] earned = {false};
                        ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                            @Override public void onAdDismissedFullScreenContent() {
                                call.resolve(new JSObject().put("earned", earned[0]));
                            }
                            @Override public void onAdFailedToShowFullScreenContent(@NonNull AdError e) {
                                call.resolve(new JSObject().put("earned", false));
                            }
                        });
                        ad.show(getActivity(), reward -> earned[0] = true);
                    }
                    @Override public void onAdFailedToLoad(@NonNull LoadAdError e) {
                        call.resolve(new JSObject().put("earned", false));
                    }
                })
        );
    }
    @PluginMethod
    public void showPrivacyOptions(PluginCall call) {
        getActivity().runOnUiThread(() ->
            UserMessagingPlatform.showPrivacyOptionsForm(getActivity(), formError -> call.resolve())
        );
    }
}
