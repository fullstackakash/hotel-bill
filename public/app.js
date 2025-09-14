
document.addEventListener('DOMContentLoaded', () => {
  const themeBtn = document.getElementById('themeToggle');
  themeBtn.addEventListener('click', () => {
    if (document.body.classList.contains('light-mode')) {
      document.body.classList.replace('light-mode','dark-mode');
      themeBtn.textContent = "🌞 Light Mode";
    } else {
      document.body.classList.replace('dark-mode','light-mode');
      themeBtn.textContent = "🌙 Dark Mode";
    }
  });
});