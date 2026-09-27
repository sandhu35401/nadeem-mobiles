require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");

const app = express();
const allowedOrigins = (process.env.CORS_ORIGINS || "").split(",").map(v => v.trim()).filter(Boolean);
app.use(cors({ origin(origin, cb) { if (!origin || allowedOrigins.includes(origin)) return cb(null, true); return cb(null, false); } }));
app.use(express.json({ limit: "64kb" }));

app.get("/api/health", (req, res) => res.json({ ok: true, service: "nadeem-mobiles-platform", time: new Date().toISOString() }));
app.use("/api", require("./routes/auth"));
app.use("/api/stats", require("./routes/stats"));
app.use("/api/customers", require("./routes/customers"));
app.use("/api/payments", require("./routes/payments"));
app.use("/api/device", require("./routes/device"));
app.get("/api/devices", require("./auth").requireAuth, (req, res) => {
  const { db } = require("./db");
  res.json(db.prepare(`SELECT id, name, phone_number, device_model, status, last_seen, created_at, released_at FROM customers ORDER BY created_at DESC`).all());
});
app.get("/api/enrollments", require("./auth").requireAuth, (req, res) => {
  const { db } = require("./db");
  res.json(db.prepare(`SELECT id, name, phone_number, pairing_code, device_model, status, last_seen, created_at, released_at FROM customers WHERE status IN ('pending','unlocked','locked','release_pending','released') ORDER BY created_at DESC`).all());
});
app.get("/api/activity", require("./auth").requireAuth, (req, res) => {
  const { db } = require("./db");
  res.json(db.prepare(`SELECT e.id, e.customer_id, c.name AS customer_name, e.action, e.detail, e.at FROM events e LEFT JOIN customers c ON c.id=e.customer_id ORDER BY e.at DESC, e.id DESC LIMIT 150`).all());
});

app.use(express.static(path.join(__dirname, "public")));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
app.listen(PORT, HOST, () => console.log(`Nadeem Mobiles API listening on ${HOST}:${PORT}`));
