import { FormEvent, useState } from 'react';
import { apiFetch } from '../lib/api';

export function OAuthDeviceVerifyPage() {
  const [userCode, setUserCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    const res = await apiFetch('/api/v1/oauth/device/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_code: userCode }),
    });
    if (!res.ok) {
      const body = (await res.json()) as { message?: string };
      setMessage(body.message ?? 'Verification failed');
      return;
    }
    setMessage('Device authorized. Return to the CLI.');
  };

  return (
    <div style={{ padding: 32, maxWidth: 480 }}>
      <h1>Authorize CLI device</h1>
      <form onSubmit={onSubmit}>
        <label>
          User code
          <input
            value={userCode}
            onChange={(e) => setUserCode(e.target.value)}
            placeholder="XXXX-XXXX"
            style={{ display: 'block', width: '100%', marginTop: 8 }}
          />
        </label>
        <button type="submit" style={{ marginTop: 12 }}>
          Authorize
        </button>
      </form>
      {message && <p style={{ marginTop: 16 }}>{message}</p>}
    </div>
  );
}
