const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message = data?.error || data?.message || `Request failed with status ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return data;
}

export function getHealth() {
  return request('/api/health');
}

export function ingestCompanies(input) {
  return request('/api/pipeline/ingest', {
    method: 'POST',
    body: JSON.stringify({ input }),
  });
}

export function getPipelineRun(runId) {
  return request(`/api/pipeline/runs/${runId}`);
}

export function debugPipeline(company) {
  return request('/api/pipeline/debug', {
    method: 'POST',
    body: JSON.stringify({ company }),
  });
}

export function getCompanies() {
  return request('/api/companies');
}

export function getCompanyById(companyId) {
  return request(`/api/companies/${companyId}`);
}
