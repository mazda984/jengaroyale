const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*" } // Farklı kaynaklardan bağlantılara izin ver
});
const path = require('path');

// 'public' klasöründeki index.html ve diğer statik dosyaları dışarıya açıyoruz
app.use(express.static(path.join(__dirname, 'public')));

const odalar = {}; // Aktif odaları ve içindeki oyuncu bilgilerini tutan obje

io.on('connection', (socket) => {
    console.log('Bir oyuncu bağlandı: ' + socket.id);

    // 1. ODA OLUŞTURMA MEKANİZMASI
    socket.on('odaOlustur', () => {
        // 5 haneli rastgele, benzersiz bir oda kodu üret (Örn: 7G2X1)
        const odaKodu = Math.random().toString(36).substring(2, 7).toUpperCase();
        
        odalar[odaKodu] = {
            oyuncular: {
                player1: { id: socket.id, x: 0, y: 30, z: 0, renk: 0x0ea5e9 }
            }
        };

        socket.join(odaKodu);
        socket.odaKodu = odaKodu;
        socket.oyuncuTipi = 'player1';

        socket.emit('odaOlusturuldu', { odaKodu, oyuncuTipi: 'player1' });
        console.log(`Oda oluşturuldu: ${odaKodu}`);
    });

    // 2. ODAYA KATILMA MEKANİZMASI
    socket.on('odayaKatil', (odaKodu) => {
        odaKodu = odaKodu.toUpperCase();
        
        // Oda varsa ve 2. oyuncu yeri boşsa odaya al
        if (odalar[odaKodu] && !odalar[odaKodu].oyuncular.player2) {
            odalar[odaKodu].oyuncular.player2 = { id: socket.id, x: 2, y: 30, z: 2, renk: 0xec4899 };
            
            socket.join(odaKodu);
            socket.odaKodu = odaKodu;
            socket.oyuncuTipi = 'player2';

            // Odadaki iki oyuncuya da oyunun başladığını bildir
            io.to(odaKodu).emit('oyunBasladi', odalar[odaKodu].oyuncular);
            console.log(`Oyuncu 2 odaya katıldı: ${odaKodu}`);
        } else {
            socket.emit('hata', 'Oda bulunamadı veya oda zaten dolu!');
        }
    });

    // 3. ANLIK POZİSYON GÜNCELLEME (REAL-TIME MOVEMENT)
    socket.on('hareketEt', (data) => {
        if (socket.odaKodu && odalar[socket.odaKodu]) {
            const oyuncu = odalar[socket.odaKodu].oyuncular[socket.oyuncuTipi];
            if (oyuncu) {
                oyuncu.x = data.x;
                oyuncu.y = data.y;
                oyuncu.z = data.z;
                
                // Pozisyon verisini odadaki diğer oyuncuya (rakibe) gönder
                socket.to(socket.odaKodu).emit('oyuncuHareketEtti', {
                    oyuncuTipi: socket.oyuncuTipi,
                    x: data.x, y: data.y, z: data.z
                });
            }
        }
    });

    // 4. 🌋 AFET SENKRONİZASYONU
    // Ev sahibi (Player 1) tarafından tetiklenen afet verilerini (tür, koordinat, güç)
    // odadaki diğer oyuncuya (Misafir - Player 2) anlık olarak aktarır.
    socket.on('afetYayinla', (data) => {
        if (socket.odaKodu) {
            socket.to(socket.odaKodu).emit('afetTetikle', data);
        }
    });

    // 5. BAĞLANTI KOPMA KONTROLÜ (DISCONNECT)
    socket.on('disconnect', () => {
        if (socket.odaKodu && odalar[socket.odaKodu]) {
            // Ayrılan oyuncuyu odadan sil
            delete odalar[socket.odaKodu].oyuncular[socket.oyuncuTipi];
            
            // Odada kalan diğer oyuncuya rakibin çıktığını haber ver
            socket.to(socket.odaKodu).emit('oyuncuAyrildi');
            
            // Eğer odada hiç kimse kalmadıysa odayı tamamen temizle
            if (Object.keys(odalar[socket.odaKodu].oyuncular).length === 0) {
                delete odalar[socket.odaKodu];
                console.log(`Oda kapandı: ${socket.odaKodu}`);
            }
        }
        console.log('Bir oyuncu ayrıldı: ' + socket.id);
    });
});

// Port Ayarı (Uzak sunucuya yüklendiğinde dinamik port alır, lokalde ise 3000 portunu açar)
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Multiplayer Jenga Sunucusu ${PORT} portunda aktif!`);
});
