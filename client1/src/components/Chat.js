import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import moment from 'moment';

const socket = io('http://localhost:5000'); // Replace with your server URL

const Chat = ({ selectedUserId, selectedGroupId }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [userId, setUserId] = useState(null);
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);
  const chatEndRef = useRef(null);

  useEffect(() => {
    const extractUserDetailsFromToken = () => {
      const token = localStorage.getItem('token');
      if (token) {
        const decodedToken = JSON.parse(atob(token.split('.')[1])); // Decode JWT token payload
        return { userId: decodedToken.userId, userName: decodedToken.userName }; // Update based on the actual token structure
      }
      return { userId: null, userName: '' };
    };

    const { userId, userName } = extractUserDetailsFromToken();
    setUserId(userId);
    setUserName(userName);

    const fetchMessages = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          console.error('No token found');
          setLoading(false);
          return;
        }

        if (selectedUserId) {
          const response = await axios.get(`http://localhost:5000/api/messages/${selectedUserId}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          setMessages(response.data);
        } else if (selectedGroupId) {
          const response = await axios.get(`http://localhost:5000/api/groups/${selectedGroupId}/messages`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          setMessages(response.data);
        }
      } catch (error) {
        if (error.response && error.response.status === 404) {
          setMessages([]); // No messages found, initialize as empty array
        } else {
          console.error('Error fetching messages:', error);
        }
      } finally {
        setLoading(false);
      }
    };

    if (selectedUserId || selectedGroupId) {
      fetchMessages();
    }

    return () => {
      socket.off('newMessage');
    };
  }, [selectedUserId, selectedGroupId]);

  useEffect(() => {
    const handleNewMessage = (message) => {
      if (selectedUserId) {
        if (
          (message.sender_id === userId && message.receiver_id === selectedUserId) ||
          (message.sender_id === selectedUserId && message.receiver_id === userId)
        ) {
          setMessages((prevMessages) => [...prevMessages, message]);
        }
      } else if (selectedGroupId) {
        if (message.group_id === selectedGroupId) {
          setMessages((prevMessages) => [...prevMessages, message]);
        }
      }
    };

    socket.on('newMessage', handleNewMessage);

    return () => {
      socket.off('newMessage', handleNewMessage);
    };
  }, [userId, selectedUserId, selectedGroupId]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (inputMessage.trim() && (selectedUserId || selectedGroupId)) {
      setInputMessage('');
      try {
        const token = localStorage.getItem('token');
        let response;
        if (selectedUserId) {
          response = await axios.post(
            'http://localhost:5000/api/messages',
            { receiverId: selectedUserId, message: inputMessage },
            {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            }
          );
        } else if (selectedGroupId) {
          response = await axios.post(
            `http://localhost:5000/api/groups/${selectedGroupId}/messages`,
            { senderId: userId, message: inputMessage },
            {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            }
          );
        }

        if (response && response.data) {
          const sentMessage = {
            id: response.data.id,
            sender_id: userId,
            sender_name: userName,
            receiver_id: selectedUserId || null,
            group_id: selectedGroupId || null,
            message: inputMessage,
            created_at: response.data.created_at || new Date().toISOString(), // Use server's created_at time if available
          };
          setMessages((prevMessages) => [...prevMessages, sentMessage]);
        }
      } catch (error) {
        console.error('Error sending message:', error);
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // Prevent the default Enter key behavior
      handleSendMessage();
    }
  };

  const renderMessages = () => {
    let lastDate = null;

    return messages.map((message) => {
      const messageDate = moment(message.created_at).format('YYYY-MM-DD');
      const isNewDate = messageDate !== lastDate;
      lastDate = messageDate;

      return (
        <React.Fragment key={message.id}>
          {isNewDate && (
            <div key={`date-${messageDate}`} className="w-full flex justify-center my-4">
              <div className="px-4 py-2 bg-gray-300 rounded-full">
                {moment(message.created_at).format('MMMM D, YYYY')}
              </div>
            </div>
          )}
          <div key={`message-${message.id}`} className={`flex ${message.sender_id === userId ? 'justify-end' : 'justify-start'} mb-2`}>
            <div className={`p-2 my-2 rounded-lg max-w-xs md:max-w-md lg:max-w-lg ${message.sender_id === userId ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
              style={{
                alignSelf: message.sender_id === userId ? 'flex-end' : 'flex-start'
              }}
            >
              <div className="text-sm text-dark-500 mb-1">
                {moment(message.created_at).format('LT')} {/* Format time as HH:MM AM/PM */}
              </div>
              <strong>{message.sender_name}</strong>: {message.message}
            </div>
          </div>
        </React.Fragment>
      );
    });
  };

  return (
    <div className="flex flex-col h-full p-4 bg-gray-100">
      <div className="flex-grow overflow-y-auto p-4 bg-white rounded-lg shadow-md">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500">Start your conversation</div>
        ) : (
          <>
            {renderMessages()}
            <div ref={chatEndRef} /> {/* This empty div is used to scroll to the bottom */}
          </>
        )}
      </div>
      <div className="mt-4 flex">
        <input
          type="text"
          value={inputMessage}
          onKeyDown={handleKeyDown} // Add this line to handle Enter key presses
          onChange={(e) => setInputMessage(e.target.value)}
          className="flex-grow px-4 py-2 border border-gray-300 rounded-l-lg focus:outline-none"
          placeholder="Type your message..."
        />
        <button
          onClick={handleSendMessage}
          className="px-4 py-2 bg-blue-500 text-white rounded-r-lg hover:bg-blue-600 focus:outline-none"
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default Chat;
