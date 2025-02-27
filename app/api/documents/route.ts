// app/api/documents/route.ts
import { NextResponse } from 'next/server';
import { Pool } from 'pg';

// Initialize database connection
const pool = new Pool({
  connectionString: "postgresql://neondb_owner:QiDtGlAW40xj@ep-polished-bird-a5hm3koc.us-east-2.aws.neon.tech/Data?sslmode=require",
  ssl: {
    rejectUnauthorized: false
  }
});

// Format the database row to match frontend expectations
function formatDocument(row: any) {
  return {
    id: row.id,
    name: row.title || 'Untitled',
    url: row.s3_url || '',
    uploadDate: new Date().toISOString(), // Since we don't have an upload date in DB
    size: '1 MB' // Placeholder since we don't have size in DB
  };
}

// GET handler to fetch all documents
export async function GET() {
  let client;
  
  try {
    client = await pool.connect();
    
    const result = await client.query(`
      SELECT 
        id,
        title,
        s3_url
      FROM documents
      WHERE s3_url IS NOT NULL
    `);

    // Map database results to frontend format
    const formattedDocuments = result.rows.map(formatDocument);

    return NextResponse.json(formattedDocuments);

  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  } finally {
    if (client) {
      client.release();
    }
  }
}
