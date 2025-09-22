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

  let foodPrices = {};
  let order = [];
  let loggedUser = null;

  // LocalStorage Helpers
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
    google.accounts.id.disableAutoSelect?.();
    showLoginUI();
  }

  // UI Control
  function showLoginUI() {
    loginContainer.style.display = 'block';
    billingContainer.style.display = 'none';
    userInfoDisplay.style.display = 'none';
    billArea.innerHTML = '';
    order = [];
    renderOrder();
    disableActions();
  }
  function showBillingUI(user) {
    loginContainer.style.display = 'none';
    billingContainer.style.display = 'block';
    userInfoDisplay.style.display = 'block';
    userNameSpan.textContent = user.name || '';
    userEmailSpan.textContent = user.email || '';
    attachVoiceListeners();
  }
  function enableActions() {
    generateBillBtn.disabled = order.length === 0;
    sendBillBtn.disabled = order.length === 0;
    printBtn.disabled = true;
    downloadPDFBtn.disabled = true;
  }
  function disableActions() {
    generateBillBtn.disabled = true;
    sendBillBtn.disabled = true;
    printBtn.disabled = true;
    downloadPDFBtn.disabled = true;
  }
  function escapeHtml(text) {
    return text ? String(text).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"'"}[m])) : '';
  }

  // Google Sign-In callback
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

  // Load user if already logged in
  loggedUser = loadUser();
  if (loggedUser) {
    showBillingUI(loggedUser);
    loadFoods();
  } else {
    showLoginUI();
  }

  // Load Foods
  async function loadFoods(prefix = '') {
    try {
      let url = '/api/foods';
      if (prefix) url += `?startsWith=${prefix}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('API not OK');
      const data = await resp.json();
      if (!Array.isArray(data)) throw new Error('Invalid foods data');
      populateFoods(data);
    } catch (err) {
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

  // Order Management
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
    if (!order.length) {
      orderList.innerHTML = '<p>No items yet.</p>';
      disableActions();
      return;
    }
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
    enableActions();
  }

  // Voice Input for Food Name - prefix-based suggestions
  function voiceFoodSuggest() {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Voice input not supported in this browser.');
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = TTS_LANG;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    let firstLetterHandled = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.trim();
      if (transcript && !firstLetterHandled) {
        const letter = transcript[0].toLowerCase();
        loadFoods(letter);
        firstLetterHandled = true;
      }
      if (event.results[0].isFinal) {
        document.getElementById('food_name').value = transcript;
        speakText(`You said ${transcript}`);
      }
    };
    recognition.onerror = () => speakText('Sorry, I could not understand. Please try again.');
    recognition.start();
  }

  // Mapping words to numbers for Quantity voice input
  function mapWordToNumber(word) {
    const mapping = {
      zero: 0,
      one: 1,
      two: 2,
      three: 3,
      four: 4,
      five: 5,
      six: 6,
      seven: 7,
      eight: 8,
      nine: 9,
      ten: 10
    };
    return mapping[word.toLowerCase()] ?? null;
  }

  // Voice input for Quantity with fast recognition
  function voiceQtySuggest() {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Voice input not supported in this browser.');
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = TTS_LANG;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    let handled = false;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.trim().toLowerCase();
      if (!handled) {
        let qty = parseInt(transcript.match(/\d+/)?.[0] || '', 10);
        if (!qty) qty = mapWordToNumber(transcript);
        if (qty && qty > 0) {
          document.getElementById('quantity').value = qty;
          speakText(`Quantity set to ${qty}`);
          handled = true;
        }
      }
      if (event.results[0].isFinal && !handled) {
        const fallbackQty = parseInt(transcript.match(/\d+/)?.[0] || '1', 10);
        document.getElementById('quantity').value = fallbackQty;
        speakText(`Quantity set to ${fallbackQty}`);
      }
    };

    recognition.onerror = () => speakText('Sorry, I could not understand. Please try again.');
    recognition.start();
  }

  // Attach voice listeners for all voice-related buttons
  function attachVoiceListeners() {
    const voiceFoodBtn = document.getElementById('voiceInputFood');
    const voiceQtyBtn = document.getElementById('voiceInputQty');
    const voiceMobileBtn = document.getElementById('voiceInputMobile');
    const voiceAddressBtn = document.getElementById('voiceInputAddress');

    if (voiceFoodBtn) voiceFoodBtn.addEventListener('click', voiceFoodSuggest);
    if (voiceQtyBtn) voiceQtyBtn.addEventListener('click', voiceQtySuggest);
    if (voiceMobileBtn) voiceMobileBtn.addEventListener('click', () => {
      voiceInput((val) => {
        const digits = val.replace(/\D/g, '');
        if (!digits) {
          speakText("Couldn't catch a valid number, try again.");
          return;
        }
        document.getElementById('customerMobile').value = digits;
        speakText(`You said mobile number ${digits.split('').join(' ')}`);
      }, "Please say your WhatsApp number");
    });
    if (voiceAddressBtn) voiceAddressBtn.addEventListener('click', () => {
      voiceInput((val) => {
        document.getElementById('customerAddress').value = val;
        speakText("Address set.");
      }, "Please say your address");
    });
  }

  // Voice synthesis helper
  function speakText(text) {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window)) return resolve();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = TTS_LANG;
      utterance.onend = utterance.onerror = resolve;
      window.speechSynthesis.speak(utterance);
    });
  }

  // Voice input helper
  function voiceInput(callback, promptText) {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Voice input not supported in this browser.');
      return;
    }
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = TTS_LANG;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      callback(event.results[0][0].transcript.trim());
    };
    recognition.onerror = () => speakText('Sorry, I could not understand. Please try again.');
    speakText(promptText).then(() => recognition.start());
  }

  // Modal handlers
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

  // Build bill html and display
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
      return `<tr>
        <td style="padding:6px;border:1px solid #ccc;">${escapeHtml(o.name)}</td>
        <td style="padding:6px;border:1px solid #ccc;">${o.qty}</td>
        <td style="padding:6px;border:1px solid #ccc;">${currency(o.price)}</td>
        <td style="padding:6px;border:1px solid #ccc;">${currency(amt)}</td>
      </tr>`;
    }).join('');
    return `<div style="font-family:Arial;">
      <h3 style="text-align:center;margin:10px 0;">XYZ Restaurant Bill</h3>
      <p><strong>Name:</strong> ${escapeHtml(customer.name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(customer.email)}</p>
      <p><strong>Mobile:</strong> ${escapeHtml(customer.mobile)}</p>
      <table style="width:100%;border-collapse:collapse;margin-top:10px;">
        <thead style="background:#2980b9;color:#fff;">
          <tr><th>Food</th><th>Qty</th><th>Price</th><th>Amount</th></tr>
        </thead>
        <tbody>${rows}
          <tr>
            <td colspan="3" style="text-align:right;padding:8px;border:1px solid #ccc;"><strong>Total</strong></td>
            <td style="padding:8px;border:1px solid #ccc;"><strong>${currency(calculateTotal(order))}</strong></td>
          </tr>
        </tbody>
      </table>
      <p style="text-align:center;color:#666;margin-top:10px;">Date: ${generatedAt}</p>
    </div>`;
  }

  function calculateTotal(order) {
    return order.reduce((acc, item) => acc + item.qty * (item.price || 0), 0);
  }

  // Send Bill
  sendBillBtn.addEventListener('click', async () => {
    if (!order.length) return alert('No order to send');
    if (!loggedUser?.whatsapp) return alert('Please enter WhatsApp number');

    const postData = {
      order,
      customer: {
        name: loggedUser.name,
        email: loggedUser.email,
        mobile: loggedUser.whatsapp
      }
    };

    sendBillBtn.disabled = true;
    const original = sendBillBtn.textContent;
    sendBillBtn.textContent = 'Sending...';

    try {
      const res = await fetch('/api/send-bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postData)
      });
      const data = await res.json();
      if (res.ok) alert('Bill sent successfully!');
      else alert(`Send failed: ${data.error || 'Unknown error'}`);
    } catch (err) {
      alert(`Send error: ${err.message || err}`);
    } finally {
      sendBillBtn.disabled = false;
      sendBillBtn.textContent = original;
    }
  });

  // Print Bill
  printBtn.addEventListener('click', () => {
    if (!billArea.innerHTML.trim()) return alert('No bill to print');
    const logoSrc = new URL('./logo.jpg', window.location.href).href;
    const win = window.open('', '', 'width=900,height=700');
    if (!win) return alert('Allow popups for printing');
    win.document.write(`
      <html>
      <head><title>Print Bill</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid black; padding: 8px; text-align: left; }
        th { background-color: #2980b9; color: white; }
      </style>
      </head>
      <body>
        <div style="text-align:center;">
          <img src="${logoSrc}" alt="Logo" style="max-width:120px;margin-bottom:10px;" />
        </div>
        ${billArea.innerHTML}
      </body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
  });

  // Download PDF
  downloadPDFBtn.addEventListener('click', async () => {
    if (!billArea.innerHTML.trim()) return alert('No bill to download');
    if (!window.jspdf) return alert('jsPDF not loaded');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    try {
      const logo = await toDataURL('./logo.jpg');
      if (logo) doc.addImage(logo, 'JPEG', 80, 10, 50, 20);
    } catch {}
    doc.setFontSize(16);
    doc.text('XYZ Restaurant Bill', doc.internal.pageSize.getWidth() / 2, 40, { align: 'center' });
    const name = loggedUser?.name || '';
    const email = loggedUser?.email || '';
    const mobile = loggedUser?.whatsapp || '';
    let yOffset = 50;
    doc.setFontSize(12);
    doc.text(`Name: ${name}`, 14, yOffset);
    doc.text(`Email: ${email}`, 110, yOffset);
    doc.text(`Mobile: ${mobile}`, 14, yOffset + 10);
    doc.text(`Date: ${new Date().toLocaleString()}`, 14, yOffset + 20);

    const columns = ["Food", "Qty", "Price", "Amount"];
    const rows = order.map(item => [
      item.name,
      String(item.qty),
      currency(item.price),
      currency(item.qty * item.price)
    ]);
    doc.autoTable({ head: [columns], body: rows, startY: yOffset + 30, theme: 'grid',
      headStyles: { fillColor: [41, 128, 185], textColor: [255, 255, 255] },
      styles: { halign: 'center' } });

    const finalY = doc.lastAutoTable.finalY;
    doc.setFontSize(12);
    doc.text(`Total: ${currency(calculateTotal(order))}`, doc.internal.pageSize.getWidth() - 20, finalY + 10, { align: 'right' });
    doc.setFontSize(10);
    doc.text('Thank you for visiting! Come again.', doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });

    doc.save('bill.pdf');
  });

  async function toDataURL(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch image');
      const blob = await res.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => reject(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }

  // Voice input helper
  function voiceInput(callback, promptText) {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Voice input not supported in this browser.');
      return;
    }
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = TTS_LANG;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript.trim();
      callback(transcript);
    };

    recognition.onerror = () => speakText('Sorry, I could not understand. Please try again.');

    speakText(promptText).then(() => recognition.start());
  }

  // Attach voice button event listeners
  function attachVoiceListeners() {
    const foodVoiceBtn = document.getElementById('voiceInputFood');
    const qtyVoiceBtn = document.getElementById('voiceInputQty');
    const mobileVoiceBtn = document.getElementById('voiceInputMobile');
    const addressVoiceBtn = document.getElementById('voiceInputAddress');

    if (foodVoiceBtn) foodVoiceBtn.addEventListener('click', voiceFoodSuggest);
    if (qtyVoiceBtn) qtyVoiceBtn.addEventListener('click', voiceQtySuggest);
    if (mobileVoiceBtn) mobileVoiceBtn.addEventListener('click', () => {
      voiceInput(val => {
        const digits = val.replace(/\D/g, '');
        if (!digits) {
          speakText("Couldn't catch valid number, try again.");
          return;
        }
        document.getElementById('customerMobile').value = digits;
        speakText(`You said mobile number ${digits.split('').join(' ')}`);
      }, 'Please say your WhatsApp number (digits only)');
    });
    if (addressVoiceBtn) addressVoiceBtn.addEventListener('click', () => {
      voiceInput(val => {
        document.getElementById('customerAddress').value = val;
        speakText("Address set.");
      }, 'Please say your address');
    });
  }

  function speakText(text) {
    return new Promise(resolve => {
      if (!('speechSynthesis' in window)) return resolve();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = TTS_LANG;
      utterance.onend = utterance.onerror = resolve;
      window.speechSynthesis.speak(utterance);
    });
  }

  // Voice input for Food Name with prefix filter suggestions
  function voiceFoodSuggest() {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Voice input not supported.');
      return;
    }
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = TTS_LANG;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    let firstLetterHandled = false;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.trim();
      if (transcript && !firstLetterHandled) {
        const letter = transcript[0].toLowerCase();
        loadFoods(letter);
        firstLetterHandled = true;
      }
      if (event.results[0].isFinal) {
        document.getElementById('food_name').value = transcript;
        speakText(`You said ${transcript}`);
      }
    };

    recognition.onerror = () => speakText('Sorry, could not understand. Please try again.');
    recognition.start();
  }

  // Voice input for Quantity with spoken words mapping
  function mapWordToNumber(word) {
    const map = {
      zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
      six: 6, seven: 7, eight: 8, nine: 9, ten: 10
    };
    return map[word.toLowerCase()] ?? null;
  }

  function voiceQtySuggest() {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Voice input not supported.');
      return;
    }
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = TTS_LANG;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    let handled = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.trim().toLowerCase();
      if (!handled) {
        let qty = parseInt(transcript.match(/\d+/)?.[0] || '', 10);
        if (!qty) qty = mapWordToNumber(transcript);
        if (qty && qty > 0) {
          document.getElementById('quantity').value = qty;
          speakText(`Quantity set to ${qty}`);
          handled = true;
        }
      }
      if (event.results[0].isFinal && !handled) {
        const fallbackQty = parseInt(transcript.match(/\d+/)?.[0] || '1', 10);
        document.getElementById('quantity').value = fallbackQty;
        speakText(`Quantity set to ${fallbackQty}`);
      }
    };
    recognition.onerror = () => speakText("Sorry, couldn't understand. Try again.");
    recognition.start();
  }

  attachVoiceListeners();

  // Add any additional handlers for bill generation, sending, printing, downloading as needed

});
