# 🚀 Role-Based UI - Quick Start

Get started with role-based UI rendering in **2 minutes**.

## ✅ Files Ready

All implementation files are created and ready to use:

- ✅ `components/RoleBasedUI.jsx` - Core components
- ✅ `utils/roleHelpers.ts` - Utility functions
- ✅ `components/layout/Sidebar.tsx` - Updated with role filtering
- ✅ `components/layout/Navbar.tsx` - Updated with role display
- ✅ `services/authService.js` - Updated with getRoleDisplayName()

## 🎯 3 Steps to Use

### Step 1: Import Components
```jsx
import { AdminOnly, UserOrAdmin, useRoles } from '../components/RoleBasedUI';
```

### Step 2: Wrap Your Content
```jsx
// Hide from non-admins
<AdminOnly>
  <button onClick={handleDelete}>Delete</button>
</AdminOnly>

// Show to all users
<UserOrAdmin>
  <button onClick={handleView}>View</button>
</UserOrAdmin>
```

### Step 3: Test
Login as admin (username: `admin`, password: `admin123`) and see all features!

## 💡 Common Patterns

### Pattern 1: Hide Button
```jsx
<AdminOnly>
  <button>Admin Only</button>
</AdminOnly>
```

### Pattern 2: Block Page
```jsx
const { isAdmin } = useRoles();

if (!isAdmin()) {
  return <div>Access Denied</div>;
}
```

### Pattern 3: Conditional Content
```jsx
const { isAdmin, canEdit } = useRoles();

return (
  <div>
    {isAdmin() && <AdminPanel />}
    {canEdit() && <EditButton />}
  </div>
);
```

## 🎨 What's Already Working

### ✅ Sidebar Navigation
Menu items automatically filtered by user roles:
- Admin sees: ALL items
- User sees: Only allowed items
- Admin-only items have "Admin" badge

### ✅ Navbar Display
Shows user information:
- User's full name
- Role badges (Administrator/User)
- Admin users get shield icon
- Dropdown with role details

## 📖 Full Documentation

| Document | Purpose |
|----------|---------|
| **ROLE-BASED-UI-SUMMARY.md** | Overview and architecture |
| **ROLE-BASED-UI-GUIDE.md** | Complete guide with examples |
| **ROLE-BASED-UI-CHECKLIST.md** | Integration checklist |
| **components/examples/RoleBasedExamples.jsx** | Copy-paste examples |

## 🧪 Quick Test

### 1. Start Backend
```bash
cd production/be
mvn spring-boot:run
```

### 2. Start Frontend
```bash
npm run dev
```

### 3. Login as Admin
- Username: `admin`
- Password: `admin123`
- Should see ALL sidebar items
- Should see "Administrator" badge

### 4. Check Browser Console
```javascript
// Check stored roles
const user = JSON.parse(localStorage.getItem('auth_user'));
console.log('Roles:', user.roles);

// Test functions
import { isAdmin, hasRole } from './services/authService';
console.log('Is Admin?', isAdmin());
```

## 🔑 Roles

| Role | Access |
|------|--------|
| **ROLE_ADMIN** | Full access to everything |
| **ROLE_USER** | Limited view-only access |

## 📚 Components Available

| Component | Purpose |
|-----------|---------|
| `<AdminOnly>` | Show only to admins |
| `<UserOrAdmin>` | Show to users and admins |
| `<RoleBasedRender>` | Flexible conditional rendering |
| `useRoles()` | Hook for role checking |
| `<RoleButton>` | Button with role check |
| `<RoleLink>` | Link with role check |

## 🛠️ Utility Functions

```javascript
import { 
  canCreate,    // Can create records?
  canEdit,      // Can edit records?
  canDelete,    // Can delete records?
  isUserAdmin,  // Is admin?
} from '../utils/roleHelpers';
```

## 🎉 You're Ready!

Start using role-based components in your pages:

```jsx
import { AdminOnly } from '../components/RoleBasedUI';

function EmployeesPage() {
  return (
    <div>
      <h1>Employees</h1>
      
      <AdminOnly>
        <button>+ New Employee</button>
      </AdminOnly>
      
      {/* Employee list */}
    </div>
  );
}
```

## 📞 Need More Help?

- See **ROLE-BASED-UI-GUIDE.md** for complete documentation
- See **ROLE-BASED-UI-CHECKLIST.md** for integration steps
- Check **components/examples/RoleBasedExamples.jsx** for code examples

---

**That's it!** Start wrapping your admin-only content with `<AdminOnly>` 🎊
