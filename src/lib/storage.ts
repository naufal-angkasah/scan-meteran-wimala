import { AppSettings, MeterReading, UnitKavling } from '../types';
import { MASTER_UNITS } from '../data/units';

const SETTINGS_KEY = 'wimala_meter_settings_v1';
const READINGS_KEY = 'wimala_meter_readings_v1';

export const DEFAULT_SETTINGS: AppSettings = {
  tarifPerM3: 3000,
  biayaAbonemen: 20000,
  batasLonjakanM3: 30,
  namaPetugas: 'Ahmad Fauzi (Petugas Lapangan)',
  periodeAktif: 'Oktober 2026',
  darkMode: false,
};

// Initial sample readings for testing/demo
export const INITIAL_SAMPLE_READINGS: MeterReading[] = [
  {
    id: 'rec-1',
    unitNo: 1,
    blok: 'D-01',
    cluster: 'Kamala',
    namaKonsumen: 'Budi Santoso',
    periode: 'Oktober 2026',
    standAwal: 142,
    standAkhir: 159,
    pemakaian: 17,
    estimasiBiayaAir: 20000 + (17 * 3000), // 71000
    kondisiMeter: 'Normal',
    petugas: 'Ahmad Fauzi (Petugas Lapangan)',
    timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
    isAnomaly: false,
    catatanPetugas: 'Meter bersih, putaran normal',
  },
  {
    id: 'rec-2',
    unitNo: 2,
    blok: 'D-02',
    cluster: 'Kamala',
    namaKonsumen: 'Siti Rahmawati',
    periode: 'Oktober 2026',
    standAwal: 198,
    standAkhir: 214,
    pemakaian: 16,
    estimasiBiayaAir: 20000 + (16 * 3000), // 68000
    kondisiMeter: 'Normal',
    petugas: 'Ahmad Fauzi (Petugas Lapangan)',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    isAnomaly: false,
  },
  {
    id: 'rec-5',
    unitNo: 5,
    blok: 'D-05',
    cluster: 'Kamala',
    namaKonsumen: 'Hendra Gunawan',
    periode: 'Oktober 2026',
    standAwal: 164,
    standAkhir: 205,
    pemakaian: 41,
    estimasiBiayaAir: 20000 + (41 * 3000), // 143000
    kondisiMeter: 'Pipa Bocor / Rembes',
    petugas: 'Ahmad Fauzi (Petugas Lapangan)',
    timestamp: new Date(Date.now() - 3600000 * 1).toISOString(),
    isAnomaly: true,
    anomalyReason: 'Pemakaian melonjak drastis (41 m³ > batas 30 m³). Terlihat rembesan di keran depan.',
    catatanPetugas: 'Sudah diinfokan ke penghuni untuk perbaikan instalasi',
  },
];

export const getSettings = (): AppSettings => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (e) {
    return DEFAULT_SETTINGS;
  }
};

export const saveSettings = (settings: AppSettings): void => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  window.dispatchEvent(new Event('wimala_settings_changed'));
};

export const getReadings = (): MeterReading[] => {
  try {
    const raw = localStorage.getItem(READINGS_KEY);
    if (!raw) {
      // Seed with sample data on first load
      localStorage.setItem(READINGS_KEY, JSON.stringify(INITIAL_SAMPLE_READINGS));
      return INITIAL_SAMPLE_READINGS;
    }
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
};

export const saveReading = (reading: MeterReading): void => {
  const readings = getReadings();
  const existingIdx = readings.findIndex(
    r => r.blok === reading.blok && r.periode === reading.periode
  );

  if (existingIdx >= 0) {
    readings[existingIdx] = reading;
  } else {
    readings.unshift(reading);
  }

  localStorage.setItem(READINGS_KEY, JSON.stringify(readings));
  window.dispatchEvent(new Event('wimala_readings_changed'));
};

export const deleteReading = (id: string): void => {
  const readings = getReadings().filter(r => r.id !== id);
  localStorage.setItem(READINGS_KEY, JSON.stringify(readings));
  window.dispatchEvent(new Event('wimala_readings_changed'));
};

export const resetAllReadings = (): void => {
  localStorage.setItem(READINGS_KEY, JSON.stringify([]));
  window.dispatchEvent(new Event('wimala_readings_changed'));
};

export const restoreDemoReadings = (): void => {
  localStorage.setItem(READINGS_KEY, JSON.stringify(INITIAL_SAMPLE_READINGS));
  window.dispatchEvent(new Event('wimala_readings_changed'));
};

export const calculateUsageAndCost = (
  standAwal: number,
  standAkhir: number,
  settings: AppSettings
): {
  pemakaian: number;
  estimasiBiaya: number;
  isAnomaly: boolean;
  anomalyReason?: string;
} => {
  const pemakaian = standAkhir - standAwal;
  let isAnomaly = false;
  let anomalyReason: string | undefined = undefined;

  if (standAkhir < standAwal) {
    isAnomaly = true;
    anomalyReason = `Stand akhir (${standAkhir} m³) lebih kecil dari stand awal (${standAwal} m³). Kemungkinan meter direset, diganti, atau salah input.`;
  } else if (pemakaian > settings.batasLonjakanM3) {
    isAnomaly = true;
    anomalyReason = `Pemakaian melonjak tinggi (${pemakaian} m³ > batas normal ${settings.batasLonjakanM3} m³). Waspada kebocoran pipa atau toren!`;
  } else if (pemakaian === 0) {
    anomalyReason = 'Pemakaian 0 m³. Pastikan rumah berpenghuni atau cek apakah jarum meteran macet.';
  }

  const biayaPemakaian = Math.max(0, pemakaian) * settings.tarifPerM3;
  const estimasiBiaya = settings.biayaAbonemen + biayaPemakaian;

  return { pemakaian, estimasiBiaya, isAnomaly, anomalyReason };
};
