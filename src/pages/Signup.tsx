import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AudioLines, User, Mail, Lock } from "lucide-react";
import { registerUser } from "../services/api";

function Signup() {
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (username.trim().length < 3) {
      setError("Username must contain at least 3 characters.");
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) {
      setError("Username can contain only letters, numbers and underscore.");
      return;
    }

    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setError("Password must contain at least 8 characters, one letter and one number.");
      return;
    }

    try {
      setLoading(true);

      await registerUser(
        username,
        email,
        password,
        displayName
      );

      navigate("/dashboard");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Registration failed."
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
          Proxi<span className="gradient-text">Speak</span>
        </div>

        <p>
          Already registered?
          <Link to="/login"> Sign In</Link>
        </p>
      </nav>

      <div className="auth-container">
        <div className="auth-visual">
          <div className="visual-circle">
            <AudioLines size={80} />
          </div>

          <h1>
            Your World. Your <span className="gradient-text">People.</span>
          </h1>

          <p>
            Join ProxiSpeak and discover meaningful conversations around you.
          </p>
        </div>

        <div className="auth-card">
          <span className="welcome-label">GET STARTED</span>

          <h2>Create your account</h2>

          <p className="auth-description">
            Join the ProxiSpeak community today.
          </p>

          <form onSubmit={handleSignup}>
            <label>Full Name</label>

            <div className="input-wrapper">
              <User size={19} />
              <input
                type="text"
                placeholder="Your full name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                maxLength={40}
              />
            </div>

            <label>Username</label>

            <div className="input-wrapper">
              <User size={19} />
              <input
                type="text"
                placeholder="Choose a username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={3}
                maxLength={24}
              />
            </div>

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
                type="password"
                placeholder="Create password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                maxLength={72}
              />
            </div>

            {error && (
              <p style={{ color: "#ff6464", marginTop: "12px" }}>
                {error}
              </p>
            )}

            <button
              className="auth-submit"
              type="submit"
              disabled={loading}
            >
              {loading ? "Creating Account..." : "Create Account"}
            </button>
          </form>

          <div className="auth-footer">
            Already have an account?
            <Link to="/login"> Sign In</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Signup;