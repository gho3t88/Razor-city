package com.hollowdocksgames.razorcity;

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
import android.content.SharedPreferences;
import android.util.Base64;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.util.HashSet;
import java.util.Set;

@CapacitorPlugin(name = "TipBilling")
public class TipBillingPlugin extends Plugin {
    private static final String[] TIP_IDS = {"tip_small", "tip_medium", "tip_large"};
    private static final String[] CREDIT_IDS = {"street_credits_100", "street_credits_550", "street_credits_1200"};
    private final Set<String> processing = new HashSet<>();
    private SharedPreferences wallet;
    private CreditLedger ledger;
    private BillingClient client;
    private String pendingProduct = "";
    private boolean creditsEnabled() {
        return getContext().getPackageName().equals("com.hollowdocksgames.razorcity")
            && !getContext().getString(R.string.play_billing_public_key).isEmpty();
    }
    private int packSize(String id) {
        if (id.equals("street_credits_100")) return 100;
        if (id.equals("street_credits_550")) return 550;
        if (id.equals("street_credits_1200")) return 1200;
        return 0;
    }
    private boolean isTip(String id) { for (String tip : TIP_IDS) if (tip.equals(id)) return true; return false; }
    private boolean verify(Purchase purchase) {
        try {
            byte[] key = Base64.decode(getContext().getString(R.string.play_billing_public_key), Base64.DEFAULT);
            Signature verifier = Signature.getInstance("SHA1withRSA");
            verifier.initVerify(KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(key)));
            verifier.update(purchase.getOriginalJson().getBytes(StandardCharsets.UTF_8));
            return verifier.verify(Base64.decode(purchase.getSignature(), Base64.DEFAULT));
        } catch (Exception error) { return false; }
    }
    private PluginCall pendingPurchase;

    @Override
    public void load() {
        wallet = getContext().getSharedPreferences("razor-credit-wallet-v1", 0);
        ledger = new CreditLedger(new CreditLedger.Storage() {
            public int balance() { return wallet.getInt("balance", 0); }
            public boolean hasReceipt(String token) { return wallet.getBoolean("receipt:" + token, false); }
            public int spent(String id) { return wallet.getInt("spend:" + id, -1); }
            public boolean grant(String token, int balance) {
                int previous = wallet.getInt("balance", 0);
                boolean saved = wallet.edit().putInt("balance", balance).putBoolean("receipt:" + token, true).commit();
                if (!saved) wallet.edit().putInt("balance", previous).remove("receipt:" + token).commit();
                return saved;
            }
            public boolean debit(String id, int amount, int balance) {
                int previous = wallet.getInt("balance", 0);
                boolean saved = wallet.edit().putInt("balance", balance).putInt("spend:" + id, amount).commit();
                if (!saved) wallet.edit().putInt("balance", previous).remove("spend:" + id).commit();
                return saved;
            }
        });
        client = BillingClient.newBuilder(getContext())
            .setListener((result, purchases) -> {
                if (result.getResponseCode() == BillingClient.BillingResponseCode.OK && purchases != null) {
                    for (Purchase purchase : purchases) handlePurchase(purchase, true);
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
                    for (Purchase purchase : purchases) handlePurchase(purchase, false);
                }
            });
    }

    private void queryProducts(PluginCall call, boolean buy) {
        List<QueryProductDetailsParams.Product> products = new ArrayList<>();
        boolean credits = "credits".equals(call.getString("kind", "tips"));
        if (credits && !creditsEnabled()) { call.resolve(new JSObject().put("products", new JSArray()).put("enabled", false)); return; }
        for (String id : credits ? CREDIT_IDS : TIP_IDS) {
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
                                pendingProduct = id;
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
        if (packSize(id) > 0) {
            if (!creditsEnabled()) { call.reject("Credit packs are not activated in this build."); return; }
            valid = true; call.getData().put("kind", "credits");
        }
        if (!valid) { call.reject("Unknown tip amount."); return; }
        if (!client.isReady()) { call.reject("Google Play Billing is unavailable on this device."); return; }
        if (pendingPurchase != null) { call.reject("A purchase is already in progress."); return; }
        queryProducts(call, true);
    }

    private void handlePurchase(Purchase purchase, boolean checkout) {
        if (purchase.getProducts().size() != 1 || !purchase.getPackageName().equals(getContext().getPackageName())) return;
        String product = purchase.getProducts().get(0);
        int amount = packSize(product);
        if (amount == 0 && !isTip(product)) return;
        boolean matchesCall = checkout && pendingPurchase != null && product.equals(pendingProduct);
        if (purchase.getPurchaseState() == Purchase.PurchaseState.PENDING) {
            if (matchesCall) { PluginCall call = pendingPurchase; pendingPurchase = null; call.resolve(new JSObject().put("status", "pending")); }
            return;
        }
        if (purchase.getPurchaseState() != Purchase.PurchaseState.PURCHASED) return;
        if (amount > 0 && (!creditsEnabled() || !verify(purchase) || purchase.getQuantity() != 1)) {
            if (matchesCall) { PluginCall call = pendingPurchase; pendingPurchase = null; call.reject("Purchase verification failed. No credits granted."); }
            return;
        }
        String token = purchase.getPurchaseToken();
        synchronized (this) {
            if (!processing.add(token)) return;
            // Persist credits and receipt together BEFORE consumption; a retry never grants twice.
            if (amount > 0 && !ledger.grant(token, amount)) {
                processing.remove(token);
                if (matchesCall) { PluginCall call = pendingPurchase; pendingPurchase = null; call.reject("Could not save your credits. Purchase will recover on reconnect."); }
                return;
            }
        }
        client.consumeAsync(ConsumeParams.newBuilder().setPurchaseToken(token).build(), (result, consumedToken) -> {
            synchronized (this) { processing.remove(token); }
            if (checkout && pendingPurchase != null && product.equals(pendingProduct)) {
                PluginCall call = pendingPurchase; pendingPurchase = null;
                call.resolve(new JSObject().put("status", "purchased").put("balance", wallet.getInt("balance", 0))
                    .put("confirmationPending", result.getResponseCode() != BillingClient.BillingResponseCode.OK));
            }
        });
    }

    @PluginMethod public synchronized void creditWallet(PluginCall call) {
        call.resolve(new JSObject().put("balance", wallet.getInt("balance", 0)).put("enabled", creditsEnabled()));
    }

    @PluginMethod public synchronized void spendCredits(PluginCall call) {
        String id = call.getString("transactionId", "");
        Integer amount = call.getInt("amount");
        CreditLedger.Debit result = ledger.spend(id, amount == null ? 0 : amount);
        if (result == CreditLedger.Debit.INSUFFICIENT) { call.reject("Not enough purchased Street Credits.", "INSUFFICIENT_CREDITS"); return; }
        if (result != CreditLedger.Debit.OK) { call.reject("Training debit could not be completed: " + result.name()); return; }
        call.resolve(new JSObject().put("balance", wallet.getInt("balance", 0)));
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
