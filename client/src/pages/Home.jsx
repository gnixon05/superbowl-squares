import { Link } from 'react-router-dom';
import { Container, Row, Col, Button, Card } from 'react-bootstrap';
import { FaFootballBall, FaTh, FaUsers, FaTrophy } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { user } = useAuth();

  return (
    <>
      {/* Hero Section */}
      <div className="bg-dark text-white py-5">
        <Container>
          <Row className="align-items-center py-4">
            <Col lg={7} className="mb-4 mb-lg-0">
              <h1 className="display-4 fw-bold mb-3">
                <FaFootballBall className="text-warning me-3" />
                Super Bowl Squares
              </h1>
              <p className="lead mb-4 text-light">
                Create or join Super Bowl square games with friends. Pick your squares,
                wait for the numbers, and see if you win!
              </p>
              {user ? (
                <Button as={Link} to="/dashboard" variant="warning" size="lg" className="fw-semibold px-4">
                  Go to Dashboard
                </Button>
              ) : (
                <div className="d-flex gap-3 flex-wrap">
                  <Button as={Link} to="/signup" variant="warning" size="lg" className="fw-semibold px-4">
                    Get Started
                  </Button>
                  <Button as={Link} to="/signin" variant="outline-light" size="lg" className="px-4">
                    Sign In
                  </Button>
                </div>
              )}
            </Col>
            <Col lg={5} className="text-center">
              <div className="p-4">
                <div
                  className="d-inline-grid gap-1 p-3 bg-success bg-opacity-25 rounded-3"
                  style={{
                    gridTemplateColumns: 'repeat(5, 1fr)',
                  }}
                >
                  {Array.from({ length: 25 }).map((_, i) => (
                    <div
                      key={i}
                      className="bg-white bg-opacity-10 rounded d-flex align-items-center justify-content-center"
                      style={{ width: 48, height: 48, fontSize: '0.75rem' }}
                    >
                      {i < 5 ? '?' : ''}
                    </div>
                  ))}
                </div>
              </div>
            </Col>
          </Row>
        </Container>
      </div>

      {/* How It Works */}
      <Container className="py-5">
        <h2 className="text-center fw-bold mb-5">How It Works</h2>
        <Row className="g-4">
          <Col md={4}>
            <Card className="h-100 border-0 shadow-sm text-center p-4">
              <Card.Body>
                <div className="mb-3">
                  <FaTh size={40} className="text-primary" />
                </div>
                <Card.Title className="fw-bold">1. Create a Game</Card.Title>
                <Card.Text className="text-muted">
                  Set up a 5x5 grid, choose two NFL teams, and share the game with friends.
                  Numbers are hidden until the board is locked.
                </Card.Text>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4}>
            <Card className="h-100 border-0 shadow-sm text-center p-4">
              <Card.Body>
                <div className="mb-3">
                  <FaUsers size={40} className="text-success" />
                </div>
                <Card.Title className="fw-bold">2. Pick Your Squares</Card.Title>
                <Card.Text className="text-muted">
                  Players select available squares on the grid. Each square represents
                  a unique combination of score digits for each team.
                </Card.Text>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4}>
            <Card className="h-100 border-0 shadow-sm text-center p-4">
              <Card.Body>
                <div className="mb-3">
                  <FaTrophy size={40} className="text-warning" />
                </div>
                <Card.Title className="fw-bold">3. Win!</Card.Title>
                <Card.Text className="text-muted">
                  Once locked, numbers are randomly assigned. The winner is determined
                  by matching the last digit of each team's score.
                </Card.Text>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>

      {/* Footer */}
      <footer className="bg-dark text-white text-center py-4 mt-auto">
        <Container>
          <p className="mb-0 text-muted">&copy; {new Date().getFullYear()} Super Bowl Squares</p>
        </Container>
      </footer>
    </>
  );
}
