import 'dotenv/config';
import { createApp } from './app.js';
import { pool } from './db.js';

const port = Number(process.env.PORT ?? 3000);
const app = createApp();
const server = app.listen(port, () => console.info(`API listening on port ${port}`));

const shutdown = async () => {
  server.close();
  await pool.end();
};

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
