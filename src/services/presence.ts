import { auth, db } from '../lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

export async function updatePresence(isOnline: boolean, isTyping: boolean = false, currentChatId: string | null = null) {
  if (!auth.currentUser) return;
  
  const presenceRef = doc(db, 'presence', auth.currentUser.uid);
  await setDoc(presenceRef, {
    uid: auth.currentUser.uid,
    isOnline,
    isTyping,
    currentChatId,
    lastActive: serverTimestamp()
  }, { merge: true });
}

export function setupPresenceListener() {
  const handleFocus = () => updatePresence(true);
  const handleBlur = () => updatePresence(false);
  
  window.addEventListener('focus', handleFocus);
  window.addEventListener('blur', handleBlur);
  window.addEventListener('beforeunload', () => updatePresence(false));

  // Initial
  updatePresence(true);

  return () => {
    window.removeEventListener('focus', handleFocus);
    window.removeEventListener('blur', handleBlur);
  };
}
