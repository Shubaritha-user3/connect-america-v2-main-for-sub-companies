'use client';
import { useState, useEffect } from 'react';
import { FileText, Search, ChevronDown, Download, Eye } from 'lucide-react';
import { useAmplitude } from '../hooks/useAmplitude';
import { toast } from 'react-hot-toast';

interface Document {
  id: string;
  name: string;
  url: string;
  uploadDate: string;
  size: string;
  title: string;
  description: string;
  category: string;
  type: 'pdf' | 'doc' | 'docx';
}

export default function DocumentsPage() {
  const amplitude = useAmplitude();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    amplitude.trackEvent('documents_page_viewed', {
      timestamp: new Date().toISOString()
    });
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const response = await fetch('/api/documents');
      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }
      const data = await response.json();
      
      // Ensure we have an array of documents
      if (Array.isArray(data)) {
        // Deduplicate documents based on name
        const uniqueDocuments = data.reduce((acc: Document[], current) => {
          const existingDoc = acc.find(doc => doc.name.toLowerCase() === current.name.toLowerCase());
          if (!existingDoc) {
            acc.push(current);
          }
          return acc;
        }, []);
        
        setDocuments(uniqueDocuments);
      } else {
        console.error('Unexpected data format:', data);
        throw new Error('Invalid data format received');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
      console.error('Error fetching documents:', err);
      amplitude.trackEvent('documents_fetch_error', {
        error: err instanceof Error ? err.message : 'Failed to load documents'
      });
    } finally {
      setLoading(false);
    }
  };

  // Safe filtering with type check
  const filteredDocuments = Array.isArray(documents) 
    ? documents.filter(doc => 
        doc.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const handleDocumentView = async (document: Document) => {
    amplitude.trackEvent('document_viewed', {
      documentId: document.id,
      documentTitle: document.title,
      documentType: document.type
    });
    
    window.open(document.url, '_blank');
  };

  const handleDocumentDownload = async (doc: Document) => {
    try {
      amplitude.trackEvent('document_download_started', {
        documentId: doc.id,
        documentTitle: doc.title,
        documentType: doc.type
      });

      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url: doc.url,
          filename: doc.name
        }),
      });

      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = doc.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      amplitude.trackEvent('document_download_completed', {
        documentId: doc.id,
        documentTitle: doc.title,
        documentType: doc.type
      });

      toast.success('Download completed successfully');
    } catch (error) {
      amplitude.trackEvent('document_download_error', {
        documentId: doc.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      toast.error('Failed to download document');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col fixed inset-0 overflow-hidden">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Documents</h1>
            <button 
              onClick={(e) => {
                e.preventDefault();
                window.location.href = '/chat';
              }}
              className="flex items-center gap-2 px-4 py-2 bg-[#0A0F5C] text-white rounded-md hover:bg-[#1a2070] transition-colors"
            >
              <ChevronDown className="w-5 h-5 rotate-90" />
              <span>Back to Chat</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Search Bar */}
          <div className="sticky top-0 z-10 bg-gray-50 dark:bg-slate-900 pb-6">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search documents..."
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-slate-600 
                  rounded-md leading-5 bg-white dark:bg-slate-800 
                  placeholder-gray-500 dark:placeholder-gray-400 
                  text-gray-900 dark:text-gray-100
                  focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
              {error}
            </div>
          )}

          {/* Documents Grid */}
          <div className="pb-6">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse bg-white rounded-lg shadow p-6">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No documents</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {searchQuery ? 'No documents match your search.' : 'No documents available.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredDocuments.map((doc) => (
                  <div key={doc.id} className="bg-white dark:bg-slate-800 rounded-lg shadow hover:shadow-md transition-shadow">
                    <div className="p-6">
                      <div className="flex items-start">
                        <div className="flex items-center">
                          <FileText className="h-8 w-8 text-blue-500" />
                          <div className="ml-3">
                            <h3 className="text-sm font-medium text-gray-900 dark:text-white">{doc.name}</h3>
                            <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                              <span>{doc.size}</span>
                              <span className="mx-1">•</span>
                              <span>{new Date(doc.uploadDate).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 flex justify-end gap-3">
                        <button
                          onClick={() => handleDocumentView(doc)}
                          className="flex items-center gap-2 px-4 py-2 text-sm font-medium
                            bg-[#1E2875] text-white hover:bg-[#161B7F] 
                            rounded-lg transition-colors"
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </button>
                        <button
                          onClick={() => handleDocumentDownload(doc)}
                          className="flex items-center gap-2 px-4 py-2 text-sm font-medium
                            bg-[#22C55E] text-white hover:bg-green-600
                            rounded-lg transition-colors"
                        >
                          <Download className="h-4 w-4" />
                          Download
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
