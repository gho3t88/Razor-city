package com.hollowdocksgames.razorcity;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.google.android.gms.ads.MobileAds;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(TipBillingPlugin.class);
        registerPlugin(AdsPlugin.class);
        super.onCreate(savedInstanceState);
        ConsentInformation consentInformation = UserMessagingPlatform.getConsentInformation(this);
        ConsentRequestParameters params = new ConsentRequestParameters.Builder().build();
        consentInformation.requestConsentInfoUpdate(this, params, () -> {
            UserMessagingPlatform.loadAndShowConsentFormIfRequired(this, formError -> {
                if (consentInformation.canRequestAds()) MobileAds.initialize(this, status -> {});
            });
            if (consentInformation.canRequestAds()) MobileAds.initialize(this, status -> {});
        }, requestConsentError -> {
            if (consentInformation.canRequestAds()) MobileAds.initialize(this, status -> {});
        });
    }
}
