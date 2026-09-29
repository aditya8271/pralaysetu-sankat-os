"use client";

import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";

// GeoJSON supports Leaflet's onEachFeature callback, but some
// react-leaflet type versions omit it from GeoJSONProps.
const GeoJSONLayer = GeoJSON as any;
const TileLayerWithAttribution = TileLayer as any;
const MapContainerWithProps = MapContainer as any;

type Mission = {
  id: string;
  asset: string;
  risk: number;
  cascade: number;
  affected: number;
  status: string;
};

type OperationalMapProps = {
  missions?: Mission[];
  selectedMissionId?: string;
  onMissionSelect?: (assetId: string) => void;
};

function MapFocus({
  selectedMission,
}: {
  selectedMission?: Mission;
}) {
  const map = useMap();

  useEffect(() => {
    if (!selectedMission) return;

    // Exact road focus will be connected after
    // ROAD-* mission IDs are mapped to OSM geometry.
  }, [selectedMission, map]);

  return null;
}

export default function OperationalMap({
  missions = [],
  selectedMissionId,
  onMissionSelect,
}: OperationalMapProps) {
  const [mapData, setMapData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadMap() {
      try {
        setLoading(true);

        const response = await fetch(
          "http://127.0.0.1:8001/api/operational-map"
        );

        if (!response.ok) {
          throw new Error(
            `Operational map request failed: ${response.status}`
          );
        }

        const data = await response.json();

        setMapData(data);
        setError("");
      } catch (err) {
        console.error("Operational map error:", err);
        setError("Failed to load Puri operational map.");
      } finally {
        setLoading(false);
      }
    }

    loadMap();
  }, []);

  const features = mapData?.features || [];

  const roadFeatures = features.filter(
    (feature: any) => feature.geometry?.type !== "Point"
  );

  const assetFeatures = features.filter(
    (feature: any) => feature.geometry?.type === "Point"
  );

  /* -------------------------------- */
  /* ROAD → MISSION MATCHING           */
  /* -------------------------------- */

  function getMissionForRoad(
    roadOsmId: string | number
  ) {
    return missions.find((mission) => {
      const missionRoadId = String(
        mission.asset || ""
      );

      return (
        missionRoadId === `ROAD-${roadOsmId}` ||
        missionRoadId === String(roadOsmId)
      );
    });
  }

  /* -------------------------------- */
  /* ASSET COLORS                      */
  /* -------------------------------- */

  function getAssetColor(type: string = "") {
    const value = type.toLowerCase();

    if (
      value.includes("hospital") ||
      value.includes("clinic")
    ) {
      return "#42a5ff";
    }

    if (
      value.includes("power") ||
      value.includes("tower") ||
      value.includes("electric")
    ) {
      return "#ffad32";
    }

    if (value.includes("police")) {
      return "#a78bfa";
    }

    if (value.includes("fuel")) {
      return "#ff3b4e";
    }

    if (value.includes("shelter")) {
      return "#24d18a";
    }

    return "#42a5ff";
  }

  /* -------------------------------- */
  /* ASSET → MISSION MATCHING          */
  /* -------------------------------- */

  function getMissionForAsset(assetId: string) {
    return missions.find(
      (mission) => mission.asset === assetId
    );
  }

  /* -------------------------------- */
  /* MISSION COLOR                     */
  /* -------------------------------- */

  function getMissionColor(mission?: Mission) {
    if (!mission) {
      return "#52708b";
    }

    if (mission.risk >= 85) {
      return "#ff3b4e";
    }

    if (mission.risk >= 60) {
      return "#ffad32";
    }

    return "#24d18a";
  }

  return (
    <div className="relative h-full w-full">

      {/* ============================= */}
      {/* LOADING                        */}
      {/* ============================= */}

      {loading && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-[#091827]">
          <div className="rounded-lg border border-[#20344d] bg-[#0c1a2b] px-4 py-3">
            <p className="text-[10px] text-[#c6d2df]">
              Loading Puri operational map...
            </p>
          </div>
        </div>
      )}

      {/* ============================= */}
      {/* ERROR                          */}
      {/* ============================= */}

      {error && (
        <div className="absolute left-3 top-3 z-[1000] rounded-lg border border-[#ff3b4e]/30 bg-[#07111f]/95 px-3 py-2">
          <p className="text-[9px] text-[#ff7b88]">
            {error}
          </p>
        </div>
      )}

      {/* ============================= */}
      {/* MAP                            */}
      {/* ============================= */}

      <MapContainerWithProps
        center={[19.8135, 85.8312]}
        zoom={13}
        scrollWheelZoom={true}
        className="h-full w-full"
      >

        {/* OPENSTREETMAP BASE MAP */}

        <TileLayerWithAttribution
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* SELECTED MISSION */}

        <MapFocus
          selectedMission={missions.find(
            (mission) =>
              mission.id === selectedMissionId
          )}
        />

        {/* ============================= */}
        {/* REAL OSM ROADS                 */}
        {/* ============================= */}

        {roadFeatures.length > 0 && (
          <GeoJSONLayer
            data={{
              type: "FeatureCollection",
              features: roadFeatures,
            }}
            onEachFeature={(
              feature: any,
              layer: any
            ) => {
              const roadName =
                feature?.properties?.name ||
                "Unnamed road";

              const roadOsmId = String(
                feature?.properties?.osm_id || ""
              );

              const mission =
                getMissionForRoad(roadOsmId);

              if (mission) {
                layer.bindTooltip(
                  `${
                    mission.risk >= 85
                      ? "P0"
                      : "P1"
                  } · ${
                    mission.asset
                  } · ${
                    roadName
                  } · Risk ${
                    mission.risk
                  }`,
                  {
                    sticky: true,
                  }
                );

                layer.on("click", () => {
                  onMissionSelect?.(
                    mission.asset
                  );
                });
              }
            }}
          />
        )}

        {/* ============================= */}
        {/* INFRASTRUCTURE ASSETS           */}
        {/* ============================= */}

        {assetFeatures.map(
          (
            feature: any,
            index: number
          ) => {
            const coordinates =
              feature.geometry.coordinates;

            const longitude =
              coordinates[0];

            const latitude =
              coordinates[1];

            const properties =
              feature.properties || {};

            const assetId =
              properties.id ||
              `ASSET-${index}`;

            const assetName =
              properties.name ||
              properties.type ||
              "Infrastructure";

            const assetType =
              properties.type ||
              "asset";

            const mission =
              getMissionForAsset(
                String(assetId)
              );

            const selected =
              mission?.id ===
              selectedMissionId;

            const markerColor =
              mission
                ? getMissionColor(mission)
                : getAssetColor(
                    assetType
                  );

            return (
              <CircleMarker
                key={`${assetId}-${index}`}
                center={[
                  latitude,
                  longitude,
                ]}
                {...({
                  radius:
                  selected
                    ? 11
                    : mission
                      ? 8
                      : 6,
                } as any)}
                pathOptions={{
                  color: selected
                    ? "#42a5ff"
                    : markerColor,

                  fillColor:
                    markerColor,

                  fillOpacity: 0.9,

                  weight: selected
                    ? 4
                    : 2,
                }}
                eventHandlers={{
                  click: () => {
                    onMissionSelect?.(
                      String(assetId)
                    );
                  },
                }}
              >
                <Popup>
                  <div className="min-w-[190px]">

                    <div className="text-sm font-bold">
                      {assetName}
                    </div>

                    <div className="mt-2 text-xs">

                      <div>
                        <strong>ID:</strong>{" "}
                        {assetId}
                      </div>

                      <div>
                        <strong>Type:</strong>{" "}
                        {assetType}
                      </div>

                      <div>
                        <strong>Source:</strong>{" "}
                        {properties.source ||
                          "OpenStreetMap"}
                      </div>

                      {mission && (
                        <div className="mt-2 border-t pt-2">

                          <div>
                            <strong>
                              Mission:
                            </strong>{" "}
                            {mission.id}
                          </div>

                          <div>
                            <strong>
                              Risk:
                            </strong>{" "}
                            {mission.risk}
                          </div>

                          <div>
                            <strong>
                              Cascade:
                            </strong>{" "}
                            {mission.cascade}
                          </div>

                          <div>
                            <strong>
                              Affected:
                            </strong>{" "}
                            {mission.affected}
                          </div>

                        </div>
                      )}

                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          }
        )}

      </MapContainerWithProps>
    </div>
  );
}