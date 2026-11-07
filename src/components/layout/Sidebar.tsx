import { NavLink, useNavigate } from "react-router-dom";

import {
  LayoutDashboard,
  Compass,
  Headphones,
  User,
  Settings,
  LogOut,
  AudioLines,
  MessageCircle,
  Building2
} from "lucide-react";

function Sidebar() {
  const navigate = useNavigate();

  const links = [
    { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { name: "Explore", path: "/explore", icon: Compass },
    { name: "Audio Rooms", path: "/audio-rooms", icon: Headphones },
    { name: "Virtual Office", path: "/virtual-office", icon: Building2 },
    { name: "Chat", path: "/chat", icon: MessageCircle },
    { name: "Profile", path: "/profile", icon: User },
    { name: "Settings", path: "/settings", icon: Settings }
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <AudioLines size={27} />
        <span>
          Proxi<span className="gradient-text">Speak</span>
        </span>
      </div>

      <p className="sidebar-label">WORKSPACE</p>

      <nav className="sidebar-nav">
        {links.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                isActive ? "sidebar-link active" : "sidebar-link"
              }
            >
              <Icon size={19} />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      <button
        className="sidebar-logout"
        onClick={() => navigate("/login")}
      >
        <LogOut size={19} />
        Logout
      </button>

      <div className="sidebar-version">
        ProxiSpeak v1.0
      </div>
    </aside>
  );
}

export default Sidebar;