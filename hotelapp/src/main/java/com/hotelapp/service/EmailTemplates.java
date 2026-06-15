package com.hotelapp.service;

import org.springframework.stereotype.Component;

/**
 * FAZ 3 — Email HTML şablonları (mor brand v4).
 *
 * Tüm email'ler ortak layout kullanır:
 *   - üstte AjansHotel logosu + mor neon strip
 *   - merkez başlık + içerik
 *   - footer (otomatik mail uyarısı + tarih)
 *
 * Inline CSS — email client'lar (Gmail, Outlook) external CSS'i atar.
 * Renkler: brand-800 #6b21a8, brand-600 #9333ea, brand-500 #a855f7,
 *         cream-50 #fdfbf7, ink-900 #171513.
 * Layout responsive — 600px max-width, padding-friendly.
 */
@Component
public class EmailTemplates {

    /** Welcome — yeni hesap açtıktan sonra hoş geldin maili. */
    public String welcome(String userName, String role, String dashboardUrl) {
        String roleText = "BUSINESS_OWNER".equals(role)
                ? "İşletmen artık AjansHotel'de — ilanları yayınla, başvuruları gör, talent pool oluştur."
                : "İşletmelerin günlük/dönemlik ilanlarına başvur, mesajlaş, hızlıca işe başla.";

        String ctaText = "BUSINESS_OWNER".equals(role)
                ? "İlk İlanı Yayınla &rarr;"
                : "İlanları Keşfet &rarr;";

        String body = """
            <h2 style="margin:0 0 16px; font-size:24px; font-weight:800; color:#171513; letter-spacing:-0.3px;">
              Hoş geldin, %s! 👋
            </h2>
            <p style="margin:0 0 20px; font-size:15px; line-height:1.6; color:#3d3631;">
              %s
            </p>

            %s

            <div style="margin:32px 0 16px; padding:20px; background:#faf7f2; border-radius:14px; border-left:4px solid #9333ea;">
              <p style="margin:0 0 8px; font-size:13px; font-weight:700; color:#171513;">
                Sırada ne var?
              </p>
              <ul style="margin:8px 0 0; padding:0 0 0 18px; font-size:13px; line-height:1.7; color:#3d3631;">
                <li>Profilini doldur — fotoğraf, açıklama, tercihler</li>
                <li>Mesajlaşma aktif — anında iletişim kur</li>
                <li>Bildirim ayarlarını gözden geçir</li>
              </ul>
            </div>
            """.formatted(escape(userName), roleText, primaryButton(dashboardUrl, ctaText));

        return layout("AjansHotel'e Hoş Geldin", body);
    }

    /** FAZ 4.4 — Email dogrulama linki maili. */
    public String verifyEmail(String userName, String verifyLink) {
        String body = """
            <h2 style="margin:0 0 16px; font-size:22px; font-weight:800; color:#171513; letter-spacing:-0.3px;">
              Email adresini doğrula ✉
            </h2>
            <p style="margin:0 0 12px; font-size:15px; line-height:1.6; color:#3d3631;">
              Merhaba %s,
            </p>
            <p style="margin:0 0 24px; font-size:15px; line-height:1.6; color:#3d3631;">
              AjansHotel hesabını oluşturduğun için teşekkürler! Hesabını tam aktifleştirmek için
              aşağıdaki butona tıkla.
            </p>

            %s

            <p style="margin:24px 0 8px; font-size:12px; line-height:1.5; color:#766c61;">
              Buton çalışmıyorsa bu bağlantıyı tarayıcına kopyala-yapıştır:
            </p>
            <p style="margin:0 0 24px; padding:10px 12px; background:#f4ede2; border-radius:8px;
                       font-size:11px; line-height:1.5; color:#6b21a8; word-break:break-all;
                       font-family:'SF Mono', Consolas, monospace;">
              %s
            </p>

            <div style="margin:24px 0 0; padding:16px; background:#fef3c7; border-radius:12px;
                        border-left:4px solid #d97706;">
              <p style="margin:0; font-size:12px; line-height:1.6; color:#78350f;">
                <strong>⚠ Bu bağlantı 24 saat geçerlidir.</strong><br>
                Bu hesabı sen oluşturmadıysan bu maili görmezden gelebilirsin.
              </p>
            </div>
            """.formatted(escape(userName), primaryButton(verifyLink, "Email'imi Doğrula &rarr;"), verifyLink);

        return layout("Email Doğrulama", body);
    }

    /** Şifre sıfırlama — mevcut password reset (mor brand v4'e güncellendi). */
    public String passwordReset(String userName, String resetLink) {
        String body = """
            <h2 style="margin:0 0 16px; font-size:22px; font-weight:800; color:#171513; letter-spacing:-0.3px;">
              Şifre Sıfırlama Talebi 🔐
            </h2>
            <p style="margin:0 0 12px; font-size:15px; line-height:1.6; color:#3d3631;">
              Merhaba %s,
            </p>
            <p style="margin:0 0 24px; font-size:15px; line-height:1.6; color:#3d3631;">
              AjansHotel hesabın için şifre sıfırlama talebi aldık. Aşağıdaki butonla
              yeni bir şifre belirleyebilirsin.
            </p>

            %s

            <p style="margin:24px 0 8px; font-size:12px; line-height:1.5; color:#766c61;">
              Buton çalışmıyorsa bu bağlantıyı tarayıcına kopyala-yapıştır:
            </p>
            <p style="margin:0 0 24px; padding:10px 12px; background:#f4ede2; border-radius:8px;
                       font-size:11px; line-height:1.5; color:#6b21a8; word-break:break-all;
                       font-family:'SF Mono', Consolas, monospace;">
              %s
            </p>

            <div style="margin:24px 0 0; padding:16px; background:#fef3c7; border-radius:12px;
                        border-left:4px solid #d97706;">
              <p style="margin:0; font-size:12px; line-height:1.6; color:#78350f;">
                <strong>⚠ Bu bağlantı 1 saat geçerlidir.</strong><br>
                Şifre sıfırlama talebinde bulunmadıysan bu maili görmezden gelebilirsin —
                hesabın güvende kalır.
              </p>
            </div>
            """.formatted(escape(userName), primaryButton(resetLink, "Şifremi Sıfırla &rarr;"), resetLink);

        return layout("Şifre Sıfırlama", body);
    }

    /** Başvurun KABUL edildi — aday için. */
    public String applicationAccepted(String candidateName, String listingTitle,
                                       String businessName, String dashboardUrl) {
        String body = """
            <h2 style="margin:0 0 16px; font-size:24px; font-weight:800; color:#171513; letter-spacing:-0.3px;">
              Müjde, başvurun kabul edildi! 🎉
            </h2>
            <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#3d3631;">
              Merhaba %s,
            </p>
            <p style="margin:0 0 20px; font-size:15px; line-height:1.6; color:#3d3631;">
              <strong style="color:#171513;">%s</strong> işletmesi
              <strong style="color:#6b21a8;">"%s"</strong> ilanı için seni kabul etti.
            </p>

            <div style="margin:20px 0; padding:18px; background:#ecfdf5; border-radius:14px;
                        border-left:4px solid #10b981;">
              <p style="margin:0 0 8px; font-size:13px; font-weight:700; color:#065f46;">
                ✓ Sırada ne var?
              </p>
              <ul style="margin:8px 0 0; padding:0 0 0 18px; font-size:13px; line-height:1.7; color:#065f46;">
                <li>İşletme ile mesajlaş — start tarih/saatini netleştir</li>
                <li>Mesai başlayınca panelden GPS clock-in yap</li>
                <li>Çalışma bittikten sonra puan vermeyi unutma</li>
              </ul>
            </div>

            %s
            """.formatted(escape(candidateName), escape(businessName), escape(listingTitle),
                    primaryButton(dashboardUrl, "Başvuruyu Gör &rarr;"));

        return layout("Başvurun Kabul Edildi", body);
    }

    /** Başvurun reddedildi — aday için (yumuşak ton). */
    public String applicationRejected(String candidateName, String listingTitle,
                                       String businessName, String note, String dashboardUrl) {
        String noteSection = (note != null && !note.isBlank())
                ? """
                  <div style="margin:16px 0; padding:14px 16px; background:#faf7f2; border-radius:12px;
                              border-left:3px solid #a9a097;">
                    <p style="margin:0 0 4px; font-size:11px; font-weight:700; color:#766c61;
                              text-transform:uppercase; letter-spacing:1px;">
                      İşletmenin notu
                    </p>
                    <p style="margin:0; font-size:13px; line-height:1.6; color:#3d3631; font-style:italic;">
                      "%s"
                    </p>
                  </div>
                  """.formatted(escape(note))
                : "";

        String body = """
            <h2 style="margin:0 0 16px; font-size:22px; font-weight:800; color:#171513; letter-spacing:-0.3px;">
              Bu sefer olmadı 😔
            </h2>
            <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#3d3631;">
              Merhaba %s,
            </p>
            <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#3d3631;">
              <strong style="color:#171513;">%s</strong> işletmesi
              <strong style="color:#6b21a8;">"%s"</strong> ilanı için başka bir aday ile devam etmeye karar verdi.
            </p>

            %s

            <p style="margin:20px 0; font-size:14px; line-height:1.6; color:#3d3631;">
              Üzülme — İstanbul'da her gün yeni ilanlar açılıyor. Bir sonraki için
              hazırsın.
            </p>

            %s
            """.formatted(escape(candidateName), escape(businessName), escape(listingTitle),
                    noteSection, primaryButton(dashboardUrl, "Yeni İlanlar &rarr;"));

        return layout("Başvurun Yanıtlandı", body);
    }

    // ──────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────

    /** Ortak shell — header (logo) + body slot + footer. */
    private String layout(String preheader, String bodyHtml) {
        return """
            <!DOCTYPE html>
            <html lang="tr">
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>AjansHotel</title>
            </head>
            <body style="margin:0; padding:0; background:#fdfbf7;
                         font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">

              <!-- Pre-header (inbox preview) — gizli -->
              <span style="display:none; visibility:hidden; opacity:0; height:0; width:0; overflow:hidden;">
                %s
              </span>

              <table cellpadding="0" cellspacing="0" border="0" width="100%%"
                     style="background:#fdfbf7; padding:32px 16px;">
                <tr><td align="center">
                  <table cellpadding="0" cellspacing="0" border="0" width="600"
                         style="max-width:600px; background:#ffffff; border-radius:18px;
                                border:1px solid #f4ede2; overflow:hidden;
                                box-shadow:0 4px 20px rgba(107,33,168,0.08);">

                    <!-- Top strip — mor brand gradient -->
                    <tr><td style="height:4px;
                            background:linear-gradient(90deg,#6b21a8,#9333ea,#d946ef,#9333ea,#6b21a8);"></td></tr>

                    <!-- Header — logo -->
                    <tr><td style="padding:32px 32px 8px;">
                      <h1 style="margin:0; font-size:26px; font-weight:900; letter-spacing:-0.4px;
                                 color:#171513;">
                        AjansHotel
                      </h1>
                      <p style="margin:2px 0 0; font-size:10px; letter-spacing:3px;
                                text-transform:uppercase; color:#9333ea; font-weight:600;">
                        İSTANBUL
                      </p>
                    </td></tr>

                    <!-- Body slot -->
                    <tr><td style="padding:24px 32px 32px;">
                      %s
                    </td></tr>

                    <!-- Footer -->
                    <tr><td style="padding:20px 32px; border-top:1px solid #f4ede2; background:#faf7f2;">
                      <p style="margin:0; font-size:11px; line-height:1.6; color:#766c61;">
                        AjansHotel &middot; İstanbul · 2026<br>
                        Bu otomatik bir mail — yanıtlama.
                        <br><br>
                        Maili istemiyorsan
                        <a href="#" style="color:#6b21a8; text-decoration:underline;">bildirim tercihlerini</a> güncelleyebilirsin.
                      </p>
                    </td></tr>
                  </table>
                </td></tr>
              </table>
            </body>
            </html>
            """.formatted(escape(preheader), bodyHtml);
    }

    /** Mor CTA butonu — table-based (Outlook/Gmail uyumlu). */
    private String primaryButton(String href, String label) {
        return """
            <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin:8px 0 8px;">
              <tr><td align="center" style="border-radius:9999px;
                       background:linear-gradient(135deg,#6b21a8,#9333ea); padding:14px 32px;">
                <a href="%s" style="font-size:14px; font-weight:700; color:#ffffff;
                       text-decoration:none; display:inline-block; letter-spacing:0.2px;">
                  %s
                </a>
              </td></tr>
            </table>
            """.formatted(href, label);
    }

    /** XSS koruması — kullanıcı adı/işletme adı gibi alanlar email body'ye girer. */
    private String escape(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}
