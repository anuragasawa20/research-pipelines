import { Link, NavLink, Outlet } from 'react-router-dom';

function Layout() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="container header-content">
          <Link className="brand" to="/">
            Mining Intelligence
          </Link>
          <nav className="main-nav">
            <NavLink to="/" end>
              Home
            </NavLink>
            <NavLink to="/companies">Companies</NavLink>
            <NavLink to="/debug">Debug</NavLink>
          </nav>
        </div>
      </header>

      <div className="flow-banner">
        <div className="container">
          Enter Names <span>/</span> Extraction <span>/</span> Pipeline Status <span>/</span> Data Insights
        </div>
      </div>

      <main className="container page-content">
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
