/**
 * Shared entry point for this app's Desk menu items (Frappe v16).
 *
 * v15 rendered a Bootstrap navbar, so the theme switcher and Sound Studio
 * injected DOM into `.navbar .navbar-nav.ms-auto` and
 * `.dropdown-navbar-user .dropdown-menu`. v16 replaced the navbar with a
 * left sidebar (frappe/public/js/frappe/ui/sidebar/sidebar.html) and builds
 * the user menu in JS via `frappe.ui.create_menu({menu_items: [...]})` —
 * there is no `.dropdown-menu` element to append to any more.
 *
 * In v16 that menu is assembled by frappe.ui.SidebarHeader (see
 * ui/sidebar/sidebar_header.js) and handed to create_menu from
 * setup_app_switcher(). `frappe.ui.create_menu` is also used for unrelated
 * menus (breadcrumbs, workspace, sidebar items), and the parent element
 * differs between them, so we do NOT match on a selector. We wrap
 * create_menu and identify the user menu structurally: it is the only one
 * carrying an item named "logout". Our items are spliced in just above the
 * divider that precedes it, so Logout stays last.
 */
(function () {
  "use strict";

  const registry = [];
  let wrapped = false;

  function buildItems() {
    // Re-read on every open so labels follow a language change.
    return registry.map((entry) => ({
      name: entry.name,
      label: typeof entry.label === "function" ? entry.label() : entry.label,
      icon: entry.icon,
      onClick: entry.onClick,
    }));
  }

  function isLogoutItem(item) {
    if (!item) return false;
    if (item.name === "logout") return true;
    // v16.32's sidebar user menu builds its items with a `label` only -- no
    // `name` -- so fall back to matching the label. Resolve "Logout" through
    // __() so this still matches on a translated Desk, and keep the English
    // spellings as a backstop for locales where the string is untranslated.
    const label = String(item.label || "").trim().toLowerCase();
    if (!label) return false;
    const translated = String(
      typeof __ === "function" ? __("Logout") : "Logout"
    ).trim().toLowerCase();
    return label === translated || label === "logout" || label === "log out";
  }

  function isUserMenu(items) {
    return Array.isArray(items) && items.some(isLogoutItem);
  }

  function withOurItems(items) {
    // Guard against double-injection if create_menu is wrapped more than once
    // or the same opts object is reused across re-renders.
    const names = new Set(registry.map((entry) => entry.name));
    const next = items.filter((item) => !(item && names.has(item.name)));

    const logoutIndex = next.findIndex(isLogoutItem);
    if (logoutIndex === -1) return next;

    // Where Frappe puts a divider immediately before Logout, insert above it so
    // our items group with the rest rather than with Logout. v16.32's menu has
    // no divider, in which case we simply land directly above Logout.
    const prev = next[logoutIndex - 1];
    const insertAt = prev && prev.is_divider ? logoutIndex - 1 : logoutIndex;

    return [
      ...next.slice(0, insertAt),
      ...buildItems(),
      ...next.slice(insertAt),
    ];
  }

  function installHook() {
    if (wrapped) return true;
    if (!window.frappe || !frappe.ui || typeof frappe.ui.create_menu !== "function") {
      return false;
    }

    const original = frappe.ui.create_menu;
    frappe.ui.create_menu = function (opts) {
      try {
        if (opts && isUserMenu(opts.menu_items) && registry.length) {
          opts = Object.assign({}, opts, {
            menu_items: withOurItems(opts.menu_items),
          });
        }
      } catch (err) {
        // A failure here must never stop the Desk from rendering its own menu.
        console.error("Finstein Theme: failed to extend the user menu", err);
      }
      return original.apply(this, [opts].concat([].slice.call(arguments, 1)));
    };
    frappe.ui.create_menu.__finstein_theme_wrapped = true;

    wrapped = true;
    return true;
  }

  /**
   * Register an item for the Desk user menu.
   * @param {{name: string, label: string|function, icon: string, onClick: function}} item
   *        `icon` is a lucide icon name (frappe/public/icons/lucide/icons.svg).
   */
  function addUserMenuItem(item) {
    if (!item || !item.name) return;
    const existing = registry.findIndex((entry) => entry.name === item.name);
    if (existing !== -1) {
      registry[existing] = item;
    } else {
      registry.push(item);
    }
    installHook();
  }

  // ---------------------------------------------------------------------
  // Quick-access buttons
  //
  // v16 splits the Desk chrome across two containers that are never both on
  // screen: `header.desktop-navbar` (which holds the bell) exists only on the
  // /desk home screen, while `.body-sidebar` covers every other route. To get
  // a one-click entry point everywhere we inject into whichever is present,
  // and re-check on SPA route changes because both are re-rendered.
  // ---------------------------------------------------------------------

  const quickActions = [];

  function icon(name) {
    return `<svg class="icon icon-md" aria-hidden="true"><use href="#icon-${name}"></use></svg>`;
  }

  function label(entry) {
    return typeof entry.label === "function" ? entry.label() : entry.label;
  }

  function injectNavbar(entry) {
    const bar = document.querySelector("header.desktop-navbar > .flex");
    if (!bar) return;
    const cls = "finstein-theme-quick-" + entry.name;
    if (bar.querySelector("." + cls)) return;

    const wrap = document.createElement("div");
    wrap.className = "finstein-theme-quick " + cls;
    const btn = document.createElement("button");
    // Same classes the bell uses, so we inherit the Desk's own button styling.
    btn.className = "btn-reset nav-link text-muted";
    btn.setAttribute("aria-label", label(entry));
    btn.setAttribute("title", label(entry));
    btn.innerHTML = icon(entry.icon);
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      entry.onClick();
    });
    wrap.appendChild(btn);

    // Sit to the left of the notifications bell.
    const bell = bar.querySelector(".desktop-notifications");
    if (bell) bar.insertBefore(wrap, bell);
    else bar.appendChild(wrap);
  }

  function injectSidebar(entry) {
    const bottom = document.querySelector(".body-sidebar-bottom");
    if (!bottom) return;
    const cls = "finstein-theme-side-" + entry.name;
    if (bottom.querySelector("." + cls)) return;

    // Mirror the markup of the "Getting Started" row so it reads as native.
    const row = document.createElement("p");
    row.className = "finstein-theme-side-row";
    const a = document.createElement("a");
    a.className = "onboarding-sidebar px-2 " + cls;
    a.style.cursor = "pointer";
    a.innerHTML = icon(entry.icon) + " <span>" + label(entry) + "</span>";
    a.addEventListener("click", (e) => {
      e.preventDefault();
      entry.onClick();
    });
    row.appendChild(a);

    const onboarding = bottom.querySelector("p:has(.onboarding-sidebar)");
    if (onboarding && onboarding.parentElement === bottom) {
      bottom.insertBefore(row, onboarding.nextSibling);
    } else {
      bottom.insertBefore(row, bottom.firstChild);
    }
  }

  function refreshQuickActions() {
    for (const entry of quickActions) {
      try {
        injectNavbar(entry);
        injectSidebar(entry);
      } catch (err) {
        console.error("Finstein Theme: quick action injection failed", entry.name, err);
      }
    }
  }

  let observing = false;
  function watchForContainers() {
    if (observing || !document.body) return;
    observing = true;
    // Both containers are re-rendered on navigation; a debounced observer keeps
    // the buttons present without polling forever.
    let pending = null;
    new MutationObserver(() => {
      if (pending) return;
      pending = setTimeout(() => {
        pending = null;
        refreshQuickActions();
      }, 150);
    }).observe(document.body, { childList: true, subtree: true });
  }

  /**
   * Register a one-click Desk button (navbar on /desk, sidebar elsewhere).
   * @param {{name: string, label: string|function, icon: string, onClick: function}} entry
   */
  function addQuickAction(entry) {
    if (!entry || !entry.name) return;
    const at = quickActions.findIndex((e) => e.name === entry.name);
    if (at !== -1) quickActions[at] = entry;
    else quickActions.push(entry);

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        watchForContainers();
        refreshQuickActions();
      });
    } else {
      watchForContainers();
      refreshQuickActions();
    }
  }

  window.finstein_theme = window.finstein_theme || {};
  window.finstein_theme.addUserMenuItem = addUserMenuItem;
  window.finstein_theme.addQuickAction = addQuickAction;

  // Install at parse time, NOT on frappe.ready. app_include_js is emitted near
  // the end of desk.html (v16.32 line 65) and runs while the document is still
  // parsing, whereas the Desk constructs the sidebar -- and with it the user
  // menu -- on DOM ready (frappe/public/js/frappe/desk.js:90). Wrapping now
  // guarantees we are in place before that first create_menu call; deferring to
  // frappe.ready would race it and the items would silently never appear.
  // The registering bundles likewise call addUserMenuItem at parse time.
  if (!installHook()) {
    // The desk bundle should already have defined frappe.ui.create_menu by the
    // time we parse. If it somehow has not, fall back to polling.
    let attempts = 0;
    const retry = () => {
      if (installHook()) return;
      if (attempts++ < 40) setTimeout(retry, 250);
    };
    retry();
  }
})();
