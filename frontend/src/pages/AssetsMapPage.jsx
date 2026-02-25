import { Link, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import AssetsMapView from '../components/AssetsMapView';
import { getCompanyById } from '../components/api';

function AssetsMapPage() {
  const { companyId } = useParams();
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadCompany() {
      try {
        const data = await getCompanyById(companyId);
        if (!isMounted) return;
        setCompany(data);
        setError('');
      } catch (err) {
        if (!isMounted) return;
        setError(err.message || 'Failed to load company assets map.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadCompany();
    return () => {
      isMounted = false;
    };
  }, [companyId]);

  return (
    <section className="stack-md">
      <div className="card stack-xs">
        <h1>Assets Geospatial View</h1>
        <p className="muted">
          {company?.name || 'Company'} assets rendered on an interactive map using extracted
          coordinates with geocoding fallback for missing lat/long.
        </p>
        <p>
          <Link to={`/companies/${companyId}`}>Back to company profile</Link>
        </p>
      </div>

      {loading ? <p className="muted">Loading map data...</p> : null}
      {!loading && error ? <p className="error">{error}</p> : null}
      {!loading && !error && company ? (
        <AssetsMapView assets={company.assets || []} companyName={company.name} />
      ) : null}
    </section>
  );
}

export default AssetsMapPage;
