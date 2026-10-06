import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ReactFlow, 
  MiniMap, 
  Controls, 
  Background, 
  useNodesState, 
  useEdgesState, 
  Position, 
  MarkerType,
  getSmoothStepPath,
  BaseEdge,
  Handle
} from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import { 
  Upload, 
  FileText, 
  Scissors, 
  Search, 
  BrainCircuit, 
  Database, 
  Filter, 
  Sigma, 
  X,
  Layers,
  Cpu,
  Workflow,
  Network,
  CheckCircle,
  UserCheck,
  ShieldAlert,
  Sliders
} from 'lucide-react';
import PageHeader from '../../components/ui/page-header';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';

// Dagre Layout Helper
const getLayoutedElements = (nodes: any[], edges: any[], direction = 'LR') => {
  const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  const isHorizontal = direction === 'LR';
  
  g.setGraph({ 
    rankdir: direction, 
    nodesep: isHorizontal ? 65 : 60, 
    ranksep: isHorizontal ? 190 : 90,
  });

  nodes.forEach((node) => {
    // Optimized standard node dimensions for Dagre layout engine
    g.setNode(node.id, { width: 240, height: 90 });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  return {
    nodes: nodes.map((node) => {
      const nodeWithPosition = g.node(node.id);
      return {
        ...node,
        targetPosition: isHorizontal ? Position.Left : Position.Top,
        sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
        position: {
          x: nodeWithPosition.x - 120,
          y: nodeWithPosition.y - 45,
        },
      };
    }),
    edges,
  };
};

// Custom Edge Component (With moving particle)
const AnimatedDataEdge = ({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd }: any) => {
  const [path] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge id={id} path={path} style={{ stroke: '#94A3B8', strokeWidth: 1.5, opacity: 0.6, ...style }} markerEnd={markerEnd} />
      <circle r="3.5" fill="#D4AF37">
        <animateMotion dur="2.2s" repeatCount="indefinite" path={path} />
      </circle>
    </>
  );
};

// Custom Node Component
const CustomDagNode = ({ data, selected, targetPosition, sourcePosition }: any) => {
  const Icon = data.icon;
  
  // Dynamic border categories matching STITEK design token colors
  let categoryClass = 'border-slate-200';
  if (data.category === 'input') categoryClass = 'border-l-4 border-l-[#415A77]';
  else if (data.category === 'search') categoryClass = 'border-l-4 border-l-amber-500';
  else if (data.category === 'ai') categoryClass = 'border-l-4 border-l-[#D4AF37] dag-node--ai';
  else if (data.category === 'storage') categoryClass = 'border-l-4 border-l-cyan-600';
  else if (data.category === 'output') categoryClass = 'border-l-4 border-l-[#0D1B2A]';
  else if (data.category === 'symbolic') categoryClass = 'border-l-4 border-l-amber-600';
  else if (data.category === 'neural') categoryClass = 'border-l-4 border-l-[#D4AF37]';
  else if (data.category === 'aggregation') categoryClass = 'border-l-4 border-l-[#D4AF37]';
  else if (data.category === 'terminal') categoryClass = 'bg-[#0D1B2A] text-white border-[#0D1B2A]';

  const isSimActive = data.isSimActive;
  const simGlow = isSimActive 
    ? 'ring-2 ring-[#D4AF37] ring-offset-2 shadow-xs border-[#D4AF37] bg-[#415A77]/10' 
    : '';

  return (
    <div className={`dag-node ${categoryClass} ${selected ? 'selected' : ''} ${simGlow}`}>
      {targetPosition && (
        <Handle 
          type="target" 
          position={targetPosition} 
          style={{ background: '#0D1B2A', width: 8, height: 8 }} 
        />
      )}
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-md flex-shrink-0 ${data.category === 'terminal' ? 'bg-white/10 text-white' : 'bg-[#0D1B2A]/5 text-[#0D1B2A]'}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold truncate leading-tight">{data.label}</p>
          <p className="text-[10px] text-muted-foreground truncate mt-0.5 leading-none">{data.desc}</p>
        </div>
      </div>
      {sourcePosition && (
        <Handle 
          type="source" 
          position={sourcePosition} 
          style={{ background: '#D4AF37', width: 8, height: 8 }} 
        />
      )}
    </div>
  );
};

const customNodeTypes = {
  custom: CustomDagNode,
};

const edgeTypes = {
  animated: AnimatedDataEdge,
};

export default function AiPerformance() {
  const [selectedNode, setSelectedNode] = useState<any>(null);

  // 1. Dataset Pipeline Analisis Dokumen End-to-End (Non-Linear RAG + HITL Flow)
  const pipelineRawNodes = [
    {
      id: 'n_upload',
      type: 'custom',
      data: {
        label: '1. Unggah PDF',
        desc: 'Form input berkas laporan',
        icon: Upload,
        category: 'input',
        technicalDetails: {
          'Modul Pengampu': 'Formulir Checker Aslab (/aslab/checker)',
          'Validasi Ekstensi': 'PDF (.pdf) saja',
          'Alur Kontrol': 'Membatasi request OCR/Embedding berat maksimal 2 proses asinkron bersamaan menggunakan Semaphore VRAM Protection.'
        }
      }
    },
    {
      id: 'n_parser',
      type: 'custom',
      data: {
        label: '2. Document Parser',
        desc: 'PyMuPDF + EasyOCR Fallback',
        icon: FileText,
        category: 'process',
        technicalDetails: {
          'Ekstrasi Digital': 'PyMuPDF (fitz) mengekstrak teks digital & geometri kata.',
          'Fallback OCR': 'Mendeteksi berkas hasil scan secara otomatis jika jumlah karakter teks digital <= 50.',
          'Mesin OCR': 'EasyOCR (bahasa: Bahasa Indonesia & Inggris) pada frame gambar resolusi tinggi (DPI 150) yang dinormalisasi ke standar PDF points (72 DPI).',
          'Visual Parser': 'Mengekstrak berkas gambar pendukung praktikum yang berdimensi >= 150px.'
        }
      }
    },
    {
      id: 'n_chunking',
      type: 'custom',
      data: {
        label: '3. Text Chunker',
        desc: 'Word geometry grouping',
        icon: Scissors,
        category: 'process',
        technicalDetails: {
          'Algoritma': 'TextChunker.chunk_page_words()',
          'Ukuran Chunk': 'Maksimal 250 kata per chunk',
          'Pencocokan Overlap': '50 kata overlap untuk redundansi kontekstrak kalimat',
          'Output Geometri': 'Menghitung bounding box koordinat (outer boundary) gabungan dari koordinat spasial kata.'
        }
      }
    },
    {
      id: 'n_search',
      type: 'custom',
      data: {
        label: '4. Hybrid Searcher',
        desc: 'Dense (SBERT) + Sparse (BM25)',
        icon: Search,
        category: 'search',
        technicalDetails: {
          'Pencarian Dense (Semantik)': 'Menggunakan embedding model SBERT "intfloat/multilingual-e5-base" untuk menangkap konteks parafrase.',
          'Pencarian Sparse (Kunci)': 'Feature hashing kata (MD5) deterministik 1 juta dimensi dipadukan dengan BM25 Term Frequency saturation scaling.',
          'Penggabungan RRF': 'Mengintegrasikan peringkat Dense & Sparse dengan Reciprocal Rank Fusion (RRF) formula k = 60 untuk akurasi optimal.'
        }
      }
    },
    {
      id: 'n_langgraph',
      type: 'custom',
      data: {
        label: '5. LangGraph Decision',
        desc: 'Neuro-Symbolic Decision',
        icon: BrainCircuit,
        category: 'ai',
        technicalDetails: {
          'Pipa Keputusan': 'Menjalankan workflow grafik keputusan 3 node (Filter Templates -> Verify Plagiarism -> Generate Feedback) menggunakan LangGraph.',
          'Pengawasan Keamanan': 'Melindungi model dari data poisoning & menjaga agar model Ollama lokal memproses chunk yang relevan saja.'
        }
      }
    },
    {
      id: 'n_hitl',
      type: 'custom',
      data: {
        label: '6. Review Aslab (HITL)',
        desc: 'Human-in-the-Loop Validation',
        icon: UserCheck,
        category: 'neural',
        technicalDetails: {
          'Status Awal': 'Dokumen berstatus PENDING di database relasional setelah diproses AI.',
          'Intervensi Aslab': 'Aslab meninjau manual skor plagiarisme AI, memverifikasi kecocokan teks/gambar, dan dapat melakukan koreksi nilai.',
          'Branching Aksi': 'Aksi Aslab menentukan apakah dokumen diindeks untuk masa depan atau ditolak/koreksi.'
        }
      }
    },
    {
      id: 'n_rejection',
      type: 'custom',
      data: {
        label: 'Dokumen Ditolak',
        desc: 'Terdeteksi Plagiat / Koreksi',
        icon: ShieldAlert,
        category: 'terminal',
        technicalDetails: {
          'Kondisi': 'Jika Aslab menandai laporan sebagai tidak sah/plagiat.',
          'Konsekuensi': 'Dokumen tidak diindeks ke Supabase pgvector untuk melindungi database dari kontaminasi data plagiat (Data Poisoning Protection).'
        }
      }
    },
    {
      id: 'n_pgvector',
      type: 'custom',
      data: {
        label: '7. Supabase pgvector Indexer',
        desc: 'Vector Database Upsert',
        icon: Database,
        category: 'storage',
        technicalDetails: {
          'Kondisi': 'Skor orisinalitas > 75% AND Apakah Diverifikasi = True oleh Aslab.',
          'Vektor Teks': 'Mengindeks dense vector (768-dim) ke tabel "laporan_text_vectors".',
          'Vektor Gambar': 'Mengekstrak visual feature 512 dimensi via CLIP ViT-B/32 dan mengindeksnya ke tabel "laporan_image_vectors".'
        }
      }
    },
    {
      id: 'n_finetuner',
      type: 'custom',
      data: {
        label: '8. SBERT Fine-Tuner',
        desc: 'Closed-Loop Model Learning',
        icon: Sliders,
        category: 'ai',
        technicalDetails: {
          'Pemicu': 'Dijalankan oleh Admin secara berkala untuk memperbarui model semantik SBERT.',
          'Data Training': 'Menarik seluruh chunk teks laporan orisinal terverifikasi (>75% orisinalitas, diverifikasi = True) dari database Supabase.',
          'Drift Protection': 'Melatih ulang model menggunakan SimCSE MultipleNegativesRankingLoss untuk meminimalisasi semantic drift.',
          'Hot-Swapping': 'Memuat bobot model baru langsung ke runtime memori (TextEmbedder singleton) tanpa me-restart server.'
        }
      }
    }
  ];

  const pipelineRawEdges = [
    { id: 'pe_u_p', source: 'n_upload', target: 'n_parser', type: 'animated', markerEnd: { type: MarkerType.ArrowClosed, color: '#64748B' } },
    { id: 'pe_p_c', source: 'n_parser', target: 'n_chunking', type: 'animated', markerEnd: { type: MarkerType.ArrowClosed, color: '#64748B' } },
    { id: 'pe_c_s', source: 'n_chunking', target: 'n_search', type: 'animated', markerEnd: { type: MarkerType.ArrowClosed, color: '#64748B' } },
    { id: 'pe_s_l', source: 'n_search', target: 'n_langgraph', type: 'animated', markerEnd: { type: MarkerType.ArrowClosed, color: '#64748B' } },
    { id: 'pe_l_h', source: 'n_langgraph', target: 'n_hitl', type: 'animated', markerEnd: { type: MarkerType.ArrowClosed, color: '#64748B' } },
    
    // HITL Branching
    { id: 'pe_h_r', source: 'n_hitl', target: 'n_rejection', type: 'animated', style: { stroke: '#E11D48' }, markerEnd: { type: MarkerType.ArrowClosed, color: '#E11D48' } },
    { id: 'pe_h_q', source: 'n_hitl', target: 'n_pgvector', type: 'animated', style: { stroke: '#16A34A' }, markerEnd: { type: MarkerType.ArrowClosed, color: '#16A34A' } },
    
    // Closed-loop learning
    { id: 'pe_q_f', source: 'n_pgvector', target: 'n_finetuner', type: 'animated', markerEnd: { type: MarkerType.ArrowClosed, color: '#64748B' } },
    
    // Feedback loop back to Hybrid Searcher
    { 
      id: 'pe_f_s', 
      source: 'n_finetuner', 
      target: 'n_search', 
      type: 'animated', 
      style: { stroke: '#A855F7', strokeWidth: 2, strokeDasharray: '5 5' },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#A855F7' }
    }
  ];

  // 2. Dataset LangGraph StateGraph (Non-Linear Neuro-Symbolic Graph with Bypass & HITL)
  const langGraphRawNodes = [
    {
      id: 'lg_filter',
      type: 'custom',
      data: {
        label: 'Node 1: Filter Templates',
        desc: 'Symbolic Rules Engine',
        icon: Filter,
        category: 'symbolic',
        technicalDetails: {
          'Tujuan': 'Menghindari biaya komputasi LLM untuk template praktikum standar.',
          'Langkah Cache': 'Memeriksa template khusus mata kuliah terdaftar dan in-memory cache.',
          'Langkah Vektor': 'Memeriksa kecocokan template dari database vektor dengan skor kemiripan > 0.82.',
          'Bypass Logic': 'Jika terindikasi template, langsung ditandai aman (plagiat: false) tanpa memicu LLM Ollama.'
        }
      }
    },
    {
      id: 'lg_verify',
      type: 'custom',
      data: {
        label: 'Node 2: Verify Plagiarism',
        desc: 'Neural Verification + Fallback',
        icon: Cpu,
        category: 'neural',
        technicalDetails: {
          'Pemeriksaan Awal': 'Jika skor kemiripan vektor <= 0.60, bypass instan (plagiat: false) tanpa LLM.',
          'Neural Evaluator': 'Memanggil LLM lokal Ollama menggunakan prompt analitis akademik berformat JSON output.',
          'Keamanan Hardware': 'Concurrency dibatasi maksimal 5 query paralel via asyncio.Semaphore.',
          'Drift Fallback': 'Jika Ollama offline/error, memicu fallback heuristik cerdas (kemiripan > 0.78 otomatis plagiat, <= 0.78 aman).'
        }
      }
    },
    {
      id: 'lg_feedback',
      type: 'custom',
      data: {
        label: 'Node 3: Generate Feedback',
        desc: 'Score & Feedback Aggregation',
        icon: Sigma,
        category: 'aggregation',
        technicalDetails: {
          'Formula Plagiat': 'Menghitung persentase chunk yang terindikasi plagiat terhadap total chunk.',
          'Formula Orisinalitas': 'Orisinalitas = 100% - Persentase Kemiripan',
          'Output Rekap': 'Memetakan daftar referensi mahasiswa pembanding, tahun, prodi, dan koordinat spasial file.'
        }
      }
    },
    {
      id: 'lg_hitl',
      type: 'custom',
      data: {
        label: 'Aslab HITL Verification',
        desc: 'Verification by Aslab',
        icon: UserCheck,
        category: 'neural',
        technicalDetails: {
          'HITL Sync': 'Menyinkronkan output LangGraph ke portal review Aslab sebelum keputusan final diambil.'
        }
      }
    },
    {
      id: 'lg_end',
      type: 'custom',
      data: {
        label: 'END',
        desc: 'StateGraph Selesai',
        icon: CheckCircle,
        category: 'terminal',
        technicalDetails: {
          'Hasil Akhir': 'State kembali ke entry point API endpoints.py dengan payload terisi lengkap.'
        }
      }
    }
  ];

  const langGraphRawEdges = [
    // Non-linear branching: filter -> verify (Bukan template) OR filter -> feedback (Template bypass!)
    { 
      id: 'lge_f_v', 
      source: 'lg_filter', 
      target: 'lg_verify', 
      type: 'animated', 
      label: 'Bukan Template',
      style: { stroke: '#64748B' },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#64748B' } 
    },
    { 
      id: 'lge_f_fb', 
      source: 'lg_filter', 
      target: 'lg_feedback', 
      type: 'animated', 
      label: 'Template Bypass',
      style: { stroke: '#16A34A', strokeDasharray: '4 4' },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#16A34A' } 
    },
    
    // Normal verify -> feedback
    { id: 'lge_v_fb', source: 'lg_verify', target: 'lg_feedback', type: 'animated', markerEnd: { type: MarkerType.ArrowClosed, color: '#64748B' } },
    
    // Feedback -> Aslab HITL -> End
    { id: 'lge_fb_h', source: 'lg_feedback', target: 'lg_hitl', type: 'animated', markerEnd: { type: MarkerType.ArrowClosed, color: '#64748B' } },
    { id: 'lge_h_e', source: 'lg_hitl', target: 'lg_end', type: 'animated', markerEnd: { type: MarkerType.ArrowClosed, color: '#64748B' } },
  ];

  // Set States with calculated coordinates
  const [pipelineNodes, setPipelineNodes, onPipelineNodesChange] = useNodesState<any>([]);
  const [pipelineEdges, setPipelineEdges, onPipelineEdgesChange] = useEdgesState<any>([]);
  const [langGraphNodes, setLangGraphNodes, onLangGraphNodesChange] = useNodesState<any>([]);
  const [langGraphEdges, setLangGraphEdges, onLangGraphEdgesChange] = useEdgesState<any>([]);

  useEffect(() => {
    const pipeLayout = getLayoutedElements(pipelineRawNodes, pipelineRawEdges, 'LR');
    setPipelineNodes(pipeLayout.nodes);
    setPipelineEdges(pipeLayout.edges);

    const langLayout = getLayoutedElements(langGraphRawNodes, langGraphRawEdges, 'TB');
    setLangGraphNodes(langLayout.nodes);
    setLangGraphEdges(langLayout.edges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Simulation states
  const [simActive, setSimActive] = useState(false);
  const [simStepText, setSimStepText] = useState('Tekan tombol "Jalankan Simulasi" untuk melihat visualisasi pengolahan data.');

  const runPipelineSimulation = async () => {
    if (simActive) return;
    setSimActive(true);
    setSelectedNode(null);

    // Sequential simulation steps
    const steps = [
      { id: 'n_upload', label: '1. Unggah PDF', text: 'Mahasiswa mengunggah berkas PDF laporan praktikum.' },
      { id: 'n_parser', label: '2. Document Parser', text: 'PyMuPDF mengekstrak teks asli dan EasyOCR memproses hasil scan halaman PDF.' },
      { id: 'n_chunking', label: '3. Text Chunker', text: 'Teks dipotong menjadi bagian-bagian kecil 250 kata dengan overlap untuk redundansi spasial.' },
      { id: 'n_search', label: '4. Hybrid Searcher', text: 'Melakukan pencarian hibrida pada Supabase pgvector menggunakan pencarian dense (SBERT) dan full-text search.' },
      { id: 'n_langgraph', label: '5. LangGraph Decision', text: 'Memvalidasi plagiarisme secara asinkron lewat decision graph neuro-simbolik di LangGraph.' },
      { id: 'n_hitl', label: '6. Review Aslab (HITL)', text: 'Menunggu review manual oleh Asisten Laboratorium untuk verifikasi keabsahan laporan (HITL).' },
      { id: 'n_pgvector', label: '7. Supabase pgvector Indexer', text: 'Jika diverifikasi aman dan orisinalitas > 75%, dokumen di-insert ke tabel vektor Supabase.' },
      { id: 'n_finetuner', label: '8. SBERT Fine-Tuner', text: 'Melatih kembali model Sentence-BERT lokal menggunakan data laporan aman demi menangkal drift akurasi.' },
      { id: 'n_search', label: 'Pembaruan Model', text: 'Bobot model SBERT v2 berhasil di-hot-swapped kembali ke Hybrid Searcher! Siklus selesai.' }
    ];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      setSimStepText(`Langkah ${i + 1} dari ${steps.length}: ${step.label}: ${step.text}`);
      
      // Update nodes state to highlight the active step
      setPipelineNodes((nodes) => 
        nodes.map((node) => ({
          ...node,
          data: {
            ...node.data,
            isSimActive: node.id === step.id
          }
        }))
      );

      // Find the corresponding node data in raw nodes to show the detail panel below
      const nodeMatch = pipelineRawNodes.find(n => n.id === step.id);
      if (nodeMatch) {
        setSelectedNode({
          ...nodeMatch,
          data: {
            ...nodeMatch.data,
            label: step.label === 'Pembaruan Model' ? 'Pembaruan Model (Selesai)' : nodeMatch.data.label
          }
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    // Reset simulation states
    setPipelineNodes((nodes) => 
      nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          isSimActive: false
        }
      }))
    );
    setSimActive(false);
    setSimStepText('Simulasi selesai! Anda dapat mengklik setiap node secara bebas untuk melihat informasi rinci.');
  };

  const onNodeClick = (_event: any, node: any) => {
    setSelectedNode(node);
  };

  const closeDetailPanel = () => {
    setSelectedNode(null);
  };

  // Bento Tech Cards data
  const techCards = [
    { name: 'PyMuPDF', desc: 'Ekstraksi PDF digital berkinerja tinggi, koordinat kata, & gambar.', icon: FileText, badge: 'Dokumen' },
    { name: 'EasyOCR', desc: 'Model deep learning OCR multi-bahasa berbasis PyTorch untuk scan PDF.', icon: Layers, badge: 'OCR' },
    { name: 'SBERT', desc: 'intfloat/multilingual-e5-base untuk representasi semantik 768-dim.', icon: BrainCircuit, badge: 'Dense NLP' },
    { name: 'CLIP', desc: 'openai/clip-vit-base-patch32 untuk ekstraksi kesamaan gambar.', icon: Search, badge: 'Visual AI' },
    { name: 'Supabase pgvector', desc: 'Pencarian vektor cosine similarity terpadu dengan filtering metadata.', icon: Database, badge: 'Vektor' },
    { name: 'Ollama', desc: 'Mesin LLM lokal untuk verifikasi orisinalitas berbasis logika kompleks.', icon: Cpu, badge: 'Neural LLM' },
    { name: 'LangGraph', desc: 'Model graf logika StateGraph untuk evaluasi neuro-symbolic.', icon: Workflow, badge: 'Orkestrator' },
    { name: 'RRF Fusion', desc: 'Rank fusion untuk menyatukan pencarian semantik & leksikal.', icon: Network, badge: 'Matematika' },
  ];

  return (
    <div className="relative min-h-screen bg-[#F7F3E9] overflow-y-auto flex flex-col font-sans text-[#0D1B2A] p-6 sm:p-10">
      <div className="relative z-10 space-y-8 animate-fade-in-up pb-10">
        <PageHeader 
          title="Visualisasi Kinerja AI" 
          titleAccent="Service Pipeline"
          description="Representasi alur Directed Acyclic Graph (DAG) keputusan, orkestrasi pipeline, dan parameter model kecerdasan buatan."
          actions={
            <Link to="/admin/dashboard">
              <Button variant="default" size="sm" className="text-xs font-semibold">
                Kembali ke Dasbor
              </Button>
            </Link>
          }
        />

        {/* Console Simulasi & Legenda Alur */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Console Simulasi */}
          <Card className="md:col-span-2 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5">
            <div className="space-y-1">
              <span className="text-[9px] font-extrabold uppercase tracking-widest text-[#0D1B2A] bg-slate-100 px-2 py-0.5 rounded-sm border border-slate-200">Simulasi Pipeline</span>
              <p className="text-xs text-[#0D1B2A] font-semibold leading-relaxed">
                {simStepText}
              </p>
            </div>
            <Button
              onClick={runPipelineSimulation}
              disabled={simActive}
              variant="default"
              size="sm"
              className="flex-shrink-0 flex items-center gap-2 text-xs font-semibold"
            >
              {simActive && (
                <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {simActive ? 'Simulasi Berjalan...' : 'Jalankan Simulasi'}
            </Button>
          </Card>

          {/* Legenda Warna Node */}
          <Card className="p-5 space-y-3">
            <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-500">Petunjuk Warna Alur</span>
            <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-slate-600">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#415A77]/100 flex-shrink-0" />
                <span>Input / Mulai</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-600 flex-shrink-0" />
                <span>Symbolic Rules</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#D4AF37] flex-shrink-0" />
                <span>Neural Engine</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-600 flex-shrink-0" />
                <span>Vector / Supabase</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-600 flex-shrink-0" />
                <span>Jalur Ditolak</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0D1B2A] flex-shrink-0" />
                <span>Selesai / Output</span>
              </div>
            </div>
          </Card>
        </div>

      {/* Grid DAGs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* End-to-End Pipeline - 2 cols width */}
        <div className="lg:col-span-2 flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-sans text-base font-bold text-[#0D1B2A] tracking-tight">1. Pipeline Analisis Dokumen (End-to-End)</h2>
              <p className="text-xs text-slate-500">Klik salah satu node untuk melihat parameter teknis penulisan kode.</p>
            </div>
            <span className="text-[10px] font-bold bg-[#0D1B2A]/5 text-[#0D1B2A] px-3 py-1 rounded-full uppercase tracking-wider">
              Layout: Horizontal (L ke R)
            </span>
          </div>
          
          <div className="h-[540px] border border-slate-200/80 rounded-lg bg-white overflow-hidden relative shadow-xs">
            <ReactFlow
              nodes={pipelineNodes}
              edges={pipelineEdges}
              onNodesChange={onPipelineNodesChange}
              onEdgesChange={onPipelineEdgesChange}
              nodeTypes={customNodeTypes}
              edgeTypes={edgeTypes}
              onNodeClick={onNodeClick}
              fitView
              fitViewOptions={{ padding: 0.15 }}
              minZoom={0.2}
              maxZoom={1.2}
            >
              <MiniMap 
                nodeColor={() => 'rgba(15, 23, 42, 0.05)'} 
                maskColor="rgba(250, 249, 246, 0.5)"
                className="!right-3 !bottom-3"
              />
              <Controls className="!left-3 !top-3" />
              <Background color="#94A3B8" gap={16} size={1} className="opacity-20" />
            </ReactFlow>
          </div>
        </div>

        {/* LangGraph Decision Graph - 1 col width */}
        <div className="flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-sans text-base font-bold text-[#0D1B2A] tracking-tight">2. LangGraph StateGraph</h2>
              <p className="text-xs text-slate-500">Pipa evaluasi orisinalitas.</p>
            </div>
            <span className="text-[10px] font-bold bg-[#0D1B2A]/5 text-[#0D1B2A] px-3 py-1 rounded-full uppercase tracking-wider">
              Layout: Vertikal (T ke B)
            </span>
          </div>

          <div className="h-[540px] border border-slate-200/80 rounded-lg bg-white overflow-hidden relative shadow-xs">
            <ReactFlow
              nodes={langGraphNodes}
              edges={langGraphEdges}
              onNodesChange={onLangGraphNodesChange}
              onEdgesChange={onLangGraphEdgesChange}
              nodeTypes={customNodeTypes}
              edgeTypes={edgeTypes}
              onNodeClick={onNodeClick}
              fitView
              fitViewOptions={{ padding: 0.15 }}
              minZoom={0.2}
              maxZoom={1.2}
            >
              <Controls className="!left-3 !top-3" />
              <Background color="#94A3B8" gap={16} size={1} className="opacity-20" />
            </ReactFlow>
          </div>
        </div>
      </div>

      {/* Floating/Integrated Detail Panel */}
      {selectedNode && (
        <Card variant="academic" className="border-[#415A77]/25 bg-white shadow-xs relative p-6 animate-fade-in">
          <button 
            onClick={closeDetailPanel} 
            className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-100 text-[#0D1B2A] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
          
          <div className="flex items-center gap-3 border-b border-slate-200/80 pb-4 mb-4">
            <div className="p-2.5 rounded-lg bg-[#0D1B2A] text-white flex-shrink-0">
              {React.createElement(selectedNode.data.icon as React.ComponentType<any>, { className: "w-5 h-5" })}
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Detail Arsitektur Node</span>
              <h3 className="text-base font-extrabold text-[#0D1B2A] uppercase leading-none">{selectedNode.data.label}</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Deskripsi Kerja</h4>
              <p className="text-sm text-[#0D1B2A] font-semibold leading-relaxed">{selectedNode.data.desc}</p>
            </div>
            
            {selectedNode.data.technicalDetails && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Parameter & Logika Teknis</h4>
                <div className="space-y-3">
                  {Object.entries(selectedNode.data.technicalDetails).map(([key, value]) => (
                    <div key={key} className="text-xs">
                      <span className="font-extrabold text-[#0D1B2A] block">{key}</span>
                      <span className="text-slate-600 font-medium leading-normal mt-0.5 block">{value as string}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Tech Stack section */}
      <div className="space-y-4">
        <div>
          <h2 className="font-sans text-base font-bold text-[#0D1B2A] tracking-tight">3. Infrastruktur & Model AI</h2>
          <p className="text-xs text-slate-500">Daftar pustaka, model embedding, dan kerangka kerja yang berjalan di service backend Python.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {techCards.map((tech) => (
            <Card key={tech.name} className="flex flex-col justify-between h-40 p-4">
              <div>
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-lg bg-[#0D1B2A]/5 text-[#0D1B2A]">
                    <tech.icon className="w-4 h-4" />
                  </div>
                  <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                    {tech.badge}
                  </span>
                </div>
                <h3 className="font-sans font-bold text-sm text-[#0D1B2A] mt-4 tracking-tight">{tech.name}</h3>
                <p className="text-[11px] text-slate-600 mt-1 font-semibold leading-snug">{tech.desc}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  </div>
  );
}
