import { useEffect, useRef, useState } from "react";
import { connectSocket } from "../../services/socket";
import {
  getCurrentLocation,
  updateUserLocation,
} from "../../services/locationService";
import "./VirtualOffice.css";

type Employee = {
  userId: string;
  username: string;
  displayName: string;
  avatarColor: string;
  gender?: "male" | "female";
  x: number;
  y: number;
  room: string;
  online: boolean;
};

const ROOMS = [
  "Boardroom",
  "Auditorium",
  "Meeting Room 1",
  "Meeting Room 2",
  "Focus Pods",
  "Breakroom",
  "Cafeteria",
  "Quiet Zone",
  "Gaming Zone",
  "Wellness Zone",
  "Help Desk",
];

const INITIAL_ROOMS = [
  { name: "Boardroom", x: 3, y: 5, w: 25, h: 23 },
  { name: "Auditorium", x: 35, y: 5, w: 30, h: 23 },
  { name: "Meeting Room 1", x: 70, y: 5, w: 13, h: 23 },
  { name: "Meeting Room 2", x: 84, y: 5, w: 13, h: 23 },
  { name: "Focus Pods", x: 3, y: 34, w: 17, h: 26 },
  { name: "Breakroom", x: 22, y: 34, w: 18, h: 26 },
  { name: "Reception", x: 42, y: 34, w: 20, h: 26 },
  { name: "Cafeteria", x: 65, y: 34, w: 32, h: 26 },
  { name: "Gaming Zone", x: 3, y: 65, w: 27, h: 28 },
  { name: "Quiet Zone", x: 33, y: 65, w: 27, h: 28 },
  { name: "Wellness Zone", x: 63, y: 65, w: 20, h: 28 },
  { name: "Help Desk", x: 85, y: 65, w: 12, h: 28 },
];

export default function VirtualOffice() {
  const socketRef = useRef(connectSocket());
  const mapRef = useRef<HTMLDivElement>(null);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [myId, setMyId] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState("Main Office");
  const [gpsStatus, setGpsStatus] = useState("GPS not enabled");
  const [gpsCoordinates, setGpsCoordinates] = useState("");

  const employeesRef = useRef<Employee[]>([]);
  const gpsWatchRef = useRef<number | null>(null);
  const lastGpsUpdateRef = useRef(0);
  const [activePanel, setActivePanel] = useState("Home");
const [micOn, setMicOn] = useState(false);
const [cameraOn, setCameraOn] = useState(false);
const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
const [chatMessage, setChatMessage] = useState("");
const [messages, setMessages] = useState<
  { text: string; time: string }[]
>([]);

  function updateEmployees(list: Employee[]) {
    employeesRef.current = list;
    setEmployees(list);
  }

  useEffect(() => {
    const socket = socketRef.current;

    const onConnect = () => {
      socket.emit("office:join");
    };

    const onSnapshot = (data: {
  users: Employee[];
  currentUserId: string;
}) => {
  updateEmployees(data.users || []);
  setMyId(data.currentUserId || "");
};

    const onJoined = (employee: Employee) => {
      updateEmployees([
        ...employeesRef.current.filter(
          (item) => item.userId !== employee.userId
        ),
        employee,
      ]);
    };

    const onMoved = (employee: Employee) => {
      updateEmployees(
        employeesRef.current.map((item) =>
          item.userId === employee.userId ? employee : item
        ).some((item) => item.userId === employee.userId)
          ? employeesRef.current.map((item) =>
              item.userId === employee.userId ? employee : item
            )
          : [...employeesRef.current, employee]
      );
    };

    const onLeft = ({ userId }: { userId: string }) => {
      updateEmployees(
        employeesRef.current.filter(
          (item) => item.userId !== userId
        )
      );
    };

    socket.on("connect", onConnect);
    socket.on("office:snapshot", onSnapshot);
    socket.on("office:user-joined", onJoined);
    socket.on("office:user-moved", onMoved);
    socket.on("office:user-left", onLeft);

    if (socket.connected) {
      socket.emit("office:join");
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("office:snapshot", onSnapshot);
      socket.off("office:user-joined", onJoined);
      socket.off("office:user-moved", onMoved);
      socket.off("office:user-left", onLeft);

      if (gpsWatchRef.current !== null) {
        navigator.geolocation.clearWatch(gpsWatchRef.current);
      }
    };
  }, []);

  function moveEmployee(
    userId: string,
    x: number,
    y: number
  ) {
    const socket = socketRef.current;

    const updated = employeesRef.current.map((employee) =>
      employee.userId === userId
        ? {
            ...employee,
            x,
            y,
            room: selectedRoom,
          }
        : employee
    );

    updateEmployees(updated);

    if (userId === myId) {
      socket.emit("office:move", {
        x,
        y,
        room: selectedRoom,
      });
    }
  }

  function handlePointerDown(
    event: React.PointerEvent<HTMLDivElement>,
    employee: Employee
  ) {
    if (employee.userId !== myId) return;

    event.preventDefault();

    setDraggingId(employee.userId);

    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(
    event: React.PointerEvent<HTMLDivElement>
  ) {
    if (!draggingId || !mapRef.current) return;

    const rect = mapRef.current.getBoundingClientRect();

    const x = Math.max(
      2,
      Math.min(98, ((event.clientX - rect.left) / rect.width) * 100)
    );

    const y = Math.max(
      2,
      Math.min(98, ((event.clientY - rect.top) / rect.height) * 100)
    );

    moveEmployee(draggingId, x, y);
  }

  function enableGPS() {
    if (!navigator.geolocation) {
      setGpsStatus("GPS is not supported by this browser.");
      return;
    }

    setGpsStatus("Requesting location permission...");

    gpsWatchRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;

        setGpsStatus(`GPS active • Accuracy ${Math.round(accuracy)}m`);

        setGpsCoordinates(
          `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
        );

        const now = Date.now();

        if (now - lastGpsUpdateRef.current < 15000) return;

        lastGpsUpdateRef.current = now;

        try {
          await updateUserLocation({
            latitude,
            longitude,
            accuracy,
          });
        } catch (error) {
          console.error("GPS update failed:", error);
        }
      },
      (error) => {
        setGpsStatus(error.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      }
    );

    // Initial location request
    void getCurrentLocation().catch((error) => {
      console.error("Initial GPS request failed:", error);
    });
  }

  function enterRoom(room: string) {
    setSelectedRoom(room);

    const me = employeesRef.current.find(
      (employee) => employee.userId === myId
    );

    if (me) {
      socketRef.current.emit("office:move", {
        x: me.x,
        y: me.y,
        room,
      });
    }
  }

  function joinOffice() {
    const socket = socketRef.current;

    if (!socket.connected) {
      socket.connect();
    }

    socket.emit("office:join");
  }
async function toggleMic() {
  try {
    if (!mediaStream) {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      setMediaStream(stream);
      setMicOn(true);
      return;
    }

    const audioTrack = mediaStream.getAudioTracks()[0];

    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setMicOn(audioTrack.enabled);
    }
  } catch (error) {
    alert("Microphone permission nahi mili. Browser settings check karo.");
    console.error(error);
  }
}

async function toggleCamera() {
  try {
    if (!mediaStream) {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
      });

      setMediaStream(stream);
      setCameraOn(true);
      return;
    }

    const videoTrack = mediaStream.getVideoTracks()[0];

    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setCameraOn(videoTrack.enabled);
    } else {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
      });

      stream.getVideoTracks().forEach((track) => {
        mediaStream.addTrack(track);
      });

      setCameraOn(true);
    }
  } catch (error) {
    alert("Camera permission nahi mili. Browser settings check karo.");
    console.error(error);
  }
}

function sendChatMessage() {
  const text = chatMessage.trim();

  if (!text) return;

  setMessages((previous) => [
    ...previous,
    {
      text,
      time: new Date().toLocaleTimeString(),
    },
  ]);

  setChatMessage("");
}

function leaveOffice() {
  mediaStream?.getTracks().forEach((track) => track.stop());
  setMediaStream(null);
  setMicOn(false);
  setCameraOn(false);

  socketRef.current.emit("office:leave");
  socketRef.current.disconnect();

  window.location.href = "/dashboard";
}
  return (
    <div className="proxi-office">
      <header className="office-header">
        <div className="office-brand">
          <div className="office-logo">📍</div>
          <div>
            <h2>ProxiSpeak</h2>
            <span>Geospatial Proximity Audio Ecosystem</span>
          </div>
        </div>

        <nav className="office-navigation">
  <button onClick={() => setActivePanel("Home")}>⌂ Home</button>

  <button onClick={() => setActivePanel("Rooms")}>▦ Rooms</button>

  <button onClick={() => setActivePanel("People")}>♟ People</button>

  <button onClick={() => setActivePanel("Events")}>▣ Events</button>

  <button onClick={() => setActivePanel("Chat")}>☏ Chat</button>
</nav>

        <div className="office-user-status">
          <span className="online-dot" />
          Online
        </div>
      </header>

      <div className="office-workspace">
        <aside className="office-online-panel">
          <h3>
            <span className="online-dot" />
            Online Now ({employees.length})
          </h3>

          {employees.map((employee) => (
            <div
              className="office-online-user"
              key={employee.userId}
            >
              <div
                className="employee-small-avatar"
                style={{
                  background: employee.avatarColor,
                }}
              >
                {employee.displayName.charAt(0).toUpperCase()}
              </div>

              <div>
                <strong>
                  {employee.displayName}
                  {employee.userId === myId ? " (You)" : ""}
                </strong>
                <span>{employee.room}</span>
              </div>
            </div>
          ))}

          {employees.length === 0 && (
            <p className="office-empty">
              Connecting employees...
            </p>
          )}

          <button className="office-reconnect" onClick={joinOffice}>
            Reconnect
          </button>
        </aside>

        <main
          className="office-map"
          ref={mapRef}
          onPointerMove={handlePointerMove}
          onPointerUp={() => setDraggingId(null)}
          onPointerCancel={() => setDraggingId(null)}
        >
          <div className="office-floor">
            {INITIAL_ROOMS.map((room) => (
              <button
                key={room.name}
                className={`office-room ${
                  selectedRoom === room.name ? "selected" : ""
                }`}
                style={{
                  left: `${room.x}%`,
                  top: `${room.y}%`,
                  width: `${room.w}%`,
                  height: `${room.h}%`,
                }}
                onClick={() => enterRoom(room.name)}
              >
                <span className="room-title">
                  {room.name === "Boardroom" && "👥"}
                  {room.name === "Auditorium" && "🎤"}
                  {room.name.includes("Meeting") && "👥"}
                  {room.name === "Focus Pods" && "🎧"}
                  {room.name === "Breakroom" && "☕"}
                  {room.name === "Reception" && "🏢"}
                  {room.name === "Cafeteria" && "🍽️"}
                  {room.name === "Gaming Zone" && "🎮"}
                  {room.name === "Quiet Zone" && "🔇"}
                  {room.name === "Wellness Zone" && "🧘"}
                  {room.name === "Help Desk" && "🎧"}
                  {" "}{room.name}
                </span>

                <div className="room-furniture">
                  {room.name === "Auditorium" ? (
                    <>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div className="auditorium-row" key={i}>
                          {Array.from({ length: 8 }).map((__, j) => (
                            <span key={j} />
                          ))}
                        </div>
                      ))}
                    </>
                  ) : room.name === "Cafeteria" ||
                    room.name === "Boardroom" ? (
                    <>
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div className="furniture-table" key={i}>
                          <span />
                          <span />
                          <span />
                          <span />
                        </div>
                      ))}
                    </>
                  ) : (
                    <>
                      <div className="furniture-sofa" />
                      <div className="furniture-table" />
                      <div className="furniture-plant">🌿</div>
                    </>
                  )}
                </div>
              </button>
            ))}

            <div className="office-main-logo">
              <span>📍</span>
              <strong>ProxiSpeak</strong>
              <small>Virtual Workspace</small>
            </div>

            {employees.map((employee) => (
              <div
                key={employee.userId}
                className={`office-avatar ${
                  employee.userId === myId ? "my-avatar" : ""
                } ${
                  draggingId === employee.userId ? "dragging" : ""
                }`}
                style={{
                  left: `${employee.x}%`,
                  top: `${employee.y}%`,
                  background: employee.avatarColor,
                }}
                onPointerDown={(event) =>
                  handlePointerDown(event, employee)
                }
                title={`${employee.displayName} — ${employee.room}`}
              >
                <span>
                  {employee.displayName.charAt(0).toUpperCase()}
                </span>

                <small>{employee.displayName}</small>
              </div>
            ))}
          </div>
        </main>
        {activePanel !== "Home" && (
  <div className="office-feature-panel">
    <button
      className="panel-close"
      onClick={() => setActivePanel("Home")}
    >
      ✕
    </button>

    <h2>{activePanel}</h2>

    {activePanel === "People" && (
  <div className="people-list">
    {employees.map((employee) => (
      <div className="people-card" key={employee.userId}>
        <div
          className="people-avatar"
          style={{ background: employee.avatarColor || "#6366f1" }}
        >
          {employee.displayName?.charAt(0).toUpperCase() || "U"}
        </div>

        <div className="people-details">
          <strong>
            {employee.displayName || employee.username}
            {employee.userId === myId && " (You)"}
          </strong>

          <span>{employee.room || "Main Office"}</span>

          <small>
            <span className="people-status-dot" />
            {employee.online ? "Online" : "Offline"}
          </small>
        </div>
      </div>
    ))}

    {employees.length === 0 && <p>No employees online.</p>}
  </div>
)}

    {activePanel === "Events" && (
      <div>
        <h3>Office Events</h3>
        <p>📅 Team Meeting</p>
        <p>📅 Project Discussion</p>
        <p>📅 Daily Standup</p>
      </div>
    )}

    {activePanel === "Rooms" && (
      <div>
        {ROOMS.map((room) => (
          <button
            key={room}
            onClick={() => {
              enterRoom(room);
              setActivePanel("Home");
            }}
          >
            {room}
          </button>
        ))}
      </div>
    )}

    {activePanel === "Chat" && (
      <div className="office-chat">
        <div className="chat-messages">
          {messages.map((message, index) => (
            <div key={index} className="chat-message">
              <p>{message.text}</p>
              <small>{message.time}</small>
            </div>
          ))}
        </div>

        <div className="chat-input">
          <input
            value={chatMessage}
            onChange={(event) => setChatMessage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") sendChatMessage();
            }}
            placeholder="Type a message..."
          />

          <button onClick={sendChatMessage}>Send</button>
        </div>
      </div>
    )}
  </div>
)}

        <aside className="office-minimap">
          <h3>Office Map</h3>

          <div className="mini-map-grid">
            {employees.map((employee) => (
              <span
                key={employee.userId}
                style={{
                  left: `${employee.x}%`,
                  top: `${employee.y}%`,
                  background: employee.avatarColor,
                }}
              />
            ))}
          </div>

          <h4>Current Room</h4>
          <p>{selectedRoom}</p>

          <h4>GPS Location</h4>
          <p>{gpsStatus}</p>
          <small>{gpsCoordinates}</small>

          <button className="gps-button" onClick={enableGPS}>
            Enable GPS
          </button>
        </aside>
      </div>

      <footer className="office-footer">
        <div className="office-room-selector">
          <label htmlFor="office-room-select">Move to room</label>

          <select
            id="office-room-select"
            value={selectedRoom}
            onChange={(event) => enterRoom(event.target.value)}
          >
            <option value="Main Office">Main Office</option>

            {ROOMS.map((room) => (
              <option key={room} value={room}>
                {room}
              </option>
            ))}
          </select>
        </div>

        <div className="office-call-controls">
  <button onClick={toggleMic}>
    {micOn ? "🔊" : "🎙️"}
    <span>{micOn ? "Mute" : "Mic"}</span>
  </button>

  <button onClick={toggleCamera}>
    {cameraOn ? "📹" : "📷"}
    <span>{cameraOn ? "Camera Off" : "Camera"}</span>
  </button>

  <button
    title="Screen sharing"
    onClick={async () => {
      try {
        const stream =
          await navigator.mediaDevices.getDisplayMedia({
            video: true,
          });

        stream.getTracks().forEach((track) => track.stop());
      } catch (error) {
        console.error("Screen sharing cancelled:", error);
      }
    }}
  >
    ▣ <span>Share</span>
  </button>

  <button title="Leave office" onClick={leaveOffice}>
    📞 <span>Leave</span>
  </button>
</div>

        <div className="office-online-count">
          👥 {employees.length} Online
        </div>
      </footer>
    </div>
  );
}