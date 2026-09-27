const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET || "";
if (!SECRET) throw new Error("JWT_SECRET is required.");

function signToken() {
  return jwt.sign({ role: "owner" }, SECRET, { expiresIn: "12h" });
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Not logged in." });
  try {
    const claims = jwt.verify(token, SECRET);
    if (claims.role !== "owner") throw new Error("bad role");
    req.user = claims;
    next();
  } catch {
    return res.status(401).json({ error: "Session expired, please sign in again." });
  }
}

module.exports = { signToken, requireAuth };
