import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, ShieldCheck, RotateCcw, Minimize2, History, Trash2, Plus, MessageSquare, ChevronLeft } from 'lucide-react';
import { Mascot } from 'page-mascot';
import { CoucouMochi } from './coucou-mochi';
import MarkdownView from './ui/markdown-view';
import { useSession } from '../api/auth';
import { Logo } from './ui/logo';

interface ChatMessage {
  id_pesan_obrolan: string;
  pengirim: 'USER' | 'AI';
  teks: string;
  tanggal_dibuat: string;
}

interface ChatSession {
  id_sesi_obrolan: string;
  judul_sesi: string;
  id_laporan: string | null;
  tanggal_diperbarui?: string;
  _count?: {
    pesan_obrolan: number;
  };
  pesan_obrolan?: ChatMessage[];
  laporan?: {
    id_laporan: string;
    nama_mahasiswa: string;
    nim: string;
  } | null;
}

interface ChatbotProps {
  idLaporan?: string | null;
  namaMahasiswa?: string;
  onSelectHighlight?: (id: string) => void;
  title?: string;
  subtitle?: string;
}

export default function Chatbot({ 
  idLaporan = null, 
  namaMahasiswa = 'Pengguna', 
  onSelectHighlight,
  title = 'Veritas Copilot',
  subtitle
}: ChatbotProps) {
  const queryClient = useQueryClient();
  const { data: sessionData } = useSession();
  const userId = sessionData?.user?.id;

  const [isOpen, setIsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const backendUrl = import.meta.env.VITE_API_BACKEND_URL || '';

  // Deteksi kehadiran dan status buka Side Drawer (agar maskot tidak menabrak tombol/konten drawer)
  const [isSideDrawerOpen, setIsSideDrawerOpen] = useState(false);

  useEffect(() => {
    const updateDrawerState = () => {
      const hasDrawerOpen = 
        document.body.classList.contains('drawer-open') ||
        document.body.getAttribute('data-drawer-open') === 'true' ||
        document.querySelector('[data-side-drawer="true"]') !== null;
      setIsSideDrawerOpen(hasDrawerOpen);
    };

    const handleDrawerEvent = (e: any) => {
      if (e.detail && typeof e.detail.open === 'boolean') {
        setIsSideDrawerOpen(e.detail.open);
      } else {
        updateDrawerState();
      }
    };

    window.addEventListener('drawer-state-change', handleDrawerEvent);
    const observer = new MutationObserver(updateDrawerState);
    observer.observe(document.body, { attributes: true, childList: true, subtree: true });
    updateDrawerState();

    return () => {
      window.removeEventListener('drawer-state-change', handleDrawerEvent);
      observer.disconnect();
    };
  }, []);

  // Reset sesi obrolan saat akun pengguna berganti (Strict Per-User Isolation)
  useEffect(() => {
    setSessionId(null);
    setIsHistoryOpen(false);
  }, [userId]);

  // Auto-scroll chat area ke bawah saat ada pesan baru atau drawer dibuka
  useEffect(() => {
    if (!isHistoryOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [sessionId, isOpen, isHistoryOpen]);

  // Format waktu pesan
  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  // Format tanggal riwayat sesi
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  // Kueri mencari daftar sesi obrolan khusus milik pengguna aktif
  const { data: sessions, isLoading: isLoadingSessions } = useQuery<ChatSession[]>({
    queryKey: ['chatSessions', userId],
    queryFn: async () => {
      const res = await fetch(`${backendUrl}/api/chatbot/sessions`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Gagal memuat sesi obrolan.');
      return res.json();
    },
    enabled: isOpen && !!userId,
  });

  // Mutasi untuk membuat sesi obrolan baru
  const createSessionMutation = useMutation({
    mutationFn: async () => {
      const defaultTitle = idLaporan 
        ? `Diskusi Laporan - ${namaMahasiswa}` 
        : `Konsultasi Analitik Eksekutif`;

      const res = await fetch(`${backendUrl}/api/chatbot/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          judul_sesi: defaultTitle,
          id_laporan: idLaporan || null,
        }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Gagal membuat sesi obrolan baru.');
      return res.json();
    },
    onSuccess: (data) => {
      setSessionId(data.id_sesi_obrolan);
      setIsHistoryOpen(false);
      queryClient.invalidateQueries({ queryKey: ['chatSessions', userId] });
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Gagal membuat sesi obrolan.');
    }
  });

  // Mutasi untuk menghapus sesi obrolan milik pengguna aktif
  const deleteSessionMutation = useMutation({
    mutationFn: async (targetSessionId: string) => {
      const res = await fetch(`${backendUrl}/api/chatbot/sessions/${targetSessionId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Gagal menghapus sesi obrolan.');
      return res.json();
    },
    onSuccess: (_, targetSessionId) => {
      if (sessionId === targetSessionId) {
        setSessionId(null);
      }
      queryClient.invalidateQueries({ queryKey: ['chatSessions', userId] });
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Gagal menghapus sesi obrolan.');
    }
  });

  // Reaktif mencari atau memilih sesi saat modal dibuka
  useEffect(() => {
    if (isOpen && sessions && userId) {
      if (!sessionId) {
        const matched = sessions.find((s) => (idLaporan ? s.id_laporan === idLaporan : s.id_laporan === null));
        if (matched) {
          setSessionId(matched.id_sesi_obrolan);
        }
      }
    }
  }, [isOpen, sessions, idLaporan, userId, sessionId]);

  // Kueri memuat detail pesan sesi terpilih (diikat ketat dengan userId)
  const { data: activeSession, isLoading: isLoadingMessages } = useQuery<ChatSession>({
    queryKey: ['sessionMessages', userId, sessionId],
    queryFn: async () => {
      const res = await fetch(`${backendUrl}/api/chatbot/sessions/${sessionId}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Gagal memuat pesan.');
      return res.json();
    },
    enabled: !!sessionId && isOpen && !!userId,
  });

  // Mutasi mengirim pesan baru dengan auto-initialization sesi
  const sendMessageMutation = useMutation({
    mutationFn: async (teks: string) => {
      let activeId = sessionId;

      // Jika sessionId belum ada, buat sesi obrolan terlebih dahulu
      if (!activeId) {
        const autoTitle = idLaporan 
          ? `Diskusi Laporan - ${namaMahasiswa}` 
          : (teks.trim().length > 35 ? teks.trim().slice(0, 32) + '...' : teks.trim());

        const sRes = await fetch(`${backendUrl}/api/chatbot/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            judul_sesi: autoTitle,
            id_laporan: idLaporan || null,
          }),
          credentials: 'include',
        });
        if (sRes.ok) {
          const sData = await sRes.json();
          activeId = sData.id_sesi_obrolan;
          setSessionId(activeId);
        }
      }

      const res = await fetch(`${backendUrl}/api/chatbot/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_sesi_obrolan: activeId || null,
          teks,
          id_laporan: idLaporan || null,
        }),
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengirim pesan.');
      }
      return {
        data,
        newSessionId: data.id_sesi_obrolan || activeId
      };
    },
    onSuccess: (result) => {
      if (result.newSessionId) {
        setSessionId(result.newSessionId);
        queryClient.invalidateQueries({ queryKey: ['sessionMessages', userId, result.newSessionId] });
      }
      queryClient.invalidateQueries({ queryKey: ['chatSessions', userId] });
      setInputText('');
      setErrorMsg('');
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Gagal mengirim pesan.');
    },
  });

  const handleSend = (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const textToSend = customText || inputText;
    if (!textToSend.trim() || sendMessageMutation.isPending) return;
    sendMessageMutation.mutate(textToSend);
  };

  const activeSubtitle = subtitle || (idLaporan ? `Diskusi naskah: ${namaMahasiswa}` : 'Asisten AI Orisinalitas STITEK');

  const quickPrompts = idLaporan
    ? [
        'Apakah ada indikasi plagiarisme signifikan?',
        'Jelaskan kesamaan segmen teks tertinggi',
        'Bandingkan gambar grafik hasil praktikum',
      ]
    : [
        'Bagaimana rekapitulasi orisinalitas per prodi?',
        'Laporan mana yang memerlukan evaluasi khusus?',
        'Jelaskan formula Hybrid RRF dan bobotnya',
      ];

  const hasMessages = activeSession?.pesan_obrolan && activeSession.pesan_obrolan.length > 0;

  return (
    <>
      {/* 1. ROOM CHAT PANEL (Berada persis di atas maskot, otomatis bergeser jika drawer samping terbuka) */}
      {isOpen && (
        <div 
          className={`fixed bottom-[148px] z-[70] w-[calc(100vw-32px)] sm:w-[410px] h-[min(510px,calc(100vh-165px))] max-h-[calc(100vh-165px)] bg-white border border-slate-200/90 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150 font-sans select-none transition-all duration-300 ${
            isSideDrawerOpen ? 'right-5 md:right-[464px] max-md:hidden' : 'right-5'
          }`}
          role="dialog"
          aria-label="Ruang Percakapan Veritas Copilot"
        >
          {/* Header Room Chat Presisi Akademik (Tanpa Avatar/PP) */}
          <div className="px-4 py-3 bg-[#0D1B2A] border-b border-slate-800 flex justify-between items-center shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <Logo size={16} variant="brass" />
                <h3 className="text-xs font-semibold text-slate-100 uppercase tracking-wider">{title}</h3>
                <span className="w-2 h-2 rounded-full bg-[#415A77]/100 inline-block shadow-xs" title="Layanan AI Aktif" />
              </div>
              <p className="text-[10.5px] text-slate-400 truncate max-w-[210px] mt-0.5">
                {activeSubtitle}
              </p>
            </div>

            <div className="flex items-center gap-1">
              {/* Tombol Riwayat Sesi Obrolan Terisolasi Per-Pengguna */}
              <button
                type="button"
                onClick={() => setIsHistoryOpen(prev => !prev)}
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                  isHistoryOpen 
                    ? 'bg-[#0D1B2A] text-[#F7F3E9]' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title="Lihat riwayat obrolan Anda"
                aria-label="Riwayat obrolan Anda"
              >
                <History className="w-3.5 h-3.5" />
              </button>

              {/* Tombol Buat Sesi Bersih Baru */}
              <button
                type="button"
                onClick={() => {
                  createSessionMutation.mutate();
                  setIsHistoryOpen(false);
                }}
                disabled={createSessionMutation.isPending}
                className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
                title="Mulai obrolan baru"
                aria-label="Mulai obrolan baru"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${createSessionMutation.isPending ? 'animate-spin' : ''}`} />
              </button>

              {/* Tombol Perkecil / Tutup */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
                title="Perkecil ruang obrolan"
                aria-label="Tutup panel obrolan"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* KONTEN UTAMA: PANEL RIWAYAT ATAU CANVAS PERCAKAPAN */}
          {isHistoryOpen ? (
            /* 1.1 PANEL RIWAYAT OBROLAN PENGGUNA TERISOLASI */
            <div className="flex-1 p-3.5 overflow-y-auto space-y-2.5 bg-[#F8FAFC]">
              <div className="flex items-center justify-between pb-1 border-b border-slate-200/80">
                <div>
                  <h4 className="text-xs font-bold text-[#0D1B2A] flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-[#8C6D1F]" />
                    <span>Riwayat Obrolan Anda</span>
                  </h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {sessions && sessions.length > 0 
                      ? `${sessions.length} sesi tersimpan khusus akun ini`
                      : 'Belum ada riwayat sesi'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => createSessionMutation.mutate()}
                  disabled={createSessionMutation.isPending}
                  className="px-2.5 py-1 bg-[#0D1B2A] hover:bg-[#1B2B3E] text-white rounded-md text-[10.5px] font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                  title="Mulai sesi obrolan baru"
                >
                  <Plus className="w-3 h-3" />
                  <span>Sesi Baru</span>
                </button>
              </div>

              {/* Daftar Sesi Terisolasi */}
              {isLoadingSessions ? (
                <div className="flex items-center justify-center py-8 text-xs text-slate-500 gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse" />
                  <span>Memuat riwayat obrolan...</span>
                </div>
              ) : !sessions || sessions.length === 0 ? (
                <div className="text-center py-8 px-4 bg-white border border-slate-200/80 rounded-xl">
                  <MessageSquare className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-700">Belum ada riwayat obrolan</p>
                  <p className="text-[10.5px] text-slate-400 mt-1">Sesi obrolan baru Anda akan otomatis tercatat dan tersimpan secara privat.</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {sessions.map((sesi) => {
                    const isActive = sesi.id_sesi_obrolan === sessionId;
                    const msgCount = sesi._count?.pesan_obrolan ?? (sesi.pesan_obrolan?.length || 0);

                    return (
                      <div
                        key={sesi.id_sesi_obrolan}
                        className={`p-2.5 rounded-xl border transition-all flex items-start justify-between gap-2 group cursor-pointer ${
                          isActive
                            ? 'bg-[#415A77]/10/70 border-[#415A77]/35 shadow-2xs'
                            : 'bg-white hover:bg-slate-50 border-slate-200/80 hover:border-slate-300'
                        }`}
                        onClick={() => {
                          setSessionId(sesi.id_sesi_obrolan);
                          setIsHistoryOpen(false);
                        }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {isActive && (
                              <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] shrink-0" />
                            )}
                            <h5 className={`text-xs font-semibold truncate ${isActive ? 'text-[#0D1B2A] font-bold' : 'text-slate-800'}`}>
                              {sesi.judul_sesi}
                            </h5>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 font-mono">
                            <span>{formatDate(sesi.tanggal_diperbarui)}</span>
                            <span>•</span>
                            <span>{msgCount} pesan</span>
                            {sesi.id_laporan && (
                              <>
                                <span>•</span>
                                <span className="text-[#0D1B2A] font-sans font-medium">Laporan</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => deleteSessionMutation.mutate(sesi.id_sesi_obrolan)}
                            disabled={deleteSessionMutation.isPending}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer opacity-80 group-hover:opacity-100"
                            title="Hapus sesi ini"
                            aria-label="Hapus sesi"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* 1.2 CANVAS PERCAKAPAN AKTIF (Tanpa Avatar/PP, Spasi Terstruktur) */
            <div className="flex-1 p-3.5 overflow-y-auto space-y-3 bg-[#F8FAFC]">
              {isLoadingMessages && !activeSession ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-2 py-8">
                  <span className="w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse" />
                  <span className="text-xs font-medium text-slate-600">Menghubungkan ke basis data asisten...</span>
                </div>
              ) : !hasMessages ? (
                /* State Kosong Bersih dengan Kartu Pemandu & Saran Cepat */
                <div className="flex flex-col items-center justify-center py-5 px-3 text-center">
                  <Logo size={42} className="mb-2.5" />
                  <h4 className="text-xs font-bold text-[#0D1B2A] tracking-tight">Veritas AI Copilot</h4>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-[280px] leading-relaxed">
                    {idLaporan 
                      ? `Pendampingan evaluasi orisinalitas naskah mahasiswa ${namaMahasiswa}.`
                      : 'Asisten analitik integritas akademik & deteksi orisinalitas laporan STITEK Bontang.'}
                  </p>

                  {/* Kartu Saran Pertanyaan Awal */}
                  <div className="w-full mt-4 space-y-1.5 text-left">
                    <p className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider px-1">Pertanyaan yang disarankan:</p>
                    {quickPrompts.map((prompt, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSend(undefined, prompt)}
                        disabled={sendMessageMutation.isPending}
                        className="w-full p-2.5 bg-white hover:bg-[#415A77]/10/50 text-slate-700 hover:text-[#0D1B2A] border border-slate-200/90 hover:border-[#415A77]/35 rounded-lg text-xs font-medium transition-all text-left flex items-center justify-between group cursor-pointer shadow-2xs"
                      >
                        <span className="truncate pr-2">{prompt}</span>
                        <span className="text-slate-400 group-hover:text-[#0D1B2A] transition-colors text-xs font-semibold">→</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {/* Riwayat Balon Percakapan */}
                  {activeSession?.pesan_obrolan?.map((msg) => {
                    const isUser = msg.pengirim === 'USER';
                    const isFallbackError = !isUser && msg.teks.includes('AI Service tidak merespons: Unable to connect');

                    return (
                      <div
                        key={msg.id_pesan_obrolan}
                        className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                      >
                        {isUser ? (
                          /* Balon Pengguna: Navy Gelap #0D1B2A, Sudut Rapi rounded-tr-xs */
                          <div className="flex flex-col items-end max-w-[85%] pl-6">
                            <div className="bg-[#0D1B2A] text-slate-50 rounded-2xl rounded-tr-xs px-3.5 py-2 text-[12.5px] leading-relaxed shadow-2xs break-words">
                              <p className="whitespace-pre-wrap">{msg.teks}</p>
                            </div>
                            <span className="text-[9px] text-slate-400 mt-0.5 pr-1 font-mono">
                              {formatTime(msg.tanggal_dibuat)}
                            </span>
                          </div>
                        ) : (
                          /* Balon AI: Kartu Putih Bersih dengan Header Halus */
                          <div className="flex flex-col items-start w-full max-w-[94%] pr-2">
                            <div className="flex items-center gap-1.5 mb-1 pl-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#415A77]/100" />
                              <span className="text-[10px] font-semibold text-slate-700">Veritas AI</span>
                              <span className="text-[9px] text-slate-400 font-mono">• {formatTime(msg.tanggal_dibuat)}</span>
                            </div>

                            <div className="w-full bg-white border border-slate-200/90 rounded-2xl rounded-tl-xs p-3 text-[12px] text-slate-800 leading-relaxed shadow-2xs overflow-hidden">
                              {isFallbackError ? (
                                <div className="space-y-2">
                                  <div className="p-2.5 rounded-md bg-amber-50/80 border border-amber-200 text-amber-900 text-xs">
                                    <p className="font-semibold text-[11px] text-amber-900 flex items-center gap-1">
                                      <span>Catatan Koneksi Sesi Sebelumnya</span>
                                    </p>
                                    <p className="text-[10.5px] text-amber-800 mt-1 leading-relaxed">{msg.teks}</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => createSessionMutation.mutate()}
                                    className="text-[11px] font-semibold text-[#0D1B2A] hover:text-[#0D1B2A] hover:underline cursor-pointer flex items-center gap-1"
                                  >
                                    <span>Mulai Sesi Bersih Baru</span>
                                    <span>→</span>
                                  </button>
                                </div>
                              ) : (
                                <MarkdownView content={msg.teks} onSelectHighlight={onSelectHighlight} />
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Indikator Penalaran Mengetik (Minimalis, Tenang) */}
                  {sendMessageMutation.isPending && (
                    <div className="flex justify-start items-center gap-2 pl-1 animate-in fade-in duration-150">
                      <div className="bg-white border border-slate-200 rounded-xl rounded-tl-xs px-3 py-1.5 text-xs text-slate-600 shadow-2xs flex items-center gap-2">
                        <span className="flex gap-1 items-center">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
                        </span>
                        <span className="text-[10.5px] font-medium text-[#0D1B2A]">Menalar basis data analitik...</span>
                      </div>
                    </div>
                  )}

                  <div ref={chatEndRef} />
                </>
              )}
            </div>
          )}

          {/* FOOTER: JIKA HISTORY TERBUKA, TAMPILKAN TOMBOL KEMBALI; JIKA CHAT, TAMPILKAN SARAN & FORM INPUT */}
          {isHistoryOpen ? (
            <div className="p-2.5 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setIsHistoryOpen(false)}
                className="text-xs font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1 px-2.5 py-1 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Kembali ke obrolan</span>
              </button>
              <span className="text-[10px] text-slate-400 font-mono pr-1">Veritas AI Copilot</span>
            </div>
          ) : (
            <>
              {/* Saran Cepat Pertanyaan (Rail Horizontal Kompak - BEBAS DARI SCROLLBAR KASAR) */}
              {hasMessages && (
                <div 
                  className="px-3 py-1.5 bg-slate-50 border-t border-slate-200/70 flex items-center gap-1.5 overflow-x-auto shrink-0 select-none [&::-webkit-scrollbar]:hidden"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                  <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap pl-0.5 shrink-0">
                    Saran:
                  </span>
                  {quickPrompts.map((prompt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSend(undefined, prompt)}
                      disabled={sendMessageMutation.isPending}
                      className="text-[10.5px] font-medium text-slate-600 hover:text-[#0D1B2A] bg-white hover:bg-[#415A77]/10 hover:border-[#415A77]/35 border border-slate-200 px-2.5 py-0.5 rounded-full transition-all whitespace-nowrap cursor-pointer shrink-0 shadow-2xs disabled:opacity-50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}

              {/* Banner Galat Fungsional */}
              {errorMsg && (
                <div className="px-3 py-1.5 bg-rose-50 border-t border-rose-200 text-rose-700 text-[10.5px] font-medium">
                  {errorMsg}
                </div>
              )}

              {/* Formulir Input Pesan Obrolan (Tinggi Proporsional, Bebas Potongan) */}
              <form onSubmit={handleSend} className="p-2 sm:p-2.5 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0">
                <input
                  type="text"
                  placeholder={idLaporan ? "Tanyakan perihal laporan ini..." : "Tanyakan analitik orisinalitas..."}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  disabled={sendMessageMutation.isPending}
                  className="flex-1 h-9 px-3 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:border-transparent focus-visible:outline-none transition-all shadow-2xs"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim() || sendMessageMutation.isPending}
                  className="h-9 px-3 bg-[#0D1B2A] hover:bg-[#1B2B3E] active:bg-[#070F18] text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer shadow-2xs focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-1"
                  title="Kirim pesan"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </>
          )}
        </div>
      )}

      {/* 2. BUBBLE CHAT CTA DENGAN 3 DOT DARI MASKOT (Tampil tepat di atas maskot saat obrolan tertutup) */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`fixed bottom-[140px] z-[70] bg-[#0D1B2A] hover:bg-slate-800 text-white text-xs font-medium px-3.5 py-1.5 rounded-full shadow-xl border border-slate-700 flex items-center gap-2 cursor-pointer transition-all duration-300 transform hover:scale-105 active:scale-95 select-none animate-in fade-in slide-in-from-bottom-1 ${
            isSideDrawerOpen ? 'right-5 md:right-[464px] max-md:hidden' : 'right-5'
          }`}
          title="Buka ruang obrolan"
        >
          {/* 3 Dot Indikator Pesan */}
          <span className="flex gap-1 items-center">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
            <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
            <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
          </span>
          <span>{isSideDrawerOpen ? 'Tanya Veritas AI' : 'Tanya Veritas AI'}</span>
        </button>
      )}

      {/* 3. MASKOT MOCHI INTERAKTIF 60FPS (UKURAN 135px, OTOMATIS BERGESER RAMPING SAAT DRAWER TERBUKA) */}
      <div 
        className={`fixed bottom-3 z-[70] cursor-pointer transition-all duration-300 active:scale-95 filter drop-shadow-xl select-none ${
          isSideDrawerOpen ? 'right-5 md:right-[464px] max-md:hidden' : 'right-5'
        }`}
        title={isOpen ? "Klik maskot untuk menutup obrolan" : "Klik maskot untuk membuka obrolan"}
      >
        <CoucouMochi
          size={135}
          label="Maskot Mochi Veritas AI STITEK Bontang"
          onClick={() => setIsOpen(prev => !prev)}
        />

        {/* Titik Indikator Status Online AI */}
        <span 
          className="absolute bottom-2.5 right-2.5 w-3.5 h-3.5 rounded-full bg-[#415A77]/100 border-2 border-white shadow-xs pointer-events-none" 
          title="Veritas AI Online"
        />
      </div>
    </>
  );
}
