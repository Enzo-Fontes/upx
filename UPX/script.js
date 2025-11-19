// Importações do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, doc, addDoc, deleteDoc, onSnapshot, collection, query } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// Variáveis globais
let app, auth, db;
let userId;
let turbinasCollectionRef;

// Referências do DOM
const authPage = document.getElementById('authPage');
const appPage = document.getElementById('appPage');

// --- CONFIGURAÇÃO DO FIREBASE ---
// SUBSTITUA ABAIXO COM SUAS CHAVES REAIS DO CONSOLE DO FIREBASE
const firebaseConfig = {
    apiKey: "SUA_API_KEY_AQUI",
    authDomain: "SEU_PROJETO.firebaseapp.com",
    projectId: "SEU_PROJECT_ID",
    storageBucket: "SEU_PROJETO.firebasestorage.app",
    messagingSenderId: "SEU_SENDER_ID",
    appId: "SEU_APP_ID"
};

// Inicialização
try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);

    // Observador de Estado de Autenticação
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // LOGADO
            authPage.classList.add('hidden');
            authPage.classList.remove('flex');
            
            appPage.classList.remove('hidden');
            appPage.classList.add('flex');

            userId = user.uid;
            document.getElementById('userIdDisplay').textContent = user.email; 
            
            // Define o caminho da coleção: users/ID/turbinas
            const collectionPath = `users/${userId}/turbinas`;
            turbinasCollectionRef = collection(db, collectionPath);
            
            carregarTurbinas();
        } else {
            // DESLOGADO
            appPage.classList.add('hidden');
            appPage.classList.remove('flex');

            authPage.classList.remove('hidden');
            authPage.classList.add('flex');

            userId = null;
            turbinasCollectionRef = null;
            
            const container = document.getElementById('turbinasContainer');
            if(container) container.innerHTML = '<p id="loadingTurbinas" class="text-gray-500">Faça login para ver suas turbinas.</p>';
        }
    });

} catch (e) {
    console.error("Erro Crítico:", e);
    if(authPage) {
        authPage.classList.remove('hidden');
        authPage.classList.add('flex');
        showAuthMensagem("Erro de configuração: Verifique o arquivo script.js", "erro");
    }
}

// --- FUNÇÕES DE AUTH ---

async function handleRegister(event) {
    event.preventDefault();
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const btn = event.target.querySelector('button');

    try {
        btn.disabled = true;
        btn.textContent = "Registrando...";
        await createUserWithEmailAndPassword(auth, email, password);
        showAuthMensagem("Conta criada! Entrando...", "sucesso");
    } catch (error) {
        showAuthMensagem(getAuthErrorMessage(error), "erro");
    } finally {
        btn.disabled = false;
        btn.textContent = "Registrar";
    }
}

async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const btn = event.target.querySelector('button');

    try {
        btn.disabled = true;
        btn.textContent = "Entrando...";
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        showAuthMensagem(getAuthErrorMessage(error), "erro");
    } finally {
        btn.disabled = false;
        btn.textContent = "Entrar";
    }
}

async function handleLogout() {
    try {
        await signOut(auth);
    } catch (error) {
        showMensagem("Erro ao tentar sair.", "erro");
    }
}

// --- FUNÇÕES DO FIRESTORE ---

function carregarTurbinas() {
    if (!turbinasCollectionRef) return;
    const q = query(turbinasCollectionRef); 
    
    onSnapshot(q, (snapshot) => {
        const container = document.getElementById('turbinasContainer');
        container.innerHTML = ''; 

        if (snapshot.empty) {
            container.innerHTML = '<p id="loadingTurbinas" class="text-gray-500">Nenhuma turbina salva ainda.</p>';
        } else {
            snapshot.docs.forEach(doc => {
                const turbina = doc.data();
                const turbinaId = doc.id;
                const turbinaCard = criarTurbinaCard(turbina, turbinaId);
                container.appendChild(turbinaCard);
            });
        }
    }, (error) => {
        console.error("Erro ao carregar: ", error);
        showMensagem("Não foi possível carregar suas turbinas.", "erro");
    });
}

async function adicionarTurbina(event) {
    event.preventDefault();
    if (!turbinasCollectionRef) {
        showMensagem("Erro de conexão.", "erro");
        return;
    }

    const nome = document.getElementById('nome').value;
    const velocidadeKmh = parseFloat(document.getElementById('velocidade').value);
    const raioMetros = parseFloat(document.getElementById('raio').value);

    if (!nome || isNaN(velocidadeKmh) || isNaN(raioMetros) || velocidadeKmh <= 0 || raioMetros <= 0) {
        showMensagem("Preencha todos os campos corretamente.", "erro");
        return;
    }

    const { potenciaCalculada, potenciaFormatada } = calcularPotencia(velocidadeKmh, raioMetros);

    const novaTurbina = {
        nome,
        velocidadeKmh,
        raioMetros,
        potenciaFormatada,
        potenciaWatts: potenciaCalculada,
    };

    try {
        const submitButton = document.getElementById('submitButton');
        submitButton.disabled = true;
        submitButton.textContent = "Salvando...";

        await addDoc(turbinasCollectionRef, novaTurbina);
        
        showMensagem("Turbina salva com sucesso!", "sucesso");
        document.getElementById('windCalculator').reset(); 

    } catch (e) {
        console.error("Erro ao salvar: ", e);
        showMensagem("Erro ao salvar a turbina.", "erro");
    } finally {
        const submitButton = document.getElementById('submitButton');
        submitButton.disabled = false;
        submitButton.textContent = "Salvar Turbina";
    }
}

async function excluirTurbina(id) {
    if (!turbinasCollectionRef) return;
    try {
        const docRef = doc(db, turbinasCollectionRef.path, id);
        await deleteDoc(docRef);
        showMensagem("Turbina excluída.", "sucesso");
    } catch (e) {
        console.error("Erro ao excluir: ", e);
        showMensagem("Erro ao excluir.", "erro");
    }
}
// Torna a função global para funcionar com o onclick do HTML
window.excluirTurbina = excluirTurbina;

// --- UTILITÁRIOS ---

function calcularPotencia(velocidadeKmh, raioMetros) {
    const RHO = 1.225; 
    const velocidadeMs = velocidadeKmh / 3.6; 
    const area = Math.PI * Math.pow(raioMetros, 2); 
    const eficiencia = 0.40; 
    
    const potenciaCalculada = 0.5 * RHO * area * Math.pow(velocidadeMs, 3) * eficiencia;

    let potenciaFormatada;
    if (potenciaCalculada < 1000) {
        potenciaFormatada = potenciaCalculada.toFixed(2) + " Watts";
    } else if (potenciaCalculada < 1000000) {
        potenciaFormatada = (potenciaCalculada / 1000).toFixed(2) + " kW";
    } else {
        potenciaFormatada = (potenciaCalculada / 1000000).toFixed(2) + " MW";
    }
    return { potenciaCalculada, potenciaFormatada };
}

function criarTurbinaCard(turbina, id) {
    const div = document.createElement('div');
    div.className = "bg-gray-50 p-5 rounded-lg border border-gray-200 shadow-sm flex justify-between items-start mb-4";
    div.innerHTML = `
        <div>
            <h3 class="text-xl font-bold text-teal-700">${turbina.nome}</h3>
            <p class="text-3xl font-light text-gray-800 mt-1">${turbina.potenciaFormatada}</p>
            <div class="text-sm text-gray-600 mt-3 space-y-1">
                <p><strong>Vento:</strong> ${turbina.velocidadeKmh} km/h</p>
                <p><strong>Raio da Pá:</strong> ${turbina.raioMetros} m</p>
                <p class="pt-2"><strong>ID:</strong> <span class="text-xs font-mono text-gray-500">${id}</span></p>
            </div>
        </div>
        <div class="text-gray-400">
            <svg class="trash-icon" onclick="window.excluirTurbina('${id}')" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.04-3.24a.75.75 0 00-.74-.76h-3.92a.75.75 0 00-.74.76l-.04 3.24M14.74 9h-5.48M12 1.5a.75.75 0 01.75.75v.75H18a.75.75 0 01.75.75v2.25a.75.75 0 01-.75.75h-1.5a.75.75 0 01-.75-.75V6a.75.75 0 00-.75-.75h-3a.75.75 0 00-.75.75v.75a.75.75 0 01-.75.75h-1.5a.75.75 0 01-.75-.75V3.75a.75.75 0 01.75-.75H11.25v-.75A.75.75 0 0112 1.5zM3.75 6a.75.75 0 01.75-.75h15a.75.75 0 01.75.75v12a.75.75 0 01-.75.75h-15a.75.75 0 01-.75-.75V6zM8.25 9.75a.75.75 0 01.75.75v6a.75.75 0 01-1.5 0v-6a.75.75 0 01.75-.75zm3.75 0a.75.75 0 01.75.75v6a.75.75 0 01-1.5 0v-6a.75.75 0 01.75-.75zm3.75 0a.75.75 0 01.75.75v6a.75.75 0 01-1.5 0v-6a.75.75 0 01.75-.75z" />
            </svg>
        </div>
    `;
    return div;
}

function showMensagem(msg, tipo) {
    const div = document.getElementById('mensagem');
    showMessage(div, msg, tipo);
}

function showAuthMensagem(msg, tipo) {
    const div = document.getElementById('authMensagem');
    showMessage(div, msg, tipo);
}

function showMessage(element, msg, tipo) {
    if(!element) return;
    element.textContent = msg;
    element.className = tipo === 'erro' 
        ? 'p-4 mb-4 rounded-lg bg-red-100 text-red-700 border border-red-200'
        : 'p-4 mb-4 rounded-lg bg-green-100 text-green-700 border border-green-200';
    element.classList.remove('hidden');
    setTimeout(() => element.classList.add('hidden'), 5000);
}

function getAuthErrorMessage(error) {
    switch (error.code) {
        case 'auth/invalid-email': return 'Formato de email inválido.';
        case 'auth/user-not-found': return 'Usuário não encontrado.';
        case 'auth/wrong-password': return 'Senha incorreta.';
        case 'auth/email-already-in-use': return 'Email já em uso.';
        case 'auth/weak-password': return 'Senha fraca (min 6 caracteres).';
        default: return 'Erro: ' + error.message;
    }
}

// Listeners
document.getElementById('windCalculator').addEventListener('submit', adicionarTurbina);
document.getElementById('logoutButton').addEventListener('click', handleLogout);
document.getElementById('loginForm').addEventListener('submit', handleLogin);
document.getElementById('registerForm').addEventListener('submit', handleRegister);

document.getElementById('showRegister').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('registerForm').classList.remove('hidden');
});

document.getElementById('showLogin').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('registerForm').classList.add('hidden');
    document.getElementById('loginForm').classList.remove('hidden');
});