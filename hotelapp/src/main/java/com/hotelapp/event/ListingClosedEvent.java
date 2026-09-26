package com.hotelapp.event;

/** İlan işletme tarafından kapatıldı → tüm günlerin ekip listesi e-postayla gider. */
public record ListingClosedEvent(Long listingId) {}
