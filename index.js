import express from 'express';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, push, get, child } from 'firebase/database';

const app = express();
const port = 3000;

// Middleware
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// Firebase configuration
const firebaseConfig = {
  databaseURL: 'https://spythere-8b6c7-default-rtdb.asia-southeast1.firebasedatabase.app/',

};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);
const postsRef = ref(db, 'posts');

// Temporary in-memory user session
const userInputCredentials = {
  email: '',
  password: '',
  username: '', // ✅ now tracking username
};

// Auth middleware
function authenticator(req, res, next) {
  if (userInputCredentials.email && userInputCredentials.password) {
    next();
  } else {
    res.redirect('/login');
  }
}

// Opening Page
app.get('/', (req, res) => {
  res.render('opening_page.ejs');
});

// Login Page
app.get('/login', (req, res) => {
  res.render('log_in.ejs', { error: null });
});

// Login Handler
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const sanitizedEmail = email.replace(/\./g, '_');
    const userRef = child(ref(db, 'users'), sanitizedEmail);
    const snapshot = await get(userRef);

    if (snapshot.exists()) {
      const userData = snapshot.val();
      if (userData.password === password) {
        userInputCredentials.email = email;
        userInputCredentials.password = password;
        userInputCredentials.username = userData.username; // ✅ Save username
        return res.redirect('/home');
      }
    }

    res.render('log_in.ejs', { error: 'Invalid email or password' });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).send('Server error during login');
  }
});

// Sign Up Page
app.get('/signup', (req, res) => {
  res.render('sign_up.ejs');
});

// Sign Up Handler
app.post('/signup', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).send('All fields are required.');
  }

  try {
    const sanitizedEmail = email.replace(/\./g, '_');
    const userRef = child(ref(db, 'users'), sanitizedEmail);

    await set(userRef, {
      username,
      email,
      password,
    });

    res.redirect('/login');
  } catch (error) {
    console.error('Sign up error:', error);
    res.status(500).send('Something went wrong while signing up.');
  }
});

// Home Page (authenticated)
app.get('/home', authenticator, async (req, res) => {
  try {
    const snapshot = await get(postsRef);
    let posts = [];
    if (snapshot.exists()) {
      const data = snapshot.val();
      posts = Object.entries(data).map(([id, value]) => {
        return {
          id,
          value: value.post || value, // Post content
          username: value.username || 'Anonymous', // Username or fallback
        };
      }).reverse();
    }

    res.render('home_page.ejs', { posts, username: userInputCredentials.username });
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).send('Error fetching posts.');
  }
});

// Submit Post
app.post('/submit-post', (req, res) => {
  const post = req.body.post;
  const username = userInputCredentials.username || 'Anonymous';

  if (post && post.trim() !== '') {
    push(postsRef, {
      post: post.trim(),
      username,
    });
  }

  res.redirect('/home');
});

// Profile Page
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
        .filter(post => post.username === userInputCredentials.username)
        .reverse();
    }

    res.render('profile_page.ejs', { 
      username: userInputCredentials.username,
      posts: posts || []
    });
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.render('profile_page.ejs', { 
      username: userInputCredentials.username,
      posts: []
    });
  }
});

// API Endpoint to Fetch Username
app.get('/api/username', (req, res) => {
  res.json({ username: userInputCredentials.username || 'Anonymous' });
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
