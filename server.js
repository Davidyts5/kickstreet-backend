const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const Paystack = require('paystack')('sk_test_3068c44381398ee52310084762f1c9f358efc60d'); // Replace with your Paystack secret key
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'your-fake-secret-key-change-in-prod'; // Update for real use

// Middleware - "Plugs" that handle requests
app.use(cors()); // Allows frontend to call backend
app.use(bodyParser.json()); // Reads JSON from requests

// Fake DB Setup - "Fakes" storage with JSON files
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
const ordersFile = path.join(dataDir, 'orders.json');
const usersFile = path.join(dataDir, 'users.json');
if (!fs.existsSync(ordersFile)) fs.writeFileSync(ordersFile, JSON.stringify([])); // Empty orders list
if (!fs.existsSync(usersFile)) fs.writeFileSync(usersFile, JSON.stringify([])); // Empty users list

// Email "Faking" - Sends real emails via Gmail (setup your app password)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'davidlucasonorigho@gmail.com', // Replace with YOUR Gmail
    pass: 'kliezmvflfdparoi' // Generate from Gmail settings > Security > App passwords
  }
});

// Fake Auth Middleware - "Fakes" login check for admin stuff
const authenticateToken = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token provided.' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token.' });
    req.user = user;
    next(); // Proceed if good
  });
};

// Route 1: Fake Signup (Admin creates account - optional flex)
app.post('/api/signup', async (req, res) => {
  const { email, password } = req.body;
  const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
  const hashedPw = await bcrypt.hash(password, 10); // "Fakes" secure password
  const newUser = { id: Date.now(), email, password: hashedPw };
  users.push(newUser);
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
  res.json({ message: 'User faked—login now.' });
});

// Route 2: Fake Login (Gets token for admin dashboard)
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
  const user = users.find(u => u.email === email);
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Wrong email/password.' });
  }
  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, message: 'Logged in—use for admin.' });
});

// Route 3: Initiate Payment (Frontend calls this to start Paystack)
app.post('/api/initiate-payment', (req, res) => {
  const { email, amount, items } = req.body; // From frontend cart
  Paystack.transaction.initialize({
    amount: amount * 100, // Convert to kobo (Paystack units)
    email,
    callback_url: 'https://your-frontend.com/success', // Update to your KickStreet live URL
    metadata: { items: JSON.stringify(items) } // Fake "fake" items in metadata
  }).then(response => {
    res.json({ status: true, data: response.data }); // Returns Paystack popup data
  }).catch(error => {
    res.status(500).json({ status: false, error: error.message });
  });
});

// Route 4: Verify Payment & "Fake Save" Order (Core "Fake" Backend)
app.get('/api/verify-payment/:reference', (req, res) => {
  const reference = req.params.reference;
  Paystack.transaction.verify(reference).then(response => {
    if (response.data.status === 'success') {
      // "Fake" DB Save - Add to JSON file
      const orders = JSON.parse(fs.readFileSync(ordersFile, 'utf8'));
      const newOrder = {
        id: Date.now(), // Fake ID
        reference,
        items: JSON.parse(response.data.metadata.items || '[]'), // From frontend
        total: response.data.amount / 100, // Back to Naira
        email: response.data.customer.email,
        status: 'paid', // Fake status
        date: new Date().toISOString()
      };
      orders.push(newOrder);
      fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2)); // Save to file

      // Fake Email - Sends real email to customer
      transporter.sendMail({
        from: 'admin@kickstreet.com', // Your "fake" sender
        to: response.data.customer.email,
        subject: 'Order Confirmed - KickStreet (Fake Test)',
        html: `
          <h1>Thanks for Shopping!</h1>
          <p>Ref: ${reference}</p>
          <p>Total: ₦${newOrder.total.toLocaleString()}</p>
          <p>Items: ${newOrder.items.map(i => i.name).join(', ')}</p>
          <p>Order faked & saved—check dashboard!</p>
        `
      }).catch(console.error); // Logs errors if email fails

      res.json({ status: true, data: response.data, orderId: newOrder.id }); // Frontend gets success
    } else {
      res.status(400).json({ status: false, message: 'Payment failed—try again.' });
    }
  }).catch(error => {
    res.status(500).json({ status: false, error: error.message });
  });
});

// Route 5: Get All Orders (Fake Admin Dashboard - Needs Login Token)
app.get('/api/orders', authenticateToken, (req, res) => {
  const orders = JSON.parse(fs.readFileSync(ordersFile, 'utf8'));
  res.json(orders); // Returns all "faked" orders as JSON
});

// Route 6: Update Order Status (Fake Admin Action)
app.put('/api/orders/:id', authenticateToken, (req, res) => {
  const id = parseInt(req.params.id);
  const { status } = req.body; // e.g., 'shipped'
  const orders = JSON.parse(fs.readFileSync(ordersFile, 'utf8'));
  const order = orders.find(o => o.id === id);
  if (order) {
    order.status = status;
    fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2));
    res.json({ message: 'Order status faked—updated.' });
  } else {
    res.status(404).json({ error: 'Order not found.' });
  }
});

// Route 7: Fake Dashboard Stats (For Admin Frontend)
app.get('/api/dashboard', authenticateToken, (req, res) => {
  const orders = JSON.parse(fs.readFileSync(ordersFile, 'utf8'));
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
  res.json({ totalOrders, totalRevenue, recent: orders.slice(-5) }); // Fake stats
});

// Start Server
app.listen(PORT, () => {
  console.log(`Fake backend beast running on http://localhost:${PORT}`);
  console.log('Test: Open browser to http://localhost:${PORT}/api/orders (empty at first)');
});
