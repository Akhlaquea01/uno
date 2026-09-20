import { useState, type FormEvent, type ReactNode } from 'react';
import { api } from '../services/api';
import { getStoredIdentity, setStoredIdentity, type StoredIdentity } from '../services/identity';
import AppHeader from './AppHeader';

/** First-login identity capture (FR-019/020): blocks the app until a name + email
 * have been submitted, then never shows again for this browser. */
export default function IdentityGate({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<StoredIdentity | null>(() => getStoredIdentity());
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (identity) return <>{children}</>;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Enter your name.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.createUser({ name: name.trim(), email: email.trim() });
      const stored: StoredIdentity = { userId: res.userId, name: res.name, email: res.email };
      setStoredIdentity(stored);
      setIdentity(stored);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="identity-gate">
      <AppHeader />
      <div className="page-content">
        <form className="identity-form panel" onSubmit={submit}>
          <p className="identity-prompt">What should we call you?</p>
          <input
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            autoFocus
          />
          <input
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'One sec…' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
