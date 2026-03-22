/* ============================================================
   AEQUITAS MARKET — Shared Navigation Component
   Renders the navbar and handles auth-aware menu items
   ============================================================ */

async function renderNavbar() {
  const profile = await getCurrentProfile();
  const isLoggedIn = !!profile;
  const isSeller = profile?.role === 'seller';
  const isAdmin = profile?.role === 'admin';

  const nav = document.getElementById('navbar');
  if (!nav) return;

  nav.innerHTML = `
    <nav class="navbar" role="navigation" aria-label="Main navigation">
      <div class="navbar__inner">
        <a href="/" class="navbar__logo">
          <div class="navbar__logo-mark" aria-hidden="true"></div>
          <div class="navbar__logo-text">AEQUITAS <span>MARKET</span></div>
        </a>

        <ul class="navbar__links">
          <li><a href="/pages/browse.html" class="navbar__link">Browse</a></li>
          ${isSeller ? `
            <li><a href="/pages/seller-dashboard.html" class="navbar__link">My Shop</a></li>
            <li><a href="/pages/create-listing.html" class="navbar__link">+ Sell</a></li>
          ` : ''}
          ${isAdmin ? `
            <li><a href="/pages/admin.html" class="navbar__link navbar__link--admin">Admin</a></li>
          ` : ''}
          ${isLoggedIn ? `
            <li><a href="/pages/orders.html" class="navbar__link">Orders</a></li>
            <li class="navbar__user-menu">
              <button class="navbar__user-btn" onclick="toggleUserMenu()" aria-expanded="false" aria-haspopup="true">
                <span class="navbar__avatar">${(profile.name || 'U').charAt(0).toUpperCase()}</span>
              </button>
              <div class="navbar__dropdown" id="user-dropdown" role="menu">
                <div class="navbar__dropdown-header">
                  <strong>${profile.name || 'User'}</strong>
                  <span class="text-xs text-muted">${profile.email}</span>
                  ${profile.is_founding ? '<span class="badge badge--founding" style="margin-top:4px;">Founding Seller</span>' : ''}
                </div>
                <hr style="border:none;border-top:1px solid var(--gray-200);margin:8px 0;">
                <a href="/pages/profile.html" class="navbar__dropdown-item" role="menuitem">Profile Settings</a>
                ${!isSeller ? '<a href="/pages/become-seller.html" class="navbar__dropdown-item" role="menuitem">Become a Seller</a>' : ''}
                <a href="#" onclick="signOut()" class="navbar__dropdown-item navbar__dropdown-item--danger" role="menuitem">Sign Out</a>
              </div>
            </li>
          ` : `
            <li><a href="/pages/login.html" class="navbar__link">Log In</a></li>
            <li><a href="/pages/signup.html" class="btn btn--gold btn--sm">Start Selling</a></li>
          `}
        </ul>

        <button class="navbar__mobile-toggle" onclick="toggleMobileMenu()" aria-label="Toggle menu">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
      </div>
    </nav>
  `;

  // Highlight active page
  const currentPath = window.location.pathname;
  nav.querySelectorAll('.navbar__link').forEach(link => {
    if (link.getAttribute('href') === currentPath) {
      link.classList.add('navbar__link--active');
    }
  });
}

function toggleUserMenu() {
  const dropdown = document.getElementById('user-dropdown');
  const btn = document.querySelector('.navbar__user-btn');
  if (dropdown) {
    const isOpen = dropdown.classList.toggle('navbar__dropdown--open');
    btn?.setAttribute('aria-expanded', isOpen);
  }
}

function toggleMobileMenu() {
  const links = document.querySelector('.navbar__links');
  if (links) {
    links.classList.toggle('navbar__links--open');
  }
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.navbar__user-menu')) {
    const dropdown = document.getElementById('user-dropdown');
    const btn = document.querySelector('.navbar__user-btn');
    if (dropdown) {
      dropdown.classList.remove('navbar__dropdown--open');
      btn?.setAttribute('aria-expanded', 'false');
    }
  }
});

// Additional navbar styles (appended to head)
const navbarStyles = document.createElement('style');
navbarStyles.textContent = `
  .navbar__user-menu {
    position: relative;
  }
  .navbar__user-btn {
    background: none;
    border: 2px solid var(--amber);
    border-radius: 50%;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all var(--transition-fast);
  }
  .navbar__user-btn:hover {
    background: rgba(212, 168, 67, 0.15);
  }
  .navbar__avatar {
    color: var(--amber);
    font-weight: 700;
    font-size: var(--text-sm);
    font-family: var(--font-display);
  }
  .navbar__dropdown {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    width: 240px;
    background: var(--white);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    padding: var(--space-2) 0;
    opacity: 0;
    visibility: hidden;
    transform: translateY(-8px);
    transition: all var(--transition-fast);
    z-index: 100;
  }
  .navbar__dropdown--open {
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
  }
  .navbar__dropdown-header {
    padding: var(--space-3) var(--space-4);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .navbar__dropdown-item {
    display: block;
    padding: var(--space-2) var(--space-4);
    color: var(--gray-700);
    font-size: var(--text-sm);
    transition: background var(--transition-fast);
    text-decoration: none;
  }
  .navbar__dropdown-item:hover {
    background: var(--gray-50);
    color: var(--navy);
  }
  .navbar__dropdown-item--danger {
    color: var(--error);
  }
  .navbar__dropdown-item--danger:hover {
    background: var(--error-light);
    color: var(--error);
  }
  .navbar__mobile-toggle {
    display: none;
    background: none;
    border: none;
    color: var(--white);
    cursor: pointer;
    padding: var(--space-2);
  }
  @media (max-width: 768px) {
    .navbar__mobile-toggle { display: block; }
    .navbar__links {
      display: none;
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: var(--navy-deep);
      flex-direction: column;
      padding: var(--space-4) var(--space-6);
      border-top: 1px solid rgba(255,255,255,0.1);
    }
    .navbar__links--open { display: flex; }
    .navbar__dropdown {
      position: static;
      box-shadow: none;
      width: 100%;
      background: var(--navy-light);
      border-radius: 0;
    }
    .navbar__dropdown-header { color: var(--white); }
    .navbar__dropdown-item { color: var(--gray-300); }
  }
`;
document.head.appendChild(navbarStyles);

// Auto-render on page load
document.addEventListener('DOMContentLoaded', renderNavbar);
