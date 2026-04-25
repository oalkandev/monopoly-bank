# Monopoly Bank — Tasarım Dokümanı

**Tarih:** 2026-04-25
**Durum:** Onaylandı

## Amaç

Monopoly oynarken nakit/para hesaplama yükünü ortadan kaldırmak. Oyuncular cep telefonlarından local IP'ye bağlanır, birbirlerine para transfer eder; bankacı bilgisayardan oyunu yönetir. Mülkler/kartlar fiziksel olarak masada kalır — uygulama yalnızca parayı takip eder.

## Karar Özeti

| Konu | Karar |
|---|---|
| Kapsam | Yalnızca para (mülk/kart yok) |
| Transfer onayı | Direkt — alıcı onayı yok |
| Kimlik | Bankacı oyuncuları oluşturur, her birine QR/link verir |
| Bankacı yetkisi | Tam kontrol — manuel ekle/çıkar, geri al, duraklat, sıfırla |
| Kalıcılık | Tek `game-state.json` dosyası, atomik tmp+rename |
| Başlangıç parası | Yapılandırılabilir (varsayılan 1500₺) |
| İşlem görünürlüğü | Tüm oyuncular tüm işlemleri görür |
| Frontend | Vanilla JS (build adımı yok) |

## Mimari

**Stack:**
- Backend: Node.js + Express + Socket.io
- Frontend: Vanilla HTML/CSS/JS, build adımı yok
- Veri: Tek `game-state.json` dosyası
- Ağ: `0.0.0.0:3000`, başlangıçta local IP + QR kodu konsola yazılır

**İki arayüz aynı sunucudan:**
- `/banker` → bankacı paneli (masaüstü)
- `/player` → oyuncu paneli (mobil)
- `/join/<token>` → tek seferlik token ile oturum açma

## Bileşenler

### Backend (`server/`)

| Dosya | Sorumluluk |
|---|---|
| `server.js` | Express + Socket.io ayağa kaldırma, statik servis, IP/QR yazdırma |
| `state.js` | Bellekteki oyun durumu (tek source of truth) |
| `persistence.js` | `game-state.json` oku/yaz (atomik tmp+rename) |
| `routes.js` | HTTP route'ları |
| `socket-handlers.js` | Socket event'leri: `transfer`, `pass-go`, `banker-adjust`, `undo`, `reset` |
| `game-logic.js` | Saf fonksiyonlar (IO'suz, test edilebilir) |

### Frontend (`public/`)

| Dosya | Ekran |
|---|---|
| `banker.html` + `banker.js` | Bankacı paneli — oyuncu oluşturma, QR'lar, manuel ayar, geri al |
| `player.html` + `player.js` | Oyuncu ekranı — bakiye, transfer, GO butonu, akış |
| `join.html` + `join.js` | Token ile oturum açma, çereze yazma |
| `style.css` | Mobil-öncelikli, büyük dokunma hedefleri |
| `socket-client.js` | Tek paylaşılan Socket.io bağlantısı |

## Akış

1. **Sunucu başlatma:** Bankacı `node server.js` çalıştırır. Konsol: `http://192.168.1.X:3000/banker`.
2. **Oyun kurma:** Bankacı paneli — başlangıç parası gir, oyuncuları (ad + renk) ekle, "Başlat".
3. **Katılım:** Her oyuncu için QR/link üretilir. Telefon kamerasıyla taranır, çereze token yazılır, oyuncu paneli açılır.
4. **Para gönderme:** Oyuncu → "Para Gönder" → alıcı seç → miktar → sunucu validasyon yapar, state'i günceller, tüm istemcilere broadcast eder.
5. **Bankacı işlemleri:** "GO'dan Geçtim" otomatik 200₺. Bankacı manuel +/− yapabilir, hatalı işlemi geri alabilir.
6. **Bağlantı kesilmesi:** Socket.io otomatik yeniden bağlanır. Sunucu çökerse JSON'dan devam eder.

## Veri Modeli (`game-state.json`)

```json
{
  "version": 1,
  "status": "active",
  "config": {
    "currency": "₺",
    "startingBalance": 1500,
    "passGoBonus": 200
  },
  "players": [
    {
      "id": "p1",
      "name": "Ahmet",
      "color": "#e53935",
      "token": "k4n2x9",
      "balance": 1500,
      "online": true
    }
  ],
  "transactions": [
    {
      "id": "t1",
      "ts": 1714050000000,
      "type": "transfer",
      "from": "p1",
      "to": "p2",
      "amount": 200,
      "note": null,
      "undone": false
    }
  ]
}
```

**İşlem tipleri:** `transfer`, `pass-go`, `banker-credit`, `banker-debit`, `initial`, `undo`.

## Hata Durumları

| Durum | Davranış |
|---|---|
| Yetersiz bakiye | Reddet, gönderene toast |
| Geçersiz miktar | Reddet (sunucu + frontend) |
| Aynı kişiye gönderme | Reddet |
| Token geçersiz | `/join` "Oyun bulunamadı" |
| Sunucu çökmesi | JSON'dan devam, telefonlar otomatik bağlanır |
| Aynı token iki cihaz | İzin verilir (telefon + tablet) |
| Bankacı sayfası kapanırsa | Oyun devam eder, yenilemede aynı yerden açılır |

## YAGNI (Yapılmayacaklar)

- Auth/şifre — local ağ, dürüstlük varsayımı
- HTTPS — local IP yeterli
- Mülk/kart takibi — kapsam dışı
- Oyun geçmişi/istatistikler — tek oturum
- Çoklu eş zamanlı oyun — tek `game-state.json`
- Veritabanı — JSON yeter
