// src/pages/FamilyEditor.tsx
import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useParams, useNavigate } from 'react-router-dom';
import MemberEditor from '../components/MemberEditor';
import { FiArrowLeft, FiSave, FiX } from 'react-icons/fi';

// 🔧 Align with Member type from MemberEditor.tsx
type FamilyMember = {
  id: string;
  name: string;
  image: string | null;        // ✅ Now string | null (no undefined)
  address: string | null;
  phone: string | null;
  occupation: string | null;
  status: 'Deceased' | null;
  spouseObj: FamilyMember | null;
  children: FamilyMember[] | null;
};

// ❌ Removed unused generateNextId — it's already in MemberEditor.tsx

export default function FamilyEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [family, setFamily] = useState<FamilyMember | null>(null);
  const [saving, setSaving] = useState(false);
  const [allMemberIds, setAllMemberIds] = useState<string[]>([]);

  const collectAllIds = (member: FamilyMember): string[] => {
    let ids = [member.id];
    if (member.spouseObj) ids.push(...collectAllIds(member.spouseObj));
    if (member.children) member.children.forEach(child => ids.push(...collectAllIds(child)));
    return ids;
  };

  useEffect(() => {
    const fetchFamily = async () => {
      const docSnap = await getDoc(doc(db, 'families', id!));
      if (docSnap.exists()) {
        const data = docSnap.data();

        // 🔧 Normalize undefined → null for compatibility
        const normalize = (obj: any): FamilyMember => {
          const safe = (val: any) => val ?? null;
          return {
            id: obj.id ?? docSnap.id,
            name: obj.name ?? '',
            image: safe(obj.image),
            address: safe(obj.address),
            phone: safe(obj.phone),
            occupation: safe(obj.occupation),
            status: obj.status === 'Deceased' ? 'Deceased' : null,
            spouseObj: obj.spouseObj ? normalize(obj.spouseObj) : null,
            children: Array.isArray(obj.children)
              ? obj.children.map(normalize)
              : null,
          };
        };

        const normalizedFamily = normalize({ id: docSnap.id, ...data });
        setFamily(normalizedFamily);
        setAllMemberIds(collectAllIds(normalizedFamily));
      }
    };
    fetchFamily();
  }, [id]);

  const handleSave = async () => {
    if (!family) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'families', family.id), family);
      alert('Family saved successfully!');
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Save error:', error);
      alert(`Failed to save: ${error.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  if (!family) return <div className="p-8 text-white bg-gray-900">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      {/* Header */}
      <header className="bg-gray-800 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 text-gray-300 hover:text-white"
            >
              <FiArrowLeft />
              <span className='hidden sm:flex'>Back to Dashboard</span>
            </button>
            <h1 className="text-2xl font-bold">Edit {family.name}</h1>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 flex items-center gap-2"
            >
              <FiX />
              <p className='hidden sm:flex'>Cancel</p>
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              <FiSave className='hidden sm:flex'/>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </header>

      {/* Editor */}
      <main className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <MemberEditor
            member={family}
            onUpdate={(updated) => setFamily(updated)} // ✅ Now compatible
            allMemberIds={allMemberIds}
            onIdsUpdate={setAllMemberIds}
            onDelete={() => {
              alert('Cannot delete root family member');
            }}
          />
        </div>
      </main>
    </div>
  );
}