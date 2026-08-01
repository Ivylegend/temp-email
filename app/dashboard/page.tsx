import { Inbox } from "lucide-react";

export default async function DashboardPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const query = await searchParams;

  return (
    <div className="mail-pane-empty">
      {query.error ? <div className="status error">{query.error}</div> : null}
      {query.success ? <div className="status success">{query.success}</div> : null}

      <div className="mail-pane-placeholder">
        <Inbox size={48} className="placeholder-icon" />
        <p className="placeholder-title">Select an alias</p>
        <p className="placeholder-sub">Choose an alias from the left panel to view its messages.</p>
      </div>
    </div>
  );
}
