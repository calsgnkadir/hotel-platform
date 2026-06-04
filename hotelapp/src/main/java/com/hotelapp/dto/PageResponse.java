package com.hotelapp.dto;

import org.springframework.data.domain.Page;

import java.util.List;
import java.util.function.Function;

/**
 * Sayfalanmış API yanıtı için temiz, kararlı sözleşme.
 * Spring'in Page'inin varsayılan JSON serileştirmesi kararsız (PageImpl uyarısı) olduğu için
 * kendi sade DTO'muzu kullanıyoruz.
 *
 * @param content       bu sayfadaki öğeler
 * @param page          mevcut sayfa indeksi (0-bazlı)
 * @param size          sayfa boyutu
 * @param totalElements toplam öğe sayısı (tüm sayfalar)
 * @param totalPages    toplam sayfa sayısı
 * @param first         ilk sayfa mı
 * @param last          son sayfa mı
 */
public record PageResponse<T>(
        List<T> content,
        int page,
        int size,
        long totalElements,
        int totalPages,
        boolean first,
        boolean last
) {
    /** Spring Page<E> -> PageResponse<T> (mapper ile entity->DTO dönüşümü) */
    public static <E, T> PageResponse<T> of(Page<E> source, Function<E, T> mapper) {
        return new PageResponse<>(
                source.getContent().stream().map(mapper).toList(),
                source.getNumber(),
                source.getSize(),
                source.getTotalElements(),
                source.getTotalPages(),
                source.isFirst(),
                source.isLast()
        );
    }
}
