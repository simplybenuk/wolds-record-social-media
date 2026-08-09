import Link from "next/link";

export default function CampaignNotFound() {
  return (
    <section className="page-card">
      <h1>Campaign not found</h1>
      <p>This campaign does not exist in the local studio database.</p>
      <Link className="button" href="/campaigns/new">Create a campaign</Link>
    </section>
  );
}
