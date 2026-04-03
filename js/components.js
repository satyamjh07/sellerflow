// SellerFlow — Components Module
// Pure functions returning HTML strings. Decouples state from rendering.
// Built to be highly extensible for future fields (variant, image, delivery partner, etc.)
// ================================================================

const Components = (() => {
  // ─── Shared Utilities ──────────────────────────────────────────
  const { formatCurrency, formatDate, initials } = SF;

  function Badge(status, type, label) {
    if (!status) return "";
    return UI.orderStatusBadge
      ? `<span class="badge badge-${type}">${label}</span>`
      : "";
  }

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

    // Future-proofing fields: image, variant
    const visual = p.image
      ? `<img src="${p.image}" alt="${p.name}" style="width:36px;height:36px;border-radius:8px;object-fit:cover" />`
      : `<div class="product-img">${p.emoji || "📦"}</div>`;

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
            <button class="action-btn action-btn-edit" onclick="Modals.editProduct('${p.id}')">✏️ Edit</button>
            <button class="action-btn action-btn-del" onclick="Modals.deleteProduct('${p.id}')">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }

  // ─── Orders Components ──────────────────────────────────────────

  function OrderRow(o) {
    // data-label attributes on each <td> power the CSS card layout on
    // mobile (≤480px) — desktop table ignores them completely.
    // The first <td> merges Order ID + Customer avatar/name so the card
    // has a natural header row matching #orders-tbody td:first-child CSS.
    const sourceBadge = o.source
      ? `<span class="badge badge-muted" style="font-size:10px;margin-left:4px">${o.source}</span>`
      : "";

    return `
      <tr onclick="Modals.viewOrder('${o.id}')" style="cursor:pointer">
        <!-- First cell: Order ID + Customer — becomes card header on mobile -->
        <td>
          <div style="display:flex;align-items:center;gap:10px">
            <div class="customer-avatar" style="width:34px;height:34px;font-size:12px;flex-shrink:0">${initials(o.customerName)}</div>
            <div>
              <div class="fw-700 text-accent" style="font-size:13px;line-height:1.3">${o.id}${sourceBadge}</div>
              <div style="font-size:12px;color:var(--text-secondary);margin-top:1px">${o.customerName}</div>
            </div>
          </div>
        </td>
        <!-- Remaining cells: labelled for mobile card pseudo-elements -->
        <td data-label="Items" style="font-size:12px;color:var(--text-secondary)">
          ${o.items.map((i) => i.name).join(", ")}
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

    const discountHtml = o.discount
      ? `
      <div style="display:flex;justify-content:space-between;padding:8px 0;font-size:13px;color:var(--success)">
        <span>Discount (${o.coupon || "Manual"})</span>
        <span>-${formatCurrency(o.discount)}</span>
      </div>
    `
      : "";

    const shippingHtml = o.shippingAddress
      ? `
      <div style="grid-column: span 2; margin-top:8px">
        <div class="form-label">Shipping Address</div>
        <div class="fw-600" style="font-size:13px;line-height:1.4">${o.shippingAddress}</div>
      </div>
    `
      : "";

    const trackingHtml = o.trackingId
      ? `
      <div>
        <div class="form-label">Tracking ID</div>
        <div class="fw-600">${o.deliveryPartner || ""} ${o.trackingId}</div>
      </div>
    `
      : "";

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
        ${o.items
          .map(
            (i) => `
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px">
            <span>${i.name} × ${i.qty}</span>
            <span class="fw-600">${formatCurrency(i.price * i.qty)}</span>
          </div>
        `,
          )
          .join("")}
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
            ${["processing", "shipped", "delivered", "cancelled"]
              .map(
                (s) =>
                  `<option value="${s}" ${o.status === s ? "selected" : ""}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`,
              )
              .join("")}
          </select>
        </div>
        <div>
          <div class="form-label">Payment Status</div>
          <select id="update-payment-status" class="form-select" style="margin-top:4px">
            ${["pending", "paid", "refunded"]
              .map(
                (s) =>
                  `<option value="${s}" ${o.payment === s ? "selected" : ""}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`,
              )
              .join("")}
          </select>
        </div>
      </div>

      ${o.notes ? `<div class="form-label">Notes</div><div style="font-size:13px;color:var(--text-secondary);background:var(--bg-input);padding:10px;border-radius:8px;margin-top:4px">${o.notes}</div>` : ""}
    `;
  }

  // ─── Customers Components ───────────────────────────────────────

  function CustomerRow(c) {
    // Future-proofing fields: repeat score, WhatsApp icon
    const isRepeat = c.totalOrders >= 2;
    const typeBadge = isRepeat
      ? `<span class="badge badge-success">⭐ Repeat</span>`
      : `<span class="badge badge-muted">New</span>`;

    // Extensible WhatsApp indicator
    const whatsappIcon = c.whatsapp
      ? `<span style="color:#25D366;font-size:12px;margin-left:4px" title="WhatsApp connected">💬</span>`
      : "";

    // Repeat Score
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
    // Future-proofing fields: whatsapp, repeat score, notes
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
        ${c.totalOrders >= 2 ? `<span class="badge badge-success" style="margin-left:auto;text-align:right">⭐ Repeat Customer<br><small style="font-weight:normal;opacity:0.8">Score: ${c.repeatScore || "Good"}</small></span>` : ""}
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
      
      ${
        c.address || c.city || c.pincode
          ? `
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
      `
          : ""
      }
      
      ${c.notes ? `<div class="form-label">Customer Notes</div><div style="margin-bottom:20px;padding:12px;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;font-size:13px">${c.notes}</div>` : ""}

      <div class="form-label" style="margin-bottom:8px">Order History (${orders.length})</div>
      ${
        orders.length === 0
          ? `<div class="text-muted" style="font-size:13px;padding:12px;text-align:center">No orders yet</div>`
          : orders
              .map(
                (o) => `
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
          `,
              )
              .join("")
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
  // Do NOT replace inline styles with CSS classes for layout-critical
  // properties (display, width, color, background). html2canvas resolves
  // computed styles but cannot reflow a detached element using external
  // stylesheets, causing columns and colours to collapse/disappear in PDFs.
  //
  function InvoiceTemplate(o, user) {
    const isPaid = o.payment === "paid";
    const subtotal = o.total + (o.discount || 0);

    // ── Plan-aware feature flags ─────────────────────────────────
    // Check Billing module if available; gracefully fall back to default
    // behaviour (branding on, no logo) so invoices always work even if
    // Billing hasn't loaded yet (e.g. during PDF generation in iframe).
    const showBranding  = typeof Billing === 'undefined' || !Billing.hasNoBranding();
    const logoUrl       = user.logoUrl || null; // loaded into user profile by SF.getUser()
    const showLogo      = !!logoUrl && typeof Billing !== 'undefined' && Billing.canUploadLogo();

    // ── Colours (hard-coded — never CSS variables) ───────────────
    // These must be literal hex values so html2canvas captures them
    // correctly when the template is cloned off-document for PDF export.
    const C = {
      accent: "#6366F1",
      black: "#1a1a1a",
      dark: "#222222",
      mid: "#444444",
      muted: "#888888",
      light: "#f8f8f8",
      border: "#f0f0f0",
      border2: "#e0e0e0",
      white: "#ffffff",
      green: "#059669",
      greenBg: "#d1fae5",
      amber: "#d97706",
      amberBg: "#fef3c7",
      emerald: "#10B981",
      red: "#EF4444",
    };

    // ── Optional blocks ──────────────────────────────────────────
    const deliveryHtml = o.deliveryPartner
      ? `<p style="font-size:12px;color:${C.muted};margin:2px 0">Partner: ${o.deliveryPartner}${o.trackingId ? ` · ID: ${o.trackingId}` : ""}</p>`
      : "";

    const discountRow = o.discount
      ? `
      <tr>
        <td colspan="2" style="padding:5px 0;font-size:13px;color:${C.mid}">Discount${o.coupon ? ` (${o.coupon})` : ""}</td>
        <td style="padding:5px 0;font-size:13px;color:${C.red};text-align:right">−${formatCurrency(o.discount)}</td>
      </tr>`
      : "";

    const addressHtml = o.shippingAddress
      ? `<p style="font-size:12px;color:${C.mid};margin:2px 0;line-height:1.5">${o.shippingAddress}</p>`
      : "";

    // ── Store brand block (logo if Platinum, text if not) ────────
    const brandBlock = showLogo
      ? `<img src="${logoUrl}" alt="${user.store || 'Store Logo'}"
           style="max-height:56px;max-width:200px;object-fit:contain;margin-bottom:6px;display:block">`
      : `<div style="font-size:22px;font-weight:700;color:${C.accent};letter-spacing:-0.5px;margin-bottom:4px">🛍️ ${user.store || "SellerFlow Store"}</div>`;

    // ── Item rows ────────────────────────────────────────────────
    const itemRows = o.items
      .map(
        (item, i) => `
      <tr style="background:${i % 2 === 0 ? C.white : C.light}">
        <td style="padding:11px 14px;font-size:13px;color:${C.muted};border-bottom:1px solid ${C.border};width:32px">${i + 1}</td>
        <td style="padding:11px 14px;font-size:13px;font-weight:600;color:${C.black};border-bottom:1px solid ${C.border}">
          ${item.name}
          ${item.variant ? `<div style="font-size:11px;color:${C.muted};font-weight:400;margin-top:2px">${item.variant}</div>` : ""}
        </td>
        <td style="padding:11px 14px;font-size:13px;color:${C.mid};text-align:center;border-bottom:1px solid ${C.border};width:60px">${item.qty}</td>
        <td style="padding:11px 14px;font-size:13px;color:${C.mid};text-align:right;border-bottom:1px solid ${C.border};width:100px">${formatCurrency(item.price)}</td>
        <td style="padding:11px 14px;font-size:13px;font-weight:700;color:${C.black};text-align:right;border-bottom:1px solid ${C.border};width:100px">${formatCurrency(item.price * item.qty)}</td>
      </tr>`,
      )
      .join("");

    // ── Status badge ─────────────────────────────────────────────
    const statusStyle = isPaid
      ? `background:${C.greenBg};color:${C.green}`
      : `background:${C.amberBg};color:${C.amber}`;
    const statusLabel = isPaid ? "✅ PAID" : "⏳ PAYMENT PENDING";

    // ── Footer branding ──────────────────────────────────────────
    // Bronze & Free: show "Generated by SellerFlow" footer line.
    // Platinum & Trial: no SellerFlow branding — clean footer.
    const brandingFooter = showBranding
      ? `<p style="margin:6px 0 0;font-size:10px">Generated by <a href="https://sellerflow.in" style="color:${C.accent};text-decoration:none">SellerFlow</a> • sellerflow.in</p>`
      : '';

    return `
      <div class="invoice-wrapper" id="invoice-print-area" style="background:${C.white};color:${C.black};padding:40px;font-family:DM Sans,Arial,sans-serif;border-radius:12px">

        <!-- ── HEADER: brand left, invoice meta right ── -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;padding-bottom:24px;border-bottom:2px solid ${C.border}">
          <tr>
            <!-- Store brand / logo -->
            <td style="vertical-align:top;width:50%">
              ${brandBlock}
              ${user.instagram ? `<p style="font-size:12px;color:${C.muted};margin:2px 0">${user.instagram}</p>` : ""}
              ${user.phone ? `<p style="font-size:12px;color:${C.muted};margin:2px 0">${user.phone}</p>` : ""}
              ${user.upiId ? `<p style="font-size:12px;color:${C.muted};margin:2px 0">UPI: ${user.upiId}</p>` : ""}
            </td>
            <!-- Invoice meta -->
            <td style="vertical-align:top;text-align:right;width:50%">
              <div style="font-size:20px;font-weight:800;color:${C.black};letter-spacing:-0.5px">INVOICE</div>
              <p style="font-size:12px;color:${C.muted};margin:3px 0">#${o.id}</p>
              <p style="font-size:12px;color:${C.muted};margin:3px 0">Date: ${formatDate(o.date)}</p>
              <div style="margin-top:8px">
                <span style="display:inline-block;padding:5px 14px;border-radius:99px;font-size:12px;font-weight:700;${statusStyle}">
                  ${statusLabel}
                </span>
              </div>
            </td>
          </tr>
        </table>

        <!-- ── FROM / BILL TO ── -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
          <tr>
            <!-- From -->
            <td style="vertical-align:top;width:48%;padding-right:16px">
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${C.muted};margin-bottom:8px">From</div>
              <div style="font-size:16px;font-weight:700;color:${C.black};margin-bottom:3px">${user.store || "Your Store"}</div>
              ${user.email ? `<p style="font-size:12px;color:${C.mid};margin:2px 0;line-height:1.6">${user.email}</p>` : ""}
              ${user.phone ? `<p style="font-size:12px;color:${C.mid};margin:2px 0;line-height:1.6">${user.phone}</p>` : ""}
            </td>
            <!-- Spacer column -->
            <td style="width:4%"></td>
            <!-- Bill To -->
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

        <!-- ── ITEMS TABLE ── -->
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
          <tbody>
            ${itemRows}
          </tbody>
        </table>

        <!-- ── TOTALS ── -->
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

        <!-- ── FOOTER ── -->
        <div style="margin-top:32px;padding-top:20px;border-top:1px solid ${C.border};text-align:center;font-size:11px;color:#bbbbbb">
          <p style="margin:0 0 4px">Thank you for shopping with us! 💜</p>
          <p style="margin:0 0 4px">Pay via UPI: <strong style="color:${C.mid}">${user.upiId || "upi@bank"}</strong> | Questions? DM us on Instagram</p>
          ${brandingFooter}
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
    const isPaid = o.payment === "paid";
    const subtotal = o.total + (o.discount || 0);
    const storeName = user.store || "SellerFlow Store";
    const upiId = user.upiId || "";

    // ── Colour tokens (email-safe, no CSS vars) ────────────────
    const C = {
      indigo: "#6366F1",
      indigoDim: "#EEF2FF",
      green: "#16A34A",
      greenDim: "#DCFCE7",
      amber: "#B45309",
      amberDim: "#FEF3C7",
      red: "#DC2626",
      border: "#E5E7EB",
      bg: "#F9FAFB",
      white: "#FFFFFF",
      textPrimary: "#111827",
      textMuted: "#6B7280",
      textLight: "#9CA3AF",
    };

    // ── Status badge ───────────────────────────────────────────
    const badgeBg = isPaid ? C.greenDim : C.amberDim;
    const badgeColor = isPaid ? C.green : C.amber;
    const badgeText = isPaid ? "✅ PAID" : "⏳ PAYMENT PENDING";

    // ── Product rows ───────────────────────────────────────────
    const itemRows = (o.items || [])
      .map(
        (item, i) => `
      <tr style="border-bottom:1px solid ${C.border}">
        <td style="padding:12px 8px;color:${C.textMuted};font-size:13px;vertical-align:top">${i + 1}</td>
        <td style="padding:12px 8px;font-weight:600;color:${C.textPrimary};font-size:14px;vertical-align:top">
          ${item.name}
          ${item.variant ? `<div style="font-size:11px;color:${C.textMuted};font-weight:400;margin-top:2px">${item.variant}</div>` : ""}
        </td>
        <td style="padding:12px 8px;text-align:center;color:${C.textPrimary};font-size:14px;vertical-align:top">${item.qty}</td>
        <td style="padding:12px 8px;text-align:right;color:${C.textMuted};font-size:14px;vertical-align:top;white-space:nowrap">${formatCurrency(item.price)}</td>
        <td style="padding:12px 8px;text-align:right;font-weight:700;color:${C.textPrimary};font-size:14px;vertical-align:top;white-space:nowrap">${formatCurrency(item.price * item.qty)}</td>
      </tr>
    `,
      )
      .join("");

    // ── Discount row (optional) ────────────────────────────────
    const discountRow = o.discount
      ? `
      <tr>
        <td colspan="2" style="padding:6px 8px;text-align:right;font-size:13px;color:${C.textMuted}">
          Discount (${o.coupon || "Manual"})
        </td>
        <td style="padding:6px 8px;text-align:right;font-weight:600;color:${C.red};font-size:13px;white-space:nowrap">
          -${formatCurrency(o.discount)}
        </td>
      </tr>
    `
      : "";

    // ── Shipping address ───────────────────────────────────────
    const addressBlock = o.shippingAddress
      ? `<p style="margin:4px 0 0;font-size:13px;color:${C.textMuted};line-height:1.5">${o.shippingAddress}</p>`
      : "";

    // ── Notes ─────────────────────────────────────────────────
    const notesBlock = o.notes
      ? `<p style="margin:6px 0 0;font-size:12px;color:${C.textMuted}">📝 Note: ${o.notes}</p>`
      : "";

    // ── UPI block ─────────────────────────────────────────────
    const upiBlock = upiId
      ? `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px">
        <tr>
          <td style="background:${C.indigoDim};border-radius:10px;padding:14px 18px;text-align:center">
            <p style="margin:0;font-size:13px;color:${C.indigo};font-weight:600">💳 Pay via UPI</p>
            <p style="margin:6px 0 0;font-size:16px;font-weight:700;color:${C.textPrimary};letter-spacing:0.5px">${upiId}</p>
          </td>
        </tr>
      </table>
    `
      : "";

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
                    ${user.instagram ? `<p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.8)">${user.instagram}</p>` : ""}
                    ${user.phone ? `<p style="margin:2px 0 0;font-size:13px;color:rgba(255,255,255,0.8)">${user.phone}</p>` : ""}
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
                    ${user.email ? `<p style="margin:3px 0 0;font-size:12px;color:${C.textMuted}">${user.email}</p>` : ""}
                    ${user.phone ? `<p style="margin:3px 0 0;font-size:12px;color:${C.textMuted}">${user.phone}</p>` : ""}
                  </td>
                  <!-- Bill To -->
                  <td style="vertical-align:top;width:50%;padding-left:16px;border-left:2px solid ${C.border}">
                    <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${C.indigo}">BILL TO</p>
                    <p style="margin:6px 0 0;font-size:15px;font-weight:700;color:${C.textPrimary}">${o.customerName}</p>
                    ${customer?.email ? `<p style="margin:3px 0 0;font-size:12px;color:${C.textMuted}">${customer.email}</p>` : ""}
                    ${customer?.phone ? `<p style="margin:3px 0 0;font-size:12px;color:${C.textMuted}">${customer.phone}</p>` : ""}
                    ${customer?.instagram ? `<p style="margin:3px 0 0;font-size:12px;color:${C.textMuted}">${customer.instagram}</p>` : ""}
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
