const encoder = new TextEncoder();

const json = (data, status = 200, extraHeaders = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", ...extraHeaders }
});

function b64urlBytes(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function b64urlText(text) { return b64urlBytes(new TextEncoder().encode(text)); }
function fromB64url(s) {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const raw = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return new Uint8Array([...raw].map(c => c.charCodeAt(0)));
}

async function hmacKey(secret) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
async function signJwt(payload, secret) {
  const head = b64urlText(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64urlText(JSON.stringify(payload));
  const input = `${head}.${body}`;
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(input)));
  return `${input}.${b64urlBytes(sig)}`;
}
async function verifyJwt(token, secret) {
  try {
    const [h, p, s] = String(token || "").split(".");
    if (!h || !p || !s) return null;
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(secret), fromB64url(s), encoder.encode(`${h}.${p}`));
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(p)));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  const allowed = String(env.CORS_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
  const headers = {};
  if (origin && (allowed.includes("*") || allowed.includes(origin))) {
    headers["access-control-allow-origin"] = origin;
    headers["access-control-allow-credentials"] = "true";
  }
  headers["access-control-allow-headers"] = "Content-Type, Authorization";
  headers["access-control-allow-methods"] = "GET,POST,PATCH,DELETE,OPTIONS";
  headers["vary"] = "Origin";
  return headers;
}

async function body(request) {
  try { return await request.json(); } catch { return {}; }
}
function randomBytes(n = 32) { const a = new Uint8Array(n); crypto.getRandomValues(a); return a; }
function token(n = 32) { return b64urlBytes(randomBytes(n)); }
function pairingCode() { return String(Math.floor(100000 + Math.random() * 900000)); }
async function uniqueCode(db) {
  for (let i = 0; i < 50; i++) {
    const c = pairingCode();
    const row = await db.prepare("SELECT 1 AS ok FROM customers WHERE pairing_code=? LIMIT 1").bind(c).first();
    if (!row) return c;
  }
  throw new Error("Could not generate pairing code.");
}
async function logEvent(db, customerId, action, detail = null) {
  await db.prepare("INSERT INTO events(customer_id,action,detail) VALUES(?,?,?)").bind(customerId ?? null, action, detail).run();
}
async function getCustomer(db, id) { return db.prepare("SELECT * FROM customers WHERE id=?").bind(id).first(); }
async function recalcPaid(db, customerId) {
  const row = await db.prepare("SELECT COALESCE(SUM(amount),0) AS paid FROM payments WHERE customer_id=?").bind(customerId).first();
  await db.prepare("UPDATE customers SET paid_amount=? WHERE id=?").bind(Number(row?.paid || 0), customerId).run();
}

let fcmCache = { token: null, exp: 0 };
function pemToBytes(pem) {
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----/g, "").replace(/-----END PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}
async function googleAccessToken(env) {
  const now = Math.floor(Date.now() / 1000);
  if (fcmCache.token && fcmCache.exp > now + 60) return fcmCache.token;
  if (!env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) throw new Error("Firebase server credentials are not configured.");
  const iat = now, exp = now + 3600;
  const header = b64urlText(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64urlText(JSON.stringify({
    iss: env.FIREBASE_CLIENT_EMAIL,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat, exp
  }));
  const unsigned = `${header}.${claim}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToBytes(env.FIREBASE_PRIVATE_KEY),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, encoder.encode(unsigned)));
  const assertion = `${unsigned}.${b64urlBytes(sig)}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion })
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error(data.error_description || data.error || "Could not obtain Firebase access token.");
  fcmCache = { token: data.access_token, exp: now + Number(data.expires_in || 3600) };
  return data.access_token;
}
function firebaseProjectId(env) {
  const configured = String(env.FCM_PROJECT_ID || "").trim();
  if (configured && !configured.startsWith("REPLACE_")) return configured;
  const email = String(env.FIREBASE_CLIENT_EMAIL || "").trim();
  const m = email.match(/@([^@]+)\.iam\.gserviceaccount\.com$/);
  return m ? m[1] : "";
}

async function sendFcm(env, tokenValue, data) {
  const projectId = firebaseProjectId(env);
  if (!projectId) throw new Error("Firebase project ID is not configured.");
  const accessToken = await googleAccessToken(env);
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "content-type": "application/json; charset=UTF-8" },
    body: JSON.stringify({ message: { token: tokenValue, data } })
  });
  const text = await response.text();
  if (!response.ok) throw new Error(text.slice(0, 500) || `FCM HTTP ${response.status}`);
  return text ? JSON.parse(text) : {};
}

async function requireAdmin(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const tokenValue = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const payload = await verifyJwt(tokenValue, env.JWT_SECRET || "");
  return payload?.sub === "admin" ? payload : null;
}

async function handle(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (path === "/") return json({ ok: true, service: "nadeem-mobiles-api", version: "2.5.0" });
  if (path === "/api/health") return json({ ok: true, service: "nadeem-mobiles-api", time: new Date().toISOString() });

  if (path === "/api/login" && request.method === "POST") {
    const b = await body(request);
    if (String(b.username || "") !== String(env.ADMIN_USERNAME || "admin") || String(b.password || "") !== String(env.ADMIN_PASSWORD || "")) {
      return json({ error: "Incorrect username or password." }, 401);
    }
    const now = Math.floor(Date.now()/1000);
    const jwt = await signJwt({ sub: "admin", iat: now, exp: now + 12*60*60 }, env.JWT_SECRET);
    return json({ token: jwt, shopName: env.SHOP_NAME || "Nadeem Mobiles" });
  }

  // Public device endpoints: 6-digit pairing, heartbeat and release acknowledgement.
  if (path === "/api/device/pair" && request.method === "POST") {
    const b = await body(request);
    const code = String(b.pairingCode || "");
    const fcmToken = String(b.fcmToken || "");
    if (!/^\d{6}$/.test(code)) return json({ error: "Enter the valid 6-digit pairing code." }, 400);
    const c = await env.DB.prepare("SELECT * FROM customers WHERE pairing_code=? LIMIT 1").bind(code).first();
    if (!c) return json({ error: "That pairing code is invalid." }, 404);
    if (c.status === "released") return json({ error: "This enrollment has already been released." }, 410);
    if (c.fcm_token || c.device_secret) return json({ error: "This pairing code has already been used." }, 409);
    const secret = token();
    await env.DB.prepare("UPDATE customers SET fcm_token=?,device_secret=?,device_model=?,status='unlocked',last_seen=datetime('now'),release_token=NULL,released_at=NULL WHERE id=?")
      .bind(fcmToken, secret, String(b.deviceModel || ""), c.id).run();
    await logEvent(env.DB, c.id, "paired", String(b.deviceModel || "") || null);
    return json({ ok:true, customerId:c.id, customerName:c.name, shopName:env.SHOP_NAME || "Nadeem Mobiles", shopPhone:env.SHOP_PHONE || "", deviceSecret:secret });
  }
  if (path === "/api/device/heartbeat" && request.method === "POST") {
    const b = await body(request), c = await getCustomer(env.DB, Number(b.customerId));
    if (!c) return json({ error: "Unknown device." }, 404);
    if (c.status === "released") return json({ error: "This device enrollment has been released." }, 410);
    if (!b.deviceSecret || b.deviceSecret !== c.device_secret) return json({ error: "Device authentication failed." }, 401);
    if (b.fcmToken && b.fcmToken !== c.fcm_token) await env.DB.prepare("UPDATE customers SET fcm_token=? WHERE id=?").bind(String(b.fcmToken), c.id).run();
    await env.DB.prepare("UPDATE customers SET last_seen=datetime('now') WHERE id=?").bind(c.id).run();
    return json({ ok:true, status:c.status, deviceSecret:c.device_secret });
  }
  if (path === "/api/device/release-ack" && request.method === "POST") {
    const b = await body(request), c = await getCustomer(env.DB, Number(b.customerId));
    if (!c || c.device_secret !== b.deviceSecret) return json({ error: "Device authentication failed." }, 401);
    if (c.status !== "release_pending" || c.release_token !== b.releaseToken) return json({ error: "No matching active release request." }, 409);
    await env.DB.prepare("UPDATE customers SET status='released',fcm_token=NULL,device_secret=NULL,release_token=NULL,released_at=datetime('now'),last_seen=datetime('now') WHERE id=?").bind(c.id).run();
    await logEvent(env.DB, c.id, "released");
    return json({ ok:true, status:"released" });
  }

  const admin = await requireAdmin(request, env);
  if (!admin) return json({ error: "Authentication required." }, 401);

  if (path === "/api/stats" && request.method === "GET") {
    const counts = await env.DB.prepare(`SELECT COUNT(*) AS total, SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending, SUM(CASE WHEN status='unlocked' THEN 1 ELSE 0 END) AS active, SUM(CASE WHEN status='locked' THEN 1 ELSE 0 END) AS locked, SUM(CASE WHEN status='release_pending' THEN 1 ELSE 0 END) AS releasing, SUM(CASE WHEN status='released' THEN 1 ELSE 0 END) AS released, COALESCE(SUM(total_amount),0) AS total_amount, COALESCE(SUM(paid_amount),0) AS paid_amount FROM customers`).first();
    const overdue = await env.DB.prepare(`SELECT COUNT(*) AS count FROM customers WHERE next_due_date IS NOT NULL AND date(next_due_date)<date('now') AND (total_amount-paid_amount)>0`).first();
    const dueSoon = await env.DB.prepare(`SELECT COUNT(*) AS count FROM customers WHERE next_due_date IS NOT NULL AND date(next_due_date) BETWEEN date('now') AND date('now','+7 day') AND (total_amount-paid_amount)>0`).first();
    return json({ ...counts, outstanding:Number(counts?.total_amount||0)-Number(counts?.paid_amount||0), overdue:Number(overdue?.count||0), dueSoon:Number(dueSoon?.count||0) });
  }

  if (path === "/api/customers" && request.method === "GET") {
    const rows = await env.DB.prepare(`SELECT c.*, (c.total_amount-c.paid_amount) AS outstanding, CASE WHEN c.next_due_date IS NOT NULL AND date(c.next_due_date)<date('now') AND (c.total_amount-c.paid_amount)>0 THEN 1 ELSE 0 END AS overdue FROM customers c ORDER BY c.created_at DESC`).all();
    return json(rows.results || []);
  }
  if (path === "/api/customers" && request.method === "POST") {
    const b = await body(request), name=String(b.name||"").trim(), phone=String(b.phoneNumber||"").trim(), total=Number(b.totalAmount||0);
    const installment = b.installmentAmount==="" || b.installmentAmount==null ? null : Number(b.installmentAmount);
    if (!name || !phone) return json({ error:"Customer name and phone number are required." },400);
    if (!Number.isFinite(total) || total<0) return json({ error:"Total amount must be a valid number." },400);
    if (installment!=null && (!Number.isFinite(installment)||installment<=0)) return json({ error:"Installment amount must be a positive number." },400);
    const code = await uniqueCode(env.DB);
    const result = await env.DB.prepare(`INSERT INTO customers(name,phone_number,total_amount,installment_amount,next_due_date,notes,pairing_code,status) VALUES(?,?,?,?,?,?,?,'pending')`)
      .bind(name,phone,total,installment,b.nextDueDate||null,String(b.notes||"").trim()||null,code).run();
    const id = result.meta.last_row_id;
    await logEvent(env.DB,id,"customer_created");
    return json({ id, pairingCode:code },201);
  }

  const m = path.match(/^\/api\/customers\/(\d+)(?:\/(.*))?$/);
  if (m) {
    const id = Number(m[1]), action = m[2] || "", c = await getCustomer(env.DB,id);
    if (!c) return json({ error:"Customer not found." },404);

    if (!action && request.method === "PATCH") {
      if (c.status === "released") return json({ error:"Released records are read-only." },409);
      const b = await body(request);
      const total=b.totalAmount==null||b.totalAmount===""?c.total_amount:Number(b.totalAmount);
      if (!Number.isFinite(total)||total<0) return json({ error:"Total amount must be a valid number." },400);
      const inst=b.installmentAmount==null||b.installmentAmount===""?null:Number(b.installmentAmount);
      await env.DB.prepare(`UPDATE customers SET name=?,phone_number=?,total_amount=?,installment_amount=?,next_due_date=?,notes=? WHERE id=?`)
        .bind(String(b.name??c.name).trim(),String(b.phoneNumber??c.phone_number).trim(),total,inst,b.nextDueDate??c.next_due_date??null,String(b.notes??c.notes??"").trim()||null,id).run();
      await logEvent(env.DB,id,"customer_updated");
      return json({ok:true});
    }
    if (!action && request.method === "DELETE") {
      if (["unlocked","locked","release_pending"].includes(c.status) || c.fcm_token) return json({ error:"Release the enrolled device before removing this customer." },409);
      await env.DB.prepare("DELETE FROM customers WHERE id=?").bind(id).run();
      return json({ok:true});
    }
    if (action === "events" && request.method === "GET") {
      const rows=await env.DB.prepare("SELECT * FROM events WHERE customer_id=? ORDER BY at DESC,id DESC LIMIT 100").bind(id).all(); return json(rows.results||[]);
    }
    if (action === "payments" && request.method === "GET") {
      const rows=await env.DB.prepare("SELECT * FROM payments WHERE customer_id=? ORDER BY paid_at DESC,id DESC").bind(id).all(); return json(rows.results||[]);
    }
    if (action === "re-enroll" && request.method === "POST") {
      if (c.status !== "released") return json({error:"Only a released enrollment can be re-enrolled."},409);
      const code=await uniqueCode(env.DB);
      await env.DB.prepare("UPDATE customers SET pairing_code=?,fcm_token=NULL,device_secret=NULL,release_token=NULL,status='pending',released_at=NULL,last_seen=NULL WHERE id=?").bind(code,id).run();
      await logEvent(env.DB,id,"re_enrollment_created"); return json({ok:true,pairingCode:code});
    }
    if (action === "regenerate-code" && request.method === "POST") {
      if (c.status !== "pending") return json({error:"Pairing code can only be regenerated before enrollment."},409);
      const code=await uniqueCode(env.DB); await env.DB.prepare("UPDATE customers SET pairing_code=? WHERE id=?").bind(code,id).run(); await logEvent(env.DB,id,"pairing_code_regenerated"); return json({ok:true,pairingCode:code});
    }
    const cmd = action === "lock" || action === "unlock" || action === "release";
    if (cmd && request.method === "POST") {
      if (!c.fcm_token) return json({error:"Device is not currently enrolled and controllable."},400);
      try {
        if (action === "lock") {
          if (!['unlocked','locked'].includes(c.status)) return json({error:"Device is not currently enrolled and controllable."},400);
          const b=await body(request);
          await sendFcm(env,c.fcm_token,{type:"LOCK",shopName:env.SHOP_NAME||"Nadeem Mobiles",shopPhone:env.SHOP_PHONE||"",message:String(b.message||"")});
          await env.DB.prepare("UPDATE customers SET status='locked' WHERE id=?").bind(id).run(); await logEvent(env.DB,id,"locked",String(b.message||"")||null); return json({ok:true,status:"locked"});
        }
        if (action === "unlock") {
          if (c.status !== "locked") return json({error:"Device is not currently locked."},400);
          await sendFcm(env,c.fcm_token,{type:"UNLOCK"});
          await env.DB.prepare("UPDATE customers SET status='unlocked' WHERE id=?").bind(id).run(); await logEvent(env.DB,id,"unlocked"); return json({ok:true,status:"unlocked"});
        }
        if (action === "release") {
          if (!['unlocked','locked'].includes(c.status)) return json({error:"Device is not ready for release."},400);
          const releaseToken=token(); await sendFcm(env,c.fcm_token,{type:"RELEASE",releaseToken});
          await env.DB.prepare("UPDATE customers SET status='release_pending',release_token=? WHERE id=?").bind(releaseToken,id).run(); await logEvent(env.DB,id,"release_requested"); return json({ok:true,status:"release_pending"});
        }
      } catch (e) { return json({error:`${action} command failed: ${e.message}`},502); }
    }
  }

  if (path === "/api/payments" && request.method === "GET") {
    const limit=Math.min(Math.max(Number(url.searchParams.get("limit")||200),1),500); const rows=await env.DB.prepare(`SELECT p.*,c.name AS customer_name,c.phone_number FROM payments p JOIN customers c ON c.id=p.customer_id ORDER BY p.paid_at DESC,p.id DESC LIMIT ?`).bind(limit).all(); return json(rows.results||[]);
  }
  const pm=path.match(/^\/api\/payments\/customer\/(\d+)$/);
  if (pm && request.method === "POST") {
    const customerId=Number(pm[1]), b=await body(request), amount=Number(b.amount), ref=String(b.reference||"").trim()||null, note=String(b.note||"").trim()||null;
    if(!Number.isFinite(amount)||amount<=0) return json({error:"Enter a valid payment amount."},400);
    const c=await getCustomer(env.DB,customerId); if(!c) return json({error:"Customer not found."},404);
    const p=await env.DB.prepare("INSERT INTO payments(customer_id,amount,reference,note) VALUES(?,?,?,?)").bind(customerId,amount,ref,note).run(); await recalcPaid(env.DB,customerId); await logEvent(env.DB,customerId,"payment_recorded",`Rs. ${amount.toLocaleString()}${ref?` · ${ref}`:""}`);
    const updated=await getCustomer(env.DB,customerId); return json({paymentId:p.meta.last_row_id,customer:updated},201);
  }
  const pd=path.match(/^\/api\/payments\/(\d+)$/);
  if(pd && request.method==="DELETE") { const p=await env.DB.prepare("SELECT * FROM payments WHERE id=?").bind(Number(pd[1])).first(); if(!p)return json({error:"Payment not found."},404); await env.DB.prepare("DELETE FROM payments WHERE id=?").bind(Number(pd[1])).run(); await recalcPaid(env.DB,p.customer_id); await logEvent(env.DB,p.customer_id,"payment_deleted",`Payment #${p.id}`); return json({ok:true}); }

  if (path === "/api/devices" && request.method === "GET") { const rows=await env.DB.prepare(`SELECT id,name,phone_number,device_model,status,last_seen,created_at,released_at FROM customers ORDER BY created_at DESC`).all(); return json(rows.results||[]); }
  if (path === "/api/enrollments" && request.method === "GET") { const rows=await env.DB.prepare(`SELECT id,name,phone_number,pairing_code,device_model,status,last_seen,created_at,released_at FROM customers WHERE status IN ('pending','unlocked','locked','release_pending','released') ORDER BY created_at DESC`).all(); return json(rows.results||[]); }
  if (path === "/api/activity" && request.method === "GET") { const rows=await env.DB.prepare(`SELECT e.id,e.customer_id,c.name AS customer_name,e.action,e.detail,e.at FROM events e LEFT JOIN customers c ON c.id=e.customer_id ORDER BY e.at DESC,e.id DESC LIMIT 150`).all(); return json(rows.results||[]); }

  return json({error:"Not found"},404);
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    try {
      const response = await handle(request, env);
      const headers = new Headers(response.headers);
      for (const [k,v] of Object.entries(cors)) headers.set(k,v);
      return new Response(response.body, { status: response.status, headers });
    } catch (error) {
      return json({ error: "Internal server error." }, 500, cors);
    }
  }
};
