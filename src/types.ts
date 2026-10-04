export type StatusRumah = 'terhuni' | 'dibangun' | 'renovasi' | 'booking' | 'kosong';

export interface Customer {
  id: string;
  namaPemilik: string;
  blok: string;
  cluster?: string;
  nomorMeteran: string;
  angkaAwal: number;
  statusRumah?: StatusRumah;
  /** true = ditambahkan otomatis oleh petugas dari stiker, perlu disesuaikan admin */
  needsReview?: boolean;
  sumber?: 'admin' | 'worker' | 'import';
  dibuatOleh?: string;
  createdAt?: any;
}

export interface Tariff {
  id: string;
  minM3: number;
  maxM3: number;
  hargaPerM3: number;
  deskripsi?: string;
}

export type ReadingStatus = 'normal' | 'perlu_cek' | 'valid';

export interface ReadingRecord {
  id: string; // customerId_periode
  customerId: string;
  blok: string;
  namaPemilik: string;
  nomorMeteran: string;
  periode: string; // YYYY-MM
  angkaSebelumnya: number;
  angkaSekarang: number;
  pemakaianM3: number;
  totalBiaya: number;
  fotoUrl: string;
  ocrConfidence: number;
  status: ReadingStatus;
  catatanAnomali?: string | null;
  dicatatOleh: string;
  dicatatOlehUid?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface OcrResult {
  angka: number | null;
  confidence: number;
  catatan?: string;
}

// -------------------------------------------------------------
// Legacy & Compatibility Types
// -------------------------------------------------------------
export type ClusterName = 'Kamala' | 'Lily' | 'Bougenvile';

export interface UnitKavling {
  no: number;
  cluster: ClusterName;
  blok: string;
  nama: string;
  tipe: string;
  status: 'Terhuni' | 'Booking';
  standAwal: number;
  nomorMeteran?: string;
}

export type KondisiMeter = 
  | 'Normal'
  | 'Kaca Buram / Berlumut'
  | 'Meter Macet / Rusak'
  | 'Pipa Bocor / Rembes'
  | 'Rumah Kosong'
  | 'Pintu / Pagar Terkunci';

export interface MeterReading {
  id: string;
  unitNo: number;
  blok: string;
  cluster: ClusterName;
  namaKonsumen: string;
  periode: string;
  standAwal: number;
  standAkhir: number;
  pemakaian: number;
  estimasiBiayaAir: number;
  kondisiMeter: KondisiMeter;
  fotoBukti?: string;
  catatanPetugas?: string;
  petugas: string;
  timestamp: string;
  isAnomaly: boolean;
  anomalyReason?: string;
}

export interface AppSettings {
  tarifPerM3: number;
  biayaAbonemen: number;
  batasLonjakanM3: number;
  namaPetugas: string;
  periodeAktif: string;
  darkMode: boolean;
}
