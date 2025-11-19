import React from "react";
import { HealthCard } from "./HealthCard";

const sampleCells = [
  {
    id: "main",
    title: "Order Processing",
    subtitle: "Cluster A",
    body: "Throughput: 1320 req/min\nErrors: 0.2% (last 5m)",
  },
  {
    id: "right-top",
    title: "Region",
    body: "us-east-1\nAZ: a,b,c",
  },
  {
    id: "right-bottom",
    title: "Owner",
    body: "Team: Payments",
  },
];

export const Demo: React.FC = () => {
  return (
    <div style={{ padding: 20, background: "#020617", minHeight: "100vh" }}>
      <HealthCard
        status="up"
        chartValues={[0.4, 0.5, 0.6, 0.3, 0.9, 0.7, 0.8]}
        layoutVariant="2x2-right-25"
        cells={sampleCells}
        width={700}
      />
    </div>
  );
};
