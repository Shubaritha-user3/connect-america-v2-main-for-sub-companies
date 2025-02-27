import { neonConfig, Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { openai as aiSdkOpenAI } from '@ai-sdk/openai';
import { streamText, embed } from 'ai';

export const maxDuration = 60;

// Types
export interface Message {
  role: 'user' | 'assistant';
  content: string;
  urls?: Array<{ url: string; content: string }>;
  isExpanded?: boolean;
}

interface Document {
  pageContent: string;
  metadata: {
    title?: string;
    source?: string;
    s3_url?: string;
  };
}

interface SearchResult {
  id: string;
  contents: string;
  title: string;
  chunk_id: string;
  s3_url: string;
  similarity_score: number;
  vector?: number[];
}

class LLMResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LLMResponseError';
  }
}

class LLMResponseCutOff extends LLMResponseError {
  constructor(message: string) {
    super(message);
    this.name = 'LLMResponseCutOff';
  }
}

class LLMNoResponseError extends LLMResponseError {
  constructor(message: string) {
    super(message);
    this.name = 'LLMNoResponseError';
  }
}

// Constants
const SYSTEM_INSTRUCTIONS_DEFAULT = `You are an AI assistant for Connect America's internal support team. Your role is to:
1. Analyze support documents and provide clear, professional responses
2. Convert technical content into easy-to-understand explanations
3. Focus on explaining processes and solutions rather than quoting directly
4. Maintain a professional, helpful tone
5. If information isn't available in the provided context, clearly state that and DO NOT provide generic responses
6. Always respond in English, regardless of the input language

`;

const SYSTEM_INSTRUCTIONS_ADVICE = `You are an AI advisor for Connect America's internal support team. Your role is to:
1. Provide guidance and recommendations in a supportive, advisory tone
2. Offer best practices and suggestions based ONLY on the documentation
3. Use phrases like "I recommend", "Consider", "It's advisable to"
4. Include practical tips and potential pitfalls to watch out for
5. If information isn't available, clearly state that and DO NOT provide generic best practices
6. Always respond in English

Response Structure:
### Overview
Brief summary of the advice

### Recommendations
• Key recommendation points
  - Supporting details
  - Implementation tips

### Best Practices
1. First practice
2. Second practice
   - Important considerations
   - Potential pitfalls

### Note
Important warnings or special considerations`;

const RELEVANCE_CHECK_INSTRUCTIONS = `Given the following question or message and the chat history, determine if it is:
1. A greeting or send-off (like "hello", "thank you", "goodbye", or casual messages)
2. Related to Connect America's core services:
    - Medical Alert Systems and Devices
    - Remote Patient Monitoring Systems
    - Care Management Services
    - Customer Service Operations
    - Status Management, Assigning a Task and Break Protocols 
    - Medication Management Solutions
    - Social Determinants of Health (SDOH)
    - Prevent fall
    - Esper AI Virtual Assistant
    - CDC Avoid Falls
    - Chair Rise Expertise
    - Financial Operations
    - Company information inquiries
    - Cancellations, Returns, Refunds and Payments
3. Related to:
    - Device setup, troubleshooting, or maintenance
    - Patient monitoring procedures
    - Care coordination processes
    - Customer support protocols and account management
    - Medication tracking systems
    - Social and environmental factors affecting health
    - Community resources and support services
    - Healthcare outcome factors
4. A follow-up question to the previous conversation about these topics
5. Related to violence, harmful activities, or other inappropriate content
6. Completely unrelated to Connect America's healthcare services
7. Related to the company operations and procedures

Respond with only one of these categories:
GREETING - for category 1
RELEVANT - for categories 2, 3, 4, or 7
INAPPROPRIATE - for category 5
NOT RELEVANT - for category 6`;

// Initialize OpenAI with error handling
const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// Configure Neon
neonConfig.fetchConnectionCache = true;

// Initialize the pool with Neon
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

// Utility Functions
async function getEmbeddings(query: string): Promise<number[]> {
  console.log('🔢 Generating embeddings for query...');
  try {
    const response = await openaiClient.embeddings.create({
      model: "text-embedding-ada-002",
      input: query,
    });
    console.log('✓ Embeddings generated successfully');
    console.log('----------------------------------------');
    return response.data[0].embedding;
  } catch (error) {
    console.error('❌ Error generating embeddings:', error);
    throw error;
  }
}

function cosineSimilarity(v1: number[], v2: number[]): number {
  const dot = v1.reduce((sum, val, i) => sum + val * v2[i], 0);
  const norm1 = Math.sqrt(v1.reduce((sum, val) => sum + val * val, 0));
  const norm2 = Math.sqrt(v2.reduce((sum, val) => sum + val * val, 0));
  return dot / (norm1 * norm2);
}

async function searchPostgres(queryEmbedding: number[], tableName: string = 'amac', topK: number = 5): Promise<SearchResult[]> {
  console.log('🔎 Searching database for relevant documents...');
  let retries = 3;
  let lastError;

  while (retries > 0) {
    let client;
    try {
      client = await pool.connect();
      const query = `
        SELECT id, vector, contents, title, chunk_id, s3_url,
               1 - (vector <=> $1::vector) as similarity_score
        FROM ${tableName}
        WHERE vector IS NOT NULL
        ORDER BY vector <=> $1::vector
        LIMIT $2;
      `;
      
      const embeddingStr = `[${queryEmbedding.join(',')}]`;
      const result = await client.query(query, [embeddingStr, topK]);
      
      const similarities = result.rows.map(row => ({
        ...row,
        similarity_score: parseFloat(row.similarity_score),
        vector: row.vector.replace(/[\[\]]/g, '').split(',').map(Number)
      }));

      console.log(`✓ Found ${similarities.length} relevant documents`);
      console.log('Top document titles:', similarities.map(doc => doc.title));
      console.log('----------------------------------------');
      return similarities;

    } catch (error) {
      lastError = error;
      console.error(`❌ Database connection attempt failed. Retries left: ${retries - 1}`, error);
      retries--;
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } finally {
      if (client) {
        await client.release();
      }
    }
  }

  console.error('❌ All database connection attempts failed:', lastError);
  throw new Error('Failed to connect to database after multiple attempts');
}

async function rewriteQuery(query: string, chatHistory: Message[] = []): Promise<string> {
  console.log('📝 Rewriting query...');
  console.log('Original query:', query);
  try {
    const response = await openaiClient.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are Connect America's internal support assistant. Rewrite this query to be more specific and searchable, taking into account the chat history if provided. Only return the rewritten query without explanations."
        },
        {
          role: "user",
          content: `Original query: ${query}\nChat history: ${JSON.stringify(chatHistory)}`
        }
      ]
    });
    const rewrittenQuery = response.choices[0]?.message?.content?.trim() || query;
    console.log('✓ Rewritten query:', rewrittenQuery);
    console.log('----------------------------------------');
    return rewrittenQuery;
  } catch (error) {
    console.error('❌ Error in query rewriting:', error);
    return query;
  }
}

function processResponse(response: string, sourceDocuments: Document[]): [string, Array<{ url: string; content: string }>] {
  console.log('🔄 Processing AI response...');
  const urlPattern = /\{url:(.*?)\}/g;
  const urlsInResponse = Array.from(response.matchAll(urlPattern), m => m[1]);
  
  console.log('📎 URLs found in response:', urlsInResponse.length);
  const uniqueUrls = new Map<string, { url: string; content: string }>();
  
  // Match URLs from source documents
  urlsInResponse.forEach(url => {
    const matchingDoc = sourceDocuments.find(doc => doc.metadata.s3_url === url);
    if (matchingDoc) {
      uniqueUrls.set(url, {
        url: url,
        content: matchingDoc.pageContent
      });
    }
  });

  const cleanedResponse = response.replace(urlPattern, '');
  const verifiedUrls = Array.from(uniqueUrls.values());
  
  console.log('✓ Response processed with URLs:', verifiedUrls.length);
  console.log('----------------------------------------');
  
  return [cleanedResponse, verifiedUrls];
}

// Main Route Handler
export async function POST(req: Request) {
  console.log('🚀 Starting new chat request...');
  console.log('----------------------------------------');

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { 
        role: 'assistant', 
        content: 'OpenAI API key is not configured. Please contact support.' 
      } as Message,
      { status: 500 }
    );
  }

  console.log('Environment Check:');
  console.log('OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);
  console.log('POSTGRES_URL exists:', !!process.env.POSTGRES_URL);
  console.log('----------------------------------------');

  const controller = new AbortController();

  try {
    const { message, chat_history, persona = 'default' } = await req.json();

    const systemInstructions = persona === 'advice' 
      ? SYSTEM_INSTRUCTIONS_ADVICE 
      : SYSTEM_INSTRUCTIONS_DEFAULT;

    console.log('Received request body:', {
      message,
      chat_history,
      persona
    });

    if (!message) {
      return NextResponse.json(
        { role: 'assistant', content: 'No message provided' } as Message,
        { status: 400 }
      );
    }

    const timeoutId = setTimeout(() => controller.abort(), 290000);

    try {
      // Relevance check using OpenAI
      console.log('🔍 Checking query relevance...');
      const relevanceResponse = await openaiClient.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: RELEVANCE_CHECK_INSTRUCTIONS
          },
          {
            role: "user",
            content: `Chat History: ${JSON.stringify(chat_history.slice(-3))}\nCurrent Question: ${message}`
          }
        ]
      });
      const relevanceResult = relevanceResponse.choices[0]?.message?.content?.toUpperCase();
      console.log('✓ Relevance result:', relevanceResult);
      console.log('----------------------------------------');

      // Handle different message types
      if (relevanceResult?.includes('GREETING')) {
        const result = await streamText({
          model: aiSdkOpenAI('gpt-4o-mini'),
          messages: [
            {
              role: "system",
              content: "You are Connect America's support assistant. Provide a friendly and engaging greeting response. Mention that you're here to help with internal support topics."
            },
            {
              role: "user",
              content: message
            }
          ]
        });

        return result.toDataStreamResponse();
      }

      if (relevanceResult?.includes('INAPPROPRIATE')) {
        const result = await streamText({
          model: aiSdkOpenAI('gpt-4o-mini'),
          messages: [
            {
              role: "system",
              content: "Provide a professional response that maintains a polite and firm tone, explains that you can only assist with appropriate work-related queries, and encourages asking a different question related to Connect America's internal support."
            },
            {
              role: "user",
              content: message
            }
          ]
        });

        return result.toDataStreamResponse();
      }

      if (relevanceResult?.includes('NOT RELEVANT')) {
        const result = await streamText({
          model: aiSdkOpenAI('gpt-4o-mini'),
          messages: [
            {
              role: "system",
              content: "Provide a response that politely acknowledges the question, explains your specialization in Connect America's internal support topics, and encourages rephrasing the question to relate to internal support matters."
            },
            {
              role: "user",
              content: message
            }
          ]
        });

        return result.toDataStreamResponse();
      }

      // Only proceed with DB search and links route for RELEVANT messages
      console.log('⏳ [POST] Rewriting query');
      const rewrittenQuery = await rewriteQuery(message, chat_history);
      console.log('✅ [POST] Query rewritten:', { 
        original: message, 
        rewritten: rewrittenQuery 
      });
      
      // Generate embeddings and search DB
      console.log('⏳ [POST] Generating embedding');
      const queryEmbedding = await getEmbeddings(rewrittenQuery);
      const searchResults = await searchPostgres(queryEmbedding, 'amac');
      
      console.log('⏳ [POST] Searching database');
      const relevantDocs = searchResults.map(result => ({
        pageContent: result.contents,
        metadata: {
          title: result.title,
          source: 'amac',
          s3_url: result.s3_url,
          content: result.contents
        }
      }));
      
      // Send to links route with only query and context
      if (relevanceResult === 'RELEVANT' && relevantDocs.length > 0) {
        console.log('📤 [Chat] Sending data to links route');
        await fetch(new URL('/api/links', req.url), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: rewrittenQuery,
            context: relevantDocs
          })
        });
      }

      // Generate streaming response
      const result = await streamText({
        model: aiSdkOpenAI('gpt-4o-mini'),
        messages: [
          { role: "system", content: systemInstructions },
          { 
            role: "user", 
            content: `Chat History:\n${JSON.stringify(chat_history.slice(-5))}\n\nContext:\n${JSON.stringify(relevantDocs)}\n\nQuestion: ${rewrittenQuery}` 
          }
        ],
      });

      return result.toDataStreamResponse();

    } catch (fetchError) {
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return NextResponse.json(
          { role: 'assistant', content: 'Sorry, the request timed out. Please try again.' } as Message,
          { status: 408 }
        );
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' } as Message,
      { status: 500 }
    );
    
  } finally {
    controller.abort();
  }
}