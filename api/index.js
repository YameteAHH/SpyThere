import express from 'express';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, push, get, child, update, remove } from 'firebase/database';
import multer from 'multer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import cookieParser from 'cookie-parser';

// Load environment variables
dotenv.config();

// Get current directory for correct file paths in different environments
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(rootDir, 'views'));
app.use(express.static(path.join(rootDir, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'spythere-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        httpOnly: true
    }
}));

// Configure multer for handling file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept images, videos, and gifs
        if (file.mimetype.startsWith('image/') ||
            file.mimetype.startsWith('video/') ||
            file.mimetype === 'image/gif') {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only images, videos, and GIFs are allowed.'));
        }
    }
});

// Configure AWS S3
const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'ap-southeast-2',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'AKIAZSKT6RARL36UOKOT',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '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'
    }
});

// Firebase configuration
const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY || "AIzaSyD1lJAV3m3b0wAKPww8moPHl6dD8-Mgv4M",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "spythere-8b6c7.firebaseapp.com",
    databaseURL: process.env.FIREBASE_DATABASE_URL || "https://spythere-8b6c7-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: process.env.FIREBASE_PROJECT_ID || "spythere-8b6c7",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "spythere-8b6c7.firebasestorage.app",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "953650363803",
    appId: process.env.FIREBASE_APP_ID || "1:953650363803:web:ceaad94aeecb2e274a753e",
    measurementId: process.env.FIREBASE_MEASUREMENT_ID || "G-F57JK91PE2"
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);
const postsRef = ref(db, 'posts');
const commentsRef = ref(db, 'comments');
const likesRef = ref(db, 'likes');

// Auth middleware using express-session
function authenticator(req, res, next) {
    if (req.session && req.session.user) {
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
            // Store user in session
            req.session.user = {
                email: email,
                username: snapshot.val().username
            };

            return res.redirect('/home');
        }
        res.render('log_in.ejs', { error: 'Invalid email or password' });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).send('Server error');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) console.error('Error destroying session:', err);
        res.redirect('/login');
    });
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
                mediaUrl: value.mediaUrl || null,
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

        // Get username from session
        const username = req.session.user.username;
        const apiVersion = 1; // Increment this when API changes

        res.render('home_page.ejs', {
            posts,
            username: username,
            apiVersion: apiVersion
        });
    } catch (error) {
        console.error('Error fetching posts:', error);
        res.status(500).send('Error fetching posts.');
    }
});

// Start server if running directly (not being imported)
if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });
}

export default app; 