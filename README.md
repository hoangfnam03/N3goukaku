# N3Goukaku - Japanese Vocabulary Study Web

Web app học từ vựng Nhật từ nhiều nguồn dữ liệu, tối ưu cho cả desktop và mobile.

## Tính năng

- Quản lý nhiều nguồn Google Sheet (mỗi nguồn là một nhóm từ vựng khác nhau)
- Quản lý nhiều nguồn quiz JSON crawl
- 3 chế độ học:
  - AI tạo đề giống JLPT (Gemini)
  - Làm quiz từ nguồn crawl và nhờ AI chữa
  - Luyện gõ hiragana
- Lưu danh sách nguồn ngay trên trình duyệt (localStorage)

## Cấu trúc dữ liệu

### 1) Google Sheet từ vựng

Sheet cần có tối thiểu các cột:

- `Hiragana/Katakana` (hoặc `kana`)
- `Nghĩa` (hoặc `meaning`)

Khuyến nghị thêm:

- `Kanji`
- `Âm Hán Việt`

Ví dụ:

| Kanji | Âm Hán Việt | Hiragana/Katakana | Nghĩa |
|---|---|---|---|
| 特徴 | ĐẶC TRƯNG | とくちょう | Đặc trưng, đặc tính |
| 特色 | ĐẶC SẮC | とくしょく | Đặc sắc |

### 2) JSON quiz crawl

Hỗ trợ một trong các schema:

```json
[
  {
    "question": "この文に合う言葉を選んでください。",
    "options": ["特徴", "普通", "一般", "特色"],
    "answer": "特色",
    "explanation": "Ngữ cảnh nhấn vào nét riêng nổi bật"
  }
]
```

Hoặc:

```json
{
  "questions": [
    {
      "question": "...",
      "options": ["...", "...", "...", "..."],
      "answer": "..."
    }
  ]
}
```

## Cài đặt và chạy local

```bash
npm install
npm run dev
```

## Cấu hình Gemini

1. Tạo file `.env` từ `.env.example`
2. Điền API key:

```bash
VITE_GEMINI_API_KEY=your_gemini_key
```

Lưu ý: vì đây là app front-end, key nằm phía client. Nên dùng key giới hạn domain và quota.

## Build production

```bash
npm run build
npm run preview
```

## Deploy

### Vercel (khuyến nghị)

1. Push source code lên GitHub
2. Import project vào Vercel
3. Build command: `npm run build`
4. Output directory: `dist`
5. Thêm environment variable: `VITE_GEMINI_API_KEY`

Sau deploy, bạn có thể học trên máy tính và điện thoại bằng cùng một URL.
