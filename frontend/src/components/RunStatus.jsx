import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPipelineRun } from './api';

function RunStatus({ runId }) {
  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    let timeoutId = null;

    async function fetchRunAndPoll() {
      try {
        const data = await getPipelineRun(runId);
        if (!isMounted) return;
        setRun(data);
        setError('');
        if (data && (data.status === 'pending' || data.status === 'processing')) {
          timeoutId = setTimeout(fetchRunAndPoll, 2500);
        }
      } catch (err) {
        if (!isMounted) return;
        setError(err.message || 'Failed to load pipeline status.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchRunAndPoll();

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [runId]);

  const progress = useMemo(() => {
    if (!run?.companies?.length) return 0;
    const completeCount = run.companies.filter((company) => company.status === 'complete').length;
    return Math.round((completeCount / run.companies.length) * 100);
  }, [run]);

  if (loading) {
    return (
      <section className="card">
        <h2>2-3. Extraction and Pipeline Status</h2>
        <p className="muted">Loading run data...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="card">
        <h2>2-3. Extraction and Pipeline Status</h2>
        <p className="error">{error}</p>
      </section>
    );
  }

  return (
    <section className="card">
      <h2>2-3. Extraction and Pipeline Status</h2>
      <div className="status-grid">
        <p>
          <strong>Run ID:</strong> {run.id}
        </p>
        <p>
          <strong>Status:</strong> <span className={`status status-${run.status}`}>{run.status}</span>
        </p>
        <p>
          <strong>Total Companies:</strong> {run.total_companies}
        </p>
        <p>
          <strong>Progress:</strong> {progress}%
        </p>
      </div>

      {run.error_log ? <p className="error">{run.error_log}</p> : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Company</th>
              <th>Step</th>
              <th>Status</th>
              <th>Error</th>
              <th>Insights</th>
            </tr>
          </thead>
          <tbody>
            {run.companies?.map((company) => (
              <tr key={company.id}>
                <td>{company.company_name}</td>
                <td>{company.step}</td>
                <td>
                  <span className={`status status-${company.status}`}>{company.status}</span>
                </td>
                <td>{company.error_message || '-'}</td>
                <td>
                  {company.company_id ? (
                    <Link to={`/companies/${company.company_id}`}>View profile</Link>
                  ) : (
                    <span className="muted">Not ready</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default RunStatus;
