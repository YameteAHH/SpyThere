document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('post-modal');
  const textarea = document.getElementById('post');
  const addPostBtn = document.getElementById('add-post-btn');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const body = document.body;

  // Fetch username if needed
  const usernameDisplay = document.getElementById('username-display');
  if (usernameDisplay) {
    fetch('/api/username')
      .then(response => response.json())
      .then(data => {
        usernameDisplay.textContent = `Posting as: ${data.username || 'Anonymous'}`;
      })
      .catch(error => {
        console.error('Error fetching username:', error);
        usernameDisplay.textContent = 'Posting as: Anonymous';
      });
  }

  // Modal functionality
  if (addPostBtn && modal && closeModalBtn) {
    addPostBtn.addEventListener('click', openModal);
    closeModalBtn.addEventListener('click', closeModal);
    
    // Close modal when clicking outside or pressing Escape
    window.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
    
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });
  }

  function openModal() {
    modal.style.display = 'block';
    textarea.focus();
    body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.style.display = 'none';
    body.style.overflow = 'auto';
    textarea.value = '';
  }
  
  // Initialize comment functionality if we're on a page with comments
  initializeComments();
});

// Function to initialize comment functionality
function initializeComments() {
  const commentBtns = document.querySelectorAll('.comment-btn');
  if (!commentBtns.length) return; // Not on a page with comments
  
  console.log('Initializing comment functionality');
}
