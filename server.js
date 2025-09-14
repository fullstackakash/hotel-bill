const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config(); // Load .env

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB connection
const mongoURI = process.env.MONGO_URI;

mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected successfully'))
.catch(err => console.error('MongoDB connection error:', err));

// Define Schemas and Models
const foodSchema = new mongoose.Schema({
  food_name: { type: String, required: true },
  price: { type: Number, required: true }
});
const billSchema = new mongoose.Schema({
  customer: {
    name: String,
    mobile: String,
    address: String
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

// API to get foods
app.get('/api/foods', async (req, res) => {
  try {
    const foods = await Food.find().sort({ food_name: 1 });
    res.json(foods);
  } catch (error) {
    console.error('Error fetching foods:', error);
    res.status(500).json({ error: 'Failed to fetch foods' });
  }
});

// API to generate bill and save it
app.post('/api/bill', async (req, res) => {
  try {
    const { order, customer } = req.body;
    if (!order || !Array.isArray(order) || order.length === 0) {
      return res.status(400).json({ error: 'No valid order data received' });
    }

    const customerName = customer?.name || '';
    const customerMobile = customer?.mobile || '';
    const customerAddress = customer?.address || '';

    let total = 0;
    const missing = [];
    const processedItems = [];

    for (const item of order) {
      if (!item.name || !item.qty) continue;

      const foodItem = await Food.findOne({ food_name: item.name });
      if (!foodItem) {
        missing.push(item.name);
        continue;
      }

      const qty = Math.max(1, parseInt(item.qty, 10));
      const price = Number(foodItem.price || 0);
      const amount = price * qty;
      total += amount;
      processedItems.push({ name: item.name, qty, price, amount });
    }

    if (processedItems.length === 0) {
      return res.json({
        html: '<div><h3>No valid items in order</h3></div>',
        text: 'No valid items in order',
        total: total.toFixed(2),
        missing
      });
    }

    const billHtml = generateBillHtml(processedItems, customerName, customerMobile, customerAddress, total, missing);

    const bill = new Bill({
      customer: { name: customerName, mobile: customerMobile, address: customerAddress },
      order: processedItems.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
      total
    });

    await bill.save();

    let textToSpeak = `Your bill: `;
    processedItems.forEach(i => {
      textToSpeak += `${i.name} ${i.qty} quantity, `;
    });
    textToSpeak += `Total ${total.toFixed(2)} rupees.`;
    if (missing.length > 0) textToSpeak += ` Missing items: ${missing.join(', ')}.`;

    res.json({ html: billHtml, text: textToSpeak, total: total.toFixed(2), missing });

  } catch (error) {
    console.error('Error generating bill:', error);
    res.status(500).json({ error: 'Failed to generate bill' });
  }
});

// Function to generate bill HTML
function generateBillHtml(items, customerName, customerMobile, customerAddress, total, missing) {
  let html = `<div id="bill-print-area" style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5;">`;
  html += `<div style="text-align:center; margin-bottom: 10px;">
            <img src="/logo.png" alt="Restaurant Logo" style="max-height:60px;"><br>
            <h2 style="margin:5px 0;">Bill Invoice</h2>
          </div>`;
  html += `<div style='margin-bottom:10px;'>
            <strong>Customer Name:</strong> ${escapeHtml(customerName)}<br>
            <strong>Mobile No:</strong> ${escapeHtml(customerMobile)}<br>`;
  if (customerAddress) {
    html += `<strong>Address:</strong> ${escapeHtml(customerAddress).replace(/\n/g, '<br>')}<br>`;
  }
  html += `</div>`;
  html += `<table width="100%" cellspacing="0" cellpadding="6" style="border-collapse: collapse; border: 1px solid #444; font-size: 13px;">
            <thead>
              <tr style="background: #f2f2f2; text-align: center;">
                <th style="border: 1px solid #444; width: 5%;">#</th>
                <th style="border: 1px solid #444; width: 40%; text-align: left;">Item</th>
                <th style="border: 1px solid #444; width: 15%;">Qty</th>
                <th style="border: 1px solid #444; width: 20%;">Rate (₹)</th>
                <th style="border: 1px solid #444; width: 20%;">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>`;

  let sn = 1;
  for (const it of items) {
    html += `<tr>
                <td style='border: 1px solid #444; text-align: center;'>${sn}</td>
                <td style='border: 1px solid #444; text-align: left;'>${escapeHtml(it.name)}</td>
                <td style='border: 1px solid #444; text-align: center;'>${it.qty}</td>
                <td style='border: 1px solid #444; text-align: right;'>${it.price.toFixed(2)}</td>
                <td style='border: 1px solid #444; text-align: right;'>${it.amount.toFixed(2)}</td>
              </tr>`;
    sn++;
  }

  html += `<tr>
            <td colspan='4' style='border: 1px solid #444; text-align: right; font-weight: bold;'>Total</td>
            <td style='border: 1px solid #444; text-align: right; font-weight: bold;'>${total.toFixed(2)}</td>
          </tr>`;

  html += `</tbody></table>`;

  if (missing && missing.length > 0) {
    html += `<div style="margin-top: 15px; color: #d32f2f; font-weight: bold;">Missing items: ${missing.join(', ')}</div>`;
  }

  html += `<div style="margin-top: 15px; font-style: italic;">Generated on ${new Date().toLocaleString()}</div>`;
  html += `</div>`;

  return html;
}

// Helper to escape HTML
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
