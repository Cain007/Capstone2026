import 'dotenv/config';
import { prisma } from '../lib/prisma.js';
import {
  BootstrapAdminError,
  bootstrapInitialAdmin,
  readBootstrapAdminInput,
} from '../services/adminBootstrap.js';

async function main() {
  const input = readBootstrapAdminInput(process.env);
  const result = await bootstrapInitialAdmin(prisma, input);

  if (result.outcome === 'skipped') {
    console.log('An Admin account already exists. Bootstrap skipped.');
    return;
  }

  console.log(
    `Initial Admin created for ${result.admin.email} (${result.admin.username}).`,
  );
  console.log('The Admin must change the temporary password after signing in.');
}

main()
  .catch((error: unknown) => {
    if (error instanceof BootstrapAdminError) {
      console.error(error.message);
    } else {
      console.error('Admin bootstrap failed. Review the database connection and server logs.');
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
