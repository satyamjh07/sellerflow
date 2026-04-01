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

      const user = await SF.getUser();
      const customers = await SF.getCustomers();
      const cust = customers.find(c => c.id === o.customerId);
      const isPaid = o.payment === 'paid';

      document.getElementById('invoice-preview-body').innerHTML = Components.InvoiceTemplate(o, user || {});

      // Toggle payment button
      const toggleBtn = document.getElementById('invoice-toggle-payment');
      toggleBtn.textContent = isPaid ? '↩️ Mark as Pending' : '✅ Mark as Paid';
      toggleBtn.className = `btn ${isPaid ? 'btn-secondary' : 'btn-success'}`;
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

      // WhatsApp Share
      const waBtn = document.getElementById('invoice-wa-btn');
      const phoneNum = cust?.phone || '';
      waBtn.title = phoneNum ? `Share via WhatsApp to ${phoneNum}` : 'WhatsApp (No phone saved)';
      waBtn.onclick = () => {
        const msg        = UI.generateInvoiceMessage(o, user || {});
        const encoded    = encodeURIComponent(msg);
        const cleanPhone = phoneNum.replace(/[^\d+]/g, '');
        const url = cleanPhone
          ? `https://wa.me/${cleanPhone.startsWith('+') ? cleanPhone.slice(1) : cleanPhone}?text=${encoded}`
          : `https://api.whatsapp.com/send?text=${encoded}`;
        if (!cleanPhone) UI.toast('No customer phone found. Opening WhatsApp Web.', 'info');
        window.open(url, '_blank');
      };

      // Copy Message
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

      // Print
      document.getElementById('invoice-print-btn').onclick = () => {
        const invoiceContent = document.getElementById('invoice-print-area').outerHTML;
        const portal = document.getElementById('print-portal');
        portal.innerHTML = invoiceContent;
        setTimeout(() => {
          window.print();
          setTimeout(() => { portal.innerHTML = ''; }, 500);
        }, 100);
      };

    } catch (err) {
      UI.toast(err.message || 'Failed to load invoice', 'error');
      UI.closeModal('modal-invoice');
    }
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
