package com.razorcity.game;

import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.ConsumeParams;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@CapacitorPlugin(name = "TipBilling")
public class TipBillingPlugin extends Plugin {
    private static final String[] TIP_IDS = {"tip_small", "tip_medium", "tip_large"};
    private BillingClient client;
    private PluginCall pendingPurchase;

    @Override
    public void load() {
        client = BillingClient.newBuilder(getContext())
            .setListener((result, purchases) -> {
                if (result.getResponseCode() == BillingClient.BillingResponseCode.OK && purchases != null) {
                    for (Purchase purchase : purchases) handlePurchase(purchase);
                } else if (pendingPurchase != null) {
                    PluginCall call = pendingPurchase;
                    pendingPurchase = null;
                    if (result.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED) {
                        call.resolve(new JSObject().put("status", "cancelled"));
                    } else {
                        call.reject("Google Play purchase failed: " + result.getDebugMessage());
                    }
                }
            })
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .enableAutoServiceReconnection()
            .build();
        connect(null);
    }

    private void connect(Runnable ready) {
        if (client.isReady()) {
            if (ready != null) ready.run();
            return;
        }
        client.startConnection(new BillingClientStateListener() {
            @Override public void onBillingSetupFinished(BillingResult result) {
                if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    recoverPurchases();
                    if (ready != null) ready.run();
                }
            }
            @Override public void onBillingServiceDisconnected() { }
        });
    }

    private void recoverPurchases() {
        client.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(),
            (result, purchases) -> {
                if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    for (Purchase purchase : purchases) handlePurchase(purchase);
                }
            });
    }

    private void queryProducts(PluginCall call, boolean buy) {
        List<QueryProductDetailsParams.Product> products = new ArrayList<>();
        for (String id : TIP_IDS) {
            products.add(QueryProductDetailsParams.Product.newBuilder()
                .setProductId(id).setProductType(BillingClient.ProductType.INAPP).build());
        }
        client.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(products).build(),
            (result, details) -> {
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    call.reject("Google Play products unavailable: " + result.getDebugMessage());
                    return;
                }
                if (buy) {
                    String id = call.getString("productId", "");
                    for (ProductDetails product : details.getProductDetailsList()) {
                        if (product.getProductId().equals(id)) {
                            List<ProductDetails.OneTimePurchaseOfferDetails> offers = product.getOneTimePurchaseOfferDetailsList();
                            if (offers == null || offers.isEmpty()) break;
                            BillingFlowParams.ProductDetailsParams item = BillingFlowParams.ProductDetailsParams.newBuilder()
                                .setProductDetails(product).setOfferToken(offers.get(0).getOfferToken()).build();
                            BillingFlowParams flow = BillingFlowParams.newBuilder()
                                .setProductDetailsParamsList(Collections.singletonList(item)).build();
                            getActivity().runOnUiThread(() -> {
                                pendingPurchase = call;
                                BillingResult launch = client.launchBillingFlow(getActivity(), flow);
                                if (launch.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                                    pendingPurchase = null;
                                    call.reject("Could not open Google Play checkout: " + launch.getDebugMessage());
                                }
                            });
                            return;
                        }
                    }
                    call.reject("Tip unavailable. Activate " + id + " in Play Console first.");
                } else {
                    JSArray list = new JSArray();
                    for (ProductDetails product : details.getProductDetailsList()) {
                        List<ProductDetails.OneTimePurchaseOfferDetails> offers = product.getOneTimePurchaseOfferDetailsList();
                        if (offers != null && !offers.isEmpty()) {
                            list.put(new JSObject().put("id", product.getProductId()).put("price", offers.get(0).getFormattedPrice()));
                        }
                    }
                    call.resolve(new JSObject().put("products", list));
                }
            });
    }

    @PluginMethod public void list(PluginCall call) {
        if (!client.isReady()) { call.reject("Google Play Billing is unavailable on this device."); return; }
        queryProducts(call, false);
    }

    @PluginMethod public void purchase(PluginCall call) {
        String id = call.getString("productId", "");
        boolean valid = false;
        for (String known : TIP_IDS) if (known.equals(id)) valid = true;
        if (!valid) { call.reject("Unknown tip amount."); return; }
        if (!client.isReady()) { call.reject("Google Play Billing is unavailable on this device."); return; }
        if (pendingPurchase != null) { call.reject("A purchase is already in progress."); return; }
        queryProducts(call, true);
    }

    private void handlePurchase(Purchase purchase) {
        if (purchase.getPurchaseState() == Purchase.PurchaseState.PENDING) {
            if (pendingPurchase != null) {
                PluginCall call = pendingPurchase;
                pendingPurchase = null;
                call.resolve(new JSObject().put("status", "pending"));
            }
            return;
        }
        if (purchase.getPurchaseState() != Purchase.PurchaseState.PURCHASED) return;
        // Consuming a repeatable tip also acknowledges it. Retry unconsumed purchases on reconnect.
        client.consumeAsync(ConsumeParams.newBuilder().setPurchaseToken(purchase.getPurchaseToken()).build(),
            (result, token) -> {
                if (pendingPurchase != null) {
                    PluginCall call = pendingPurchase;
                    pendingPurchase = null;
                    if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                        call.resolve(new JSObject().put("status", "purchased"));
                    } else {
                        call.reject("Payment is processing. Google Play will retry the confirmation.");
                    }
                }
            });
    }

    @Override protected void handleOnResume() {
        super.handleOnResume();
        if (client != null && client.isReady()) recoverPurchases();
    }

    @Override protected void handleOnDestroy() {
        if (client != null) client.endConnection();
        super.handleOnDestroy();
    }
}
