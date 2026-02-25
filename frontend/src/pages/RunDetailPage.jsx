import { Link, useParams } from 'react-router-dom';
import RunStatus from '../components/RunStatus';

function RunDetailPage() {
  const { runId } = useParams();

  return (
    <section className="stack-md">
      <div className="card">
        <h1>Pipeline Run</h1>
        <p className="muted">Track extraction progress and open company insights as each profile becomes available.</p>
        <p>
          <Link to="/companies">Browse all companies</Link>
        </p>
      </div>
      <RunStatus runId={runId} />
    </section>
  );
}

export default RunDetailPage;
