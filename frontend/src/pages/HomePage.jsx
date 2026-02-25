import { useNavigate } from 'react-router-dom';
import IngestForm from '../components/IngestForm';

function HomePage() {
  const navigate = useNavigate();

  function handleRunCreated(run) {
    navigate(`/runs/${run.runId}`);
  }

  return (
    <section className="stack-md">
      <IngestForm onRunCreated={handleRunCreated} />
    </section>
  );
}

export default HomePage;
