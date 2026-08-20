import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getEvacuationCenters } from '../../api/evacuation';
import { useAuthStore } from '../../store/authStore';
import { FileDown, TrendingUp, Users, Home, X, Printer, Search, Filter, ShieldAlert, HeartHandshake, User } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../../api/axios';

const BARANGAYS = [
  'Bagong Silang', 'Balimbingan', 'Balubad', 'Caliraya', 'Concepcion',
  'Lewin', 'Maracta', 'Maytalang I', 'Maytalang II',
  'Primera Parang', 'Primera Pulo', 'Salac', 'Segunda Parang',
  'Segunda Pulo', 'Santo Niño', 'Wawa',
];

export default function MswdoReports() {
  const { user } = useAuthStore();
  const [selectedCenterId, setSelectedCenterId] = useState(user?.evacuation_center_id ? String(user.evacuation_center_id) : '');

  const [pdfPreview, setPdfPreview] = useState(null);
  const [search, setSearch] = useState('');
  const [filterBrgy, setFilterBrgy] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [filterDamage, setFilterDamage] = useState('');
  const [filterClassification, setFilterClassification] = useState('');
  const [filterAgeMin, setFilterAgeMin] = useState('');
  const [filterAgeMax, setFilterAgeMax] = useState('');

  const { data: centers = [] } = useQuery({
    queryKey: ['evacuation'],
    queryFn: getEvacuationCenters,
  });

  const activeCenterId = selectedCenterId || (user?.evacuation_center_id ? String(user.evacuation_center_id) : (centers[0] ? String(centers[0].id) : 'all'));

  const { data: allFamilies = [] } = useQuery({
    queryKey: ['all-families'],
    queryFn: () => api.get('/evacuation/all-families').then(r => r.data.data || []).catch(async () => {
      if (!centers.length) return [];
      const results = await Promise.all(
        centers.map(c => api.get(`/evacuation/${c.id}/families`).then(r => (r.data.data || []).map(f => ({ ...f, center_name: c.name }))))
      );
      return results.flat();
    }),
    enabled: centers.length > 0,
  });

  const isAll = activeCenterId === 'all';
  const selectedCenter = centers.find(c => String(c.id) === String(activeCenterId));

  const centerName = isAll ? 'All Evacuation Centers' : (selectedCenter?.name || '—');
  const centerBarangay = isAll ? 'All Barangays' : (selectedCenter?.barangay_name || selectedCenter?.barangay || '—');

  const families = isAll
    ? allFamilies
    : allFamilies.filter(f => String(f.evacuation_center_id) === String(activeCenterId));

  const familyEvacueeCount = families.reduce((s, f) => s + (Number(f.members) || 0), 0);

  const current = isAll
    ? Math.max(allFamilies.reduce((s, f) => s + (Number(f.members) || 0), 0), centers.reduce((s, c) => s + (Number(c.capacity_current) || 0), 0))
    : Math.max(Number(selectedCenter?.capacity_current) || 0, familyEvacueeCount);

  const total = isAll
    ? (centers.reduce((s, c) => s + (Number(c.capacity_total) || 0), 0) || 1)
    : (Number(selectedCenter?.capacity_total) || 1);

  const avail = Math.max(total - current, 0);
  const rawPct = total > 0 ? (current / total) * 100 : 0;
  const pct = Math.min(rawPct, 100);
  const pctFormatted = pct === 0 ? '0%' : pct < 1 ? `${pct.toFixed(1)}%` : `${Math.round(pct)}%`;

  const totalMembers = families.reduce((s, f) => s + (Number(f.members) || 0), 0);
  const total4Ps = families.filter(f => f.is_4ps_beneficiary).length;
  const totalIPs = families.filter(f => f.is_ip).length;
  const totalDamaged = families.filter(f => f.shelter_damage && f.shelter_damage !== 'Intact/Undamaged').length;

  const filteredAll = useMemo(() => {
    return families.filter(f => {
      const matchSearch = !search ||
        f.head_name?.toLowerCase().includes(search.toLowerCase()) ||
        f.serial_number?.toLowerCase().includes(search.toLowerCase()) ||
        f.barangay?.toLowerCase().includes(search.toLowerCase()) ||
        f.address?.toLowerCase().includes(search.toLowerCase());

      const matchBrgy = !filterBrgy || f.barangay === filterBrgy;
      const matchGender = !filterGender || f.gender === filterGender;
      const matchDamage = !filterDamage || f.shelter_damage === filterDamage;

      let matchClassification = true;
      if (filterClassification === '4Ps') matchClassification = f.is_4ps_beneficiary;
      else if (filterClassification === 'IP') matchClassification = f.is_ip;

      const age = f.age ? parseInt(f.age) : null;
      const matchAgeMin = !filterAgeMin || (age !== null && age >= parseInt(filterAgeMin));
      const matchAgeMax = !filterAgeMax || (age !== null && age <= parseInt(filterAgeMax));

      return matchSearch && matchBrgy && matchGender && matchDamage && matchClassification && matchAgeMin && matchAgeMax;
    });
  }, [families, search, filterBrgy, filterGender, filterDamage, filterClassification, filterAgeMin, filterAgeMax]);

  const generateFacedCardPDF = (f) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const nowStr = new Date().toLocaleString('en-PH');

    // Header
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text('MSWDO', 14, 12);
    doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
    doc.text('Republic of the Philippines', 30, 9.5);
    doc.setFontSize(8.5); doc.setFont('helvetica', 'bold');
    doc.text('Municipal Social Welfare and Development Office', 30, 13.5);
    doc.setFontSize(8.5);
    doc.text('FAMILY ASSISTANCE CARD IN EMERGENCIES AND DISASTERS (FACED)', 30, 18, { maxWidth: 104 });

    // Official Use Only Box (Right Aligned)
    doc.setFontSize(6); doc.setFont('helvetica', 'normal');
    doc.text("THIS CARD IS NOT FOR SALE / SOCIAL WORKER'S COPY", 136, 9.5);
    doc.setLineWidth(0.3); doc.rect(136, 11, 59, 10);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
    doc.text('OFFICIAL USE ONLY', 138, 14.5);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
    doc.text(`SERIAL NO: ${f.serial_number || 'MSWDO-' + (f.id ? f.id.slice(0, 8).toUpperCase() : '0000')}`, 138, 19);

    doc.setFillColor(30, 41, 59); doc.rect(14, 23, 181, 5, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.text('LOCATION OF THE AFFECTED FAMILY', 16, 26.5);
    doc.setTextColor(0, 0, 0);

    doc.rect(14, 28, 181, 12); doc.setFontSize(7); doc.setFont('helvetica', 'normal');
    doc.text(`1. REGION: ${f.region || 'Region IV-A'}`, 16, 32);
    doc.text(`2. PROVINCE: ${f.province || 'Laguna'}`, 16, 36);
    doc.text(`3. CITY/ MUNICIPALITY: ${f.city_municipality || 'Lumban'}`, 70, 32);
    doc.text(`4. DISTRICT: ${f.district || '1st District'}`, 70, 36);
    doc.text(`5. BARANGAY: ${f.barangay || '—'}`, 130, 32);
    doc.text(`6. EVACUATION CENTER/ SITE: ${f.center_name || centerName}`, 130, 36);

    doc.setFillColor(30, 41, 59); doc.rect(14, 42, 181, 5, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.text('HEAD OF THE FAMILY', 16, 45.5);
    doc.setTextColor(0, 0, 0);

    doc.rect(14, 47, 181, 46); doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
    doc.text(`7. LAST NAME: ${f.head_last_name || f.head_name?.split(' ').pop() || '—'}`, 16, 51);
    doc.text(`8. FIRST NAME: ${f.head_first_name || f.head_name?.split(' ')[0] || '—'}`, 16, 56);
    doc.text(`9. MIDDLE NAME: ${f.head_middle_name || '—'}`, 16, 61);
    doc.text(`10. NAME EXT. (Jr., Sr.): ${f.head_name_ext || '—'}`, 16, 66);
    doc.text(`11. DATE OF BIRTH: ${f.head_dob ? new Date(f.head_dob).toLocaleDateString('en-PH') : '—'}`, 16, 71);
    doc.text(`12. AGE: ${f.age || '—'}`, 16, 76);
    doc.text(`13. PLACE OF BIRTH: ${f.head_place_of_birth || '—'}`, 16, 81);
    doc.text(`14. SEX: [${f.gender === 'Male' ? 'X' : ' '}] MALE   [${f.gender === 'Female' ? 'X' : ' '}] FEMALE`, 16, 86);

    doc.text(`15. CIVIL STATUS: ${f.head_civil_status || '—'}`, 100, 51);
    doc.text(`16. MOTHER'S MAIDEN NAME: ${f.head_mothers_maiden_name || '—'}`, 100, 56);
    doc.text(`17. RELIGION: ${f.head_religion || '—'}`, 100, 61);
    doc.text(`18. OCCUPATION: ${f.head_occupation || '—'}`, 100, 66);
    doc.text(`19. MONTHLY FAMILY NET INCOME: ₱${f.head_monthly_income || '—'}`, 100, 71);
    doc.text(`20. ID CARD PRESENTED: ${f.head_id_card_presented || '—'}`, 100, 76);
    doc.text(`21. ID CARD NUMBER: ${f.head_id_card_number || '—'}`, 100, 81);
    doc.text(`22. CONTACT NUMBER: ${f.contact || '—'} (ALT: ${f.contact_alternate || '—'})`, 100, 86);

    doc.line(14, 88.5, 195, 88.5);
    doc.text(`23. PERMANENT ADDRESS: ${f.address || `${f.house_lot_no || ''} ${f.street || ''} ${f.subd_village || ''} Brgy. ${f.barangay || ''}, ${f.city_municipality || 'Lumban'}, ${f.province || 'Laguna'}`}`, 16, 92);
    doc.text(`24. OTHERS:  [${f.is_4ps_beneficiary ? 'X' : ' '}] 4Ps Beneficiary    [${f.is_ip ? 'X' : ' '}] IP (Ethnicity: ${f.ethnicity || 'N/A'})`, 100, 92);

    doc.setFillColor(30, 41, 59); doc.rect(14, 95, 181, 5, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.text('FAMILY INFORMATION', 16, 98.5);
    doc.setTextColor(0, 0, 0);

    const membersTableRows = (f.members_list?.length ? f.members_list : []).map((m, i) => [
      i + 1, m.name, m.relation_to_head || '—', m.birthdate ? new Date(m.birthdate).toLocaleDateString('en-PH') : '—',
      m.age || '—', m.sex || m.gender || '—', m.educational_attainment || '—', m.occupation || '—', m.vulnerability_type || 'None',
    ]);

    autoTable(doc, {
      startY: 101,
      head: [['#', 'FAMILY MEMBERS', 'RELATION TO HEAD', 'BIRTHDATE', 'AGE', 'SEX', 'HIGHEST EDUC. ATTAINMENT', 'OCCUPATION', 'TYPE OF VULNERABILITY']],
      body: membersTableRows.length ? membersTableRows : [['1', 'No additional members registered', '—', '—', '—', '—', '—', '—', '—']],
      styles: { fontSize: 7, cellPadding: 2, lineColor: [200, 200, 200], lineWidth: 0.1 },
      headStyles: { fillColor: [241, 245, 249], textColor: 0, fontStyle: 'bold', fontSize: 6.5 },
      theme: 'grid',
      margin: { left: 14, right: 14 }
    });

    const finalY = doc.lastAutoTable.finalY || 140;

    doc.setFillColor(30, 41, 59); doc.rect(14, finalY + 3, 181, 5, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.text('ACCOUNT INFORMATION (For Financial / Cash Assistance)', 16, finalY + 6.5);
    doc.setTextColor(0, 0, 0);

    doc.rect(14, finalY + 8, 181, 12); doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
    doc.text(`25. BANK/E-WALLET: ${f.bank_ewallet || 'N/A'}`, 16, finalY + 13);
    doc.text(`26. ACCOUNT NAME: ${f.account_name || 'N/A'}`, 16, finalY + 17);
    doc.text(`27. ACCOUNT TYPE: ${f.account_type || 'N/A'}`, 100, finalY + 13);
    doc.text(`28. ACCOUNT NUMBER: ${f.account_number || 'N/A'}`, 100, finalY + 17);

    const yHousing = finalY + 22;
    doc.rect(14, yHousing, 181, 12);
    doc.text(`29. HOUSE OWNERSHIP: [${f.house_ownership === 'Owner' ? 'X' : ' '}] OWNER    [${f.house_ownership === 'Renter' ? 'X' : ' '}] RENTER    [${f.house_ownership === 'Sharer' ? 'X' : ' '}] SHARER`, 16, yHousing + 5);
    doc.text(`30. SHELTER DAMAGE CLASSIFICATION: [${f.shelter_damage === 'Partially Damaged' ? 'X' : ' '}] PARTIALLY DAMAGED    [${f.shelter_damage === 'Totally Damaged' ? 'X' : ' '}] TOTALLY DAMAGED`, 16, yHousing + 9.5);

    const ySig = yHousing + 15;
    doc.rect(14, ySig, 181, 25); doc.rect(16, ySig + 2, 20, 20);
    doc.setFontSize(6); doc.text('Right Thumbmark', 17, ySig + 20);

    doc.line(45, ySig + 16, 110, ySig + 16); doc.setFontSize(7);
    doc.text('Signature / Thumbmark of Family Head', 48, ySig + 19);

    doc.line(125, ySig + 16, 188, ySig + 16);
    doc.text('Name / Signature of Barangay Captain', 130, ySig + 19);

    doc.line(45, ySig + 22, 110, ySig + 22);
    doc.text(`Date Registered: ${f.arrival_date ? new Date(f.arrival_date).toLocaleDateString('en-PH') : nowStr}`, 48, ySig + 24.5);

    doc.line(125, ySig + 22, 188, ySig + 22);
    doc.text('Name / Signature of LSWDO', 138, ySig + 24.5);

    doc.setFontSize(6.5); doc.setFont('helvetica', 'bold');
    doc.text('DATA PRIVACY DECLARATION', 14, ySig + 28.5);
    doc.setFont('helvetica', 'normal');
    doc.text('All data and information indicated herein shall be used for identification purposes for the implementation of disaster risk reduction and management (DRRM) programs, projects, and activities in compliance to Republic Act 10173 (Data Privacy Act of 2012).', 14, ySig + 32, { maxWidth: 181 });

    const filename = `FACED_Card_${f.head_last_name || 'Evacuee'}_${f.serial_number || 'Record'}.pdf`;
    setPdfPreview({ url: doc.output('bloburl'), filename });
  };

  const exportCenterPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const nowStr = new Date().toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' });

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('MSWDO — Evacuee & FACED Summary Report', 14, 16);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(`Evacuation Center: ${centerName}`, 14, 23);
    doc.text(`Barangay: ${centerBarangay}`, 14, 29);
    doc.text(`Generated: ${nowStr}`, 14, 35);
    doc.text(`Generated by: ${user?.full_name || '—'} (${user?.role || 'Officer'})`, 14, 41);
    doc.text(`Total Families: ${filteredAll.length} | Members: ${filteredAll.reduce((s, f) => s + (f.members || 0), 0)} | 4Ps: ${total4Ps} | IPs: ${totalIPs}`, 14, 47);

    // Summary Table
    autoTable(doc, {
      startY: 52,
      head: [['Current Evacuees', 'Max Capacity', 'Available Space', 'Occupancy Rate', 'Registered Families', '4Ps Count', 'IP Count', 'Shelters Damaged']],
      body: [
        [current, total, avail, pctFormatted, families.length, total4Ps, totalIPs, totalDamaged]
      ],
      styles: { fontSize: 9, cellPadding: 3, halign: 'center' },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [241, 245, 249] },
    });

    const summaryEndY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : 70;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Evacuee Records (FACED Format)', 14, summaryEndY);

    if (filteredAll.length > 0) {
      autoTable(doc, {
        startY: summaryEndY + 4,
        head: [['#', 'Serial No.', 'Head of Family', 'Age/Sex', 'Address', 'Barangay', 'Center', 'Members', '4Ps/IP', 'Damage Status', 'Bank / E-Wallet', 'Arrival Date']],
        body: filteredAll.map((f, i) => [
          i + 1,
          f.serial_number || '—',
          f.head_name || `${f.head_first_name || ''} ${f.head_last_name || ''}`,
          `${f.age || '—'} / ${f.gender || '—'}`,
          f.address || '—',
          f.barangay || '—',
          f.center_name || '—',
          f.members,
          `${f.is_4ps_beneficiary ? '4Ps' : ''}${f.is_4ps_beneficiary && f.is_ip ? ' / ' : ''}${f.is_ip ? 'IP' : ''}` || 'None',
          f.shelter_damage || '—',
          f.bank_ewallet ? `${f.bank_ewallet} (${f.account_number || ''})` : '—',
          f.arrival_date ? new Date(f.arrival_date).toLocaleDateString('en-PH') : '—',
        ]),
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [241, 245, 249] },
      });
    } else {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(150);
      doc.text('No family records match current filters.', 14, summaryEndY + 8);
    }

    const filename = `evacuee_report_${centerName.replace(/\s+/g, '_').toLowerCase()}.pdf`;
    setPdfPreview({ url: doc.output('bloburl'), filename });
  };

  const stats = [
    { icon: Users, label: 'Current Evacuees', value: current, color: '#2563eb' },
    { icon: Home, label: 'Max Capacity', value: total, color: '#7c3aed' },
    { icon: TrendingUp, label: 'Occupancy Rate', value: pctFormatted, color: pct >= 75 ? '#dc2626' : '#16a34a' },
    { icon: Users, label: 'Registered Families', value: families.length, color: '#d97706' },
    { icon: HeartHandshake, label: '4Ps Beneficiaries', value: total4Ps, color: '#0284c7' },
    { icon: User, label: 'IP / Indigenous', value: totalIPs, color: '#9333ea' },
    { icon: ShieldAlert, label: 'Damaged Shelters', value: totalDamaged, color: '#e11d48' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Reports & Evacuee Analytics</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-slate-600 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Evacuation Center:</span>
            <select
              value={activeCenterId}
              onChange={e => setSelectedCenterId(e.target.value)}
              className="bg-white border border-slate-300 dark:bg-slate-800 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            >
              <option value="all">All Evacuation Centers</option>
              {centers.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
        <button onClick={exportCenterPDF}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors shadow-sm">
          <FileDown size={15} /> Export PDF Report
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {stats.map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Icon size={14} style={{ color }} />
              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider truncate">{label}</span>
            </div>
            <div className="text-xl font-black" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Occupancy bar */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Capacity Utilization — {centerName}</span>
          <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{current} / {total} occupants</span>
        </div>
        <div className="h-4 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-2">
          <div className="h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2"
            style={{ width: `${Math.max(pct, current > 0 ? 2 : 0)}%`, backgroundColor: pct >= 100 ? '#ef4444' : pct >= 75 ? '#f59e0b' : '#22c55e' }}>
            {pct > 15 && <span className="text-[10px] font-bold text-white">{pctFormatted}</span>}
          </div>
        </div>
        <div className="flex justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400">
          <span>0 occupants</span><span>{total} max capacity</span>
        </div>
      </div>

      {/* PDF Preview Modal */}
      {pdfPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-2xl w-full max-w-5xl flex flex-col shadow-2xl" style={{ height: '90vh' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
              <span className="text-sm font-bold text-slate-900 dark:text-white">PDF Preview — {pdfPreview.filename}</span>
              <div className="flex items-center gap-2">
                <a href={pdfPreview.url} download={pdfPreview.filename}
                  className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors font-bold shadow-sm">
                  <FileDown size={13} /> Download
                </a>
                <button onClick={() => setPdfPreview(null)} className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors p-1">
                  <X size={18} />
                </button>
              </div>
            </div>
            <iframe key={pdfPreview.url} src={pdfPreview.url} className="flex-1 w-full rounded-b-2xl" title="PDF Preview" />
          </div>
        </div>
      )}

      {/* FILTER BAR CARD */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
          <div className="flex items-center gap-2">
            <Filter size={15} className="text-blue-600 dark:text-blue-400" />
            <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Filter Evacuee Data</span>
          </div>
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{filteredAll.length} of {families.length} records matching</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Search */}
          <div className="lg:col-span-2">
            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1 uppercase tracking-wider">Search</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Search serial #, name, or barangay..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm" />
            </div>
          </div>

          {/* Barangay */}
          <div>
            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1 uppercase tracking-wider">Barangay</label>
            <select value={filterBrgy} onChange={e => setFilterBrgy(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white text-xs font-semibold rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm">
              <option value="">All Barangays</option>
              {BARANGAYS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          {/* Sex */}
          <div>
            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1 uppercase tracking-wider">Sex</label>
            <select value={filterGender} onChange={e => setFilterGender(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white text-xs font-semibold rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm">
              <option value="">All Genders</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>

          {/* Classification */}
          <div>
            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1 uppercase tracking-wider">4Ps / IP Category</label>
            <select value={filterClassification} onChange={e => setFilterClassification(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white text-xs font-semibold rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm">
              <option value="">All Categories</option>
              <option value="4Ps">4Ps Beneficiary</option>
              <option value="IP">IP (Indigenous)</option>
            </select>
          </div>

          {/* Shelter Damage */}
          <div>
            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1 uppercase tracking-wider">Shelter Damage</label>
            <select value={filterDamage} onChange={e => setFilterDamage(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white text-xs font-semibold rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm">
              <option value="">All Damage Status</option>
              <option value="Partially Damaged">Partially Damaged</option>
              <option value="Totally Damaged">Totally Damaged</option>
              <option value="Intact/Undamaged">Intact / Undamaged</option>
            </select>
          </div>
        </div>

        {/* Age Range & Reset */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Age Range:</span>
            <input type="number" min="0" max="120" placeholder="Min" value={filterAgeMin} onChange={e => setFilterAgeMin(e.target.value)}
              className="w-20 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white text-xs font-semibold rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm" />
            <span className="text-slate-400 text-xs font-bold">–</span>
            <input type="number" min="0" max="120" placeholder="Max" value={filterAgeMax} onChange={e => setFilterAgeMax(e.target.value)}
              className="w-20 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white text-xs font-semibold rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm" />
          </div>

          {(search || filterBrgy || filterGender || filterDamage || filterClassification || filterAgeMin || filterAgeMax) && (
            <button onClick={() => { setSearch(''); setFilterBrgy(''); setFilterGender(''); setFilterDamage(''); setFilterClassification(''); setFilterAgeMin(''); setFilterAgeMax(''); }}
              className="text-xs font-bold text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 border border-slate-300 dark:border-slate-600 px-3 py-1.5 rounded-xl transition-colors shadow-sm">
              Clear All Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Evacuee Data Table */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            FACED Evacuee Records ({isAll ? 'All Evacuation Centers' : centerName})
          </h3>
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{filteredAll.length} records found</span>
        </div>

        {filteredAll.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <Users size={36} className="mb-2 opacity-30" />
            <p className="text-xs font-semibold">No evacuee records match the selected filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                  {['#', 'Serial No.', 'Head of Family', 'Age/Sex', 'Barangay', 'Evacuees', '4Ps / IP', 'Damage Status', 'Bank / E-Wallet', 'Contact', 'Arrival Date', 'Center', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">
                {filteredAll.map((f, i) => (
                  <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 text-slate-500 font-medium">{i + 1}</td>
                    <td className="px-4 py-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                      {f.serial_number || 'MSWDO-' + (f.id ? f.id.slice(0, 6).toUpperCase() : '0000')}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                      {f.head_name || `${f.head_first_name || ''} ${f.head_last_name || ''}`}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">{f.age || '—'} / {f.gender || '—'}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">{f.barangay || '—'}</td>
                    <td className="px-4 py-3 font-bold text-blue-600 dark:text-blue-400">{f.members}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {f.is_4ps_beneficiary && <span className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 px-1.5 py-0.5 rounded font-bold">4Ps</span>}
                        {f.is_ip && <span className="text-[10px] bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 px-1.5 py-0.5 rounded font-bold">IP</span>}
                        {!f.is_4ps_beneficiary && !f.is_ip && <span className="text-slate-500">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {f.shelter_damage === 'Totally Damaged' ? (
                        <span className="text-[10px] bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 px-2 py-0.5 rounded-full font-bold">Totally Damaged</span>
                      ) : f.shelter_damage === 'Partially Damaged' ? (
                        <span className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 px-2 py-0.5 rounded-full font-bold">Partially Damaged</span>
                      ) : (
                        <span className="text-[10px] text-slate-500 font-medium">Intact</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">
                      {f.bank_ewallet ? `${f.bank_ewallet} (${f.account_number || 'No #'})` : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-mono font-medium">{f.contact || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap font-medium">
                      {f.arrival_date ? new Date(f.arrival_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-semibold">{f.center_name || '—'}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => generateFacedCardPDF(f)} title="Print FACED Card"
                        className="flex items-center gap-1 text-[11px] font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 px-2.5 py-1 rounded-lg border border-blue-200 dark:border-blue-700 transition-colors">
                        <Printer size={12} /> FACED Card
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
