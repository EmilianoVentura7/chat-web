import express, { Request, Response } from 'express';
import cors from 'cors';
import mysql from 'mysql2';
import WebSocket from 'ws';
import http from 'http';

const app = express();
app.use(express.json());
app.use(cors());

// Configurar la conexión a la base de datos
const db = mysql.createConnection({
    host: 'localhost', 
    user: 'root', 
    password: 'Bryam203A', 
    database: 'cs' 
});

// Conectar a la base de datos
db.connect((err) => {
    if (err) {
        console.error('Error conectando a la base de datos:', err);
        return;
    }
    console.log('Conectado a la base de datos MySQL');
});


let clients: Response[] = [];

// Agregar un nuevo cliente de SSE
app.get('/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    clients.push(res);

    req.on('close', () => {
        clients = clients.filter(client => client !== res);
    });
});

function sendEventToClients(event: string, data: any) {
    clients.forEach(client => {
        client.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    });
}

// Conteo de mensajes
app.get('/message-count', (req, res) => {
    db.query('SELECT COUNT(*) AS count FROM mensajes', (err, results: any[]) => {
        if (err) {
            console.error('Error ejecutando la consulta', err);
            res.status(500).json({ error: 'Error Interno del Servidor' });
            return;
        }
        const count = results[0].count;
        res.json({ count });
    });
});

// Obtener todas las notificaciones
app.get('/chat', (req, res) => {
    db.query('SELECT * FROM mensajes', (err, results) => {
        if (err) {
            res.status(500).json({ success: false, error: err });
            return;
        }
        res.json({
            success: true,
            notificaciones: results
        });
    });
});

// Agregar una nueva notificación
app.post('/notificaciones', (req, res) => {
    const { user, asunto } = req.body;

    db.query('INSERT INTO mensajes (user, asunto, fecha) VALUES (?, ?, ?)', [user, asunto, new Date()], (err, result) => {
        if (err) {
            res.status(500).json({ success: false, error: err });
            return;
        }

        const notificacion = {
            user,
            asunto,
            fecha: new Date().toISOString().slice(0, 19).replace('T', ' ')
        };

        sendEventToClients('newNotification', notificacion);
        sendMessageCountToClients();
        enviarEstadisticasMensajes();


        const discordWebhookUrl = 'https://discord.com/api/webhooks/1252373821286125712/mjqwj7pK6UpOi7cSSS9Fiouzl2etaoqImDZVRHrTLntanqeCCBukafXTi3cCegYeqwlI'; // Reemplaza con tu URL de webhook de Discord
        fetch(discordWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: `Nueva notificación \nusuario: ${user} \nmensaje: ${asunto}`
            })
        })
        .then(() => {
            console.log('Notificación enviada a Discord');
        })
        .catch(err => {
            console.error('Error enviando notificación a Discord:', err);
        });


        res.json({
            success: true,
            notificacion
        });
    });
});

// Función para enviar el conteo de mensajes a los clientes SSE
function sendMessageCountToClients() {
    db.query('SELECT COUNT(*) AS count FROM mensajes', (err, results: any[]) => {
        if (err) {
            console.error('Error ejecutando la consulta', err);
            return;
        }
        const count = results[0].count;
        sendEventToClients('messageCount', { count });
    });
}


//end point ws 
app.get('/mensajes/estadisticas', (req, res) => {
    db.query('SELECT user, COUNT(*) as mensajesEnviados FROM mensajes GROUP BY user', (error, results) => {
        if (error) {
            console.error('Error al obtener estadísticas de mensajes:', error);
            return res.status(500).json({ success: false, error: 'Error interno del servidor' });
        }
        return res.status(200).json({ success: true, datosUsuarios: results });
    });
});

const server = http.createServer(app);

const wss = new WebSocket.Server({ server });

function enviarEstadisticasMensajes() {
    db.query('SELECT user, COUNT(*) as mensajesEnviados FROM mensajes GROUP BY user', (error, results) => {
        if (error) {
            console.error('Error al obtener estadísticas de mensajes:', error);
            return;
        }
        const message = JSON.stringify({ type: 'estadisticasMensajes', data: results });
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    });
}

function createWebSocketConnection() {
    const ws = new WebSocket('ws://localhost:4000'); 

    ws.on('open', () => {
        console.log('Conexión WebSocket establecida');
    });

    ws.on('message', (message: string) => {
        const data = JSON.parse(message);
       
    });

    ws.on('close', () => {
        console.log('Conexión WebSocket cerrada. Intentando reconectar...');
        setTimeout(createWebSocketConnection, 5000); 
    });

    ws.on('error', (error) => {
        console.error('Error en WebSocket:', error);
    });

    return ws;
}

wss.on('connection', (ws: WebSocket) => {
    console.log('Cliente conectado');

    ws.on('message', (message: string) => {
        const data = JSON.parse(message);
    });

    ws.on('close', () => {
        console.log('Cliente desconectado');
    });
});

const ws = createWebSocketConnection();

server.listen(4000, () => {
    console.log('Servidor inicializado en el puerto 4000');
    enviarEstadisticasMensajes();
});



