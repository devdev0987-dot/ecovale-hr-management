# 🌿 Ecovale HR Management System

A full-stack HR management system built with Node.js, Express, MongoDB, and React.

## Features

- ✅ Employee Management (Create, Read, Update, Delete)
- 👥 Employee Directory with filtering and search
- 📊 Department and Position tracking
- 💰 Salary management
- 📅 Hire date tracking
- 🔄 Employee status management (Active, Inactive, On Leave)
- 📱 Responsive design for mobile and desktop

## Tech Stack

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web framework
- **MongoDB** - NoSQL database
- **Mongoose** - MongoDB object modeling
- **JWT** - Authentication (ready for implementation)
- **bcryptjs** - Password hashing (ready for implementation)

### Frontend
- **React** - UI library
- **React Router** - Client-side routing
- **Axios** - HTTP client
- **CSS3** - Styling

## Project Structure

```
ecovale-hr-management/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── database.js       # MongoDB connection
│   │   ├── models/
│   │   │   └── Employee.js       # Employee schema
│   │   ├── routes/
│   │   │   └── employees.js      # Employee routes
│   │   └── server.js             # Express server
│   ├── .env.example              # Environment variables template
│   └── package.json
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── components/
│   │   │   ├── EmployeeList.js   # Employee directory
│   │   │   ├── EmployeeList.css
│   │   │   ├── EmployeeForm.js   # Add/Edit employee form
│   │   │   └── EmployeeForm.css
│   │   ├── services/
│   │   │   └── api.js            # API service layer
│   │   ├── App.js                # Main app component
│   │   ├── App.css
│   │   ├── index.js
│   │   └── index.css
│   ├── .env.example              # Environment variables template
│   └── package.json
└── README.md
```

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/devdev0987-dot/ecovale-hr-management.git
   cd ecovale-hr-management
   ```

2. **Set up the Backend**
   ```bash
   cd backend
   npm install
   
   # Copy environment variables
   cp .env.example .env
   
   # Edit .env and configure your MongoDB connection
   # MONGODB_URI=mongodb://localhost:27017/ecovale_hr
   ```

3. **Set up the Frontend**
   ```bash
   cd ../frontend
   npm install
   
   # Copy environment variables
   cp .env.example .env
   
   # The default API URL is http://localhost:5000/api
   ```

4. **Start MongoDB**
   ```bash
   # Make sure MongoDB is running on your system
   # macOS/Linux: sudo systemctl start mongod
   # Windows: Start MongoDB service
   ```

5. **Run the Application**

   Open two terminal windows:

   **Terminal 1 - Backend:**
   ```bash
   cd backend
   npm start
   # Backend will run on http://localhost:5000
   ```

   **Terminal 2 - Frontend:**
   ```bash
   cd frontend
   npm start
   # Frontend will run on http://localhost:3000
   ```

6. **Access the Application**
   
   Open your browser and navigate to `http://localhost:3000`

## API Endpoints

### Employees

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/employees` | Get all employees |
| GET | `/api/employees/:id` | Get employee by ID |
| POST | `/api/employees` | Create new employee |
| PUT | `/api/employees/:id` | Update employee |
| DELETE | `/api/employees/:id` | Delete employee |

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Check API status |

### Example API Request

**Create Employee:**
```bash
curl -X POST http://localhost:5000/api/employees \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@ecovale.com",
    "position": "Software Engineer",
    "department": "Engineering",
    "salary": 75000,
    "status": "active"
  }'
```

## Development

### Backend Development
```bash
cd backend
npm run dev  # Uses nodemon for auto-reload
```

### Frontend Development
```bash
cd frontend
npm start  # Runs with hot reload
```

## Future Enhancements

- 🔐 User authentication and authorization
- 📊 Dashboard with analytics
- 📄 Export employee data (PDF, Excel)
- 🔍 Advanced search and filtering
- 📧 Email notifications
- 📸 Employee profile pictures
- 📝 Performance reviews module
- 🗓️ Leave management system
- 💼 Payroll integration

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License - see the LICENSE file for details.

## Support

For support, email support@ecovale.com or open an issue in the repository.

---

Made with ❤️ by Ecovale Team