'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from 'context/AuthContext';
import { setTokensInLocalStorage } from '@utils/tokenUtils';

export default function ShopperSignup() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { setTokens } = useAuth();
  const router = useRouter();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_DJANGO_API_URL}/signup/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.detail || 'Signup failed');

      const access = data.access || data.token?.access;
      const refresh = data.refresh || data.token?.refresh;
      if (!access || !refresh) throw new Error('Invalid response from server');

      setTokensInLocalStorage(access, refresh);
      setTokens(access, refresh);
      localStorage.setItem('user', JSON.stringify({ username, email }));
      router.push('/shopper_dashboard');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || 'Something went wrong');
      } else {
        setError('An unexpected error occurred');
      }
    }
  };

  return (
    <div className="signup-section">
      <h1 className="signup-title">Create Your Business Account</h1>

      <form onSubmit={handleSignUp} className="signup-form">
        <input
          className="input-field"
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          className="input-field"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="input-field"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button type="submit" className="signup-button">Sign Up</button>

        {error && <p className="error-text">{error}</p>}
      </form>

      <p className="login-redirect">
        <Link className="login-link" href="/shopper_login">
          Already have an account? Log in
        </Link>
      </p>

      <style jsx>{`
        .signup-section {
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

        .signup-title {
          color: #fff;
          font-size: 1.5rem;
          font-weight: 700;
          text-align: center;
          margin-bottom: 1.5rem;
          letter-spacing: 0.5px;
        }

        .signup-form {
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

        .signup-button {
          background: linear-gradient(90deg, #00f2fe, #4facfe);
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

        .signup-button:hover {
          background: linear-gradient(90deg, #4facfe, #00f2fe);
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
        }

        .error-text {
          color: #ff6b6b;
          margin-top: 0.5rem;
          font-size: 0.9rem;
          text-align: center;
        }

        .login-redirect {
          color: rgba(255, 255, 255, 0.85);
          font-size: 0.9rem;
          margin-top: 1.5rem;
          text-align: center;
        }

        .login-link {
          color: #00f2fe;
          text-decoration: none;
          font-weight: 600;
          transition: color 0.3s ease;
        }

        .login-link:hover {
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
          .signup-section {
            width: 90%;
            padding: 1.5rem;
          }

          .signup-title {
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
