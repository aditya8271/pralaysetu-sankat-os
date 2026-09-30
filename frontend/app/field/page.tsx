"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import {
ArrowLeft,
Camera,
  CheckCircle2,
  Clock3,
  MapPin,
  Mic,
  Navigation,
  ShieldCheck,
  Upload,
  Wifi,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { API_BASE_URL } from "../../lib/api";

type Mission = {
  id: string;
  asset?: string;
  asset_id?: string;
  road_id?: string;
  action?: string;
  owner_role?: string;
  deadline_minutes?: number;
  priority?: string;
  status?: string;
  risk_score?: number;
  priority_score?: number;
  cascade_score?: number;
  affected_count?: number;
  hazard?: { safety_phase?: string };
  evidence?: { uploaded_at?: string };
};

function FieldPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const missionId = searchParams.get("mission");

  const [mission, setMission] = useState<Mission | null>(null);
  const [safetyPhase, setSafetyPhase] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [gps, setGps] = useState<{
    lat: number;
    lon: number;
  } | null>(null);

  const [status, setStatus] = useState("loading");
  const [verification, setVerification] = useState<any>(null);
  const [verificationError, setVerificationError] = useState("");
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState("English");
  const [isRecording, setIsRecording] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechStatus, setSpeechStatus] = useState(
    "Speech-to-text is available in supported browsers."
  );
  const [voiceSeconds, setVoiceSeconds] = useState(0);
  const [evidenceTimestamp, setEvidenceTimestamp] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const voiceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const speechRecognitionRef = useRef<any>(null);

  const canFieldDeploy =
    !safetyPhase || safetyPhase === "PRE_LANDFALL" || safetyPhase === "POST_CLEARANCE";
  const canCollectEvidence = !safetyPhase || safetyPhase === "POST_CLEARANCE";

  useEffect(() => {
    async function loadMission() {
  if (!missionId) {
    setLoading(false);
    setStatus("missing");
    return;
  }

  try {
    // First try direct mission endpoint
    const directResponse = await fetch(
      `${API_BASE_URL}/api/missions/${encodeURIComponent(
        missionId
      )}`
    );

    if (directResponse.ok) {
      const data = await directResponse.json();

      const loadedMission = data.mission || data;
      setMission(loadedMission);
      try {
        const hazardResponse = await fetch(`${API_BASE_URL}/api/hazard`);
        if (hazardResponse.ok) {
          const hazardData = await hazardResponse.json();
          setSafetyPhase(hazardData?.hazard?.safety_phase || null);
        }
      } catch {
        setSafetyPhase(null);
      }
      setStatus("ready");
      return;
    }

    // Fallback: load complete mission list
    const missionsResponse = await fetch(
      `${API_BASE_URL}/api/missions`
    );

    if (!missionsResponse.ok) {
      throw new Error("Unable to load missions");
    }

    const missionsData = await missionsResponse.json();

    const missionList = Array.isArray(missionsData)
      ? missionsData
      : missionsData.missions || [];

    const foundMission = missionList.find(
      (item: Mission) => item.id === missionId
    );

    if (!foundMission) {
      throw new Error(
        `Mission ${missionId} was not found in mission list`
      );
    }

    setMission(foundMission);
    try {
      const hazardResponse = await fetch(`${API_BASE_URL}/api/hazard`);
      if (hazardResponse.ok) {
        const hazardData = await hazardResponse.json();
        setSafetyPhase(hazardData?.hazard?.safety_phase || null);
      }
    } catch {
      setSafetyPhase(null);
    }
    setStatus("ready");
  } catch (error) {
    console.error("Failed to load mission:", error);
    setStatus("error");
  } finally {
    setLoading(false);
  }
}

    loadMission();
  }, [missionId]);

  function getGPS() {
    if (!canFieldDeploy) return;
    if (!navigator.geolocation) {
      alert("GPS is not supported by this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGps({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
      },
      (error) => {
        console.error(error);
        alert("Unable to get GPS location.");
      }
    );
  }

  function getLanguageCode(language: string) {
    switch (language) {
      case "Hindi":
        return "hi-IN";
      case "Odia":
        return "or-IN";
      default:
        return "en-IN";
    }
  }

  function toggleSpeechRecognition() {
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setSpeechStatus(
        "Speech-to-text is unavailable in this browser. You can still type or edit the observation manually."
      );
      return;
    }

    if (isListening) {
      speechRecognitionRef.current?.stop();
      return;
    }

    try {
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = getLanguageCode(selectedLanguage);
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onresult = (event: any) => {
        const newestResult = event.results?.[event.results.length - 1];
        const transcriptText = newestResult?.[0]?.transcript?.trim();

        if (!transcriptText) return;

        setNotes((previous) =>
          previous ? `${previous} ${transcriptText}`.trim() : transcriptText
        );
      };

      recognition.onerror = (event: any) => {
        setSpeechStatus(
          `Speech recognition error: ${event?.error || "Unable to listen"}. You can still type the observation manually.`
        );
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        setSpeechStatus(
          "Transcript ready. Review and edit the observation before uploading evidence."
        );
      };

      speechRecognitionRef.current = recognition;
      setIsListening(true);
      setSpeechStatus("Listening... speak your field observation.");
      recognition.start();
    } catch (error) {
      console.error("Speech recognition failed:", error);
      setSpeechStatus(
        "Speech-to-text could not start. Please try again or type the observation manually."
      );
    }
  }

  function speakObservation() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setSpeechStatus(
        "Text-to-speech is unavailable in this browser. Please read the observation manually."
      );
      return;
    }

    const text = notes.trim() || mission?.action || "No observation available yet.";
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = getLanguageCode(selectedLanguage);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setSpeechStatus("Reading the observation aloud...");
  }

  function stopVoiceTimer() {
    if (voiceTimerRef.current) {
      clearInterval(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
  }

  async function toggleVoiceCapture() {
    if (!canCollectEvidence) return;
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      alert("Voice recording is not supported by this browser/device.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      voiceChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) voiceChunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "audio/webm";
        const blob = new Blob(voiceChunksRef.current, {
          type: mimeType,
        });
        const extension = mimeType.includes("mp4") ? "m4a" : mimeType.includes("ogg") ? "ogg" : "webm";
        const file = new File(
          [blob],
          `field-voice-${missionId || "mission"}-${Date.now()}.${extension}`,
          { type: blob.type || "audio/webm" }
        );
        setVoiceFile(file);
        setIsRecording(false);
        stopVoiceTimer();
        setVoiceSeconds(0);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setVoiceSeconds(0);
      voiceTimerRef.current = setInterval(() => {
        setVoiceSeconds((seconds) => seconds + 1);
      }, 1000);
    } catch (error) {
      console.error("Voice capture failed:", error);
      alert("Microphone permission was denied or recording could not start.");
    }
  }

  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stop();
      speechRecognitionRef.current?.stop();
      stopVoiceTimer();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  async function updateMissionStatus(
    endpoint: "acknowledge" | "start" | "complete"
  ) {
    if (!missionId) return;
    if ((endpoint === "start" || endpoint === "complete") && !canFieldDeploy) {
      alert("Field deployment is unavailable until the backend reports POST_CLEARANCE.");
      return;
    }

    try {
      setActionLoading(true);

      let currentStatus = String(mission?.status || "").toLowerCase();

      // Backend lifecycle: PENDING -> ASSIGNED -> ACKNOWLEDGED -> IN_PROGRESS -> VERIFICATION_REQUIRED
      if (endpoint === "acknowledge" && ["pending", ""].includes(currentStatus)) {
        const assignResponse = await fetch(
          `${API_BASE_URL}/api/missions/${encodeURIComponent(missionId)}/assign`,
          { method: "POST" }
        );

        if (!assignResponse.ok) {
          const errorText = await assignResponse.text();
          throw new Error(`Assignment failed (${assignResponse.status}): ${errorText}`);
        }

        const assignData = await assignResponse.json();
        setMission(assignData.mission || assignData);
        currentStatus = "assigned";
      }

      if (endpoint === "acknowledge" && ["pending", "assigned"].includes(currentStatus)) {
        const response = await fetch(
          `${API_BASE_URL}/api/missions/${encodeURIComponent(missionId)}/acknowledge`,
          { method: "POST" }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Acknowledge failed (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        setMission(data.mission || data);
        setStatus("acknowledged");
        return;
      }

      if (endpoint === "start") {
        if (!["acknowledged"].includes(currentStatus)) {
          throw new Error(`Mission must be acknowledged before starting. Current status: ${currentStatus || "unknown"}`);
        }

        const response = await fetch(
          `${API_BASE_URL}/api/missions/${encodeURIComponent(missionId)}/start`,
          { method: "POST" }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Start failed (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        setMission(data.mission || data);
        setStatus("in_progress");
        return;
      }

      if (endpoint === "complete") {
        if (!["in_progress"].includes(currentStatus)) {
          throw new Error(`Mission must be in progress before completing. Current status: ${currentStatus || "unknown"}`);
        }

        const response = await fetch(
          `${API_BASE_URL}/api/missions/${encodeURIComponent(missionId)}/complete`,
          { method: "POST" }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Complete failed (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        setMission(data.mission || data);
        setStatus("verification");
      }
    } catch (error) {
      console.error("Mission status update failed:", error);
      alert(error instanceof Error ? error.message : "Mission update failed.");
    } finally {
      setActionLoading(false);
    }
  }

  async function uploadEvidence() {
    if (!missionId) return;
    if (!canCollectEvidence) {
      alert("Evidence collection is unavailable until the backend reports POST_CLEARANCE.");
      return;
    }

    if (!photo && !notes.trim() && !gps && !voiceFile) {
      alert("Add photo, GPS or field notes first.");
      return;
    }

    try {
      setActionLoading(true);
      setVerificationError("");

      const formData = new FormData();

      if (photo) {
        formData.append("photo", photo);
      }

      if (gps) {
        formData.append("latitude", String(gps.lat));
        formData.append("longitude", String(gps.lon));
      }

      formData.append("notes", notes);
      formData.append("transcript", notes.trim());
      formData.append("voice_language", selectedLanguage);
      formData.append("observation_language", selectedLanguage);

      if (voiceFile) {
        formData.append("voice", voiceFile);
      }

      const uploadResponse = await fetch(
        `${API_BASE_URL}/api/missions/${encodeURIComponent(
          missionId
        )}/evidence/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        throw new Error(
          `Evidence upload failed: ${uploadResponse.status} ${errorText}`
        );
      }

      const uploadData = await uploadResponse.json();

      if (uploadData?.mission) {
        setMission(uploadData.mission);
      }
      setEvidenceTimestamp(uploadData?.evidence?.uploaded_at || null);

      setStatus("evidence_uploaded");

      const verifyResponse = await fetch(
        `${API_BASE_URL}/api/missions/${encodeURIComponent(
          missionId
        )}/verify`,
        {
          method: "POST",
        }
      );

      if (!verifyResponse.ok) {
        const errorText = await verifyResponse.text();
        throw new Error(
          `AI verification failed: ${verifyResponse.status} ${errorText}`
        );
      }

      const verifyData = await verifyResponse.json();

      console.log("AI VERIFICATION RESPONSE:", verifyData);

      setVerification(verifyData);
      setStatus("verification");

      try {
        const missionResponse = await fetch(
          `${API_BASE_URL}/api/missions/${encodeURIComponent(
            missionId
          )}`
        );

        if (missionResponse.ok) {
          const refreshed = await missionResponse.json();
          setMission(refreshed.mission || refreshed);
        }
      } catch (refreshError) {
        console.warn(
          "Mission refresh after verification failed:",
          refreshError
        );
      }
    } catch (error) {
      console.error("Evidence/verification error:", error);
      setVerificationError(
        error instanceof Error
          ? error.message
          : "Evidence verification failed."
      );
      setStatus("evidence_uploaded");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07111f] text-white">
        <div className="flex items-center gap-3 rounded-xl border border-[#20344d] bg-[#0c1a2b] px-5 py-4">
          <Loader2
            size={18}
            className="animate-spin text-[#42a5ff]"
          />
          <span className="text-sm">
            Loading mission...
          </span>
        </div>
      </main>
    );
  }

  if (status === "missing" || status === "error" || !mission) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07111f] px-4 text-white">
        <div className="w-full max-w-md rounded-2xl border border-[#20344d] bg-[#0c1a2b] p-6">
          <AlertTriangle
            size={30}
            className="mb-4 text-[#ffad32]"
          />

          <h1 className="text-lg font-bold">
            Mission unavailable
          </h1>

          <p className="mt-2 text-sm text-[#8da2bb]">
            No valid mission was found for this field operation.
          </p>

          <button
            onClick={() => router.push("/")}
            className="mt-5 w-full rounded-lg bg-[#42a5ff] px-4 py-3 text-sm font-bold text-[#06111e]"
          >
            BACK TO COMMAND CENTRE
          </button>
        </div>
      </main>
    );
  }

  const priority =
    mission.priority ||
    ((mission.priority_score || mission.risk_score || 0) >= 85
      ? "P0"
      : "P1");

  const risk = Math.round(
    mission.risk_score ||
      mission.priority_score ||
      0
  );

  const cascade = Math.round(
    mission.cascade_score || 0
  );

  const affected =
    mission.affected_count || 0;

  const missionAsset =
    mission.road_id ||
    mission.asset_id ||
    mission.asset ||
    "Unknown asset";

  const reassessment = verification?.reassessment;
  const roadAfter = reassessment?.road;
  const reassessedAsset = reassessment?.asset as {
    priority?: { priorities?: Array<{ asset_id?: string; priority?: string }> };
    impact?: { results?: Array<{ asset?: { id?: string }; impact?: { score?: number } }> };
  } | undefined;
  const assetPriorityAfter = reassessedAsset?.priority?.priorities?.find(
    (item) => String(item.asset_id) === String(mission.asset_id || mission.asset || missionAsset)
  );
  const assetImpactAfter = reassessedAsset?.impact?.results?.find(
    (item) => String(item.asset?.id) === String(mission.asset_id || mission.asset || missionAsset)
  );

  return (
    <main className="min-h-screen bg-[#07111f] text-white">
      {/* HEADER */}

      <header className="sticky top-0 z-50 border-b border-[#20344d] bg-[#07111f]/95 backdrop-blur">
        <div className="flex h-16 items-center justify-between px-4">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-sm text-[#8da2bb] hover:text-white"
          >
            <ArrowLeft size={17} />
            Command Centre
          </button>

          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#24d18a]" />
            <span className="text-[9px] tracking-widest text-[#8da2bb]">
              FIELD MODE
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-5">
        {/* MISSION HEADER */}

        <section className="rounded-2xl border border-[#20344d] bg-[#0c1a2b] p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-md px-2 py-1 text-[10px] font-black ${
                    priority === "P0"
                      ? "bg-[#ff3b4e] text-white"
                      : "bg-[#ffad32] text-[#06111e]"
                  }`}
                >
                  {priority}
                </span>

                <span className="text-[9px] uppercase tracking-widest text-[#8da2bb]">
                  Field Mission
                </span>
              </div>

              <h1 className="mt-3 text-xl font-bold">
                {canFieldDeploy
                  ? mission.action || "Verify assigned infrastructure"
                  : safetyPhase === "DURING_STORM"
                    ? "Remote monitoring only — do not enter the affected area"
                    : "Field mission held pending post-clearance"}
              </h1>

              <p className="mt-1 font-mono text-[10px] text-[#526a83]">
                {mission.id}
              </p>
            </div>

            <div className="text-right">
              <p className="font-mono text-3xl font-black text-[#ff3b4e]">
                {risk}
              </p>

              <p className="text-[8px] uppercase tracking-widest text-[#526a83]">
                risk
              </p>
            </div>
          </div>

          {/* METRICS */}

          <div className="mt-5 grid grid-cols-3 gap-2">
            <Metric
              label="Cascade"
              value={cascade}
            />

            <Metric
              label="Affected"
              value={affected}
            />

            <Metric
              label="Deadline"
              value={`${mission.deadline_minutes || 0}m`}
            />
          </div>
        </section>

        <section className={`mt-3 rounded-xl border p-4 text-xs ${canFieldDeploy ? "border-[#24d18a]/30 bg-[#24d18a]/[0.05] text-[#24d18a]" : "border-[#ffad32]/30 bg-[#ffad32]/[0.05] text-[#ffad32]"}`} role="status">
          <p className="font-bold">Backend safety phase: {safetyPhase || "UNAVAILABLE"}</p>
          <p className="mt-1 text-[10px] text-[#8da2bb]">
            {safetyPhase === "POST_CLEARANCE"
              ? "Post-clearance: field verification and evidence collection are allowed."
              : safetyPhase === "DURING_STORM"
                ? "Active storm: do not enter the affected area. Remote monitoring only; field actions and evidence capture are disabled."
                : safetyPhase === "PRE_LANDFALL"
                  ? "Pre-landfall: planned inspection deployment is allowed. Evidence capture and upload remain held until post-clearance."
                  : "Safety phase is unavailable. Field deployment and evidence capture are disabled."}
          </p>
        </section>

        {/* LOCATION */}

        <section className="mt-3 rounded-2xl border border-[#20344d] bg-[#0c1a2b] p-5">
          <div className="flex items-center gap-2">
            <Navigation
              size={15}
              className="text-[#42a5ff]"
            />

            <h2 className="text-sm font-semibold">
              Assigned Infrastructure
            </h2>
          </div>

          <div className="mt-4 rounded-xl border border-[#20344d] bg-[#091624] p-4">
            <p className="font-mono text-sm font-bold">
              {missionAsset}
            </p>

            <p className="mt-1 text-xs text-[#8da2bb]">
              {mission.owner_role ||
                "Response Team"}
            </p>
          </div>
        </section>

        {/* MISSION STATE */}

        <section className="mt-3 rounded-2xl border border-[#20344d] bg-[#0c1a2b] p-5">
          <div className="flex items-center gap-2">
            <Clock3
              size={15}
              className="text-[#ffad32]"
            />

            <h2 className="text-sm font-semibold">
              Mission State
            </h2>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-2">
            <State
              label="Assigned"
              active
            />

            <State
              label="Acknowledged"
              active={
                status === "acknowledged" ||
                status === "in_progress" ||
                status === "verification" ||
                status === "evidence_uploaded"
              }
            />

            <State
              label="In Progress"
              active={
                status === "in_progress" ||
                status === "verification" ||
                status === "evidence_uploaded"
              }
            />

            <State
              label="Evidence"
              active={
                status === "verification" ||
                status === "evidence_uploaded"
              }
            />
          </div>
        </section>

        {/* ACTIONS */}

        <section className="mt-3 rounded-2xl border border-[#20344d] bg-[#0c1a2b] p-5">
          <h2 className="text-sm font-semibold">
            Field Action
          </h2>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <ActionButton
              icon={<ShieldCheck size={16} />}
              label="Acknowledge"
              onClick={() =>
                updateMissionStatus("acknowledge")
              }
              disabled={actionLoading}
            />

            <ActionButton
              icon={<Navigation size={16} />}
              label="Start Mission"
              onClick={() =>
                updateMissionStatus("start")
              }
              disabled={actionLoading || !canFieldDeploy}
            />

            <ActionButton
              icon={<CheckCircle2 size={16} />}
              label="Complete"
              onClick={() =>
                updateMissionStatus("complete")
              }
              disabled={actionLoading || !canFieldDeploy}
            />
          </div>
        </section>

        {/* EVIDENCE */}

        <section className="mt-3 rounded-2xl border border-[#20344d] bg-[#0c1a2b] p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">
                Field Evidence
              </h2>

              <p className="mt-1 text-[10px] text-[#8da2bb]">
                {canCollectEvidence
                  ? "Submit photo, GPS and field notes."
                  : safetyPhase === "DURING_STORM"
                    ? "Remote monitoring notes only; physical evidence capture and upload are blocked."
                    : safetyPhase === "PRE_LANDFALL"
                      ? "Notes and planned-inspection GPS are available. Photo, voice and evidence submission remain held until post-clearance."
                      : "Notes can be drafted. Evidence capture and submission remain blocked until the backend safety phase is available."}
              </p>
            </div>

            <Camera
              size={18}
              className="text-[#42a5ff]"
            />
          </div>
          <p className="mt-2 text-[9px] text-[#8da2bb]">
            {evidenceTimestamp || mission.evidence?.uploaded_at
              ? `Evidence timestamp: ${new Date(evidenceTimestamp || mission.evidence?.uploaded_at || "").toLocaleString()}`
              : "Evidence not uploaded"}
          </p>

          {/* PHOTO */}

          <label className={`mt-4 flex items-center gap-3 rounded-xl border border-dashed border-[#36516c] bg-[#091624] p-4 ${canCollectEvidence ? "cursor-pointer hover:border-[#42a5ff]" : "cursor-not-allowed opacity-50"}`}>
            <Upload
              size={18}
              className="text-[#42a5ff]"
            />

            <div className="min-w-0">
              <p className="text-xs font-semibold">
                {photo
                  ? photo.name
                  : "Upload field photo"}
              </p>

              <p className="mt-1 text-[9px] text-[#526a83]">
                Photo will be sent for AI-assisted verification.
              </p>
            </div>

            <input
              type="file"
              accept="image/*"
              capture="environment"
              disabled={!canCollectEvidence}
              className="hidden"
              onChange={(event) => {
                setPhoto(
                  event.target.files?.[0] || null
                );
              }}
            />
          </label>

          {/* GPS */}

          <button
            onClick={getGPS}
            disabled={!canFieldDeploy}
            className="mt-2 flex w-full items-center justify-between rounded-xl border border-[#20344d] bg-[#091624] p-4 text-left hover:border-[#42a5ff] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <MapPin
                size={18}
                className={
                  gps
                    ? "text-[#24d18a]"
                    : "text-[#8da2bb]"
                }
              />

              <div>
                <p className="text-xs font-semibold">
                  {gps
                    ? "GPS captured"
                    : "Capture GPS location"}
                </p>

                {gps && (
                  <p className="mt-1 font-mono text-[9px] text-[#24d18a]">
                    {gps.lat.toFixed(6)},{" "}
                    {gps.lon.toFixed(6)}
                  </p>
                )}
              </div>
            </div>

            <Navigation
              size={15}
              className="text-[#526a83]"
            />
          </button>

          <div className="mt-2 rounded-xl border border-[#20344d] bg-[#091624] p-3">
            <label className="flex items-center justify-between gap-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#8da2bb]">
              Observation language
              <select
                value={selectedLanguage}
                onChange={(event) => setSelectedLanguage(event.target.value)}
                disabled={!canCollectEvidence}
                className="rounded-md border border-[#20344d] bg-[#0c1a2b] px-2 py-1 text-[9px] text-white outline-none"
              >
                <option>English</option>
                <option>Hindi</option>
                <option>Odia</option>
              </select>
            </label>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={toggleSpeechRecognition}
                disabled={actionLoading || !canCollectEvidence}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-[9px] font-bold transition ${
                  isListening
                    ? "border-[#ff3b4e]/40 bg-[#ff3b4e]/[0.06] text-[#ff7b88]"
                    : "border-[#20344d] bg-[#091624] text-[#8da2bb] hover:border-[#42a5ff]/50"
                }`}
              >
                <Mic size={14} className={isListening ? "animate-pulse" : ""} />
                {isListening ? "LISTENING" : "RECORD OBSERVATION"}
              </button>

              <button
                type="button"
                onClick={speakObservation}
                disabled={!notes.trim() || !canCollectEvidence}
                className="flex items-center justify-center gap-2 rounded-lg border border-[#20344d] bg-[#091624] px-3 py-2 text-[9px] font-bold text-[#8da2bb] hover:border-[#42a5ff]/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span>🔊</span>
                READ ALOUD
              </button>
            </div>

            <p className="mt-2 text-[8px] text-[#526a83]">{speechStatus}</p>
          </div>

          {/* NOTES */}

          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={safetyPhase === "DURING_STORM"
              ? "Remote monitoring notes only; do not enter the affected area..."
              : "Describe observations from your approved inspection..."}
            className="mt-2 h-28 w-full resize-none rounded-xl border border-[#20344d] bg-[#091624] p-4 text-xs text-white outline-none placeholder:text-[#526a83] focus:border-[#42a5ff]"
          />

          {/* VOICE EVIDENCE */}

          <button
            type="button"
            onClick={toggleVoiceCapture}
            disabled={actionLoading || !canCollectEvidence}
            className={`mt-2 flex w-full items-center justify-between rounded-xl border p-4 text-left text-xs transition ${
              isRecording
                ? "border-[#ff3b4e]/40 bg-[#ff3b4e]/[0.06] text-[#ff7b88]"
                : voiceFile
                  ? "border-[#24d18a]/30 bg-[#24d18a]/[0.05] text-[#24d18a]"
                  : "border-[#20344d] bg-[#091624] text-[#8da2bb] hover:border-[#ffad32]/50"
            }`}
          >
            <div className="flex items-center gap-3">
              <Mic
                size={17}
                className={isRecording ? "animate-pulse text-[#ff3b4e]" : "text-[#ffad32]"}
              />
              <div>
                <p className="font-semibold">
                  {isRecording
                    ? `Recording voice observation · ${voiceSeconds}s`
                    : voiceFile
                      ? "Voice observation recorded"
                      : "Add voice observation"}
                </p>
                <p className="mt-1 text-[8px] text-[#526a83]">
                  {isRecording
                    ? "Tap again to stop recording."
                    : voiceFile
                      ? "Voice will be uploaded with the field evidence."
                      : "Record a short field observation from the device microphone."}
                </p>
              </div>
            </div>

            <span className="rounded-md border border-current/20 px-2 py-1 text-[7px] font-bold">
              {isRecording ? "STOP" : voiceFile ? "READY" : "REC"}
            </span>
          </button>

          <p className="mt-2 text-[8px] text-[#526a83]">
            The original voice evidence remains in place; the selected language is used for speech-to-text and read-aloud support when supported by the browser.
          </p>

          {/* UPLOAD */}

          <button
            onClick={uploadEvidence}
            disabled={actionLoading || !canCollectEvidence}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#42a5ff] py-3 text-xs font-black text-[#06111e] hover:bg-[#64b4ff] disabled:opacity-50"
          >
            {actionLoading ? (
              <>
                <Loader2
                  size={15}
                  className="animate-spin"
                />
                VERIFYING FIELD EVIDENCE...
              </>
            ) : (
              <>
                <Upload size={15} />
                SUBMIT & VERIFY EVIDENCE
              </>
            )}
          </button>
        </section>

        {/* VERIFICATION */}

        <section className="mt-3 rounded-2xl border border-[#42a5ff]/20 bg-[#42a5ff]/[0.04] p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck
                size={17}
                className="text-[#42a5ff]"
              />

              <h2 className="text-sm font-semibold">
                AI Verification
              </h2>
            </div>

            {verification && (
              <span className="rounded-md border border-[#24d18a]/20 bg-[#24d18a]/[0.06] px-2 py-1 text-[8px] font-bold text-[#24d18a]">
                ANALYSED
              </span>
            )}
          </div>

          <p className="mt-3 text-[10px] leading-5 text-[#8da2bb]">
            Submitted field evidence is checked against the mission
            context, supplied GPS and field observations. AI output is
            advisory; inconsistent or insufficient evidence requires
            human review.
          </p>

          {status === "evidence_uploaded" && !verification && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-[#ffad32]/20 bg-[#ffad32]/[0.05] p-3 text-[10px] text-[#ffad32]">
              <Loader2 size={13} className="animate-spin" />
              Evidence uploaded · waiting for verification
            </div>
          )}

          {verificationError && (
            <div className="mt-4 rounded-lg border border-[#ff3b4e]/20 bg-[#ff3b4e]/[0.05] p-3 text-[10px] leading-4 text-[#ff7b88]">
              <div className="font-semibold">
                Verification error
              </div>
              <div className="mt-1">
                {verificationError}
              </div>
            </div>
          )}

          {verification && (
            <div className="mt-4 space-y-3">
              {(() => {
                const result =
                  verification?.verification ||
                  verification?.result ||
                  verification;

                const reassessment =
                  verification?.reassessment;

                const incidentType =
                  result?.incident_type ||
                  result?.incidentType ||
                  "Not determined";

                const severity =
                  result?.severity ||
                  "Not determined";

                const confidence =
                  result?.confidence ??
                  result?.confidence_score ??
                  "—";

                const locationConsistent =
                  result?.location_consistent;

                const needsHumanReview =
                  Boolean(
                    result?.needs_human_review ??
                      result?.human_review ??
                      false
                  );

                const reason =
                  result?.reason ||
                  result?.review_reason ||
                  "No additional reason supplied.";

                return (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <VerificationMetric
                        label="Incident"
                        value={String(incidentType)}
                      />

                      <VerificationMetric
                        label="Severity"
                        value={String(severity)}
                      />

                      <VerificationMetric
                        label="Confidence"
                        value={
                          typeof confidence === "number"
                            ? confidence <= 1
                              ? confidence.toFixed(2)
                              : String(Math.round(confidence))
                            : String(confidence)
                        }
                      />

                      <VerificationMetric
                        label="GPS consistency"
                        value={
                          locationConsistent === true
                            ? "Consistent"
                            : locationConsistent === false
                              ? "Mismatch"
                              : "Not checked"
                        }
                      />
                    </div>

                    <div
                      className={`rounded-lg border p-3 text-[10px] ${
                        needsHumanReview
                          ? "border-[#ffad32]/25 bg-[#ffad32]/[0.05] text-[#ffad32]"
                          : "border-[#24d18a]/25 bg-[#24d18a]/[0.05] text-[#24d18a]"
                      }`}
                    >
                      <div className="flex items-center gap-2 font-semibold">
                        {needsHumanReview ? (
                          <AlertTriangle size={13} />
                        ) : (
                          <CheckCircle2 size={13} />
                        )}

                        {needsHumanReview
                          ? "Human review required"
                          : "Evidence passed AI checks"}
                      </div>

                      <p className="mt-2 leading-4 text-[#8da2bb]">
                        {reason}
                      </p>
                    </div>

                    {reassessment && (
                      <div className="rounded-lg border border-[#20344d] bg-[#091624] p-3">
                        <div className="flex items-center gap-2">
                          <Navigation
                            size={13}
                            className="text-[#42a5ff]"
                          />

                          <span className="text-[9px] font-semibold">
                            Reassessment
                          </span>
                        </div>

                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <VerificationMetric
                            label="Risk"
                            value={String(
                              reassessment.priority_score ??
                                reassessment.risk_score ??
                                "—"
                            )}
                          />

                          <VerificationMetric
                            label="Next action"
                            value={String(
                              reassessment.next_action ||
                                "Human review"
                            )}
                          />
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[#20344d] pt-3">
                          <div className="rounded-lg border border-[#20344d] p-3">
                            <p className="text-[7px] uppercase tracking-wider text-[#526a83]">Before field evidence</p>
                            <p className="mt-1 text-[10px]">{mission.priority || priority} · risk {mission.risk_score ?? mission.priority_score ?? "Unavailable"}</p>
                          </div>
                          <div className="rounded-lg border border-[#20344d] p-3">
                            <p className="text-[7px] uppercase tracking-wider text-[#526a83]">After reassessment</p>
                            {roadAfter ? (
                              <p className="mt-1 text-[10px]">{roadAfter.field_state || "Status unavailable"} · {roadAfter.operational_priority?.priority || "Priority unavailable"} · risk {roadAfter.predicted_risk?.risk_score ?? "Unavailable"}</p>
                            ) : assetPriorityAfter || assetImpactAfter ? (
                              <p className="mt-1 text-[10px]">{assetPriorityAfter?.priority || "Priority unavailable"} · impact {assetImpactAfter?.impact?.score ?? "Unavailable"}</p>
                            ) : (
                              <p className="mt-1 text-[10px]">Returned after-state unavailable</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </section>

        {/* FOOTER */}

        <div className="flex items-center justify-center gap-2 py-6 text-[9px] text-[#526a83]">
          <Wifi size={11} />
          Field device connected · Sankat OS
        </div>
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-[#20344d] bg-[#091624] p-3">
      <p className="text-[8px] uppercase tracking-wider text-[#526a83]">
        {label}
      </p>

      <p className="mt-1 font-mono text-sm font-bold">
        {value}
      </p>
    </div>
  );
}

function State({
  label,
  active = false,
}: {
  label: string;
  active?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-2 text-center ${
        active
          ? "border-[#24d18a]/30 bg-[#24d18a]/[0.06] text-[#24d18a]"
          : "border-[#20344d] bg-[#091624] text-[#526a83]"
      }`}
    >
      <div className="flex justify-center">
        {active ? (
          <CheckCircle2 size={13} />
        ) : (
          <Clock3 size={13} />
        )}
      </div>

      <p className="mt-1 text-[7px]">
        {label}
      </p>
    </div>
  );
}

function VerificationMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-[#20344d] bg-[#091624] p-3">
      <p className="text-[7px] uppercase tracking-wider text-[#526a83]">
        {label}
      </p>

      <p className="mt-1 truncate text-[10px] font-semibold">
        {value}
      </p>
    </div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center gap-2 rounded-lg border border-[#20344d] bg-[#091624] px-3 py-3 text-[10px] font-bold hover:border-[#42a5ff]/50 hover:bg-[#42a5ff]/5 disabled:opacity-50"
    >
      {icon}
      {label}
    </button>
  );
}


export default function FieldPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#050b14]" />}>
      <FieldPageContent />
    </Suspense>
  );
}

