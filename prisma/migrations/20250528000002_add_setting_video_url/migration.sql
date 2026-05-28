-- AlterTable Setting: add videoUrl column if it doesn't exist
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "videoUrl" TEXT DEFAULT 'https://www.youtube.com/embed/jAQvxW2l-Pg';
