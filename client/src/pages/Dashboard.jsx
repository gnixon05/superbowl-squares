import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Container, Row, Col, Card, Button, Modal, Form,
  Alert, Badge, Spinner, Tabs, Tab,
} from 'react-bootstrap';
import { FaTh, FaPlus, FaLock, FaCheck, FaUsers } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const NFL_TEAMS = [
  'Arizona Cardinals', 'Atlanta Falcons', 'Baltimore Ravens', 'Buffalo Bills',
  'Carolina Panthers', 'Chicago Bears', 'Cincinnati Bengals', 'Cleveland Browns',
  'Dallas Cowboys', 'Denver Broncos', 'Detroit Lions', 'Green Bay Packers',
  'Houston Texans', 'Indianapolis Colts', 'Jacksonville Jaguars', 'Kansas City Chiefs',
  'Las Vegas Raiders', 'Los Angeles Chargers', 'Los Angeles Rams', 'Miami Dolphins',
  'Minnesota Vikings', 'New England Patriots', 'New Orleans Saints', 'New York Giants',
  'New York Jets', 'Philadelphia Eagles', 'Pittsburgh Steelers', 'San Francisco 49ers',
  'Seattle Seahawks', 'Tampa Bay Buccaneers', 'Tennessee Titans', 'Washington Commanders',
];

function StatusBadge({ status }) {
  const map = {
    open: { bg: 'success', label: 'Open', icon: <FaUsers /> },
    locked: { bg: 'warning', label: 'Locked', icon: <FaLock /> },
    completed: { bg: 'secondary', label: 'Completed', icon: <FaCheck /> },
  };
  const s = map[status] || map.open;
  return (
    <Badge bg={s.bg} className="d-inline-flex align-items-center gap-1">
      {s.icon} {s.label}
    </Badge>
  );
}

function GameCard({ game }) {
  return (
    <Col xs={12} sm={6} lg={4}>
      <Card className="h-100 border-0 shadow-sm">
        <Card.Body className="d-flex flex-column">
          <div className="d-flex justify-content-between align-items-start mb-2">
            <Card.Title className="fw-bold mb-0 fs-6">{game.name}</Card.Title>
            <StatusBadge status={game.status} />
          </div>
          <Card.Text className="text-muted small mb-2">
            {game.teamRow} vs {game.teamCol}
          </Card.Text>
          <div className="small text-muted mb-3">
            <span>By {game.creatorName}</span>
            <span className="mx-2">|</span>
            <span>{game.claimedSquares}/{game.totalSquares} squares taken</span>
          </div>
          {game.status === 'completed' && game.winners && (
            <div className="small mb-2">
              {game.scores?.final && (
                <span className="text-muted me-2">
                  Final: {game.scores.final.row} - {game.scores.final.col}
                </span>
              )}
              {game.winners.final && (
                <Badge bg="info">Winner: {game.winners.final}</Badge>
              )}
            </div>
          )}
          <div className="mt-auto">
            <Button
              as={Link}
              to={`/game/${game.id}`}
              variant={game.status === 'open' ? 'primary' : 'outline-primary'}
              size="sm"
              className="w-100"
            >
              {game.status === 'open' ? 'Join / View Board' : 'View Board'}
            </Button>
          </div>
        </Card.Body>
      </Card>
    </Col>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [myGames, setMyGames] = useState([]);
  const [allGames, setAllGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    teamRow: '',
    teamCol: '',
    isPublic: true,
  });
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchGames = async () => {
    try {
      const [myRes, allRes] = await Promise.all([
        api.get('/games/my-games'),
        api.get('/games'),
      ]);
      setMyGames(myRes.data);
      setAllGames(allRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGames();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreateError('');

    if (createForm.teamRow === createForm.teamCol) {
      return setCreateError('Please select two different teams');
    }

    setCreating(true);
    try {
      const res = await api.post('/games', createForm);
      setShowCreate(false);
      setCreateForm({ name: '', teamRow: '', teamCol: '', isPublic: true });
      navigate(`/game/${res.data.id}`);
    } catch (err) {
      setCreateError(err.response?.data?.message || 'Failed to create game');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" variant="primary" />
      </Container>
    );
  }

  // Games the user can join (public, open, not already in)
  const myGameIds = new Set(myGames.map((g) => g.id));
  const joinableGames = allGames.filter((g) => g.status === 'open' && !myGameIds.has(g.id));

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <h2 className="fw-bold mb-0 d-flex align-items-center gap-2">
          <FaTh /> Dashboard
        </h2>
        <Button variant="warning" className="fw-semibold" onClick={() => setShowCreate(true)}>
          <FaPlus className="me-1" /> New Game
        </Button>
      </div>

      <Tabs defaultActiveKey="my-games" className="mb-4">
        <Tab eventKey="my-games" title={`My Games (${myGames.length})`}>
          {myGames.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <Card.Body className="text-center py-5">
                <FaTh size={48} className="text-muted mb-3" />
                <h5>No games yet</h5>
                <p className="text-muted mb-3">Create a new game or join a public one</p>
                <Button variant="warning" onClick={() => setShowCreate(true)}>
                  <FaPlus className="me-1" /> Create Game
                </Button>
              </Card.Body>
            </Card>
          ) : (
            <Row className="g-3">
              {myGames.map((game) => (
                <GameCard key={game.id} game={game} />
              ))}
            </Row>
          )}
        </Tab>

        <Tab eventKey="public-games" title={`Join a Game (${joinableGames.length})`}>
          {joinableGames.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <Card.Body className="text-center py-5">
                <FaUsers size={48} className="text-muted mb-3" />
                <h5>No public games available</h5>
                <p className="text-muted">Check back later or create your own</p>
              </Card.Body>
            </Card>
          ) : (
            <Row className="g-3">
              {joinableGames.map((game) => (
                <GameCard key={game.id} game={game} />
              ))}
            </Row>
          )}
        </Tab>
      </Tabs>

      {/* Create Game Modal */}
      <Modal show={showCreate} onHide={() => setShowCreate(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="fw-bold">Create New Game</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleCreate}>
          <Modal.Body>
            {createError && <Alert variant="danger">{createError}</Alert>}
            <Form.Group className="mb-3">
              <Form.Label>Game Name</Form.Label>
              <Form.Control
                placeholder="e.g. Super Bowl Party 2026"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Row Team (horizontal)</Form.Label>
              <Form.Select
                value={createForm.teamRow}
                onChange={(e) => setCreateForm({ ...createForm, teamRow: e.target.value })}
                required
              >
                <option value="">Select a team...</option>
                {NFL_TEAMS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Column Team (vertical)</Form.Label>
              <Form.Select
                value={createForm.teamCol}
                onChange={(e) => setCreateForm({ ...createForm, teamCol: e.target.value })}
                required
              >
                <option value="">Select a team...</option>
                {NFL_TEAMS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Check
              type="switch"
              label="Public game (anyone can join)"
              checked={createForm.isPublic}
              onChange={(e) => setCreateForm({ ...createForm, isPublic: e.target.checked })}
            />
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button variant="warning" type="submit" className="fw-semibold" disabled={creating}>
              {creating ? 'Creating...' : 'Create Game'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Container>
  );
}
