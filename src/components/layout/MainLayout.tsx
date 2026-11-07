import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";

function MainLayout() {
  return (
    <div className="main-layout">

      <Sidebar />

      <div className="main-content">

        <Navbar />

        <main className="content-area">
          <Outlet />
        </main>

      </div>

    </div>
  );
}

export default MainLayout;