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

    let shippingAddress = '';

    if (customerSel === 'new') {
      const name = document.getElementById('new-customer-name').value.trim();
      const insta = document.getElementById('new-customer-insta').value.trim();
      const phone = document.getElementById('new-customer-phone').value.trim();
      const email = document.getElementById('new-customer-email').value.trim();
      
      const address = document.getElementById('new-customer-address').value.trim();
      const landmark = document.getElementById('new-customer-landmark').value.trim();
      const city = document.getElementById('new-customer-city').value.trim();
      const state = document.getElementById('new-customer-state').value.trim();
      const pincode = document.getElementById('new-customer-pincode').value.trim();

      if (!name) { UI.toast('Please enter customer name', 'error'); return; }
      const nc = SF.findOrCreateCustomer(name, insta);
      
      const updates = {};
      if (phone) updates.phone = phone;
      if (email) updates.email = email;
      if (address) updates.address = address;
      if (landmark) updates.landmark = landmark;
      if (city) updates.city = city;
      if (state) updates.state = state;
      if (pincode) updates.pincode = pincode;

      if (Object.keys(updates).length > 0) SF.updateCustomer(nc.id, updates);
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

    const custForAddr = SF.getCustomers().find(c => c.id === customerId);
    if (custForAddr && custForAddr.address) {
      shippingAddress = `${custForAddr.address}`;
      if (custForAddr.landmark) shippingAddress += `, ${custForAddr.landmark}`;
      if (custForAddr.city) shippingAddress += `, ${custForAddr.city}`;
      if (custForAddr.state) shippingAddress += `, ${custForAddr.state}`;
      if (custForAddr.pincode) shippingAddress += ` - ${custForAddr.pincode}`;
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
      shippingAddress,
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
    content.innerHTML = Components.ViewOrderContent(o);

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
    const invoiceHTML = Components.InvoiceTemplate(o, user);

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

    // WhatsApp Share Button
    const waBtn = document.getElementById('invoice-wa-btn');
    const cust = SF.getCustomers().find(c => c.id === o.customerId);
    const phoneNum = cust && cust.phone ? cust.phone : '';
    
    if (phoneNum) {
      waBtn.title = `Share via WhatsApp to ${phoneNum}`;
    } else {
      waBtn.title = `WhatsApp (No phone number saved)`;
    }

    waBtn.onclick = () => {
      const msg = UI.generateInvoiceMessage(o, user);
      const encoded = encodeURIComponent(msg);
      const cleanPhone = phoneNum.replace(/[^\d+]/g, '');
      
      let url;
      if (cleanPhone) {
        url = `https://wa.me/${cleanPhone.startsWith('+') ? cleanPhone.slice(1) : cleanPhone}?text=${encoded}`;
      } else {
        url = `https://api.whatsapp.com/send?text=${encoded}`;
        UI.toast('No customer phone found. Opening WhatsApp Web.', 'info');
      }
      window.open(url, '_blank');
    };

    // Copy Message Button
    document.getElementById('invoice-copy-msg-btn').onclick = () => {
      const msg = UI.generateInvoiceMessage(o, user);
      if (navigator.clipboard) {
        navigator.clipboard.writeText(msg).then(() => {
          UI.toast('Invoice message copied to clipboard!', 'success');
        }).catch(err => {
          console.error(err);
          UI.toast('Failed to copy', 'error');
        });
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = msg;
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
          UI.toast('Invoice message copied to clipboard!', 'success');
        } catch (err) {
          UI.toast('Failed to copy', 'error');
        }
        document.body.removeChild(textArea);
      }
    };

    document.getElementById('invoice-print-btn').onclick = () => {
      const invoiceContent = document.getElementById('invoice-print-area').outerHTML;
      const printPortal = document.getElementById('print-portal');
      
      // Inject the invoice into the print portal and trigger print
      printPortal.innerHTML = invoiceContent;
      
      // Small delay to ensure styles and layouts are applied before print triggers
      setTimeout(() => {
        window.print();
        // Clean up portal
        setTimeout(() => {
          printPortal.innerHTML = '';
        }, 500);
      }, 100);
    };

    UI.openModal('modal-invoice');
  }

  // ─── View Customer ────────────────────────────────
  function viewCustomer(id) {
    const c = SF.getCustomers().find(x => x.id === id);
    if (!c) return;
    const orders = SF.getOrders().filter(o => o.customerId === id);

    const content = document.getElementById('view-customer-content');
    content.innerHTML = Components.ViewCustomerContent(c, orders);

    UI.openModal('modal-view-customer');
  }

  // Public API
  return {
    openAddProduct, editProduct, saveProduct, deleteProduct,
    openCreateOrder, handleCustomerSelectChange, addOrderItem, removeOrderItem, saveOrder,
    viewOrder, showInvoice, viewCustomer,
  };
})();
