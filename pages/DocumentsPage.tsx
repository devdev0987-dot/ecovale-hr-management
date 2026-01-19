import React, { useState, useEffect } from 'react';
import { getEmployees } from '../services/storageService';
import { Employee } from '../types';
import { useAppContext } from '../contexts/AppContext';
import Button from '../components/ui/Button';

const DocumentsPage: React.FC = () => {
  const { showToast } = useAppContext();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewDocument, setPreviewDocument] = useState<{ type: string; data: string; fileName: string } | null>(null);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const emps = await getEmployees();
        setEmployees(emps);
        setFilteredEmployees(emps);
        setLoading(false);
      } catch (error) {
        showToast('Failed to load employees', 'error');
        setLoading(false);
      }
    };
    fetchEmployees();
  }, [showToast]);

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    const filtered = employees.filter(emp => {
      const fullName = `${emp.personalInfo.firstName} ${emp.personalInfo.lastName}`.toLowerCase();
      const designation = emp.employmentDetails.designation.toLowerCase();
      const department = emp.employmentDetails.department.toLowerCase();
      const empId = emp.id.toLowerCase();
      const searchLower = term.toLowerCase();
      
      return fullName.includes(searchLower) || designation.includes(searchLower) || 
             department.includes(searchLower) || empId.includes(searchLower);
    });
    setFilteredEmployees(filtered);
    setSelectedEmployee(null);
  };

  const getDocumentType = (docType: string) => {
    const typeMap: { [key: string]: { icon: string; color: string } } = {
      'Aadhar': { icon: '🆔', color: 'text-blue-600' },
      'PAN': { icon: '📄', color: 'text-green-600' },
      'Driving License': { icon: '🚗', color: 'text-purple-600' }
    };
    return typeMap[docType] || { icon: '📎', color: 'text-gray-600' };
  };

  const downloadDocument = (doc: any) => {
    try {
      const link = document.createElement('a');
      link.href = doc.data;
      link.download = doc.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Document downloaded successfully', 'success');
    } catch (error) {
      showToast('Failed to download document', 'error');
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6 text-gray-800">Employee Documents</h1>
      <p className="text-sm text-gray-600 mb-6">Search employees and view their verified documents (Aadhar, PAN, Driving License).</p>

      {/* Search Section */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Search Employee</label>
        <input
          type="text"
          placeholder="Search by name, ID, designation, or department..."
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
        <p className="text-sm text-gray-500 mt-2">
          {loading ? 'Loading employees...' : `Found ${filteredEmployees.length} employee(s)`}
        </p>
      </div>

      {/* Employee List */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {filteredEmployees.length === 0 ? (
            <div className="col-span-full text-center py-8">
              <p className="text-gray-600">No employees found matching your search</p>
            </div>
          ) : (
            filteredEmployees.map(emp => (
              <div
                key={emp.id}
                onClick={() => setSelectedEmployee(emp)}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedEmployee?.id === emp.id
                    ? 'border-green-600 bg-green-50'
                    : 'border-gray-200 bg-white hover:border-green-300'
                }`}
              >
                <p className="font-semibold text-gray-800">
                  {emp.personalInfo.firstName} {emp.personalInfo.lastName}
                </p>
                <p className="text-sm text-gray-600">{emp.employmentDetails.designation}</p>
                <p className="text-sm text-gray-500">{emp.employmentDetails.department}</p>
                <p className="text-xs text-gray-500 mt-1">ID: {emp.id}</p>
                {emp.documents && emp.documents.length > 0 && (
                  <div className="mt-2 flex gap-1">
                    {emp.documents.map(doc => {
                      const docInfo = getDocumentType(doc.type);
                      return (
                        <span key={doc.type} title={doc.type} className={`text-lg ${docInfo.color}`}>
                          {docInfo.icon}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Document Details */}
      {selectedEmployee && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">
                {selectedEmployee.personalInfo.firstName} {selectedEmployee.personalInfo.lastName}
              </h2>
              <p className="text-sm text-gray-600">{selectedEmployee.employmentDetails.designation}</p>
              <p className="text-sm text-gray-600">{selectedEmployee.employmentDetails.department}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Employee ID</p>
              <p className="font-mono text-lg font-semibold">{selectedEmployee.id}</p>
            </div>
          </div>

          {/* Documents Grid */}
          {selectedEmployee.documents && selectedEmployee.documents.length > 0 ? (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Documents</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {selectedEmployee.documents.map(doc => {
                  const docInfo = getDocumentType(doc.type);
                  return (
                    <div key={doc.type} className="border rounded-lg p-4 bg-gray-50">
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`text-2xl ${docInfo.color}`}>{docInfo.icon}</span>
                        <h4 className="font-semibold text-gray-800">{doc.type}</h4>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">File: {doc.fileName}</p>
                      <p className="text-xs text-gray-500 mb-3">
                        Uploaded: {new Date(doc.uploadDate).toLocaleDateString()}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setPreviewDocument({ type: doc.type, data: doc.data, fileName: doc.fileName })}
                          className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                        >
                          Preview
                        </button>
                        <button
                          onClick={() => downloadDocument(doc)}
                          className="flex-1 px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                        >
                          Download
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <p className="text-gray-600">No documents uploaded for this employee</p>
            </div>
          )}
        </div>
      )}

      {/* Document Preview Modal */}
      {previewDocument && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl max-h-96 overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
              <h3 className="text-lg font-semibold">{previewDocument.type} - Preview</h3>
              <button
                onClick={() => setPreviewDocument(null)}
                className="text-gray-600 hover:text-gray-800 text-2xl"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              {previewDocument.data.startsWith('data:image') ? (
                <img src={previewDocument.data} alt={previewDocument.type} className="max-w-full h-auto mx-auto" />
              ) : previewDocument.data.startsWith('data:application/pdf') ? (
                <div className="text-center py-8">
                  <p className="text-gray-600 mb-4">PDF Document</p>
                  <Button onClick={() => downloadDocument({ data: previewDocument.data, fileName: previewDocument.fileName })}>
                    Download PDF
                  </Button>
                </div>
              ) : (
                <div className="bg-gray-50 p-4 rounded text-center">
                  <p className="text-gray-600">Document file - Click download to view</p>
                  <Button onClick={() => downloadDocument({ data: previewDocument.data, fileName: previewDocument.fileName })} size="sm" className="mt-4">
                    Download Document
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentsPage;
