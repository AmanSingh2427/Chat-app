import React, { useEffect, useState } from 'react';
import axios from 'axios';

const Sidebar = ({ onSelectUser }) => {
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchUsersAndDetails = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          console.error('No token found');
          return;
        }

        // Fetch current user's details
        const userResponse = await axios.get('http://localhost:5000/api/user', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        setCurrentUser(userResponse.data);

        // Fetch other users
        const response = await axios.get('http://localhost:5000/api/users', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        setUsers(response.data);
      } catch (error) {
        console.error('Error fetching users or user details:', error.response ? error.response.data : error.message);
      }
    };

    fetchUsersAndDetails();
  }, []);

  // Filter users based on the search query
  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle user selection
  const handleSelectUser = async (userId) => {
    // Notify the backend to mark messages as read
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No token found');
        return;
      }

      await axios.post(`http://localhost:5000/api/messages/mark-as-read`, 
        { userId },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      // Fetch updated user data to reflect message count change
      const userResponse = await axios.get('http://localhost:5000/api/user', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setCurrentUser(userResponse.data);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }

    onSelectUser(userId);
  };

  return (
    <div className="w-64 h-screen bg-gray-800 text-white overflow-y-auto">
      <div className="p-4">
        <h2 className="text-xl font-bold mb-4">Users</h2>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full p-2 mb-4 bg-gray-700 text-white rounded"
          placeholder="Search users..."
        />
        <ul>
          {filteredUsers.map((user) => (
            <li
              key={user.id}
              className="flex items-center mb-4 p-2 bg-gray-700 rounded hover:bg-gray-600 cursor-pointer"
              onClick={() => handleSelectUser(user.id)}
            >
              {user.image ? (
                <img
                  src={`http://localhost:5000/uploads/${user.image}`}
                  alt={user.username}
                  className="w-12 h-12 rounded-full mr-4"
                />
              ) : (
                <div className="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center text-white mr-4">U</div>
              )}
              <span>{user.username}</span>
              {user.unreadMessages > 0 && (
                <span className="ml-auto bg-red-600 text-white px-2 py-1 rounded-full text-sm">
                  {user.unreadMessages}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default Sidebar;
