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

app.get('/api/foods', async (req, res) => {
  try {
    const foods = await Food.find().sort({ food_name: 1 });
    res.json(foods);
  } catch (error) {
    console.error('Error fetching foods:', error);
    res.status(500).json({ error: 'Failed to fetch foods' });
  }
});

app.post('/api/send-bill', async (req, res) => {
  try {
    const { customer, order } = req.body;
    if (!customer || !customer.name || !customer.email || !customer.mobile) {
      return res.status(400).json({ error: 'Missing customer info' });
    }
    if (!order || !Array.isArray(order) || order.length === 0) {
      return res.status(400).json({ error: 'Order is empty' });
    }

    let total = 0;
    let billText = `Bill for ${customer.name}\n`;
    order.forEach((item, i) => {
      const amount = (item.price || 0) * (item.qty || 0);
      total += amount;
      billText += `${i + 1}. ${item.name} x ${item.qty} @ ₹${item.price} = ₹${amount}\n`;
    });
    billText += `Total: ₹${total.toFixed(2)}\nThank you for visiting!`;

    // Save bill into DB
    const bill = new Bill({
      customer: { name: customer.name, email: customer.email, mobile: customer.mobile },
      order,
      total,
    });
    await bill.save();

    // Twilio WhatsApp (only if configured)
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM) {
      try {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const client = twilio(accountSid, authToken);

        let whatsappTo = customer.mobile.startsWith('+') ? customer.mobile : '+91' + customer.mobile;

        await client.messages.create({
          from: 'whatsapp:' + process.env.TWILIO_WHATSAPP_FROM.replace(/^whatsapp:/, ''),
          to: 'whatsapp:' + whatsappTo.replace(/^whatsapp:/, ''),
          body: billText
        });
      } catch (twErr) {
        console.warn('Twilio send warning:', twErr);
        // continue, don't fail entire request
      }
    } else {
      console.log('Twilio not configured; skipping WhatsApp send.');
    }

    // Nodemailer Email (only if configured)
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
          text: billText
        });
      } catch (mailErr) {
        console.warn('Email send warning:', mailErr);
        // continue
      }
    } else {
      console.log('Email not configured; skipping email send.');
    }

    res.json({ success: true, message: 'Bill saved. Attempts made to send via WhatsApp / Email.' });
  } catch (err) {
    console.error('Send Bill Error:', err);
    res.status(500).json({ error: 'Failed to send bill' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
