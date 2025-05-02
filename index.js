import express from 'express';
import { initializeApp } from 'firebase/app';
import { get, push, remove, getDatabase, ref } from 'firebase/database';

// express
const app = express();
const port = 3000;

// firebase configuration
const firebaseConfig = {
  databaseURL: 'https://spythere-8b6c7-default-rtdb.asia-southeast1.firebasedatabase.app/',
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);
const dbRef = ref(db, 'posts');

// dummy account
const user = {
    email: 'christina-admin11',
    password: 'admin1234',
}

const userInputCredentials = {
    email: '',
    password: '',
}

function authenticator(req, res, next) {
    if (userInputCredentials.email === user.email && userInputCredentials.password === user.password) {
        next();
    } else {
        res.redirect('/login');
    }
}

// middleware
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
// app.use(authenticator);

// home page
app.get('/', [authenticator], async (req, res) => {
    const snapshot = await get(dbRef);
    let posts = [];
    if (snapshot.exists()) {
      const data = snapshot.val();
      if (data) {
        posts = Object.entries(data).map(([id, value]) => ({ id, value }));
        posts.reverse();
      }
    }
    res.render('home_page.ejs', { posts });
  });
  
  
  app.post('/submit-post', (req, res) => {
      const post = req.body.post;
      if (post && post.trim() !== '') {
          push(dbRef, post.trim());
      }
      res.redirect('/');
  });

  // login page
app.get('/login', (req, res) => {
    res.render('log_in.ejs');
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;
    if (email === user.email && password === user.password) {
        userInputCredentials.email = email;
        userInputCredentials.password = password;
        res.redirect('/');
    } else {
        res.render('log_in.ejs', { error: 'Invalid credentials' });
    }
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});