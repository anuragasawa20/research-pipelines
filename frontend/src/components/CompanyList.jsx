import { Link } from 'react-router-dom';

function CompanyList({ companies }) {
  if (!companies.length) {
    return <p className="muted">No companies ingested yet.</p>;
  }

  return (
    <div className="table-wrap card">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Leaders</th>
            <th>Assets</th>
            <th>Profile</th>
          </tr>
        </thead>
        <tbody>
          {companies.map((company) => (
            <tr key={company.id}>
              <td>{company.name}</td>
              <td>{company.leader_count}</td>
              <td>{company.asset_count}</td>
              <td>
                <Link to={`/companies/${company.id}`}>View profile</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default CompanyList;
