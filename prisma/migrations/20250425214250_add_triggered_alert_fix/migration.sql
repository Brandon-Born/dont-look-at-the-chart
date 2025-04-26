-- CreateTable
CREATE TABLE "TriggeredAlert" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "triggeringPrice" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "TriggeredAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TriggeredAlert_ruleId_triggeredAt_idx" ON "TriggeredAlert"("ruleId", "triggeredAt");

-- AddForeignKey
ALTER TABLE "TriggeredAlert" ADD CONSTRAINT "TriggeredAlert_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "NotificationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
