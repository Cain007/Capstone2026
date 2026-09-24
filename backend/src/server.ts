import 'dotenv/config';
import { createApp } from './app.js';
import {
  EnvironmentValidationError,
  loadBackendEnvironment,
} from './config/env.js';
import { prisma } from './lib/prisma.js';

let environment;
try {
  environment = loadBackendEnvironment();
} catch (error) {
  if (error instanceof EnvironmentValidationError) console.error(error.message);
  else console.error('Backend environment validation failed.');
  process.exit(1);
}

const app = createApp(environment);
const server = app.listen(environment.port, () => {
  console.log(`API running on port ${environment.port}`);
});

async function shutdown() {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
