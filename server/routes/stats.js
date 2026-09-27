const express = require("express");
const { db } = require("../db");
const { requireAuth } = require("../auth");
const router = express.Router();
router.use(requireAuth);
router.get("/", (req, res) => {
  const counts = db.prepare(`SELECT COUNT(*) AS total, SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending, SUM(CASE WHEN status='unlocked' THEN 1 ELSE 0 END) AS active, SUM(CASE WHEN status='locked' THEN 1 ELSE 0 END) AS locked, SUM(CASE WHEN status='release_pending' THEN 1 ELSE 0 END) AS releasing, SUM(CASE WHEN status='released' THEN 1 ELSE 0 END) AS released, COALESCE(SUM(total_amount),0) AS total_amount, COALESCE(SUM(paid_amount),0) AS paid_amount FROM customers`).get();
  const overdue = db.prepare(`SELECT COUNT(*) AS count FROM customers WHERE next_due_date IS NOT NULL AND date(next_due_date)<date('now') AND (total_amount-paid_amount)>0`).get().count;
  const dueSoon = db.prepare(`SELECT COUNT(*) AS count FROM customers WHERE next_due_date IS NOT NULL AND date(next_due_date) BETWEEN date('now') AND date('now','+7 day') AND (total_amount-paid_amount)>0`).get().count;
  res.json({ ...counts, outstanding: Number(counts.total_amount||0)-Number(counts.paid_amount||0), overdue:Number(overdue||0), dueSoon:Number(dueSoon||0) });
});
module.exports = router;
