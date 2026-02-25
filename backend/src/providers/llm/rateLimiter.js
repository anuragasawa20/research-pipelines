import Bottleneck from 'bottleneck';
import config from '../../config/index.js';

const rpm = Math.max(1, Number(config.pipeline.llmRequestsPerMinute || 4));
const minTime = Math.ceil(60000 / rpm);

// Single shared limiter instance for all LLM calls in this process.
const limiter = new Bottleneck({
  maxConcurrent: 1,
  minTime,
});

export function scheduleLLM(task) {
  return limiter.schedule(task);
}

export function getLLMLimiterConfig() {
  return { requestsPerMinute: rpm, minTimeMs: minTime };
}
