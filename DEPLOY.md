Deploy huong dan nhanh cho N3Goukaku

Phuong an 1: Vercel (de dung nhat)
1. Day source code len GitHub
2. Vao vercel.com, chon Add New Project
3. Import repo N3goukaku
4. Build Command: npm run build
5. Output Directory: dist
6. Them Environment Variable:
   VITE_GEMINI_API_KEY = API key cua ban
7. Bam Deploy

Sau khi deploy xong:
1. Vao Project Settings > Domains de gan domain tuy chon
2. Moi lan push GitHub se tu dong redeploy

Phuong an 2: Netlify
1. Day source code len GitHub
2. Vao app.netlify.com, chon Add new site > Import an existing project
3. Chon repo N3goukaku
4. Build command: npm run build
5. Publish directory: dist
6. Them Environment Variable:
   VITE_GEMINI_API_KEY = API key cua ban
7. Bam Deploy site

Luu y bao mat
1. API key hien dang nam ben frontend, nen can gioi han theo domain
2. Nen rotate key neu key da tung bi lo

Kiem tra sau deploy
1. Tai duoc tu vung tu Google Sheet CSV
2. Tao de AI hoat dong
3. Chua bai AI hoat dong
4. Trang responsive tren mobile
