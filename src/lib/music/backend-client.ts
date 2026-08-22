import { getEnv } from '../env.js';

export async function enqueueMusicJob(jobId: string, query: string): Promise<void> {
  const { musicWorkerUrl } = getEnv();
  let response: Response;

  try {
    response = await fetch(`${musicWorkerUrl}/v1/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, query }),
    });
  } catch {
    throw new Error('Music service is unavailable.');
  }

  if (!response.ok) {
    throw new Error('Music service is unavailable.');
  }
}
