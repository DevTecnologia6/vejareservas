# VejaReservas · Espaço Veja

Sistema de reservas do **Espaço Veja**: cadastro de locações, calendário público, controle financeiro, despesas e lembrete automático no WhatsApp um dia antes de cada locação.

100% gratuito: **Firebase** (banco + login) · **GitHub Pages** (site) · **GitHub Actions** (robô do lembrete) · **CallMeBot** (WhatsApp).

```
vejareservas/
├── index.html               ← site do CLIENTE (espacoveja.com.br) — conta, calendário, fotos, pré-reserva
├── painel.html              ← painel do DONO (espacoveja.com.br/painel.html)
├── css/style.css
├── js/
│   ├── firebase-config.js   ← COLE AQUI a configuração do Firebase
│   ├── db.js                ← acesso aos dados (Firebase ou modo demonstração)
│   ├── app.js               ← painel: início, reservas, financeiro, despesas, ajustes
│   ├── calendar.js          ← componente de calendário
│   ├── publico.js           ← calendário público + pré-reserva
│   ├── pix.js               ← gera o Pix copia e cola e o QR Code
│   └── vendor/qrcode.js     ← biblioteca de QR Code (licença MIT)
├── assets/                  ← logo.png e banner.jpg (troque pelas suas fotos)
├── lembrete/                ← robô do WhatsApp (Node.js)
├── .github/workflows/lembrete.yml
└── firestore.rules          ← regras de segurança do banco
```

---

## 1. Subir no GitHub (dá para fazer tudo pelo navegador)

1. Em github.com, clique em **New repository**, dê o nome `vejareservas` e deixe **Public** (o GitHub Pages grátis exige repositório público; nada secreto fica no código).
2. Clique em **uploading an existing file** e arraste **todo o conteúdo** da pasta `vejareservas` (inclusive a pasta `.github`) → **Commit changes**.
   > Se a pasta `.github` não subir arrastando, crie pelo GitHub: **Add file → Create new file**, digite `.github/workflows/lembrete.yml` como nome e cole o conteúdo do arquivo.
3. Vá em **Settings → Pages** → *Source*: **Deploy from a branch** → Branch **main** / **(root)** → **Save**.
4. Em 1–2 minutos o site fica no ar (no seu caso, em `devtecnologia.app.br/vejareservas/`).

Nesse ponto ele já funciona em **modo demonstração** (com dados de exemplo salvos só no seu navegador) — dá para testar tudo antes de ligar o Firebase.

## 2. Ligar o Firebase

1. Em console.firebase.google.com, abra (ou crie) o projeto `vejareservas`.
2. **Authentication → Começar → E-mail/senha → Ativar.** Depois em **Users → Adicionar usuário** crie o seu login (e-mail + senha).
3. **Firestore Database → Criar banco de dados →** modo de **produção**, local `southamerica-east1 (São Paulo)`.
4. Em **Firestore → Regras**, cole o conteúdo de `firestore.rules`, **troque `SEU-EMAIL@gmail.com` pelo e-mail do passo 2** e clique em **Publicar**.
5. **⚙ Configurações do projeto → Seus apps → Web (`</>`)** → registre o app → copie os valores do `firebaseConfig` para `js/firebase-config.js` (no GitHub: abra o arquivo → lápis ✏️ → cole → **Commit**).
6. **Authentication → Configurações → Domínios autorizados**: adicione `SEU-USUARIO.github.io` e o seu domínio (ex.: `reservas.seudominio.com.br`).

## 3. Primeiro acesso

1. Abra o site, entre com o e-mail e senha criados no Firebase.
2. Vá em **Ajustes**, ajuste os preços (vêm com 12h R$ 770 · 24h R$ 1.000 · limpeza R$ 75), preencha o **WhatsApp**, a **chave Pix** e clique em **Salvar configurações**. ⚠ Esse passo é obrigatório: é ele que publica preços, WhatsApp e Pix para o calendário público.
3. Copie o **link do calendário público** e coloque na bio do Instagram / status do WhatsApp.

## 4. Domínio: espacoveja.devtecnologia.app.br

1. Em registro.br → *devtecnologia.app.br* → **DNS → Editar zona** → **Nova entrada**:

| Tipo | Nome | Dados |
|---|---|---|
| CNAME | `espacoveja` | `devtecnologia6.github.io` |

   (Não mexa nas entradas que já existem do site da Dev Tecnologia.)
2. No GitHub: repositório *vejareservas* → **Settings → Pages → Custom domain** → `espacoveja.devtecnologia.app.br` → **Save**. Quando aparecer *DNS check successful*, marque **Enforce HTTPS**.
3. No Firebase: **Authentication → Configurações → Domínios autorizados** → adicione `espacoveja.devtecnologia.app.br`.
4. `js/firebase-config.js` já vem com `dominioOficial = "espacoveja.devtecnologia.app.br"`.

Links finais:
- **Clientes:** `https://espacoveja.devtecnologia.app.br`
- **Seu painel:** `https://espacoveja.devtecnologia.app.br/painel.html` (não divulgue; salve nos favoritos)

> **Quando comprar o espacoveja.com.br:** troque o `dominioOficial` no `firebase-config.js`, troque o *Custom domain* no GitHub, crie no DNS do domínio novo 4 entradas **A** (`185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`) + **CNAME** `www` → `devtecnologia6.github.io`, e adicione o domínio novo no Firebase.

## 5. Pix e pré-reserva pelo site

Em **Ajustes**:
- **Pré-reserva pelo site**: ligado, o cliente cria a conta (ou entra), escolhe um dia livre, o período, se **quer ou não a limpeza pós-evento**, aceita as regras e envia. O dia já aparece como *em negociação* para os outros visitantes.
- **Sinal**: 30%, 50% ou 100% do total (locação + limpeza, se escolhida).
- **Pix**: escolha o tipo da chave, a chave, o nome do recebedor e a cidade. O cliente recebe um **QR Code com o valor do sinal já preenchido**, mais o Pix copia e cola. Use **Testar QR Code (R$ 1,00)** e leia com o app do banco para conferir se o nome aparece certo.
- **Regras do espaço**: texto que o cliente precisa aceitar antes de enviar.

Quando chega uma pré-reserva, ela aparece no topo do **Início** (com um número vermelho no menu). Confira se o Pix caiu e clique em:
- **Aprovar**: abre a reserva já preenchida, com o sinal lançado. Salve e pronto.
- **Recusar**: libera a data, e o cliente vê "Não aprovada" em *Minhas reservas*.

> O sistema **não confirma o Pix sozinho** (isso exigiria a API paga de um banco). Por isso a pré-reserva fica *em negociação* até você conferir o comprovante e aprovar. O cliente continua podendo só conversar pelo WhatsApp, se preferir.

## 5.1 Horários e fotos

- **Horário de entrada**: em *Ajustes*, defina os horários que o cliente pode escolher (ex.: `08:00, 09:00, 10:00, 12:00, 14:00`). Na pré-reserva ele escolhe um deles e o sistema mostra a **saída prevista** (12h ou 24h depois). No painel você pode digitar qualquer horário ao cadastrar ou editar.
- **Fotos da casa**: menu **Fotos** → *Toque para adicionar fotos* (pode escolher várias). Elas são reduzidas automaticamente e aparecem no topo do calendário público em "Conheça o espaço", com visualizador em tela cheia (no celular dá para deslizar). Dá para colocar legenda, reordenar (◀ ▶) e excluir. Limite de 20 fotos.
  > As fotos ficam guardadas no próprio banco (Firestore), já otimizadas, porque o *Storage* do Firebase passou a exigir o plano pago em 2024. Assim continua tudo grátis.

## 6. Segurança e contas

**Dois tipos de conta, no mesmo Firebase:**

| | Proprietário (você) | Cliente |
|---|---|---|
| Onde entra | `painel.html` | `espacoveja.com.br` (index.html): abre direto na tela de **Entrar / Criar conta** |
| Como é criada | Só por você, no console do Firebase (Authentication → Adicionar usuário) | O próprio cliente cria com **nome, WhatsApp, e-mail e senha** |
| Confirmação | — | **Link no e-mail**, obrigatório para ver qualquer coisa: calendário, fotos e pré-reserva |
| O que pode ver | Tudo | Só as próprias reservas, em *Minhas reservas* |

- **Sem conta não se vê nada**: datas, fotos, preços e Pix só são liberados pelo banco para quem está logado com e-mail confirmado (não é só a tela escondendo; as regras do Firestore bloqueiam).
- Quem decide quem é dono são as **regras do Firestore** (`firestore.rules`), pelo e-mail. Mesmo que um cliente tente abrir o painel, o banco recusa e aparece "Acesso restrito".
- Senhas são guardadas criptografadas pelo Google (Firebase Authentication); nem você consegue vê-las. "Esqueci minha senha" envia um link de redefinição por e-mail.
- **Confirmação por SMS do número não está ativada**: o Firebase só envia SMS no plano pago (Blaze), cobrando por mensagem. O WhatsApp é salvo no cadastro e você confere na conversa. Dá para ativar o SMS no futuro, se quiser.
- Para o e-mail de confirmação sair em português: Authentication → Templates → ✏️ → *Idioma do modelo*: Português (Brasil).

**Proteção contra sites falsos:**
1. Em `js/firebase-config.js`, preencha `dominioOficial` com o seu endereço (ex.: `reservas.seudominio.com.br`).
2. O calendário mostra o **selo verde "Site oficial e seguro"** com dicas para o cliente: conferir o endereço, conferir o **nome do recebedor do Pix** no app do banco e o WhatsApp oficial.
3. Se alguém copiar o site e publicar em outro endereço, a cópia mostra uma **faixa vermelha "Este NÃO é o site oficial"**, esconde o Pix e o botão de reservar.
4. Nos **Domínios autorizados** do Firebase deixe **só** o seu domínio (e `SEU-USUARIO.github.io`): assim uma cópia não consegue criar contas nem fazer login no seu sistema.

> Importante: um golpista mais esperto pode apagar o alerta do código copiado. A proteção que **sempre funciona** é o cliente conferir o **nome do recebedor do Pix** antes de pagar, e é por isso que o sistema repete esse aviso na tela de pagamento. Divulgue sempre o link oficial no Instagram e no WhatsApp.

## 7. Ligar o lembrete no WhatsApp

Todo dia às **9h (Brasília)** o robô verifica se há locação **no dia seguinte** e te manda nome, telefone, evento, horário e quanto falta receber. Se houver pré-reservas do site esperando aprovação, ele também te avisa.

1. **Chave do Firebase:** ⚙ Configurações do projeto → **Contas de serviço** → **Gerar nova chave privada** → baixa um arquivo `.json`. ⚠ Esse arquivo é secreto: **não suba ele no repositório.**
2. No GitHub: **Settings → Secrets and variables → Actions → New repository secret** e crie os 3:

| Nome | Valor |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | todo o conteúdo do arquivo `.json` (abra no Bloco de Notas e copie tudo) |
| `CALLMEBOT_PHONE` | seu número no formato `+5527999999999` |
| `CALLMEBOT_APIKEY` | a chave que o bot do CallMeBot te mandou |

3. **Testar agora:** aba **Actions → Lembrete de locação → Run workflow** → em *data_teste* coloque a data de uma reserva cadastrada (ex.: `2026-11-21`) → **Run**. Em ~1 minuto chega o WhatsApp.

> O GitHub pausa agendamentos de repositórios públicos sem nenhuma alteração por 60 dias. Se isso acontecer, ele avisa por e-mail — é só entrar em **Actions** e clicar em **Enable workflow**.
> O horário do GitHub Actions pode atrasar alguns minutos em dias de muito uso.

---

## Como o sistema funciona

| Status | Significado | Ocupa a data? |
|---|---|---|
| **Pendente** | Aguardando sinal/confirmação | Sim (aparece "em negociação" no público) |
| **Confirmada** | Data garantida | Sim |
| **Congelada** | Cliente desistiu — valor fica como crédito para remarcar com prioridade (pode ficar sem data) | Não |
| **Concluída** | Locação já realizada | Sim |
| **Cancelada** | Não vale mais | Não |

- **Valor**: preenchido automaticamente pelo período (12h/24h); a **limpeza pós-evento é opcional** (marque a caixinha quando o cliente quiser).
- **Pagamentos**: registre o sinal ao cadastrar e os demais pagamentos depois — o sistema calcula quanto falta.
- **Calendário público**: lê apenas as coleções `ocupacao` (só datas) e `publico` (nome, preços, WhatsApp e chave Pix). Nomes, telefones e valores de outros clientes nunca aparecem.
- **Pré-reservas**: só clientes com e-mail confirmado criam, sempre em nome da própria conta; as regras do Firestore validam todos os campos.
- **Backup**: em Ajustes → *Baixar backup (.json)*.
- **Fotos**: troque `assets/logo.png` e `assets/banner.jpg` por imagens suas (mesmo nome).
