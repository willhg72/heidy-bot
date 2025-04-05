"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsappService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const whatsapp_web_js_1 = require("whatsapp-web.js");
const qrcode = __importStar(require("qrcode-terminal"));
// Fix the import statement
const qrcodeLib = __importStar(require("qrcode")); // Rename to avoid conflict
const email_service_1 = require("../email/email.service");
// Create a silent logger that doesn't output to console
class SilentLogger {
    log(message, ...optionalParams) { }
    error(message, ...optionalParams) { }
    warn(message, ...optionalParams) { }
    debug(message, ...optionalParams) { }
    verbose(message, ...optionalParams) { }
}
// Estados de la conversación
var ConversationState;
(function (ConversationState) {
    ConversationState["MENU_PRINCIPAL"] = "MENU_PRINCIPAL";
    ConversationState["NOMBRE_PACIENTE"] = "NOMBRE_PACIENTE";
    ConversationState["NUMERO_WHATSAPP"] = "NUMERO_WHATSAPP";
    ConversationState["CORREO_PACIENTE"] = "CORREO_PACIENTE";
})(ConversationState || (ConversationState = {}));
// Límite de intentos inválidos
const MAX_INTENTOS_INVALIDOS = 3;
// Regex para validación
const PHONE_REGEX = /^\+\d{1,3}\s?\d{5,12}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
let WhatsappService = class WhatsappService {
    constructor(configService, emailService) {
        this.configService = configService;
        this.emailService = emailService;
        this.userStates = new Map();
        // Replace the standard logger with the silent logger
        this.logger = new SilentLogger();
        this.reconnectTimer = null;
        // Create client with more robust session handling
        this.client = new whatsapp_web_js_1.Client({
            authStrategy: new whatsapp_web_js_1.LocalAuth({
                dataPath: './whatsapp-sessions',
                clientId: 'whatsapp-bot-main', // Use a consistent client ID instead of a timestamp
            }),
            puppeteer: {
                args: ['--no-sandbox'],
                // Add more puppeteer options to help with cleanup
                handleSIGINT: false, // Let our app handle process termination
            },
        });
        this.registerEventHandlers();
    }
    registerEventHandlers() {
        // Make sure client is not null before registering handlers
        if (!this.client) {
            this.logger.error('Cannot register event handlers: client is null');
            return;
        }
        this.client.on('qr', (qr) => {
            qrcode.generate(qr, { small: true });
            this.logger.log('QR RECEIVED. Scan it with your WhatsApp app.');
            this.sendQrCodeByEmail(qr);
        });
        this.client.on('disconnected', (reason) => {
            this.logger.error(`Client was disconnected: ${reason}`);
            // Don't try to use this client instance anymore
            this.client = null;
            // Clear any existing reconnection timer
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
            }
            // Set a new reconnection timer with a longer delay
            this.reconnectTimer = setTimeout(() => {
                this.logger.log('Creating new client instance after disconnection...');
                this.initializeClient();
            }, 20000); // Wait 20 seconds before trying to reconnect
        });
        this.client.on('ready', () => {
            this.logger.log('WhatsApp client is ready!');
        });
        this.client.on('message_create', (msg) => {
            this.logger.log(`Message created: ${msg.body} from ${msg.from}`);
        });
        this.client.on('message_ack', (msg, ack) => {
            this.logger.log(`Message acknowledgement: ${ack} for message: ${msg.body}`);
        });
        this.client.on('message', (msg) => __awaiter(this, void 0, void 0, function* () {
            this.logger.log(`Message received: ${msg.body} from ${msg.from}, fromMe: ${msg.fromMe}`);
            if (msg.body) {
                try {
                    this.logger.log(`Processing message: ${msg.body}`);
                    yield this.handleMessage(msg);
                    this.logger.log(`Handled message: ${msg.body}`);
                }
                catch (error) {
                    const errorMessage = (error === null || error === void 0 ? void 0 : error.message) || 'Unknown error';
                    const errorStack = (error === null || error === void 0 ? void 0 : error.stack) || '';
                    this.logger.error(`Error handling message: ${errorMessage}`, errorStack);
                }
            }
        }));
        this.client.on('auth_failure', (msg) => {
            this.logger.error(`Authentication failure: ${msg}`);
        });
    }
    onModuleInit() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.initializeClient();
        });
    }
    cleanupSessionFiles(clientId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.logger.log(`Attempting to clean up session files for client: ${clientId}`);
                const fs = require('fs');
                const path = require('path');
                const sessionDir = path.join(process.cwd(), 'whatsapp-sessions', `session-${clientId}`);
                // Check if directory exists before attempting to delete
                if (fs.existsSync(sessionDir)) {
                    // Instead of recursive delete, try to delete specific problematic files first
                    const cookiesPath = path.join(sessionDir, 'Default', 'Cookies-journal');
                    if (fs.existsSync(cookiesPath)) {
                        try {
                            fs.unlinkSync(cookiesPath);
                            this.logger.log('Successfully deleted Cookies-journal file');
                        }
                        catch (err) {
                            this.logger.warn(`Could not delete Cookies-journal: ${err instanceof Error ? err.message : 'Unknown error'}`);
                            // Continue anyway
                        }
                    }
                    // Wait a bit before attempting full directory deletion
                    yield new Promise(resolve => setTimeout(resolve, 2000));
                    // Now try to delete the directory, but don't throw if it fails
                    try {
                        // Use rimraf for more reliable directory deletion
                        const rimraf = require('rimraf');
                        rimraf.sync(sessionDir, { maxRetries: 3, retryDelay: 1000 });
                        this.logger.log(`Successfully cleaned up session directory: ${sessionDir}`);
                    }
                    catch (err) {
                        this.logger.warn(`Could not delete session directory: ${err instanceof Error ? err.message : 'Unknown error'}`);
                        // Continue anyway
                    }
                }
            }
            catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                this.logger.warn(`Error during session cleanup: ${errorMsg}`);
                // Don't throw, just log the error
            }
        });
    }
    initializeClient() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // First, clear any existing reconnect timer
                if (this.reconnectTimer) {
                    clearTimeout(this.reconnectTimer);
                    this.reconnectTimer = null;
                }
                // If there's an existing client, try to destroy it properly
                if (this.client) {
                    try {
                        // Set a timeout to force destroy if it takes too long
                        const destroyTimeout = setTimeout(() => {
                            this.logger.warn('Client destroy operation timed out, forcing cleanup');
                            this.client = null;
                        }, 5000);
                        // Check if client has destroy method before calling it
                        if (typeof this.client.destroy === 'function') {
                            yield this.client.destroy().catch(err => {
                                const errorMsg = err instanceof Error ? err.message : 'Unknown error';
                                this.logger.error(`Error during client destroy: ${errorMsg}`);
                            });
                        }
                        else {
                            this.logger.warn('Client destroy method not available, forcing cleanup');
                        }
                        clearTimeout(destroyTimeout);
                        this.client = null;
                    }
                    catch (destroyError) {
                        // Fix: Properly handle the error object
                        const errorMsg = destroyError instanceof Error ? destroyError.message : 'Unknown error';
                        this.logger.error(`Failed to destroy client: ${errorMsg}`);
                        this.client = null;
                    }
                }
                // Wait a bit to ensure resources are released
                yield new Promise(resolve => setTimeout(resolve, 5000));
                // Create a new client with a CONSISTENT ID
                const clientId = 'whatsapp-bot-main';
                this.logger.log(`Creating client with consistent ID: ${clientId}`);
                this.client = new whatsapp_web_js_1.Client({
                    authStrategy: new whatsapp_web_js_1.LocalAuth({
                        dataPath: './whatsapp-sessions',
                        clientId: clientId,
                    }),
                    puppeteer: {
                        // More conservative Puppeteer options
                        args: [
                            '--no-sandbox',
                            '--disable-setuid-sandbox',
                            '--disable-dev-shm-usage',
                            '--disable-accelerated-2d-canvas',
                            '--no-first-run',
                            '--no-zygote',
                            '--single-process', // This might help with resource cleanup
                            '--disable-gpu'
                        ],
                        handleSIGINT: false,
                        headless: true,
                    },
                    // Don't try to restart on auth failure - we'll handle reconnection ourselves
                    restartOnAuthFail: false,
                });
                // Register event handlers
                this.registerEventHandlers();
                // Initialize with a timeout
                if (this.client) {
                    const initTimeout = 60000; // 60 seconds
                    try {
                        yield Promise.race([
                            this.client.initialize(),
                            new Promise((_, reject) => setTimeout(() => reject(new Error('Client initialization timed out')), initTimeout))
                        ]);
                        this.logger.log(`Client initialized successfully with ID: ${clientId}`);
                    }
                    catch (initError) {
                        // Fix: Properly handle the error object
                        const errorMsg = initError instanceof Error ? initError.message : 'Unknown error';
                        this.logger.error(`Client initialization failed: ${errorMsg}`);
                        // Clean up the failed client
                        this.client = null;
                        // Schedule a retry
                        this.reconnectTimer = setTimeout(() => {
                            this.logger.log('Retrying client initialization...');
                            this.initializeClient();
                        }, 30000);
                        return; // Exit early
                    }
                }
            }
            catch (error) {
                // Fix: Properly handle the error object
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                this.logger.error(`Unexpected error during client initialization: ${errorMsg}`);
                // Schedule a retry
                this.reconnectTimer = setTimeout(() => {
                    this.logger.log('Retrying client initialization after error...');
                    this.initializeClient();
                }, 30000);
            }
        });
    }
    getUserState(userId) {
        if (!this.userStates.has(userId)) {
            this.userStates.set(userId, {
                state: ConversationState.MENU_PRINCIPAL,
                intentos: 0,
                menu_mostrado: false,
                data: {}
            });
        }
        return this.userStates.get(userId);
    }
    // Keep only this handleMessage implementation and remove the other one
    handleMessage(msg) {
        return __awaiter(this, void 0, void 0, function* () {
            const userId = msg.from;
            this.logger.log(`Handling message for user: ${userId}`);
            // Add try-catch for better error handling
            try {
                // Change activation command from "/bot" to "info"
                if (msg.body.toLowerCase() === 'info') {
                    this.logger.log('Bot activation command detected');
                    const userState = this.getUserState(userId);
                    userState.intentos = 0;
                    userState.menu_mostrado = false;
                    userState.state = ConversationState.MENU_PRINCIPAL;
                    return yield this.mostrarMenu(msg);
                }
                // Only proceed with conversation if the user already has a state (bot was activated)
                if (this.userStates.has(userId)) {
                    const userState = this.getUserState(userId);
                    this.logger.log(`User state: ${JSON.stringify(userState)}`);
                    // Handle restart commands
                    if (msg.body.toLowerCase() === '/start' || msg.body.toLowerCase() === 'hola') {
                        this.logger.log('Detected restart command');
                        userState.intentos = 0;
                        userState.menu_mostrado = false;
                        userState.state = ConversationState.MENU_PRINCIPAL;
                        return yield this.mostrarMenu(msg);
                    }
                    // Manejar según el estado actual
                    this.logger.log(`Processing state: ${userState.state}`);
                    switch (userState.state) {
                        case ConversationState.MENU_PRINCIPAL:
                            return yield this.handleMenuPrincipal(msg, userState);
                        case ConversationState.NOMBRE_PACIENTE:
                            return yield this.handleNombrePaciente(msg, userState);
                        case ConversationState.NUMERO_WHATSAPP:
                            return yield this.handleNumeroWhatsApp(msg, userState);
                        case ConversationState.CORREO_PACIENTE:
                            return yield this.handleCorreoPaciente(msg, userState);
                        default:
                            return yield this.mostrarMenu(msg);
                    }
                }
                // If we get here, the message is ignored (bot not activated)
            }
            catch (error) { // Add type annotation here
                this.logger.error(`Error in handleMessage: ${(error === null || error === void 0 ? void 0 : error.message) || 'Unknown error'}`);
                // Try to send a fallback message
                try {
                    yield msg.reply("🤖 Lo siento, ocurrió un error. Por favor, intenta de nuevo escribiendo 'info'.");
                }
                catch (replyError) { // Add type annotation here
                    this.logger.error(`Failed to send error message: ${(replyError === null || replyError === void 0 ? void 0 : replyError.message) || 'Unknown error'}`);
                }
            }
        });
    }
    mostrarMenu(msg) {
        return __awaiter(this, void 0, void 0, function* () {
            const userId = msg.from;
            this.logger.log(`Showing menu for user: ${userId}`);
            const userState = this.getUserState(userId);
            let mensaje;
            if (userState.menu_mostrado) {
                mensaje = "🤖 *MENÚ DE OPCIONES*\n\n" +
                    "Seleccione un número:\n\n" +
                    "[ 2️⃣ ] 📅 Agendar una cita\n\n" +
                    "[ 3️⃣ ] 👋 Salir";
            }
            else {
                mensaje = "¡Hola! 👋 Soy Laura B. 🤖 Asistente de la Psicoterapeuta Heidy Codallo. Gracias por contactarnos. ✨\n\n" +
                    "🤖 *MENÚ DE OPCIONES*\n\n" +
                    "Seleccione un número:\n\n" +
                    "[ 1️⃣ ] 📝 Información de las Sesiones de Terapia\n\n" +
                    "[ 2️⃣ ] 📅 Agendar una cita\n\n" +
                    "[ 3️⃣ ] 👋 Salir";
                userState.menu_mostrado = true;
            }
            userState.state = ConversationState.MENU_PRINCIPAL;
            this.logger.log(`Sending menu message: ${mensaje}`);
            try {
                yield msg.reply(mensaje);
                this.logger.log('Menu message sent successfully');
            }
            catch (error) { // Add type annotation here
                this.logger.error(`Failed to send menu message: ${(error === null || error === void 0 ? void 0 : error.message) || 'Unknown error'}`);
                // Try alternative method
                try {
                    const chat = yield msg.getChat();
                    yield chat.sendMessage(mensaje);
                    this.logger.log('Menu message sent via chat.sendMessage');
                }
                catch (chatError) { // Add type annotation here
                    this.logger.error(`Failed to send via chat: ${(chatError === null || chatError === void 0 ? void 0 : chatError.message) || 'Unknown error'}`);
                }
            }
        });
    }
    handleMenuPrincipal(msg, userState) {
        return __awaiter(this, void 0, void 0, function* () {
            const opcion = msg.body.trim();
            if (opcion === "1") {
                yield msg.reply("🤖 ¡Sí, con gusto! ✨\n\n📱 La sesión es online por videollamada WhatsApp\n\n⏱️ La duración de la sesión es de 90 minutos\n\n💰 El costo es de 55 USD (precio único internacional, válido desde cualquier país)\n\n💳 Aceptamos diferentes métodos de pago");
                // Add a delay before showing the menu again to improve UX
                yield new Promise(resolve => setTimeout(resolve, 10000));
                // Set menu_mostrado to true so we get the shorter menu format
                userState.menu_mostrado = true;
                return yield this.mostrarMenu(msg);
            }
            else if (opcion === "2") {
                // Rest of the code remains the same
                userState.state = ConversationState.NOMBRE_PACIENTE;
                yield msg.reply("🤖 ¡Genial! ¿Puedes indicarme su nombre completo, por favor?");
            }
            else if (opcion === "3") {
                yield msg.reply("🤖 Gracias por tu interés. Si necesitas ayuda más adelante, no dudes en escribirnos. ¡Bendiciones!🙏");
                this.userStates.delete(msg.from);
            }
            else {
                userState.intentos += 1;
                if (userState.intentos >= MAX_INTENTOS_INVALIDOS) {
                    yield msg.reply(" 🤖 Parece que tienes dudas. Si necesitas ayuda más adelante, no dudes en escribirnos. ¡Bendiciones!🙏");
                    this.userStates.delete(msg.from);
                }
                else {
                    yield msg.reply(" 🤖 Por favor, selecciona una opción válida (1, 2 o 3).");
                }
            }
        });
    }
    handleNombrePaciente(msg, userState) {
        return __awaiter(this, void 0, void 0, function* () {
            const nombre = msg.body.trim();
            // Validate that the name contains only letters, spaces, and common name characters
            const NAME_REGEX = /^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s.'-]+$/;
            if (!NAME_REGEX.test(nombre)) {
                userState.intentos += 1;
                if (userState.intentos >= MAX_INTENTOS_INVALIDOS) {
                    yield msg.reply("🤖 Parece que sigues ingresando un nombre inválido. Si deseas continuar, puedes intentarlo más adelante. ¡Bendiciones! 🙏");
                    this.userStates.delete(msg.from);
                }
                else {
                    yield msg.reply("⚠️ Por favor, ingresa un nombre válido que contenga solo letras (sin números ni caracteres especiales).");
                }
                return;
            }
            userState.data.nombre = nombre;
            userState.intentos = 0;
            // Store the WhatsApp number directly from the message sender
            // The msg.from contains the WhatsApp number in the format "123456789@c.us"
            const whatsappNumber = msg.from.split('@')[0];
            userState.data.whatsapp = whatsappNumber;
            // Skip the WhatsApp number question and go directly to email
            userState.state = ConversationState.CORREO_PACIENTE;
            yield msg.reply("✅ Perfecto. Ahora, ¿puedes indicarnos tu correo electrónico? 📧\n\n📱 Te enviaremos promociones especiales y recordatorios relacionados con nuestras terapias.\n\n❌ Si no deseas compartirlo, puedes escribir 'no'.");
        });
    }
    // Remove or comment out the handleNumeroWhatsApp method since we're not using it anymore
    // private async handleNumeroWhatsApp(msg: Message, userState: any) {
    //   ...
    // }
    handleNumeroWhatsApp(msg, userState) {
        return __awaiter(this, void 0, void 0, function* () {
            const numero = msg.body.trim();
            if (!PHONE_REGEX.test(numero)) {
                userState.intentos += 1;
                if (userState.intentos >= MAX_INTENTOS_INVALIDOS) {
                    yield msg.reply("Parece que el número sigue siendo inválido. Si deseas continuar, puedes intentarlo más adelante. ¡Bendiciones!");
                    this.userStates.delete(msg.from);
                }
                else {
                    yield msg.reply("⚠️ El número no es válido. Asegúrate de incluir el código de país. Ejemplo: +57 3001234567");
                }
                return;
            }
            userState.data.whatsapp = numero;
            userState.intentos = 0;
            userState.state = ConversationState.CORREO_PACIENTE;
            yield msg.reply("✅ Perfecto. Ahora, ¿puedes indicarnos tu correo electrónico? 📧\n\n📱 Te enviaremos promociones especiales y recordatorios relacionados con nuestras terapias.\n\n❌ Si no deseas compartirlo, puedes escribir 'no'.");
        });
    }
    handleCorreoPaciente(msg, userState) {
        return __awaiter(this, void 0, void 0, function* () {
            const correo = msg.body.trim();
            if (correo.toLowerCase() !== "no" && !EMAIL_REGEX.test(correo)) {
                yield msg.reply("⚠️ El correo ingresado no parece válido. Por favor, intenta de nuevo o escribe 'no'.");
                return;
            }
            userState.data.correo = correo.toLowerCase() !== "no" ? correo : "No proporcionado";
            // Enviar notificación por correo
            try {
                yield this.emailService.sendNotificationEmail(userState.data.whatsapp, `Nuevo paciente: ${userState.data.nombre}\nCorreo: ${userState.data.correo}`);
            }
            catch (error) {
                console.error('Error al enviar correo:', error);
            }
            yield msg.reply(`✨ ¡Gracias, ${userState.data.nombre}! ✨\n\n✅ Hemos registrado tus datos correctamente.\n\n📱 Pronto te contactaremos para coordinar tu cita.\n\n🙏 ¡Que tengas un excelente día!`);
            this.userStates.delete(msg.from);
        });
    }
    sendQrCodeByEmail(qr) {
        return __awaiter(this, void 0, void 0, function* () {
            // Define serverUrl and qrFileName at the top level of the function so they're accessible in catch blocks
            let serverUrl = '';
            let qrFileName = '';
            try {
                this.logger.log('Attempting to send QR code via email...');
                // Use path.join for cross-platform compatibility
                const path = require('path');
                const publicDir = path.join(process.cwd(), 'public');
                // Create directory if it doesn't exist
                const fs = require('fs');
                if (!fs.existsSync(publicDir)) {
                    fs.mkdirSync(publicDir, { recursive: true });
                }
                // Generate a unique filename for each QR code
                qrFileName = `qrcode-${Date.now()}.png`;
                const qrFilePath = path.join(publicDir, qrFileName);
                // Save QR code to file
                yield qrcodeLib.toFile(qrFilePath, qr);
                // Get server URL from environment or config
                serverUrl = process.env.SERVER_URL || this.configService.get('SERVER_URL') || (yield this.getServerUrl());
                const qrImageUrl = `${serverUrl}/${qrFileName}`;
                // Create a message with a completely different format to avoid confusion
                const timestamp = new Date().toLocaleString();
                const message = `Bot WhatsApp - Código QR de reconexión - ${timestamp}\n\n` +
                    `Para escanear el código QR, visita este enlace: ${qrImageUrl}`;
                // Use sendNotificationEmail with a recipient that clearly indicates this is for QR code
                yield this.emailService.sendNotificationEmail('QR-WhatsApp-Bot', // This will appear as the "to" field in the notification
                message);
                this.logger.log('QR code sent by email successfully');
            }
            catch (error) {
                this.logger.error(`Failed to send QR code by email: ${(error === null || error === void 0 ? void 0 : error.message) || 'Unknown error'}`);
                // Try an alternative approach
                try {
                    this.logger.log('Attempting alternative email method...');
                    // Now serverUrl and qrFileName are accessible here
                    // If serverUrl wasn't set in the first try block, get it now
                    if (!serverUrl) {
                        serverUrl = process.env.SERVER_URL || this.configService.get('SERVER_URL') || (yield this.getServerUrl());
                    }
                    // Create a message with a completely different format for the alternative recipient
                    const timestamp = new Date().toLocaleString();
                    const message = `Bot WhatsApp - Código QR de reconexión - ${timestamp}\n\n` +
                        `Para escanear el código QR, visita este enlace: ${serverUrl}/${qrFileName}`;
                    // Use a different recipient identifier for the alternative email
                    yield this.emailService.sendNotificationEmail('QR-WhatsApp-Bot-Backup', message);
                }
                catch (altError) {
                    this.logger.error(`Alternative email method also failed: ${(altError === null || altError === void 0 ? void 0 : altError.message) || 'Unknown error'}`);
                }
            }
        });
    }
    // Helper method to get server URL
    getServerUrl() {
        return __awaiter(this, void 0, void 0, function* () {
            // First try to get the server URL from environment variables
            const envUrl = process.env.SERVER_URL || this.configService.get('SERVER_URL');
            if (envUrl) {
                return envUrl;
            }
            // For local development, use localhost with the correct port
            const port = process.env.PORT || this.configService.get('PORT') || '3001';
            // Check if we're running in a development environment
            const isDev = process.env.NODE_ENV !== 'production';
            if (isDev) {
                this.logger.log('Using localhost URL for development environment');
                return `http://localhost:${port}`;
            }
            // Only try to get public IP if we're not in development
            try {
                const axios = require('axios');
                const response = yield axios.get('https://api.ipify.org');
                const publicIp = response.data;
                const protocol = process.env.USE_HTTPS === 'true' ? 'https' : 'http';
                return `${protocol}://${publicIp}:${port}`;
            }
            catch (error) {
                this.logger.warn('Could not determine server URL dynamically');
                // Return localhost as a fallback
                return `http://localhost:${port}`;
            }
        });
    }
    // Add this method after the getServerUrl method
    onModuleDestroy() {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.log('WhatsApp service is being destroyed...');
            // Clear any reconnect timers
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = null;
            }
            // Safely destroy the client if it exists
            if (this.client) {
                try {
                    this.logger.log('Attempting to destroy WhatsApp client...');
                    // Set a timeout to force cleanup if destroy takes too long
                    const destroyTimeout = setTimeout(() => {
                        this.logger.warn('Client destroy timed out during module destruction');
                        this.client = null;
                    }, 5000);
                    // Only call destroy if it's a function
                    if (typeof this.client.destroy === 'function') {
                        yield this.client.destroy().catch(err => {
                            const errorMsg = err instanceof Error ? err.message : 'Unknown error';
                            this.logger.error(`Error during client destroy on module destruction: ${errorMsg}`);
                        });
                    }
                    clearTimeout(destroyTimeout);
                }
                catch (error) {
                    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                    this.logger.error(`Failed to destroy client during module destruction: ${errorMsg}`);
                }
                finally {
                    this.client = null;
                }
            }
            this.logger.log('WhatsApp service destroyed');
        });
    } // Add this closing brace to properly close the class
};
exports.WhatsappService = WhatsappService;
exports.WhatsappService = WhatsappService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        email_service_1.EmailService])
], WhatsappService);
