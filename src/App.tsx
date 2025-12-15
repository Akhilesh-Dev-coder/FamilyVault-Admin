import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import { useEffect, useState, type ReactNode, lazy, Suspense } from 'react';

// ✅ Keep Login eager (small + critical)
import Login from './pages/Login';

// ✅ Lazy-loaded pages (heavy)
const Dashboard = lazy(() => import('./pages/Dashboard'));
const FamilyEditor = lazy(() => import('./pages/FamilyEditor'));

function FullPageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
      Loading...
    </div>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) return <FullPageLoader />;

  // ✅ Proper redirect (no hard reload)
  if (!user) return <Navigate to="/login" replace />;

  return <>{children}</>;
}

export default function App() {
  return (
    <div className="bg-gray-900 min-h-screen text-gray-100">
      <BrowserRouter>
        <Suspense fallback={<FullPageLoader />}>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/family/:id"
              element={
                <ProtectedRoute>
                  <FamilyEditor />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </div>
  );
}
