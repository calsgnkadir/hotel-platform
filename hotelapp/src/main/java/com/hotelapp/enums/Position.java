package com.hotelapp.enums;

public enum Position {
    WAITER("Garson"),
    DISHWASHER("Bulaşıkçı"),
    HOUSEKEEPING("Kat hizmetleri"),
    RECEPTION("Resepsiyon"),
    KITCHEN_STAFF("Mutfak personeli"),
    BELLBOY("Bellboy"),
    SECURITY("Güvenlik");

    /** Kullanıcıya gösterilen Türkçe ad (bildirim metinleri). hotel-web utils/labels.js ile aynı. */
    private final String label;

    Position(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }
}
