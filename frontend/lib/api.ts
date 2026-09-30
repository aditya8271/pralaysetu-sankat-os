export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8002";

export async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const targetUrls = process.env.NEXT_PUBLIC_API_URL
    ? [process.env.NEXT_PUBLIC_API_URL]
    : [
        API_BASE_URL,
        "http://127.0.0.1:8001",
        "http://127.0.0.1:8000",
        "http://localhost:8002",
        "http://localhost:8001",
      ];

  const uniqueUrls = Array.from(new Set(targetUrls));
  let lastError: any = null;

  for (let i = 0; i < uniqueUrls.length; i++) {
    const base = uniqueUrls[i];
    try {
      const response = await fetch(`${base}${endpoint}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(options?.headers || {}),
        },
      });

      if (!response.ok) {
        if (response.status === 404 && i < uniqueUrls.length - 1) {
          continue;
        }
        throw new Error(
          `API request failed: ${response.status} ${response.statusText}`
        );
      }

      return response.json();
    } catch (err) {
      lastError = err;
      if (i < uniqueUrls.length - 1) {
        continue;
      }
    }
  }

  throw lastError || new Error(`API request failed: ${endpoint}`);
}

export async function getScenarios() {
  return apiFetch("/api/scenarios");
}

export async function getAssets() {
  return apiFetch("/api/assets");
}

export async function getMissions() {
  return apiFetch("/api/missions");
}

export async function getOperationalMap() {
  return apiFetch<any>("/api/operational-map");
}

export async function getHazard() {
  return apiFetch("/api/hazard");
}

export async function getCurrentWeather() {
  return apiFetch("/api/hazard/current-weather");
}

export async function analyzeCurrentWeather() {
  return apiFetch("/api/hazard/analyze-current-weather", {
    method: "POST",
  });
}

export async function runImpactAnalysis(hazard: any) {
  return apiFetch("/api/hazard", {
    method: "POST",
    body: JSON.stringify(hazard),
  });
}

export async function getMission(missionId: string) {
  return apiFetch(`/api/missions/${missionId}`);
}

export async function acknowledgeMission(missionId: string) {
  return apiFetch(`/api/missions/${missionId}/acknowledge`, {
    method: "POST",
  });
}

export async function assignMission(missionId: string) {
  return apiFetch(`/api/missions/${missionId}/assign`, {
    method: "POST",
  });
}

export async function startMission(missionId: string) {
  return apiFetch(`/api/missions/${missionId}/start`, {
    method: "POST",
  });
}

export async function completeMission(missionId: string) {
  return apiFetch(`/api/missions/${missionId}/complete`, {
    method: "POST",
  });
}

export async function resolveMission(missionId: string) {
  return apiFetch(`/api/missions/${missionId}/resolve`, {
    method: "POST",
  });
}
