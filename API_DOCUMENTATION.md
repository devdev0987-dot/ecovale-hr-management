# Ecovale HR Management API Documentation

## Base URL
```
http://localhost:5000/api
```

## Endpoints

### Health Check

#### Check API Status
```http
GET /api/health
```

**Response:**
```json
{
  "status": "ok",
  "message": "Ecovale HR Management API is running"
}
```

---

## Employee Management

### Get All Employees

Retrieve a list of all employees.

```http
GET /api/employees
```

**Response:**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@ecovale.com",
      "position": "Software Engineer",
      "department": "Engineering",
      "salary": 75000,
      "hireDate": "2024-01-15T00:00:00.000Z",
      "status": "active",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

---

### Get Single Employee

Retrieve a specific employee by ID.

```http
GET /api/employees/:id
```

**Parameters:**
- `id` (string, required) - Employee ID

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@ecovale.com",
    "position": "Software Engineer",
    "department": "Engineering",
    "salary": 75000,
    "hireDate": "2024-01-15T00:00:00.000Z",
    "status": "active",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Response (404):**
```json
{
  "success": false,
  "error": "Employee not found"
}
```

---

### Create Employee

Create a new employee record.

```http
POST /api/employees
```

**Request Body:**
```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "email": "jane.smith@ecovale.com",
  "position": "Product Manager",
  "department": "Product",
  "salary": 85000,
  "hireDate": "2024-02-01",
  "status": "active"
}
```

**Required Fields:**
- `firstName` (string) - Employee's first name
- `lastName` (string) - Employee's last name
- `email` (string) - Valid email address (must be unique)
- `position` (string) - Job position
- `department` (string) - Department name
- `salary` (number) - Salary amount (must be positive)

**Optional Fields:**
- `hireDate` (date) - Hire date (defaults to current date)
- `status` (string) - Employee status: "active", "inactive", or "on-leave" (defaults to "active")

**Response (201):**
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439012",
    "firstName": "Jane",
    "lastName": "Smith",
    "email": "jane.smith@ecovale.com",
    "position": "Product Manager",
    "department": "Product",
    "salary": 85000,
    "hireDate": "2024-02-01T00:00:00.000Z",
    "status": "active",
    "createdAt": "2024-02-01T09:00:00.000Z",
    "updatedAt": "2024-02-01T09:00:00.000Z"
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": "Email is required"
}
```

---

### Update Employee

Update an existing employee record.

```http
PUT /api/employees/:id
```

**Parameters:**
- `id` (string, required) - Employee ID

**Request Body:**
```json
{
  "salary": 90000,
  "position": "Senior Product Manager",
  "status": "active"
}
```

**Note:** Only include fields you want to update. All fields are optional in update requests.

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439012",
    "firstName": "Jane",
    "lastName": "Smith",
    "email": "jane.smith@ecovale.com",
    "position": "Senior Product Manager",
    "department": "Product",
    "salary": 90000,
    "hireDate": "2024-02-01T00:00:00.000Z",
    "status": "active",
    "createdAt": "2024-02-01T09:00:00.000Z",
    "updatedAt": "2024-03-15T14:20:00.000Z"
  }
}
```

**Error Response (404):**
```json
{
  "success": false,
  "error": "Employee not found"
}
```

---

### Delete Employee

Delete an employee record.

```http
DELETE /api/employees/:id
```

**Parameters:**
- `id` (string, required) - Employee ID

**Response:**
```json
{
  "success": true,
  "data": {}
}
```

**Error Response (404):**
```json
{
  "success": false,
  "error": "Employee not found"
}
```

---

## Error Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid input |
| 404 | Not Found - Resource doesn't exist |
| 500 | Internal Server Error |

---

## Data Models

### Employee Schema

```javascript
{
  firstName: String,      // Required
  lastName: String,       // Required
  email: String,          // Required, unique, valid email format
  position: String,       // Required
  department: String,     // Required
  salary: Number,         // Required, must be >= 0
  hireDate: Date,         // Defaults to current date
  status: String,         // "active", "inactive", "on-leave" (default: "active")
  createdAt: Date,        // Auto-generated
  updatedAt: Date         // Auto-generated
}
```

---

## Examples

### Using cURL

**Create an employee:**
```bash
curl -X POST http://localhost:5000/api/employees \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Alice",
    "lastName": "Johnson",
    "email": "alice.johnson@ecovale.com",
    "position": "UX Designer",
    "department": "Design",
    "salary": 70000
  }'
```

**Get all employees:**
```bash
curl http://localhost:5000/api/employees
```

**Update an employee:**
```bash
curl -X PUT http://localhost:5000/api/employees/507f1f77bcf86cd799439011 \
  -H "Content-Type: application/json" \
  -d '{
    "salary": 80000,
    "status": "active"
  }'
```

**Delete an employee:**
```bash
curl -X DELETE http://localhost:5000/api/employees/507f1f77bcf86cd799439011
```

### Using JavaScript (Axios)

```javascript
import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

// Get all employees
const getAllEmployees = async () => {
  const response = await axios.get(`${API_URL}/employees`);
  return response.data;
};

// Create employee
const createEmployee = async (employeeData) => {
  const response = await axios.post(`${API_URL}/employees`, employeeData);
  return response.data;
};

// Update employee
const updateEmployee = async (id, employeeData) => {
  const response = await axios.put(`${API_URL}/employees/${id}`, employeeData);
  return response.data;
};

// Delete employee
const deleteEmployee = async (id) => {
  const response = await axios.delete(`${API_URL}/employees/${id}`);
  return response.data;
};
```

---

## Rate Limiting

Currently, there are no rate limits on the API. This may be added in future versions.

## Authentication

Authentication is not yet implemented. Future versions will require JWT tokens for all endpoints except health check.

---

## Support

For API support or questions, please open an issue on GitHub or contact support@ecovale.com.
