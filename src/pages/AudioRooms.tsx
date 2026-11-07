import { useEffect, useState } from "react";
import { Users, Radio, Plus, LogOut, RefreshCw } from "lucide-react";
import {
  getRooms,
  createRoom,
  joinRoom,
  leaveRoom,
  type Room,
} from "../services/api";

export default function AudioRooms() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomName, setRoomName] = useState("");
  const [maxParticipants, setMaxParticipants] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadRooms() {
    setLoading(true);
    setError("");

    try {
      const result = await getRooms();
      setRooms(result.rooms);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load rooms"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRooms();
  }, []);

  async function handleCreateRoom(e: React.FormEvent) {
    e.preventDefault();

    if (!roomName.trim()) {
      setError("Please enter a room name");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      await createRoom(roomName.trim(), maxParticipants);
      setRoomName("");
      setMessage("Room created successfully!");
      await loadRooms();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to create room"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin(roomId: string) {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      await joinRoom(roomId);
      setMessage("Successfully joined the room!");
      await loadRooms();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to join room"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleLeave(roomId: string) {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      await leaveRoom(roomId);
      setMessage("You left the room.");
      await loadRooms();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to leave room"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-container">
      <div className="page-heading">
        <div>
          <span className="welcome-label">PROXISPEAK</span>
          <h1>Audio Rooms</h1>
          <p>Discover and join conversations around you.</p>
        </div>

        <button
          className="primary-btn"
          onClick={loadRooms}
          disabled={loading}
        >
          <RefreshCw size={18} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="glass-card" style={{ padding: 15, marginBottom: 15 }}>
          {error}
        </div>
      )}

      {message && (
        <div className="glass-card" style={{ padding: 15, marginBottom: 15 }}>
          {message}
        </div>
      )}

      <div className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
        <h2>
          <Plus size={20} /> Create Audio Room
        </h2>

        <form onSubmit={handleCreateRoom}>
          <input
            type="text"
            placeholder="Enter room name"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            maxLength={60}
            required
            style={{
              padding: 12,
              width: "100%",
              margin: "15px 0",
              borderRadius: 8,
            }}
          />

          <label>
            Maximum participants:
            <select
              value={maxParticipants}
              onChange={(e) => setMaxParticipants(Number(e.target.value))}
              style={{ marginLeft: 12, padding: 8 }}
            >
              {[2, 5, 10, 15, 20].map((number) => (
                <option key={number} value={number}>
                  {number}
                </option>
              ))}
            </select>
          </label>

          <br />

          <button
            className="primary-btn"
            type="submit"
            disabled={loading}
            style={{ marginTop: 18 }}
          >
            <Plus size={18} />
            Create Room
          </button>
        </form>
      </div>

      <div className="glass-card" style={{ padding: 24 }}>
        <h2>
          <Radio size={22} /> Nearby Audio Rooms
        </h2>

        {loading && <p>Loading rooms...</p>}

        {!loading && rooms.length === 0 && (
          <p style={{ marginTop: 20 }}>
            No nearby rooms found. Create the first room!
          </p>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 18,
            marginTop: 20,
          }}
        >
          {rooms.map((room) => (
            <div
              key={room.id}
              className="glass-card"
              style={{ padding: 20 }}
            >
              <Radio size={28} />

              <h3 style={{ margin: "12px 0" }}>{room.name}</h3>

              <p>
                <Users size={16} />{" "}
                {room.participantCount ?? 0}/{room.maxParticipants} members
              </p>

              <p style={{ marginTop: 8 }}>
                Distance: {room.distanceMeters ?? "N/A"} meters
              </p>

              {room.isMember ? (
                <button
                  className="primary-btn"
                  onClick={() => handleLeave(room.id)}
                  disabled={loading}
                  style={{ marginTop: 15 }}
                >
                  <LogOut size={16} />
                  Leave Room
                </button>
              ) : (
                <button
                  className="primary-btn"
                  onClick={() => handleJoin(room.id)}
                  disabled={loading}
                  style={{ marginTop: 15 }}
                >
                  Join Room
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}