// SellerFlow — Components Module
// Pure functions returning HTML strings. Decouples state from rendering.
// Built to be highly extensible for future fields (variant, image, delivery partner, etc.)
// ================================================================

const Components = (() => {
  // ─── Shared Utilities ──────────────────────────────────────────
  const { formatCurrency, formatDate, initials } = SF;

  // ─── Products Components ────────────────────────────────────────

  function ProductRow(p) {
    const stockClass =
      p.stock === 0
        ? "stock-low"
        : p.stock <= (p.lowStockThreshold || 5)
          ? "stock-mid"
          : "stock-good";
    const stockBadge =
      p.stock <= (p.lowStockThreshold || 5)
        ? `<span class="badge badge-warn" style="margin-left:6px">Low</span>`
        : "";

    const visual = p.image
      ? `<img src="${p.image}" alt="${p.name}" style="width:36px;height:36px;border-radius:8px;object-fit:cover" />`
      : `<div class="product-img">${p.emoji || '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;opacity:0.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>'}</div>`;

    const variantHtml = p.variant
      ? `<div class="text-muted" style="font-size:11px;margin-top:2px">${p.variant}</div>`
      : "";

    return `
      <tr>
        <td>
          <div class="product-name-cell">
            ${visual}
            <div class="product-name-info">
              <div class="product-name">${p.name}</div>
              <div class="product-sku">${p.sku || "No SKU"}</div>
              ${variantHtml}
            </div>
          </div>
        </td>
        <td><span class="badge badge-muted">${p.category || "Uncategorized"}</span></td>
        <td class="fw-700">${formatCurrency(p.price)}</td>
        <td>
          <span class="stock-number ${stockClass}">${p.stock}</span>
          ${stockBadge}
        </td>
        <td class="text-muted" style="font-size:12px">${p.lowStockThreshold || 5}</td>
        <td>
          <div class="action-btns">
            <button class="action-btn action-btn-edit" onclick="Modals.editProduct('${p.id}')"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit</button>
            <button class="action-btn action-btn-del" onclick="Modals.deleteProduct('${p.id}')"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
          </div>
        </td>
      </tr>
    `;
  }

  // ─── Orders Components ──────────────────────────────────────────

  function OrderRow(o) {
    const sourceBadge = o.source
      ? `<span class="badge badge-muted" style="margin-top:4px;font-size:10px">${o.source}</span>`
      : "";

    // ── Desktop: standard table row (hidden on mobile via CSS) ──
    const desktopRow = `
      <td class="fw-700 text-accent ord-desktop">
        <div>${o.id}</div>
        ${sourceBadge}
      </td>
      <td class="ord-desktop">
        <div class="customer-name-cell">
          <div class="customer-avatar" style="width:30px;height:30px;font-size:11px">${initials(o.customerName)}</div>
          <span>${o.customerName}</span>
        </div>
      </td>
      <td class="ord-desktop" style="font-size:12px;color:var(--text-secondary)">
        ${o.items.map((i) => i.name).join(", ")}
      </td>
      <td class="fw-700 ord-desktop">${formatCurrency(o.total)}</td>
      <td class="ord-desktop">${UI.orderStatusBadge(o.status)}</td>
      <td class="ord-desktop">${UI.paymentBadge(o.payment)}</td>
      <td class="ord-desktop">${formatDate(o.date)}</td>
      <td class="ord-desktop">
        <div class="action-btns">
          <button class="action-btn action-btn-edit" onclick="Modals.viewOrder('${o.id}')"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> View</button>
          <button class="action-btn action-btn-edit" onclick="Modals.showInvoice('${o.id}')"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></button>
        </div>
      </td>`;

    // ── Mobile: pure div card (hidden on desktop via CSS) ────────
    const mobileCard = `
      <td class="ord-mobile" colspan="8" style="padding:0;border:none;">
        <div class="ord-card" onclick="Modals.viewOrder('${o.id}')">

          <div class="ord-card-header">
            <div>
              <div class="ord-card-id">${o.id}</div>
              ${sourceBadge}
            </div>
            <div class="ord-card-customer">
              <div class="customer-avatar" style="width:28px;height:28px;font-size:10px;flex-shrink:0;">${initials(o.customerName)}</div>
              <span class="ord-card-name">${o.customerName}</span>
            </div>
          </div>

          <div class="ord-card-body">
            <div class="ord-card-row">
              <span class="ord-card-label">Items</span>
              <span class="ord-card-value">${o.items.map((i) => i.name).join(", ")}</span>
            </div>
            <div class="ord-card-row">
              <span class="ord-card-label">Total</span>
              <span class="ord-card-value ord-card-total">${formatCurrency(o.total)}</span>
            </div>
            <div class="ord-card-row">
              <span class="ord-card-label">Delivery</span>
              <span class="ord-card-value">${UI.orderStatusBadge(o.status)}</span>
            </div>
            <div class="ord-card-row">
              <span class="ord-card-label">Payment</span>
              <span class="ord-card-value">${UI.paymentBadge(o.payment)}</span>
            </div>
            <div class="ord-card-row">
              <span class="ord-card-label">Date</span>
              <span class="ord-card-value ord-card-date">${formatDate(o.date)}</span>
            </div>
          </div>

          <div class="ord-card-footer">
            <button class="action-btn action-btn-edit" onclick="event.stopPropagation();Modals.viewOrder('${o.id}')">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;margin-right:4px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>View
            </button>
            <button class="action-btn action-btn-edit" onclick="event.stopPropagation();Modals.showInvoice('${o.id}')">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;margin-right:4px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>Invoice
            </button>
          </div>

        </div>
      </td>`;

    return `<tr class="ord-row">${desktopRow}${mobileCard}</tr>`;
  }

  // ─── ViewOrderContent ───────────────────────────────────────────
  //
  // Renders the interior of the "Order Details" modal.
  // Additions vs. original:
  //   • out_for_delivery added as a delivery status option
  //   • Follow-up button section: shown only when payment=pending AND
  //     customer email exists AND plan allows (Bronze/Platinum)
  //   • Last follow-up sent timestamp shown below the button
  //   • Delivery status change triggers auto-email via JS wired in modals.js
  //
  function ViewOrderContent(o, customerEmail) {
    // customerEmail is passed by Modals.viewOrder() after fetching the customer
    const hasCustomerEmail = !!(customerEmail && customerEmail.trim());
    const isPaid           = o.payment === 'paid';

    // ── Follow-up button section ───────────────────────────────
    // Visibility logic:
    //   1. Payment must be pending
    //   2. Customer must have an email address
    //   3. Plan must be Bronze or Platinum (checked at click time too)
    const showFollowupZone = !isPaid && hasCustomerEmail;

    let followupHtml = '';
    if (showFollowupZone) {
      const lastSentHtml = o.lastFollowupSentAt
        ? `<div id="followup-last-sent" style="font-size:11px;color:var(--text-muted);margin-top:6px;text-align:center">
             Last sent: ${formatDate(o.lastFollowupSentAt)}
           </div>`
        : `<div id="followup-last-sent" style="font-size:11px;color:var(--text-muted);margin-top:6px;text-align:center;display:none"></div>`;

      followupHtml = `
        <div id="followup-section"
          style="margin-top:18px;padding:14px 16px;background:var(--warn-dim);border:1px solid rgba(245,158,11,0.25);border-radius:var(--radius-md)">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
            <span style="display:inline-flex;align-items:center"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span>
            <div>
              <div style="font-size:13px;font-weight:700;color:var(--text-primary)">Payment Pending</div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:1px">
                Send a polite reminder to the customer
              </div>
            </div>
          </div>
          <button
            id="followup-send-btn"
            onclick="Modals.sendFollowupEmail('${o.id}')"
            style="
              width:100%;
              background:var(--warn);
              color:#fff;
              border:none;
              border-radius:var(--radius-sm);
              padding:10px 16px;
              font-size:13px;
              font-weight:600;
              cursor:pointer;
              transition:var(--transition);
              display:flex;
              align-items:center;
              justify-content:center;
              gap:8px;
              font-family:var(--font-body);
            "
          >
            <span id="followup-btn-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg></span>
            <span id="followup-btn-text">Send Follow-up Email</span>
          </button>
          ${lastSentHtml}
        </div>`;
    }

    // ── Optional blocks ────────────────────────────────────────
    const discountHtml = o.discount
      ? `<div style="display:flex;justify-content:space-between;padding:8px 0;font-size:13px;color:var(--success)">
           <span>Discount (${o.coupon || "Manual"})</span>
           <span>-${formatCurrency(o.discount)}</span>
         </div>`
      : "";

    const shippingHtml = o.shippingAddress
      ? `<div style="grid-column: span 2; margin-top:8px">
           <div class="form-label">Shipping Address</div>
           <div class="fw-600" style="font-size:13px;line-height:1.4">${o.shippingAddress}</div>
         </div>`
      : "";

    const trackingHtml = o.trackingId
      ? `<div>
           <div class="form-label">Tracking ID</div>
           <div class="fw-600">${o.deliveryPartner || ""} ${o.trackingId}</div>
         </div>`
      : "";

    // ── Delivery status options ────────────────────────────────
    // out_for_delivery added as a new valid status.
    // data-original-status captures what was set when the modal opened —
    // modals.js uses this to detect a genuine change before triggering email.
    const deliveryStatuses = [
      { value: 'processing',       label: 'Processing' },
      { value: 'shipped',          label: 'Shipped' },
      { value: 'out_for_delivery', label: 'Out for Delivery' },
      { value: 'delivered',        label: 'Delivered' },
      { value: 'cancelled',        label: 'Cancelled' },
    ];

    const deliveryOptions = deliveryStatuses
      .map(s => `<option value="${s.value}" ${o.status === s.value ? 'selected' : ''}>${s.label}</option>`)
      .join('');

    const paymentOptions = ['pending', 'paid', 'refunded']
      .map(s => `<option value="${s}" ${o.payment === s ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`)
      .join('');

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
        `).join("")}
        ${discountHtml}
        <div style="display:flex;justify-content:space-between;padding:8px 0;font-weight:700;font-size:14px">
          <span>Final Total</span>
          <span class="text-accent">${formatCurrency(o.total)}</span>
        </div>
      </div>

      <div class="mobile-grid-1" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
        <div>
          <div class="form-label">Delivery Status</div>
          <select
            id="update-delivery-status"
            class="form-select"
            style="margin-top:4px"
            data-original-status="${o.status}"
          >
            ${deliveryOptions}
          </select>
        </div>
        <div>
          <div class="form-label">Payment Status</div>
          <select id="update-payment-status" class="form-select" style="margin-top:4px">
            ${paymentOptions}
          </select>
        </div>
      </div>

      ${o.notes
        ? `<div class="form-label">Notes</div>
           <div style="font-size:13px;color:var(--text-secondary);background:var(--bg-input);padding:10px;border-radius:8px;margin-top:4px;margin-bottom:14px">${o.notes}</div>`
        : ''}

      ${followupHtml}
    `;
  }

  // ─── Customers Components ───────────────────────────────────────

  function CustomerRow(c) {
    const isRepeat = c.totalOrders >= 2;
    const typeBadge = isRepeat
      ? `<span class="badge badge-success"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> Repeat</span>`
      : `<span class="badge badge-muted">New</span>`;

    const whatsappIcon = c.whatsapp
      ? `<span style="color:#25D366;display:inline-flex;align-items:center;margin-left:4px" title="WhatsApp connected"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width:12px;height:12px;color:#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg></span>`
      : "";

    const scoreBadge = c.repeatScore
      ? `<div style="font-size:10px;color:var(--text-muted);margin-top:2px">Score: ${c.repeatScore}/10</div>`
      : "";

    return `
      <tr class="customer-row" onclick="Modals.viewCustomer('${c.id}')">
        <td>
          <div class="customer-name-cell">
            <div class="customer-avatar">${initials(c.name)}</div>
            <div>
              <div class="customer-name">${c.name} ${whatsappIcon}</div>
              <div class="customer-handle">${c.instagram || "—"}</div>
              ${scoreBadge}
            </div>
          </div>
        </td>
        <td>${c.city || "—"}</td>
        <td class="fw-700">${c.totalOrders || 0}</td>
        <td class="fw-700 text-accent">${formatCurrency(c.totalSpent || 0)}</td>
        <td>${formatDate(c.lastOrder)}</td>
        <td>${typeBadge}</td>
      </tr>
    `;
  }

  function ViewCustomerContent(c, orders) {
    return `
      <div class="mobile-flex-col" style="display:flex;align-items:center;gap:16px;margin-bottom:24px;padding-bottom:18px;border-bottom:1px solid var(--border)">
        <div style="width:56px;height:56px;border-radius:50%;background:var(--accent-dim);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;color:var(--accent)">
          ${initials(c.name)}
        </div>
        <div>
          <div style="font-family:var(--font-display);font-size:20px;font-weight:700">${c.name}</div>
          <div style="font-size:13px;color:var(--text-secondary)">${c.instagram || ""} · ${c.city || ""}</div>
          ${c.whatsapp ? `<div style="font-size:12px;color:#10B981;margin-top:2px">WhatsApp: ${c.whatsapp}</div>` : ""}
        </div>
        ${c.totalOrders >= 2 ? `<span class="badge badge-success" style="margin-left:auto;text-align:right"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> Repeat Customer<br><small style="font-weight:normal;opacity:0.8">Score: ${c.repeatScore || "Good"}</small></span>` : ""}
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
        <div><div class="form-label">Phone</div><div class="fw-600" style="margin-top:3px">${c.phone || "—"}</div></div>
        <div><div class="form-label">Email</div><div class="fw-600" style="margin-top:3px">${c.email || "—"}</div></div>
      </div>

      ${c.address || c.city || c.pincode ? `
        <div style="margin-bottom:20px">
          <div class="form-label">Saved Delivery Address</div>
          <div style="margin-top:5px;padding:12px;background:var(--bg-input);border-radius:8px;font-size:13.5px;line-height:1.5">
            <div class="fw-600" style="color:var(--text-primary)">
              ${c.address ? `${c.address}<br>` : ""}
              ${c.landmark ? `${c.landmark}<br>` : ""}
              ${[c.city, c.state, c.pincode].filter(Boolean).join(", ")}
            </div>
          </div>
        </div>
      ` : ""}

      ${c.notes ? `<div class="form-label">Customer Notes</div><div style="margin-bottom:20px;padding:12px;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;font-size:13px">${c.notes}</div>` : ""}

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
              <button class="action-btn action-btn-edit" onclick="UI.closeModal('modal-view-customer');Modals.showInvoice('${o.id}')"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></button>
            </div>
          `).join("")
      }
    `;
  }

  // ─── Invoice ────────────────────────────────────────────────────
  //
  // INLINE-STYLE ARCHITECTURE
  // Every layout and colour property is baked directly into inline styles.
  // This is intentional — it guarantees identical rendering in three contexts:
  //   1. Live in-app invoice preview modal (dark theme)
  //   2. html2pdf / html2canvas PDF capture (detached clone, no stylesheet)
  //   3. Browser print / @media print
  //
  function InvoiceTemplate(o, user) {
    const isPaid   = o.payment === "paid";
    const subtotal = o.total + (o.discount || 0);

    const showBranding = typeof Billing === 'undefined' || !Billing.hasNoBranding();
    const logoUrl      = user.logoUrl || null;
    const showLogo     = !!logoUrl && typeof Billing !== 'undefined' && Billing.canUploadLogo();

    const C = {
      accent: "#6366F1", black: "#1a1a1a", dark: "#222222", mid: "#444444",
      muted: "#888888", light: "#f8f8f8", border: "#f0f0f0", border2: "#e0e0e0",
      white: "#ffffff", green: "#059669", greenBg: "#d1fae5",
      amber: "#d97706", amberBg: "#fef3c7", emerald: "#10B981", red: "#EF4444",
    };

    const deliveryHtml = o.deliveryPartner
      ? `<p style="font-size:12px;color:${C.muted};margin:2px 0">Partner: ${o.deliveryPartner}${o.trackingId ? ` · ID: ${o.trackingId}` : ""}</p>`
      : "";

    const discountRow = o.discount
      ? `<tr>
           <td colspan="2" style="padding:5px 0;font-size:13px;color:${C.mid}">Discount${o.coupon ? ` (${o.coupon})` : ""}</td>
           <td style="padding:5px 0;font-size:13px;color:${C.red};text-align:right">−${formatCurrency(o.discount)}</td>
         </tr>`
      : "";

    const addressHtml = o.shippingAddress
      ? `<p style="font-size:12px;color:${C.mid};margin:2px 0;line-height:1.5">${o.shippingAddress}</p>`
      : "";

    const brandBlock = showLogo
      ? `<img src="${logoUrl}" alt="${user.store || 'Store Logo'}" style="max-height:56px;max-width:200px;object-fit:contain;margin-bottom:6px;display:block">`
      : `<div style="font-size:22px;font-weight:700;color:${C.accent};letter-spacing:-0.5px;margin-bottom:4px">${user.store || "SellerFlow Store"}</div>`;

    const itemRows = o.items.map((item, i) => `
      <tr style="background:${i % 2 === 0 ? C.white : C.light}">
        <td style="padding:11px 14px;font-size:13px;color:${C.muted};border-bottom:1px solid ${C.border};width:32px">${i + 1}</td>
        <td style="padding:11px 14px;font-size:13px;font-weight:600;color:${C.black};border-bottom:1px solid ${C.border}">
          ${item.name}
          ${item.variant ? `<div style="font-size:11px;color:${C.muted};font-weight:400;margin-top:2px">${item.variant}</div>` : ""}
        </td>
        <td style="padding:11px 14px;font-size:13px;color:${C.mid};text-align:center;border-bottom:1px solid ${C.border};width:60px">${item.qty}</td>
        <td style="padding:11px 14px;font-size:13px;color:${C.mid};text-align:right;border-bottom:1px solid ${C.border};width:100px">${formatCurrency(item.price)}</td>
        <td style="padding:11px 14px;font-size:13px;font-weight:700;color:${C.black};text-align:right;border-bottom:1px solid ${C.border};width:100px">${formatCurrency(item.price * item.qty)}</td>
      </tr>`).join("");

    const statusStyle = isPaid
      ? `background:${C.greenBg};color:${C.green}`
      : `background:${C.amberBg};color:${C.amber}`;
    const statusLabel = isPaid ? "PAID" : "PAYMENT PENDING";

    const brandingFooter = showBranding
      ? `<p style="margin:6px 0 0;font-size:10px">Generated by <a href="https://sellerflow.in" style="color:${C.accent};text-decoration:none">SellerFlow</a> • sellerflow.in</p>`
      : '';

    return `
      <div class="invoice-wrapper" id="invoice-print-area" style="background:${C.white};color:${C.black};padding:40px;font-family:DM Sans,Arial,sans-serif;border-radius:12px">
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;padding-bottom:24px;border-bottom:2px solid ${C.border}">
          <tr>
            <td style="vertical-align:top;width:50%">
              ${brandBlock}
              ${user.instagram ? `<p style="font-size:12px;color:${C.muted};margin:2px 0">${user.instagram}</p>` : ""}
              ${user.phone    ? `<p style="font-size:12px;color:${C.muted};margin:2px 0">${user.phone}</p>` : ""}
              ${user.upiId    ? `<p style="font-size:12px;color:${C.muted};margin:2px 0">UPI: ${user.upiId}</p>` : ""}
              ${user.gstNumber ? `<p style="font-size:11px;color:${C.muted};margin:3px 0;letter-spacing:0.3px"><span style="font-weight:600;color:${C.mid}">GSTIN:</span> ${user.gstNumber}</p>` : ""}
            </td>
            <td style="vertical-align:top;text-align:right;width:50%">
              <div style="font-size:20px;font-weight:800;color:${C.black};letter-spacing:-0.5px">INVOICE</div>
              <p style="font-size:12px;color:${C.muted};margin:3px 0">#${o.id}</p>
              <p style="font-size:12px;color:${C.muted};margin:3px 0">Date: ${formatDate(o.date)}</p>
              <div style="margin-top:8px">
                <span style="display:inline-block;padding:5px 14px;border-radius:99px;font-size:12px;font-weight:700;${statusStyle}">${statusLabel}</span>
              </div>
            </td>
          </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
          <tr>
            <td style="vertical-align:top;width:48%;padding-right:16px">
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${C.muted};margin-bottom:8px">From</div>
              <div style="font-size:16px;font-weight:700;color:${C.black};margin-bottom:3px">${user.store || "Your Store"}</div>
              ${user.email ? `<p style="font-size:12px;color:${C.mid};margin:2px 0;line-height:1.6">${user.email}</p>` : ""}
              ${user.phone ? `<p style="font-size:12px;color:${C.mid};margin:2px 0;line-height:1.6">${user.phone}</p>` : ""}
              ${user.gstNumber ? `<p style="font-size:11px;color:${C.mid};margin:3px 0;letter-spacing:0.3px"><span style="font-weight:600">GSTIN:</span> ${user.gstNumber}</p>` : ""}
            </td>
            <td style="width:4%"></td>
            <td style="vertical-align:top;width:48%">
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${C.muted};margin-bottom:8px">Bill To</div>
              <div style="font-size:16px;font-weight:700;color:${C.black};margin-bottom:3px">${o.customerName}</div>
              <p style="font-size:12px;color:${C.mid};margin:2px 0;line-height:1.6">${o.source || "Instagram Order"}</p>
              ${addressHtml}
              ${deliveryHtml}
              ${o.notes ? `<p style="font-size:12px;color:${C.mid};margin:6px 0 0;line-height:1.5">Note: ${o.notes}</p>` : ""}
            </td>
          </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px">
          <thead>
            <tr style="background:${C.light}">
              <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:${C.muted};border-bottom:1px solid ${C.border};width:32px">#</th>
              <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:${C.muted};border-bottom:1px solid ${C.border}">Product</th>
              <th style="padding:10px 14px;text-align:center;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:${C.muted};border-bottom:1px solid ${C.border};width:60px">Qty</th>
              <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:${C.muted};border-bottom:1px solid ${C.border};width:100px">Unit Price</th>
              <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:${C.muted};border-bottom:1px solid ${C.border};width:100px">Total</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:0">
          <tr>
            <td width="55%"></td>
            <td width="45%">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:5px 0;font-size:13px;color:${C.mid}">Subtotal</td>
                  <td style="padding:5px 0;font-size:13px;color:${C.mid};text-align:right">${formatCurrency(subtotal)}</td>
                </tr>
                ${discountRow}
                <tr>
                  <td style="padding:5px 0;font-size:13px;color:${C.mid}">Shipping</td>
                  <td style="padding:5px 0;font-size:13px;color:${C.emerald};text-align:right;font-weight:600">Free</td>
                </tr>
                <tr>
                  <td colspan="2" style="padding:0"><hr style="border:none;border-top:2px solid ${C.border2};margin:6px 0"></td>
                </tr>
                <tr>
                  <td style="padding:8px 0;font-size:16px;font-weight:800;color:${C.black}">Total Due</td>
                  <td style="padding:8px 0;font-size:16px;font-weight:800;color:${C.accent};text-align:right">${formatCurrency(o.total)}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <div style="margin-top:32px;padding-top:20px;border-top:1px solid ${C.border};text-align:center;font-size:11px;color:#bbbbbb">
          <p style="margin:0 0 4px">Thank you for shopping with us!</p>
          <p style="margin:0 0 4px">Pay via UPI: <strong style="color:${C.mid}">${user.upiId || "upi@bank"}</strong> | Questions? DM us on Instagram</p>
          ${brandingFooter}
        </div>
      </div>
    `;
  }

  // ─── Email Invoice HTML ───────────────────────────────────────────────────
  function generateInvoiceEmailHTML(o, customer, user) {
    const isPaid    = o.payment === "paid";
    const subtotal  = o.total + (o.discount || 0);
    const storeName = user.store || "SellerFlow Store";
    const upiId     = user.upiId || "";

    const C = {
      indigo: "#6366F1", indigoDim: "#EEF2FF",
      green: "#16A34A", greenDim: "#DCFCE7",
      amber: "#B45309", amberDim: "#FEF3C7",
      red: "#DC2626", border: "#E5E7EB", bg: "#F9FAFB",
      white: "#FFFFFF", textPrimary: "#111827",
      textMuted: "#6B7280", textLight: "#9CA3AF",
    };

    const badgeBg    = isPaid ? C.greenDim : C.amberDim;
    const badgeColor = isPaid ? C.green    : C.amber;
    const badgeText  = isPaid ? "PAID"  : "PAYMENT PENDING";

    const itemRows = (o.items || []).map((item, i) => `
      <tr style="border-bottom:1px solid ${C.border}">
        <td style="padding:12px 8px;color:${C.textMuted};font-size:13px;vertical-align:top">${i + 1}</td>
        <td style="padding:12px 8px;font-weight:600;color:${C.textPrimary};font-size:14px;vertical-align:top">
          ${item.name}
          ${item.variant ? `<div style="font-size:11px;color:${C.textMuted};font-weight:400;margin-top:2px">${item.variant}</div>` : ""}
        </td>
        <td style="padding:12px 8px;text-align:center;color:${C.textPrimary};font-size:14px;vertical-align:top">${item.qty}</td>
        <td style="padding:12px 8px;text-align:right;color:${C.textMuted};font-size:14px;vertical-align:top;white-space:nowrap">${formatCurrency(item.price)}</td>
        <td style="padding:12px 8px;text-align:right;font-weight:700;color:${C.textPrimary};font-size:14px;vertical-align:top;white-space:nowrap">${formatCurrency(item.price * item.qty)}</td>
      </tr>`).join("");

    const discountRow = o.discount
      ? `<tr>
           <td colspan="2" style="padding:6px 8px;text-align:right;font-size:13px;color:${C.textMuted}">Discount (${o.coupon || "Manual"})</td>
           <td style="padding:6px 8px;text-align:right;font-weight:600;color:${C.red};font-size:13px;white-space:nowrap">-${formatCurrency(o.discount)}</td>
         </tr>`
      : "";

    const addressBlock = o.shippingAddress
      ? `<p style="margin:4px 0 0;font-size:13px;color:${C.textMuted};line-height:1.5">${o.shippingAddress}</p>`
      : "";

    const notesBlock = o.notes
      ? `<p style="margin:6px 0 0;font-size:12px;color:${C.textMuted}">Note: ${o.notes}</p>`
      : "";

    const upiBlock = upiId
      ? `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px">
           <tr>
             <td style="background:${C.indigoDim};border-radius:10px;padding:14px 18px;text-align:center">
               <p style="margin:0;font-size:13px;color:${C.indigo};font-weight:600">Pay via UPI</p>
               <p style="margin:6px 0 0;font-size:16px;font-weight:700;color:${C.textPrimary};letter-spacing:0.5px">${upiId}</p>
             </td>
           </tr>
         </table>`
      : "";

    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Invoice ${o.id} — ${storeName}</title></head>
<body style="margin:0;padding:0;background-color:#F3F4F6;font-family:Arial,Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F3F4F6;padding:32px 16px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:${C.white};border-radius:16px;overflow:hidden;border:1px solid ${C.border}">
        <tr>
          <td style="background:linear-gradient(135deg,#6366F1 0%,#818CF8 100%);padding:28px 32px">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="vertical-align:top">
                  <p style="margin:0;font-size:22px;font-weight:700;color:#fff">${storeName}</p>
                  ${user.instagram ? `<p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.8)">${user.instagram}</p>` : ""}
                  ${user.phone    ? `<p style="margin:2px 0 0;font-size:13px;color:rgba(255,255,255,0.8)">${user.phone}</p>` : ""}
                  ${user.gstNumber ? `<p style="margin:4px 0 0;font-size:11px;color:rgba(255,255,255,0.7)"><span style="font-weight:700">GSTIN:</span> ${user.gstNumber}</p>` : ""}
                </td>
                <td style="vertical-align:top;text-align:right">
                  <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:2px;color:rgba(255,255,255,0.7);text-transform:uppercase">Invoice</p>
                  <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#fff">#${o.id}</p>
                  <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.75)">${formatDate(o.date)}</p>
                  <div style="display:inline-block;margin-top:10px;padding:5px 12px;background:${badgeBg};border-radius:20px">
                    <span style="font-size:12px;font-weight:700;color:${badgeColor}">${badgeText}</span>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 0">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="vertical-align:top;width:50%;padding-right:16px">
                  <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${C.indigo}">FROM</p>
                  <p style="margin:6px 0 0;font-size:15px;font-weight:700;color:${C.textPrimary}">${storeName}</p>
                  ${user.email ? `<p style="margin:3px 0 0;font-size:12px;color:${C.textMuted}">${user.email}</p>` : ""}
                  ${user.gstNumber ? `<p style="margin:4px 0 0;font-size:11px;color:${C.textMuted}"><span style="font-weight:700;color:${C.textPrimary}">GSTIN:</span> ${user.gstNumber}</p>` : ""}
                </td>
                <td style="vertical-align:top;width:50%;padding-left:16px;border-left:2px solid ${C.border}">
                  <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${C.indigo}">BILL TO</p>
                  <p style="margin:6px 0 0;font-size:15px;font-weight:700;color:${C.textPrimary}">${o.customerName}</p>
                  ${customer?.email    ? `<p style="margin:3px 0 0;font-size:12px;color:${C.textMuted}">${customer.email}</p>` : ""}
                  ${customer?.phone    ? `<p style="margin:3px 0 0;font-size:12px;color:${C.textMuted}">${customer.phone}</p>` : ""}
                  ${customer?.instagram? `<p style="margin:3px 0 0;font-size:12px;color:${C.textMuted}">${customer.instagram}</p>` : ""}
                  ${addressBlock}
                  ${notesBlock}
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr><td style="padding:20px 32px 0"><div style="height:1px;background-color:${C.border}"></div></td></tr>
        <tr>
          <td style="padding:0 32px">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
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
        <tr><td style="padding:0 32px">${upiBlock}</td></tr>
        <tr>
          <td style="padding:28px 32px;text-align:center;border-top:1px solid ${C.border}">
            
            <p style="margin:8px 0 0;font-size:15px;font-weight:700;color:${C.textPrimary}">Thank you for shopping with us!</p>
            <p style="margin:6px 0 0;font-size:13px;color:${C.textMuted}">Questions? DM us on Instagram or reply to this email.</p>
            <p style="margin:20px 0 0;font-size:11px;color:${C.textLight}">Generated by <strong>SellerFlow</strong></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
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
