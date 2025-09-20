const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const nodemailer = require('nodemailer');
const twilio = require('twilio');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ✅ Fix for COOP/COEP blocking Google login postMessage
app.use((req, res, next) => {
  res.removeHeader("Cross-Origin-Opener-Policy");
  res.removeHeader("Cross-Origin-Embedder-Policy");
  next();
});

// 🔹 MongoDB
const mongoURI = process.env.MONGO_URI;
if (!mongoURI) {
  console.error('MONGO_URI not set in .env. Exiting.');
  process.exit(1);
}

mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// 🔹 Schemas
const foodSchema = new mongoose.Schema({
  food_name: { type: String, required: true },
  price: { type: Number, required: true }
});
const billSchema = new mongoose.Schema({
  customer: {
    name: String,
    email: String,
    mobile: String
  },
  order: [{
    name: String,
    qty: Number,
    price: Number
  }],
  total: Number,
  date: { type: Date, default: Date.now }
});

const Food = mongoose.model('Food', foodSchema);
const Bill = mongoose.model('Bill', billSchema);

// 🔹 API: Fetch foods
app.get('/api/foods', async (req, res) => {
  try {
    const foods = await Food.find().sort({ food_name: 1 });
    res.json(foods);
  } catch (error) {
    console.error('Error fetching foods:', error);
    res.status(500).json({ error: 'Failed to fetch foods' });
  }
});

// 🔹 API: Send Bill (save + send link)
app.post('/api/send-bill', async (req, res) => {
  try {
    const { customer, order } = req.body;
    if (!customer || !customer.name || !customer.email || !customer.mobile) {
      return res.status(400).json({ error: 'Missing customer info' });
    }
    if (!order || !Array.isArray(order) || order.length === 0) {
      return res.status(400).json({ error: 'Order is empty' });
    }

    // Calculate total
    let total = 0;
    order.forEach(item => {
      total += (item.price || 0) * (item.qty || 0);
    });

    // Save bill into DB
    const bill = new Bill({
      customer,
      order,
      total,
    });
    await bill.save();

    // Unique bill link
    const billLink = `${process.env.BASE_URL || 'http://localhost:' + PORT}/bills/${bill._id}`;

    // 🔹 Twilio WhatsApp (if configured)
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM) {
      try {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const client = twilio(accountSid, authToken);

        let whatsappTo = customer.mobile.startsWith('+') ? customer.mobile : '+91' + customer.mobile;

        await client.messages.create({
          from: 'whatsapp:' + process.env.TWILIO_WHATSAPP_FROM.replace(/^whatsapp:/, ''),
          to: 'whatsapp:' + whatsappTo.replace(/^whatsapp:/, ''),
          body: `Hello ${customer.name}, your bill is ready! Click here: ${billLink}`
        });
      } catch (twErr) {
        console.warn('Twilio send warning:', twErr);
      }
    } else {
      console.log('Twilio not configured; skipping WhatsApp send.');
    }

    // 🔹 Nodemailer Email (if configured)
    if (process.env.EMAIL_SERVICE && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      try {
        let transporter = nodemailer.createTransport({
          service: process.env.EMAIL_SERVICE,
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
          }
        });

        await transporter.sendMail({
          from: `"XYZ Restaurant" <${process.env.EMAIL_USER}>`,
          to: customer.email,
          subject: 'Your Bill from XYZ Restaurant',
          text: `Hello ${customer.name},\n\nYour bill is ready. View it here: ${billLink}\n\nThank you!`
        });
      } catch (mailErr) {
        console.warn('Email send warning:', mailErr);
      }
    } else {
      console.log('Email not configured; skipping email send.');
    }

    res.json({ success: true, message: 'Bill saved and link sent.', link: billLink });
  } catch (err) {
    console.error('Send Bill Error:', err);
    res.status(500).json({ error: 'Failed to send bill' });
  }
});

// 🔹 Route: View Bill
app.get('/bills/:id', async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id);
    if (!bill) return res.status(404).send("Bill not found");

    let html = `
      <h2>XYZ Restaurant Bill</h2>
      <p><b>Name:</b> ${bill.customer.name}</p>
      <p><b>Email:</b> ${bill.customer.email}</p>
      <p><b>Mobile:</b> ${bill.customer.mobile}</p>
      <hr>
      <table border="1" cellspacing="0" cellpadding="6">
        <tr><th>Food</th><th>Qty</th><th>Price</th><th>Amount</th></tr>`;

    bill.order.forEach(item => {
      html += `<tr>
        <td>${item.name}</td>
        <td>${item.qty}</td>
        <td>${item.price}</td>
        <td>${item.qty * item.price}</td>
      </tr>`;
    });

    html += `<tr><td colspan="3"><b>Total</b></td><td><b>${bill.total}</b></td></tr></table>`;
    res.send(html);
  } catch (err) {
    console.error('Bill view error:', err);
    res.status(500).send("Error loading bill");
  }
});

// 🔹 Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 🔹 Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
