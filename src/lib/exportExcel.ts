import * as XLSX from 'xlsx';
import { MASTER_UNITS } from '../data/units';
import { MeterReading, AppSettings } from '../types';

export const exportToExcel = (
  readings: MeterReading[],
  settings: AppSettings,
  fileNamePrefix: string = 'Rekap_Meteran_Air_Wimala'
): void => {
  const readingsMap = new Map<string, MeterReading>();
  readings.forEach(r => readingsMap.set(r.blok, r));

  // 1. Data Sheet: Rincian Seluruh 65 Unit
  const rows = MASTER_UNITS.map((unit, index) => {
    const record = readingsMap.get(unit.blok);
    const standAkhir = record ? record.standAkhir : '';
    const pemakaian = record ? record.pemakaian : '';
    const tagihanAir = record ? record.estimasiBiayaAir : '';
    const statusCatat = record 
      ? (record.isAnomaly ? 'Anomali / Perlu Tinjau' : 'Sudah Dicatat') 
      : 'Belum Dicatat';

    return {
      'No': index + 1,
      'Periode Tagihan': settings.periodeAktif,
      'Cluster': unit.cluster,
      'Blok & Kavling': unit.blok,
      'Nama Konsumen': unit.nama,
      'Tipe Rumah': unit.tipe,
      'Status Kavling': unit.status,
      'Stand Awal (m³)': unit.standAwal,
      'Stand Akhir (m³)': standAkhir,
      'Pemakaian (m³)': pemakaian,
      'Abonemen (Rp)': record ? settings.biayaAbonemen : '',
      'Total Tagihan Air (Rp)': tagihanAir,
      'Kondisi Meter': record?.kondisiMeter || '-',
      'Status Catat': statusCatat,
      'Catatan Petugas': record?.catatanPetugas || (record?.anomalyReason || '-'),
      'Waktu Dicatat': record ? new Date(record.timestamp).toLocaleString('id-ID') : '-',
      'Petugas': record?.petugas || '-',
    };
  });

  // 2. Summary Sheet: Rekapitulasi per Cluster
  const clusters = ['Kamala', 'Lily', 'Bougenvile'] as const;
  const summaryRows = clusters.map(cName => {
    const clusterUnits = MASTER_UNITS.filter(u => u.cluster === cName);
    const recordedUnits = clusterUnits.filter(u => readingsMap.has(u.blok));
    const totalM3 = recordedUnits.reduce((acc, u) => {
      const r = readingsMap.get(u.blok);
      return acc + (r?.pemakaian || 0);
    }, 0);
    const totalTagihan = recordedUnits.reduce((acc, u) => {
      const r = readingsMap.get(u.blok);
      return acc + (r?.estimasiBiayaAir || 0);
    }, 0);

    return {
      'Nama Cluster': `Cluster ${cName}`,
      'Total Kavling': clusterUnits.length,
      'Sudah Dicatat': recordedUnits.length,
      'Belum Dicatat': clusterUnits.length - recordedUnits.length,
      'Total Pemakaian (m³)': totalM3,
      'Total Tagihan Air (Rp)': totalTagihan,
    };
  });

  // Grand Total Row
  const totalRecorded = MASTER_UNITS.filter(u => readingsMap.has(u.blok)).length;
  const grandTotalM3 = readings.reduce((acc, r) => acc + (r.pemakaian > 0 ? r.pemakaian : 0), 0);
  const grandTotalTagihan = readings.reduce((acc, r) => acc + r.estimasiBiayaAir, 0);

  summaryRows.push({
    'Nama Cluster': 'TOTAL KESELURUHAN',
    'Total Kavling': MASTER_UNITS.length,
    'Sudah Dicatat': totalRecorded,
    'Belum Dicatat': MASTER_UNITS.length - totalRecorded,
    'Total Pemakaian (m³)': grandTotalM3,
    'Total Tagihan Air (Rp)': grandTotalTagihan,
  });

  // Create Workbook
  const wb = XLSX.utils.book_new();

  const wsDetails = XLSX.utils.json_to_sheet(rows);
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);

  // Auto-fit column widths
  wsDetails['!cols'] = [
    { wch: 6 },  // No
    { wch: 15 }, // Periode
    { wch: 14 }, // Cluster
    { wch: 14 }, // Blok
    { wch: 22 }, // Nama
    { wch: 18 }, // Tipe
    { wch: 14 }, // Status Kavling
    { wch: 15 }, // Stand Awal
    { wch: 15 }, // Stand Akhir
    { wch: 15 }, // Pemakaian
    { wch: 15 }, // Abonemen
    { wch: 20 }, // Total Tagihan
    { wch: 20 }, // Kondisi
    { wch: 18 }, // Status Catat
    { wch: 30 }, // Catatan
    { wch: 20 }, // Waktu
    { wch: 22 }, // Petugas
  ];

  XLSX.utils.book_append_sheet(wb, wsDetails, 'Rincian Meteran Warga');
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Rekapitulasi Cluster');

  // Generate filename
  const cleanPeriode = settings.periodeAktif.replace(/\s+/g, '_');
  const filename = `${fileNamePrefix}_${cleanPeriode}.xlsx`;

  XLSX.writeFile(wb, filename);
};
