import { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert } from 'react-bootstrap';
import { FaUser } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const AVATAR_OPTIONS = [
  '', '🏈', '🏆', '⭐', '🎯', '🦅', '🐻', '🦁', '🐬',
  '🐎', '🐺', '🦬', '🐆', '🐏', '🦌', '🐅', '🐊',
];

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    avatar: '',
    currentPassword: '',
    newPassword: '',
  });
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        avatar: user.avatar || '',
        currentPassword: '',
        newPassword: '',
      });
    }
  }, [user]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const payload = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        avatar: formData.avatar,
      };

      if (formData.newPassword) {
        payload.currentPassword = formData.currentPassword;
        payload.newPassword = formData.newPassword;
      }

      const res = await api.put('/users/profile', payload);
      updateUser(res.data);
      setSuccess('Profile updated successfully');
      setFormData((prev) => ({ ...prev, currentPassword: '', newPassword: '' }));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container className="py-4">
      <Row className="justify-content-center">
        <Col xs={12} md={8} lg={6}>
          <h2 className="fw-bold mb-4 d-flex align-items-center gap-2">
            <FaUser /> My Profile
          </h2>

          <Card className="shadow-sm border-0">
            <Card.Body className="p-4">
              {success && <Alert variant="success" dismissible onClose={() => setSuccess('')}>{success}</Alert>}
              {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}

              <Form onSubmit={handleSubmit}>
                {/* Avatar Selection */}
                <Form.Group className="mb-4">
                  <Form.Label className="fw-semibold">Avatar</Form.Label>
                  <div className="d-flex flex-wrap gap-2">
                    {AVATAR_OPTIONS.map((av) => (
                      <button
                        key={av || 'none'}
                        type="button"
                        className={`btn btn-outline-secondary d-flex align-items-center justify-content-center ${
                          formData.avatar === av ? 'active border-primary border-2' : ''
                        }`}
                        style={{ width: 48, height: 48, fontSize: '1.5rem' }}
                        onClick={() => setFormData({ ...formData, avatar: av })}
                      >
                        {av || <FaUser size={16} />}
                      </button>
                    ))}
                  </div>
                </Form.Group>

                <Row>
                  <Col xs={6}>
                    <Form.Group className="mb-3" controlId="firstName">
                      <Form.Label>First Name</Form.Label>
                      <Form.Control
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleChange}
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col xs={6}>
                    <Form.Group className="mb-3" controlId="lastName">
                      <Form.Label>Last Name</Form.Label>
                      <Form.Control
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleChange}
                        required
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <Form.Group className="mb-3" controlId="email">
                  <Form.Label>Email</Form.Label>
                  <Form.Control
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </Form.Group>

                <hr className="my-4" />
                <h6 className="text-muted mb-3">Change Password (optional)</h6>

                <Form.Group className="mb-3" controlId="currentPassword">
                  <Form.Label>Current Password</Form.Label>
                  <Form.Control
                    type="password"
                    name="currentPassword"
                    value={formData.currentPassword}
                    onChange={handleChange}
                  />
                </Form.Group>
                <Form.Group className="mb-4" controlId="newPassword">
                  <Form.Label>New Password</Form.Label>
                  <Form.Control
                    type="password"
                    name="newPassword"
                    value={formData.newPassword}
                    onChange={handleChange}
                    minLength={6}
                  />
                </Form.Group>

                <Button type="submit" variant="primary" className="w-100 fw-semibold" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Changes'}
                </Button>
              </Form>
            </Card.Body>
          </Card>

          <Card className="mt-4 shadow-sm border-0">
            <Card.Body>
              <small className="text-muted">
                Member since: {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
              </small>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
