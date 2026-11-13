# Street Credits and Play Billing activation

The combat update provides fight-earned Street Credits and optional purchased credits. Both can pay for combat training; earned credits are used first. Paid credits live in a separate native wallet and survive starting a new game. Training applies to the current run. No credit purchases are enabled in the sideloaded Map Preview APK.

## Products to configure

Create these as consumable one-time products for the existing release app `com.hollowdocksgames.razorcity`. Choose their prices in Play Console; the app displays Google's localized prices rather than hard-coded prices. Leave multi-quantity purchases disabled.

| Product ID | Street Credits |
| --- | ---: |
| `street_credits_100` | 100 |
| `street_credits_550` | 550 |
| `street_credits_1200` | 1,200 |

Add the app's Base64 Play Billing licensing public key to the GitHub Actions secret `RAZOR_PLAY_BILLING_PUBLIC_KEY`. The release AAB workflow supplies it to the generated Android resource. Without this key, or with the `.mappreview` application ID, premium checkout remains disabled. The public key is used to verify Play's signed purchase data; it is not a private signing key.

Build the release AAB and install it through a Google Play internal testing track with license testers before activating public sales. Verify successful, cancelled and pending purchases; reconnect/reopen recovery; repeat purchases; and training with mixed earned/purchased balances. No Play Console products, prices, or public releases were created by this source update.

## Implemented payment behavior

The existing TipBilling plugin remains the single BillingClient. Tip products and credit products are queried separately. Credit receipts must be PURCHASED, contain a known product ID, match the release package, have quantity one and pass signature verification. Pending/cancelled purchases grant no credits. Receipt token and balance are committed together before consumption; a failed consume is retried on reconnect without granting credits twice. Unknown purchases are ignored rather than consumed.

Training debits have durable transaction IDs. The game writes a training journal before debiting the native wallet and saves the completed game state before clearing the journal. Reopening recovers an interrupted transaction idempotently. Paid wallet mutations are covered by native CreditLedger unit tests. Game test code cannot grant purchased coins.

The wallet is device-local. It is not an account-backed server wallet and does not restore consumed balances across devices or a data wipe. Refund/revocation reconciliation and cross-device balances require a backend before offering those guarantees. Google recommends server verification, token deduplication and refund handling for production monetization: https://developer.android.com/google/play/billing/security . Client-side receipt checks are a minimum safeguard, not an anti-tamper guarantee.
