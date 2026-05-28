-- CreateEnum
CREATE TYPE "CounterType" AS ENUM ('OPERATOR', 'VERIFIKATOR');

-- CreateEnum
CREATE TYPE "QueueType" AS ENUM ('OPERATOR', 'VERIFIKATOR');

-- AlterTable Counter
ALTER TABLE "Counter" ADD COLUMN "counterType" "CounterType" NOT NULL DEFAULT 'OPERATOR';

-- AlterTable Queue
ALTER TABLE "Queue" ADD COLUMN "queueType" "QueueType" NOT NULL DEFAULT 'OPERATOR';
