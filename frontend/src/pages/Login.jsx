import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await authAPI.login({ username, password });
      if (data.success) {
        login(data.data.token, data.data.user);
        navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: isDark ? '#0c1320' : '#f0f4f8', position: 'relative', overflow: 'hidden',
    }}>
      {/* Background glows */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '20%', left: '20%', width: 360, height: 360, background: 'rgba(26,191,148,0.1)', borderRadius: '50%', filter: 'blur(70px)' }} />
        <div style={{ position: 'absolute', bottom: '20%', right: '20%', width: 360, height: 360, background: 'rgba(52,211,153,0.07)', borderRadius: '50%', filter: 'blur(70px)' }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55 }}
        style={{
          position: 'relative', width: '100%', maxWidth: 420, margin: '0 16px',
          padding: 36, borderRadius: 24,
          background: isDark ? '#181e27' : 'white',
          border: `1px solid ${isDark ? '#252f3e' : '#e5e7eb'}`,
          boxShadow: '0 24px 60px rgba(0,0,0,0.2)',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
            style={{
              width: 60, height: 60, borderRadius: 18,
              background: 'linear-gradient(135deg, #1abf94, #107f61)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(26,191,148,0.35)', marginBottom: 14,
            }}
          >
            <span style={{ color: 'white', fontWeight: 800, fontSize: 26 }}>F</span>
          </motion.div>

          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
            <span style={{ color: isDark ? '#e5e7eb' : '#111827' }}>Finance</span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 20, height: 20, borderRadius: '50%',
              background: 'linear-gradient(135deg, #1abf94, #107f61)',
              color: 'white', fontSize: 11, fontWeight: 800, margin: '0 2px',
              verticalAlign: 'middle',
            }}>m</span>
            <span style={{ color: isDark ? '#e5e7eb' : '#111827' }}>re</span>
          </h1>
          <p style={{ fontSize: 13, marginTop: 6, color: isDark ? '#6b7280' : '#9ca3af', margin: '6px 0 0' }}>
            Your Personal Finance Dashboard
          </p>
        </div>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              marginBottom: 16, padding: '10px 14px', borderRadius: 10,
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
              color: '#ef4444', fontSize: 13, textAlign: 'center',
            }}
          >
            {error}
          </motion.div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: isDark ? '#d1d5db' : '#374151' }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input-field"
              placeholder="Enter username"
              required
              autoFocus
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: isDark ? '#d1d5db' : '#374151' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="Enter password"
                required
                style={{ paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: isDark ? '#6b7280' : '#9ca3af', padding: 0, display: 'flex',
                }}
              >
                {showPassword
                  ? <EyeSlashIcon style={{ width: 18, height: 18 }} />
                  : <EyeIcon style={{ width: 18, height: 18 }} />
                }
              </button>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ width: '100%', padding: '12px', fontSize: 15, fontWeight: 700, justifyContent: 'center', marginTop: 4 }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                <span style={{
                  width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.9s linear infinite',
                }} />
                Signing in...
              </span>
            ) : 'Sign In'}
          </motion.button>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </form>

        <p style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: isDark ? '#8b949e' : '#6b7280' }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: '#1abf94', fontWeight: 600, textDecoration: 'none' }}>
            Sign Up
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
