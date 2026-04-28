/**
 * AffArmy Tracking SDK
 * Drop this on any page to auto-capture affiliate referrals and fire conversions.
 * Usage: <script src="https://your-affArmy.com/sdk/aff-army.js" data-base="https://your-affArmy.com"></script>
 */
(function () {
  'use strict';

  var script = document.currentScript || document.querySelector('script[data-base]');
  var BASE = (script && script.getAttribute('data-base')) || '';
  var COOKIE_DAYS = parseInt((script && script.getAttribute('data-cookie-days')) || '30');
  var PARAM = (script && script.getAttribute('data-param')) || 'ref';

  // ── Cookie Helpers ─────────────────────────────────────────

  function setCookie(name, value, days) {
    var expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + expires + '; path=/; SameSite=Lax';
  }

  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  }

  // ── Referral Capture ───────────────────────────────────────

  function captureReferral() {
    var params = new URLSearchParams(window.location.search);
    var code = params.get(PARAM) || params.get('aff') || params.get('affiliate');
    if (!code) return;

    code = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!code) return;

    // Fire a click to the server and get a session ID
    var url = BASE + '/track/click/' + code + '?to=' + encodeURIComponent(window.location.href);

    // Ping the server (no-CORS image trick as fallback)
    fetch(url, { method: 'GET', mode: 'no-cors', credentials: 'include' }).catch(function () {
      new Image().src = url;
    });

    setCookie('aff_code', code, COOKIE_DAYS);
  }

  // ── Conversion Fire ────────────────────────────────────────

  /**
   * Call this on your thank-you / confirmation page after a purchase.
   * @param {string} orderId  Your order ID
   * @param {number} amount   Sale amount in cents (e.g. 4999 for $49.99)
   */
  window.AffArmy = {
    trackConversion: function (orderId, amount) {
      var code = getCookie('aff_code');
      var sid = getCookie('aff_sid');

      var payload = { orderId: String(orderId), amount: Number(amount) };
      if (code) payload.affiliateCode = code;
      if (sid) payload.sessionId = sid;

      fetch(BASE + '/track/conversion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      }).catch(function (err) {
        console.warn('[AffArmy] conversion ping failed:', err);
      });
    },

    getCode: function () {
      return getCookie('aff_code');
    },
  };

  // Auto-capture on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', captureReferral);
  } else {
    captureReferral();
  }

})();
