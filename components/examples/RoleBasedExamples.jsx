import React from 'react';
import { useRoles, AdminOnly, UserOrAdmin, RoleButton } from '../components/RoleBasedUI';

/**
 * Example: Employees Page with Role-Based UI
 * Shows different actions based on user role
 */
const EmployeesPageExample = () => {
  const { isAdmin, canCreate, canEdit, canDelete, canView } = useRoles();

  const handleCreate = () => {
    console.log('Create employee');
  };

  const handleEdit = (id) => {
    console.log('Edit employee:', id);
  };

  const handleDelete = (id) => {
    console.log('Delete employee:', id);
  };

  const handleView = (id) => {
    console.log('View employee:', id);
  };

  return (
    <div className="p-6">
      {/* Page Header with Role-Based Actions */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Employees</h1>
        
        {/* Admin Only: Create Button */}
        <AdminOnly>
          <button
            onClick={handleCreate}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            + New Employee
          </button>
        </AdminOnly>
      </div>

      {/* Employee List */}
      <div className="bg-white rounded-lg shadow">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Department
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {/* Sample Employee Row */}
            <tr>
              <td className="px-6 py-4">John Doe</td>
              <td className="px-6 py-4">john@example.com</td>
              <td className="px-6 py-4">Engineering</td>
              <td className="px-6 py-4">
                <div className="flex gap-2">
                  {/* Everyone can view */}
                  <UserOrAdmin>
                    <button
                      onClick={() => handleView(1)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      View
                    </button>
                  </UserOrAdmin>

                  {/* Admin only: Edit */}
                  <AdminOnly>
                    <button
                      onClick={() => handleEdit(1)}
                      className="text-green-600 hover:text-green-800"
                    >
                      Edit
                    </button>
                  </AdminOnly>

                  {/* Admin only: Delete */}
                  <AdminOnly>
                    <button
                      onClick={() => handleDelete(1)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  </AdminOnly>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Role-Based Information Box */}
      {isAdmin() ? (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded">
          <p className="text-sm text-blue-800">
            ℹ️ <strong>Admin Mode:</strong> You have full access to create, edit, and delete employees.
          </p>
        </div>
      ) : (
        <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded">
          <p className="text-sm text-gray-700">
            ℹ️ <strong>View Only:</strong> Contact an administrator to make changes.
          </p>
        </div>
      )}
    </div>
  );
};

/**
 * Example: Settings Page - Admin Only
 */
const SettingsPageExample = () => {
  const { isAdmin } = useRoles();

  if (!isAdmin()) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-600">
            Settings are only accessible to administrators.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">System Settings</h1>
      {/* Settings content */}
    </div>
  );
};

/**
 * Example: Dashboard with Conditional Cards
 */
const DashboardExample = () => {
  const { isAdmin, canView } = useRoles();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Card visible to all authenticated users */}
        <UserOrAdmin>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-2">My Profile</h3>
            <p className="text-gray-600">View and update your profile information.</p>
          </div>
        </UserOrAdmin>

        {/* Card visible to all authenticated users */}
        <UserOrAdmin>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-2">My Attendance</h3>
            <p className="text-gray-600">Check your attendance records.</p>
          </div>
        </UserOrAdmin>

        {/* Admin-only cards */}
        <AdminOnly>
          <div className="bg-white p-6 rounded-lg shadow border-2 border-red-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold">Employee Management</h3>
              <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">Admin</span>
            </div>
            <p className="text-gray-600">Manage employee records and profiles.</p>
          </div>
        </AdminOnly>

        <AdminOnly>
          <div className="bg-white p-6 rounded-lg shadow border-2 border-red-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold">Loan Management</h3>
              <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">Admin</span>
            </div>
            <p className="text-gray-600">Process and approve employee loans.</p>
          </div>
        </AdminOnly>

        <AdminOnly>
          <div className="bg-white p-6 rounded-lg shadow border-2 border-red-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold">System Settings</h3>
              <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">Admin</span>
            </div>
            <p className="text-gray-600">Configure system preferences.</p>
          </div>
        </AdminOnly>
      </div>
    </div>
  );
};

/**
 * Example: Form with Role-Based Field Access
 */
const EmployeeFormExample = () => {
  const { isAdmin } = useRoles();

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Employee Details</h1>

      <form className="bg-white p-6 rounded-lg shadow space-y-4">
        {/* Fields visible to all */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Full Name
          </label>
          <input
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            disabled={!isAdmin()}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            disabled={!isAdmin()}
          />
        </div>

        {/* Admin-only field */}
        <AdminOnly>
          <div className="border-t pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Salary (Admin Only)
            </label>
            <input
              type="number"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
        </AdminOnly>

        {/* Admin-only field */}
        <AdminOnly>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Employee Status
            </label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-md">
              <option>Active</option>
              <option>Inactive</option>
              <option>Suspended</option>
            </select>
          </div>
        </AdminOnly>

        {/* Role-based buttons */}
        <div className="flex gap-4 pt-4">
          <AdminOnly>
            <button
              type="submit"
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
            >
              Save Changes
            </button>
          </AdminOnly>

          <UserOrAdmin>
            <button
              type="button"
              className="bg-gray-200 text-gray-700 px-6 py-2 rounded hover:bg-gray-300"
            >
              {isAdmin() ? 'Cancel' : 'Close'}
            </button>
          </UserOrAdmin>
        </div>
      </form>
    </div>
  );
};

/**
 * Example: Using RoleButton Component
 */
const RoleButtonExample = () => {
  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">Role-Based Buttons</h2>
      
      <div className="flex gap-4">
        {/* Only visible to admins */}
        <RoleButton
          requireAdmin={true}
          onClick={() => alert('Admin action')}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          Admin Only Action
        </RoleButton>

        {/* Visible to users or admins */}
        <RoleButton
          requiredAnyRole={['ROLE_USER', 'ROLE_ADMIN']}
          onClick={() => alert('User action')}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          User Action
        </RoleButton>
      </div>
    </div>
  );
};

export {
  EmployeesPageExample,
  SettingsPageExample,
  DashboardExample,
  EmployeeFormExample,
  RoleButtonExample,
};
