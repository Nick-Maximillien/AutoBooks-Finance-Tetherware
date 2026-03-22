'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { useAuth } from 'context/AuthContext';
import Link from 'next/link';

export default function ShopperLoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const { setTokens } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await axios.post(`${process.env.NEXT_PUBLIC_DJANGO_API_URL}/token/`, {
        username,
        password,
      });
      const { access, refresh } = res.data;
      setTokens(access, refresh);
      localStorage.setItem('user', JSON.stringify({ username }));
      router.push('/shopper_dashboard');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError('Invalid credentials. Please try again.');
        console.error('Login failed:', err.message);
      } else {
        setError('An unknown error occurred.');
        console.error('Unknown login error:', err);
      }
    }
  };

  return (
    <div className="login-section">
      <h1 className="login-title">Business Portal Login</h1>

      <form onSubmit={handleSubmit} className="login-form">
        <input
          className="input-field"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          required
        />
        <input
          className="input-field"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
        />

        <button type="submit" className="login-button">
          Login
        </button>

        {error && <p className="error-text">{error}</p>}
      </form>

      <p className="signup-redirect">
        No business account yet?{' '}
        <Link className="signup-link" href="/shopper_signup">
          Sign up
        </Link>
      </p>

      <style jsx>{`
        .login-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          width: 100%;
          max-width: 420px;
          margin: 2rem auto;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.15);
          animation: fadeIn 0.4s ease-in-out;
          font-family: 'Inter', sans-serif;
        }

        .login-title {
          color: #fff;
          font-size: 1.5rem;
          font-weight: 700;
          text-align: center;
          margin-bottom: 1.5rem;
          letter-spacing: 0.5px;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          width: 100%;
        }

        .input-field {
          background: rgba(255, 255, 255, 0.2);
          border: none;
          outline: none;
          padding: 0.9rem 1rem;
          margin-bottom: 1rem;
          border-radius: 12px;
          color: #fff;
          font-size: 1rem;
          transition: all 0.3s ease;
        }

        .input-field::placeholder {
          color: rgba(255, 255, 255, 0.7);
        }

        .input-field:focus {
          background: rgba(255, 255, 255, 0.3);
          transform: scale(1.02);
        }

        .login-button {
          background: linear-gradient(90deg, #4facfe, #00f2fe);
          border: none;
          border-radius: 12px;
          color: white;
          font-size: 1rem;
          font-weight: 600;
          padding: 0.9rem;
          cursor: pointer;
          transition: all 0.3s ease;
          letter-spacing: 0.3px;
        }

        .login-button:hover {
          background: linear-gradient(90deg, #00f2fe, #4facfe);
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
        }

        .error-text {
          color: #ff6b6b;
          margin-top: 0.5rem;
          font-size: 0.9rem;
          text-align: center;
        }

        .signup-redirect {
          color: rgba(255, 255, 255, 0.85);
          font-size: 0.9rem;
          margin-top: 1.5rem;
          text-align: center;
        }

        .signup-link {
          color: #00f2fe;
          text-decoration: none;
          font-weight: 600;
          transition: color 0.3s ease;
        }

        .signup-link:hover {
          color: #4facfe;
          text-decoration: underline;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(15px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 480px) {
          .login-section {
            width: 90%;
            padding: 1.5rem;
          }

          .login-title {
            font-size: 1.3rem;
          }

          .input-field {
            font-size: 0.95rem;
            padding: 0.8rem;
          }
        }
      `}</style>
    </div>
  );
}
