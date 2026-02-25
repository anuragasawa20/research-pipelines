function LeaderCard({ leader }) {
  return (
    <article className="card item-card">
      <h4>{leader.name}</h4>
      <p className="muted">{leader.title || 'Title not available'}</p>

      <div className="stack-xs">
        <p className="label">Expertise</p>
        <div className="chip-wrap">
          {leader.expertise_tags?.length ? (
            leader.expertise_tags.map((tag) => (
              <span key={`${leader.id}-${tag}`} className="chip">
                {tag}
              </span>
            ))
          ) : (
            <span className="muted">No expertise tags</span>
          )}
        </div>
      </div>

      <div className="stack-xs">
        <p className="label">Summary</p>
        {leader.summary_bullets?.length ? (
          <ul>
            {leader.summary_bullets.map((bullet) => (
              <li key={`${leader.id}-${bullet}`}>{bullet}</li>
            ))}
          </ul>
        ) : (
          <p className="muted">No summary available</p>
        )}
      </div>

      {leader.source_url ? (
        <p>
          <a href={leader.source_url} target="_blank" rel="noreferrer">
            Source
          </a>
        </p>
      ) : null}
    </article>
  );
}

export default LeaderCard;
