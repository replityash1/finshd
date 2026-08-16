/**
 * js/storage.js — localStorage + Firestore dual persistence
 * 
 * Built in Phase 1. Exposes saveUserState(), loadUserState(), debouncedSync().
 * Handles sync status updates, document-size guard, and old-shape migration.
 * Only module that touches localStorage/Firestore directly.
 */
