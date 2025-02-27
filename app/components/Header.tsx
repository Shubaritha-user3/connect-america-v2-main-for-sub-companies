
import Link from 'next/link'
import { MessageSquare, FileText } from 'lucide-react'

const Header = () => {
  return (
    <header className="bg-white shadow-md">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center">
          {/* Replace with actual Connect America logo */}
          <div className="text-2xl font-bold text-blue-600">
            Connect America
          </div>
        </div>
        <nav>
          <ul className="flex space-x-6">
            <li>
              <Link href="/chat" className="flex items-center text-gray-600 hover:text-blue-600 transition-colors duration-200">
                <MessageSquare className="w-5 h-5 mr-2" />
                <span>Chat</span>
              </Link>
            </li>
            <li>
              <Link href="/documents" className="flex items-center text-gray-600 hover:text-blue-600 transition-colors duration-200">
                <FileText className="w-5 h-5 mr-2" />
                <span>Documents</span>
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  )
}

export default Header

