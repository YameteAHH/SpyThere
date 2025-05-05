import express from 'express';
import { initializeApp } from 'firebase/app';
import { get, push, getDatabase, ref } from 'firebase/database';

// Express setup
const app = express();
const port = 3000;

// Set EJS as the view engine
app.set('view engine', 'ejs');

// Static files (CSS, images, etc.) will be served from the 'public' folder
app.use(express.static('public'));

// Middleware to parse form data
app.use(express.urlencoded({ extended: true }));

// Firebase configuration
const firebaseConfig = {
  databaseURL: 'https://spythere-8b6c7-default-rtdb.asia-southeast1.firebasedatabase.app/',
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);
const dbRef = ref(db, 'posts');

// Dummy login credentials (for simplicity)
const user = {
  email: 'christina-admin11',
  password: 'admin1234',
};

// Store logged-in user session in memory (simplified version)
const userInputCredentials = {
  email: '',
  password: '',
};

// Auth middleware to protect routes
function authenticator(req, res, next) {
  if (
    userInputCredentials.email === user.email &&
    userInputCredentials.password === user.password
  ) {
    next(); // User is authenticated, proceed to the next middleware/route
  } else {
    res.redirect('/login'); // Redirect to login page if not authenticated
  }
}

// 📑 Opening Page (Main Entry Point)
app.get('/', (req, res) => {
  res.render('opening_page.ejs');
});

// 📑 Login Page (GET Request)
app.get('/login', (req, res) => {
  res.render('log_in.ejs');
});

// 📑 Login Handling (POST Request)
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (email === user.email && password === user.password) {
    userInputCredentials.email = email;
    userInputCredentials.password = password;
    res.redirect('/home'); // Redirect to home page after successful login
  } else {
    res.render('log_in.ejs', { error: 'Invalid credentials' }); // Show error if credentials are invalid
  }
});

// 📑 Sign Up Page (GET Request)
app.get('/signup', (req, res) => {
  res.render('sign_up.ejs');
});

// 📑 Home Page (Requires login)
app.get('/home', authenticator, async (req, res) => {
  try {
    const snapshot = await get(dbRef);
    let posts = [];
    if (snapshot.exists()) {
      const data = snapshot.val();
      posts = Object.entries(data).map(([id, value]) => ({ id, value })).reverse();
    }
    res.render('home_page.ejs', { posts }); // Render the home page with posts
  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).send('Error fetching posts');
  }
});

// 📑 Post Submission (POST Request)
app.post('/submit-post', (req, res) => {
  const post = req.body.post;
  if (post && post.trim() !== '') {
    push(dbRef, post.trim()); // Push the post to Firebase
  }
  res.redirect('/home'); // Redirect back to home after submitting a post
});

// 📑 Profile Page (Requires login)
app.get('/profile', authenticator, (req, res) => {
  res.render('profile_page.ejs');
});

// Start the server
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
