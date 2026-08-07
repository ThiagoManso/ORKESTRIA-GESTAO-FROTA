import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

export async function syncDriverStatus(
  driverIdentifier: { id?: string; name?: string; cpf?: string; email?: string },
  newStatus: 'active' | 'on_route' | 'offline',
  vehicleId?: string | null
): Promise<void> {
  try {
    const driversRef = collection(db, 'drivers');
    const snapshot = await getDocs(driversRef);
    if (snapshot.empty) return;

    const targetId = driverIdentifier.id?.trim();
    const targetName = driverIdentifier.name?.trim().toLowerCase();
    const targetCpf = driverIdentifier.cpf?.trim().replace(/\D/g, '');
    const targetEmail = driverIdentifier.email?.trim().toLowerCase();

    const updatePromises: Promise<any>[] = [];
    const matchedDriverIds: string[] = [];
    const matchedDriverNames: string[] = [];

    snapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const docId = docSnap.id;
      const docName = (data.name || '').trim().toLowerCase();
      const docCpf = (data.cpf || '').trim().replace(/\D/g, '');
      const docEmail = (data.email || '').trim().toLowerCase();

      const isMatchById = Boolean(targetId && docId === targetId);
      const isMatchByName = Boolean(targetName && docName && docName === targetName);
      const isMatchByCpf = Boolean(targetCpf && docCpf && docCpf === targetCpf);
      const isMatchByEmail = Boolean(targetEmail && docEmail && docEmail === targetEmail);

      if (isMatchById || isMatchByName || isMatchByCpf || isMatchByEmail) {
        matchedDriverIds.push(docId);
        if (data.name) matchedDriverNames.push(data.name.trim().toLowerCase());

        const updatePayload: Record<string, any> = {
          status: newStatus,
          updatedAt: new Date().toISOString()
        };

        if (newStatus === 'offline') {
          updatePayload.currentSessionId = null;
        }

        if (vehicleId !== undefined) {
          updatePayload.currentVehicle = vehicleId;
          updatePayload.currentVehicleId = vehicleId;
        }

        updatePromises.push(
          updateDoc(doc(db, 'drivers', docId), updatePayload).catch((err) => {
            console.warn(`Erro ao atualizar status do motorista (${docId}):`, err);
          })
        );
      }
    });

    // Quando o entregador fica offline ou desloga, libera o veículo
    // mas preserva o dailyLog para que, caso não tenha lançado o KM do dia,
    // o sistema exija o encerramento do turno posteriormente conforme regra de negócio.
    if (newStatus === 'offline' && (matchedDriverIds.length > 0 || matchedDriverNames.length > 0 || targetName)) {
      try {
        const vehiclesSnap = await getDocs(collection(db, 'vehicles'));
        vehiclesSnap.docs.forEach((vDoc) => {
          const vData = vDoc.data();
          const vDriverName = (vData.currentDriver || '').trim().toLowerCase();
          const matchesVehicleDriver = vDriverName && (
            matchedDriverNames.includes(vDriverName) ||
            (targetName && (vDriverName === targetName || vDriverName.includes(targetName) || targetName.includes(vDriverName)))
          );

          if (matchesVehicleDriver || vData.currentDriverId === targetId) {
            updatePromises.push(
              updateDoc(doc(db, 'vehicles', vDoc.id), {
                status: 'available',
                currentDriver: '',
                currentDriverId: null
              }).catch((err) => console.warn('Erro ao liberar veículo do motorista:', err))
            );
          }
        });
      } catch (err) {
        console.warn('Erro em syncDriverStatus ao liberar veículo:', err);
      }
    }

    await Promise.all(updatePromises);
  } catch (error) {
    console.error('Erro em syncDriverStatus:', error);
  }
}
