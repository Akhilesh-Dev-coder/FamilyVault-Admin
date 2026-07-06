import { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc, deleteDoc, setDoc, onSnapshot, query, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiArrowLeft, FiUserX, FiTrash2, FiCheckCircle, FiAlertCircle, FiEdit2, FiSave, FiX, FiKey } from 'react-icons/fi';
import { hashPassword } from '../utils/hashUtils';
import NotificationBell from '../components/NotificationBell';

type User = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  loginMethod?: string;
  passwordHash?: string;
  mustChangePassword?: boolean;
  role?: string;
  suspended?: boolean;
  resetRequested?: boolean;
  resetRequestedAt?: any;
};

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ name: '', role: 'user' });
  const [resettingUser, setResettingUser] = useState<User | null>(null);
  const [tempPassword, setTempPassword] = useState('');
  const [resetConfirming, setResetConfirming] = useState(false);
  const [resetRequests, setResetRequests] = useState<User[]>([]);
  const navigate = useNavigate();

  const openResetPasswordModal = (user: User) => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let generatedTemp = "FV-";
    for (let i = 0; i < 6; i++) {
      generatedTemp += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setTempPassword(generatedTemp);
    setResettingUser(user);
  };

  const handleConfirmReset = async () => {
    if (!resettingUser) return;
    
    setResetConfirming(true);
    try {
      const userRef = doc(db, 'Users', resettingUser.id);
      const hashedTemp = hashPassword(tempPassword);
      
      await updateDoc(userRef, {
        passwordHash: hashedTemp,
        mustChangePassword: true,
        resetRequested: false,
        resetRequestedAt: null
      });
      
      alert(`Password for ${resettingUser.name} has been reset successfully. Temporary password is: ${tempPassword}`);
      setResettingUser(null);
    } catch (error: any) {
      console.error("Error resetting password:", error);
      alert("Failed to reset password: " + error.message);
    } finally {
      setResetConfirming(false);
    }
  };

  const handleResolveRequest = async (userId: string) => {
    try {
      const userRef = doc(db, "Users", userId);
      await updateDoc(userRef, {
        resetRequested: false,
        resetRequestedAt: null
      });
    } catch (err: any) {
      console.error("Error resolving request:", err);
      alert("Failed to resolve request: " + err.message);
    }
  };

  const handleResetFromRequest = (user: User) => {
    openResetPasswordModal(user);
  };

  useEffect(() => {
    // Real-time listener for pending password reset requests inside the Users collection
    const q = query(
      collection(db, "Users"),
      where("resetRequested", "==", true)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const requestsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as User[];

      // Sort by resetRequestedAt descending locally
      requestsData.sort((a, b) => {
        const timeA = a.resetRequestedAt?.seconds || 0;
        const timeB = b.resetRequestedAt?.seconds || 0;
        return timeB - timeA;
      });

      setResetRequests(requestsData);
    }, (err) => {
      console.error("Error subscribing to reset requests:", err);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchUsers();
      } else {
        setLoading(false);
        setError("You must be logged in to view users");
      }
    });

    return () => unsubscribe();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      // Try both common casing options
      const collectionsToTry = ['users', 'Users', 'user', 'User'];
      let foundUsers: User[] = [];
      let debugInfo = [];

      for (const colName of collectionsToTry) {
        console.log(`Trying collection: ${colName}`);
        try {
          const snapshot = await getDocs(collection(db, colName));
          console.log(`${colName}: Found ${snapshot.size} docs`);

          if (!snapshot.empty) {
            const data = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            })) as User[];
            foundUsers = [...foundUsers, ...data];
            debugInfo.push(`${colName} (${snapshot.size})`);
          }
        } catch (e: any) {
          console.log(`Failed to fetch ${colName}`, e);
          if (colName === 'Users') {
            // Capture this specific error because we know 'Users' is the correct one
            setError(`Failed to load 'Users' collection: ${e.message}`);
          }
        }
      }

      // Remove duplicates by ID just in case
      const uniqueUsers = Array.from(new Map(foundUsers.map(item => [item.id, item])).values());

      if (uniqueUsers.length === 0 && debugInfo.length === 0) {
        console.warn("No users found in any collection variants");
      } else {
        console.log(`Total unique users found: ${uniqueUsers.length}`);
      }

      setUsers(uniqueUsers);
      setFilteredUsers(uniqueUsers);
    } catch (err: any) {
      console.error("Error fetching users:", err);
      setError(err.message || "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredUsers(
        users.filter(u =>
          (u.name?.toLowerCase() || '').includes(query) ||
          (u.email?.toLowerCase() || '').includes(query) ||
          (u.phone || '').includes(query)
        )
      );
    }
  }, [searchQuery, users]);

  const handleSuspend = async (userId: string, currentStatus?: boolean) => {
    try {
      const userRef = doc(db, 'Users', userId);
      await updateDoc(userRef, {
        suspended: !currentStatus
      });
      // Update local state
      setUsers(users.map(u => u.id === userId ? { ...u, suspended: !currentStatus } : u));
    } catch (error) {
      console.error("Error updating user suspension:", error);
      alert("Failed to update user status");
    }
  };

  const handleDelete = async (userId: string) => {
    if (!window.confirm("Are you sure you want to delete this user? This action cannot be undone.")) return;

    try {
      await deleteDoc(doc(db, 'Users', userId));
      setUsers(users.filter(u => u.id !== userId));
    } catch (error) {
      console.error("Error deleting user:", error);
      alert("Failed to delete user");
    }
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setEditForm({
      name: user.name || '',
      role: user.role || 'user'
    });
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;

    try {
      const userRef = doc(db, 'Users', editingUser.id);
      await updateDoc(userRef, {
        name: editForm.name
        // role: editForm.role // Role editing disabled
      });

      setUsers(users.map(u =>
        u.id === editingUser.id
          ? { ...u, name: editForm.name }
          : u
      ));
      setEditingUser(null);
    } catch (error) {
      console.error("Error updating user:", error);
      alert("Failed to update user");
    }
  };

  const runDebug = async () => {
    try {
      const testId = "debug_" + Date.now();
      console.log("Attempting to write debug doc:", testId);
      await setDoc(doc(db, "Users", testId), {
        name: "Debug User",
        email: "debug@test.com",
        role: "user",
        createdAt: "Just now"
      });
      alert("Debug doc created! Refreshing...");
      fetchUsers();
    } catch (e: any) {
      console.error("Debug write failed:", e);
      alert("Debug write failed: " + e.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      {/* Header */}
      <header className="bg-gray-800 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8
                        flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 hover:bg-gray-700 rounded-full transition"
            >
              <FiArrowLeft className="text-xl" />
            </button>
            <h1 className="text-xl sm:text-2xl font-bold">User Management</h1>
            <button onClick={runDebug} className="text-xs bg-gray-700 px-2 py-1 rounded border border-gray-600">Debug</button>
          </div>

          <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
            <div className="relative w-full sm:w-72">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-700 rounded-lg
                           text-white placeholder-gray-400
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <NotificationBell />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Reset Requests Section */}
        {!loading && resetRequests.length > 0 && (
          <div className="mb-8 bg-amber-500/10 border border-amber-500/20 rounded-xl p-6 shadow-lg">
            <h2 className="text-lg font-bold text-amber-400 mb-4 flex items-center gap-2">
              <FiKey /> Pending Password Reset Requests ({resetRequests.length})
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {resetRequests.map((req) => {
                return (
                  <div key={req.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-col justify-between gap-4 text-left">
                    <div>
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-semibold text-white tracking-wide">
                          {req.phone || 'No Phone'}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono">
                          {req.resetRequestedAt?.seconds 
                            ? new Date(req.resetRequestedAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : 'Just now'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                        Matches user: <span className="font-semibold text-amber-300">{req.name || 'N/A'}</span>
                      </p>
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t border-gray-700/50">
                      <button
                        onClick={() => handleResolveRequest(req.id)}
                        className="px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-700 hover:text-white rounded-lg transition"
                      >
                        Dismiss
                      </button>
                      <button
                        onClick={() => handleResetFromRequest(req)}
                        className="px-3 py-1.5 text-xs bg-amber-500 text-gray-900 font-bold hover:bg-amber-400 rounded-lg transition flex items-center gap-1"
                      >
                        <FiKey className="text-[10px]" /> Reset Password
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading users...</div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6 text-center">
            <p className="text-red-500 font-semibold mb-2">Error Loading Users</p>
            <p className="text-red-400 text-sm font-mono">{error}</p>
            <button
              onClick={fetchUsers}
              className="mt-4 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-md transition"
            >
              Retry
            </button>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-20">
            <FiSearch className="mx-auto text-4xl text-gray-600 mb-4" />
            <p className="text-gray-400">No users found</p>
          </div>
        ) : (
          <>
            {/* Desktop View (Table) */}
            <div className="hidden sm:block overflow-x-auto bg-gray-800 rounded-xl shadow border border-gray-700">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-700 text-gray-400 text-sm uppercase">
                    <th className="p-4 font-medium">Name</th>
                    <th className="p-4 font-medium">Email</th>
                    <th className="p-4 font-medium">Role</th>
                    <th className="p-4 font-medium">Status</th>
                    <th className="p-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {filteredUsers.map(user => (
                    <tr key={user.id} className="hover:bg-gray-750 transition">
                      <td className="p-4 font-medium">{user.name || 'N/A'}</td>
                      <td className="p-4 text-gray-400">
                        {user.phone ? (
                          <span className="flex flex-col text-left">
                            <span className="font-semibold text-blue-400">{user.phone}</span>
                            <span className="text-xs text-slate-500">Phone User</span>
                          </span>
                        ) : (
                          user.email || 'N/A'
                        )}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border ${user.role === 'admin'
                          ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                          : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          }`}>
                          {user.role === 'admin' ? 'Admin' : 'User'}
                        </span>
                      </td>
                      <td className="p-4">
                        {user.suspended ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-500 border border-red-500/20">
                            <FiAlertCircle /> Suspended
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-green-500/10 text-green-500 border border-green-500/20">
                            <FiCheckCircle /> Active
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right space-x-2">
                        {user.phone && (
                          <button
                            onClick={() => openResetPasswordModal(user)}
                            title="Reset Password"
                            className="p-2 bg-amber-600/20 text-amber-400 rounded-lg hover:bg-amber-600/30 transition inline-flex items-center"
                          >
                            <FiKey />
                          </button>
                        )}
                        <button
                          onClick={() => openEditModal(user)}
                          title="Edit User"
                          className="p-2 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30 transition inline-flex items-center"
                        >
                          <FiEdit2 />
                        </button>
                        <button
                          onClick={() => handleSuspend(user.id, user.suspended)}
                          title={user.suspended ? "Activate User" : "Suspend User"}
                          className={`p-2 rounded-lg transition inline-flex items-center ${user.suspended
                            ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                            : 'bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30'
                            }`}
                        >
                          {user.suspended ? <FiCheckCircle /> : <FiUserX />}
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          title="Delete User"
                          className="p-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 transition inline-flex items-center"
                        >
                          <FiTrash2 />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile View (Cards) */}
            <div className="block sm:hidden space-y-4">
              {filteredUsers.map(user => (
                <div key={user.id} className="bg-gray-800 rounded-xl p-4 border border-gray-700 shadow-md">
                  <div className="flex justify-between items-start mb-3 text-left">
                    <div>
                      <h3 className="font-bold text-lg text-white">{user.name || 'N/A'}</h3>
                      <p className="text-sm text-gray-400">
                        {user.phone ? (
                          <span className="text-blue-400 font-semibold">{user.phone} (Phone)</span>
                        ) : (
                          user.email || 'N/A'
                        )}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-semibold border ${user.role === 'admin'
                      ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                      : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      }`}>
                      {user.role === 'admin' ? 'Admin' : 'User'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-700">
                    <div className="flex items-center">
                      {user.suspended ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-400">
                          <FiAlertCircle /> Suspended
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-400">
                          <FiCheckCircle /> Active
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2">
                      {user.phone && (
                        <button
                          onClick={() => openResetPasswordModal(user)}
                          className="p-2 bg-amber-600/20 text-amber-400 rounded-lg hover:bg-amber-600/30 flex items-center"
                        >
                          <FiKey />
                        </button>
                      )}
                      <button
                        onClick={() => openEditModal(user)}
                        className="p-2 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30 flex items-center"
                      >
                        <FiEdit2 />
                      </button>
                      <button
                        onClick={() => handleSuspend(user.id, user.suspended)}
                        className={`p-2 rounded-lg flex items-center ${user.suspended
                          ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                          : 'bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30'
                          }`}
                      >
                        {user.suspended ? <FiCheckCircle /> : <FiUserX />}
                      </button>
                      <button
                        onClick={() => handleDelete(user.id)}
                        className="p-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 flex items-center"
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>


      {/* Edit Modal */}
      {
        editingUser && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-2xl shadow-xl w-full max-w-md border border-gray-700">
              <div className="p-6 border-b border-gray-700 flex justify-between items-center">
                <h2 className="text-xl font-bold">Edit User</h2>
                <button
                  onClick={() => setEditingUser(null)}
                  className="text-gray-400 hover:text-white transition"
                >
                  <FiX className="text-xl" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Role editing disabled per request */}
                {/* <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                Role
              </label>
              <div className="px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-gray-400 cursor-not-allowed">
                  {editForm.role === 'admin' ? 'Admin' : 'User'}
              </div>
            </div> */}

                <div className="pt-4 flex gap-3 justify-end">
                  <button
                    onClick={() => setEditingUser(null)}
                    className="px-4 py-2 text-gray-400 hover:bg-gray-700 rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdateUser}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition flex items-center gap-2"
                  >
                    <FiSave />
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Reset Password Modal */}
      {
        resettingUser && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 text-left">
            <div className="bg-gray-800 rounded-2xl shadow-xl w-full max-w-md border border-gray-700">
              <div className="p-6 border-b border-gray-700 flex justify-between items-center">
                <h2 className="text-xl font-bold flex items-center gap-2 text-amber-400">
                  <FiKey /> Reset Password
                </h2>
                <button
                  onClick={() => setResettingUser(null)}
                  className="text-gray-400 hover:text-white transition"
                >
                  <FiX className="text-xl" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-sm text-gray-300">
                  Resetting password for <span className="font-bold text-white">{resettingUser.name}</span> ({resettingUser.phone}).
                </p>

                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 space-y-2">
                  <span className="block text-xs font-semibold text-amber-400 uppercase tracking-wider">Temporary Password</span>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-2xl font-bold text-white tracking-widest">{tempPassword}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(tempPassword);
                        alert("Copied to clipboard!");
                      }}
                      className="text-xs bg-amber-500/20 text-amber-300 px-3 py-1.5 rounded-lg hover:bg-amber-500/30 transition font-bold"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                <p className="text-xs text-gray-400 leading-relaxed">
                  Upon saving, this temporary password will be stored. The user will be required to change this temporary password immediately after they log in.
                </p>

                <div className="pt-4 flex gap-3 justify-end">
                  <button
                    onClick={() => setResettingUser(null)}
                    className="px-4 py-2 text-gray-400 hover:bg-gray-700 rounded-lg transition"
                    disabled={resetConfirming}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmReset}
                    className="px-4 py-2 bg-amber-500 text-gray-900 font-semibold rounded-lg hover:bg-amber-400 transition flex items-center gap-2"
                    disabled={resetConfirming}
                  >
                    {resetConfirming ? "Saving..." : "Confirm Reset"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}
