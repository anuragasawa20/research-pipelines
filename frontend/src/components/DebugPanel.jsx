import { useState } from 'react';
import { debugPipeline } from './api';

function JsonBlock({ data }) {
  return <pre className="json-block">{JSON.stringify(data, null, 2)}</pre>;
}

function DebugPanel() {
  const [company, setCompany] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!company.trim()) {
      setError('Please enter a company name.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const data = await debugPipeline(company.trim());
      setResult(data);
    } catch (err) {
      setError(err.message || 'Debug request failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="stack-md">
      <article className="card">
        <h2>Debug Pipeline</h2>
        <p className="muted">Runs search, crawl, and extraction for one company without writing to the database.</p>

        <form onSubmit={handleSubmit} className="stack-sm">
          <input
            className="input"
            value={company}
            onChange={(event) => setCompany(event.target.value)}
            placeholder="Enter a company name"
            disabled={loading}
          />
          {error ? <p className="error">{error}</p> : null}
          <button type="submit" disabled={loading}>
            {loading ? 'Running debug...' : 'Run Debug'}
          </button>
        </form>
      </article>

      {result ? (
        <article className="card stack-sm">
          <h3>Debug Result</h3>
          {result.searchError ? <p className="error">{result.searchError}</p> : null}

          <details>
            <summary>Search URLs</summary>
            <JsonBlock data={result.searchUrls} />
          </details>

          <details>
            <summary>Reordered Search URLs</summary>
            <JsonBlock data={result.searchUrlsReordered} />
          </details>

          <details>
            <summary>Crawl Summary</summary>
            <JsonBlock data={result.crawl} />
          </details>

          <details>
            <summary>Parsed Leadership</summary>
            <JsonBlock data={result.llm?.leadership?.parsed || []} />
          </details>

          <details>
            <summary>Parsed Assets</summary>
            <JsonBlock data={result.llm?.assets?.parsed || []} />
          </details>

          <details>
            <summary>Raw LLM Leadership Output</summary>
            <JsonBlock data={result.llm?.leadership?.raw || null} />
          </details>

          <details>
            <summary>Raw LLM Assets Output</summary>
            <JsonBlock data={result.llm?.assets?.raw || null} />
          </details>
        </article>
      ) : null}
    </section>
  );
}

export default DebugPanel;
