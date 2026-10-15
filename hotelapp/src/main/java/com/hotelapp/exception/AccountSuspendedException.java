package com.hotelapp.exception;

import org.springframework.security.authentication.LockedException;

import java.time.LocalDateTime;

/**
 * Doğru şifreyle giriş yapan ama banlı (askıya alınmış) kullanıcı → 401.
 * Ban bitişi yalnız bu yolda (şifre doğrulandıktan sonra) gösterilir;
 * yanlış şifrede genel "E-posta veya şifre hatalı" döner.
 */
public class AccountSuspendedException extends LockedException {

    private final transient LocalDateTime until;

    public AccountSuspendedException(LocalDateTime until) {
        super("Account suspended");
        this.until = until;
    }

    public LocalDateTime getUntil() {
        return until;
    }
}
