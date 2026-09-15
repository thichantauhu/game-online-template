# GAME ONLINE TEMPLATE

Template lobby realtime dùng chung cho các game board/card game online.

## Lobby có sẵn

- Tạo phòng bằng mã 5 ký tự
- Vào phòng bằng mã
- Sao chép mã phòng
- Danh sách người chơi realtime
- Chủ phòng
- Kick người chơi
- Thêm bot
- Kiểm tra số người tối thiểu / tối đa
- Nút Bắt đầu
- Khung Luật chơi
- Chuyển sang `game.html` khi bắt đầu

## Làm game mới

Giữ nguyên lobby. Chỉ cần sửa `GAME` trong `server.js` và `public/config.js`, sau đó xây gameplay trong `public/game.html` (hoặc tách thành thư mục riêng).

```js
const GAME = {
  name: 'Tên game mới',
  minPlayers: 3,
  maxPlayers: 7,
  maxBots: 7,
  rules: [
    'Luật 1',
    'Luật 2',
    'Luật 3'
  ]
};
```

## Chạy local

```bash
npm install
npm start
```

Mở `http://localhost:3000`.

## Deploy Render

Repo có sẵn `render.yaml`. Trên Render chọn **New + > Blueprint** hoặc tạo Web Service từ repo và dùng:

- Build Command: `npm install`
- Start Command: `npm start`

## Quy ước

Khi tạo game mới, dùng câu: **"Dùng GAME ONLINE LOBBY TEMPLATE của t."**

Không tự ý đổi cấu trúc lobby nếu chỉ được yêu cầu sửa gameplay.
