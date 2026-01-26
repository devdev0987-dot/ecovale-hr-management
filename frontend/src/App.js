import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import EmployeeList from './components/EmployeeList';
import EmployeeForm from './components/EmployeeForm';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <header className="App-header">
          <h1>🌿 Ecovale HR Management System</h1>
          <nav>
            <Link to="/" className="nav-link">Employees</Link>
            <Link to="/add" className="nav-link">Add Employee</Link>
          </nav>
        </header>
        
        <main className="App-main">
          <Routes>
            <Route path="/" element={<EmployeeList />} />
            <Route path="/add" element={<EmployeeForm />} />
            <Route path="/edit/:id" element={<EmployeeForm />} />
          </Routes>
        </main>
        
        <footer className="App-footer">
          <p>&copy; 2026 Ecovale HR Management System</p>
        </footer>
      </div>
    </Router>
  );
}

export default App;
