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
    <div className="min-h-screen flex items-center justify-center bg-deep">
      <div className="text-center space-y-8 px-6">
        <div className="space-y-2">
          <h1 className="font-display italic text-chalk text-4xl tracking-wide">Bookshelf</h1>
          <p className="text-mist text-sm">Your personal library, catalogued.</p>
        </div>
        <div className="flex justify-center">
          <GoogleLogin
            onSuccess={handleSuccess}
            onError={() => alert('Google sign-in failed')}
            useOneTap
            theme="filled_black"
            shape="pill"
          />
        </div>
      </div>
    </div>
  );
}
