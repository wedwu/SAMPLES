import React, { useEffect, useRef, useState } from "react";

type Status = "up" | "down";

type LayoutVariant =
  | "1x1"
  | "2col-25-right"
  | "4col-2row-special"
  | "2x2-right-25"
  | "2x2-right-33";

interface CellContent {
  id: string;
  title?: string;
  subtitle?: string;
  body?: string;
  // You can add arbitrary JSON fields here as needed
}

interface HealthCardProps {
  status: Status;
  chartValues: number[]; // health data history
  layoutVariant: LayoutVariant;
  cells: CellContent[];
  width?: string | number; // e.g. "100%", "600px", 480
}

// Simple menu placeholder – you can expand this
const QuickMenu: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <div
      style={{
        position: "absolute",
        top: "40px",
        right: "12px",
        background: "#1f2933",
        color: "#f9fafb",
        padding: "8px 12px",
        borderRadius: 6,
        boxShadow: "0 4px 18px rgba(0,0,0,0.35)",
        zIndex: 20,
        minWidth: 160,
        fontSize: 13,
      }}
    >
      <div style={{ marginBottom: 6, fontWeight: 600 }}>Actions</div>
      <button
        style={{
          all: "unset",
          cursor: "pointer",
          display: "block",
          padding: "4px 0",
        }}
      >
        View details
      </button>
      <button
        style={{
          all: "unset",
          cursor: "pointer",
          display: "block",
          padding: "4px 0",
        }}
      >
        Open logs
      </button>
      <button
        style={{
          all: "unset",
          cursor: "pointer",
          display: "block",
          padding: "4px 0",
          color: "#f97373",
        }}
        onClick={onClose}
      >
        Close
      </button>
    </div>
  );
};

export const HealthCard: React.FC<HealthCardProps> = ({
  status,
  chartValues,
  layoutVariant,
  cells,
  width = "100%",
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const isDown = status === "down";

  // Colors driven by status
  const accentColor = isDown ? "#ef4444" : "#22c55e"; // red / green
  const accentSoft = isDown ? "rgba(239,68,68,0.25)" : "rgba(34,197,94,0.25)";

  // --------- AREA CHART RENDERING (CANVAS) ----------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    const data = chartValues.length > 0 ? chartValues : [0];

    // Normalize data to 0–1
    const max = Math.max(...data, 0);
    const min = Math.min(...data, 0);

    const range = max - min || 1; // avoid 0 range
    const toY = (value: number) => {
      const normalized = (value - min) / range; // 0..1
      return h - normalized * h; // invert for canvas
    };

    ctx.beginPath();
    ctx.moveTo(0, h); // start at bottom-left

    const stepX = data.length > 1 ? w / (data.length - 1) : w;

    data.forEach((v, idx) => {
      const x = idx * stepX;
      const y = toY(v);
      ctx.lineTo(x, y);
    });

    ctx.lineTo(w, h); // bottom-right
    ctx.closePath();

    // Fill
    ctx.fillStyle = accentSoft;
    ctx.fill();

    // Stroke line
    ctx.beginPath();
    data.forEach((v, idx) => {
      const x = idx * stepX;
      const y = toY(v);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [chartValues, accentColor, accentSoft]);

  // --------- LAYOUT RENDERING (FLEXBOX) ----------

  const renderCell = (cell?: CellContent) => {
    if (!cell) return null;

    return (
      <div style={{ padding: "8px 10px" }}>
        {cell.title && (
          <h2
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 600,
              marginBottom: 2,
            }}
          >
            {cell.title}
          </h2>
        )}
        {cell.subtitle && (
          <h3
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 500,
              color: "#9ca3af",
              marginBottom: 4,
            }}
          >
            {cell.subtitle}
          </h3>
        )}
        {cell.body && (
          <p
            style={{
              margin: 0,
              fontSize: 13,
              lineHeight: 1.4,
              whiteSpace: "pre-line",
            }}
          >
            {cell.body}
          </p>
        )}
      </div>
    );
  };

  const renderLayoutBody = () => {
    switch (layoutVariant) {
      case "1x1": {
        // 1 column, 1 row
        return (
          <div style={{ display: "flex", flexDirection: "row", gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>{renderCell(cells[0])}</div>
          </div>
        );
      }

      case "2col-25-right": {
        // 2 columns, right column is 25% width
        return (
          <div style={{ display: "flex", flexDirection: "row", gap: 8 }}>
            <div style={{ flex: 3, minWidth: 0 }}>{renderCell(cells[0])}</div>
            <div style={{ flex: 1, minWidth: 0 }}>{renderCell(cells[1])}</div>
          </div>
        );
      }

      case "4col-2row-special": {
        // 4 columns, 2 rows
        // Top row: merge first 3 columns into 1 big left (75%), right 25%
        // Bottom row: 4 columns, last column aligned with top right (25%)
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {/* Top row */}
            <div style={{ display: "flex", flexDirection: "row", gap: 8 }}>
              <div style={{ flex: 3, minWidth: 0 }}>
                {renderCell(cells[0])}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {renderCell(cells[1])}
              </div>
            </div>
            {/* Bottom row */}
            <div style={{ display: "flex", flexDirection: "row", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {renderCell(cells[2])}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {renderCell(cells[3])}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {renderCell(cells[4])}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {renderCell(cells[5])}
              </div>
            </div>
          </div>
        );
      }

      case "2x2-right-25": {
        // 2 columns, 2 rows
        // Left column rows merged (full height left)
        // Right column is 25% width (split into 2 rows)
        return (
          <div style={{ display: "flex", flexDirection: "row", gap: 8 }}>
            <div style={{ flex: 3, minWidth: 0 }}>
              {renderCell(cells[0]) /* big left spanning both rows */}
            </div>
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div style={{ flex: 1 }}>{renderCell(cells[1])}</div>
              <div style={{ flex: 1 }}>{renderCell(cells[2])}</div>
            </div>
          </div>
        );
      }

      case "2x2-right-33": {
        // 2 columns, 2 rows
        // Left column rows merged, right column rows 33% width
        // Interpretation: Right side ~1/3 width, left ~2/3
        return (
          <div style={{ display: "flex", flexDirection: "row", gap: 8 }}>
            <div style={{ flex: 2, minWidth: 0 }}>
              {renderCell(cells[0]) /* big left */}
            </div>
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div style={{ flex: 1 }}>{renderCell(cells[1])}</div>
              <div style={{ flex: 1 }}>{renderCell(cells[2])}</div>
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  // --------- MAIN RENDER ----------
  return (
    <div
      style={{
        position: "relative",
        width,
        maxWidth: "100%",
        background: "#111827",
        borderRadius: 12,
        padding: 12,
        boxSizing: "border-box",
        color: "#f9fafb",
        boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {/* Top bar with chart + menu */}
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "row",
          alignItems: "stretch",
        }}
      >
        {/* Chart wrapper */}
        <div style={{ flex: 1 }}>
          <canvas
            ref={canvasRef}
            width={600}
            height={80}
            style={{
              width: "100%",
              height: 80,
              display: "block",
              borderRadius: 8,
              background: "#020617",
            }}
          />
        </div>

        {/* Quick menu button in upper right */}
        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          style={{
            position: "absolute",
            right: 8,
            top: 4,
            width: 32,
            height: 32,
            borderRadius: "999px",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            background: accentColor,
            color: "#0b1120",
            boxShadow: "0 2px 6px rgba(0,0,0,0.45)",
          }}
        >
          {/* Hamburger icon */}
          <span
            style={{
              display: "block",
              width: 14,
              height: 2,
              background: "#020617",
              borderRadius: 999,
              boxShadow: "0 5px 0 #020617, 0 -5px 0 #020617",
            }}
          />
        </button>

        {menuOpen && <QuickMenu onClose={() => setMenuOpen(false)} />}
      </div>

      {/* Body layout – flexbox based on variant */}
      <div>{renderLayoutBody()}</div>
    </div>
  );
};
