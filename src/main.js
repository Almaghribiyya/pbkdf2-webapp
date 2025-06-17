document.addEventListener('DOMContentLoaded', () => {
    // Referensi elemen DOM
    const tabs = document.querySelectorAll('.tab-button');
    const sections = {
        home: document.getElementById('home-content'),
        crypto: document.getElementById('crypto-content')
    };
    const notification = document.getElementById('notification');
    const encryptButton = document.getElementById('encrypt-button');
    const decryptButton = document.getElementById('decrypt-button');
    const copyButtons = document.querySelectorAll('.copy-btn');
    const passwordToggles = document.querySelectorAll('.password-toggle');
    const clearButtons = document.querySelectorAll('.clear-btn');

    // --- MANAJEMEN UI ---

    // Fungsi untuk menampilkan notifikasi
    function showNotification(message, isSuccess = true) {
        notification.textContent = message;
        notification.classList.remove('hidden', 'bg-red-600', 'bg-cyan-500');
        notification.classList.add(isSuccess ? 'bg-cyan-500' : 'bg-red-600');
        setTimeout(() => notification.classList.add('hidden'), 3000);
    }

    // Navigasi Tab
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const target = tab.id.split('-')[1]; // "home" atau "crypto"
            Object.values(sections).forEach(s => s.classList.add('hidden'));
            sections[target].classList.remove('hidden');
        });
    });

    // Toggle Tampilkan/Sembunyikan Kata Sandi
    passwordToggles.forEach(button => {
        button.addEventListener('click', () => {
            const targetInput = document.getElementById(button.dataset.target);
            const isPassword = targetInput.type === 'password';
            targetInput.type = isPassword ? 'text' : 'password';
            button.querySelector('.eye-open').classList.toggle('hidden', isPassword);
            button.querySelector('.eye-closed').classList.toggle('hidden', !isPassword);
        });
    });

    // Tombol Salin ke Clipboard
    copyButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTextarea = document.getElementById(button.dataset.target);
            if (targetTextarea.value) {
                navigator.clipboard.writeText(targetTextarea.value)
                    .then(() => showNotification('Berhasil disalin!', true))
                    .catch(() => showNotification('Gagal menyalin.', false));
            }
        });
    });
    
    // Tombol Bersihkan Form
    clearButtons.forEach(button => {
        button.addEventListener('click', () => {
            const cardId = button.dataset.card;
            const card = document.getElementById(cardId);
            card.querySelectorAll('input, textarea').forEach(el => el.value = '');
        });
    });
    
    // Fungsi untuk mengelola status loading tombol
    function setButtonLoading(button, isLoading) {
        button.disabled = isLoading;
        button.querySelector('.btn-text').classList.toggle('hidden', isLoading);
        button.querySelector('.btn-spinner').classList.toggle('hidden', !isLoading);
    }

    // --- LOGIKA KRIPTOGRAFI ---

    const textEncoder = new TextEncoder();
    const textDecoder = new TextDecoder();

    async function getPBKDF2Key(password, salt) {
        const baseKey = await crypto.subtle.importKey("raw", textEncoder.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]);
        return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, baseKey, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
    }
    
    function xor(data, key) {
        const result = new Uint8Array(data.length);
        for (let i = 0; i < data.length; i++) result[i] = data[i] ^ key[i % key.length];
        return result;
    }

    function base64ToUrlSafe(str) { return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''); }
    function urlSafeToBase64(str) {
        str = str.replace(/-/g, '+').replace(/_/g, '/');
        while (str.length % 4) str += '=';
        return str;
    }

    // Event Listener Enkripsi
    encryptButton.addEventListener('click', async () => {
        const text = document.getElementById('text-enkripsi').value;
        const password = document.getElementById('password-enkripsi').value;
        const confirmPassword = document.getElementById('confirm-password-enkripsi').value;
        const resultArea = document.getElementById('result-enkripsi');

        if (!text || !password) return showNotification("Pesan dan kunci tidak boleh kosong.", false);
        if (password !== confirmPassword) return showNotification("Konfirmasi kunci tidak cocok.", false);

        setButtonLoading(encryptButton, true);
        try {
            await new Promise(resolve => setTimeout(resolve, 500)); // Simulasi loading
            const salt = crypto.getRandomValues(new Uint8Array(16));
            const derivedKey = await getPBKDF2Key(password, salt);
            const keyBytes = new Uint8Array(await crypto.subtle.exportKey("raw", derivedKey));
            const textBytes = textEncoder.encode(text);
            const encryptedBytes = xor(textBytes, keyBytes);
            
            const combined = new Uint8Array(salt.length + encryptedBytes.length);
            combined.set(salt, 0);
            combined.set(encryptedBytes, salt.length);

            const base64String = btoa(String.fromCharCode.apply(null, combined));
            resultArea.value = base64ToUrlSafe(base64String);
            showNotification("Enkripsi berhasil!", true);
        } catch (error) {
            showNotification("Terjadi kesalahan saat enkripsi.", false);
            resultArea.value = '';
        } finally {
            setButtonLoading(encryptButton, false);
        }
    });

    // Event Listener Dekripsi
    decryptButton.addEventListener('click', async () => {
        const ciphertextB64 = document.getElementById('text-dekripsi').value;
        const password = document.getElementById('password-dekripsi').value;
        const confirmPassword = document.getElementById('confirm-password-dekripsi').value;
        const resultArea = document.getElementById('result-dekripsi');

        if (!ciphertextB64 || !password) return showNotification("Ciphertext dan kunci tidak boleh kosong.", false);
        if (password !== confirmPassword) return showNotification("Konfirmasi kunci tidak cocok.", false);

        setButtonLoading(decryptButton, true);
        try {
            await new Promise(resolve => setTimeout(resolve, 500)); // Simulasi loading
            const combinedBase64 = urlSafeToBase64(ciphertextB64);
            const combined = Uint8Array.from(atob(combinedBase64), c => c.charCodeAt(0));
            if (combined.length < 16) throw new Error("Ciphertext tidak valid.");

            const salt = combined.slice(0, 16);
            const encryptedBytes = combined.slice(16);

            const derivedKey = await getPBKDF2Key(password, salt);
            const keyBytes = new Uint8Array(await crypto.subtle.exportKey("raw", derivedKey));
            const decryptedBytes = xor(encryptedBytes, keyBytes);

            resultArea.value = textDecoder.decode(decryptedBytes);
            showNotification("Dekripsi berhasil!", true);
        } catch (error) {
            showNotification("Gagal mendekripsi. Pastikan data benar.", false);
            resultArea.value = '';
        } finally {
            setButtonLoading(decryptButton, false);
        }
    });
});