import { Bell, Search, CircleUserRound } from "lucide-react";

function Navbar() {
  return (
    <header className="main-navbar">

      <div className="navbar-search">
        <Search size={18} />
        <input placeholder="Search people, rooms..." />
      </div>

      <div className="navbar-actions">

        <button className="icon-button">
          <Bell size={20} />
        </button>

        <div className="navbar-user">
          <CircleUserRound size={30} />
          <div>
            <strong>Guest User</strong>
            <span>Online</span>
          </div>
        </div>

      </div>

    </header>
  );
}

export default Navbar;