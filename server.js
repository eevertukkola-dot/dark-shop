const express = require("express");
const cors = require("cors");
const Stripe = require("stripe");

const app = express();

app.use(cors());
app.use(express.json());

// 🔑 VAIHDA MYÖHEMMIN OIKEAAN KEYHIN
const stripe = Stripe("sk_test_123");

// =====================
// DATA
// =====================
let users = [];
let sessions = {};
let orders = [];

// =====================
// UTILS
// =====================
function makeToken() {
  return Math.random().toString(36).substring(2) + Date.now();
}

// =====================
// TEST ROUTE (ET NÄE ENÄÄ "cannot get")
// =====================
app.get("/", (req, res) => {
  res.send("🔥 Dark Shop API toimii!");
});

// =====================
// SIGNUP
// =====================
app.post("/signup", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.json({ error: "missing" });
  }

  users.push({ username, password });

  res.json({ ok: true });
});

// =====================
// LOGIN
// =====================
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (username === "Ucholand" && password === "Chio9aiw") {
    const token = makeToken();
    sessions[token] = { username, role: "admin" };
    return res.json({ token, role: "admin" });
  }

  const user = users.find(u => u.username === username && u.password === password);

  if (!user) return res.json({ error: "fail" });

  const token = makeToken();
  sessions[token] = { username, role: "user" };

  res.json({ token, role: "user" });
});

// =====================
// STRIPE CHECKOUT
// =====================
app.post("/create-checkout-session", async (req, res) => {
  const sessionUser = sessions[req.body.token];

  if (!sessionUser) {
    return res.json({ error: "not logged in" });
  }

  const cart = req.body.cart || [];

  const line_items = cart.map(p => ({
    price_data: {
      currency: "eur",
      product_data: { name: p.name },
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
    id: "ORD-" + Math.random().toString(36).substring(2, 8),
    user: sessionUser.username,
    total: cart.reduce((a,b)=>a+b.price,0),
    status: "pending"
  };

  orders.push(order);

  res.json({ url: session.url });
});

// =====================
// ADMIN DASHBOARD
// =====================
app.get("/admin/orders/:token", (req, res) => {
  const session = sessions[req.params.token];

  if (!session || session.role !== "admin") {
    return res.json({ error: "no access" });
  }

  const revenue = orders.reduce((sum,o)=>sum+o.total,0);

  res.json({
    orders,
    revenue
  });
});

// =====================
// START SERVER (RENDER FIX)
// =====================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Server running on", PORT);
});
