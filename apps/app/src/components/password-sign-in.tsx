'use client';

import { buildAuthCallbackUrl } from '@/utils/auth-callback';
import { Button } from '@trycompai/ui/button';
import { Input } from '@trycompai/ui/input';
import { Loader2, Lock, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface PasswordSignInProps {
  inviteCode?: string;
  redirectTo?: string;
}

export function PasswordSignIn({ inviteCode, redirectTo }: PasswordSignInProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Email and password are required');
      return;
    }
    if (isSignUp && !name) {
      toast.error('Full name is required');
      return;
    }
    setLoading(true);
    const callbackURL = buildAuthCallbackUrl({ inviteCode, redirectTo });

    try {
      const endpoint = isSignUp ? '/api/auth/sign-up/email' : '/api/auth/sign-in/email';
      const body: Record<string, string> = {
        email,
        password,
        callbackURL,
      };
      if (isSignUp) {
        body.name = name || email.split('@')[0];
      }
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        toast.error(data.error?.message || data.statusText || 'Authentication failed');
        setLoading(false);
        return;
      }
      setLoading(false);
      window.location.href = callbackURL;
    } catch (err) {
      console.error('Sign-in error:', err);
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        {isSignUp && (
          <Input
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className="h-11"
          />
        )}
        <Input
          placeholder="name@example.com"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus={!isSignUp}
          className="h-11"
          autoComplete="email"
        />
        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-11"
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
        />
        <Button
          type="submit"
          className="w-full h-11 font-medium"
          variant="default"
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isSignUp ? (
            <>
              <UserPlus className="h-4 w-4" />
              Create account
            </>
          ) : (
            <>
              <Lock className="h-4 w-4" />
              Sign in with password
            </>
          )}
        </Button>
      </form>

      <div className="text-center">
        <Button
          variant="link"
          size="sm"
          className="text-sm text-muted-foreground"
          onClick={() => {
            setIsSignUp(!isSignUp);
            setName('');
            setEmail('');
            setPassword('');
          }}
        >
          {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
        </Button>
      </div>
    </div>
  );
}
