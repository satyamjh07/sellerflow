// SellerFlow — Components Module
// Pure functions returning HTML strings. Decouples state from rendering.
// Built to be highly extensible for future fields (variant, image, delivery partner, etc.)
// ================================================================

const Components = (() => {

  // ─── Shared Utilities ──────────────────────────────────────────
  const { formatCurrency, formatDate, initials } = SF;

  function Badge(status, type, label) {
    if (!status) return '';
    return UI.orderStatusBadge ? `<span class="badge badge-${type}">${label}</span>` : '';
  }

  // ─── Products Components ────────────────────────────────────────
  
  function ProductRow(p) {
    const stockClass = p.stock === 0 ? 'stock-low' : p.stock <= (p.lowStockThreshold || 5) ? 'stock-mid' : 'stock-good';
    const stockBadge = p.stock <= (p.lowStockThreshold || 5) 
      ? `<span class="badge badge-warn" style="margin-left:6px">Low</span>` : '';
      
    // Future-proofing fields: image, variant
    const visual = p.image 
      ? `<img src="${p.image}" alt="${p.name}" style="width:36px;height:36px;border-radius:8px;object-fit:cover" />`
      : `<div class="product-img">${p.emoji || '📦'}</div>`;

    const variantHtml = p.variant ? `<div class="text-muted" style="font-size:11px;margin-top:2px">${p.variant}</div>` : '';

    return `
      <tr>
        <td>
          <div class="product-name-cell">
            ${visual}
            <div class="product-name-info">
              <div class="product-name">${p.name}</div>
              <div class="product-sku">${p.sku || 'No SKU'}</div>
              ${variantHtml}
            </div>
          </div>
        </td>
        <td><span class="badge badge-muted">${p.category || 'Uncategorized'}</span></td>
        <td class="fw-700">${formatCurrency(p.price)}</td>
        <td>
          <span class="stock-number ${stockClass}">${p.stock}</span>
          ${stockBadge}
        </td>
        <td class="text-muted" style="font-size:12px">${p.lowStockThreshold || 5}</td>
        <td>
          <div class="action-btns">
            <button class="action-btn action-btn-edit" onclick="Modals.editProduct('${p.id}')">✏️ Edit</button>
            <button class="action-btn action-btn-del" onclick="Modals.deleteProduct('${p.id}')">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }

  // ─── Orders Components ──────────────────────────────────────────

  function OrderRow(o) {
    // Future-proofing fields: order source, tracking ID
    const sourceBadge = o.source ? `<span class="badge badge-muted" style="margin-top:4px;font-size:10px">${o.source}</span>` : '';
    
    return `
      <tr>
        <td class="fw-700 text-accent">
          <div>${o.id}</div>
          ${sourceBadge}
        </td>
        <td>
          <div class="customer-name-cell">
            <div class="customer-avatar" style="width:30px;height:30px;font-size:11px">${initials(o.customerName)}</div>
            <span>${o.customerName}</span>
          </div>
        </td>
        <td style="font-size:12px;color:var(--text-secondary)">
          ${o.items.map(i => i.name).join(', ')}
        </td>
        <td class="fw-700">${formatCurrency(o.total)}</td>
        <td>${UI.orderStatusBadge(o.status)}</td>
        <td>${UI.paymentBadge(o.payment)}</td>
        <td>${formatDate(o.date)}</td>
        <td>
          <div class="action-btns">
            <button class="action-btn action-btn-edit" onclick="Modals.viewOrder('${o.id}')">👁️ View</button>
            <button class="action-btn action-btn-edit" onclick="Modals.showInvoice('${o.id}')">🧾</button>
          </div>
        </td>
      </tr>
    `;
  }

  function ViewOrderContent(o) {
    // Future-proofing: delivery partner, tracking ID, discount, shipping address

    const discountHtml = o.discount ? `
      <div style="display:flex;justify-content:space-between;padding:8px 0;font-size:13px;color:var(--success)">
        <span>Discount (${o.coupon || 'Manual'})</span>
        <span>-${formatCurrency(o.discount)}</span>
      </div>
    ` : '';
    
    const shippingHtml = o.shippingAddress ? `
      <div style="grid-column: span 2; margin-top:8px">
        <div class="form-label">Shipping Address</div>
        <div class="fw-600" style="font-size:13px;line-height:1.4">${o.shippingAddress}</div>
      </div>
    ` : '';

    const trackingHtml = o.trackingId ? `
      <div>
        <div class="form-label">Tracking ID</div>
        <div class="fw-600">${o.deliveryPartner || ''} ${o.trackingId}</div>
      </div>
    ` : '';

    return `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:18px">
        <div>
          <div class="form-label">Order ID</div>
          <div class="fw-700 text-accent" style="font-size:16px">${o.id}</div>
        </div>
        <div>
          <div class="form-label">Date</div>
          <div class="fw-600">${formatDate(o.date)}</div>
        </div>
        <div>
          <div class="form-label">Customer</div>
          <div class="fw-600">${o.customerName}</div>
        </div>
        <div>
          <div class="form-label">Total Due</div>
          <div class="fw-700" style="font-size:18px;color:var(--accent)">${formatCurrency(o.total)}</div>
        </div>
        ${shippingHtml}
        ${trackingHtml}
      </div>

      <div class="form-label" style="margin-bottom:8px">Items</div>
      <div style="background:var(--bg-input);border-radius:8px;padding:12px;margin-bottom:16px">
        ${o.items.map(i => `
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px">
            <span>${i.name} × ${i.qty}</span>
            <span class="fw-600">${formatCurrency(i.price * i.qty)}</span>
          </div>
        `).join('')}
        ${discountHtml}
        <div style="display:flex;justify-content:space-between;padding:8px 0;font-weight:700;font-size:14px">
          <span>Final Total</span>
          <span class="text-accent">${formatCurrency(o.total)}</span>
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
  }

  // ─── Customers Components ───────────────────────────────────────

  function CustomerRow(c) {
    // Future-proofing fields: repeat score, WhatsApp icon
    const isRepeat = c.totalOrders >= 2;
    const typeBadge = isRepeat ? `<span class="badge badge-success">⭐ Repeat</span>` : `<span class="badge badge-muted">New</span>`;
    
    // Extensible WhatsApp indicator
    const whatsappIcon = c.whatsapp ? `<span style="color:#25D366;font-size:12px;margin-left:4px" title="WhatsApp connected">💬</span>` : '';
    
    // Repeat Score
    const scoreBadge = c.repeatScore ? `<div style="font-size:10px;color:var(--text-muted);margin-top:2px">Score: ${c.repeatScore}/10</div>` : '';

    return `
      <tr class="customer-row" onclick="Modals.viewCustomer('${c.id}')">
        <td>
          <div class="customer-name-cell">
            <div class="customer-avatar">${initials(c.name)}</div>
            <div>
              <div class="customer-name">${c.name} ${whatsappIcon}</div>
              <div class="customer-handle">${c.instagram || '—'}</div>
              ${scoreBadge}
            </div>
          </div>
        </td>
        <td>${c.city || '—'}</td>
        <td class="fw-700">${c.totalOrders || 0}</td>
        <td class="fw-700 text-accent">${formatCurrency(c.totalSpent || 0)}</td>
        <td>${formatDate(c.lastOrder)}</td>
        <td>${typeBadge}</td>
      </tr>
    `;
  }

  function ViewCustomerContent(c, orders) {
    // Future-proofing fields: whatsapp, repeat score, notes
    return `
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;padding-bottom:18px;border-bottom:1px solid var(--border)">
        <div style="width:56px;height:56px;border-radius:50%;background:var(--accent-dim);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;color:var(--accent)">
          ${initials(c.name)}
        </div>
        <div>
          <div style="font-family:var(--font-display);font-size:20px;font-weight:700">${c.name}</div>
          <div style="font-size:13px;color:var(--text-secondary)">${c.instagram || ''} · ${c.city || ''}</div>
          ${c.whatsapp ? `<div style="font-size:12px;color:#10B981;margin-top:2px">WhatsApp: ${c.whatsapp}</div>` : ''}
        </div>
        ${c.totalOrders >= 2 ? `<span class="badge badge-success" style="margin-left:auto;text-align:right">⭐ Repeat Customer<br><small style="font-weight:normal;opacity:0.8">Score: ${c.repeatScore || 'Good'}</small></span>` : ''}
      </div>

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
        <div style="background:var(--bg-input);border-radius:10px;padding:14px;text-align:center">
          <div style="font-size:22px;font-weight:700;font-family:var(--font-display)">${c.totalOrders || 0}</div>
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-top:3px">Total Orders</div>
        </div>
        <div style="background:var(--accent-dim);border-radius:10px;padding:14px;text-align:center">
          <div style="font-size:20px;font-weight:700;color:var(--accent)">${formatCurrency(c.totalSpent || 0)}</div>
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-top:3px">Total Spent</div>
        </div>
        <div style="background:var(--bg-input);border-radius:10px;padding:14px;text-align:center">
          <div style="font-size:14px;font-weight:700">${formatDate(c.lastOrder)}</div>
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-top:3px">Last Order</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
        <div><div class="form-label">Phone</div><div class="fw-600" style="margin-top:3px">${c.phone || '—'}</div></div>
        <div><div class="form-label">Email</div><div class="fw-600" style="margin-top:3px">${c.email || '—'}</div></div>
      </div>
      
      ${c.notes ? `<div class="form-label">Customer Notes</div><div style="margin-bottom:20px;padding:12px;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;font-size:13px">${c.notes}</div>` : ''}

      <div class="form-label" style="margin-bottom:8px">Order History (${orders.length})</div>
      ${orders.length === 0
        ? `<div class="text-muted" style="font-size:13px;padding:12px;text-align:center">No orders yet</div>`
        : orders.map(o => `
            <div style="display:flex;align-items:center;gap:12px;padding:10px;background:var(--bg-input);border-radius:8px;margin-bottom:6px">
              <div style="flex:1">
                <div style="font-size:13px;font-weight:700;color:var(--accent)">${o.id}</div>
                <div style="font-size:11px;color:var(--text-muted)">${formatDate(o.date)}</div>
              </div>
              <div style="text-align:right">
                <div style="font-weight:700">${formatCurrency(o.total)}</div>
                <div>${UI.paymentBadge(o.payment)}</div>
              </div>
              <button class="action-btn action-btn-edit" onclick="UI.closeModal('modal-view-customer');Modals.showInvoice('${o.id}')">🧾</button>
            </div>
          `).join('')
      }
    `;
  }

  // ─── Invoice ────────────────────────────────────────────────────

  function InvoiceTemplate(o, user) {
    const isPaid = o.payment === 'paid';
    const subtotal = o.total + (o.discount || 0);

    // Future-proofing fields: shipping address, delivery partner, discount
    const deliveryHtml = o.deliveryPartner ? `<p>Partner: ${o.deliveryPartner} (ID: ${o.trackingId || 'N/A'})</p>` : '';
    const discountHtml = o.discount ? `
      <div class="invoice-total-row">
        <span>Discount (${o.coupon || 'Manual'})</span>
        <span style="color:#EF4444">-${formatCurrency(o.discount)}</span>
      </div>
    ` : '';
    
    // Address format
    const addressHtml = o.shippingAddress ? `<p style="margin-top:4px;opacity:0.9">${o.shippingAddress}</p>` : '';

    return `
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
            <p>Date: ${formatDate(o.date)}</p>
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
            <p>${o.source || 'Instagram Order'}</p>
            ${addressHtml}
            ${deliveryHtml}
            ${o.notes ? `<p style="margin-top:6px">Note: ${o.notes}</p>` : ''}
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
                <td style="font-weight:600;color:var(--text-primary)">
                  ${item.name}
                  ${item.variant ? `<div style="font-size:11px;color:var(--text-muted);font-weight:400">${item.variant}</div>` : ''}
                </td>
                <td style="text-align:center">${item.qty}</td>
                <td style="text-align:right">${formatCurrency(item.price)}</td>
                <td style="text-align:right;font-weight:700;color:var(--text-primary)">${formatCurrency(item.price * item.qty)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="invoice-totals">
          <div class="invoice-totals-inner">
            <div class="invoice-total-row">
              <span>Subtotal</span>
              <span>${formatCurrency(subtotal)}</span>
            </div>
            ${discountHtml}
            <div class="invoice-total-row">
              <span>Shipping</span>
              <span style="color:#10B981">Free</span>
            </div>
            <div class="invoice-total-row grand">
              <span>Total Due</span>
              <span style="color:#6366f1">${formatCurrency(o.total)}</span>
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
  }

  return {
    ProductRow,
    OrderRow,
    ViewOrderContent,
    CustomerRow,
    ViewCustomerContent,
    InvoiceTemplate
  };
})();
