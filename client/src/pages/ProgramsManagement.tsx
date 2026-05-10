import { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth, storage } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiArrowLeft, FiPlus, FiTrash2, FiEdit2, FiSave, FiX, FiCalendar, FiMapPin, FiClock, FiEye, FiEyeOff, FiUpload } from 'react-icons/fi';

type ProgramType = 'Wedding' | 'Birthday' | 'Anniversary' | 'Get Together' | 'Meeting' | 'Other';
type ProgramStatus = 'Upcoming' | 'Completed' | 'Cancelled';

type Program = {
    id: string;
    title: string;
    type: ProgramType;
    date: string;
    time: string;
    location: string;
    description: string;
    imageUrl?: string;
    status: ProgramStatus;
    visibility: boolean;
    createdAt?: any;
};

const PROGRAM_TYPES: ProgramType[] = ['Wedding', 'Birthday', 'Anniversary', 'Get Together', 'Meeting', 'Other'];
const PROGRAM_STATUSES: ProgramStatus[] = ['Upcoming', 'Completed', 'Cancelled'];

export default function ProgramsManagement() {
    const [programs, setPrograms] = useState<Program[]>([]);
    const [filteredPrograms, setFilteredPrograms] = useState<Program[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProgram, setEditingProgram] = useState<Program | null>(null);
    const [formData, setFormData] = useState<Omit<Program, 'id' | 'createdAt'>>({
        title: '',
        type: 'Get Together',
        date: '',
        time: '',
        location: '',
        description: '',
        status: 'Upcoming',
        visibility: true
    });

    // Upload State
    const [uploading, setUploading] = useState(false);

    const navigate = useNavigate();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                fetchPrograms();
            } else {
                setLoading(false);
                setError("You must be logged in to manage programs");
            }
        });

        return () => unsubscribe();
    }, []);

    const fetchPrograms = async () => {
        try {
            setLoading(true);
            setError(null);
            const querySnapshot = await getDocs(collection(db, 'programs'));
            const data = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Program[];

            // Sort by date (descending for management usually, or upcoming first)
            data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            setPrograms(data);
            setFilteredPrograms(data);
        } catch (err: any) {
            console.error("Error fetching programs:", err);
            setError(`Failed to fetch programs: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!searchQuery.trim()) {
            setFilteredPrograms(programs);
        } else {
            const query = searchQuery.toLowerCase();
            setFilteredPrograms(
                programs.filter(p =>
                    p.title.toLowerCase().includes(query) ||
                    p.location.toLowerCase().includes(query)
                )
            );
        }
    }, [searchQuery, programs]);

    const handleOpenModal = (program?: Program) => {
        if (program) {
            setEditingProgram(program);
            setFormData({
                title: program.title,
                type: program.type,
                date: program.date,
                time: program.time,
                location: program.location,
                description: program.description,
                status: program.status,
                visibility: program.visibility,
                imageUrl: program.imageUrl || ''
            });
        } else {
            setEditingProgram(null);
            setFormData({
                title: '',
                type: 'Get Together',
                date: '',
                time: '',
                location: '',
                description: '',
                status: 'Upcoming',
                visibility: true,
                imageUrl: ''
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingProgram(null);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this program?")) return;
        try {
            await deleteDoc(doc(db, 'programs', id));
            setPrograms(programs.filter(p => p.id !== id));
        } catch (error) {
            console.error("Error deleting program:", error);
            alert("Failed to delete program");
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingProgram) {
                // Update
                const programRef = doc(db, 'programs', editingProgram.id);
                await updateDoc(programRef, { ...formData });
                setPrograms(programs.map(p => p.id === editingProgram.id ? { ...p, ...formData } : p));
            } else {
                // Create
                const docRef = await addDoc(collection(db, 'programs'), {
                    ...formData,
                    createdAt: serverTimestamp()
                });
                const newProgram: Program = { id: docRef.id, ...formData };
                setPrograms([newProgram, ...programs]);
            }
            handleCloseModal();
        } catch (error) {
            console.error("Error saving program:", error);
            alert("Failed to save program");
        }
    };

    const toggleVisibility = async (program: Program) => {
        try {
            const newVisibility = !program.visibility;
            await updateDoc(doc(db, 'programs', program.id), { visibility: newVisibility });
            setPrograms(programs.map(p => p.id === program.id ? { ...p, visibility: newVisibility } : p));
        } catch (error) {
            console.error("Error updating visibility:", error);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            // Create a safe filename with timestamp
            const timestamp = Date.now();
            const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
            const storagePath = `program_images/${timestamp}_${safeName}`;

            const imageRef = ref(storage, storagePath);
            await uploadBytes(imageRef, file);
            const downloadURL = await getDownloadURL(imageRef);

            setFormData(prev => ({ ...prev, imageUrl: downloadURL }));
        } catch (error: any) {
            console.error("Error uploading image:", error);
            alert(`Failed to upload image: ${error.message}`);
        } finally {
            setUploading(false);
        }
    };

    const handleRemoveImage = () => {
        setFormData(prev => ({ ...prev, imageUrl: '' }));
    };

    const formatTime12Hour = (time24: string) => {
        if (!time24) return '';
        const [hours, minutes] = time24.split(':');
        const h = parseInt(hours, 10);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return `${h12}:${minutes} ${ampm}`;
    };

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100">
            {/* Header */}
            <header className="bg-gray-800 shadow-lg sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8
                        flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="p-2 hover:bg-gray-700 rounded-full transition"
                        >
                            <FiArrowLeft className="text-xl" />
                        </button>
                        <h1 className="text-xl sm:text-2xl font-bold">Programs Management</h1>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                        <div className="relative w-full sm:w-64">
                            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search programs..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-gray-700 rounded-lg
                           text-white placeholder-gray-400
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <button
                            onClick={() => handleOpenModal()}
                            className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-500 transition flex items-center justify-center gap-2"
                        >
                            <FiPlus />
                            Create Program
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
                {loading ? (
                    <div className="text-center py-20 text-gray-400">Loading programs...</div>
                ) : error ? (
                    <div className="text-center py-20 text-red-400">{error}</div>
                ) : filteredPrograms.length === 0 ? (
                    <div className="text-center py-20">
                        <FiCalendar className="mx-auto text-4xl text-gray-600 mb-4" />
                        <p className="text-gray-400">No programs found</p>
                    </div>
                ) : (
                    <div className="grid gap-6 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
                        {filteredPrograms.map(program => (
                            <div key={program.id} className="bg-gray-800 rounded-xl border border-gray-700 shadow-md overflow-hidden flex flex-col">
                                <div className="p-5 flex-1">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className={`px-2 py-1 rounded text-xs font-semibold
                      ${program.status === 'Upcoming' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                                program.status === 'Completed' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                                                    'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                            {program.status}
                                        </span>
                                        <button
                                            onClick={() => toggleVisibility(program)}
                                            className={`p-1.5 rounded-full transition ${program.visibility ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-400'}`}
                                            title={program.visibility ? "Visible to App" : "Hidden from App"}
                                        >
                                            {program.visibility ? <FiEye /> : <FiEyeOff />}
                                        </button>
                                    </div>

                                    {program.imageUrl && (
                                        <div className="mb-4 h-48 w-full rounded-lg overflow-hidden bg-gray-900 border border-gray-700">
                                            <img
                                                src={program.imageUrl}
                                                alt={program.title}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    )}

                                    <h3 className="text-xl font-bold text-white mb-1">{program.title}</h3>
                                    <div className="text-sm text-gray-400 mb-4 font-medium flex items-center gap-2">
                                        <span className="bg-gray-700 px-2 py-0.5 rounded text-xs">{program.type}</span>
                                    </div>

                                    <div className="space-y-2 text-sm text-gray-300">
                                        <div className="flex items-center gap-2">
                                            <FiCalendar className="text-gray-500" />
                                            <span>{program.date}</span>
                                            <span className="text-gray-600">|</span>
                                            <FiClock className="text-gray-500" />
                                            <span>{formatTime12Hour(program.time)}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <FiMapPin className="text-gray-500" />
                                            <span className="truncate">{program.location}</span>
                                        </div>
                                    </div>

                                    {program.description && (
                                        <p className="mt-4 text-sm text-gray-500 line-clamp-2">{program.description}</p>
                                    )}
                                </div>

                                <div className="bg-gray-750 px-5 py-3 border-t border-gray-700 flex justify-end gap-2">
                                    <button
                                        onClick={() => handleOpenModal(program)}
                                        className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition"
                                        title="Edit"
                                    >
                                        <FiEdit2 />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(program.id)}
                                        className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition"
                                        title="Delete"
                                    >
                                        <FiTrash2 />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Create/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 overflow-y-auto flex px-4 py-6">
                    <div className="bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl border border-gray-700 m-auto relative">
                        <div className="p-6 border-b border-gray-700 flex justify-between items-center bg-gray-800 rounded-t-2xl">
                            <h2 className="text-xl font-bold">{editingProgram ? 'Edit Program' : 'Create New Program'}</h2>
                            <button
                                onClick={handleCloseModal}
                                className="text-gray-400 hover:text-white transition"
                            >
                                <FiX className="text-xl" />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="col-span-1 md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Program Title</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="e.g. Grandma's 80th Birthday"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Type</label>
                                    <select
                                        value={formData.type}
                                        onChange={(e) => setFormData({ ...formData, type: e.target.value as ProgramType })}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        {PROGRAM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Status</label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value as ProgramStatus })}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        {PROGRAM_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Date</label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.date}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Time</label>
                                    <input
                                        type="time"
                                        required
                                        value={formData.time}
                                        onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div className="col-span-1 md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Location / Venue</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.location}
                                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="e.g. 123 Family Lane OR Zoom/Google Meet Link"
                                    />
                                </div>

                                <div className="col-span-1 md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Description</label>
                                    <textarea
                                        rows={4}
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Agenda, notes, instructions..."
                                    />
                                </div>

                                <div className="col-span-1 md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-400 mb-2">Program Image (Optional)</label>

                                    <div className="flex flex-col gap-4">
                                        {/* Image Preview and Remove Button */}
                                        {formData.imageUrl ? (
                                            <div className="relative w-full h-48 bg-gray-700 rounded-lg border border-gray-600 overflow-hidden group">
                                                <img
                                                    src={formData.imageUrl}
                                                    alt="Program Preview"
                                                    className="w-full h-full object-cover"
                                                />
                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                                    <button
                                                        type="button"
                                                        onClick={handleRemoveImage}
                                                        className="px-4 py-2 bg-red-600 text-white rounded-lg flex items-center gap-2 hover:bg-red-700 transition"
                                                    >
                                                        <FiTrash2 /> Remove Image
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            /* Upload Placeholder */
                                            <div className="w-full h-32 border-2 border-dashed border-gray-600 rounded-lg hover:border-gray-500 transition bg-gray-700/30 flex items-center justify-center">
                                                <label className="cursor-pointer flex flex-col items-center gap-2 w-full h-full justify-center">
                                                    {uploading ? (
                                                        <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                                                    ) : (
                                                        <>
                                                            <FiUpload className="text-2xl text-gray-400" />
                                                            <span className="text-gray-400 font-medium">Click to upload image</span>
                                                            <span className="text-gray-500 text-xs">PNG, JPG up to 5MB</span>
                                                        </>
                                                    )}
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        className="hidden"
                                                        onChange={handleImageUpload}
                                                        disabled={uploading}
                                                    />
                                                </label>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="col-span-1 md:col-span-2 flex items-center gap-3 bg-gray-750 p-4 rounded-lg border border-gray-700">
                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, visibility: !prev.visibility }))}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${formData.visibility ? 'bg-green-500' : 'bg-gray-600'}`}
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${formData.visibility ? 'translate-x-6' : 'translate-x-1'}`}
                                        />
                                    </button>
                                    <span className="text-gray-300 text-sm">
                                        Visible in Mobile App? <span className="text-gray-500 text-xs">(If OFF, only admins can see this)</span>
                                    </span>
                                </div>
                            </div>

                            <div className="pt-4 flex gap-3 justify-end border-t border-gray-700 mt-6">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="px-4 py-2 text-gray-400 hover:bg-gray-700 rounded-lg transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={uploading}
                                    className={`px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition flex items-center gap-2 font-medium ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <FiSave />
                                    {editingProgram ? 'Save Changes' : 'Create Program'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
