import express from 'express';
import cors from 'cors';
import config from './config/index.js';
import pipelineRoutes from './routes/pipeline.js';
import companyRoutes from './routes/companies.js';

const app = express();

app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/pipeline', pipelineRoutes);
app.use('/api/companies', companyRoutes);

app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(config.port, () => {
  console.log(`Mining Intelligence API running on http://localhost:${config.port}`);
  console.log(`Search provider: ${config.searchProvider}`);
  console.log(`Crawl provider:  ${config.crawlProvider}`);
  console.log(`LLM provider:    ${config.llmProvider}`);
});
