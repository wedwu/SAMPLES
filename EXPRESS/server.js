const express = require("express");
const cors = require("cors");

// npm install express cors
// node server.js
// http://localhost:4000/api/rides

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/rides", (req, res) => {
  const rides = [
    { name: "Space Mountain", uptime: Math.round(70 + Math.random() * 30) },
    { name: "Pirates of the Caribbean", uptime: Math.round(60 + Math.random() * 40) },
    { name: "Big Thunder Mountain", uptime: Math.round(50 + Math.random() * 50) },
    { name: "Haunted Mansion", uptime: Math.round(65 + Math.random() * 35) },
    { name: "TRON Lightcycle Run", uptime: Math.round(40 + Math.random() * 60) }
  ];

  res.json({ rides });
});

const PORT = 4000;
app.listen(PORT, () => console.log(`Mock API running on http://localhost:${PORT}`));
