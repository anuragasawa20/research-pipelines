function formatLocation(asset) {
  return [asset.country, asset.state_province, asset.town].filter(Boolean).join(', ');
}

function AssetCard({ asset }) {
  const location = formatLocation(asset);
  const hasCoordinates = asset.latitude != null && asset.longitude != null;

  return (
    <article className="card item-card">
      <h4>{asset.name}</h4>

      <div className="stack-xs">
        <p className="label">Commodities</p>
        <div className="chip-wrap">
          {asset.commodities?.length ? (
            asset.commodities.map((commodity) => (
              <span key={`${asset.id}-${commodity}`} className="chip">
                {commodity}
              </span>
            ))
          ) : (
            <span className="muted">No commodities listed</span>
          )}
        </div>
      </div>

      <div className="stack-xs">
        <p className="label">Status</p>
        <span className={`status status-${asset.status}`}>{asset.status}</span>
      </div>

      <div className="stack-xs">
        <p className="label">Location</p>
        <p>{location || 'Location not available'}</p>
      </div>

      <div className="stack-xs">
        <p className="label">Coordinates</p>
        <p>{hasCoordinates ? `(${asset.latitude}, ${asset.longitude})` : 'Not available'}</p>
      </div>

      {asset.source_url ? (
        <p>
          <a href={asset.source_url} target="_blank" rel="noreferrer">
            Source
          </a>
        </p>
      ) : null}
    </article>
  );
}

export default AssetCard;
