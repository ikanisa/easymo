export type ExternalFeedItem = {
  id: string;
  source: string;
  title: string;
  snippet: string | null;
  url: string;
  confidence: number | null;
};

type ExternalFeedListProps = {
  feedItems: ExternalFeedItem[];
};

export function ExternalFeedList({ feedItems }: ExternalFeedListProps) {
  if (!feedItems.length) {
    return <p className="text-muted">No external feed items yet.</p>;
  }

  return (
    <div className="feed-grid">
      {feedItems.map((item) => (
        <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="feed-card">
          <header>
            <p className="feed-source">{item.source.replace(/_/g, " ")}</p>
            {item.confidence !== null && <span className="feed-confidence">{(item.confidence * 100).toFixed(0)}%</span>}
          </header>
          <h4>{item.title}</h4>
          {item.snippet && <p>{item.snippet}</p>}
        </a>
      ))}
    </div>
  );
}
