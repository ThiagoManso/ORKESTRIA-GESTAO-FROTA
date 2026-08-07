import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "orkestria-os-gestao-de-frota",
  appId: "1:23796532338:web:c6dfa3903bc060359eeeeb",
  apiKey: "AIzaSyDxhehxMBvx5C8TbfaKr25iaBRzT0B-pf8",
  authDomain: "orkestria-os-gestao-de-frota.firebaseapp.com",
  storageBucket: "orkestria-os-gestao-de-frota.firebasestorage.app",
  messagingSenderId: "23796532338"
};

const app = initializeApp(firebaseConfig);
const sourceDb = getFirestore(app, "ai-studio-orkestriaosbrass-d4be16bf-f869-4fdf-95ef-b446bd38bbb5");
const targetDb = getFirestore(app, "gestaodefrota");

const collectionsToMigrate = [
  'system_users',
  'drivers',
  'vehicles',
  'routes',
  'dailyLogs',
  'companies',
  'settings',
  'incidents'
];

async function migrateCollection(colName: string) {
  console.log(`\n----------------------------------------------------`);
  console.log(`Iniciando migração da coleção: [ ${colName} ]...`);
  try {
    const snap = await getDocs(collection(sourceDb, colName));
    if (snap.empty) {
      console.log(`  -> Coleção [ ${colName} ] vazia no banco origem. Nada a copiar.`);
      return { colName, copied: 0, status: 'EMPTY' };
    }

    console.log(`  -> Encontrados ${snap.size} documento(s) em [ ${colName} ]. Copiando para [gestaodefrota]...`);
    let count = 0;
    for (const d of snap.docs) {
      await setDoc(doc(targetDb, colName, d.id), d.data());
      count++;
    }
    console.log(`  => Sucesso! ${count} documento(s) copiados na coleção [ ${colName} ].`);
    return { colName, copied: count, status: 'SUCCESS' };
  } catch (err: any) {
    console.error(`  [!] Erro ao migrar [ ${colName} ]:`, err.message);
    return { colName, copied: 0, status: 'ERROR', error: err.message };
  }
}

async function runMigration() {
  console.log(`====================================================`);
  console.log(`   MIGRAÇÃO TOTAL: BANCO ANTIGO -> [gestaodefrota]  `);
  console.log(`====================================================`);

  const results = [];
  for (const col of collectionsToMigrate) {
    const res = await migrateCollection(col);
    results.push(res);
  }

  console.log(`\n====================================================`);
  console.log(`               RESUMO DA MIGRAÇÃO                   `);
  console.log(`====================================================`);
  let totalCopied = 0;
  for (const r of results) {
    console.log(` - ${r.colName.padEnd(15)} : ${r.copied} documento(s) | Status: ${r.status}`);
    totalCopied += r.copied;
  }
  console.log(`----------------------------------------------------`);
  console.log(`Total de documentos copiados para [gestaodefrota]: ${totalCopied}`);
  console.log(`====================================================\n`);
  process.exit(0);
}

runMigration();
