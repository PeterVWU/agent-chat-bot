import React, { useState, useEffect } from 'react';
import './App.css';

type Message = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'system',
      content: 'You are a helpful assistant that can use tools to provide accurate information.'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(
    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  const [conversationId, setConversationId] = useState<string | null>(null);

  // Load conversation from localStorage on initial load
  useEffect(() => {
    const savedConversationId = localStorage.getItem('conversationId');
    const savedMessages = localStorage.getItem('messages');

    if (savedConversationId) {
      setConversationId(savedConversationId);
    }

    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages) as Message[];
        setMessages(parsedMessages);
      } catch (error) {
        console.error('Error parsing saved messages:', error);
      }
    }
  }, []);

  // Save conversation to localStorage when updated
  useEffect(() => {
    if (conversationId) {
      localStorage.setItem('conversationId', conversationId);
    }

    localStorage.setItem('messages', JSON.stringify(messages));
  }, [messages, conversationId]);

  // Detect system dark mode changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => setDarkMode(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Apply theme
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  // Send message to the API
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          conversationId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();

      // Save the conversation ID if it's a new conversation
      if (!conversationId && data.conversationId) {
        setConversationId(data.conversationId);
      }

      // Add the assistant's message
      if (data.message && data.message.content) {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: data.message.content }
        ]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.'
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Clear conversation history
  const clearChat = () => {
    setMessages([
      {
        role: 'system',
        content: 'You are a helpful assistant that can use tools to provide accurate information.'
      }
    ]);
    setConversationId(null);
    localStorage.removeItem('conversationId');
    localStorage.removeItem('messages');
  };

  return (
    <div className={`app ${darkMode ? 'dark' : 'light'}`}>
      <header>
        <h1>Simple Chat Agent</h1>
        <div className="controls">
          <button
            onClick={() => setDarkMode(!darkMode)}
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            className="theme-toggle"
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
          <button onClick={clearChat} className="clear-button">
            Clear Chat
          </button>
        </div>
      </header>

      <div className="chat-container">
        <div className="message-list">
          {messages.filter(msg => msg.role !== 'system').map((message, index) => (
            <div key={index} className={`message ${message.role}`}>
              <div className="avatar">
                {message.role === 'user' ? '👤' : '🤖'}
              </div>
              <div className="content">
                {message.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="message assistant loading">
              <div className="avatar">🤖</div>
              <div className="content">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={sendMessage} className="input-form">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading || !input.trim()}>
            Send
          </button>
        </form>
      </div>

      {conversationId && (
        <div className="conversation-info">
          <small>Conversation ID: {conversationId}</small>
        </div>
      )}
    </div>
  );
}

export default App;