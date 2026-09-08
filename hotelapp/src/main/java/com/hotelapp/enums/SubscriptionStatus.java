package com.hotelapp.enums;

/**
 * İşletme abonelik durumu.
 *  TRIAL     — ücretsiz deneme sürüyor (trialEndsAt gelecekte)
 *  ACTIVE    — ödendi, currentPeriodEnd gelecekte
 *  PAST_DUE  — dönem bitti, yenilenmedi (deneme veya abonelik süresi doldu)
 *  CANCELED  — işletme iptal etti
 */
public enum SubscriptionStatus {
    TRIAL, ACTIVE, PAST_DUE, CANCELED
}
