import React, { useEffect, useRef, useState } from "react";

export default function ServerDiagram() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const [config, setConfig] = useState(null);
  const boxMapRef = useRef({});

  // -----------------------------------------
  // Fetch API JSON (your real backend)
  // -----------------------------------------
  useEffect(() => {
    fetch("YOUR_API_URL_HERE")
      .then((res) => res.json())
      .then((data) => setConfig(data))
      .catch((err) => console.error("API Error:", err));
  }, []);

  // -----------------------------------------
  // Render everything after API loads
  // -----------------------------------------
  useEffect(() => {
    if (!config) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    const ctx = canvas.getContext("2d");

    const maxBoxes = Math.max(...config.columns.map((c) => c.boxes.length));

    canvas.width = 1400;
    canvas.height = maxBoxes * (config.baseBoxHeight + config.boxMargin * 2);

    const width = canvas.width;
    const height = canvas.height;
    const colWidth = width / config.columns.length;

    container.style.width = width + "px";
    container.style.height = height + "px";

    // Reset stored maps + remove old DOM children
    boxMapRef.current = {};
    Array.from(container.children).forEach((child) => {
      if (child.tagName !== "CANVAS") child.remove();
    });

    // -----------------------------------------
    // LAYOUT COLUMNS & CREATE DIV OVERLAYS
    // -----------------------------------------
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
        const h = boxHeight - config.boxMargin * 2;

        boxMapRef.current[box.id] = { x, y, w, h, status: box.status, colIndex };

        // Create overlay DIV
        const div = document.createElement("div");
        div.className = "dynamic-box";
        div.style.left = x + "px";
        div.style.top = y + "px";
        div.style.width = w + "px";
        div.style.height = h + "px";
        div.style.border =
          "4px solid " + (box.status === "down" ? "#ff5242" : "#4c5e74");

        div.style.position = "absolute";
        div.style.zIndex = 10;
        div.style.background = "#1e1d22";
        div.style.padding = "8px";
        div.style.color = "white";
        div.style.borderRadius = "5px";
        div.style.boxSizing = "border-box";

        // Content
        const title = document.createElement("h3");
        title.style.margin = 0;
        title.textContent = box.id;

        const details = document.createElement("p");
        details.style.margin = 0;
        details.style.whiteSpace = "pre-line";
        details.textContent = `Status: ${box.status}
Column: ${colIndex + 1}
Index: ${i}`;

        div.appendChild(title);
        div.appendChild(details);
        container.appendChild(div);
      });
    });

    // -----------------------------------------
    // DRAW CONNECTION LINES + ELBOW ICONS
    // -----------------------------------------
    const boxMap = boxMapRef.current;
    ctx.clearRect(0, 0, width, height);

    ctx.lineWidth = 2;
    const maxLaneWidth = colWidth * 0.25;

    const sourceGroups = {};
    config.connections.forEach((conn) => {
      (sourceGroups[conn.from] ||= []).push(conn);
    });

    Object.values(sourceGroups).forEach((conns) => {
      const count = conns.length;
      conns.forEach((conn, idx) => {
        conn._sourceCount = count;
        conn._sourceIndex = idx;
        const rev = count - idx;
        conn._sourceLane = (rev / (count + 1)) * (maxLaneWidth / config.lineSpacing);
      });
    });

    const targetGroups = {};
    config.connections.forEach((conn) => {
      (targetGroups[conn.to] ||= []).push(conn);
    });

    Object.values(targetGroups).forEach((conns) => {
      const count = conns.length;
      conns.forEach((conn, idx) => {
        conn._targetCount = count;
        conn._targetIndex = idx;
        const rev = count - idx;
        conn._targetLane = (rev / (count + 1)) * (maxLaneWidth / config.lineSpacing);
      });
    });

    config.connections.forEach((conn) => {
      const startBox = boxMap[conn.from];
      const endBox = boxMap[conn.to];
      if (!startBox || !endBox) return;

      const startCol = startBox.colIndex;
      const endCol = endBox.colIndex;

      const count = conn._sourceCount || 1;
      const idx = conn._sourceIndex || 0;

      const start = {
        x: startBox.x + startBox.w,
        y: startBox.y + (startBox.h / (count + 1)) * (idx + 1)
      };

      let endY = endBox.y + endBox.h / 2;
      if (conn._targetCount > 1) {
        const spacing = endBox.h / (conn._targetCount + 1);
        endY = endBox.y + spacing * (conn._targetIndex + 1);
      }

      const end = { x: endBox.x, y: endY };

      let midX;
      if (startCol === 0 && endCol === 1) {
        midX = start.x + config.lineSpacing * conn._sourceLane;
      } else if (startCol === 1 && endCol === 2) {
        midX = end.x - config.lineSpacing * conn._targetLane;
      } else {
        const dir = endCol > startCol ? 1 : -1;
        midX = start.x + dir * config.lineSpacing * (conn._sourceLane || 1);
      }

      // DRAW LINE
      ctx.strokeStyle = conn.color;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(midX, start.y);
      ctx.lineTo(midX, end.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();

      // -----------------------------------------
      // ADD ELBOW ICON FOR STATUS DOWN
      // -----------------------------------------
      if (startBox.status === "down" || endBox.status === "down") {
        const elbow = document.createElement("div");
        elbow.className = "elbow-icon";
        elbow.textContent = "⚠";

        elbow.style.position = "absolute";
        elbow.style.width = "22px";
        elbow.style.height = "22px";
        elbow.style.borderRadius = "50%";
        elbow.style.background = "#ff5242";
        elbow.style.border = "2px solid white";
        elbow.style.display = "flex";
        elbow.style.alignItems = "center";
        elbow.style.justifyContent = "center";
        elbow.style.color = "white";
        elbow.style.fontSize = "14px";
        elbow.style.fontWeight = "bold";
        elbow.style.left = `${midX - 11}px`;
        elbow.style.top = `${end.y - 11}px`;
        elbow.style.zIndex = 20;

        container.appendChild(elbow);
      }
    });

    // -----------------------------------------
    // DRAW CANVAS BOX BORDERS
    // -----------------------------------------
    Object.values(boxMap).forEach(({ x, y, w, h, status }) => {
      ctx.lineWidth = 10;
      ctx.strokeStyle = status === "down" ? "#ff5242" : "#4c5e74";
      ctx.strokeRect(x, y, w, h);
    });
  }, [config]);

  // -----------------------------------------
  // COMPONENT RENDER
  // -----------------------------------------
  return (
    <div
      ref={containerRef}
      style={{ position: "relative", width: "1400px", marginTop: "20px" }}
    >
      <canvas ref={canvasRef} />
    </div>
  );
}
