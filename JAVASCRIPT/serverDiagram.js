import React, {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  MutableRefObject,
} from "react";

// -----------------------------------------------------
// TYPES
// -----------------------------------------------------

interface BoxItem {
  id: string;
  status: "up" | "down";
}

interface ColumnItem {
  color: string;
  boxes: BoxItem[];
}

interface ConnectionItem {
  from: string;
  to: string;
  color: string;

  _sourceCount?: number;
  _sourceIndex?: number;
  _sourceLane?: number;

  _targetCount?: number;
  _targetIndex?: number;
  _targetLane?: number;
}

interface DiagramConfig {
  columns: ColumnItem[];
  connections: ConnectionItem[];
  boxMargin: number;
  baseBoxHeight: number;
  lineSpacing: number;
}

interface BoxMapEntry {
  x: number;
  y: number;
  w: number;
  h: number;
  status: string;
  colIndex: number;
}

interface BoxMap {
  [key: string]: BoxMapEntry;
}

// -----------------------------------------------------
// MAIN COMPONENT
// -----------------------------------------------------

export default function ServerDiagram() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const boxMapRef = useRef<BoxMap>({});
  const boxRefs = useRef<{ [id: string]: HTMLDivElement | null }>({});

  const [config, setConfig] = useState<DiagramConfig | null>(null);

  // -----------------------------------------
  // Fetch Config From API
  // -----------------------------------------
  useEffect(() => {
    fetch("/api/server-diagram") // <--- REPLACE THIS WITH YOUR REAL ENDPOINT
      .then((res) => res.json())
      .then((data) => setConfig(data))
      .catch((err) => console.error("API Error:", err));
  }, []);

  // -----------------------------------------------------
  // LAYOUT CALCULATION (does NOT draw canvas)
  // -----------------------------------------------------
  const computeLayout = () => {
    if (!config) return;

    const maxBoxes = Math.max(...config.columns.map((c) => c.boxes.length));

    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = 1400;
    canvas.height =
      maxBoxes * (config.baseBoxHeight + config.boxMargin * 2);

    const width = canvas.width;
    const height = canvas.height;
    const colWidth = width / config.columns.length;

    boxMapRef.current = {};

    // Compute positions but NOT heights yet (we measure later!)
    config.columns.forEach((column, colIndex) => {
      const boxes = column.boxes;
      const boxHeight = height / maxBoxes;

      boxes.forEach((box, i) => {
        const x = colWidth * colIndex + config.boxMargin;

        let y;
        if (colIndex === 0) {
          if (i === 0) {
            y = config.boxMargin;
          } else {
            const indexFromBottom = boxes.length - i;
            const bottomStart = height - boxHeight + config.boxMargin;
            y = bottomStart - (indexFromBottom - 1) * boxHeight;
          }
        } else {
          y = i * boxHeight + config.boxMargin;
        }

        const w = (colWidth - config.boxMargin * 2) * 0.7;

        boxMapRef.current[box.id] = {
          x,
          y,
          w,
          h: 0, // <-- WILL BE MEASURED LATER
          status: box.status,
          colIndex,
        };
      });
    });
  };

  // -----------------------------------------------------
  // MEASURE BOX HEIGHTS AFTER JSX RENDERS
  // -----------------------------------------------------
  useLayoutEffect(() => {
    if (!config) return;

    Object.entries(boxRefs.current).forEach(([id, el]) => {
      if (el) {
        const h = el.offsetHeight;
        boxMapRef.current[id].h = h;
      }
    });

    drawCanvas();
  });

  // -----------------------------------------------------
  // DRAW CANVAS (lines + border boxes)
  // -----------------------------------------------------
  const drawCanvas = () => {
    if (!config) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const boxMap = boxMapRef.current;

    // Draw box borders
    Object.values(boxMap).forEach(({ x, y, w, h, status }) => {
      ctx.lineWidth = 10;
      ctx.strokeStyle = status === "down" ? "#ff5242" : "#4c5e74";
      ctx.strokeRect(x, y, w, h);
    });

    // Draw Connections
    const maxBoxes = Math.max(...config.columns.map((c) => c.boxes.length));
    const colWidth = canvas.width / config.columns.length;
    const maxLaneWidth = colWidth * 0.25;

    const sourceGroups: { [key: string]: ConnectionItem[] } = {};
    const targetGroups: { [key: string]: ConnectionItem[] } = {};

    config.connections.forEach((conn) => {
      (sourceGroups[conn.from] ||= []).push(conn);
      (targetGroups[conn.to] ||= []).push(conn);
    });

    Object.values(sourceGroups).forEach((conns) => {
      const count = conns.length;
      conns.forEach((conn, idx) => {
        conn._sourceCount = count;
        conn._sourceIndex = idx;
        conn._sourceLane =
          ((count - idx) / (count + 1)) * (maxLaneWidth / config.lineSpacing);
      });
    });

    Object.values(targetGroups).forEach((conns) => {
      const count = conns.length;
      conns.forEach((conn, idx) => {
        conn._targetCount = count;
        conn._targetIndex = idx;
        conn._targetLane =
          ((count - idx) / (count + 1)) * (maxLaneWidth / config.lineSpacing);
      });
    });

    // Draw each connection
    config.connections.forEach((conn) => {
      const startBox = boxMap[conn.from];
      const endBox = boxMap[conn.to];
      if (!startBox || !endBox) return;

      const sourceCount = conn._sourceCount ?? 1;
      const sourceIndex = conn._sourceIndex ?? 0;
      const sourceLane = conn._sourceLane ?? 1;

      const targetCount = conn._targetCount ?? 1;
      const targetIndex = conn._targetIndex ?? 0;
      const targetLane = conn._targetLane ?? 1;

      const start = {
        x: startBox.x + startBox.w,
        y: startBox.y + (startBox.h / (sourceCount + 1)) * (sourceIndex + 1),
      };

      let endY = endBox.y + endBox.h / 2;
      if (targetCount > 1) {
        const spacing = endBox.h / (targetCount + 1);
        endY = endBox.y + spacing * (targetIndex + 1);
      }

      const end = { x: endBox.x, y: endY };

      let midX;
      if (startBox.colIndex === 0 && endBox.colIndex === 1) {
        midX = start.x + config.lineSpacing * sourceLane;
      } else if (startBox.colIndex === 1 && endBox.colIndex === 2) {
        midX = end.x - config.lineSpacing * targetLane;
      } else {
        const dir = endBox.colIndex > startBox.colIndex ? 1 : -1;
        midX = start.x + dir * config.lineSpacing * sourceLane;
      }

      ctx.strokeStyle = conn.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(midX, start.y);
      ctx.lineTo(midX, end.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    });
  };

  // -----------------------------------------------------
  // INITIAL LAYOUT & REDRAW WHEN CONFIG CHANGES
  // -----------------------------------------------------
  useEffect(() => {
    if (!config) return;
    computeLayout();
  }, [config]);

  // -----------------------------------------------------
  // JSX RENDERED OVERLAY BOXES
  // -----------------------------------------------------
  return (
    <div
      ref={containerRef}
      style={{ position: "relative", width: "1400px", marginTop: "20px" }}
    >
      <canvas ref={canvasRef} />

      {config &&
        config.columns.map((column, colIndex) => {
          return column.boxes.map((box) => {
            const pos = boxMapRef.current[box.id];
            if (!pos) return null;

            return (
              <div
                key={box.id}
                ref={(el) => (boxRefs.current[box.id] = el)}
                className="dynamic-box"
                style={{
                  position: "absolute",
                  left: pos.x,
                  top: pos.y,
                  width: pos.w,
                  background: "#1e1d22",
                  padding: "8px",
                  border: `4px solid ${
                    box.status === "down" ? "#ff5242" : "#4c5e74"
                  }`,
                  borderRadius: "5px",
                  color: "white",
                  zIndex: 10,
                }}
              >
                <h3>{box.id}</h3>
                <p>Status: {box.status}</p>
              </div>
            );
          });
        })}
    </div>
  );
}
