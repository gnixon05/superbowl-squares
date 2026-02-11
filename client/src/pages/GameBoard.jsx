import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container, Row, Col, Card, Button, Badge, Alert,
  Spinner, Modal, Form, OverlayTrigger, Tooltip,
  ListGroup, Table, InputGroup,
} from 'react-bootstrap';
import {
  FaLock, FaTrophy, FaArrowLeft, FaCheck, FaEnvelope,
  FaUserPlus, FaDollarSign, FaMoneyBillWave, FaTimes,
  FaUsers,
} from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const QUARTERS = ['q1', 'q2', 'q3', 'final'];
const QUARTER_LABELS = { q1: 'Q1', q2: 'Q2', q3: 'Q3', final: 'Final' };
const QUARTER_COLORS = { q1: '#0d6efd', q2: '#198754', q3: '#fd7e14', final: '#dc3545' };

function findWinningSquare(numbersRow, numbersCol, rowScore, colScore) {
  if (rowScore === undefined || colScore === undefined || !numbersRow || !numbersCol) return null;
  const winRow = numbersRow.findIndex((pair) => pair.includes(rowScore % 10));
  const winCol = numbersCol.findIndex((pair) => pair.includes(colScore % 10));
  if (winRow === -1 || winCol === -1) return null;
  return `${winRow}-${winCol}`;
}

export default function GameBoard() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [showScore, setShowScore] = useState(false);
  const [scores, setScores] = useState({ rowScore: '', colScore: '' });

  // Invitation state
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitations, setInvitations] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [showManageAccess, setShowManageAccess] = useState(false);

  // Payment state
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [showPayouts, setShowPayouts] = useState(false);
  const [payouts, setPayouts] = useState([]);
  const [paymentStatuses, setPaymentStatuses] = useState(null);

  const fetchGame = useCallback(async () => {
    try {
      const res = await api.get(`/games/${id}`);
      setGame(res.data);
    } catch (err) {
      if (err.response?.status === 403) {
        setError('You do not have access to this private game.');
      } else {
        setError('Game not found');
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchInvitations = useCallback(async () => {
    try {
      const res = await api.get(`/games/${id}/invitations`);
      setInvitations(res.data);
    } catch {
      // not creator, ignore
    }
  }, [id]);

  const fetchJoinRequests = useCallback(async () => {
    try {
      const res = await api.get(`/games/${id}/join-requests`);
      setJoinRequests(res.data);
    } catch {
      // not creator, ignore
    }
  }, [id]);

  const fetchPayouts = useCallback(async () => {
    try {
      const res = await api.get(`/payments/game/${id}/payouts`);
      setPayouts(res.data);
    } catch {
      // ignore
    }
  }, [id]);

  const fetchPaymentStatuses = useCallback(async () => {
    try {
      const res = await api.get(`/payments/game/${id}/status`);
      setPaymentStatuses(res.data);
    } catch {
      // ignore
    }
  }, [id]);

  useEffect(() => {
    fetchGame();
  }, [fetchGame]);

  useEffect(() => {
    if (game) {
      fetchInvitations();
      fetchJoinRequests();
      if (game.paymentType === 'paid') {
        fetchPayouts();
        fetchPaymentStatuses();
      }
    }
  }, [game?.id]);

  const handlePick = async (row, col) => {
    if (actionLoading) return;
    setActionLoading(true);
    setError('');
    try {
      const res = await api.post(`/games/${id}/pick`, { row, col });
      setGame(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to pick square');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnpick = async (row, col) => {
    if (actionLoading) return;
    setActionLoading(true);
    setError('');
    try {
      const res = await api.post(`/games/${id}/unpick`, { row, col });
      setGame(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove pick');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLock = async () => {
    if (!window.confirm('Are you sure you want to lock the board? This will generate the numbers and no more picks can be made.')) return;
    setActionLoading(true);
    setError('');
    try {
      const res = await api.post(`/games/${id}/lock`);
      setGame(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to lock board');
    } finally {
      setActionLoading(false);
    }
  };

  const handleScore = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setError('');
    try {
      const res = await api.post(`/games/${id}/score`, {
        rowScore: parseInt(scores.rowScore, 10),
        colScore: parseInt(scores.colScore, 10),
      });
      setGame(res.data);
      setShowScore(false);
      setScores({ rowScore: '', colScore: '' });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit score');
    } finally {
      setActionLoading(false);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await api.post(`/games/${id}/invite`, { email: inviteEmail });
      setInvitations(res.data);
      setInviteEmail('');
      setShowInvite(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send invitation');
    }
  };

  const handleRemoveInvite = async (inviteId) => {
    try {
      const res = await api.delete(`/games/${id}/invite/${inviteId}`);
      setInvitations(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove invitation');
    }
  };

  const handleApproveJoin = async (requestId) => {
    try {
      await api.post(`/games/${id}/approve-join/${requestId}`);
      fetchJoinRequests();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to approve request');
    }
  };

  const handleDenyJoin = async (requestId) => {
    try {
      await api.post(`/games/${id}/deny-join/${requestId}`);
      fetchJoinRequests();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to deny request');
    }
  };

  const handleRequestJoin = async () => {
    setError('');
    try {
      await api.post(`/games/${id}/request-join`);
      fetchGame();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send join request');
    }
  };

  const handleCheckout = async () => {
    setCheckoutLoading(true);
    setError('');
    try {
      // Get client token
      const tokenRes = await api.get('/payments/client-token');
      const clientToken = tokenRes.data.clientToken;

      // For now, use a simple nonce approach — in production, this would use Braintree Drop-in UI
      // We'll create a simple checkout that gets a payment method nonce
      setPaymentStatus({ clientToken, step: 'ready' });
      setShowCheckout(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Payment system not available. Contact the game creator.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleProcessPayment = async (nonce) => {
    setCheckoutLoading(true);
    setError('');
    try {
      const res = await api.post('/payments/checkout', {
        gameId: id,
        paymentMethodNonce: nonce,
      });
      setShowCheckout(false);
      setPaymentStatus({ paid: true, ...res.data });
      fetchGame();
      fetchPaymentStatuses();
    } catch (err) {
      setError(err.response?.data?.message || 'Payment failed');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handlePayout = async (quarter) => {
    if (!window.confirm(`Initiate payout for ${QUARTER_LABELS[quarter]} winner?`)) return;
    setError('');
    try {
      await api.post('/payments/payout', { gameId: id, quarter });
      fetchPayouts();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to process payout');
    }
  };

  if (loading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" variant="primary" />
      </Container>
    );
  }

  if (!game) {
    return (
      <Container className="py-5 text-center">
        {error && <Alert variant="danger" className="mb-3">{error}</Alert>}
        <p className="text-muted">Game not found or you don&apos;t have access.</p>
        <Button variant="primary" onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
      </Container>
    );
  }

  const isCreator = user?.id === game.creatorId;
  const gridSize = game.gridSize;
  const isPaidIntegrated = game.paymentType === 'paid' && game.paymentMethod === 'integrated';
  const isPaid = game.paymentType === 'paid';

  // User's squares count
  const mySquareCount = game.squares.filter((sq) => sq.userId === user?.id).length;
  const hasPaid = !!game.userPayment;
  const needsPayment = isPaidIntegrated && mySquareCount > 0 && !hasPaid && !isCreator;

  // Build a lookup for squares
  const squareMap = {};
  for (const sq of game.squares) {
    squareMap[`${sq.row}-${sq.col}`] = sq;
  }

  // Build winning square map
  const winMap = {};
  for (const q of QUARTERS) {
    if (game.scores?.[q]) {
      const key = findWinningSquare(game.numbersRow, game.numbersCol, game.scores[q].row, game.scores[q].col);
      if (key) {
        if (!winMap[key]) winMap[key] = [];
        winMap[key].push(q);
      }
    }
  }

  const hasScores = game.scores && Object.keys(game.scores).length > 0;
  const canEnterScore = isCreator && game.status === 'locked' && game.currentQuarter;
  const pendingJoinRequests = joinRequests.filter((r) => r.status === 'pending');

  // Check if user has requested to join
  const userJoinRequest = game.userJoinRequest;
  const isPrivateAndNotMember = !game.isPublic && !isCreator && !game.userInvitation?.status?.match(/accepted/) && userJoinRequest?.status !== 'approved';
  const hasSquaresInGame = game.squares.some((sq) => sq.userId === user?.id);

  return (
    <Container className="py-4">
      <Button variant="link" className="text-decoration-none mb-3 p-0" onClick={() => navigate('/dashboard')}>
        <FaArrowLeft className="me-1" /> Back to Dashboard
      </Button>

      {/* Game Header */}
      <Card className="border-0 shadow-sm mb-4">
        <Card.Body>
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
            <div>
              <h3 className="fw-bold mb-1">{game.name}</h3>
              <p className="text-muted mb-1">{game.teamRow} vs {game.teamCol}</p>
              <small className="text-muted">Created by {game.creatorName}</small>
              <div className="d-flex gap-2 mt-1">
                {!game.isPublic && <Badge bg="dark">Private</Badge>}
                {isPaid && (
                  <Badge bg="info">
                    <FaDollarSign style={{ fontSize: '0.6rem' }} /> ${game.costPerSquare}/square
                    {game.paymentMethod === 'integrated' ? ' (Venmo)' : ' (Offline)'}
                  </Badge>
                )}
              </div>
            </div>
            <div className="text-end">
              <StatusBadge status={game.status} currentQuarter={game.currentQuarter} />
            </div>
          </div>

          {/* Quarter Scoreboard */}
          {hasScores && (
            <div className="mt-3 pt-3 border-top">
              <Row className="g-2">
                {QUARTERS.map((q) => {
                  const s = game.scores?.[q];
                  const w = game.winners?.[q];
                  if (!s) return null;
                  return (
                    <Col xs={6} md={3} key={q}>
                      <div className="border rounded p-2 text-center" style={{ borderColor: QUARTER_COLORS[q] + ' !important' }}>
                        <div className="small fw-bold" style={{ color: QUARTER_COLORS[q] }}>{QUARTER_LABELS[q]}</div>
                        <div className="fw-bold">{s.row} - {s.col}</div>
                        <div className="small">
                          {w ? (
                            <span className="text-success"><FaTrophy className="me-1" style={{ fontSize: '0.6rem' }} />{w}</span>
                          ) : (
                            <span className="text-muted">Unclaimed</span>
                          )}
                        </div>
                      </div>
                    </Col>
                  );
                })}
              </Row>
            </div>
          )}

          {/* Creator Actions */}
          <div className="mt-3 pt-3 border-top d-flex flex-wrap gap-2">
            {isCreator && game.status === 'open' && (
              <Button variant="warning" size="sm" className="fw-semibold" onClick={handleLock}>
                <FaLock className="me-1" /> Lock Board & Generate Numbers
              </Button>
            )}
            {canEnterScore && (
              <Button variant="success" size="sm" className="fw-semibold" onClick={() => setShowScore(true)}>
                <FaCheck className="me-1" /> Enter {QUARTER_LABELS[game.currentQuarter]} Score
              </Button>
            )}
            {isCreator && !game.isPublic && (
              <>
                <Button variant="outline-primary" size="sm" onClick={() => setShowInvite(true)}>
                  <FaEnvelope className="me-1" /> Invite Players
                </Button>
                <Button variant="outline-secondary" size="sm" onClick={() => { setShowManageAccess(true); fetchJoinRequests(); fetchInvitations(); }}>
                  <FaUsers className="me-1" /> Manage Access
                  {pendingJoinRequests.length > 0 && (
                    <Badge bg="danger" className="ms-1">{pendingJoinRequests.length}</Badge>
                  )}
                </Button>
              </>
            )}
            {isCreator && isPaid && (
              <Button variant="outline-info" size="sm" onClick={() => { setShowPayouts(true); fetchPayouts(); fetchPaymentStatuses(); }}>
                <FaMoneyBillWave className="me-1" /> Payments & Payouts
              </Button>
            )}
          </div>

          {/* Payment notice for players */}
          {needsPayment && (
            <Alert variant="warning" className="mt-3 mb-0">
              <FaDollarSign className="me-1" />
              You have {mySquareCount} square{mySquareCount > 1 ? 's' : ''} selected.
              Total: <strong>${(game.costPerSquare * mySquareCount).toFixed(2)}</strong>
              <Button variant="warning" size="sm" className="ms-3 fw-semibold" onClick={handleCheckout} disabled={checkoutLoading}>
                {checkoutLoading ? 'Loading...' : 'Pay with Venmo'}
              </Button>
            </Alert>
          )}
          {hasPaid && isPaidIntegrated && (
            <Alert variant="success" className="mt-3 mb-0 small">
              <FaCheck className="me-1" /> Payment complete for your squares.
            </Alert>
          )}
          {isPaid && game.paymentMethod === 'offline' && mySquareCount > 0 && !isCreator && (
            <Alert variant="info" className="mt-3 mb-0 small">
              <FaDollarSign className="me-1" />
              Total owed: <strong>${(game.costPerSquare * mySquareCount).toFixed(2)}</strong> ({mySquareCount} square{mySquareCount > 1 ? 's' : ''} x ${game.costPerSquare}).
              Contact the game creator to arrange payment.
            </Alert>
          )}
        </Card.Body>
      </Card>

      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}

      {/* Private game - join request for non-members */}
      {isPrivateAndNotMember && !hasSquaresInGame && (
        <Card className="border-0 shadow-sm mb-4">
          <Card.Body className="text-center py-4">
            <FaLock size={32} className="text-muted mb-3" />
            <h5>Private Game</h5>
            {userJoinRequest?.status === 'pending' ? (
              <p className="text-muted">Your join request is pending approval.</p>
            ) : userJoinRequest?.status === 'denied' ? (
              <p className="text-danger">Your join request was denied.</p>
            ) : (
              <>
                <p className="text-muted">Request access from the game creator to participate.</p>
                <Button variant="primary" onClick={handleRequestJoin}>
                  <FaUserPlus className="me-1" /> Request to Join
                </Button>
              </>
            )}
          </Card.Body>
        </Card>
      )}

      {/* Game Grid */}
      <div className="table-responsive">
        <div className="d-inline-block" style={{ minWidth: 'fit-content' }}>
          {/* Column team label */}
          <div className="text-center fw-bold mb-2 text-primary" style={{ marginLeft: 80 }}>
            {game.teamCol}
          </div>

          <div className="d-flex">
            {/* Row team label (rotated) */}
            <div className="d-flex align-items-center justify-content-center fw-bold text-primary"
              style={{ width: 30, writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
              {game.teamRow}
            </div>

            <div>
              {/* Column numbers header */}
              <div className="d-flex" style={{ marginLeft: 50 }}>
                {Array.from({ length: gridSize }).map((_, c) => (
                  <div
                    key={c}
                    className="d-flex align-items-center justify-content-center fw-bold bg-primary text-white"
                    style={{ width: 80, height: 36, fontSize: '0.85rem' }}
                  >
                    {game.numbersCol ? game.numbersCol[c].join(', ') : '?, ?'}
                  </div>
                ))}
              </div>

              {/* Grid rows */}
              {Array.from({ length: gridSize }).map((_, r) => (
                <div key={r} className="d-flex">
                  {/* Row number */}
                  <div
                    className="d-flex align-items-center justify-content-center fw-bold bg-primary text-white text-center"
                    style={{ width: 50, height: 80, fontSize: '0.85rem', lineHeight: '1.2', whiteSpace: 'pre-line' }}
                  >
                    {game.numbersRow ? game.numbersRow[r].join('\n') : '?\n?'}
                  </div>

                  {/* Squares */}
                  {Array.from({ length: gridSize }).map((_, c) => {
                    const sq = squareMap[`${r}-${c}`];
                    const isMine = sq?.userId === user?.id;
                    const isTaken = !!sq?.userId;
                    const squareKey = `${r}-${c}`;
                    const wonQuarters = winMap[squareKey] || [];
                    const isWinner = wonQuarters.length > 0;
                    const canPick = game.status === 'open' && !isTaken && (!isPrivateAndNotMember || hasSquaresInGame);
                    const canUnpick = game.status === 'open' && isMine;

                    let bgClass = 'bg-light border';
                    if (isWinner) bgClass = 'bg-warning bg-opacity-25 border border-warning';
                    else if (isMine) bgClass = 'bg-success bg-opacity-25 border border-success';
                    else if (isTaken) bgClass = 'bg-secondary bg-opacity-10 border';

                    const squareContent = (
                      <div
                        key={c}
                        className={`d-flex flex-column align-items-center justify-content-center ${bgClass} position-relative`}
                        style={{
                          width: 80,
                          height: 80,
                          cursor: canPick || canUnpick ? 'pointer' : 'default',
                          transition: 'all 0.15s ease',
                        }}
                        onClick={() => {
                          if (canPick) handlePick(r, c);
                          else if (canUnpick) handleUnpick(r, c);
                        }}
                        onMouseEnter={(e) => {
                          if (canPick) e.currentTarget.style.backgroundColor = '#d4edda';
                        }}
                        onMouseLeave={(e) => {
                          if (canPick) e.currentTarget.style.backgroundColor = '';
                        }}
                      >
                        {/* Quarter win indicators */}
                        {isWinner && (
                          <div className="position-absolute d-flex gap-0" style={{ top: 2, right: 2 }}>
                            {wonQuarters.map((q) => (
                              <span
                                key={q}
                                className="badge rounded-pill"
                                style={{
                                  fontSize: '0.5rem',
                                  padding: '1px 3px',
                                  backgroundColor: QUARTER_COLORS[q],
                                  color: 'white',
                                }}
                              >
                                {QUARTER_LABELS[q]}
                              </span>
                            ))}
                          </div>
                        )}
                        {isTaken ? (
                          <>
                            <span style={{ fontSize: '1.2rem' }}>{sq.avatar || '🏈'}</span>
                            <small className="text-truncate w-100 text-center px-1" style={{ fontSize: '0.6rem' }}>
                              {sq.firstName} {sq.lastName?.charAt(0)}.
                            </small>
                          </>
                        ) : (
                          <small className="text-muted" style={{ fontSize: '0.7rem' }}>
                            {game.status === 'open' ? 'Pick' : '—'}
                          </small>
                        )}
                      </div>
                    );

                    if (isTaken && sq.firstName) {
                      return (
                        <OverlayTrigger
                          key={c}
                          placement="top"
                          overlay={
                            <Tooltip>
                              {sq.firstName} {sq.lastName}
                              {isWinner && ` — Won: ${wonQuarters.map((q) => QUARTER_LABELS[q]).join(', ')}`}
                            </Tooltip>
                          }
                        >
                          {squareContent}
                        </OverlayTrigger>
                      );
                    }

                    return squareContent;
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <Card className="border-0 shadow-sm mt-4">
        <Card.Body>
          <h6 className="fw-bold mb-3">Legend</h6>
          <div className="d-flex flex-wrap gap-3">
            <div className="d-flex align-items-center gap-2">
              <div className="bg-light border" style={{ width: 20, height: 20 }}></div>
              <small>Available</small>
            </div>
            <div className="d-flex align-items-center gap-2">
              <div className="bg-success bg-opacity-25 border border-success" style={{ width: 20, height: 20 }}></div>
              <small>Your square</small>
            </div>
            <div className="d-flex align-items-center gap-2">
              <div className="bg-secondary bg-opacity-10 border" style={{ width: 20, height: 20 }}></div>
              <small>Taken</small>
            </div>
            {Object.keys(winMap).length > 0 && (
              <div className="d-flex align-items-center gap-2">
                <div className="bg-warning bg-opacity-25 border border-warning" style={{ width: 20, height: 20 }}></div>
                <small>Quarter winner</small>
              </div>
            )}
          </div>
        </Card.Body>
      </Card>

      {/* Score Entry Modal */}
      <Modal show={showScore} onHide={() => setShowScore(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="fw-bold">
            Enter {game?.currentQuarter ? QUARTER_LABELS[game.currentQuarter] : ''} Score
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleScore}>
          <Modal.Body>
            <p className="text-muted small">
              Enter the cumulative score at the end of {game?.currentQuarter ? QUARTER_LABELS[game.currentQuarter] : 'this quarter'}.
            </p>
            <Form.Group className="mb-3">
              <Form.Label>{game?.teamRow} Score</Form.Label>
              <Form.Control
                type="number"
                min="0"
                value={scores.rowScore}
                onChange={(e) => setScores({ ...scores, rowScore: e.target.value })}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>{game?.teamCol} Score</Form.Label>
              <Form.Control
                type="number"
                min="0"
                value={scores.colScore}
                onChange={(e) => setScores({ ...scores, colScore: e.target.value })}
                required
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowScore(false)}>Cancel</Button>
            <Button variant="success" type="submit" className="fw-semibold" disabled={actionLoading}>
              {actionLoading ? 'Saving...' : `Submit ${game?.currentQuarter ? QUARTER_LABELS[game.currentQuarter] : ''} Score`}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Invite Players Modal */}
      <Modal show={showInvite} onHide={() => setShowInvite(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="fw-bold">Invite Players</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleInvite}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Email Address</Form.Label>
              <Form.Control
                type="email"
                placeholder="player@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
              />
              <Form.Text className="text-muted">
                The user will see an invitation on their dashboard if they have an account.
              </Form.Text>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowInvite(false)}>Cancel</Button>
            <Button variant="primary" type="submit" className="fw-semibold">
              <FaEnvelope className="me-1" /> Send Invitation
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Manage Access Modal (Invitations + Join Requests) */}
      <Modal show={showManageAccess} onHide={() => setShowManageAccess(false)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title className="fw-bold">Manage Access</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {/* Pending Join Requests */}
          <h6 className="fw-bold mb-2">
            <FaUserPlus className="me-1 text-primary" />
            Join Requests ({pendingJoinRequests.length})
          </h6>
          {pendingJoinRequests.length === 0 ? (
            <p className="text-muted small mb-4">No pending join requests.</p>
          ) : (
            <ListGroup className="mb-4">
              {pendingJoinRequests.map((req) => (
                <ListGroup.Item key={req.id} className="d-flex justify-content-between align-items-center">
                  <div>
                    <span className="me-2">{req.avatar || '🏈'}</span>
                    <span className="fw-semibold">{req.firstName} {req.lastName}</span>
                    <br />
                    <small className="text-muted">{req.email}</small>
                  </div>
                  <div className="d-flex gap-2">
                    <Button size="sm" variant="success" onClick={() => handleApproveJoin(req.id)}>Approve</Button>
                    <Button size="sm" variant="outline-danger" onClick={() => handleDenyJoin(req.id)}>Deny</Button>
                  </div>
                </ListGroup.Item>
              ))}
            </ListGroup>
          )}

          {/* Sent Invitations */}
          <h6 className="fw-bold mb-2">
            <FaEnvelope className="me-1 text-info" />
            Invitations ({invitations.length})
          </h6>
          {invitations.length === 0 ? (
            <p className="text-muted small">No invitations sent yet.</p>
          ) : (
            <ListGroup>
              {invitations.map((inv) => (
                <ListGroup.Item key={inv.id} className="d-flex justify-content-between align-items-center">
                  <div>
                    <span className="fw-semibold">{inv.invitedEmail}</span>
                    {inv.firstName && <span className="text-muted ms-2">({inv.firstName} {inv.lastName})</span>}
                    <br />
                    <Badge
                      bg={inv.status === 'accepted' ? 'success' : inv.status === 'declined' ? 'danger' : 'warning'}
                      className="mt-1"
                    >
                      {inv.status}
                    </Badge>
                  </div>
                  {inv.status === 'pending' && (
                    <Button size="sm" variant="outline-danger" onClick={() => handleRemoveInvite(inv.id)}>
                      <FaTimes />
                    </Button>
                  )}
                </ListGroup.Item>
              ))}
            </ListGroup>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="primary" size="sm" onClick={() => { setShowManageAccess(false); setShowInvite(true); }}>
            <FaEnvelope className="me-1" /> Invite More
          </Button>
          <Button variant="secondary" onClick={() => setShowManageAccess(false)}>Close</Button>
        </Modal.Footer>
      </Modal>

      {/* Checkout Modal */}
      <Modal show={showCheckout} onHide={() => setShowCheckout(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="fw-bold">Checkout</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="text-center mb-4">
            <h5 className="fw-bold">{game?.name}</h5>
            <p className="text-muted">
              {mySquareCount} square{mySquareCount > 1 ? 's' : ''} x ${game?.costPerSquare} = <strong>${(game?.costPerSquare * mySquareCount).toFixed(2)}</strong>
            </p>
          </div>

          <div id="dropin-container" className="mb-3"></div>

          <BraintreeDropIn
            clientToken={paymentStatus?.clientToken}
            onPaymentMethodNonce={handleProcessPayment}
            loading={checkoutLoading}
            amount={(game?.costPerSquare * mySquareCount).toFixed(2)}
          />
        </Modal.Body>
      </Modal>

      {/* Payments & Payouts Modal (Creator) */}
      <Modal show={showPayouts} onHide={() => setShowPayouts(false)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title className="fw-bold">Payments & Payouts</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {/* Payment Status */}
          <h6 className="fw-bold mb-2"><FaDollarSign className="text-success me-1" /> Payments Received</h6>
          {paymentStatuses?.payments?.length > 0 ? (
            <Table responsive size="sm" className="mb-4">
              <thead className="table-light">
                <tr>
                  <th>Player</th>
                  <th>Squares</th>
                  <th>Amount</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {paymentStatuses.payments.map((p) => (
                  <tr key={p.id}>
                    <td>{p.firstName} {p.lastName}</td>
                    <td>{p.squareCount}</td>
                    <td>${p.amount.toFixed(2)}</td>
                    <td><small>{new Date(p.createdAt).toLocaleDateString()}</small></td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <p className="text-muted small mb-4">No payments received yet.</p>
          )}

          {/* Unpaid Users */}
          {paymentStatuses?.unpaidUsers?.length > 0 && isPaidIntegrated && (
            <>
              <h6 className="fw-bold mb-2 text-danger">Unpaid Players</h6>
              <ListGroup className="mb-4">
                {paymentStatuses.unpaidUsers.map((u) => (
                  <ListGroup.Item key={u.id} className="d-flex justify-content-between align-items-center">
                    <span>{u.firstName} {u.lastName} ({u.email})</span>
                    <Badge bg="danger">{u.squareCount} squares — ${(u.squareCount * game.costPerSquare).toFixed(2)}</Badge>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            </>
          )}

          {/* Payouts */}
          <h6 className="fw-bold mb-2"><FaMoneyBillWave className="text-info me-1" /> Payouts</h6>
          {hasScores && game.winners && (
            <Table responsive size="sm" className="mb-3">
              <thead className="table-light">
                <tr>
                  <th>Quarter</th>
                  <th>Winner</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {QUARTERS.map((q) => {
                  const w = game.winners?.[q];
                  if (!w) return null;
                  const payout = payouts.find((p) => p.quarter === q);

                  // Calculate total pot and per-quarter amount
                  const totalPaid = paymentStatuses?.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
                  const winnerCount = Object.values(game.winners).filter(Boolean).length;
                  const perQuarter = winnerCount > 0 ? (totalPaid / winnerCount).toFixed(2) : '0.00';

                  return (
                    <tr key={q}>
                      <td>
                        <Badge style={{ backgroundColor: QUARTER_COLORS[q] }}>{QUARTER_LABELS[q]}</Badge>
                      </td>
                      <td>{w}</td>
                      <td>${payout ? payout.amount.toFixed(2) : perQuarter}</td>
                      <td>
                        {payout ? (
                          <Badge bg={payout.status === 'completed' ? 'success' : 'warning'}>{payout.status}</Badge>
                        ) : (
                          <Badge bg="secondary">Not sent</Badge>
                        )}
                      </td>
                      <td>
                        {!payout && isPaidIntegrated && (
                          <Button size="sm" variant="outline-success" onClick={() => handlePayout(q)}>
                            Send Payout
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
          {!hasScores && (
            <p className="text-muted small">No scores entered yet. Payouts are available after scoring.</p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowPayouts(false)}>Close</Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}

function StatusBadge({ status, currentQuarter }) {
  if (status === 'locked' && currentQuarter) {
    return (
      <Badge bg="warning" text="dark">
        In Progress — {QUARTER_LABELS[currentQuarter]}
      </Badge>
    );
  }
  const map = {
    open: { bg: 'success', label: 'Open' },
    locked: { bg: 'warning', label: 'Locked' },
    completed: { bg: 'secondary', label: 'Completed' },
  };
  const s = map[status] || map.open;
  return <Badge bg={s.bg}>{s.label}</Badge>;
}

// Braintree Drop-in component
function BraintreeDropIn({ clientToken, onPaymentMethodNonce, loading, amount }) {
  const containerRef = useRef(null);
  const [dropinInstance, setDropinInstance] = useState(null);
  const [loadingDropin, setLoadingDropin] = useState(true);
  const [dropinError, setDropinError] = useState('');

  useEffect(() => {
    if (!clientToken) {
      setLoadingDropin(false);
      setDropinError('Payment system not available. Please contact the game creator.');
      return;
    }

    // Dynamically load Braintree Drop-in script
    const existingScript = document.querySelector('script[src*="braintree-web-drop-in"]');
    if (existingScript) {
      initDropin();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://js.braintreegateway.com/web/dropin/1.43.0/js/dropin.min.js';
    script.async = true;
    script.onload = () => initDropin();
    script.onerror = () => {
      setLoadingDropin(false);
      setDropinError('Failed to load payment system. Please try again.');
    };
    document.head.appendChild(script);

    function initDropin() {
      if (!containerRef.current || !window.braintree?.dropin) {
        setLoadingDropin(false);
        setDropinError('Payment system not ready. Please try again.');
        return;
      }

      window.braintree.dropin.create({
        authorization: clientToken,
        container: containerRef.current,
        venmo: {
          allowDesktop: true,
          paymentMethodUsage: 'multi_use',
        },
      }, (err, instance) => {
        setLoadingDropin(false);
        if (err) {
          console.error('Braintree Drop-in error:', err);
          setDropinError('Failed to initialize payment. Please try again.');
          return;
        }
        setDropinInstance(instance);
      });
    }

    return () => {
      if (dropinInstance) {
        dropinInstance.teardown();
      }
    };
  }, [clientToken]);

  const handlePay = () => {
    if (!dropinInstance) return;
    dropinInstance.requestPaymentMethod((err, payload) => {
      if (err) {
        console.error('Payment method error:', err);
        return;
      }
      onPaymentMethodNonce(payload.nonce);
    });
  };

  if (dropinError) {
    return <Alert variant="danger">{dropinError}</Alert>;
  }

  return (
    <div>
      {loadingDropin && (
        <div className="text-center py-3">
          <Spinner animation="border" size="sm" className="me-2" />
          Loading payment options...
        </div>
      )}
      <div ref={containerRef}></div>
      {dropinInstance && (
        <Button
          variant="success"
          className="w-100 fw-semibold"
          onClick={handlePay}
          disabled={loading}
        >
          {loading ? 'Processing...' : `Pay $${amount}`}
        </Button>
      )}
    </div>
  );
}
