import {
  projectLngLat,
  MAP_GRID_LNGS,
  MAP_GRID_LATS,
} from "@/lib/cosmic";

// One meridian line on the flat map. These are the MC/IC lines from the chart,
// each a vertical line at a fixed longitude.
export interface MapLine {
  body: string;
  bodyLabel: string;
  angle: "MC" | "IC";
  lng: number;
  meaning: string;
}

// One love-line city: a place near a relationship-flavoured meridian.
export interface MapCity {
  key: string;
  label: string;
  lat: number;
  lng: number;
  bodyLabel: string;
  angle: "MC" | "IC";
  distanceMiles: number;
}

const VIEW_W = 360;
const VIEW_H = 180;

// A dependency-free equirectangular world map. It draws a faint graticule, the
// vertical meridian lines from the chart, and dots for the love-line cities.
// Everything shares one projection so the markers line up with the grid.
export function CosmicMap({
  lines,
  cities,
}: {
  lines: MapLine[];
  cities: MapCity[];
}) {
  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className="w-full h-auto rounded-xl bg-white/[0.02] border border-white/8"
      role="img"
      aria-label="World map of your astrocartography love lines"
    >
      {/* Graticule */}
      {MAP_GRID_LNGS.map((lng) => {
        const { x } = projectLngLat(lng, 0);
        return (
          <line
            key={`v-${lng}`}
            x1={x * VIEW_W}
            y1={0}
            x2={x * VIEW_W}
            y2={VIEW_H}
            stroke="currentColor"
            strokeWidth={0.3}
            className="text-white/10"
          />
        );
      })}
      {MAP_GRID_LATS.map((lat) => {
        const { y } = projectLngLat(0, lat);
        return (
          <line
            key={`h-${lat}`}
            x1={0}
            y1={y * VIEW_H}
            x2={VIEW_W}
            y2={y * VIEW_H}
            stroke="currentColor"
            strokeWidth={0.3}
            className="text-white/10"
          />
        );
      })}

      {/* Meridian lines from the chart */}
      {lines.map((line, i) => {
        const { x } = projectLngLat(line.lng, 0);
        return (
          <g key={`${line.body}-${line.angle}-${i}`}>
            <line
              x1={x * VIEW_W}
              y1={0}
              x2={x * VIEW_W}
              y2={VIEW_H}
              stroke="currentColor"
              strokeWidth={1}
              strokeDasharray="3 3"
              className="text-primary/60"
            />
            <text
              x={x * VIEW_W + 2}
              y={12}
              className="fill-primary/70"
              style={{ fontSize: 7, fontWeight: 600 }}
            >
              {line.bodyLabel} {line.angle}
            </text>
          </g>
        );
      })}

      {/* Love-line cities */}
      {cities.map((city) => {
        const { x, y } = projectLngLat(city.lng, city.lat);
        return (
          <g key={city.key}>
            <circle
              cx={x * VIEW_W}
              cy={y * VIEW_H}
              r={2.5}
              className="fill-primary"
            />
            <circle
              cx={x * VIEW_W}
              cy={y * VIEW_H}
              r={5}
              className="fill-primary/20"
            />
            <text
              x={x * VIEW_W + 6}
              y={y * VIEW_H + 2.5}
              className="fill-foreground/80"
              style={{ fontSize: 6.5 }}
            >
              {city.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
