// SellerFlow — Notification Service
// Provider-agnostic email and notification dispatcher.
//
// ARCHITECTURE
//   NotificationService.sendOrderEmail(type, order, customer, user)
//     → validates eligibility
//     → builds the branded HTML template for the event type
//     → dispatches via the configured provider (currently EmailJS)
//     → logs the attempt to notification_logs in Supabase
//     → updates the order row to prevent duplicate sends
//
// SUPPORTED EVENT TYPES
//   payment_followup   — manual "please pay" reminder (Bronze/Platinum only)
//   shipped            — order has shipped
//   out_for_delivery   — order is out for delivery today
//   delivered          — order delivered successfully
//
// ADDING A NEW PROVIDER (e.g. Resend, Brevo, WhatsApp)
//   1. Add a case to _dispatch() below
//   2. Set PROVIDER constant or read it from user settings
//   3. Everything else (templates, logging, dedup) stays the same
//
// DEDUPLICATION
//   payment_followup: guarded by last_followup_sent_at (caller checks cooldown)
//   delivery events:  guarded by delivery_email_sent_statuses JSON array in DB
//                     We write the status to that array BEFORE sending so a
//                     page reload mid-send cannot cause a duplicate.
//
// ================================================================

const NotificationService = (() => {

  // ── Provider config ───────────────────────────────────────────
  // Reuses the same EmailJS credentials already configured in the app.
  const EMAILJS_SERVICE_ID  = 'service_5k8qt0o';
  const EMAILJS_TEMPLATE_ID = 'template_x6h0iqc';

  // Minimum hours between payment follow-up emails for the same order.
  // Prevents accidental spam if the seller clicks repeatedly.
  const FOLLOWUP_COOLDOWN_HOURS = 24;

  // ── Plan gate helpers ─────────────────────────────────────────

  // payment_followup requires Bronze or Platinum
  function _canSendFollowup() {
    if (typeof Billing === 'undefined') return false;
    const id = Billing.getCurrentPlan().id;
    return id === 'bronze' || id === 'platinum' || id === 'trial';
  }

  // Delivery status emails are free for all plans
  function _canSendDeliveryEmail() {
    return true;
  }


  // ════════════════════════════════════════════════════════════
  //  PUBLIC API
  // ════════════════════════════════════════════════════════════

  // sendOrderEmail(type, order, customer, user)
  //
  // @param type     {string}  Event type (see SUPPORTED EVENT TYPES above)
  // @param order    {object}  Full order object from SF.getOrders()
  // @param customer {object}  Customer object from SF.getCustomers() — may be null
  // @param user     {object}  Seller profile from SF.getUser()
  // @returns        {object}  { success: bool, error?: string }
  //
  async function sendOrderEmail(type, order, customer, user) {
    try {
      // ── Guard: recipient email ──────────────────────────────
      const recipientEmail = customer?.email || '';
      if (!recipientEmail) {
        return { success: false, error: 'No customer email on file.' };
      }

      // ── Guard: plan eligibility ─────────────────────────────
      if (type === 'payment_followup' && !_canSendFollowup()) {
        return { success: false, error: 'Upgrade to Bronze or Platinum to send payment follow-ups.' };
      }

      // ── Guard: deduplication for delivery emails ────────────
      if (_isDeliveryType(type)) {
        const alreadySent = await _checkDeliveryAlreadySent(order.id, type);
        if (alreadySent) {
          return { success: false, error: `Email for '${type}' already sent for this order.` };
        }
        // Mark as sent BEFORE dispatch to prevent race on retry
        await _markDeliverySent(order.id, type, order.delivery_email_sent_statuses || []);
      }

      // ── Guard: follow-up cooldown ───────────────────────────
      if (type === 'payment_followup') {
        const lastSent = order.lastFollowupSentAt;
        if (lastSent) {
          const hoursSince = (Date.now() - new Date(lastSent).getTime()) / 3600000;
          if (hoursSince < FOLLOWUP_COOLDOWN_HOURS) {
            const hoursLeft = Math.ceil(FOLLOWUP_COOLDOWN_HOURS - hoursSince);
            return {
              success: false,
              error: `Follow-up already sent recently. Wait ${hoursLeft}h before resending.`,
            };
          }
        }
      }

      // ── Build HTML template ─────────────────────────────────
      const html = _buildTemplate(type, order, customer, user);

      // ── Dispatch via provider ───────────────────────────────
      const subject = _getSubject(type, order, user);
      await _dispatch({
        to_email:       recipientEmail,
        to_name:        customer?.name || order.customerName,
        customer_name:  customer?.name || order.customerName,
        customer_email: recipientEmail,
        order_id:       order.id,
        store_name:     user?.store || 'SellerFlow Store',
        total:          SF.formatCurrency(order.total),
        payment_status: subject,
        invoice_html:   html,
      });

      // ── Log success ─────────────────────────────────────────
      await _logNotification({
        orderId:        order.id,
        eventType:      type,
        recipientEmail,
        customerName:   customer?.name || order.customerName,
        status:         'sent',
      });

      // ── Update order timestamp for follow-ups ───────────────
      if (type === 'payment_followup') {
        await _updateFollowupTimestamp(order.id);
      }

      return { success: true };

    } catch (err) {
      console.error(`[NotificationService] sendOrderEmail(${type}) failed:`, err);

      // Log the failure
      await _logNotification({
        orderId:        order.id,
        eventType:      type,
        recipientEmail: customer?.email || '',
        customerName:   customer?.name  || order.customerName,
        status:         'failed',
        errorMessage:   err.message || 'Unknown error',
      }).catch(() => {}); // never throw from error path

      return { success: false, error: err.message || 'Failed to send email.' };
    }
  }


  // ════════════════════════════════════════════════════════════
  //  EMAIL TEMPLATES
  //  All templates return a complete, self-contained HTML string.
  //  Gmail / Outlook / Apple Mail safe — table-based, inline styles.
  //  Brand colours: indigo #6366F1, dark bg #0B1120 wrapping white card.
  // ════════════════════════════════════════════════════════════

  function _buildTemplate(type, order, customer, user) {
    const name      = customer?.name || order.customerName || 'Valued Customer';
    const storeName = user?.store    || 'SellerFlow Store';
    const firstName = name.split(' ')[0];

    switch (type) {
      case 'payment_followup':  return _tplPaymentFollowup(firstName, order, user, storeName);
      case 'shipped':           return _tplDelivery(firstName, order, user, storeName, 'shipped');
      case 'out_for_delivery':  return _tplDelivery(firstName, order, user, storeName, 'out_for_delivery');
      case 'delivered':         return _tplDelivery(firstName, order, user, storeName, 'delivered');
      default:
        throw new Error(`Unknown notification type: ${type}`);
    }
  }

  // ── Shared email shell ────────────────────────────────────────
  // Wraps any inner content in the branded card shell.
  function _shell(innerHtml, accentColor = '#6366F1') {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SellerFlow Notification</title>
</head>
<body style="margin:0;padding:0;background-color:#F3F4F6;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F3F4F6;padding:32px 16px">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
          style="max-width:580px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E5E7EB">

          <!-- Accent header bar -->
          <tr>
            <td style="background:${accentColor};padding:4px 0;line-height:0">&nbsp;</td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:32px 36px 28px">
              ${innerHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F9FAFB;padding:18px 36px;border-top:1px solid #E5E7EB;text-align:center">
              <p style="margin:0;font-size:11px;color:#9CA3AF">
                You're receiving this because you placed an order with this store.
              </p>
              <p style="margin:6px 0 0;font-size:11px;color:#D1D5DB">
                Powered by <strong style="color:#6366F1">SellerFlow</strong>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  // ── Template: Payment Follow-up ───────────────────────────────
  function _tplPaymentFollowup(firstName, order, user, storeName) {
    const upiLine = user?.upiId
      ? `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px">
           <tr>
             <td style="background:#EEF2FF;border-radius:10px;padding:16px 20px;text-align:center">
               <p style="margin:0;font-size:13px;color:#6366F1;font-weight:700">💳 Pay via UPI</p>
               <p style="margin:8px 0 0;font-size:18px;font-weight:700;color:#111827;letter-spacing:0.5px">${user.upiId}</p>
             </td>
           </tr>
         </table>`
      : '';

    const inner = `
      <!-- Logo / Store name -->
      <p style="margin:0 0 24px;font-size:22px;font-weight:700;color:#111827">🛍️ ${storeName}</p>

      <!-- Greeting -->
      <p style="margin:0 0 6px;font-size:16px;font-weight:700;color:#111827">Hi ${firstName} 👋</p>
      <p style="margin:0 0 20px;font-size:14px;color:#6B7280;line-height:1.6">
        We noticed your order is still awaiting payment. We'd love to get it on its way to you!
      </p>

      <!-- Order summary card -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0"
        style="background:#F9FAFB;border-radius:10px;border:1px solid #E5E7EB;margin-bottom:20px">
        <tr>
          <td style="padding:16px 20px">
            <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#9CA3AF">Order Summary</p>
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-size:13px;color:#6B7280;padding:4px 0">Order ID</td>
                <td style="font-size:13px;color:#111827;font-weight:600;text-align:right;padding:4px 0">#${order.id}</td>
              </tr>
              <tr>
                <td style="font-size:13px;color:#6B7280;padding:4px 0">Items</td>
                <td style="font-size:13px;color:#111827;font-weight:600;text-align:right;padding:4px 0">
                  ${(order.items || []).map(i => `${i.name} ×${i.qty}`).join(', ')}
                </td>
              </tr>
              <tr>
                <td colspan="2" style="padding:8px 0 4px">
                  <div style="height:1px;background:#E5E7EB"></div>
                </td>
              </tr>
              <tr>
                <td style="font-size:15px;font-weight:700;color:#111827;padding:4px 0">Amount Due</td>
                <td style="font-size:18px;font-weight:800;color:#6366F1;text-align:right;padding:4px 0">
                  ${SF.formatCurrency(order.total)}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      ${upiLine}

      <!-- CTA message -->
      <p style="margin:20px 0 0;font-size:14px;color:#6B7280;line-height:1.6">
        Once payment is received, we'll process and ship your order right away.
        If you've already paid, please ignore this message — we'll update the status shortly.
      </p>

      <p style="margin:16px 0 0;font-size:14px;color:#6B7280">
        Questions? Just reply to this email or DM us on Instagram.
      </p>

      <p style="margin:24px 0 0;font-size:14px;color:#374151">
        Thank you for your support! 💜<br>
        <strong>${storeName}</strong>
      </p>`;

    return _shell(inner, '#F59E0B'); // amber header for payment reminder
  }

  // ── Template: Delivery Status (shipped / out_for_delivery / delivered) ─
  function _tplDelivery(firstName, order, user, storeName, status) {
    const statusConfig = {
      shipped: {
        emoji:      '🚚',
        headline:   'Your order has been shipped!',
        body:       `Great news — your order is on its way! Our delivery partner will bring it to you soon.`,
        badge:      'Shipped',
        badgeBg:    '#EFF6FF',
        badgeColor: '#2563EB',
        accent:     '#3B82F6',
      },
      out_for_delivery: {
        emoji:      '📦',
        headline:   'Your order is out for delivery today!',
        body:       `Your order is on a delivery vehicle and will reach you today. Please make sure someone is available to receive it.`,
        badge:      'Out for Delivery',
        badgeBg:    '#FFF7ED',
        badgeColor: '#C2410C',
        accent:     '#F97316',
      },
      delivered: {
        emoji:      '✅',
        headline:   'Your order has been delivered!',
        body:       `Your order has been delivered successfully. We hope you love it! If there's anything wrong, please reach out to us immediately.`,
        badge:      'Delivered',
        badgeBg:    '#F0FDF4',
        badgeColor: '#15803D',
        accent:     '#22C55E',
      },
    };

    const cfg = statusConfig[status] || statusConfig.shipped;

    const trackingLine = order.trackingId
      ? `<p style="margin:12px 0 0;font-size:13px;color:#6B7280">
           Tracking ID: <strong style="color:#374151">${order.deliveryPartner ? order.deliveryPartner + ' · ' : ''}${order.trackingId}</strong>
         </p>`
      : '';

    const inner = `
      <!-- Store name -->
      <p style="margin:0 0 20px;font-size:20px;font-weight:700;color:#111827">🛍️ ${storeName}</p>

      <!-- Status badge -->
      <div style="display:inline-block;padding:6px 16px;background:${cfg.badgeBg};border-radius:99px;margin-bottom:16px">
        <span style="font-size:13px;font-weight:700;color:${cfg.badgeColor}">${cfg.emoji} ${cfg.badge}</span>
      </div>

      <!-- Headline + body -->
      <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#111827">${cfg.headline}</p>
      <p style="margin:0 0 20px;font-size:14px;color:#6B7280;line-height:1.6">Hi ${firstName}, ${cfg.body}</p>

      <!-- Order info card -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0"
        style="background:#F9FAFB;border-radius:10px;border:1px solid #E5E7EB;margin-bottom:20px">
        <tr>
          <td style="padding:16px 20px">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-size:13px;color:#6B7280;padding:4px 0">Order ID</td>
                <td style="font-size:13px;color:#111827;font-weight:600;text-align:right;padding:4px 0">#${order.id}</td>
              </tr>
              <tr>
                <td style="font-size:13px;color:#6B7280;padding:4px 0">Items</td>
                <td style="font-size:13px;color:#111827;font-weight:600;text-align:right;padding:4px 0">
                  ${(order.items || []).map(i => `${i.name} ×${i.qty}`).join(', ')}
                </td>
              </tr>
              <tr>
                <td style="font-size:13px;color:#6B7280;padding:4px 0">Total</td>
                <td style="font-size:13px;color:#111827;font-weight:600;text-align:right;padding:4px 0">
                  ${SF.formatCurrency(order.total)}
                </td>
              </tr>
            </table>
            ${trackingLine}
          </td>
        </tr>
      </table>

      <!-- Closing -->
      <p style="margin:0;font-size:14px;color:#374151">
        ${status === 'delivered'
          ? 'Thank you for shopping with us! We hope to see you again soon. 💜'
          : 'Thank you for your patience! 💜'}
        <br><strong>${storeName}</strong>
      </p>`;

    return _shell(inner, cfg.accent);
  }


  // ════════════════════════════════════════════════════════════
  //  DISPATCH (provider layer)
  //  Swap this function to change email provider.
  //  All callers pass the same normalized payload object.
  // ════════════════════════════════════════════════════════════

  async function _dispatch(payload) {
    // ── EmailJS (current provider) ────────────────────────────
    if (typeof emailjs === 'undefined') {
      throw new Error('EmailJS not loaded. Check script tag in index.html.');
    }
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, payload);

    // ── Future providers (uncomment to switch): ───────────────
    // await _dispatchResend(payload);
    // await _dispatchBrevo(payload);
    // await _dispatchWhatsApp(payload);
  }

  // Stub: Resend (https://resend.com)
  // async function _dispatchResend(payload) {
  //   const res = await fetch('https://api.resend.com/emails', {
  //     method: 'POST',
  //     headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
  //     body: JSON.stringify({
  //       from: 'orders@yourdomain.com',
  //       to:   payload.to_email,
  //       subject: payload.payment_status,
  //       html: payload.invoice_html,
  //     }),
  //   });
  //   if (!res.ok) throw new Error(await res.text());
  // }


  // ════════════════════════════════════════════════════════════
  //  SUPABASE HELPERS
  // ════════════════════════════════════════════════════════════

  // Log a send attempt to notification_logs
  async function _logNotification({ orderId, eventType, recipientEmail, customerName, status, errorMessage }) {
    const uid = Auth.getUserId();
    if (!uid) return;
    const { error } = await _supabase
      .from('notification_logs')
      .insert({
        user_id:         uid,
        order_id:        orderId,
        event_type:      eventType,
        recipient_email: recipientEmail,
        customer_name:   customerName || '',
        status,
        error_message:   errorMessage || null,
        provider:        'emailjs',
      });
    if (error) console.warn('[NotificationService] Log write failed:', error.message);
  }

  // Stamp last_followup_sent_at on the order row
  async function _updateFollowupTimestamp(orderId) {
    const uid = Auth.getUserId();
    if (!uid) return;
    const { error } = await _supabase
      .from('orders')
      .update({ last_followup_sent_at: new Date().toISOString() })
      .eq('id', orderId)
      .eq('user_id', uid);
    if (error) console.warn('[NotificationService] Timestamp update failed:', error.message);
  }

  // Check if a delivery email for this status was already sent
  async function _checkDeliveryAlreadySent(orderId, eventType) {
    const uid = Auth.getUserId();
    if (!uid) return false;
    const { data, error } = await _supabase
      .from('orders')
      .select('delivery_email_sent_statuses')
      .eq('id', orderId)
      .eq('user_id', uid)
      .single();
    if (error || !data) return false;
    const sent = Array.isArray(data.delivery_email_sent_statuses)
      ? data.delivery_email_sent_statuses
      : [];
    return sent.includes(eventType);
  }

  // Add the status to the sent array (idempotent write)
  async function _markDeliverySent(orderId, eventType, currentArray) {
    const uid = Auth.getUserId();
    if (!uid) return;
    const updated = [...new Set([...(currentArray || []), eventType])];
    const { error } = await _supabase
      .from('orders')
      .update({ delivery_email_sent_statuses: updated })
      .eq('id', orderId)
      .eq('user_id', uid);
    if (error) console.warn('[NotificationService] Sent-status update failed:', error.message);
  }


  // ════════════════════════════════════════════════════════════
  //  UTILITY HELPERS
  // ════════════════════════════════════════════════════════════

  function _isDeliveryType(type) {
    return ['shipped', 'out_for_delivery', 'delivered'].includes(type);
  }

  function _getSubject(type, order, user) {
    const store = user?.store || 'SellerFlow';
    switch (type) {
      case 'payment_followup':  return `⏳ Payment Reminder — Order #${order.id} | ${store}`;
      case 'shipped':           return `🚚 Your order #${order.id} has shipped | ${store}`;
      case 'out_for_delivery':  return `📦 Out for delivery today — Order #${order.id} | ${store}`;
      case 'delivered':         return `✅ Order #${order.id} delivered | ${store}`;
      default:                  return `Order Update #${order.id} | ${store}`;
    }
  }

  // Public helpers for plan gating checks (used by UI to show/hide buttons)
  function canSendFollowup()      { return _canSendFollowup(); }
  function canSendDeliveryEmail() { return _canSendDeliveryEmail(); }

  // Public API
  return {
    sendOrderEmail,
    canSendFollowup,
    canSendDeliveryEmail,
  };

})();
