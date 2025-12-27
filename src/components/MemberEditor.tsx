// src/components/MemberEditor.tsx
import { useState, useEffect, useCallback } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import { FiPlus, FiTrash2, FiUserPlus, FiX, FiCheck, FiImage } from 'react-icons/fi';

type Member = {
  id: string;
  name: string;
  image: string | null;        // ✅ Now explicitly string or null (never undefined)
  address: string | null;
  phone: string | null;
  occupation: string | null;
  status: 'Deceased' | null;
  spouseObj: Member | null;
  children: Member[] | null;
};

// Helper: create a clean, Firestore-safe member
const createMember = (partial: Partial<Member> & { id: string; name: string }): Member => ({
  id: partial.id,
  name: partial.name,
  image: partial.image ?? null,
  address: partial.address ?? null,
  phone: partial.phone ?? null,
  occupation: partial.occupation ?? null,
  status: partial.status ?? null,
  spouseObj: partial.spouseObj ?? null,
  children: partial.children ?? null,
});

const generateNextId = (existingIds: string[]): string => {
  const numericIds = existingIds
    .map(id => parseInt(id.replace(/\D/g, '')))
    .filter(id => !isNaN(id));
  const maxId = Math.max(...numericIds, 0);
  return (maxId + 1).toString();
};

// 🌈 Depth Colors (High Contrast)
const DEPTH_COLORS = [
  "border-blue-500",    // Level 0: Standard Blue
  "border-yellow-500",  // Level 1: Bright Yellow (Contrast)
  "border-red-500",     // Level 2: Strong Red
  "border-green-500",   // Level 3: Nature Green
  "border-purple-500",  // Level 4: Royal Purple
  "border-orange-500",  // Level 5: Bright Orange
  "border-pink-500",    // Level 6: Vibrant Pink
  "border-cyan-500",    // Level 7: Electric Cyan
  "border-lime-500",    // Level 8: Acid Lime
  "border-indigo-500",  // Level 9: Deep Indigo
];

export default function MemberEditor({
  member,
  onUpdate,
  allMemberIds,
  onIdsUpdate,
  onDelete,
  depth = 0 // Default depth
}: {
  member: Member;
  onUpdate: (updated: Member) => void;
  allMemberIds: string[];
  onIdsUpdate: (newIds: string[]) => void;
  onDelete: () => void;
  depth?: number;
}) {
  // Ensure localMember never has undefined values
  const [localMember, setLocalMember] = useState<Member>(() => ({
    id: member.id,
    name: member.name,
    image: member.image ?? null,
    address: member.address ?? null,
    phone: member.phone ?? null,
    occupation: member.occupation ?? null,
    status: member.status ?? null,
    spouseObj: member.spouseObj ?? null,
    children: member.children ?? null,
  }));

  const [uploading, setUploading] = useState(false);
  const [addingSpouse, setAddingSpouse] = useState(false);
  const [newSpouseName, setNewSpouseName] = useState('');
  const [addingChild, setAddingChild] = useState(false);
  const [newChildName, setNewChildName] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [fetchedImageUrl, setFetchedImageUrl] = useState<string | null>(null);

  const fetchExistingImageUrl = useCallback(async () => {
    if (localMember.image && !imagePreview) {
      try {
        const imageRef = ref(storage, `images/${localMember.image}`);
        const url = await getDownloadURL(imageRef);
        setFetchedImageUrl(url);
      } catch (error) {
        console.warn('Could not fetch existing image:', error);
        setFetchedImageUrl(null);
      }
    } else {
      setFetchedImageUrl(null);
    }
  }, [localMember.image, imagePreview]);

  useEffect(() => {
    fetchExistingImageUrl();
  }, [fetchExistingImageUrl]);

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const handleChange = (field: keyof Member, value: any) => {
    // Ensure we never set undefined — convert to null if needed
    const safeValue = value === undefined ? null : value;
    const updated = { ...localMember, [field]: safeValue };
    setLocalMember(updated);
    onUpdate(updated);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
    setUploading(true);

    try {
      const imageRef = ref(storage, `images/${localMember.id}.jpg`);
      await uploadBytes(imageRef, file);
      const newFilename = `${localMember.id}.jpg`;
      handleChange('image', newFilename);

      const downloadURL = await getDownloadURL(imageRef);
      setFetchedImageUrl(downloadURL);
    } catch (error: any) {
      console.error('Image upload failed:', error);
      alert(`Upload failed: ${error.message || 'Unknown error'}`);
      setImagePreview(null);
      URL.revokeObjectURL(previewUrl);
    } finally {
      setUploading(false);
    }
  };

  const handleAddSpouse = () => {
    if (!newSpouseName.trim()) return;
    const spouseId = `${localMember.id}s`;
    const newSpouse = createMember({
      id: spouseId,
      name: newSpouseName,
    });
    handleChange('spouseObj', newSpouse);
    onIdsUpdate([...allMemberIds, spouseId]);
    setAddingSpouse(false);
    setNewSpouseName('');
  };

  const handleAddChild = () => {
    if (!newChildName.trim()) return;
    const newId = generateNextId(allMemberIds);
    const newChild = createMember({
      id: newId,
      name: newChildName,
    });
    const updatedChildren = [...(localMember.children || []), newChild];
    handleChange('children', updatedChildren);
    onIdsUpdate([...allMemberIds, newId]);
    setAddingChild(false);
    setNewChildName('');
  };

  const handleDelete = () => {
    if (window.confirm(`Delete ${localMember.name}? This cannot be undone.`)) {
      onDelete();
    }
  };

  const handleRemoveImage = () => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setImagePreview(null);
    setFetchedImageUrl(null);
    handleChange('image', null); // ✅ null, not undefined
  };

  const displayImageUrl = imagePreview || fetchedImageUrl;

  // Calculate border color based on depth
  const borderColorClass = DEPTH_COLORS[depth % DEPTH_COLORS.length];

  return (
    <div className={`border-l-4 ${borderColorClass} pl-4 mb-6`}>
      {/* Member Info Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <input
          type="text"
          value={localMember.name}
          onChange={(e) => handleChange('name', e.target.value)}
          className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Name"
        />
        <input
          type="text"
          value={localMember.address || ''}
          onChange={(e) => handleChange('address', e.target.value || null)}
          className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Address"
        />
        <input
          type="text"
          value={localMember.phone || ''}
          onChange={(e) => handleChange('phone', e.target.value || null)}
          className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Phone"
        />
        <input
          type="text"
          value={localMember.occupation || ''}
          onChange={(e) => handleChange('occupation', e.target.value || null)}
          className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Occupation"
        />
        <select
          value={localMember.status || ''}
          onChange={(e) => handleChange('status', e.target.value || null)}
          className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Living</option>
          <option value="Deceased">Deceased</option>
        </select>
      </div>

      {/* Image Upload */}
      <div className="mb-4">
        <label className="block mb-2 text-sm font-medium text-gray-300">Profile Photo</label>

        {displayImageUrl ? (
          <div className="relative inline-block">
            <img
              src={displayImageUrl}
              alt="Profile preview"
              className="w-24 h-24 object-cover rounded border border-gray-600"
            />
            <label className="absolute bottom-0 right-0 bg-blue-600 text-white p-1 rounded-full cursor-pointer hover:bg-blue-700">
              <FiImage size={14} />
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
          </div>
        ) : (
          <label className="flex items-center gap-2 px-4 py-2 bg-gray-700 border border-gray-600 rounded cursor-pointer hover:bg-gray-600">
            <FiImage className="text-gray-400" />
            <span className="text-gray-300">
              {uploading ? 'Uploading...' : 'Choose image'}
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>
        )}

        {displayImageUrl && (
          <div className="mt-2">
            <button
              type="button"
              onClick={handleRemoveImage}
              className="text-xs text-red-400 hover:underline"
            >
              Remove photo
            </button>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setAddingChild(true)}
          className="px-3 py-1.5 bg-green-600 text-white text-sm rounded flex items-center gap-1 hover:bg-green-700"
        >
          <FiPlus size={14} />
          Add Child
        </button>

        {!localMember.spouseObj ? (
          <button
            onClick={() => setAddingSpouse(true)}
            className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded flex items-center gap-1 hover:bg-purple-700"
          >
            <FiUserPlus size={14} />
            Add Spouse
          </button>
        ) : (
          <span className="px-3 py-1.5 bg-gray-700 text-gray-300 text-sm rounded">
            Spouse: {localMember.spouseObj.name}
          </span>
        )}

        <button
          onClick={handleDelete}
          className="px-3 py-1.5 bg-red-600 text-white text-sm rounded flex items-center gap-1 hover:bg-red-700"
        >
          <FiTrash2 size={14} />
          Delete
        </button>
      </div>

      {/* Add Child Form */}
      {addingChild && (
        <div className="mb-6 p-4 border border-green-500 rounded-lg bg-gray-800">
          <h3 className="font-medium text-green-400 mb-3 flex items-center gap-2">
            <FiPlus /> Add Child
          </h3>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={newChildName}
              onChange={(e) => setNewChildName(e.target.value)}
              placeholder="Child's name"
              className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <button
              onClick={handleAddChild}
              className="px-3 py-1.5 bg-green-600 text-white text-sm rounded flex items-center gap-1"
            >
              <FiCheck size={14} />
              Save
            </button>
            <button
              onClick={() => setAddingChild(false)}
              className="px-3 py-1.5 bg-gray-600 text-white text-sm rounded flex items-center gap-1"
            >
              <FiX size={14} />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Add Spouse Form */}
      {addingSpouse && (
        <div className="mb-6 p-4 border border-purple-500 rounded-lg bg-gray-800">
          <h3 className="font-medium text-purple-400 mb-3 flex items-center gap-2">
            <FiUserPlus /> Add Spouse
          </h3>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={newSpouseName}
              onChange={(e) => setNewSpouseName(e.target.value)}
              placeholder="Spouse's name"
              className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              onClick={handleAddSpouse}
              className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded flex items-center gap-1"
            >
              <FiCheck size={14} />
              Save
            </button>
            <button
              onClick={() => setAddingSpouse(false)}
              className="px-3 py-1.5 bg-gray-600 text-white text-sm rounded flex items-center gap-1"
            >
              <FiX size={14} />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Spouse Editor */}
      {localMember.spouseObj && (
        <div className="mt-6 pt-4 border-t border-gray-700">
          <h3 className="font-medium text-gray-300 mb-3">Spouse</h3>
          <MemberEditor
            member={localMember.spouseObj}
            onUpdate={(updatedSpouse) => {
              handleChange('spouseObj', updatedSpouse);
            }}
            allMemberIds={allMemberIds}
            onIdsUpdate={onIdsUpdate}
            onDelete={() => {
              handleChange('spouseObj', null);
            }}
            depth={depth + 1}
          />
        </div>
      )}

      {/* Children Editor */}
      {localMember.children && localMember.children.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-700">
          <h3 className="font-medium text-gray-300 mb-3">
            Children ({localMember.children.length})
          </h3>
          {localMember.children.map((child, index) => (
            <div key={child.id} className="mb-4">
              <MemberEditor
                member={child}
                onUpdate={(updatedChild) => {
                  const newChildren = [...localMember.children!];
                  newChildren[index] = updatedChild;
                  handleChange('children', newChildren);
                }}
                allMemberIds={allMemberIds}
                onIdsUpdate={onIdsUpdate}
                onDelete={() => {
                  const newChildren = localMember.children!.filter((_, i) => i !== index);
                  handleChange('children', newChildren.length > 0 ? newChildren : null);
                }}
                depth={depth + 1}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}