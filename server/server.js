// Server Setup
const express = require('express');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const cors = require('cors');
const fs = require('fs');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const port = 5000;

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: 'http://localhost:3000', // Update with your frontend URL
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage: storage });

// PostgreSQL pool setup
const pool = new Pool({
  user: 'postgres',
  host: '192.168.1.6',
  database: 'php_training',
  password: 'mawai123',
  port: 5432,
});

// const jwt = require('jsonwebtoken');

// Secret key for JWT
const JWT_SECRET = 'your_jwt_secret_key'; // Replace with your secret key

// Middleware to authenticate JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};






// User Registration Route
app.post('/api/auth/register', upload.single('image'), async (req, res) => {
  const { username, email, password } = req.body;
  const image = req.file ? req.file.filename : null;

  if (!username || !email || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO aman.chatusers (username, email, password, image) VALUES ($1, $2, $3, $4) RETURNING id',
      [username, email, hashedPassword, image]
    );
    const userId = result.rows[0].id;
    res.status(201).json({ message: 'User registered successfully', userId });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ message: 'Error registering user' });
  }
});




// User Login Route
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const result = await pool.query('SELECT * FROM aman.chatusers WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ message: 'Error logging in' });
  }
});



app.get('/api/user', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    console.log('Fetching details for user:', userId);

    // Fetch user details
    const userDetails = await pool.query(
      'SELECT id, username, email, image FROM aman.chatusers WHERE id = $1',
      [userId]
    );
    if (userDetails.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    const user = userDetails.rows[0];

    // Fetch unread message count
    const unreadMessagesResult = await pool.query(
      'SELECT COUNT(*) FROM aman.chat_messages WHERE receiver_id = $1 AND read = FALSE',
      [userId]
    );
    const unreadMessagesCount = parseInt(unreadMessagesResult.rows[0].count);

    // Send user details with unread message count
    res.json({
      ...user,
      unreadMessages: unreadMessagesCount
    });
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ message: 'Error fetching user details' });
  }
});






// Fetch Other Users Route for sidebar
// Fetch Other Users Route for sidebar
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Fetch other users excluding the current user with unread message count and most recent message time
    const users = await pool.query(
      `SELECT u.id, u.username, u.image,
              COALESCE(MAX(m.created_at), '1970-01-01T00:00:00Z') AS mostRecentMessageTime,
              COALESCE(SUM(CASE WHEN m.read = FALSE THEN 1 ELSE 0 END), 0) AS unreadMessagesCount
       FROM aman.chatusers u
       LEFT JOIN aman.chat_messages m ON u.id = m.receiver_id
       WHERE u.id != $1
       GROUP BY u.id`,
      [userId]
    );

    res.json(users.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Error fetching users' });
  }
});





// Mark messages as read for a specific user
app.post('/api/messages/mark-as-read', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.body;
    const currentUserId = req.user.userId;

    await pool.query(
      'UPDATE aman.chat_messages SET read = TRUE WHERE receiver_id = $1 AND sender_id = $2 AND read = FALSE',
      [currentUserId, userId]
    );

    res.sendStatus(200);
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).send('Server error');
  }
});

// // Fetch All Users Route
// app.get('/api/users', authenticateToken, async (req, res) => {
//   try {
//     const result = await pool.query('SELECT id, username, image FROM aman.chatusers');
//     const users = result.rows;
//     res.json(users);
//   } catch (error) {
//     console.error('Error fetching users:', error);
//     res.status(500).json({ message: 'Error fetching users' });
//   }
// });


// Fetch Messages Route for a specific user
app.get('/api/messages/:userId', authenticateToken, async (req, res) => {
  const { userId: selectedUserId } = req.params;
  const { userId: currentUserId } = req.user; // Assuming you add the user object in the authenticateToken middleware

  try {
    // Fetch messages along with sender details
    const result = await pool.query(
      `SELECT m.id, m.sender_id, m.receiver_id, m.message, m.created_at, s.username AS sender_name
       FROM aman.chat_messages m
       LEFT JOIN aman.chatusers s ON m.sender_id = s.id
       WHERE (m.sender_id = $1 AND m.receiver_id = $2) OR (m.sender_id = $2 AND m.receiver_id = $1)
       ORDER BY m.created_at ASC`,
      [currentUserId, selectedUserId]
    );

    if (result.rows.length > 0) {
      res.json(result.rows);
    } else {
      res.status(404).json({ message: 'No messages found' });
    }
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Server error' });
  }
});




// Send Message Route
app.post('/api/messages', authenticateToken, async (req, res) => {
  const { receiverId, message } = req.body; 
  const senderId = req.user.userId;
  console.log(senderId);
  console.log(req.body,receiverId,message);
  // return;

  if (!receiverId || !message) {
    return res.status(400).json({ message: 'Receiver ID and message are required' });
  }

  try {
    // Fetch sender's name
    const senderResult = await pool.query('SELECT username FROM aman.chatusers WHERE id = $1', [senderId]);
    const senderName = senderResult.rows[0].username;
    console.log(senderResult);

    // Insert the new message
    const result = await pool.query(
      'INSERT INTO aman.chat_messages (sender_id, receiver_id, message) VALUES ($1, $2, $3) RETURNING id, created_at',
      [senderId, receiverId, message]
    );

    const newMessage = result.rows[0];

    // Emit the new message including sender's name
    io.emit('newMessage', { sender_id: senderId, sender_name: senderName, receiver_id: receiverId, message, created_at: newMessage.created_at });

    // res.status(201).json({ id: newMessage.id, sender_name: senderName, created_at: newMessage.created_at, message });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: 'Server error' });
  }
});





// Get Messages Route
app.get('/api/messages/:receiverId', authenticateToken, async (req, res) => {
  const { receiverId } = req.params;
  const senderId = req.user.userId;

  try {
    const result = await pool.query(
      'SELECT * FROM aman.chat_messages WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1) ORDER BY created_at ASC',
      [senderId, receiverId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No messages found' });
    }

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

////////////////  Gropus /////////////////////////////////////////////////////////////////////////////

// Route to get all users to create a group
app.get('/api/chatusersgroup', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM aman.chatusers');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// Route to create a new group
app.post('/api/groups', async (req, res) => {
  const { groupName, admin, users } = req.body;
  if (!groupName || !admin || !Array.isArray(users)) {
    return res.status(400).json({ error: 'Invalid input data' });
  }

  try {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Create the group
      const groupResult = await client.query(
        'INSERT INTO aman.groups (name) VALUES ($1) RETURNING id',
        [groupName]
      );
      const groupId = groupResult.rows[0].id;

      // Insert group members
      const insertMemberPromises = users.map(userId => {
        return client.query(
          'INSERT INTO aman.group_members (group_id, user_id) VALUES ($1, $2)',
          [groupId, userId]
        );
      });
      await Promise.all(insertMemberPromises);

      await client.query('COMMIT');
      res.status(201).json({ groupId });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating group:', error);
      res.status(500).json({ error: 'Internal server error' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error connecting to database:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



// Route to get all groups
// Route to get all groups (if needed, can be modified similarly to the above example)
app.get('/api/groups', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM aman.groups');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route to get user details
app.get('/api/user', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query('SELECT * FROM aman.chatusers WHERE id = $1', [userId]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// Route to get groups with member names and most recent message time
// Route to get groups with member names and most recent message time for the current user
app.get('/api/groups/members', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(`
      SELECT 
        g.id AS group_id,
        g.name AS group_name,
        cu.id AS user_id,
        cu.username AS user_name,
        g.most_recent_message_time
      FROM 
        aman.group_members gm
      JOIN 
        aman.groups g ON gm.group_id = g.id
      JOIN 
        aman.chatusers cu ON gm.user_id = cu.id
      WHERE 
        gm.group_id IN (
          SELECT group_id FROM aman.group_members WHERE user_id = $1
        )
    `, [userId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching groups and members:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});




// Route to get groups for a specific user
// Route to get groups for a specific user
app.get('/api/user/groups', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(`
      SELECT 
        g.id AS group_id,
        g.name AS group_name
      FROM 
        aman.group_members gm
      JOIN 
        aman.groups g ON gm.group_id = g.id
      WHERE 
        gm.user_id = $1
    `, [userId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching user groups:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



// Route to send a message to a group
app.post('/api/groups/:groupId/messages', async (req, res) => {
  const { groupId } = req.params;
  const { senderId, message } = req.body;

  if (!senderId || !message) {
    return res.status(400).json({ error: 'Invalid input data' });
  }

  try {
    // Insert the message into the group_messages table
    await pool.query(
      'INSERT INTO aman.group_messages (group_id, sender_id, message) VALUES ($1, $2, $3)',
      [groupId, senderId, message]
    );

    // Fetch the message along with the sender's username
    const result = await pool.query(
      `SELECT gm.id, gm.group_id, gm.sender_id, gm.message, gm.created_at, cu.username AS sender_name
       FROM aman.group_messages gm
       JOIN aman.group_members gmbr ON gm.group_id = gmbr.group_id
       JOIN aman.chatusers cu ON gmbr.user_id = cu.id
       WHERE gm.group_id = $1 AND gm.sender_id = $2 AND gm.message = $3
       ORDER BY gm.created_at DESC
       LIMIT 1`,
      [groupId, senderId, message]
    );
    console.log(result);

    const sentMessage = result.rows[0];
    res.status(201).json(sentMessage);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});







// Route to get details of a specific group
app.get('/api/groups/:id', async (req, res) => {
  const groupId = parseInt(req.params.id, 10);
  try {
    const result = await pool.query('SELECT * FROM aman.groups WHERE id = $1', [groupId]);
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(404).json({ error: 'Group not found' });
    }
  } catch (error) {
    console.error('Error fetching group details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



// Route to get messages from a group
app.get('/api/groups/:groupId/messages', async (req, res) => {
  const { groupId } = req.params;

  try {
    const result = await pool.query(
      'SELECT * FROM aman.group_messages WHERE group_id = $1 ORDER BY created_at ASC',
      [groupId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});





// Serve static files from 'uploads' directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Create uploads directory if not exists
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Socket.IO connection
io.on('connection', (socket) => {
  console.log('a user connected');
  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
});

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
server.js