# ⏰ Clock App

Um aplicativo de desktop moderno e elegante para gerenciamento de tempo e produtividade, construído com **Electron** e **JavaScript**. Inspirado no design e funcionalidade do aplicativo Relógio do iOS.

[![GitHub Release](https://img.shields.io/github/v/release/PietroFilippo/ClockApp?style=flat-square)](https://github.com/PietroFilippo/ClockApp/releases/latest)
[![Electron](https://img.shields.io/badge/Electron-40-47848F?style=flat-square&logo=electron)](https://www.electronjs.org/)
[![License](https://img.shields.io/github/license/PietroFilippo/ClockApp?style=flat-square)](LICENSE)

---

## 📋 Visão Geral

O **Clock App** é uma ferramenta completa para gerenciar seu tempo. Ele combina funcionalidades essenciais como Relógio Mundial, Alarmes, Cronômetro e Temporizador em uma interface limpa e intuitiva, com tema escuro. O aplicativo foi projetado para se integrar perfeitamente ao ambiente de trabalho, oferecendo notificações personalizáveis, minimização para a bandeja do sistema (System Tray), atalhos globais configuráveis, atualização automática e persistência de dados.

---

## Funcionalidades

### 🌍 Relógio Mundial
- Adicione múltiplos relógios de diferentes fusos horários
- Pesquisa de cidades integrada com suporte a vários idiomas
- **Drag & Drop**: Reordene os relógios arrastando e soltando
- Visualização clara da diferença de horário (Offset GMT)
- Menu de contexto (clique direito) para editar ou deletar

### ⏰ Alarmes
- Crie alarmes com horários específicos e etiquetas personalizadas
- **Repetição**: Configure alarmes para dias específicos da semana (com botão "Selecionar Todos")
- **Sons Personalizados**: Escolha entre 13 sons inclusos ou adicione seus próprios arquivos de áudio
- **Soneca (Snooze)**: Adie alarmes com intervalos configuráveis (1–30 min)
- **Persistência**: Alarmes, estados de soneca e configurações são salvos automaticamente
- Menu de contexto para edição e exclusão rápida

### ⏱️ Cronômetro
- Cronômetro preciso com display de alta resolução (horas, minutos, segundos, centésimos)
- **Voltas (Laps)**: Registre voltas com indicação visual da melhor e pior
- **Cores Customizáveis**: Personalize a cor do display via Color Picker interativo (canvas)
- **Velocidade**: Ajuste entre 3 velocidades de atualização do display
- **Atalhos Configuráveis**: Grave e personalize atalhos de teclado (Start/Stop, Lap, Stop, Reset) com resolução inteligente de conflitos
- **Download**: Exporte as voltas registradas como arquivo de texto

### ⏲️ Temporizador
- Interface visual com **anel de progresso circular** (SVG animado)
- **Recentes**: Timers usados recentemente ficam salvos para reutilização rápida
- **Repetir**: Repita o último timer diretamente da notificação
- Seleção direta de horas, minutos e segundos com validação
- Modo de edição para gerenciar lista de recentes

### ⚙️ Configurações
| Configuração | Descrição |
|---|---|
| **Start on Boot** | Inicia o app automaticamente ao fazer login |
| **Minimize to Tray** | Mantém o app rodando em segundo plano ao fechar |
| **Prevent Sleep** | Impede que o computador hiberne durante timers |
| **Steal Focus** | Notificações tomam foco do teclado |
| **Notification Style** | Sistema (Windows), App Custom, Ambos ou Nenhum |
| **Notification Position** | 4 cantos pré-definidos ou posição customizada (picker visual) |
| **Auto-Close Duration** | Tempo até a notificação fechar automaticamente (5s – 1min ou Nunca) |
| **Global Shortcuts** | Atalhos funcionam mesmo com o app minimizado |

### 🔔 Notificações
- **Notificações Híbridas**: Suporte a notificações nativas do SO e/ou janelas de sobreposição personalizadas
- **Overlay Visual**: Notificação in-app com botões de ação (Parar, Soneca, Repetir)
- **Posição Customizada**: Escolha onde a notificação aparece na tela com picker visual
- **Arrastar**: Janela de notificação arrastável via clique em qualquer área
- **Truncamento**: Labels longas são truncadas a 60 caracteres

### 🔄 Atualização Automática
- Verificação automática de novas versões via **GitHub Releases** ao iniciar
- Banner com botão **Update** (baixa e instala automaticamente) e **View Release** (abre a página no navegador)
- Barra de progresso animada durante o download
- Powered by `electron-updater`

---

## 🛠️ Arquitetura e Tecnologias

O projeto utiliza uma arquitetura baseada em **Electron** com **Vite** para o bundle do renderizador. O código é escrito em **Vanilla JavaScript** (ES Modules), focando em performance e simplicidade.

| Camada | Tecnologia |
|---|---|
| **Runtime** | [Electron](https://www.electronjs.org/) v40 |
| **Bundler** | [Vite](https://vitejs.dev/) v7 |
| **Linguagem** | JavaScript (ES6+ Modules) |
| **Estilização** | CSS puro com variáveis |
| **Build** | [electron-builder](https://www.electron.build/) v26 (NSIS) |
| **Auto-Update** | [electron-updater](https://www.electron.build/auto-update) v6 |
| **Armazenamento** | `localStorage` (renderer) + `settings.json` (main process via `fs`) |

### Estrutura de Pastas

```
clockapp/
├── electron/                       # Processo Principal (Main Process)
│   ├── main.js                     # Entry point do Electron, IPC, autoUpdater, tray
│   ├── preload.js                  # Bridge segura (contextBridge + ipcRenderer)
│   ├── notification.html           # Janela de notificação custom (secundária)
│   └── positionPicker.html         # Picker de posição custom para notificações
│
├── src/                            # Processo de Renderização (UI)
│   ├── main.js                     # Entry point do frontend, roteamento e update banner
│   │
│   ├── components/                 # Componentes de UI
│   │   ├── Alarm.js                # Tela de alarmes (skeleton + updates granulares)
│   │   ├── Navigation.js           # Barra de navegação inferior
│   │   ├── RingOverlay.js          # Overlay de tela cheia para alarmes/timers tocando
│   │   ├── Settings.js             # Tela de configurações
│   │   ├── Stopwatch.js            # Cronômetro com laps, cores e velocidade
│   │   ├── Timer.js                # Temporizador com anel circular e recentes
│   │   └── WorldClock.js           # Relógio mundial com drag & drop
│   │
│   ├── modules/                    # Lógica de negócios e gerenciamento de estado
│   │   ├── AlarmManager.js         # Estado, agendamento, soneca e áudio dos alarmes
│   │   ├── StopwatchManager.js     # Estado e lógica do cronômetro
│   │   └── TimerManager.js         # Estado, contagem regressiva e recentes do timer
│   │
│   ├── utils/                      # Utilitários compartilhados
│   │   ├── AudioManager.js         # Gerenciador centralizado de áudio (Web Audio API)
│   │   ├── ColorPicker.js          # Color picker interativo (canvas)
│   │   ├── KeybindManager.js       # Gravação, conflitos e modal de atalhos
│   │   ├── SoundPicker.js          # Seletor de sons (padrão + custom)
│   │   ├── SoundSettingsModal.js   # Modal de configurações de som do alarme
│   │   ├── constants.js            # Constantes (storage keys, cores, limites)
│   │   ├── contextMenu.js          # Menu de contexto (clique direito)
│   │   ├── modal.js                # Utilitário de modais genéricos
│   │   ├── notification.js         # Alerts, confirms e truncate
│   │   └── sanitize.js             # Escape de HTML
│   │
│   ├── data/
│   │   └── timezones.js            # Lista de fusos horários
│   │
│   └── assets/styles/              # Estilos CSS
│       ├── index.css               # Entry point de estilos (@import)
│       ├── variables.css           # Variáveis de tema (cores, fontes)
│       ├── base.css                # Estilos globais
│       ├── layout.css              # Title bar, navegação, update banner
│       ├── components/             # Estilos de componentes reutilizáveis
│       │   ├── context-menu.css
│       │   ├── form.css
│       │   ├── header.css
│       │   └── modal.css
│       └── features/               # Estilos por funcionalidade
│           ├── alarm.css
│           ├── settings.css
│           ├── stopwatch.css
│           ├── timer.css
│           └── world-clock.css
│
├── public/                         # Assets estáticos
│   ├── icon.png                    # Ícone do app
│   ├── manifest.json               # PWA manifest
│   ├── sw.js                       # Service Worker
│   └── sounds/                     # 13 sons inclusos (alarmes e notificações)
│
├── release/                        # Saída dos builds de produção
├── package.json                    # Dependências, scripts e config do electron-builder
├── vite.config.js                  # Configuração do Vite
└── index.html                      # HTML principal com CSP e Service Worker
```

### Padrões de Renderização

Os componentes utilizam um padrão otimizado de renderização:
- **Skeleton estático**: A estrutura HTML é criada uma única vez no `container`
- **Updates granulares**: Apenas os elementos dinâmicos (listas, contadores, estados de botões) são atualizados
- **Delegação de eventos**: Event listeners são registrados uma vez no container via delegação
- **Tracking de modo**: Timer.js rastreia o modo (picker/running) para evitar rebuilds desnecessários

### Comunicação IPC

A comunicação entre Main ↔ Renderer é feita exclusivamente via `contextBridge` + `ipcRenderer` (exposto como `window.electronAPI`), garantindo isolamento de contexto (`contextIsolation: true`).

---

## 🚀 Instalação e Execução

### 📥 Download Rápido

A forma mais fácil de instalar é baixar o instalador mais recente diretamente da página de releases:

**[Baixar última versão (.exe)](https://github.com/PietroFilippo/ClockApp/releases/latest)**

Basta executar o instalador e seguir as instruções. O app receberá atualizações automaticamente.

---

### Desenvolvimento

#### Pré-requisitos
- Node.js (versão recomendada: LTS)
- npm

### Desenvolvimento

```bash
# Clone o repositório
git clone https://github.com/PietroFilippo/ClockApp.git
cd ClockApp

# Instale as dependências
npm install

# Execute em modo de desenvolvimento
npm run electron:dev
```

### Build para Produção

```bash
# Gera o instalador (.exe) na pasta release/
npm run electron:build
```

### Scripts Disponíveis

| Script | Descrição |
|---|---|
| `npm run dev` | Inicia o servidor Vite (apenas frontend) |
| `npm run build` | Build do frontend via Vite |
| `npm run electron:dev` | Dev completo (Vite watch + Electron) |
| `npm run electron:build` | Build de produção (Vite + electron-builder) |
| `npm run electron:publish` | Build + publicação no GitHub Releases |

---

## ⌨️ Atalhos

| Atalho | Ação |
|---|---|
| `Alt+P` | Start/Stop do cronômetro* |
| `Alt+L` | Registrar volta* |
| `Alt+S` | Parar cronômetro* |
| `Alt+R` | Reset do cronômetro* |
| `Ctrl+Shift+I` | DevTools (apenas em desenvolvimento) |
| `Ctrl+Q` | Encerrar totalmente o aplicativo |

\* Atalhos padrão, podem ser reconfigurados no modal de keybinds do Cronômetro.

---

## ⚠️ Limitações Conhecidas

- O bloqueio de suspensão de energia (Power Save Blocker) é gerenciado pelo Electron, mas pode depender de permissões do SO.
- Em alguns sistemas, notificações customizadas podem não se sobrepor a aplicativos em "Tela Cheia Exclusiva" (jogos).
- A atualização automática funciona em builds empacotados. Em modo de desenvolvimento, o check é desabilitado.
- Sem code signing, o Windows SmartScreen pode exibir aviso ao instalar/atualizar.

---
