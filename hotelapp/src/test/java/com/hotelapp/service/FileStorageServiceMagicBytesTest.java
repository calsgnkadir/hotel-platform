package com.hotelapp.service;

import com.cloudinary.Cloudinary;
import com.hotelapp.exception.BusinessRuleException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * FileStorageService magic byte / MIME spoofing testleri.
 *
 * Cloudinary mock'lanir (validate() upload'a ulasmadan once tetiklenir);
 * private validate metodu store(file, studentId) cagrisinin icinden
 * sirasi 1. olarak isler — validation hatasi orada atilirsa Cloudinary
 * call hic yapilmaz.
 */
@ExtendWith(MockitoExtension.class)
class FileStorageServiceMagicBytesTest {

    @Mock private Cloudinary cloudinary;
    @InjectMocks private FileStorageService service;

    // ----- Happy paths: gercek imza + dogru uzanti -----

    @Test
    @DisplayName("Gerçek PDF (%PDF magic) + .pdf uzantısı: validate geçer")
    void realPdf_passesValidation() {
        byte[] pdfHeader = bytes(0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x37);  // %PDF-1.7
        MockMultipartFile file = new MockMultipartFile("file", "cv.pdf", "application/pdf", pdfHeader);

        // Upload Cloudinary'ye gidecek — burada NPE yerine kontrol hatası bekliyoruz mu?
        // Aslinda validate() gecip Cloudinary'ye gidecek; mock olduğu için NPE atar.
        // O yüzden validate hatası ATMAMASI bizim için yeterli — gerçek upload fail edebilir.
        assertThatThrownBy(() -> service.store(file, 1L))
                .isNotInstanceOf(BusinessRuleException.class);
    }

    @Test
    @DisplayName("Gerçek JPEG (FF D8 FF) + .jpg uzantısı: validate geçer")
    void realJpeg_passesValidation() {
        byte[] jpgHeader = bytes(0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46);
        MockMultipartFile file = new MockMultipartFile("file", "foto.jpg", "image/jpeg", jpgHeader);

        assertThatThrownBy(() -> service.store(file, 1L))
                .isNotInstanceOf(BusinessRuleException.class);
    }

    @Test
    @DisplayName("Gerçek PNG + .png uzantısı: validate geçer")
    void realPng_passesValidation() {
        byte[] pngHeader = bytes(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A);
        MockMultipartFile file = new MockMultipartFile("file", "logo.png", "image/png", pngHeader);

        assertThatThrownBy(() -> service.store(file, 1L))
                .isNotInstanceOf(BusinessRuleException.class);
    }

    @Test
    @DisplayName("Gerçek WEBP (RIFF...WEBP) + .webp: validate geçer")
    void realWebp_passesValidation() {
        byte[] webpHeader = bytes(
                0x52, 0x49, 0x46, 0x46,   // RIFF
                0x24, 0x00, 0x00, 0x00,   // size
                0x57, 0x45, 0x42, 0x50,   // WEBP
                0x56, 0x50, 0x38, 0x20    // VP8
        );
        MockMultipartFile file = new MockMultipartFile("file", "foto.webp", "image/webp", webpHeader);

        assertThatThrownBy(() -> service.store(file, 1L))
                .isNotInstanceOf(BusinessRuleException.class);
    }

    @Test
    @DisplayName("Gerçek HEIC (ftyp + heic brand) + .heic: validate geçer")
    void realHeic_passesValidation() {
        byte[] heicHeader = bytes(
                0x00, 0x00, 0x00, 0x18,
                0x66, 0x74, 0x79, 0x70,   // ftyp
                0x68, 0x65, 0x69, 0x63,   // heic
                0x00, 0x00, 0x00, 0x00
        );
        MockMultipartFile file = new MockMultipartFile("file", "iphone.heic", "image/heic", heicHeader);

        assertThatThrownBy(() -> service.store(file, 1L))
                .isNotInstanceOf(BusinessRuleException.class);
    }

    // ----- Spoofing: uzanti yalan soyluyor -----

    @Test
    @DisplayName("Spoofing: PNG bytes ama .pdf uzantısı → reddedilir")
    void pngBytesWithPdfExtension_isRejected() {
        byte[] pngHeader = bytes(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A);
        MockMultipartFile file = new MockMultipartFile("file", "cv.pdf", "application/pdf", pngHeader);

        assertThatThrownBy(() -> service.store(file, 1L))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("uzantısıyla uyumsuz");
    }

    @Test
    @DisplayName("Spoofing: rastgele bytes (exe) + .jpg → reddedilir")
    void randomBytesWithJpgExtension_isRejected() {
        byte[] exeHeader = bytes(0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00);  // MZ - Windows PE
        MockMultipartFile file = new MockMultipartFile("file", "foto.jpg", "image/jpeg", exeHeader);

        assertThatThrownBy(() -> service.store(file, 1L))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("uzantısıyla uyumsuz");
    }

    @Test
    @DisplayName("Spoofing: PDF bytes + .png uzantısı → reddedilir")
    void pdfBytesWithPngExtension_isRejected() {
        byte[] pdfHeader = bytes(0x25, 0x50, 0x44, 0x46, 0x2D, 0x31);
        MockMultipartFile file = new MockMultipartFile("file", "image.png", "image/png", pdfHeader);

        assertThatThrownBy(() -> service.store(file, 1L))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("uzantısıyla uyumsuz");
    }

    // ----- Diger validation kurallari -----

    @Test
    @DisplayName("Bos dosya: reddedilir")
    void emptyFile_isRejected() {
        MockMultipartFile file = new MockMultipartFile("file", "bos.pdf", "application/pdf", new byte[0]);

        assertThatThrownBy(() -> service.store(file, 1L))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("Boş dosya");
    }

    @Test
    @DisplayName("Desteklenmeyen uzanti (.exe): reddedilir")
    void unsupportedExtension_isRejected() {
        byte[] data = bytes(0x4D, 0x5A);
        MockMultipartFile file = new MockMultipartFile("file", "tool.exe", "application/octet-stream", data);

        assertThatThrownBy(() -> service.store(file, 1L))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("formatı desteklenmiyor");
    }

    @Test
    @DisplayName("Path traversal denemesi (..): reddedilir")
    void pathTraversal_isRejected() {
        byte[] data = bytes(0x25, 0x50, 0x44, 0x46);
        MockMultipartFile file = new MockMultipartFile("file", "../../etc/passwd.pdf", "application/pdf", data);

        assertThatThrownBy(() -> service.store(file, 1L))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("Geçersiz dosya adı");
    }

    @Test
    @DisplayName("Uzantisi olmayan dosya: reddedilir")
    void noExtension_isRejected() {
        byte[] data = bytes(0x25, 0x50, 0x44, 0x46);
        MockMultipartFile file = new MockMultipartFile("file", "noext", "application/octet-stream", data);

        assertThatThrownBy(() -> service.store(file, 1L))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("uzantısı yok");
    }

    // ----- Helpers -----
    private static byte[] bytes(int... values) {
        byte[] arr = new byte[values.length];
        for (int i = 0; i < values.length; i++) arr[i] = (byte) values[i];
        return arr;
    }
}
