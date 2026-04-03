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
      // Runs in setTimeout(0) so it is fully outside this try/catch.
      // A broken email config will NEVER block order creation or show
      // a false "order failed" error. The order is already saved at this point.
      setTimeout(async () => {
        try {
          const user = await SF.getUser();
          if (!user?.autoEmail) return; // Toggle is OFF in Settings — skip

          // Re-fetch customer by ID so newly-created customers are found too
          const allCustomers = await SF.getCustomers();
          const savedCustomer = allCustomers.find(c => c.id === customerId);

          if (!savedCustomer?.email) {
            console.info(`[SellerFlow] Email skipped for ${created.id} — no email on file for customer.`);
            return;
          }

          // Build the full self-contained invoice HTML (email-safe, table-based)
          const invoiceHTML = Components.generateInvoiceEmailHTML(created, savedCustomer, user);

          await emailjs.send('service_5k8qt0o', 'template_x6h0iqc', {
            to_email:     savedCustomer.email,
            to_name:      customerName,
            order_id:     created.id,
            order_total:  SF.formatCurrency(created.total),
            store_name:   user.store || 'SellerFlow Store',
            invoice_html: invoiceHTML,   // ← full rendered invoice injected here
          });

          UI.toast(`Confirmation email sent to ${savedCustomer.email} 📧`, 'success');
        } catch (emailErr) {
          // Email errors are non-fatal — warn without surfacing as an order error
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
      // WHY IFRAME + html2pdf.js (not window.print, not off-screen clone):
      // ─────────────────────────────────────────────────────────────────
      // window.print() opens a dialog the user must manually dismiss,
      // and on Android/iOS in-app browsers it produces blank white pages.
      //
      // Off-screen clones at left:-9999px are cropped by html2canvas
      // because it captures from viewport (0,0) — left column disappears.
      //
      // SOLUTION: inject the invoice into a visibility:hidden <iframe>
      // at position (0,0). The iframe has its own document with (0,0)
      // origin, so html2canvas captures the full width correctly.
      // html2pdf generates a Blob → we trigger <a download> for a real
      // one-click save with no dialog on desktop; iOS opens in new tab
      // where the seller can Share → Save to Files.
      //
      const dlBtn = document.getElementById('invoice-download-btn');
      dlBtn.onclick = async () => {
        await _downloadInvoicePDF(o, user || {});
      };

    } catch (err) {
      UI.toast(err.message || 'Failed to load invoice', 'error');
      UI.closeModal('modal-invoice');
    }
  }

  // ─── PDF Download (iframe + html2pdf.js pipeline) ─────────────
  //
  // Renders a complete, self-contained HTML document in a hidden iframe
  // (same document approach as _printInvoice but uses html2pdf.js to
  // produce a Blob instead of calling window.print).
  //
  // The invoice CSS is inlined — zero dependency on style.css. The
  // InvoiceTemplate already uses 100% inline styles for all colours
  // and layout, so the PDF captures perfectly on first try.
  //
  async function _downloadInvoicePDF(o, user) {
    if (typeof html2pdf === 'undefined') {
      // Fallback to print dialog if the CDN script didn't load
      UI.toast('PDF library not loaded. Opening print dialog instead.', 'warn');
      _printFallback(o, user);
      return;
    }

    const dlBtn = document.getElementById('invoice-download-btn');
    if (dlBtn) {
      dlBtn.disabled = true;
      dlBtn.innerHTML = '<span style="display:inline-block;width:13px;height:13px;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;animation:spin 0.7s linear infinite;vertical-align:middle;margin-right:6px"></span>Generating…';
    }

    // ── 1. Build the iframe ──────────────────────────────────────
    // visibility:hidden keeps it invisible but still fully laid out.
    // top:0; left:0 puts the document origin at (0,0) so html2canvas
    // captures from the correct starting position.
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:0;left:0;width:794px;height:1px;border:none;visibility:hidden;z-index:-9999';
    document.body.appendChild(iframe);

    try {
      const invoiceHTML = Components.InvoiceTemplate(o, user);
      const filename    = `invoice-${o.id}.pdf`;

      // ── 2. Write a complete self-contained document ──────────────
      // All invoice CSS inlined — no external stylesheet dependency.
      // CSS variables resolved to literals so they work in the isolated
      // iframe document that doesn't inherit :root from the dark theme.
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      iframeDoc.open();
      iframeDoc.write(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,Helvetica,sans-serif;background:#fff;color:#1a1a1a;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  table{border-collapse:collapse}
  td,th{vertical-align:top}
  p{margin:0}
  img{max-width:100%;display:block}
  /* Resolve any CSS vars that survive from InvoiceTemplate inline styles */
  :root{--text-primary:#1a1a1a;--text-muted:#888;--text-secondary:#666;--accent:#6366F1;--bg-input:#f8f8f8;--border:rgba(0,0,0,0.08)}
</style>
</head>
<body>${invoiceHTML}</body>
</html>`);
      iframeDoc.close();

      // ── 3. Wait for layout to settle ─────────────────────────────
      await new Promise(resolve => setTimeout(resolve, 150));

      const invoiceEl = iframeDoc.getElementById('invoice-print-area')
                     || iframeDoc.body.firstElementChild;
      if (!invoiceEl) throw new Error('Invoice element not found in iframe');

      // ── 4. Generate PDF Blob via html2pdf ────────────────────────
      // html2canvas runs in the iframe's own window context so its
      // (0,0) is the top-left of the invoice — no left-column cropping.
      const blob = await html2pdf()
        .set({
          margin:      [10, 10, 10, 10],
          filename,
          image:       { type: 'jpeg', quality: 0.98 },
          html2canvas: {
            scale:           2,          // retina sharpness
            useCORS:         true,
            backgroundColor: '#ffffff',
            logging:         false,
            scrollX:         0,
            scrollY:         0,
            windowWidth:     794,
            windowHeight:    iframeDoc.body.scrollHeight || 1123,
          },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['avoid-all', 'css'] },
        })
        .from(invoiceEl, 'element')
        .output('blob');

      // ── 5. Trigger download ──────────────────────────────────────
      const blobUrl = URL.createObjectURL(blob);
      const anchor  = document.createElement('a');
      anchor.href     = blobUrl;
      anchor.download = filename;
      anchor.style.display = 'none';
      document.body.appendChild(anchor);

      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        // iOS Safari: <a download> not supported — open in new tab
        // User can tap Share → Save to Files to keep the PDF
        window.open(blobUrl, '_blank');
        UI.toast('PDF opened — tap Share to save it 📄', 'info');
      } else {
        anchor.click();
        UI.toast(`invoice-${o.id}.pdf downloaded ✅`, 'success');
      }

      document.body.removeChild(anchor);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);

    } catch (err) {
      console.error('[SellerFlow] PDF generation failed:', err);
      UI.toast('PDF generation failed — opening print dialog instead', 'warn');
      _printFallback(o, user);
    } finally {
      // Always clean up iframe and restore button
      if (document.body.contains(iframe)) document.body.removeChild(iframe);
      if (dlBtn) {
        dlBtn.disabled = false;
        dlBtn.innerHTML = '⬇️ Download PDF';
      }
    }
  }

  // ─── Print fallback (when html2pdf.js fails or isn't loaded) ──
  // Opens the browser's native print dialog. Better than nothing on
  // rare edge cases (offline, CDN blocked, very old browser).
  function _printFallback(o, user) {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;border:none;visibility:hidden';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}:root{--text-primary:#1a1a1a;--text-muted:#888;--text-secondary:#666;--accent:#6366F1;--bg-input:#f8f8f8;--border:rgba(0,0,0,0.08)}table{border-collapse:collapse}td,th{vertical-align:top}p{margin:0}@page{size:A4 portrait;margin:14mm 16mm}</style>
</head><body>${Components.InvoiceTemplate(o, user)}</body></html>`);
    doc.close();

    const win = iframe.contentWindow;
    const doPrint = () => {
      win.focus();
      win.print();
      setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 1000);
    };

    if (win.document.fonts?.ready) {
      win.document.fonts.ready.then(doPrint);
    } else {
      setTimeout(doPrint, 400);
    }

    UI.toast('Opening print dialog — choose "Save as PDF" 🖨️', 'info');
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
