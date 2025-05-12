import express from 'express';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, push, get, child, update } from 'firebase/database';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // Add JSON middleware for API endpoints

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD1lJAV3m3b0wAKPww8moPHl6dD8-Mgv4M",
  authDomain: "spythere-8b6c7.firebaseapp.com",
  databaseURL: "https://spythere-8b6c7-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "spythere-8b6c7",
  storageBucket: "spythere-8b6c7.firebasestorage.app",
  messagingSenderId: "953650363803",
  appId: "1:953650363803:web:ceaad94aeecb2e274a753e",
  measurementId: "G-F57JK91PE2"
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);
const postsRef = ref(db, 'posts');
const commentsRef = ref(db, 'comments');

// Session storage
const userSession = {
  email: '',
  password: '',
  username: '',
};

// Auth middleware
function authenticator(req, res, next) {
  if (userSession.email && userSession.password) {
    next();
  } else {
    res.redirect('/login');
  }
}

// Routes
app.get('/', (req, res) => res.render('opening_page.ejs'));

app.get('/login', (req, res) => res.render('log_in.ejs', { error: null }));

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const sanitizedEmail = email.replace(/\./g, '_');
    const userRef = child(ref(db, 'users'), sanitizedEmail);
    const snapshot = await get(userRef);

    if (snapshot.exists() && snapshot.val().password === password) {
      userSession.email = email;
      userSession.password = password;
      userSession.username = snapshot.val().username;
      return res.redirect('/home');
    }
    res.render('log_in.ejs', { error: 'Invalid email or password' });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).send('Server error');
  }
});

app.get('/signup', (req, res) => res.render('sign_up.ejs'));

app.post('/signup', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).send('All fields are required.');
  }
  try {
    const sanitizedEmail = email.replace(/\./g, '_');
    await set(child(ref(db, 'users'), sanitizedEmail), {
      username,
      email,
      password,
    });
    res.redirect('/login');
  } catch (error) {
    console.error('Sign up error:', error);
    res.status(500).send('Something went wrong.');
  }
});

app.get('/home', authenticator, async (req, res) => {
  try {
    const snapshot = await get(postsRef);
    let posts = [];
    if (snapshot.exists()) {
      const data = snapshot.val();
      posts = Object.entries(data).map(([id, value]) => ({
        id,
        value: value.post || value,
        username: value.username || 'Anonymous',
      })).reverse();
    }
    
    // Ensure every post has a valid ID for the comments API
    posts = posts.map(post => {
      if (!post.id) {
        console.warn('Post without ID detected, generating one');
        post.id = 'post-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      }
      return post;
    });
    
    res.render('home_page.ejs', { posts, username: userSession.username });
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).send('Error fetching posts.');
  }
});

app.post('/submit-post', authenticator, (req, res) => {
  const post = req.body.post;
  if (post && post.trim() !== '') {
    push(postsRef, {
      post: post.trim(),
      username: userSession.username || 'Anonymous',
    });
  }
  res.redirect('/home');
});

app.get('/profile', authenticator, async (req, res) => {
  try {
    const snapshot = await get(postsRef);
    let posts = [];
    if (snapshot.exists()) {
      const data = snapshot.val();
      posts = Object.entries(data)
        .map(([id, value]) => ({
          id,
          value: value.post || value,
          username: value.username || 'Anonymous'
        }))
        .filter(post => post.username === userSession.username)
        .reverse();
    }
    res.render('profile_page.ejs', { username: userSession.username, posts });
  } catch (error) {
    console.error('Error:', error);
    res.render('profile_page.ejs', { username: userSession.username, posts: [] });
  }
});

app.get('/api/username', (req, res) => {
  res.json({ username: userSession.username || 'Anonymous' });
});

// Comment API Routes
app.post('/api/comments', authenticator, async (req, res) => {
  try {
    const { postId, text } = req.body;
    
    console.log('Received comment request:', { postId, text });
    
    if (!postId || !text || text.trim() === '') {
      return res.status(400).json({ error: 'Post ID and comment text are required' });
    }
    
    // Decode the postId if it was URL encoded
    const decodedPostId = decodeURIComponent(postId);
    console.log('Decoded post ID for comment:', decodedPostId);
    
    const newComment = {
      postId: decodedPostId,
      text: text.trim(),
      author: userSession.username,
      timestamp: Date.now()
    };
    
    console.log('Creating comment:', newComment);
    
    // Create a reference to the specific post's comments collection
    const postCommentsRef = ref(db, `comments/${decodedPostId}`);
    const newCommentRef = push(postCommentsRef);
    
    console.log('Comment reference created');
    
    await set(newCommentRef, newComment);
    
    console.log('Comment saved successfully');
    
    res.status(201).json({ 
      id: newCommentRef.key,
      ...newComment
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Failed to add comment: ' + error.message });
  }
});

app.get('/api/comments/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    console.log('Fetching comments for post:', postId);
    
    if (!postId) {
      return res.status(400).json({ error: 'Post ID is required' });
    }
    
    // Decode the postId if it was URL encoded
    const decodedPostId = decodeURIComponent(postId);
    console.log('Decoded post ID:', decodedPostId);
    
    const postCommentsRef = ref(db, `comments/${decodedPostId}`);
    const snapshot = await get(postCommentsRef);
    
    let comments = [];
    if (snapshot.exists()) {
      const data = snapshot.val();
      comments = Object.entries(data).map(([id, comment]) => ({
        id,
        ...comment
      })).sort((a, b) => b.timestamp - a.timestamp); // Sort newest first
      
      console.log(`Found ${comments.length} comments for post ${decodedPostId}`);
    } else {
      console.log(`No comments found for post ${decodedPostId}`);
    }
    
    res.json({ comments });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments: ' + error.message });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
