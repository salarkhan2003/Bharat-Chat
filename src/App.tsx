import React, { useState, useEffect, useRef } from 'react';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider,
  signOut,
  signInAnonymously
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  where, 
  onSnapshot,
  addDoc,
  serverTimestamp,
  orderBy,
  limit,
  getDocs,
  getDocFromServer
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';

// --- Connection Test ---
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();
import { 
  Send, 
  LogOut, 
  MessageSquare, 
  Users, 
  Sparkles, 
  Shield, 
  Bot,
  Circle,
  Menu,
  ChevronLeft,
  Info,
  AlertCircle,
  Sun,
  Moon
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from './lib/utils';
import { generateKeyPair, encryptMessage, decryptMessage } from './lib/crypto';
import { summarizeChat, getSmartReplies, chatWithAI } from './lib/ai';
import { useChatMessages, usePresence } from './hooks/useRealtime';
import { setupPresenceListener, updatePresence } from './services/presence';

// --- Type Definitions ---
interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  status?: string;
  publicKey?: string;
  privacySettings?: {
    showLastSeen: boolean;
    showReadReceipts: boolean;
  };
}

interface Chat {
  id: string;
  participants: string[];
  lastMessage?: string;
  lastMessageAt?: any;
  participantDetails?: UserProfile[];
}

function ProfileSettings({ isOpen, onClose, profile, onUpdate }: any) {
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [status, setStatus] = useState(profile?.status || '');
  const [photoURL, setPhotoURL] = useState(profile?.photoURL || '');
  const [showLastSeen, setShowLastSeen] = useState(profile?.privacySettings?.showLastSeen ?? true);
  const [showReadReceipts, setShowReadReceipts] = useState(profile?.privacySettings?.showReadReceipts ?? true);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updated = {
        displayName,
        status,
        photoURL,
        privacySettings: { showLastSeen, showReadReceipts }
      };
      await setDoc(doc(db, 'users', profile.uid), updated, { merge: true });
      onUpdate({ ...profile, ...updated });
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
    >
      <motion.div 
        initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }}
        className="w-full max-w-md liquid-clay-card p-8"
      >
        <h3 className="text-2xl font-display font-bold text-white mb-6 text-center">Settings</h3>
        
        <div className="space-y-6">
          <div className="flex flex-col items-center gap-4">
            <img src={photoURL} className="w-24 h-24 rounded-3xl object-cover border-2 border-white/10" alt="Profile" />
            <input 
              value={photoURL} onChange={(e) => setPhotoURL(e.target.value)}
              placeholder="Avatar URL"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-slate-400"
            />
          </div>

          <div className="space-y-4">
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display Name" className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-white" />
            <input value={status} onChange={(e) => setStatus(e.target.value)} placeholder="Status" className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-white" />
          </div>

          <div className="space-y-3 pt-4 border-t border-white/5">
            <div className="flex justify-between items-center"><span className="text-sm text-slate-300 font-sans">Show Last Seen</span><button onClick={() => setShowLastSeen(!showLastSeen)} className={cn("w-10 h-6 rounded-full relative", showLastSeen ? "bg-blue-600" : "bg-slate-700")}><div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full transition-all", showLastSeen ? "left-5" : "left-1")} /></button></div>
            <div className="flex justify-between items-center"><span className="text-sm text-slate-300 font-sans">Read Receipts</span><button onClick={() => setShowReadReceipts(!showReadReceipts)} className={cn("w-10 h-6 rounded-full relative", showReadReceipts ? "bg-blue-600" : "bg-slate-700")}><div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full transition-all", showReadReceipts ? "left-5" : "left-1")} /></button></div>
          </div>

          <div className="flex gap-3 pt-4">
            <button onClick={onClose} className="flex-1 py-3 glass rounded-2xl font-bold text-slate-400">Cancel</button>
            <button onClick={handleSave} disabled={isSaving} className="flex-1 py-3 bg-white text-black rounded-2xl font-bold disabled:opacity-50 shadow-xl">{isSaving ? 'Saving...' : 'Save'}</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function NewChatModal({ isOpen, onClose, onSelectUser, myUid }: any) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'discover' | 'contacts'>('contacts');
  const [contacts, setContacts] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen || !myUid) return;
    setLoading(true);
    
    const unsubUsers = onSnapshot(query(collection(db, 'users'), limit(50)), (snap) => {
      setUsers(snap.docs.map(d => d.data() as UserProfile).filter(u => u.uid !== myUid));
      setLoading(false);
    });

    const unsubContacts = onSnapshot(collection(db, 'users', myUid, 'contacts'), (snap) => {
      setContacts(snap.docs.map(d => d.id));
    });

    return () => { unsubUsers(); unsubContacts(); };
  }, [isOpen, myUid]);

  const toggleContact = async (u: UserProfile) => {
    const ref = doc(db, 'users', myUid, 'contacts', u.uid);
    if (!contacts.includes(u.uid)) {
      await setDoc(ref, { uid: u.uid, displayName: u.displayName, photoURL: u.photoURL, addedAt: serverTimestamp() });
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="w-full max-w-md liquid-clay-card p-6 flex flex-col max-h-[80vh] bg-[var(--bg-tertiary)] border-[var(--border-primary)] transition-colors duration-300">
        <div className="flex justify-between items-center mb-6 px-1">
          <h3 className="text-xl font-display font-bold text-[var(--text-primary)]">Connections</h3>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-[var(--text-secondary)] font-bold transition-all">×</button>
        </div>

        <div className="flex gap-2 mb-6 p-1 bg-black/5 rounded-2xl border border-[var(--border-primary)]">
          <button onClick={() => setTab('contacts')} className={cn("flex-1 py-2 text-xs font-bold rounded-xl transition-all", tab === 'contacts' ? "bg-[var(--accent-primary)] text-[var(--accent-secondary)]" : "text-[var(--text-secondary)]")}>Contacts</button>
          <button onClick={() => setTab('discover')} className={cn("flex-1 py-2 text-xs font-bold rounded-xl transition-all", tab === 'discover' ? "bg-[var(--accent-primary)] text-[var(--accent-secondary)]" : "text-[var(--text-secondary)]")}>Discover</button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-hide">
          {(tab === 'contacts' ? users.filter(u => contacts.includes(u.uid)) : users).map(u => (
            <div key={u.uid} className="p-4 glass rounded-2xl flex items-center gap-3 border border-[var(--border-primary)] transition-all duration-300">
              <img src={u.photoURL} className="w-10 h-10 rounded-xl object-cover" alt="U" />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[var(--text-primary)] text-sm truncate">{u.displayName}</div>
                <div className="text-[10px] text-[var(--text-secondary)] truncate uppercase tracking-tighter">{u.status || 'Verified'}</div>
              </div>
              <div className="flex gap-2">
                {!contacts.includes(u.uid) && <button onClick={() => toggleContact(u)} className="p-2 text-blue-400 hover:bg-blue-400/10 rounded-xl transition-colors"><Users className="w-4 h-4" /></button>}
                <button onClick={() => onSelectUser(u)} className="p-2 bg-blue-600 rounded-xl text-white hover:bg-blue-500 transition-colors shadow-lg"><Send className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

// --- Constants ---
const TEST_USERS = [
  { id: 'demo_1', name: 'Arjun Sharma', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Arjun' },
  { id: 'demo_2', name: 'Priya Patel', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Priya' },
  { id: 'demo_3', name: 'Vikram Singh', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Vikram' },
  { id: 'demo_4', name: 'Ananya Iyer', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ananya' },
  { id: 'demo_5', name: 'Rahul Verma', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Rahul' },
];

function LoginView({ onLogin, onDemoLogin }: { onLogin: () => void, onDemoLogin: (u: typeof TEST_USERS[0]) => void }) {
  const [error, setError] = useState<string | null>(null);

  const handleDemoClick = async (u: typeof TEST_USERS[0]) => {
    setError(null);
    try {
      await onDemoLogin(u);
    } catch (err: any) {
      if (err?.code === 'auth/admin-restricted-operation' || err?.code === 'auth/operation-not-allowed') {
        setError('Demo Login (Anonymous) is disabled. Please enable it in Firebase Console or use Google Login.');
      } else {
        setError(err?.message || 'Login failed');
      }
    }
  };

  return (
    <div className="h-[100dvh] w-full flex items-center justify-center bg-[var(--bg-primary)] p-6 overflow-y-auto transition-colors duration-300">
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-50">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px]" />
      </div>
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md liquid-clay-card p-10 flex flex-col items-center text-center gap-8 relative z-10"
      >
        <div className="w-20 h-20 bg-white/5 rounded-[2rem] flex items-center justify-center backdrop-blur-md border border-[var(--border-primary)]">
          <MessageSquare className="w-10 h-10 text-[var(--accent-primary)]" />
        </div>
        
        <div>
          <h1 className="text-4xl font-display font-bold text-[var(--text-primary)] mb-2 tracking-tight">BharatChat</h1>
          <p className="text-[var(--text-secondary)] font-sans text-sm">Glassmorphism E2EE Messenger</p>
        </div>

        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="w-full p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-left">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-xs text-red-200 font-medium leading-relaxed">{error}</p>
          </motion.div>
        )}

        <button 
          onClick={onLogin}
          className="liquid-clay-button w-full py-4 px-6 rounded-2xl font-bold font-sans shadow-2xl flex items-center justify-center gap-3"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="G" />
          Sign in with Google
        </button>

        <div className="w-full h-px bg-[var(--border-primary)] relative my-2">
          <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--bg-tertiary)] px-4 text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest">Or Test Real-time</span>
        </div>

        <div className="grid grid-cols-1 w-full gap-2 text-left">
          {TEST_USERS.map(u => (
            <button 
              key={u.id}
              onClick={() => handleDemoClick(u)}
              className="w-full p-3 glass rounded-2xl flex items-center gap-3 hover:bg-white/10 transition-all group"
            >
              <img src={u.avatar} className="w-8 h-8 rounded-full border border-[var(--border-primary)]" alt="Av" />
              <div className="flex-1 min-w-0">
                <div className="text-[var(--text-primary)] text-xs font-bold truncate">{u.name}</div>
                <div className="text-[9px] text-[var(--text-secondary)] uppercase tracking-tighter truncate">Demo Credentials</div>
              </div>
              <ChevronLeft className="w-4 h-4 rotate-180 text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors" />
            </button>
          ))}
        </div>
        
        <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-widest font-bold">Military-Grade Encryption · Signal Protocol</p>
      </motion.div>
    </div>
  );
}

// --- Main App Component ---
export default function App() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAIActive, setIsAIActive] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const profileRef = doc(db, 'users', u.uid);
        const profileSnap = await getDoc(profileRef);
        
        if (!profileSnap.exists()) {
          const keys = await generateKeyPair();
          localStorage.setItem(`enc_key_${u.uid}`, keys.privateKey);
          
          // Check if we have pending demo data
          const demoDataStr = sessionStorage.getItem('pending_demo_user');
          const demoData = demoDataStr ? JSON.parse(demoDataStr) : null;

          const pData: UserProfile = {
            uid: u.uid,
            displayName: demoData?.name || u.displayName || 'Unknown',
            photoURL: demoData?.avatar || u.photoURL || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + u.uid,
            publicKey: keys.publicKey,
            status: demoData ? 'I am a tester 🚀' : 'Hey there! I am using BharatChat.',
            privacySettings: { showLastSeen: true, showReadReceipts: true }
          };
          await setDoc(profileRef, pData);
          setProfile(pData);
          sessionStorage.removeItem('pending_demo_user');
        } else {
          const pData = profileSnap.data() as UserProfile;
          if (!localStorage.getItem(`enc_key_${u.uid}`)) {
            const keys = await generateKeyPair();
            localStorage.setItem(`enc_key_${u.uid}`, keys.privateKey);
            await setDoc(profileRef, { publicKey: keys.publicKey }, { merge: true });
          }
          setProfile(pData);
        }
        setupPresenceListener();
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const handleDemoLogin = async (demo: typeof TEST_USERS[0]) => {
    setLoading(true);
    sessionStorage.setItem('pending_demo_user', JSON.stringify(demo));
    try {
      await signInAnonymously(auth);
    } catch (e) {
      sessionStorage.removeItem('pending_demo_user');
      setLoading(false);
      throw e; // Caught by LoginView
    }
  };

  const handleLogout = async () => {
    await updatePresence(false);
    await signOut(auth);
    setActiveChat(null);
    setProfile(null);
  };

  if (loading) return (
    <div className="h-[100dvh] w-full flex items-center justify-center bg-[var(--bg-primary)]">
      <motion.div 
        animate={{ scale: [1, 1.1, 1], opacity: [0.3, 1, 0.3] }} 
        transition={{ repeat: Infinity, duration: 2 }}
        className="text-[var(--text-primary)] font-display text-2xl font-bold flex flex-col items-center gap-4"
      >
        <Sparkles className="text-[var(--text-primary)] w-12 h-12" />
        BharatChat
      </motion.div>
    </div>
  );

  if (!user) return <LoginView onLogin={handleLogin} onDemoLogin={handleDemoLogin} />;

  return (
    <div className="h-[100dvh] w-full flex bg-[var(--bg-secondary)] overflow-hidden transition-colors duration-300">
      <ProfileSettings 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        profile={profile} 
        onUpdate={(p: UserProfile) => setProfile(p)}
      />

      {/* Sidebar - Desktop and Mobile (Off-canvas) */}
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <>
            {/* Mobile Overlay */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm md:hidden"
            />
            <motion.div
              initial={{ x: -100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -100, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 z-[70] w-full max-w-[340px] bg-[var(--bg-primary)] flex flex-col md:relative md:w-96 md:max-w-none transition-colors duration-300"
            >
              <Sidebar 
                profile={profile} 
                onLogout={handleLogout} 
                onSettings={() => setIsSettingsOpen(true)}
                onClose={() => setIsSidebarOpen(false)}
                theme={theme}
                toggleTheme={toggleTheme}
                onSelectChat={(chat: Chat) => {
                  setIsAIActive(false);
                  setActiveChat(chat);
                  if (window.innerWidth < 768) setIsSidebarOpen(false);
                }}
                onAISelect={() => {
                  setIsAIActive(true);
                  setActiveChat(null);
                  if (window.innerWidth < 768) setIsSidebarOpen(false);
                }}
                activeChatId={activeChat?.id}
                isAIActive={isAIActive}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        <Header 
          activeChat={activeChat} 
          isAIActive={isAIActive}
          isSidebarOpen={isSidebarOpen} 
          toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} 
          onBack={() => {
            setActiveChat(null);
            setIsAIActive(false);
          }}
        />
        
        <main className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
            {isAIActive ? (
              <motion.div
                key="ai-chat"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="h-full"
              >
                <AIChatView userId={profile!.uid} />
              </motion.div>
            ) : activeChat ? (
              <ChatRoom 
                key={activeChat.id} 
                chat={activeChat} 
                myProfile={profile!} 
              />
            ) : (
              <EmptyState />
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

// --- Sub-components ---

function AIChatView({ userId }: { userId: string }) {
  const [messages, setMessages] = useState<{ role: 'user' | 'model', content: string }[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userId) return;
    const docRef = doc(db, 'ai_chats', userId);
    const unsubscribe = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        setMessages(snap.data().messages || []);
      } else {
        setMessages([{ role: 'model', content: "Hello! I'm Bharat AI. How can I help you today?" }]);
      }
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `ai_chats/${userId}`);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [userId]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages, isTyping]);

  const saveHistory = async (newMessages: typeof messages) => {
    try {
      await setDoc(doc(db, 'ai_chats', userId), {
        userId,
        messages: newMessages,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      console.error("Failed to save AI history:", err);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || isTyping || !userId) return;

    const userMsg = inputText.trim();
    setInputText('');
    const updatedMessages = [...messages, { role: 'user', content: userMsg }] as typeof messages;
    setMessages(updatedMessages);
    setIsTyping(true);

    try {
      const history = updatedMessages.map(m => ({
        role: m.role,
        parts: [{ text: m.content }]
      }));

      const response = await chatWithAI(userMsg, history);
      const finalMessages = [...updatedMessages, { role: 'model', content: response }] as typeof messages;
      setMessages(finalMessages);
      await saveHistory(finalMessages);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'model', content: "Sorry, I'm having trouble connecting right now." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleNewChat = async () => {
    const initialMsg = [{ role: 'model', content: "Hello! I'm Bharat AI. How can I help you today?" }] as typeof messages;
    setMessages(initialMsg);
    await saveHistory(initialMsg);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--bg-primary)] transition-colors duration-300">
      <div className="px-6 py-2 border-b border-[var(--border-primary)] flex justify-between items-center bg-[var(--bg-primary)]/50 backdrop-blur-xl">
        <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">Session Persistent</span>
        <button 
          onClick={handleNewChat}
          className="text-[10px] font-bold text-blue-400 hover:text-blue-300 uppercase tracking-widest flex items-center gap-1 transition-colors"
        >
          <Sparkles className="w-3 h-3" />
          Start New Chat
        </button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide">
        {messages.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn("flex flex-col", m.role === 'user' ? "items-end" : "items-start")}
          >
            <div className={cn(
              "max-w-[85%] px-5 py-3 rounded-[1.5rem] text-sm font-medium transition-all duration-300",
              m.role === 'user' 
                ? "bg-[var(--accent-primary)] text-[var(--accent-secondary)] rounded-tr-none shadow-xl" 
                : "bg-[var(--bg-quaternary)] text-[var(--text-primary)] border border-[var(--border-primary)] rounded-tl-none"
            )}>
              <div className="whitespace-pre-wrap">{m.content}</div>
            </div>
          </motion.div>
        ))}
        {isTyping && (
          <div className="flex items-start">
            <div className="bg-[var(--bg-quaternary)] text-[var(--text-secondary)] px-5 py-3 rounded-[1.5rem] rounded-tl-none text-sm font-medium animate-pulse border border-[var(--border-primary)]">
              AI is thinking...
            </div>
          </div>
        )}
      </div>

      <div className="p-6 pt-0">
        <div className="flex gap-4 items-center">
          <div className="flex-1 bg-[var(--bg-quaternary)] rounded-full flex items-center px-4 py-2 border border-[var(--border-primary)] focus-within:border-white/20 transition-all">
            <input 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask anything..."
              className="flex-1 bg-transparent border-none focus:ring-0 text-[var(--text-primary)] placeholder-slate-500 py-2 text-sm font-medium"
            />
          </div>
          <button 
            onClick={handleSend}
            disabled={isTyping}
            className="w-12 h-12 bg-[var(--accent-primary)] text-[var(--accent-secondary)] rounded-full flex items-center justify-center transition-transform active:scale-90 shadow-lg disabled:opacity-50"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Sidebar({ profile, onLogout, onSettings, onClose, onSelectChat, onAISelect, theme, toggleTheme, activeChatId, isAIActive }: any) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'messages' | 'contacts' | 'ai'>(isAIActive ? 'ai' : 'messages');
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);

  // Messages/Chats listener
  useEffect(() => {
    if (!profile || activeTab !== 'messages') return;
    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', profile.uid),
      orderBy('updatedAt', 'desc')
    );
    
    return onSnapshot(q, async (snap) => {
      try {
        const chatList = await Promise.all(snap.docs.map(async (d) => {
          const data = d.data() as Chat;
          const otherParticipantId = data.participants.find(p => p !== profile.uid);
          let otherProfile: UserProfile | null = null;
          if (otherParticipantId) {
            const uSnap = await getDoc(doc(db, 'users', otherParticipantId));
            otherProfile = uSnap.data() as UserProfile;
          }
          return { 
            id: d.id, 
            ...data, 
            participantDetails: otherProfile ? [otherProfile] : [] 
          };
        }));
        setChats(chatList);
      } catch (err) {
        console.error(err);
      }
    });
  }, [profile, activeTab]);

  // All Users/Discover listener
  useEffect(() => {
    if (!profile || activeTab !== 'contacts') return;
    const q = query(collection(db, 'users'), limit(50));
    return onSnapshot(q, (snap) => {
      setAllUsers(snap.docs.map(d => d.data() as UserProfile).filter(u => u.uid !== profile.uid));
    });
  }, [profile, activeTab]);

  const handleCreateChat = async (otherUser: UserProfile) => {
    const existing = chats.find(c => c.participants.includes(otherUser.uid));
    if (existing) {
      onSelectChat(existing);
      setActiveTab('messages');
    } else {
      const chatRef = await addDoc(collection(db, 'chats'), {
        participants: [profile.uid, otherUser.uid],
        updatedAt: serverTimestamp(),
        lastMessage: 'Started a new conversation',
        lastMessageAt: serverTimestamp()
      });
      onSelectChat({ 
        id: chatRef.id, 
        participants: [profile.uid, otherUser.uid], 
        participantDetails: [otherUser] 
      });
      setActiveTab('messages');
    }
  };

  return (
    <>
      <NewChatModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSelectUser={handleCreateChat}
        myUid={profile?.uid}
      />
      
      <div className="flex-1 flex flex-col min-h-0 bg-[var(--bg-primary)] p-6 space-y-6 transition-colors duration-300">
        {/* Header Section */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-display font-bold text-[var(--text-primary)] tracking-tight">
            {activeTab === 'messages' ? 'Messages' : activeTab === 'contacts' ? 'Contacts' : 'AI Assistant'}
          </h1>
          <div className="flex items-center gap-2">
            <button 
              onClick={toggleTheme}
              className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button onClick={onLogout} className="p-2 text-slate-500 hover:text-red-400 transition-colors">
              <LogOut className="w-5 h-5" />
            </button>
            <button onClick={onClose} className="md:hidden p-2 text-slate-500 hover:text-white">
              <ChevronLeft className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative group">
          <Menu className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-white transition-colors" />
          <input 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${activeTab}...`}
            className="search-bar"
          />
        </div>

        {/* Dynamic Content List */}
        <div className="flex-1 overflow-y-auto space-y-1 scrollbar-hide -mx-2 px-2">
          {activeTab === 'messages' && (
            chats.filter(c => {
              const name = c.participantDetails?.[0]?.displayName || '';
              return name.toLowerCase().includes(searchQuery.toLowerCase());
            }).map(chat => {
              const other = chat.participantDetails?.[0];
              return (
                <motion.button
                  key={chat.id}
                  onClick={() => onSelectChat(chat)}
                  className={cn(
                    "w-full px-3 py-4 rounded-[2rem] flex items-center gap-4 transition-all group",
                    activeChatId === chat.id 
                      ? "bg-white/10" 
                      : "hover:bg-white/5"
                  )}
                >
                  <div className="relative flex-shrink-0">
                    <img 
                      src={other?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${chat.id}`} 
                      className="w-14 h-14 rounded-full object-cover grayscale-[20%] group-hover:grayscale-0 transition-all border border-white/5 shadow-lg shadow-black/40" 
                      alt="P" 
                    />
                    <div className="absolute top-0 right-0 w-4 h-4 bg-black rounded-full flex items-center justify-center border border-white/10">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                    </div>
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-white text-base truncate pr-2">{other?.displayName || 'Chat user'}</span>
                      {chat.lastMessageAt && (
                        <span className="text-[11px] font-medium text-slate-500 whitespace-nowrap">
                          {format(chat.lastMessageAt.toDate ? chat.lastMessageAt.toDate() : new Date(), 'HH:mm')}
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <p className="text-sm text-slate-500 truncate font-medium">
                        {chat.lastMessage || 'No messages yet'}
                      </p>
                      <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center flex-shrink-0 shadow-lg border border-black/10">
                        <span className="text-[10px] font-bold text-black">1</span>
                      </div>
                    </div>
                  </div>
                </motion.button>
              );
            })
          )}

          {activeTab === 'contacts' && (
            allUsers.filter(u => u.displayName.toLowerCase().includes(searchQuery.toLowerCase())).map(u => (
              <motion.button
                key={u.uid}
                onClick={() => handleCreateChat(u)}
                className="w-full px-3 py-4 rounded-[2rem] flex items-center gap-4 hover:bg-white/5 transition-all group"
              >
                <img src={u.photoURL} className="w-12 h-12 rounded-full object-cover border border-white/5" alt="U" />
                <div className="flex-1 text-left min-w-0">
                  <div className="font-bold text-white text-base truncate">{u.displayName}</div>
                  <div className="text-xs text-slate-500 truncate">{u.status || 'Active now'}</div>
                </div>
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-blue-400 group-hover:bg-blue-400 group-hover:text-white transition-all">
                  <Send className="w-4 h-4" />
                </div>
              </motion.button>
            ))
          )}

          {activeTab === 'ai' && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4 p-8">
              <div className="w-20 h-20 bg-white/5 rounded-[2.5rem] flex items-center justify-center border border-white/5 shadow-2xl">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Bharat AI Assistant</h3>
                <p className="text-sm text-slate-500 mt-2">Chat with our AI bot to summarize your conversations or get intelligent insights.</p>
              </div>
              <button 
                onClick={onAISelect}
                className="liquid-clay-button px-6 py-3 rounded-2xl font-bold"
              >
                Start AI Chat
              </button>
            </div>
          )}
        </div>

        {/* Bottom Tab Navigation */}
        <div className="flex items-center justify-between gap-4 pt-2 relative">
          <div className="flex-1 bg-[#121212] border border-white/5 rounded-full px-4 py-2 flex items-center justify-around gap-2 shadow-2xl">
            <button 
              onClick={() => setActiveTab('contacts')}
              className={cn("p-2 transition-all", activeTab === 'contacts' ? "text-white bg-white/10 rounded-full" : "text-slate-500 hover:text-white")}
            >
              <Users className="w-6 h-6" />
            </button>
            <button 
              onClick={() => setActiveTab('messages')}
              className={cn("p-2 transition-all", activeTab === 'messages' ? "text-white bg-white/10 rounded-full" : "text-slate-500 hover:text-white")}
            >
              <MessageSquare className="w-6 h-6" />
            </button>
            <button 
              onClick={() => setActiveTab('ai')}
              className={cn("p-2 transition-all", activeTab === 'ai' ? "text-white bg-white/10 rounded-full" : "text-slate-500 hover:text-white")}
            >
              <Bot className="w-6 h-6" />
            </button>
          </div>
          <button 
            onClick={onSettings}
            className="w-14 h-14 bg-white/5 border border-white/10 text-white rounded-full flex items-center justify-center shadow-2xl hover:bg-white/10 active:scale-95 transition-all"
          >
            <div className="w-8 h-8 rounded-full overflow-hidden border border-white/10 shadow-lg">
              <img src={profile?.photoURL} className="w-full h-full object-cover" alt="Me" />
            </div>
          </button>
        </div>
      </div>
    </>
  );
}

function Header({ activeChat, isAIActive, isSidebarOpen, toggleSidebar, onBack }: any) {
  const other = activeChat?.participantDetails?.[0];
  const presence = usePresence(other?.uid || null);

  return (
    <header className="h-20 bg-[var(--bg-primary)] px-6 flex items-center justify-between z-40 border-b border-[var(--border-primary)] transition-colors duration-300">
      <div className="flex items-center gap-4">
        {(activeChat || isAIActive) ? (
          <button onClick={onBack} className="p-1 -ml-4 text-[var(--text-primary)] hover:bg-white/5 rounded-full transition-colors">
            <ChevronLeft className="w-7 h-7" />
          </button>
        ) : (
          !isSidebarOpen && (
            <button onClick={toggleSidebar} className="p-2 -ml-2 text-[var(--text-primary)] hover:bg-white/5 rounded-full transition-colors">
              <Menu className="w-6 h-6" />
            </button>
          )
        )}
        
        {(activeChat || isAIActive) && (
          <div className="flex items-center gap-3">
            <div className="relative">
              {isAIActive ? (
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-[var(--border-primary)]">
                  <Sparkles className="w-5 h-5 text-[var(--text-primary)]" />
                </div>
              ) : (
                <>
                  <img src={other?.photoURL} className="w-10 h-10 rounded-full object-cover border border-[var(--border-primary)]" alt="Avatar" />
                  {presence?.isOnline && (
                    <div className="absolute top-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[var(--bg-primary)]" />
                  )}
                </>
              )}
            </div>
            <div>
              <h2 className="font-display font-bold text-[var(--text-primary)] text-sm leading-tight text-left">
                {isAIActive ? 'Bharat AI' : other?.displayName}
              </h2>
              <p className="text-[10px] font-medium text-[var(--text-secondary)] text-left">
                {isAIActive ? (
                  <span className="text-green-400">Online & Thinking</span>
                ) : (
                  presence?.isTyping && presence?.currentChatId === activeChat?.id ? (
                    <span className="text-blue-400">Typing...</span>
                  ) : (
                    presence?.isOnline ? 'Active Now' : 'Offline'
                  )
                )}
              </p>
            </div>
          </div>
        )}
      </div>
      
      {activeChat && (
        <div className="flex items-center gap-4">
          <button className="text-slate-400 hover:text-white transition-colors">
            <Bot className="w-6 h-6" />
          </button>
          <button className="text-slate-400 hover:text-white transition-colors">
            <Users className="w-6 h-6" />
          </button>
        </div>
      )}
    </header>
  );
}

function ChatRoom({ chat, myProfile }: { chat: Chat, myProfile: UserProfile }) {
  const { messages, loading } = useChatMessages(chat.id);
  const [inputText, setInputText] = useState('');
  const [decryptedMessages, setDecryptedMessages] = useState<any[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [smartReplies, setSmartReplies] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const other = chat.participantDetails?.[0];
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Read receipts logic
  useEffect(() => {
    const markAsRead = async () => {
      const unread = messages.filter(m => m.senderId !== myProfile.uid && m.status !== 'read');
      for (const m of unread) {
        await setDoc(doc(db, 'chats', chat.id, 'messages', m.id), { status: 'read' }, { merge: true });
      }
    };
    if (messages.length > 0 && myProfile.privacySettings?.showReadReceipts !== false) {
      markAsRead();
    }
  }, [messages, myProfile.uid, chat.id, myProfile.privacySettings?.showReadReceipts]);

  useEffect(() => {
    const decryptAll = async () => {
      const privateKey = localStorage.getItem(`enc_key_${myProfile.uid}`);
      if (!privateKey) return;
      
      const decrypted = await Promise.all(messages.map(async (m) => {
        try {
          if (m.iv && m.senderPublicKey) {
            const text = await decryptMessage(
              { content: m.content, iv: m.iv, senderPublicKey: m.senderPublicKey },
              privateKey
            );
            return { ...m, content: text };
          }
          return m;
        } catch (e) {
          return { ...m, content: '[Encrypted Message]' };
        }
      }));
      setDecryptedMessages(decrypted);

      // Get smart replies for last few messages
      if (decrypted.length > 0 && decrypted[decrypted.length - 1].senderId !== myProfile.uid) {
        const lastFew = decrypted.slice(-3).map(m => ({ 
          sender: m.senderId === myProfile.uid ? 'Me' : 'Other', 
          text: m.content 
        }));
        const replies = await getSmartReplies(lastFew);
        setSmartReplies(replies);
      }
    };
    decryptAll();
  }, [messages, myProfile.uid]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [decryptedMessages]);

  const handleSendMessage = async (text: string = inputText) => {
    if (!text.trim() || !other?.publicKey) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    try {
      const encrypted = await encryptMessage(text, other.publicKey);
      
      await addDoc(collection(db, 'chats', chat.id, 'messages'), {
        senderId: myProfile.uid,
        content: encrypted.content,
        iv: encrypted.iv,
        senderPublicKey: encrypted.senderPublicKey,
        createdAt: serverTimestamp(),
        status: 'sent',
        type: 'text'
      });

      await setDoc(doc(db, 'chats', chat.id), {
        lastMessage: 'Encrypted Message',
        lastMessageAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });

      setInputText('');
      setSmartReplies([]);
      await updatePresence(true, false, chat.id);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSummarize = async () => {
    setIsSummarizing(true);
    const msgs = decryptedMessages.slice(-20).map(m => ({
      sender: m.senderId === myProfile.uid ? 'Me' : (other?.displayName || 'Recipient'),
      text: m.content
    }));
    const res = await summarizeChat(msgs);
    setSummary(res || 'Unable to summarize.');
    setIsSummarizing(false);
  };

  return (
    <div className="h-full flex flex-col relative">
      {/* AI Summary Overlay */}
      <AnimatePresence>
        {isSummarizing && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center"
          >
            <div className="flex flex-col items-center gap-4">
              <Sparkles className="w-12 h-12 text-blue-400 animate-pulse" />
              <p className="font-display font-medium text-white">AI is reading the conversation...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {summary && (
        <motion.div 
          initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          className="mx-6 mt-4 p-4 liquid-clay-card border-blue-500/30 bg-blue-600/10 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-2 opacity-20"><Bot className="w-8 h-8" /></div>
          <h5 className="text-[10px] uppercase tracking-widest font-bold text-blue-400 mb-1 flex items-center gap-2">
            AI Summary <Sparkles className="w-3 h-3" />
          </h5>
          <p className="text-sm text-slate-200 font-sans leading-relaxed">{summary}</p>
          <button onClick={() => setSummary(null)} className="absolute top-2 right-2 text-slate-500 hover:text-white transition-colors">
            < ChevronLeft className="w-4 h-4 rotate-90" />
          </button>
        </motion.div>
      )}

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {loading ? (
          <div className="text-center py-10 opacity-40">Connecting to secure tunnel...</div>
        ) : (
          decryptedMessages.map((m, idx) => {
            const isMe = m.senderId === myProfile.uid;
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, x: isMe ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={cn("flex flex-col", isMe ? "items-end" : "items-start")}
              >
                <div className={cn(
                  "max-w-[85%] px-5 py-3 rounded-[1.5rem] font-sans text-sm font-medium transition-all duration-300",
                  isMe 
                    ? "bg-[var(--accent-primary)] text-[var(--accent-secondary)] rounded-tr-none shadow-xl" 
                    : "bg-[var(--bg-quaternary)] text-[var(--text-primary)] rounded-tl-none border border-[var(--border-primary)]"
                )}>
                  {m.content}
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-[9px] text-slate-500 uppercase tracking-tighter">
                    {m.createdAt ? format(m.createdAt.toDate ? m.createdAt.toDate() : new Date(), 'p') : 'Just now'}
                  </span>
                  {isMe && (
                    <div className="flex -space-x-1">
                      <Shield className={cn("w-3 h-3", m.status === 'read' ? "text-blue-400" : "text-slate-700")} />
                      {m.status !== 'sent' && (
                        <Shield className={cn("w-3 h-3", m.status === 'read' ? "text-blue-400" : "text-slate-700")} />
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input Area */}
      <div className="p-6 bg-[var(--bg-primary)] border-t border-[var(--border-primary)] transition-colors duration-300">
        <div className="flex gap-4 items-center">
          <div className="flex-1 bg-[var(--bg-quaternary)] rounded-full flex items-center px-4 py-2 border border-[var(--border-primary)] focus-within:border-white/20 transition-all">
            <input 
              value={inputText}
              onChange={(e) => {
                const val = e.target.value;
                setInputText(val);
                updatePresence(true, val.length > 0, chat.id);
                
                if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = setTimeout(() => {
                  updatePresence(true, false, chat.id);
                }, 3000);
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Type Here..."
              className="flex-1 bg-transparent border-none focus:ring-0 text-[var(--text-primary)] placeholder-slate-500 py-2 text-sm font-medium"
            />
          </div>
          <button 
            onClick={() => handleSendMessage()}
            className="w-12 h-12 bg-[var(--accent-primary)] text-[var(--accent-secondary)] rounded-full flex items-center justify-center transition-transform active:scale-90 shadow-lg"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-full flex items-center justify-center p-10 text-center bg-[var(--bg-primary)] transition-colors duration-300">
      <div className="max-w-xs flex flex-col items-center gap-8">
        <div className="w-24 h-24 bg-[var(--bg-quaternary)] rounded-[3rem] flex items-center justify-center border border-[var(--border-primary)] shadow-2xl relative">
          <div className="absolute inset-0 bg-white/5 blur-xl rounded-full" />
          <MessageSquare className="w-10 h-10 text-[var(--text-primary)] relative z-10" />
        </div>
        <div>
          <h3 className="text-2xl font-display font-bold text-[var(--text-primary)] mb-3 tracking-tight">BharatChat</h3>
          <p className="text-[var(--text-secondary)] text-sm font-medium leading-relaxed">
            Select a message or start a new conversation to begin chatting securely.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <div className="px-4 py-1.5 bg-[var(--bg-quaternary)] border border-[var(--border-primary)] rounded-full text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-widest shadow-lg">End-to-End Encrypted</div>
          <div className="px-4 py-1.5 bg-[var(--bg-quaternary)] border border-[var(--border-primary)] rounded-full text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-widest shadow-lg">Safe & Secure</div>
        </div>
      </div>
    </div>
  );
}
