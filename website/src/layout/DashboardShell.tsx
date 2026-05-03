import React, { useState, useEffect, ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getUser, logout, initials, colorFromString } from "../api";
import LiveBadge from "../LiveBadge";

/**
 * Shared dashboard layout:
 *  - Fixed left sidebar with DocVault brand, nav items, and user footer
 *  - White background + accent #3801FF
 *  - Fully responsive: on screens < 900px, sidebar collapses and is toggled
 *    via a hamburger button in the top bar.
 *
 * Use across ClientHome / AdminHome / SuperAdminDashboard.
 */

export type NavItem = {
  to: string;
  label: string;
  icon: ReactNode;
  /** Optional match predicate; default matches pathname startsWith(to) */
  matches?: (pathname: string) => boolean;
  /** Called instead of navigation (e.g. to open a modal, trigger logout etc.) */
  onPress?: () => void;
  /** Visual only (non-link rendering) */
  variant?: "default" | "danger";
  /** Right-side badge, e.g. count */
  badge?: string | number;
};

type Props = {
  role: "client" | "admin" | "superadmin";
  /** Short title shown at top of sidebar (e.g. "Client Console") */
  title: string;
  /** Main nav items */
  nav: NavItem[];
  /** Optional right-side toolbar items (next to LiveBadge) */
  toolbar?: ReactNode;
  /** Heading shown above children, optional */
  pageTitle?: string;
  pageSubtitle?: string;
  /** Action button/element on the right side of the page title row */
  headerAction?: ReactNode;
  children: ReactNode;
};

export default function DashboardShell({
  role,
  title,
  nav,
  toolbar,
  pageTitle,
  pageSubtitle,
  headerAction,
  children,
}: Props) {
  const nav_hook = useNavigate();
  const loc = useLocation();
  const me = getUser();
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState<boolean>(
    typeof window !== "undefined" ? window.innerWidth < 900 : false,
  );

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 900;
      setIsMobile(mobile);
      if (!mobile) setOpen(false); // reset drawer when desktop
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Close drawer on route change (mobile)
  useEffect(() => {
    setOpen(false);
  }, [loc.pathname]);

  const onLogout = () => {
    logout();
    nav_hook("/", { replace: true });
  };

  const isActive = (item: NavItem): boolean => {
    if (item.matches) return item.matches(loc.pathname);
    return loc.pathname === item.to || loc.pathname.startsWith(item.to + "/");
  };

  const roleLabel =
    role === "superadmin" ? "Super Admin" : role === "admin" ? "Admin" : "Client";

  // --- Sidebar content (used in both fixed desktop rail AND mobile drawer) ---
  const sidebarInner = (
    <>
      <div className="ds-brand">
        <img
          src="/api/web/favicon.png"
          alt="DocVault"
          className="ds-brand-logo"
        />
        <div className="ds-brand-text">
          <div className="ds-brand-name">DocVault</div>
          <div className="ds-brand-sub">{title}</div>
        </div>
      </div>

      <nav className="ds-nav">
        {nav.map((item) => {
          const active = isActive(item);
          const cls = `ds-nav-item ${active ? "active" : ""} ${
            item.variant === "danger" ? "danger" : ""
          }`;
          if (item.onPress) {
            return (
              <button
                key={item.to}
                type="button"
                className={cls}
                onClick={item.onPress}
              >
                <span className="ds-nav-icon">{item.icon}</span>
                <span className="ds-nav-label">{item.label}</span>
                {item.badge !== undefined && (
                  <span className="ds-nav-badge">{item.badge}</span>
                )}
              </button>
            );
          }
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cls}
            >
              <span className="ds-nav-icon">{item.icon}</span>
              <span className="ds-nav-label">{item.label}</span>
              {item.badge !== undefined && (
                <span className="ds-nav-badge">{item.badge}</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="ds-foot">
        <div className="ds-user">
          <div
            className="ds-user-avatar"
            style={{ background: me ? colorFromString(me.id) : "#3801FF" }}
          >
            {me ? initials(me.name) : "?"}
          </div>
          <div className="ds-user-meta">
            <div className="ds-user-name">{me?.name || "User"}</div>
            <div className="ds-user-role">{roleLabel}</div>
          </div>
        </div>
        <button className="ds-logout" onClick={onLogout} title="Log out">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span>Log out</span>
        </button>
      </div>
    </>
  );

  return (
    <div className={`ds-shell ${isMobile ? "mobile" : ""}`}>
      {/* Desktop fixed rail */}
      {!isMobile && <aside className="ds-rail">{sidebarInner}</aside>}

      {/* Mobile overlay drawer */}
      {isMobile && open && (
        <>
          <div
            className="ds-drawer-backdrop"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside className="ds-rail drawer">{sidebarInner}</aside>
        </>
      )}

      <main className="ds-main">
        <header className="ds-topbar">
          {isMobile && (
            <button
              className="ds-hamburger"
              onClick={() => setOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              <span />
              <span />
              <span />
            </button>
          )}
          <div className="ds-topbar-title">
            {isMobile ? title : pageTitle || title}
          </div>
          <div className="ds-topbar-actions">
            <LiveBadge />
            {toolbar}
          </div>
        </header>

        <div className="ds-page">
          {(pageTitle || pageSubtitle || headerAction) && !isMobile && (
            <div className="ds-page-head">
              <div>
                {pageTitle && <h1 className="ds-page-title">{pageTitle}</h1>}
                {pageSubtitle && <p className="ds-page-sub">{pageSubtitle}</p>}
              </div>
              {headerAction && <div className="ds-page-action">{headerAction}</div>}
            </div>
          )}
          {isMobile && (pageTitle || pageSubtitle || headerAction) && (
            <div className="ds-page-head mobile">
              <div>
                {pageTitle && <h1 className="ds-page-title">{pageTitle}</h1>}
                {pageSubtitle && <p className="ds-page-sub">{pageSubtitle}</p>}
              </div>
              {headerAction && (
                <div className="ds-page-action mobile">{headerAction}</div>
              )}
            </div>
          )}

          <div className="ds-page-body">{children}</div>
        </div>
      </main>
    </div>
  );
}
