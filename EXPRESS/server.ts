import express, { Request, Response } from "express";
import cors from "cors";

// npm install express cors @types/express @types/cors
// tsc
// node dist/server.js

const app = express();
app.use(cors());
app.use(express.json());

type Ride = {
  name: string;
  uptime: number; // 0–100
};

app.get("/api/rides", (req: Request, res: Response) => {
  const rides: Ride[] = [
    { name: "Space Mountain", uptime: Math.round(70 + Math.random() * 30) },
    { name: "Pirates of the Caribbean", uptime: Math.round(60 + Math.random() * 40) },
    { name: "Big Thunder Mountain", uptime: Math.round(50 + Math.random() * 50) },
    { name: "Haunted Mansion", uptime: Math.round(65 + Math.random() * 35) },
    { name: "TRON Lightcycle Run", uptime: Math.round(40 + Math.random() * 60) }
  ];

  res.json({ rides });
});

const PORT = 4000;
app.listen(PORT, () => console.log(`Mock TS API running on http://localhost:${PORT}`));
