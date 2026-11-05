import { useEffect, useState } from "react";

import {
  Users,
  Headphones,
  Radio,
  MapPin,
  ArrowUpRight,
  Activity,
  Compass,
  RefreshCw,
} from "lucide-react";

import {
  getCurrentUser,
  getNearbyUsers,
  getActiveRooms,
  getBackendHealth,
  type DashboardUser,
} from "../services/api";

function Dashboard() {
  const [user, setUser] = useState<DashboardUser | null>(null);

  const [nearbyCount, setNearbyCount] = useState(0);
  const [roomCount, setRoomCount] = useState(0);

  const [backendStatus, setBackendStatus] = useState("Checking...");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = async () => {
    setLoading(true);
    setError("");

    const results = await Promise.allSettled([
      getCurrentUser(),
      getNearbyUsers(),
      getActiveRooms(),
      getBackendHealth(),
    ]);

    if (results[0].status === "fulfilled") {
      setUser(results[0].value.user);
    }

    if (results[1].status === "fulfilled") {
      setNearbyCount(results[1].value.users.length);
    }

    if (results[2].status === "fulfilled") {
      setRoomCount(results[2].value.rooms.length);
    }

    if (results[3].status === "fulfilled") {
      setBackendStatus(
        results[3].value.status === "ok" ? "Online" : "Unavailable"
      );
    } else {
      setBackendStatus("Offline");
    }

    const failedRequests = results
  .map((result, index) => {
    if (result.status === "rejected") {
      const names = ["Current User", "Nearby Users", "Active Rooms", "Backend Health"];

      return `${names[index]}: ${
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason)
      }`;
    }

    return null;
  })
  .filter(Boolean);

if (failedRequests.length > 0) {
  setError(failedRequests.join(" | "));
}

    setLoading(false);
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const currentDate = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="app-container">
      <div className="page-container">

        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "40px",
            flexWrap: "wrap",
            gap: "20px",
          }}
        >
          <div>
            <p style={{ color: "#9ca3af" }}>
              {currentDate}
            </p>

            <h1 style={{ fontSize: "32px", marginTop: "10px" }}>
              Welcome,{" "}
              <span className="gradient-text">
                {user?.displayName || user?.username || "User"}
              </span>
            </h1>

            <p style={{ color: "#9ca3af", marginTop: "10px" }}>
              Your world is closer than you think.
            </p>
          </div>

          <div
            className="glass-card"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Activity
              size={18}
              color={backendStatus === "Online" ? "#34d399" : "#f87171"}
            />

            <span>Backend: {backendStatus}</span>
          </div>
        </header>

        {error && (
          <div className="glass-card" style={{ marginBottom: "20px" }}>
            <p>{error}</p>

            <button
              className="primary-btn"
              onClick={loadDashboard}
              style={{ marginTop: "12px" }}
            >
              <RefreshCw size={16} /> Retry
            </button>
          </div>
        )}

        <div className="dashboard-grid">

          <div className="glass-card">
            <Users color="#a78bfa" size={28} />

            <h2>{loading ? "..." : nearbyCount}</h2>

            <p>Nearby Users</p>
          </div>

          <div className="glass-card">
            <Headphones color="#60a5fa" size={28} />

            <h2>{loading ? "..." : user ? "Active" : "—"}</h2>

            <p>Account Status</p>
          </div>

          <div className="glass-card">
            <Radio color="#34d399" size={28} />

            <h2>{loading ? "..." : roomCount}</h2>

            <p>Active Rooms</p>
          </div>

          <div className="glass-card">
            <MapPin color="#fbbf24" size={28} />

            <h2>Explore</h2>

            <p>Location Status</p>
          </div>

        </div>

        <div className="dashboard-main">

          <section className="glass-card">
            <h2>Discover Nearby People</h2>

            <p>
              Find people around you and start conversations.
            </p>

            <button
              className="primary-btn"
              onClick={() => (window.location.href = "/explore")}
            >
              Explore People <ArrowUpRight size={16} />
            </button>
          </section>

          <section className="glass-card">
            <Compass size={30} color="#a78bfa" />

            <h2>Spatial Audio Rooms</h2>

            <p>
              Join conversations happening around you.
            </p>

            <button
              className="primary-btn"
              onClick={() => (window.location.href = "/audio-rooms")}
            >
              Explore Rooms
            </button>
          </section>

        </div>

        <div style={{ marginTop: "25px" }}>
          <button
            className="primary-btn"
            onClick={loadDashboard}
            disabled={loading}
          >
            <RefreshCw size={16} />
            {loading ? "Refreshing..." : "Refresh Dashboard"}
          </button>
        </div>

      </div>
    </div>
  );
}

export default Dashboard;