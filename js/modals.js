// SellerFlow — Modals Module
// All modal open/close logic + form handling
// ================================================================

const Modals = (() => {

  // ─── State ────────────────────────────────────────
  let editingProductId = null;
  let orderItems = [];

  // ─── Add / Edit Product Modal ─────────────────────
  function openAddProduct() {
    editingProductId = null;
    document.getElementById('product-modal-title').textContent = 'Add Product';
    document.getElementById('product-form').reset();
    document.getElementById('product-id').value = '';
    UI.openModal('modal-product');
  }

  function editProduct(id) {
    const p = SF.getProducts().find(x => x.id === id);
    if (!p) return;
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

  function saveProduct() {
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

    const data = { name, sku, category, price, stock, lowStockThreshold: threshold, emoji };

    if (editingProductId) {
      SF.updateProduct(editingProductId, data);
      UI.toast(`${name} updated successfully`, 'success');
    } else {
      SF.addProduct(data);
      UI.toast(`${name} added to inventory`, 'success');
    }

    UI.closeModal('modal-product');
    Pages.products();
    UI.updateBadges();
  }

  function deleteProduct(id) {
    const p = SF.getProducts().find(x => x.id === id);
    if (!p) return;
    if (!UI.confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    SF.deleteProduct(id);
    UI.toast(`${p.name} deleted`, 'warn');
    Pages.products();
    UI.updateBadges();
  }

  // ─── Create Order Modal ───────────────────────────
  function openCreateOrder() {
    orderItems = [];
    document.getElementById('order-form').reset();
    renderOrderItems();
    populateProductDropdown();
    populateCustomerDropdown();
    UI.openModal('modal-order');
  }

  function populateProductDropdown() {
    const sel = document.getElementById('order-product-select');
    const products = SF.getProducts().filter(p => p.stock > 0);
    sel.innerHTML = `<option value="">— Select Product —</option>`;
    products.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.emoji || '📦'} ${p.name} — ${SF.formatCurrency(p.price)} (Stock: ${p.stock})`;
      sel.appendChild(opt);
    });
  }

  function populateCustomerDropdown() {
    const sel = document.getElementById('order-customer-select');
    const customers = SF.getCustomers();
    sel.innerHTML = `<option value="">— Select Existing Customer —</option><option value="new">+ New Customer</option>`;
    customers.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.name} (${c.instagram || c.phone || ''})`;
      sel.appendChild(opt);
    });
  }

  function handleCustomerSelectChange() {
    const val = document.getElementById('order-customer-select').value;
    const newCustomerFields = document.getElementById('new-customer-fields');
    newCustomerFields.style.display = val === 'new' ? 'block' : 'none';
  }

  function addOrderItem() {
    const sel = document.getElementById('order-product-select');
    const qty = parseInt(document.getElementById('order-qty-input').value) || 1;
    if (!sel.value) { UI.toast('Please select a product', 'error'); return; }

    const product = SF.getProducts().find(p => p.id === sel.value);
    if (!product) return;
    if (qty > product.stock) {
      UI.toast(`Only ${product.stock} units available for ${product.name}`, 'error');
      return;
    }

    // Check if already in items
    const existing = orderItems.find(i => i.productId === sel.value);
    if (existing) {
      existing.qty += qty;
    } else {
      orderItems.push({ productId: product.id, name: product.name, price: product.price, qty, emoji: product.emoji });
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
    const el = document.getElementById('order-items-list');
    const totalEl = document.getElementById('order-total-display');

    if (orderItems.length === 0) {
      el.innerHTML = `<div class="text-muted" style="font-size:12px;padding:12px;text-align:center">No items added yet</div>`;
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
        <button onclick="Modals.removeOrderItem(${i})" style="background:var(--danger-dim);color:var(--danger);border:none;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:11px">✕</button>
      </div>
    `).join('');

    const total = orderItems.reduce((s, i) => s + i.price * i.qty, 0);
    if (totalEl) totalEl.textContent = SF.formatCurrency(total);
  }

  function saveOrder() {
    if (orderItems.length === 0) {
      UI.toast('Please add at least one product', 'error');
      return;
    }

    const customerSel = document.getElementById('order-customer-select').value;
    let customerId, customerName;

    if (customerSel === 'new') {
      const name = document.getElementById('new-customer-name').value.trim();
      const insta = document.getElementById('new-customer-insta').value.trim();
      const phone = document.getElementById('new-customer-phone').value.trim();
      if (!name) { UI.toast('Please enter customer name', 'error'); return; }
      const nc = SF.findOrCreateCustomer(name, insta);
      if (phone) SF.updateCustomer(nc.id, { phone });
      customerId = nc.id;
      customerName = nc.name;
    } else if (customerSel) {
      const cust = SF.getCustomers().find(c => c.id === customerSel);
      if (!cust) { UI.toast('Customer not found', 'error'); return; }
      customerId = cust.id;
      customerName = cust.name;
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
      items: orderItems.map(i => ({ productId: i.productId, name: i.name, qty: i.qty, price: i.price })),
      total,
      status: 'processing',
      payment,
      notes,
    };

    const created = SF.addOrder(order);
    UI.toast(`Order ${created.id} created for ${customerName}!`, 'success');
    UI.closeModal('modal-order');
    Pages.orders();
    Pages.dashboard();
    UI.updateBadges();
  }

  // ─── View Order Modal ─────────────────────────────
  function viewOrder(id) {
    const o = SF.getOrders().find(x => x.id === id);
    if (!o) return;

    const content = document.getElementById('view-order-content');
    content.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:18px">
        <div>
          <div class="form-label">Order ID</div>
          <div class="fw-700 text-accent" style="font-size:16px">${o.id}</div>
        </div>
        <div>
          <div class="form-label">Date</div>
          <div class="fw-600">${SF.formatDate(o.date)}</div>
        </div>
        <div>
          <div class="form-label">Customer</div>
          <div class="fw-600">${o.customerName}</div>
        </div>
        <div>
          <div class="form-label">Total</div>
          <div class="fw-700" style="font-size:18px;color:var(--accent)">${SF.formatCurrency(o.total)}</div>
        </div>
      </div>

      <div class="form-label" style="margin-bottom:8px">Items</div>
      <div style="background:var(--bg-input);border-radius:8px;padding:12px;margin-bottom:16px">
        ${o.items.map(i => `
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px">
            <span>${i.name} × ${i.qty}</span>
            <span class="fw-600">${SF.formatCurrency(i.price * i.qty)}</span>
          </div>
        `).join('')}
        <div style="display:flex;justify-content:space-between;padding:8px 0;font-weight:700;font-size:14px">
          <span>Total</span>
          <span class="text-accent">${SF.formatCurrency(o.total)}</span>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
        <div>
          <div class="form-label">Delivery Status</div>
          <select id="update-delivery-status" class="form-select" style="margin-top:4px">
            ${['processing','shipped','delivered','cancelled'].map(s =>
              `<option value="${s}" ${o.status===s?'selected':''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`
            ).join('')}
          </select>
        </div>
        <div>
          <div class="form-label">Payment Status</div>
          <select id="update-payment-status" class="form-select" style="margin-top:4px">
            ${['pending','paid','refunded'].map(s =>
              `<option value="${s}" ${o.payment===s?'selected':''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`
            ).join('')}
          </select>
        </div>
      </div>

      ${o.notes ? `<div class="form-label">Notes</div><div style="font-size:13px;color:var(--text-secondary);background:var(--bg-input);padding:10px;border-radius:8px;margin-top:4px">${o.notes}</div>` : ''}
    `;

    document.getElementById('view-order-update-btn').onclick = () => {
      const delivery = document.getElementById('update-delivery-status').value;
      const payment  = document.getElementById('update-payment-status').value;
      SF.updateOrder(id, { status: delivery, payment });
      UI.toast('Order updated successfully', 'success');
      UI.closeModal('modal-view-order');
      Pages.orders();
      Pages.dashboard();
      UI.updateBadges();
    };

    document.getElementById('view-order-invoice-btn').onclick = () => {
      UI.closeModal('modal-view-order');
      showInvoice(id);
    };

    UI.openModal('modal-view-order');
  }

  // ─── Invoice Preview ──────────────────────────────
  function showInvoice(id) {
    const o = SF.getOrders().find(x => x.id === id);
    const user = SF.getUser();
    if (!o) return;

    const subtotal = o.total;
    const isPaid = o.payment === 'paid';

    const invoiceHTML = `
      <div class="invoice-wrapper" id="invoice-print-area">
        <div class="invoice-header">
          <div class="invoice-brand">
            <div class="brand-name">🛍️ ${user.store || 'SellerFlow Store'}</div>
            <p>${user.instagram || ''}</p>
            <p>${user.phone || ''}</p>
            <p>UPI: ${user.upiId || ''}</p>
          </div>
          <div class="invoice-meta">
            <div class="invoice-number">INVOICE</div>
            <p>#${o.id}</p>
            <p>Date: ${SF.formatDate(o.date)}</p>
            <div>
              <span class="invoice-status-banner ${isPaid ? 'invoice-status-paid' : 'invoice-status-pending'}">
                ${isPaid ? '✅ PAID' : '⏳ PAYMENT PENDING'}
              </span>
            </div>
          </div>
        </div>

        <div class="invoice-parties">
          <div class="invoice-party">
            <div class="invoice-party-label">From</div>
            <div class="invoice-party-name">${user.store || 'Your Store'}</div>
            <p>${user.email || ''}</p>
            <p>${user.phone || ''}</p>
          </div>
          <div class="invoice-party">
            <div class="invoice-party-label">Bill To</div>
            <div class="invoice-party-name">${o.customerName}</div>
            <p>Instagram Order</p>
            ${o.notes ? `<p>Note: ${o.notes}</p>` : ''}
          </div>
        </div>

        <table class="invoice-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Product</th>
              <th style="text-align:center">Qty</th>
              <th style="text-align:right">Unit Price</th>
              <th style="text-align:right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${o.items.map((item, i) => `
              <tr>
                <td style="color:#999">${i+1}</td>
                <td style="font-weight:600;color:#1a1a1a">${item.name}</td>
                <td style="text-align:center">${item.qty}</td>
                <td style="text-align:right">${SF.formatCurrency(item.price)}</td>
                <td style="text-align:right;font-weight:700;color:#1a1a1a">${SF.formatCurrency(item.price * item.qty)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="invoice-totals">
          <div class="invoice-totals-inner">
            <div class="invoice-total-row">
              <span>Subtotal</span>
              <span>${SF.formatCurrency(subtotal)}</span>
            </div>
            <div class="invoice-total-row">
              <span>Shipping</span>
              <span style="color:#10B981">Free</span>
            </div>
            <div class="invoice-total-row grand">
              <span>Total Due</span>
              <span style="color:#6366f1">${SF.formatCurrency(subtotal)}</span>
            </div>
          </div>
        </div>

        <div class="invoice-footer">
          <p>Thank you for shopping with us! 💜</p>
          <p style="margin-top:4px">Pay via UPI: <strong>${user.upiId || 'upi@bank'}</strong> | Questions? DM us on Instagram</p>
          <p style="margin-top:6px;font-size:10px">Generated by SellerFlow • sellerflow.in</p>
        </div>
      </div>
    `;

    document.getElementById('invoice-preview-body').innerHTML = invoiceHTML;

    // Toggle payment btn
    const toggleBtn = document.getElementById('invoice-toggle-payment');
    toggleBtn.textContent = isPaid ? '↩️ Mark as Pending' : '✅ Mark as Paid';
    toggleBtn.className = `btn ${isPaid ? 'btn-secondary' : 'btn-success'}`;
    toggleBtn.onclick = () => {
      const newStatus = isPaid ? 'pending' : 'paid';
      SF.updateOrder(id, { payment: newStatus });
      UI.toast(`Payment marked as ${newStatus}`, 'success');
      UI.closeModal('modal-invoice');
      Pages.billing();
      Pages.orders();
      UI.updateBadges();
    };

  document.getElementById('invoice-print-btn').onclick = () => {
  const invoiceContent = document.getElementById('invoice-print-area').outerHTML;

  const printWindow = window.open('', '_blank', 'width=900,height=700');

  printWindow.document.write(`
    <html>
      <head>
        <title>Invoice #${o.id}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background: white;
            margin: 0;
            padding: 30px;
            color: #1a1a1a;
          }

          .invoice-wrapper {
            background: #fff;
            color: #1a1a1a;
            padding: 40px;
            max-width: 800px;
            margin: auto;
          }

          .invoice-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 32px;
            padding-bottom: 24px;
            border-bottom: 2px solid #f0f0f0;
          }

          .invoice-parties {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24px;
            margin-bottom: 28px;
          }

          .invoice-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 24px;
          }

          .invoice-table th,
          .invoice-table td {
            padding: 10px;
            border-bottom: 1px solid #eee;
            text-align: left;
          }

          .invoice-totals {
            display: flex;
            justify-content: flex-end;
          }

          .invoice-totals-inner {
            width: 240px;
          }

          .invoice-total-row {
            display: flex;
            justify-content: space-between;
            padding: 6px 0;
          }

          .invoice-total-row.grand {
            border-top: 2px solid #ddd;
            font-weight: bold;
            margin-top: 8px;
            padding-top: 10px;
          }

          .invoice-footer {
            margin-top: 30px;
            text-align: center;
            font-size: 12px;
            color: #666;
          }

          @media print {
            body {
              padding: 0;
            }

            * {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        ${invoiceContent}
      </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();

  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 300);
};

    UI.openModal('modal-invoice');
  }

  // ─── View Customer ────────────────────────────────
  function viewCustomer(id) {
    const c = SF.getCustomers().find(x => x.id === id);
    if (!c) return;
    const orders = SF.getOrders().filter(o => o.customerId === id);

    const content = document.getElementById('view-customer-content');
    content.innerHTML = `
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;padding-bottom:18px;border-bottom:1px solid var(--border)">
        <div style="width:56px;height:56px;border-radius:50%;background:var(--accent-dim);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;color:var(--accent)">
          ${SF.initials(c.name)}
        </div>
        <div>
          <div style="font-family:var(--font-display);font-size:20px;font-weight:700">${c.name}</div>
          <div style="font-size:13px;color:var(--text-secondary)">${c.instagram || ''} · ${c.city || ''}</div>
        </div>
        ${c.totalOrders >= 2 ? `<span class="badge badge-success" style="margin-left:auto">⭐ Repeat Customer</span>` : ''}
      </div>

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
        <div style="background:var(--bg-input);border-radius:10px;padding:14px;text-align:center">
          <div style="font-size:22px;font-weight:700;font-family:var(--font-display)">${c.totalOrders || 0}</div>
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-top:3px">Total Orders</div>
        </div>
        <div style="background:var(--accent-dim);border-radius:10px;padding:14px;text-align:center">
          <div style="font-size:20px;font-weight:700;color:var(--accent)">${SF.formatCurrency(c.totalSpent || 0)}</div>
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-top:3px">Total Spent</div>
        </div>
        <div style="background:var(--bg-input);border-radius:10px;padding:14px;text-align:center">
          <div style="font-size:14px;font-weight:700">${SF.formatDate(c.lastOrder)}</div>
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-top:3px">Last Order</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
        <div><div class="form-label">Phone</div><div class="fw-600" style="margin-top:3px">${c.phone || '—'}</div></div>
        <div><div class="form-label">Email</div><div class="fw-600" style="margin-top:3px">${c.email || '—'}</div></div>
      </div>

      <div class="form-label" style="margin-bottom:8px">Order History (${orders.length})</div>
      ${orders.length === 0
        ? `<div class="text-muted" style="font-size:13px;padding:12px;text-align:center">No orders yet</div>`
        : orders.map(o => `
            <div style="display:flex;align-items:center;gap:12px;padding:10px;background:var(--bg-input);border-radius:8px;margin-bottom:6px">
              <div style="flex:1">
                <div style="font-size:13px;font-weight:700;color:var(--accent)">${o.id}</div>
                <div style="font-size:11px;color:var(--text-muted)">${SF.formatDate(o.date)}</div>
              </div>
              <div style="text-align:right">
                <div style="font-weight:700">${SF.formatCurrency(o.total)}</div>
                <div>${UI.paymentBadge(o.payment)}</div>
              </div>
              <button class="action-btn action-btn-edit" onclick="UI.closeModal('modal-view-customer');Modals.showInvoice('${o.id}')">🧾</button>
            </div>
          `).join('')
      }
    `;

    UI.openModal('modal-view-customer');
  }

  // Public API
  return {
    openAddProduct, editProduct, saveProduct, deleteProduct,
    openCreateOrder, handleCustomerSelectChange, addOrderItem, removeOrderItem, saveOrder,
    viewOrder, showInvoice, viewCustomer,
  };
})();