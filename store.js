/* ListingStore — the only place listings are saved.
   The prototype keeps them in localStorage. A Supabase backend can replace
   this object without touching the listing flow:
     list()   -> select from the listings table (newest first)
     create() -> upload each photo in `photos` to Storage, then insert the row
                 with those public URLs and the auth user as the seller.
   `photos` are JPEG data URLs today. The future adapter can accept the same
   call and swap them for Storage URLs before anything else reads them. */
const ListingStore = {
  key: 'imdrivn_listings',
  list() {
    try {
      const raw = JSON.parse(localStorage.getItem(this.key) || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch (e) {
      return [];
    }
  },
  async create(listing) {
    const id = listing.id || ('u' + Date.now());
    const createdAt = new Date().toISOString();
    const existing = this.list();
    const sets = [listing.photos || []];
    if ((listing.photos || []).length > 1) sets.push([listing.photos[0]]);
    let last;
    for (const photos of sets) {
      const row = {...listing, id, createdAt, photos: photos.slice()};
      try {
        localStorage.setItem(this.key, JSON.stringify([row, ...existing]));
        return row;
      } catch (err) {
        last = err;
      }
    }
    const error = new Error('storage');
    error.cause = last;
    throw error;
  }
};
