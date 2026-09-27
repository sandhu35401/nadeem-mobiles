const express = require("express");
const { db, logEvent, recalcPaidAmount } = require("../db");
const { requireAuth } = require("../auth");
const router = express.Router();
router.use(requireAuth);
router.get("/", (req,res)=>{ const limit=Math.min(Math.max(Number(req.query.limit||200),1),500); res.json(db.prepare(`SELECT p.*, c.name AS customer_name, c.phone_number FROM payments p JOIN customers c ON c.id=p.customer_id ORDER BY p.paid_at DESC,p.id DESC LIMIT ?`).all(limit)); });
router.post("/customer/:id", (req,res)=>{
  const customerId=Number(req.params.id), amount=Number(req.body?.amount), reference=String(req.body?.reference||"").trim()||null, note=String(req.body?.note||"").trim()||null;
  if(!Number.isFinite(amount)||amount<=0) return res.status(400).json({error:"Enter a valid payment amount."});
  const customer=db.prepare(`SELECT * FROM customers WHERE id=?`).get(customerId); if(!customer) return res.status(404).json({error:"Customer not found."});
  const payment=db.prepare(`INSERT INTO payments(customer_id,amount,reference,note) VALUES(?,?,?,?)`).run(customerId,amount,reference,note); recalcPaidAmount(customerId); logEvent(customerId,"payment_recorded",`Rs. ${amount.toLocaleString()}${reference?` · ${reference}`:""}`); res.status(201).json({paymentId:payment.lastInsertRowid,customer:db.prepare(`SELECT * FROM customers WHERE id=?`).get(customerId)});
});
router.delete("/:id",(req,res)=>{ const p=db.prepare(`SELECT * FROM payments WHERE id=?`).get(req.params.id); if(!p)return res.status(404).json({error:"Payment not found."}); db.prepare(`DELETE FROM payments WHERE id=?`).run(req.params.id); recalcPaidAmount(p.customer_id); logEvent(p.customer_id,"payment_deleted",`Payment #${p.id}`); res.json({ok:true}); });
module.exports=router;
