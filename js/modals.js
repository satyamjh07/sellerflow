// SellerFlow — Modals Module (Async / Supabase Edition)
// All data interactions are now async. UI feedback via UI.toast().
//
// NOTIFICATION ADDITIONS (vs original):
//   viewOrder()         — passes customerEmail to ViewOrderContent,
//                         wires delivery status select onChange to
//                         trigger NotificationService delivery emails
//   sendFollowupEmail() — new public function, called by the follow-up
//                         button injected into ViewOrderContent
// ================================================================

const Modals = (() => {

  // ─── State ────────────────────────────────────────────────────
  let editingProductId = null;
  let orderItems       = [];

  // ─── Add / Edit Product ───────────────────────────────────────
  function openAddProduct() {
    editingProductId = null;
    document.getElementById('product-modal-title').textContent = 'Add Product';
    document.getElementById('product-form').reset();
    document.getElementById('product-id').value = '';
    UI.openModal('modal-product');
  }

  async function editProduct(id) {
    const products = await SF.getProducts();
    const p = products.find(x => x.id === id);
    if (!p) { UI.toast('Product not found', 'error'); return; }

    editingProductId = id;
    document.getElementById('product-modal-title').textContent = 'Edit Product';
    document.getElementById('product-id').value              = p.id;
    document.getElementById('product-name-input').value      = p.name;
    document.getElementById('product-sku-input').value       = p.sku;
    document.getElementById('product-category-input').value  = p.category;
    document.getElementById('product-price-input').value     = p.price;
    document.getElementById('product-stock-input').value     = p.stock;
    document.getElementById('product-threshold-input').value = p.lowStockThreshold;
    document.getElementById('product-emoji-input').value     = p.emoji || '';
    UI.openModal('modal-product');
  }

  async function saveProduct() {
    const name      = document.getElementById('product-name-input').value.trim();
    const sku       = document.getElementById('product-sku-input').value.trim();
    const category  = document.getElementById('product-category-input').value.trim();
    const price     = parseFloat(document.getElementById('product-price-input').value);
    const stock     = parseInt(document.getElementById('product-stock-input').value);
    const threshold = parseInt(document.getElementById('product-threshold-input').value) || 5;
    const emoji     = document.getElementById('product-emoji-input').value.trim() || '📦';

    if (!name || !category || isNaN(price) || isNaN(stock)) {
      UI.toast('Please fill in all required fields', 'error');
      return;
    }

    const saveBtn = document.getElementById('save-product-btn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    try {
      const data = { name, sku, category, price, stock, lowStockThreshold: threshold, emoji };
      if (editingProductId) {
        await SF.updateProduct(editingProductId, data);
        UI.toast(`${name} updated successfully`, 'success');
      } else {
        await SF.addProduct(data);
        UI.toast(`${name} added to inventory`, 'success');
      }
      UI.closeModal('modal-product');
      await Pages.products();
      await UI.updateBadges();
    } catch (err) {
      UI.toast(err.message || 'Failed to save product', 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 Save Product';
    }
  }

  async function deleteProduct(id) {
    const products = await SF.getProducts();
    const p = products.find(x => x.id === id);
    if (!p) return;
    if (!UI.confirm(`Delete "${p.name}"? This cannot be undone.`)) return;

    try {
      await SF.deleteProduct(id);
      UI.toast(`${p.name} deleted`, 'warn');
      await Pages.products();
      await UI.updateBadges();
    } catch (err) {
      UI.toast(err.message || 'Failed to delete product', 'error');
    }
  }

  // ─── Create Order ─────────────────────────────────────────────
  async function openCreateOrder() {
    orderItems = [];
    document.getElementById('order-form').reset();
    renderOrderItems();
    await _populateProductDropdown();
    await _populateCustomerDropdown();
    const ncf = document.getElementById('new-customer-fields');
    if (ncf) ncf.style.display = 'none';
    UI.openModal('modal-order');
  }

  async function _populateProductDropdown() {
    const sel = document.getElementById('order-product-select');
    sel.innerHTML = '<option value="">Loading products…</option>';
    const products = await SF.getProducts();
    const available = products.filter(p => p.stock > 0);
    sel.innerHTML = '<option value="">— Select Product —</option>';
    available.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.emoji || '📦'} ${p.name} — ${SF.formatCurrency(p.price)} (Stock: ${p.stock})`;
      sel.appendChild(opt);
    });
  }

  async function _populateCustomerDropdown() {
    const sel = document.getElementById('order-customer-select');
    sel.innerHTML = '<option value="">Loading customers…</option>';
    const customers = await SF.getCustomers();
    sel.innerHTML = '<option value="">— Select Existing Customer —</option><option value="new">+ New Customer</option>';
    customers.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.name} (${c.instagram || c.phone || ''})`;
      sel.appendChild(opt);
    });
  }

  function handleCustomerSelectChange() {
    const val = document.getElementById('order-customer-select').value;
    const ncf = document.getElementById('new-customer-fields');
    if (ncf) ncf.style.display = val === 'new' ? 'block' : 'none';
  }

  async function addOrderItem() {
    const sel = document.getElementById('order-product-select');
    const qty = parseInt(document.getElementById('order-qty-input').value) || 1;
    if (!sel.value) { UI.toast('Please select a product', 'error'); return; }

    const products = await SF.getProducts();
    const product  = products.find(p => p.id === sel.value);
    if (!product) return;
    if (qty > product.stock) {
      UI.toast(`Only ${product.stock} units available for ${product.name}`, 'error');
      return;
    }

    const existing = orderItems.find(i => i.productId === sel.value);
    if (existing) {
      existing.qty += qty;
    } else {
      orderItems.push({
        productId: product.id,
        name:      product.name,
        price:     product.price,
        qty,
        emoji:     product.emoji,
      });
    }

    renderOrderItems();
    sel.value = '';
    document.getElementById('order-qty-input').value = 1;
  }

  function removeOrderItem(idx) {
    orderItems.splice(idx, 1);
    renderOrderItems();
  }

  function renderOrderItems() {
    const el      = document.getElementById('order-items-list');
    const totalEl = document.getElementById('order-total-display');

    if (orderItems.length === 0) {
      el.innerHTML = '<div class="text-muted" style="font-size:12px;padding:12px;text-align:center">No items added yet</div>';
      if (totalEl) totalEl.textContent = '₹0';
      return;
    }

    el.innerHTML = orderItems.map((item, i) => `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--bg-input);border-radius:8px;margin-bottom:6px">
        <span style="font-size:18px">${item.emoji || '📦'}</span>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:600">${item.name}</div>
          <div style="font-size:11px;color:var(--text-muted)">Qty: ${item.qty} × ${SF.formatCurrency(item.price)}</div>
        </div>
        <span style="font-weight:700;font-size:13px">${SF.formatCurrency(item.price * item.qty)}</span>
        <button onclick="Modals.removeOrderItem(${i})"
          style="background:var(--danger-dim);color:var(--danger);border:none;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:11px">✕</button>
      </div>
    `).join('');

    const total = orderItems.reduce((s, i) => s + i.price * i.qty, 0);
    if (totalEl) totalEl.textContent = SF.formatCurrency(total);
  }

  async function saveOrder() {
    if (orderItems.length === 0) {
      UI.toast('Please add at least one product', 'error');
      return;
    }

    const customerSel = document.getElementById('order-customer-select').value;
    let customerId, customerName;

    const saveBtn = document.getElementById('save-order-btn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Creating…';

    try {
      if (customerSel === 'new') {
        const name     = document.getElementById('new-customer-name').value.trim();
        const insta    = document.getElementById('new-customer-insta').value.trim();
        const phone    = document.getElementById('new-customer-phone').value.trim();
        const email    = document.getElementById('new-customer-email').value.trim();
        const address  = document.getElementById('new-customer-address').value.trim();
        const landmark = document.getElementById('new-customer-landmark').value.trim();
        const city     = document.getElementById('new-customer-city').value.trim();
        const state    = document.getElementById('new-customer-state').value.trim();
        const pincode  = document.getElementById('new-customer-pincode').value.trim();

        if (!name) { UI.toast('Please enter customer name', 'error'); return; }

        const nc = await SF.findOrCreateCustomer(name, insta);
        const updates = {};
        if (phone)    updates.phone    = phone;
        if (email)    updates.email    = email;
        if (address)  updates.address  = address;
        if (landmark) updates.landmark = landmark;
        if (city)     updates.city     = city;
        if (state)    updates.state    = state;
        if (pincode)  updates.pincode  = pincode;
        if (Object.keys(updates).length > 0) await SF.updateCustomer(nc.id, { ...nc, ...updates });

        customerId   = nc.id;
        customerName = nc.name;
        var shippingAddress = [address, landmark, city, state, pincode].filter(Boolean).join(', ');

      } else if (customerSel) {
        const customers = await SF.getCustomers();
        const cust = customers.find(c => c.id === customerSel);
        if (!cust) { UI.toast('Customer not found', 'error'); return; }
        customerId   = cust.id;
        customerName = cust.name;
        const parts  = [cust.address, cust.landmark, cust.city, cust.state, cust.pincode].filter(Boolean);
        var shippingAddress = parts.join(', ');

      } else {
        UI.toast('Please select or create a customer', 'error');
        return;
      }

      const payment = document.getElementById('order-payment-status').value;
      const notes   = document.getElementById('order-notes').value.trim();
      const total   = orderItems.reduce((s, i) => s + i.price * i.qty, 0);

      const order = {
        customerId,
        customerName,
        items: orderItems.map(i => ({
          productId: i.productId, name: i.name, qty: i.qty, price: i.price,
        })),
        total,
        status:          'processing',
        payment,
        notes,
        shippingAddress: shippingAddress || '',
      };

      // ── Order limit gate ──────────────────────────────────────
      if (typeof Billing !== 'undefined') {
        const stats = await SF.getDashStats();
        if (Billing.isOrderLimitReached(stats.totalOrders)) {
          const limit = Billing.getMonthlyOrderLimit();
          UI.toast(`Monthly order limit reached (${limit} orders). Upgrade to Bronze or Platinum for unlimited orders.`, 'warn');
          saveBtn.disabled = false;
          saveBtn.textContent = '✅ Create Order';
          return;
        }
      }

      const created = await SF.addOrder(order);
      UI.toast(`Order ${created.id} created for ${customerName}!`, 'success');
      UI.closeModal('modal-order');

      // ─── Auto Email Confirmation (non-blocking) ───────────────
      setTimeout(async () => {
        try {
          const user = await SF.getUser();
          if (!user?.autoEmail) return;
          const allCustomers  = await SF.getCustomers();
          const savedCustomer = allCustomers.find(c => c.id === customerId);
          if (!savedCustomer?.email) return;
          const invoiceHTML = Components.generateInvoiceEmailHTML(created, savedCustomer, user);
          await emailjs.send('service_5k8qt0o', 'template_x6h0iqc', {
            to_email:     savedCustomer.email,
            to_name:      customerName,
            order_id:     created.id,
            order_total:  SF.formatCurrency(created.total),
            store_name:   user.store || 'SellerFlow Store',
            invoice_html: invoiceHTML,
          });
          UI.toast(`Confirmation email sent to ${savedCustomer.email} 📧`, 'success');
        } catch (emailErr) {
          console.error('[SellerFlow] EmailJS send failed:', emailErr);
          UI.toast('Order saved! (Email delivery failed — check browser Console)', 'warn');
        }
      }, 0);

      await Promise.all([Pages.orders(), Pages.dashboard(), UI.updateBadges()]);

    } catch (err) {
      UI.toast(err.message || 'Failed to create order', 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = '✅ Create Order';
    }
  }

  // ─── View / Edit Order ────────────────────────────────────────
  //
  // NOTIFICATIONS INTEGRATION
  //   1. Fetches the customer record to get their email address.
  //   2. Passes customerEmail to ViewOrderContent so the follow-up
  //      button renders only when an email address exists.
  //   3. After rendering, wires the delivery status <select> with an
  //      onChange handler that fires delivery status emails automatically.
  //
  async function viewOrder(id) {
    const orders = await SF.getOrders();
    const o = orders.find(x => x.id === id);
    if (!o) { UI.toast('Order not found', 'error'); return; }

    // Fetch customer for email address (needed by follow-up button and
    // delivery email trigger)
    const customers    = await SF.getCustomers();
    const customer     = customers.find(c => c.id === o.customerId) || null;
    const customerEmail = customer?.email || '';

    const content = document.getElementById('view-order-content');
    // Pass customerEmail so ViewOrderContent can decide whether to show
    // the follow-up button and delivery email confirmation
    content.innerHTML = Components.ViewOrderContent(o, customerEmail);

    // ── Wire delivery status select for auto-email on change ────
    _wireDeliveryStatusChange(o, customer);

    // ── Wire Update button ──────────────────────────────────────
    document.getElementById('view-order-update-btn').onclick = async () => {
      const delivery = document.getElementById('update-delivery-status').value;
      const payment  = document.getElementById('update-payment-status').value;
      try {
        await SF.updateOrder(id, { status: delivery, payment });
        UI.toast('Order updated successfully', 'success');
        UI.closeModal('modal-view-order');
        await Promise.all([Pages.orders(), Pages.dashboard(), UI.updateBadges()]);
      } catch (err) {
        UI.toast(err.message || 'Failed to update order', 'error');
      }
    };

    document.getElementById('view-order-invoice-btn').onclick = () => {
      UI.closeModal('modal-view-order');
      showInvoice(id);
    };

    UI.openModal('modal-view-order');
  }

  // ── Wire delivery status <select> ─────────────────────────────
  //
  // Listens for changes to the delivery status dropdown.
  // On each change:
  //   1. Immediately saves the new status to Supabase
  //   2. If the transition warrants a notification email AND the
  //      customer has an email AND it hasn't already been sent for
  //      this status → fires the notification
  //
  // TRANSITIONS THAT TRIGGER EMAIL:
  //   any → shipped           → 'shipped'
  //   any → out_for_delivery  → 'out_for_delivery'
  //   any → delivered         → 'delivered'
  //
  // The deduplication check lives inside NotificationService so even
  // if this handler fires twice (e.g. double-click) only one email
  // is dispatched.
  //
  function _wireDeliveryStatusChange(order, customer) {
    const sel = document.getElementById('update-delivery-status');
    if (!sel) return;

    // Map DB status values to NotificationService event types
    const DELIVERY_EMAIL_MAP = {
      shipped:          'shipped',
      out_for_delivery: 'out_for_delivery',
      delivered:        'delivered',
    };

    sel.addEventListener('change', async () => {
      const newStatus = sel.value;
      const eventType = DELIVERY_EMAIL_MAP[newStatus];

      // ── Save status immediately ──────────────────────────────
      try {
        await SF.updateOrder(order.id, { status: newStatus });
      } catch (err) {
        UI.toast('Failed to save status: ' + (err.message || ''), 'error');
        // Revert the select to previous value
        sel.value = sel.dataset.originalStatus || order.status;
        return;
      }

      // ── Update the data-original-status so next change is accurate
      sel.dataset.originalStatus = newStatus;

      // ── Send notification if this transition triggers one ────
      if (!eventType) return;           // processing / cancelled — no email
      if (!customer?.email) return;     // no customer email — skip silently

      if (typeof NotificationService === 'undefined') return;

      // Re-fetch the order to get the latest delivery_email_sent_statuses
      const freshOrders = await SF.getOrders();
      const freshOrder  = freshOrders.find(x => x.id === order.id) || order;

      const user = await SF.getUser();
      const result = await NotificationService.sendOrderEmail(
        eventType,
        freshOrder,
        customer,
        user,
      );

      if (result.success) {
        const labels = { shipped: 'Shipped', out_for_delivery: 'Out for delivery', delivered: 'Delivered' };
        UI.toast(`📧 Customer notified: ${labels[eventType] || newStatus}`, 'success');
      } else if (result.error?.includes('already sent')) {
        // Silent — duplicate guard fired. Status was already updated.
      } else if (result.error) {
        console.warn('[Modals] Delivery email skipped:', result.error);
      }
    });
  }


  // ─── Send Follow-up Email ─────────────────────────────────────
  //
  // Called by the inline onclick on the follow-up button rendered inside
  // ViewOrderContent. Handles its own loading/success/error UI states.
  //
  async function sendFollowupEmail(orderId) {
    // ── Plan gate (UI check — NotificationService also checks) ──
    if (typeof NotificationService !== 'undefined' && !NotificationService.canSendFollowup()) {
      UI.toast('Upgrade to Bronze or Platinum to send payment follow-ups.', 'warn');
      return;
    }

    const btn     = document.getElementById('followup-send-btn');
    const btnIcon = document.getElementById('followup-btn-icon');
    const btnText = document.getElementById('followup-btn-text');
    if (!btn) return;

    // ── Loading state ─────────────────────────────────────────
    btn.disabled = true;
    if (btnIcon) btnIcon.innerHTML = '<span class="sf-spinner" style="width:14px;height:14px;border-width:2px;display:inline-block;vertical-align:middle"></span>';
    if (btnText) btnText.textContent = 'Sending…';

    try {
      const [orders, customers] = await Promise.all([
        SF.getOrders(),
        SF.getCustomers(),
      ]);
      const order    = orders.find(x => x.id === orderId);
      const customer = order ? customers.find(c => c.id === order.customerId) : null;
      const user     = await SF.getUser();

      if (!order) {
        UI.toast('Order not found.', 'error');
        return;
      }

      if (!customer?.email) {
        UI.toast('No email address on file for this customer.', 'warn');
        return;
      }

      const result = await NotificationService.sendOrderEmail(
        'payment_followup',
        order,
        customer,
        user,
      );

      if (result.success) {
        UI.toast(`📧 Follow-up sent to ${customer.email}!`, 'success');

        // ── Update the "last sent" timestamp in the modal ──────
        const lastSentEl = document.getElementById('followup-last-sent');
        if (lastSentEl) {
          lastSentEl.textContent = `Last sent: ${SF.formatDate(new Date().toISOString())}`;
          lastSentEl.style.display = '';
        }

        // ── Animate button to "Sent" state ─────────────────────
        btn.style.background = 'var(--success)';
        if (btnIcon) btnIcon.textContent = '✅';
        if (btnText) btnText.textContent = 'Follow-up Sent!';

        // Reset after 4 seconds so it can be used again
        setTimeout(() => {
          btn.style.background = 'var(--warn)';
          if (btnIcon) btnIcon.textContent = '📧';
          if (btnText) btnText.textContent = 'Send Follow-up Email';
          btn.disabled = false;
        }, 4000);

      } else {
        UI.toast(result.error || 'Failed to send follow-up.', 'error');
        if (btnIcon) btnIcon.textContent = '📧';
        if (btnText) btnText.textContent = 'Send Follow-up Email';
        btn.disabled = false;
      }

    } catch (err) {
      UI.toast(err.message || 'Failed to send follow-up.', 'error');
      if (btnIcon) btnIcon.textContent = '📧';
      if (btnText) btnText.textContent = 'Send Follow-up Email';
      btn.disabled = false;
    }
  }


  // ─── Invoice Preview ──────────────────────────────────────────
  async function showInvoice(id) {
    document.getElementById('invoice-preview-body').innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;padding:60px">
        <div class="sf-spinner"></div>
      </div>`;
    UI.openModal('modal-invoice');

    try {
      const orders    = await SF.getOrders();
      const o         = orders.find(x => x.id === id);
      if (!o) { UI.toast('Order not found', 'error'); UI.closeModal('modal-invoice'); return; }

      const user      = await SF.getUser();
      const customers = await SF.getCustomers();
      const cust      = customers.find(c => c.id === o.customerId);
      const isPaid    = o.payment === 'paid';

      document.getElementById('invoice-preview-body').innerHTML = Components.InvoiceTemplate(o, user || {});

      // ── Toggle payment ─────────────────────────────────────────
      const toggleBtn = document.getElementById('invoice-toggle-payment');
      toggleBtn.textContent = isPaid ? '↩️ Mark as Pending' : '✅ Mark as Paid';
      toggleBtn.className   = `btn ${isPaid ? 'btn-secondary' : 'btn-success'}`;
      toggleBtn.onclick = async () => {
        try {
          await SF.updateOrder(id, { payment: isPaid ? 'pending' : 'paid' });
          UI.toast(`Payment marked as ${isPaid ? 'pending' : 'paid'}`, 'success');
          UI.closeModal('modal-invoice');
          await Promise.all([Pages.billing(), Pages.orders(), UI.updateBadges()]);
        } catch (err) {
          UI.toast(err.message || 'Failed to update payment', 'error');
        }
      };

      // ── WhatsApp Share ─────────────────────────────────────────
      const waBtn    = document.getElementById('invoice-wa-btn');
      const phoneNum = cust?.phone || '';
      waBtn.title    = phoneNum ? `Share via WhatsApp to ${phoneNum}` : 'WhatsApp (No phone saved)';
      waBtn.onclick  = () => {
        const msg        = UI.generateInvoiceMessage(o, user || {});
        const encoded    = encodeURIComponent(msg);
        const cleanPhone = phoneNum.replace(/[^\d+]/g, '');
        const url = cleanPhone
          ? `https://wa.me/${cleanPhone.startsWith('+') ? cleanPhone.slice(1) : cleanPhone}?text=${encoded}`
          : `https://api.whatsapp.com/send?text=${encoded}`;
        if (!cleanPhone) UI.toast('No customer phone found. Opening WhatsApp Web.', 'info');
        window.open(url, '_blank');
      };

      // ── Copy Message ───────────────────────────────────────────
      document.getElementById('invoice-copy-msg-btn').onclick = () => {
        const msg = UI.generateInvoiceMessage(o, user || {});
        if (navigator.clipboard) {
          navigator.clipboard.writeText(msg)
            .then(() => UI.toast('Invoice message copied!', 'success'))
            .catch(() => _fallbackCopy(msg));
        } else {
          _fallbackCopy(msg);
        }
      };

      // ── Download PDF ───────────────────────────────────────────
      document.getElementById('invoice-download-btn').onclick = () => {
        _printInvoice(o, user || {});
      };

    } catch (err) {
      UI.toast(err.message || 'Failed to load invoice', 'error');
      UI.closeModal('modal-invoice');
    }
  }

  // ─── Print Invoice ────────────────────────────────────────────
  function _printInvoice(o, user) {
    const invoiceHTML = Components.InvoiceTemplate(o, user);

    const invoiceCSS = `
      @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'DM Sans', Arial, sans-serif; background: #ffffff; color: #1a1a1a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @page { size: A4 portrait; margin: 14mm 16mm; }
      .invoice-wrapper { background: #ffffff; color: #1a1a1a; border-radius: 12px; padding: 40px; font-family: 'DM Sans', Arial, sans-serif; width: 100%; }
      .invoice-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 2px solid #f0f0f0; }
      .invoice-brand .brand-name { font-size: 24px; font-weight: 700; color: #6366f1; letter-spacing: -0.5px; }
      .invoice-meta { text-align: right; }
      .invoice-number { font-size: 20px; font-weight: 800; color: #1a1a1a; letter-spacing: -0.5px; }
      .invoice-parties { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 28px; }
      .invoice-party-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; color: #999; margin-bottom: 8px; }
      .invoice-party-name { font-size: 16px; font-weight: 700; color: #1a1a1a; margin-bottom: 3px; }
      .invoice-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
      .invoice-table th { background: #f8f8f8 !important; padding: 10px 14px; text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #888; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .invoice-table td { padding: 12px 14px; font-size: 13px; color: #444; border-bottom: 1px solid #f0f0f0; }
      .invoice-totals { display: flex; justify-content: flex-end; }
      .invoice-totals-inner { width: 240px; }
      .invoice-total-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; color: #666; }
      .invoice-total-row.grand { border-top: 2px solid #e0e0e0; margin-top: 6px; padding-top: 10px; font-size: 16px; font-weight: 800; color: #1a1a1a; }
      .invoice-footer { margin-top: 32px; padding-top: 20px; border-top: 1px solid #f0f0f0; text-align: center; font-size: 11px; color: #bbb; }
      .invoice-status-paid    { background: #d1fae5 !important; color: #059669 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .invoice-status-pending { background: #fef3c7 !important; color: #d97706 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      :root { --text-primary: #1a1a1a; --text-muted: #888; }
    `;

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;border:none;visibility:hidden';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Invoice ${o.id}</title><style>${invoiceCSS}</style></head><body>${invoiceHTML}</body></html>`);
    doc.close();

    const win = iframe.contentWindow;
    const doPrint = () => {
      win.focus();
      win.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) document.body.removeChild(iframe);
      }, 1000);
    };

    if (win.document.fonts?.ready) {
      win.document.fonts.ready.then(doPrint);
    } else {
      setTimeout(doPrint, 400);
    }

    UI.toast('Print dialog opening — choose "Save as PDF" 🖨️', 'info');
  }

  function _fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); UI.toast('Message copied!', 'success'); }
    catch { UI.toast('Failed to copy', 'error'); }
    document.body.removeChild(ta);
  }

  // ─── View Customer ────────────────────────────────────────────
  async function viewCustomer(id) {
    document.getElementById('view-customer-content').innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;padding:60px">
        <div class="sf-spinner"></div>
      </div>`;
    UI.openModal('modal-view-customer');

    try {
      const [customers, orders] = await Promise.all([
        SF.getCustomers(),
        SF.getOrders(),
      ]);
      const c = customers.find(x => x.id === id);
      if (!c) { UI.toast('Customer not found', 'error'); UI.closeModal('modal-view-customer'); return; }

      const custOrders = orders.filter(o => o.customerId === id);
      document.getElementById('view-customer-content').innerHTML =
        Components.ViewCustomerContent(c, custOrders);
    } catch (err) {
      UI.toast(err.message || 'Failed to load customer', 'error');
      UI.closeModal('modal-view-customer');
    }
  }

  // Public API
  return {
    openAddProduct, editProduct, saveProduct, deleteProduct,
    openCreateOrder, handleCustomerSelectChange, addOrderItem, removeOrderItem, saveOrder,
    viewOrder, showInvoice, viewCustomer,
    sendFollowupEmail,   // ← new: called from follow-up button onclick
  };
})();
