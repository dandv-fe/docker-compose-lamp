// Fixed stdin/stdout bridge for PHP. No database access or user-supplied executable.
import fs from 'node:fs';
import { forecastScheduledCollections } from '../dist/services/ratingEngine.js';
import { presentOwnChallenge } from '../dist/services/dispatchChallengePresentation.js';
try {
  const raw = fs.readFileSync(0, 'utf8');
  if (raw.length > 20_000_000) throw new Error('Forecast input exceeds the supported size.');
  const data = JSON.parse(raw);
  if (data.action === 'own') {
    process.stdout.write(JSON.stringify(presentOwnChallenge(data.row, data.salary, data.goal, data.today,
      data.collections, data.coverage)));
    process.exit(0);
  }
  if (!Array.isArray(data.cards) || data.cards.length > 20_000
      || !/^\d{4}-\d{2}-\d{2}$/.test(data.today) || !/^\d{4}-\d{2}-\d{2}$/.test(data.deadline)) {
    throw new Error('Invalid dispatch forecast input.');
  }
  const result = forecastScheduledCollections(data.cards, new Date(`${data.today}T12:00:00-05:00`),
    new Date(`${data.deadline}T12:00:00-05:00`), 'America/Bogota');
  process.stdout.write(JSON.stringify(result));
} catch (error) {
  process.stderr.write(`Dispatch forecast: ${error.message}\n`);
  process.exitCode = 1;
}
