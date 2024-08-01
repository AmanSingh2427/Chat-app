import React, { useState } from 'react';

const Modal = ({ users, onClose }) => {
  const [groupName, setGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:5000/api/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ groupName, admin: 'admin-id', users: selectedUsers }), // Adjust according to your needs
      });
      if (response.ok) {
        alert('Group created successfully!');
        onClose();
      } else {
        alert('Error creating group.');
      }
    } catch (error) {
      console.error('Error creating group:', error);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded shadow-lg w-1/3">
        <h2 className="text-xl mb-4">Create Group</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="groupName" className="block text-sm font-medium text-gray-700">Group Name</label>
            <input
              type="text"
              id="groupName"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
              required
            />
          </div>
          <div className="mb-4">
            <label htmlFor="users" className="block text-sm font-medium text-gray-700">Select Users</label>
            <select
              id="users"
              multiple
              value={selectedUsers}
              onChange={(e) => setSelectedUsers(Array.from(e.target.selectedOptions, option => option.value))}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
            >
              {users.map(user => (
                <option key={user.id} value={user.id}>{user.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-end space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="bg-gray-500 text-white px-4 py-2 rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-blue-500 text-white px-4 py-2 rounded"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Modal;
