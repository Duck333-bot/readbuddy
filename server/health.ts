import { sql } from "drizzle-orm";
import { configurationIssues } from "./config";
import { getDb } from "./db";

export type ReadinessResult = {
  statusCode: 200 | 503;
  body: { status: "ready" | "unavailable"; reason?: "configuration" | "database" };
};

type ReadinessDependencies = {
  nodeEnv?: string;
  getConfigurationIssues?: () => string[];
  getDatabase?: typeof getDb;
};

export async function readinessResult({
  nodeEnv = process.env.NODE_ENV,
  getConfigurationIssues = configurationIssues,
  getDatabase = getDb,
}: ReadinessDependencies = {}): Promise<ReadinessResult> {
  if (nodeEnv === "production" && getConfigurationIssues().length > 0) {
    return { statusCode: 503, body: { status: "unavailable", reason: "configuration" } };
  }

  try {
    const database = await getDatabase();
    if (!database) throw new Error("Database unavailable");
    await database.execute(sql`SELECT 1`);
    return { statusCode: 200, body: { status: "ready" } };
  } catch {
    return { statusCode: 503, body: { status: "unavailable", reason: "database" } };
  }
}

