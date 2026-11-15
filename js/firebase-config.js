// =====================================================================
//  VejaReservas — configuração do Firebase
// ---------------------------------------------------------------------
//  1. Abra console.firebase.google.com > seu projeto > ⚙ Configurações
//     do projeto > Seus apps > Web (</>) e copie o bloco firebaseConfig.
//  2. Cole os valores abaixo, substituindo os "COLE_AQUI".
//
//  Enquanto os valores forem "COLE_AQUI", o sistema roda em MODO
//  DEMONSTRAÇÃO: os dados ficam salvos só neste navegador.
//  (Esses dados NÃO são secretos — podem ficar no GitHub público.)
// =====================================================================
export const firebaseConfig = {
  apiKey: "AIzaSyDWjgx2GuVfJ06rr7imF9lXe37XaHjZkn8",
  authDomain: "vejareservas.firebaseapp.com",
  projectId: "vejareservas",
  storageBucket: "vejareservas.firebasestorage.app",
  messagingSenderId: "397876577086",
  appId: "1:397876577086:web:91f7729e234d713d2b626f"
};

// =====================================================================
//  Endereço OFICIAL do site (sem https://), ex.: "reservas.seudominio.com.br"
//  Se alguém copiar o site e abrir em outro endereço, o calendário mostra
//  um alerta vermelho "Este NÃO é o site oficial" e esconde o Pix.
//  Deixe vazio enquanto ainda não tiver o domínio configurado.
// =====================================================================
export const dominioOficial = "espacoveja.devtecnologia.app.br";

// Outros endereços SEUS onde o site também pode abrir sem alerta
// (útil enquanto o domínio novo não fica pronto). Pode apagar depois.
export const dominiosPermitidos = ["devtecnologia.app.br", "devtecnologia6.github.io"];
