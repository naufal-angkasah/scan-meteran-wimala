export type ClusterName = 'Kamala' | 'Lily' | 'Bougenvile';

export interface UnitKavling {
  no: number;
  cluster: ClusterName;
  blok: string; // e.g. 'D-01', 'A-21'
  nama: string;
  tipe: string;
  status: 'Terhuni' | 'Booking';
  standAwal: number; // m3 bulan lalu
  nomorMeteran?: string; // no seri meter fisik
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
  periode: string; // e.g. 'September 2026'
  standAwal: number; // m3
  standAkhir: number; // m3
  pemakaian: number; // standAkhir - standAwal (m3)
  estimasiBiayaAir: number; // Rp
  kondisiMeter: KondisiMeter;
  fotoBukti?: string; // Data URL base64 atau path
  catatanPetugas?: string;
  petugas: string;
  timestamp: string; // ISO date string
  isAnomaly: boolean;
  anomalyReason?: string;
}

export interface AppSettings {
  tarifPerM3: number; // default Rp 3.000 / m3
  biayaAbonemen: number; // default Rp 20.000
  batasLonjakanM3: number; // default 30 m3
  namaPetugas: string;
  periodeAktif: string; // e.g. 'Oktober 2026'
  darkMode: boolean;
}
