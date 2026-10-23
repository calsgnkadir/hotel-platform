# Harici servis anahtarları

Sunucudan bağımsız kurulum notları (eski Render belgesinden taşındı; Render artık
kullanılmıyor). Değerleri yerelde IntelliJ çalıştırma ayarlarına, canlıda sunucunun
ortam değişkenlerine girin. Anahtarları repoya ya da sohbete yazmayın.

## Bildirim anahtarları (VAPID)

Push bildirimleri bir anahtar çiftiyle imzalanır. Çift **bir kez** üretilir ve
hep aynı kalır; değişirse herkesin bildirim kaydı geçersiz olur.

1. Kendi bilgisayarında (Node yüklü) şunu çalıştır:

   ```bash
   node -e "const c=require('crypto');const k=c.generateKeyPairSync('ec',{namedCurve:'prime256v1'});const p=k.publicKey.export({format:'jwk'});const s=k.privateKey.export({format:'jwk'});const b=x=>Buffer.from(x,'base64url');console.log('VAPID_PUBLIC_KEY='+Buffer.concat([Buffer.from([4]),b(p.x),b(p.y)]).toString('base64url'));console.log('VAPID_PRIVATE_KEY='+s.d)"
   ```

2. Çıkan iki satırı sunucunun ortam değişkenlerine gir (yerelde IntelliJ çalıştırma ayarları).
3. Özel anahtarı (`VAPID_PRIVATE_KEY`) kimseyle paylaşma, repoya veya sohbete
   yapıştırma; bir parola yöneticisinde sakla.

Vitrinde (`prod,showcase`) boş bırakılırsa uygulama açılır ama her yeniden
başlatmada abonelikler bozulur. Gerçek üründe (`prod`) boşsa sunucu **açılmaz**.

## E-posta (Resend)

Şifre sıfırlama, e-posta doğrulama, başvuru sonucu ve ekip listesi (Excel) e-postayla
gider. **Gerçek üründe zorunlu** — `RESEND_API_KEY` (`re_` ile başlar) ve kendi alan
adından bir `RESEND_FROM` yoksa sunucu açılmaz. Vitrinde bilerek kapalı (demo
hesapları gerçek olmayan adresler; mail atılırsa geri döner, alan adının itibarı düşer).

1. <https://resend.com> → kaydol (ücretsiz: günde 100, ayda 3.000 mail).
2. **Domains → Add Domain** → `kadrom.me`, bölge **Ireland (eu-west-1)**.
3. Resend 4 DNS kaydı gösterir. Namecheap → kadrom.me → **Advanced DNS** →
   **ADD NEW RECORD** ile **birebir** gir (kadrom.me'de 2026-10 itibarıyla girildi):

   | Type | Host | Value |
   |---|---|---|
   | TXT | `resend._domainkey` | `p=MIGfMA...` (DKIM — Resend'de değere tıklayıp kopyala) |
   | CNAME | `rsend` | `rsend-euw1.forge.rmta.net` |
   | CNAME | `send` | `send.forge.rmta.net` |
   | TXT | `_dmarc` | `v=DMARC1; p=none;` |

   - **Host** kutusuna sadece alt kısmı yaz (sonuna `.kadrom.me` ekleme).
   - Değerleri ekrandaki `[...]` kısaltmasından değil, tıklayıp kopyalayarak al.
   - DKIM değeri `p=` ile, DMARC değeri `v=DMARC1` ile başlar — karıştırma.
   - MX kaydı gerekmez (Resend gönderim için CNAME kullanıyor).
4. Resend'de **Verify DNS Records** → hepsi "Verified" olana kadar bekle
   (genelde dakikalar, en çok birkaç saat).
5. **API Keys → Create API Key** → izin: *Sending access*, alan adı: `kadrom.me`.
   Anahtar **bir kez** gösterilir; kopyala.
6. Gerçek ürünün `kadrom-api` → **Environment**:
   - `RESEND_API_KEY` = az önce kopyaladığın `re_...`
   - `RESEND_FROM` = `bildirim@kadrom.me` (doğrulanmış alan adından herhangi bir ad)
7. Kontrol: uygulamada "Şifremi unuttum" → kendi adresine mail gelmeli. Gelmezse
   admin paneli → **Outbox**'ta e-posta satırının son hatası yazar
   (ör. `403 ... domain is not verified`).

Anahtarı (`re_...`) repoya veya sohbete yapıştırma.

## Google ile giriş (isteğe bağlı)

Ayarlanmazsa **Google butonu otomatik gizlenir**, e-posta/şifre girişi normal çalışır
(kırık buton gösterilmez). Açmak için:

1. <https://console.cloud.google.com> → yeni proje: `Kadrom`.
2. **APIs & Services → OAuth consent screen** → *External* → uygulama adı `Kadrom`,
   destek e-postası, **Authorized domain**: `kadrom.me`; kapsamlar: `email`, `profile`.
   Sonra **Publish app** (yayınlanmazsa yalnızca eklediğin test kullanıcıları girebilir).
3. **Credentials → Create credentials → OAuth client ID** → *Web application*:
   - **Authorized JavaScript origins**: `https://kadrom.me`
   - **Authorized redirect URIs**: `https://api.kadrom.me/login/oauth2/code/google`
4. Çıkan **Client ID** (`...apps.googleusercontent.com`) ve **Client secret**'ı
   Sunucunun ortam değişkenlerine: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
5. Yeniden başlatınca buton giriş/kayıt ekranlarında kendiliğinden görünür
   (`GET /api/auth/providers` → `{"google": true}`).

Client secret'ı repoya veya sohbete yapıştırma.

## Ödeme (iyzico, isteğe bağlı)

Kodda varsayılan iyzico anahtarı **yok**. `IYZICO_API_KEY` / `IYZICO_SECRET_KEY`
verilmezse ödeme kapalıdır: abonelik ekranında satın alma butonu çıkmaz, ilan kotası
uygulanmaz — işletmeler ücretsiz ve sınırsız ilan açar. Açılış için gerekmez.

- **Vitrin (`prod,showcase`)**: ödeme akışını göstermek istersen kendi iyzico
  *sandbox* hesabının anahtarlarını Environment'a gir. Ekranda test kartı yalnızca
  sandbox'ta görünür; gerçek para hareket etmez.
- **Gerçek ödeme (`prod`, vitrinsiz)**: önce kayıtlı şirket + onaylı iyzico üye işyeri
  hesabı gerekir. Sonra:
  - `IYZICO_API_KEY`, `IYZICO_SECRET_KEY` → canlı anahtarlar
  - `IYZICO_BASE_URL` = `https://api.iyzipay.com`
  - `IYZICO_CALLBACK_URL` = `https://api.kadrom.me/api/billing/callback`

  Prod'da sandbox adresi/anahtarı, tek anahtar ya da `https` olmayan callback
  verilirse uygulama **açılmaz** (ProductionSafetyConfiguration) — sandbox'ta herkese
  açık test kartıyla bedava abonelik alınabilirdi.

Anahtarları repoya veya sohbete yapıştırma.
