import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { FiBell } from 'react-icons/fi';

export default function NotificationBell() {
  const [count, setCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const q = query(
      collection(db, 'Users'),
      where('resetRequested', '==', true)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCount(snapshot.size);
    }, (err) => {
      console.error("Error listening to password reset requests:", err);
    });

    return () => unsubscribe();
  }, []);

  return (
    <button
      onClick={() => navigate('/users')}
      className="relative p-2.5 bg-slate-900 border border-white/10 hover:border-blue-500/50 hover:bg-slate-800 rounded-xl transition text-slate-400 hover:text-white cursor-pointer group flex items-center justify-center shrink-0"
      title={count > 0 ? `${count} pending password reset requests` : "No pending password reset requests"}
    >
      <div className="absolute inset-0 bg-blue-500/10 blur-lg opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
      <FiBell className="text-xl relative z-10" />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-950 shadow-md animate-pulse z-20">
          {count}
        </span>
      )}
    </button>
  );
}
