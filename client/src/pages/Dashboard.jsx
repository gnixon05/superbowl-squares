import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Container, Row, Col, Card, Button, Modal, Form,
  Alert, Badge, Spinner, Tabs, Tab, ListGroup, InputGroup,
} from 'react-bootstrap';
import { FaTh, FaPlus, FaLock, FaCheck, FaUsers, FaDollarSign, FaEnvelope, FaEnvelopeOpen } from 'react-icons/fa';
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
            <div className="d-flex gap-1 flex-wrap justify-content-end">
              <StatusBadge status={game.status} />
              {!game.isPublic && <Badge bg="dark">Private</Badge>}
              {game.paymentType === 'paid' && (
                <Badge bg="info">
                  <FaDollarSign className="me-1" style={{ fontSize: '0.6rem' }} />
                  ${game.costPerSquare}/sq
                </Badge>
              )}
            </div>
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

const defaultCreateForm = {
  name: '',
  teamRow: '',
  teamCol: '',
  isPublic: true,
  paymentType: 'free',
  paymentMethod: 'offline',
  costPerSquare: '',
  venmoUsername: '',
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [myGames, setMyGames] = useState([]);
  const [allGames, setAllGames] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ ...defaultCreateForm });
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

  const fetchInvitations = async () => {
    try {
      const res = await api.get('/invitations/my-invitations');
      setInvitations(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchGames();
    fetchInvitations();
  }, []);

  const handleAcceptInvite = async (gameId) => {
    try {
      await api.post(`/games/${gameId}/accept-invite`);
      fetchInvitations();
      fetchGames();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeclineInvite = async (gameId) => {
    try {
      await api.post(`/games/${gameId}/decline-invite`);
      fetchInvitations();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreateError('');

    if (createForm.teamRow === createForm.teamCol) {
      return setCreateError('Please select two different teams');
    }

    if (createForm.paymentType === 'paid' && (!createForm.costPerSquare || parseFloat(createForm.costPerSquare) <= 0)) {
      return setCreateError('Please enter a valid cost per square');
    }

    setCreating(true);
    try {
      const res = await api.post('/games', createForm);
      setShowCreate(false);
      setCreateForm({ ...defaultCreateForm });
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

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <Card className="border-0 shadow-sm mb-4 border-start border-4 border-info">
          <Card.Body>
            <h6 className="fw-bold mb-3 d-flex align-items-center gap-2">
              <FaEnvelope className="text-info" /> Pending Invitations ({invitations.length})
            </h6>
            <ListGroup variant="flush">
              {invitations.map((inv) => (
                <ListGroup.Item key={inv.id} className="d-flex justify-content-between align-items-center px-0">
                  <div>
                    <span className="fw-semibold">{inv.gameName}</span>
                    <br />
                    <small className="text-muted">{inv.teamRow} vs {inv.teamCol} — by {inv.creatorName}</small>
                  </div>
                  <div className="d-flex gap-2">
                    <Button size="sm" variant="success" onClick={() => handleAcceptInvite(inv.gameId)}>Accept</Button>
                    <Button size="sm" variant="outline-danger" onClick={() => handleDeclineInvite(inv.gameId)}>Decline</Button>
                  </div>
                </ListGroup.Item>
              ))}
            </ListGroup>
          </Card.Body>
        </Card>
      )}

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
      <Modal show={showCreate} onHide={() => setShowCreate(false)} centered size="lg">
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

            <Row className="mb-3">
              <Col md={6}>
                <Form.Group>
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
              </Col>
              <Col md={6}>
                <Form.Group>
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
              </Col>
            </Row>

            <Form.Check
              type="switch"
              label="Public game (anyone can join)"
              checked={createForm.isPublic}
              onChange={(e) => setCreateForm({ ...createForm, isPublic: e.target.checked })}
              className="mb-3"
            />
            {!createForm.isPublic && (
              <Alert variant="info" className="small">
                <FaLock className="me-1" /> This game is private. You can invite players by email or approve join requests from the game board.
              </Alert>
            )}

            <hr />
            <h6 className="fw-bold mb-3">Payment Settings</h6>

            <Form.Group className="mb-3">
              <Form.Label>Game Type</Form.Label>
              <div className="d-flex gap-3">
                <Form.Check
                  type="radio"
                  label="Free"
                  name="paymentType"
                  checked={createForm.paymentType === 'free'}
                  onChange={() => setCreateForm({ ...createForm, paymentType: 'free', costPerSquare: '', paymentMethod: 'offline', venmoUsername: '' })}
                />
                <Form.Check
                  type="radio"
                  label="Paid"
                  name="paymentType"
                  checked={createForm.paymentType === 'paid'}
                  onChange={() => setCreateForm({ ...createForm, paymentType: 'paid' })}
                />
              </div>
            </Form.Group>

            {createForm.paymentType === 'paid' && (
              <>
                <Form.Group className="mb-3">
                  <Form.Label>Cost Per Square</Form.Label>
                  <InputGroup>
                    <InputGroup.Text>$</InputGroup.Text>
                    <Form.Control
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="5.00"
                      value={createForm.costPerSquare}
                      onChange={(e) => setCreateForm({ ...createForm, costPerSquare: e.target.value })}
                      required
                    />
                  </InputGroup>
                  <Form.Text className="text-muted">
                    Total pot: ${((parseFloat(createForm.costPerSquare) || 0) * 25).toFixed(2)} (25 squares)
                  </Form.Text>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Payment Method</Form.Label>
                  <div className="d-flex gap-3">
                    <Form.Check
                      type="radio"
                      label="Offline (handle payments yourself)"
                      name="paymentMethod"
                      checked={createForm.paymentMethod === 'offline'}
                      onChange={() => setCreateForm({ ...createForm, paymentMethod: 'offline', venmoUsername: '' })}
                    />
                    <Form.Check
                      type="radio"
                      label="Integrated (Venmo via Braintree)"
                      name="paymentMethod"
                      checked={createForm.paymentMethod === 'integrated'}
                      onChange={() => setCreateForm({ ...createForm, paymentMethod: 'integrated' })}
                    />
                  </div>
                </Form.Group>

                {createForm.paymentMethod === 'integrated' && (
                  <Form.Group className="mb-3">
                    <Form.Label>Venmo Username (for payouts)</Form.Label>
                    <Form.Control
                      placeholder="@your-venmo-handle"
                      value={createForm.venmoUsername}
                      onChange={(e) => setCreateForm({ ...createForm, venmoUsername: e.target.value })}
                    />
                    <Form.Text className="text-muted">
                      Players will pay via Venmo when selecting squares. Winners receive automatic payouts.
                    </Form.Text>
                  </Form.Group>
                )}

                {createForm.paymentMethod === 'offline' && (
                  <Alert variant="secondary" className="small">
                    Players will see the cost per square on the game board. You&apos;ll need to collect payments outside the app.
                  </Alert>
                )}
              </>
            )}
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
