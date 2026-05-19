import { GoogleLogin } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import { googleAuth } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSuccess(response) {
    try {
      const data = await googleAuth(response.credential);
      login(data.access_token, data.email, data.name);
      navigate('/', { replace: true });
    } catch (err) {
      alert(err.message || 'Sign-in failed');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <div className="text-center space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900 italic">Bookshelf</h1>
          <p className="text-stone-500 text-sm mt-1">Sign in to access your catalog</p>
        </div>
        <div className="flex justify-center">
          <GoogleLogin
            onSuccess={handleSuccess}
            onError={() => alert('Google sign-in failed')}
            useOneTap
          />
        </div>
      </div>
    </div>
  );
}
