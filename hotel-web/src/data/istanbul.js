/**
 * İstanbul ilçeleri + yaygın mahalleleri.
 *
 * Mahalle listesi kapsayıcı değildir — her ilçeden öne çıkan ~5-15 mahalle.
 * UI'da listede yoksa kullanıcı "Diğer..." ile manuel girebilir.
 */
export const ISTANBUL_NEIGHBORHOODS = {
  'Adalar':        ['Büyükada', 'Heybeliada', 'Burgazada', 'Kınalıada'],
  'Arnavutköy':    ['Merkez', 'Yeniköy', 'Hadımköy', 'Boğazköy', 'Anadolu', 'Taşoluk'],
  'Ataşehir':      ['Atatürk', 'Yenisahra', 'Örnek', 'Barbaros', 'Ferhatpaşa', 'İçerenköy', 'Küçükbakkalköy', 'Mustafa Kemal'],
  'Avcılar':       ['Cihangir', 'Denizköşkler', 'Merkez', 'Üniversite', 'Tahtakale', 'Ambarlı', 'Firuzköy', 'Mustafa Kemal Paşa'],
  'Bağcılar':      ['Bağlar', 'Çınar', 'Demirkapı', 'Fevzi Çakmak', 'Göztepe', 'Güneşli', 'Hürriyet', 'Yeşilbağ'],
  'Bahçelievler':  ['Bahçelievler', 'Çobançeşme', 'Yenibosna', 'Cumhuriyet', 'Hürriyet', 'Kocasinan', 'Soğanlı', 'Şirinevler'],
  'Bakırköy':      ['Ataköy', 'Yenimahalle', 'Yeşilköy', 'Florya', 'Kartaltepe', 'Cevizlik', 'Sakızağacı', 'Şenlikköy', 'Zeytinlik'],
  'Başakşehir':    ['Başakşehir', 'Kayabaşı', 'Şahintepe', 'Bahçeşehir', 'Güvercintepe', 'Ziya Gökalp', 'Altınşehir'],
  'Bayrampaşa':    ['Cevatpaşa', 'Yıldırım', 'Kartaltepe', 'Muratpaşa', 'Vatan', 'Yenidoğan'],
  'Beşiktaş':      ['Levent', 'Etiler', 'Ortaköy', 'Bebek', 'Yıldız', 'Akatlar', 'Arnavutköy', 'Cihannüma', 'Gayrettepe', 'Vişnezade', 'Mecidiye', 'Türkali', 'Kuruçeşme'],
  'Beykoz':        ['Anadolu Kavağı', 'Çubuklu', 'Paşabahçe', 'Kanlıca', 'İncirköy', 'Yenimahalle', 'Yavuz Selim', 'Soğuksu'],
  'Beylikdüzü':    ['Cumhuriyet', 'Marmara', 'Sahil', 'Adnan Kahveci', 'Barış', 'Büyükşehir', 'Gürpınar', 'Yakuplu'],
  'Beyoğlu':       ['Cihangir', 'Galata', 'Karaköy', 'Taksim', 'Şişhane', 'Kasımpaşa', 'Tarlabaşı', 'Asmalı Mescit', 'Tepebaşı', 'Tomtom', 'Hacımimi', 'Kuloğlu'],
  'Büyükçekmece':  ['Mimaroba', 'Tepecik', 'Kumburgaz', 'Atatürk', 'Cumhuriyet', 'Fatih', 'Sinanoba', 'Türkoba'],
  'Çatalca':       ['Merkez', 'Subaşı', 'Ferhatpaşa', 'Kaleiçi', 'Yalıköy'],
  'Çekmeköy':      ['Çekmeköy', 'Taşdelen', 'Alemdağ', 'Hamidiye', 'Merkez', 'Ömerli', 'Sırapınar', 'Sultançiftliği'],
  'Esenler':       ['Birlik', 'Çiftehavuzlar', 'Menderes', 'Atışalanı', 'Davutpaşa', 'Fatih', 'Havaalanı', 'Nine Hatun', 'Oruçreis', 'Tuna'],
  'Esenyurt':      ['Saadetdere', 'Yeşilkent', 'Cumhuriyet', 'Pınar', 'Akşemsettin', 'Atatürk', 'Bahçelievler', 'Gökevler', 'İncirtepe', 'Yenikent'],
  'Eyüpsultan':    ['Eyüp', 'Pirinçci', 'Topçular', 'Akşemsettin', 'Alibeyköy', 'Düğmeciler', 'Kemerburgaz', 'Mimar Sinan', 'Yeşilpınar'],
  'Fatih':         ['Aksaray', 'Beyazıt', 'Fatih', 'Çapa', 'Sultanahmet', 'Eminönü', 'Balat', 'Fener', 'Karagümrük', 'Kocamustafapaşa', 'Şehremini', 'Topkapı', 'Yedikule'],
  'Gaziosmanpaşa': ['Merkez', 'Sarıgöl', 'Şemsipaşa', 'Bağlarbaşı', 'Barbaros Hayrettin Paşa', 'Karadeniz', 'Karayolları', 'Karlıtepe', 'Mevlana', 'Pazariçi'],
  'Güngören':      ['Akıncılar', 'Gençosman', 'Sanayi', 'Abdurrahman Nafiz Gürman', 'Güneştepe', 'Güven', 'Haznedar', 'Mareşal Çakmak', 'Tozkoparan'],
  'Kadıköy':       ['Caddebostan', 'Fenerbahçe', 'Göztepe', 'Kalamış', 'Kozyatağı', 'Moda', 'Suadiye', 'Sahrayıcedit', 'Kayışdağı', 'Bostancı', 'Erenköy', 'Feneryolu', 'Fikirtepe', 'Hasanpaşa', 'Koşuyolu', 'Merdivenköy', 'Osmanağa', 'Rasimpaşa', 'Zühtüpaşa'],
  'Kağıthane':     ['Kağıthane', 'Çağlayan', 'Gültepe', 'Çeliktepe', 'Hamidiye', 'Harmantepe', 'Hürriyet', 'Mehmet Akif Ersoy', 'Merkez', 'Nurtepe', 'Ortabayır', 'Sanayi', 'Seyrantepe', 'Şirintepe', 'Talatpaşa', 'Telsizler', 'Yahya Kemal', 'Yeşilce'],
  'Kartal':        ['Cevizli', 'Hürriyet', 'Yakacık', 'Yukarı', 'Soğanlık', 'Atalar', 'Cumhuriyet', 'Esentepe', 'Karlıktepe', 'Kordonboyu', 'Orhantepe', 'Petroliş', 'Topselvi', 'Uğurmumcu'],
  'Küçükçekmece':  ['Atakent', 'Kanarya', 'Sefaköy', 'Söğütlüçeşme', 'Cennet', 'Cumhuriyet', 'Fatih', 'Fevzi Çakmak', 'Gültepe', 'Halkalı', 'İnönü', 'Kartaltepe', 'Mehmet Akif', 'Tevfikbey', 'Yarımburgaz', 'Yenimahalle', 'Yeşilova'],
  'Maltepe':       ['Altayçeşme', 'Bağlarbaşı', 'Cevizli', 'Esenkent', 'İdealtepe', 'Küçükyalı', 'Altıntepe', 'Aydınevler', 'Başıbüyük', 'Büyükbakkalköy', 'Çınar', 'Feyzullah', 'Fındıklı', 'Girne', 'Gülensu', 'Gülsuyu', 'Yalı', 'Zümrütevler'],
  'Pendik':        ['Bahçelievler', 'Esenyalı', 'Kaynarca', 'Sapanbağları', 'Yayalar', 'Ahmet Yesevi', 'Çamçeşme', 'Çamlık', 'Doğu', 'Dumlupınar', 'Ertuğrul Gazi', 'Fevzi Çakmak', 'Güzelyalı', 'Harmandere', 'Kavakpınar', 'Kurtköy', 'Velibaba', 'Yenişehir'],
  'Sancaktepe':    ['Akpınar', 'Hilal', 'Sarıgazi', 'Abdurrahmangazi', 'Eyüpsultan', 'Fatih', 'İnönü', 'Kemal Türkler', 'Meclis', 'Merve', 'Mevlana', 'Osmangazi', 'Paşaköy', 'Safa', 'Veysel Karani', 'Yenidoğan', 'Yunus Emre'],
  'Sarıyer':       ['Bahçeköy', 'Çayırbaşı', 'Maslak', 'Tarabya', 'Yeniköy', 'Baltalimanı', 'Büyükdere', 'Çamlıtepe', 'Emirgan', 'Ferahevler', 'İstinye', 'Kireçburnu', 'Kumköy', 'Maden', 'Pınar', 'Reşitpaşa', 'Rumelifeneri', 'Rumelihisarı', 'Zekeriyaköy'],
  'Silivri':       ['Alibey', 'Cumhuriyet', 'Piri Mehmet Paşa', 'Alipaşa', 'Çayırdere', 'Değirmenköy', 'Fatih', 'Gümüşyaka', 'Kavaklı', 'Mimar Sinan', 'Ortaköy', 'Selimpaşa', 'Yeni'],
  'Sultanbeyli':   ['Mehmet Akif', 'Mimar Sinan', 'Yavuz Selim', 'Abdurrahmangazi', 'Adil', 'Ahmet Yesevi', 'Akşemsettin', 'Battalgazi', 'Fatih', 'Hamidiye', 'Hasanpaşa', 'Necip Fazıl', 'Orhangazi', 'Turgut Reis'],
  'Sultangazi':    ['50. Yıl', 'Cebeci', 'Habibler', '75. Yıl', 'Cumhuriyet', 'Eski Habibler', 'Esentepe', 'Gazi', 'İsmetpaşa', 'Malkoçoğlu', 'Sultançiftliği', 'Uğur Mumcu', 'Yayla', 'Yunus Emre', 'Zübeyde Hanım'],
  'Şile':          ['Akıllı', 'Çayırbaşı', 'Merkez', 'Ahmetli', 'Balibey', 'Bıçkıdere', 'Doğancılı', 'Hacıllı', 'Kabakoz', 'Kalemköy', 'Karakiraz', 'Kumbaba', 'Oruçoğlu', 'Sahilköy', 'Şuayipli', 'Yeniköy'],
  'Şişli':         ['Bomonti', 'Esentepe', 'Feriköy', 'Mecidiyeköy', 'Nişantaşı', 'Teşvikiye', 'Harbiye', 'Cumhuriyet', 'Gülbahar', 'Halaskargazi', 'Halide Edip Adıvar', '19 Mayıs', 'Ayazağa', 'Duatepe', 'Eskişehir', 'Fulya', 'Huzur', 'İnönü', 'İzzetpaşa', 'Kuştepe', 'Mahmut Şevket Paşa', 'Maslak', 'Merkez', 'Meşrutiyet', 'Paşa', 'Yayla'],
  'Tuzla':         ['Aydınlı', 'Cami', 'Mescit', 'Yayla', 'Akfırat', 'Anadolu', 'Aydıntepe', 'Evliya Çelebi', 'Fatih', 'İçmeler', 'İstasyon', 'Mimar Sinan', 'Orhanlı', 'Orta', 'Postane', 'Şifa', 'Tepeören'],
  'Ümraniye':      ['Atakent', 'Çakmak', 'Esenkent', 'İnkilap', 'Saray', 'Adem Yavuz', 'Altınşehir', 'Armağan Evler', 'Aşağı Dudullu', 'Atatürk', 'Cemil Meriç', 'Çamlık', 'Dumlupınar', 'Elmalıkent', 'Hekimbaşı', 'Huzur', 'İstiklal', 'Kazım Karabekir', 'Madenler', 'Mehmet Akif', 'Namık Kemal', 'Necip Fazıl', 'Parseller', 'Site', 'Şerifali', 'Tantavi', 'Tatlısu', 'Topağacı', 'Yamanevler', 'Yukarı Dudullu'],
  'Üsküdar':       ['Acıbadem', 'Altunizade', 'Bağlarbaşı', 'Beylerbeyi', 'Çengelköy', 'Kuzguncuk', 'Salacak', 'Kandilli', 'Ahmediye', 'Aziz Mahmut Hüdayi', 'Barbaros', 'Burhaniye', 'Cumhuriyet', 'Ferah', 'Güzeltepe', 'İcadiye', 'Kirazlıtepe', 'Kısıklı', 'Küçük Çamlıca', 'Küçüksu', 'Mehmet Akif Ersoy', 'Mimar Sinan', 'Murat Reis', 'Sultantepe', 'Ünalan', 'Valide-i Atik', 'Yavuztürk', 'Zeynep Kamil'],
  'Zeytinburnu':   ['Beştelsiz', 'Çırpıcı', 'Merkez', 'Sümer', 'Yeşiltepe', 'Gökalp', 'Kazlıçeşme', 'Maltepe', 'Nuripaşa', 'Seyit Nizam', 'Telsiz', 'Veliefendi', 'Yenidoğan'],
}

/** Alfabetik sıralı ilçe listesi — UI'lar bunu kullansın. */
export const ISTANBUL_DISTRICTS = Object.keys(ISTANBUL_NEIGHBORHOODS).sort((a, b) =>
  a.localeCompare(b, 'tr')
)

/** Belirli bir ilçenin mahalle listesi (alfabetik). Bilinmeyen ilçe için []. */
export function neighborhoodsOf(district) {
  if (!district) return []
  const list = ISTANBUL_NEIGHBORHOODS[district] || []
  return [...list].sort((a, b) => a.localeCompare(b, 'tr'))
}
