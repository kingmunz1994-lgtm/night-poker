// ── Mental Poker Crypto (client-side) ────────────────────────
// XOR-based encryption adapted from zkpoker (ottodevs)
// Each card is padded to 16 bytes; XOR with player's 16-byte key
// XOR is commutative: E_A(E_B(x)) = E_B(E_A(x)) = x XOR keyA XOR keyB

class MentalPokerCrypto {
  constructor() {
    this.key = null; // Uint8Array(16) — player's secret XOR key
  }

  // Generate a random 16-byte XOR key
  generateKey() {
    this.key = crypto.getRandomValues(new Uint8Array(16));
    return this.key;
  }

  // Load key from storage (persist across reconnects)
  loadOrGenerateKey(tableId) {
    const stored = localStorage.getItem(`np_key_${tableId}`);
    if (stored) {
      this.key = new Uint8Array(JSON.parse(stored));
    } else {
      this.generateKey();
      localStorage.setItem(`np_key_${tableId}`, JSON.stringify([...this.key]));
    }
    return this.key;
  }

  // Pad a card byte (0–51) to 16 bytes
  padCard(card) {
    const buf = new Uint8Array(16);
    buf[0] = card;
    return buf;
  }

  // XOR two 16-byte arrays
  xor16(a, b) {
    const result = new Uint8Array(16);
    for (let i = 0; i < 16; i++) result[i] = a[i] ^ b[i];
    return result;
  }

  // Encrypt a card with this player's key
  encrypt(card) {
    return this.xor16(this.padCard(card), this.key);
  }

  // Decrypt — XOR again with same key (XOR is its own inverse)
  decrypt(encCard) {
    return this.xor16(encCard, this.key)[0]; // first byte = card value
  }

  // Encrypt entire 52-card deck
  encryptDeck(deck) {
    return deck.map(card => this.encrypt(card));
  }

  // Decrypt a single encrypted card (removes this player's layer)
  decryptCard(encCard) {
    return this.xor16(encCard, this.key);
  }

  // Shuffle an array in-place (Fisher-Yates)
  shuffle(deck) {
    const arr = [...deck];
    for (let i = arr.length - 1; i > 0; i--) {
      const rand = new Uint8Array(1);
      crypto.getRandomValues(rand);
      const j = rand[0] % (i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Encode Uint8Array → hex string for on-chain submission
  toHex(bytes) {
    return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Decode hex string → Uint8Array
  fromHex(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    }
    return bytes;
  }

  // Hash a value (for ZK commitment simulation)
  async hashCommit(value, nonce) {
    const data = new Uint8Array([value, ...nonce]);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return new Uint8Array(hash);
  }

  // Verify card matches commitment
  async verifyCommit(card, nonce, commitment) {
    const hash = await this.hashCommit(card, nonce);
    return this.toHex(hash) === this.toHex(commitment);
  }
}

// State channel — off-chain betting with signatures
class StateChannel {
  constructor(tableId, players) {
    this.tableId = tableId;
    this.players = players; // array of public keys
    this.state   = null;
    this.sigs    = {};
  }

  // Sign a state update (simulated — real impl uses Midnight DApp Connector)
  async sign(state) {
    // In production: use walletState.api.signMessage(JSON.stringify(state))
    const stateStr = JSON.stringify(state);
    const encoded  = new TextEncoder().encode(stateStr);
    const hash     = await crypto.subtle.digest('SHA-256', encoded);
    return { state, sig: [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2,'0')).join('') };
  }

  // Collect all player signatures — returns true when all have signed
  collectSig(playerKey, sig) {
    this.sigs[playerKey] = sig;
    return Object.keys(this.sigs).length >= this.players.length;
  }

  // Check if all active players have signed
  isComplete() {
    return this.players.every(pk => this.sigs[pk]);
  }
}

const poker_crypto = new MentalPokerCrypto();
