import { Link, useNavigate } from 'react-router-dom';
import { Navbar as BsNavbar, Nav, Container, Button } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { FaFootballBall, FaUser, FaChartBar, FaTh } from 'react-icons/fa';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <BsNavbar bg="dark" variant="dark" expand="md" sticky="top" className="shadow-sm">
      <Container>
        <BsNavbar.Brand as={Link} to="/" className="d-flex align-items-center gap-2 fw-bold">
          <FaFootballBall className="text-warning" />
          SB Squares
        </BsNavbar.Brand>
        <BsNavbar.Toggle aria-controls="main-navbar" />
        <BsNavbar.Collapse id="main-navbar">
          <Nav className="ms-auto align-items-md-center gap-md-1">
            {user ? (
              <>
                <Nav.Link as={Link} to="/dashboard" className="d-flex align-items-center gap-1">
                  <FaTh /> Dashboard
                </Nav.Link>
                <Nav.Link as={Link} to="/stats" className="d-flex align-items-center gap-1">
                  <FaChartBar /> Stats
                </Nav.Link>
                <Nav.Link as={Link} to="/profile" className="d-flex align-items-center gap-1">
                  <FaUser /> Profile
                </Nav.Link>
                <Button
                  variant="outline-light"
                  size="sm"
                  onClick={handleLogout}
                  className="ms-md-2 mt-2 mt-md-0"
                >
                  Sign Out
                </Button>
              </>
            ) : (
              <>
                <Nav.Link as={Link} to="/signin">Sign In</Nav.Link>
                <Button
                  as={Link}
                  to="/signup"
                  variant="warning"
                  size="sm"
                  className="ms-md-2 mt-2 mt-md-0 fw-semibold"
                >
                  Sign Up
                </Button>
              </>
            )}
          </Nav>
        </BsNavbar.Collapse>
      </Container>
    </BsNavbar>
  );
}
