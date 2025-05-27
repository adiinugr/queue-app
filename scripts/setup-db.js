#!/usr/bin/env node

const { execSync } = require("child_process")
const fs = require("fs")
const path = require("path")

// Pastikan folder .env.local ada
const envLocalPath = path.join(process.cwd(), ".env.local")
if (!fs.existsSync(envLocalPath)) {
  console.log("File .env.local tidak ditemukan. Membuat file contoh...")
  fs.writeFileSync(
    envLocalPath,
    'DATABASE_URL="postgresql://user:password@neon.tech:5432/database"\n'
  )
  console.log(
    "File .env.local dibuat. Silakan update DATABASE_URL dengan connection string yang benar."
  )
  process.exit(1)
}

console.log("Memulai setup database...")

try {
  // Langkah 1: Generate Prisma Client
  console.log("Generating Prisma Client...")
  execSync("npx prisma generate", { stdio: "inherit" })

  // Langkah 2: Tanya apakah ingin membuat migrasi
  console.log("\nApakah Anda ingin membuat migrasi database?")
  console.log("Untuk membuat migrasi, jalankan:")
  console.log("npx prisma migrate dev --name init")

  // Langkah 3: Tanya apakah ingin menerapkan migrasi ke database
  console.log(
    "\nUntuk menerapkan migrasi tanpa membuat migrasi baru, jalankan:"
  )
  console.log("npx prisma migrate deploy")

  // Langkah 4: Tanya apakah ingin melihat data di database
  console.log("\nUntuk melihat data di database, jalankan:")
  console.log("npx prisma studio")

  console.log("\nSetup database selesai!")
} catch (error) {
  console.error("Error saat setup database:", error.message)
  process.exit(1)
}
