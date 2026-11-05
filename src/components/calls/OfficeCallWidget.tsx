import { useEffect, useState } from "react";
import { getNearbyUsers } from "../../services/locationService";
import type { NearbyUser } from "../../services/locationService";
import CallPanel from "./CallPanel";
import "./OfficeCallWidget.css";

export default function OfficeCallWidget() {
  const [users, setUsers] = useState<NearbyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedUser, setSelectedUser] =
    useState<NearbyUser | null>(null);

  const [callType, setCallType] =
    useState<"voice" | "video">("voice");

  async function loadUsers() {
    try {
      setLoading(true);
      setError("");

      const response = await getNearbyUsers();

      setUsers(response.users || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load employees."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  function startCall(
    user: NearbyUser,
    type: "voice" | "video"
  ) {
    setSelectedUser(user);
    setCallType(type);
  }

  function getName(user: NearbyUser) {
    return (
      user.displayName ||
      user.username ||
      "Employee"
    );
  }

  const selectedUserId = selectedUser
    ? selectedUser.id || selectedUser._id || ""
    : "";

  return (
    <>
      <section className="office-call-widget">
        <div className="office-call-heading">
          <div>
            <h3>Office Employees</h3>
            <p>{users.length} nearby employees</p>
          </div>

          <button
            className="office-refresh-button"
            onClick={() => void loadUsers()}
          >
            ↻
          </button>
        </div>

        {loading && (
          <p className="office-call-message">
            Loading employees...
          </p>
        )}

        {!loading && error && (
          <div className="office-call-message office-call-error">
            {error}
            <button onClick={() => void loadUsers()}>
              Retry
            </button>
          </div>
        )}

        {!loading && !error && users.length === 0 && (
          <p className="office-call-message">
            No nearby employees found.
          </p>
        )}

        <div className="office-employee-list">
          {users.map((user) => {
            const userId = user.id || user._id;

            if (!userId) return null;

            return (
              <div className="office-employee" key={userId}>
                <div
                  className="office-employee-avatar"
                  style={{
                    backgroundColor:
                      user.avatarColor || "#5265d8",
                  }}
                >
                  {getName(user).charAt(0).toUpperCase()}
                </div>

                <div className="office-employee-info">
                  <strong>{getName(user)}</strong>

                  <span>
                    {user.distanceMeters != null
                      ? `${Math.round(user.distanceMeters)} m away`
                      : "Nearby"}
                  </span>
                </div>

                <div className="office-employee-actions">
                  <button
                    title="Voice call"
                    onClick={() => startCall(user, "voice")}
                  >
                    📞
                  </button>

                  <button
                    title="Video call"
                    onClick={() => startCall(user, "video")}
                  >
                    🎥
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* IMPORTANT: Always mounted for incoming calls */}
      <CallPanel
        targetUserId={selectedUserId}
        targetName={selectedUser ? getName(selectedUser) : ""}
        initialCallType={callType}
        onClose={() => setSelectedUser(null)}
      />
    </>
  );
}