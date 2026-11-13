import { Capacitor, registerPlugin } from "@capacitor/core";
export const CREDIT_PACKS = [{ id: "street_credits_100", credits: 100 }, { id: "street_credits_550", credits: 550 }, { id: "street_credits_1200", credits: 1200 }];
interface CreditBilling {
  list(options: { kind: "credits" }): Promise<{ products: { id: string; price: string }[] }>;
  purchase(options: { productId: string; kind: "credits" }): Promise<{ status: "purchased" | "pending" | "cancelled"; balance?: number }>;
  creditWallet(): Promise<{ balance: number; enabled: boolean }>;
  spendCredits(options: { transactionId: string; amount: number }): Promise<{ balance: number }>;
}
const billing = registerPlugin<CreditBilling>("TipBilling");
export async function creditWallet() { return Capacitor.isNativePlatform() ? billing.creditWallet() : { balance: 0, enabled: false }; }
export async function listCreditPacks() { return Capacitor.isNativePlatform() ? billing.list({ kind: "credits" }) : { products: [] }; }
export async function purchaseCredits(productId: string) {
  if (!Capacitor.isNativePlatform()) throw new Error("Credit packs are available in the Google Play release.");
  return billing.purchase({ productId, kind: "credits" });
}
export async function spendCredits(transactionId: string, amount: number) {
  if (!Capacitor.isNativePlatform()) throw new Error("No purchased credits are available in this preview.");
  return billing.spendCredits({ transactionId, amount });
}
