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
        <td data-label="Category"><span class="badge badge-muted">${p.category || 'Uncategorized'}</span></td>
        <td data-label="Price" class="fw-700">${formatCurrency(p.price)}</td>
        <td data-label="Stock">
          <span class="stock-number ${stockClass}">${p.stock}</span>
          ${stockBadge}
        </td>
        <td data-label="Low Alert" class="text-muted" style="font-size:12px">${p.lowStockThreshold || 5}</td>
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
    // data-label attrs on each <td> power the CSS card layout on mobile (≤ 480px).
    // Desktop ignores them. The first <td> merges Order ID + Customer for the card header.
    const sourceBadge = o.source ? `<span class="badge badge-muted" style="margin-top:4px;font-size:10px">${o.source}</span>` : '';

    return `
      <tr onclick="Modals.viewOrder('${o.id}')" style="cursor:pointer">
        <td class="fw-700 text-accent">
          <div class="customer-name-cell" style="gap:10px">
            <div class="customer-avatar" style="width:34px;height:34px;font-size:12px;flex-shrink:0">${initials(o.customerName)}</div>
            <div>
              <div class="fw-700 text-accent" style="font-size:13px">${o.id} ${sourceBadge}</div>
              <div style="font-size:12px;color:var(--text-secondary);font-weight:400">${o.customerName}</div>
            </div>
          </div>
        </td>
        <td data-label="Items" style="font-size:12px;color:var(--text-secondary)">
          ${o.items.map(i => i.name).join(', ')}
        </td>
        <td data-label="Total" class="fw-700">${formatCurrency(o.total)}</td>
        <td data-label="Delivery">${UI.orderStatusBadge(o.status)}</td>
        <td data-label="Payment">${UI.paymentBadge(o.payment)}</td>
        <td data-label="Date">${formatDate(o.date)}</td>
        <td>
          <div class="action-btns">
            <button class="action-btn action-btn-edit" onclick="event.stopPropagation();Modals.viewOrder('${o.id}')">👁️ View</button>
            <button class="action-btn action-btn-edit" onclick="event.stopPropagation();Modals.showInvoice('${o.id}')">🧾</button>
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
      <div class="mobile-grid-1" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:18px">
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

      <div class="mobile-grid-1" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
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
        <td data-label="City">${c.city || '—'}</td>
        <td data-label="Orders" class="fw-700">${c.totalOrders || 0}</td>
        <td data-label="Spent" class="fw-700 text-accent">${formatCurrency(c.totalSpent || 0)}</td>
        <td data-label="Last Order">${formatDate(c.lastOrder)}</td>
        <td data-label="Type">${typeBadge}</td>
      </tr>
    `;
  }

  function ViewCustomerContent(c, orders) {
    // Future-proofing fields: whatsapp, repeat score, notes
    return `
      <div class="mobile-flex-col" style="display:flex;align-items:center;gap:16px;margin-bottom:24px;padding-bottom:18px;border-bottom:1px solid var(--border)">
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

      <div class="mobile-grid-1" style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
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

      <div class="mobile-grid-1" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
        <div><div class="form-label">Phone</div><div class="fw-600" style="margin-top:3px">${c.phone || '—'}</div></div>
        <div><div class="form-label">Email</div><div class="fw-600" style="margin-top:3px">${c.email || '—'}</div></div>
      </div>
      
      ${c.address || c.city || c.pincode ? `
      <div style="margin-bottom:20px">
        <div class="form-label">Saved Delivery Address</div>
        <div style="margin-top:5px;padding:12px;background:var(--bg-input);border-radius:8px;font-size:13.5px;line-height:1.5">
          <div class="fw-600" style="color:var(--text-primary)">
            ${c.address ? `${c.address}<br>` : ''}
            ${c.landmark ? `${c.landmark}<br>` : ''}
            ${[c.city, c.state, c.pincode].filter(Boolean).join(', ')}
          </div>
        </div>
      </div>
      ` : ''}
      
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

  // ─── Email Invoice HTML ───────────────────────────────────────────────────
  //
  // generateInvoiceEmailHTML(order, customer, user)
  //
  // Generates a fully self-contained, email-client-safe HTML invoice string.
  // - Uses table-based layout (Gmail / Outlook / Apple Mail compatible)
  // - Inline styles only — no CSS classes, no CSS variables, no external fonts
  // - White/light theme so it looks clean in any email client
  // - Mobile-friendly: single column, fluid width, min font sizes
  // - Mirrors the exact visual structure of the in-app InvoiceTemplate
  // - Safe to assign directly to an EmailJS template variable: {{invoice_html}}
  // - Reusable standalone: call from modals.js, a future API route, or React
  //
  function generateInvoiceEmailHTML(o, customer, user) {
    const isPaid    = o.payment === 'paid';
    const subtotal  = o.total + (o.discount || 0);
    const storeName = user.store || 'SellerFlow Store';
    const upiId     = user.upiId || '';

    // ── Colour tokens (email-safe, no CSS vars) ────────────────
    const C = {
      indigo:     '#6366F1',
      indigoDim:  '#EEF2FF',
      green:      '#16A34A',
      greenDim:   '#DCFCE7',
      amber:      '#B45309',
      amberDim:   '#FEF3C7',
      red:        '#DC2626',
      border:     '#E5E7EB',
      bg:         '#F9FAFB',
      white:      '#FFFFFF',
      textPrimary:'#111827',
      textMuted:  '#6B7280',
      textLight:  '#9CA3AF',
    };

    // ── Status badge ───────────────────────────────────────────
    const badgeBg    = isPaid ? C.greenDim  : C.amberDim;
    const badgeColor = isPaid ? C.green     : C.amber;
    const badgeText  = isPaid ? '✅ PAID'   : '⏳ PAYMENT PENDING';

    // ── Product rows ───────────────────────────────────────────
    const itemRows = (o.items || []).map((item, i) => `
      <tr style="border-bottom:1px solid ${C.border}">
        <td style="padding:12px 8px;color:${C.textMuted};font-size:13px;vertical-align:top">${i + 1}</td>
        <td style="padding:12px 8px;font-weight:600;color:${C.textPrimary};font-size:14px;vertical-align:top">
          ${item.name}
          ${item.variant ? `<div style="font-size:11px;color:${C.textMuted};font-weight:400;margin-top:2px">${item.variant}</div>` : ''}
        </td>
        <td style="padding:12px 8px;text-align:center;color:${C.textPrimary};font-size:14px;vertical-align:top">${item.qty}</td>
        <td style="padding:12px 8px;text-align:right;color:${C.textMuted};font-size:14px;vertical-align:top;white-space:nowrap">${formatCurrency(item.price)}</td>
        <td style="padding:12px 8px;text-align:right;font-weight:700;color:${C.textPrimary};font-size:14px;vertical-align:top;white-space:nowrap">${formatCurrency(item.price * item.qty)}</td>
      </tr>
    `).join('');

    // ── Discount row (optional) ────────────────────────────────
    const discountRow = o.discount ? `
      <tr>
        <td colspan="2" style="padding:6px 8px;text-align:right;font-size:13px;color:${C.textMuted}">
          Discount (${o.coupon || 'Manual'})
        </td>
        <td style="padding:6px 8px;text-align:right;font-weight:600;color:${C.red};font-size:13px;white-space:nowrap">
          -${formatCurrency(o.discount)}
        </td>
      </tr>
    ` : '';

    // ── Shipping address ───────────────────────────────────────
    const addressBlock = o.shippingAddress
      ? `<p style="margin:4px 0 0;font-size:13px;color:${C.textMuted};line-height:1.5">${o.shippingAddress}</p>`
      : '';

    // ── Notes ─────────────────────────────────────────────────
    const notesBlock = o.notes
      ? `<p style="margin:6px 0 0;font-size:12px;color:${C.textMuted}">📝 Note: ${o.notes}</p>`
      : '';

    // ── UPI block ─────────────────────────────────────────────
    const upiBlock = upiId ? `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px">
        <tr>
          <td style="background:${C.indigoDim};border-radius:10px;padding:14px 18px;text-align:center">
            <p style="margin:0;font-size:13px;color:${C.indigo};font-weight:600">💳 Pay via UPI</p>
            <p style="margin:6px 0 0;font-size:16px;font-weight:700;color:${C.textPrimary};letter-spacing:0.5px">${upiId}</p>
          </td>
        </tr>
      </table>
    ` : '';

    // ── Full HTML ──────────────────────────────────────────────
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Invoice ${o.id} — ${storeName}</title>
</head>
<body style="margin:0;padding:0;background-color:#F3F4F6;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%">

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F3F4F6;padding:32px 16px">
    <tr>
      <td align="center">

        <!-- Card -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:${C.white};border-radius:16px;overflow:hidden;border:1px solid ${C.border}">

          <!-- ── Header stripe ───────────────────────────────── -->
          <tr>
            <td style="background:linear-gradient(135deg,#6366F1 0%,#818CF8 100%);padding:28px 32px">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:top">
                    <p style="margin:0;font-size:22px;font-weight:700;color:${C.white}">🛍️ ${storeName}</p>
                    ${user.instagram ? `<p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.8)">${user.instagram}</p>` : ''}
                    ${user.phone    ? `<p style="margin:2px 0 0;font-size:13px;color:rgba(255,255,255,0.8)">${user.phone}</p>` : ''}
                  </td>
                  <td style="vertical-align:top;text-align:right">
                    <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:2px;color:rgba(255,255,255,0.7);text-transform:uppercase">Invoice</p>
                    <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:${C.white}">#${o.id}</p>
                    <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.75)">${formatDate(o.date)}</p>
                    <!-- Status badge -->
                    <div style="display:inline-block;margin-top:10px;padding:5px 12px;background:${badgeBg};border-radius:20px">
                      <span style="font-size:12px;font-weight:700;color:${badgeColor}">${badgeText}</span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── From / Bill To ─────────────────────────────── -->
          <tr>
            <td style="padding:24px 32px 0">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <!-- From -->
                  <td style="vertical-align:top;width:50%;padding-right:16px">
                    <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${C.indigo}">FROM</p>
                    <p style="margin:6px 0 0;font-size:15px;font-weight:700;color:${C.textPrimary}">${storeName}</p>
                    ${user.email ? `<p style="margin:3px 0 0;font-size:12px;color:${C.textMuted}">${user.email}</p>` : ''}
                    ${user.phone ? `<p style="margin:3px 0 0;font-size:12px;color:${C.textMuted}">${user.phone}</p>` : ''}
                  </td>
                  <!-- Bill To -->
                  <td style="vertical-align:top;width:50%;padding-left:16px;border-left:2px solid ${C.border}">
                    <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${C.indigo}">BILL TO</p>
                    <p style="margin:6px 0 0;font-size:15px;font-weight:700;color:${C.textPrimary}">${o.customerName}</p>
                    ${customer?.email    ? `<p style="margin:3px 0 0;font-size:12px;color:${C.textMuted}">${customer.email}</p>` : ''}
                    ${customer?.phone    ? `<p style="margin:3px 0 0;font-size:12px;color:${C.textMuted}">${customer.phone}</p>` : ''}
                    ${customer?.instagram? `<p style="margin:3px 0 0;font-size:12px;color:${C.textMuted}">${customer.instagram}</p>` : ''}
                    ${addressBlock}
                    ${notesBlock}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── Divider ────────────────────────────────────── -->
          <tr>
            <td style="padding:20px 32px 0">
              <div style="height:1px;background-color:${C.border}"></div>
            </td>
          </tr>

          <!-- ── Products table ─────────────────────────────── -->
          <tr>
            <td style="padding:0 32px">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <!-- Table header -->
                <tr style="background-color:${C.bg}">
                  <th style="padding:10px 8px;text-align:left;font-size:11px;font-weight:700;color:${C.textMuted};text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid ${C.border}">#</th>
                  <th style="padding:10px 8px;text-align:left;font-size:11px;font-weight:700;color:${C.textMuted};text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid ${C.border}">Product</th>
                  <th style="padding:10px 8px;text-align:center;font-size:11px;font-weight:700;color:${C.textMuted};text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid ${C.border}">Qty</th>
                  <th style="padding:10px 8px;text-align:right;font-size:11px;font-weight:700;color:${C.textMuted};text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid ${C.border}">Price</th>
                  <th style="padding:10px 8px;text-align:right;font-size:11px;font-weight:700;color:${C.textMuted};text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid ${C.border}">Total</th>
                </tr>
                ${itemRows}
              </table>
            </td>
          </tr>

          <!-- ── Totals ─────────────────────────────────────── -->
          <tr>
            <td style="padding:16px 32px 0">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="width:55%"></td>
                  <td style="width:45%">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg};border-radius:10px;overflow:hidden">
                      <tr>
                        <td style="padding:10px 16px;font-size:13px;color:${C.textMuted}">Subtotal</td>
                        <td style="padding:10px 16px;font-size:13px;color:${C.textPrimary};text-align:right;font-weight:600;white-space:nowrap">${formatCurrency(subtotal)}</td>
                      </tr>
                      ${discountRow}
                      <tr>
                        <td style="padding:10px 16px;font-size:13px;color:${C.textMuted}">Shipping</td>
                        <td style="padding:10px 16px;font-size:13px;color:${C.green};text-align:right;font-weight:600">Free</td>
                      </tr>
                      <tr style="border-top:2px solid ${C.border}">
                        <td style="padding:14px 16px;font-size:15px;font-weight:700;color:${C.textPrimary}">Total Due</td>
                        <td style="padding:14px 16px;font-size:18px;font-weight:700;color:${C.indigo};text-align:right;white-space:nowrap">${formatCurrency(o.total)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── UPI payment block ───────────────────────────── -->
          <tr>
            <td style="padding:0 32px">
              ${upiBlock}
            </td>
          </tr>

          <!-- ── Thank you footer ───────────────────────────── -->
          <tr>
            <td style="padding:28px 32px;text-align:center;border-top:1px solid ${C.border};margin-top:24px">
              <p style="margin:0;font-size:20px">💜</p>
              <p style="margin:8px 0 0;font-size:15px;font-weight:700;color:${C.textPrimary}">Thank you for shopping with us!</p>
              <p style="margin:6px 0 0;font-size:13px;color:${C.textMuted}">Questions? DM us on Instagram or reply to this email.</p>
              <p style="margin:20px 0 0;font-size:11px;color:${C.textLight}">Generated by <strong>SellerFlow</strong> • sellerflow.in</p>
            </td>
          </tr>

        </table>
        <!-- /Card -->

      </td>
    </tr>
  </table>
  <!-- /Outer wrapper -->

</body>
</html>`;
  }

  return {
    ProductRow,
    OrderRow,
    ViewOrderContent,
    CustomerRow,
    ViewCustomerContent,
    InvoiceTemplate,
    generateInvoiceEmailHTML,
  };
})();
