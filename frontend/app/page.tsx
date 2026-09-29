"use client";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";

import {
  getMissions,
  getHazard,
  runImpactAnalysis,
  getCurrentWeather,
  analyzeCurrentWeather,
  acknowledgeMission,
} from "../lib/api";

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  Check,
  ChevronRight,
  Clock3,
  CloudRain,
  Command,
  Database,
  Send,
  UserCheck,
  FileCheck2,
  Gauge,
  GitBranch,
  Hospital,
  House,
  Info,
  Map,
  MapPin,
  Menu,
  MessageSquare,
  Navigation,
  Radio,
  RefreshCw,
  Route,
  Satellite,
  Settings,
  ShieldCheck,
  Siren,
  Timer,
  Users,
  Wifi,
  Zap,
} from "lucide-react";

/*
 * Leaflet uses browser-only APIs such as window/document.
 * Therefore it must NOT be imported directly during
 * Next.js server rendering.
 */
const OperationalMap = dynamic(
  () => import("../components/OperationalMap"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-[#091827]">
        <span className="text-[10px] text-[#8da2bb]">
          Loading Puri operational map...
        </span>
      </div>
    ),
  }
);

type DisplayMission = {
  id: string;
  asset: string;
  title: string;
  type: string;
  risk: number;
  priority: string;
  cascade: number;
  affected: number;
  owner: string;
  deadline: string;
  status: string;
  confidence: string;
  affectedAssets: string[];
  assetName?: string;
  roadName?: string;
  highway?: string;
};

function toDisplayMission(
  mission: any,
  mode: "LIVE" | "SIMULATION" = "LIVE",
): DisplayMission {
  const risk = Math.round(mission.risk_score ?? mission.priority_score ?? 0);
  const asset = mission.road_id || mission.asset_id || mission.asset || "Unknown";
  const rawType = String(mission.mission_type || "Infrastructure").toLowerCase();
  const rawAction = String(mission.action || "Operational mission");

  let title = rawAction;
  let type = mission.mission_type || "Infrastructure";

  // DEMO missions are deliberately labelled as cyclone-impact missions so the
  // operator/judge can immediately distinguish them from current-weather LIVE work.
  if (mode === "SIMULATION") {
    if (rawType.includes("road") || String(asset).startsWith("ROAD-")) {
      title = rawAction.toLowerCase().includes("inspect")
        ? "Cyclone impact: inspect critical route"
        : `Cyclone impact: ${rawAction}`;
      type = "CYCLONE · ROAD";
    } else if (rawAction.toLowerCase().includes("blood bank")) {
      title = "Cyclone exposure: blood-bank continuity";
      type = "CYCLONE · CRITICAL ASSET";
    } else if (rawAction.toLowerCase().includes("hospital")) {
      title = "Cyclone exposure: hospital access";
      type = "CYCLONE · CRITICAL ASSET";
    } else if (rawAction.toLowerCase().includes("fuel")) {
      title = "Cyclone exposure: fuel continuity";
      type = "CYCLONE · CRITICAL ASSET";
    } else if (rawAction.toLowerCase().includes("police")) {
      title = "Cyclone exposure: emergency access";
      type = "CYCLONE · CRITICAL ASSET";
    } else {
      title = `Cyclone impact: ${rawAction}`;
      type = "CYCLONE · ASSET";
    }
  }

  return {
    id: mission.id,
    asset,
    title,
    type,
    risk,
    priority: mission.priority || (risk >= 85 ? "P0" : risk >= 60 ? "P1" : "P2"),
    cascade: Math.round(mission.cascade_score ?? 0),
    affected: mission.affected_count ?? 0,
    owner: mission.owner_role || "Unassigned",
    deadline: `${mission.deadline_minutes ?? 0} min`,
    status: mission.status || "pending",
    confidence: "—",
    affectedAssets: Array.isArray(mission.affected_assets) ? mission.affected_assets : [],
    assetName: mission.asset_name || undefined,
    roadName: mission.road_name || undefined,
    highway: mission.highway || undefined,
  };
}
export default function Home() {
  const [selected, setSelected] = useState<DisplayMission | null>(null);
  const [hazard, setHazard] = useState<any>(null);
  const [liveHazard, setLiveHazard] = useState<any>(null);
  const [simulationHazard, setSimulationHazard] = useState<any>(null);
  const [currentWeather, setCurrentWeather] = useState<any>(null);
  const [analysisMode, setAnalysisMode] = useState<"LIVE" | "SIMULATION">("LIVE");
  const [liveMissions, setLiveMissions] = useState<DisplayMission[]>([]);
const [simulationMissions, setSimulationMissions] = useState<DisplayMission[]>([]);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState("");

  const refreshCurrentWeather = useCallback(async () => {
    setWeatherLoading(true);
    try {
      const data: any = await getCurrentWeather();
      setCurrentWeather(data);
      setWeatherError(data.status === "available" || data.status === "stale" ? "" : data.error || "Live weather is unavailable.");
    } catch (error) {
      setWeatherError(error instanceof Error ? error.message : "Live weather is unavailable.");
      setCurrentWeather((existing: any) => existing ? { ...existing, status: "unavailable", freshness: "UNAVAILABLE", stale: false } : null);
    } finally {
      setWeatherLoading(false);
    }
  }, []);
  const [analysisRunning, setAnalysisRunning] = useState(false);
  const [assetCatalog, setAssetCatalog] = useState<Record<string, any>>({});

  // Load the real OSM infrastructure catalogue once so the dependency
  // graph can show actual affected asset names/types instead of only
  // a numeric "N assets" placeholder.
  useEffect(() => {
    let cancelled = false;

    async function loadAssetCatalog() {
      try {
        const response = await fetch("http://127.0.0.1:8001/api/assets");
        if (!response.ok) return;
        const data = await response.json();
        const assets = Array.isArray(data) ? data : data?.assets || [];
        const catalog: Record<string, any> = {};
        for (const asset of assets) {
          if (asset?.id) catalog[String(asset.id)] = asset;
        }
        if (!cancelled) setAssetCatalog(catalog);
      } catch {
        // Graph still renders candidate IDs if the catalogue is unavailable.
      }
    }

    void loadAssetCatalog();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist the operator's current mission/mode so returning from the
  // Field Worker view restores the same mission instead of resetting to
  // the first/default mission.
  useEffect(() => {
    try {
      const savedMode = window.localStorage.getItem("sankat-analysis-mode");
      const savedMissionId = window.localStorage.getItem("sankat-selected-mission-id");

      if (savedMode === "LIVE" || savedMode === "SIMULATION") {
        setAnalysisMode(savedMode);
      }

      async function restoreMissionState() {
        try {
          const missionsData = await getMissions();
          const missionList = Array.isArray(missionsData)
            ? missionsData
            : (missionsData as { missions?: any[] }).missions || [];

          const mode: "LIVE" | "SIMULATION" =
            savedMode === "SIMULATION" ? "SIMULATION" : "LIVE";

          const displayList = missionList.map((mission) =>
            toDisplayMission(mission, mode)
          );

          if (mode === "SIMULATION") {
            displayList.sort((a, b) => {
              const aRoad = a.type.includes("ROAD") ? 0 : 1;
              const bRoad = b.type.includes("ROAD") ? 0 : 1;
              if (aRoad !== bRoad) return aRoad - bRoad;

              const priorityRank = { P0: 0, P1: 1, P2: 2 };
              const pa = priorityRank[a.priority as keyof typeof priorityRank] ?? 3;
              const pb = priorityRank[b.priority as keyof typeof priorityRank] ?? 3;
              if (pa !== pb) return pa - pb;

              return b.risk - a.risk;
            });
          }

          if (mode === "SIMULATION") {
            setSimulationMissions(displayList);
          } else {
            setLiveMissions(displayList);
          }

          const restored =
            displayList.find((mission) => mission.id === savedMissionId) ||
            displayList[0] ||
            null;

          if (restored) {
            setSelected(restored);
            setShowDetail(true);
          }
        } catch (error) {
          console.error("Failed to restore Command Centre mission state:", error);
        }
      }

      void restoreMissionState();
    } catch (error) {
      console.error("Failed to restore Command Centre state:", error);
    }
  }, []);

  useEffect(() => {
    try {
      if (selected?.id) {
        window.localStorage.setItem("sankat-selected-mission-id", selected.id);
      }
    } catch {
      // Local persistence is optional; never break the Command Centre.
    }
  }, [selected?.id]);

  useEffect(() => {
    try {
      window.localStorage.setItem("sankat-analysis-mode", analysisMode);
    } catch {
      // Local persistence is optional; never break the Command Centre.
    }
  }, [analysisMode]);

  const replaceMissionList = useCallback(
    (missionList: any[], mode: "LIVE" | "SIMULATION") => {
      const displayList = missionList.map((mission) => toDisplayMission(mission, mode));

      if (mode === "SIMULATION") {
        displayList.sort((a, b) => {
          const aRoad = a.type.includes("ROAD") ? 0 : 1;
          const bRoad = b.type.includes("ROAD") ? 0 : 1;
          if (aRoad !== bRoad) return aRoad - bRoad;

          const priorityRank = { P0: 0, P1: 1, P2: 2 };
          const pa = priorityRank[a.priority as keyof typeof priorityRank] ?? 3;
          const pb = priorityRank[b.priority as keyof typeof priorityRank] ?? 3;
          if (pa !== pb) return pa - pb;

          return b.risk - a.risk;
        });
        setSimulationMissions(displayList);
      } else {
        setLiveMissions(displayList);
      }

      const currentSelectedId =
        selected?.id ||
        (typeof window !== "undefined"
          ? window.localStorage.getItem("sankat-selected-mission-id")
          : null);

      setSelected(
        displayList.find((mission) => mission.id === currentSelectedId) ||
          displayList[0] ||
          null
      );
    },
    [selected?.id]
  );

  const displayMissions =
    analysisMode === "LIVE" ? liveMissions : simulationMissions;

  const handleNavClick = useCallback((label: string) => {
    setActiveNav(label);

    if (label === "Overview") {
      document.getElementById("overview-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    if (label === "Impact Map") {
      document.getElementById("impact-map-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    if (label === "Dependency Graph") {
      document.getElementById("dependency-graph-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    if (label === "Missions") {
      const firstMission = displayMissions[0];
      if (firstMission) {
        setSelected(firstMission);
        setShowDetail(true);
      }
      document.getElementById("missions-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    if (label === "Field Verification") {
      const mission = selected || displayMissions[0];
      if (mission) {
        setSelected(mission);
        try {
          window.localStorage.setItem("sankat-selected-mission-id", mission.id);
          window.localStorage.setItem("sankat-analysis-mode", analysisMode);
        } catch {
          // Local persistence is optional.
        }
        window.location.href = `/field?mission=${encodeURIComponent(mission.id)}`;
      } else {
        setCommandMessage("No active mission is available for field verification.");
        setShowCommandPanel(true);
      }
      return;
    }

    if (label === "AI Command") {
      setShowSourcesPanel(false);
      setShowCommandPanel(true);
      setCommandMessage(
        analysisMode === "SIMULATION"
          ? "Simulation command centre ready. Run impact analysis, inspect a P0 mission, then send it to field verification."
          : "Live command centre ready. Current conditions do not indicate an actionable weather-triggered response."
      );
      return;
    }

    if (label === "Data Sources") {
      setShowCommandPanel(false);
      setShowSourcesPanel(true);
    }
  }, [analysisMode, displayMissions, selected]);

  const [loadingMissions, setLoadingMissions] = useState(false);
  const [apiError, setApiError] = useState(false);
  const [analysisError, setAnalysisError] = useState("");

  const totalMissions = displayMissions.length;
  const p0Missions = displayMissions.filter((m) => m.priority === "P0").length;
  const p1Missions = displayMissions.filter((m) => m.priority === "P1").length;

  const openMissions = displayMissions.filter(
    (m) => !["resolved", "closed"].includes(String(m.status || "").toLowerCase())
  ).length;

  const awaitingAck = displayMissions.filter(
    (m) => ["pending", "assigned"].includes(String(m.status || "").toLowerCase())
  ).length;

  const acknowledgedMissions = displayMissions.filter(
    (m) => !["pending", "assigned"].includes(String(m.status || "").toLowerCase())
  ).length;

  const acknowledgementRate =
    totalMissions > 0
      ? Math.round((acknowledgedMissions / totalMissions) * 100)
      : 0;

  const exposedAssets = new Set(
    displayMissions
      .map((mission) => mission.asset)
      .filter((asset) => asset !== "Unknown")
  ).size;

  const cascadeAssets = selected?.affectedAssets
    ?.map((id) => assetCatalog[id] || { id, name: id, type: "infrastructure" })
    .slice(0, 4) || [];

useEffect(() => {
  async function loadHazard() {
    try {
      const data = await getHazard();
      setSimulationHazard(data);
      // LIVE mode must not inherit the simulation hazard.
      if (analysisMode === "SIMULATION") {
        setHazard(data);
      }
    } catch (error) {
      console.error("Failed to load simulation hazard:", error);
    }
  }

  loadHazard();
  // The simulation hazard is loaded once as the controlled demo dataset.
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

useEffect(() => {
  void refreshCurrentWeather();
}, [refreshCurrentWeather]);
  const [activeNav, setActiveNav] = useState("Overview");
  const [commandMessage, setCommandMessage] = useState("");
  const [showCommandPanel, setShowCommandPanel] = useState(false);
  const [showSourcesPanel, setShowSourcesPanel] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [reassessed, setReassessed] = useState(false);
  const [showDetail, setShowDetail] = useState(true);
  const [dispatchTeam, setDispatchTeam] = useState("PWD Coastal Response Team");
  const [dispatchWorker, setDispatchWorker] = useState("Field Worker 07");
  const [notifyTeam, setNotifyTeam] = useState(true);
  const [dispatchLoading, setDispatchLoading] = useState(false);
  const [dispatchState, setDispatchState] = useState<any>(null);
  const [dispatchError, setDispatchError] = useState("");

  const dispatchSelectedMission = async () => {
    if (!selected?.id) return;

    try {
      setDispatchLoading(true);
      setDispatchError("");

      // First move the mission into the backend's assigned state.
      const assignResponse = await fetch(
        `http://127.0.0.1:8001/api/missions/${encodeURIComponent(selected.id)}/assign`,
        { method: "POST" },
      );

      if (!assignResponse.ok) {
        const body = await assignResponse.text();
        throw new Error(body || `Mission assignment failed (${assignResponse.status})`);
      }

      // Then register the departmental/field-worker handoff.
      const dispatchResponse = await fetch(
        `http://127.0.0.1:8001/api/dispatch/${encodeURIComponent(selected.id)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            team: dispatchTeam,
            worker_name: dispatchWorker,
            notify_team: notifyTeam,
          }),
        },
      );

      const dispatchData = await dispatchResponse.json().catch(() => ({}));
      if (!dispatchResponse.ok) {
        throw new Error(dispatchData?.detail || `Dispatch failed (${dispatchResponse.status})`);
      }

      setDispatchState(dispatchData.dispatch);

      // Refresh the mission list so the command centre immediately reflects assignment.
      const missionsData = await getMissions();
      const missionList = Array.isArray(missionsData)
        ? missionsData
        : (missionsData as { missions?: any[] }).missions || [];
      replaceMissionList(missionList, analysisMode);
    } catch (error) {
      setDispatchError(error instanceof Error ? error.message : "Mission dispatch failed.");
    } finally {
      setDispatchLoading(false);
    }
  };

  useEffect(() => {
    // Keep the command centre connected to the backend dispatch registry.
    // This restores the dispatch card when the same mission is re-opened.
    let cancelled = false;

    async function loadDispatchState() {
      setDispatchState(null);
      setDispatchError("");
      if (!selected?.id) return;

      try {
        const response = await fetch(
          `http://127.0.0.1:8001/api/dispatch/${encodeURIComponent(selected.id)}`
        );
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) setDispatchState(data?.dispatch || null);
      } catch {
        // Dispatch is an optional command-centre layer; do not break the mission UI.
      }
    }

    void loadDispatchState();
    return () => {
      cancelled = true;
    };
  }, [selected?.id]);

  const acknowledge = async () => {
    if (!selected?.id) return;

    try {
      await acknowledgeMission(selected.id);
      setAcknowledged(true);

      const data = await getMissions();
      const missionList = Array.isArray(data)
        ? data
        : (data as { missions?: any[] }).missions || [];

      replaceMissionList(missionList, analysisMode);
    } catch (error) {
      console.error("Failed to acknowledge mission:", error);
    }
  };
  const runAnalysis = async () => {
  try {
    setAnalysisMode("SIMULATION");
    setAnalysisRunning(true);
    setAnalysisError("");

    let demoHazard = simulationHazard;
    if (!demoHazard?.hazard) {
      demoHazard = await getHazard();
      setSimulationHazard(demoHazard);
    }

    if (!demoHazard?.hazard) {
      throw new Error("Controlled simulation dataset is unavailable.");
    }

    setHazard(demoHazard);
    const result = await runImpactAnalysis(demoHazard.hazard);

    setSimulationHazard(result);
    setHazard(result);

    const missionsResult = (
      result as
        | { missions?: any[] }
        | null
        | undefined
    )?.missions;
    const missionList = Array.isArray(missionsResult)
      ? missionsResult
      : (missionsResult as { missions?: any[] } | undefined)
          ?.missions || [];

    replaceMissionList(missionList, "SIMULATION");
  } catch (error) {
    setAnalysisError(error instanceof Error ? error.message : "Impact analysis failed.");
    console.error("Impact analysis failed:", error);
  } finally {
    setAnalysisRunning(false);
  }
};

  const isActionableLiveWeather = (weather: any) => {
    if (!weather || weather.status !== "available") return false;

    const wind = Number(weather.wind_speed_kmh ?? 0);
    const precipitation = Number(weather.precipitation_mm ?? 0);
    const weatherStatus = String(weather.weather_status ?? "").toLowerCase();
    const warningStatus = String(weather.warning_status ?? "").toLowerCase();

    const hasProviderWarning =
      warningStatus &&
      !warningStatus.includes("no provider warning") &&
      !warningStatus.includes("none") &&
      !warningStatus.includes("no warning");

    const severeWeather =
      weatherStatus.includes("thunder") ||
      weatherStatus.includes("storm") ||
      weatherStatus.includes("heavy rain") ||
      weatherStatus.includes("heavy shower");

    return hasProviderWarning || severeWeather || wind >= 60 || precipitation >= 50;
  };

  const runLiveWeatherAnalysis = async () => {
    try {
      setAnalysisMode("LIVE");
      setAnalysisRunning(true);
      setAnalysisError("");
      setWeatherError("");

      const result: any = await analyzeCurrentWeather();
      const liveWeather = result?.weather;
      setLiveHazard(result);
      setHazard(result);
      setCurrentWeather(liveWeather);

      // LIVE mode is intentionally independent from the cyclone demo.
      // Under normal current conditions, do not show simulated/generated missions.
      const actionable = isActionableLiveWeather(liveWeather);
      const missionList = actionable ? (result?.missions?.missions || []) : [];

      replaceMissionList(missionList, "LIVE");
      setApiError(false);
      setLoadingMissions(false);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Live weather analysis failed.";
      setAnalysisError(detail);
    } finally {
      setAnalysisRunning(false);
    }
  };

  const reassess = async () => {
    if (analysisMode === "LIVE") {
      try {
        setReassessed(true);
        setAnalysisRunning(true);
        setAnalysisError("");
        setWeatherError("");

        const result: any = await analyzeCurrentWeather();
        const liveWeather = result?.weather;
        setLiveHazard(result);
        setHazard(result);
        setCurrentWeather(liveWeather);
        const missionList = isActionableLiveWeather(liveWeather)
          ? (result?.missions?.missions || [])
          : [];
        replaceMissionList(missionList, "LIVE");
        setApiError(false);
        setLoadingMissions(false);
      } catch (error) {
        setAnalysisError(error instanceof Error ? error.message : "Live reassessment failed.");
        console.error("Live reassessment failed:", error);
      } finally {
        setAnalysisRunning(false);
      }
      return;
    }

    try {
      setReassessed(true);
      setAnalysisRunning(true);
      setAnalysisError("");

      let demoHazard = simulationHazard;
      if (!demoHazard?.hazard) {
        demoHazard = await getHazard();
        setSimulationHazard(demoHazard);
      }

      if (!demoHazard?.hazard) {
        throw new Error("Controlled simulation dataset is unavailable.");
      }

      const result = await runImpactAnalysis(demoHazard.hazard);
      setSimulationHazard(result);
      setHazard(result);

      const missionsResult = (
        result as
          | { missions?: any[] }
          | null
          | undefined
      )?.missions;
      const missionList = Array.isArray(missionsResult)
        ? missionsResult
        : (missionsResult as { missions?: any[] } | undefined)
            ?.missions || [];

      replaceMissionList(missionList, "SIMULATION");
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : "Reassessment failed.");
      console.error("Reassessment failed:", error);
    } finally {
      setAnalysisRunning(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#07111f] text-[#f4f7fb]">
      {/* HEADER */}
      <header className="sticky top-0 z-[1200] border-b border-[#20344d] bg-[#07111f]/95 backdrop-blur-xl">
        <div className="flex h-[72px] items-center justify-between px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#ff3b4e]/30 bg-[#ff3b4e]/10">
              <Siren size={21} className="text-[#ff3b4e]" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-[17px] font-bold tracking-[0.08em]">
                  SANKAT OS
                </h1>
                <span className="hidden rounded border border-[#42a5ff]/20 bg-[#42a5ff]/5 px-2 py-0.5 text-[9px] font-medium tracking-wider text-[#42a5ff] sm:block">
                  POWERED BY PRALAYSETU
                </span>
              </div>
              <p className="truncate text-[11px] text-[#8da2bb]">
                Disaster Operations Command Centre
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-8 lg:flex">
            <div>
              <p className="text-[9px] uppercase tracking-[0.18em] text-[#8da2bb]">
                Active event
              </p>
              <p className="mt-0.5 text-sm font-semibold">
  {hazard?.hazard?.hazard_type
    ? hazard.hazard.hazard_type.toUpperCase()
    : "—"}
</p>
            </div>

            <div>
              <p className="text-[9px] uppercase tracking-[0.18em] text-[#8da2bb]">
                Location
              </p>
              <p className="mt-0.5 text-sm font-semibold">
  {hazard?.hazard?.area ?? "—"}
</p>
            </div>

            <div className="border-l border-[#20344d] pl-8">
              <p className="text-[9px] uppercase tracking-[0.18em] text-[#8da2bb]">
                {analysisMode === "LIVE" ? "Weather status" : "Time to impact"}
              </p>
              <p className="mt-0.5 font-mono text-sm font-bold text-[#ffad32]">
                {analysisMode === "LIVE" ? "CURRENT CONDITIONS" : "T-06:00"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-lg border border-[#20344d] bg-[#0c1a2b] px-3 py-2 sm:flex">
              <span className="h-2 w-2 rounded-full bg-[#24d18a] shadow-[0_0_8px_#24d18a]" />
              <span className="text-[10px] text-[#8da2bb]">CONNECTED</span>
            </div>

            <div className="rounded-lg border border-[#ff3b4e]/30 bg-[#ff3b4e]/10 px-3 py-2">
              <span className="text-[10px] font-bold tracking-wider text-[#ff3b4e]">
  {hazard?.hazard?.alert_level
    ? `${hazard.hazard.alert_level.toUpperCase()} ALERT`
    : analysisMode === "LIVE"
      ? "NO PROVIDER WARNING"
      : "SIMULATION ALERT"}
</span>
            </div>

            <button
              onClick={() => {
                setShowSourcesPanel(false);
                setCommandMessage(
                  "System status: backend connected. LIVE uses Open-Meteo model-based conditions; DEMO uses the controlled Puri cyclone dataset. All simulated outputs remain labelled."
                );
                setShowCommandPanel(true);
              }}
              aria-label="Open system status"
              className="hidden rounded-lg border border-[#20344d] bg-[#0c1a2b] p-2.5 text-[#8da2bb] hover:text-white md:block"
            >
              <Settings size={16} />
            </button>

            <button
              onClick={() => setShowCommandPanel(true)}
              aria-label="Open command centre"
              className="rounded-lg border border-[#20344d] bg-[#0c1a2b] p-2.5 text-[#8da2bb] hover:text-white md:hidden"
            >
              <Menu size={17} />
            </button>
          </div>
        </div>

        <div className="h-[2px] bg-gradient-to-r from-[#42a5ff] via-[#ffad32] to-[#ff3b4e]" />

        <div className="hidden h-7 items-center gap-2 border-b border-[#20344d] px-5 text-[9px] uppercase tracking-[0.16em] text-[#8da2bb] md:flex">
          <span className="text-[#42a5ff]">Forecast</span>
          <ChevronRight size={11} />
          <span className="text-[#42a5ff]">Impact</span>
          <ChevronRight size={11} />
          <span className="text-[#ffad32]">Priority</span>
          <ChevronRight size={11} />
          <span>Mission</span>
          <ChevronRight size={11} />
          <span>Field Action</span>
          <ChevronRight size={11} />
          <span>Verification</span>
          <ChevronRight size={11} />
          <span>Reassessment</span>
        </div>
      </header>

      {/* APPLICATION SHELL */}
      <div className="flex min-h-[calc(100vh-102px)]">
        {/* LEFT NAV */}
        <aside className="hidden w-[190px] shrink-0 border-r border-[#20344d] bg-[#091624] p-3 lg:block">
          <p className="px-3 pb-3 pt-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#526a83]">
            Operations
          </p>

          <nav className="space-y-1">
            {[
              { label: "Overview", icon: Command },
              { label: "Impact Map", icon: Map },
              { label: "Dependency Graph", icon: GitBranch },
              { label: "Missions", icon: Radio },
              { label: "Field Verification", icon: FileCheck2 },
              { label: "AI Command", icon: Bot },
              { label: "Data Sources", icon: Database },
            ].map((item) => {
              const Icon = item.icon;
              const active = activeNav === item.label;

              return (
                <button
                  key={item.label}
                  onClick={() => handleNavClick(item.label)}
                  className={`flex w-full items-center gap-3 rounded-lg border-l-2 px-3 py-2.5 text-left text-xs transition ${
                    active
                      ? "border-[#42a5ff] bg-[#42a5ff]/10 text-white"
                      : "border-transparent text-[#8da2bb] hover:bg-white/[0.03] hover:text-white"
                  }`}
                >
                  <Icon size={15} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto pt-8">
            <div className="rounded-xl border border-[#20344d] bg-[#0c1a2b] p-3">
              <div className="mb-2 flex items-center gap-2">
                <Activity size={13} className="text-[#ffad32]" />
                <span className="text-[10px] font-semibold">
                  {analysisMode === "LIVE" ? "LIVE ANALYSIS" : "SIMULATION MODE"}
                </span>
              </div>

              <p className="text-[9px] leading-4 text-[#8da2bb]">
                {analysisMode === "LIVE"
                  ? "Public geography + live model-based weather conditions + infrastructure impact analysis."
                  : "Public geography + realistic infrastructure data + controlled simulated operational event."}
              </p>
            </div>

            <div className="mt-3 flex items-center gap-2 px-2 text-[9px] text-[#526a83]">
              <Info size={12} />
              Demo environment
            </div>
          </div>
        </aside>

        {/* CENTRE */}
        <section className="min-w-0 flex-1 p-3 md:p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#20344d] bg-[#091827] p-3">
            <div>
              <p className="text-[9px] uppercase tracking-[0.16em] text-[#526a83]">Analysis mode</p>
              <p className="mt-1 text-[10px] text-[#8da2bb]">
                Live conditions and controlled simulation use separate mission results.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setAnalysisMode("LIVE");
                  setHazard(liveHazard || null);
                  setSelected(liveMissions[0] || null);
                  setShowDetail(Boolean(liveMissions[0]));
                  setShowCommandPanel(false);
                  setShowSourcesPanel(false);
                }}
                className={`rounded-lg border px-3 py-2 text-[9px] font-bold transition ${
                  analysisMode === "LIVE"
                    ? "border-[#24d18a]/40 bg-[#24d18a]/10 text-[#24d18a]"
                    : "border-[#20344d] bg-[#0c1a2b] text-[#8da2bb] hover:text-white"
                }`}
              >
                LIVE ANALYSIS
              </button>
              <button
                onClick={() => {
                  setAnalysisMode("SIMULATION");
                  setHazard(simulationHazard || null);
                  setSelected(simulationMissions[0] || null);
                  setShowDetail(Boolean(simulationMissions[0]));
                  setShowCommandPanel(false);
                  setShowSourcesPanel(false);
                }}
                className={`rounded-lg border px-3 py-2 text-[9px] font-bold transition ${
                  analysisMode === "SIMULATION"
                    ? "border-[#ffad32]/40 bg-[#ffad32]/10 text-[#ffad32]"
                    : "border-[#20344d] bg-[#0c1a2b] text-[#8da2bb] hover:text-white"
                }`}
              >
                DEMO SIMULATION
              </button>
            </div>
          </div>

          <section className="mb-3 rounded-xl border border-[#20344d] bg-[#091827] p-4" aria-live="polite">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <CloudRain size={15} className="text-[#42a5ff]" />
                  <h2 className="text-[11px] font-bold tracking-[0.14em]">CURRENT CONDITIONS · PURI, ODISHA</h2>
                  <span className={`rounded border px-2 py-0.5 text-[8px] font-bold ${currentWeather?.status === "available" ? "border-[#24d18a]/30 bg-[#24d18a]/10 text-[#24d18a]" : currentWeather?.status === "stale" ? "border-[#ffad32]/30 bg-[#ffad32]/10 text-[#ffad32]" : "border-[#ff3b4e]/30 bg-[#ff3b4e]/10 text-[#ff7b88]"}`}>
                    {weatherLoading ? "FETCHING" : currentWeather?.status === "available" ? "LIVE" : currentWeather?.status === "stale" ? "STALE" : "LIVE DATA UNAVAILABLE"}
                  </span>
                </div>
                {weatherError && <p className="mt-2 text-[9px] text-[#ff7b88]">{weatherError}. The current simulation remains available for demo.</p>}
                <p className="mt-2 max-w-3xl text-[9px] leading-4 text-[#8da2bb]">
                  LIVE WEATHER · Open-Meteo model-based current conditions · {analysisMode === "LIVE" ? "active operational assessment" : "reference conditions while demo simulation is active"}
                </p>
                {!weatherError && currentWeather?.message && <p className="mt-1 max-w-3xl text-[9px] leading-4 text-[#8da2bb]">{currentWeather.message}</p>}
              </div>
              <button onClick={refreshCurrentWeather} disabled={weatherLoading || analysisRunning} className="rounded-lg border border-[#20344d] px-3 py-2 text-[9px] font-semibold text-[#c6d2df] disabled:opacity-50">
                {weatherLoading ? "Refreshing…" : "Refresh weather"}
              </button>
              <button onClick={runLiveWeatherAnalysis} disabled={analysisRunning || weatherLoading || currentWeather?.status !== "available"} className="rounded-lg bg-[#42a5ff] px-3 py-2 text-[9px] font-bold text-[#06111e] disabled:cursor-not-allowed disabled:bg-[#36516c]">
                {analysisRunning ? "Fetching & analyzing…" : "ANALYZE CURRENT CONDITIONS"}
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <WeatherMetric label="Temperature" value={currentWeather?.temperature_c == null ? "Unavailable" : `${currentWeather.temperature_c} °C`} />
              <WeatherMetric label="Precipitation" value={currentWeather?.precipitation_mm == null ? "Unavailable" : `${currentWeather.precipitation_mm} mm`} />
              <WeatherMetric label="Wind" value={currentWeather?.wind_speed_kmh == null ? "Unavailable" : `${currentWeather.wind_speed_kmh} km/h`} />
              <WeatherMetric label="Wind direction" value={currentWeather?.wind_direction_degrees == null ? "Unavailable" : `${currentWeather.wind_direction_degrees}°`} />
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[8px] text-[#8da2bb]">
              <span>Provider: {currentWeather?.provider || "Open-Meteo"}</span>
              <span>Weather: {currentWeather?.weather_status || "Unavailable"}</span>
              <span>Warning: {currentWeather?.warning_status || "No provider warning feed"}</span>
              <span>Fetched: {currentWeather?.fetched_at ? new Date(currentWeather.fetched_at).toLocaleString() : "Not fetched"}</span>
              <span>Provider time: {currentWeather?.provider_time ? new Date(currentWeather.provider_time).toLocaleString() : "Unavailable"}</span>
            </div>
            {currentWeather?.status === "stale" && <p className="mt-2 text-[9px] text-[#ffad32]">Provider data is stale; live analysis is disabled. Run the simulation for the demo.</p>}
            {analysisError && <p role="alert" className="mt-2 text-[9px] text-[#ff7b88]">Analysis failed: {analysisError}</p>}
          </section>
          {/* INCIDENT CANVAS HEADER */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[15px] font-semibold">
                  Operational Impact Canvas
                </h2>
                <span className={`rounded border px-2 py-0.5 text-[8px] font-bold ${analysisMode === "LIVE" ? "border-[#24d18a]/20 bg-[#24d18a]/10 text-[#24d18a]" : "border-[#ffad32]/20 bg-[#ffad32]/10 text-[#ffad32]"}`}>
                  {analysisMode}
                </span>
              </div>

              <p className="mt-1 text-[10px] text-[#8da2bb]">
                Infrastructure exposure and cascading dependency intelligence
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={reassess}
                className="flex items-center gap-2 rounded-lg border border-[#20344d] bg-[#0c1a2b] px-3 py-2 text-[10px] font-medium text-[#c6d2df] transition hover:border-[#42a5ff]/40 hover:bg-[#42a5ff]/5"
              >
                <RefreshCw size={13} className={reassessed ? "animate-spin" : ""} />
                Reassess
              </button>

              {analysisMode === "SIMULATION" && (
                <button
                  onClick={runAnalysis}
                  disabled={analysisRunning || !hazard?.hazard}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[10px] font-bold text-[#06111e] transition ${
                    analysisRunning || !hazard?.hazard
                      ? "cursor-not-allowed bg-[#36516c]"
                      : "bg-[#42a5ff] hover:bg-[#64b4ff]"
                  }`}
                >
                  <Gauge
                    size={13}
                    className={analysisRunning ? "animate-spin" : ""}
                  />
                  {analysisRunning ? "Running Analysis..." : "Run Impact Analysis"}
                </button>
              )}
            </div>
          </div>

          {/* MAP */}
          <div id="impact-map-section" className="relative isolate overflow-hidden rounded-xl border border-[#20344d] bg-[#091827] shadow-2xl">
            {/* Map toolbar */}
            <div className="pointer-events-none absolute left-3 right-3 top-3 z-20 flex items-start justify-between">
              <div className="rounded-lg border border-[#20344d] bg-[#091827]/90 px-3 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.28)] backdrop-blur">
                <div className="flex items-center gap-2">
                  <Satellite size={13} className="text-[#42a5ff]" />
                  <span className="text-[10px] font-semibold">
                    PURI OPERATIONAL MAP
                  </span>
                </div>
                <p className="mt-1 text-[8px] text-[#8da2bb]">
                  OSM infrastructure · hazard overlay · dependency intelligence
                </p>
              </div>

              <div className="flex gap-1.5 rounded-lg border border-[#20344d] bg-[#091827]/90 p-1 backdrop-blur">
                <LegendDot color="#ff3b4e" label="P0" />
                <LegendDot color="#ffad32" label="P1" />
                <LegendDot color="#24d18a" label="P2" />
              </div>
            </div>

            {/* MAP BACKGROUND */}
            {analysisMode === "SIMULATION" && (
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#ffad32]/25 bg-[#ffad32]/[0.05] px-3 py-2">
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#ffad32]">
                    CONTROLLED CYCLONE DATASET
                  </span>
                  <span className="ml-3 text-[9px] text-[#c6d2df]">
                    140 km/h wind · 220 mm rainfall · RED simulation
                  </span>
                </div>
                <span className="text-[8px] text-[#8da2bb]">Not a live government warning</span>
              </div>
            )}

            {/* REAL PURI OPERATIONAL MAP */}
<div className="relative h-[430px] overflow-hidden">
  <OperationalMap
  missions={displayMissions}
  selectedMissionId={selected?.id}
  onMissionSelect={(assetId) => {
    const mission = displayMissions.find(
      (m) =>
        m.asset === assetId ||
        m.asset === `ROAD-${assetId}`
    );

    if (mission) {
      setSelected(mission);
      setShowDetail(true);
    }
  }}
/>

  {/* Map status */}
  <div className="pointer-events-none absolute bottom-3 right-3 z-[1000] flex flex-wrap gap-2">
    <StatusChip
      icon={<AlertTriangle size={11} />}
      text={`${exposedAssets} exposed assets`}
    />

    <StatusChip
      icon={<Siren size={11} />}
      text={`${p0Missions} P0 missions`}
      danger
    />
  </div>
</div>

            {/* MAP LEGEND */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#20344d] bg-[#0c1a2b] px-4 py-2.5">
              <SmallLegend color="#ff3b4e" text="P0 Critical" />
              <SmallLegend color="#ffad32" text="P1 High" />
              <SmallLegend color="#24d18a" text="P2 Monitor" />
              <SmallLegend color="#42a5ff" text="Selected asset" />
              <span className="ml-auto hidden text-[8px] text-[#526a83] sm:block">
                SOURCE: OSM GEOGRAPHY + {analysisMode === "LIVE" ? "OPEN-METEO WEATHER" : "SIMULATED EVENT"} - NOT LIVE GOVERNMENT DATA
              </span>
            </div>
          </div>

          {/* OPERATIONAL STRIP */}
          <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[#20344d] bg-[#20344d] sm:grid-cols-3 xl:grid-cols-7">
            <Stat label="Total missions" value={String(totalMissions)} />
            <Stat
  label="Assets exposed"
  value={String(exposedAssets)}
/>

<Stat
  label="P0 critical"
  value={String(p0Missions)}
  danger
/>

<Stat
  label="P1 high"
  value={String(p1Missions)}
  warning
/>

<Stat
  label="Open missions"
  value={String(openMissions)}
/>

<Stat
  label="Awaiting ack"
  value={String(awaitingAck)}
  warning
/>

<Stat
  label="Acknowledgement"
  value={`${acknowledgementRate}%`}
/>
          </div>

          {/* CASCADE */}
          <div id="dependency-graph-section" className="mt-3 rounded-xl border border-[#20344d] bg-[#0c1a2b]">
            <div className="flex items-center justify-between border-b border-[#20344d] px-4 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <GitBranch size={14} className="text-[#42a5ff]" />
                  <h3 className="text-[12px] font-semibold">
                    Dependency Cascade
                  </h3>
                </div>
                <p className="mt-1 text-[9px] text-[#8da2bb]">
                  Selected route and downstream infrastructure impact
                </p>
              </div>

              <button
                onClick={() => {
                  setActiveNav("Dependency Graph");
                  setCommandMessage(
                    analysisMode === "SIMULATION"
                      ? "Dependency failure simulation queued: R17 → PHC P04 → S03 → V03."
                      : "Switch to DEMO SIMULATION to run a controlled dependency-failure scenario."
                  );
                  setShowCommandPanel(true);
                }}
                className="rounded-md border border-[#20344d] px-2.5 py-1.5 text-[9px] text-[#8da2bb] hover:border-[#42a5ff]/40 hover:text-white"
              >
                Simulate failure
              </button>
            </div>

            {analysisMode === "SIMULATION" && selected ? (
              <div className="p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#ff3b4e] shadow-[0_0_8px_#ff3b4e]" />
                    <span className="text-[8px] font-semibold uppercase tracking-[0.14em] text-[#c6d2df]">
                      Dependency chain · live selection
                    </span>
                  </div>
                  <span className="rounded border border-[#20344d] bg-[#091624] px-2 py-1 text-[7px] uppercase tracking-wider text-[#526a83]">
                    Spatial inference
                  </span>
                </div>

                <div className="overflow-x-auto pb-1">
                  <div className="flex min-w-max items-center gap-2">
                    <CascadeNode
                      title={selected.asset}
                      sub={selected.roadName || selected.highway || "Selected infrastructure"}
                      danger={selected.priority === "P0"}
                      warning={selected.priority === "P1"}
                      animated
                    />

                    <CascadeFlow />

                    <div className="flex items-center gap-2">
                      {cascadeAssets.length > 0 ? (
                        cascadeAssets.map((asset, index) => (
                          <span key={`${selected.id}-${asset.id}`} className="flex items-center gap-2">
                            {index > 0 && <CascadeBranch />}
                            <CascadeAssetNode
                              id={String(asset.id)}
                              name={String(asset.name || asset.asset_name || asset.id)}
                              type={String(asset.type || asset.asset_type || "infrastructure")}
                              catalog={assetCatalog}
                              animated
                            />
                          </span>
                        ))
                      ) : (
                        <CascadeNode
                          title={`${selected.affected} affected assets`}
                          sub="Candidate downstream exposure"
                          danger={selected.cascade >= 85}
                          warning={selected.cascade >= 60 && selected.cascade < 85}
                          animated
                        />
                      )}
                    </div>

                    <CascadeFlow />

                    <CascadeNode
                      title="Response mission"
                      sub={`${selected.priority} · ${selected.risk} risk`}
                      warning={selected.priority === "P1"}
                      danger={selected.priority === "P0"}
                      animated
                    />

                    <CascadeFlow />

                    <CascadeNode
                      title="Field verification"
                      sub="Evidence + reassessment"
                      animated
                    />
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-[8px] text-[#526a83]">
                  <span className="rounded border border-[#20344d] bg-[#091624] px-2 py-1">
                    {selected.affectedAssets.length || selected.affected} downstream asset{(selected.affectedAssets.length || selected.affected) === 1 ? "" : "s"}
                  </span>
                  <span>·</span>
                  <span>Relationships are candidate spatial dependencies, not confirmed causal links.</span>
                </div>
              </div>
            ) : (
              <div className="p-4">
                <div className="rounded-lg border border-[#20344d] bg-[#091624] p-3">
                  <p className="text-[9px] font-semibold text-[#c6d2df]">NO ACTIVE CASCADE</p>
                  <p className="mt-1 text-[8px] leading-4 text-[#526a83]">
                    Current LIVE conditions are not producing an actionable weather-triggered mission. Candidate dependencies are shown only after the controlled simulation is run.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* TIMELINE */}
          <div className="mt-3 rounded-xl border border-[#20344d] bg-[#0c1a2b] p-4">
            <div className="mb-4 flex items-center gap-2">
              <Clock3 size={14} className="text-[#42a5ff]" />
              <h3 className="text-[12px] font-semibold">
                Operational Timeline
              </h3>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <TimelineItem label="Forecast / hazard input" done={Boolean(hazard)} current={!hazard} />
              <TimelineItem label="Impact analysis" done={totalMissions > 0} current={Boolean(hazard) && totalMissions === 0} />
              <TimelineItem label="Priority identified" done={p0Missions > 0 || p1Missions > 0} current={totalMissions > 0 && p0Missions === 0 && p1Missions === 0} />
              <TimelineItem label="Mission generated" done={Boolean(selected)} current={!selected && totalMissions > 0} />
              <TimelineItem
                label={
                  selected && !["pending", "assigned"].includes(String(selected.status || "").toLowerCase())
                    ? "Field acknowledgement received"
                    : dispatchState
                      ? "Awaiting field acknowledgement"
                      : "Awaiting dispatch"
                }
                done={Boolean(selected && !["pending", "assigned"].includes(String(selected.status || "").toLowerCase()))}
                current={Boolean(selected && (dispatchState || ["pending", "assigned"].includes(String(selected.status || "").toLowerCase())))}
              />
            </div>
          </div>
        </section>

        {/* RIGHT MISSION PANEL */}
        <aside id="missions-section" className="hidden w-[390px] shrink-0 border-l border-[#20344d] bg-[#091624] xl:block">
          <div className="sticky top-[102px] h-[calc(100vh-102px)] overflow-y-auto">
            <div className="border-b border-[#20344d] px-4 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[14px] font-semibold">
                    {analysisMode === "SIMULATION" ? "Simulation Missions" : "Priority Missions"}
                  </h2>
                  <p className="mt-1 text-[9px] text-[#8da2bb]">
                    {analysisMode === "SIMULATION"
                      ? "Cyclone dataset · impact + cascade response queue"
                      : "AI-assisted operational queue"}
                  </p>
                </div>

                <div className="rounded-md border border-[#ff3b4e]/20 bg-[#ff3b4e]/10 px-2.5 py-1.5">
                  <span className="text-[10px] font-bold text-[#ff3b4e]">
                    {p0Missions} P0
                  </span>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <span className="text-[9px] text-[#8da2bb]">
                  Acknowledgement rate
                </span>
                <span className="font-mono text-[10px] font-bold">
                  {acknowledgementRate}%
                </span>
              </div>

              <div className="mt-1 h-1 overflow-hidden rounded-full bg-[#20344d]">
                <div
                  className="h-full bg-[#42a5ff] transition-all"
                  style={{ width: `${acknowledgementRate}%` }}
                />
              </div>
            </div>

            <div className="space-y-2 p-3">
              {loadingMissions && <p className="rounded-lg border border-[#20344d] p-3 text-[10px] text-[#8da2bb]">Loading missions…</p>}
              {apiError && !loadingMissions && <p role="alert" className="rounded-lg border border-[#ff3b4e]/30 p-3 text-[10px] text-[#ff7b88]">Mission queue unavailable. Check the backend connection.</p>}
              {!loadingMissions && !apiError && displayMissions.length === 0 && (
                analysisMode === "LIVE" ? (
                  <div className="rounded-lg border border-[#24d18a]/20 bg-[#24d18a]/[0.04] p-4">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[#24d18a]/30 bg-[#24d18a]/10 text-[#24d18a]">✓</span>
                      <span className="text-[10px] font-bold text-[#24d18a]">NORMAL OPERATIONS</span>
                    </div>
                    <p className="mt-2 text-[10px] font-medium text-[#c6d2df]">No weather-triggered missions detected.</p>
                    <p className="mt-1 text-[9px] leading-4 text-[#8da2bb]">Current conditions do not meet the operational trigger threshold. Continue monitoring.</p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-[#ffad32]/20 bg-[#ffad32]/[0.04] p-4">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-[#ffad32]">SIMULATION READY</span>
                    </div>
                    <p className="mt-2 text-[10px] font-medium text-[#c6d2df]">No cyclone missions generated yet.</p>
                    <p className="mt-1 text-[9px] leading-4 text-[#8da2bb]">Run Impact Analysis to apply the 140 km/h · 220 mm controlled cyclone dataset.</p>
                  </div>
                )
              )}
              {displayMissions.map((mission) => (
                <button
                  key={mission.id}
                  onClick={() => {
                    setSelected(mission);
                    setShowDetail(true);
                    try {
                      window.localStorage.setItem(
                        "sankat-selected-mission-id",
                        mission.id
                      );
                    } catch {
                      // Local persistence is optional.
                    }
                  }}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    selected?.id === mission.id
                      ? "border-[#42a5ff]/60 bg-[#42a5ff]/[0.07] shadow-[0_0_24px_rgba(66,165,255,0.08)] sankat-selected"
                      : "border-[#20344d] bg-[#0c1a2b] hover:border-[#36516c] hover:bg-[#102033]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`rounded px-1.5 py-0.5 text-[8px] font-black ${
                          mission.priority === "P0"
                            ? "bg-[#ff3b4e] text-white shadow-[0_0_10px_rgba(255,59,78,0.28)]"
                            : mission.priority === "P1"
                              ? "bg-[#ffad32] text-[#08111c]"
                              : "bg-[#24d18a] text-[#06111e]"
                        }`}>
                          {mission.priority}
                        </span>

                        <MissionIcon type={mission.type} />

                        <span className="text-[9px] text-[#8da2bb]">
                          {mission.type}
                        </span>
                      </div>

                      <p className="mt-2 truncate text-[11px] font-semibold">
                        {mission.title}
                      </p>

                      <p className="mt-1 font-mono text-[8px] text-[#526a83]">
                        {mission.asset} · {mission.id.split("-").slice(-1)[0]}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="font-mono text-xl font-bold text-[#ff3b4e]">
                        {mission.risk}
                      </p>
                      <p className="text-[7px] uppercase tracking-wider text-[#526a83]">
                        risk
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[#20344d] pt-2">
                    <MiniMetric label="Cascade" value={mission.cascade} />
                    <MiniMetric label="Assets" value={mission.affected} />
                    <MiniMetric label="Deadline" value={mission.deadline} />
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[8px] text-[#8da2bb]">
                      Owner: <b className="text-[#c6d2df]">{mission.owner}</b>
                    </span>

                    <span
                      className={`text-[8px] ${
                        ["pending", "assigned", "Awaiting acknowledgement"].includes(
                          String(mission.status)
                        )
                          ? "text-[#ffad32]"
                          : mission.status === "resolved"
                            ? "text-[#24d18a]"
                            : "text-[#8da2bb]"
                      }`}
                    >
                      {mission.status}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {/* DETAIL */}
            {showDetail && selected && displayMissions.length > 0 && (
              <div className="border-t border-[#20344d] bg-[#07111f] p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[8px] uppercase tracking-[0.16em] text-[#526a83]">
                      Mission intelligence
                    </p>
                    <h3 className="mt-1 text-[13px] font-bold">
                      {selected.asset} - {selected.priority} mission
                    </h3>
                  </div>

                  <button
                    onClick={() => setShowDetail(false)}
                    className="text-[10px] text-[#526a83] hover:text-white"
                  >
                    CLOSE
                  </button>
                </div>

                <div className="mt-3 rounded-lg border border-[#20344d] bg-[#0c1a2b] p-3">
                  <p className="text-[10px] leading-5 text-[#c6d2df]">
                    {analysisMode === "SIMULATION"
                      ? `${selected.title} is prioritized ${selected.priority} from the controlled cyclone dataset using hazard exposure, dependency cascade, and affected-asset values.`
                      : `${selected.title} is prioritized ${selected.priority} from the current-weather operational assessment using the active weather conditions and returned impact factors.`}
                  </p>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Reason label="Risk score" value={String(selected.risk)} />
                  <Reason label="Cascade score" value={String(selected.cascade)} />
                  <Reason label="Affected assets" value={String(selected.affected)} />
                  <Reason label="Priority" value={selected.priority} />
                  <Reason label="Owner" value={selected.owner} />
                  <Reason label="AI confidence" value={selected.confidence} />
                </div>

                <div className="mt-3">
                  <p className="mb-2 text-[8px] uppercase tracking-wider text-[#526a83]">
                    Evidence
                  </p>

                  <div className="flex flex-wrap gap-1.5">
                    <Evidence label="Hazard input" />
                    <Evidence label="OSM infrastructure" />
                    <Evidence label={selected.asset} />
                    <Evidence label={`${selected.affected} affected assets`} />
                    <Evidence label="Dependency analysis" />
                  </div>
                </div>

                <div className="mt-3 rounded-lg border border-[#42a5ff]/20 bg-[#42a5ff]/[0.05] p-3">
                  <div className="flex items-center gap-2">
                    <Bot size={13} className="text-[#42a5ff]" />
                    <span className="text-[9px] font-semibold">
                      PralaySetu reasoning
                    </span>
                  </div>

                  <p className="mt-2 text-[9px] leading-4 text-[#8da2bb]">
                    Mission generated by the active PralaySetu analysis from the structured risk factors shown above.
                  </p>

                  <div className="mt-2 flex items-center gap-1.5 text-[8px] font-semibold text-[#ffad32]">
                    <ShieldCheck size={11} />
                    Human approval required
                  </div>
                </div>

                {/* FIELD DISPATCH */}
                <div className="mt-3 rounded-xl border border-[#42a5ff]/20 bg-[#091827] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Send size={13} className="text-[#42a5ff]" />
                        <p className="text-[9px] font-bold uppercase tracking-[0.14em]">Field Dispatch</p>
                      </div>
                      <p className="mt-1 text-[8px] leading-4 text-[#8da2bb]">
                        Assign this mission to the responsible department response team. No personal phone number is required.
                      </p>
                    </div>
                    {dispatchState && (
                      <span className="rounded border border-[#24d18a]/30 bg-[#24d18a]/10 px-2 py-1 text-[7px] font-bold text-[#24d18a]">
                        DISPATCHED
                      </span>
                    )}
                  </div>

                  {!dispatchState ? (
                    <>
                      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <label className="rounded-lg border border-[#20344d] bg-[#0c1a2b] p-2">
                          <span className="text-[7px] uppercase tracking-wider text-[#526a83]">Responsible department / team</span>
                          <select
                            value={dispatchTeam}
                            onChange={(event) => setDispatchTeam(event.target.value)}
                            className="mt-1 w-full bg-transparent text-[9px] font-semibold text-white outline-none"
                          >
                            <option value="PWD Coastal Response Team">PWD Coastal Response Team</option>
                            <option value="PWD Roads & Works Team">PWD Roads & Works Team</option>
                            <option value="Municipal Response Team">Municipal Response Team</option>
                            <option value="Emergency Infrastructure Team">Emergency Infrastructure Team</option>
                          </select>
                        </label>

                        <label className="rounded-lg border border-[#20344d] bg-[#0c1a2b] p-2">
                          <span className="text-[7px] uppercase tracking-wider text-[#526a83]">Assigned field worker</span>
                          <select
                            value={dispatchWorker}
                            onChange={(event) => setDispatchWorker(event.target.value)}
                            className="mt-1 w-full bg-transparent text-[9px] font-semibold text-white outline-none"
                          >
                            <option value="Field Worker 07">Field Worker 07</option>
                            <option value="Field Worker 12">Field Worker 12</option>
                            <option value="Field Worker 19">Field Worker 19</option>
                          </select>
                        </label>
                      </div>

                      <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-lg border border-[#20344d] bg-[#0c1a2b] px-2.5 py-2">
                        <input
                          type="checkbox"
                          checked={notifyTeam}
                          onChange={(event) => setNotifyTeam(event.target.checked)}
                          className="accent-[#42a5ff]"
                        />
                        <span className="text-[8px] text-[#c6d2df]">Notify department response queue</span>
                        <span className="ml-auto text-[7px] text-[#526a83]">TEAM QUEUE</span>
                      </label>

                      {dispatchError && (
                        <p role="alert" className="mt-2 rounded-lg border border-[#ff3b4e]/30 bg-[#ff3b4e]/[0.04] px-2.5 py-2 text-[8px] text-[#ff7b88]">
                          {dispatchError}
                        </p>
                      )}

                      <button
                        onClick={dispatchSelectedMission}
                        disabled={dispatchLoading}
                        className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-[#42a5ff] py-2.5 text-[9px] font-black text-[#06111e] disabled:cursor-not-allowed disabled:bg-[#36516c]"
                      >
                        <Send size={12} />
                        {dispatchLoading ? "DISPATCHING…" : "DISPATCH MISSION TO FIELD"}
                      </button>
                    </>
                  ) : (
                    <div className="mt-3 rounded-lg border border-[#24d18a]/20 bg-[#24d18a]/[0.04] p-3">
                      <div className="flex items-center gap-2">
                        <UserCheck size={13} className="text-[#24d18a]" />
                        <span className="text-[9px] font-bold text-[#24d18a]">MISSION DISPATCHED</span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <Reason label="Response team" value={dispatchState.team} />
                        <Reason label="Field worker" value={dispatchState.worker_name} />
                      </div>
                      <div className="mt-2 rounded-lg border border-[#20344d] bg-[#0c1a2b] px-2.5 py-2">
                        <p className="text-[8px] text-[#8da2bb]">Notification</p>
                        <p className="mt-1 text-[9px] font-semibold text-[#c6d2df]">
                          {dispatchState.notification?.status === "queued" ? "Department response queue notified" : "Notification not requested"}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          window.location.href = dispatchState.field_url || `/field?mission=${encodeURIComponent(selected.id)}`;
                        }}
                        className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-[#24d18a]/30 bg-[#24d18a]/10 py-2.5 text-[9px] font-bold text-[#24d18a]"
                      >
                        <Navigation size={12} />
                        OPEN FIELD WORKER VIEW
                      </button>
                    </div>
                  )}
                </div>

                {dispatchState && (
                  <div className="mt-3 rounded-lg border border-[#24d18a]/20 bg-[#24d18a]/[0.04] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Radio size={11} className="text-[#24d18a]" />
                        <span className="text-[8px] font-bold uppercase tracking-wider text-[#24d18a]">Field handoff active</span>
                      </div>
                      <span className="text-[8px] text-[#8da2bb]">{selected.status}</span>
                    </div>
                    <p className="mt-1 text-[8px] text-[#8da2bb]">
                      {dispatchState.team} · {dispatchState.worker_name} · response queue {dispatchState.notification?.status === "queued" ? "notified" : "not requested"}
                    </p>
                  </div>
                )}

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => {
                      try {
                        window.localStorage.setItem(
                          "sankat-selected-mission-id",
                          selected.id
                        );
                        window.localStorage.setItem(
                          "sankat-analysis-mode",
                          analysisMode
                        );
                      } catch {
                        // Local persistence is optional.
                      }
                      window.location.href = `/field?mission=${encodeURIComponent(
                        selected.id
                      )}`;
                    }}
                    className="flex-1 rounded-lg bg-[#42a5ff] py-2.5 text-[9px] font-bold text-[#06111e]"
                  >
                    OPEN MISSION
                  </button>

                  <button
                    onClick={acknowledge}
                    className="flex-1 rounded-lg border border-[#20344d] bg-[#0c1a2b] py-2.5 text-[9px] font-bold"
                  >
                    {acknowledged ? "ACKNOWLEDGED ✓" : "ACKNOWLEDGE"}
                  </button>
                </div>

                <div className="mt-2 flex items-center justify-between text-[8px] text-[#526a83]">
                  <span>Evidence: Current hazard - OSM geography - dependency analysis</span>
                  <span>Updated 2m ago</span>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
      {showCommandPanel && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-[#020914]/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-[#20344d] bg-[#091827] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Bot size={16} className="text-[#42a5ff]" />
                  <h3 className="text-[13px] font-bold">AI Command Centre</h3>
                </div>
                <p className="mt-1 text-[9px] text-[#8da2bb]">
                  Controlled operator actions for the current analysis mode.
                </p>
              </div>
              <button onClick={() => setShowCommandPanel(false)} className="text-[10px] text-[#526a83] hover:text-white">
                CLOSE
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-[#42a5ff]/20 bg-[#42a5ff]/[0.05] p-3">
              <p className="text-[10px] leading-5 text-[#c6d2df]">{commandMessage}</p>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  if (analysisMode === "SIMULATION") runAnalysis();
                  else runLiveWeatherAnalysis();
                  setShowCommandPanel(false);
                }}
                className="rounded-lg bg-[#42a5ff] px-3 py-2.5 text-[9px] font-bold text-[#06111e]"
              >
                {analysisMode === "SIMULATION" ? "RUN IMPACT ANALYSIS" : "ANALYZE LIVE"}
              </button>

              <button
                onClick={() => {
                  const mission = selected || displayMissions[0];
                  if (mission) {
                    setSelected(mission);
                    setShowDetail(true);
                    setShowCommandPanel(false);
                    document.getElementById("missions-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
                  } else {
                    setCommandMessage("No mission is currently available.");
                  }
                }}
                className="rounded-lg border border-[#20344d] bg-[#0c1a2b] px-3 py-2.5 text-[9px] font-bold text-[#c6d2df]"
              >
                OPEN PRIORITY
              </button>
            </div>
          </div>
        </div>
      )}

      {showSourcesPanel && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-[#020914]/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-[#20344d] bg-[#091827] p-5 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Database size={16} className="text-[#42a5ff]" />
                  <h3 className="text-[13px] font-bold">Data Sources</h3>
                </div>
                <p className="mt-1 text-[9px] text-[#8da2bb]">
                  Provenance used by the prototype.
                </p>
              </div>
              <button onClick={() => setShowSourcesPanel(false)} className="text-[10px] text-[#526a83] hover:text-white">
                CLOSE
              </button>
            </div>

            <div className="mt-4 space-y-2">
              <SourceRow name="OpenStreetMap" detail="Puri roads + infrastructure geography" />
              <SourceRow name="Open-Meteo" detail="Current model-based weather conditions" />
              <SourceRow name="PralaySetu simulation dataset" detail="140 km/h wind · 220 mm rainfall · controlled demo event" />
              <SourceRow name="Gemini" detail="Mission/evidence reasoning with human review guardrails" />
            </div>

            <p className="mt-4 text-[8px] leading-4 text-[#526a83]">
              Simulation outputs are labelled as simulated. Candidate spatial dependencies are operational inferences, not causal truth.
            </p>
          </div>
        </div>
      )}

    </main>
  );
}

/* ---------------- COMPONENTS ---------------- */

function RoadLine({
  x,
  y,
  width,
  rotate,
  critical = false,
}: {
  x: string;
  y: string;
  width: string;
  rotate: string;
  critical?: boolean;
}) {
  return (
    <div
      className={`absolute h-[2px] ${
        critical ? "bg-[#ff3b4e]/70" : "bg-[#52708b]/70"
      }`}
      style={{
        left: x,
        top: y,
        width,
        transform: `rotate(${rotate})`,
      }}
    />
  );
}

function MapMarker({
  left,
  top,
  color,
  label,
  selected = false,
}: {
  left: string;
  top: string;
  color: "red" | "amber" | "green";
  label: string;
  selected?: boolean;
}) {
  const colors = {
    red: "bg-[#ff3b4e] shadow-[0_0_12px_#ff3b4e]",
    amber: "bg-[#ffad32] shadow-[0_0_10px_#ffad32]",
    green: "bg-[#24d18a] shadow-[0_0_10px_#24d18a]",
  };

  return (
    <div
      className="absolute z-10"
      style={{ left, top }}
    >
      <div
        className={`relative flex h-4 w-4 items-center justify-center rounded-full ${
          colors[color]
        } ${selected ? "ring-4 ring-[#42a5ff]/20" : ""}`}
      >
        {selected && (
          <span className="absolute inset-[-5px] animate-ping rounded-full border border-[#ff3b4e]/40" />
        )}
      </div>

      {selected && (
        <span className="absolute left-6 top-[-2px] whitespace-nowrap rounded border border-[#ff3b4e]/30 bg-[#07111f]/90 px-1.5 py-1 text-[8px] font-bold text-[#ff7b88]">
          {label} · P0
        </span>
      )}
    </div>
  );
}

function LegendDot({
  color,
  label,
}: {
  color: string;
  label: string;
}) {
  return (
    <span className="flex items-center gap-1 px-1.5 text-[8px] font-semibold">
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}

function StatusChip({
  icon,
  text,
  danger = false,
}: {
  icon: ReactNode;
  text: string;
  danger?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[8px] backdrop-blur ${
        danger
          ? "border-[#ff3b4e]/30 bg-[#07111f]/90 text-[#ff7b88]"
          : "border-[#20344d] bg-[#07111f]/90 text-[#c6d2df]"
      }`}
    >
      {icon}
      {text}
    </div>
  );
}

function SmallLegend({
  color,
  text,
}: {
  color: string;
  text: string;
}) {
  return (
    <div className="flex items-center gap-1.5 text-[8px] text-[#8da2bb]">
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: color }}
      />
      {text}
    </div>
  );
}

      <style jsx global>{`
        .sankat-selected {
          animation: sankatSelected 2.6s ease-in-out infinite;
        }

        .sankat-node {
          animation: sankatNodeIn 420ms ease-out both;
        }

        .sankat-flow {
          animation: sankatFlow 1.8s ease-in-out infinite;
        }

        .sankat-branch {
          animation: sankatBranch 1.8s ease-in-out infinite;
        }

        @keyframes sankatSelected {
          0%, 100% { box-shadow: 0 0 0 rgba(66,165,255,0); }
          50% { box-shadow: 0 0 22px rgba(66,165,255,0.10); }
        }

        @keyframes sankatNodeIn {
          from { opacity: 0; transform: translateY(5px) scale(0.985); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes sankatFlow {
          0%, 100% { opacity: 0.45; transform: translateX(0); }
          50% { opacity: 1; transform: translateX(2px); }
        }

        @keyframes sankatBranch {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 0.9; }
        }

        @media (prefers-reduced-motion: reduce) {
          .sankat-selected,
          .sankat-node,
          .sankat-flow,
          .sankat-branch {
            animation: none !important;
          }
        }
      `}</style>

function Stat({
  label,
  value,
  danger,
  warning,
}: {
  label: string;
  value: string;
  danger?: boolean;
  warning?: boolean;
}) {
  return (
    <div className="bg-[#0c1a2b] px-4 py-3">
      <p className="text-[8px] uppercase tracking-wider text-[#526a83]">
        {label}
      </p>
      <p
        className={`mt-1 font-mono text-sm font-bold ${
          danger
            ? "text-[#ff3b4e]"
            : warning
              ? "text-[#ffad32]"
              : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function CascadeNode({
  title,
  sub,
  danger,
  warning,
  animated,
}: {
  title: string;
  sub: string;
  danger?: boolean;
  warning?: boolean;
  animated?: boolean;
}) {
  return (
    <div
      className={`min-w-[142px] rounded-xl border px-3 py-2.5 transition ${
        danger
          ? "border-[#ff3b4e]/40 bg-[#ff3b4e]/[0.07] shadow-[0_0_18px_rgba(255,59,78,0.07)]"
          : warning
            ? "border-[#ffad32]/40 bg-[#ffad32]/[0.06]"
            : "border-[#20344d] bg-[#091624]"
      } ${animated ? "sankat-node" : ""}`}
    >
      <p className="font-mono text-[10px] font-bold">{title}</p>
      <p className="mt-1 text-[8px] leading-3 text-[#8da2bb]">{sub}</p>
    </div>
  );
}

function CascadeAssetNode({
  id,
  name,
  type,
  catalog,
  animated,
}: {
  id: string;
  name: string;
  type: string;
  catalog: Record<string, any>;
  animated?: boolean;
}) {
  const value = type.toLowerCase();
  const asset = catalog[id];
  const label = String(name || asset?.name || id);
  const kind = String(type || asset?.type || "infrastructure").replace(/_/g, " ");

  let icon = <Zap size={13} className="text-[#ffad32]" />;
  if (value.includes("hospital") || value.includes("clinic")) {
    icon = <Hospital size={13} className="text-[#42a5ff]" />;
  } else if (value.includes("shelter")) {
    icon = <House size={13} className="text-[#24d18a]" />;
  } else if (value.includes("police")) {
    icon = <ShieldCheck size={13} className="text-[#a78bfa]" />;
  } else if (value.includes("fuel") || value.includes("blood")) {
    icon = <Siren size={13} className="text-[#ff3b4e]" />;
  }

  return (
    <div
      title={`${label} · ${id}`}
      className={`min-w-[154px] max-w-[180px] rounded-xl border border-[#42a5ff]/25 bg-[#0a1828] px-3 py-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.18)] transition hover:-translate-y-0.5 hover:border-[#42a5ff]/50 ${
        animated ? "sankat-node" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="truncate text-[9px] font-bold text-[#e8f0f8]">{label}</span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="truncate text-[7px] uppercase tracking-wider text-[#526a83]">{kind}</span>
        <span className="font-mono text-[7px] text-[#526a83]">{id.replace("OSM-", "OSM ")}</span>
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-[#42a5ff]" />
        <span className="text-[7px] text-[#8da2bb]">candidate downstream exposure</span>
      </div>
    </div>
  );
}

function CascadeFlow() {
  return (
    <div className="flex shrink-0 items-center gap-1.5 text-[#526a83] sankat-flow">
      <span className="h-px w-5 bg-[#20344d]" />
      <ArrowRight size={14} />
    </div>
  );
}

function CascadeBranch() {
  return <ArrowRight size={12} className="shrink-0 text-[#36516c] sankat-branch" />;
}

function Arrow() {
  return <ArrowRight size={15} className="shrink-0 text-[#526a83]" />;
}

function TimelineItem({
  label,
  done,
  current,
}: {
  label: string;
  done?: boolean;
  current?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <div
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
          done
            ? "bg-[#24d18a]/15 text-[#24d18a]"
            : current
              ? "bg-[#42a5ff]/15 text-[#42a5ff]"
              : "bg-[#20344d] text-[#526a83]"
        }`}
      >
        {done ? <Check size={11} /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      </div>

      <div>
        <p className="text-[9px] font-medium">{label}</p>
        <p className="mt-0.5 text-[7px] text-[#526a83]">
          {done ? "Completed" : current ? "Current state" : "Pending"}
        </p>
      </div>
    </div>
  );
}

function MissionIcon({ type }: { type: string }) {
  const value = String(type).toLowerCase();

  if (value.includes("hospital")) {
    return <Hospital size={12} className="text-[#42a5ff]" />;
  }

  if (value.includes("blood")) {
    return <ShieldCheck size={12} className="text-[#ff3b4e]" />;
  }

  if (value.includes("critical asset") || value.includes("fuel")) {
    return <Siren size={12} className="text-[#ff3b4e]" />;
  }

  return <Route size={12} className="text-[#ffad32]" />;
}

function MiniMetric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div>
      <p className="text-[7px] uppercase tracking-wider text-[#526a83]">
        {label}
      </p>
      <p className="mt-0.5 font-mono text-[10px] font-semibold">
        {value}
      </p>
    </div>
  );
}

function Reason({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-[#20344d] bg-[#0c1a2b] p-2">
      <p className="text-[7px] text-[#526a83]">{label}</p>
      <p className="mt-1 font-mono text-[11px] font-bold">{value}</p>
    </div>
  );
}

function Evidence({ label }: { label: string }) {
  return (
    <span className="rounded border border-[#20344d] bg-[#0c1a2b] px-2 py-1 text-[8px] text-[#8da2bb]">
      {label}
    </span>
  );
}

function SourceRow({ name, detail }: { name: string; detail: string }) {
  return (
    <div className="rounded-lg border border-[#20344d] bg-[#0c1a2b] p-3">
      <p className="text-[9px] font-semibold text-white">{name}</p>
      <p className="mt-1 text-[8px] text-[#8da2bb]">{detail}</p>
    </div>
  );
}

function WeatherMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#20344d] bg-[#0c1a2b] px-3 py-2">
      <p className="text-[8px] uppercase tracking-wider text-[#526a83]">{label}</p>
      <p className="mt-1 text-[11px] font-semibold text-white">{value}</p>
    </div>
  );
}
