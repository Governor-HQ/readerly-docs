// ===== CART & FILTER STATE =====
let cart = [];
let currentAvailability = 'all';
let currentCategory = 'all';
let currentSearch = '';

// ===================================================
// ===== BOOKS DATA =====
//
// Each book has two status fields — buyStatus and rentStatus.
// Set them independently for full control over each book.
//
// buyStatus options:
//   "available"  → buy button works normally
//   "soon"       → shows "Coming Soon"
//   "outofstock" → shows "Out of Stock"
//   "nosale"     → shows "Not for Sale"
//
// rentStatus options:
//   "available"  → rent button works normally
//   "soon"       → shows "Coming Soon"
//   "outofstock" → shows "Out of Stock"
//   "norent"     → rent button hidden entirely
//
// EXAMPLES:
//   Normal book:           buyStatus: "available",  rentStatus: "available"
//   Buy only, no rent:     buyStatus: "available",  rentStatus: "norent"
//   Coming soon both:      buyStatus: "soon",        rentStatus: "soon"
//   Buy ok, rent sold out: buyStatus: "available",  rentStatus: "outofstock"
//   Sold out, rent ok:     buyStatus: "outofstock", rentStatus: "available"
//
// To ADD a book: copy any object, paste before the closing ];
//               give it the next id number and fill in the details.
// To EDIT a book: just change the value and save. Redeploy on Netlify.
// ===================================================

const books = [
  {
    id: 1,
    title: "The Alchemist",
    author: "Paulo Coelho",
    description: "A shepherd boy's journey across the desert becomes a meditation on destiny, courage, and the language of the universe. This book will make you question what you're chasing, and why.",
    buyPrice: "₦7,000",
    rentPrice: "₦1,000/week",
    buyStatus: "available",
    rentStatus: "available",
    image: "https://covers.openlibrary.org/b/isbn/9780062315007-L.jpg",
    emoji: "✨",
    categories: ["spirituality", "mindset"]
  },
  {
    id: 2,
    title: "Ikigai",
    author: "Héctor García & Francesc Miralles",
    description: "The Japanese concept of 'reason for being' explored through the world's longest-living communities. A gentle but powerful framework for finding what makes your life worth waking up for.",
    buyPrice: "₦5,000",
    rentPrice: "₦1,000/week",
    buyStatus: "available",
    rentStatus: "available",
    image: "https://covers.openlibrary.org/b/isbn/9780143130727-L.jpg",
    emoji: "🌸",
    categories: ["spirituality", "mindset", "health"]
  },
  {
    id: 3,
    title: "Ego Is the Enemy",
    author: "Ryan Holiday",
    description: "Before success, ego prevents you from learning. During success, ego makes you reckless. After failure, ego stops you from recovering. Ryan Holiday shows how to defeat it at every stage.",
    buyPrice: "₦9,000",
    rentPrice: "₦1,000/week",
    buyStatus: "soon",
    rentStatus: "available",
    image: "https://covers.openlibrary.org/b/isbn/9781591847816-L.jpg",
    emoji: "🧠",
    categories: ["mindset", "resilience", "leadership"]
  },
  {
    id: 4,
    title: "Sell Like Crazy",
    author: "Sabri Suby",
    description: "The most powerful customer-acquisition system ever developed. If you sell anything (a product, a service, yourself), this book will change how you think about marketing forever.",
    buyPrice: "₦10,500",
    rentPrice: "₦1,000/week",
    buyStatus: "soon",
    rentStatus: "available",
    image: "https://covers.openlibrary.org/b/isbn/9780648459903-L.jpg",
    emoji: "💰",
    categories: ["money", "communication", "career"]
  },
  {
    id: 5,
    title: "How to Win Friends & Influence People",
    author: "Dale Carnegie",
    description: "Written in 1936. Still the most practical guide to human relationships ever published. Read this and you'll understand why some people are magnetic and others aren't.",
    buyPrice: "₦4,000",
    rentPrice: "₦1,000/week",
    buyStatus: "available",
    rentStatus: "available",
    image: "https://covers.openlibrary.org/b/isbn/9789382449102-L.jpg",
    emoji: "🤝",
    categories: ["relationships", "communication", "leadership"]
  },
  {
    id: 6,
    title: "Atomic Habits",
    author: "James Clear",
    description: "You don't rise to the level of your goals, you fall to the level of your systems. This book gives you those systems. The most practical book ever written on behaviour change.",
    buyPrice: "₦9,500",
    rentPrice: "₦1,000/week",
    buyStatus: "soon",
    rentStatus: "soon",
    image: "https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg",
    emoji: "⚡",
    categories: ["productivity", "mindset"]
  },
  {
    id: 7,
    title: "The Psychology of Money",
    author: "Morgan Housel",
    description: "Doing well with money has little to do with how smart you are and a lot to do with how you behave. 19 short stories about the strange ways people think about wealth.",
    buyPrice: "₦9,000",
    rentPrice: "₦1,000/week",
    buyStatus: "soon",
    rentStatus: "soon",
    image: "https://covers.openlibrary.org/b/isbn/9780857197689-L.jpg",
    emoji: "💡",
    categories: ["money", "mindset"]
  },
  {
    id: 8,
    title: "The Subtle Art of Not Giving a F*ck",
    author: "Mark Manson",
    description: "A counterintuitive approach to living a good life. Not about being positive, it's about being honest. This book will make you care about fewer things, but the right things.",
    buyPrice: "₦6,000",
    rentPrice: "₦1,000/week",
    buyStatus: "available",
    rentStatus: "available",
    image: "https://covers.openlibrary.org/b/isbn/9780062457714-L.jpg",
    emoji: "🔑",
    categories: ["mindset", "resilience"]
  },
  {
    id: 9,
    title: "Deep Work",
    author: "Cal Newport",
    description: "The ability to focus without distraction is becoming rare, and increasingly valuable. Cal Newport argues that deep work is the superpower of the 21st century. This book teaches you how to cultivate it.",
    buyPrice: "₦9,000",
    rentPrice: "₦1,000/week",
    buyStatus: "soon",
    rentStatus: "soon",
    image: "https://covers.openlibrary.org/b/isbn/9780349411910-L.jpg",
    emoji: "🎯",
    categories: ["productivity", "career"]
  },
  {
    id: 10,
    title: "Rich Dad Poor Dad",
    author: "Robert Kiyosaki",
    description: "Two fathers, two completely different money philosophies. This book doesn't just teach you about money, it changes the way you see money, work, and what it means to be rich.",
    buyPrice: "₦9,000",
    rentPrice: "₦1,000/week",
    buyStatus: "soon",
    rentStatus: "soon",
    image: "https://covers.openlibrary.org/b/isbn/9781612680194-L.jpg",
    emoji: "🏦",
    categories: ["money", "mindset"]
  },
  {
    id: 11,
    title: "Think and Grow Rich",
    author: "Napoleon Hill",
    description: "After studying 500 of the most successful people in America for 20 years, Napoleon Hill distilled their secrets into 13 principles. Still the most referenced success book ever written.",
    buyPrice: "₦8,500",
    rentPrice: "₦1,000/week",
    buyStatus: "soon",
    rentStatus: "soon",
    image: "https://covers.openlibrary.org/b/isbn/9781585424337-L.jpg",
    emoji: "💎",
    categories: ["money", "mindset", "career"]
  },
  {
    id: 12,
    title: "The Richest Man in Babylon",
    author: "George S. Clason",
    description: "Ancient parables set in Babylon that contain timeless financial wisdom. Simple enough to finish in a day, deep enough to transform how you handle every naira you ever earn.",
    buyPrice: "₦8,000",
    rentPrice: "₦1,000/week",
    buyStatus: "soon",
    rentStatus: "soon",
    image: "https://covers.openlibrary.org/b/isbn/9780451205360-L.jpg",
    emoji: "🏺",
    categories: ["money"]
  },
  {
    id: 13,
    title: "So Good They Can't Ignore You",
    author: "Cal Newport",
    description: "Passion is a side effect of mastery, not a prerequisite for it. Newport destroys the 'follow your passion' myth and replaces it with something that actually works: become so skilled the world can't ignore you.",
    buyPrice: "₦9,000",
    rentPrice: "₦1,000/week",
    buyStatus: "soon",
    rentStatus: "soon",
    image: "https://covers.openlibrary.org/b/isbn/9781455509126-L.jpg",
    emoji: "📈",
    categories: ["career", "mindset"]
  },
  {
    id: 14,
    title: "The 48 Laws of Power",
    author: "Robert Greene",
    description: "3,000 years of the history of power condensed into 48 laws. Whether you want to gain power, defend against it, or simply understand how it works, this is the most comprehensive manual ever written.",
    buyPrice: "₦11,000",
    rentPrice: "₦1,000/week",
    buyStatus: "soon",
    rentStatus: "soon",
    image: "https://covers.openlibrary.org/b/isbn/9780670881468-L.jpg",
    emoji: "👑",
    categories: ["leadership", "communication", "mindset"]
  },
  {
    id: 15,
    title: "The Purpose Driven Life",
    author: "Rick Warren",
    description: "What on earth am I here for? This book tackles the most fundamental question of human existence. Over 50 million copies sold. It will challenge you to live for something bigger than yourself.",
    buyPrice: "₦8,500",
    rentPrice: "₦1,000/week",
    buyStatus: "soon",
    rentStatus: "soon",
    image: "https://covers.openlibrary.org/b/isbn/9780310247883-L.jpg",
    emoji: "🌟",
    categories: ["spirituality"]
  },
  {
    id: 16,
    title: "Stillness Is the Key",
    author: "Ryan Holiday",
    description: "In a world obsessed with speed and noise, stillness is the competitive advantage nobody talks about. Holiday draws on the Stoics, Buddhists, and history's greatest minds to show you how to find it.",
    buyPrice: "₦9,000",
    rentPrice: "₦1,000/week",
    buyStatus: "soon",
    rentStatus: "soon",
    image: "https://covers.openlibrary.org/b/isbn/9780525538585-L.jpg",
    emoji: "🧘",
    categories: ["mindset", "spirituality", "resilience"]
  },
  {
    id: 17,
    title: "Man's Search for Meaning",
    author: "Viktor Frankl",
    description: "Written by a Holocaust survivor and psychiatrist. Frankl argues that even in the most brutal suffering, humans can choose their response. A short book that will permanently change your relationship with hardship.",
    buyPrice: "₦8,000",
    rentPrice: "₦1,000/week",
    buyStatus: "soon",
    rentStatus: "soon",
    image: "https://covers.openlibrary.org/b/isbn/9780807014271-L.jpg",
    emoji: "🕯️",
    categories: ["resilience", "spirituality", "mindset"]
  },
  {
    id: 18,
    title: "The Obstacle Is the Way",
    author: "Ryan Holiday",
    description: "The ancient Stoic idea that obstacles are not in the way, they ARE the way. Using Marcus Aurelius, Eisenhower, and others, Holiday shows how history's greatest people turned problems into their greatest advantages.",
    buyPrice: "₦9,000",
    rentPrice: "₦1,000/week",
    buyStatus: "soon",
    rentStatus: "soon",
    image: "https://covers.openlibrary.org/b/isbn/9781591846352-L.jpg",
    emoji: "🔥",
    categories: ["resilience", "mindset", "leadership"]
  },
];

// ===== STATUS HELPERS =====
const statusConfig = {
  available:  { label: null,               badge: null,                          cls: '' },
  soon:       { label: '⏳ Coming Soon',    badge: { text: 'Coming Soon',  cls: 'badge-soon' }, cls: 'btn-disabled' },
  outofstock: { label: '❌ Out of Stock',   badge: { text: 'Out of Stock', cls: 'badge-outofstock' }, cls: 'btn-disabled' },
  nosale:     { label: '🚫 Not for Sale',   badge: null,                          cls: 'btn-disabled' },
  norent:     { label: null,               badge: null,                          cls: '' },
};

function buildBuyBtn(book, inCart, forModal = false) {
  const s = book.buyStatus;
  const baseCls = forModal ? 'modal-action-btn modal-buy-btn' : 'action-btn buy-btn';
  const onclick = forModal
    ? `addToCart(${book.id}, 'buy'); updateModalButtons(${book.id})`
    : `addToCart(${book.id}, 'buy')`;

  if (s === 'available') {
    return `<button class="${baseCls} ${inCart ? 'in-cart' : ''}" onclick="${onclick}">
      ${inCart ? (forModal ? '✓ Added to Cart' : '✓ Buying') : '📦 Buy : ' + book.buyPrice}
    </button>`;
  }
  return `<button class="${forModal ? 'modal-action-btn' : 'action-btn buy-btn'} btn-disabled" disabled>
    ${statusConfig[s]?.label || '🚫 Unavailable'}
  </button>`;
}

function buildRentBtn(book, inCart, forModal = false) {
  if (book.rentStatus === 'norent') return '';
  const s = book.rentStatus;
  const baseCls = forModal ? 'modal-action-btn modal-rent-btn' : 'action-btn rent-btn';
  const onclick = forModal
    ? `addToCart(${book.id}, 'rent'); updateModalButtons(${book.id})`
    : `addToCart(${book.id}, 'rent')`;

  if (s === 'available') {
    return `<button class="${baseCls} ${inCart ? 'in-cart-rent' : ''}" onclick="${onclick}">
      ${inCart ? (forModal ? '✓ Added to Cart' : '✓ Renting') : '🔄 Rent : ₦1,000/' + (forModal ? 'week' : 'wk')}
    </button>`;
  }
  return `<button class="${forModal ? 'modal-action-btn' : 'action-btn rent-btn'} btn-disabled" disabled>
    ${statusConfig[s]?.label || '🚫 Unavailable'}
  </button>`;
}

function getBadgeHTML(book) {
  const buyStat = statusConfig[book.buyStatus];
  const rentStat = statusConfig[book.rentStatus];
  const badge = buyStat?.badge || rentStat?.badge;
  if (!badge) return '';
  return `<span class="availability-badge ${badge.cls}">${badge.text}</span>`;
}

function handleSearch(value) {
  currentSearch = value.trim().toLowerCase();
  document.getElementById('search-clear').style.display = currentSearch ? 'flex' : 'none';
  renderBooks();
}

function clearSearch() {
  currentSearch = '';
  document.getElementById('book-search').value = '';
  document.getElementById('search-clear').style.display = 'none';
  renderBooks();
}

// ===== RENDER BOOKS =====
function renderBooks() {
  const grid = document.getElementById('books-grid');
  const emptyState = document.getElementById('empty-state');
  const resultsCount = document.getElementById('results-count');
  grid.innerHTML = '';

  const filtered = books.filter(book => {
  const availabilityMatch = currentAvailability === 'all' ||
    (currentAvailability === 'rent' && book.rentStatus !== 'norent' && book.rentStatus === 'available');
  const categoryMatch = currentCategory === 'all' || book.categories.includes(currentCategory);
  const searchMatch = !currentSearch ||
    book.title.toLowerCase().includes(currentSearch) ||
    book.author.toLowerCase().includes(currentSearch);
  return availabilityMatch && categoryMatch && searchMatch;
});

  if (filtered.length === 0) {
    emptyState.style.display = 'block';
    resultsCount.textContent = '';
    return;
  }

  emptyState.style.display = 'none';
  resultsCount.textContent = `Showing ${filtered.length} book${filtered.length > 1 ? 's' : ''}`;

  filtered.forEach(book => {
    const inCartBuy = cart.find(i => i.id === book.id && i.type === 'buy');
    const inCartRent = cart.find(i => i.id === book.id && i.type === 'rent');

    const card = `
      <div class="book-card" id="card-${book.id}">
        ${getBadgeHTML(book)}
        <div class="book-cover">
          <img
            src="${book.image}"
            alt="${book.title} cover"
            onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
          />
          <div class="book-emoji-fallback" style="display:none;">${book.emoji}</div>
        </div>
        <div class="book-info">
          <h3>${book.title}</h3>
          <p class="book-author">${book.author}</p>
          <p class="book-desc">${book.description}</p>
          <div class="book-categories">
            ${book.categories.map(c => `<span class="book-tag">${c}</span>`).join('')}
          </div>
          <div class="book-actions">
            ${buildBuyBtn(book, inCartBuy)}
            ${buildRentBtn(book, inCartRent)}
          </div>
        </div>
      </div>
    `;
    grid.innerHTML += card;
  });
}

// ===== FILTER FUNCTIONS =====
function setAvailability(type, btn) {
  currentAvailability = type;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderBooks();
}

function setCategory(category, btn) {
  currentCategory = category;
  document.querySelectorAll('.pill').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderBooks();
}

// ===== CART FUNCTIONS =====
function addToCart(bookId, type) {
  const book = books.find(b => b.id === bookId);
  const already = cart.find(item => item.id === bookId);

  if (already && already.type === type) {
    cart = cart.filter(item => item.id !== bookId);
    updateCartUI();
    renderBooks();
    return;
  }

  if (already && already.type !== type) {
    cart = cart.filter(item => item.id !== bookId);
  }

  // Guard — only available items can be added
  if (type === 'buy' && book.buyStatus !== 'available') return;
  if (type === 'rent' && book.rentStatus !== 'available') return;

  if (type === 'rent') {
    const existingRental = cart.find(item => item.type === 'rent');
    if (existingRental) {
      alert(`You can only rent one book at a time.\n\nRemove "${existingRental.title}" from your cart first.`);
      return;
    }
  }

  cart.push({ ...book, type });
  updateCartUI();
  renderBooks();
}

function updateCartUI() {
  const count = cart.length;
  document.getElementById('cart-count').textContent = count;

  const itemsContainer = document.getElementById('cart-items');
  const footer = document.getElementById('cart-footer');

  if (count === 0) {
    itemsContainer.innerHTML = '<p class="cart-empty">No books added yet.</p>';
    footer.style.display = 'none';
    return;
  }

  footer.style.display = 'flex';

  const buyItems = cart.filter(item => item.type === 'buy');
  const rentItems = cart.filter(item => item.type === 'rent');

  let html = '';

  if (buyItems.length > 0) {
    html += `<p class="cart-section-label">📦 Buying</p>`;
    html += buyItems.map(book => `
      <div class="cart-item">
        <img class="cart-item-img" src="${book.image}" alt="${book.title}"
          onerror="this.style.display='none';" />
        <div class="cart-item-info">
          <p class="cart-item-title">${book.title}</p>
          <p class="cart-item-author">${book.author}</p>
          <p class="cart-item-type">${book.buyPrice}</p>
        </div>
        <button class="cart-item-remove" onclick="addToCart(${book.id}, 'buy')">✕</button>
      </div>
    `).join('');
  }

  if (rentItems.length > 0) {
    html += `<p class="cart-section-label">🔄 Renting</p>`;
    html += rentItems.map(book => `
      <div class="cart-item">
        <img class="cart-item-img" src="${book.image}" alt="${book.title}"
          onerror="this.style.display='none';" />
        <div class="cart-item-info">
          <p class="cart-item-title">${book.title}</p>
          <p class="cart-item-author">${book.author}</p>
          <p class="cart-item-type">₦1,000/week · max 3 weeks</p>
        </div>
        <button class="cart-item-remove" onclick="addToCart(${book.id}, 'rent')">✕</button>
      </div>
    `).join('');
  }

  itemsContainer.innerHTML = html;

  const buyTotal = buyItems.reduce((sum, b) => {
    const price = parseInt(b.buyPrice.replace(/[₦,]/g, ''));
    return sum + price;
  }, 0);
  const rentTotal = rentItems.length * 1000;
  const grandTotal = buyTotal + rentTotal;

  const totalHTML = `
    <div class="cart-total">
      ${buyItems.length > 0 ? `<p class="cart-total-line"><span>Books to buy (${buyItems.length})</span><span>₦${buyTotal.toLocaleString()}</span></p>` : ''}
      ${rentItems.length > 0 ? `<p class="cart-total-line"><span>Rental deposit (1 week)</span><span>₦${rentTotal.toLocaleString()}</span></p>` : ''}
      <div class="cart-total-grand">
        <span>Estimated Total</span>
        <span>₦${grandTotal.toLocaleString()}</span>
      </div>
      <p class="cart-total-note">* Delivery fee varies by location and will be confirmed on WhatsApp after you send your order. Rental renews weekly at ₦1,000.</p>
    </div>
  `;

  itemsContainer.innerHTML += totalHTML;

  let message = `Hi! Here's my Readerly order:\n`;
  if (buyItems.length > 0) {
    message += `\n📦 TO BUY:\n`;
    message += buyItems.map((b, i) => `${i + 1}. ${b.title} by ${b.author} : ${b.buyPrice}`).join('\n');
  }
  if (rentItems.length > 0) {
    message += `\n\n🔄 TO RENT (₦1,000/week):\n`;
    message += rentItems.map((b, i) => `${i + 1}. ${b.title} by ${b.author}`).join('\n');
    message += `\n\n📍 Please confirm rental availability for my location.`;
  }
  message += `\n\nEstimated Total: ₦${grandTotal.toLocaleString()} (excl. delivery)\n\nThank you!`;

  const encoded = encodeURIComponent(message);
  document.getElementById('checkout-btn').href = `https://wa.me/2348138281223?text=${encoded}`;
}

function toggleCart() {
  const drawer = document.getElementById('cart-drawer');
  const overlay = document.getElementById('cart-overlay');
  drawer.classList.toggle('open');
  overlay.classList.toggle('open');
}

function clearCart() {
  cart = [];
  updateCartUI();
  renderBooks();
}

// ===== HOW IT WORKS TABS =====
function switchTab(tab, e) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.remove('hidden');
  e.target.classList.add('active');
}

// ===== HAMBURGER & MOBILE MENU =====
document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('mobile-menu').classList.add('open');
  document.getElementById('mobile-menu-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
});

function closeMobileMenu() {
  document.getElementById('mobile-menu').classList.remove('open');
  document.getElementById('mobile-menu-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

// ===== MOBILE CATEGORY DROPDOWN =====
function toggleMobileCategories() {
  document.getElementById('nav-category-list').classList.toggle('open');
  const arrow = document.getElementById('cat-arrow');
  if (arrow) arrow.textContent = document.getElementById('nav-category-list').classList.contains('open') ? '▴' : '▾';
}

function mobileCategorySelect(category, el) {
  closeMobileMenu();
  currentCategory = category;
  document.querySelectorAll('.pill').forEach(b => b.classList.remove('active'));
  const matchingPill = [...document.querySelectorAll('.pill')].find(p =>
    p.getAttribute('onclick') && p.getAttribute('onclick').includes(`'${category}'`)
  );
  if (matchingPill) matchingPill.classList.add('active');
  renderBooks();
}

// ===== BOOK MODAL (MOBILE) =====
function openBookModal(bookId) {
  const book = books.find(b => b.id === bookId);
  if (!book) return;

  const inCartBuy = cart.find(i => i.id === book.id && i.type === 'buy');
  const inCartRent = cart.find(i => i.id === book.id && i.type === 'rent');

  document.getElementById('modal-content').innerHTML = `
    <div class="modal-cover">
      <img src="${book.image}" alt="${book.title}"
        onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
      <div class="modal-emoji-fallback" style="display:none;">${book.emoji}</div>
    </div>
    <div class="modal-body">
      <h2 class="modal-title">${book.title}</h2>
      <p class="modal-author">${book.author}</p>
      <p class="modal-desc">${book.description}</p>
      <div class="modal-tags">
        ${book.categories.map(c => `<span class="book-tag">${c}</span>`).join('')}
      </div>
      <div class="modal-actions" id="modal-actions-${book.id}">
        ${buildBuyBtn(book, inCartBuy, true)}
        ${buildRentBtn(book, inCartRent, true)}
      </div>
    </div>
  `;

  document.getElementById('book-modal').dataset.bookId = book.id;
  document.getElementById('book-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function updateModalButtons(bookId) {
  const book = books.find(b => b.id === bookId);
  if (!book) return;
  const inCartBuy = cart.find(i => i.id === bookId && i.type === 'buy');
  const inCartRent = cart.find(i => i.id === bookId && i.type === 'rent');

  const buyBtn = document.querySelector('.modal-buy-btn');
  if (buyBtn && book.buyStatus === 'available') {
    buyBtn.textContent = inCartBuy ? '✓ Added to Cart' : '📦 Buy : ' + book.buyPrice;
    buyBtn.classList.toggle('in-cart', !!inCartBuy);
  }

  const rentBtn = document.querySelector('.modal-rent-btn');
  if (rentBtn && book.rentStatus === 'available') {
    rentBtn.textContent = inCartRent ? '✓ Added to Cart' : '🔄 Rent : ₦1,000/week';
    rentBtn.classList.toggle('in-cart-rent', !!inCartRent);
  }
}

function closeBookModal() {
  document.getElementById('book-modal').classList.remove('open');
  setTimeout(() => { document.body.style.overflow = ''; }, 300);
}

function handleModalOverlayClick(e) {
  if (!document.getElementById('modal-panel').contains(e.target)) {
    closeBookModal();
  }
}

// Open modal on mobile card tap
document.getElementById('books-grid').addEventListener('click', (e) => {
  if (window.innerWidth > 768) return;
  if (e.target.closest('.action-btn') ||
      e.target.closest('.buy-btn') ||
      e.target.closest('.rent-btn')) return;
  const card = e.target.closest('.book-card');
  if (!card) return;
  const bookId = parseInt(card.id.replace('card-', ''));
  openBookModal(bookId);
});

// ===== INIT =====
renderBooks();