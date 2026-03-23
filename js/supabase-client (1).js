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

// Strip all EXIF/metadata from an image by redrawing through canvas
// Removes: GPS coordinates, camera info, timestamps, software tags, etc.
async function stripImageMetadata(file, maxDimension = 2048, quality = 0.92) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Calculate dimensions (scale down if larger than maxDimension)
      let width = img.width;
      let height = img.height;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      // Draw to canvas — this strips ALL metadata
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      // Convert back to blob
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to process image'));
            return;
          }
          // Create a new File from the clean blob
          const cleanFile = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now()
          });
          resolve(cleanFile);
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for processing'));
    };

    img.src = url;
  });
}

async function uploadListingImage(file, listingId) {
  // Strip all metadata before uploading
  let cleanFile;
  try {
    cleanFile = await stripImageMetadata(file);
  } catch (err) {
    console.error('Metadata strip failed, uploading original:', err);
    cleanFile = file; // Fallback to original if stripping fails
  }

  const fileName = `${listingId}/${Date.now()}.jpg`;

  const { data, error } = await supabaseClient.storage
    .from('listing-images')
    .upload(fileName, cleanFile, {
      cacheControl: '3600',
      contentType: 'image/jpeg',
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
  
  // Stripe fee: 2.9% + $0.30
  const stripeFee = Math.round((total * 0.029 + 0.30) * 100) / 100;
  
  // Platform fee: feeRate% of subtotal (not shipping)
  const platformFee = Math.round((subtotal * feeRate / 100) * 100) / 100;
  
  // Seller payout
  const sellerPayout = Math.round((total - stripeFee - platformFee) * 100) / 100;

  return {
    subtotal,
    shipping,
    total,
    stripeFee,
    platformFee,
    sellerPayout,
    feeRate
  };
}

/* ============================================================
   CONTENT FILTER — Off-Platform Transaction Prevention
   Scans text for contact info, social handles, URLs, phone
   numbers, and solicitation phrases. Returns violations found.
   ============================================================ */

function checkContentFilter(text) {
  if (!text) return { clean: true, violations: [] };

  const violations = [];
  const lower = text.toLowerCase();

  // Email addresses
  if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text)) {
    violations.push('email address');
  }

  // Phone numbers (various US formats)
  if (/(\+?1?[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(text)) {
    violations.push('phone number');
  }

  // Social media handles (@username)
  if (/@[a-zA-Z0-9_.]{2,}/.test(text)) {
    violations.push('social media handle');
  }

  // URLs and domains
  if (/https?:\/\/|www\.|\.com|\.net|\.org|\.io|\.shop|\.co\/|\.me\/|linktr\.ee|bit\.ly/i.test(text)) {
    violations.push('website or link');
  }

  // Platform names used for off-platform contact
  const platforms = /\b(venmo|cashapp|cash\s*app|zelle|paypal|whatsapp|telegram|signal|facebook|fb|messenger|snapchat|snap|tiktok|twitter|discord)\b/i;
  if (platforms.test(text)) {
    violations.push('external platform reference');
  }

  // Solicitation phrases
  const solicitation = /\b(dm\s*me|text\s*me|call\s*me|hit\s*me\s*up|message\s*me|contact\s*me\s*(at|on|via)|reach\s*(me|out)\s*(at|on|via)|find\s*me\s*(at|on)|follow\s*me|hmu|send\s*me\s*a\s*(dm|message|text)|off\s*platform|pay\s*me\s*(directly|outside)|direct\s*payment)\b/i;
  if (solicitation.test(text)) {
    violations.push('off-platform solicitation');
  }

  return {
    clean: violations.length === 0,
    violations
  };
}

// Format violations into a user-friendly message
function getContentFilterMessage(violations) {
  const items = violations.map(v => v).join(', ');
  return `Your listing contains ${items}. To protect buyers and sellers, contact information and off-platform references are not allowed in listings. All transactions must go through Aequitas Market's secure checkout.`;
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
