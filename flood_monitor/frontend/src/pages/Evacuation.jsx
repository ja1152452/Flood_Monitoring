import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import lumbanBoundary from '../data/lumban-border.geojson';
import { getEvacuationCenters, updateEvacuationCenter, deleteEvacuationCenter } from '../api/evacuation';
import api from '../api/axios';
import { Modal } from '../components/ui/Modal';
import toast from 'react-hot-toast';
import { Plus, Edit2, Users, Trash2, Download, X, Printer, Maximize2, Minimize2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const LUMBAN_CENTER = [14.291969, 121.460112];

const BASEMAPS = {
  streets: {
    id: 'streets',
    name: 'Street',
    icon: '🗺️',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    labelsUrl: null,
    attribution: '&copy; OpenStreetMap contributors',
  },
  satellite: {
    id: 'satellite',
    name: 'Satellite',
    icon: '🛰️',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    labelsUrl: 'https://services.arcgisonline.com/arcgis/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri &copy; OpenStreetMap',
  },
  topo: {
    id: 'topo',
    name: 'Topographic',
    icon: '⛰️',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    labelsUrl: null,
    attribution: '&copy; OpenTopoMap &copy; OpenStreetMap',
  },
  dark: {
    id: 'dark',
    name: 'Dark',
    icon: '🌙',
    url: 'https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    labelsUrl: 'https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, HERE, Garmin, &copy; OpenStreetMap',
  },
};

const EMPTY_FORM = {
  name: '', barangay: '', address: '',
  lat: '', lng: '', capacity_total: '',
  contact_person: '', contact_number: '', is_open: false,
};

const BARANGAYS = [
  'Bagong Silang', 'Balimbingan', 'Balubad', 'Caliraya',
  'Concepcion', 'Lewin', 'Maracta', 'Maytalang I', 'Maytalang II',
  'Primera Parang', 'Primera Pulo', 'Salac',
  'Segunda Parang', 'Segunda Pulo', 'Santo Niño', 'Wawa',
];

const inputClass = "w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-red-500 shadow-sm";

function Field({ label, required, children }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = 'text', ...props }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      autoComplete="off"
      className={inputClass}
      {...props}
    />
  );
}

function LocationPicker({ onPick }) {
  useMapEvents({
    click(e) { onPick(e.latlng.lat, e.latlng.lng); },
  });
  return null;
}

function MapResizeController({ isFullScreen }) {
  const map = useMap();
  useEffect(() => {
    const handleResize = () => map.invalidateSize();
    handleResize();
    const t1 = setTimeout(handleResize, 60);
    const t2 = setTimeout(handleResize, 200);
    const t3 = setTimeout(handleResize, 500);
    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener('resize', handleResize);
    };
  }, [isFullScreen, map]);
  return null;
}

export default function Evacuation() {
  const qc = useQueryClient();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [pinned, setPinned] = useState(null);
  const [activeTab, setActiveTab] = useState('centers');
  const [pdfPreview, setPdfPreview] = useState(null);
  const [selectedCenter, setSelectedCenter] = useState(null);
  const [filterGender, setFilterGender] = useState('');
  const [filterAgeMin, setFilterAgeMin] = useState('');
  const [filterAgeMax, setFilterAgeMax] = useState('');
  const [mapBasemap, setMapBasemap] = useState('streets');
  const [isMapFullScreen, setIsMapFullScreen] = useState(false);
  const mapContainerRef = useRef(null);

  const toggleFullScreen = () => {
    const el = mapContainerRef.current;
    if (!el) return;

    if (!document.fullscreenElement && !isMapFullScreen) {
      if (el.requestFullscreen) {
        el.requestFullscreen().catch(() => {
          setIsMapFullScreen(true);
        });
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
      } else {
        setIsMapFullScreen(true);
      }
    } else {
      if (document.fullscreenElement) {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }
      }
      setIsMapFullScreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      const isFs = document.fullscreenElement === mapContainerRef.current;
      setIsMapFullScreen(isFs);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isMapFullScreen) {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
        setIsMapFullScreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMapFullScreen]);

  const { data: centers = [] } = useQuery({
    queryKey: ['evacuation'],
    queryFn: getEvacuationCenters,
    refetchInterval: 30000,
  });

  const { data: allFamilies = [] } = useQuery({
    queryKey: ['all-families'],
    queryFn: () => api.get('/evacuation/all-families').then(r => r.data.data),
    refetchInterval: 15000,
  });

  const addCenter = useMutation({
    mutationFn: (data) => api.post('/evacuation', data).then(r => r.data.data),
    onSuccess: () => {
      toast.success('Evacuation center added');
      qc.invalidateQueries(['evacuation']);
      setShowAddModal(false);
      setForm(EMPTY_FORM);
      setPinned(null);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to add'),
  });

  const updateCenter = useMutation({
    mutationFn: ({ id, data }) => updateEvacuationCenter(id, data),
    onSuccess: () => {
      toast.success('Center updated');
      qc.invalidateQueries(['evacuation']);
      setShowEditModal(false);
    },
    onError: () => toast.error('Update failed'),
  });

  const removeCenter = useMutation({
    mutationFn: (id) => deleteEvacuationCenter(id),
    onSuccess: () => { toast.success('Center deleted'); qc.invalidateQueries(['evacuation']); },
    onError: () => toast.error('Delete failed'),
  });

  const handleAddSubmit = () => {
    if (!form.name || !form.barangay || !form.lat || !form.lng || !form.capacity_total) {
      toast.error('Fill in all required fields and pick a location on the map');
      return;
    }
    addCenter.mutate({
      name: form.name,
      barangay: form.barangay,
      address: form.address,
      lat: parseFloat(form.lat),
      lng: parseFloat(form.lng),
      capacity_total: parseInt(form.capacity_total),
      contact_person: form.contact_person,
      contact_number: form.contact_number,
      is_open: form.is_open,
    });
  };

  const openEdit = (center) => {
    setEditTarget(center);
    setForm({
      name: center.name,
      barangay: center.barangay_name || '',
      address: center.address || '',
      lat: center.lat,
      lng: center.lng,
      capacity_total: center.capacity_total,
      capacity_current: center.capacity_current,
      contact_person: center.contact_person || '',
      contact_number: center.contact_number || '',
      is_open: center.is_open,
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = () => {
    updateCenter.mutate({
      id: editTarget.id,
      data: {
        name: form.name,
        address: form.address,
        capacity_total: parseInt(form.capacity_total),
        capacity_current: parseInt(form.capacity_current || 0),
        contact_person: form.contact_person,
        contact_number: form.contact_number,
        is_open: form.is_open,
      },
    });
  };

  const exportCentersPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const now = new Date().toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' });
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text('MDRRMO — Evacuation Centers', 14, 16);
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${now}`, 14, 23);
    doc.text(`Total Centers: ${centers.length}   Open: ${centers.filter(c => c.is_open).length}`, 14, 29);
    autoTable(doc, {
      startY: 34,
      head: [['#', 'Center Name', 'Barangay', 'Address', 'Capacity', 'Occupancy', 'Contact Person', 'Contact Number', 'Status']],
      body: centers.map((c, i) => [
        i + 1,
        c.name,
        c.barangay_name || '—',
        c.address || '—',
        c.capacity_total,
        `${c.capacity_current} (${c.capacity_total > 0 ? Math.round((c.capacity_current / c.capacity_total) * 100) : 0}%)`,
        c.contact_person || '—',
        c.contact_number || '—',
        c.is_open ? 'OPEN' : 'CLOSED',
      ]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [220, 38, 38], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [241, 245, 249] },
    });
    const filename = `evacuation_centers_${new Date().toISOString().slice(0, 10)}.pdf`;
    setPdfPreview({ url: doc.output('bloburl'), filename });
  };

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
    doc.text(`6. EVACUATION CENTER/ SITE: ${f.center_name || selectedCenter?.name || '—'}`, 130, 36);

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

  const exportAllPDF = () => {
    const familiesToExport = allFamilies.filter(f => {
      if (selectedCenter && f.evacuation_center_id !== selectedCenter.id) return false;
      if (filterGender && f.gender !== filterGender) return false;
      const age = f.age ? parseInt(f.age) : null;
      if (filterAgeMin && (age === null || age < parseInt(filterAgeMin))) return false;
      if (filterAgeMax && (age === null || age > parseInt(filterAgeMax))) return false;
      return true;
    });

    if (familiesToExport.length === 0) {
      toast.error('No families match the active filters to export');
      return;
    }

    const centerName = selectedCenter ? selectedCenter.name : 'All Centers';

    const doc = new jsPDF({ orientation: 'landscape' });
    const now = new Date().toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' });
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text(`MDRRMO — Evacuee Records (FACED Registry)${selectedCenter ? ` — ${centerName}` : ''}`, 14, 16);
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${now}`, 14, 23);

    const filterNotes = [];
    if (filterGender) filterNotes.push(`Gender: ${filterGender}`);
    if (filterAgeMin || filterAgeMax) filterNotes.push(`Age: ${filterAgeMin || '0'} - ${filterAgeMax || '120+'}`);
    const filterSub = filterNotes.length > 0 ? `   [Filters Applied: ${filterNotes.join(', ')}]` : '';

    doc.text(`Total Families: ${familiesToExport.length}   Total Members: ${familiesToExport.reduce((s, f) => s + (f.members || 0), 0)}${filterSub}`, 14, 29);
    autoTable(doc, {
      startY: 34,
      head: [['#', 'Serial No.', 'Head of Family', 'Age/Sex', 'Address', 'Barangay', 'Members', '4Ps/IP', 'Damage Status', 'Bank / E-Wallet', 'Contact', 'Arrival Date', selectedCenter ? '' : 'Center']].map(row => row.filter(h => h !== '')),
      body: familiesToExport.map((f, i) => {
        const row = [
          i + 1,
          f.serial_number || '—',
          f.head_name || `${f.head_first_name || ''} ${f.head_last_name || ''}`,
          `${f.age || '—'} / ${f.gender || '—'}`,
          f.address || '—',
          f.barangay || '—',
          f.members,
          `${f.is_4ps_beneficiary ? '4Ps' : ''}${f.is_4ps_beneficiary && f.is_ip ? ' / ' : ''}${f.is_ip ? 'IP' : ''}` || 'None',
          f.shelter_damage || '—',
          f.bank_ewallet ? `${f.bank_ewallet} (${f.account_number || ''})` : '—',
          f.contact || '—',
          f.arrival_date ? new Date(f.arrival_date).toLocaleDateString('en-PH') : '—',
        ];
        if (!selectedCenter) row.push(f.center_name || '—');
        return row;
      }),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [220, 38, 38], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [241, 245, 249] },
    });
    const filename = `evacuees_${selectedCenter ? selectedCenter.name.replace(/\s+/g, '_') : 'all'}_${new Date().toISOString().slice(0, 10)}.pdf`;
    setPdfPreview({ url: doc.output('bloburl'), filename });
  };

  return (
    <div className="space-y-6">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Evacuation Centers</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {centers.filter(c => c.is_open).length} open · {centers.length} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCentersPDF}
            className="flex items-center gap-2 bg-green-700 hover:bg-green-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors">
            <Download size={15} /> Export Centers PDF
          </button>
          <button
            onClick={() => { setForm(EMPTY_FORM); setPinned(null); setShowAddModal(true); }}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors">
            <Plus size={16} />
            Add Center
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1 w-fit shadow-sm dark:shadow-none">
        {[['centers', 'Centers'], ['evacuees', 'Evacuee Records']].map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === key ? 'bg-red-600 text-white' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}>{label}</button>
        ))}
      </div>

      {activeTab === 'evacuees' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              {selectedCenter ? (
                <div className="flex items-center gap-3">
                  <button onClick={() => setSelectedCenter(null)}
                    className="text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div>
                    <h3 className="text-lg font-bold text-white">{selectedCenter.name}</h3>
                    <p className="text-slate-400 text-sm">
                      {allFamilies.filter(f => f.evacuation_center_id === selectedCenter.id).length} families · {allFamilies.filter(f => f.evacuation_center_id === selectedCenter.id).reduce((s, f) => s + (f.members || 0), 0)} members
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-slate-400 text-sm">
                  {allFamilies.length} families · {allFamilies.reduce((s, f) => s + (f.members || 0), 0)} total members across all centers
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select value={filterGender} onChange={e => setFilterGender(e.target.value)}
                className="bg-slate-200 border border-slate-300 text-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">All Genders</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
              <input type="number" min="0" max="120" placeholder="Age min" value={filterAgeMin}
                onChange={e => setFilterAgeMin(e.target.value)}
                className="w-20 bg-slate-200 border border-slate-300 text-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="number" min="0" max="120" placeholder="Age max" value={filterAgeMax}
                onChange={e => setFilterAgeMax(e.target.value)}
                className="w-20 bg-slate-200 border border-slate-300 text-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              {(filterGender || filterAgeMin || filterAgeMax) && (
                <button onClick={() => { setFilterGender(''); setFilterAgeMin(''); setFilterAgeMax(''); }}
                  className="text-xs text-slate-700 hover:text-slate-900 bg-slate-200 hover:bg-slate-300 dark:text-slate-400 dark:hover:text-white px-2 py-1.5 dark:bg-slate-700 rounded-lg transition-colors">Clear</button>
              )}
              <button onClick={exportAllPDF}
                className="flex items-center gap-2 bg-green-700 hover:bg-green-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors">
                <Download size={15} /> Export PDF
              </button>
            </div>
          </div>

          {/* Show center cards if no center selected */}
          {!selectedCenter ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {centers.map(center => {
                const centerFamilies = allFamilies.filter(f => f.evacuation_center_id === center.id);
                const totalMembers = centerFamilies.reduce((s, f) => s + (f.members || 0), 0);

                return (
                  <button
                    key={center.id}
                    onClick={() => setSelectedCenter(center)}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 text-left hover:border-red-500 transition-all hover:shadow-lg hover:shadow-red-500/10 shadow-sm dark:shadow-none"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{center.name}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">📍 {center.barangay_name}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${center.is_open ? 'bg-emerald-100 text-emerald-800 dark:bg-green-900 dark:text-green-300' : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-400'
                        }`}>
                        {center.is_open ? 'OPEN' : 'CLOSED'}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-900 dark:text-white font-semibold">{center.capacity_current} <span className="text-slate-400 text-xs font-normal">/ {center.capacity_total}</span></span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">Total Members</span>
                        <span className="text-blue-400 font-semibold">{totalMembers}</span>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500 text-center">
                      Click to view details →
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (() => {
            const rows = allFamilies.filter(f => {
              if (f.evacuation_center_id !== selectedCenter.id) return false;
              if (filterGender && f.gender !== filterGender) return false;
              const age = f.age ? parseInt(f.age) : null;
              if (filterAgeMin && (age === null || age < parseInt(filterAgeMin))) return false;
              if (filterAgeMax && (age === null || age > parseInt(filterAgeMax))) return false;
              return true;
            });
            return (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm dark:shadow-none">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                        {['#', 'Serial No.', 'Head of Family', 'Age/Sex', 'Barangay', 'Evacuees', '4Ps / IP', 'Damage Status', 'Bank / E-Wallet', 'Arrival Date', 'Actions'].map(h => (
                          <th key={h} className="px-4 py-3 text-left font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">
                      {rows.length === 0 ? (
                        <tr><td colSpan={11} className="px-5 py-10 text-center text-slate-500 font-semibold">No families match the current filters</td></tr>
                      ) : rows.map((f, i) => (
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
                          <td className="px-4 py-3 text-blue-600 dark:text-blue-400 font-bold">{f.members}</td>
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
                            {f.bank_ewallet ? `${f.bank_ewallet} (${f.account_number || ''})` : '—'}
                          </td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs whitespace-nowrap font-medium">
                            {f.arrival_date ? new Date(f.arrival_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                          </td>
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
              </div>
            );
          })()}

          {!selectedCenter && allFamilies.length === 0 && (
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-10 text-center text-slate-500 shadow-sm dark:shadow-none">
              No evacuee records yet
            </div>
          )}
        </div>
      )}

      {activeTab === 'centers' && (<>

        <div
          ref={mapContainerRef}
          style={{ height: isMapFullScreen ? '100vh' : 'auto', width: '100%' }}
          className={`relative overflow-hidden flex flex-col shadow-sm dark:shadow-none transition-all ${
            isMapFullScreen
              ? 'fixed inset-0 z-[5000] w-screen h-screen rounded-none border-none bg-slate-950'
              : 'bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700'
          }`}
        >
          <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between flex-wrap gap-2 shrink-0">
            <div>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-300">Evacuation Centers Map — Lumban, Laguna</h3>
              <p className="text-xs text-slate-500 mt-0.5">Click a marker to see capacity and contact details</p>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Fullscreen Button */}
              <button
                onClick={toggleFullScreen}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                  isMapFullScreen
                    ? 'bg-red-600 text-white border-red-500 shadow-md'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                }`}
                title="Toggle Fullscreen Map View (Entire Monitor)"
              >
                {isMapFullScreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                <span>{isMapFullScreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
              </button>

              {/* Basemap Switcher */}
              <div className="flex bg-slate-100 dark:bg-slate-900/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                {Object.values(BASEMAPS).map(bm => (
                  <button
                    key={bm.id}
                    onClick={() => setMapBasemap(bm.id)}
                    className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                      mapBasemap === bm.id
                        ? 'bg-red-600 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>{bm.icon}</span>
                    <span className="hidden sm:inline">{bm.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <MapContainer center={LUMBAN_CENTER} zoom={15} style={{ flex: 1, minHeight: isMapFullScreen ? 'calc(100vh - 58px)' : '460px', width: '100%', background: '#09101d' }}>
            <MapResizeController isFullScreen={isMapFullScreen} />
            <TileLayer
              key={mapBasemap}
              url={BASEMAPS[mapBasemap].url}
              attribution={BASEMAPS[mapBasemap].attribution}
              maxZoom={19}
            />
            {BASEMAPS[mapBasemap].labelsUrl && (
              <TileLayer url={BASEMAPS[mapBasemap].labelsUrl} maxZoom={19} />
            )}
            <GeoJSON key="lumban-border" data={lumbanBoundary} style={{ color: '#ef4444', weight: 2, fillOpacity: 0, dashArray: '6 3' }} interactive={false} />
            {centers.map(center => {
              const cap = Number(center.capacity_total) || 100;
              const curr = Number(center.capacity_current) || 0;
              const pct = Math.min(100, Math.round((curr / cap) * 100));
              const statusColor = pct >= 90 ? '#dc2626' : pct >= 70 ? '#d97706' : '#16a34a';
              const statusBorder = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#22c55e';

              return (
                <Marker
                  key={center.id}
                  position={[center.lat, center.lng]}
                  icon={L.divIcon({
                    html: `
                      <div style="
                        background:${center.is_open ? statusColor : '#64748b'};
                        color:white;
                        border:2px solid white;
                        box-shadow:0 0 0 2px ${center.is_open ? statusBorder : '#94a3b8'}, 0 4px 10px rgba(0,0,0,0.35);
                        border-radius:9999px;
                        padding:3px 8px;
                        display:flex;
                        align-items:center;
                        gap:4px;
                        font-family:sans-serif;
                        white-space:nowrap;
                        font-weight:800;
                        font-size:11px;
                      ">
                        <span>🏠</span>
                        <span>${pct}%</span>
                      </div>`,
                    className: '',
                    iconSize: [54, 24],
                    iconAnchor: [27, 12],
                  })}
                >
                  <Popup>
                    <div style={{ minWidth: 230, fontFamily: 'sans-serif', padding: '6px 2px', lineHeight: 1.5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <strong style={{ fontSize: 13, color: '#0f172a' }}>{center.name}</strong>
                        <span style={{
                          background: center.is_open ? (pct >= 90 ? '#fee2e2' : '#dcfce7') : '#f1f5f9',
                          color: center.is_open ? (pct >= 90 ? '#dc2626' : '#16a34a') : '#64748b',
                          padding: '2px 8px', borderRadius: 999,
                          fontSize: 10, fontWeight: 800,
                        }}>
                          {center.is_open ? (pct >= 100 ? 'FULL' : `${pct}% FULL`) : 'CLOSED'}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>📍 {center.barangay_name}</div>
                      {center.address && <div style={{ fontSize: 11, color: '#475569', marginBottom: 6 }}>{center.address}</div>}
                      
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 8px', fontSize: 11, marginBottom: 8 }}>
                        <div><b>Occupancy:</b> {curr} / {cap} Individuals</div>
                        <div><b>Available Slots:</b> {Math.max(0, cap - curr)}</div>
                        {center.contact_person && <div><b>Manager:</b> {center.contact_person} ({center.contact_number || 'N/A'})</div>}
                      </div>

                      <div style={{ display: 'flex', gap: 6 }}>
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${center.lat},${center.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            background: '#2563eb',
                            color: 'white',
                            padding: '5px 10px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 700,
                            textDecoration: 'none'
                          }}
                        >
                          🗺️ Get Directions
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCenter(center);
                            setActiveTab('evacuees');
                          }}
                          style={{
                            background: '#f1f5f9',
                            color: '#334155',
                            border: '1px solid #cbd5e1',
                            padding: '5px 10px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          View Families →
                        </button>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {centers.map(center => {
            const pct = center.capacity_total > 0 ? Math.round((center.capacity_current / center.capacity_total) * 100) : 0;
            const full = pct >= 100;
            return (
              <div key={center.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm dark:shadow-none">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0 pr-2">
                    <h4 className="font-semibold text-slate-900 dark:text-white text-base">{center.name}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">📍 {center.barangay_name}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${center.is_open ? full ? 'bg-rose-100 text-rose-800 dark:bg-red-900 dark:text-red-300' : 'bg-emerald-100 text-emerald-800 dark:bg-green-900 dark:text-green-300' : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-400'}`}>
                      {center.is_open ? (full ? 'FULL' : 'OPEN') : 'CLOSED'}
                    </span>
                    <button onClick={() => openEdit(center)} className="text-slate-400 hover:text-blue-400 transition-colors">
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => { if (window.confirm(`Delete "${center.name}"?`)) removeCenter.mutate(center.id); }}
                      className="text-slate-400 hover:text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <Users size={13} className="text-slate-500" />
                  <span className="text-xs text-slate-400">{center.capacity_current} / {center.capacity_total} evacuees</span>
                </div>
                <div className="mb-3">
                  <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                </div>
                {center.contact_person && (
                  <div className="text-xs text-slate-500">👤 {center.contact_person}{center.contact_number && ` · ${center.contact_number}`}</div>
                )}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => updateCenter.mutate({ id: center.id, data: { is_open: !center.is_open } })}
                    className={`flex-1 text-xs py-2 rounded-lg font-medium transition-colors ${center.is_open ? 'bg-red-100 hover:bg-red-200 text-red-800 dark:bg-red-900 dark:hover:bg-red-800 dark:text-red-200' : 'bg-green-100 hover:bg-green-200 text-green-800 dark:bg-green-900 dark:hover:bg-green-800 dark:text-green-200'}`}>
                    {center.is_open ? 'Close Center' : 'Open Center'}
                  </button>
                  <button
                    onClick={() => {
                      setSelectedCenter(center);
                      setActiveTab('evacuees');
                    }}
                    className="text-xs py-2 px-3 rounded-lg font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white transition-colors"
                  >
                    View Families →
                  </button>
                  <div className="flex items-center gap-1">
                    <input
                      type="number" min="0" max={center.capacity_total}
                      defaultValue={center.capacity_current}
                      className="w-16 text-xs bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-2 text-slate-900 dark:text-white text-center"
                      onBlur={e => updateCenter.mutate({ id: center.id, data: { capacity_current: parseInt(e.target.value) || 0 } })}
                    />
                    <span className="text-xs text-slate-500">evacuees</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </>)}

      {/* PDF Preview Modal */}
      {pdfPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-2xl w-full max-w-5xl flex flex-col shadow-2xl" style={{ height: '90vh' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
              <span className="text-sm font-semibold text-slate-800 dark:text-white">PDF Preview — {pdfPreview.filename}</span>
              <div className="flex items-center gap-2">
                <a href={pdfPreview.url} download={pdfPreview.filename}
                  className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors">
                  <Download size={13} /> Download
                </a>
                <button onClick={() => setPdfPreview(null)} className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white transition-colors p-1">
                  <X size={18} />
                </button>
              </div>
            </div>
            <iframe src={pdfPreview.url} className="flex-1 w-full rounded-b-2xl" title="PDF Preview" />
          </div>
        </div>
      )}

      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Evacuation Center">
        <div className="space-y-4">
          <div className="bg-blue-900/30 border border-blue-700 rounded-xl p-3 text-xs text-blue-300">
            📌 <span className="text-blue-900 font-bold px-1 rounded">Click on the map below to pin the exact location.</span>
          </div>

          <MapContainer center={LUMBAN_CENTER} zoom={15} style={{ height: '220px', width: '100%', borderRadius: '10px' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
            <LocationPicker onPick={(lat, lng) => {
              setPinned({ lat, lng });
              setForm(f => ({ ...f, lat: lat.toFixed(6), lng: lng.toFixed(6) }));
            }} />
            {pinned && <Marker position={[pinned.lat, pinned.lng]}><Popup>📍 Selected location</Popup></Marker>}
          </MapContainer>

          {form.lat && (
            <div className="text-xs text-green-400 bg-green-900/20 rounded-lg px-3 py-2">
              ✓ Pinned: {parseFloat(form.lat).toFixed(5)}, {parseFloat(form.lng).toFixed(5)}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Center Name" required>
              <Input value={form.name} placeholder="e.g. Wawa Covered Court"
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </Field>
            <Field label="Barangay" required>
              <select value={form.barangay}
                onChange={e => setForm(f => ({ ...f, barangay: e.target.value }))}
                className={inputClass}>
                <option value="">Select barangay</option>
                {BARANGAYS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Address / Landmark">
            <Input value={form.address} placeholder="e.g. Brgy. Hall Compound"
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude" required>
              <Input
                type="text"
                inputMode="decimal"
                value={form.lat}
                placeholder="Click map to set (e.g. 14.300)"
                onChange={e => setForm(f => ({ ...f, lat: e.target.value.replace(/[^0-9.-]/g, '') }))}
              />
            </Field>
            <Field label="Longitude" required>
              <Input
                type="text"
                inputMode="decimal"
                value={form.lng}
                placeholder="Click map to set (e.g. 121.460)"
                onChange={e => setForm(f => ({ ...f, lng: e.target.value.replace(/[^0-9.-]/g, '') }))}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Total Capacity" required>
              <Input
                type="text"
                inputMode="numeric"
                value={form.capacity_total}
                placeholder="e.g. 200"
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, '');
                  setForm(f => ({ ...f, capacity_total: val }));
                }}
              />
            </Field>
            <Field label="Contact Person">
              <Input value={form.contact_person} placeholder="Brgy. Captain name"
                onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} />
            </Field>
          </div>

          <Field label="Contact Number">
            <Input
              type="tel"
              inputMode="numeric"
              maxLength={11}
              value={form.contact_number}
              placeholder="09171234567"
              onChange={e => {
                const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 11);
                setForm(f => ({ ...f, contact_number: val }));
              }}
            />
          </Field>

          <div className="flex items-center gap-3">
            <input type="checkbox" checked={form.is_open}
              onChange={e => setForm(f => ({ ...f, is_open: e.target.checked }))}
              className="w-4 h-4 rounded" />
            <span className="text-sm text-slate-300">Open immediately after adding</span>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowAddModal(false)}
              className="flex-1 bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white text-sm py-2.5 rounded-xl transition-colors">
              Cancel
            </button>
            <button onClick={handleAddSubmit} disabled={addCenter.isPending}
              className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-xl transition-colors">
              {addCenter.isPending ? 'Adding...' : 'Add Center'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Evacuation Center">
        <div className="space-y-4">
          <Field label="Center Name">
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="Address">
            <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Total Capacity">
              <Input
                type="text"
                inputMode="numeric"
                value={form.capacity_total}
                placeholder="e.g. 200"
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, '');
                  setForm(f => ({ ...f, capacity_total: val }));
                }}
              />
            </Field>
            <Field label="Current Evacuees">
              <Input
                type="text"
                inputMode="numeric"
                value={form.capacity_current}
                placeholder="0"
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, '');
                  setForm(f => ({ ...f, capacity_current: val }));
                }}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Contact Person">
              <Input value={form.contact_person} onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} />
            </Field>
            <Field label="Contact Number">
              <Input
                type="tel"
                inputMode="numeric"
                maxLength={11}
                value={form.contact_number}
                placeholder="09171234567"
                onChange={e => {
                  const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 11);
                  setForm(f => ({ ...f, contact_number: val }));
                }}
              />
            </Field>
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" checked={form.is_open}
              onChange={e => setForm(f => ({ ...f, is_open: e.target.checked }))}
              className="w-4 h-4 rounded" />
            <span className="text-sm text-slate-300">Center is Open</span>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowEditModal(false)}
              className="flex-1 bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white text-sm py-2.5 rounded-xl transition-colors">
              Cancel
            </button>
            <button onClick={handleEditSubmit} disabled={updateCenter.isPending}
              className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-xl transition-colors">
              {updateCenter.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </Modal>

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
    </div>
  );
}