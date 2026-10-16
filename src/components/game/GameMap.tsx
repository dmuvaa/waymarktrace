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

function aimYearStem(marker: HTMLElement) {
  const label = marker.querySelector<HTMLElement>(".year-marker__label");
  const stem = marker.querySelector<HTMLElement>(".year-marker__stem");
  if (!label || !stem) return;
  const markerBox = marker.getBoundingClientRect();
  const labelBox = label.getBoundingClientRect();
  const dx = labelBox.left + labelBox.width / 2 - (markerBox.left + markerBox.width / 2);
  const dy = labelBox.top + labelBox.height / 2 - (markerBox.top + markerBox.height / 2);
  const length = Math.hypot(dx, dy);
  const trim = 15;
  if (length < trim + 10) {
    stem.hidden = true;
    return;
  }
  stem.hidden = false;
  stem.style.left = `${13 + (dx / length) * trim}px`;
  stem.style.top = `${13 + (dy / length) * trim}px`;
  stem.style.width = `${length - trim}px`;
  stem.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
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
    <span class="year-marker__stem" hidden></span>
    <span class="year-marker__ring" aria-hidden="true"><span></span></span>
    <span class="year-marker__label">${displayYear(year)}</span>
  `;
  marker.title = `${kind === "birth" ? "Birth" : "Death"}: ${displayYear(year)}`;
  marker.dataset.location = location.name;

  const label = marker.querySelector<HTMLElement>(".year-marker__label");
  if (!label) return marker;
  label.title = "Drag the year if it covers a place name";
  label.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    event.preventDefault();
    label.setPointerCapture(event.pointerId);
    const markerBox = marker.getBoundingClientRect();
    const labelBox = label.getBoundingClientRect();
    const origin = {
      x: event.clientX,
      y: event.clientY,
      left: labelBox.left - markerBox.left,
      top: labelBox.top - markerBox.top,
    };
    label.style.left = "0";
    label.style.right = "auto";
    label.style.top = "0";
    label.style.bottom = "auto";
    label.style.margin = "0";
    label.style.transform = "none";
    label.style.translate = `${origin.left}px ${origin.top}px`;
    label.classList.add("is-dragging");

    const move = (moveEvent: PointerEvent) => {
      moveEvent.stopPropagation();
      moveEvent.preventDefault();
      const x = origin.left + (moveEvent.clientX - origin.x);
      const y = origin.top + (moveEvent.clientY - origin.y);
      label.style.translate = `${x}px ${y}px`;
      aimYearStem(marker);
    };
    const finish = () => {
      label.removeEventListener("pointermove", move);
      label.removeEventListener("pointerup", finish);
      label.removeEventListener("pointercancel", finish);
      label.classList.remove("is-dragging");
      aimYearStem(marker);
    };
    label.addEventListener("pointermove", move);
    label.addEventListener("pointerup", finish);
    label.addEventListener("pointercancel", finish);
  });
  requestAnimationFrame(() => aimYearStem(marker));
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

  const sheet = window.matchMedia("(max-width: 900px) and (orientation: portrait)").matches;
  map.fitBounds(
    [
      [Math.min(birth.longitude, deathLng), Math.min(birth.latitude, death.latitude)],
      [Math.max(birth.longitude, deathLng), Math.max(birth.latitude, death.latitude)],
    ],
    {
      padding: sheet
        ? { top: 64, right: 48, bottom: 230, left: 16 }
        : { top: 80, right: 80, bottom: 80, left: 80 },
      maxZoom: 7,
      duration: 800,
    },
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
  hintsDisabled: boolean;
  hiddenHintDisabled: boolean;
  onHint: () => void;
  onHiddenHint: () => void;
};

function HintIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M8 1.7a3.6 3.6 0 0 0-2.1 6.5c.3.3.5.6.5 1v.3h3.2v-.3c0-.4.2-.7.5-1A3.6 3.6 0 0 0 8 1.7Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path d="M6.4 11.1h3.2M6.9 12.8h2.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function HiddenHintIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M1.6 8S4 4.2 8 4.2 14.4 8 14.4 8 12 11.8 8 11.8 1.6 8 1.6 8Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <circle cx="8" cy="8" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function GameMap({
  figure,
  difficulty,
  resolved,
  hintsDisabled,
  hiddenHintDisabled,
  onHint,
  onHiddenHint,
}: GameMapProps) {
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
      subpixelPositioning: true,
    })
      .setLngLat([figure.birthLocation.longitude, figure.birthLocation.latitude])
      .addTo(map);
    const deathMarker = new maplibregl.Marker({
      element: markerElement("death", figure.deathYear, figure.deathLocation, overlap),
      anchor: "center",
      subpixelPositioning: true,
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
      {!resolved && (
        <div className="map-hint-stack">
          <button type="button" onClick={onHint} disabled={hintsDisabled} aria-label="Hint">
            <HintIcon />
          </button>
          <button type="button" onClick={onHiddenHint} disabled={hiddenHintDisabled} aria-label="Hidden hint">
            <HiddenHintIcon />
          </button>
        </div>
      )}
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
