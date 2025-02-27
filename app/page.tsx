'use client';

import { useEffect } from 'react';
import { useAmplitude } from './hooks/useAmplitude';
import Link from 'next/link';
import { FileText, MessageSquare, Shield, Clock, Users } from 'lucide-react';

export default function Home() {
  const amplitude = useAmplitude();

  useEffect(() => {
    amplitude.trackEvent('home_page_viewed', {
      timestamp: new Date().toISOString()
    });
  }, []);

  const handleChatStart = () => {
    amplitude.trackEvent('chat_started', {
      source: 'home_page'
    });
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-[#F5F7FF]">
      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6 tracking-tight">
            Welcome to{' '}
            <span className="text-[#0A0F5C] inline-block">
              Connect America Support
            </span>
          </h1>
          
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-12">
            Get instant answers and support with our AI-powered assistant. Access documentation and resources all in one place.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
            <Link 
              href="/chat"
              onClick={handleChatStart}
              className="inline-flex items-center px-8 py-4 rounded-xl
                bg-[#0A0F5C] text-white hover:bg-[#161B7F] 
                transition-all transform hover:scale-105
                shadow-lg hover:shadow-xl
                text-lg font-medium"
            >
              Start Chat Now
              <svg 
                className="ml-2 w-5 h-5 animate-bounce" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M13 5l7 7-7 7M5 12h15" 
                />
              </svg>
            </Link>

            <Link
              href="/documents"
              className="inline-flex items-center px-8 py-4 rounded-xl
                bg-white text-[#0A0F5C] hover:bg-gray-50
                border-2 border-[#0A0F5C]
                transition-all transform hover:scale-105
                shadow-lg hover:shadow-xl
                text-lg font-medium"
            >
              Browse Documents
              <FileText className="ml-2 w-5 h-5" />
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {[
            {
              title: "24/7 AI Support",
              description: "Get instant answers to your questions anytime, anywhere",
              icon: "🤖"
            },
            {
              title: "Smart Documentation",
              description: "Access and search through all support documents easily",
              icon: "📚"
            },
            {
              title: "Personalized Help",
              description: "Receive tailored support based on your specific needs",
              icon: "🎯"
            }
          ].map((feature, index) => (
            <div 
              key={index}
              className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl
                transition-all transform hover:-translate-y-1
                border border-gray-100"
            >
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-600">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Animated Wave Divider */}
      <div className="w-full overflow-hidden">
        <svg className="w-full h-24" viewBox="0 0 1440 74" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0,37 C320,77 420,-3 720,37 C1020,77 1120,-3 1440,37 V74 H0 V37Z" 
            fill="#0A0F5C" fillOpacity="0.05"
            className="animate-wave"
          />
        </svg>
      </div>

      {/* Stats Section */}
      <div className="py-16 bg-white/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { number: "24/7", label: "Support Available", icon: Clock },
              { number: "100+", label: "Documents", icon: FileText },
              { number: "1000+", label: "Users Helped", icon: Users },
              { number: "99.9%", label: "Satisfaction Rate", icon: Shield },
            ].map((stat, index) => (
              <div 
                key={index}
                className="group p-6 rounded-xl bg-white/60 hover:bg-white
                  transform hover:-translate-y-2 transition-all duration-300
                  border border-gray-100 hover:border-[#0A0F5C]/20"
              >
                <div className="flex justify-center mb-4">
                  <stat.icon className="w-8 h-8 text-[#0A0F5C] 
                    group-hover:scale-110 transition-transform duration-300" />
                </div>
                <div className="text-3xl font-bold text-[#0A0F5C] mb-2">
                  {stat.number}
                </div>
                <div className="text-gray-600">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* How It Works Section */}
      <div className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-16 text-[#0A0F5C]">
            How It Works
          </h2>
          <div className="relative">
            {/* Connection Line */}
            <div className="absolute top-1/2 left-0 w-full h-1 bg-[#0A0F5C]/10 
              -translate-y-1/2 hidden md:block"></div>
            
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  step: "1",
                  title: "Ask a Question",
                  description: "Type your question or browse our documentation"
                },
                {
                  step: "2",
                  title: "Get Instant Answer",
                  description: "Our AI provides accurate, relevant responses"
                },
                {
                  step: "3",
                  title: "Access Resources",
                  description: "View related documents and additional help"
                }
              ].map((item, index) => (
                <div 
                  key={index}
                  className="relative bg-white p-8 rounded-xl shadow-lg
                    hover:shadow-2xl transition-all duration-300
                    transform hover:-translate-y-2"
                >
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2
                    w-12 h-12 rounded-full bg-[#0A0F5C] text-white
                    flex items-center justify-center text-xl font-bold
                    border-4 border-white"
                  >
                    {item.step}
                  </div>
                  <h3 className="text-xl font-semibold text-center mt-4 mb-3 text-[#0A0F5C]">
                    {item.title}
                  </h3>
                  <p className="text-gray-600 text-center">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-16 bg-[#0A0F5C]/5">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-6">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Join thousands of users who trust our support system
          </p>
          <Link
            href="/chat"
            onClick={handleChatStart}
            className="inline-flex items-center px-8 py-4 rounded-xl
              bg-[#0A0F5C] text-white hover:bg-[#161B7F]
              transition-all transform hover:scale-105 hover:rotate-1
              shadow-lg hover:shadow-xl text-lg font-medium
              animate-pulse hover:animate-none"
          >
            Start Using AI Support
            <MessageSquare className="ml-2 w-5 h-5" />
          </Link>
        </div>
      </div>
    </main>
  );
}


