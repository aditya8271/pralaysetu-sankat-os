const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8001";

async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(
      `API request failed: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
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
