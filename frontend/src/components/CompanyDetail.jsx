import { useEffect, useState } from 'react';
import { getCompanyById } from './api';
import CompanyProfile from './CompanyProfile';

function CompanyDetail({ companyId }) {
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
        setError(err.message || 'Failed to load company profile.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadCompany();
    return () => {
      isMounted = false;
    };
  }, [companyId]);

  if (loading) return <p className="muted">Loading company profile...</p>;
  if (error) return <p className="error">{error}</p>;
  if (!company) return <p className="muted">Company not found.</p>;

  return <CompanyProfile company={company} />;
}

export default CompanyDetail;
