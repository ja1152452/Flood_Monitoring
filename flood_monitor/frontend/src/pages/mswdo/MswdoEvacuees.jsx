import { useState, useMemo, Fragment } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getEvacuationCenters } from '../../api/evacuation';
import { useAuthStore } from '../../store/authStore';
import { Modal } from '../../components/ui/Modal';
import { Plus, Edit2, Trash2, Users, Search, Download, Filter, X, Printer, ShieldAlert, HeartHandshake, Home, CreditCard, User, MapPin, ChevronRight, ChevronLeft, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const BARANGAYS = [
  'Bagong Silang', 'Balimbingan', 'Balubad', 'Caliraya', 'Concepcion',
  'Lewin', 'Maracta', 'Maytalang I', 'Maytalang II', 'Poblacion',
  'Primera Parang', 'Primera Pulo', 'Salac', 'Segunda Parang',
  'Segunda Pulo', 'Santo Niño', 'Wawa',
];

const VULNERABILITY_OPTIONS = [
  'None',
  'Senior Citizen (60+)',
  'PWD (Person with Disability)',
  'Pregnant Woman',
  'Lactating Mother',
  'Solo Parent',
  'Infant (0-2 yrs)',
  'Child (3-12 yrs)',
  'Chronically Ill'
];

const RELATIONS = ['Spouse', 'Son', 'Daughter', 'Father', 'Mother', 'Brother', 'Sister', 'Grandparent', 'Grandchild', 'In-Law', 'Other Relative', 'Non-Relative'];
const CIVIL_STATUSES = ['Single', 'Married', 'Widowed', 'Separated', 'Co-habitation (Live-in)'];
const EDUCATION_LEVELS = ['None', 'Elementary Undergraduate', 'Elementary Graduate', 'High School Undergraduate', 'High School Graduate', 'Senior High School', 'Vocational', 'College Undergraduate', 'College Graduate', 'Post Graduate'];

const EMPTY = {
  // FACED Header & Serial
  serial_number: '',
  region: 'Region IV-A',
  province: 'Laguna',
  city_municipality: 'Lumban',
  district: '1st District',
  barangay: '',

  // Head of Family Details
  head_name: '',
  head_last_name: '',
  head_first_name: '',
  head_middle_name: '',
  head_name_ext: '',
  head_dob: '',
  age: '',
  gender: 'Male',
  head_place_of_birth: '',
  head_civil_status: 'Married',
  head_mothers_maiden_name: '',
  head_religion: '',
  head_occupation: '',
  head_monthly_income: '',
  head_id_card_presented: '',
  head_id_card_number: '',
  contact: '',
  contact_alternate: '',

  // Permanent Address
  house_lot_no: '',
  street: '',
  subd_village: '',
  zip_code: '4014',
  address: '',

  // Classifications
  is_4ps_beneficiary: false,
  is_ip: false,
  ethnicity: '',

  // Family members list
  members: 1,
  members_list: [
    {
      name: '',
      relation_to_head: 'Spouse',
      birthdate: '',
      age: '',
      sex: 'Female',
      gender: 'Female',
      educational_attainment: 'High School Graduate',
      occupation: '',
      vulnerability_type: 'None'
    }
  ],

  // Account Information
  bank_ewallet: '',
  account_name: '',
  account_type: 'E-Wallet',
  account_number: '',

  // Housing & Shelter
  house_ownership: 'Owner',
  shelter_damage: 'Partially Damaged',

  // Meta
  arrival_date: new Date().toISOString().slice(0, 16),
  notes: ''
};

const inputClass = 'w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm placeholder:text-slate-400 dark:placeholder:text-slate-500';
const labelClass = 'text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1 uppercase tracking-wider';

export default function MswdoEvacuees() {
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [filterBrgy, setFilterBrgy] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [filterDamage, setFilterDamage] = useState('');
  const [filterVulnerable, setFilterVulnerable] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [activeStep, setActiveStep] = useState(1);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const [expandedRow, setExpandedRow] = useState(null);
  const [pdfPreview, setPdfPreview] = useState(null);

  const now = new Date();
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const [wlFilter, setWlFilter] = useState({
    type: 'month',
    month: now.getMonth(),
    year: now.getFullYear(),
    date: now.toISOString().slice(0, 10),
    week: `${now.getFullYear()}-W${String(Math.ceil((now - new Date(now.getFullYear(), 0, 1)) / 604800000)).padStart(2, '0')}`,
  });

  function getWeekRange(weekStr) {
    const [year, w] = weekStr.split('-W');
    const jan4 = new Date(year, 0, 4);
    const s1 = new Date(jan4);
    s1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
    const start = new Date(s1);
    start.setDate(s1.getDate() + (parseInt(w) - 1) * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start, end };
  }

  const { data: centers = [] } = useQuery({
    queryKey: ['evacuation'],
    queryFn: getEvacuationCenters,
    refetchInterval: 15000,
  });

  const center = centers.find(c => c.id === user?.evacuation_center_id) || centers[0];

  const { data: families = [], isLoading } = useQuery({
    queryKey: ['families', center?.id],
    queryFn: () => api.get(`/evacuation/${center?.id}/families`).then(r => r.data.data),
    enabled: !!center?.id,
    refetchInterval: 10000,
  });

  const saveFamily = useMutation({
    mutationFn: (data) => {
      if (editing) return api.put(`/evacuation/${center?.id}/families/${editing.id}`, data);
      return api.post(`/evacuation/${center?.id}/families`, data);
    },
    onSuccess: () => {
      qc.invalidateQueries(['families', center?.id]);
      qc.invalidateQueries(['evacuation']);
      toast.success(editing ? 'FACED Record updated' : 'Evacuee registered with FACED Form');
      setShowModal(false);
      setEditing(null);
      setForm(EMPTY);
      setActiveStep(1);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Save failed'),
  });

  const deleteFamily = useMutation({
    mutationFn: (fid) => api.delete(`/evacuation/${center?.id}/families/${fid}`),
    onSuccess: () => {
      qc.invalidateQueries(['families', center?.id]);
      qc.invalidateQueries(['evacuation']);
      toast.success('Record removed');
    },
    onError: () => toast.error('Delete failed'),
  });

  const filtered = useMemo(() => {
    return families.filter(f => {
      if (wlFilter.type === 'month') {
        const arrDate = new Date(f.arrival_date);
        if (arrDate.getFullYear() !== wlFilter.year || arrDate.getMonth() !== wlFilter.month) return false;
      } else if (wlFilter.type === 'date') {
        const arrDateStr = f.arrival_date ? new Date(f.arrival_date).toISOString().slice(0, 10) : '';
        if (arrDateStr !== wlFilter.date) return false;
      } else if (wlFilter.type === 'week') {
        const arrDate = new Date(f.arrival_date);
        const { start, end } = getWeekRange(wlFilter.week);
        if (arrDate < start || arrDate > end) return false;
      }

      const matchSearch = !search ||
        f.head_name?.toLowerCase().includes(search.toLowerCase()) ||
        f.head_first_name?.toLowerCase().includes(search.toLowerCase()) ||
        f.head_last_name?.toLowerCase().includes(search.toLowerCase()) ||
        f.serial_number?.toLowerCase().includes(search.toLowerCase()) ||
        f.barangay?.toLowerCase().includes(search.toLowerCase()) ||
        f.address?.toLowerCase().includes(search.toLowerCase());
      
      const matchBrgy = !filterBrgy || f.barangay === filterBrgy;
      const matchGender = !filterGender || f.gender === filterGender;
      const matchDamage = !filterDamage || f.shelter_damage === filterDamage;

      let matchVulnerable = true;
      if (filterVulnerable) {
        matchVulnerable = f.members_list?.some(m => m.vulnerability_type && m.vulnerability_type.toLowerCase().includes(filterVulnerable.toLowerCase()));
      }

      return matchSearch && matchBrgy && matchGender && matchDamage && matchVulnerable;
    });
  }, [families, search, filterBrgy, filterGender, filterDamage, filterVulnerable, wlFilter]);

  const totalMembers = filtered.reduce((s, f) => s + (f.members || 0), 0);
  const total4Ps = filtered.filter(f => f.is_4ps_beneficiary).length;
  const totalIPs = filtered.filter(f => f.is_ip).length;

  const openAdd = () => { setEditing(null); setForm(EMPTY); setActiveStep(1); setShowModal(true); };
  const openEdit = (f) => {
    setEditing(f);
    setForm({
      serial_number: f.serial_number || '',
      region: f.region || 'Region IV-A',
      province: f.province || 'Laguna',
      city_municipality: f.city_municipality || 'Lumban',
      district: f.district || '1st District',
      barangay: f.barangay || '',

      head_name: f.head_name || '',
      head_last_name: f.head_last_name || '',
      head_first_name: f.head_first_name || '',
      head_middle_name: f.head_middle_name || '',
      head_name_ext: f.head_name_ext || '',
      head_dob: f.head_dob ? new Date(f.head_dob).toISOString().slice(0, 10) : '',
      age: f.age ? String(f.age) : '',
      gender: f.gender || 'Male',
      head_place_of_birth: f.head_place_of_birth || '',
      head_civil_status: f.head_civil_status || 'Married',
      head_mothers_maiden_name: f.head_mothers_maiden_name || '',
      head_religion: f.head_religion || '',
      head_occupation: f.head_occupation || '',
      head_monthly_income: f.head_monthly_income || '',
      head_id_card_presented: f.head_id_card_presented || '',
      head_id_card_number: f.head_id_card_number || '',
      contact: f.contact || '',
      contact_alternate: f.contact_alternate || '',

      house_lot_no: f.house_lot_no || '',
      street: f.street || '',
      subd_village: f.subd_village || '',
      zip_code: f.zip_code || '4014',
      address: f.address || '',

      is_4ps_beneficiary: !!f.is_4ps_beneficiary,
      is_ip: !!f.is_ip,
      ethnicity: f.ethnicity || '',

      members: f.members || (f.members_list?.length ? f.members_list.length + 1 : 1),
      members_list: f.members_list?.length ? f.members_list : [{ name: '', relation_to_head: 'Spouse', birthdate: '', age: '', gender: 'Female', sex: 'Female', educational_attainment: 'High School Graduate', occupation: '', vulnerability_type: 'None' }],

      bank_ewallet: f.bank_ewallet || '',
      account_name: f.account_name || '',
      account_type: f.account_type || 'E-Wallet',
      account_number: f.account_number || '',

      house_ownership: f.house_ownership || 'Owner',
      shelter_damage: f.shelter_damage || 'Partially Damaged',

      arrival_date: f.arrival_date ? new Date(f.arrival_date).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
      notes: f.notes || '',
    });
    setActiveStep(1);
    setShowModal(true);
  };

  const addMemberRow = () => {
    setForm(f => {
      const updatedList = [
        ...f.members_list,
        {
          name: '',
          relation_to_head: 'Son/Daughter',
          birthdate: '',
          age: '',
          gender: 'Male',
          sex: 'Male',
          educational_attainment: 'Elementary',
          occupation: '',
          vulnerability_type: 'None'
        }
      ];
      return {
        ...f,
        members_list: updatedList,
        members: updatedList.length + 1,
      };
    });
  };

  const removeMemberRow = (idx) => {
    setForm(f => {
      const list = f.members_list.filter((_, i) => i !== idx);
      return { ...f, members_list: list, members: list.length + 1 };
    });
  };

  const updateMember = (idx, field, val) => {
    setForm(f => {
      const list = [...f.members_list];
      list[idx] = { ...list[idx], [field]: val };
      return { ...f, members_list: list };
    });
  };

  const handleSave = () => {
    const headFullName = form.head_name.trim() || `${form.head_first_name} ${form.head_middle_name || ''} ${form.head_last_name} ${form.head_name_ext || ''}`.trim();
    if (!headFullName) { toast.error('Head of family name is required'); return; }
    if (!form.barangay) { toast.error('Barangay is required'); return; }

    saveFamily.mutate({
      ...form,
      head_name: headFullName,
      age: form.age ? parseInt(form.age) : null,
      members: (form.members_list?.filter(m => m.name.trim()).length || 0) + 1,
      members_list: form.members_list.filter(m => m.name.trim()),
    });
  };

  // Generate individual MSWDO FACED Card PDF matching photo template
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
    doc.text(`SERIAL NO: ${f.serial_number || 'MSWDO-' + (f.id ? f.id.slice(0, 8).toUpperCase() : '0000')}`, 138, 19);;

    // Section 1: LOCATION OF THE AFFECTED FAMILY
    doc.setFillColor(30, 41, 59);
    doc.rect(14, 23, 181, 5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('LOCATION OF THE AFFECTED FAMILY', 16, 26.5);
    doc.setTextColor(0, 0, 0);

    doc.rect(14, 28, 181, 12);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(`1. REGION: ${f.region || 'Region IV-A'}`, 16, 32);
    doc.text(`2. PROVINCE: ${f.province || 'Laguna'}`, 16, 36);
    doc.text(`3. CITY/ MUNICIPALITY: ${f.city_municipality || 'Lumban'}`, 70, 32);
    doc.text(`4. DISTRICT: ${f.district || '1st District'}`, 70, 36);
    doc.text(`5. BARANGAY: ${f.barangay || '—'}`, 130, 32);
    doc.text(`6. EVACUATION CENTER/ SITE: ${center?.name || '—'}`, 130, 36);

    // Section 2: HEAD OF THE FAMILY
    doc.setFillColor(30, 41, 59);
    doc.rect(14, 42, 181, 5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('HEAD OF THE FAMILY', 16, 45.5);
    doc.setTextColor(0, 0, 0);

    doc.rect(14, 47, 181, 46);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
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

    // Address & Classification
    doc.line(14, 88.5, 195, 88.5);
    doc.text(`23. PERMANENT ADDRESS: ${f.address || `${f.house_lot_no || ''} ${f.street || ''} ${f.subd_village || ''} Brgy. ${f.barangay || ''}, ${f.city_municipality || 'Lumban'}, ${f.province || 'Laguna'}`}`, 16, 92);
    
    // 4Ps and IP
    doc.text(`24. OTHERS:  [${f.is_4ps_beneficiary ? 'X' : ' '}] 4Ps Beneficiary    [${f.is_ip ? 'X' : ' '}] IP (Ethnicity: ${f.ethnicity || 'N/A'})`, 100, 92);

    // Section 3: FAMILY INFORMATION
    doc.setFillColor(30, 41, 59);
    doc.rect(14, 95, 181, 5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('FAMILY INFORMATION', 16, 98.5);
    doc.setTextColor(0, 0, 0);

    const membersTableRows = (f.members_list?.length ? f.members_list : []).map((m, i) => [
      i + 1,
      m.name,
      m.relation_to_head || '—',
      m.birthdate ? new Date(m.birthdate).toLocaleDateString('en-PH') : '—',
      m.age || '—',
      m.sex || m.gender || '—',
      m.educational_attainment || '—',
      m.occupation || '—',
      m.vulnerability_type || 'None',
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

    // Section 4: ACCOUNT INFORMATION
    doc.setFillColor(30, 41, 59);
    doc.rect(14, finalY + 3, 181, 5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('ACCOUNT INFORMATION (For Financial / Cash Assistance)', 16, finalY + 6.5);
    doc.setTextColor(0, 0, 0);

    doc.rect(14, finalY + 8, 181, 12);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`25. BANK/E-WALLET: ${f.bank_ewallet || 'N/A'}`, 16, finalY + 13);
    doc.text(`26. ACCOUNT NAME: ${f.account_name || 'N/A'}`, 16, finalY + 17);
    doc.text(`27. ACCOUNT TYPE: ${f.account_type || 'N/A'}`, 100, finalY + 13);
    doc.text(`28. ACCOUNT NUMBER: ${f.account_number || 'N/A'}`, 100, finalY + 17);

    // Section 5: HOUSING & SHELTER
    const yHousing = finalY + 22;
    doc.rect(14, yHousing, 181, 12);
    doc.text(`29. HOUSE OWNERSHIP: [${f.house_ownership === 'Owner' ? 'X' : ' '}] OWNER    [${f.house_ownership === 'Renter' ? 'X' : ' '}] RENTER    [${f.house_ownership === 'Sharer' ? 'X' : ' '}] SHARER`, 16, yHousing + 5);
    doc.text(`30. SHELTER DAMAGE CLASSIFICATION: [${f.shelter_damage === 'Partially Damaged' ? 'X' : ' '}] PARTIALLY DAMAGED    [${f.shelter_damage === 'Totally Damaged' ? 'X' : ' '}] TOTALLY DAMAGED`, 16, yHousing + 9.5);

    // Signatures Block
    const ySig = yHousing + 15;
    doc.rect(14, ySig, 181, 25);
    doc.rect(16, ySig + 2, 20, 20);
    doc.setFontSize(6);
    doc.text('Right Thumbmark', 17, ySig + 20);

    doc.line(45, ySig + 16, 110, ySig + 16);
    doc.setFontSize(7);
    doc.text('Signature / Thumbmark of Family Head', 48, ySig + 19);

    doc.line(125, ySig + 16, 188, ySig + 16);
    doc.text('Name / Signature of Barangay Captain', 130, ySig + 19);

    doc.line(45, ySig + 22, 110, ySig + 22);
    doc.text(`Date Registered: ${f.arrival_date ? new Date(f.arrival_date).toLocaleDateString('en-PH') : nowStr}`, 48, ySig + 24.5);

    doc.line(125, ySig + 22, 188, ySig + 22);
    doc.text('Name / Signature of LSWDO', 138, ySig + 24.5);

    // Privacy Declaration
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.text('DATA PRIVACY DECLARATION', 14, ySig + 28.5);
    doc.setFont('helvetica', 'normal');
    doc.text('All data and information indicated herein shall be used for identification purposes for the implementation of disaster risk reduction and management (DRRM) programs, projects, and activities in compliance to Republic Act 10173 (Data Privacy Act of 2012).', 14, ySig + 32, { maxWidth: 181 });

    const filename = `FACED_Card_${f.head_last_name || 'Evacuee'}_${f.serial_number || 'Record'}.pdf`;
    setPdfPreview({ url: doc.output('bloburl'), filename });
  };

  // Export Masterlist PDF
  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const nowStr = new Date().toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' });

    let periodLabel = '';
    if (wlFilter.type === 'month') {
      periodLabel = `${MONTHS[wlFilter.month]} ${wlFilter.year}`;
    } else if (wlFilter.type === 'date') {
      periodLabel = new Date(wlFilter.date).toLocaleDateString('en-PH', { dateStyle: 'long' });
    } else if (wlFilter.type === 'week') {
      const { start, end } = getWeekRange(wlFilter.week);
      periodLabel = `Week of ${start.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }

    const exportRows = filtered;
    const exportTotal = exportRows.reduce((s, f) => s + (f.members || 0), 0);

    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('MSWDO — Masterlist of Evacuees (FACED Registry)', 14, 15);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Evacuation Center: ${center?.name || '—'}`, 14, 21);
    doc.text(`Period: ${periodLabel}`, 14, 26);
    doc.text(`Generated: ${nowStr}`, 14, 31);
    doc.text(`Total Families: ${exportRows.length} | Total Members: ${exportTotal} | 4Ps Beneficiaries: ${total4Ps} | IP: ${totalIPs}`, 14, 36);

    autoTable(doc, {
      startY: 40,
      head: [['#', 'Serial No.', 'Head of Family', 'Age/Sex', 'Barangay', 'Members', '4Ps', 'Damage Status', 'Bank / E-Wallet Account', 'Contact', 'Arrival Date']],
      body: exportRows.map((f, i) => [
        i + 1,
        f.serial_number || '—',
        f.head_name || `${f.head_first_name || ''} ${f.head_last_name || ''}`,
        `${f.age || '—'} / ${f.gender || '—'}`,
        f.barangay || '—',
        f.members,
        f.is_4ps_beneficiary ? 'YES' : 'NO',
        f.shelter_damage || '—',
        f.bank_ewallet ? `${f.bank_ewallet}: ${f.account_number || ''}` : '—',
        f.contact || '—',
        f.arrival_date ? new Date(f.arrival_date).toLocaleDateString('en-PH') : '—',
      ]),
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    const fileLabel = wlFilter.type === 'date' ? wlFilter.date
      : wlFilter.type === 'week' ? wlFilter.week
        : `${wlFilter.year}-${String(wlFilter.month + 1).padStart(2, '0')}`;
    const filename = `MSWDO_Masterlist_${center?.name?.replace(/\s+/g, '_') || 'report'}_${fileLabel}.pdf`;
    setPdfPreview({ url: doc.output('bloburl'), filename });
  };

  const steps = [
    { number: 1, id: 'head', title: 'Head of Family', icon: User },
    { number: 2, id: 'address', title: 'Address & Classifications', icon: MapPin },
    { number: 3, id: 'members', title: 'Household Members', icon: Users },
    { number: 4, id: 'account', title: 'Account & Shelter', icon: CreditCard },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Evacuee Management</h1>
            <span className="text-xs px-3 py-1 rounded-full font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
              FACED Form Compliant
            </span>
          </div>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-0.5 font-medium">
            {center?.name} · {filtered.length} families · {totalMembers} total evacuees
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <button onClick={() => setShowFilter(v => !v)}
            className="flex items-center gap-2 bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600 text-xs font-bold px-3.5 py-2.5 rounded-xl transition-colors border border-slate-300 dark:border-slate-600 shadow-sm">
            <Filter size={14} /> Filter
          </button>
          
          {/* Period Filter */}
          {['month', 'date', 'week'].map(t => (
            <button key={t} onClick={() => setWlFilter(f => ({ ...f, type: t }))}
              className={`text-xs px-3 py-2.5 rounded-xl font-bold transition-colors shadow-sm ${wlFilter.type === t
                  ? 'bg-blue-600 text-white hover:bg-blue-500'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 dark:border-slate-600'
                }`}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
          {wlFilter.type === 'month' && (
            <>
              <select value={wlFilter.month} onChange={e => setWlFilter(f => ({ ...f, month: +e.target.value }))}
                className="bg-white border border-slate-300 text-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white text-xs font-semibold rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm">
                {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
              <select value={wlFilter.year} onChange={e => setWlFilter(f => ({ ...f, year: +e.target.value }))}
                className="bg-white border border-slate-300 text-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white text-xs font-semibold rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm">
                {Array.from({ length: 5 }, (_, i) => now.getFullYear() - i).map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </>
          )}
          {wlFilter.type === 'date' && (
            <input type="date" value={wlFilter.date}
              onChange={e => setWlFilter(f => ({ ...f, date: e.target.value }))}
              className="bg-white border border-slate-300 text-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white text-xs font-semibold rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm" />
          )}
          {wlFilter.type === 'week' && (
            <input type="week" value={wlFilter.week}
              onChange={e => setWlFilter(f => ({ ...f, week: e.target.value }))}
              className="bg-white border border-slate-300 text-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white text-xs font-semibold rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm" />
          )}
          
          <button onClick={exportPDF}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors shadow-sm">
            <Download size={14} /> Export Masterlist
          </button>
          <button onClick={openAdd}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors shadow-sm">
            <Plus size={14} /> Add Evacuee (FACED)
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Total Families', value: filtered.length, color: '#2563eb', icon: Users },
          { label: 'Total Evacuees', value: totalMembers, color: '#16a34a', icon: Users },
          { label: '4Ps Beneficiaries', value: total4Ps, color: '#d97706', icon: HeartHandshake },
          { label: 'IP / Indigenous', value: totalIPs, color: '#9333ea', icon: User },
          { label: 'Center Capacity', value: `${center?.capacity_current || 0} / ${center?.capacity_total || 0}`, color: '#0284c7', icon: Home },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">{label}</div>
              <div className="text-xl font-black" style={{ color }}>{value}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-700/50 text-slate-500">
              <Icon size={18} />
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      {showFilter && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex flex-wrap gap-3 items-end shadow-sm">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Barangay</label>
            <select value={filterBrgy} onChange={e => setFilterBrgy(e.target.value)}
              className="bg-white border border-slate-300 text-slate-900 dark:bg-slate-900 dark:border-slate-600 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 shadow-sm">
              <option value="">All Barangays</option>
              {BARANGAYS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Sex</label>
            <select value={filterGender} onChange={e => setFilterGender(e.target.value)}
              className="bg-white border border-slate-300 text-slate-900 dark:bg-slate-900 dark:border-slate-600 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 shadow-sm">
              <option value="">All</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Shelter Damage</label>
            <select value={filterDamage} onChange={e => setFilterDamage(e.target.value)}
              className="bg-white border border-slate-300 text-slate-900 dark:bg-slate-900 dark:border-slate-600 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 shadow-sm">
              <option value="">All Shelter Status</option>
              <option value="Partially Damaged">Partially Damaged</option>
              <option value="Totally Damaged">Totally Damaged</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Vulnerability</label>
            <select value={filterVulnerable} onChange={e => setFilterVulnerable(e.target.value)}
              className="bg-white border border-slate-300 text-slate-900 dark:bg-slate-900 dark:border-slate-600 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 shadow-sm">
              <option value="">All Vulnerabilities</option>
              {VULNERABILITY_OPTIONS.filter(v => v !== 'None').map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          {(filterBrgy || filterGender || filterDamage || filterVulnerable) && (
            <button onClick={() => { setFilterBrgy(''); setFilterGender(''); setFilterDamage(''); setFilterVulnerable(''); }}
              className="text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 dark:text-slate-300 dark:hover:text-white px-3 py-2 dark:bg-slate-700 rounded-xl transition-colors shadow-sm">
              Clear Filters
            </button>
          )}
        </div>
      )}

      {/* Main Table */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Search serial #, name, or barangay..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-white border border-slate-300 text-slate-900 dark:bg-slate-900 dark:border-slate-600 dark:text-white rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-blue-500 shadow-sm" />
          </div>
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{filtered.length} families found</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-500 text-sm font-semibold">Loading FACED records...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <Users size={36} className="mb-3 opacity-30" />
            <p className="text-sm font-semibold">No evacuee records found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                  {['#', 'Serial No.', 'Head of Family', 'Barangay', 'Evacuees', '4Ps / IP', 'Damage Status', 'Bank / E-Wallet', 'Registered', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">
                {filtered.map((f, i) => (
                  <Fragment key={f.id}>
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer"
                      onClick={() => setExpandedRow(expandedRow === f.id ? null : f.id)}>
                      <td className="px-4 py-3 text-slate-500 font-medium">{i + 1}</td>
                      <td className="px-4 py-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                        {f.serial_number || 'MSWDO-' + (f.id ? f.id.slice(0, 6).toUpperCase() : '0000')}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400 text-[10px]">{expandedRow === f.id ? '▼' : '▶'}</span>
                          <div>
                            <div>{f.head_name || `${f.head_first_name || ''} ${f.head_last_name || ''}`}</div>
                            {f.head_occupation && <div className="text-[10px] font-normal text-slate-600 dark:text-slate-400">{f.head_occupation}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">{f.barangay || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-lg border border-blue-200 dark:border-blue-700">
                          <Users size={11} /> {f.members}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {f.is_4ps_beneficiary && <span className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 px-1.5 py-0.5 rounded font-bold">4Ps</span>}
                          {f.is_ip && <span className="text-[10px] bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 px-1.5 py-0.5 rounded font-bold">IP</span>}
                          {!f.is_4ps_beneficiary && !f.is_ip && <span className="text-slate-600 dark:text-slate-400">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {f.shelter_damage === 'Totally Damaged' ? (
                          <span className="text-[10px] bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 px-2 py-0.5 rounded-full font-bold">Totally Damaged</span>
                        ) : f.shelter_damage === 'Partially Damaged' ? (
                          <span className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 px-2 py-0.5 rounded-full font-bold">Partially Damaged</span>
                        ) : (
                          <span className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">Intact</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">
                        {f.bank_ewallet ? `${f.bank_ewallet} (${f.account_number || 'No #'})` : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap font-medium">
                        {f.arrival_date ? new Date(f.arrival_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => generateFacedCardPDF(f)} title="Print FACED Card"
                            className="text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                            <Printer size={13} />
                          </button>
                          <button onClick={() => openEdit(f)} title="Edit Record"
                            className="text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                            <Edit2 size={13} />
                          </button>
                          <button onClick={() => { if (window.confirm('Remove this FACED evacuee record?')) deleteFamily.mutate(f.id); }} title="Delete Record"
                            className="text-slate-500 hover:text-red-600 dark:hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedRow === f.id && (
                      <tr className="bg-slate-50 dark:bg-slate-900/50">
                        <td colSpan={10} className="px-6 py-4">
                          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-4 shadow-sm">
                            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
                              <div>
                                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                                  MSWDO FACED Card Details — {f.serial_number || 'MSWDO-' + (f.id ? f.id.slice(0, 8).toUpperCase() : '')}
                                </h4>
                                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                                  Head: {f.head_name || `${f.head_first_name} ${f.head_last_name}`} · Civil Status: {f.head_civil_status || '—'} · Religion: {f.head_religion || '—'}
                                </p>
                              </div>
                              <button onClick={() => generateFacedCardPDF(f)}
                                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm">
                                <Printer size={12} /> Print Official FACED Form
                              </button>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                              <div>
                                <span className="text-[10px] font-bold text-slate-400 block uppercase">Address</span>
                                <span className="font-semibold text-slate-800 dark:text-slate-200">{f.address || `${f.house_lot_no || ''} ${f.street || ''} ${f.barangay || ''}`}</span>
                              </div>
                              <div>
                                <span className="text-[10px] font-bold text-slate-400 block uppercase">Contact Info</span>
                                <span className="font-semibold text-slate-800 dark:text-slate-200">{f.contact || '—'} {f.contact_alternate ? `(Alt: ${f.contact_alternate})` : ''}</span>
                              </div>
                              <div>
                                <span className="text-[10px] font-bold text-slate-400 block uppercase">E-Wallet / Bank Account</span>
                                <span className="font-semibold text-slate-800 dark:text-slate-200">{f.bank_ewallet ? `${f.bank_ewallet} - ${f.account_name} (${f.account_number})` : 'None Listed'}</span>
                              </div>
                              <div>
                                <span className="text-[10px] font-bold text-slate-400 block uppercase">House Ownership & Damage</span>
                                <span className="font-semibold text-slate-800 dark:text-slate-200">{f.house_ownership || '—'} · {f.shelter_damage || '—'}</span>
                              </div>
                            </div>

                            {/* Family Members Breakdown */}
                            <div>
                              <div className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Registered Household Members ({f.members_list?.length || 0})</div>
                              {f.members_list?.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                  {f.members_list.map((m, mi) => (
                                    <div key={mi} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-xs">
                                      <div className="font-bold text-slate-900 dark:text-white flex items-center justify-between">
                                        <span>{mi + 1}. {m.name}</span>
                                        {m.vulnerability_type && m.vulnerability_type !== 'None' && (
                                          <span className="text-[9px] bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 font-bold px-1.5 py-0.5 rounded">
                                            {m.vulnerability_type}
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[10px] text-slate-600 dark:text-slate-400 mt-1">
                                        Relation: {m.relation_to_head || 'Member'} · Age: {m.age || '—'} · Sex: {m.sex || m.gender || '—'}
                                      </div>
                                      {m.educational_attainment && <div className="text-[10px] text-slate-600 dark:text-slate-400">Educ: {m.educational_attainment}</div>}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-slate-500 italic">No additional family members listed.</p>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PDF Preview Modal */}
      {pdfPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-2xl w-full max-w-5xl flex flex-col shadow-2xl" style={{ height: '90vh' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
              <span className="text-sm font-bold text-slate-900 dark:text-white">PDF Document Preview — {pdfPreview.filename}</span>
              <div className="flex items-center gap-2">
                <a href={pdfPreview.url} download={pdfPreview.filename}
                  className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors font-bold shadow-sm">
                  <Download size={13} /> Download PDF
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

      {/* Add / Edit FACED Evacuee Modal */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditing(null); }}
        maxWidth="max-w-4xl"
        title={editing ? 'Edit FACED Evacuee Record' : 'MSWDO Family Assistance Card (FACED) Registration'}>
        <div className="space-y-5">
          {/* Step Progress Wizard Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-slate-100 dark:bg-slate-900/80 p-2 rounded-2xl border border-slate-200 dark:border-slate-700/80">
            {steps.map((step) => {
              const Icon = step.icon;
              const isActive = activeStep === step.number;
              const isCompleted = activeStep > step.number;
              return (
                <button key={step.number} type="button" onClick={() => setActiveStep(step.number)}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl text-left transition-all ${isActive
                      ? 'bg-blue-600 text-white shadow-md font-bold'
                      : isCompleted
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium'
                    }`}>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs ${isActive
                      ? 'bg-white/20 text-white font-bold'
                      : isCompleted
                        ? 'bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-white font-bold'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}>
                    {isCompleted ? <CheckCircle2 size={15} /> : step.number}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] opacity-75 uppercase tracking-wider block">Step {step.number}</div>
                    <div className="text-xs truncate">{step.title}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* STEP 1: HEAD OF FAMILY & LOCATION */}
          {activeStep === 1 && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/30 p-4 rounded-2xl border border-blue-200 dark:border-blue-800/60 flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-blue-900 dark:text-blue-200 uppercase tracking-wider">Official Control Serial Number</h4>
                  <p className="text-[11px] text-blue-700 dark:text-blue-300">Located on the top-right box of the MSWDO Family Assistance Card</p>
                </div>
                <input value={form.serial_number} onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))}
                  placeholder="e.g. FACED-2026-0012" className="w-52 bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs font-mono font-bold shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>

              <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 p-4 rounded-2xl space-y-3">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Location of the Affected Family</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className={labelClass}>Region</label>
                    <input value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Province</label>
                    <input value={form.province} onChange={e => setForm(f => ({ ...f, province: e.target.value }))} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>City / Municipality</label>
                    <input value={form.city_municipality} onChange={e => setForm(f => ({ ...f, city_municipality: e.target.value }))} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>District</label>
                    <input value={form.district} onChange={e => setForm(f => ({ ...f, district: e.target.value }))} className={inputClass} />
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 p-4 rounded-2xl space-y-3">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Head of the Family Demographics</div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className={labelClass}>Last Name <span className="text-red-500">*</span></label>
                    <input value={form.head_last_name} onChange={e => setForm(f => ({ ...f, head_last_name: e.target.value, head_name: `${e.target.value}, ${f.head_first_name}` }))}
                      placeholder="e.g. Dela Cruz" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>First Name <span className="text-red-500">*</span></label>
                    <input value={form.head_first_name} onChange={e => setForm(f => ({ ...f, head_first_name: e.target.value, head_name: `${f.head_last_name}, ${e.target.value}` }))}
                      placeholder="e.g. Juan" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Middle Name</label>
                    <input value={form.head_middle_name} onChange={e => setForm(f => ({ ...f, head_middle_name: e.target.value }))}
                      placeholder="e.g. Santos" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Ext (Jr., Sr., III)</label>
                    <input value={form.head_name_ext} onChange={e => setForm(f => ({ ...f, head_name_ext: e.target.value }))}
                      placeholder="e.g. Jr." className={inputClass} />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className={labelClass}>Date of Birth</label>
                    <input type="date" value={form.head_dob} onChange={e => {
                      const dob = e.target.value;
                      let age = form.age;
                      if (dob) {
                        const birthYear = new Date(dob).getFullYear();
                        age = String(new Date().getFullYear() - birthYear);
                      }
                      setForm(f => ({ ...f, head_dob: dob, age }));
                    }} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Age</label>
                    <input type="number" min="1" max="120" value={form.age} onChange={e => setForm(f => ({ ...f, age: e.target.value }))} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Sex</label>
                    <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))} className={inputClass}>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Civil Status</label>
                    <select value={form.head_civil_status} onChange={e => setForm(f => ({ ...f, head_civil_status: e.target.value }))} className={inputClass}>
                      {CIVIL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className={labelClass}>Place of Birth</label>
                    <input value={form.head_place_of_birth} onChange={e => setForm(f => ({ ...f, head_place_of_birth: e.target.value }))} placeholder="City / Municipality / Province" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Mother's Maiden Name</label>
                    <input value={form.head_mothers_maiden_name} onChange={e => setForm(f => ({ ...f, head_mothers_maiden_name: e.target.value }))} placeholder="Full Mother's Maiden Name" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Religion</label>
                    <input value={form.head_religion} onChange={e => setForm(f => ({ ...f, head_religion: e.target.value }))} placeholder="e.g. Roman Catholic" className={inputClass} />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className={labelClass}>Occupation</label>
                    <input value={form.head_occupation} onChange={e => setForm(f => ({ ...f, head_occupation: e.target.value }))} placeholder="e.g. Fisherman / Farmer" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Monthly Net Income</label>
                    <input value={form.head_monthly_income} onChange={e => setForm(f => ({ ...f, head_monthly_income: e.target.value }))} placeholder="e.g. ₱5,000" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Primary Contact <span className="text-red-500">*</span></label>
                    <input value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} placeholder="0917XXXXXXX" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Alternate Contact</label>
                    <input value={form.contact_alternate} onChange={e => setForm(f => ({ ...f, contact_alternate: e.target.value }))} placeholder="0918XXXXXXX" className={inputClass} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>ID Card Presented</label>
                    <input value={form.head_id_card_presented} onChange={e => setForm(f => ({ ...f, head_id_card_presented: e.target.value }))} placeholder="PhilHealth / Voter ID / UMID / National ID" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>ID Card Number</label>
                    <input value={form.head_id_card_number} onChange={e => setForm(f => ({ ...f, head_id_card_number: e.target.value }))} placeholder="ID Card Control Number" className={inputClass} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: PERMANENT ADDRESS & CLASSIFICATIONS */}
          {activeStep === 2 && (
            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 p-4 rounded-2xl space-y-3">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Item 23: Permanent Address of Affected Family</div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className={labelClass}>House / Lot / Block No.</label>
                    <input value={form.house_lot_no} onChange={e => setForm(f => ({ ...f, house_lot_no: e.target.value }))} placeholder="Blk 4 Lot 12" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Street</label>
                    <input value={form.street} onChange={e => setForm(f => ({ ...f, street: e.target.value }))} placeholder="Rizal St." className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Subdivision / Village / Purok</label>
                    <input value={form.subd_village} onChange={e => setForm(f => ({ ...f, subd_village: e.target.value }))} placeholder="Purok 3" className={inputClass} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className={labelClass}>Barangay <span className="text-red-500">*</span></label>
                    <select value={form.barangay} onChange={e => setForm(f => ({ ...f, barangay: e.target.value }))} className={inputClass}>
                      <option value="">— Select Barangay —</option>
                      {BARANGAYS.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>City / Municipality</label>
                    <input value={form.city_municipality} onChange={e => setForm(f => ({ ...f, city_municipality: e.target.value }))} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Zip Code</label>
                    <input value={form.zip_code} onChange={e => setForm(f => ({ ...f, zip_code: e.target.value }))} className={inputClass} />
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 p-4 rounded-2xl space-y-3">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Item 24: Others / Special Beneficiary Classifications</div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
                    <input type="checkbox" id="4ps" checked={form.is_4ps_beneficiary} onChange={e => setForm(f => ({ ...f, is_4ps_beneficiary: e.target.checked }))}
                      className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer" />
                    <label htmlFor="4ps" className="cursor-pointer">
                      <span className="text-xs font-bold text-slate-900 dark:text-white block">4Ps Beneficiary</span>
                      <span className="text-[11px] text-slate-500">Registered Pantawid Pamilyang Pilipino Program member</span>
                    </label>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="flex items-center gap-3">
                      <input type="checkbox" id="ip" checked={form.is_ip} onChange={e => setForm(f => ({ ...f, is_ip: e.target.checked }))}
                        className="w-5 h-5 rounded text-purple-600 focus:ring-purple-500 cursor-pointer" />
                      <label htmlFor="ip" className="cursor-pointer">
                        <span className="text-xs font-bold text-slate-900 dark:text-white block">IP (Indigenous Person)</span>
                        <span className="text-[11px] text-slate-500">Belongs to an indigenous cultural community</span>
                      </label>
                    </div>
                    {form.is_ip && (
                      <input value={form.ethnicity} onChange={e => setForm(f => ({ ...f, ethnicity: e.target.value }))}
                        placeholder="Type of Ethnicity (e.g. Dumagat, Remontado)" className={inputClass} />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: FAMILY MEMBERS */}
          {activeStep === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Item 3: Household Members Breakdown</h4>
                  <p className="text-[11px] text-slate-500">Add all family members living in the household with the family head.</p>
                </div>
                <button type="button" onClick={addMemberRow}
                  className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 flex items-center gap-1.5 px-3.5 py-2 rounded-xl shadow-sm transition-colors">
                  <Plus size={14} /> Add Household Member
                </button>
              </div>

              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {form.members_list.map((m, i) => (
                  <div key={i} className="bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Household Member #{i + 1}</span>
                      {form.members_list.length > 1 && (
                        <button type="button" onClick={() => removeMemberRow(i)} className="text-slate-400 hover:text-red-500 text-xs font-bold flex items-center gap-1">
                          <Trash2 size={13} /> Remove
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div className="md:col-span-2">
                        <label className={labelClass}>Full Name <span className="text-red-500">*</span></label>
                        <input type="text" placeholder="Full Name" value={m.name} onChange={e => updateMember(i, 'name', e.target.value)} className={inputClass} />
                      </div>
                      <div>
                        <label className={labelClass}>Relation to Head</label>
                        <select value={m.relation_to_head} onChange={e => updateMember(i, 'relation_to_head', e.target.value)} className={inputClass}>
                          {RELATIONS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Sex</label>
                        <select value={m.sex || m.gender} onChange={e => updateMember(i, 'sex', e.target.value)} className={inputClass}>
                          <option value="Female">Female</option>
                          <option value="Male">Male</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className={labelClass}>Birthdate</label>
                        <input type="date" value={m.birthdate} onChange={e => {
                          const dob = e.target.value;
                          let age = m.age;
                          if (dob) age = String(new Date().getFullYear() - new Date(dob).getFullYear());
                          updateMember(i, 'birthdate', dob);
                          updateMember(i, 'age', age);
                        }} className={inputClass} />
                      </div>
                      <div>
                        <label className={labelClass}>Age</label>
                        <input type="number" placeholder="Age" value={m.age} onChange={e => updateMember(i, 'age', e.target.value)} className={inputClass} />
                      </div>
                      <div>
                        <label className={labelClass}>Educ Attainment</label>
                        <select value={m.educational_attainment} onChange={e => updateMember(i, 'educational_attainment', e.target.value)} className={inputClass}>
                          {EDUCATION_LEVELS.map(e => <option key={e} value={e}>{e}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Type of Vulnerability</label>
                        <select value={m.vulnerability_type} onChange={e => updateMember(i, 'vulnerability_type', e.target.value)} className={inputClass}>
                          {VULNERABILITY_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 4: ACCOUNT & SHELTER */}
          {activeStep === 4 && (
            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 p-4 rounded-2xl space-y-3">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Account Information (Items 25-28)</div>
                <p className="text-[11px] text-slate-500">Specify bank or e-wallet account details for direct emergency financial assistance.</p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className={labelClass}>Bank / E-Wallet</label>
                    <input value={form.bank_ewallet} onChange={e => setForm(f => ({ ...f, bank_ewallet: e.target.value }))} placeholder="e.g. GCash / Maya / Landbank" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Account Name</label>
                    <input value={form.account_name} onChange={e => setForm(f => ({ ...f, account_name: e.target.value }))} placeholder="Account Name" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Account Type</label>
                    <input value={form.account_type} onChange={e => setForm(f => ({ ...f, account_type: e.target.value }))} placeholder="E-Wallet / Savings" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Account Number</label>
                    <input value={form.account_number} onChange={e => setForm(f => ({ ...f, account_number: e.target.value }))} placeholder="09XXXXXXXXX" className={inputClass} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 p-4 rounded-2xl">
                  <label className={labelClass}>Item 29: House Ownership Classification</label>
                  <select value={form.house_ownership} onChange={e => setForm(f => ({ ...f, house_ownership: e.target.value }))} className={inputClass}>
                    <option value="Owner">Owner</option>
                    <option value="Renter">Renter</option>
                    <option value="Sharer">Sharer</option>
                  </select>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 p-4 rounded-2xl">
                  <label className={labelClass}>Item 30: Shelter Damage Classification</label>
                  <select value={form.shelter_damage} onChange={e => setForm(f => ({ ...f, shelter_damage: e.target.value }))} className={inputClass}>
                    <option value="Partially Damaged">Partially Damaged</option>
                    <option value="Totally Damaged">Totally Damaged</option>
                    <option value="Intact/Undamaged">Intact / Undamaged</option>
                  </select>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 p-4 rounded-2xl space-y-3">
                <div>
                  <label className={labelClass}>Arrival / Intake Registration Date</label>
                  <input type="datetime-local" value={form.arrival_date} onChange={e => setForm(f => ({ ...f, arrival_date: e.target.value }))} className={inputClass} />
                </div>

                <div>
                  <label className={labelClass}>Remarks / Special Needs</label>
                  <textarea value={form.notes} rows={2} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Maintenance medicines, infants milk requirement, dietary or medical restrictions..." className={`${inputClass} resize-none`} />
                </div>
              </div>
            </div>
          )}

          {/* Modal Navigation Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
            <button type="button" onClick={() => { setShowModal(false); setEditing(null); }}
              className="bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white border-transparent text-xs font-bold px-4 py-2.5 rounded-xl transition-colors">
              Cancel
            </button>

            <div className="flex items-center gap-2">
              {activeStep > 1 && (
                <button type="button" onClick={() => setActiveStep(s => s - 1)}
                  className="flex items-center gap-1 bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600 text-xs font-bold px-4 py-2.5 rounded-xl transition-colors border border-slate-300 dark:border-slate-600">
                  <ChevronLeft size={14} /> Back
                </button>
              )}

              {activeStep < 4 ? (
                <button type="button" onClick={() => setActiveStep(s => s + 1)}
                  className="flex items-center gap-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-colors shadow-sm">
                  Next Step <ChevronRight size={14} />
                </button>
              ) : (
                <button type="button" onClick={handleSave} disabled={saveFamily.isPending}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold px-6 py-2.5 rounded-xl transition-colors shadow-md">
                  {saveFamily.isPending ? 'Saving FACED Record...' : editing ? 'Save Changes' : 'Submit & Register Evacuee'}
                </button>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
