export type ComponentStatus =
  | "operational"
  | "under_maintenance"
  | "degraded_performance"
  | "partial_outage"
  | "major_outage"
  | "unknown";

export type ServiceId = "claude" | "codex";

export type ServiceComponent = {
  name: string;
  status: ComponentStatus;
};

export type ServiceReport =
  | {
      id: ServiceId;
      title: string;
      page: string;
      available: true;
      status: ComponentStatus;
      description: string;
      components: ServiceComponent[];
    }
  | {
      id: ServiceId;
      title: string;
      page: string;
      available: false;
      reason: string;
    };

export type StatusReport = {
  fetchedAt: number;
  services: ServiceReport[];
};

export const STATUS_RANK: Record<ComponentStatus, number> = {
  operational: 0,
  under_maintenance: 1,
  unknown: 1,
  degraded_performance: 2,
  partial_outage: 3,
  major_outage: 4,
};

export const STATUS_LABEL: Record<ComponentStatus, string> = {
  operational: "Operational",
  under_maintenance: "Under maintenance",
  degraded_performance: "Degraded performance",
  partial_outage: "Partial outage",
  major_outage: "Major outage",
  unknown: "Unknown",
};

const FETCH_TIMEOUT_MS = 7000;

type ServiceSource = {
  id: ServiceId;
  title: string;
  page: string;
  api: string;
  tracks: (componentName: string) => boolean;
};

const SOURCES: ServiceSource[] = [
  {
    id: "claude",
    title: "Claude",
    page: "https://status.claude.com",
    api: "https://status.claude.com/api/v2/summary.json",
    tracks: (name) => name === "Claude Code" || name.startsWith("Claude API"),
  },
  {
    id: "codex",
    title: "Codex",
    page: "https://status.openai.com",
    api: "https://status.openai.com/api/v2/summary.json",
    tracks: (name) => name.includes("Codex"),
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toComponentStatus(value: unknown): ComponentStatus {
  switch (value) {
    case "operational":
    case "under_maintenance":
    case "degraded_performance":
    case "partial_outage":
    case "major_outage":
      return value;
    default:
      return "unknown";
  }
}

function indicatorToStatus(value: unknown): ComponentStatus {
  switch (value) {
    case "none":
      return "operational";
    case "maintenance":
      return "under_maintenance";
    case "minor":
      return "degraded_performance";
    case "major":
      return "partial_outage";
    case "critical":
      return "major_outage";
    default:
      return "unknown";
  }
}

function worstOf(statuses: ComponentStatus[]): ComponentStatus {
  return statuses.reduce<ComponentStatus>(
    (worst, current) => (STATUS_RANK[current] > STATUS_RANK[worst] ? current : worst),
    "operational"
  );
}

export function worstServiceStatus(report: StatusReport): ComponentStatus {
  return worstOf(
    report.services.map((service) => (service.available ? service.status : "unknown"))
  );
}

function readComponents(
  value: unknown,
  tracks: (name: string) => boolean
): ServiceComponent[] {
  if (!isRecord(value) || !Array.isArray(value.components)) return [];

  const components: ServiceComponent[] = [];
  for (const entry of value.components) {
    if (!isRecord(entry)) continue;
    const name = entry.name;
    if (typeof name !== "string" || !tracks(name)) continue;
    components.push({ name, status: toComponentStatus(entry.status) });
  }

  return components.sort((a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status]);
}

function readPageStatus(value: unknown): { indicator: unknown; description: string } {
  if (!isRecord(value) || !isRecord(value.status)) return { indicator: null, description: "" };
  const description = value.status.description;
  return {
    indicator: value.status.indicator,
    description: typeof description === "string" ? description : "",
  };
}

async function fetchService(source: ServiceSource): Promise<ServiceReport> {
  const base = { id: source.id, title: source.title, page: source.page };

  try {
    const res = await fetch(source.api, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!res.ok) {
      return { ...base, available: false, reason: `Status page returned ${res.status}` };
    }

    const body: unknown = await res.json();
    const components = readComponents(body, source.tracks);
    const page = readPageStatus(body);

    const status =
      components.length > 0
        ? worstOf(components.map((component) => component.status))
        : indicatorToStatus(page.indicator);

    return { ...base, available: true, status, description: page.description, components };
  } catch (error) {
    const reason =
      error instanceof Error && error.name === "TimeoutError"
        ? "Status page timed out"
        : "Status page unreachable";
    return { ...base, available: false, reason };
  }
}

export async function getStatusReport(): Promise<StatusReport> {
  const services = await Promise.all(SOURCES.map(fetchService));
  return { fetchedAt: Date.now(), services };
}

function parseServiceReport(value: unknown): ServiceReport | null {
  if (!isRecord(value)) return null;

  const { id, title, page } = value;
  if (id !== "claude" && id !== "codex") return null;
  if (typeof title !== "string" || typeof page !== "string") return null;

  if (value.available === true) {
    const components: ServiceComponent[] = [];
    if (Array.isArray(value.components)) {
      for (const entry of value.components) {
        if (!isRecord(entry) || typeof entry.name !== "string") continue;
        components.push({ name: entry.name, status: toComponentStatus(entry.status) });
      }
    }
    return {
      id,
      title,
      page,
      available: true,
      status: toComponentStatus(value.status),
      description: typeof value.description === "string" ? value.description : "",
      components,
    };
  }

  return {
    id,
    title,
    page,
    available: false,
    reason: typeof value.reason === "string" ? value.reason : "Status unavailable",
  };
}

export function parseStatusReport(value: unknown): StatusReport | null {
  if (!isRecord(value)) return null;
  const { fetchedAt, services } = value;
  if (typeof fetchedAt !== "number" || !Array.isArray(services)) return null;

  const parsed: ServiceReport[] = [];
  for (const entry of services) {
    const service = parseServiceReport(entry);
    if (service) parsed.push(service);
  }

  if (parsed.length === 0) return null;
  return { fetchedAt, services: parsed };
}
