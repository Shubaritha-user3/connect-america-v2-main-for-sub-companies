import { NextResponse } from 'next/server';
import { Pool } from 'pg';

// Initialize the connection pool
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:QiDtGlAW40xj@ep-polished-bird-a5hm3koc.us-east-2.aws.neon.tech/Data?sslmode=require'
});

export async function GET() {
  try {
    // Get a client from the pool
    const client = await pool.connect();
    
    try {
      // Query to get random questions
      const result = await client.query(`
        SELECT id, question_text, created_at 
        FROM questions 
        ORDER BY RANDOM() 
        LIMIT 3
      `);

      return NextResponse.json({ 
        questions: result.rows,
        success: true 
      });
      
    } finally {
      // Release the client back to the pool
      client.release();
    }
    
  } catch (error) {
    console.error('Error fetching questions:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch questions',
        success: false
      },
      { status: 500 }
    );
  }
}

// Export config for Edge Runtime compatibility
export const config = {
  runtime: 'nodejs'
};
