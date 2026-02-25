import AssetCard from './AssetCard';
import LeaderCard from './LeaderCard';

function CompanyProfile({ company }) {
  const leaders = company.leaders || [];
  const assets = company.assets || [];

  return (
    <section className="stack-lg">
      <article className="card">
        <h2>4. Data Insights</h2>
        <h3>{company.name}</h3>
        <p className="muted">{company.description || 'No description available.'}</p>

        <div className="status-grid">
          <p>
            <strong>Leaders:</strong> {leaders.length}
          </p>
          <p>
            <strong>Assets:</strong> {assets.length}
          </p>
          <p>
            <strong>Website:</strong>{' '}
            {company.website_url ? (
              <a href={company.website_url} target="_blank" rel="noreferrer">
                {company.website_url}
              </a>
            ) : (
              'Not available'
            )}
          </p>
        </div>
      </article>

      <section className="stack-md">
        <h3>Leaders</h3>
        {leaders.length ? (
          <div className="grid-2">
            {leaders.map((leader) => (
              <LeaderCard key={leader.id} leader={leader} />
            ))}
          </div>
        ) : (
          <p className="muted">No leaders found for this company.</p>
        )}
      </section>

      <section className="stack-md">
        <h3>Assets</h3>
        {assets.length ? (
          <div className="grid-2">
            {assets.map((asset) => (
              <AssetCard key={asset.id} asset={asset} />
            ))}
          </div>
        ) : (
          <p className="muted">No assets found for this company.</p>
        )}
      </section>
    </section>
  );
}

export default CompanyProfile;
