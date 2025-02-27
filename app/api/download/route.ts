import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { url, filename } = await request.json();

    if (!url) {
      return new NextResponse('URL is required', { status: 400 });
    }

    // Fetch the file from the provided URL
    const fileResponse = await fetch(url);

    if (!fileResponse.ok) {
      throw new Error(`Failed to fetch file from ${url}`);
    }

    // Get the file content as a blob
    const fileBlob = await fileResponse.blob();

    // Get the content type from the original response
    const contentType = fileResponse.headers.get('content-type') || 'application/octet-stream';

    // Use provided filename or extract from URL with fallback
    const finalFilename = filename || url.split('/').pop() || 'download';

    // Create response with the file content
    const response = new NextResponse(fileBlob, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${finalFilename}"`,
      },
    });

    return response;
  } catch (error) {
    console.error('Download error:', error);
    return new NextResponse('Failed to download file', { status: 500 });
  }
}
