import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { INITIAL_VEHICLES, INITIAL_ROUTES } from '../data/mockData';

const INITIAL_DRIVERS = [
  { id: '1', name: 'Edvaldo Nascimento', vehicle: 'Fiorino Branca (ABC-1234)', rating: 4.8, status: 'on_route', completed: 1450 },
  { id: '2', name: 'Juraci Silva', vehicle: 'Moto CG 160 (XYZ-9876)', rating: 4.9, status: 'on_route', completed: 3210 },
  { id: '3', name: 'Alexandre Santos', vehicle: 'Van Renault (QWE-5544)', rating: 4.5, status: 'active', completed: 890 },
  { id: '4', name: 'Thais Bezerra', vehicle: 'Fiorino Prata (RTY-1122)', rating: 5.0, status: 'offline', completed: 2100 },
  { id: '5', name: 'Carlos Mendes', vehicle: 'Moto Honda (UIO-3321)', rating: 4.7, status: 'active', completed: 1100 },
];

export const seedDatabase = async () => {
  const vSnap = await getDocs(collection(db, 'vehicles'));
  if (vSnap.empty) {
    for (const v of INITIAL_VEHICLES) {
      await setDoc(doc(db, 'vehicles', v.id), v);
    }
  }

  const dSnap = await getDocs(collection(db, 'drivers'));
  if (dSnap.empty) {
    for (const d of INITIAL_DRIVERS) {
      await setDoc(doc(db, 'drivers', d.id), d);
    }
  }

  const rSnap = await getDocs(collection(db, 'routes'));
  if (rSnap.empty) {
    for (const r of INITIAL_ROUTES) {
      await setDoc(doc(db, 'routes', r.id), r);
    }
  }
};
