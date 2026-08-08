export default {
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.SOCIAL_STUDIO_DB_PATH ?? "./data/social-studio.sqlite",
  },
};
