document.addEventListener('DOMContentLoaded', () => {
  const TTS_LANG = 'en-IN';
  const currency = amt => `₹${Number(amt).toFixed(2)}`;

  // Elements
  const loginContainer = document.getElementById('loginContainer');
  const billingContainer = document.getElementById('billingContainer');
  const userInfoDisplay = document.getElementById('userInfoDisplay');
  const userNameSpan = document.getElementById('userName');
  const userEmailSpan = document.getElementById('userEmail');
  const logoutBtn = document.getElementById('logoutBtn');
  const datalist = document.getElementById('foods');
  const orderForm = document.getElementById('orderForm');
  const orderList = document.getElementById('orderList');
  const billArea = document.getElementById('billArea');
  const generateBillBtn = document.getElementById('generateBill');
  const printBtn = document.getElementById('printBtn');
  const downloadPDFBtn = document.getElementById('downloadPDF');
  const sendBillBtn = document.getElementById('sendBillBtn');
  const userInfoModal = document.getElementById('userInfoModal');
  const userInfoForm = document.getElementById('userInfoForm');
  const cancelUserInfoBtn = document.getElementById('cancelUserInfo');
  const voiceFoodBtn = document.getElementById('voiceInputFood');
  const voiceQtyBtn = document.getElementById('voiceInputQty');
const voiceMobileBtn = document.getElementById('voiceInputMobile');
  const voiceAddressBtn = document.getElementById('voiceInputAddress');

  let foodPrices = {};
  let order = [];
  let loggedUser = null;

  // ===== LocalStorage Helpers =====
  function saveUser(user) {
    localStorage.setItem('loggedUser', JSON.stringify(user));
  }
  function loadUser() {
    const user = localStorage.getItem('loggedUser');
    if (!user) return null;
    try { return JSON.parse(user); } catch { return null; }
  }
  function logoutUser() {
    localStorage.removeItem('loggedUser');
    loggedUser = null;
    google.accounts.id.disableAutoSelect?.(); // Prevent auto-login
    showLoginUI();
  }

  // ===== UI Control =====
  function showLoginUI() {
    loginContainer.style.display = 'block';
    billingContainer.style.display = 'none';
    userInfoDisplay.style.display = 'none';
    billArea.innerHTML = '';
    order = [];
    renderOrder();
    disableBillActions();
  }
  function showBillingUI(user) {
    loginContainer.style.display = 'none';
    billingContainer.style.display = 'block';
    userInfoDisplay.style.display = 'block';
    userNameSpan.textContent = user.name || '';
    userEmailSpan.textContent = user.email || '';
  }
  function enableBillActions() {
    generateBillBtn.disabled = false;
    sendBillBtn.disabled = order.length === 0;
  }
  function disableBillActions() {
    generateBillBtn.disabled = true;
    printBtn.disabled = true;
    downloadPDFBtn.disabled = true;
    sendBillBtn.disabled = true;
  }
  function escapeHtml(text) {
    return text ? String(text).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m])) : '';
  }

  // ===== Google Sign-In callback =====
  window.handleCredentialResponse = (response) => {
    try {
      const base64Url = response.credential.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(c =>
        '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
      const userObj = JSON.parse(jsonPayload);

      loggedUser = { name: userObj.name, email: userObj.email };
      saveUser(loggedUser);
      showBillingUI(loggedUser);
      loadFoods();
    } catch (err) {
      console.error('Google Sign-in error:', err);
      alert('Google sign-in failed.');
    }
  };

  logoutBtn.addEventListener('click', () => logoutUser());

  // ===== Load user if already logged in =====
  loggedUser = loadUser();
  if (loggedUser) {
    showBillingUI(loggedUser);
    loadFoods();
  } else {
    showLoginUI();
  }

  // ===== Load Foods =====
  async function loadFoods() {
    try {
      const resp = await fetch('/api/foods');
      if (!resp.ok) throw new Error('API not OK');
      const data = await resp.json();
      if (!Array.isArray(data)) throw new Error('Invalid foods data');
      populateFoods(data);
    } catch (err) {
      console.warn('loadFoods failed, using fallback:', err);
      const fallback = [
        { food_name: 'Tea', price: 20 },
        { food_name: 'Coffee', price: 40 },
        { food_name: 'Samosa', price: 25 },
        { food_name: 'Maggi', price: 60 },
        { food_name: 'Fried Rice', price: 120 }
      ];
      populateFoods(fallback);
    }
  }

  function populateFoods(list) {
    datalist.innerHTML = '';
    foodPrices = {};
    list.forEach(item => {
      const name = String(item.food_name || '').trim();
      if (!name) return;
      const opt = document.createElement('option');
      opt.value = name;
      datalist.appendChild(opt);
      foodPrices[name.toLowerCase()] = parseFloat(item.price || 0);
    });
  }

  // ===== Order Management =====
  orderForm.addEventListener('submit', (e) => {
    e.preventDefault();
    addOrderItem();
  });
  function addOrderItem() {
    const nameEl = document.getElementById('food_name');
    const qtyEl = document.getElementById('quantity');
    const name = nameEl.value.trim();
    const qty = parseInt(qtyEl.value, 10) || 0;
    if (!name || qty < 1) return alert('Enter valid food and quantity');

    const price = foodPrices[name.toLowerCase()] || 0;
    const idx = order.findIndex(o => o.name.toLowerCase() === name.toLowerCase());
    if (idx >= 0) order[idx].qty += qty;
    else order.push({ name, qty, price });

    orderForm.reset();
    qtyEl.value = 1;
    renderOrder();
  }

  function renderOrder() {
    if (!order.length) { orderList.innerHTML = '<p>No items yet.</p>'; disableBillActions(); return; }
    let total = 0;
    let html = `<h4>Your Order</h4><table style="border-collapse:collapse;width:100%;text-align:center;font-family:Arial;font-size:14px;">
      <thead style="background:#2980b9;color:#fff;"><tr><th>Food</th><th>Qty</th><th>Price</th><th>Amount</th><th>Action</th></tr></thead><tbody>`;
    order.forEach((o, i) => {
      const amt = o.qty * (o.price || 0);
      total += amt;
      html += `<tr>
        <td style="padding:6px;border:1px solid #ccc;text-align:left;">${escapeHtml(o.name)}</td>
        <td style="padding:6px;border:1px solid #ccc;">${o.qty}</td>
        <td style="padding:6px;border:1px solid #ccc;">${currency(o.price)}</td>
        <td style="padding:6px;border:1px solid #ccc;">${currency(amt)}</td>
        <td style="padding:6px;border:1px solid #ccc;">
          <button data-idx="${i}" class="removeBtn" style="background:#e74c3c;color:#fff;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;">❌</button>
        </td>
      </tr>`;
    });
    html += `<tr>
      <td colspan="3" style="text-align:right;padding:8px;border:1px solid #ccc;"><strong>Total</strong></td>
      <td style="padding:8px;border:1px solid #ccc;"><strong>${currency(total)}</strong></td>
      <td style="border:1px solid #ccc;"></td>
    </tr></tbody></table>`;
    orderList.innerHTML = html;

    document.querySelectorAll('.removeBtn').forEach(btn => {
      btn.addEventListener('click', ev => {
        order.splice(Number(ev.currentTarget.dataset.idx), 1);
        renderOrder();
      });
    });
    enableBillActions();
  }

  // ===== Voice Input =====
  function speakText(text) {
    return new Promise(resolve => {
      if (!('speechSynthesis' in window)) return resolve();
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = TTS_LANG;
      u.onend = u.onerror = () => resolve();
      window.speechSynthesis.speak(u);
    });
  }
  function voiceInput(callback, promptText) {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Voice input not supported in this browser');
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = TTS_LANG;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    speakText(promptText).then(() => recognition.start());
    recognition.onresult = (event) => {
      const spoken = event.results[0][0].transcript.trim();
      callback(spoken);
    };
    recognition.onerror = () => speakText('Sorry, I could not understand. Please try again.');
  }
  if (voiceFoodBtn) {
    voiceFoodBtn.addEventListener('click', () => {
      voiceInput(val => {
        const el = document.getElementById('food_name');
        el.value = val;
        speakText(`You said ${val}`);
      }, 'Please say the food name');
    });
  }
  if (voiceQtyBtn) {
    voiceQtyBtn.addEventListener('click', () => {
      voiceInput(val => {
        const qty = parseInt(val.match(/\d+/)?.[0] || '1', 10);
        document.getElementById('quantity').value = qty;
        speakText(`Quantity set to ${qty}`);
      }, 'Please say the quantity');
    });
  }

  // ===== Bill Modal =====
  if (generateBillBtn) {
    generateBillBtn.addEventListener('click', () => {
      if (!order.length) return alert('Add some food items first');
      openModal();
    });
  }
  function openModal() {
    userInfoModal.style.display = 'flex';
    userInfoModal.setAttribute('aria-hidden', 'false');
    document.getElementById('customerMobile').value = loggedUser?.whatsapp || '';
    document.getElementById('customerMobile').focus();
  }
  function closeModal() {
    userInfoModal.style.display = 'none';
    userInfoModal.setAttribute('aria-hidden', 'true');
  }
  cancelUserInfoBtn.addEventListener('click', closeModal);

  userInfoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const mobile = document.getElementById('customerMobile').value.trim();
    if (!mobile.match(/^\d{7,15}$/)) return alert('Enter valid WhatsApp number digits only');
    loggedUser.whatsapp = mobile;
    saveUser(loggedUser);
    closeModal();
    buildBill();
  });

  // ===== Bill Build =====
  function buildBill() {
    const payload = {
      order,
      customer: {
        name: loggedUser.name,
        email: loggedUser.email,
        mobile: loggedUser.whatsapp || ''
      },
      generatedAt: new Date().toLocaleString()
    };
    billArea.innerHTML = buildBillHTML(payload);
    printBtn.disabled = false;
    downloadPDFBtn.disabled = false;
    sendBillBtn.disabled = false;
    speakText(`Bill generated for ${loggedUser.name}. Total amount ${calculateTotal(order)} rupees.`);
  }
  function buildBillHTML({ order, customer, generatedAt }) {
    const rows = order.map(o => {
      const amt = o.qty * (o.price || 0);
      return `<tr><td style="padding:6px;border:1px solid #ccc;">${escapeHtml(o.name)}</td>
              <td style="padding:6px;border:1px solid #ccc;">${o.qty}</td>
              <td style="padding:6px;border:1px solid #ccc;">${currency(o.price)}</td>
              <td style="padding:6px;border:1px solid #ccc;">${currency(amt)}</td></tr>`;
    }).join('');
    return `<div style="font-family:Arial;">
      <h3 style="margin:6px 0;text-align:center;">XYZ Restaurant Bill</h3>
      <div><strong>Name:</strong> ${escapeHtml(customer.name)} &nbsp;&nbsp; <strong>Email:</strong> ${escapeHtml(customer.email)} &nbsp;&nbsp; <strong>Mobile:</strong> ${escapeHtml(customer.mobile)}</div>
      <div style="margin-top:8px;">
        <table style="width:100%;border-collapse:collapse;">
          <thead style="background:#2980b9;color:#fff;"><tr><th>Food</th><th>Qty</th><th>Price</th><th>Amount</th></tr></thead>
          <tbody>${rows}<tr>
            <td colspan="3" style="text-align:right;padding:8px;border:1px solid #ccc;"><strong>Total</strong></td>
            <td style="padding:8px;border:1px solid #ccc;"><strong>${currency(calculateTotal(order))}</strong></td>
          </tr></tbody>
        </table>
      </div>
      <div style="margin-top:12px;text-align:center;color:#666;">Date: ${generatedAt}</div>
    </div>`;
  }
  function calculateTotal(order) {
    return order.reduce((s, o) => s + (o.qty * (o.price || 0)), 0);
  }
if (voiceMobileBtn) {
    voiceMobileBtn.addEventListener('click', () => {
      voiceInput(val => {
        // Sirf digits nikalne ke liye regex
        const digits = val.replace(/\D/g, '');
        if (!digits) {
          speakText("I couldn't catch a valid number, please try again.");
          return;
        }
        const el = document.getElementById('customerMobile');
        el.value = digits;
        speakText(`You said mobile number ${digits.split('').join(' ')}`);
      }, 'Please say your WhatsApp number in digits');
    });
  }

  if (voiceAddressBtn) {
    voiceAddressBtn.addEventListener('click', () => {
      voiceInput(val => {
        const el = document.getElementById('customerAddress');
        el.value = val;
        speakText(`Address set as: ${val}`);
      }, 'Please say your address');
    });
  }
  // ===== Send Bill =====
  if (sendBillBtn) {
    sendBillBtn.addEventListener('click', async () => {
      if (!order.length) return alert('No order to send');
      if (!loggedUser?.whatsapp) return alert('Please enter WhatsApp number first');

      const postData = {
        order,
        customer: {
          name: loggedUser.name,
          email: loggedUser.email,
          mobile: loggedUser.whatsapp
        }
      };
      sendBillBtn.disabled = true;
      const originalText = sendBillBtn.textContent;
      sendBillBtn.textContent = 'Sending...';

      try {
        const resp = await fetch('/api/send-bill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(postData)
        });
        const data = await resp.json();
        if (resp.ok) alert('Bill sent successfully on WhatsApp and Email');
        else alert('Failed to send bill: ' + (data.error || 'Unknown error'));
      } catch (err) {
        alert('Send Bill error: ' + (err.message || err));
      } finally {
        sendBillBtn.disabled = false;
        sendBillBtn.textContent = originalText || 'Send Bill (WhatsApp / Email)';
      }
    });
  }

  // ===== Print =====
  if (printBtn) {
    printBtn.addEventListener('click', () => {
      if (!billArea.innerHTML.trim()) return alert('No bill to print');
      const logoSrc = new URL('./logo.jpg', window.location.href).href;
      const billHtml = `<div style="text-align:center;"><img src="${logoSrc}" style="max-width:120px;margin-bottom:10px;"></div>` + billArea.innerHTML;
      const win = window.open('', '', 'height=700,width=900');
      if (!win) return alert('Allow popups for printing');
      win.document.write('<html><head><title>Bill</title><style>body{font-family:Arial;margin:20px;}table{width:100%;border-collapse:collapse;}th,td{border:1px solid #000;padding:8px;text-align:left;}th{background-color:#f2f2f2;}</style></head><body>');
      win.document.write(billHtml);
      win.document.write('</body></html>');
      win.document.close();
      win.focus();
      win.print();
    });
  }

  // ===== Download PDF =====
  if (downloadPDFBtn) {
    downloadPDFBtn.addEventListener('click', async () => {
      if (!billArea.innerHTML.trim()) return alert('No bill to download');
      if (!window.jspdf) return alert('jsPDF not loaded');
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      try { const logo = await toDataURL('./logo.jpg'); if (logo) doc.addImage(logo, 'JPEG', 80, 10, 50, 20); } catch {}
      doc.setFontSize(16); doc.text('XYZ Restaurant Bill', doc.internal.pageSize.width / 2, 40, { align: 'center' });
      const name = loggedUser?.name || '';
      const email = loggedUser?.email || '';
      const mobile = loggedUser?.whatsapp || '';
      let yOffset = 50; doc.setFontSize(12);
      doc.text(`Name: ${name}`, 14, yOffset);
      doc.text(`Email: ${email}`, 110, yOffset);
      doc.text(`Mobile: ${mobile}`, 14, yOffset + 8);
      doc.setFontSize(10); doc.text(`Date: ${new Date().toLocaleString()}`, 14, yOffset + 16);

      let total = 0;
      const headers = ["Food", "Qty", "Price", "Amount"];
      const rows = order.map(o => {
        const amt = o.qty * (o.price || 0);
        total += amt;
        return [o.name, String(o.qty), currency(o.price), currency(amt)];
      });

      if (doc.autoTable) {
        doc.autoTable({ head: [headers], body: rows, startY: yOffset + 24, theme: 'grid', styles: { halign: 'center', fontSize: 11, cellPadding: 3 }, headStyles: { fillColor: [41, 128, 185], textColor: [255, 255, 255] } });
        const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY : yOffset + 24;
        doc.setFontSize(12); doc.text(`Total: ${currency(total)}`, doc.internal.pageSize.width - 14, finalY + 10, { align: 'right' });
      } else {
        // fallback
        let y = yOffset + 30;
        rows.forEach(r => {
          doc.text(r.join(' | '), 14, y);
          y += 8;
        });
        doc.text(`Total: ${currency(total)}`, doc.internal.pageSize.width - 14, y + 6, { align: 'right' });
      }
      doc.setFontSize(10); doc.text('Thank you for visiting! Come again.', doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
      doc.save('bill.pdf');
    });
  }

  // ===== Helper: Convert Image to Base64 =====
  async function toDataURL(url) {
    try {
      const resp = await fetch(url, { mode: 'cors' });
      if (!resp.ok) throw new Error('Fetch failed');
      const blob = await resp.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      return new Promise(resolve => {
        const img = new Image(); img.crossOrigin = "Anonymous"; img.onload = function () {
          try {
            const canvas = document.createElement('canvas'); canvas.width = this.width; canvas.height = this.height;
            const ctx = canvas.getContext('2d'); ctx.drawImage(this, 0, 0);
            resolve(canvas.toDataURL('image/jpeg'));
          } catch { resolve(null); }
        };
        img.onerror = () => resolve(null);
        img.src = url;
      });
    }
  }
});
