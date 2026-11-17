package com.hollowdocksgames.razorcity;

/** Receipt and debit rules shared by purchase recovery and the native wallet. */
public final class CreditLedger {
    public interface Storage {
        int balance();
        boolean hasReceipt(String token);
        int spent(String transaction);
        boolean grant(String token, int balance);
        boolean debit(String transaction, int amount, int balance);
    }
    public enum Debit { OK, INVALID, MISMATCH, INSUFFICIENT, SAVE_FAILED }
    private final Storage storage;
    public CreditLedger(Storage storage) { this.storage = storage; }
    public synchronized boolean grant(String token, int amount) {
        if (token == null || token.isEmpty() || amount < 1) return false;
        if (storage.hasReceipt(token)) return true;
        long next = (long) storage.balance() + amount;
        if (next > Integer.MAX_VALUE) return false;
        return storage.grant(token, (int) next);
    }
    public synchronized Debit spend(String id, int amount) {
        if (id == null || !id.matches("[a-zA-Z0-9_-]{8,100}") || amount < 1 || amount > 215) return Debit.INVALID;
        int previous = storage.spent(id);
        if (previous >= 0) return previous == amount ? Debit.OK : Debit.MISMATCH;
        if (storage.balance() < amount) return Debit.INSUFFICIENT;
        return storage.debit(id, amount, storage.balance() - amount) ? Debit.OK : Debit.SAVE_FAILED;
    }
}
