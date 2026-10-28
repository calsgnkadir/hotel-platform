# Yedek hazırlığı ve kalan canlı doğrulaması

## Bugünkü durum

`deploy/prod/run-backup.sh` yerel yedeği alır, yapılandırılmışsa rclone ile
ayrı hedefe kopyalar. Bu çalışma gerçek cron, bildirim hizmeti veya uzak depo
kurmadı. `BACKUP_REMOTE` boşken dış kopyalama **kapalıdır**. Mevcut bilgisayardaki
dosyalar sunucu dışı üretim yedeği sayılmaz.

`backup.sh` yarım dosyayı tamamlanmış yedek olarak bırakmaz ve yerel saklamayı
`KEEP` ile sınırlar. Yeni görev aynı anda iki çalışmayı engeller. Kilit alınamazsa
75 koduyla çıkar ve varsa hata hook'unu `LOCK_UNAVAILABLE` ile çağırır. Kilidi
sahiplenmeyen süreç onu silmez. Elektrik kesintisi / SIGKILL sonrası kalan kilidi
silmeden önce çalışan yedek süreci olmadığını doğrulamak gerekir.

## Sunucu alındığında kullanılacak ayarlar

Korunan `.env.prod` dosyasına eklenebilir; anahtarları Git'e koymayın:

```sh
KEEP=14
BACKUP_REMOTE=
BACKUP_FAILURE_HOOK=
```

`BACKUP_REMOTE` ancak ayrı depolama hesabı gerçekten yapılandırılıp doğrulandığında
örneğin `kadrom-backups:encrypted-database` olabilir. Bu isim bir yer tutucudur;
hazır bir hesap değildir. Sunucuda rclone kurulmalı, erişimi yedeği çalıştıran
kullanıcıya ait korunan yapılandırmada bulunmalıdır. Veritabanı kişisel veri
içereceğinden hedef erişimini sınırlandırın ve dış kopyayı şifreli tutun.

`BACKUP_FAILURE_HOOK` mutlak yollu, çalıştırılabilir bir dosya olmalıdır. Script
ilk argüman olarak hata durumunu alır; örneğin `LOCAL_BACKUP_FAILED`,
`REMOTE_COPY_FAILED`, `LOCK_UNAVAILABLE`, `STATE_WRITE_FAILED`. Hook'u sağlayıcıya
göre ayrıca hazırlayıp gerçek bildirim teslimini deneyin. Hook başarısızlığı loga
yazılır; ikinci bağımsız bildirim kanalı veya otomatik tekrar kuyruğu kurulmaz.
Durum dosyası yazılamasa bile hook denenir. Çalışmayan cron hiçbir hook çağıramaz;
son başarılı yedeğin yaşını ayrıca izlemek gerekir.

## Zamanlama taslağı

Sunucudaki gerçek proje yolu ve Docker erişimi olan kullanıcı belirlendikten sonra
ilk çalıştırmayı elle doğrulayın. Aşağıdaki yalnız Linux crontab örneğidir;
kurulu değildir. Saat sunucunun saat dilimine göre yorumlanır.

```cron
30 3 * * * /bin/bash /opt/kadrom/deploy/prod/run-backup.sh >> /opt/kadrom/deploy/prod/backups/backup.log 2>&1
```

Önce `backups` klasörünü oluşturup yalnız görev kullanıcısına erişim verin
(`chmod 700`); `.env.prod`, rclone yapılandırması ve log dosyalarını da koruyun.
Log boyutunu işletim sisteminin log rotasyonuyla sınırlandırın. Cron ortamında
Docker ve rclone PATH'ini doğrulayın.

`.backup-status` kilit alabilen son girişimin UTC zamanını ve durumunu içerir.
Kilit alınamazsa mevcut durum dosyasına dokunulmaz; bu hata log ve hook ile iletilir:

| Durum | Kanıtladığı |
| --- | --- |
| `RUNNING` | İş başladı; bitiş kanıtı değil |
| `LOCAL_ONLY` | Yerel yedek tamamlandı; dış kopya yok |
| `REMOTE_COPY_ACCEPTED` | rclone kopyalama komutunu başarılı bildirdi |
| Hata durumu | İş başarısız; log ve hook teslimi incelenmeli |

`REMOTE_COPY_ACCEPTED` hedefin fiziksel olarak ayrı yerde olduğunu veya yedeğin
geri yüklenebildiğini kanıtlamaz. `rclone copyto` uzak eski dosyaları silmez;
`KEEP` yalnız yerel dosyalara uygulanır. Uzak saklama süresi ve kota ayrıca
seçilmeli; ücretsiz kota aşımları ve bütçe takip edilmelidir.

## Canlıdan önce kapanacak kanıtlar

1. Gerçek hedefin sunucudan bağımsız olduğunu doğrulayın; seçilen dosyayı hedefte
   listeleyip indirin, yerel kopyayla bütünlüğünü karşılaştırın.
2. İndirilen yedeği başka izole MySQL ortamına geri yükleyip temel kayıtları ve
   uygulamanın o verilerle açılmasını kontrol edin. Üretim veritabanına deneme
   yüklemesi yapmayın. Başarılı yedek alma, kurtarma kanıtı değildir.
3. Uzak bağlantı hatasında işin başarısız olduğunu ve gerçek uyarının ulaştığını
   doğrulayın. Son başarılı dosya tarihi için bağımsız kontrol kurun.
4. Dosya tarihi, hedef, geri yükleme sonucu ve süreyi gizli bilgi içermeyen kanıt
   kaydına yazın. Bunlar gerçek hedef/sunucu kurulana kadar **bekliyor**.

Offline kontroller: `deploy/prod/tests/backup-safety-test.sh` ve
`deploy/prod/tests/backup-job-test.sh`. İkinci test sahte Docker/rclone/hook ile
hata yollarını ve kopyalanan içeriği doğrular; gerçek e-posta, uzak depo veya
kurtarma kanıtı değildir. Çıktılar Git dışında `hotelapp/target/` altında kalır.
