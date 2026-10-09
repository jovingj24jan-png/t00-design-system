/* Site configuration. Load in <head>, before any other script, on every app page.

   MAINTENANCE MODE (prototype switch)
   Set maintenanceMode to true and deploy to send every app page to maintenance.html.
   Set it back to false and deploy to end maintenance.
   This is a frontend flag in a static site: it only changes which page the browser shows.
   It does not stop a server or block API traffic. A real deployment should also return
   HTTP 503 with Retry-After from the server or CDN during maintenance. */
(() => {
  'use strict';

  window.NexoraConfig = Object.freeze({ maintenanceMode: false });

  if (window.NexoraConfig.maintenanceMode && !/\/maintenance\.html$/.test(location.pathname)) {
    const here = location.pathname.split('/').pop() || 'design-system.html';
    // replace() keeps the maintenance page out of history, so Back doesn't loop.
    document.documentElement.style.visibility = 'hidden';
    location.replace(`maintenance.html?from=${encodeURIComponent(here + location.search + location.hash)}`);
  }
})();
