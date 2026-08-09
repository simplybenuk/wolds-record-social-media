"use client";

export default function CampaignError({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="page-card" role="alert">
      <h1>Campaign could not be loaded</h1>
      <p>The saved campaign is still available. Try loading it again.</p>
      <button className="button" onClick={reset}>Try again</button>
    </section>
  );
}
