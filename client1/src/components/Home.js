import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Sidebar from './Sidebar';
import Navbar from './Navbar'; // Import the Navbar component
import Chat from './Chat';

const Home = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState(null);

  useEffect(() => {
    const fetchUserDetails = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError('No token found, please login again.');
          setLoading(false);
          return;
        }

        const response = await axios.get('http://localhost:5000/api/user', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        setUser(response.data);
      } catch (err) {
        setError('Error fetching user details');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserDetails();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div className="flex flex-col h-screen">
      <Navbar user={user} />
      <div className="flex flex-grow overflow-hidden">
        <div className="w-64 bg-gray-800 overflow-y-auto">
          <Sidebar onSelectUser={setSelectedUserId} />
        </div>
        <div className="flex-grow overflow-y-auto">
          <Chat selectedUserId={selectedUserId} />
        </div>
      </div>
    </div>
  );
};

export default Home;