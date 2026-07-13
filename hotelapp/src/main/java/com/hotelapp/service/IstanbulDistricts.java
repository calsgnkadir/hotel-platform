package com.hotelapp.service;

import java.util.Map;
import java.util.Set;

/**
 * FAZ 11.W4.2 — Istanbul ilce komsuluk haritasi (statik).
 *
 * Ranking scorer'da "komsu ilce" sinyali icin: aday Besiktas'i tercih
 * etmisse Sisli'deki ilan tam eslesme (+30) alamaz ama komsu bonusu (+15)
 * alir. Koordinat verisi gerektirmez (aday konumu sadece ilce string'i).
 *
 * Kaynak: IBB ilce sinir komsuluklari. Cift yonlu tutarlilik testi
 * JobListingQueryServiceRankingTest.DistrictNeighbors'da.
 */
final class IstanbulDistricts {

    private IstanbulDistricts() {}

    static final Map<String, Set<String>> NEIGHBORS = Map.ofEntries(
        // ── Avrupa yakasi ──
        Map.entry("Adalar",        Set.of()),  // ada — komsu yok
        Map.entry("Arnavutkoy",    Set.of("Basaksehir", "Buyukcekmece", "Catalca", "Esenyurt", "Eyupsultan")),
        Map.entry("Avcilar",       Set.of("Basaksehir", "Beylikduzu", "Esenyurt", "Kucukcekmece")),
        Map.entry("Bagcilar",      Set.of("Bahcelievler", "Basaksehir", "Esenler", "Gungoren", "Kucukcekmece")),
        Map.entry("Bahcelievler",  Set.of("Bagcilar", "Bakirkoy", "Gungoren", "Kucukcekmece")),
        Map.entry("Bakirkoy",      Set.of("Bahcelievler", "Gungoren", "Kucukcekmece", "Zeytinburnu")),
        Map.entry("Basaksehir",    Set.of("Arnavutkoy", "Avcilar", "Bagcilar", "Esenler", "Esenyurt", "Eyupsultan", "Kucukcekmece", "Sultangazi")),
        Map.entry("Bayrampasa",    Set.of("Esenler", "Eyupsultan", "Gaziosmanpasa", "Gungoren", "Zeytinburnu", "Fatih")),
        Map.entry("Besiktas",      Set.of("Beyoglu", "Kagithane", "Sariyer", "Sisli")),
        Map.entry("Beylikduzu",    Set.of("Avcilar", "Buyukcekmece", "Esenyurt")),
        Map.entry("Beyoglu",       Set.of("Besiktas", "Eyupsultan", "Fatih", "Kagithane", "Sisli")),
        Map.entry("Buyukcekmece",  Set.of("Arnavutkoy", "Beylikduzu", "Catalca", "Esenyurt", "Silivri")),
        Map.entry("Catalca",       Set.of("Arnavutkoy", "Buyukcekmece", "Silivri")),
        Map.entry("Esenler",       Set.of("Bagcilar", "Basaksehir", "Bayrampasa", "Gaziosmanpasa", "Gungoren", "Sultangazi")),
        Map.entry("Esenyurt",      Set.of("Arnavutkoy", "Avcilar", "Basaksehir", "Beylikduzu", "Buyukcekmece")),
        Map.entry("Eyupsultan",    Set.of("Arnavutkoy", "Bayrampasa", "Beyoglu", "Gaziosmanpasa", "Kagithane", "Sariyer", "Sultangazi", "Basaksehir")),
        Map.entry("Fatih",         Set.of("Bayrampasa", "Beyoglu", "Zeytinburnu", "Gungoren")),
        Map.entry("Gaziosmanpasa", Set.of("Bayrampasa", "Esenler", "Eyupsultan", "Sultangazi")),
        Map.entry("Gungoren",      Set.of("Bagcilar", "Bahcelievler", "Bakirkoy", "Bayrampasa", "Esenler", "Zeytinburnu", "Fatih")),
        Map.entry("Kagithane",     Set.of("Besiktas", "Beyoglu", "Eyupsultan", "Sariyer", "Sisli")),
        Map.entry("Kucukcekmece",  Set.of("Avcilar", "Bagcilar", "Bahcelievler", "Bakirkoy", "Basaksehir")),
        Map.entry("Sariyer",       Set.of("Besiktas", "Eyupsultan", "Kagithane", "Sisli")),
        Map.entry("Silivri",       Set.of("Buyukcekmece", "Catalca")),
        Map.entry("Sultangazi",    Set.of("Basaksehir", "Esenler", "Eyupsultan", "Gaziosmanpasa")),
        Map.entry("Sisli",         Set.of("Besiktas", "Beyoglu", "Kagithane", "Sariyer")),
        Map.entry("Zeytinburnu",   Set.of("Bakirkoy", "Bayrampasa", "Fatih", "Gungoren")),
        // ── Anadolu yakasi ──
        Map.entry("Atasehir",      Set.of("Kadikoy", "Umraniye", "Uskudar", "Maltepe", "Sancaktepe")),
        Map.entry("Beykoz",        Set.of("Cekmekoy", "Umraniye", "Uskudar", "Sile")),
        Map.entry("Cekmekoy",      Set.of("Beykoz", "Sancaktepe", "Umraniye", "Sile", "Pendik")),
        Map.entry("Kadikoy",       Set.of("Atasehir", "Maltepe", "Umraniye", "Uskudar")),
        Map.entry("Kartal",        Set.of("Maltepe", "Pendik", "Sancaktepe", "Sultanbeyli")),
        Map.entry("Maltepe",       Set.of("Atasehir", "Kadikoy", "Kartal", "Sancaktepe")),
        Map.entry("Pendik",        Set.of("Kartal", "Sancaktepe", "Sultanbeyli", "Tuzla", "Cekmekoy", "Sile")),
        Map.entry("Sancaktepe",    Set.of("Atasehir", "Cekmekoy", "Kartal", "Maltepe", "Pendik", "Sultanbeyli", "Umraniye")),
        Map.entry("Sile",          Set.of("Beykoz", "Cekmekoy", "Pendik")),
        Map.entry("Sultanbeyli",   Set.of("Kartal", "Pendik", "Sancaktepe")),
        Map.entry("Tuzla",         Set.of("Pendik")),
        Map.entry("Umraniye",      Set.of("Atasehir", "Beykoz", "Cekmekoy", "Kadikoy", "Sancaktepe", "Uskudar")),
        Map.entry("Uskudar",       Set.of("Atasehir", "Beykoz", "Kadikoy", "Umraniye"))
    );

    /** Turkce karakterleri sadelestirip normalize eder (Besiktas == Beşiktaş). */
    static String normalize(String district) {
        if (district == null) return "";
        return district.trim()
                .replace('ı', 'i').replace('İ', 'I')
                .replace('ş', 's').replace('Ş', 'S')
                .replace('ğ', 'g').replace('Ğ', 'G')
                .replace('ü', 'u').replace('Ü', 'U')
                .replace('ö', 'o').replace('Ö', 'O')
                .replace('ç', 'c').replace('Ç', 'C')
                .toLowerCase(java.util.Locale.ROOT);
    }

    /** a ile b komsu ilceler mi? (normalize edilmis karsilastirma) */
    static boolean areNeighbors(String a, String b) {
        String na = normalize(a), nb = normalize(b);
        if (na.isEmpty() || nb.isEmpty() || na.equals(nb)) return false;
        for (var e : NEIGHBORS.entrySet()) {
            if (normalize(e.getKey()).equals(na)) {
                return e.getValue().stream().anyMatch(n -> normalize(n).equals(nb));
            }
        }
        return false;
    }
}
