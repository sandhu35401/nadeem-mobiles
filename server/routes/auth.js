const express = require("express");
const { signToken } = require("../auth");
const router = express.Router();
router.post("/login", (req, res) => {
  const { username, password } = req.body || {};
  if (username !== process.env.ADMIN_USERNAME || password !== process.env.ADMIN_PASSWORD) return res.status(401).json({ error: "Incorrect username or password." });
  res.json({ token: signToken(), shopName: process.env.SHOP_NAME || "Nadeem Mobiles" });
});
module.exports = router;
