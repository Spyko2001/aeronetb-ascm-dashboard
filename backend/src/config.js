export const config = {
  port: Number(process.env.PORT || 10000),
  host: process.env.HOST || (process.env.RENDER ? "0.0.0.0" : "127.0.0.1"),
  databaseUrl: process.env.DATABASE_URL || process.env.POSTGRES_URL || "",
  mongoUri: process.env.MONGODB_URI || process.env.MONGO_URI || "",
  mongoDbName: process.env.MONGODB_DB_NAME || process.env.MONGO_DB_NAME || "aeronetsystem",
  sessionSecret: process.env.SESSION_SECRET || "local-dev-only-change-me",
  autoSeed: process.env.AUTO_SEED !== "false",
  isProduction: process.env.NODE_ENV === "production"
};
