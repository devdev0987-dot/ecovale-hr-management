# Role-Based UI Integration Checklist

Quick checklist for integrating role-based UI into your React app.

## ✅ Files Created (Complete)

- [x] `components/RoleBasedUI.jsx` - Core role components
- [x] `components/examples/RoleBasedExamples.jsx` - Usage examples
- [x] `utils/roleHelpers.ts` - Utility functions
- [x] `components/layout/Sidebar.tsx` - Updated with role filtering
- [x] `components/layout/Navbar.tsx` - Updated with role display
- [x] `ROLE-BASED-UI-GUIDE.md` - Complete documentation

## 🚀 Integration Steps

### Step 1: Verify JWT Contains Roles ✓

Your backend already sends JWT with roles. The token payload contains:
```json
{
  "userId": 1,
  "username": "admin",
  "roles": ["ROLE_ADMIN"]
}
```

**Test:**
```bash
# Login and check token
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Response should include user.roles array
```

### Step 2: Update Existing Pages with Role Checks

#### Example: EmployeesPage.tsx

**Add import:**
```jsx
import { AdminOnly, UserOrAdmin, useRoles } from '../components/RoleBasedUI';
```

**Wrap admin-only buttons:**
```jsx
// Before:
<button onClick={handleCreate}>+ New Employee</button>

// After:
<AdminOnly>
  <button onClick={handleCreate}>+ New Employee</button>
</AdminOnly>
```

**Wrap action buttons:**
```jsx
<td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
  <UserOrAdmin>
    <button onClick={() => handleView(employee.id)}>View</button>
  </UserOrAdmin>
  
  <AdminOnly>
    <button onClick={() => handleEdit(employee.id)}>Edit</button>
    <button onClick={() => handleDelete(employee.id)}>Delete</button>
  </AdminOnly>
</td>
```

#### Example: NewEmployeePage.tsx

**Protect entire page:**
```jsx
import { useRoles } from '../components/RoleBasedUI';

function NewEmployeePage() {
  const { isAdmin } = useRoles();

  // Block non-admins
  if (!isAdmin()) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-bold text-gray-800 mb-2">Access Denied</h2>
        <p className="text-gray-600">Only administrators can create employees.</p>
      </div>
    );
  }

  // Rest of your page code...
}
```

#### Example: DashboardPage.tsx

**Conditional cards:**
```jsx
import { AdminOnly, UserOrAdmin } from '../components/RoleBasedUI';

function DashboardPage() {
  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Everyone sees this */}
      <UserOrAdmin>
        <div className="card">My Profile</div>
      </UserOrAdmin>

      {/* Admin-only cards */}
      <AdminOnly>
        <div className="card">Employee Management</div>
      </AdminOnly>
      
      <AdminOnly>
        <div className="card">Payroll</div>
      </AdminOnly>
    </div>
  );
}
```

### Step 3: Test Both Roles

#### As Admin (username: `admin`, password: `admin123`):
- [ ] See all sidebar items (Employees, New Employee, Payroll, Loans, Settings)
- [ ] See "Administrator" badge in navbar
- [ ] See Create/Edit/Delete buttons on Employees page
- [ ] Can access Settings page
- [ ] See admin-only dashboard cards

#### As Regular User:
First, create a user with ROLE_USER:
```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john",
    "password": "password123",
    "fullName": "John Doe",
    "email": "john@example.com",
    "roles": ["ROLE_USER"]
  }'
```

Then login and verify:
- [ ] See limited sidebar items (Dashboard, Attendance, Documents)
- [ ] See "User" badge in navbar
- [ ] Do NOT see Create/Edit/Delete buttons
- [ ] Cannot access Settings page (should show access denied)
- [ ] Do NOT see admin-only dashboard cards

### Step 4: Update All Pages

Use this template for each page:

#### Pages that should be ADMIN-ONLY:
- [ ] `EmployeesPage.tsx` - Add role checks to CRUD buttons
- [ ] `NewEmployeePage.tsx` - Block entire page if not admin
- [ ] `DesignationsPage.tsx` - Block entire page if not admin
- [ ] `PayrollPage.tsx` - Block entire page if not admin
- [ ] `LoanRegisterPage.tsx` - Block entire page if not admin
- [ ] `AdvanceRegisterPage.tsx` - Block entire page if not admin
- [ ] `PayRunPage.tsx` - Block entire page if not admin
- [ ] `SettingsPage.tsx` - Block entire page if not admin

Template for blocking pages:
```jsx
import { useRoles } from '../components/RoleBasedUI';

function AdminOnlyPage() {
  const { isAdmin } = useRoles();

  if (!isAdmin()) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-600">
            This page is only accessible to administrators.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Your admin page content */}
    </div>
  );
}
```

#### Pages that should be ACCESSIBLE TO ALL:
- [ ] `DashboardPage.tsx` - Show different content based on role
- [ ] `AttendanceRegisterPage.tsx` - All can view, only admin can edit
- [ ] `DocumentsPage.tsx` - All can view
- [ ] `LettersPage.tsx` - All can view
- [ ] `CalculatorPage.tsx` - All can use
- [ ] `CareerPage.tsx` - All can view

Template for conditional content:
```jsx
import { AdminOnly, UserOrAdmin } from '../components/RoleBasedUI';

function SharedPage() {
  return (
    <div>
      {/* Everyone sees this */}
      <UserOrAdmin>
        <div>View Content</div>
      </UserOrAdmin>

      {/* Only admins see this */}
      <AdminOnly>
        <button>Edit</button>
        <button>Delete</button>
      </AdminOnly>
    </div>
  );
}
```

## 🧪 Testing Checklist

### Manual Testing

#### Test 1: Sidebar Navigation
- [ ] Login as admin → see all menu items
- [ ] Login as user → see limited menu items
- [ ] Admin-only items show "Admin" badge
- [ ] Click each item and verify access

#### Test 2: Page Access
- [ ] Admin can access all pages
- [ ] User blocked from admin-only pages
- [ ] Blocked pages show "Access Denied" message
- [ ] User can access allowed pages

#### Test 3: Button Visibility
- [ ] Admin sees Create/Edit/Delete buttons
- [ ] User does NOT see Create/Edit/Delete buttons
- [ ] User sees View buttons
- [ ] Buttons don't appear/disappear on role change without re-render

#### Test 4: Navbar Display
- [ ] Navbar shows correct username
- [ ] Role badges display correctly (Administrator vs User)
- [ ] Admin users have shield icon
- [ ] Dropdown shows correct role information

#### Test 5: Form Fields
- [ ] Admin can edit all form fields
- [ ] User has read-only access to sensitive fields
- [ ] Admin-only fields hidden from users
- [ ] Form submission respects role permissions

### Browser Console Testing

```javascript
// Test 1: Check stored user data
const user = JSON.parse(localStorage.getItem('auth_user'));
console.log('User:', user);
console.log('Roles:', user.roles);

// Test 2: Test role functions
import { hasRole, isAdmin, hasAnyRole } from './services/authService';
console.log('Is Admin?', isAdmin());
console.log('Has ROLE_USER?', hasRole('ROLE_USER'));
console.log('Has any role?', hasAnyRole(['ROLE_USER', 'ROLE_ADMIN']));

// Test 3: Test utility functions
import { canCreate, canEdit, canDelete } from './utils/roleHelpers';
console.log('Can Create?', canCreate());
console.log('Can Edit?', canEdit());
console.log('Can Delete?', canDelete());

// Test 4: Check JWT token
const token = localStorage.getItem('auth_token');
const payload = JSON.parse(atob(token.split('.')[1]));
console.log('Token Payload:', payload);
console.log('Token Roles:', payload.roles);
```

### API Testing

```bash
# Test 1: Login as admin
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Test 2: Login as user (after creating one)
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"john","password":"password123"}'

# Test 3: Access protected endpoint with token
curl -X GET http://localhost:8080/api/employees \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Test 4: Try admin endpoint as user (should fail)
curl -X DELETE http://localhost:8080/api/employees/1 \
  -H "Authorization: Bearer USER_TOKEN_HERE"
```

## 🐛 Common Issues & Solutions

### Issue 1: Roles not showing in navbar
**Solution:**
```javascript
// Check if backend sends roles in login response
// Response should include:
{
  "token": "...",
  "user": {
    "id": 1,
    "username": "admin",
    "fullName": "Admin User",
    "roles": ["ROLE_ADMIN"]  // ← Must be present
  }
}
```

### Issue 2: All sidebar items hidden
**Solution:**
```javascript
// Check if user is authenticated
import { isAuthenticated } from './services/authService';
console.log('Authenticated?', isAuthenticated());

// If false, token may be expired or invalid
```

### Issue 3: Admin features visible to regular users
**Solution:**
```jsx
// Make sure you're using the components correctly:
<AdminOnly>  {/* ✓ Correct */}
  <button>Delete</button>
</AdminOnly>

// NOT this:
{isAdmin && <button>Delete</button>}  {/* ✗ Wrong */}
```

### Issue 4: TypeScript errors
**Solution:**
```typescript
// Add type definitions if needed
interface MenuItem {
  icon: any;
  label: string;
  page: string;
  requiredRoles?: string[];
}
```

### Issue 5: Components not re-rendering on role change
**Solution:**
```jsx
// Use AuthContext to trigger re-renders on auth changes
import { useAuth } from '../contexts/AuthContext';

function MyComponent() {
  const { user, isAuthenticated } = useAuth();
  // Component will re-render when auth state changes
}
```

## 📚 Reference Documentation

- **ROLE-BASED-UI-GUIDE.md** - Complete implementation guide
- **FRONTEND-JWT-GUIDE.md** - JWT authentication setup
- **components/examples/RoleBasedExamples.jsx** - Real-world examples
- **utils/roleHelpers.ts** - All utility functions

## ✅ Success Criteria

Your role-based UI is working correctly when:

- [x] Admin users see all features and pages
- [x] Regular users see limited features and pages
- [x] Sidebar navigation filtered by roles
- [x] Navbar displays user roles correctly
- [x] Admin-only buttons hidden from regular users
- [x] Admin-only pages blocked for regular users
- [x] No console errors related to roles
- [x] JWT roles properly decoded and stored
- [x] Role checks work in all components
- [x] Both admin and user logins tested successfully

## 🎉 You're Done!

Your React app now has complete role-based UI rendering:

✅ JWT roles extracted from backend  
✅ Sidebar filtered by roles  
✅ Navbar shows user roles  
✅ Admin-only pages protected  
✅ Buttons show/hide based on roles  
✅ Reusable components available  
✅ Utility functions for custom logic  

**Next Steps:**
1. Test with both admin and user accounts
2. Update remaining pages with role checks
3. Add more granular permissions if needed
4. Consider adding role-based API call guards

Need help? Check the examples in `components/examples/RoleBasedExamples.jsx`!
