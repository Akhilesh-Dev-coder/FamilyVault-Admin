// src/pages/Dashboard.tsx
import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiUser, FiUsers, FiHome } from 'react-icons/fi';

type FamilyMember = {
  id: string;
  name: string;
};

export default function Dashboard() {
  const [families, setFamilies] = useState<FamilyMember[]>([]);
  const [filteredFamilies, setFilteredFamilies] = useState<FamilyMember[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchFamilies = async () => {
      const querySnapshot = await getDocs(collection(db, 'families'));
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FamilyMember[];

      data.sort((a, b) => {
        const idA = parseInt(a.id.replace(/\D/g, '') || '0');
        const idB = parseInt(b.id.replace(/\D/g, '') || '0');
        return idA - idB;
      });

      setFamilies(data);
      setFilteredFamilies(data);
    };
    fetchFamilies();
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
    <div className="min-h-screen bg-gray-900 text-gray-100">
      {/* Header */}
      <header className="bg-gray-800 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8
                        flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

          {/* Title */}
          <div className="flex items-center gap-3">
            <FiHome className="text-blue-400 text-2xl" />
            <h1 className="text-xl sm:text-2xl font-bold">Admin Panel</h1>
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-72">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search families..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-700 rounded-lg
                         text-white placeholder-gray-400
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap gap-4 justify-between text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <FiUsers className="text-blue-400" />
            <span>{families.length} families</span>
          </div>
          <div className="flex items-center gap-2">
            <FiUser className="text-yellow-400" />
            <span>Admin Mode</span>
          </div>
        </div>
      </div>

      {/* Family Grid */}
      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {filteredFamilies.length === 0 ? (
          <div className="text-center py-20">
            <FiSearch className="mx-auto text-4xl text-gray-600 mb-4" />
            <p className="text-gray-400">No families found</p>
          </div>
        ) : (
          <div
            className="grid gap-4
                       grid-cols-1
                       sm:grid-cols-2
                       lg:grid-cols-3
                       xl:grid-cols-4"
          >
            {filteredFamilies.map(family => (
              <div
                key={family.id}
                onClick={() => navigate(`/family/${family.id}`)}
                className="bg-gray-800 p-5 rounded-xl border border-gray-700
                           shadow-md hover:shadow-xl hover:bg-gray-750
                           transition cursor-pointer active:scale-[0.98]"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-blue-500 w-12 h-12 rounded-full
                                  flex items-center justify-center text-lg font-bold">
                    {family.name.charAt(0)}
                  </div>
                  <div className="truncate">
                    <h2 className="text-lg font-semibold truncate">
                      {family.name}
                    </h2>
                    <p className="text-gray-400 text-sm truncate">
                      ID: {family.id}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
