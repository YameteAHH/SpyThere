const modal = document.getElementById('post-modal');
const textarea = document.getElementById('post');
const addPostBtn = document.getElementById('add-post-btn');
const closeModalBtn = document.getElementById('close-modal-btn');

const body = document.body;

addPostBtn.addEventListener('click', openModal);
closeModalBtn.addEventListener('click', closeModal);

// Close modal when clicking outside of modal content
window.addEventListener('click', (e) => {
    console.log(e.target);
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
