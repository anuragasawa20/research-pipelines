import { useState } from 'react';
import { ingestCompanies } from './api';

function IngestForm({ onRunCreated }) {
  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    if (!input.trim()) {
      setError('Please enter one or more company names.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const result = await ingestCompanies(input.trim());
      onRunCreated(result);
    } catch (err) {
      setError(err.message || 'Failed to start pipeline run.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="card">
      <h2>1. Enter Company Names</h2>
      <p className="muted">Use comma-separated names, for example: BHP, Rio Tinto, Fortescue</p>

      <form onSubmit={handleSubmit} className="stack-sm">
        <textarea
          className="input"
          rows={4}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Company A, Company B, Company C"
          disabled={submitting}
        />

        {error ? <p className="error">{error}</p> : null}

        <button type="submit" disabled={submitting}>
          {submitting ? 'Starting...' : 'Start Extraction'}
        </button>
      </form>
    </section>
  );
}

export default IngestForm;
