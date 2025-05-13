import express from 'express';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, push, get, child, update, remove } from 'firebase/database';

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
const likesRef = ref(db, 'likes');

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
    
    // Check if the user has already liked any posts
    const username = userSession.username;
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
    res.render('profile_page.ejs', { 
      username: userSession.username, 
      email: userSession.email,
      posts 
    });
  } catch (error) {
    console.error('Error:', error);
    res.render('profile_page.ejs', { 
      username: userSession.username, 
      email: userSession.email,
      posts: [] 
    });
  }
});

// Handle profile update
app.post('/update-profile', authenticator, async (req, res) => {
  try {
    const { username, email, currentPassword } = req.body;
    const oldUsername = userSession.username;
    
    // Verify current password
    const oldEmail = userSession.email;
    const sanitizedOldEmail = oldEmail.replace(/\./g, '_');
    const userRef = child(ref(db, 'users'), sanitizedOldEmail);
    const snapshot = await get(userRef);
    
    if (!snapshot.exists() || snapshot.val().password !== currentPassword) {
      return res.render('profile_page.ejs', { 
        username: userSession.username, 
        email: userSession.email,
        posts: [],
        error: 'Invalid password. Changes not saved.'
      });
    }
    
    // Check if username changed and update all references
    if (username !== oldUsername) {
      console.log(`Updating username from ${oldUsername} to ${username}`);
      
      // Update username in all user's posts
      try {
        const postsSnapshot = await get(postsRef);
        if (postsSnapshot.exists()) {
          const allPosts = postsSnapshot.val();
          
          // Iterate through all posts
          for (const postId in allPosts) {
            const post = allPosts[postId];
            if (post.username === oldUsername) {
              console.log(`Updating post ${postId}`);
              await update(ref(db, `posts/${postId}`), { username: username });
            }
          }
        }
      } catch (postError) {
        console.error('Error updating posts:', postError);
        // Don't stop the process for post update errors
      }
      
      // Update username in all comments
      try {
        const commentsSnapshot = await get(commentsRef);
        if (commentsSnapshot.exists()) {
          const allComments = commentsSnapshot.val();
          
          // Iterate through all post comments
          for (const postId in allComments) {
            const postComments = allComments[postId];
            
            // Update author field in each comment by this user
            for (const commentId in postComments) {
              const comment = postComments[commentId];
              if (comment.author === oldUsername) {
                console.log(`Updating comment ${commentId} in post ${postId}`);
                await update(ref(db, `comments/${postId}/${commentId}`), { author: username });
              }
            }
          }
        }
      } catch (commentError) {
        console.error('Error updating comments:', commentError);
        // Don't stop the process for comment update errors
      }
      
      // Update username in all likes
      try {
        const likesSnapshot = await get(likesRef);
        if (likesSnapshot.exists()) {
          const allLikes = likesSnapshot.val();
          
          // Iterate through all post likes
          for (const postId in allLikes) {
            const postLikes = allLikes[postId];
            
            // The user's like entry is stored with sanitized username as key
            const sanitizedOldUsername = oldUsername.replace(/\./g, '_');
            if (postLikes[sanitizedOldUsername]) {
              console.log(`Updating like in post ${postId}`);
              
              // Get the like data
              const likeData = postLikes[sanitizedOldUsername];
              
              // Create new entry with new username
              const sanitizedNewUsername = username.replace(/\./g, '_');
              await set(ref(db, `likes/${postId}/${sanitizedNewUsername}`), {
                ...likeData,
                username: username // Update the username field
              });
              
              // Remove old entry
              await remove(ref(db, `likes/${postId}/${sanitizedOldUsername}`));
            }
          }
        }
      } catch (likeError) {
        console.error('Error updating likes:', likeError);
        // Don't stop the process for like update errors
      }
    }
    
    // Create updated user data
    const updatedUser = {
      username,
      email,
      password: snapshot.val().password // Keep existing password
    };
    
    // If email changed, delete old record and create new one
    if (email !== oldEmail) {
      // Create new user record with new email
      const sanitizedNewEmail = email.replace(/\./g, '_');
      const newUserRef = child(ref(db, 'users'), sanitizedNewEmail);
      
      // Check if new email already exists
      const newEmailSnapshot = await get(newUserRef);
      if (newEmailSnapshot.exists()) {
        return res.render('profile_page.ejs', { 
          username: userSession.username, 
          email: userSession.email,
          posts: [],
          error: 'Email already exists. Please choose a different one.'
        });
      }
      
      // Add new record
      await set(newUserRef, updatedUser);
      
      // Delete old record
      await remove(userRef);
      
      // Update session data
      userSession.email = email;
      userSession.username = username;
      
      // Redirect to updated profile page with success message
      return res.render('profile_page.ejs', { 
        username: username, 
        email: email,
        posts: [], // Will be populated on next page load
        success: 'Profile updated successfully!'
      });
    } 
    
    // If only username changed, update existing record
    await update(userRef, { username });
    
    // Update session
    userSession.username = username;
    
    // Redirect to updated profile page with success message
    return res.render('profile_page.ejs', { 
      username: username, 
      email: email,
      posts: [], // Will be populated on next page load
      success: 'Profile updated successfully!'
    });
    
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).render('profile_page.ejs', { 
      username: userSession.username, 
      email: userSession.email,
      posts: [],
      error: 'Error updating profile: ' + error.message
    });
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

// Update a comment
app.put('/api/comments/:postId/:commentId', authenticator, async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const { text } = req.body;
    
    console.log(`Updating comment ${commentId} for post ${postId}`);
    
    if (!postId || !commentId) {
      return res.status(400).json({ error: 'Post ID and Comment ID are required' });
    }
    
    if (!text || text.trim() === '') {
      return res.status(400).json({ error: 'Comment text is required' });
    }
    
    // Decode IDs if they were URL encoded
    const decodedPostId = decodeURIComponent(postId);
    const decodedCommentId = decodeURIComponent(commentId);
    
    // Get the comment to check ownership
    const commentRef = ref(db, `comments/${decodedPostId}/${decodedCommentId}`);
    const snapshot = await get(commentRef);
    
    if (!snapshot.exists()) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    
    const comment = snapshot.val();
    
    // Check if the current user is the author of the comment
    if (comment.author !== userSession.username) {
      return res.status(403).json({ error: 'You can only edit your own comments' });
    }
    
    // Update the comment
    await update(commentRef, {
      text: text.trim(),
      edited: true,
      editTimestamp: Date.now()
    });
    
    // Get the updated comment
    const updatedSnapshot = await get(commentRef);
    const updatedComment = {
      id: decodedCommentId,
      ...updatedSnapshot.val()
    };
    
    console.log('Comment updated successfully');
    
    res.json(updatedComment);
  } catch (error) {
    console.error('Error updating comment:', error);
    res.status(500).json({ error: 'Failed to update comment: ' + error.message });
  }
});

// Delete a comment
app.delete('/api/comments/:postId/:commentId', authenticator, async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    
    console.log(`Deleting comment ${commentId} from post ${postId}`);
    
    if (!postId || !commentId) {
      return res.status(400).json({ error: 'Post ID and Comment ID are required' });
    }
    
    // Decode IDs if they were URL encoded
    const decodedPostId = decodeURIComponent(postId);
    const decodedCommentId = decodeURIComponent(commentId);
    
    // Get the comment to check ownership
    const commentRef = ref(db, `comments/${decodedPostId}/${decodedCommentId}`);
    const snapshot = await get(commentRef);
    
    if (!snapshot.exists()) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    
    const comment = snapshot.val();
    
    // Check if the current user is the author of the comment
    if (comment.author !== userSession.username) {
      return res.status(403).json({ error: 'You can only delete your own comments' });
    }
    
    // Delete the comment
    await remove(commentRef);
    
    console.log('Comment deleted successfully');
    
    res.json({ success: true, message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ error: 'Failed to delete comment: ' + error.message });
  }
});

// Like API Routes
app.post('/api/likes', authenticator, async (req, res) => {
  try {
    const { postId, liked } = req.body;
    
    console.log('Received like request:', { postId, liked });
    
    if (!postId) {
      return res.status(400).json({ error: 'Post ID is required' });
    }
    
    // Decode the postId if it was URL encoded
    const decodedPostId = decodeURIComponent(postId);
    console.log('Decoded post ID for like:', decodedPostId);
    
    // Create a unique ID for this user's like on this post
    const username = userSession.username;
    const userLikeId = username.replace(/\./g, '_'); // Sanitize the username for Firebase
    
    // Reference to this specific user's like for this post
    const userLikeRef = ref(db, `likes/${decodedPostId}/${userLikeId}`);
    
    if (liked) {
      // Add the like
      await set(userLikeRef, {
        username: username,
        timestamp: Date.now()
      });
      console.log(`User ${username} liked post ${decodedPostId}`);
    } else {
      // Remove the like
      await remove(userLikeRef);
      console.log(`User ${username} unliked post ${decodedPostId}`);
    }
    
    // Get updated like count
    const postLikesRef = ref(db, `likes/${decodedPostId}`);
    const snapshot = await get(postLikesRef);
    const likeCount = snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
    
    res.json({ 
      success: true,
      liked: liked,
      likeCount: likeCount
    });
  } catch (error) {
    console.error('Error updating like:', error);
    res.status(500).json({ error: 'Failed to update like: ' + error.message });
  }
});

app.get('/api/likes/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    console.log('Fetching likes for post:', postId);
    
    if (!postId) {
      return res.status(400).json({ error: 'Post ID is required' });
    }
    
    // Decode the postId if it was URL encoded
    const decodedPostId = decodeURIComponent(postId);
    console.log('Decoded post ID:', decodedPostId);
    
    const postLikesRef = ref(db, `likes/${decodedPostId}`);
    const snapshot = await get(postLikesRef);
    
    let likes = [];
    let userLiked = false;
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      likes = Object.entries(data).map(([id, like]) => ({
        id,
        username: like.username,
        timestamp: like.timestamp
      }));
      
      // Check if current user has liked this post
      const username = userSession.username;
      const userLikeId = username.replace(/\./g, '_');
      userLiked = data[userLikeId] !== undefined;
      
      console.log(`Found ${likes.length} likes for post ${decodedPostId}`);
    } else {
      console.log(`No likes found for post ${decodedPostId}`);
    }
    
    res.json({ 
      likes,
      userLiked
    });
  } catch (error) {
    console.error('Error fetching likes:', error);
    res.status(500).json({ error: 'Failed to fetch likes: ' + error.message });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
