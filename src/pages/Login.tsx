import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AudioLines,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
} from "lucide-react";
import { loginUser } from "../services/api";

function Login() {
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please enter email and password.");
      return;
    }

    try {
      setLoading(true);

      await loginUser(email.trim(), password);

      navigate("/dashboard");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to login."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <nav className="auth-navbar">
        <div className="brand">
          <AudioLines size={30} />
          <span>
            Proxi<span className="gradient-text">Speak</span>
          </span>
        </div>

        <p>
          Don't have an account?
          <Link to="/signup"> Sign Up</Link>
        </p>
      </nav>

      <div className="auth-container">
        <div className="auth-visual">
          <div className="visual-circle">
            <AudioLines size={90} />
          </div>

          <h1>
            Connect Beyond <span className="gradient-text">Distance.</span>
          </h1>

          <p>
            Discover people around you and experience
            conversations powered by spatial audio.
          </p>

          <div className="visual-tags">
            <span>Real-time Audio</span>
            <span>Location Discovery</span>
          </div>
        </div>

        <div className="auth-card">
          <span className="welcome-label">WELCOME BACK</span>

          <h2>Sign in to your account</h2>

          <p className="auth-description">
            Enter your details to continue your journey.
          </p>

          <form onSubmit={handleLogin}>
            <label>Email Address</label>

            <div className="input-wrapper">
              <Mail size={19} />
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <label>Password</label>

            <div className="input-wrapper">
              <Lock size={19} />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>

            {error && (
              <p style={{ color: "#ff6464", marginTop: "12px" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              className="auth-submit"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign In"}
              {!loading && <ArrowRight size={19} />}
            </button>
          </form>

          <div className="auth-footer">
            New to ProxiSpeak?
            <Link to="/signup"> Create an account</Link>
          </div>
        </div>
      </div>

      <footer className="auth-bottom">
        © 2026 ProxiSpeak. Connecting people, naturally.
      </footer>
    </div>
  );
}

export default Login;