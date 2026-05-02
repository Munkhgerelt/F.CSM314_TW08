# Хэрэглэгч ба хандалтын удирдлагын модуль

Энэ төсөл нь интернет кафены удирдлагын системийн хэрэглэгч, нэвтрэлт, эрхийн хяналтын хэсэг. Backend нь API ажиллуулна, frontend нь тэр API-тай холбогдож хэрэглэгч болон админ үйлдлүүдийг дэлгэцээр хийх боломж өгнө.

## Folder бүтэц

```text
backend/   Express + SQLite API
frontend/  React + Vite frontend
```

Root дээр байгаа `package.json` нь зөвхөн shortcut command-уудтай.

## Юу хийдэг вэ?

- Шинэ хэрэглэгч бүртгэнэ
- Имэйл, нууц үгээр login хийнэ
- JWT ашиглаж хамгаалагдсан endpoint-ууд руу хандана
- Logout хийхэд token сервер талд хүчингүй болно
- Нууц үгийг bcrypt hash хэлбэрээр хадгална
- Нууц үг сэргээх token үүсгэнэ
- Хэрэглэгч өөрийн profile-оо харж, засна
- Админ хэрэглэгчдийн жагсаалтыг шүүлт, pagination-тэй харна
- Админ хэрэглэгчийн status болон role өөрчилнө
- Register, login, failed login, logout, password reset, role/status change зэрэг үйлдлийг activity log-д хадгална

## Аюулгүй байдлын хэсэг

| Шийдэл | Хэрэгжүүлэлт |
|---|---|
| Authentication | Login амжилттай бол JWT үүсгэнэ |
| Authorization | Admin endpoint-ууд role шалгалттай |
| Password protection | Нууц үг plain text биш bcrypt hash-аар хадгалагдана |
| Password reset | Reset token random үүснэ, database-д hash хэлбэрээр хадгалагдана, хугацаатай, нэг удаа ашиглагдана |
| Token revoke | Logout хийхэд JWT-ийн `jti` revoked token table-д орно |
| Session invalidation | Password, role, status өөрчлөгдөхөд token version нэмэгдэж хуучин JWT ажиллахгүй болно |
| Input validation | Имэйл, нууц үг, нэр, role, status, page, limit зэрэг оролтууд шалгагдана |
| Rate limiting | Login оролдлогыг хязгаарласан |
| Audit log | Гол аюулгүй байдлын үйлдлүүд бүртгэгдэнэ |
| Admin хамгаалалт | Системд дор хаяж нэг active admin үлдэхээр шалгана |

## Ашигласан технологи

Backend:

- Node.js
- Express.js
- SQLite
- JWT
- bcryptjs
- helmet
- express-rate-limit
- express-validator

Frontend:

- React
- Vite
- HTML/CSS
- JavaScript

## Ажиллуулах

Backend package-уудыг суулгах:

```bash
cd backend
npm install
```

`.env` файл үүсгэх:

```bash
cp .env.example .env
```

Demo account-ууд үүсгэх:

```bash
npm run seed
```

Backend асаах:

```bash
npm run dev
```

Backend default-оор:

```text
http://localhost:5000
```

Frontend асаах:

```bash
cd ../frontend
npm run dev
```

Frontend default-оор:

```text
http://localhost:3000
```

Root folder-оос ажиллуулах shortcut:

```bash
npm run backend:dev
npm run frontend:dev
```

Test:

```bash
npm run backend:test
```

## Demo account-ууд

```text
Admin email: admin@esport.local
Admin password: Admin@12345

User email: user@example.com
User password: User@12345
```

## Frontend дээр хийх боломжтой зүйлс

- Login / logout
- User бүртгэх
- Өөрийн profile харах, засах
- Password reset token үүсгэх, password солих
- Admin эрхээр users харах, шүүх
- User status өөрчлөх
- User role өөрчлөх
- Activity log харах

## API endpoint-ууд

### Health check

```http
GET /health
```

### Хэрэглэгч бүртгэх

```http
POST /api/auth/register
Content-Type: application/json

{
  "fullName": "New User",
  "email": "newuser@example.com",
  "password": "Password123"
}
```

### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@esport.local",
  "password": "Admin@12345"
}
```

Login амжилттай бол token ирнэ. Дараагийн protected request дээр:

```http
Authorization: Bearer YOUR_TOKEN_HERE
```

### Өөрийн мэдээлэл харах

```http
GET /api/auth/me
Authorization: Bearer YOUR_TOKEN_HERE
```

### Logout

```http
POST /api/auth/logout
Authorization: Bearer YOUR_TOKEN_HERE
```

### Нууц үг сэргээх token авах

```http
POST /api/auth/forgot-password
Content-Type: application/json

{
  "email": "user@example.com"
}
```

Local/demo үед response дотор `resetToken` ирнэ. Production дээр үүнийг email эсвэл notification service-ээр явуулах ёстой.

### Нууц үг шинэчлэх

```http
POST /api/auth/reset-password
Content-Type: application/json

{
  "token": "RESET_TOKEN_HERE",
  "password": "NewPassword123"
}
```

### Profile засах

```http
PATCH /api/users/me
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json

{
  "fullName": "Updated Name"
}
```

### Admin: users харах

```http
GET /api/users?page=1&limit=20&role=USER&status=ACTIVE&search=user
Authorization: Bearer ADMIN_TOKEN_HERE
```

### Admin: user status өөрчлөх

```http
PATCH /api/users/2/status
Authorization: Bearer ADMIN_TOKEN_HERE
Content-Type: application/json

{
  "status": "INACTIVE"
}
```

### Admin: user role өөрчлөх

```http
PATCH /api/users/2/role
Authorization: Bearer ADMIN_TOKEN_HERE
Content-Type: application/json

{
  "role": "ADMIN"
}
```

### Admin: activity log харах

```http
GET /api/users/activity-logs?page=1&limit=20&action=LOGIN
Authorization: Bearer ADMIN_TOKEN_HERE
```

## Demo хийх дараалал

1. Backend асаана.
2. Frontend асаана.
3. Admin account-аар login хийнэ.
4. Users хэсгээс хэрэглэгчдийн жагсаалтыг харна.
5. User account үүсгэнэ эсвэл demo user-аар login хийж үзнэ.
6. Profile мэдээлэл засна.
7. Admin эрхээр user-ийн status эсвэл role өөрчилнө.
8. Password reset flow туршина.
9. Activity log дээр хийсэн үйлдлүүдээ шалгана.

## GitHub дээр оруулах

```bash
git add .
git commit -m "Add user access management module with frontend"
git branch -M main
git remote add origin YOUR_REPOSITORY_URL
git push -u origin main
```
