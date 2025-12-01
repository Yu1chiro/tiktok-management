require('dotenv').config();
const express = require('express');
const cors = require('cors');
// Multer & Archiver dihapus agar ringan dan Vercel-friendly
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Setup Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Middleware
app.use(cors());
app.use(express.json()); // Hanya menerima JSON body
app.use(express.static('public')); 

// --- ROUTES: DECKS (CRUD) ---

// 1. GET ALL DECKS
app.get('/api/decks', async (req, res) => {
    const { data, error } = await supabase
        .from('decks')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// 2. POST CREATE DECK
app.post('/api/decks', async (req, res) => {
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: "Title wajib diisi" });

    const { data, error } = await supabase
        .from('decks')
        .insert([{ title }])
        .select();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
});

// 3. PUT UPDATE DECK
app.put('/api/decks/:id', async (req, res) => {
    const { id } = req.params;
    const { title } = req.body;

    const { data, error } = await supabase
        .from('decks')
        .update({ title })
        .eq('id', id)
        .select();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
});

// 4. DELETE DECK
app.delete('/api/decks/:id', async (req, res) => {
    const { id } = req.params;
    
    // Note: Pastikan di Supabase Assets di set "ON DELETE CASCADE" relasinya ke Decks
    const { error } = await supabase
        .from('decks')
        .delete()
        .eq('id', id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: "Deck deleted" });
});

// --- ROUTES: ASSETS ---

// 5. GET ASSETS BY DECK
app.get('/api/decks/:deckId/assets', async (req, res) => {
    const { deckId } = req.params;

    const { data, error } = await supabase
        .from('assets')
        .select('*')
        .eq('deck_id', deckId)
        .order('created_at', { ascending: true }); 

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// 6. RECORD ASSET (Pengganti Upload Fisik)
// File diupload Frontend -> Frontend kirim JSON metadata ke sini -> Server catat di DB
app.post('/api/assets', async (req, res) => {
    // Menerima array asset untuk support bulk insert logic
    const { deckId, assets } = req.body; 
    // Format assets: [{ title, storage_path, public_url }, ...]

    if (!assets || assets.length === 0) {
        return res.status(400).json({ error: "Data asset kosong" });
    }

    // Persiapkan data untuk bulk insert
    const records = assets.map(file => ({
        deck_id: deckId,
        title: file.title,
        storage_path: file.storage_path,
        public_url: file.public_url,
        created_at: new Date().toISOString()
    }));

    const { data, error } = await supabase
        .from('assets')
        .insert(records)
        .select();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: "Metadata recorded", data: data });
});

// 7. DELETE SINGLE ASSET
app.delete('/api/assets/:id', async (req, res) => {
    const { id } = req.params;

    // Ambil info path storage dulu
    const { data: asset } = await supabase.from('assets').select('storage_path').eq('id', id).single();

    if (asset) {
        // Hapus dari Storage Supabase
        await supabase.storage.from('deck-assets').remove([asset.storage_path]);
    }

    // Hapus dari DB
    const { error } = await supabase.from('assets').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: "Asset deleted" });
});

// Route halaman frontend
app.get('/asset', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'asset.html'));
});
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});