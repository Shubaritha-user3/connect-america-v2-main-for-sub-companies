import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Types
interface Message {
  role: 'user' | 'assistant';
  content: string;
  urls?: Array<{ url: string; content: string }>;
  isExpanded?: boolean;
}

// Constants
const SYSTEM_INSTRUCTIONS = `You are an AI assistant for Connect America's internal support team. Your role is to:
1. Compare the AI's answer with the provided context documents
2. Only extract URLs of documents whose content is directly referenced or used in the answer
3. Return ONLY the URLs in {{url:}} format for documents that contributed to the answer
4. Do not add any additional text or explanations
5. If no content from the documents was used in the answer, return an empty string
6. Do not give generic or modified URLs, only the ones from the context
Example output format:
{{url:https://connect-america-files.s3.us-east-1.amazonaws.com/Connect+America+Test/example1.pdf}}
{{url:https://connect-america-files.s3.us-east-1.amazonaws.com/Connect+America+Test/example2.pdf}}`;


// Add temporary store at the top of the file
let tempStore: {
  message?: string;
  context?: any[];
  answer?: string;
} = {};

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { role: 'assistant', content: 'OpenAI API key is not configured. Please contact support.' } as Message,
      { status: 500 }
    );
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  try {
    const body = await req.json();
    
    // Step 1: Receive initial message and context from chat route
    if (body.message && body.context) {
      console.log('\n=== Step 1: Received Initial Data ===');
      console.log('📝 Message:', body.message);
      console.log('📚 Context:', JSON.stringify(body.context, null, 2));
      console.log('⏳ Waiting for answer...');
      console.log('=== End Step 1 ===\n');
      
      tempStore = {
        message: body.message,
        context: body.context
      };
      
      return NextResponse.json({ 
        status: 'waiting_for_answer',
        hasContext: true 
      });
    }
    
    // Step 2: Process when answer is received
    if (body.answer && tempStore.message && tempStore.context) {
      console.log('\n=== Step 2: Processing Complete Data ===');
      console.log('📝 Message:', tempStore.message);
      console.log('📚 Context:', JSON.stringify(tempStore.context, null, 2));
      console.log('✍️ Answer:', body.answer);
      
      // Process with LLM
      console.log('🤖 Starting LLM processing...');
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: SYSTEM_INSTRUCTIONS
          },
          {
            role: 'user',
            content: `Context:\n${JSON.stringify(tempStore.context)}\n\nOriginal Question: ${tempStore.message}\n\nAI Answer: ${body.answer}\n\nExtract relevant URLs:`
          }
        ],
        temperature: 0.1
      });

      const llmResponse = completion.choices[0].message.content || '';
      console.log('✅ LLM Response:', llmResponse);
      
      // Extract URLs from the response
      const urlPattern = /\{\{url:(.*?)\}\}/g;
      const urls = Array.from(llmResponse.matchAll(urlPattern), m => {
        const url = m[1];
        const matchingDoc = tempStore.context?.find(doc => doc.metadata.s3_url === url);
        return {
          url
        };
      }).filter(({url}) => url); // Filter out any empty URLs
      
      console.log('📎 Extracted URLs:', urls);
      
      // Clear the temporary store after processing
      tempStore = {};
      
      return NextResponse.json({ 
        urls,
        status: 'success'
      });
    }
    
    // Return empty response if parameters are incomplete
    return NextResponse.json({ 
      status: 'success',
      hasContext: false 
    });
    
  } catch (error) {
    console.error('❌ Error in links route:', error);
    return NextResponse.json({ 
      status: 'error',
      message: 'Internal server error'
    }, { 
      status: 500 
    });
  }
}