import { neon } from '@neondatabase/serverless';

// Initialize Neon database client with connection string from environment
const sql = neon(process.env.DATABASE_URL || '');

export default sql;

// Example usage:
// import sql from './services/databaseService';
// const [post] = await sql`SELECT * FROM posts WHERE id = ${postId}`;
// const users = await sql`SELECT * FROM users`;
