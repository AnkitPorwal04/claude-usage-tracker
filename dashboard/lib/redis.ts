import { Redis } from "@upstash/redis";

export const redis = Redis.fromEnv();

export type ModelBreakdown = {
  name: string;
  pct: number;
};

export type DailyPoint = {
  date: string;
  cost: number;
  tokens: number;
};

export type Snapshot = {
  machine: string;
  ts: number;
  account: {
    name: string | null;
    email: string | null;
    plan: string | null;
  };
  fiveHour: {
    pct: number;
    resetsAt: string | null;
  };
  week: {
    pct: number;
    resetsAt: string | null;
    byModel: ModelBreakdown[];
  };
  anomaly: {
    status: "clean" | "flag" | "baseline" | "unknown";
    message: string;
  };
  costs: {
    today: number;
    todayTokens: number;
    week: number;
    weekTokens: number;
    month: number;
    monthTokens: number;
  };
  dailyHistory: DailyPoint[];
};

const machineKey = (machine: string) => `claude:snapshot:${machine}`;
const machinesSetKey = "claude:machines";

export async function saveSnapshot(snapshot: Snapshot) {
  await redis.set(machineKey(snapshot.machine), snapshot);
  await redis.sadd(machinesSetKey, snapshot.machine);
}

export async function getAllSnapshots(): Promise<Snapshot[]> {
  const machines = await redis.smembers(machinesSetKey);
  if (!machines || machines.length === 0) return [];
  const results = await Promise.all(
    machines.map((m) => redis.get<Snapshot>(machineKey(m)))
  );
  return results.filter((s): s is Snapshot => s != null);
}
