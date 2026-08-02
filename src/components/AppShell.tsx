import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { ButtonLink } from "@/components/ui";
import { NotificationBell } from "@/components/NotificationBell";
import { BRAND } from "@/lib/brand";

export function AppShell() {
  const { user, logout, ready } = useAuth();

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="shell header-inner">
          <NavLink to={user ? "/dashboard" : "/"} className="brand" end>
            <img
              className="brand-mark"
              src="/logo.png"
              alt=""
              width={44}
              height={44}
              decoding="async"
            />
            <span className="brand-text">
              <strong>{BRAND.name}</strong>
              <span>{user ? user.name : BRAND.tagline}</span>
            </span>
          </NavLink>

          <nav className="nav-links" aria-label="Primary">
            {ready && user ? (
              <>
                <NavLink to="/dashboard">Home</NavLink>
                <NavLink to="/request">Emergency</NavLink>
                <NavLink to="/donor">Be a donor</NavLink>
                <NavLink to="/donors">Our Donors</NavLink>
                <NavLink to="/history">History</NavLink>
                <NotificationBell />
                <NavLink to="/profile">Profile</NavLink>
                <button type="button" className="linkish" onClick={() => void logout()}>
                  Logout
                </button>
              </>
            ) : (
              <>
                <NavLink to="/donors">Our Donors</NavLink>
                <NavLink to="/login">Login</NavLink>
                <ButtonLink to="/login?mode=register" variant="primary">
                  Join
                </ButtonLink>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="shell footer-inner">
          <p>
            <strong style={{ color: "var(--ink)", fontFamily: "var(--display)" }}>
              {BRAND.name}
            </strong>{" "}
            · AI blood emergency seva
          </p>
          <p>Coordination support — always confirm with the blood bank.</p>
        </div>
      </footer>
    </div>
  );
}
