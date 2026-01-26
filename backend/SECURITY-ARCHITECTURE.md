# JWT Authentication Architecture

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (React + Vite)                        │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐       │
│  │ Login Page │  │ Dashboard  │  │  Employees │  │   Other    │       │
│  │            │  │            │  │    Page    │  │   Pages    │       │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘       │
│        │               │               │               │                 │
│        └───────────────┴───────────────┴───────────────┘                 │
│                              │                                           │
│                    ┌─────────▼──────────┐                               │
│                    │   apiClient.js     │                               │
│                    │  (Axios Client)    │                               │
│                    │                    │                               │
│                    │  - Add JWT Token   │                               │
│                    │  - Handle 401      │                               │
│                    └─────────┬──────────┘                               │
└──────────────────────────────┼────────────────────────────────────────────┘
                               │
                               │ HTTP Requests
                               │ Authorization: Bearer <token>
                               │
┌──────────────────────────────▼────────────────────────────────────────────┐
│                      BACKEND (Spring Boot)                                │
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                    Spring Security Filter Chain                      │ │
│  │                                                                       │ │
│  │  ┌────────────────────┐         ┌────────────────────┐             │ │
│  │  │  CORS Filter       │────────▶│  JWT Auth Filter   │             │ │
│  │  │                    │         │                    │             │ │
│  │  │  - Allow origins   │         │  - Extract token   │             │ │
│  │  │  - Allow methods   │         │  - Validate token  │             │ │
│  │  │  - Allow headers   │         │  - Set auth context│             │ │
│  │  └────────────────────┘         └──────────┬─────────┘             │ │
│  │                                             │                        │ │
│  └─────────────────────────────────────────────┼────────────────────────┘ │
│                                                │                           │
│  ┌─────────────────────────────────────────────▼────────────────────────┐ │
│  │                         Controllers                                   │ │
│  │                                                                        │ │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────┐    │ │
│  │  │ AuthController  │  │ EmployeeCtrl    │  │  Other Ctrlrs    │    │ │
│  │  │                 │  │                 │  │                  │    │ │
│  │  │ /auth/login     │  │ @PreAuthorize   │  │  @PreAuthorize   │    │ │
│  │  │ /auth/register  │  │ hasRole('ADMIN')│  │  Role checks     │    │ │
│  │  │ /auth/me        │  │ hasAnyRole(...)│  │                  │    │ │
│  │  └────────┬────────┘  └────────┬────────┘  └────────┬─────────┘    │ │
│  └───────────┼────────────────────┼────────────────────┼───────────────┘ │
│              │                    │                    │                  │
│  ┌───────────▼────────────────────▼────────────────────▼───────────────┐ │
│  │                            Services                                   │ │
│  │                                                                        │ │
│  │  ┌────────────────┐  ┌──────────────────┐  ┌────────────────────┐  │ │
│  │  │  JwtUtil       │  │  EmployeeService │  │   Other Services   │  │ │
│  │  │                │  │                  │  │                    │  │ │
│  │  │  - Generate    │  │  - Business      │  │  - Business logic  │  │ │
│  │  │  - Validate    │  │    logic         │  │                    │  │ │
│  │  │  - Extract     │  │                  │  │                    │  │ │
│  │  └────────┬───────┘  └────────┬─────────┘  └────────┬───────────┘  │ │
│  └───────────┼────────────────────┼────────────────────┼───────────────┘ │
│              │                    │                    │                  │
│  ┌───────────▼────────────────────▼────────────────────▼───────────────┐ │
│  │                         Repositories                                  │ │
│  │                                                                        │ │
│  │  ┌────────────────┐  ┌──────────────────┐  ┌────────────────────┐  │ │
│  │  │ UserRepository │  │ EmployeeRepo     │  │  Other Repos       │  │ │
│  │  │ RoleRepository │  │                  │  │                    │  │ │
│  │  └────────┬───────┘  └────────┬─────────┘  └────────┬───────────┘  │ │
│  └───────────┼────────────────────┼────────────────────┼───────────────┘ │
└──────────────┼────────────────────┼────────────────────┼──────────────────┘
               │                    │                    │
               └────────────────────┴────────────────────┘
                              │
┌─────────────────────────────▼─────────────────────────────┐
│                      MySQL Database                        │
│                                                            │
│  ┌─────────┐  ┌─────────┐  ┌──────────┐  ┌───────────┐  │
│  │  users  │  │  roles  │  │ employees│  │   Other   │  │
│  └─────────┘  └─────────┘  └──────────┘  └───────────┘  │
│       │            │                                       │
│  ┌────▼────────────▼──┐                                  │
│  │   user_roles       │                                  │
│  │   (junction)       │                                  │
│  └────────────────────┘                                  │
└───────────────────────────────────────────────────────────┘
```

## Authentication Flow

```
┌─────────┐                                              ┌─────────┐
│ Client  │                                              │ Backend │
└────┬────┘                                              └────┬────┘
     │                                                        │
     │  1. POST /api/auth/login                              │
     │     { username, password }                            │
     ├──────────────────────────────────────────────────────▶│
     │                                                        │
     │                              2. Load user from DB     │
     │                                 & validate password   │
     │                                                        │
     │                              3. Generate JWT token    │
     │                                 with user info        │
     │                                                        │
     │  4. Return token + user info                          │
     │     { token, id, username, roles }                    │
     │◀──────────────────────────────────────────────────────┤
     │                                                        │
     │  5. Store token in localStorage                       │
     │                                                        │
     │  6. GET /api/employees                                │
     │     Authorization: Bearer <token>                     │
     ├──────────────────────────────────────────────────────▶│
     │                                                        │
     │                              7. Extract & validate    │
     │                                 token                 │
     │                                                        │
     │                              8. Check @PreAuthorize   │
     │                                 role requirements     │
     │                                                        │
     │  9. Return employee data                              │
     │◀──────────────────────────────────────────────────────┤
     │                                                        │
```

## Request Processing Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                        Incoming Request                           │
│            GET /api/employees                                     │
│            Authorization: Bearer eyJhbGci...                      │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                      CorsFilter                                   │
│  - Check allowed origin                                           │
│  - Validate HTTP method                                           │
│  - Add CORS headers                                               │
└───────────────────────────┬──────────────────────────────────────┘
                            │ PASS
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                  JwtAuthenticationFilter                          │
│  1. Extract token from Authorization header                       │
│  2. Validate token signature                                      │
│  3. Check token expiration                                        │
│  4. Extract username from token                                   │
│  5. Load UserDetails from database                                │
│  6. Set Authentication in SecurityContext                         │
└───────────────────────────┬──────────────────────────────────────┘
                            │ AUTHENTICATED
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                    @PreAuthorize Check                            │
│  @PreAuthorize("hasAnyRole('USER', 'ADMIN')")                    │
│  - Check user roles from SecurityContext                          │
│  - ROLE_USER ✓ or ROLE_ADMIN ✓                                  │
└───────────────────────────┬──────────────────────────────────────┘
                            │ AUTHORIZED
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                    EmployeeController                             │
│  @GetMapping("/api/employees")                                    │
│  public ResponseEntity<?> getAllEmployees() {                     │
│      // Execute business logic                                    │
│  }                                                                 │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                       EmployeeService                             │
│  - Execute business logic                                         │
│  - Call repository methods                                        │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                      EmployeeRepository                           │
│  - Execute database queries                                       │
│  - Return entity objects                                          │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                         Response                                  │
│  200 OK                                                           │
│  {                                                                │
│    "success": true,                                               │
│    "data": [...employees...]                                      │
│  }                                                                 │
└──────────────────────────────────────────────────────────────────┘
```

## Error Handling Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Error Scenarios                           │
└─────────────────────────────────────────────────────────────┘

┌──────────────────┐
│ No Token Sent    │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────┐
│ JwtAuthenticationFilter      │
│ - No Authorization header    │
│ - Continue without auth      │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ Spring Security              │
│ - No Authentication set      │
│ - Return 403 Forbidden       │
└──────────────────────────────┘

┌──────────────────┐
│ Invalid Token    │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────┐
│ JwtAuthenticationFilter      │
│ - Token validation fails     │
│ - Catch exception            │
│ - Continue without auth      │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ Spring Security              │
│ - No Authentication set      │
│ - Return 403 Forbidden       │
└──────────────────────────────┘

┌──────────────────┐
│ Expired Token    │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────┐
│ JwtUtil                      │
│ - isTokenExpired() = true    │
│ - Validation fails           │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ Return 403 Forbidden         │
│ Client should re-login       │
└──────────────────────────────┘

┌──────────────────┐
│ Insufficient Role│
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────┐
│ @PreAuthorize Check          │
│ - User has ROLE_USER         │
│ - Requires ROLE_ADMIN        │
│ - Access denied              │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ Return 403 Forbidden         │
│ { message: "Access Denied" } │
└──────────────────────────────┘
```

## Component Interactions

```
┌─────────────────────────────────────────────────────────────┐
│                     SecurityConfig                           │
│  - Configure security filter chain                           │
│  - Define public endpoints: /api/auth/**                     │
│  - Define protected endpoints: /api/**                       │
│  - Add JwtAuthenticationFilter                               │
│  - Configure CORS                                            │
└────┬───────────────────────────────────────────┬────────────┘
     │                                           │
     │ Creates                                   │ Uses
     │                                           │
     ▼                                           ▼
┌──────────────────────┐             ┌─────────────────────────┐
│ JwtAuthenticationFilter│            │  CustomUserDetailsService│
│  - Extends              │            │  - Loads user from DB   │
│    OncePerRequestFilter │            │  - Returns UserDetails  │
│  - Extract JWT token    │            │                         │
│  - Validate token       │            └───────────┬─────────────┘
│  - Set authentication   │                        │
└──────────┬───────────────┘                       │ Uses
           │                                        │
           │ Uses                                   ▼
           │                              ┌──────────────────┐
           ▼                              │ UserRepository   │
┌──────────────────────┐                 │  - findByUsername│
│      JwtUtil         │                 │  - findByEmail   │
│  - Generate token    │                 └──────────────────┘
│  - Validate token    │
│  - Extract claims    │
│  - Check expiration  │
└──────────────────────┘
```

## Database Entity Relationships

```
┌──────────────────────┐              ┌──────────────────────┐
│       User           │              │       Role           │
├──────────────────────┤              ├──────────────────────┤
│ id (PK)              │              │ id (PK)              │
│ username (UNIQUE)    │              │ name (UNIQUE)        │
│ email (UNIQUE)       │      ┌───────│ description          │
│ password (BCrypt)    │      │       └──────────────────────┘
│ full_name            │      │
│ enabled              │      │ Many-to-Many
│ created_at           │      │
│ updated_at           │      │
│ last_login_at        │      │
└──────────┬───────────┘      │
           │                  │
           │                  │
           │     ┌────────────▼─────────────┐
           └────▶│      user_roles          │
                 │      (Junction Table)    │
                 ├──────────────────────────┤
                 │ user_id (FK → users)     │
                 │ role_id (FK → roles)     │
                 │ PRIMARY KEY (user_id,    │
                 │              role_id)    │
                 └──────────────────────────┘
```

## Security Configuration Summary

```
┌────────────────────────────────────────────────────────────────┐
│                    Spring Security Config                       │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Public Endpoints (No Authentication Required)                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  • /api/auth/login                                       │ │
│  │  • /api/auth/register                                    │ │
│  │  • /actuator/health                                      │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Protected Endpoints (JWT Required)                            │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  • /api/auth/me          (Authenticated users)           │ │
│  │  • /api/employees/**     (ADMIN or USER)                 │ │
│  │  • /api/attendance/**    (ADMIN or USER)                 │ │
│  │  • /api/designations/**  (ADMIN or USER)                 │ │
│  │  • All other /api/**     (Authenticated users)           │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Authorization Rules                                            │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  CREATE operations:  @PreAuthorize("hasRole('ADMIN')")  │ │
│  │  UPDATE operations:  @PreAuthorize("hasRole('ADMIN')")  │ │
│  │  DELETE operations:  @PreAuthorize("hasRole('ADMIN')")  │ │
│  │  READ operations:    @PreAuthorize("hasAnyRole(         │ │
│  │                                      'USER', 'ADMIN')")  │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  CORS Configuration                                             │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Allowed Origins:  http://localhost:5173                 │ │
│  │                    http://localhost:3000                 │ │
│  │  Allowed Methods:  GET, POST, PUT, DELETE, OPTIONS       │ │
│  │  Allowed Headers:  *                                     │ │
│  │  Exposed Headers:  Authorization                         │ │
│  │  Max Age:          3600 seconds                          │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Session Management                                             │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Session Policy:  STATELESS                              │ │
│  │  (No server-side session, JWT only)                      │ │
│  └──────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

---

## Legend

```
┌─────┐
│ Box │  = Component/System
└─────┘

   ▼     = Flow direction

   │     = Connection

  ───▶   = Data/Request flow

(FK)    = Foreign Key
(PK)    = Primary Key
```

---

**Created**: January 26, 2025  
**Status**: Complete Implementation
