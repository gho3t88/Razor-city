package com.hollowdocksgames.razorcity;
import org.junit.Test;
import java.util.HashMap;
import java.util.HashSet;
import static org.junit.Assert.*;
public class CreditLedgerTest {
    static class Memory implements CreditLedger.Storage {
        int balance; boolean fail;
        HashSet<String> receipts = new HashSet<>(); HashMap<String,Integer> spent = new HashMap<>();
        public int balance() { return balance; }
        public boolean hasReceipt(String token) { return receipts.contains(token); }
        public int spent(String id) { return spent.getOrDefault(id, -1); }
        public boolean grant(String token, int next) { if (fail) return false; balance = next; receipts.add(token); return true; }
        public boolean debit(String id, int amount, int next) { if (fail) return false; balance = next; spent.put(id, amount); return true; }
    }
    @Test public void recoveredReceiptsNeverGrantTwice() {
        Memory m = new Memory(); CreditLedger l = new CreditLedger(m);
        assertTrue(l.grant("receipt", 100)); assertTrue(l.grant("receipt", 100)); assertEquals(100, m.balance);
        CreditLedger reopened = new CreditLedger(m); assertTrue(reopened.grant("receipt", 100)); assertEquals(100, m.balance);
        assertTrue(reopened.grant("next-receipt", 550)); assertEquals(650, m.balance);
    }
    @Test public void retriesNeverDebitTwiceAndMismatchFails() {
        Memory m = new Memory(); CreditLedger l = new CreditLedger(m); l.grant("receipt", 100);
        assertEquals(CreditLedger.Debit.OK, l.spend("training_001", 25)); assertEquals(75, m.balance);
        assertEquals(CreditLedger.Debit.OK, new CreditLedger(m).spend("training_001", 25)); assertEquals(75, m.balance);
        assertEquals(CreditLedger.Debit.MISMATCH, l.spend("training_001", 35)); assertEquals(75, m.balance);
    }
    @Test public void failedStorageCannotGrantOrSpend() {
        Memory m = new Memory(); CreditLedger l = new CreditLedger(m); m.fail = true;
        assertFalse(l.grant("receipt", 100)); assertEquals(0, m.balance); assertFalse(m.hasReceipt("receipt"));
        m.fail = false; l.grant("receipt", 100); m.fail = true;
        assertEquals(CreditLedger.Debit.SAVE_FAILED, l.spend("training_001", 25)); assertEquals(100, m.balance); assertEquals(-1, m.spent("training_001"));
    }
    @Test public void invalidAndInsufficientDebitsLeaveWalletAlone() {
        Memory m = new Memory(); CreditLedger l = new CreditLedger(m);
        assertEquals(CreditLedger.Debit.INSUFFICIENT, l.spend("training_001", 25));
        assertEquals(CreditLedger.Debit.INVALID, l.spend("x", 25)); assertEquals(CreditLedger.Debit.INVALID, l.spend("training_001", -25));
        assertEquals(CreditLedger.Debit.INVALID, l.spend("training_001", 99999)); assertEquals(0, m.balance);
    }
}
