# Sistem Antrean Loket

Aplikasi untuk mengelola antrean loket seperti di rumah sakit, bank, atau instansi lainnya. Dibangun dengan Next.js, Prisma, dan Neon Database.

## Fitur

- **Panel Admin**: Kelola pengaturan, loket, dan antrean
- **Panel Operator Loket**: Antarmuka untuk petugas loket memanggil dan menyelesaikan antrean
- **Display Antrean**: Tampilan publik untuk menampilkan antrean yang sedang dilayani

## Teknologi

- **Frontend**: Next.js, React, TailwindCSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL (Neon Database)
- **ORM**: Prisma
- **Real-time**: Socket.io

## Instalasi

1. Clone repositori ini
2. Install dependensi:

```bash
npm install
```

3. Salin file `.env.example` ke `.env.local` dan atur DATABASE_URL ke connection string Neon Database Anda:

```bash
DATABASE_URL="postgresql://user:password@neon.tech:5432/database"
```

4. Generate Prisma Client:

```bash
npm run generate
```

5. Buat migrasi database:

```bash
npx prisma migrate dev --name init
```

6. Jalankan aplikasi:

```bash
npm run dev
```

## Struktur Aplikasi

- `/src/app` - Kode aplikasi Next.js
  - `/api` - API routes
  - `/admin` - Panel admin
  - `/loket` - Panel operator loket
  - `/display` - Display antrean
- `/prisma` - Konfigurasi database
- `/src/lib` - Library utilities

## Penggunaan

1. Buka `http://localhost:3000/admin` untuk mengakses panel admin
2. Atur pengaturan sistem dan tambahkan loket
3. Buka `http://localhost:3000/loket/[id]` untuk mengakses panel operator loket
4. Buka `http://localhost:3000/display` untuk melihat display antrean

## Deployment

Aplikasi dapat di-deploy ke Vercel atau layanan hosting lainnya. Pastikan untuk menyiapkan database Neon Database terlebih dahulu dan menyetel environment variable DATABASE_URL pada layanan hosting.

## Kontribusi

Kontribusi selalu diterima. Silakan buat issue atau pull request untuk meningkatkan aplikasi ini.

## Lisensi

Proyek ini dilisensikan di bawah lisensi MIT.

# Queue System Application

A modern queue management system with digital interfaces, real-time updates, and voice announcements.

## Setup Instructions

### Install Dependencies

```bash
npm install
```

### Database Setup

```bash
npm run setup-db
npm run generate
```

### Start Development Server

```bash
npm run dev
```

## Key Features

- **Admin Panel**: Configure system settings, manage counters, and monitor queues
- **Counter Interface**: For operators to call and serve customers
- **Public Display**: Shows current queue status with voice announcements
- **Voice Announcements**: Calls out queue numbers using the Web Speech API
- **Real-time Updates**: Uses Socket.io for instant updates across all interfaces

## Technology Stack

- Next.js 15
- React 19
- Prisma ORM
- PostgreSQL
- Tailwind CSS
- Socket.io
- Web Speech API
