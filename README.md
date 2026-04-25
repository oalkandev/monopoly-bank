# Monopoly Bank

Local ağda çalışan Monopoly para yönetim uygulaması. Bankacı bilgisayardan yönetir, oyuncular telefondan QR ile katılır.

## Kurulum

```bash
npm install
npm run build       # React frontend'i public/ klasörüne derler
npm start           # Express + Socket.io sunucusunu başlatır
```

Konsola yazılan `http://192.168.x.x:3000/banker` adresini bilgisayarda aç. Port doluysa `PORT=3737 npm start`.

## Geliştirme

```bash
npm run dev:client  # Vite dev sunucusu (HMR), client kodunda iterate ederken
npm run build       # public/ tekrar derler
npm test            # game-logic unit testleri (15 test)
```

## Özellikler

- Bankacı: oyuncu oluştur, başlangıç parası ayarla, mid-game GO bonusunu değiştir, +/− manuel ayar, hatalı işlemi geri al
- Oyuncu: bakiye, para gönder, bankaya öde, GO bonusu al, canlı işlem akışı
- QR kod ile telefondan katılım, otomatik wake-lock (telefon ekranı kapanmaz)
- JSON dosyada otomatik kalıcılık (`game-state.json`)
- Tüm işlemler herkese açık (gerçek Monopoly gibi)

## Stack

- Backend: Node.js + Express + Socket.io + qrcode-terminal
- Frontend: Vite + React + Tailwind + DaisyUI + react-hot-toast
- Persistence: tek `game-state.json`, atomik tmp+rename
