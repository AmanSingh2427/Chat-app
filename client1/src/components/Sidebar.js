import React, { useEffect, useState } from 'react';
import axios from 'axios';

const Sidebar = ({ onSelectUser, onSelectGroup }) => {
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [groupMembers, setGroupMembers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchUsersAndGroups = async () => {
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
        const usersResponse = await axios.get('http://localhost:5000/api/users', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        setUsers(usersResponse.data);

        // Fetch groups
        const groupsResponse = await axios.get('http://localhost:5000/api/groups', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        setGroups(groupsResponse.data);

        // Fetch group members
        const groupMembersResponse = await axios.get('http://localhost:5000/api/groups/members', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        setGroupMembers(groupMembersResponse.data);

      } catch (error) {
        console.error('Error fetching users, groups, or user details:', error.response ? error.response.data : error.message);
      }
    };

    fetchUsersAndGroups();
  }, []);

  // Filter users and groups based on the search query
  const filteredUsers = users
    .filter(user => user.username.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      // Sort users by the timestamp of their most recent message
      const recentMessageA = new Date(a.mostRecentMessageTime).getTime();
      const recentMessageB = new Date(b.mostRecentMessageTime).getTime();
      return recentMessageB - recentMessageA;
    });

  const filteredGroups = groups
    .filter(group => group.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      // Sort groups by the timestamp of their most recent message
      const recentMessageA = new Date(a.mostRecentMessageTime).getTime();
      const recentMessageB = new Date(b.mostRecentMessageTime).getTime();
      return recentMessageB - recentMessageA;
    });

  // Handle user selection
  const handleSelectUser = async (userId) => {
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

  // Handle group selection
  const handleSelectGroup = (groupId) => {
    onSelectGroup(groupId);
  };

  return (
    <div className="w-64 h-full bg-gray-800 text-white overflow-y-auto">
      <div className="p-4">
        <h2 className="text-xl font-bold mb-4">Users and Groups</h2>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full p-2 mb-4 bg-gray-700 text-white rounded"
          placeholder="Search users or groups..."
        />
        <h3 className="text-lg font-semibold mb-2">Users</h3>
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
              <div className="flex flex-col">
                <span>{user.username}</span>
                {user.unreadMessagesCount > 0 && (
                  <span className="text-gray-400 text-sm">
                    Unread Messages: {user.unreadMessagesCount}
                  </span>
                )}
              </div>
              {user.unreadMessagesCount > 0 && (
                <span className="ml-auto bg-red-600 text-white px-2 py-1 rounded-full text-sm">
                  {user.unreadMessagesCount}
                </span>
              )}
            </li>
          ))}
        </ul>
        <h3 className="text-lg font-semibold mb-2">Groups</h3>
        <ul>
          {filteredGroups.map((group) => (
            <li
              key={group.id}
              className="flex items-center mb-4 p-2 bg-gray-700 rounded hover:bg-gray-600 cursor-pointer"
              onClick={() => handleSelectGroup(group.id)}
            >
              <div className="flex flex-col">
                <span>{group.name}</span>
                <ul className="pl-4">
                  {groupMembers
                    .filter(member => member.group_id === group.id)
                    .map(member => (
                      <li key={member.user_id} className="text-sm text-gray-400">
                        {member.user_name}
                      </li>
                    ))}
                </ul>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default Sidebar;
