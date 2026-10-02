package com.hollowdocksgames.razorcity;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.google.android.gms.ads.MobileAds;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(TipBillingPlugin.class);
        registerPlugin(AdsPlugin.class);
        super.onCreate(savedInstanceState);
        new Thread(() -> MobileAds.initialize(this, status -> {})).start();
    }
}
