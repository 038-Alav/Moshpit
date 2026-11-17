export const env = {
  host: process.env.API_HOST ?? "0.0.0.0",
  port: Number(process.env.API_PORT ?? 3000),
  databaseUrl:
    process.env.DATABASE_URL ??
    "postgresql://moshpit:moshpit_dev@localhost:5432/moshpit",
  centrifugoUrl: process.env.CENTRIFUGO_URL ?? "http://localhost:8000",
  centrifugoApiKey:
    process.env.CENTRIFUGO_API_KEY ?? "local-dev-api-key-change-before-use",
  centrifugoTokenHmacSecretKey:
    process.env.CENTRIFUGO_TOKEN_HMAC_SECRET_KEY ?? "local-dev-token-secret-change-before-use"
} as const;
