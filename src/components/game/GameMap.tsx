"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import type { Difficulty, HistoricalFigure, Location } from "@/types/game";

const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";
maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

function displayYear(year: number) {
  return year < 0 ? `${Math.abs(year)} BCE` : `${year}`;
}

function markerElement(
  kind: "birth" | "death",
  year: number,
  location: Location,
  offsetLabel: boolean,
) {
  const marker = document.createElement("div");
  marker.className = `year-marker year-marker--${kind}${offsetLabel ? " year-marker--offset" : ""}`;
  marker.setAttribute(
    "aria-label",
    `${kind === "birth" ? "Birth" : "Death"} marker, ${displayYear(year)}. Location hidden until the round is resolved.`,
  );
  marker.innerHTML = `
    <span class="year-marker__ring" aria-hidden="true"><span></span></span>
    <span class="year-marker__label">${displayYear(year)}</span>
  `;
  marker.title = `${kind === "birth" ? "Birth" : "Death"}: ${displayYear(year)}`;
  marker.dataset.location = location.name;
  return marker;
}

function distanceBetweenLocations(a: Location, b: Location) {
  const lat = a.latitude - b.latitude;
  const lng = Math.min(
    Math.abs(a.longitude - b.longitude),
    360 - Math.abs(a.longitude - b.longitude),
  );
  return Math.hypot(lat, lng);
}

function frameLocations(map: MapLibreMap, figure: HistoricalFigure) {
  const birth = figure.birthLocation;
  const death = figure.deathLocation;
  let deathLng = death.longitude;
  const directDifference = Math.abs(birth.longitude - death.longitude);
  if (directDifference > 180) {
    deathLng += birth.longitude > death.longitude ? 360 : -360;
  }

  if (distanceBetweenLocations(birth, death) < 0.08) {
    map.easeTo({
      center: [birth.longitude, birth.latitude],
      zoom: 9,
      duration: 800,
    });
    return;
  }

  map.fitBounds(
    [
      [Math.min(birth.longitude, deathLng), Math.min(birth.latitude, death.latitude)],
      [Math.max(birth.longitude, deathLng), Math.max(birth.latitude, death.latitude)],
    ],
    { padding: { top: 80, right: 80, bottom: 80, left: 80 }, maxZoom: 7, duration: 800 },
  );
}

function applyDifficulty(map: MapLibreMap, difficulty: Difficulty) {
  if (difficulty === "easy") return;
  for (const layer of map.getStyle().layers ?? []) {
    const id = layer.id.toLowerCase();
    const hideLabel = layer.type === "symbol";
    const hideBoundary =
      (difficulty === "hard" || difficulty === "super-hard") &&
      layer.type === "line" &&
      (id.includes("boundary") || id.includes("admin") || id.includes("border"));
    const keepOnSuperHard =
      layer.type === "background" ||
      (layer.type === "fill" && id === "water");
    const hideForSuperHard = difficulty === "super-hard" && !keepOnSuperHard;
    if (hideLabel || hideBoundary || hideForSuperHard) {
      map.setLayoutProperty(layer.id, "visibility", "none");
    }
  }
}

type GameMapProps = {
  figure: HistoricalFigure;
  difficulty: Difficulty;
  resolved: boolean;
};

export function GameMap({ figure, difficulty, resolved }: GameMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [mapError, setMapError] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [10, 20],
      zoom: 1.2,
      minZoom: 0.8,
      maxZoom: 12,
      attributionControl: false,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(
      new maplibregl.AttributionControl({ compact: true, customAttribution: "Waymarktrace" }),
      "bottom-right",
    );

    map.on("style.load", () => {
      applyDifficulty(map, difficulty);
      setMapReady(true);
    });
    map.on("error", (event) => {
      if (event.error?.message?.toLowerCase().includes("style")) setMapError(true);
    });

    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      markersRef.current.forEach((marker) => marker.remove());
      map.remove();
      mapRef.current = null;
    };
  }, [difficulty]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    markersRef.current.forEach((marker) => marker.remove());
    const overlap = distanceBetweenLocations(figure.birthLocation, figure.deathLocation) < 0.15;
    const birthMarker = new maplibregl.Marker({
      element: markerElement("birth", figure.birthYear, figure.birthLocation, false),
      anchor: "center",
    })
      .setLngLat([figure.birthLocation.longitude, figure.birthLocation.latitude])
      .addTo(map);
    const deathMarker = new maplibregl.Marker({
      element: markerElement("death", figure.deathYear, figure.deathLocation, overlap),
      anchor: "center",
    })
      .setLngLat([figure.deathLocation.longitude, figure.deathLocation.latitude])
      .addTo(map);
    markersRef.current = [birthMarker, deathMarker];
    frameLocations(map, figure);
  }, [figure, mapReady]);

  if (mapError) {
    return (
      <div className="map-error" role="alert">
        <p>The map could not be loaded.</p>
        <button type="button" onClick={() => window.location.reload()}>
          Retry map
        </button>
      </div>
    );
  }

  return (
    <div className="map-shell">
      <div
        ref={containerRef}
        className="game-map"
        role="region"
        aria-label={`Interactive world map with a green birth marker for ${displayYear(figure.birthYear)} and a red death marker for ${displayYear(figure.deathYear)}.`}
      />
      {!mapReady && <div className="map-loading">Drawing the map…</div>}
      <div className="map-legend" aria-hidden="true">
        <span><i className="legend-dot legend-dot--birth" />Born</span>
        <span><i className="legend-dot legend-dot--death" />Died</span>
      </div>
      <button
        className="map-reset"
        type="button"
        onClick={() => mapRef.current && frameLocations(mapRef.current, figure)}
      >
        Reframe clues
      </button>
      {resolved && (
        <div className="map-place-names" aria-live="polite">
          <span><b>Born</b> {figure.birthLocation.name}</span>
          <span><b>Died</b> {figure.deathLocation.name}</span>
        </div>
      )}
    </div>
  );
}
