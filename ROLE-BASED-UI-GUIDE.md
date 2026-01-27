# Role-Based UI Implementation Guide

Complete guide for implementing role-based UI rendering in your React app using JWT roles from the backend.

## 📋 Table of Contents
1. [Overview](#overview)
2. [How It Works](#how-it-works)
3. [Files Created](#files-created)
4. [Role Definitions](#role-definitions)
5. [Usage Examples](#usage-examples)
6. [Component Reference](#component-reference)
7. [Utility Functions](#utility-functions)
8. [Integration Steps](#integration-steps)
9. [Testing](#testing)
10. [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

This implementation provides:
- ✅ JWT role decoding (already handled by authService.js)
- ✅ Reusable role-based components
- ✅ Show/hide UI elements based on roles
- ✅ Admin-only pages and features
- ✅ Role-based navigation sidebar
- ✅ User role display in navbar
- ✅ Comprehensive utility functions

## 🔧 How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                    JWT Token (from backend)                  │
│  eyJhbGci...{userId, username, roles: ["ROLE_ADMIN"]}...xyz  │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────────┐
│              authService.js (JWT Decoding)                   │
│  - getUser() → returns user object with roles array          │
│  - hasRole(role) → checks if user has specific role          │
│  - hasAnyRole(roles) → checks if user has any of the roles   │
│  - isAdmin() → checks if user is admin                       │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────────┐
│              Role-Based UI Components                         │
│  - RoleBasedRender: Conditional rendering wrapper            │
│  - AdminOnly: Show only to admins                            │
│  - UserOrAdmin: Show to users and admins                     │
│  - useRoles: React hook for role checking                    │
│  - RoleButton: Button that hides if no permission            │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                  Your React Components                        │
│  - Pages show/hide based on roles                            │
│  - Buttons appear only if user has permission                │
│  - Sidebar navigation filtered by roles                      │
│  - Forms fields restricted by roles                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Files Created

### 1. **components/RoleBasedUI.jsx** (250 lines)
Core role-based UI components and hooks:
- `RoleBasedRender` - Main conditional rendering component
- `AdminOnly` - Shorthand for admin-only content
- `UserOrAdmin` - Show to both users and admins
- `useRoles` - Custom hook for role checking
- `RoleButton` - Role-based button component
- `RoleLink` - Role-based navigation link
- `RoleBadges` - Display user roles as badges

### 2. **components/examples/RoleBasedExamples.jsx** (400+ lines)
Real-world examples:
- `EmployeesPageExample` - Employee list with role-based actions
- `SettingsPageExample` - Admin-only settings page
- `DashboardExample` - Dashboard with conditional cards
- `EmployeeFormExample` - Form with role-based fields
- `RoleButtonExample` - Button examples

### 3. **utils/roleHelpers.ts** (350+ lines)
Utility functions for role-based logic:
- Role constants (`ROLES.ADMIN`, `ROLES.USER`)
- Permission checking functions
- Page access functions
- Feature access functions
- Role display utilities

### 4. **components/layout/Sidebar.tsx** (UPDATED)
- Menu items now have `requiredRoles` property
- Sidebar automatically filters items based on user roles
- Admin-only items show "Admin" badge

### 5. **components/layout/Navbar.tsx** (UPDATED)
- Displays user's full name
- Shows user roles as badges
- Admin users get shield icon
- Role information in dropdown

---

## 👥 Role Definitions

### ROLE_ADMIN
- Full access to all features
- Can create, edit, delete employees
- Can manage loans and advances
- Can process payroll
- Can access settings
- Can generate reports

### ROLE_USER
- Limited access
- Can view own information
- Can view documents and letters
- Can check attendance
- Cannot perform CRUD operations
- Cannot access admin pages

---

## 💡 Usage Examples

### Example 1: Basic Role-Based Rendering

```jsx
import { AdminOnly, UserOrAdmin } from '../components/RoleBasedUI';

function MyPage() {
  return (
    <div>
      {/* Everyone authenticated can see this */}
      <UserOrAdmin>
        <h1>Welcome to Dashboard</h1>
      </UserOrAdmin>

      {/* Only admins see this */}
      <AdminOnly>
        <button>Delete All Users</button>
      </AdminOnly>
    </div>
  );
}
```

### Example 2: Using the useRoles Hook

```jsx
import { useRoles } from '../components/RoleBasedUI';

function EmployeePage() {
  const { isAdmin, canEdit, canDelete, hasRole } = useRoles();

  return (
    <div>
      <h1>Employee Details</h1>
      
      {isAdmin() && (
        <button>Edit Employee</button>
      )}

      {canDelete() && (
        <button>Delete Employee</button>
      )}

      {hasRole('ROLE_ADMIN') && (
        <div>Admin Panel</div>
      )}
    </div>
  );
}
```

### Example 3: RoleBasedRender with Props

```jsx
import { RoleBasedRender } from '../components/RoleBasedUI';

function Dashboard() {
  return (
    <div>
      {/* Single role requirement */}
      <RoleBasedRender requiredRole="ROLE_ADMIN">
        <div>Admin Dashboard</div>
      </RoleBasedRender>

      {/* Multiple role options */}
      <RoleBasedRender requiredAnyRole={['ROLE_USER', 'ROLE_ADMIN']}>
        <div>User Dashboard</div>
      </RoleBasedRender>

      {/* With fallback */}
      <RoleBasedRender 
        requiredRole="ROLE_ADMIN" 
        fallback={<p>Access Denied</p>}
      >
        <div>Admin Content</div>
      </RoleBasedRender>

      {/* Admin-only shorthand */}
      <RoleBasedRender requireAdmin={true}>
        <div>Admin Only</div>
      </RoleBasedRender>
    </div>
  );
}
```

### Example 4: Role-Based Buttons

```jsx
import { RoleButton } from '../components/RoleBasedUI';

function ActionButtons() {
  return (
    <div>
      {/* Only visible to admins */}
      <RoleButton
        requireAdmin={true}
        onClick={() => console.log('Create')}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        Create Employee
      </RoleButton>

      {/* Visible to users or admins */}
      <RoleButton
        requiredAnyRole={['ROLE_USER', 'ROLE_ADMIN']}
        onClick={() => console.log('View')}
        className="bg-gray-600 text-white px-4 py-2 rounded"
      >
        View Details
      </RoleButton>
    </div>
  );
}
```

### Example 5: Employee List with Role-Based Actions

```jsx
import { AdminOnly, UserOrAdmin, useRoles } from '../components/RoleBasedUI';

function EmployeeList({ employees }) {
  const { canEdit, canDelete } = useRoles();

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h1>Employees</h1>
        <AdminOnly>
          <button className="bg-blue-600 text-white px-4 py-2 rounded">
            + New Employee
          </button>
        </AdminOnly>
      </div>

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {employees.map(emp => (
            <tr key={emp.id}>
              <td>{emp.name}</td>
              <td>{emp.email}</td>
              <td>
                <UserOrAdmin>
                  <button>View</button>
                </UserOrAdmin>
                
                {canEdit() && <button>Edit</button>}
                {canDelete() && <button>Delete</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### Example 6: Conditional Page Rendering

```jsx
import { useRoles } from '../components/RoleBasedUI';

function SettingsPage() {
  const { isAdmin } = useRoles();

  // Early return if not admin
  if (!isAdmin()) {
    return (
      <div className="p-6 text-center">
        <h2>Access Denied</h2>
        <p>This page is only accessible to administrators.</p>
      </div>
    );
  }

  // Admin content
  return (
    <div className="p-6">
      <h1>System Settings</h1>
      {/* Settings form */}
    </div>
  );
}
```

### Example 7: Form with Role-Based Fields

```jsx
import { AdminOnly } from '../components/RoleBasedUI';

function EmployeeForm() {
  return (
    <form>
      {/* Everyone can see these */}
      <input name="name" placeholder="Name" />
      <input name="email" placeholder="Email" />

      {/* Only admins can edit salary */}
      <AdminOnly>
        <div className="border-t pt-4">
          <label>Salary (Admin Only)</label>
          <input type="number" name="salary" />
        </div>
      </AdminOnly>

      {/* Only admins can change status */}
      <AdminOnly>
        <label>Employee Status</label>
        <select name="status">
          <option>Active</option>
          <option>Inactive</option>
        </select>
      </AdminOnly>

      <button type="submit">Save</button>
    </form>
  );
}
```

### Example 8: Using Utility Functions

```jsx
import { canCreate, canEdit, canDelete, isUserAdmin } from '../utils/roleHelpers';

function MyComponent() {
  return (
    <div>
      {canCreate() && <button>Create</button>}
      {canEdit() && <button>Edit</button>}
      {canDelete() && <button>Delete</button>}
      
      {isUserAdmin() && <div>Admin Panel</div>}
    </div>
  );
}
```

---

## 📚 Component Reference

### RoleBasedRender

Main component for conditional rendering based on roles.

**Props:**
- `requiredRole?: string` - Single role required (e.g., 'ROLE_ADMIN')
- `requiredAnyRole?: string[]` - Array of roles (user needs any one)
- `requireAdmin?: boolean` - Shorthand for admin-only
- `fallback?: ReactNode` - What to show if no access
- `children: ReactNode` - Content to show if user has access

### AdminOnly

Shorthand component for admin-only content.

**Props:**
- `fallback?: ReactNode` - What to show if not admin
- `children: ReactNode` - Admin-only content

### UserOrAdmin

Shows content to both regular users and admins.

**Props:**
- `fallback?: ReactNode` - What to show if no access
- `children: ReactNode` - Content for users/admins

### useRoles Hook

Custom React hook for role checking in components.

**Returns:**
```typescript
{
  user: User | null,
  roles: string[],
  hasRole: (role: string) => boolean,
  hasAnyRole: (roles: string[]) => boolean,
  isAdmin: () => boolean,
  isUser: () => boolean,
  canCreate: () => boolean,
  canEdit: () => boolean,
  canDelete: () => boolean,
  canView: () => boolean,
}
```

### RoleButton

Button that only renders if user has required role.

**Props:**
- `requiredRole?: string`
- `requiredAnyRole?: string[]`
- `requireAdmin?: boolean`
- Standard button props (onClick, disabled, className, etc.)

---

## 🛠️ Utility Functions

### Role Checking
```typescript
isUserAdmin(): boolean                    // Check if user is admin
isUserRole(): boolean                     // Check if user has USER role
hasPermission(permission: string): boolean // Check specific permission
```

### CRUD Permissions
```typescript
canCreate(): boolean   // Can create records
canEdit(): boolean     // Can edit records
canDelete(): boolean   // Can delete records
canView(): boolean     // Can view records
```

### Page Access
```typescript
canAccessEmployeesPage(): boolean
canAccessNewEmployeePage(): boolean
canAccessDesignationsPage(): boolean
canAccessPayrollPage(): boolean
canAccessLoansPage(): boolean
canAccessAdvancesPage(): boolean
canAccessPayRunPage(): boolean
canAccessSettingsPage(): boolean
canAccessDashboard(): boolean
canAccessAttendance(): boolean
canAccessDocuments(): boolean
canAccessLetters(): boolean
```

### Feature Access
```typescript
canApproveLoans(): boolean
canProcessPayroll(): boolean
canManageUsers(): boolean
canViewSalaries(): boolean
canEditSalaries(): boolean
canGenerateReports(): boolean
canExportData(): boolean
```

### Role Display
```typescript
getUserRoleNames(): string[]              // Get role display names
getPrimaryRole(): string                  // Get highest role
getPrimaryRoleDisplayName(): string       // Get display name of primary role
getRoleBadgeColor(role: string)          // Get Tailwind classes for badge
```

---

## 🔗 Integration Steps

### Step 1: Import Components in Your Pages

```jsx
// In your pages
import { AdminOnly, UserOrAdmin, useRoles } from '../components/RoleBasedUI';
```

### Step 2: Wrap Conditional Content

```jsx
function MyPage() {
  return (
    <div>
      <AdminOnly>
        <button>Admin Action</button>
      </AdminOnly>
    </div>
  );
}
```

### Step 3: Use Role Hooks

```jsx
function MyPage() {
  const { isAdmin, canEdit } = useRoles();
  
  return (
    <div>
      {isAdmin() && <AdminPanel />}
      {canEdit() && <EditButton />}
    </div>
  );
}
```

### Step 4: Update Existing Pages

Add role checks to existing pages:

**Before:**
```jsx
function EmployeesPage() {
  return (
    <div>
      <button onClick={handleCreate}>New Employee</button>
      <button onClick={handleDelete}>Delete</button>
    </div>
  );
}
```

**After:**
```jsx
import { AdminOnly } from '../components/RoleBasedUI';

function EmployeesPage() {
  return (
    <div>
      <AdminOnly>
        <button onClick={handleCreate}>New Employee</button>
      </AdminOnly>
      <AdminOnly>
        <button onClick={handleDelete}>Delete</button>
      </AdminOnly>
    </div>
  );
}
```

---

## 🧪 Testing

### Test User Roles

1. **Login as Admin** (username: `admin`, password: `admin123`)
   - Should see all sidebar items
   - Should see "Administrator" badge in navbar
   - Should see all CRUD buttons
   - Should access Settings page

2. **Login as User** (create user with ROLE_USER)
   - Should see limited sidebar items
   - Should see "User" badge in navbar
   - Should NOT see Create/Edit/Delete buttons
   - Should NOT access admin pages

### Browser Console Testing

```javascript
// Check current user
console.log(JSON.parse(localStorage.getItem('auth_user')));

// Check roles
const user = JSON.parse(localStorage.getItem('auth_user'));
console.log('Roles:', user.roles);

// Manual role check
import { hasRole, isAdmin } from './services/authService';
console.log('Is Admin?', isAdmin());
console.log('Has ROLE_USER?', hasRole('ROLE_USER'));
```

### Role Verification Checklist

- [ ] Admin users see all sidebar items
- [ ] Regular users see limited sidebar items
- [ ] Admin-only buttons hidden from regular users
- [ ] Settings page blocked for regular users
- [ ] Employee CRUD restricted to admins
- [ ] Loan management restricted to admins
- [ ] Role badges display correctly in navbar
- [ ] Logout works for both roles

---

## 🐛 Troubleshooting

### Issue: User roles not showing

**Solution:**
```javascript
// Check if roles are in localStorage
const user = JSON.parse(localStorage.getItem('auth_user'));
console.log('User:', user);
console.log('Roles:', user?.roles);

// If roles are missing, backend may not be sending them
// Check backend UserDTO or response
```

### Issue: All sidebar items hidden

**Solution:**
```javascript
// Check if user is authenticated
import { isAuthenticated, getUser } from './services/authService';
console.log('Authenticated?', isAuthenticated());
console.log('User:', getUser());

// If getUser() returns null, token may be expired
```

### Issue: Admin features showing to regular users

**Solution:**
```jsx
// Double-check role requirements
<AdminOnly>  {/* Correct */}
  <button>Delete</button>
</AdminOnly>

// NOT this:
{isAdmin && <button>Delete</button>}  {/* Wrong - needs () */}
```

### Issue: TypeScript errors with roleHelpers

**Solution:**
```typescript
// If using TypeScript, ensure proper imports
import { ROLES, canCreate, canEdit } from '../utils/roleHelpers';

// Or use type assertion
const roles = user.roles as string[];
```

### Issue: Roles not decoded from JWT

**Solution:**
The `authService.js` already handles JWT decoding. Check:

```javascript
// In authService.js, login function stores user data:
localStorage.setItem('auth_user', JSON.stringify(response.data.user));

// Make sure backend sends user object with roles:
{
  "token": "eyJhbG...",
  "user": {
    "id": 1,
    "username": "admin",
    "fullName": "Admin User",
    "roles": ["ROLE_ADMIN"]  // ← This must be present
  }
}
```

---

## 📖 Quick Reference

### Admin-Only Pages
- Employees (CRUD)
- New Employee
- Designations
- Payroll
- Loan Register
- Advance Register
- Pay Run
- Settings

### User + Admin Pages
- Dashboard
- Attendance
- Documents
- Letters
- Calculator
- Career

### Common Patterns

```jsx
// Pattern 1: Hide button for non-admins
<AdminOnly>
  <button>Admin Action</button>
</AdminOnly>

// Pattern 2: Show to all authenticated
<UserOrAdmin>
  <div>Content for all users</div>
</UserOrAdmin>

// Pattern 3: Conditional with hook
const { isAdmin } = useRoles();
{isAdmin() && <AdminPanel />}

// Pattern 4: Check before API call
const handleDelete = () => {
  if (!canDelete()) {
    alert('No permission');
    return;
  }
  // Proceed with delete
};
```

---

## 🎉 Summary

You now have a complete role-based UI system:

✅ JWT roles automatically decoded  
✅ Reusable components (AdminOnly, UserOrAdmin, RoleBasedRender)  
✅ Custom hook (useRoles) for flexible role checking  
✅ Sidebar filtered by roles  
✅ Navbar shows user roles  
✅ Comprehensive utility functions  
✅ Real-world examples included  
✅ TypeScript support  

**Next Steps:**
1. Test with admin and user accounts
2. Update your existing pages with role checks
3. Add role requirements to new features
4. Review the examples in `components/examples/RoleBasedExamples.jsx`

For more help, see:
- `FRONTEND-JWT-GUIDE.md` - JWT authentication setup
- `components/examples/RoleBasedExamples.jsx` - Real-world usage examples
- `utils/roleHelpers.ts` - All utility functions
