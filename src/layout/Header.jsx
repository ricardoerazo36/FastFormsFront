import React from "react";
import "./Header.css";
import { Link, useNavigate } from "react-router-dom";
import { useAtom } from "jotai";
import { userAtom } from "../stores/authAtom";
import { supabase } from "../lib/supabaseClient";
import ThemeToggle from "../components/ThemeToggle";

const Header = () => {
  const [user, setUser] = useAtom(userAtom);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      navigate("/register");
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  return (
    <header className="site-header">
      <Link to="/" className="header-left">
        <div className="logo-icon">⚡</div>
        <h1 className="site-title">Fast Forms</h1>
      </Link>

      <nav className="header-center">
        {user && (
          <Link to="/dashboard" className="dashboard-link">
            Dashboard
          </Link>
        )}
      </nav>

      <div className="header-right">
        <ThemeToggle />
        {user ? (
          <>
            <span className="user-name">{user.email.split("@")[0]}</span>
            <button className="logout-btn" onClick={handleLogout}>
              Cerrar sesión
            </button>
          </>
        ) : (
          <>
            <Link className="login-link" to="/login">
              Iniciar sesión
            </Link>

            <Link className="register-btn" to="/register">
              Registrarse
            </Link>
          </>
        )}
      </div>
    </header>
  );
};

export default Header;
