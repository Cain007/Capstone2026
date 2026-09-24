const PRODUCTION_REQUIRED_VARIABLES = [
  'DATABASE_URL',
  'JWT_SECRET',
  'FRONTEND_URL',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
] as const;

export type BackendEnvironment = {
  nodeEnv: string;
  isProduction: boolean;
  port: number;
  frontendOrigin: string;
  trustProxy: false | 1;
};

export class EnvironmentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvironmentValidationError';
  }
}

function configuredValue(environment: NodeJS.ProcessEnv, name: string) {
  const value = environment[name]?.trim();
  return value ? value : null;
}

function validateDatabaseUrl(value: string) {
  try {
    const url = new URL(value);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error();
  } catch {
    throw new EnvironmentValidationError(
      'DATABASE_URL must be a valid PostgreSQL connection URL.',
    );
  }
}

function validateFrontendOrigin(value: string, isProduction: boolean) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new EnvironmentValidationError(
      'FRONTEND_URL must be a valid HTTP or HTTPS origin.',
    );
  }

  const isHttp = url.protocol === 'http:' || url.protocol === 'https:';
  const isOriginOnly =
    url.pathname === '/' && !url.search && !url.hash && !url.username && !url.password;
  if (!isHttp || !isOriginOnly) {
    throw new EnvironmentValidationError(
      'FRONTEND_URL must be a valid HTTP or HTTPS origin.',
    );
  }

  const isLocalhost =
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.hostname === '[::1]';
  if (isProduction && (url.protocol !== 'https:' || isLocalhost)) {
    throw new EnvironmentValidationError(
      'FRONTEND_URL must be a non-local HTTPS origin in production.',
    );
  }

  return url.origin;
}

export function loadBackendEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): BackendEnvironment {
  const nodeEnv = configuredValue(environment, 'NODE_ENV') ?? 'development';
  const isProduction = nodeEnv === 'production';

  if (isProduction) {
    const missing = PRODUCTION_REQUIRED_VARIABLES.filter(
      (name) => configuredValue(environment, name) === null,
    );
    if (missing.length) {
      throw new EnvironmentValidationError(
        `Missing required production variables:\n${missing.join('\n')}`,
      );
    }

    validateDatabaseUrl(environment.DATABASE_URL!);
    if (environment.JWT_SECRET!.length < 32) {
      throw new EnvironmentValidationError(
        'JWT_SECRET must be at least 32 characters in production.',
      );
    }
  }

  const frontendOrigin = validateFrontendOrigin(
    configuredValue(environment, 'FRONTEND_URL') ?? 'http://localhost:5173',
    isProduction,
  );
  const portValue = configuredValue(environment, 'PORT');
  const port = portValue === null ? 5000 : Number(portValue);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new EnvironmentValidationError(
      'PORT must be an integer between 1 and 65535.',
    );
  }

  return {
    nodeEnv,
    isProduction,
    port,
    frontendOrigin,
    trustProxy: isProduction ? 1 : false,
  };
}
