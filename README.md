# Хэрэглэгч ба хандалтын удирдлагын модуль

Энэ модуль нь интернет кафены удирдлагын системд зориулсан хэрэглэгчийн бүртгэл, нэвтрэлт, эрхийн хяналт, админы хэрэглэгч удирдлага болон үйлдлийн бүртгэлийг хариуцна. Гол санаа нь энгийн: хэрэглэгч системд аюулгүй нэвтэрч, өөрийн мэдээллээ харна; харин админ хэрэглэгчдийн төлөв, эрх, үйлдлийн бүртгэлийг хянах боломжтой байна.

## Юу хийдэг вэ?

- Шинэ хэрэглэгч бүртгэнэ
- Имэйл, нууц үгээр нэвтрүүлнэ
- JWT ашиглаж хамгаалагдсан endpoint-ууд руу хандуулна
- Гарах үед JWT-г сервер талд хүчингүй болгоно
- Нууц үгийг bcrypt ашиглан hash хэлбэрээр хадгална
- Нууц үг сэргээх token үүсгэнэ
- Нэвтэрсэн хэрэглэгч өөрийн мэдээллээ харж, нэр эсвэл имэйлээ засна
- Админ хэрэглэгчдийн жагсаалтыг шүүлт, pagination-тэй харна
- Админ хэрэглэгчийг идэвхтэй/идэвхгүй болгоно
- Админ хэрэглэгчийн role өөрчилнө
- Аюулгүй байдлын холбоотой үйлдлүүдийг activity log-д хадгална

## Аюулгүй байдлын шийдлүүд

| Шийдэл | Яаж хэрэгжүүлсэн |
|---|---|
| Нэвтрэлт | Амжилттай login хийсний дараа JWT үүсгэнэ |
| Эрхийн хяналт | Admin endpoint-ууд role шалгалтаар хамгаалагдсан |
| Нууц үг хамгаалалт | Нууц үгийг plain text биш bcrypt hash хэлбэрээр хадгална |
| Нууц үг сэргээх | Reset token санамсаргүй үүснэ, database-д hash хэлбэрээр хадгалагдана, хугацаатай, нэг удаа ашиглагдана |
| Token хүчингүй болгох | Logout хийхэд JWT-ийн `jti` revoked token хүснэгтэд хадгалагдана |
| Session invalidation | Нууц үг, role, status өөрчлөгдөхөд token version нэмэгдэж хуучин JWT ажиллахгүй болно |
| Input validation | Имэйл, нууц үг, нэр, role, status, page, limit зэрэг оролтуудыг шалгана |
| Rate limiting | Login оролдлогыг хязгаарлаж brute-force халдлагаас хамгаална |
| Мэдээлэл задруулахгүй байх | Идэвхгүй хэрэглэгч эсэхийг хэлэхээс өмнө эхлээд нууц үгийг шалгана |
| Activity log | Register, login, failed login, logout, profile update, password reset, role/status change зэрэг үйлдлүүдийг бүртгэнэ |
| Admin хамгаалалт | Системд дор хаяж нэг идэвхтэй admin үлдэхээр шалгалт хийсэн |

## Ашигласан технологи

- Node.js
- Express.js
- SQLite
- JWT
- bcryptjs
- helmet
- express-rate-limit
- express-validator

## Ажиллуулах

Эхлээд package-уудаа суулгана.

```bash
npm install
```

Дараа нь `.env.example`-оос `.env` файл үүсгээд шаардлагатай утгуудыг тохируулна.

```bash
cp .env.example .env
```

Demo хэрэглэгч, админыг үүсгэх:

```bash
npm run seed
```

Сервер асаах:

```bash
npm run dev
```

Сервер default-оор энд ажиллана.

```text
http://localhost:5000
```

Test ажиллуулах бол:

```bash
npm test
```

## Demo account-ууд

```text
Admin email: admin@esport.local
Admin password: Admin@12345

Customer email: customer@example.com
Customer password: Customer@12345
```

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
  "fullName": "New Customer",
  "email": "newcustomer@example.com",
  "password": "Password123"
}
```

### Нэвтрэх

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@esport.local",
  "password": "Admin@12345"
}
```

Login амжилттай бол token буцаана. Дараагийн хамгаалагдсан request дээр ингэж ашиглана.

```http
Authorization: Bearer YOUR_TOKEN_HERE
```

### Өөрийн мэдээлэл харах

```http
GET /api/auth/me
Authorization: Bearer YOUR_TOKEN_HERE
```

### Гарах

```http
POST /api/auth/logout
Authorization: Bearer YOUR_TOKEN_HERE
```

Logout хийсний дараа тухайн token сервер талд хүчингүй болно.

### Нууц үг сэргээх хүсэлт

```http
POST /api/auth/forgot-password
Content-Type: application/json

{
  "email": "newcustomer@example.com"
}
```

Local/demo орчинд response дотор `resetToken` ирнэ. Production дээр бол энэ token-ийг хэрэглэгч рүү email эсвэл өөр notification сувгаар илгээх ёстой.

### Нууц үг шинэчлэх

```http
POST /api/auth/reset-password
Content-Type: application/json

{
  "token": "RESET_TOKEN_HERE",
  "password": "NewPassword123"
}
```

### Өөрийн profile засах

```http
PATCH /api/users/me
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json

{
  "fullName": "Updated Name"
}
```

### Admin: хэрэглэгчдийн жагсаалт харах

```http
GET /api/users?page=1&limit=20&role=CUSTOMER&status=ACTIVE&search=customer
Authorization: Bearer ADMIN_TOKEN_HERE
```

### Admin: хэрэглэгч идэвхтэй/идэвхгүй болгох

```http
PATCH /api/users/2/status
Authorization: Bearer ADMIN_TOKEN_HERE
Content-Type: application/json

{
  "status": "INACTIVE"
}
```

### Admin: хэрэглэгчийн role өөрчлөх

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

1. Серверээ асаана.
2. Шинэ customer бүртгэнэ.
3. Customer эрхээр login хийнэ.
4. Өөрийн profile-оо харна.
5. Profile мэдээллээ засна.
6. Admin эрхээр login хийнэ.
7. Хэрэглэгчдийн жагсаалтыг харна.
8. Customer account-ыг идэвхгүй болгоно.
9. Идэвхгүй болсон account-аар login хийж үзнэ.
10. Account-ыг буцааж идэвхжүүлнэ.
11. Нууц үг сэргээх flow-г туршина.
12. Customer-ийн role-г өөрчилж үзнэ.
13. Activity log-оос хийсэн үйлдлүүдээ шалгана.

## GitHub дээр оруулах

```bash
git init
git add .
git commit -m "Add user access management module"
git branch -M main
git remote add origin YOUR_REPOSITORY_URL
git push -u origin main
```
