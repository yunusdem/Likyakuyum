import { Dropdown } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { IconShieldCheck } from '@tabler/icons-react';

export default function MasakMenu({ onUpdate, mobile = false }: { onUpdate: () => void; mobile?: boolean }) {
  return <Dropdown align="end" className="d-inline-flex">
    <Dropdown.Toggle variant="link" id={mobile ? 'dropdown-masak-mobile' : 'dropdown-masak-quick'}
      className={mobile
        ? 'd-flex align-items-center gap-1 text-decoration-none px-2 py-1 rounded-pill bg-light border text-nowrap quick-action-mobile-pill'
        : 'd-flex flex-column align-items-center justify-content-center text-decoration-none px-2 py-0.5 rounded-2 quick-action-btn'}>
      <IconShieldCheck size={mobile ? 16 : 18} strokeWidth={2} style={{ color: '#dc2626' }} />
      <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#dc2626', lineHeight: 1 }}>MASAK</span>
    </Dropdown.Toggle>
    <Dropdown.Menu className="shadow border-0 py-1" style={{ minWidth: 180 }}>
      <Dropdown.Item onClick={onUpdate}>Liste güncelle</Dropdown.Item>
      <Dropdown.Item as={Link} to="/ayarlar/masak-dondurulanlar">Sorgulama</Dropdown.Item>
    </Dropdown.Menu>
  </Dropdown>;
}
