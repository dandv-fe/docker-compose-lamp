import 'dotenv/config';
import { createApp } from './app.js';
import { pool } from './db.js';
import { startRatingWorker } from './services/ratingAutomation.js';

const port = Number(process.env.PORT ?? 3000);
// Invalid rating automation settings abort startup instead of running with silent defaults.
const ratingWorker = startRatingWorker();
const app = createApp();
const server = app.listen(port, () => console.info(`API listening on port ${port}`));

const shutdown = async () => {
  server.close();
  await ratingWorker?.stop();
  await pool.end();
};

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
