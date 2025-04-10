# WhatsApp Reminder Bot

Um chatbot para WhatsApp que permite criar e gerenciar lembretes usando linguagem natural (em português).

## Funcionalidades

- Criação de lembretes com processamento de linguagem natural
- Suporte para frequências: única vez, diária, semanal, mensal
- Notificações automáticas para lembretes
- Lembretes de véspera para eventos importantes
- Gerenciamento de lembretes: listar, marcar como concluído, deletar

## Pré-requisitos

- Node.js 14 ou superior
- MongoDB instalado e rodando (local ou na nuvem)
- Um smartphone com WhatsApp instalado

## Instalação

1. Clone o repositório:
```bash
git clone https://github.com/seu-usuario/whatsapp-reminder-bot.git
cd whatsapp-reminder-bot
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente no arquivo `.env`:
```
MONGODB_URI=mongodb://localhost:27017/reminder_bot
PORT=3000
TIMEZONE=America/Sao_Paulo
```

4. Compile o TypeScript:
```bash
npm run build
```

## Uso

1. Inicie o bot:
```bash
npm start
```

2. Escaneie o código QR que aparecerá no terminal com seu WhatsApp
3. O bot estará pronto para receber comandos e criar lembretes

## Exemplos de Comandos

- **Criar um lembrete**: Basta enviar uma mensagem descrevendo o evento, a data e a hora
  - "Reunião com cliente dia 18 de abril às 21 horas"
  - "Todos os dias preciso tomar 5 gramas de creatina às 11:30 da manhã"

- **Comandos disponíveis**:
  - `/lembretes` - Listar todos seus lembretes
  - `/concluir ID` - Marcar um lembrete como concluído
  - `/deletar ID` - Remover um lembrete
  - `/ajuda` - Mostrar mensagem de ajuda

## Modo de desenvolvimento

Para iniciar em modo de desenvolvimento com recarregamento automático:
```bash
npm run dev
```

## Construído com

- TypeScript
- Node.js
- WhatsApp Web.js
- MongoDB & Mongoose
- node-cron

## Licença

MIT # whatsapp-bot-reminder
