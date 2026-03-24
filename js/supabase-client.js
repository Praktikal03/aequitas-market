/* ============================================================
   AEQUITAS MARKET — Supabase Client Configuration
   
   SETUP INSTRUCTIONS:
   1. Go to your Supabase dashboard (app.supabase.com)
   2. Click on your project
   3. Go to Settings → API
   4. Copy "Project URL" and "anon/public" key
   5. Paste them below
   ============================================================ */

const SUPABASE_URL = 'https://nyzryeiwhkevxylrpvwr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55enJ5ZWl3aGtldnh5bHJwdndyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMTQyODAsImV4cCI6MjA4OTY5MDI4MH0.0Pyjyt9f6PedBenAJuYxzf-azLwlT5yfTPMyxGGZaM0';

// Initialize Supabase client
// CDN creates window.supabase — we reassign it to our configured client
const _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// Override window.supabase won't work with const, so we use a new name
// All helper functions below use _sb internally
var supabaseClient = _sb;

/* ============================================================
   AUTH HELPER FUNCTIONS
   ============================================================ */

// Get current logged-in user
async function getCurrentUser() {
  const { data: { user }, error } = await supabaseClient.auth.getUser();
  if (error || !user) return null;
  return user;
}

// Get current user's profile (with marketplace data)
async function getCurrentProfile() {
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Error fetching profile:', error);
    return null;
  }
  return data;
}

// Sign up new user
async function signUp(email, password, metadata = {}) {
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      data: metadata  // { name: '...', role: 'seller' }
    }
  });
  return { data, error };
}

// Sign in existing user
async function signIn(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });
  return { data, error };
}

// Sign out
async function signOut() {
  const { error } = await supabaseClient.auth.signOut();
  if (!error) {
    window.location.href = '/';
  }
  return { error };
}

// Listen for auth state changes
supabaseClient.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    console.log('User signed in:', session.user.email);
  } else if (event === 'SIGNED_OUT') {
    console.log('User signed out');
  }
});

/* ============================================================
   NAVIGATION HELPERS
   ============================================================ */

// Redirect if not logged in
async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = '/pages/login.html';
    return null;
  }
  return user;
}

// Redirect if not a seller
async function requireSeller() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== 'seller') {
    window.location.href = '/';
    return null;
  }
  return profile;
}

// Redirect if not admin
async function requireAdmin() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== 'admin') {
    window.location.href = '/';
    return null;
  }
  return profile;
}

/* ============================================================
   LISTING HELPERS
   ============================================================ */

// Fetch active listings (for browse page)
async function getActiveListings(category = null, search = null, limit = 24, offset = 0) {
  let query = supabaseClient
    .from('listings_with_seller')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (category && category !== 'all') {
    query = query.eq('category', category);
  }

  if (search) {
    query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
  }

  const { data, error } = await query;
  return { data, error };
}

// Fetch single listing
async function getListing(id) {
  const { data, error } = await supabaseClient
    .from('listings_with_seller')
    .select('*')
    .eq('id', id)
    .single();
  return { data, error };
}

// Fetch seller's listings
async function getSellerListings(sellerId) {
  const { data, error } = await supabaseClient
    .from('listings')
    .select('*')
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false });
  return { data, error };
}

// Create new listing
async function createListing(listing) {
  const { data, error } = await supabaseClient
    .from('listings')
    .insert([listing])
    .select()
    .single();
  return { data, error };
}

// Update listing
async function updateListing(id, updates) {
  const { data, error } = await supabaseClient
    .from('listings')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  return { data, error };
}

/* ============================================================
   IMAGE UPLOAD HELPERS
   ============================================================ */

async function uploadListingImage(file, listingId) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${listingId}/${Date.now()}.${fileExt}`;

  const { data, error } = await supabaseClient.storage
    .from('listing-images')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) return { url: null, error };

  const { data: { publicUrl } } = supabaseClient.storage
    .from('listing-images')
    .getPublicUrl(fileName);

  return { url: publicUrl, error: null };
}

/* ============================================================
   ORDER HELPERS
   ============================================================ */

async function getOrdersForUser(userId, role = 'buyer') {
  const column = role === 'buyer' ? 'buyer_id' : 'seller_id';
  const { data, error } = await supabaseClient
    .from('orders')
    .select(`
      *,
      order_items (
        *,
        listing:listings (title, images)
      )
    `)
    .eq(column, userId)
    .order('created_at', { ascending: false });
  return { data, error };
}

/* ============================================================
   FEE CALCULATION
   ============================================================ */

function calculateFees(price, shippingCost, feeRate = 10) {
  const subtotal = parseFloat(price);
  const shipping = parseFloat(shippingCost) || 0;
  const total = subtotal + shipping;
  
  // Platform fee: feeRate% of subtotal (not shipping) — all-inclusive, no hidden fees
  const platformFee = Math.round((subtotal * feeRate / 100) * 100) / 100;
  
  // Seller payout: total minus platform fee only — Stripe processing is absorbed by platform
  const sellerPayout = Math.round((total - platformFee) * 100) / 100;

  // Internal: Stripe fee (2.9% + $0.30) — NOT shown to sellers, comes out of platform cut
  const stripeFee = Math.round((total * 0.029 + 0.30) * 100) / 100;
  const platformNetRevenue = Math.round((platformFee - stripeFee) * 100) / 100;

  return {
    subtotal,
    shipping,
    total,
    stripeFee,          // internal use only — do not display to sellers
    platformFee,
    platformNetRevenue, // what platform actually keeps after Stripe
    sellerPayout,
    feeRate
  };
}

/* ============================================================
   UTILITY FUNCTIONS
   ============================================================ */

function formatPrice(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function getCategoryLabel(category) {
  const labels = {
    clothing: 'Clothing & Fashion',
    electronics: 'Electronics & Tech',
    vintage: 'Vintage & Antiques',
    art: 'Art & Handmade',
    collectibles: 'Collectibles',
    general: 'General / Everything'
  };
  return labels[category] || category;
}

function getStatusLabel(status) {
  const labels = {
    pending: 'Pending Review',
    active: 'Active',
    sold: 'Sold',
    removed: 'Removed',
    draft: 'Draft',
    paid: 'Paid',
    shipped: 'Shipped',
    delivered: 'Delivered',
    completed: 'Completed',
    disputed: 'Disputed',
    refunded: 'Refunded',
    cancelled: 'Cancelled'
  };
  return labels[status] || status;
}

// Show/hide loading state
function showLoading(buttonEl, text = 'Loading...') {
  buttonEl.disabled = true;
  buttonEl.dataset.originalText = buttonEl.textContent;
  buttonEl.innerHTML = `<span class="spinner" style="width:16px;height:16px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:8px;"></span>${text}`;
}

function hideLoading(buttonEl) {
  buttonEl.disabled = false;
  buttonEl.textContent = buttonEl.dataset.originalText || 'Submit';
}

// Show alert message
function showAlert(container, type, message) {
  const alert = document.createElement('div');
  alert.className = `alert alert--${type}`;
  alert.textContent = message;
  container.prepend(alert);
  setTimeout(() => alert.remove(), 5000);
}
