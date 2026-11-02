-- CreateTable
CREATE TABLE "rooms" (
    "room_id" TEXT NOT NULL,
    "host_key" TEXT NOT NULL,
    "table_state" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("room_id")
);
