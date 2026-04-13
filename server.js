const express = require("express");
const cors = require("cors");
const Stripe = require("stripe");

const app = express();

app.use(cors());
app.use(express.json());

// 🔑 STRIPE KEY (vaihda tähän sun oma sk_test key)
const stripe = Stripe("sk_test_YOUR_KEY_HERE");

// =====================
// DATA
// =====================
let users = [];
let orders = [];
let sessions = {};
let coupons = {};

// =====================
// UTILS
// =====================
function makeToken() {
  return Math.random().toString(36).substring(2) + Date.now();
}

// =====================
// SIGNUP
// =====================
app.post("/signup", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "missing fields" });
  }

  if (users.find(u => u.username === username)) {
    return res.status(400).json({ message: "user exists" });
  }

  users.push({ username, password });

  res.json({ ok: true });
});

// =====================
// LOGIN
// =====================
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  // ADMIN
  if (username === "Ucholand" && password === "Chio9aiw") {
    const token = makeToken();
    sessions[token] = { username, role: "admin" };

    return res.json({ token, username, role: "admin" });
  }

  // USER
  const user = users.find(u => u.username === username && u.password === password);

  if (!user) {
    return res.status(401).json({ message: "login failed" });
  }

  const token = makeToken();
  sessions[token] = { username, role: "user" };

  res.json({ token, username, role: "user" });
});

// =====================
// COUPONS
// =====================
app.post("/coupon", (req, res) => {
  const session = sessions[req.body.token];

  if (!session || session.role !== "admin") {
    return res.status(403).json({ message: "not admin" });
  }

  const { code, discount, maxUses } = req.body;

  coupons[code] = {
    discount: Number(discount),
    maxUses: Number(maxUses) || null,
    uses: 0
  };

  res.json({ ok: true });
});

app.get("/coupons", (req, res) => {
  res.json(coupons);
});

app.delete("/coupon/:code", (req, res) => {
  delete coupons[req.params.code];
  res.json({ ok: true });
});

app.get("/coupon/:code", (req, res) => {
  const c = coupons[req.params.code];

  if (!c) return res.json({ valid: false });

  if (c.maxUses && c.uses >= c.maxUses) {
    return res.json({ valid: false });
  }

  res.json({ valid: true, discount: c.discount });
});

// =====================
// ORDER (CREATE STRIPE SESSION)
// =====================
app.post("/create-checkout-session", async (req, res) => {
  const sessionUser = sessions[req.body.token];

  if (!sessionUser) {
    return res.status(401).json({ error: "not logged in" });
  }

  const { cart } = req.body;

  const line_items = cart.map(p => ({
    price_data: {
      currency: "eur",
      product_data: {
        name: p.name
      },
      unit_amount: Math.round(p.price * 100),
    },
    quantity: 1
  }));

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    line_items,
    success_url: "https://example.com/success",
    cancel_url: "https://example.com/cancel"
  });

  const order = {
    id: "ORD-" + Math.random().toString(36).substring(2, 8).toUpperCase(),
    user: sessionUser.username,
    cart,
    status: "pending",
    stripeSessionId: session.id,
    total: cart.reduce((a, b) => a + b.price, 0)
  };

  orders.push(order);

  res.json({ url: session.url });
});

// =====================
// STRIPE WEBHOOK (OPTIONAL FUTURE)
// =====================
app.post("/webhook", express.raw({ type: "application/json" }), (req, res) => {
  res.json({ received: true });
});

// =====================
// ADMIN DASHBOARD
// =====================
app.get("/admin/orders/:token", (req, res) => {
  const session = sessions[req.params.token];

  if (!session || session.role !== "admin") {
    return res.status(403).json({ error: "no access" });
  }

  const revenue = orders
    .filter(o => o.status === "paid")
    .reduce((sum, o) => sum + o.total, 0);

  res.json({
    orders,
    revenue
  });
});

// =====================
// START SERVER
// =====================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Server running on", PORT);
});