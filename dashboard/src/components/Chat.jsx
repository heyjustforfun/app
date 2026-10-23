import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  Copy,
  Download,
  FileArchive,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Maximize2,
  MessageSquare,
  Paperclip,
  Play,
  Send,
  Smile,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import { api, dateTime, upload } from '../lib/api';
import { playSendSound, playReceiveSound, isSoundEnabled, toggleSound } from '../lib/sound';
import { useToast } from '../context/AppContext';
import { Spinner } from './ui';

const EMOJI_CATEGORIES = [
  {
    id: 'popular',
    name: 'Top Reactions',
    icon: '🔥',
    emojis: ['👍', '🔥', '💰', '🚀', '📈', '❤️', '🎉', '✅', '🤝', '💡', '⚡', '👏', '🙌', '💯', '💎', '🏆', '⭐', '✨'],
  },
  {
    id: 'crypto',
    name: 'Finance & Trade',
    icon: '💰',
    emojis: ['💰', '💵', '💳', '🏦', '📈', '📉', '📊', '🪙', '💎', '🚀', '⚡', '🔔', '🎯', '🔒', '🛡️', '⏳', '⏱️', '💼', '📑', '💹', '💸', '🧾'],
  },
  {
    id: 'smileys',
    name: 'Smileys',
    icon: '😊',
    emojis: ['😊', '😄', '😃', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😇', '🥰', '😍', '🤩', '😘', '😋', '🤑', '😎', '🤔', '🤫', '🫡', '🥳', '😴', '🤐', '🤗'],
  },
  {
    id: 'gestures',
    name: 'Gestures',
    icon: '👋',
    emojis: ['👍', '👎', '👌', '✌️', '🤞', '🤙', '👏', '🙌', '👐', '🤲', '🙏', '✍️', '💪', '🤝', '🫡', '👊', '🤛', '🤜', '👋', '✋'],
  },
  {
    id: 'symbols',
    name: 'Icons & Status',
    icon: '✅',
    emojis: ['✅', '❌', '⚠️', 'ℹ️', '❓', '❗', '🛑', '🟢', '🟡', '🔴', '🌟', '⭐', '💫', '💎', '🕒', '📅', '📌', '🔗', '🛡️', '🔑'],
  },
];

const QUICK_REACTIONS = ['👍', '🔥', '💰', '🚀', '📈', '❤️', '🎉', '✅', '🤝'];

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function isImageFile(type, name) {
  if (type && type.startsWith('image/')) return true;
  if (name && /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(name)) return true;
  return false;
}

function getFileIcon(type, name) {
  const n = (name || '').toLowerCase();
  if (n.endsWith('.pdf')) return <FileText className="h-5 w-5 text-rose-400" />;
  if (n.endsWith('.xls') || n.endsWith('.xlsx') || n.endsWith('.csv')) return <FileSpreadsheet className="h-5 w-5 text-emerald-400" />;
  if (n.endsWith('.zip') || n.endsWith('.rar')) return <FileArchive className="h-5 w-5 text-amber-400" />;
  return <FileText className="h-5 w-5 text-cyan-400" />;
}

/**
 * Enhanced Support Chat Component.
 * Supports:
 * - Real-time polling & thread sync
 * - Categorized Emoji Picker & 1-click Quick Reactions
 * - Document & Image attachments (upload, preview, clipboard paste & drag-drop)
 * - Image lightbox zoom & high-res document downloads
 * - Interactive Task Activation codes with copy & trade buttons
 */
export default function Chat({
  path,
  mineIsStaff,
  placeholder = 'Type your message…',
  onActivity,
  height = 'h-[60vh]',
}) {
  const toast = useToast();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [soundOn, setSoundOn] = useState(() => isSoundEnabled());

  // Keep soundOn in sync if changed elsewhere
  useEffect(() => {
    const handlePref = (e) => setSoundOn(e.detail?.enabled ?? isSoundEnabled());
    window.addEventListener('sound-preference-changed', handlePref);
    return () => window.removeEventListener('sound-preference-changed', handlePref);
  }, []);

  // File Attachment State
  const [stagedFile, setStagedFile] = useState(null); // { file, previewUrl, isImage, name, size }
  const [isDragging, setIsDragging] = useState(false);

  // Emoji Picker State
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeTab, setActiveTab] = useState('popular');
  const [emojiSearch, setEmojiSearch] = useState('');

  // Lightbox Modal State
  const [lightbox, setLightbox] = useState(null); // { url, name, size }

  const lastId = useRef(0);
  const scroller = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const emojiPickerRef = useRef(null);

  // Close emoji picker on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
    }
    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker]);

  // Clean up object preview URLs when stagedFile changes
  useEffect(() => {
    return () => {
      if (stagedFile?.previewUrl) {
        URL.revokeObjectURL(stagedFile.previewUrl);
      }
    };
  }, [stagedFile]);

  // Polling thread
  useEffect(() => {
    let alive = true;
    let initialLoadDone = false;
    lastId.current = 0;
    setMessages([]);
    setLoading(true);
    const load = async () => {
      try {
        const sep = path.includes('?') ? '&' : '?';
        const d = await api(`${path}${sep}after=${lastId.current}`);
        if (!alive) return;
        if (d.messages?.length) {
          lastId.current = d.messages[d.messages.length - 1].id;
          setMessages((m) => {
            const incoming = d.messages.filter((x) => !m.some((y) => y.id === x.id));
            if (initialLoadDone && incoming.length > 0) {
              const fromOther = incoming.some((msg) => !!msg.is_staff !== mineIsStaff);
              if (fromOther) {
                playReceiveSound();
              }
            }
            return [...m, ...incoming];
          });
          onActivity?.(d);
        }
        initialLoadDone = true;
      } catch {
        /* keep polling */
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    const t = setInterval(() => document.visibilityState === 'visible' && load(), 4000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  const stageFileObject = (file) => {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      toast.error('File exceeds maximum size of 15 MB');
      return;
    }
    const isImg = isImageFile(file.type, file.name);
    const previewUrl = isImg ? URL.createObjectURL(file) : null;
    setStagedFile({
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      isImage: isImg,
      previewUrl,
    });
  };

  const clearStagedFile = () => {
    if (stagedFile?.previewUrl) {
      URL.revokeObjectURL(stagedFile.previewUrl);
    }
    setStagedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      stageFileObject(e.dataTransfer.files[0]);
    }
  };

  // Clipboard image paste
  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            stageFileObject(file);
            toast.success('Screenshot pasted as attachment!');
            break;
          }
        }
      }
    }
  };

  const insertEmoji = (emoji) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setBody((b) => b + emoji);
      return;
    }
    const start = textarea.selectionStart || body.length;
    const end = textarea.selectionEnd || body.length;
    const newText = body.substring(0, start) + emoji + body.substring(end);
    setBody(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
    }, 0);
  };

  const send = async (e) => {
    if (e) e.preventDefault();
    const cleanBody = body.trim();
    if (!cleanBody && !stagedFile) return;

    setSending(true);
    try {
      let attachmentMeta = null;

      // If there's an attached document/image, upload it first
      if (stagedFile) {
        const uploadEndpoint = mineIsStaff ? '/admin/support/upload' : '/support/upload';
        const res = await upload(uploadEndpoint, { file: stagedFile.file });
        attachmentMeta = {
          attachment_path: res.attachment_path,
          attachment_name: res.attachment_name,
          attachment_type: res.attachment_type,
          attachment_size: res.attachment_size,
        };
      }

      const postPath = path.split('?')[0];
      const payload = {
        body: cleanBody,
        ...(attachmentMeta || {}),
      };

      const { message } = await api(postPath, { method: 'POST', body: payload });
      lastId.current = Math.max(lastId.current, message.id);
      setMessages((m) => [...m, message]);
      setBody('');
      clearStagedFile();
      setShowEmojiPicker(false);
      playSendSound();
    } catch (err) {
      toast.error(err);
    } finally {
      setSending(false);
    }
  };

  const copyText = (text, key) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedId(key);
      toast.success(`Copied: ${text}`);
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  // Helper to extract task code from message text
  const extractTaskCode = (text) => {
    const match = text && String(text).match(/\b(TSK-[A-Z0-9]+)\b/i);
    return match ? match[1].toUpperCase() : null;
  };

  return (
    <div
      className={`relative flex flex-col ${height} h-full min-h-0 overflow-hidden bg-ink-950/40`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag & Drop Overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex flex-col items-center justify-center border-2 border-dashed border-green-400 bg-ink-950/90 backdrop-blur-sm p-6 text-center"
          >
            <Paperclip className="h-12 w-12 text-green-400 animate-bounce mb-3" />
            <h4 className="text-lg font-bold text-white">Drop file to attach</h4>
            <p className="text-xs text-zinc-400 mt-1">Images, PDFs, Word docs, spreadsheets, or text files up to 15 MB</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages Thread - internally scrollable */}
      <div ref={scroller} className="flex-1 min-h-0 overflow-y-auto space-y-3 p-4 sm:p-5">
        {loading && (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center text-sm text-zinc-500 py-12">
            <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-green-500/10 text-green-400">
              <MessageSquare className="h-7 w-7" strokeWidth={1.75} />
            </div>
            <div className="font-semibold text-zinc-300">No messages in this conversation yet</div>
            <p className="mt-1 text-xs text-zinc-500 max-w-xs">
              Say hello, share attachments, or ask questions to get direct live assistance.
            </p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((m) => {
            const mine = !!m.is_staff === mineIsStaff;
            const isTradeDispatch = m.body && m.body.includes('[TRADE TASK DISPATCHED]');
            const taskCode = extractTaskCode(m.body);
            const hasAttachment = Boolean(m.attachment_path || m.attachment_name);
            const isImg = hasAttachment && isImageFile(m.attachment_type, m.attachment_name);
            const attachmentUrl = `/api/support/attachment/${m.id}`;

            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={`group flex ${mine ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`relative max-w-[90%] sm:max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-lg ${
                    isTradeDispatch
                      ? 'border border-emerald-500/40 bg-ink-900/95 text-zinc-100'
                      : mine
                      ? 'rounded-br-sm bg-gradient-to-r from-emerald-600 to-green-600 text-white font-normal'
                      : 'rounded-bl-sm border border-white/10 bg-ink-900/90 text-zinc-200 backdrop-blur'
                  }`}
                >
                  {!mine && (
                    <div className="mb-1.5 flex items-center justify-between gap-3 text-[11px] font-semibold text-green-400">
                      <span>{m.is_staff ? (m.sender ? `Support · ${m.sender}` : 'Support Desk') : m.sender || 'Investor'}</span>
                    </div>
                  )}

                  {/* Text Body */}
                  {m.body && <div className="break-words whitespace-pre-wrap leading-relaxed">{m.body}</div>}

                  {/* Attachment Card */}
                  {hasAttachment && (
                    <div className={`${m.body ? 'mt-2.5' : ''}`}>
                      {isImg ? (
                        <div className="group/img relative overflow-hidden rounded-xl border border-white/15 bg-black/40 shadow-inner">
                          <img
                            src={attachmentUrl}
                            alt={m.attachment_name || 'Attached Image'}
                            className="max-h-72 w-full object-cover rounded-xl transition hover:scale-102 cursor-pointer"
                            loading="lazy"
                            onClick={() =>
                              setLightbox({
                                url: attachmentUrl,
                                name: m.attachment_name || 'Image Preview',
                                size: m.attachment_size,
                              })
                            }
                          />
                          <div className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-lg bg-black/75 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur shadow">
                            <Maximize2 className="h-3 w-3" />
                            <span>Preview</span>
                          </div>
                        </div>
                      ) : (
                        <div
                          className={`flex items-center gap-3 rounded-xl p-3 shadow-inner ${
                            mine
                              ? 'border border-black/10 bg-black/10 text-ink-950'
                              : 'border border-white/10 bg-white/[0.04] text-zinc-200'
                          }`}
                        >
                          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-black/20 shadow">
                            {getFileIcon(m.attachment_type, m.attachment_name)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-semibold text-xs leading-tight" title={m.attachment_name}>
                              {m.attachment_name || 'Document File'}
                            </div>
                            <div className={`text-[10px] ${mine ? 'text-ink-950/70' : 'text-zinc-400'}`}>
                              {formatBytes(m.attachment_size)}
                            </div>
                          </div>
                          <a
                            href={`${attachmentUrl}?download=1`}
                            download={m.attachment_name || 'download'}
                            className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold shadow-sm transition ${
                              mine
                                ? 'bg-ink-950 text-green-400 hover:bg-black'
                                : 'bg-green-500/15 text-green-300 hover:bg-green-500/25 border border-green-500/30'
                            }`}
                            title="Download document"
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Download</span>
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Task Activation Code Banner */}
                  {taskCode && (
                    <div className="mt-3 rounded-xl border border-amber-500/30 bg-ink-950/85 p-3 text-left shadow-inner">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 uppercase tracking-wider">
                          <Zap className="h-3.5 w-3.5 text-amber-400 animate-pulse" /> Task Activation Code
                        </div>
                        <span className="rounded bg-amber-500/15 px-2 py-0.5 font-mono text-xs font-bold text-amber-300">
                          {taskCode}
                        </span>
                      </div>

                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => copyText(taskCode, `code-${m.id}`)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-white/15"
                          title="Copy task code"
                        >
                          {copiedId === `code-${m.id}` ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-green-400" />
                              <span className="text-green-300">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5 text-zinc-300" />
                              <span>Copy Code</span>
                            </>
                          )}
                        </button>

                        {!mineIsStaff && (
                          <Link
                            to={`/tasks?code=${taskCode}`}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-green-500 px-2.5 py-1 text-xs font-bold text-ink-950 transition hover:bg-green-400"
                          >
                            <Play className="h-3 w-3 fill-current" /> Activate & Trade
                          </Link>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Message Timestamp & Actions */}
                  <div className="mt-2 flex items-center justify-between gap-3 text-[10px]">
                    <span className={mine ? 'text-ink-950/70' : 'text-zinc-500'}>{dateTime(m.created_at)}</span>
                    <button
                      type="button"
                      onClick={() => copyText(m.body || m.attachment_name || '', `msg-${m.id}`)}
                      className={`inline-flex items-center gap-1 text-[10px] opacity-70 transition hover:opacity-100 ${
                        mine ? 'text-ink-950 hover:text-black' : 'text-zinc-400 hover:text-white'
                      }`}
                      title="Copy text"
                    >
                      <Copy className="h-2.5 w-2.5" />
                      <span>{copiedId === `msg-${m.id}` ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Quick Reaction Bar */}
      <div className="shrink-0 flex items-center gap-1 border-t border-white/5 bg-ink-900/80 px-3 py-1.5 overflow-x-auto scrollbar-none z-10">
        <span className="text-[11px] font-medium text-zinc-500 shrink-0 mr-1 hidden sm:inline">Quick Emojis:</span>
        {QUICK_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => insertEmoji(emoji)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm transition hover:bg-white/10 hover:scale-115 active:scale-95"
            title={`Insert ${emoji}`}
          >
            {emoji}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowEmojiPicker((v) => !v)}
          className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
            showEmojiPicker ? 'bg-green-500/20 text-green-300' : 'text-zinc-400 hover:bg-white/5 hover:text-white'
          }`}
          title="Browse all emojis"
        >
          <Smile className="h-3.5 w-3.5" />
          <span>More</span>
        </button>

        <button
          type="button"
          onClick={() => setSoundOn(toggleSound())}
          className={`ml-auto flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
            soundOn ? 'text-zinc-400 hover:text-white hover:bg-white/5' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
          }`}
          title={soundOn ? 'Sound alerts enabled (Click to mute)' : 'Sound alerts muted (Click to enable)'}
        >
          {soundOn ? <Volume2 className="h-3.5 w-3.5 text-green-400" /> : <VolumeX className="h-3.5 w-3.5 text-zinc-500" />}
          <span className="hidden sm:inline">{soundOn ? 'Sound on' : 'Muted'}</span>
        </button>
      </div>

      {/* Floating Emoji Picker Popover */}
      <AnimatePresence>
        {showEmojiPicker && (
          <motion.div
            ref={emojiPickerRef}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute bottom-16 right-3 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-white/10 bg-ink-900 p-3 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                <Smile className="h-4 w-4 text-green-400" /> Choose Emoji
              </div>
              <button
                type="button"
                onClick={() => setShowEmojiPicker(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Emoji Category Tabs */}
            <div className="mt-2 flex gap-1 overflow-x-auto pb-1 scrollbar-none">
              {EMOJI_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(cat.id);
                    setEmojiSearch('');
                  }}
                  className={`flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition ${
                    activeTab === cat.id
                      ? 'bg-green-500 text-ink-950 font-bold'
                      : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.name}</span>
                </button>
              ))}
            </div>

            {/* Emoji Grid */}
            <div className="mt-2 grid max-h-48 grid-cols-6 gap-1.5 overflow-y-auto p-1">
              {(EMOJI_CATEGORIES.find((c) => c.id === activeTab)?.emojis || []).map((emoji, idx) => (
                <button
                  key={`${emoji}-${idx}`}
                  type="button"
                  onClick={() => insertEmoji(emoji)}
                  className="grid h-10 w-10 place-items-center rounded-xl text-xl transition hover:bg-white/10 hover:scale-120 active:scale-95"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Staged File Preview Chip */}
      <AnimatePresence>
        {stagedFile && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="shrink-0 flex items-center gap-3 border-t border-white/5 bg-ink-900/95 px-4 py-2.5 backdrop-blur z-10"
          >
            {stagedFile.isImage ? (
              <img src={stagedFile.previewUrl} alt="Preview" className="h-10 w-10 rounded-lg object-cover border border-white/10" />
            ) : (
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-white/5 border border-white/10">
                {getFileIcon(stagedFile.type, stagedFile.name)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold text-white">{stagedFile.name}</div>
              <div className="text-[10px] text-zinc-400">{formatBytes(stagedFile.size)} · Ready to upload</div>
            </div>
            <button
              type="button"
              onClick={clearStagedFile}
              className="rounded-lg p-1 text-zinc-400 hover:bg-white/10 hover:text-white transition"
              title="Remove attachment"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input & Controls Form */}
      <form onSubmit={send} className="shrink-0 flex items-end gap-2 border-t border-white/5 bg-ink-950 px-3 py-2.5 z-10">
        {/* Hidden File Inputs */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.zip"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              stageFileObject(e.target.files[0]);
            }
          }}
        />
        <input
          ref={imageInputRef}
          type="file"
          className="hidden"
          accept="image/*"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              stageFileObject(e.target.files[0]);
            }
          }}
        />

        {/* Attachment Buttons */}
        <div className="flex items-center gap-1 pb-1">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-xl p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white active:scale-95"
            title="Attach document or file (PDF, Word, Excel, ZIP)"
          >
            <Paperclip className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className="rounded-xl p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white active:scale-95"
            title="Attach picture or screenshot"
          >
            <ImageIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setShowEmojiPicker((v) => !v)}
            className={`rounded-xl p-2 transition active:scale-95 ${
              showEmojiPicker ? 'bg-green-500/20 text-green-300' : 'text-zinc-400 hover:bg-white/5 hover:text-white'
            }`}
            title="Add emojis"
          >
            <Smile className="h-5 w-5" />
          </button>
        </div>

        {/* Text Area */}
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            className="input max-h-32 min-h-11 w-full resize-none py-2.5 px-3 text-sm leading-relaxed"
            rows={1}
            placeholder={stagedFile ? 'Add an optional message…' : placeholder}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
        </div>

        {/* Send Button */}
        <button
          type="submit"
          className="btn btn-primary !h-11 !px-4 shadow-lg active:scale-95"
          disabled={sending || (!body.trim() && !stagedFile)}
          aria-label="Send message"
        >
          {sending ? (
            <Spinner className="!text-ink-950" />
          ) : (
            <div className="flex items-center gap-1 font-semibold">
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">Send</span>
            </div>
          )}
        </button>
      </form>

      {/* Lightbox Modal for Full Image Viewing */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md"
            onClick={() => setLightbox(null)}
          >
            <div className="relative max-h-[92vh] max-w-4xl overflow-hidden rounded-2xl bg-ink-950 p-2 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
                <div className="min-w-0 pr-4">
                  <h4 className="truncate font-semibold text-white text-sm">{lightbox.name}</h4>
                  <div className="text-[10px] text-zinc-400">{formatBytes(lightbox.size)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`${lightbox.url}?download=1`}
                    download={lightbox.name}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-green-500 px-3 py-1.5 text-xs font-bold text-ink-950 hover:bg-green-400 transition"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => setLightbox(null)}
                    className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-center p-2">
                <img src={lightbox.url} alt={lightbox.name} className="max-h-[75vh] max-w-full rounded-xl object-contain shadow-2xl" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
