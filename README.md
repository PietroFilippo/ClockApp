# Clock App

Um aplicativo de desktop moderno e elegante para gerenciamento de tempo e produtividade, construído com Electron e JavaScript. Inspirado no design e funcionalidade do aplicativo Relógio do iOS (iPhone).

## 📋 Visão Geral

O **Clock App** é uma ferramenta completa para gerenciar seu tempo. Ele combina funcionalidades essenciais como Relógio Mundial, Alarmes, Cronômetro e Temporizador em uma interface limpa e intuitiva. O aplicativo foi projetado para se integrar perfeitamente ao ambiente de trabalho, oferecendo notificações personalizáveis, minimização para a bandeja do sistema (System Tray) e persistência de dados.

## Funcionalidades Principais

*   **🌍 Relógio Mundial**:
    *   Adicione múltiplos relógios de diferentes fusos horários.
    *   Pesquisa de cidades integrada.
    *   Reordene os relógios com "arrastar e soltar" (Drag & Drop).
    *   Visualização clara da diferença de horário (Offset GMT).

*   **⏰ Alarmes**:
    *   Crie alarmes com horários específicos e etiquetas personalizadas.
    *   **Repetição**: Configure alarmes para dias específicos da semana.
    *   **Sons Personalizados**: Escolha entre sons padrão ou adicione seus próprios arquivos de áudio.
    *   **Soneca (Snooze)**: Funcionalidade de adiar alarmes com intervalos configuráveis.
    *   Persistência: Alarmes e estados de soneca são salvos automaticamente.

*   **⏱️ Cronômetro e Temporizador**:
    *   Cronômetro preciso.
    *   Temporizador com interface visual circular e presets de tempo.
    *   Notificações visuais e sonoras ao término.

*   **🔧 Sistema e Integração**:
    *   **Notificações Híbridas**: Suporte a notificações nativas do SO e/ou janelas de sobreposição personalizadas (Custom Overlays).
    *   **System Tray**: O app continua rodando em segundo plano quando fechado, acessível via ícone na bandeja.
    *   **Power Blocker**: Impede que o computador hiberne enquanto funcionalidades críticas estão ativas (gerenciado pelo Electron).
    *   **Janela Customizada**: Interface "frameless" com controles de janela personalizados.

## 🛠️ Arquitetura e Tecnologias

O projeto utiliza uma arquitetura baseada em **Electron** com **Vite** para o bundle do renderizador. O código é escrito em **Vanilla JavaScript** (ES Modules), focando em performance e simplicidade sem a sobrecarga de frameworks complexos.

*   **Runtime**: [Electron](https://www.electronjs.org/) (Main Process)
*   **Bundler**: [Vite](https://vitejs.dev/)
*   **Linguagem**: JavaScript (ES6+)
*   **Estilização**: CSS Puro (Vanilla CSS) com variáveis para temas.
*   **Armazenamento**:
    *   `localStorage`: Utilizado para dados do usuário no Renderer (Alarmes, Cidades, Tabs).
    *   `settings.json`: Arquivo local (via `fs` no Main Process) para configurações globais da janela e do aplicativo.

### Estrutura de Pastas

```
clockapp/
├── electron/           # Código do Processo Principal (Main Process)
│   └── main.js         # Entry point do Electron, gerenciamento de janelas e IPC
├── src/                # Código do Processo de Renderização (UI)
│   ├── components/     # Componentes de UI (Alarm.js, WorldClock.js, etc.)
│   ├── modules/        # Lógica de negócios e gerenciamento de estado (AlarmManager.js)
│   ├── data/           # Dados estáticos (fusos horários)
│   ├── utils/          # Utilitários (Notificações, Modais)
│   └── main.js         # Entry point do Frontend
├── public/             # Assets estáticos (ícones, sons)
└── release/            # Saída dos builds de produção
```

## Instalação e Execução

### Pré-requisitos
*   Node.js (versão recomendada: LTS)
*   npm ou yarn

### Passos

1.  **Clone o repositório** (ou baixe os arquivos):
    ```bash
    git clone <url-do-repositorio>
    cd clockapp
    ```

2.  **Instale as dependências**:
    ```bash
    npm install
    ```

3.  **Execute em modo de desenvolvimento**:
    Este comando inicia tanto o servidor Vite quanto a janela do Electron.
    ```bash
    npm run electron:dev
    ```

4.  **Compilar para Produção (Build)**:
    Gera o instalador do aplicativo na pasta `release`.
    ```bash
    npm run electron:build
    ```

## Configuração

As configurações do aplicativo (como posição das notificações, comportamento ao fechar, etc.) são acessíveis via interface, na aba de **Configurações**.

**Atalhos e Comportamentos:**
*   **Ctrl+Shift+I**: DevTools (Bloqueado em produção).
*   **Command/Ctrl+Q**: Encerra totalmente o aplicativo.
*   **Minimizar**: Por padrão, o botão de fechar minimiza para a bandeja (configurável).

## Limitações Conhecidas

*   O bloqueio de suspensão de energia (Power Save Blocker) é gerenciado pelo Electron, mas pode depender de permissões do SO.
*   Em alguns sistemas, notificações customizadas podem não se sobrepor a aplicativos em "Tela Cheia Exclusiva" (jogos).

---
