import { Link, useParams } from 'react-router-dom';
import CompanyDetail from '../components/CompanyDetail';

function CompanyDetailPage() {
  const { companyId } = useParams();

  return (
    <section className="stack-md">
      <div className="card">
        <h1>Company Profile</h1>
        <p>
          <Link to="/companies">Back to companies</Link>
        </p>
      </div>
      <CompanyDetail companyId={companyId} />
    </section>
  );
}

export default CompanyDetailPage;
