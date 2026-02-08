import { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Table, Badge, Spinner } from 'react-bootstrap';
import { FaChartBar, FaTrophy, FaGamepad, FaMedal } from 'react-icons/fa';
import api from '../services/api';

export default function Stats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/games/stats/all')
      .then((res) => setStats(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" variant="primary" />
      </Container>
    );
  }

  if (!stats) {
    return (
      <Container className="py-5 text-center">
        <p className="text-muted">Unable to load stats.</p>
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <h2 className="fw-bold mb-4 d-flex align-items-center gap-2">
        <FaChartBar /> Stats & Results
      </h2>

      {/* Summary Cards */}
      <Row className="g-3 mb-4">
        <Col xs={6} md={4}>
          <Card className="border-0 shadow-sm text-center p-3">
            <div className="text-primary mb-1"><FaGamepad size={28} /></div>
            <h3 className="fw-bold mb-0">{stats.totalGames}</h3>
            <small className="text-muted">Total Games</small>
          </Card>
        </Col>
        <Col xs={6} md={4}>
          <Card className="border-0 shadow-sm text-center p-3">
            <div className="text-success mb-1"><FaTrophy size={28} /></div>
            <h3 className="fw-bold mb-0">{stats.completedGames}</h3>
            <small className="text-muted">Completed</small>
          </Card>
        </Col>
        <Col xs={12} md={4}>
          <Card className="border-0 shadow-sm text-center p-3">
            <div className="text-warning mb-1"><FaGamepad size={28} /></div>
            <h3 className="fw-bold mb-0">{stats.activeGames}</h3>
            <small className="text-muted">Active Games</small>
          </Card>
        </Col>
      </Row>

      <Row className="g-4">
        {/* Leaderboard */}
        <Col lg={6}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Header className="bg-white border-bottom fw-bold d-flex align-items-center gap-2">
              <FaMedal className="text-warning" /> Leaderboard
            </Card.Header>
            <Card.Body className="p-0">
              {stats.topPlayers.length === 0 ? (
                <p className="text-muted text-center py-4">No players yet</p>
              ) : (
                <Table responsive hover className="mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>#</th>
                      <th>Player</th>
                      <th className="text-center">Games</th>
                      <th className="text-center">Wins</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.topPlayers.map((player, i) => (
                      <tr key={player.id}>
                        <td>
                          {i === 0 && <Badge bg="warning" text="dark">1st</Badge>}
                          {i === 1 && <Badge bg="secondary">2nd</Badge>}
                          {i === 2 && <Badge bg="danger">3rd</Badge>}
                          {i > 2 && <span className="text-muted">{i + 1}</span>}
                        </td>
                        <td>
                          <span className="me-2">{player.avatar || '🏈'}</span>
                          {player.firstName} {player.lastName}
                        </td>
                        <td className="text-center">{player.gamesPlayed}</td>
                        <td className="text-center fw-bold">{player.wins}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </Col>

        {/* Recent Completed Games */}
        <Col lg={6}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Header className="bg-white border-bottom fw-bold d-flex align-items-center gap-2">
              <FaTrophy className="text-success" /> Recent Results
            </Card.Header>
            <Card.Body className="p-0">
              {stats.recentCompleted.length === 0 ? (
                <p className="text-muted text-center py-4">No completed games yet</p>
              ) : (
                <Table responsive hover className="mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Game</th>
                      <th>Score</th>
                      <th>Winner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentCompleted.map((game) => (
                      <tr key={game.id}>
                        <td>
                          <small className="fw-semibold">{game.name}</small>
                          <br />
                          <small className="text-muted">{game.teamRow} vs {game.teamCol}</small>
                        </td>
                        <td>
                          <small>{game.rowScore} - {game.colScore}</small>
                        </td>
                        <td>
                          <small className="fw-bold text-success">
                            {game.winner || 'Unclaimed'}
                          </small>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
