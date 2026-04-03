// SellerFlow — Modals Module (Async / Supabase Edition)
// All data interactions are now async. UI feedback via UI.toast().
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
    // Fetch fresh from DB (not cache) so editing reflects latest stock
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
    // Reset new-customer fields
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
        const name    = document.getElementById('new-customer-name').value.trim();
        const insta   = document.getElementById('new-customer-insta').value.trim();
        const phone   = document.getElementById('new-customer-phone').value.trim();
        const email   = document.getElementById('new-customer-email').value.trim();
        const address = document.getElementById('new-customer-address').value.trim();
        const landmark= document.getElementById('new-customer-landmark').value.trim();
        const city    = document.getElementById('new-customer-city').value.trim();
        const state   = document.getElementById('new-customer-state').value.trim();
        const pincode = document.getElementById('new-customer-pincode').value.trim();

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

      } else if (customerSel) {
        const customers = await SF.getCustomers();
        const cust = customers.find(c => c.id === customerSel);
        if (!cust) { UI.toast('Customer not found', 'error'); return; }
        customerId   = cust.id;
        customerName = cust.name;

        // Build shipping address from saved profile
        const parts = [cust.address, cust.landmark, cust.city, cust.state, cust.pincode].filter(Boolean);
        var shippingAddress = parts.join(', ');

      } else {
        UI.toast('Please select or create a customer', 'error');
        return;
      }

      // For new customers the shipping address is built from the form fields
      if (customerSel === 'new') {
        const addr    = document.getElementById('new-customer-address').value.trim();
        const lm      = document.getElementById('new-customer-landmark').value.trim();
        const city    = document.getElementById('new-customer-city').value.trim();
        const state   = document.getElementById('new-customer-state').value.trim();
        const pincode = document.getElementById('new-customer-pincode').value.trim();
        var shippingAddress = [addr, lm, city, state, pincode].filter(Boolean).join(', ');
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

      // ── Order limit gate (Free plan: 20/month) ────────────────
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

      // ─── Auto Email Confirmation (non-blocking) ────────────────────────────
      // Runs in setTimeout(0) — fully outside the order try/catch so a broken
      // email config can NEVER block or roll back order creation.
      //
      // ROOT CAUSE OF PREVIOUS ERR_HTTP2_PROTOCOL_ERROR:
      // Sending the full invoice HTML (~15-17KB) as a JSON variable caused
      // HTTP/2 DATA frame fragmentation errors between Cloudflare-hosted sites
      // and api.emailjs.com. The fix: send only small structured text variables
      // and render the visual invoice inside the EmailJS template itself using
      // {{invoice_items}}, {{total}}, etc. — keeping the payload under 2KB.
      //
      setTimeout(async () => {
        try {
          const user = await SF.getUser();
          if (!user?.autoEmail) return; // Toggle is OFF in Settings — skip

          const allCustomers = await SF.getCustomers();
          const savedCustomer = allCustomers.find(c => c.id === customerId);

          if (!savedCustomer?.email) {
            console.info(`[SellerFlow] Email skipped for ${created.id} — no email on file.`);
            return;
          }

          // ── Build a compact plain-text items summary ─────────────────────
          // Keeps the total payload well under 5KB — no HTTP/2 frame issues.
          const itemsSummary = (created.items || [])
            .map(i => `• ${i.name} × ${i.qty}  →  ${SF.formatCurrency(i.price * i.qty)}`)
            .join('\n');

          const paymentLine  = created.payment === 'paid' ? '✅ PAID' : '⏳ PAYMENT PENDING';
          const customerFirst = customerName.split(' ')[0];

          // ── Small HTML snippet for the email body ────────────────────────
          // This is NOT a full HTML document — just a <div> block with the
          // essential order details. Total size: ~500–800 bytes, not 15KB.
          // The EmailJS template wraps it in whatever header/footer you've set.
          const invoiceSnippet = [
            `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">`,
            `  <div style="background:#6366F1;color:#fff;padding:20px 24px;border-radius:10px 10px 0 0">`,
            `    <p style="margin:0;font-size:18px;font-weight:700">🛍️ ${user.store || 'SellerFlow Store'}</p>`,
            `    <p style="margin:6px 0 0;font-size:13px;opacity:0.85">Order Confirmation</p>`,
            `  </div>`,
            `  <div style="background:#f9fafb;padding:20px 24px;border:1px solid #e5e7eb">`,
            `    <p style="margin:0 0 4px;font-size:13px;color:#6b7280">Order ID</p>`,
            `    <p style="margin:0 0 16px;font-size:16px;font-weight:700;color:#111827">#${created.id}</p>`,
            `    <p style="margin:0 0 4px;font-size:13px;color:#6b7280">Items</p>`,
            `    <pre style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:13px;color:#374151;white-space:pre-wrap">${itemsSummary}</pre>`,
            `    <p style="margin:0 0 4px;font-size:13px;color:#6b7280">Total</p>`,
            `    <p style="margin:0 0 16px;font-size:20px;font-weight:700;color:#6366F1">${SF.formatCurrency(created.total)}</p>`,
            `    <p style="margin:0 0 4px;font-size:13px;color:#6b7280">Payment</p>`,
            `    <p style="margin:0 0 16px;font-size:14px;font-weight:600;color:#111827">${paymentLine}</p>`,
            user.upiId ? `    <div style="background:#eef2ff;border-radius:8px;padding:12px 16px;margin-top:8px">` +
              `<p style="margin:0;font-size:12px;color:#6366F1;font-weight:600">💳 Pay via UPI</p>` +
              `<p style="margin:4px 0 0;font-size:15px;font-weight:700;color:#111827">${user.upiId}</p></div>` : '',
            `  </div>`,
            `  <div style="padding:16px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;text-align:center">`,
            `    <p style="margin:0;font-size:13px;color:#6b7280">Questions? DM us or reply to this email 💜</p>`,
            `  </div>`,
            `</div>`,
          ].filter(Boolean).join('\n');

          // ── Send via EmailJS with small payload ──────────────────────────
          // Total payload: ~1-2KB vs the previous ~17KB that caused HTTP/2 errors.
          await emailjs.send('service_5k8qt0o', 'template_x6h0iqc', {
            to_email:      savedCustomer.email,
            to_name:       customerFirst,
            order_id:      created.id,
            order_total:   SF.formatCurrency(created.total),
            store_name:    user.store || 'SellerFlow Store',
            payment_status: paymentLine,
            items_summary: itemsSummary,
            invoice_html:  invoiceSnippet,   // compact snippet, not a full HTML doc
          });

          UI.toast(`Confirmation email sent to ${savedCustomer.email} 📧`, 'success');
        } catch (emailErr) {
          console.error('[SellerFlow] EmailJS send failed:', emailErr);
          UI.toast('Order saved! (Email delivery failed — check browser Console)', 'warn');
        }
      }, 0);

      // Refresh affected pages
      await Promise.all([Pages.orders(), Pages.dashboard(), UI.updateBadges()]);

    } catch (err) {
      UI.toast(err.message || 'Failed to create order', 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = '✅ Create Order';
    }
  }

  // ─── View / Edit Order ────────────────────────────────────────
  async function viewOrder(id) {
    const orders = await SF.getOrders();
    const o = orders.find(x => x.id === id);
    if (!o) { UI.toast('Order not found', 'error'); return; }

    const content = document.getElementById('view-order-content');
    content.innerHTML = Components.ViewOrderContent(o);

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

  // ─── Invoice Preview ──────────────────────────────────────────
  async function showInvoice(id) {
    // Show modal immediately with a loading spinner
    document.getElementById('invoice-preview-body').innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;padding:60px">
        <div class="sf-spinner"></div>
      </div>`;
    UI.openModal('modal-invoice');

    try {
      const orders = await SF.getOrders();
      const o = orders.find(x => x.id === id);
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
      //
      // WHY PRINT WINDOW INSTEAD OF html2canvas / html2pdf:
      // ─────────────────────────────────────────────────────────
      // html2canvas rasterises the DOM to a <canvas> bitmap. It CANNOT
      // load external stylesheets (CORS + async timing), so the invoice
      // classes (invoice-header, invoice-parties, invoice-table, etc.)
      // render unstyled — the flex/grid layout collapses and the left
      // column disappears entirely. This is the root cause of the bug.
      //
      // The browser's native print engine has no such limitation:
      //   • It renders HTML exactly as it would on screen
      //   • Supports all CSS (flex, grid, custom properties, fonts)
      //   • Produces a true vector PDF — not a blurry JPEG screenshot
      //   • Works identically on Chrome, Safari, Firefox, Edge
      //   • No third-party library needed
      //
      // APPROACH: open a hidden <iframe>, write a self-contained HTML
      // document that includes ALL invoice CSS inlined in a <style> tag
      // (no external file dependency), then call iframe.contentWindow.print().
      // The iframe is removed after the print dialog closes.
      //
      document.getElementById('invoice-download-btn').onclick = () => {
        _printInvoice(o, user || {});
      };

    } catch (err) {
      UI.toast(err.message || 'Failed to load invoice', 'error');
      UI.closeModal('modal-invoice');
    }
  }

  // ─── Print Invoice (PDF export pipeline) ─────────────────────
  //
  // Renders the invoice into a dedicated hidden iframe that owns its
  // own document. All CSS is inlined — zero dependency on style.css.
  // Calls iframe.contentWindow.print() to open the browser print dialog
  // where the user selects "Save as PDF".
  //
  // Layout: identical to the in-app modal preview because the same
  // InvoiceTemplate HTML string is used, just with the styles embedded.
  //
  function _printInvoice(o, user) {
    // ── Build the invoice HTML from the existing template ───────
    const invoiceHTML = Components.InvoiceTemplate(o, user);

    // ── All invoice CSS — inlined so no external file is needed ─
    // CSS variables resolved to literal values so they work in a
    // detached document that doesn't have :root defined.
    const invoiceCSS = `
      @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
      @import url('https://api.fontshare.com/v2/css?f[]=clash-display@400,500,600,700&display=swap');

      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

      body {
        font-family: 'DM Sans', Arial, sans-serif;
        background: #ffffff;
        color: #1a1a1a;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      /* ── Page setup ──────────────────────────────────────────── */
      @page {
        size: A4 portrait;
        margin: 14mm 16mm;
      }

      /* ── Invoice wrapper ─────────────────────────────────────── */
      .invoice-wrapper {
        background: #ffffff;
        color: #1a1a1a;
        border-radius: 12px;
        padding: 40px;
        font-family: 'DM Sans', Arial, sans-serif;
        width: 100%;
        max-width: 100%;
      }

      /* ── Header: brand left, meta right ─────────────────────── */
      .invoice-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 32px;
        padding-bottom: 24px;
        border-bottom: 2px solid #f0f0f0;
      }

      .invoice-brand .brand-name {
        font-family: 'Clash Display', 'DM Sans', Arial, sans-serif;
        font-size: 24px;
        font-weight: 700;
        color: #6366f1;
        letter-spacing: -0.5px;
      }
      .invoice-brand p {
        font-size: 12px;
        color: #888888;
        margin-top: 2px;
      }

      .invoice-meta { text-align: right; }
      .invoice-number {
        font-family: 'Clash Display', 'DM Sans', Arial, sans-serif;
        font-size: 20px;
        font-weight: 800;
        color: #1a1a1a;
        letter-spacing: -0.5px;
      }
      .invoice-meta p { font-size: 12px; color: #888888; margin-top: 3px; }

      /* ── Status badge ────────────────────────────────────────── */
      .invoice-status-banner {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 14px;
        border-radius: 99px;
        font-size: 12px;
        font-weight: 700;
        margin-top: 8px;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .invoice-status-paid    { background: #d1fae5 !important; color: #059669 !important; }
      .invoice-status-pending { background: #fef3c7 !important; color: #d97706 !important; }

      /* ── From / Bill To ──────────────────────────────────────── */
      .invoice-parties {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 24px;
        margin-bottom: 28px;
      }
      .invoice-party-label {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 1px;
        font-weight: 700;
        color: #999999;
        margin-bottom: 8px;
      }
      .invoice-party-name {
        font-size: 16px;
        font-weight: 700;
        color: #1a1a1a;
        margin-bottom: 3px;
      }
      .invoice-party p {
        font-size: 12px;
        color: #666666;
        line-height: 1.6;
      }

      /* ── Items table ─────────────────────────────────────────── */
      .invoice-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 24px;
      }
      .invoice-table th {
        background: #f8f8f8 !important;
        padding: 10px 14px;
        text-align: left;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: #888888;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .invoice-table td {
        padding: 12px 14px;
        font-size: 13px;
        color: #444444;
        border-bottom: 1px solid #f0f0f0;
      }
      .invoice-table tr:last-child td { border-bottom: none; }

      /* ── Totals ──────────────────────────────────────────────── */
      .invoice-totals {
        display: flex;
        justify-content: flex-end;
      }
      .invoice-totals-inner { width: 240px; }
      .invoice-total-row {
        display: flex;
        justify-content: space-between;
        padding: 5px 0;
        font-size: 13px;
        color: #666666;
      }
      .invoice-total-row.grand {
        border-top: 2px solid #e0e0e0;
        margin-top: 6px;
        padding-top: 10px;
        font-size: 16px;
        font-weight: 800;
        color: #1a1a1a;
      }

      /* ── Footer ──────────────────────────────────────────────── */
      .invoice-footer {
        margin-top: 32px;
        padding-top: 20px;
        border-top: 1px solid #f0f0f0;
        text-align: center;
        font-size: 11px;
        color: #bbbbbb;
      }

      /* ── Resolve CSS vars used in InvoiceTemplate inline styles ─ */
      /* (InvoiceTemplate uses var(--text-primary) etc. in item rows) */
      :root {
        --text-primary: #1a1a1a;
        --text-muted:   #888888;
      }
    `;

    // ── Create hidden iframe ─────────────────────────────────────
    const iframe = document.createElement('iframe');
    iframe.style.cssText = [
      'position:fixed',
      'top:0', 'left:0',
      'width:0', 'height:0',
      'border:none',
      'visibility:hidden',
    ].join(';');
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Invoice ${o.id}</title>
  <style>${invoiceCSS}</style>
</head>
<body>
  ${invoiceHTML}
</body>
</html>`);
    doc.close();

    // ── Wait for fonts + layout, then print ─────────────────────
    // document.fonts.ready ensures web fonts are loaded before print
    // so character widths are calculated correctly.
    const win = iframe.contentWindow;

    const doPrint = () => {
      win.focus();
      win.print();
      // Remove iframe after a short delay — long enough for the
      // print dialog to open; the dialog keeps a reference to the
      // document independently so removing the iframe is safe.
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1000);
    };

    if (win.document.fonts && win.document.fonts.ready) {
      win.document.fonts.ready.then(doPrint);
    } else {
      // Fallback for browsers without FontFaceSet API
      setTimeout(doPrint, 400);
    }

    UI.toast('Print dialog opening — choose "Save as PDF" to download 🖨️', 'info');
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
    // Show modal immediately with loading
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
  };
})();
