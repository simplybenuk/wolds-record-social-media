"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

import { runGenerationAction } from "@/features/campaigns/actions";

export function GenerationStarter({
  campaignId,
  attemptId,
}: {
  campaignId: string;
  attemptId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      await runGenerationAction(campaignId, attemptId);
      router.refresh();
    });
  }, [attemptId, campaignId, router]);

  return (
    <div aria-live="polite" className="status-panel">
      <span className="spinner" aria-hidden="true" />
      <div>
        <strong>{pending ? "Creating and rendering your campaign…" : "Generation is queued…"}</strong>
        <p>You can safely reload this page. The campaign and attempt are already saved.</p>
      </div>
    </div>
  );
}
