const modal = document.getElementById('post-modal');
const textarea = document.getElementById('post');
const addPostBtn = document.getElementById('add-post-btn');
const closeModalBtn = document.getElementById('close-modal-btn');
const usernameDisplay = document.getElementById('username-display'); // Add an element to display the username

const body = document.body;

// Fetch the username dynamically (if available)
document.addEventListener('DOMContentLoaded', () => {
    fetch('/api/username') // Endpoint to get the logged-in user's username
        .then(response => response.json())
        .then(data => {
            if (data.username) {
                usernameDisplay.textContent = `Posting as: ${data.username}`;
            } else {
                usernameDisplay.textContent = 'Posting as: Anonymous';
            }
        })
        .catch(error => {
            console.error('Error fetching username:', error);
            usernameDisplay.textContent = 'Posting as: Anonymous';
        });
});

addPostBtn.addEventListener('click', openModal);
closeModalBtn.addEventListener('click', closeModal);

// Close modal when clicking outside of modal content
window.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
});

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});

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
