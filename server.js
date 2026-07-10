const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*" }
});
const path = require('path');

// Public klasöründeki HTML/JS dosyalarını dışarıya açıyoruz
app.use(express.static(path.join(__dirname, 'public')));

const odalar = {};

io.on('connection', (socket) => {
    console.log('Oyuncu bağlandı: ' + socket.id);

    socket.on('odaOlustur', () => {
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
    });

    socket.on('odayaKatil', (odaKodu) => {
        odaKodu = odaKodu.toUpperCase();
        if (odalar[odaKodu] && !odalar[odaKodu].oyuncular.player2) {
            odalar[odaKodu].oyuncular.player2 = { id: socket.id, x: 2, y: 30, z: 2, renk: 0xec4899 };
            socket.join(odaKodu);
            socket.odaKodu = odaKodu;
            socket.oyuncuTipi = 'player2';
            io.to(odaKodu).emit('oyunBasladi', odalar[odaKodu].oyuncular);
        } else {
            socket.emit('hata', 'Oda bulunamadı veya dolu!');
        }
    });

    socket.on('hareketEt', (data) => {
        if (socket.odaKodu && odalar[socket.odaKodu]) {
            const oyuncu = odalar[socket.odaKodu].oyuncular[socket.oyuncuTipi];
            if (oyuncu) {
                oyuncu.x = data.x; oyuncu.y = data.y; oyuncu.z = data.z;
                socket.to(socket.odaKodu).emit('oyuncuHareketEtti', {
                    oyuncuTipi: socket.oyuncuTipi, x: data.x, y: data.y, z: data.z
                });
            }
        }
    });

    socket.on('disconnect', () => {
        if (socket.odaKodu && odalar[socket.odaKodu]) {
            delete odalar[socket.odaKodu].oyuncular[socket.oyuncuTipi];
            socket.to(socket.odaKodu).emit('oyuncuAyrildi');
            if (Object.keys(odalar[socket.odaKodu].oyuncular).length === 0) {
                delete odalar[socket.odaKodu];
            }
        }
    });
});

// Port ayarı (Glitch, Heroku gibi sunuculara yüklenirse otomatik port alır, yoksa 3000 açar)
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Oyun ${PORT} portunda yayında!`);
});
