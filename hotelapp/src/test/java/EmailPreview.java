import com.hotelapp.service.EmailTemplates;
import java.nio.file.*;

public class EmailPreview {
    public static void main(String[] args) throws Exception {
        EmailTemplates t = new EmailTemplates();

        // Aday hesap
        write("welcome-candidate.html",
              t.welcome("Ayşe Demir", "CANDIDATE", "https://ajanshotel.com/candidate"));

        // Işletme
        write("welcome-business.html",
              t.welcome("Kadir Çalışkan", "BUSINESS_OWNER", "https://ajanshotel.com/business"));

        // Password reset
        write("password-reset.html",
              t.passwordReset("Ayşe Demir",
                              "https://ajanshotel.com/reset-password?token=abc123xyz789"));

        // Application ACCEPTED
        write("application-accepted.html",
              t.applicationAccepted("Ayşe Demir", "Garson — Cumartesi Akşam",
                                    "Conrad İstanbul", "https://ajanshotel.com/candidate"));

        // Application REJECTED (note yok)
        write("application-rejected-no-note.html",
              t.applicationRejected("Ayşe Demir", "Garson — Cumartesi Akşam",
                                    "Conrad İstanbul", null,
                                    "https://ajanshotel.com/candidate"));

        // Application REJECTED (note var)
        write("application-rejected-with-note.html",
              t.applicationRejected("Ayşe Demir", "Resepsiyon — Pazar Sabah",
                                    "Four Seasons Bosphorus",
                                    "Bu pozisyon için 1 yıl tecrübe arıyoruz. Bir sonraki ilanımızda görüşmek üzere!",
                                    "https://ajanshotel.com/candidate"));

        System.out.println("OK — preview/ klasörüne 6 dosya yazıldı.");
    }

    static void write(String name, String html) throws Exception {
        Path dir = Paths.get("preview");
        Files.createDirectories(dir);
        Files.writeString(dir.resolve(name), html);
        System.out.println("  → preview/" + name);
    }
}
