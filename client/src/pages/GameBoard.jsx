import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container, Row, Col, Card, Button, Badge, Alert,
  Spinner, Modal, Form, OverlayTrigger, Tooltip,
} from 'react-bootstrap';
import { FaLock, FaTrophy, FaArrowLeft, FaCheck } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function GameBoard() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [scores, setScores] = useState({ rowScore: '', colScore: '' });

  const fetchGame = useCallback(async () => {
    try {
      const res = await api.get(`/games/${id}`);
      setGame(res.data);
    } catch (err) {
      setError('Game not found');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchGame();
  }, [fetchGame]);

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

  const handleComplete = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setError('');
    try {
      const res = await api.post(`/games/${id}/complete`, {
        rowScore: parseInt(scores.rowScore, 10),
        colScore: parseInt(scores.colScore, 10),
      });
      setGame(res.data);
      setShowComplete(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to complete game');
    } finally {
      setActionLoading(false);
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
        <p className="text-muted">Game not found.</p>
        <Button variant="primary" onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
      </Container>
    );
  }

  const isCreator = user?.id === game.creatorId;
  const gridSize = game.gridSize;

  // Build a lookup for squares
  const squareMap = {};
  for (const sq of game.squares) {
    squareMap[`${sq.row}-${sq.col}`] = sq;
  }

  // Find winning square if game is completed
  let winRow = -1;
  let winCol = -1;
  if (game.status === 'completed' && game.numbersRow && game.numbersCol) {
    const rowLastDigit = game.rowScore % 10;
    const colLastDigit = game.colScore % 10;
    winRow = game.numbersRow.indexOf(rowLastDigit);
    winCol = game.numbersCol.indexOf(colLastDigit);
  }

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
            </div>
            <div className="text-end">
              <StatusBadge status={game.status} />
              {game.status === 'completed' && (
                <div className="mt-2">
                  <div className="fw-bold">{game.rowScore} - {game.colScore}</div>
                  {game.winner && (
                    <Badge bg="success" className="mt-1">
                      <FaTrophy className="me-1" /> {game.winner}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Creator Actions */}
          {isCreator && game.status === 'open' && (
            <div className="mt-3 pt-3 border-top">
              <Button variant="warning" size="sm" className="fw-semibold" onClick={handleLock}>
                <FaLock className="me-1" /> Lock Board & Generate Numbers
              </Button>
            </div>
          )}
          {isCreator && game.status === 'locked' && (
            <div className="mt-3 pt-3 border-top">
              <Button variant="success" size="sm" className="fw-semibold" onClick={() => setShowComplete(true)}>
                <FaCheck className="me-1" /> Enter Final Score
              </Button>
            </div>
          )}
        </Card.Body>
      </Card>

      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}

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
                    style={{ width: 80, height: 36, fontSize: '0.9rem' }}
                  >
                    {game.numbersCol ? game.numbersCol[c] : '?'}
                  </div>
                ))}
              </div>

              {/* Grid rows */}
              {Array.from({ length: gridSize }).map((_, r) => (
                <div key={r} className="d-flex">
                  {/* Row number */}
                  <div
                    className="d-flex align-items-center justify-content-center fw-bold bg-primary text-white"
                    style={{ width: 50, height: 80, fontSize: '0.9rem' }}
                  >
                    {game.numbersRow ? game.numbersRow[r] : '?'}
                  </div>

                  {/* Squares */}
                  {Array.from({ length: gridSize }).map((_, c) => {
                    const sq = squareMap[`${r}-${c}`];
                    const isMine = sq?.userId === user?.id;
                    const isTaken = !!sq?.userId;
                    const isWinner = r === winRow && c === winCol;
                    const canPick = game.status === 'open' && !isTaken;
                    const canUnpick = game.status === 'open' && isMine;

                    let bgClass = 'bg-light border';
                    if (isWinner) bgClass = 'bg-warning border border-warning';
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
                        {isWinner && (
                          <FaTrophy className="text-warning position-absolute" style={{ top: 4, right: 4, fontSize: '0.7rem' }} />
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
                            <Tooltip>{sq.firstName} {sq.lastName}</Tooltip>
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
            {game.status === 'completed' && (
              <div className="d-flex align-items-center gap-2">
                <div className="bg-warning border border-warning" style={{ width: 20, height: 20 }}></div>
                <small>Winner</small>
              </div>
            )}
          </div>
        </Card.Body>
      </Card>

      {/* Complete Game Modal */}
      <Modal show={showComplete} onHide={() => setShowComplete(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="fw-bold">Enter Final Score</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleComplete}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>{game.teamRow} Score</Form.Label>
              <Form.Control
                type="number"
                min="0"
                value={scores.rowScore}
                onChange={(e) => setScores({ ...scores, rowScore: e.target.value })}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>{game.teamCol} Score</Form.Label>
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
            <Button variant="secondary" onClick={() => setShowComplete(false)}>Cancel</Button>
            <Button variant="success" type="submit" className="fw-semibold" disabled={actionLoading}>
              {actionLoading ? 'Saving...' : 'Complete Game'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Container>
  );
}

function StatusBadge({ status }) {
  const map = {
    open: { bg: 'success', label: 'Open' },
    locked: { bg: 'warning', label: 'Locked' },
    completed: { bg: 'secondary', label: 'Completed' },
  };
  const s = map[status] || map.open;
  return <Badge bg={s.bg}>{s.label}</Badge>;
}
