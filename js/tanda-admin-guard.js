/**
 * Client gate for /admin-tools/ pages (mirrors mobile admin visibility).
 * Requires ../js/super-affiliate-api.js loaded first.
 *
 * Non-admins → access-denied page. Unauthenticated → login with return URL.
 */
(function () {
  'use strict';

  var SITE_ROOT = '../';
  var LOGIN = SITE_ROOT + 'super-affiliate-login.html';
  var HOME = SITE_ROOT + 'index.html';
  var ACCESS_DENIED = SITE_ROOT + 'access-denied.html?reason=admin-tools';

  function redirect(url) {
    window.location.replace(url);
  }

  async function run() {
    if (typeof SuperAffiliateAPI === 'undefined') {
      redirect(HOME);
      return;
    }
    if (!SuperAffiliateAPI.isAuthenticated()) {
      redirect(LOGIN + '?redirect=' + encodeURIComponent(window.location.href));
      return;
    }
    var user;
    try {
      user = await SuperAffiliateAPI.getCurrentUser();
    } catch (e) {
      redirect(LOGIN + '?redirect=' + encodeURIComponent(window.location.href));
      return;
    }
    if (!SuperAffiliateAPI.isTandaWebAdmin(user)) {
      redirect(ACCESS_DENIED);
      return;
    }
  }

  run();
})();
