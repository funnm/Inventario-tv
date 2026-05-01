import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-storage.js";

// Credenciales Originales
const firebaseConfig = {
    apiKey: "AIzaSyBDoCi9pfNP8pj3MAyfmDiHuqGHb9naPrA",
    authDomain: "elzuco-vault-73760.firebaseapp.com",
    databaseURL: "https://elzuco-vault-73760-default-rtdb.firebaseio.com",
    projectId: "elzuco-vault-73760",
    storageBucket: "elzuco-vault-73760.firebasestorage.app",
    messagingSenderId: "68119814899",
    appId: "1:68119814899:web:8b84cc9c2cb4ec46f6cd86",
    measurementId: "G-V0ZDJ4QZF5"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

let registrosActuales = [];

// --- AUTENTICACIÓN ---
const loginForm = document.getElementById('login-form');
const authContainer = document.getElementById('auth-container');

loginForm.onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    try {
        await signInWithEmailAndPassword(auth, email, pass);
        window.showToast("✅ Acceso Concedido", "success");
    } catch (error) {
        window.showToast("❌ Credenciales incorrectas", "error");
    }
};

document.getElementById('btn-logout').onclick = () => signOut(auth);

onAuthStateChanged(auth, (user) => {
    if (user) {
        authContainer.classList.add('hidden');
        initApp();
    } else {
        authContainer.classList.remove('hidden');
    }
});

// --- INICIALIZACIÓN ---
function initApp() {
    initTabs();
    initModals();
    initFilters();
    setupEditableList('marcas'); // NUEVO: Inicializa el gestor de marcas
    document.getElementById("year").innerText = new Date().getFullYear();

    const q = query(collection(db, "tvs"), orderBy("timestamp", "desc"));
    onSnapshot(q, (snapshot) => {
        registrosActuales = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        loadRegistros();
    });
}

function initTabs() {
    const tabIngreso = document.getElementById('tab-ingreso');
    const tabRegistro = document.getElementById('tab-registro');
    const contentIngreso = document.getElementById('ingreso-tab');
    const contentRegistro = document.getElementById('registro-tab');

    tabIngreso.onclick = () => {
        contentIngreso.classList.replace('hidden', 'block');
        contentRegistro.classList.replace('block', 'hidden');
        tabIngreso.classList.add('bg-blue-600');
        tabRegistro.classList.remove('bg-blue-600');
    };

    tabRegistro.onclick = () => {
        contentRegistro.classList.replace('hidden', 'block');
        contentIngreso.classList.replace('block', 'hidden');
        tabRegistro.classList.add('bg-blue-600');
        tabIngreso.classList.remove('bg-blue-600');
        loadRegistros();
    };
}

// --- CARGA DE DATOS ---
function loadRegistros() {
    const tableBody = document.getElementById('registros-tabla');
    if (!tableBody) return;

    // Estadísticas
    const enUso = registrosActuales.filter(r => r.estado === 'uso').length;
    const guardados = registrosActuales.filter(r => r.estado === 'guardado').length;
    const reparacion = registrosActuales.filter(r => r.estado === 'reparacion').length;

    if (document.getElementById('stat-uso')) document.getElementById('stat-uso').innerText = enUso;
    if (document.getElementById('stat-guardados')) document.getElementById('stat-guardados').innerText = guardados;
    if (document.getElementById('stat-reparacion')) document.getElementById('stat-reparacion').innerText = reparacion;

    const filtrados = filterRegistros(registrosActuales);

    tableBody.innerHTML = filtrados.map(reg => {
        return `
        <tr class="hover:bg-slate-50 border-b transition-colors">
            <td class="py-4 px-3 font-mono font-bold text-blue-600">${reg.numeroOrden}</td>
            <td class="py-4 px-3">
                <strong>${reg.marca}</strong><br>
                <span class="text-[10px] text-slate-500 uppercase">${reg.modelo}</span>
            </td>
            <td class="py-4 px-3 font-bold">${reg.pulgadas}"</td>
            <td class="py-4 px-3 text-[10px] uppercase">${reg.ubicacion}</td>
            <td class="py-4 px-3">${getEstadoBadge(reg.estado)}</td>
            <td class="py-4 px-3 text-center">
                <div class="flex justify-center gap-3">
                    <button onclick="window.generarEtiquetaPDF('${reg.id}')" class="text-slate-400 hover:text-blue-600" title="Imprimir Etiqueta"><i class="fas fa-print"></i></button>
                    <button onclick="window.abrirModalEstado('${reg.id}', '${reg.estado}')" class="text-slate-400 hover:text-green-600" title="Cambiar Estado"><i class="fas fa-sync-alt"></i></button>
                </div>
            </td>
            <td class="py-4 px-3 text-center">
                ${reg.foto ? `<img src="${reg.foto}" class="h-10 w-10 rounded-lg object-cover mx-auto cursor-pointer border" onclick="window.open('${reg.foto}', '_blank')">` : '<i class="fas fa-camera text-slate-200"></i>'}
            </td>
        </tr>`;
    }).join('');
}

// --- GUARDAR NUEVO TV ---
document.getElementById('form-ingreso').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.submitter;
    btn.disabled = true;
    window.showToast("⏳ Subiendo a la nube...", "success");

    const file = document.getElementById('foto-tv').files[0];
    let fotoUrl = "";

    try {
        if (file) {
            const storageRef = ref(storage, `fotos_tvs/${Date.now()}_${file.name}`);
            await uploadBytes(storageRef, file);
            fotoUrl = await getDownloadURL(storageRef);
        }

        const nuevoRegistro = {
            numeroOrden: document.getElementById('numero-orden').value.trim().toUpperCase(),
            marca: document.getElementById('marca-tv').value,
            modelo: document.getElementById('modelo-tv').value.trim().toUpperCase(),
            pulgadas: document.getElementById('pulgadas-tv').value,
            ubicacion: document.getElementById('ubicacion-tv').value.trim(),
            estado: document.getElementById('estado-tv-input').value,
            notas: document.getElementById('notas-tv').value.trim(),
            foto: fotoUrl,
            timestamp: new Date()
        };

        await addDoc(collection(db, "tvs"), nuevoRegistro);
        window.showToast("✅ TV Registrado", "success");
        e.target.reset();
        document.getElementById('tab-registro').click();
    } catch (err) {
        console.error(err);
        window.showToast("❌ Error al guardar", "error");
    } finally {
        btn.disabled = false;
    }
};

// --- ACTUALIZAR ESTADO ---
document.getElementById('btn-guardar-estado').onclick = async () => {
    const id = document.getElementById('registro-id').value;
    const estado = document.getElementById('select-estado').value;
    const docRef = doc(db, "tvs", id);
    
    try {
        await updateDoc(docRef, { estado: estado });
        window.showToast("✅ Estado Actualizado", "success");
        document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
    } catch (e) {
        window.showToast("❌ Error al actualizar", "error");
    }
};

window.abrirModalEstado = (id, actual) => {
    document.getElementById('registro-id').value = id;
    document.getElementById('select-estado').value = actual;
    document.getElementById('modal-estado').style.display = 'flex';
};

// --- ETIQUETA DE INVENTARIO PDF ---
window.generarEtiquetaPDF = (id) => {
    const reg = registrosActuales.find(r => r.id === id);
    if(!reg) return;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: [80, 80] });

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 80, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("INVENTARIO VAULT TV", 40, 12, { align: "center" });

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.text(`CONTROL: ${reg.numeroOrden}`, 40, 30, { align: "center" });
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Marca: ${reg.marca}`, 10, 45);
    doc.text(`Modelo: ${reg.modelo}`, 10, 52);
    doc.text(`Tamaño: ${reg.pulgadas} Pulgadas`, 10, 59);
    doc.text(`Ubicación: ${reg.ubicacion}`, 10, 66);

    doc.save(`Etiqueta_${reg.numeroOrden}.pdf`);
};

// --- UTILIDADES ---
window.showToast = (m, t) => {
    const el = document.getElementById('toast');
    if (!el) return;
    el.innerText = m;
    el.className = `toast show ${t === 'success' ? 'bg-slate-900' : 'bg-red-600'} text-white p-4 rounded-xl fixed top-5 right-5 z-[100] shadow-lg`;
    setTimeout(() => el.classList.remove('show'), 3000);
};

function filterRegistros(regs) {
    const s = document.getElementById('search-input')?.value.toLowerCase() || '';
    const e = document.getElementById('filtro-estado')?.value || '';
    return regs.filter(r => (
        r.marca.toLowerCase().includes(s) || 
        r.modelo.toLowerCase().includes(s) || 
        r.numeroOrden.toLowerCase().includes(s)
    ) && (!e || r.estado === e));
}

function getEstadoBadge(e) {
    const st = { 'uso': 'bg-green-100 text-green-700', 'guardado': 'bg-amber-100 text-amber-700', 'reparacion': 'bg-red-100 text-red-700' };
    const tx = { 'uso': 'EN USO', 'guardado': 'GUARDADO', 'reparacion': 'EN REPARACIÓN' };
    return `<span class="px-2 py-1 rounded-lg text-[9px] font-bold ${st[e] || 'bg-slate-100'}">${tx[e] || e}</span>`;
}

// NUEVO: Función para agregar marcas personalizadas a la lista
function setupEditableList(type) {
    const btn = document.getElementById(`btn-agregar-${type}`);
    const input = document.getElementById(`nueva-marca`);
    const select = document.getElementById('marca-tv');

    if (btn) {
        btn.onclick = () => {
            const val = input.value.trim();
            if (val) {
                // Añade la nueva marca al select desplegable
                select.add(new Option(val, val));
                select.value = val; // Selecciona automáticamente la nueva marca
                input.value = '';
                window.showToast(`✅ Marca ${val} agregada`, "success");
            }
        };
    }
}

function initModals() {
    // NUEVO: Listener para abrir el modal de marcas
    const btnMarcas = document.getElementById('btn-editar-marcas');
    if(btnMarcas) {
        btnMarcas.onclick = () => document.getElementById('modal-marcas').style.display = 'flex';
    }

    document.querySelectorAll('.close-modal').forEach(b => b.onclick = () => document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'));
}

function initFilters() {
    ['search-input', 'filtro-estado'].forEach(id => document.getElementById(id)?.addEventListener('input', () => loadRegistros()));
}