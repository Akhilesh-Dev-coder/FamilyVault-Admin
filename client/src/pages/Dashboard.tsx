// src/pages/Dashboard.tsx
import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiUser, FiUsers, FiHome, FiCalendar, FiActivity, FiClock } from 'react-icons/fi';

// Recursive type for family tree structure
type FamilyMember = {
  id: string;
  name: string;
  spouseObj?: FamilyMember;
  children?: FamilyMember[];
};

// Helper: Recursively count all members in a family tree
const countMembers = (node: FamilyMember | undefined): number => {
  if (!node) return 0;
  let count = 1; // Count self

  if (node.spouseObj) {
    count += 1; // Count spouse
  }

  if (node.children && Array.isArray(node.children)) {
    node.children.forEach(child => {
      count += countMembers(child); // Recursively count children
    });
  }

  return count;
};

export default function Dashboard() {
  const [families, setFamilies] = useState<FamilyMember[]>([]);
  const [filteredFamilies, setFilteredFamilies] = useState<FamilyMember[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Smart Stats
  const [totalUsers, setTotalUsers] = useState(0);
  const [upcomingEvents, setUpcomingEvents] = useState(0);
  const [totalMembers, setTotalMembers] = useState(0);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        // Fetch all data in parallel for speed
        const [familiesSnap, usersSnap, programsSnap] = await Promise.all([
          getDocs(collection(db, 'families')),
          getDocs(collection(db, 'Users')),
          getDocs(collection(db, 'programs'))
        ]);

        // 1. Families & Members
        const familiesData = familiesSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as FamilyMember[];

        familiesData.sort((a, b) => {
          const idA = parseInt(a.id.replace(/\D/g, '') || '0');
          const idB = parseInt(b.id.replace(/\D/g, '') || '0');
          return idA - idB;
        });

        setFamilies(familiesData);
        setFilteredFamilies(familiesData);

        // Calculate total members across all families using recursive helper
        const membersCount = familiesData.reduce((acc, fam) => acc + countMembers(fam), 0);
        setTotalMembers(membersCount);

        // 2. Users
        setTotalUsers(usersSnap.size);

        // 3. Upcoming Events
        const today = new Date().toISOString().split('T')[0];
        const activePrograms = programsSnap.docs.filter(doc => {
          const data = doc.data();
          return data.status === 'Upcoming' && data.date >= today;
        }).length;
        setUpcomingEvents(activePrograms);

      } catch (error) {
        console.error("Error loading dashboard:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredFamilies(families);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredFamilies(
        families.filter(f =>
          f.name.toLowerCase().includes(query) ||
          f.id.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, families]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-blue-500/30">

      {/* 🌌 Ambient Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-900/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-900/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">

        {/* 🟢 Glass Navbar */}
        <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-white/5">
          <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">

            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="relative group cursor-pointer" onClick={() => navigate('/')}>
                <div className="absolute inset-0 bg-blue-500 blur-lg opacity-20 group-hover:opacity-40 transition-opacity" />
                <div className="relative bg-slate-900 border border-white/10 p-2 rounded-xl">
                  <FiActivity className="text-blue-400 text-xl" />
                </div>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">FamilyVault</h1>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Admin Console</span>
                </div>
              </div>
            </div>

            {/* Navigation Pills */}
            <nav className="flex items-center bg-slate-900/50 p-1 rounded-full border border-white/5 overflow-x-auto max-w-full">
              <button
                onClick={() => navigate('/programs')}
                className="px-4 py-1.5 text-sm font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 hover:text-emerald-300 rounded-full transition-all flex items-center gap-2 whitespace-nowrap"
              >
                <FiCalendar size={14} /> Programs
              </button>
              <button
                onClick={() => navigate('/users')}
                className="px-4 py-1.5 text-sm font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 hover:text-blue-300 rounded-full transition-all flex items-center gap-2 whitespace-nowrap"
              >
                <FiUsers size={14} /> Users
              </button>
            </nav>
          </div>
        </header>

        {/* 🚀 Dashboard Content */}
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8">

          {/* Welcome Section */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold text-white tracking-tight">Dashboard Overview</h2>
              <p className="text-slate-400 mt-1">Real-time metrics and management</p>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/50 border border-white/5 rounded-full text-xs font-mono text-slate-400">
              <FiClock className="text-blue-400" />
              <span>{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</span>
            </div>
          </div>

          {/* 📊 Smart Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

            {/* Card: Total Families */}
            <div className="group relative p-6 bg-slate-900/40 border border-white/5 rounded-2xl hover:bg-slate-900/60 hover:border-blue-500/30 transition-all duration-300">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400 group-hover:bg-blue-500/20 transition-colors">
                  <FiHome size={24} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-400">Total Families</p>
                  <h3 className="text-2xl font-bold text-white">{families.length}</h3>
                </div>
              </div>
              <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full w-[70%] group-hover:w-[80%] transition-all duration-1000" />
              </div>
            </div>

            {/* Card: Total Members */}
            <div className="group relative p-6 bg-slate-900/40 border border-white/5 rounded-2xl hover:bg-slate-900/60 hover:border-purple-500/30 transition-all duration-300">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400 group-hover:bg-purple-500/20 transition-colors">
                  <FiUsers size={24} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-400">Total Members</p>
                  <h3 className="text-2xl font-bold text-white">{totalMembers}</h3>
                </div>
              </div>
              <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                <div className="bg-purple-500 h-full w-[45%] group-hover:w-[55%] transition-all duration-1000" />
              </div>
            </div>

            {/* Card: App Users */}
            <div className="group relative p-6 bg-slate-900/40 border border-white/5 rounded-2xl hover:bg-slate-900/60 hover:border-cyan-500/30 transition-all duration-300">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-cyan-500/10 rounded-xl text-cyan-400 group-hover:bg-cyan-500/20 transition-colors">
                  <FiUser size={24} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-400">App Users</p>
                  <h3 className="text-2xl font-bold text-white">{totalUsers}</h3>
                </div>
              </div>
              <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                <div className="bg-cyan-500 h-full w-[30%] group-hover:w-[40%] transition-all duration-1000" />
              </div>
            </div>

            {/* Card: Upcoming Events */}
            <div className="group relative p-6 bg-gradient-to-br from-blue-900/40 to-indigo-900/40 border border-blue-500/20 rounded-2xl hover:border-blue-500/40 transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-blue-500 rounded-lg text-white shadow-lg shadow-blue-500/20">
                  <FiCalendar size={20} />
                </div>
                <span className="text-xs font-bold text-blue-300 bg-blue-500/10 px-2 py-1 rounded-full">NeXT UP</span>
              </div>
              <div>
                <span className="text-2xl font-bold text-white">{upcomingEvents}</span>
                <p className="text-sm text-blue-200/60">Scheduled Events</p>
              </div>
              <button
                onClick={() => navigate('/programs')}
                className="mt-3 w-full py-2 bg-slate-950/30 hover:bg-slate-950/50 text-xs font-bold text-blue-300 border border-blue-500/30 rounded-lg transition-all"
              >
                View Calendar
              </button>
            </div>
          </div>

          {/* 📂 Directory Grid */}
          <section className="bg-slate-900/30 border border-white/5 rounded-3xl overflow-hidden backdrop-blur-sm">
            <div className="p-6 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white">Family Directory</h3>
                <p className="text-sm text-slate-500">Manage database entries</p>
              </div>

              {/* Search */}
              <div className="relative group w-full md:w-80">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiSearch className="text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search families..."
                  className="block w-full pl-10 pr-4 py-2.5 bg-slate-950/50 border border-white/10 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div className="p-6">
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-20 bg-slate-800/50 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : filteredFamilies.length === 0 ? (
                <div className="text-center py-16">
                  <div className="inline-flex p-4 rounded-full bg-slate-800/50 mb-4">
                    <FiSearch className="text-2xl text-slate-600" />
                  </div>
                  <p className="text-slate-400 font-medium">No results found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredFamilies.map((family) => (
                    <div
                      key={family.id}
                      onClick={() => navigate(`/family/${family.id}`)}
                      className="group flex items-center gap-4 p-4 bg-slate-950/40 border border-white/5 rounded-2xl hover:bg-slate-900 hover:border-blue-500/30 cursor-pointer transition-all duration-200 relative overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />

                      <div className="relative z-10 h-12 w-12 shrink-0 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center text-white border border-white/10 shadow-lg">
                        <span className="font-bold text-lg">{family.name.charAt(0)}</span>
                      </div>

                      <div className="relative z-10 flex-1 min-w-0">
                        <h4 className="text-base font-semibold text-slate-200 group-hover:text-white truncate transition-colors">
                          {family.name}
                        </h4>
                        <p className="text-xs text-slate-500 font-mono truncate uppercase tracking-wider group-hover:text-blue-400/70 transition-colors">
                          ID: {family.id}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

        </main>
      </div>
    </div>
  );
}
