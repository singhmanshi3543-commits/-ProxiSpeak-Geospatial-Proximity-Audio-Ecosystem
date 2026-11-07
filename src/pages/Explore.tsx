import VirtualOffice from "../components/dashboard/VirtualOffice";
import LocationStatus from "../components/dashboard/LocationStatus";
import { useState } from "react";

import {
  MapPin,
  Radio,
  Users,
  Navigation,
  LocateFixed,
  Loader2
} from "lucide-react";

import {
  getCurrentLocation,
  updateUserLocation,
  getNearbyUsers,
  type UserLocation,
  type NearbyUser
} from "../services/locationService";

function Explore() {

  const [location, setLocation] =
    useState<UserLocation | null>(null);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const [nearbyUsers, setNearbyUsers] = useState<NearbyUser[]>([]);
const [radius, setRadius] = useState(100);

const handleLocation = async () => {
  setLoading(true);
  setError("");

  try {
    const currentLocation = await getCurrentLocation();

    await updateUserLocation(currentLocation);

    setLocation(currentLocation);

    const result = await getNearbyUsers();
    setNearbyUsers(result.users);
    setRadius(result.radiusMeters);
  } catch (err) {
    setError(
      err instanceof Error ? err.message : "Unable to access location."
    );
  } finally {
    setLoading(false);
  }
};

  return (

    <div className="page-container">
      <VirtualOffice />
      <LocationStatus />

      <div className="page-heading">

        <div>
          <span className="welcome-label">
            DISCOVER
          </span>

          <h1>
            Explore <span className="gradient-text">Nearby</span>
          </h1>

          <p>
            Discover people and conversations around you.
          </p>
        </div>

        <button
          className="primary-btn"
          onClick={handleLocation}
          disabled={loading}
        >

          {loading
            ? <Loader2 className="spin" size={18} />
            : <LocateFixed size={18} />
          }

          {loading ? "Locating..." : "Enable Location"}

        </button>

      </div>

      <div className="explore-grid">

        <div className="glass-card explore-map">

          <MapPin size={45} color="#a78bfa" />

          <h2>Proximity Discovery</h2>

          <p>
            Discover users based on their geographic location.
          </p>

          <div className="radar-circle">
            <Radio size={30} />
          </div>

          {location ? (

            <div className="location-details">

              <h3>Location Connected</h3>

              <p>
                Latitude: {location.latitude.toFixed(6)}
              </p>

              <p>
                Longitude: {location.longitude.toFixed(6)}
              </p>

              <p>
                Accuracy: ±`${(location.accuracy ?? 0).toFixed(1)} meters`
              </p>

            </div>

          ) : (

            <span>Location not connected</span>

          )}

          {error && (
            <p className="location-error">
              {error}
            </p>
          )}

        </div>

        <div className="glass-card explore-info">

          <h2>Discovery Overview</h2>

          <div className="explore-stat">

            <Users size={22} />

            <div>
              <strong>Nearby Users</strong>
              <p>
                {location
                  ? "Location available – waiting for backend discovery"
                  : "Enable location first"}
              </p>
            </div>

          </div>

          <div className="explore-stat">

            <Radio size={22} />

            <div>
              <strong>Location Status</strong>
              <p>
                {location ? "Connected" : "Disconnected"}
              </p>
            </div>

          </div>

          <div className="explore-stat">

            <Navigation size={22} />

            <div>
              <strong>GPS Accuracy</strong>
              <p>
                {location
                  ? `${(location.accuracy ?? 0).toFixed(1)} meters`
                  : "Not available"}
              </p>
            </div>

          </div>

        </div>

      </div>

      <div className="glass-card" style={{ marginTop: "24px", padding: "24px" }}>
  <h2>Nearby People</h2>
  <p>Discovery radius: {radius} meters</p>

  {nearbyUsers.length === 0 ? (
    <p>No nearby users found. Ask another registered user to enable location.</p>
  ) : (
    nearbyUsers.map((user, index) => (
      <div key={user._id || index} style={{ padding: "12px 0" }}>
        <strong>
          {user.displayName || user.username || "ProxiSpeak User"}
        </strong>
        <p>
          Distance: {user.distanceMeters ?? user.distance ?? "N/A"} meters
        </p>
      </div>
    ))
  )}
</div>

    </div>

  );
}

export default Explore;