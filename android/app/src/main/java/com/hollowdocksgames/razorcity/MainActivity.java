package com.hollowdocksgames.razorcity;

import android.os.Bundle;
import java.util.concurrent.atomic.AtomicBoolean;
import com.getcapacitor.BridgeActivity;
import com.google.android.gms.ads.MobileAds;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;

public class MainActivity extends BridgeActivity {
    private final AtomicBoolean mobileAdsInitialized = new AtomicBoolean(false);
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(TipBillingPlugin.class);
        registerPlugin(AdsPlugin.class);
        super.onCreate(savedInstanceState);
        ConsentInformation consentInformation = UserMessagingPlatform.getConsentInformation(this);
        ConsentRequestParameters params = new ConsentRequestParameters.Builder().build();
        consentInformation.requestConsentInfoUpdate(this, params, () -> {
            UserMessagingPlatform.loadAndShowConsentFormIfRequired(this, formError -> {
                if (consentInformation.canRequestAds()) initializeMobileAds();
            });
            if (consentInformation.canRequestAds()) initializeMobileAds();
        }, requestConsentError -> {
            if (consentInformation.canRequestAds()) initializeMobileAds();
        });
    }

    private void initializeMobileAds() {
        if (mobileAdsInitialized.getAndSet(true)) return;
        MobileAds.initialize(this, status -> {});
    }
}
