
import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { getDesignations, saveDesignation, updateDesignation, deleteDesignation } from '../services/storageService';
import { Designation, Department } from '../types';
import Button from '../components/ui/Button';
import { useAppContext } from '../contexts/AppContext';
import { DEPARTMENTS } from '../utils/constants';

const DesignationModal = ({ isOpen, onClose, onSave, designation, designations }) => {
    const [title, setTitle] = useState('');
    const [department, setDepartment] = useState<Department>('IT');
    const [level, setLevel] = useState(1);
    const [description, setDescription] = useState('');
    const [reportingTo, setReportingTo] = useState('');

    useEffect(() => {
        if (designation) {
            setTitle(designation.title);
            setDepartment(designation.department);
            setLevel(designation.level);
            setDescription(designation.description);
            setReportingTo(designation.reportingTo || '');
        } else {
            setTitle('');
            setDepartment('IT');
            setLevel(1);
            setDescription('');
            setReportingTo('');
        }
    }, [designation, isOpen]);

    const handleSubmit = (e) => {
        e.preventDefault();
        const newDesignation = {
            id: designation ? designation.id : undefined,
            title,
            department,
            level,
            description,
            reportingTo: reportingTo || undefined,
        };
        onSave(newDesignation);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-40">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
                <h3 className="text-xl font-semibold mb-4">{designation ? 'Edit' : 'Add'} Designation</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input type="text" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full p-2 border rounded" />
                    <select value={department} onChange={(e) => setDepartment(e.target.value as Department)} className="w-full p-2 border rounded">
                        {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <input type="number" placeholder="Level (1-10)" min="1" max="10" value={level} onChange={(e) => setLevel(Number(e.target.value))} required className="w-full p-2 border rounded" />
                    <select value={reportingTo} onChange={(e) => setReportingTo(e.target.value)} className="w-full p-2 border rounded">
                         <option value="">None (Reports to top level)</option>
                         {designations.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
                    </select>
                    <textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full p-2 border rounded" />
                    <div className="flex justify-end space-x-2">
                        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
                        <Button type="submit">Save</Button>
                    </div>
                </form>
            </div>
        </div>
    );
};


const DesignationsPage: React.FC = () => {
    const { showToast } = useAppContext();
    const [designations, setDesignations] = useState<Designation[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDesignation, setEditingDesignation] = useState<Designation | null>(null);

    const loadDesignations = async () => {
        try {
            setLoading(true);
            const data = await getDesignations();
            setDesignations(data);
        } catch (error) {
            showToast('Failed to load designations', 'error');
        } finally {
            setLoading(false);
        }
    };
    
    useEffect(() => {
        loadDesignations();
    }, []);

    const handleSave = async (designationData) => {
        try {
            if (designationData.id) {
                await updateDesignation(designationData);
                showToast('Designation updated successfully', 'success');
            } else {
                await saveDesignation(designationData);
                showToast('Designation added successfully', 'success');
            }
            setIsModalOpen(false);
            setEditingDesignation(null);
            await loadDesignations();
        } catch(error) {
            showToast('Failed to save designation', 'error');
        }
    };

    const handleDelete = async (id: string) => {
        if(window.confirm('Are you sure you want to delete this designation?')) {
            try {
                await deleteDesignation(id);
                showToast('Designation deleted', 'success');
                await loadDesignations();
            } catch (error) {
                 showToast('Failed to delete designation', 'error');
            }
        }
    };
    
    const handleEdit = (designation: Designation) => {
        setEditingDesignation(designation);
        setIsModalOpen(true);
    };

    const handleAdd = () => {
        setEditingDesignation(null);
        setIsModalOpen(true);
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold text-gray-800">Designations</h2>
                <Button onClick={handleAdd}>
                    <Plus size={18} className="mr-2" />
                    Add Designation
                </Button>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-500">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                            <tr>
                                <th className="px-6 py-3">Title</th>
                                <th className="px-6 py-3">Department</th>
                                <th className="px-6 py-3">Level</th>
                                <th className="px-6 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {designations.map(d => (
                                <tr key={d.id} className="bg-white border-b hover:bg-gray-50">
                                    <td className="px-6 py-4 font-medium text-gray-900">{d.title}</td>
                                    <td className="px-6 py-4">{d.department}</td>
                                    <td className="px-6 py-4">{d.level}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex space-x-2">
                                            <button onClick={() => handleEdit(d)} className="text-gray-500 hover:text-green-600"><Edit size={18} /></button>
                                            <button onClick={() => handleDelete(d.id)} className="text-gray-500 hover:text-red-600"><Trash2 size={18} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                 {designations.length === 0 && <div className="text-center py-8 text-gray-500">No designations found.</div>}
            </div>
            <DesignationModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                onSave={handleSave} 
                designation={editingDesignation}
                designations={designations}
            />
        </div>
    );
};

export default DesignationsPage;
